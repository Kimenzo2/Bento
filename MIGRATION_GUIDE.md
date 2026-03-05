# Genesis — Mastra Migration Guide

This document covers the complete migration from Genesis's legacy client-side AI
architecture to the new Mastra-powered server-side system.

---

## What Changed and Why

### Before (Legacy)
- React components called Gemini/Bytez APIs **directly from the browser**
- API keys were bundled in the Vite build (`VITE_GEMINI_API_KEY_*`)
- No durable state — refreshing the page during book generation lost all progress
- Rate limiting was client-side (easily bypassed)
- No structured quality checks or eval metrics

### After (Mastra)
- All AI calls go through the **Mastra Hono server** (`mastra/server.ts`, port 4111)
- API keys live **only on the server** — zero browser exposure
- Workflows are durable — suspend/resume survives page reloads
- Rate limiting and tier enforcement are server-enforced
- Built-in OpenTelemetry tracing + custom `bookQualityScorer` eval

---

## Architecture

```
Browser (Vite/React)
  └── mastraClient.ts  (typed fetch client using Supabase JWT)
        └── Hono HTTP Server  :4111  (mastra/server.ts)
              └── Mastra Instance  (mastra/index.ts)
                    ├── 6 Agents  (mastra/agents/*.ts)
                    ├── 2 Workflows  (mastra/workflows/*.ts)
                    ├── Observability  (@mastra/observability)
                    └── Evals  (mastra/evals/bookQualityEval.ts)
```

---

## File-by-File Migration Map

| Legacy File | Mastra Replacement | Status |
|---|---|---|
| `services/geminiService.ts` | `mastra/agents/storyArchitectAgent.ts` | ✅ Replaced |
| `services/generator/qaService.ts` | `mastra/agents/qualityAssuranceAgent.ts` | ✅ Replaced |
| `services/grokService.ts` | `mastra/agents/storyEditorAgent.ts` | ✅ Replaced |
| `services/generator/illustrationService.ts` | `mastra/agents/characterArtistAgent.ts` | ✅ Replaced |
| `services/gamificationService.ts` | `mastra/agents/gamificationAgent.ts` | ✅ Replaced |
| `services/tierLimits.ts` (client) | `services/tierLimits.ts` (Mastra call + fallback) | ✅ Dual-path |
| `services/storageService.ts` (client) | `services/storageService.ts` (Mastra hook + fallback) | ✅ Dual-path |
| `components/SmartEditor.tsx` (direct API) | `components/SmartEditor.tsx` (Mastra → legacy fallback) | ✅ Dual-path |
| `components/BlueprintReview.tsx` | Updated to call workflow resume | ✅ Updated |
| `components/GamificationHub.tsx` | Fetches from Mastra gamification agent | ✅ Updated |
| n/a | `mastra/workflows/bookGenerationWorkflow.ts` | ✅ New — 10-step pipeline |
| n/a | `mastra/workflows/brandVoiceRAGWorkflow.ts` | ✅ New — RAG ingestion |
| n/a | `mastra/evals/bookQualityEval.ts` | ✅ New — quality scorer |
| n/a | `src/services/mastraClient.ts` | ✅ New — typed HTTP client |

---

## Running the System

### Development (two processes)
```bash
# Terminal 1 — Mastra backend
npm run mastra:dev

# Terminal 2 — Vite frontend
npm run dev

# Or both at once:
npm run dev:all
```

### Verify both are running
- Frontend: http://localhost:5173
- Mastra health: http://localhost:4111/health

---

## Environment Variables

### Required for all environments

| Variable | Used By | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public anon key |
| `SUPABASE_URL` | Mastra server | Same URL, server-side read |
| `SUPABASE_SERVICE_ROLE_KEY` | Mastra server | **Keep secret — full DB access** |
| `VITE_MASTRA_URL` | Browser | Where to send Mastra API requests |
| `GEMINI_API_KEY_1` … `_5` | Mastra agents | Server-side Gemini keys |
| `BYTEZ_API_KEY` | Mastra agents | Server-side Bytez key |

### Local dev only defaults
| Variable | Default | Notes |
|---|---|---|
| `MASTRA_SERVER_PORT` | `4111` | Override if port conflicts |
| `VITE_MASTRA_URL` | `http://localhost:4111` | Points to local Mastra server |

### Optional
| Variable | Notes |
|---|---|
| `MASTRA_PG_CONNECTION_STRING` | Auto-derived from `SUPABASE_URL` if omitted |
| `MASTRA_CLOUD_ACCESS_TOKEN` | Enable Mastra Cloud trace dashboard |

---

## Deploying the Mastra Server

The Mastra server is a **long-running Node.js process** — it cannot deploy as a
Vercel serverless function (function timeout limits are incompatible with durable
workflow state).

### Recommended: Railway
1. Create a new Railway project
2. Connect your GitHub repo
3. Set the start command: `npx tsx mastra/server.ts`
4. Add all non-`VITE_` env vars in Railway's variable dashboard
5. Copy the Railway URL → set `VITE_MASTRA_URL` in Vercel

### Alternative: Render / Fly.io / any VPS
Same approach — run `npx tsx mastra/server.ts` as the process, expose port 4111.

### Docker (optional)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY mastra/ ./mastra/
COPY types/ ./types/
EXPOSE 4111
CMD ["npx", "tsx", "mastra/server.ts"]
```

### Vercel CSP
After deploying, add your Mastra server hostname to the `connect-src` directive in
`vercel.json`. The current config already allows `*.railway.app` and `*.onrender.com`.
For custom domains, add them manually:

```json
"connect-src": "... https://your-mastra.yourdomain.com"
```

---

## Dual-Path Fallback Pattern

During migration, components use a **dual-path** pattern so the app stays
functional even if the Mastra server is down:

```ts
// Pattern used in SmartEditor, tierLimits, storageService, etc.
try {
  return await mastra.agents.storyEditor.improveText(text, tone, audience);
} catch (mastraErr) {
  console.warn('[Mastra] Falling back to legacy service:', mastraErr);
  return legacyGrokService.improveText(text, tone, audience); // legacy path
}
```

**When to remove the fallback:**
1. Mastra server is stable in production (1+ week without incidents)
2. All e2e tests pass against the Mastra path
3. Legacy `VITE_GEMINI_*` and `VITE_BYTEZ_*` keys are rotated/removed

---

## New API Endpoints

All endpoints require `Authorization: Bearer <supabase_access_token>`.

### Agents
| Method | Path | Replaces |
|---|---|---|
| `POST` | `/api/agents/story-architect/generate` | `geminiService.generateBookStructure()` |
| `POST` | `/api/agents/character-artist/illustrate` | `illustrationService.generateIllustration()` |
| `POST` | `/api/agents/style-architect/analyze` | `geminiService.analyzeStyleGuide()` |
| `POST` | `/api/agents/story-editor/improve` | `grokService.improveText()` |
| `POST` | `/api/agents/story-editor/consistency` | `grokService.checkCharacterConsistency()` |
| `POST` | `/api/agents/gamification/track` | `gamificationService.trackAction()` |
| `GET`  | `/api/agents/gamification/state/:userId` | `gamificationService.getState()` |
| `POST` | `/api/agents/quality-assurance/analyze` | `qaService.analyzeQuality()` |

### Workflows
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/workflows/book-generation/start` | Start 10-step book pipeline |
| `POST` | `/api/workflows/book-generation/resume` | Resume at suspend point (blueprint approval) |
| `POST` | `/api/workflows/book-generation/cancel` | Cancel in-progress workflow |
| `POST` | `/api/workflows/brand-voice/ingest` | RAG ingestion of brand voice docs |

### Admin (EMPIRE tier only)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/eval-run` | Run bookQualityScorer on a book |
| `GET`  | `/api/admin/eval-averages` | Aggregate quality metrics across all books |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server health + registered agents/workflows |

---

## Workflow: Book Generation

The 10-step `bookGenerationWorkflow` replaces the previous single-call generation:

```
1. validateInput      — Tier limits, content policy, settings normalisation
2. generateBlueprint  — Story structure, character sheets, chapter outlines
3. [SUSPEND]          — Wait for user approval in BlueprintReview.tsx
4. generateChapters   — Full text for all pages in parallel batches
5. styleCheck         — Apply brand voice and style guide
6. generateImagePrompts — Midjourney/Imagen prompts for each page
7. generateIllustrations — Call Imagen/Bytez for actual images
8. runQualityAssurance — Score via qualityAssuranceAgent, auto-improve < threshold
9. assembleBook       — Merge text + images, build final BookProject
10. persistBook       — Save to Supabase, award gamification XP
```

**Suspend/Resume** at step 3 means the user can review the blueprint and either:
- Approve → `POST /api/workflows/book-generation/resume` with `{ approved: true }`
- Request changes → resume with `{ approved: false, feedback: "..." }`

---

## Observability

Mastra-native tracing is configured in `mastra/index.ts`:

- **Dev**: 100% sampling, `DefaultExporter` (view in Mastra Studio)
- **Prod**: 10% sampling to manage costs
- `SensitiveDataFilter` redacts API keys and tokens before export
- Trace context propagated via `userId`, `tier`, `workflowId` from request headers

To view traces locally:
```bash
npx mastra studio
```

---

## Evals & Quality Scoring

`mastra/evals/bookQualityEval.ts` provides `bookQualityScorer` — a deterministic
scorer (no LLM judge, runs in <50ms) with a composite 0–1 score:

| Dimension | Weight | Method |
|---|---|---|
| Readability | 25% | Flesch-Kincaid Reading Ease |
| Grammar | 20% | Pattern-based issue detection |
| Coherence | 20% | Transition density + sentence variance |
| Age Appropriateness | 20% | Avg word/sentence length + content flags |
| Completeness | 15% | Expected structure presence |

Result is stored to `book_eval_results` table and aggregated via the
`/api/admin/eval-averages` endpoint.

---

## Supabase Tables Required

The following tables must exist (run `supabase_schema.sql` migrations):

| Table | Used By |
|---|---|
| `workflow_state` | Workflow suspend/resume, cancellation |
| `book_eval_results` | bookQualityScorer results |
| `gamification_events` | Gamification agent event log |
| `brand_voice_chunks` | Brand voice RAG vector store |

---

## Known Limitations & Future Work

- **Video generation** (Veo 3.1) is stubbed — will be wired in a future phase
- **Legacy VITE_ keys** are still required for the fallback path
- **Mastra Studio** requires `DefaultExporter` + local storage (not available on Vercel)
- **WebSocket streaming** for workflow progress is SSE-based (works, but stateless servers need sticky routing)

---

*Last updated: Phase 6 — March 2026*
