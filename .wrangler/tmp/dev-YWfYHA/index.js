var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-6fuvHN/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-6fuvHN/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/BeatAgent.ts
var BeatAgent = class {
  env;
  ctx;
  state;
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = {
      currentTrack: null,
      history: [],
      lastSuggestions: null
    };
  }
  async analyzeVibe(input) {
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
      const response = await this.env.AI.run("@cf/meta/llama-2-7b-chat-int8", {
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
        const responseText = response.response || response.result || response.toString();
        console.log("AI Response:", responseText);
        let cleanedResponse = responseText.replace(/\n/g, " ");
        cleanedResponse = cleanedResponse.replace(/,\s*\n\s*/g, ", ").replace(/:\s*\n\s*/g, ": ").replace(/\s+/g, " ").trim();
        cleanedResponse = cleanedResponse.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
        console.log("Cleaned Response:", cleanedResponse);
        suggestions = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        console.error("Raw response:", response);
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
      await this.ctx.storage.put("state", this.state);
      return suggestions;
    } catch (error) {
      console.error("Error calling Workers AI:", error);
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
  async acceptSuggestion(trackIndex) {
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
    await this.ctx.storage.put("state", this.state);
  }
  async getSessionSummary() {
    const history = this.state.history.filter((h) => h.accepted);
    if (history.length === 0) {
      return { totalTracks: 0 };
    }
    const bpmMatches = this.state.history.filter((h) => h.accepted).map((h) => {
      const match = h.track.match(/BPM:\s*(\d+)/i);
      return match ? parseInt(match[1]) : null;
    }).filter((bpm) => bpm !== null);
    const averageBPM = bpmMatches.length > 0 ? Math.round(bpmMatches.reduce((a, b) => a + b, 0) / bpmMatches.length) : void 0;
    return {
      totalTracks: history.length,
      averageBPM,
      preferredGenres: []
      // Could be enhanced with genre extraction
    };
  }
  async fetch(request) {
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
};
__name(BeatAgent, "BeatAgent");

// src/index.ts
async function serveStaticFile(pathname) {
  if (pathname === "/" || pathname === "") {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BeatPilot - AI DJ Co-Pilot</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .header h1 {
            color: white;
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .header p {
            color: rgba(255, 255, 255, 0.8);
        }

        .container {
            flex: 1;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            width: 100%;
        }

        .session-controls {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 2rem;
            margin-bottom: 2rem;
            text-align: center;
        }

        .btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.3s;
            margin: 0 10px;
        }

        .btn:hover {
            background: #45a049;
        }

        .btn:disabled {
            background: #cccccc;
            cursor: not-allowed;
        }

        .btn.secondary {
            background: #2196F3;
        }

        .btn.secondary:hover {
            background: #0b7dda;
        }

        .chat-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            height: 500px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .chat-messages {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .message {
            padding: 1rem;
            border-radius: 10px;
            max-width: 80%;
        }

        .message.user {
            background: #4CAF50;
            color: white;
            align-self: flex-end;
        }

        .message.ai {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            align-self: flex-start;
        }

        .suggestions {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            padding: 1rem;
        }

        .suggestion-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.5rem;
            margin: 0.5rem 0;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .suggestion-item:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .transition-plan {
            font-style: italic;
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 8px;
        }

        .chat-input-container {
            padding: 1rem;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            gap: 1rem;
        }

        .chat-input {
            flex: 1;
            padding: 12px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 1rem;
        }

        .chat-input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }

        .chat-input:focus {
            outline: none;
            border-color: #4CAF50;
        }

        .session-info {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 1rem;
            margin-top: 1rem;
        }

        .status {
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            display: inline-block;
        }

        .status.connected {
            background: #4CAF50;
            color: white;
        }

        .status.disconnected {
            background: #f44336;
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>\u{1F3A7} BeatPilot</h1>
        <p>AI DJ Co-Pilot for Perfect Transitions</p>
    </div>

    <div class="container">
        <div class="session-controls">
            <h2>DJ Session Control</h2>
            <p>Start a new session or connect to an existing one</p>
            <div style="margin-top: 1rem;">
                <button class="btn" onclick="startNewSession()">Start New Session</button>
                <button class="btn secondary" onclick="getSessionSummary()">Get Summary</button>
            </div>
            <div id="session-status" class="status disconnected" style="margin-top: 1rem;">
                Disconnected
            </div>
        </div>

        <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
                <div class="message ai">
                    <strong>BeatPilot:</strong> Welcome to BeatPilot! Describe your current track or crowd vibe, and I'll suggest the perfect next tracks with transition plans.
                </div>
            </div>

            <div class="chat-input-container">
                <input type="text" class="chat-input" id="vibe-input"
                       placeholder="e.g., 'Playing deep house at 122 BPM, crowd is mellow...'"
                       onkeypress="handleKeyPress(event)">
                <button class="btn" onclick="analyzeVibe()">Get Suggestions</button>
            </div>
        </div>

        <div class="session-info" id="session-info" style="display: none;">
            <h3>Session Summary</h3>
            <div id="summary-content"></div>
        </div>
    </div>

    <script>
        let sessionId = null;
        let ws = null;
        let isConnected = false;

        function startNewSession() {
            fetch('/new-session', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    sessionId = data.sessionId;
                    connectWebSocket(data.agentUrl);
                    addMessage('ai', \`New session started! Session ID: \${sessionId}\`);
                })
                .catch(error => {
                    console.error('Error starting session:', error);
                    addMessage('ai', 'Failed to start session. Please try again.');
                });
        }

        function connectWebSocket(agentUrl) {
            if (ws) {
                ws.close();
            }

            // Use the same origin for WebSocket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\${agentUrl}\`;

            ws = new WebSocket(wsUrl);

            ws.onopen = function() {
                isConnected = true;
                document.getElementById('session-status').textContent = 'Connected';
                document.getElementById('session-status').className = 'status connected';
                console.log('WebSocket connected');
            };

            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };

            ws.onclose = function() {
                isConnected = false;
                document.getElementById('session-status').textContent = 'Disconnected';
                document.getElementById('session-status').className = 'status disconnected';
                console.log('WebSocket disconnected');
            };

            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
                addMessage('ai', 'Connection error. Please refresh and try again.');
            };
        }

        function handleWebSocketMessage(data) {
            switch (data.type) {
                case 'suggestions':
                    displaySuggestions(data.data);
                    break;
                case 'suggestion_accepted':
                    addMessage('ai', \`\u2705 Track accepted: \${data.data.track}\`);
                    break;
                case 'session_summary':
                    displaySessionSummary(data.data);
                    break;
                case 'error':
                    addMessage('ai', \`\u274C Error: \${data.data.message}\`);
                    break;
            }
        }

        function analyzeVibe() {
            const input = document.getElementById('vibe-input').value.trim();
            if (!input) return;

            if (!isConnected) {
                addMessage('ai', 'Please start a session first.');
                return;
            }

            addMessage('user', input);

            ws.send(JSON.stringify({
                type: 'analyze_vibe',
                input: input
            }));

            document.getElementById('vibe-input').value = '';
        }

        function displaySuggestions(data) {
            const suggestionsHtml = data.suggestions.map((suggestion, index) =>
                \`<div class="suggestion-item" onclick="acceptSuggestion(\${index})">
                    \${suggestion}
                </div>\`
            ).join('');

            const messageHtml = \`
                <div class="suggestions">
                    <strong>\u{1F3B5} Suggested Tracks:</strong><br>
                    \${suggestionsHtml}
                    <div class="transition-plan">
                        <strong>\u{1F39B}\uFE0F Transition Plan:</strong><br>
                        \${data.transition_plan}
                    </div>
                </div>
            \`;

            addMessage('ai', messageHtml, false);
        }

        function acceptSuggestion(index) {
            if (!isConnected) return;

            ws.send(JSON.stringify({
                type: 'accept_suggestion',
                trackIndex: index
            }));

            // Visual feedback
            const suggestions = document.querySelectorAll('.suggestion-item');
            if (suggestions[index]) {
                suggestions[index].style.background = 'rgba(76, 175, 80, 0.3)';
            }
        }

        function getSessionSummary() {
            if (!isConnected) {
                addMessage('ai', 'Please start a session first.');
                return;
            }

            ws.send(JSON.stringify({
                type: 'get_summary'
            }));
        }

        function displaySessionSummary(summary) {
            const summaryDiv = document.getElementById('session-info');
            const contentDiv = document.getElementById('summary-content');

            contentDiv.innerHTML = \`
                <p><strong>Total Tracks Played:</strong> \${summary.totalTracks}</p>
                \${summary.averageBPM ? \`<p><strong>Average BPM:</strong> \${summary.averageBPM}</p>\` : ''}
            \`;

            summaryDiv.style.display = 'block';
        }

        function addMessage(type, content, isText = true) {
            const messagesDiv = document.getElementById('chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}\`;

            if (isText) {
                messageDiv.innerHTML = \`<strong>\${type === 'user' ? 'You:' : 'BeatPilot:'}</strong> \${content}\`;
            } else {
                messageDiv.innerHTML = content;
            }

            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                analyzeVibe();
            }
        }

        // Auto-start session on page load for demo
        window.onload = function() {
            setTimeout(() => {
                startNewSession();
            }, 500);
        };
    <\/script>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html" }
    });
  }
  return new Response("Not Found", { status: 404 });
}
__name(serveStaticFile, "serveStaticFile");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/new-session" && request.method === "POST") {
      const id = env.BEAT_AGENT.newUniqueId();
      const agent = env.BEAT_AGENT.get(id);
      return new Response(JSON.stringify({
        sessionId: id.toString(),
        agentUrl: `/agent/${id.toString()}`
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname.startsWith("/agent/") && request.headers.get("Upgrade") === "websocket") {
      const agentId = url.pathname.split("/agent/")[1];
      const agent = env.BEAT_AGENT.get(env.BEAT_AGENT.idFromString(agentId));
      return await agent.fetch(request);
    }
    if (request.method === "GET" && !url.pathname.startsWith("/agent/")) {
      return await serveStaticFile(url.pathname);
    }
    return new Response("BeatPilot API", { status: 200 });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-6fuvHN/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-6fuvHN/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  BeatAgent,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
