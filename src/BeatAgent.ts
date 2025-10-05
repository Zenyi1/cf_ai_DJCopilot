import { DurableObject } from "@cloudflare/workers-types";
import { Env } from "./index";

export interface BeatState {
  currentTrack: string | null;
  history: Array<{
    track: string;
    timestamp: number;
    accepted: boolean;
  }>;
  lastSuggestions: {
    suggestions: string[];
    transition_plan: string;
  } | null;
}

export class BeatAgent implements DurableObject {
  private env: Env;
  private ctx: DurableObjectState;
  private state: BeatState;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;

    // Initialize state from storage or create default
    this.state = {
      currentTrack: null,
      history: [],
      lastSuggestions: null
    };
  }

  async analyzeVibe(input: string): Promise<{ suggestions: string[], transition_plan: string }> {
    try {
      const prompt = `You are BeatPilot, an AI DJ assistant. Based on the current track or vibe description, suggest 3 tracks that would mix well as the next song in a DJ set. Also provide a brief transition plan.

Input: "${input}"

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "suggestions": ["Sandstorm - Darude (128 BPM)", "Levels - Avicii (126 BPM)", "Animals - Martin Garrix (128 BPM)"],
  "transition_plan": "Gradually increase energy while maintaining the current BPM range. Use a 16-bar phrase to mix in the new track."
}

Choose from well-known, real electronic/dance songs that actually exist. Use real artists and accurate BPM values. Popular choices include: Darude, Avicii, Martin Garrix, David Guetta, Calvin Harris, Swedish House Mafia, Tiesto, Armin van Buuren, Hardwell, Dimitri Vegas & Like Mike.`;

      console.log("Calling AI with input:", input);

      const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8' as any, {
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      let suggestions;
      try {
        // Handle different response formats from Workers AI
        const responseText = (response as any).response || (response as any).result || response.toString();
        console.log("AI Response:", responseText);

        // Try multiple approaches to extract clean JSON
        let cleanedResponse = responseText;

        // Approach 1: Extract JSON between first { and last }
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        // Approach 2: Manual cleanup for stubborn formatting
        cleanedResponse = cleanedResponse
          .replace(/([{,]\s*)"\s*:\s*"/g, '$1": "')  // Fix quotes around keys
          .replace(/"\s*,\s*"/g, '", "')            // Fix quotes in arrays
          .replace(/\s*\n\s*/g, ' ')                 // Replace newlines with spaces
          .replace(/\s*,\s*/g, ', ')                 // Normalize comma spacing
          .replace(/\s*:\s*/g, ': ')                 // Normalize colon spacing
          .replace(/\s+/g, ' ')                      // Multiple spaces to single
          .replace(/,\s*([}\]])/g, '$1')             // Remove trailing commas
          .trim();

        // Last resort: try to fix specific issues we know about
        try {
          // Check if it ends with a quote but should end with a brace
          if (cleanedResponse.endsWith('"') && !cleanedResponse.endsWith('"}')) {
            cleanedResponse = cleanedResponse.slice(0, -1) + '"}';
          }

          // Ensure it starts and ends correctly
          if (!cleanedResponse.startsWith('{')) {
            cleanedResponse = '{' + cleanedResponse;
          }

          console.log("Final cleaned response:", cleanedResponse);
          console.log("Length:", cleanedResponse.length);

          suggestions = JSON.parse(cleanedResponse);
        } catch (finalError) {
          console.error("Even after cleaning, JSON parsing failed:", finalError);
          console.error("Attempting manual fix...");

          // Ultimate fallback: manually construct from the response
          try {
            const suggestionsMatch = responseText.match(/"suggestions":\s*\[(.*?)\]/s);
            const transitionMatch = responseText.match(/"transition_plan":\s*"([^"]+)"/);

            if (suggestionsMatch && transitionMatch) {
              const suggestionsText = suggestionsMatch[1];
              const transitionPlan = transitionMatch[1];

              // Parse the suggestions array manually
              const suggestionItems = suggestionsText.split(',').map((item: string) =>
                item.replace(/"/g, '').trim()
              );

              suggestions = {
                suggestions: suggestionItems,
                transition_plan: transitionPlan
              };

              console.log("Manual parsing succeeded:", suggestions);
            } else {
              throw new Error("Manual parsing also failed");
            }
          } catch (manualError) {
            console.error("Manual parsing failed too:", manualError);
            throw finalError;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        console.error("Raw response:", response);

        // Fallback: create a basic suggestion if JSON parsing fails
        suggestions = {
          suggestions: [
            "Sandstorm - Darude (128 BPM)",
            "Levels - Avicii (126 BPM)",
            "Animals - Martin Garrix (128 BPM)"
          ],
          transition_plan: "Gradually increase energy while maintaining the current BPM range. Use a 16-bar phrase to mix in the new track."
        };
      }

      this.state.lastSuggestions = suggestions;

      // Save state to storage
      await this.ctx.storage.put("state", this.state);

      return suggestions;
    } catch (error) {
      console.error("Error calling Workers AI:", error);

      // Fallback suggestions if AI fails completely
      const fallbackSuggestions = {
        suggestions: [
          "Sandstorm - Darude (128 BPM)",
          "Levels - Avicii (126 BPM)",
          "Animals - Martin Garrix (128 BPM)"
        ],
        transition_plan: "Gradually increase energy while maintaining the current BPM range. Use a 16-bar phrase to mix in the new track."
      };

      this.state.lastSuggestions = fallbackSuggestions;
      await this.ctx.storage.put("state", this.state);

      return fallbackSuggestions;
    }
  }

  async acceptSuggestion(trackIndex: number): Promise<void> {
    if (!this.state.lastSuggestions || !this.state.lastSuggestions.suggestions[trackIndex]) {
      throw new Error("No suggestion available at this index");
    }

    const acceptedTrack = this.state.lastSuggestions.suggestions[trackIndex];

    this.state.currentTrack = acceptedTrack;
    this.state.history.push({
      track: acceptedTrack,
      timestamp: Date.now(),
      accepted: true
    });

    // Save state to storage
    await this.ctx.storage.put("state", this.state);
  }

  async getSessionSummary(): Promise<{ totalTracks: number, averageBPM?: number, preferredGenres?: string[] }> {
    const history = this.state.history.filter(h => h.accepted);

    if (history.length === 0) {
      return { totalTracks: 0 };
    }

    // Extract BPM from track strings (simple regex for demo)
    const bpmMatches = this.state.history.filter(h => h.accepted).map((h: { track: string; timestamp: number; accepted: boolean }) => {
      const match = h.track.match(/BPM:\s*(\d+)/i);
      return match ? parseInt(match[1]) : null;
    }).filter((bpm: number | null): bpm is number => bpm !== null);

    const averageBPM = bpmMatches.length > 0
      ? Math.round(bpmMatches.reduce((a, b) => a + b, 0) / bpmMatches.length)
      : undefined;

    return {
      totalTracks: history.length,
      averageBPM,
      preferredGenres: [] // Could be enhanced with genre extraction
    };
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket connections for realtime updates
    if (request.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = Object.values(new WebSocketPair());

      server.accept();

      server.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "analyze_vibe") {
            const result = await this.analyzeVibe(data.input);
            server.send(JSON.stringify({
              type: "suggestions",
              data: result
            }));
          }

          if (data.type === "accept_suggestion") {
            await this.acceptSuggestion(data.trackIndex);
            server.send(JSON.stringify({
              type: "suggestion_accepted",
              data: { track: this.state.currentTrack }
            }));
          }

          if (data.type === "get_summary") {
            const summary = await this.getSessionSummary();
            server.send(JSON.stringify({
              type: "session_summary",
              data: summary
            }));
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
          server.send(JSON.stringify({
            type: "error",
            data: { message: "Failed to process request" }
          }));
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("BeatAgent API", { status: 200 });
  }
}
