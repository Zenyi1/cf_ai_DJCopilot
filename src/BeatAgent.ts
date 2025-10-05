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
  "suggestions": ["Track 1 - Artist 1 (BPM: 120)", "Track 2 - Artist 2 (BPM: 122)", "Track 3 - Artist 3 (BPM: 121)"],
  "transition_plan": "Gradually increase energy while maintaining the current BPM range. Use a 16-bar phrase to mix in the new track."
}

Do not include any other text, explanations, or markdown formatting. Only the JSON object.`;

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

        // More robust JSON cleaning for multi-line responses
        let cleanedResponse = responseText.replace(/\n/g, ' ');

        // Handle cases where newlines break JSON structure
        cleanedResponse = cleanedResponse
          .replace(/,\s*\n\s*/g, ', ')
          .replace(/:\s*\n\s*/g, ': ')
          .replace(/\s+/g, ' ')
          .trim();

        // Additional cleanup for common AI formatting issues
        cleanedResponse = cleanedResponse
          .replace(/,\s*]/g, ']')
          .replace(/,\s*}/g, '}');

        console.log("Cleaned Response:", cleanedResponse);

        suggestions = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        console.error("Raw response:", response);

        // Fallback: create a basic suggestion if JSON parsing fails
        suggestions = {
          suggestions: [
            "Lost Frequencies - Solomun (BPM: 120)",
            "Higher Ground - Andhim (BPM: 122)",
            "Say My Name - Oliver Heldens (BPM: 121)"
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
          "Lost Frequencies - Solomun (BPM: 120)",
          "Higher Ground - Andhim (BPM: 122)",
          "Say My Name - Oliver Heldens (BPM: 121)"
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
