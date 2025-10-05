# DJ Co-Pilot

The same way developer have cursor, I believe there will come a time when most professions will have their own copilot. So I thought of a random cool job like DJs and tried to build a copilot for them. Using the cloudflare submission requirements.

A sophisticated AI-powered DJ assistant built on Cloudflare's edge computing platform. BeatPilot provides real-time song suggestions and transition plans to help DJs create seamless andengaging sets.


##  Features

-  Uses Cloudflare Workers AI (Llama 2) to generate contextual song recommendations
-  Suggests actual, well-known electronic/dance tracks with accurate BPM values (can still hallucinate if context goes beyond 5 tracks or if asked to recommend track that does not exist)
-  WebSocket-powered live communication between frontend and AI
- Durable Objects store DJ session history and preferences
-  Provides detailed transition plans for seamless mixing
-  Built entirely on Cloudflare's global edge network

## Quick Start

### Prerequisites

- Node.js 16+
- Cloudflare account with Workers & Pages enabled
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/zenyic/cf_ai_DJCopilot.git
   cd beatpilot-mvp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Cloudflare (one-time)**
   ```bash
   # Login to Cloudflare
   npx wrangler login

   # Deploy to Cloudflare
   npm run deploy
   ```

### Development

1. **Start local development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   Navigate to `http://127.0.0.1:8787`

3. **Start DJing**
   - Enter your current track or crowd vibe
   - Get AI-powered song suggestions
   - Follow the transition plan for mixing

## Usage

### Basic Workflow

1. **Start Session**: Click "Start New Session" to begin
2. **Describe Current Track**: Enter details like "Playing deep house at 122 BPM, crowd is mellow"
3. **Get Suggestions**: Receive 3 AI-curated song recommendations with BPM info
4. **Review Transition Plan**: Follow the detailed mixing instructions
5. **Accept & Continue**: Click "Use this track" to log your choice and get the next suggestions

### Example Interaction

```
You: "Playing tech house at 124 BPM, need next track"
BeatPilot: 🎵 Suggested Tracks:
• Sandstorm - Darude (128 BPM)
• Levels - Avicii (126 BPM)
• Animals - Martin Garrix (128 BPM)

🎛️ Transition Plan:
Gradually increase energy while maintaining the current BPM range. Use a 16-bar phrase to mix in the new track.
```

##  Architecture

### Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript with WebSocket integration
- **Backend**: Cloudflare Workers with Durable Objects
- **AI**: Cloudflare Workers AI (Llama 2 7B model)
- **Storage**: Durable Objects with SQLite backend
- **Real-time**: WebSocket connections via Durable Objects
- **Deployment**: Cloudflare Pages + Workers

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │◄──►│  Durable Object  │◄──►│  Workers AI     │
│   (Pages)       │    │  (BeatAgent)     │    │  (Llama 2)      │
│                 │    │                  │    │                 │
│ - Chat UI       │    │ - Session State  │    │ - Song Sugges-  │
│ - WebSocket     │    │ - AI Integration │    │   tions         │
│ - Real-time     │    │ - Storage        │    │ - Transition    │
│   Updates       │    │ - WebSocket      │    │   Plans         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Configuration

### Wrangler Configuration (`wrangler.toml`)

```toml
name = "beatpilot-mvp"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[site]
bucket = "./public"

[[durable_objects.bindings]]
name = "BEAT_AGENT"
class_name = "BeatAgent"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "beatpilot-memory"

[[migrations]]
tag = "v1"
new_classes = ["BeatAgent"]
```

##  Limitations & Future Enhancements

### Current Limitations

- **AI Model Constraints**: Uses Llama 2 7B (smaller model) for faster responses
- **Song Variety**: Limited to electronic/dance genres in current implementation
- **BPM Detection**: Relies on manual BPM input rather than audio analysis
- **Session Storage**: Limited to single-user sessions (no multi-DJ collaboration)
- **Offline Capability**: Requires internet connection for AI suggestions

### Potential Enhancements

- **Audio Analysis**: Real-time BPM detection from uploaded samples
- **Genre Expansion**: Support for hip-hop, rock, and other genres
- **Multi-User Sessions**: Collaborative DJ sessions with multiple participants
- **Music Library Integration**: Spotify/YouTube API integration for richer metadata
- **Advanced Transitions**: Harmonic mixing suggestions based on key detection
- **Historical Learning**: Vectorize integration for learning from past successful transitions


## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

##  License

MIT License - see LICENSE file for details

