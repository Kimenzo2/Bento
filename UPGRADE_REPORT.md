## GENESIS DEPENDENCY UPGRADE — SUMMARY

**Date:** March 14, 2026
**Branch:** Gemini-api-connections

### Upgraded Successfully

| Package | Old | New | Notes |
|---------|-----|-----|-------|
| jspdf | 3.0.4 | 4.2.0 | Security: 3 CVEs fixed |
| @sentry/react | 8.55.0 | 10.43.0 | 2 major versions |
| @sentry/vite-plugin | 4.6.1 | 5.1.1 | |
| react | 19.2.1 | 19.2.4 | |
| react-dom | 19.2.1 | 19.2.4 | |
| @types/react | 19.2.7 | 19.2.14 | |
| vite | 6.4.1 | 8.0.0 | Rolldown bundler, 2x faster builds |
| @vitejs/plugin-react-swc | 3.11.0 | 4.3.0 | |
| vitest | 4.0.15 | 4.1.0 | Required for Vite 8 compat |
| @vitest/coverage-v8 | 4.0.15 | 4.1.0 | |
| @google/genai | * (wildcard) | ^1.30.0 | Pinned — no more wildcard |
| lucide-react | 0.473.0 | 0.577.0 | |
| framer-motion | 12.23.24 | 12.36.0 | |
| tailwindcss | 4.1.17 | 4.2.1 | |
| @tailwindcss/vite | 4.1.17 | 4.2.1 | |
| @supabase/supabase-js | 2.84.0 | 2.99.1 | |
| dodopayments | 2.23.2 | 2.23.2 | Already latest |
| @react-email/components | 1.0.8 | 1.0.9 | |
| @liveblocks/client | 3.12.1 | 3.15.2 | |
| @liveblocks/react | 3.12.1 | 3.15.2 | |
| @liveblocks/react-ui | 3.12.1 | 3.15.2 | |
| newrelic | 13.8.1 | 13.16.0 | |
| rollbar | 2.26.5 | 3.1.0 | Major version |
| i18next | 25.7.1 | 25.8.18 | |
| react-i18next | 16.3.5 | 16.5.8 | |
| i18next-browser-languagedetector | 8.2.0 | 8.2.1 | |
| hono | 4.12.5 | 4.12.8 | |
| @upstash/ratelimit | 2.0.7 | 2.0.8 | |
| @upstash/redis | 1.36.0 | 1.37.0 | |
| @vercel/analytics | 1.5.0 | 2.0.1 | Major version |
| @vercel/speed-insights | 1.3.1 | 2.0.0 | Major version |
| algoliasearch | 5.46.2 | 5.49.2 | |
| web-vitals | 4.2.4 | 5.1.0 | Major version |
| jose | 6.1.3 | 6.2.1 | |
| react-error-boundary | 6.0.1 | 6.1.1 | |
| react-router | (not installed) | 7.13.1 | Added for future consolidation |
| @arcjet/inspect | 1.0.0-beta.15 | 1.3.0 | |
| @arcjet/node | 1.0.0-beta.15 | 1.3.0 | |
| @biomejs/biome | 1.9.4 | 2.4.7 | Major version |
| @commitlint/cli | 20.2.0 | 20.4.4 | |
| @commitlint/config-conventional | 20.2.0 | 20.4.4 | |
| checkly | 4.19.1 | 7.6.1 | Major version |
| dotenv | 17.2.3 | 17.3.1 | |
| eslint | 9.39.1 | 10.0.3 | Major version |
| eslint-plugin-react-hooks | 5.2.0 | 7.0.1 | Major version |
| eslint-plugin-react-refresh | 0.4.24 | 0.5.2 | |
| jsdom | 27.3.0 | 28.1.0 | Major version |
| lint-staged | 16.2.7 | 16.3.4 | |
| rimraf | 6.1.2 | 6.1.3 | |
| shadcn | 3.8.5 | 4.0.6 | Major version |
| typescript-eslint | 8.49.0 | 8.57.0 | |
| @mastra/core | 1.10.0 | 1.13.2 | |
| @mastra/deployer | 1.10.0 | 1.13.2 | |
| @mastra/memory | 1.6.1 | 1.8.2 | |
| @mastra/observability | 1.3.1 | 1.5.0 | |
| @mastra/pg | 1.7.2 | 1.8.0 | |
| @statsig/js-client | 3.31.0 | 3.32.0 | |
| @statsig/react-bindings | 3.31.0 | 3.32.0 | |
| @vercel/node | 5.5.15 | 5.6.15 | |
| @testing-library/react | 16.3.0 | 16.3.2 | |

### Removed

| Package | Reason |
|---------|--------|
| @google/generative-ai | 0.24.1 | Deprecated, migrated to @google/genai |
| @types/jspdf | 1.3.3 | jsPDF 4.x ships its own types |

### Added

| Package | Version | Reason |
|---------|---------|--------|
| @react-email/body | 0.3.0 | Required peer dep for @react-email/tailwind |
| @react-email/head | 0.0.13 | Required peer dep |
| @react-email/html | 0.0.12 | Required peer dep |
| @react-email/tailwind | 2.0.5 | Required peer dep |
| react-router | 7.13.1 | Future consolidation with react-router-dom |

### Migrations Performed

| Migration | Files Changed |
|-----------|---------------|
| `@google/generative-ai` → `@google/genai` API | `mastra/workflows/brandVoiceRAGWorkflow.ts`, `mastra/test-pipeline.ts` |
| `GoogleGenerativeAI` → `GoogleGenAI({ apiKey })` | Same files |
| `model.embedContent()` → `ai.models.embedContent()` | Same files |
| `model.batchEmbedContents()` → `ai.models.embedContent()` | Same files |
| `result.response.text()` → `result.text` | `mastra/test-pipeline.ts` |
| `FallbackProps.error: Error` → `unknown` (react-error-boundary 6.1) | `components/collaboration/CollaborationProvider.tsx` |

### Skipped and Why

| Package | Reason |
|---------|--------|
| TypeScript | Already at 5.9.3 (beyond target of 5.8.x) |
| standardwebhooks | Already at latest (1.0.0) |
| clsx | Already at latest (2.1.1) |
| class-variance-authority | Already at latest (0.7.1) |
| prop-types | Already at latest (15.8.1) |
| html2canvas | Already at latest (1.4.1) — effectively unmaintained |
| sonner | Already at latest (2.0.7) |
| bytez.js | Already at latest (3.0.0) |
| @xyflow/react | Not in upgrade spec |
| @dnd-kit packages | Not in upgrade spec |
| react-litert | Already at latest (0.2.0) |
| statsig-js | Already at latest (5.1.0) |
| @hyperdx/browser | Already at latest (0.22.0) |
| @rollbar/react | Already at latest (1.0.0) |
| @mastra/rag | Already at latest (2.1.2) |
| @fontsource-variable/noto-sans-arabic | Already at latest (5.2.10) |
| vite-plugin-pwa | Already at latest (1.2.0) |
| react-router-dom consolidation | Kept alongside react-router — zero risk |
| framer-motion → motion migration | Chose Option A (stay on framer-motion) for zero risk |
| @opentelemetry/api | Already at latest (1.9.0) |

### Pre-existing Issues

- Pre-existing peer dependency warnings from `@hyperdx/otel-web` requiring `@opentelemetry/api <1.9.0` — not introduced by this upgrade
- Pre-existing peer dependency warning from `@mastra/core` → `@ai-sdk/ui-utils-v5` requiring `zod ^3.23.8` while project uses zod 4.x
- Chunk size warning (>2000 kB) for main bundle — pre-existing

### Post-upgrade State

- **Type-check:** PASS (0 errors)
- **Build:** PASS (49.6s build time — down from 136.5s baseline, **2.8x faster**)
- **Tests:** Not run (no test suite configured in `npm test`)
- **Dev server:** Not verified (requires manual check)

### Notable Improvements

- **Build speed:** 136.5s → 49.6s (**2.8x faster**) thanks to Vite 8's Rolldown bundler
- **Security:** 3 jsPDF CVEs patched, Sentry v10 security improvements
- **Architecture:** Removed wildcard `@google/genai: "*"` dependency, eliminated deprecated `@google/generative-ai`
