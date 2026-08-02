**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Agent Integration — Vercel AI SDK

Backend server implementation for the AgentPanel, powered by the [Vercel AI SDK](https://sdk.vercel.ai).

## Architecture

```
src/
├── lib/ai/
│   ├── types.ts          # Shared TypeScript types & constants
│   ├── providers.ts      # Provider factory (OpenAI, Anthropic, Google, Grok, Ollama)
│   ├── agent.ts          # Agent orchestration (streamText, generateText, executeTool)
│   ├── tools/
│   │   └── index.ts      # Tool definitions with Zod schemas
│   ├── prompts.ts        # System prompt templates
│   ├── memory.ts         # Conversation history management
│   └── utils.ts          # Validation, error handling, logging
└── routes/api/agent/
    ├── +server.ts        # POST /api/agent — main streaming chat endpoint
    ├── config/
    │   └── +server.ts    # GET /api/agent/config — provider/model/tool metadata
    └── tools/
        └── +server.ts    # GET+POST /api/agent/tools — standalone tool execution
```

## API Endpoints

### POST `/api/agent` — Streaming Chat

The primary endpoint. Sends messages to the AI and streams back a response.

**Request body:**

```json
{
  "messages": [{ "role": "user", "content": "Hello, what can you do?" }],
  "provider": "openai",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "tools": ["get_current_time", "get_weather"],
  "conversationId": "optional-uuid-for-history"
}
```

| Field              | Type            | Required | Default              | Description                                             |
| ------------------ | --------------- | -------- | -------------------- | ------------------------------------------------------- |
| `messages`         | `CoreMessage[]` | Yes      | —                    | Conversation in AI SDK format                           |
| `provider`         | `string`        | No       | `"openai"`           | `openai`, `anthropic`, `gemini`, `grok`, `ollama`       |
| `model`            | `string`        | No       | Provider default     | Model ID (e.g. `gpt-4o`, `claude-sonnet-4`)             |
| `system`           | `string`        | No       | Default Bento prompt | System prompt override. Empty string = no system prompt |
| `temperature`      | `number`        | No       | `0.7`                | Sampling temperature (0–2)                              |
| `maxTokens`        | `number`        | No       | `4096`               | Maximum tokens to generate                              |
| `topP`             | `number`        | No       | `1`                  | Nucleus sampling                                        |
| `topK`             | `number`        | No       | —                    | Top-k sampling (provider-dependent)                     |
| `presencePenalty`  | `number`        | No       | `0`                  | -2 to 2                                                 |
| `frequencyPenalty` | `number`        | No       | `0`                  | -2 to 2                                                 |
| `stop`             | `string[]`      | No       | —                    | Stop sequences                                          |
| `tools`            | `string[]`      | No       | All built-in         | Tool names to enable. `[]` = no tools                   |
| `conversationId`   | `string`        | No       | —                    | UUID for conversation persistence                       |
| `apiKey`           | `string`        | No       | Env var              | Override API key (dev only)                             |
| `baseUrl`          | `string`        | No       | Default              | Override provider base URL                              |

**Response:** Streaming response with `Content-Type: text/event-stream` using the AI SDK data stream protocol. Compatible with `useChat()` from `@ai-sdk/svelte`.

**Error responses:**

| Status | Code               | Meaning                |
| ------ | ------------------ | ---------------------- |
| 400    | `INVALID_JSON`     | Malformed request body |
| 422    | `VALIDATION_ERROR` | Zod validation failed  |
| 401    | `AGENT_ERROR`      | Authentication failure |
| 429    | `AGENT_ERROR`      | Rate limited           |
| 504    | `AGENT_ERROR`      | Request timed out      |
| 500    | `AGENT_ERROR`      | Internal error         |

---

### GET `/api/agent/config` — Configuration

Returns available providers, models, and tools for UI setup.

**Response:**

```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "models": ["gpt-4o", "gpt-4o-mini", "o3-mini"],
      "defaultModel": "gpt-4o",
      "requiresKey": true,
      "hasKey": false,
      "supportsTools": true,
      "supportsStructuredOutput": true
    }
  ],
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "toolGroups": [
    {
      "name": "utility",
      "tools": [
        { "name": "get_current_time", "description": "Get the current date and time" },
        { "name": "get_weather", "description": "Get weather for a location" }
      ]
    }
  ],
  "version": "1.0.0"
}
```

---

### POST `/api/agent/tools` — Execute Tool

Run a tool directly without a conversation.

**Request:**

```json
{
  "tool": "get_current_time",
  "args": { "timezone": "America/New_York" }
}
```

**Response:**

```json
{
  "result": {
    "iso": "2026-07-14T21:05:00.000Z",
    "formatted": "Tuesday, July 14, 2026 at 5:05:00 PM EDT",
    "timezone": "America/New_York"
  }
}
```

### GET `/api/agent/tools` — List Tools

Returns all available tools grouped by category.

---

## Environment Variables

Set these in `.env` (development) or configure via the BYOK settings UI (production):

```env
# OpenAI:     https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Anthropic:  https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini: https://aistudio.google.com/apikey
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# xAI (Grok): https://console.x.ai/
XAI_API_KEY=xai-...

# Ollama: No key needed
OLLAMA_BASE_URL=http://localhost:11434/v1
```

---

## Frontend Integration (High-Level)

The API routes handle everything server-side. The frontend only needs to:

1. **Fetch config** — Call `GET /api/agent/config` on mount to populate provider/model selectors.
2. **Stream chat** — Call `POST /api/agent` with user messages. The streaming response is consumed using the `useChat()` hook from `@ai-sdk/svelte` (recommended) or a manual `ReadableStream` reader.
3. **Execute tools** — Call `POST /api/agent/tools` for standalone tool usage.
4. **Manage conversation IDs** — Generate a UUID per conversation and pass it as `conversationId` to maintain history across messages.

The `useChat()` hook handles:

- Sending messages to `POST /api/agent`
- Parsing the streaming response
- Managing message state (append user messages, stream assistant responses)
- Tool call lifecycle (invocation → result)

**Key libraries to install on the frontend:**

- `@ai-sdk/svelte` — provides `useChat()`, `useAssistant()`
- `ai` — core types (`CoreMessage`, `ToolSet`)

---

## Adding a New Provider

1. Install the SDK package (e.g. `@ai-sdk/cohere`)
2. Add the provider ID to `ProviderId` in `src/lib/ai/types.ts`
3. Add models and feature flags in the same file
4. Add a factory function in `src/lib/ai/providers.ts`
5. Add the API key env var to `.env.example`

---

## Adding New Tools

1. Open `src/lib/ai/tools/index.ts`
2. Add a new entry to `builtinTools` (or `advancedTools` for opt-in tools):

```ts
my_tool: {
  toolGroup: "utility",
  description: "What this tool does",
  parameters: z.object({
    param1: z.string().describe("Description"),
  }),
  execute: async ({ param1 }) => {
    // Tool logic here
    return { result: "done" };
  },
},
```

3. The tool is automatically available — no routing changes needed.

---

## Adding RAG (Retrieval-Augmented Generation)

1. Create a new tool in `src/lib/ai/tools/index.ts` that queries your vector store
2. The tool receives search queries from the AI and returns relevant chunks
3. Configure the system prompt in `src/lib/ai/prompts.ts` to instruct the AI to use the RAG tool

---

## Conversation Persistence

Currently uses in-memory storage (`Map<string, CoreMessage[]>`).
For production, replace `src/lib/ai/memory.ts` with:

- **SQLite** via the existing Tauri store plugin
- **Supabase** via the existing Supabase client
- **Mastra Memory** (already a dependency: `@mastra/memory`)
- **Redis / Upstash**

The `memory.ts` module has a clean API (`getConversationHistory`, `appendToConversation`, `createConversation`, `clearConversation`) — swap the implementation without changing callers.

---

## Observability

The `agentLogger` in `src/lib/ai/utils.ts` logs structured entries to the console.
For production, integrate with:

- **Mastra Observability** (already a dependency: `@mastra/observability`)
- **OpenTelemetry** — automatic instrumentation via the AI SDK

---

## Production Deployment

These API routes work with the Vite dev server. For production in a Tauri app:

**Option 1: Tauri Rust Command**
Wrap `streamAgentResponse()` in a Tauri command and call it via `invoke()`.
The existing `src/lib/desktop/ai.ts` pattern shows how to stream via Tauri channels.

**Option 2: Embedded Server**
Run a lightweight HTTP server (Fastify/Hono) inside the Tauri Rust backend,
and have the frontend call `http://localhost:{PORT}/api/agent`.

**Option 3: SvelteKit Adapter**
Switch from `adapter-static` to `adapter-node` and deploy as a local server.
