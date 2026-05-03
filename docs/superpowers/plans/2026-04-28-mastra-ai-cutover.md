# Mastra AI Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all runtime AI traffic in Genesis onto Mastra-backed endpoints and models, removing the Gemini provider path from the active application flow.

**Architecture:** Keep the existing Mastra app structure, but repoint its agents and workflows to OpenAI-compatible model router strings and a shared server-side AI gateway. Browser-side AI calls will route directly to the Mastra server, while the legacy `/api/ai-generate` and `/api/ai-bytez` entrypoints remain as compatibility wrappers that no longer talk to Gemini.

**Tech Stack:** TypeScript, Mastra, Hono, Supabase auth, OpenAI chat/embeddings REST APIs, Bytez image API.

---

### Task 1: Add a shared Mastra AI gateway

**Files:**

- Create: `apps/genesis-app/mastra/lib/aiGateway.ts`

- [ ] **Step 1: Define request normalization and provider helpers**

```ts
type LegacyGeminiMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type LegacyGeminiContents = { role?: string; parts?: Array<{ text?: string }> }[];

export function normalizeTextModel(model?: string): string;
export function legacyContentsToMessages(contents: LegacyGeminiContents): LegacyGeminiMessage[];
export async function generateTextFromRequest(input: {
  model?: string;
  prompt?: string;
  contents?: LegacyGeminiContents;
  messages?: LegacyGeminiMessage[];
  systemInstruction?: string;
  config?: Record<string, unknown>;
  maxTokens?: number;
}): Promise<{ text: string; raw: unknown; model: string }>;
export async function generateEmbeddingVector(text: string): Promise<number[]>;
export async function generateBytezImage(input: {
  model: string;
  prompt: string;
}): Promise<string | null>;
```

- [ ] **Step 2: Run a type-check against the new module shape**

Run: `bun run type-check --filter=@genesis/app`
Expected: the new module type-checks without importing Gemini-only SDKs.

- [ ] **Step 3: Implement the OpenAI and Bytez HTTP calls**

```ts
// OpenAI chat completions for text
// OpenAI embeddings for brand voice RAG
// Bytez run endpoint for images
```

- [ ] **Step 4: Verify the helper compiles**

Run: `bun run type-check --filter=@genesis/app`
Expected: PASS

### Task 2: Repoint Mastra agents to OpenAI model router strings

**Files:**

- Modify: `apps/genesis-app/mastra/lib/geminiProvider.ts`
- Modify: `apps/genesis-app/mastra/agents/*.ts`

- [ ] **Step 1: Convert the compatibility helper**

```ts
export function getGeminiModel(modelId = 'gpt-4o-mini'): string {
  return `openai/${modelId}`;
}
```

- [ ] **Step 2: Keep agent imports stable**

```ts
import { getGeminiModel } from '../lib/geminiProvider';
```

- [ ] **Step 3: Verify the agent config still resolves**

Run: `bun run type-check --filter=@genesis/app`
Expected: PASS

### Task 3: Move the book generation and brand voice workflows off Gemini

**Files:**

- Modify: `apps/genesis-app/mastra/workflows/bookGenerationWorkflow.ts`
- Modify: `apps/genesis-app/mastra/workflows/brandVoiceRAGWorkflow.ts`
- Modify: `apps/genesis-app/mastra/test-pipeline.ts`

- [ ] **Step 1: Replace direct Gemini REST calls with the shared gateway**

```ts
const rawText = await generateTextFromRequest({
  model: 'openai/gpt-4o',
  prompt: buildGenerationPrompt(settings),
  maxTokens: 8192,
  config: { responseMimeType: 'application/json' },
});
```

- [ ] **Step 2: Replace Google embedding calls with OpenAI embeddings**

```ts
const embedding = await generateEmbeddingVector(text);
```

- [ ] **Step 3: Remove the direct `@google/genai` test path**

```ts
// Keep the test-pipeline focused on the Mastra model/router path.
```

- [ ] **Step 4: Verify the workflow files type-check**

Run: `bun run type-check --filter=@genesis/app`
Expected: PASS

### Task 4: Expose AI routes from the Mastra server

**Files:**

- Modify: `apps/genesis-app/mastra/server.ts`
- Modify: `api/ai-generate.ts`
- Modify: `api/ai-bytez.ts`

- [ ] **Step 1: Add `/api/ai-generate` and `/api/ai-bytez` handlers to the Mastra server**

```ts
app.post('/api/ai-generate', async (c) => {
  const result = await generateTextFromRequest(await c.req.json());
  return c.json(result);
});
```

- [ ] **Step 2: Make the legacy Vercel routes use the same helper**

```ts
const result = await generateTextFromRequest(req.body ?? {});
return res.status(200).json(result);
```

- [ ] **Step 3: Verify the server still boots**

Run: `bun run mastra:dev`
Expected: the Hono server starts and serves the AI routes.

### Task 5: Redirect browser AI calls to Mastra

**Files:**

- Modify: `apps/genesis-app/services/api/authenticatedFetch.ts`
- Modify: `apps/genesis-app/services/geminiService.ts`
- Modify: `apps/genesis-app/services/grokService.ts`
- Modify: `apps/genesis-app/services/curriculumService.ts`
- Modify: `apps/genesis-app/lib/gen/genBrain.ts`

- [ ] **Step 1: Route only AI endpoints to the Mastra server**

```ts
if (url === '/api/ai-generate' || url === '/api/ai-bytez') {
  return fetch(`${MASTRA_BASE_URL}${url}`, { ...options, headers });
}
```

- [ ] **Step 2: Update the service constants and logs to use OpenAI/Mastra wording**

```ts
const TEXT_MODEL = 'openai/gpt-4o-mini';
```

- [ ] **Step 3: Verify browser-facing AI still points at the same JSON contract**

Run: `bun run type-check --filter=@genesis/app`
Expected: PASS

### Task 6: Clean up stale Gemini health/docs references

**Files:**

- Modify: `api/health.ts`
- Modify: `apps/genesis-app/.env.example`
- Modify: `apps/genesis-app/config/env.ts`
- Modify: `apps/genesis-app/pages/legal/PrivacyPage.tsx`
- Modify: `apps/genesis-app/pages/legal/TermsPage.tsx`
- Modify: `apps/genesis-app/public/llms.txt`

- [ ] **Step 1: Rename visible Gemini references to provider-agnostic or OpenAI wording**

```ts
gemini: { state: 'CLOSED', failures: 0, successRate: 0.99 }
```

- [ ] **Step 2: Update the env examples to match the new provider**

```env
OPENAI_API_KEY=your_openai_api_key_here
```

- [ ] **Step 3: Verify no runtime Gemini calls remain**

Run: `rg -n "@google/genai|generativelanguage.googleapis.com|GEMINI_API_KEY_1|GOOGLE_GENERATIVE_AI_API_KEY" apps/genesis-app api`
Expected: only legacy comments or no matches.

### Task 7: Verify the cutover end to end

**Files:**

- No additional files

- [ ] **Step 1: Run type-check**

Run: `bun run type-check`
Expected: PASS

- [ ] **Step 2: Run targeted search for Gemini runtime usage**

Run: `rg -n "@google/genai|generativelanguage.googleapis.com|GEMINI_API_KEY_1|GOOGLE_GENERATIVE_AI_API_KEY" apps/genesis-app api`
Expected: no active runtime call sites.

- [ ] **Step 3: Start the app and Mastra server together**

Run: `bun run dev:both`
Expected: the frontend loads and AI requests resolve through Mastra-backed routes.
