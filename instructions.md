This is a project to be fast tracked to an interview for cloudflare internship.

You need to strictly use AI agents from https://developers.cloudflare.com/agents

# BeatPilot MVP — Cloudflare AI DJ Co‑Pilot

> Minimal viable prototype (MVP) for the BeatPilot concept — an AI co‑pilot for DJs that generates real‑time song suggestions and transition plans using Cloudflare Workers AI, Agents, Workflows, and Pages.

---

## 🎯 Goal

Build a lightweight but functional demo that:

1. Accepts user input (text or short audio clip) describing the current track or crowd vibe.
2. Calls **Workers AI (Llama 3.3)** to generate 2–3 song suggestions and a transition plan.
3. Displays results instantly via a **Pages** UI connected to a **Durable Object Agent**.
4. Stores basic session memory in the Agent (e.g., last track, accepted suggestion).

---

## 🧠 Architecture Overview

```
Frontend (Pages + Realtime) <--> Agent (Durable Object)
                                  |--> Workers AI (Llama 3.3)
                                  |--> Vectorize (optional for memory)
```

### Components

* **Pages + Realtime**: Frontend for user input + live suggestions.
* **Durable Object Agent**: Stores current session state, manages model calls.
* **Workers AI (Llama 3.3)**: Provides reasoning and suggestion generation.
* **Vectorize (optional)**: Remembers prior accepted suggestions.

---

## ⚙️ Core MVP Flow

### 1. User starts a new DJ session

* Pages app calls `/new-session` → creates a new Agent instance.
* Agent initializes with empty state: `{ currentTrack: null, history: [] }`

### 2. User inputs current track or vibe

* Example: “I’m playing a deep house track around 122 BPM, crowd is mellow.”
* Agent sends this text to **Workers AI (Llama 3.3)** with a short prompt to get 2–3 next track ideas and a basic transition plan.

**Prompt example:**

```
System: You are BeatPilot, a DJ assistant. Suggest 3 tracks that would mix well into the following set.
Input: {user_input}
Output JSON: {"suggestions": ["track1","track2"], "transition_plan": "..."}
```

### 3. Workers AI returns suggestions

* Agent saves them to state and pushes the result to all connected clients via Realtime.

### 4. DJ selects one suggestion

* Client clicks “Use this track” → Agent logs decision and updates history.

### 5. (Optional) Post‑Set Summary

* Agent summarizes the session (e.g., “2 transitions, preferred BPM range 120–125”).
* Displays in UI as a mini recap.

---

## 🧩 Example `BeatAgent.ts`

```ts
import { Agent } from "agents";
export class BeatAgent extends Agent {
  async analyzeVibe(input) {
    const response = await env.AI.run('@cf/meta/llama-3.3-8b-instruct', {
      prompt: `You are BeatPilot. Suggest 3 tracks that mix well into: ${input}`,
      max_tokens: 150
    });
    const suggestions = JSON.parse(response.output_text || '{}');
    this.setState({ lastInput: input, lastSuggestions: suggestions });
    return suggestions;
  }
}
```

---

## 🖥️ Pages UI (MVP)

* Simple chat‑style interface:

  * Textbox for DJ input.
  * Button to send query.
  * Display suggestions + transition plan.
* Use **Realtime** to connect to Agent and auto‑update suggestions.

---

## 📦 Deployment Steps

1. Create new project:

   ```bash
   npm create cloudflare@latest beatpilot-mvp -- --template=cloudflare/agents-starter
   ```
2. Add **Workers AI** and **Agents** bindings in `wrangler.toml`:

   ```toml
   [[durable_objects.bindings]]
   name = "BEAT_AGENT"
   class_name = "BeatAgent"
   ```
3. Deploy the Worker and Pages site:

   ```bash
   npx wrangler deploy
   npx wrangler pages publish ./public
   ```
4. Test locally with `wrangler dev` and verify roundtrip from input → AI → response.

---

## 🚀 Stretch (if time allows)

* Add Vectorize memory to recall previous gigs.
* Add simple BPM detection for uploaded samples.
* Add persistent session history in Durable Object.

---

## ✅ Reviewer Demo Script (under 2 minutes)

1. Open Pages UI → click **Start Session**.
2. Enter: “Playing tech house 124 BPM, need next track.”
3. Get 3 AI suggestions + a transition plan.
4. Click “Use track” to log it.
5. Show history summary.

---

**Why this MVP works:** It highlights Cloudflare’s edge AI stack (Workers AI + Agents + Pages + Realtime) with a creative, music-driven use case, and keeps everything minimal and reviewable within 5–10 minutes.
