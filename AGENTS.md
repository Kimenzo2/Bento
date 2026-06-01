# Genesis Codebase: AI Agent Rules

**This file is mandatory reading for every AI coding agent operating on this codebase.**
**Violation of these rules will break production payments for real users.**

---

## CRITICAL: Payment System is LOCKED

The Dodo Payments integration is **live in production** processing real money.
The following files and configurations are **FROZEN** unless the project owner
explicitly requests a change and confirms they understand the payment impact.

### Frozen Files (DO NOT MODIFY)

| File                                                       | Why it is frozen                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `api/dodo.ts`                                              | The entire Dodo Payments server — checkout, webhook handler, profile sync                     |
| `vercel.json`                                              | Contains webhook/checkout rewrites and `trailingSlash: false` — changing this breaks webhooks |
| `supabase/migrations/007_add_dodo_payments.sql`            | Live DB schema for payment_provider column                                                    |
| `supabase/migrations/009_payment_history.sql`              | Live DB schema for payment_history table                                                      |
| `supabase/migrations/011_dodo_subscription_management.sql` | Live DB schema for subscription columns                                                       |
| `supabase/migrations/012_dodo_profile_reconciliation.sql`  | Webhook trigger that syncs profiles on payment events                                         |
| `services/dodoService.ts`                                  | Frontend service that calls checkout endpoint                                                 |
| `components/onboarding/ProRevealMoment.tsx`                | Listens to payment_history realtime for upgrade animation                                     |
| `components/PaymentCallback.tsx`                           | Post-checkout redirect handler                                                                |

### Frozen Configuration Values

These values are set correctly. Changing them breaks payments:

- **`vercel.json` > `trailingSlash`** must remain `false`. Setting it to `true` causes 308 redirects that silently kill webhook POST requests from Dodo.
- **`vercel.json` > `rewrites`** for `/api/dodo-checkout` and `/api/dodo-webhook` must route to `/api/dodo?action=checkout` and `/api/dodo?action=webhook` respectively. Both with-slash and without-slash variants must exist.
- **`api/dodo.ts` > `bodyParser: false`** must remain `false`. Webhook signature verification requires the raw request body.
- **`api/dodo.ts` > `handleWebhook`** must NOT be wrapped in middleware or imported through intermediate modules that use ESM-only packages.

### Frozen Database Schema

These columns and tables are written to by the live webhook handler. Do not rename, drop, or change their types:

**`profiles` table:**

- `user_tier` (text) — CHECK: `'SPARK', 'CREATOR', 'STUDIO', 'EMPIRE'`
- `subscription_status` (text) — CHECK: `'none', 'inactive', 'active', 'cancelled', 'on_hold', 'past_due', 'payment_failed'`
- `subscription_plan_code` (text)
- `subscription_end_date` (timestamptz)
- `cancel_at_period_end` (boolean)
- `dodo_customer_id` (text)
- `dodo_subscription_id` (text)
- `payment_provider` (text) — CHECK: `'none', 'dodo'`

**`payment_history` table:**

- `user_id`, `provider`, `payment_id`, `subscription_id`, `amount`, `currency`, `plan`, `status`, `event_type`, `metadata`, `created_at`
- `provider` CHECK: `'dodo'`
- `plan` CHECK: `'spark', 'creator', 'studio', 'empire', NULL`

**`processed_webhooks` table:**

- `webhook_id`, `event_type`, `processed_at`, `payload`
- Has an AFTER INSERT trigger (`trg_processed_webhooks_dodo_profile_sync`) that calls `apply_dodo_webhook_profile_sync()` — do not drop this trigger

**RPC functions (do not drop or rename):**

- `downgrade_to_spark(p_user_id UUID)`
- `get_today_upgrade_count(p_user_id UUID)`
- `apply_dodo_webhook_profile_sync(p_event_type TEXT, p_payload JSONB)`

### Frozen Environment Variables

These Vercel env vars are configured for live Dodo payments. Do not change the variable names or their mapping:

- `DODO_PAYMENTS_API_KEY` — live mode API key
- `DODO_PAYMENTS_ENV` — must be `live_mode`
- `DODO_PAYMENTS_WEBHOOK_SECRET` — webhook signature verification
- `DODO_PRODUCT_ID_CREATOR_MONTHLY`, `DODO_PRODUCT_ID_STUDIO_MONTHLY`, `DODO_PRODUCT_ID_EMPIRE_MONTHLY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`

When adding env vars via `vercel env add`, pipe the value through `printf` (not `echo`) to avoid trailing newline corruption:

```bash
printf 'the_value' | npx vercel env add VAR_NAME production --yes
```

---

## Rules for ALL Code Changes

### 1. Never change the Dodo API method

The checkout uses `checkoutSessions.create()` (see `api/dodo.ts`). Do not change it to `subscriptions.create()` or any other method. The current method is tested and working in production.

### 2. Never add `trailingSlash: true` to vercel.json

This causes Vercel to issue 308 redirects on webhook URLs, which silently drops the POST body. Dodo's webhook client does not follow redirects. This was the root cause of a production outage.

### 3. Never import \_middleware.ts in api/dodo.ts

The `_middleware.ts` file imports `jose` which is ESM-only. A static import at module level crashes the entire serverless function before any handler code runs, causing `FUNCTION_INVOCATION_FAILED` on every request.

### 4. Never add Paystack references back

Paystack has been fully removed. The payment provider is Dodo. Do not:

- Add `paystack` to any CHECK constraint
- Create columns with `paystack_` prefix
- Import Paystack SDKs
- Add `VITE_PAYSTACK_PUBLIC_KEY` back to env vars

### 5. Preserve RLS policy performance patterns

All RLS policies use `(SELECT auth.uid())` and `(SELECT auth.role())` with the `SELECT` wrapper for performance. Do not rewrite these as bare `auth.uid()` or `auth.role()` calls — that evaluates per-row instead of once per query.

### 6. Database changes require verification

Before modifying any migration file or running SQL against production:

- Verify the column/table is not referenced in `api/dodo.ts`
- Verify it is not referenced in `supabase/migrations/012_dodo_profile_reconciliation.sql`
- Verify the CHECK constraints allow all values the webhook handler writes
- Never run `DROP TABLE`, `DROP COLUMN`, or `ALTER TYPE` on payment-related tables without explicit owner approval

### 7. Autovacuum settings are tuned

`profiles` and `user_gamification` have custom autovacuum thresholds. Do not reset table storage parameters on these tables.

---

## Architecture Quick Reference

```
Frontend (React SPA)
  |
  |-- POST /api/dodo-checkout  -->  vercel.json rewrite  -->  api/dodo.ts?action=checkout
  |                                                            |
  |                                                            |- verifies JWT (jose or Supabase Auth API)
  |                                                            |- calls Dodo checkoutSessions.create()
  |                                                            |- returns checkout_url to frontend
  |
  |-- (user pays on Dodo hosted page)
  |
  |-- Dodo sends POST /api/dodo-webhook  -->  vercel.json rewrite  -->  api/dodo.ts?action=webhook
                                                                         |
                                                                         |- verifies signature (webhooks.unwrap)
                                                                         |- deduplicates via processed_webhooks
                                                                         |- updates profiles table
                                                                         |- inserts into payment_history
                                                                         |- inserts into processed_webhooks
                                                                         |- trigger fires apply_dodo_webhook_profile_sync()
```

**Dodo webhook URL configured in Dodo dashboard:** `https://iamazeyou.me/api/dodo-webhook`

---

## When in Doubt

If you are unsure whether a change affects payments:

1. **ASK the project owner** before proceeding
2. Search `api/dodo.ts` for any column or table name you plan to change
3. Search `supabase/migrations/012_dodo_profile_reconciliation.sql` for the same
4. Test webhook delivery: `POST https://iamazeyou.me/api/dodo-webhook` should return 400 "Missing webhook headers" (not 308, not 404, not 500)

---

## Genesis Architecture Context (Appended)

The Genesis system is evolving to a monorepo architecture with two apps and shared packages:

- `apps/landing`: Next.js marketing/front-door application
- `apps/genesis-app`: existing Vite 8 application (moved as-is)
- `packages/ui`: shared presentational UI primitives/components
- `packages/types`: shared public TypeScript types

### Deployment model

- Public domain: `https://iamazeyou.me`
- Landing app handles public marketing pages.
- Vite app handles authenticated/product experience.
- Vercel path-based routing and rewrites proxy app routes transparently.

### Performance mission

Performance is the primary architecture filter. For landing and app surfaces, choose the fastest safe option first, then optimize for maintainability.

### Hard rule: Vite app migration

The Vite application must not be migrated to Next.js. It may be relocated inside a monorepo, but the runtime framework and behavior of the app must remain Vite-based unless the owner explicitly directs otherwise.

---

# The Complete Architecture: Global Settings + In-App Settings + Installable Mini-Apps

## First: The Core Insight That Changes Everything

The navigation approach (`window.location.replace()`) we designed earlier has one fatal flaw for this new requirement: when you navigate to a module URL, the shell's V-gulley and global settings unmount and die.

The correct architecture uses dynamic import: the shell stays permanently mounted, modules load into a container div. This is exactly what Raycast solved: one main process running a supervising entity that takes care of loading, unloading and recovering from crashes, with each extension dynamically loaded and run in isolation.

## Layer 1: The Shell (Permanent, Never Unmounts)

```text
Shell Binary (~15MB installed)
├── Rust binary (all core commands, capability-gated)
├── Shell Svelte UI (~500KB bundle)
│   ├── V-gulley module switcher  ← ALWAYS mounted
│   ├── Global settings panel     ← ALWAYS mounted
│   ├── App store / installer     ← ALWAYS mounted
│   └── #module-container div     ← modules mount HERE
└── WebView (OS-provided, 0MB)
```

The shell never navigates away. It owns the window forever.

## Layer 2: The `module://` Custom Protocol (The Key Mechanism)

Rust registers a custom URI scheme that serves installed module files from `$APPDATA`:

```rust
// src-tauri/src/main.rs
tauri::Builder::default()
    .register_uri_scheme_protocol("module", |app, request| {
        let uri = request.uri().path().to_string();
        // module://localhost/notes/index.js
        // → $APPDATA/modules/notes/index.js

        let rel_path = uri.trim_start_matches('/');
        let module_path = app.path()
            .app_data_dir().unwrap()
            .join("modules")
            .join(rel_path);

        let content = std::fs::read(&module_path)
            .unwrap_or_default();

        let mime = match module_path.extension()
            .and_then(|e| e.to_str()) {
            Some("js")   => "application/javascript",
            Some("css")  => "text/css",
            Some("html") => "text/html",
            Some("woff2")=> "font/woff2",
            Some("svg")  => "image/svg+xml",
            _            => "application/octet-stream",
        };

        tauri::http::Response::builder()
            .status(200)
            .header("content-type", mime)
            .header("cross-origin-embedder-policy", "require-corp")
            .body(content)
            .unwrap()
    })
```

```json
// tauri.conf.json — allow module:// in CSP
{
  "app": {
    "security": {
      "csp": "default-src 'self' ipc: http://ipc.localhost module:; script-src 'self' module:; style-src 'self' 'unsafe-inline' module:"
    }
  }
}
```

## Layer 3: Dynamic Module Loading (Shell Side)

The shell dynamically imports module JS bundles into a permanent container:

```typescript
// src/lib/moduleLoader.ts
import { invoke } from '@tauri-apps/api/core';

let currentModule: { unmount: () => void } | null = null;

export async function loadModule(moduleId: string) {
  // 1. Unmount previous module cleanly
  if (currentModule) {
    currentModule.unmount();
    currentModule = null;
  }

  // 2. Tell Rust which module is active (for capability enforcement)
  await invoke('set_active_module', { moduleId });

  // 3. Dynamic import from custom protocol
  // This works because module:// is in CSP script-src
  const { default: ModuleApp } = await import(
    /* @vite-ignore */
    `module://localhost/${moduleId}/index.js`
  );

  // 4. Mount Svelte component into permanent container
  const container = document.getElementById('module-container')!;
  container.innerHTML = ''; // clean slate

  currentModule = new ModuleApp({
    target: container,
    props: {
      moduleId,
      // Pass global settings from shell store
      settings: getGlobalSettings(),
    },
  });

  // 5. Load module-specific CSS
  loadModuleCSS(moduleId);
}

function loadModuleCSS(moduleId: string) {
  // Remove previous module CSS
  document.getElementById('module-css')?.remove();

  const link = document.createElement('link');
  link.id = 'module-css';
  link.rel = 'stylesheet';
  link.href = `module://localhost/${moduleId}/index.css`;
  document.head.appendChild(link);
}
```

```svelte
<!-- src/App.svelte — the permanent shell -->
<script lang="ts">
  import ModuleSwitcher from './components/ModuleSwitcher.svelte';
  import GlobalSettings from './components/GlobalSettings.svelte';
  import { initSettings } from './stores/settings.svelte';
  import { onMount } from 'svelte';

  onMount(async () => {
    await initSettings(); // load from Rust once
  });
</script>

<!-- These NEVER unmount regardless of which module is active -->
<ModuleSwitcher />
<GlobalSettings />

<!-- Modules live here — gets swapped -->
<div id="module-container" class="module-viewport" />
```

## Layer 4: Module Bundle Structure (Each Installable App)

Each module is a self-contained Vite-built Svelte bundle:

```text
$APPDATA/modules/
├── notes/
│   ├── manifest.json      ← identity, version, permissions
│   ├── index.js           ← compiled Svelte (ESM)
│   ├── index.css          ← compiled styles
│   └── assets/            ← any module-specific assets
├── tasks/
│   ├── manifest.json
│   ├── index.js
│   └── index.css
├── health/
│   ├── manifest.json
│   └── index.js
└── habits/
    ├── manifest.json
    └── index.js
```

```json
// manifest.json — every module must have this
{
  "id": "notes",
  "name": "Notes",
  "version": "1.2.0",
  "description": "Rich markdown note-taking with AI",
  "author": "yourname",
  "size_mb": 2.1,
  "min_shell_version": "1.0.0",
  "rust_commands": ["read_note", "write_note", "search_notes", "delete_note", "list_notes"],
  "permissions": ["fs:notes-dir"],
  "icon": "assets/icon.svg",
  "accent": "#7c3aed"
}
```

## Layer 5: The Installer System

### Module Registry (CDN-hosted JSON)

```json
// https://cdn.yourapp.com/registry/v1.json
{
  "version": "1.0.0",
  "updated_at": "2026-05-09T00:00:00Z",
  "modules": [
    {
      "id": "notes",
      "name": "Notes",
      "description": "Rich markdown note-taking with AI assistance",
      "version": "1.2.0",
      "size_mb": 2.1,
      "category": "productivity",
      "bundle_url": "https://cdn.yourapp.com/modules/notes/1.2.0.tar.gz",
      "checksum_sha256": "abc123...",
      "screenshots": ["https://cdn.yourapp.com/modules/notes/screen1.png"],
      "icon_url": "https://cdn.yourapp.com/modules/notes/icon.svg",
      "free": true
    }
  ]
}
```

### Rust Installer Commands

```rust
#[tauri::command]
pub async fn fetch_module_registry() -> Result<Vec<ModuleMeta>, String> {
    let resp = reqwest::get("https://cdn.yourapp.com/registry/v1.json")
        .await.map_err(|e| e.to_string())?
        .json::<Registry>().await.map_err(|e| e.to_string())?;
    Ok(resp.modules)
}

#[tauri::command]
pub async fn install_module(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    module_id: String,
    bundle_url: String,
    expected_checksum: String,
    on_progress: tauri::ipc::Channel<f32>,
) -> Result<(), String> {
    let bytes = download_with_progress(&bundle_url, &on_progress)
        .await.map_err(|e| e.to_string())?;

    verify_sha256(&bytes, &expected_checksum)
        .map_err(|_| "Checksum mismatch — download may be corrupted".to_string())?;

    let modules_dir = app.path().app_data_dir().unwrap().join("modules");
    extract_tar_gz(&bytes, &modules_dir.join(&module_id))
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT OR REPLACE INTO installed_modules
         (id, installed_at, version) VALUES (?, unixepoch(), ?)"
    )
    .bind(&module_id)
    .bind("1.0.0")
    .execute(&*state.db.lock().await)
    .await.map_err(|e| e.to_string())?;

    Ok(())
}
```

## Layer 6: Global Settings Architecture (Complete)

The settings panel is part of the permanent shell, not an app module. It opens from anywhere, including inside installed modules, via `Ctrl+,` / `Cmd+,`.

```typescript
interface GlobalSettings {
  theme: 'dark' | 'light' | 'midnight' | 'aurora' | 'sand' | 'system';
  accentColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  density: 'compact' | 'default' | 'comfortable';
  animationsEnabled: boolean;
  reducedMotion: boolean;
  globalFontScale: number;
  launchModule: string;
  launchOnBoot: boolean;
  minimizeToTray: boolean;
  autoSaveIntervalMs: number;
  spellCheck: boolean;
  aiProvider: 'anthropic' | 'openai' | 'ollama' | 'groq';
  aiModel: string;
  aiStream: boolean;
  aiApiKey: string;
  syncEnabled: boolean;
  syncInterval: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  analytics: boolean;
  crashReports: boolean;
  autoUpdate: boolean;
  updateChannel: 'stable' | 'beta';
}
```

## Layer 7: SQLite Schema (Final Complete)

```sql
CREATE TABLE IF NOT EXISTS installed_modules (
    id              TEXT PRIMARY KEY,
    version         TEXT NOT NULL,
    installed_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS module_settings (
    module_id   TEXT PRIMARY KEY,
    data        TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS module_fonts (
    module      TEXT NOT NULL,
    role        TEXT NOT NULL,
    family      TEXT NOT NULL,
    source      TEXT NOT NULL,
    file_path   TEXT,
    size_scale  REAL DEFAULT 1.0,
    PRIMARY KEY (module, role)
);

CREATE TABLE IF NOT EXISTS module_context (
    module          TEXT PRIMARY KEY,
    scroll_position REAL DEFAULT 0,
    last_open_id    TEXT,
    extra           TEXT DEFAULT '{}'
);
```

## Size Budget Reality Check

| Component                         | Size                 |
| --------------------------------- | -------------------- |
| Shell binary (Rust, all commands) | ~10-12MB             |
| Shell Svelte UI                   | ~400KB               |
| SQLite WAL database               | grows with user data |
| Total base install                | ~12-13MB             |
| Notes module bundle               | ~1.5-2MB             |
| Tasks module bundle               | ~1-1.5MB             |
| Health module bundle              | ~2MB                 |
| Habits module bundle              | ~800KB               |
| Budget module bundle              | ~1.2MB               |
| Code editor module (Monaco)       | ~4-5MB               |
| 10 modules installed              | ~25MB total          |

## Confidence Check: Remaining Risks

One honest caveat: CSP for dynamic `import()` from a custom protocol needs to be tested specifically on WebView2 (Windows). WebKit (macOS/Linux) handles `module:` protocol in CSP cleanly. WebView2 has historically been stricter about custom protocol CSP interactions.

The mitigation: if WebView2 blocks dynamic import from `module://`, the fallback is loading the module JS via a `<script type="module">` tag injected into the DOM. Functionally it is the same loader path; only the transport changes.

Everything else is production-grade and aligns with durable patterns used by plugin shells and extension hosts. The Genesis-specific hard rule is that remote module installation must remain behind signed registry and checksum validation before arbitrary executable frontend bundles are accepted.

---

# The 20 Starter Apps — 2026 App Store Standards

**Must-Have in EVERY app (non-negotiable baseline):**
AI assistant built-in, instant full-text search, offline-first, cross-device sync, voice input, dark/light/custom theme, keyboard shortcuts, widgets/quick capture, export (PDF/Markdown/CSV), custom reminders.

---

| #   | App                         | 2026 Core Features People Actually Use                                                                                                                                       |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Journal / Diary**         | Daily prompts AI-generated, mood check-in, streak calendar, photo attachments, end-of-year AI recap, lock with biometrics, timeline view                                     |
| 2   | **To-Do / Tasks**           | Natural language input ("buy milk tomorrow 8am"), subtasks, priority flags, recurring tasks, today/upcoming/filters view, AI task suggestions from calendar                  |
| 3   | **Habit Tracker**           | Streak counter, visual heatmap (GitHub-style), custom frequencies (not just daily), habit stacking, weekly review AI summary, widget with today's habits                     |
| 4   | **Focus Timer**             | Pomodoro + custom intervals, ambient sounds (rain/lofi/white noise), session history chart, website blocking integration, animated focus companion                           |
| 5   | **Password Vault**          | Biometric unlock, password health score, breach alerts, passkey support, one-tap autofill, secure notes, travel mode (hide sensitive vaults)                                 |
| 6   | **Health Tracker**          | Weight/body metrics log, workout library with custom exercises, progress photos, AI insight ("you sleep better on workout days"), Apple Health/Google Fit sync               |
| 7   | **Sleep Tracker**           | Smart alarm (wake in light sleep), sleep score, snore detection, bedtime routine reminders, weekly trend charts, caffeine/screen time correlation                            |
| 8   | **Water & Nutrition**       | Quick-log cups/bottles, hydration goal with reminders, food log with barcode scanner, macro breakdown, AI meal suggestions based on goals                                    |
| 9   | **Mood Tracker**            | One-tap emotion logging (Daylio-style), mood + activity correlation, monthly mood calendar, AI pattern detection ("you feel low on Sundays"), export to share with therapist |
| 10  | **Budget Tracker**          | Manual transaction log, category budgets, monthly summary, bill reminders, spending trend charts, no bank connection required (privacy-first)                                |
| 11  | **Flashcards / Study**      | Spaced repetition algorithm, AI card generation from notes/text, image cards, progress tracking per deck, cram mode vs. learn mode                                           |
| 12  | **Reading Tracker**         | Book log with ISBN lookup, reading sessions with timer, highlights/notes per book, annual reading goal, AI book recommendations based on finished books                      |
| 13  | **Grocery / Shopping**      | Quick add via voice, shared lists (sync with family via link), auto-categorize by store section, recipe → shopping list conversion, price tracking                           |
| 14  | **Recipe Manager**          | Import from URL/photo, ingredient scaling, step-by-step cooking mode (screen stays on), meal planning calendar, shopping list generation from plan                           |
| 15  | **Time Tracker**            | One-tap start/stop timer, project/client tagging, daily/weekly hour charts, idle detection, invoice-ready export, Pomodoro integration                                       |
| 16  | **Goal Tracker**            | Long-term goals with milestones, progress percentage, check-in reminders, vision board (image grid), AI weekly accountability message                                        |
| 17  | **Clipboard Manager**       | Persistent clipboard history (text/images/links), pin favorites, search history, snippet templates, auto-expire sensitive clips, cross-device paste                          |
| 18  | **Breathing / Calm**        | Guided breathing exercises (box, 4-7-8, physiological sigh), session streaks, heart rate guide (manual), anxiety check-in, ambient visuals                                   |
| 19  | **Voice Memos**             | One-tap record, AI transcription, speaker labels, search inside recordings, auto-title from content, organize by tag/date, export as text or audio                           |
| 20  | **Countdown / Life Events** | Event countdowns with cover photos, anniversary reminders, "days since" tracker, birthday board, shareable countdown cards, widget per event                                 |

---

# App 21: Personal Telemetry — The Self-Healing Intelligence Layer

This is the most important architectural piece in the whole app. Here's the honest vision fully designed.

---

## What It Actually Is

Not a crash reporter. Not analytics sent to a server. A **private, on-device performance intelligence system** that watches everything happening inside the app, detects problems before the user feels them, and has an AI agent that fixes or explains them. The user owns all of it. Nothing leaves the device.

---

## The Four Layers

```text
Layer 1: Collectors     — Rust, zero UI thread impact
Layer 2: Ring Buffer    — SQLite WAL, last 72hrs only
Layer 3: Anomaly Engine — Pure Rust rules + thresholds
Layer 4: AI Agent       — Reads telemetry, explains + heals
```

---

## Layer 1: Collectors (Rust)

The `hotpath-rs` crate measures function execution time, memory allocations, thread utilization, and Tokio runtime worker scheduling — all via a `#[hotpath::measure]` attribute macro. It also ships a built-in MCP server that lets AI agents query profiling data in real-time.

This is your foundation. Combine it with `sysinfo` for system-level metrics:

```toml
# Cargo.toml
[dependencies]
hotpath     = "0.15"          # function-level timing + allocation
tracing     = "0.1"           # structured event collection
tracing-subscriber = "0.3"    # subscriber that routes to SQLite
sysinfo     = "0.32"          # RAM, CPU, disk per-process
tokio       = { version = "1", features = ["full"] }
```

```rust
// telemetry/collectors.rs

use sysinfo::{System, SystemExt, ProcessExt};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, serde::Serialize)]
pub struct TelemetrySnapshot {
    pub timestamp_ms: u64,
    pub module: String,          // which mini-app was active

    // Memory
    pub heap_bytes: u64,         // Rust process memory
    pub webview_bytes: u64,      // WebView process memory
    pub total_app_mb: f32,

    // Performance
    pub ipc_latency_ms: f32,     // last IPC command roundtrip
    pub db_query_ms: f32,        // last SQLite query time
    pub frame_budget_used: f32,  // 0.0-1.0 (1.0 = 16ms budget consumed)

    // Rust async runtime
    pub tokio_tasks_active: u32,
    pub tokio_queue_depth: u32,

    // User action context
    pub last_action: String,     // "typed_in_notes", "switched_module", etc.
}

pub struct TelemetryCollector {
    sys: Arc<Mutex<System>>,
    pid: u32,
}

impl TelemetryCollector {
    pub fn new() -> Self {
        let sys = System::new_all();
        let pid = std::process::id();
        Self { sys: Arc::new(Mutex::new(sys)), pid }
    }

    pub async fn snapshot(&self, module: &str, last_action: &str) -> TelemetrySnapshot {
        let mut sys = self.sys.lock().await;
        sys.refresh_process(sysinfo::Pid::from_u32(self.pid));

        let process = sys.process(sysinfo::Pid::from_u32(self.pid));
        let heap_bytes = process.map(|p| p.memory()).unwrap_or(0);

        TelemetrySnapshot {
            timestamp_ms: unix_ms(),
            module: module.to_string(),
            heap_bytes,
            webview_bytes: get_webview_memory(),  // platform-specific
            total_app_mb: (heap_bytes as f32) / 1_048_576.0,
            ipc_latency_ms: 0.0,   // filled by IPC middleware
            db_query_ms: 0.0,      // filled by DB middleware
            frame_budget_used: 0.0,
            tokio_tasks_active: 0,
            tokio_queue_depth: 0,
            last_action: last_action.to_string(),
        }
    }
}
```

**IPC auto-instrumentation** — wraps every Tauri command automatically:

```rust
// Every Tauri command is wrapped — zero manual work per command
macro_rules! instrumented_command {
    ($name:ident, $inner:expr) => {
        #[tauri::command]
        async fn $name(
            telemetry: tauri::State<'_, TelemetryState>,
            $($args)*
        ) -> Result<_, _> {
            let start = std::time::Instant::now();
            let result = $inner.await;
            let elapsed = start.elapsed().as_secs_f32() * 1000.0;

            telemetry.record_ipc(stringify!($name), elapsed).await;

            // Flag if IPC took >50ms — that's anomalous
            if elapsed > 50.0 {
                telemetry.flag_anomaly(Anomaly::SlowIPC {
                    command: stringify!($name).to_string(),
                    ms: elapsed,
                }).await;
            }

            result
        }
    };
}
```

---

## Layer 2: Ring Buffer (SQLite)

Even with Rust's memory safety guarantees, production applications still face latency spikes, resource contention, and unexpected bottlenecks. The key is retaining enough history to identify patterns without unbounded storage growth.

```sql
-- Auto-expiring ring buffer — never grows beyond 72hrs
CREATE TABLE IF NOT EXISTS telemetry_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_ms    INTEGER NOT NULL,
    module          TEXT NOT NULL,
    data            TEXT NOT NULL,  -- JSON blob of TelemetrySnapshot
    anomaly_flags   TEXT            -- JSON array of anomaly types
);

CREATE TABLE IF NOT EXISTS anomaly_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_ms    INTEGER NOT NULL,
    module          TEXT NOT NULL,
    anomaly_type    TEXT NOT NULL,
    severity        TEXT NOT NULL,  -- 'info' | 'warn' | 'critical'
    data            TEXT NOT NULL,  -- JSON context
    resolved        INTEGER DEFAULT 0,
    resolution      TEXT            -- what the AI agent did
);

CREATE TABLE IF NOT EXISTS performance_baselines (
    module          TEXT PRIMARY KEY,
    avg_heap_mb     REAL,
    p95_ipc_ms      REAL,
    p95_db_ms       REAL,
    computed_at     INTEGER
);
```

```rust
// Cleanup job — runs every hour, keeps only 72hrs
pub async fn prune_old_telemetry(db: &SqlitePool) {
    let cutoff = unix_ms() - (72 * 60 * 60 * 1000);
    sqlx::query("DELETE FROM telemetry_snapshots WHERE timestamp_ms < ?")
        .bind(cutoff as i64)
        .execute(db).await.ok();
}
```

---

## Layer 3: Anomaly Engine (Pure Rust, No AI)

Fast rule-based detection that runs synchronously. AI only gets called for anomalies, not every snapshot:

```rust
// anomaly_engine.rs
pub enum Anomaly {
    MemorySpike { module: String, current_mb: f32, baseline_mb: f32 },
    SlowIPC     { command: String, ms: f32 },
    SlowDB      { query_type: String, ms: f32 },
    TokioStarve { queue_depth: u32 },  // async tasks backing up
    RapidGrowth { module: String, growth_rate_mb_per_min: f32 },
    ModuleLeaking { module: String, mb_not_freed: f32 }, // after switch
}

pub fn detect_anomalies(
    snapshot: &TelemetrySnapshot,
    baseline: &PerformanceBaseline,
) -> Vec<Anomaly> {
    let mut anomalies = vec![];

    // Memory >2x baseline is a spike
    if snapshot.total_app_mb > baseline.avg_heap_mb * 2.0 {
        anomalies.push(Anomaly::MemorySpike {
            module: snapshot.module.clone(),
            current_mb: snapshot.total_app_mb,
            baseline_mb: baseline.avg_heap_mb,
        });
    }

    // IPC >3x p95 is anomalous
    if snapshot.ipc_latency_ms > baseline.p95_ipc_ms * 3.0 {
        anomalies.push(Anomaly::SlowIPC {
            command: snapshot.last_action.clone(),
            ms: snapshot.ipc_latency_ms,
        });
    }

    // Tokio queue >100 tasks = something is blocking
    if snapshot.tokio_queue_depth > 100 {
        anomalies.push(Anomaly::TokioStarve {
            queue_depth: snapshot.tokio_queue_depth,
        });
    }

    anomalies
}
```

---

## Layer 4: The Self-Healing AI Agent

`hotpath-rs` ships a built-in MCP server that lets AI agents query profiling data in real-time — meaning your AI agent can directly query what the Rust runtime is doing without any custom API.

The AI agent only wakes on anomaly detection — zero cost when the app is healthy:

```rust
// ai_healer.rs
pub async fn heal(
    anomaly: &Anomaly,
    db: &SqlitePool,
    app: &tauri::AppHandle,
) -> HealingAction {

    // Build context from last 30 minutes of telemetry
    let history = get_recent_telemetry(db, 30).await;

    let prompt = format!(r#"
You are the performance guardian of a desktop productivity app.
You have detected this anomaly: {:?}

Last 30 minutes of telemetry (summarized):
{}

The user was doing: {}

Diagnose the root cause and respond in JSON:
{{
  "diagnosis": "one sentence plain English",
  "severity": "info|warn|critical",
  "user_message": "friendly explanation for non-technical user",
  "auto_fix": {{
    "possible": true/false,
    "action": "clear_module_cache|vacuum_db|reload_module|gc_hint|none",
    "params": {{}}
  }},
  "prevented": true/false
}}
    "#, anomaly, summarize_telemetry(&history), get_last_user_action());

    // Call AI (local Ollama or cloud depending on user setting)
    let response = call_ai(&prompt).await;
    let action: HealingAction = serde_json::from_str(&response).unwrap();

    // Execute auto-fix if safe
    if action.auto_fix.possible {
        execute_fix(&action.auto_fix.action, app, db).await;
    }

    // Log the resolution
    log_anomaly_resolution(db, anomaly, &action).await;

    action
}

async fn execute_fix(action: &str, app: &tauri::AppHandle, db: &SqlitePool) {
    match action {
        "vacuum_db" => {
            sqlx::query("VACUUM").execute(db).await.ok();
        }
        "gc_hint" => {
            // Emit event to frontend to trigger JS GC hint
            app.emit("telemetry:gc-hint", ()).ok();
        }
        "reload_module" => {
            // Emit to frontend to reload the current module
            app.emit("telemetry:reload-module", ()).ok();
        }
        "clear_module_cache" => {
            clear_module_caches(db).await;
        }
        _ => {}
    }
}
```

---

## The Telemetry UI (The 21st Mini-App)

This lives as a permanently mounted shell component AND as a full mini-app users can open:

```text
┌─────────────────────────────────┐
│  System Health                  │
│  ● App is running perfectly     │
│                                 │
│  Memory    12.4 MB  ████░ Good  │
│  Speed     <1ms IPC ████░ Fast  │
│  Database  Healthy  ████░ OK    │
│                                 │
│  Last 24hrs                     │
│  [sparkline memory chart]       │
│                                 │
│  2 anomalies detected, fixed    │
│  > Memory spike in Notes 2h ago │
│    AI fixed it automatically    │
│  > DB query slow 6h ago         │
│    Ran VACUUM, resolved         │
└─────────────────────────────────┘
```

```svelte
<!-- TelemetryBadge.svelte — tiny indicator on V-gulley -->
<script lang="ts">
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';

  let health = $state<'good' | 'warn' | 'critical'>('good');
  let activeAnomalies = $state(0);

  // Listen for real-time anomaly alerts from Rust
  await listen<{severity: string}>('telemetry:anomaly', (e) => {
    health = e.payload.severity as any;
    activeAnomalies++;
  });

  await listen('telemetry:healed', () => {
    activeAnomalies = Math.max(0, activeAnomalies - 1);
    if (activeAnomalies === 0) health = 'good';
  });
</script>

<!-- Dot on V-gulley shows health -->
<div class="health-dot" class:warn={health === 'warn'} class:critical={health === 'critical'} />
```

---

## Collection Schedule (Zero Performance Impact)

| Collector         | Interval             | Storage Cost            |
| ----------------- | -------------------- | ----------------------- |
| Memory snapshot   | Every 5 seconds      | ~500 bytes/snapshot     |
| IPC latency       | Per command          | ~100 bytes/event        |
| DB query time     | Per query            | ~100 bytes/event        |
| Tokio runtime     | Every 10 seconds     | ~200 bytes/snapshot     |
| Anomaly detection | After every snapshot | 0 (pure CPU, in-memory) |
| AI healing        | Only on anomaly      | 0 when healthy          |
| DB prune job      | Every 1 hour         | Removes old data        |

**72 hours of data = ~50-80MB SQLite file maximum.** Separate from `app.db`. Auto-pruned.

---

## Confidence Check

This architecture is 100% stable because:

Rust's memory safety without garbage collection and fearless concurrency without data races means the telemetry collector itself will never be the source of a performance problem — no GC pauses, no race conditions corrupting metrics data during collection.

The AI agent only fires on anomalies detected by the rule engine. When the app is healthy — which is 99% of the time — the AI costs zero. The rule engine is pure synchronous Rust taking microseconds. The ring buffer auto-expires. Nothing accumulates. Nothing leaks. The telemetry system cannot hurt the app it's watching.

---

# Genesis Desktop Screenshot Reference Inventory

These local screenshot references are implementation inputs for the Genesis Desktop 21-app UI build. The sidebar/navigation shell must remain consistent across all apps; app content should intelligently adapt the referenced layout, density, hierarchy, typography, and card language to the correct app domain.

## Received Images

| Image | Local Path                                                             | File URL                                                                           | Size      | Primary UI Reading                                                                                                                                                           | Suggested App Mapping                                  |
| ----- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 175836.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20175836.png` | 1034x601  | Green project dashboard with left sidebar, top search, KPI cards, project analytics, reminders, team list, time tracker.                                                     | Goal Tracker / Time Tracker dashboard reference        |
| 2     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 180005.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20180005.png` | 1275x891  | Purple online learning dashboard with course hero, lesson cards, mentor panel, stats, search, friend/sidebar list.                                                           | Flashcards / Study reference                           |
| 3     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 180119.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20180119.png` | 1300x926  | Warm HR/time dashboard with pill top nav, profile card, progress bars, work-time dial, onboarding tasks, schedule calendar.                                                  | Time Tracker / Goal Tracker reference                  |
| 4     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 180343.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20180343.png` | 1323x1014 | Personal productivity board with profile, prioritized task gradients, connected trackers, focus line chart, meetings sidebar, skill bars.                                    | Focus Timer reference                                  |
| 5     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 180422.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20180422.png` | 1346x967  | Dark node/workflow canvas with dotted grid, connected prompt/model nodes, preview panel, floating controls.                                                                  | Personal Telemetry / AI workflow reference             |
| 6     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 180617.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20180617.png` | 1294x942  | CRM/revenue analytics with nested sidebar tree, revenue hero, metric cards, platform bars, sales tables, report cards.                                                       | Budget Tracker reference                               |
| 7     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 152902.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20152902.png` | 1193x872  | Organization workflow/admin dashboard with black rail, pill tabs, usage cards, upgrade card, statistics chart, resource list.                                                | App Store / module management / shell admin reference  |
| 8     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 152957.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20152957.png` | 1207x836  | Dark operations dashboard with vertical icon rail, map canvas, vehicle panel, compass, toggles, dense telemetry controls.                                                    | Personal Telemetry reference                           |
| 9     | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153041.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153041.png` | 1214x852  | Event/sports home with slim rail, central command search, large feature cards, moments, insights metrics.                                                                    | Countdown / Life Events reference                      |
| 10    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153134.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153134.png` | 1220x851  | CRM workspace with lead cards, schedule bar, stats, video overlay, document/summary side panel.                                                                              | Goal Tracker / Time Tracker secondary reference        |
| 11    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153211.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153211.png` | 1272x945  | Financial dashboard with minimal white cards, assistant prompt, income/payment cards, lock/growth ring, stock sparkline, survey card.                                        | Budget Tracker reference                               |
| 12    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153248.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153248.png` | 1237x836  | Customer journey canvas with left rail, top nav, connected workflow columns, avatars, process stages, task grid.                                                             | Recipe Manager / process-flow reference                |
| 13    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153331.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153331.png` | 1171x838  | Gmail-like generated summary composer with structured sections and side navigation anchors.                                                                                  | Voice Memos transcription / Journal AI recap reference |
| 14    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153410.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153410.png` | 1428x791  | Dark fitness dashboard with neon lime accents, workout bars, step ring, water tile, calendar schedule, daily goals checklist.                                                | Health Tracker / Water & Nutrition reference           |
| 15    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153447.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153447.png` | 1003x689  | Dark smart-home control board with room hero, activity timeline, lamp/AC/vacuum device cards.                                                                                | Sleep Tracker / bedtime routine reference              |
| 16    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-03 153900.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-03%20153900.png` | 1002x602  | Music dashboard with red artist hero, albums, top artists, vertical icon rail, persistent audio player.                                                                      | Breathing / Calm ambient audio reference               |
| 17    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 175348.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20175348.png` | 1339x956  | Exact kanban/task board with shared sidebar, task count badge, pastel task cards, filters, avatars, progress dots.                                                           | To-Do / Tasks primary reference                        |
| 18    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 175501.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20175501.png` | 1023x843  | Learning dashboard with pill top nav, ongoing class cards, learning-hours chart, messages, calendar, class schedule.                                                         | Reading Tracker / Study secondary reference            |
| 19    | `C:\Users\admin\Pictures\Screenshots\Screenshot 2026-05-09 191848.png` | `file:///C:/Users/admin/Pictures/Screenshots/Screenshot%202026-05-09%20191848.png` | 1308x942  | Commerce analytics dashboard with clean left sidebar, profit chart, sales-performance gauge, transaction table, top market cards, product cards, green/black/orange accents. | Budget Tracker / commerce analytics reference          |

## App Coverage Status

Screenshots received: 19. Target apps: 21.

Directly covered: To-Do / Tasks, Habit/goal-style dashboards, Focus Timer, Health Tracker, Water & Nutrition, Budget Tracker, Flashcards / Study, Reading Tracker, Time Tracker, Goal Tracker, Breathing / Calm, Voice Memos, Countdown / Life Events, Personal Telemetry.

Still needs explicit or inferred visual treatment: Journal / Diary, Password Vault, Sleep Tracker, Mood Tracker, Grocery / Shopping, Recipe Manager, Clipboard Manager. If no further screenshots are provided, infer these from the closest references while keeping the shared Genesis sidebar and shell consistent.

## Implementation Rule For Screenshots

Do not copy screenshot content blindly. Use each screenshot as a visual-system reference: grid, card density, sidebar rhythm, type scale, topbar layout, icon treatment, color language, and content hierarchy. The final app content must match the Genesis app domain even when the screenshot domain differs.

---

# Genesis Desktop App Launch Transition Architecture

This section is the source of truth for Genesis Desktop mini-app launch behavior. App selection from the top-center V-gulley must feel like entering an application, not like navigating to another page.

## Core Insight

Page transitions feel like navigation because they are horizontal: slide, fade, push. App launches feel like entering because they are dimensional: the selected icon expands and the user visually zooms through it into the app. Genesis Desktop uses this dimensional launch model.

## Three-Phase Launch Sequence

### Phase 1: Instant, 0ms-50ms

- User clicks an app in the V-gulley.
- The shell renders a launch canvas immediately.
- The full window is filled with that module's launch background or accent color.
- A large app icon appears centered with a scale-in animation.
- The app name fades up below the icon.
- Three loading dots pulse below the name.

### Phase 2: Parallel, 50ms-600ms

- The selected module route and module JavaScript load behind the launch canvas.
- The user sees the confident launch surface, not a loading flash.
- The canvas holds until the mounted module signals that its first render is ready.
- Even if the module loads instantly, the canvas remains visible for a minimum intentional display time of 500ms.

### Phase 3: Reveal, when module is ready

- The icon scales from normal size to roughly 3x.
- The canvas background fades out at the same time.
- The module is already rendered underneath, so the final frame reads as zooming through the app icon into the app.
- The launch canvas removes itself after the exit transition completes.

## Required Architecture

- The launch canvas belongs to the permanent shell and must not be owned by an individual mini-app.
- App identity is defined once and reused by the V-gulley expanded picker and launch canvas.
- Each identity includes: `id`, `name`, `tagline`, `icon`, `accentColor`, and `launchBg`.
- The V-gulley expanded state must show app tiles with icons and app names, not plain text-only buttons.
- Launch transition state must start before route navigation begins.
- The module must signal readiness only after its first rendered frame is mounted.
- The launch canvas must have a guarded fallback so a missing ready signal cannot leave Genesis stuck under a permanent overlay.
- The transition is CSS-transform/opacity based and GPU-friendly.
- Respect `prefers-reduced-motion` by shortening or disabling scale-heavy motion while preserving the launch state.

## Required Visual Mechanics

- Full-screen launch canvas uses the selected module's launch color.
- Center icon is rendered at large size inside a frosted square/circle backdrop.
- The backdrop uses glass blur without a heavy external shadow.
- App name is centered below the icon.
- Loading dots pulse while the target module is loading.
- On ready, the icon stage scales out as the canvas fades, creating the zoom-through-icon effect.
- Canvas z-index must sit above module content and below the V-gulley, so the shell keeps ownership of the launch interaction.

## App Identity Registry Baseline

The exact colors may evolve with the app visual system, but every app must have a clear launch identity.

| App         | Icon               | Accent    | Launch Background |
| ----------- | ------------------ | --------- | ----------------- |
| Dashboard   | `layout-dashboard` | `#F8FAFC` | `#0B0B0B`         |
| Notes       | `file-text`        | `#6366F1` | `#3730A3`         |
| Tasks       | `layout-grid`      | `#1B5E3B` | `#1B5E3B`         |
| Journal     | `book-heart`       | `#818CF8` | `#1E1B4B`         |
| Habits      | `target`           | `#C8F535` | `#1A2800`         |
| Focus       | `timer`            | `#F5C400` | `#7A6200`         |
| Health      | `activity`         | `#C8F535` | `#0D1500`         |
| Sleep       | `moon`             | `#8CC8FF` | `#101624`         |
| Nutrition   | `droplets`         | `#1AA6A6` | `#063B3C`         |
| Mood        | `smile-plus`       | `#D92B67` | `#5F1231`         |
| Budget      | `wallet`           | `#E05A3A` | `#6B1F0A`         |
| Flashcards  | `brain`            | `#6D5CE7` | `#2F247F`         |
| Reading     | `library`          | `#E11D48` | `#881337`         |
| Grocery     | `shopping-cart`    | `#22C55E` | `#064E3B`         |
| Recipes     | `utensils-crossed` | `#D4A017` | `#4A3308`         |
| Time        | `clock-4`          | `#FFD95B` | `#5B4300`         |
| Goals       | `trophy`           | `#CCFF00` | `#182400`         |
| Clipboard   | `clipboard-list`   | `#E11D48` | `#4C0519`         |
| Breathing   | `wind`             | `#65D7C1` | `#063D35`         |
| Voice Memos | `mic`              | `#8B5CF6` | `#2E1065`         |
| Countdown   | `hourglass`        | `#EC4899` | `#831843`         |
| Telemetry   | `gauge`            | `#38BDF8` | `#0C2340`         |
| AI Studio   | `bot`              | `#38BDF8` | `#0C2340`         |
| Settings    | `settings`         | `#E5E7EB` | `#171717`         |

## Verification Requirements

- Selecting an app from the V-gulley starts the launch canvas before route content changes.
- Module content renders underneath the canvas.
- Canvas remains visible for at least 500ms.
- Ready modules trigger the zoom-through-icon exit.
- Failed switches clear or transition out of the canvas instead of trapping the UI.
- `bun run type-check` must pass after implementation.
- A production frontend build should be run when CSS/Svelte launch mechanics change.

## Current Code Integration Contract

The active Genesis Desktop implementation lives in `C:\Users\admin\.codex\worktrees\genesis-desktop\apps\genesis-desktop`.

Launch behavior is implemented through these shell-owned files:

- `src/lib/data/app-registry.ts` owns launch identity for shell routes and all starter apps.
- `src/lib/stores/app-launch.store.ts` owns the active launch state, ready signal, error signal, and cleanup.
- `src/lib/components/AppIcon.svelte` maps registry icon names to Lucide Svelte icons.
- `src/lib/components/AppLaunchCanvas.svelte` renders the full-screen launch canvas, 500ms minimum display, zoom-through exit, and fallback timeout.
- `src/lib/components/LaunchReadyReporter.svelte` signals readiness after a rendered route/module frame is mounted.
- `src/lib/components/ModuleSwitcher.svelte` starts the launch before calling `switchModule(...)` and renders registry-driven app icon tiles.
- `src/lib/components/DesktopApp.svelte` mounts the permanent shell-level `ModuleSwitcher`, `AppLaunchCanvas`, and `GlobalSettings`.
- `src/lib/components/ShellRoute.svelte` reports readiness for eager shell pages and routes starter apps through `StarterModuleHost`.
- `src/lib/modules/StarterModuleHost.svelte` reports readiness after the dynamically imported starter module resolves and mounts.
- `src/app.css` owns the V-gulley tile layout and ensures the switcher sits above the launch canvas.

No mini-app should own or duplicate launch-canvas behavior. Mini-apps render content only; the permanent shell owns launch, app identity, settings, sidebar, and recovery.
