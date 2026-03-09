# GENESIS CODEBASE AUDIT REPORT
Generated: 2026-03-09
Audited by: Claude Opus 4.6
Total files audited: 578 (190 .ts, 163 .tsx, 22 .js, 131 .json, 5 .css, 22 .md, 24 .cjs, 21 .sql)
Total commits analyzed: 343 (across 3 local branches, 5 remote branches)

---

## 1. ARCHITECTURE SUMMARY

Genesis is a production AI-powered visual storytelling and edutainment platform (`genesis-ebook-generator` v2.0.0) where users create illustrated ebooks, character worlds, visual learning content, and infographics using Google Gemini AI. The frontend is a React 19 SPA built with Vite 6, TypeScript 5.7, and Tailwind CSS v4, deployed on Vercel with serverless API routes. The backend consists of two layers: (1) a Mastra-based multi-agent AI server (Hono HTTP, port 4111) hosting 6 specialized AI agents and 2 workflows for book generation and brand voice RAG, and (2) Vercel serverless functions proxying AI API calls (Gemini for text, Bytez for images). Data persistence uses Supabase (PostgreSQL + Auth + Storage) with ~40 tables. The platform supports 4 subscription tiers (Spark/free, Creator, Studio, Empire) with Paystack payment processing, 9 languages, PWA offline support, and an extensive integration ecosystem (18+ third-party services including Sentry, Statsig, Algolia, Liveblocks, PostHog, Cloudinary, and others).

---

## 2. TECH STACK -- CONFIRMED

| Technology | Version | Role |
|---|---|---|
| React | 19.0.0 | UI framework |
| TypeScript | 5.7.2 | Type system |
| Vite | 6.0.5 | Build tool, dev server (port 3000), HMR via SWC |
| Tailwind CSS | 4.0.0 | Utility-first CSS, v4 with Vite plugin (not PostCSS) |
| React Router DOM | 7.9.6 | Client-side routing |
| Supabase JS | 2.84.0 | Auth, PostgreSQL, Storage, Realtime |
| Mastra Core | 1.10.0 | AI agent orchestration framework |
| Mastra PG | 1.7.2 | PostgreSQL adapter for Mastra state persistence |
| Mastra RAG | 2.1.2 | Retrieval-augmented generation (pgvector) |
| Mastra Memory | 1.6.1 | Conversational memory persistence |
| Hono | 4.12.5 | Lightweight HTTP server for Mastra backend |
| @ai-sdk/google | 3.0.43 | Google AI SDK for agent model routing |
| @google/generative-ai | 0.24.1 | Direct Gemini API client (embeddings, legacy) |
| Bytez.js | 3.0.0 | Image generation API client |
| Framer Motion | 12.23.24 | Animation library |
| Radix UI | Various 1.x/2.x | Accessible headless UI primitives (15 packages) |
| shadcn/ui | 3.8.5 | Component code generation (via Radix + CVA) |
| Lucide React | 0.473.0 | Icon library |
| i18next + react-i18next | 25.7.1 / 16.3.5 | Internationalization (9 locales) |
| Paystack Inline JS | 2.22.7 | Payment processing |
| jose | 6.1.3 | JWT verification (serverless middleware) |
| jsPDF | 3.0.4 | Client-side PDF generation |
| html2canvas | 1.4.1 | Screenshot/export functionality |
| Rollbar | 2.26.5 | Error monitoring (primary) |
| Sentry | 8.55.0 | Error monitoring (secondary) |
| Statsig | 3.31.0 | Feature flags and experimentation |
| Upstash Redis | 1.36.0 | Rate limiting and caching |
| Algolia | 5.46.2 | Full-text search |
| Liveblocks | 3.12.1 | Real-time collaboration |
| PostHog | (via integration) | Product analytics |
| Cloudinary | (via integration) | Media optimization |
| Vercel Analytics | 1.5.0 | Web analytics |
| New Relic | 13.8.1 | APM (server-side) |
| OpenTelemetry | 1.9.0 | Distributed tracing |
| Zod | 4.3.6 | Schema validation |
| Biome | 1.9.4 | Primary linter/formatter |
| ESLint | 9.17.0 | Secondary linter |
| Vitest | 4.0.15 | Unit testing (v8 coverage) |
| Playwright | 1.58.2 | E2E testing (6 browsers/devices) |
| Husky | 9.1.7 | Git hooks (commitlint active, lint-staged disabled) |
| Node.js | >=22.13.0 | Runtime requirement |
| npm | 10.9.0 | Package manager |

---

## 3. SERVICE LAYER MAP

### 3.1 Mastra AI Backend (Server-Side -- port 4111)

| File | Responsibility | Model Used |
|---|---|---|
| `mastra/index.ts` | Central Mastra instance; registers agents, workflows, scorer, PG storage, observability | -- |
| `mastra/server.ts` | Hono HTTP server with JWT auth, CORS, rate limiting (30 req/min), SSE streaming, gamification endpoints | -- |
| `mastra/db.ts` | Shared Supabase admin client singleton for agent database tools | -- |
| `mastra/lib/geminiProvider.ts` | Model router string helper (`google/gemini-2.0-flash`) | -- |
| `mastra/schemas.ts` | Zod validation schemas for book generation, brand voice, and shared types | -- |
| `mastra/agents/storyArchitectAgent.ts` | Book structure planning, page content generation, pacing analysis | gemini-2.0-flash |
| `mastra/agents/characterArtistAgent.ts` | Character sheet generation with in-memory consistency store (30-min TTL) | gemini-2.0-flash |
| `mastra/agents/styleArchitectAgent.ts` | Art direction, style guide generation, mood boards (in-memory store, NO TTL) | gemini-2.0-flash |
| `mastra/agents/storyEditorAgent.ts` | Text improvement, tone tuning, writing suggestions (in-memory store, NO TTL) | gemini-2.0-flash |
| `mastra/agents/gamificationAgent.ts` | XP, streaks, badges, daily challenges (DB-driven via Supabase admin) | gemini-2.0-flash |
| `mastra/agents/qualityAssuranceAgent.ts` | Content scoring, auto-improvement, child safety review | gemini-2.0-flash |
| `mastra/workflows/bookGenerationWorkflow.ts` | 10-step book generation pipeline with human-in-the-loop approval | gemini-2.0-flash |
| `mastra/workflows/brandVoiceRAGWorkflow.ts` | RAG pipeline: chunk text, embed (gemini-embedding-001, 768-dim), store in pgvector, query | gemini-embedding-001 |
| `mastra/evals/bookQualityEval.ts` | Deterministic quality scorer (Flesch-Kincaid, grammar, coherence, age-appropriateness, completeness) | None (deterministic) |

### 3.2 Legacy Client-Side Services (Being Migrated to Mastra)

| File | Responsibility | Proxied Through |
|---|---|---|
| `services/geminiService.ts` | ~1500 lines. AI text/image generation, prompt caching (localStorage, 7-day TTL), token bucket rate limiting, 11-key rotation | `/api/ai-generate`, `/api/ai-bytez` |
| `services/grokService.ts` | Text improvement, consistency checking, writing suggestions. Name is misleading -- actually calls Gemini, not Grok | `/api/ai-generate` |
| `src/services/mastraClient.ts` | Typed HTTP/SSE client for Mastra backend; auto-retry with exponential backoff (2 retries, 1s base delay) | Direct to Mastra server |

### 3.3 Data/Platform Services

| File | Responsibility |
|---|---|
| `services/supabaseClient.ts` | Supabase client init; dummy stub when env vars missing; exported as `any` (type-unsafe) |
| `services/storageService.ts` | Book CRUD via Supabase Storage; localStorage offline fallback |
| `services/shareService.ts` | Book sharing with short codes via `shared_books` table |
| `services/profileService.ts` | User profile CRUD via `profiles` table; cached in memory |
| `services/libraryService.ts` | User book/infographic library management |
| `services/paystackService.ts` | Payment initialization and verification via Paystack API |
| `services/paystackSubscription.ts` | Subscription event logging to `subscription_events` table |
| `services/emailService.ts` | Email sending via `/api/send-email` (Resend) |
| `services/tierLimits.ts` | Tier limit constants and enforcement (SPARK/CREATOR/STUDIO/EMPIRE) |
| `services/collaborationService.ts` | Multi-user collaboration sessions, challenges, reactions |
| `services/greenRoomService.ts` | Character interview sessions ("Green Room") |
| `services/greenRoomAIService.ts` | AI-powered character persona and dialogue |
| `services/remixService.ts` | Book/world remixing and forking |
| `services/storyBibleService.ts` | Story bible generation and management |
| `services/broadcastService.ts` | Live broadcast sessions with viewers and mentoring |
| `services/notificationService.ts` | User notification system |
| `services/insightsService.ts` | User analytics and insights dashboard |
| `services/versionControlService.ts` | Visual asset version control (branches, diffs) |

### 3.4 Infrastructure Services

| File | Responsibility |
|---|---|
| `services/api/authenticatedFetch.ts` | Attaches Supabase JWT Bearer token to all API requests |
| `services/api/base.ts` | Base API client wrapper |
| `services/performanceOptimizations.ts` | LRUCache, RequestQueue, debounce, throttle, retry, connection pool |
| `services/serviceWrapper.ts` | `safeCall<T>()` Result-type error wrapper |
| `services/analytics/circuitBreakerService.ts` | Per-user spending limits with model downgrade fallback |
| `services/security/securityGuard.ts` | CSRF, XSS detection, SQL injection detection, path traversal, URL sanitization, rate limiting |
| `services/security/sanitizationService.ts` | PII detection, prompt injection detection (18+ patterns), children's content policy |
| `services/security/auditLogger.ts` | In-memory security audit logging (28 event types, 10k cap) |
| `services/featureFlags/featureFlagService.ts` | In-memory feature flags with percentage rollouts |
| `services/observability/aiObservabilityService.ts` | In-memory circular buffer tracing for AI operations |
| `services/observability/metricsService.ts` | Counter/histogram/gauge metrics collection |
| `services/observability/sloTracker.ts` | SLO/SLI tracking |
| `services/observability/alertManager.ts` | Alert routing (Slack/Discord webhooks) |
| `services/observability/structuredLogger.ts` | Structured JSON logging |
| `services/search/algoliaService.ts` | Full-text search (Algolia write key is empty -- writes silently fail) |
| `services/infrastructure/r2Storage.ts` | Cloudflare R2 object storage |
| `services/infrastructure/jobQueue.ts` | BullMQ job queue integration |
| `services/infrastructure/rateLimiter.ts` | Upstash Redis rate limiting |
| `services/infrastructure/semanticCache.ts` | Embedding-based semantic cache |

### 3.5 Vercel Serverless API Routes

| File | Responsibility |
|---|---|
| `api/_middleware.ts` | Auth (JWT via jose), CORS, per-IP/user rate limiting, request logging |
| `api/ai-generate.ts` | Gemini text generation proxy (GEMINI_API_KEY_1, model allowlist) |
| `api/ai-bytez.ts` | Bytez image generation proxy (BYTEZ_API_KEY_1) |
| `api/paystack.ts` | Paystack webhook handler (charge, verify, webhook actions) |
| `api/send-email.ts` | Email via Resend API |
| `api/storage.ts` | Cloudflare R2 storage operations |
| `api/jobs.ts` | Background job management |
| `api/health.ts` | Health check endpoint |
| `api/service-proxy.ts` | General third-party service proxy |

---

## 4. COMPONENT MAP

### 4.1 Provider Hierarchy (Root Down)

```
React.StrictMode
  RollbarProvider
    RollbarErrorBoundary
      ErrorBoundary (class)
        IntegrationsProvider (Sentry, Statsig, HyperDX, Upstash, Checkly, Arcjet)
          AuthProvider (Supabase auth, Google OAuth, email auth)
            BrowserRouter
              App (thin wrapper)
                AppRouter (route-level code splitting)
```

Within MainApp:
```
ErrorBoundary
  ThemeProvider
    FontProvider
      LanguageProvider
        DirectionProvider (RTL support)
          MainAppContent
```

### 4.2 Route-Level Components

| Route | Component | Lazy? | Guard |
|---|---|---|---|
| `/payment-callback` | PaymentCallback | Yes | None |
| `/auth` | AuthPage | Yes | None |
| `/tier/creator\|studio\|empire` | TierDetail* | Yes | TierLayout wrapper |
| `/blog` | BlogIndex | Yes | ThemeProvider only |
| `/blog/:slug` | BlogPost | Yes | ThemeProvider only |
| `/welcome/*` | OnboardingApp | Yes | OnboardingGuard (localStorage + profile check) |
| `/*` | MainApp | Yes | MainAppGuard (localStorage + profile check) |

### 4.3 MainApp Internal Routing (Mode-Based Switch)

| Path | AppMode | Component |
|---|---|---|
| `/` | DASHBOARD | CreationCanvas |
| `/create` | CREATION | CreationCanvas (shouldFocusCreation) |
| `/editor` | EDITOR | SmartEditor |
| `/visual-studio` | VISUAL_STUDIO | VisualStudio |
| `/settings` | SETTINGS | SettingsPanel |
| `/pricing` | PRICING | PricingPage |
| `/gamification` | GAMIFICATION | GamificationHub |
| `/success` | SUCCESS | BookSuccessView |
| `/viewer` | VIEWER | StorybookViewer |
| `/legal` | LEGAL | LegalViewer |
| `/shared/:shortCode` | -- | SharedBookViewer |

### 4.4 Key Component Responsibilities

| Component | Props | State Count | Key Services | Notes |
|---|---|---|---|---|
| **MainAppContent** | None | 15+ | profileService, geminiService, tierLimits | GOD COMPONENT: manages generation, navigation, profile, modals, project state |
| **CreationCanvas** | 7 props | 40+ | storageService, tierLimits | GOD COMPONENT: form, brand config, education config, saved books, templates |
| **SmartEditor** | 8 props | 30+ | geminiService, grokService, mastraClient, storageService, storyBibleService | GOD COMPONENT: editing, AI services, green room, remix, consistency |
| **Navigation** | 3 props | 2 | profileService | Duplicates profile fetch from MainApp |
| **SettingsPanel** | 3 props | 6+ | profileService | Triplicates profile fetch |
| **AuthPage** | None | 7 | AuthContext methods | Clean; open redirect validation |
| **BookViewer** | 2 props | 2 | None | Clean, focused, minimal state |
| **GreenRoom** | 6 props | 11 | greenRoomService | Well-encapsulated feature module |
| **GenerationTheater** | 3 props | 1 | particles utility | Clean animation overlay |
| **PricingPage** | 1 prop | 3 | None (hardcoded Paystack URLs) | Contains hardcoded payment plan codes |
| **Sidebar** | 2 props | 0 | None | LEGACY/DEAD: references non-existent AppModes |

### 4.5 Context Providers

| Context | Key Values Exposed | Consumers | Status |
|---|---|---|---|
| AuthContext | user, session, loading, userProfile, sign-in/out methods | 14+ components | Active (core) |
| ThemeContext | currentTheme, isDarkMode, setTheme, toggleDarkMode | Navigation, MainApp, blog routes | Active |
| IntegrationsContext | isReady, sentry, statsig, hyperdx, upstash, arcjet, checkFeature | Service bootstrap | Active |
| FontContext (src/) | activeFontPairing, setFontPairing, availablePairings | SettingsPanel FontSelector | Active |
| LanguageContext (src/) | currentLanguage, changeLanguage, direction, format* | SettingsPanel LanguageSelector | Active (wraps react-i18next) |
| I18nContext (contexts/) | language, direction, setLanguage, t() | -- | DEAD (never mounted) |
| InfrastructureContext | isReady, services, health, reinitialize | -- | DEAD (never mounted) |

---

## 5. DATA FLOW

### 5.1 Book Generation Flow (Primary User Journey)

```
User fills CreationCanvas form (prompt, style, tone, audience, pages)
  --> MainAppContent.handleGenerateProject()
      --> tierLimits.canCreateEbook() (localStorage + server fallback)
      --> geminiService.generateBookStructure() (legacy path)
          --> authenticatedFetch('/api/ai-generate')
              --> api/ai-generate.ts (JWT verify, rate limit)
                  --> Google Gemini API (gemini-2.0-flash)
      --> For each page: geminiService.generateIllustration()
          --> authenticatedFetch('/api/ai-bytez')
              --> api/ai-bytez.ts (JWT verify, rate limit)
                  --> Bytez API (imagen-4.0)
      --> storageService.saveBook() (Supabase Storage)
      --> tierLimits.incrementEbookCount() (localStorage + Mastra server)
      --> Navigate to /success with BookSuccessView
```

### 5.2 Mastra Agent Flow (New Architecture)

```
User action in SmartEditor/CreationCanvas
  --> mastraClient.generateBookStructure() or similar
      --> HTTP POST to Mastra server (port 4111)
          --> mastra/server.ts (JWT verify via supabaseAdmin)
              --> mastra/index.ts agent resolution
                  --> Agent.generate() with Gemini model
                      --> Google AI SDK (@ai-sdk/google)
      --> SSE stream back to client for real-time updates
```

### 5.3 Auth Flow

```
Landing/Auth --> signInWithGoogle() or signInWithEmail()
  --> Supabase Auth (OAuth or email/password)
  --> AuthContext.onAuthStateChange listener
      --> ensureUserProfile() creates/updates profiles table
      --> sendWelcomeEmail() queued in sessionStorage
      --> setUser(), setSession(), setDbProfile()
  --> AppRouter guards check localStorage/profile
      --> Route to /welcome (new) or /* (returning)
```

### 5.4 Payment Flow

```
PricingPage --> Paystack hosted payment page (hardcoded URLs)
  --> User completes payment
  --> Paystack webhook --> api/paystack.ts
      --> Verify payment
      --> Update profiles.tier in Supabase
      --> Log to subscription_events table
  --> Redirect to /payment-callback
      --> PaymentCallback verifies and updates local state
```

---

## 6. GIT HISTORY KEY DECISIONS

### Decision 1: Chat System Removed (commit 0326c40, 13b06a6)
A full real-time chat system (23 files: ChatConversation, ChatInterface/*, ChatPanel, ChatWidget, EmojiPicker, MessagesWidget, NotificationPanel, realtimeChatService, useRealtimeChat) was built and deliberately deleted. **Never recreate a chat system without explicit instruction.**

### Decision 2: Auth Modal --> Auth Page (commits 1bafc4b, 556bdeb)
Authentication was refactored from a modal overlay (`AuthModal.tsx`) to a dedicated full-page route (`AuthPage.tsx`). **Never convert auth back to a modal.**

### Decision 3: Supabase Client Consolidated (commit 693e41a)
`lib/supabase.ts` and `lib/supabaseHelpers.ts` were deleted and consolidated into `services/supabaseClient.ts`. **Never create separate Supabase client initialization files.**

### Decision 4: PaystackIntegration Component Extracted (commit 760e2b1)
`PaystackIntegration.tsx` was removed; payment logic was extracted into `paystackService.ts` and the API layer. **Keep payment logic in services, not components.**

### Decision 5: Mastra AI Framework Introduced (commit ca4cd77)
The Mastra multi-agent framework was introduced in a single large commit, representing a deliberate architectural shift from direct client-side AI calls to server-side agent orchestration. The migration is ongoing -- both paths coexist.

### Decision 6: Blog System Added (commits a863a07 through 952178e)
A public SEO-ready blog system was added with its own "Searchable editorial theme" (stone palette, Instrument Serif, terracotta accents) that deliberately operates outside the main theme system.

### Decision 7: Development on Feature Branch
All active development happens on `Gemini-api-connections` branch with periodic PR merges to `main` (9 PRs merged so far). The `PWA` branch appears stale.

### Decision 8: Copilot Suggestions Created but Not Merged
Two remote branches (`copilot/improve-inefficient-code`, `copilot/remove-14-day-trial-references`) exist from GitHub Copilot automated suggestions. These have NOT been merged, suggesting the developer reviews and rejects automated suggestions rather than auto-merging.

---

## 7. DEVELOPER INTENT -- PATTERNS I MUST RESPECT

### Naming Conventions
- **Components:** PascalCase filenames matching exported component name (e.g., `CreationCanvas.tsx`)
- **Services:** camelCase filenames with domain-first naming (e.g., `geminiService.ts`, `paystackService.ts`)
- **Hooks:** `use` prefix, camelCase (e.g., `useAutoSave.tsx`, `useGoogleOneTap.ts`)
- **Contexts:** PascalCase with `Context` suffix (e.g., `AuthContext.tsx`, `ThemeContext.tsx`)
- **Agents:** camelCase with `Agent` suffix (e.g., `storyArchitectAgent.ts`)
- **Workflows:** camelCase with `Workflow` suffix (e.g., `bookGenerationWorkflow.ts`)
- **API routes:** kebab-case (e.g., `ai-generate.ts`, `send-email.ts`)

### Code Style
- **Primary linter:** Biome (not ESLint; ESLint is secondary)
- **Formatting:** 2-space indent, single quotes, semicolons, ES5 trailing commas
- **Imports:** Use path aliases (`@/*`, `@components/*`, `@services/*`, etc.)
- **Commit messages:** Conventional commits enforced via commitlint (feat:, fix:, docs:, style:, etc.)
- **Console logging:** Uses emoji decorators throughout (this is an established pattern, not an oversight)

### Architectural Patterns
- **Service wrapper:** Use `safeCall<T>()` from `serviceWrapper.ts` for Result-type error handling
- **Auth middleware:** Three-layer auth: client JWT auto-refresh, API middleware JWT verify (jose), Mastra server JWT verify (supabaseAdmin)
- **Rate limiting:** Three-layer: client token bucket, API middleware per-IP/user, Mastra server per-user
- **Theme system:** CSS variables on `:root` with runtime switching via ThemeContext
- **Lazy loading:** `lazyWithRetry` wrapper for chunk error recovery (auto-retry on dynamic import failure)
- **Environment validation:** Zod schemas in `config/env.ts` for required env vars
- **Security:** Defense-in-depth with dedicated security services (XSS, CSRF, PII detection, prompt injection)
- **Flat design:** All box-shadows globally set to `none` -- this is deliberate aesthetic choice

### Technology Choices
- **Radix UI + shadcn/ui** for accessible component primitives (never use raw HTML for dialogs, dropdowns, etc.)
- **Framer Motion** for animation (never introduce another animation library)
- **Lucide React** for icons (never introduce another icon library)
- **Tailwind v4** with CSS-first `@theme` configuration in `index.css`

---

## 8. ACTIVE BRANCHES -- WORK IN PROGRESS

| Branch | Status | Content |
|---|---|---|
| `Gemini-api-connections` (current) | Active, primary development | All current features; massive divergence from main |
| `main` | Stable release | Receives periodic PR merges from Gemini-api-connections |
| `PWA` (local only) | Likely stale | PWA feature work (appears incorporated into main branch already) |
| `origin/copilot/improve-inefficient-code` | Unmerged | GitHub Copilot automated code improvement suggestions |
| `origin/copilot/remove-14-day-trial-references` | Unmerged | GitHub Copilot suggestion to remove trial references |
| `origin/vercel/install-and-configure-vercel-s-d99s6w` | Unknown | Vercel configuration suggestion |

---

## 9. CRITICAL ISSUES FOUND

### CRITICAL

1. **Hardcoded API Key in Source** -- `test-grok-api.js` contains an OpenRouter API key (`sk-or-v1-...`) in plaintext. This file is untracked but not in `.gitignore`. The key must be rotated immediately and the file added to `.gitignore`. (Severity: CRITICAL)

2. **Tier Limits Defined in 3 Separate Locations** -- `services/tierLimits.ts`, `mastra/agents/storyArchitectAgent.ts` (lines 54-59), and `mastra/workflows/bookGenerationWorkflow.ts` (lines 104-109) each define their own copy of tier limits. Any update to one without the others creates enforcement drift between client and server. (Severity: CRITICAL)

3. **Algolia Write Key Empty** -- `services/search/algoliaService.ts` line 29 has `ALGOLIA_WRITE_KEY = ''`. All Algolia indexing operations silently fail. (Severity: CRITICAL)

### HIGH

4. **Production Logging of Sensitive Auth Data** -- `AuthContext.tsx` `signInWithIdToken` logs token length, user email, and session details via unconditional `console.warn` (lines 262, 298-309) in production. (Severity: HIGH)

5. **Rate Limit User ID Spoofing** -- `api/_middleware.ts` `extractUserIdUnsafe()` accepts `req.query.user_id` as a rate-limit identifier (line 206), allowing attackers to spread rate limits across arbitrary IDs. (Severity: HIGH)

6. **Supabase Service Role Key Exported** -- `mastra/index.ts` exports `supabaseServiceRoleKey` from the module. Any accidental client-side import chain would expose the admin key. (Severity: HIGH)

7. **Multiple Non-Singleton Supabase Admin Clients** -- `gamificationAgent.ts` and `brandVoiceRAGWorkflow.ts` create new Supabase admin clients per invocation instead of reusing the shared `mastra/db.ts` singleton. (Severity: HIGH)

8. **Stub Agent Tools** -- Multiple Mastra agent tools (generateVisualIdentity, analyzePageQuality, improvePageContent, writePageTool, improveTool) return placeholder data and rely entirely on the LLM. Tool descriptions imply they perform operations they do not execute. (Severity: HIGH)

9. **CSP Includes `unsafe-inline` for script-src** -- `vercel.json` CSP policy allows inline scripts, weakening XSS protection. (Severity: HIGH)

10. **CORS Defaults to Wildcard** -- API middleware defaults to `Access-Control-Allow-Origin: *` when no specific config is provided. (Severity: HIGH)

### MEDIUM

11. **Memory Leaks in Long-Running Processes** -- `styleArchitectAgent.ts` `styleGuideMemory` Map and `storyEditorAgent.ts` `sessionMemory` Map have NO TTL cleanup or eviction, unlike `characterMemory` (30-min) and `qaReports` (1-hour). (Severity: MEDIUM)

12. **Supabase Client Exported as `any`** -- `services/supabaseClient.ts` line 74 casts the client to `any`, disabling TypeScript safety for all ~40 table name references across the codebase. (Severity: MEDIUM)

13. **23+ Environment Variables Without Validation** -- Only 7 of ~30 `VITE_*` variables are declared in the Zod schema in `config/env.ts`. The rest are used directly without validation and silently `undefined` if not set. (Severity: MEDIUM)

14. **localStorage Data Unencrypted** -- User settings including name, email, and avatar are stored in plaintext localStorage. The `secureStorage` wrapper exists but uses `sessionStorage` only. (Severity: MEDIUM)

15. **Triplicate Profile Fetching** -- `getUserProfile()` is called independently in MainApp, Navigation, and SettingsPanel, each maintaining separate state. AuthContext also derives a profile, creating 4 sources of truth. (Severity: MEDIUM)

16. **Blog Components Bypass Theme System** -- BlogPost, BlogIndex, and BlogCard define independent hardcoded color palettes that do not respond to theme changes. (Severity: MEDIUM -- may be intentional)

17. **Duplicate I18n System** -- `contexts/I18nContext.tsx` is a hand-rolled i18n system that is never mounted. Active system is `react-i18next` via `src/contexts/LanguageContext.tsx`. Dead code should be removed. (Severity: MEDIUM)

18. **Unused InfrastructureContext** -- `contexts/InfrastructureContext.tsx` defines a full infrastructure bootstrap system but is never mounted in the provider tree. (Severity: MEDIUM)

19. **In-Memory Audit Logs Not Persisted** -- `security/auditLogger.ts` stores up to 10,000 audit events in memory only. All logs lost on page refresh or serverless cold start. (Severity: MEDIUM)

20. **Overly Broad PII Regex** -- `sanitizationService.ts` `bankAccount` pattern (`/\b\d{8,17}\b/g`) matches any 8-17 digit number (timestamps, phone numbers, order IDs), causing false positives. (Severity: MEDIUM)

21. **Feature Flag Analytics Not Implemented** -- `featureFlagService.ts` has a `logEvaluation()` method that is never called. Flag evaluations are never tracked. (Severity: MEDIUM)

### LOW

22. **localStorage JSON.parse Without try/catch** -- `tierLimits.ts` line 109 parses localStorage data without error handling. Corrupted data will crash the app. (Severity: LOW)

23. **Naming Mismatch: grokService.ts** -- File is named `grokService` but actually calls Gemini API. The `MASTER_GROK_PROMPT` in `infographicService.ts` is also sent to Gemini. (Severity: LOW)

24. **Legacy Sidebar Component** -- `components/Sidebar.tsx` references `AppMode.LAYOUT_LAB` and `AppMode.EXPORT` which do not exist in the current routing. Appears replaced by `Navigation.tsx`. (Severity: LOW)

25. **Hardcoded Paystack URLs** -- `PricingPage.tsx` contains hardcoded payment URLs and plan codes directly in source. Should be in environment variables or config. (Severity: LOW)

26. **Hardcoded Character Data** -- `SmartEditor.tsx` embeds 200+ lines of default character personality profiles directly in the component file. (Severity: LOW)

27. **Duplicate Shadow/Animation Config** -- Shadows and animations defined in both `index.css @theme` and `tailwind.config.js`, requiring dual updates. (Severity: LOW)

28. **Hybrid Routing Anti-Pattern** -- MainApp uses React Router for URLs but a manual `switch` statement for component rendering. No nested `<Route>` components; no route-level code splitting within MainApp. (Severity: LOW)

29. **Observability ID Collisions** -- `aiObservabilityService.ts` uses `timestamp + counter` for IDs (not UUID). Potential collisions in distributed deployments. (Severity: LOW)

---

## 10. THINGS I MUST NEVER DO

Based on the audit, the following actions are PROHIBITED without explicit developer instruction:

1. **Never reinitialize the Supabase client** -- It is initialized in `services/supabaseClient.ts` with graceful degradation. Never create a new `createClient()` call in frontend code. The Mastra server has its own admin client in `mastra/db.ts`.

2. **Never recreate the chat system** -- A full real-time chat (23 files) was deliberately removed in commits `0326c40` and `13b06a6`. This was a conscious architectural decision.

3. **Never convert AuthPage back to a modal** -- Authentication was deliberately moved from `AuthModal.tsx` to a full-page `AuthPage.tsx`.

4. **Never introduce new animation libraries** -- Framer Motion is the established choice. Never add GSAP, anime.js, or others.

5. **Never introduce new icon libraries** -- Lucide React is the standard. Never add FontAwesome, Heroicons, or others.

6. **Never add box-shadows** -- All shadows are globally set to `none` as a deliberate flat design choice. Do not add shadows to components.

7. **Never bypass the theme CSS variable system** -- Use `var(--color-*)` tokens for colors. Do not introduce new hardcoded hex colors in components (existing blog theme is a known exception).

8. **Never use ESLint as the primary linter** -- Biome is the primary linter/formatter. ESLint is secondary and used only for React-specific rules.

9. **Never store secrets in VITE_ prefixed env vars** -- All API keys must go through server-side proxies (`/api/ai-generate`, `/api/ai-bytez`). Client-side `VITE_GEMINI_API_KEY_*` vars are legacy and being deprecated.

10. **Never create a separate Supabase migration file** -- SQL migrations go in `supabase/migrations/` with sequential numbering (002, 003, etc.).

11. **Never move tier limit checking to client-only** -- The three-layer validation (client localStorage fallback, API middleware, Mastra server) is intentional defense-in-depth.

12. **Never auto-merge Copilot suggestions** -- Two Copilot branches exist unmerged, indicating the developer manually reviews and often rejects automated suggestions.

13. **Never rename AppMode or MODE_TO_PATH** -- The hybrid routing system in MainApp is fragile; changing mode names or path mappings will break navigation across multiple components.

14. **Never remove the LazyWithRetry wrapper** -- Chunk loading errors are handled by this wrapper with auto-retry. Replacing with bare `React.lazy` will cause uncaught import failures.

---

## 11. ENVIRONMENT VARIABLES REQUIRED

### Required for Basic Operation
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key (client-side) |
| `SUPABASE_URL` | Supabase project URL (server-side, Mastra + API routes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side only) |
| `SUPABASE_JWT_SECRET` | JWT verification secret (API middleware) |

### Required for AI Features
| Variable | Description |
|---|---|
| `GEMINI_API_KEY_1` | Google Gemini API key (server-side, API route) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key for Mastra agents |
| `BYTEZ_API_KEY_1` | Bytez API key for image generation (server-side) |

### Required for Payments
| Variable | Description |
|---|---|
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key (client-side) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (server-side webhook) |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signature verification |

### Required for Mastra Backend
| Variable | Description |
|---|---|
| `MASTRA_PG_CONNECTION_STRING` | PostgreSQL connection for Mastra state persistence |
| `VITE_MASTRA_URL` | Mastra server URL for client-side calls |

### Required for Auth
| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (One Tap + OAuth) |

### Optional Integrations (graceful degradation when missing)
| Variable | Description |
|---|---|
| `VITE_ROLLBAR_ACCESS_TOKEN` | Error monitoring (Rollbar) |
| `VITE_SENTRY_DSN` | Error monitoring (Sentry) |
| `VITE_STATSIG_CLIENT_KEY` | Feature flags (Statsig) |
| `VITE_POSTHOG_API_KEY` | Product analytics (PostHog) |
| `VITE_ALGOLIA_APP_ID` + `VITE_ALGOLIA_SEARCH_API_KEY` | Full-text search (Algolia) |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | Real-time collaboration (Liveblocks) |
| `VITE_KNOCK_PUBLIC_API_KEY` | Notifications (Knock) |
| `VITE_HYPERDX_API_KEY` | Observability (HyperDX) |
| `VITE_CLOUDINARY_CLOUD_NAME` + `VITE_CLOUDINARY_API_KEY` | Media optimization (Cloudinary) |
| `VITE_ELEVENLABS_API_KEY` | Voice synthesis (ElevenLabs) |
| `VITE_MUX_TOKEN_ID` | Video processing (Mux) |
| `VITE_UPSTASH_REDIS_REST_URL` + `VITE_UPSTASH_REDIS_REST_TOKEN` | Redis caching (Upstash) |
| `VITE_CHECKLY_ACCOUNT_ID` | Synthetic monitoring (Checkly) |
| `VITE_ARCJET_KEY` | Edge security (Arcjet) |
| `RESEND_API_KEY` | Email sending (server-side) |
| `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME` | Object storage (Cloudflare R2) |
| `REDIS_URL` | Job queue (BullMQ) |
| `NEW_RELIC_LICENSE_KEY` | APM (New Relic, server-side) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Distributed tracing (OpenTelemetry) |
| `SENTRY_AUTH_TOKEN` | Sentry sourcemap upload (build-time) |

---

## 12. OPEN QUESTIONS FOR DEVELOPER

1. **Mastra migration status:** The codebase has both legacy `geminiService.ts` (client-side proxy via `/api/ai-generate`) and new Mastra agents. What is the migration timeline? Should new features use Mastra agents exclusively, or is the legacy path still the primary code path for production?

2. **Blog theme intentionality:** The blog components (BlogPost, BlogIndex, BlogCard) define their own hardcoded "Searchable editorial theme" that bypasses the main theme system. Is this intentional (blog should have fixed branding) or should it be integrated into the theme context?

3. **InfrastructureContext and I18nContext:** Both are defined but never mounted in the provider tree. Should they be removed as dead code, or are they planned for future integration?

4. **Sidebar.tsx:** Is this component still used anywhere, or has it been fully replaced by `Navigation.tsx`? It references `AppMode.LAYOUT_LAB` and `AppMode.EXPORT` which don't exist in current routing.

5. **Tier limit duplication:** Tier limits exist in three places (services/tierLimits.ts, storyArchitectAgent.ts, bookGenerationWorkflow.ts). Should these be unified into a shared source that both client and server import?

6. **Supabase client as `any`:** The Supabase client is cast to `any` in `supabaseClient.ts`. Was this a temporary workaround for a type issue, or a deliberate choice? Would you like type-safe table references via generated types?

7. **Test coverage:** The Vitest config has 50% minimum coverage thresholds, but only one test file (`LoadingSpinner.test.tsx`) was found. What is the testing strategy? Are E2E tests via Playwright the primary testing approach?

8. **Hardcoded Paystack plan codes:** `PricingPage.tsx` contains hardcoded payment URLs and plan codes. Should these be moved to environment variables, a config file, or fetched from the API?

9. **Key rotation status:** The codebase references `GEMINI_API_KEY_1` through `_11` and `BYTEZ_API_KEY_1` through `_11` for key rotation. Are all 11 key slots populated, or is this aspirational? The `test-grok-api.js` file contains a plaintext OpenRouter key -- has this key been rotated?

10. **PWA branch:** The local `PWA` branch exists but PWA functionality appears to already be in the main codebase (vite-plugin-pwa in vite.config.ts). Can this branch be deleted?
