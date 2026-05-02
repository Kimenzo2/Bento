<div align="center">
<img width="1200" height="475" alt="Genesis — AI Visual Storytelling Platform for Illustrated Books, Educational Content, and Character Design" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Genesis — AI Visual Storytelling Platform

### _Create illustrated storybooks, educational content, and character worlds with a multi-agent AI pipeline. No prompt engineering required._

[![Version](https://img.shields.io/badge/Genesis-v2.0.0-FF9B71?style=for-the-badge)](https://iamazeyou.me)
[![Live](https://img.shields.io/badge/Live%20at-iamazeyou.me-FFD93D?style=for-the-badge)](https://iamazeyou.me)
[![Stack](https://img.shields.io/badge/Stack-React%2019%20%2B%20Mastra%20%2B%20Gemini-4A9EFF?style=for-the-badge)](#tech-stack)
[![License](https://img.shields.io/badge/License-Commercial-blue?style=for-the-badge)](LICENSE)

</div>

---

## What Is Genesis?

Genesis is a full-stack AI visual storytelling platform. You describe an idea — a children's story, an educational science explainer, a brand narrative, a fantasy world — and Genesis generates it as a fully illustrated, exportable book. It handles story structure, page-by-page text, AI-generated illustration prompts, character visual consistency, and PDF/eBook export in a single guided workflow.

Unlike generic AI image tools that give you a blank prompt box, Genesis structures the creative process through three themed realms (**Cosmos**, **Kingdom**, **Cell**) and a multi-agent backend that runs blueprint approval, parallel character sheet generation, style guide creation, quality assurance scoring, and Supabase persistence as coordinated pipeline steps.

**The live application is at [iamazeyou.me](https://iamazeyou.me).**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  React 19 Frontend  (Vite 6, TypeScript 5.7, Tailwind v4, Framer Motion)│
│                                                                         │
│  CreationCanvas → BlueprintReview → SmartEditor → StorybookViewer       │
│  VisualStudio → CurriculumBuilder → GamificationHub → ExportModal       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  REST (JSON)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Mastra Agent Backend  (Hono HTTP, mastra/server.ts)                    │
│                                                                         │
│  Agents:                                                                │
│  ├─ storyArchitectAgent   — ContentStructure blueprint generation       │
│  ├─ characterArtistAgent  — CharacterSheet + visual identity (Gemini)   │
│  ├─ styleArchitectAgent   — Art direction + color palette generation    │
│  ├─ storyEditorAgent      — Text improvement, consistency, suggestions  │
│  ├─ qualityAssuranceAgent — Page scoring + auto-improvement             │
│  └─ gamificationAgent     — XP, badge, challenge award logic           │
│                                                                         │
│  Workflows:                                                             │
│  ├─ bookGenerationWorkflow — 9-step orchestration with human-in-loop    │
│  └─ brandVoiceRAGWorkflow  — pgvector ingestion + semantic retrieval    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          ▼                     ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
│  Supabase       │   │  Vercel API fns │   │  Cloudflare R2   │
│  PostgreSQL     │   │  ai-generate.ts │   │  (image assets)  │
│  pgvector RAG   │   │  ai-bytez.ts    │   │                  │
│  Auth + RLS     │   │  paystack.ts    │   └──────────────────┘
│  Realtime       │   │  send-email.ts  │
│  Storage        │   └─────────────────┘
└─────────────────┘
```

---

## The Multi-Agent Pipeline

The core of Genesis v2 is a [Mastra](https://mastra.ai)-orchestrated AI agent system. When a user clicks **Generate**, this runs server-side:

### Book Generation Workflow (`mastra/workflows/bookGenerationWorkflow.ts`)

A 9-step durable workflow with a human-in-the-loop pause:

| Step | Agent / Action | Description |
|------|---------------|-------------|
| 1 | `validateRequest` | Tier limit enforcement (cannot be bypassed client-side) |
| 2 | `analyzeContent` (storyArchitectAgent) | Generates full `ContentStructure` blueprint: chapters, pages, characters, emotional arc |
| 3 | **SUSPEND** | Human-in-the-loop: user reviews and approves blueprint before compute continues |
| 4 | `generateCharacters` (characterArtistAgent) | Parallel `CharacterSheet` generation with visual identity, hex color palette, style enforcement |
| 5 | `generateStyleGuide` (styleArchitectAgent) | Art direction, motifs, scene-level color palette |
| 6 | `generatePageContent` (storyArchitectAgent) | Page text + illustration prompts, batched in groups of 3 |
| 7 | `generateIllustrations` (Gemini / Bytez) | AI image generation, batched in groups of 2 |
| 8 | `runQualityAssurance` (qualityAssuranceAgent) | Per-page scoring + auto-improvement loop |
| 9 | `persistBook` | Supabase write, usage increment, XP award |

### Agent Capabilities

**storyArchitectAgent** — The structure engine. Takes `GenerationSettings` (prompt, art style, tone, page count, audience age, educational config, brand profile) and returns a `ContentStructure` with every page's scene description, layout template, visual focus, emotional arc note, and word count estimate. Enforces age-appropriate content rules (ages 3–5 through 13+) and brand voice directives.

**characterArtistAgent** — The consistency keeper. Maintains in-memory state of every character generated within a session. When generating a new character, it always fetches existing characters for the same book first to enforce compatible color palettes, proportional styling, and shared art style keywords. Outputs `CharacterSheet` objects with face structure, body type, clothing (with hex codes), accessories, expression range, and style enforcement strings that get injected into every illustration prompt.

**styleArchitectAgent** — Generates a `StyleGuide`: primary/accent color palettes (hex), typography direction, recurring visual motifs, scene-level mood directives. Used by all downstream agents.

**storyEditorAgent** — Three modes via an `action` field: `improve` (tone-matched text rewriting that avoids previously rejected patterns), `consistency` (character consistency scoring 0–100 with specific issue callouts), `suggestions` (inline writing suggestions that adapt to the author's evolving style preferences stored in session memory).

**qualityAssuranceAgent** — Scores each generated page and auto-improves below-threshold pages before they reach the user. Runs the `bookQualityEval` metric suite from `mastra/evals/bookQualityEval.ts`.

**gamificationAgent** — Awards XP and evaluates badge unlock conditions after generation milestones.

### Brand Voice RAG (`mastra/workflows/brandVoiceRAGWorkflow.ts`)

When a user uploads brand sample text, it is chunked (512-token windows, 50-token overlap), embedded via `text-embedding-004`, and stored in Supabase `brand_voice_chunks` with a `pgvector` index. At generation time, `retrieveBrandContext()` performs a cosine similarity search to inject the top-3 most relevant chunks into the story architect and story editor prompts, ensuring brand voice coherence without prompt stuffing.

---

## Frontend Application

### Application Shell

Genesis uses a split-bundle architecture at the router level (`AppRouter.tsx`). New users load the `OnboardingApp` bundle; returning authenticated users load `MainApp` directly. The two bundles are siblings — they share nothing except `AuthContext`. Splitting is handled automatically by Vite's dynamic `import()`.

### Key Views and Components

| Component | Purpose |
|-----------|---------|
| `CreationCanvas.tsx` | Primary creation workspace. Full generation form: realm/style/tone selection, character assignment, educational mode, brand content mode, template library, and the Generate button that triggers the Mastra workflow. |
| `BlueprintReview.tsx` | The human-in-the-loop step. Displays the AI-generated `ContentStructure` for user review before the pipeline continues. |
| `SmartEditor.tsx` | Full page-by-page editor. Integrates auto-save, undo/redo, inline AI writing suggestions, character consistency checks, `AudienceSafety` warnings, `GreenRoom` character deepening, and `RemixStudio`. |
| `StorybookViewer.tsx` | The finished book viewer. Supports fullscreen, keyboard navigation, page flip animations (Framer Motion), and a sharing modal. |
| `VisualStudio.tsx` | Per-image AI regeneration workspace. Users can edit illustration prompts and regenerate individual page images without touching text. |
| `CurriculumBuilder.tsx` + `CurriculumViewer.tsx` | Educator tooling. Builds structured curriculum modules from books, complete with quizzes, learning objectives, and vocabulary lists. |
| `GamificationHub.tsx` | User XP level, badges, daily challenges, and streaks. |
| `GreenRoom.tsx` | Deep character development panel. Surfaces the full `Character` type: Big Five OCEAN psychological profile, core identity, formative experiences, relationship style, behavioral patterns, and voice profile. |
| `ExportModal.tsx` + `KDPExportModal.tsx` | PDF export via `jspdf` + `html2canvas`. KDP modal formats output to Amazon Kindle Direct Publishing trim sizes. |
| `PricingPage.tsx` | Four-tier pricing UI with Paystack payment integration. |
| `GenerationTheater.tsx` | Streaming progress view shown during AI generation. Receives server-sent progress events. |
| `LivingStoryboard.tsx` | Story bible visualization: entity graph, emotional arc chart (sentiment + tension per page), consistency issue callouts. |
| `AudienceSafety.tsx` | Inline safety report: vocabulary difficulty, thematic intensity checks against selected age range. |
| `ConversationMode.tsx` | Chat-style alternative creation interface. Users describe their book through a guided conversation. |
| `RemixStudio.tsx` | Page-level content remixing. Swap a page's scene, tone, or layout without touching the rest of the book. |
| `SharedBookViewer.tsx` | Public read-only book view served on shared links. No auth required. |
| `InfographicWizard` (in `components/infographic/`) | Alternative creation path for non-narrative visual content: diagrams, explainers, data visualizations. |

### Theming

Themes are defined in `config/themes.ts` as typed `Theme` objects with `cssVariables` and `darkCssVariables` maps. The active theme is applied to `document.documentElement` style at runtime via `ThemeContext`. Included themes: Genesis Classic (warm cream/peach), Aurora Scholar (purple/pink), Ocean Deep (teal), Forest Sage (green), and Midnight Ink (dark).

### Internationalization

Full i18n via `react-i18next` and `i18next-http-backend`. Translations are lazy-loaded per locale from `/public/locales/`. Locale is detected from browser settings via `i18next-browser-languagedetector`. Arabic is supported with RTL layout adjustments via `@fontsource-variable/noto-sans-arabic`.

---

## Data Model

Key TypeScript types defined in `types.ts`:

```typescript
// The root document created by users
interface BookProject {
  id: string;
  title: string;
  synopsis: string;
  style: ArtStyle;          // enum: Watercolor | Pixar3D | Manga | CorporateMinimalist
                            //       | CyberpunkNeon | VintageIllustration | PaperCutout
                            //       | FlatDesign | Infographic | TechnicalBlueprint
  tone: BookTone;           // enum: Playful | Educational | Dramatic | Inspirational
                            //       | Humorous | Mysterious | Heartwarming
  targetAudience: string;
  chapters: Chapter[];
  characters: Character[];
  storyBible?: StoryBible;     // Entity graph, beat sheet, emotional arc, safety report
  brandProfile?: BrandProfile; // For brand content mode
  learningConfig?: LearningConfig; // Educational mode config
  metadata?: BookMetadata;
  decisionTree?: DecisionTree; // For branching / interactive books
  backMatter?: BackMatter;     // Discussion questions, activities, vocabulary
}

// A deeply specified character with psychological profile
interface Character {
  id, name, role, description, visualTraits, imageUrl

  // Psychology — Big Five / OCEAN model (scores 0–100)
  psychologicalProfile: { openness, conscientiousness, extraversion, agreeableness, neuroticism }

  // Identity
  coreIdentity: { coreBelief, greatestDesire, greatestFear, moralCode, flaw, strength, lie, truth }

  // History
  formativeExperiences: { childhoodMemory, biggestRegret, definingMoment, secretShame, proudestAchievement }

  // Relationships
  relationshipStyle: { attachmentStyle, trustLevel, conflictStyle, loveLanguage }

  // Behavior
  behavioralPatterns: { stressResponse, joyTriggers, angerTriggers, copingMechanisms, habits, speechPatterns }

  // Voice
  voiceProfile: { tone, vocabulary, catchphrases, nonverbalTics, laughStyle }

  // Teaching (educational mode)
  teachingStyle: { subjectsExpertise, teachingApproach, encouragementStyle, correctionStyle, exampleStyle }
}

// Page-level data
interface Page {
  id, pageNumber, text, imagePrompt, imageUrl
  layoutType: 'full-bleed' | 'split-horizontal' | 'split-vertical' | 'text-only' | 'learning-break'
  narrationNotes?: NarrationNotes
  interactiveElement?: InteractiveElement   // Decision branches for interactive books
  learningContent?: { topic, mentorDialogue, quiz: { question, options, correctAnswer, explanation } }
  vocabularyWords?: VocabularyWord[]
}
```

---

## Backend API (Vercel Serverless Functions)

All API routes live in `/api/` and are deployed as Vercel serverless functions:

| Route | Purpose |
|-------|---------|
| `api/ai-generate.ts` | Secure Gemini proxy. Accepts raw Gemini REST format, `{ prompt }`, or `{ messages }` chat array. Routes to `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`, or other allowed models. Keeps all API keys server-side. 55-second abort guard against Vercel timeout drops. |
| `api/ai-bytez.ts` | Bytez image generation proxy for illustration requests. |
| `api/paystack.ts` | Paystack payment webhook handler and charge endpoint. |
| `api/send-email.ts` | Transactional email via Resend. |
| `api/storage.ts` | Cloudflare R2 signed URL generation for user asset uploads. |
| `api/service-proxy.ts` | Generic authenticated proxy for external service calls. |
| `api/jobs.ts` | Background job status endpoint. |
| `api/health.ts` | Health check endpoint. |
| `api/_middleware.ts` | Shared authentication middleware. Validates Supabase JWT on every protected route. |

---

## Infrastructure and Integrations

| Service | Role |
|---------|------|
| **Supabase** | PostgreSQL database, row-level security, auth (Google OAuth + email/password + Google One Tap), realtime subscriptions, file storage |
| **Supabase pgvector** | Vector embeddings for Brand Voice RAG workflow |
| **Upstash Redis** | Rate limiting (via `@upstash/ratelimit`), API response caching, semantic cache |
| **Arcjet** | Bot detection, request rate limiting, shield middleware on API routes |
| **Sentry** | Error tracking with session replay and performance monitoring |
| **HyperDX** | Distributed tracing and log aggregation |
| **Statsig** | Feature flags, A/B tests, gradual rollouts |
| **Rollbar** | Secondary error tracking and alerting |
| **Liveblocks** | Real-time collaborative editing (books shared between users) |
| **Resend** | Transactional email (welcome, share notifications) |
| **Paystack** | Payment processing (Nigeria, Ghana, Kenya, and other African markets) |
| **Algolia** | Full-text search across saved books |
| **Cloudflare R2** | User-generated image asset storage |
| **Vercel Analytics + Speed Insights** | Page views, Web Vitals, real-user performance |
| **OpenTelemetry** | Distributed tracing from Mastra agents to Supabase (10% sampling in production) |
| **Checkly** | Synthetic monitoring and uptime checks |
| **New Relic** | Application performance monitoring |

---

## Hooks and State Management

No Redux. State is managed through React context + custom hooks:

| Hook | Purpose |
|------|---------|
| `useAutoSave` | Debounced auto-save with dirty-state tracking. Fires 30s after last edit. |
| `useUndoRedo` | Full undo/redo history stack for the book editor. |
| `useTheme` | Active theme read/write from `ThemeContext`. |
| `useUserSettings` | User preferences read/written to Supabase. |
| `useNetworkStatus` | Online/offline detection with `OfflineIndicator` UI. |
| `useOfflineFirst` | Service worker + cache-first strategy for offline book reading. |
| `useSwipeGesture` | Native touch swipe detection for `StorybookViewer` page turns. |
| `usePageSEO` | Per-route `<title>` and `<meta>` tag management. |
| `useGoogleOneTap` | Google One Tap sign-in integration. |
| `useInfrastructure` | Access to `InfrastructureContext` (health checks, service readiness). |

---

## User Tier System

Four tiers defined in `types.ts` as the `UserTier` enum, enforced server-side in the `validateRequest` workflow step:

| Tier | Price | Creations | Pages/Book |
|------|-------|-----------|------------|
| **Spark** | Free | 3/month | 8 pages |
| **Creator** | $19.99/mo | 30/month | 12 pages |
| **Studio** | $59.99/mo | Unlimited | 30 pages |
| **Empire** | $199.99/mo | Unlimited | Unlimited |

Tier limits gate: page count, art style access, educational mode, brand content mode, collaborative editing, KDP export, and API access.

---

## Gamification System

The `GamificationState` type tracks:
- **Level** with title (e.g., "Rising Author", "Seasoned Storyteller")
- **XP** with next-level threshold
- **Badges** (identified by Lucide icon name, with locked/unlocked state)
- **Daily Challenges** with XP rewards
- **Creation streak** (consecutive days)

`gamificationAgent` evaluates badge conditions and XP awards after each book generation milestone. State persists to Supabase via `supabase_gamification_migration.sql`.

---

## PWA Capabilities

Genesis is a Progressive Web App configured via `vite-plugin-pwa`:
- **Install prompt** — `InstallPWA.tsx` renders a native install banner
- **Service worker** — Pre-caches the application shell, lazy-loads page assets
- **Offline indicator** — `OfflineIndicator.tsx` surfaces when connectivity is lost
- **`useOfflineFirst`** — Hooks into the service worker cache for offline book reading

---

## Security

- All API routes use `createAuthenticatedHandler` which validates the Supabase JWT before executing handlers
- Gemini and Bytez API keys are **never** sent to the browser — all AI calls go through `/api/ai-generate` and `/api/ai-bytez`
- Arcjet runs bot detection and per-IP rate limiting on all API endpoints
- Supabase Row-Level Security policies restrict every table to the authenticated user's own rows
- `Content-Security-Policy` header in `vercel.json` whitelists only explicitly required domains
- `Strict-Transport-Security` with `preload` enforced on all responses
- `X-Frame-Options: DENY` prevents clickjacking

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript 5.7 |
| Build | Vite 6 with SWC, custom `nonBlockingAssets()` plugin for CSS preload |
| Styling | Tailwind CSS v4 (CSS-first `@theme` config), Framer Motion 12, Radix UI, shadcn/ui |
| Routing | React Router v7 |
| AI generation | Google Gemini 2.0 Flash / 2.5 Flash / 2.5 Pro, Bytez |
| AI agents | Mastra v1.9 (`@mastra/core`, `@mastra/rag`, `@mastra/memory`, `@mastra/pg`) |
| AI embeddings | Google `text-embedding-004` → Supabase pgvector |
| Database | Supabase (PostgreSQL 15 + pgvector + RLS) |
| Auth | Supabase Auth, Google OAuth, Google One Tap |
| Storage | Supabase Storage, Cloudflare R2 |
| API server | Hono (Mastra), Vercel serverless functions |
| Payments | Paystack (`@paystack/inline-js`) |
| Email | Resend |
| Real-time collaboration | Liveblocks v3 |
| Search | Algolia v5 |
| Error tracking | Sentry v8, Rollbar |
| APM | HyperDX, New Relic, OpenTelemetry |
| Feature flags | Statsig |
| Rate limiting | Arcjet, Upstash Redis |
| CI / Deploy | Vercel |
| Testing | Vitest v4 (unit), Playwright (E2E), Checkly (synthetic) |
| Linting | Biome, ESLint, commitlint |

---

## Project Structure

```
genesis/
├── api/                        # Vercel serverless API functions
│   ├── _middleware.ts          # JWT auth middleware for all API routes
│   ├── ai-generate.ts          # Gemini proxy (server-side key management)
│   ├── ai-bytez.ts             # Bytez image generation proxy
│   ├── paystack.ts             # Payment processing
│   ├── send-email.ts           # Transactional email via Resend
│   ├── storage.ts              # Cloudflare R2 signed URLs
│   └── jobs.ts / health.ts     # Job status + health check
│
├── components/
│   ├── CreationCanvas.tsx      # Main creation form + quick-start cards
│   ├── SmartEditor.tsx         # Page-by-page editor with AI assistance
│   ├── StorybookViewer.tsx     # Finished book viewer
│   ├── VisualStudio.tsx        # Per-image AI regeneration
│   ├── BlueprintReview.tsx     # Human-in-the-loop blueprint approval
│   ├── GreenRoom.tsx           # Deep character psychology editor
│   ├── CurriculumBuilder.tsx   # Educator curriculum module builder
│   ├── GamificationHub.tsx     # XP / badges / challenges
│   ├── LivingStoryboard.tsx    # Story bible visualization
│   ├── GenerationTheater.tsx   # Live generation progress view
│   ├── ExportModal.tsx         # PDF export (jspdf + html2canvas)
│   ├── KDPExportModal.tsx      # Amazon KDP format export
│   ├── PricingPage.tsx         # Tier comparison + Paystack checkout
│   ├── Navigation.tsx          # Main nav bar
│   ├── MobileBottomNav.tsx     # Mobile sticky navigation
│   ├── onboarding/             # Complete onboarding flow (isolated bundle)
│   ├── settings/               # User settings panel
│   ├── infographic/            # Infographic wizard
│   ├── collaboration/          # Liveblocks real-time editing components
│   └── ui/                     # shadcn/ui component library
│
├── mastra/
│   ├── index.ts                # Central Mastra instance (agent + workflow registry)
│   ├── server.ts               # Hono HTTP server exposing agent endpoints
│   ├── schemas.ts              # Shared Zod schemas for all agents
│   ├── db.ts                   # Supabase client for Mastra persistence
│   ├── agents/
│   │   ├── storyArchitectAgent.ts    # Blueprint + page content generation
│   │   ├── characterArtistAgent.ts   # Visual character sheet generation
│   │   ├── styleArchitectAgent.ts    # Art direction + style guide
│   │   ├── storyEditorAgent.ts       # Improve, consistency, suggestions
│   │   ├── qualityAssuranceAgent.ts  # Page scoring + auto-improvement
│   │   └── gamificationAgent.ts     # XP + badge awards
│   ├── workflows/
│   │   ├── bookGenerationWorkflow.ts # 9-step book creation pipeline
│   │   └── brandVoiceRAGWorkflow.ts  # Brand voice ingestion + retrieval
│   ├── evals/
│   │   └── bookQualityEval.ts        # Quality scoring metrics
│   └── lib/
│       └── geminiProvider.ts         # Gemini model factory for agents
│
├── contexts/
│   ├── AuthContext.tsx          # Supabase auth state + profile management
│   ├── ThemeContext.tsx         # Active theme + dark/light mode
│   ├── IntegrationsContext.tsx  # All third-party service bootstrap
│   └── InfrastructureContext.tsx # Config validation + service health
│
├── hooks/                       # useAutoSave, useUndoRedo, useOfflineFirst, etc.
├── config/                      # infrastructure.ts (env validation), themes.ts
├── types.ts                     # All shared TypeScript types and enums
├── AppRouter.tsx                # Root router — onboarding / main app split
├── MainApp.tsx                  # Authenticated app shell
├── index.html                   # Entry HTML with SEO, AEO, structured data
├── index.css                    # Global styles, Tailwind directives
├── vite.config.ts               # Vite + SWC + PWA + non-blocking asset plugin
├── vercel.json                  # Vercel deploy config, headers, rewrites
└── supabase_*.sql               # Database migration scripts
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 22.13.0
- npm ≥ 10.9.0

### Install and Run

```bash
git clone https://github.com/Kimenzo/Genesis.git
cd Genesis
npm install
cp .env.example .env.local
# Fill in required env vars (see below)
npm run dev
```

For the Mastra agent server (required for full AI functionality):

```bash
npm run mastra:dev   # Starts Hono server on localhost:4111
npm run dev:all      # Starts both frontend and Mastra in parallel
```

### Environment Variables

```env
# Supabase (required)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# AI (required for generation)
GEMINI_API_KEY_1=
VITE_GEMINI_API_KEY=

# Payments
VITE_PAYSTACK_PUBLIC_KEY=

# Error tracking
VITE_SENTRY_DSN=

# Feature flags
VITE_STATSIG_CLIENT_KEY=

# Security
ARCJET_KEY=

# Caching / rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email
RESEND_API_KEY=

# Collaboration
LIVEBLOCKS_SECRET_KEY=
VITE_LIVEBLOCKS_PUBLIC_KEY=

# Image storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

### Build and Deploy

```bash
npm run build         # Parallel TypeScript check + Vite build
npm run type-check    # TypeScript strict check only
npm run lint          # Biome linter
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
npx vercel --prod     # Deploy to Vercel production
```

---

## Database Setup

SQL migration files are included in the root:

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Core tables: profiles, books, pages, characters |
| `supabase_gamification_migration.sql` | XP, badges, challenges, streaks |
| `supabase_paystack_schema.sql` | Subscription and payment records |
| `supabase_realtime_schema.sql` | Realtime publication configuration |
| `supabase_settings_schema.sql` | User settings and preferences |
| `supabase_sharing_schema.sql` | Book sharing links and permissions |
| `supabase_analytics_schema.sql` | Usage analytics events |
| `phantom_tables_schema.sql` | Brand voice RAG chunks (pgvector) |

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed setup instructions.

---

## Documentation

| Document | Content |
|----------|---------|
| [USER_GUIDE.md](USER_GUIDE.md) | End-user walkthrough: creation, editing, export, sharing |
| [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Database schema setup, RLS policies, auth config |
| [SUPABASE_AUTH_TROUBLESHOOTING.md](SUPABASE_AUTH_TROUBLESHOOTING.md) | Auth debugging guide |
| [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) | v1 → v2 migration notes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines, branch naming, commit conventions |
| [TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md) | How to add new locales to the i18n system |
| [FONT_INTEGRATION_GUIDE.md](FONT_INTEGRATION_GUIDE.md) | Font loading strategy and FOUC prevention |
| [MARS_CLASS_ARCHITECTURE.md](MARS_CLASS_ARCHITECTURE.md) | Infrastructure design for high-scale deployment |
| [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md) | Terms of service |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | Privacy policy |
| [COOKIE_POLICY.md](COOKIE_POLICY.md) | Cookie policy |
| [ACCEPTABLE_USE_POLICY.md](ACCEPTABLE_USE_POLICY.md) | Acceptable use policy |

---

## Live Application

**[iamazeyou.me](https://iamazeyou.me)** — Production deployment on Vercel.

The Spark tier is free with no credit card required. Choose The Cosmos (space and science), The Kingdom (fantasy and narrative), or The Cell (biology) to start your first creation.

---

<div align="center">

**Genesis** © 2026 — AI Visual Storytelling Platform

[iamazeyou.me](https://iamazeyou.me) · Built with React 19, Mastra, Gemini, and Supabase

</div>
