# 🎧 BeatPilot - AI DJ Co-Pilot

A sophisticated AI-powered DJ assistant built on Cloudflare's edge computing platform. BeatPilot provides real-time song suggestions and transition plans to help DJs create seamless, engaging sets.

![BeatPilot Demo](https://via.placeholder.com/800x400/667eea/ffffff?text=BeatPilot+AI+DJ+Assistant)

## ✨ Features

- **🤖 AI-Powered Suggestions**: Uses Cloudflare Workers AI (Llama 2) to generate contextual song recommendations
- **🎵 Real Song Database**: Suggests actual, well-known electronic/dance tracks with accurate BPM values
- **⚡ Real-time Updates**: WebSocket-powered live communication between frontend and AI
- **💾 Session Persistence**: Durable Objects store DJ session history and preferences
- **🎛️ Smart Transitions**: Provides detailed transition plans for seamless mixing
- **🌐 Edge Computing**: Built entirely on Cloudflare's global edge network

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Cloudflare account with Workers & Pages enabled
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
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

3. **Start DJing!**
   - Enter your current track or crowd vibe
   - Get AI-powered song suggestions
   - Follow the transition plan for perfect mixing

## 📋 Usage

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

## 🏗️ Architecture

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

## ⚙️ Configuration

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

## 🚧 Limitations & Future Enhancements

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

## 🎯 Interview Demo Script

**Perfect for Cloudflare internship interviews!** Here's a 2-minute demo:

1. **Open BeatPilot UI** → Click "Start New Session"
2. **Enter DJ scenario** → "Playing tech house at 124 BPM, need next track"
3. **Show AI suggestions** → Display 3 real song recommendations
4. **Demonstrate transition plan** → Explain the mixing strategy
5. **Show session history** → Click "Get Summary" to show tracked preferences

**Key Talking Points:**
- "This showcases Cloudflare's AI + Durable Objects + Pages + Realtime stack"
- "The AI provides contextual suggestions using real electronic music knowledge"
- "Session state persists across the entire DJ set using Durable Objects"
- "WebSocket connections enable real-time AI responses"

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built for Cloudflare internship applications
- Powered by Cloudflare Workers AI and Durable Objects
- Inspired by the need for intelligent DJ assistance in live environments

---

**Ready to revolutionize DJing with AI? Start your BeatPilot session now! 🎧✨**