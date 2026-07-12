use std::{
    env,
    path::PathBuf,
    sync::atomic::{AtomicU8, Ordering},
    sync::Arc,
};

use crate::spawn_timeout;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{DateTime, Utc};
use keyring::Entry;
use once_cell::sync::Lazy;
use rand::{thread_rng, RngCore};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_oauth::{start_with_config, OauthConfig};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    sync::Mutex,
    time::{sleep, timeout, Duration},
};
use url::Url;

// ── Compile-time build floor (clock rollback protection) ──
// Embedded at compile time so rolling the system clock back before
// this date cannot extend a subscription. Any subscription_end_date
// resolved to a time before BUILD_TIMESTAMP is treated as expired.
const BUILD_TIMESTAMP: &str = "2026-07-08T00:00:00Z";

static BUILD_TIME_FLOOR: Lazy<DateTime<Utc>> = Lazy::new(|| {
    BUILD_TIMESTAMP
        .parse::<DateTime<Utc>>()
        .unwrap_or_else(|_| Utc::now())
});

// ── Gating rate limiter ──────────────────────────────────
// Tracks rapid consecutive denials per module — prevents brute-force
// probing of the gating system (e.g. spamming switch_module to find
// a race window). Resets after 30s of no denials.
struct GateDenialCounter {
    count: AtomicU8,
}

impl GateDenialCounter {
    fn new() -> Self {
        Self {
            count: AtomicU8::new(0),
        }
    }

    fn hit(&self) -> u8 {
        let prev = self.count.fetch_add(1, Ordering::AcqRel);
        prev + 1
    }

    fn reset(&self) {
        self.count.store(0, Ordering::Release);
    }

    fn is_throttled(&self) -> bool {
        self.count.load(Ordering::Acquire) >= 10
    }
}

// ── Gating audit log ─────────────────────────────────────
// Suspicious activity events are emitted to the frontend and
// written to stderr for LogRocket capture. Module-gate bypass
// attempts, invalid receipt tampering, and expired subscription
// accesses are all logged with a consistent prefix.
const GATE_LOG_PREFIX: &str = "[gate]";

pub(crate) fn emit_gate_event(module_id: &str, action: &str, detail: &str) {
    eprintln!("{GATE_LOG_PREFIX} module={module_id} action={action} detail={detail}");
}

pub(crate) fn emit_suspicious_event(action: &str, detail: &str) {
    eprintln!("{GATE_LOG_PREFIX} SUSPICIOUS action={action} detail={detail}");
}

/// Open a URL using the platform's default mechanism via `tauri-plugin-opener`.
///
/// Uses `app.opener().open_url()` (the recommended Tauri v2 plugin-integrated path)
/// instead of the standalone `tauri_plugin_opener::open_url()` wrapped in spawn_blocking.
///
/// On Windows, `ShellExecuteW` can transiently fail with ERROR_CANCELLED (os error 1223)
/// during rapid state changes. We retry up to 2 times with a 100ms delay to work around this.
///
/// The entire retry loop runs inside `spawn_timeout!` (spawn_blocking + 15s timeout)
/// so neither the tokio async worker nor the main IPC thread is ever blocked.
async fn open_url_in_browser(app: &AppHandle, url: &str) -> Result<(), String> {
    let url = url.to_owned();
    let app = app.clone();
    eprintln!("[opener] open_url_in_browser: {url}");

    spawn_timeout!(15, {
        let max_attempts = 3;
        let mut last_err = String::new();

        for attempt in 1..=max_attempts {
            match app.opener().open_url(&url, None::<&str>) {
                Ok(()) => {
                    if attempt > 1 {
                        eprintln!("[opener] open_url succeeded on attempt {attempt}");
                    }
                    return Ok(());
                }
                Err(e) => {
                    let err_str: String = e.to_string();
                    eprintln!("[opener] attempt {attempt}/{max_attempts} failed: {err_str}");
                    last_err = err_str;
                }
            }

            if attempt < max_attempts {
                // Short blocking sleep (fine inside spawn_blocking)
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }

        Err(format!(
            "Failed to open browser after {max_attempts} attempts: {last_err}"
        ))
    })
}

// window_bounds::transition_to_shell is imported locally in prepare_shell_window

const AUTH_KEYRING_SERVICE: &str = "Bento Desktop";
const AUTH_KEYRING_ACCOUNT: &str = "supabase-session";
const AUTH_SESSION_FILENAME: &str = "session.json";
const SUPABASE_REDIRECT_STATE_TTL_MS: i64 = 2 * 60 * 1000;
const SUPABASE_REFRESH_CHECK_INTERVAL_MS: u64 = 5 * 60 * 1000;
const SUPABASE_REFRESH_WINDOW_MS: i64 = 10 * 60 * 1000;
const SUPABASE_OAUTH_PORT: u16 = 47832;

// ── Connectivity monitor ──────────────────────────────────
// Lightweight endpoints that return a minimal response (204 No Content or tiny body).
// Used by the connectivity monitor to detect when network is restored.
// Multiple fallback URLs ensure resilience across different network environments.
const CONNECTIVITY_CHECK_URLS: &[&str] = &[
    "https://clients3.google.com/generate_204",
    "http://connectivitycheck.gstatic.com/generate_204",
    "https://captive.apple.com/hotspot-detect.html",
];

/// Minimum interval between connectivity pings (fast detection when actively waiting).
const CONNECTIVITY_MIN_INTERVAL_S: u64 = 5;
/// Maximum interval — applied after sustained offline (battery/CPU friendly).
const CONNECTIVITY_MAX_INTERVAL_S: u64 = 120;
/// Number of consecutive offline pings before backing off to max interval.
const CONNECTIVITY_BACKOFF_THRESHOLD: u64 = 6;

const LOGIN_WINDOW_WIDTH: f64 = 400.0;
const LOGIN_WINDOW_HEIGHT: f64 = 480.0;
// Public desktop auth config. These values are safe to ship in the client.
const BUNDLED_SUPABASE_URL: &str = "https://qjjocfnqwtccuxbnoult.supabase.co";
const BUNDLED_SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqam9jZm5xd3RjY3V4Ym5vdWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzY3MzUsImV4cCI6MjA3OTI1MjczNX0.oPqt-rffxO2gtX7xv4RisONqIdSSJ98hl7QNDjM_Y4c";

// ── Keyring accounts ───────────────────────────────────────────
const AUTH_KEYRING_SERVICE_ROLE_ACCOUNT: &str = "supabase-service-role";

// ── Billing cache & refresh (Anytype patterns) ────────────────
const BILLING_CACHE_TTL: Duration = Duration::from_secs(120); // 2m (was 10m — reduced for tighter downgrade window)
const BILLING_NORMAL_INTERVAL: Duration = Duration::from_secs(60); // 60s
const BILLING_FORCE_INTERVAL: Duration = Duration::from_secs(10); // 10s
const BILLING_FORCE_WINDOW: Duration = Duration::from_secs(1800); // 30min

// ── Cache version pinning (Anytype cache.go 1:1) ────────────
// Anytype uses a format-version constant. When the cache data structure
// changes, bump this constant and all old cached data auto-invalidates.
// See: anytype-heart/core/payments/cache/cache.go → cacheLastVersion = 8
const BILLING_CACHE_LAST_VERSION: u64 = 1;

/// Filename for disk-persisted billing cache (Anytype: SQLite KV entry → we use JSON file).
/// Survives app restarts so the last known subscription status is available offline.
const BILLING_CACHE_FILENAME: &str = "billing-cache.json";

// ── Module gate cache (disk-persisted gating decisions) ──────
/// Filename for disk-persisted module gate cache.
/// Caches the allowed/denied decision per module, tied to the billing
/// profile's cache_version. On cold boot offline, decisions are immediately
/// available without parsing the billing profile.
const MODULE_GATE_CACHE_FILENAME: &str = "module-gate-cache.json";

const MODULE_GATE_CACHE_LAST_VERSION: u64 = 1;

/// Disk-persisted billing profile cache with TTL + format version pinning.
/// Anytype cache.go pattern: every cached entry has a CurrentVersion field.
/// On CacheGet(): if stored.CurrentVersion != cacheLastVersion → ErrUnsupportedCacheVersion.
///
/// **Disk persistence:** On set(), writes to a JSON file in the app data directory.
/// On new(), loads from that file. This matches Anytype's SQLite-backed storage
/// (anystoreprovider.SystemCollection) — cache data survives restarts and is available offline.
struct BillingCache {
    data: Option<BillingProfilePayload>,
    cached_at: Option<Instant>,
    /// Format version (Anytype: CurrentVersion uint16). Initialized to BILLING_CACHE_LAST_VERSION
    /// in the constructor (like newStorageStruct() sets CurrentVersion: cacheLastVersion).
    /// If this mismatches the constant, get() returns None.
    format_version: u64,
    /// Path to the JSON file on disk (Anytype: KV collection reference).
    /// None = no disk persistence (e.g. before data_dir is configured).
    cache_path: Option<PathBuf>,
}

impl BillingCache {
    /// newStorageStruct() in Anytype: sets CurrentVersion = cacheLastVersion,
    /// then tries to load existing data from disk.
    fn new(cache_path: Option<PathBuf>) -> Self {
        let mut cache = Self {
            data: None,
            cached_at: None,
            format_version: BILLING_CACHE_LAST_VERSION,
            cache_path,
        };
        // Try to load from disk on construction (Anytype: CacheGet on init)
        cache.load_from_disk();
        cache
    }

    /// CacheGet() in Anytype: checks CurrentVersion == cacheLastVersion.
    /// If mismatch → returns ErrUnsupportedCacheVersion (we return None).
    fn get(&self) -> Option<&BillingProfilePayload> {
        // Version pin check (Anytype cache.go:58-65)
        if self.format_version != BILLING_CACHE_LAST_VERSION {
            return None;
        }
        let cached_at = self.cached_at?;
        // TTL check (Anytype: getExpireTime)
        if cached_at.elapsed() > BILLING_CACHE_TTL {
            return None;
        }
        self.data.as_ref()
    }

    /// Return cached data even if TTL-expired — used as an offline fallback
    /// when the network fetch fails. This is the Anytype "stale cache" pattern:
    /// trust the last known good state rather than locking the user out.
    fn get_stale(&self) -> Option<&BillingProfilePayload> {
        if self.format_version != BILLING_CACHE_LAST_VERSION {
            return None;
        }
        self.data.as_ref()
    }

    /// CacheSet() in Anytype: updates data, restores format version so future get() succeeds.
    /// Anytype: CacheSet preserves CurrentVersion (stays at cacheLastVersion).
    /// After invalidate(), this restores the version so the cache is usable again.
    /// Also persists to disk (Anytype: KV set in SystemCollection).
    fn set(&mut self, profile: BillingProfilePayload) {
        // Restore format version so get() works again after invalidate()
        self.format_version = BILLING_CACHE_LAST_VERSION;
        self.data = Some(profile);
        self.cached_at = Some(Instant::now());
        self.save_to_disk();
    }

    /// Load cached billing profile from disk if it exists.
    /// Anytype pattern: CacheGet on service init loads from SystemCollection.
    fn load_from_disk(&mut self) {
        let path = match &self.cache_path {
            Some(p) => p.clone(),
            None => return,
        };
        if !path.exists() {
            return;
        }
        match std::fs::read_to_string(&path) {
            Ok(raw) => {
                match serde_json::from_str::<BillingProfilePayload>(&raw) {
                    Ok(profile) => {
                        // Version guard: reject old-format cache files (Anytype pattern:
                        // cacheLastVersion mismatch → ErrUnsupportedCacheVersion → rebuild)
                        if profile.cache_version != BILLING_CACHE_LAST_VERSION {
                            eprintln!("[cache] disk cache version mismatch (stored={}, expected={}), removing",
                                profile.cache_version, BILLING_CACHE_LAST_VERSION);
                            let _ = std::fs::remove_file(&path);
                            return;
                        }
                        eprintln!("[cache] loaded billing profile from disk");
                        self.data = Some(profile);
                        self.format_version = BILLING_CACHE_LAST_VERSION;
                        // cached_at = None means the TTL will force a background refresh,
                        // but stale data is available via get_stale() for offline use.
                    }
                    Err(err) => {
                        eprintln!("[cache] disk cache corrupt, removing: {err}");
                        let _ = std::fs::remove_file(&path);
                    }
                }
            }
            Err(err) => {
                eprintln!("[cache] failed to read disk cache: {err}");
            }
        }
    }

    /// Persist the current billing profile to disk.
    /// Anytype pattern: CacheSet also persists to SystemCollection.
    fn save_to_disk(&self) {
        let path = match &self.cache_path {
            Some(p) => p.clone(),
            None => return,
        };
        let Some(ref profile) = self.data else { return };

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                if let Err(err) = std::fs::create_dir_all(parent) {
                    eprintln!("[cache] failed to create cache dir: {err}");
                    return;
                }
            }
        }

        match serde_json::to_string(profile) {
            Ok(raw) => {
                // Atomic write: write to temp file first, then rename
                let tmp_path = path.with_extension("json.tmp");
                match std::fs::write(&tmp_path, &raw) {
                    Ok(()) => {
                        if let Err(err) = std::fs::rename(&tmp_path, &path) {
                            eprintln!("[cache] failed to rename temp cache: {err}");
                            let _ = std::fs::write(&path, &raw); // fallback to direct write
                        }
                    }
                    Err(err) => {
                        eprintln!("[cache] failed to write cache: {err}");
                    }
                }
            }
            Err(err) => {
                eprintln!("[cache] failed to serialize cache: {err}");
            }
        }
    }

    /// Delete the disk cache file. Called on invalidate() or when clearing state.
    fn delete_disk_cache(&self) {
        if let Some(path) = &self.cache_path {
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
            // Also clean up any stale temp file
            let tmp_path = path.with_extension("json.tmp");
            if tmp_path.exists() {
                let _ = std::fs::remove_file(tmp_path);
            }
        }
    }

    /// Invalidate cache by setting version to a non-matching value.
    /// Anytype equivalent: CacheClear() creates newStorageStruct() with CurrentVersion = cacheLastVersion
    /// but we want more aggressive invalidation: future get() returns None until set() is called.
    /// BUG FIX: BillingCache::invalidate() used to set format_version = 0 without restoring it in set().
    /// Now set() always restores format_version to BILLING_CACHE_LAST_VERSION, so invalidate-then-set
    /// produces a valid cache entry.
    /// Also deletes the disk cache file (Anytype: CacheClear() wipes the KV entry).
    fn invalidate(&mut self) {
        self.delete_disk_cache();
        self.data = None;
        self.cached_at = None;
        self.format_version = 0;
    }
}

// ── Module gate cache ────────────────────────────────────────
/// A cached gating decision for a single module.
/// Tied to the billing profile's cache_version so the entry
/// auto-invalidates when the subscription data changes.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModuleGateEntry {
    #[serde(default)]
    module_id: String,
    allowed: bool,
    /// The user's tier rank (0=Free, 1=Core, 2=Pro, 3=Power) at decision time.
    user_tier_rank: u8,
    /// The billing profile cache_version at decision time.
    /// When the billing profile is updated (new cache_version),
    /// this entry is stale and must be re-evaluated.
    profile_cache_version: u64,
    #[serde(default)]
    cached_at_epoch_ms: i64,
}

/// Disk-persisted cache of module gating decisions.
/// Same pattern as BillingCache: JSON file in app data dir,
/// atomic writes, format version pinning.
///
/// Purpose: On cold boot offline, the billing profile is loaded from
/// disk, but we still need to compute the tier from it. The module gate
/// cache shortcuts this: decisions are immediately available, and they
/// auto-invalidate when the billing profile changes (via profile_cache_version).
struct ModuleGateCache {
    entries: std::collections::HashMap<String, ModuleGateEntry>,
    cache_path: Option<PathBuf>,
    format_version: u64,
}

impl ModuleGateCache {
    fn new(cache_path: Option<PathBuf>) -> Self {
        let mut cache = Self {
            entries: std::collections::HashMap::new(),
            cache_path,
            format_version: MODULE_GATE_CACHE_LAST_VERSION,
        };
        cache.load_from_disk();
        cache
    }

    /// Return the cached gating decision if the entry is still valid
    /// (same profile_cache_version as the current billing cache).
    fn get(&self, module_id: &str, profile_cache_version: u64) -> Option<&ModuleGateEntry> {
        if self.format_version != MODULE_GATE_CACHE_LAST_VERSION {
            return None;
        }
        let entry = self.entries.get(module_id)?;
        // Auto-invalidate on billing profile change
        if entry.profile_cache_version != profile_cache_version {
            return None;
        }
        Some(entry)
    }

    /// Cache a gating decision and persist to disk.
    fn set(&mut self, entry: ModuleGateEntry) {
        self.format_version = MODULE_GATE_CACHE_LAST_VERSION;
        self.entries.insert(entry.module_id.clone(), entry);
        self.save_to_disk();
    }

    /// Clear all entries and delete disk cache.
    fn invalidate(&mut self) {
        self.entries.clear();
        self.delete_disk_cache();
        self.format_version = 0;
    }

    fn load_from_disk(&mut self) {
        let path = match &self.cache_path {
            Some(p) => p.clone(),
            None => return,
        };
        if !path.exists() {
            return;
        }
        match std::fs::read_to_string(&path) {
            Ok(raw) => {
                match serde_json::from_str::<std::collections::HashMap<String, ModuleGateEntry>>(
                    &raw,
                ) {
                    Ok(entries) => {
                        eprintln!("[gate_cache] loaded {} decisions from disk", entries.len());
                        self.entries = entries;
                        self.format_version = MODULE_GATE_CACHE_LAST_VERSION;
                    }
                    Err(err) => {
                        eprintln!("[gate_cache] disk cache corrupt, removing: {err}");
                        let _ = std::fs::remove_file(&path);
                    }
                }
            }
            Err(err) => {
                eprintln!("[gate_cache] failed to read disk cache: {err}");
            }
        }
    }

    fn save_to_disk(&self) {
        let path = match &self.cache_path {
            Some(p) => p.clone(),
            None => return,
        };
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                if let Err(err) = std::fs::create_dir_all(parent) {
                    eprintln!("[gate_cache] failed to create cache dir: {err}");
                    return;
                }
            }
        }
        match serde_json::to_string(&self.entries) {
            Ok(raw) => {
                let tmp_path = path.with_extension("json.tmp");
                match std::fs::write(&tmp_path, &raw) {
                    Ok(()) => {
                        if let Err(err) = std::fs::rename(&tmp_path, &path) {
                            eprintln!("[gate_cache] failed to rename temp cache: {err}");
                            let _ = std::fs::write(&path, &raw);
                        }
                    }
                    Err(err) => {
                        eprintln!("[gate_cache] failed to write cache: {err}");
                    }
                }
            }
            Err(err) => {
                eprintln!("[gate_cache] failed to serialize cache: {err}");
            }
        }
    }

    fn delete_disk_cache(&self) {
        if let Some(path) = &self.cache_path {
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
            let tmp_path = path.with_extension("json.tmp");
            if tmp_path.exists() {
                let _ = std::fs::remove_file(tmp_path);
            }
        }
    }
}

struct BillingRefreshController {
    force_tx: tokio::sync::mpsc::UnboundedSender<std::time::Duration>,
}

impl BillingRefreshController {
    /// Spawn the refresh loop. The `fetch` callback is called on each tick.
    /// Anytype refresh.go 1:1 pattern.
    /// Returns `(changed: bool, err: Option<String>)`.
    /// - `changed = true` → exits force mode (data updated)
    /// - `err = Some(...)` → logged, force mode continues (anytype: log.Warn + continue)
    fn spawn<F, Fut>(app: AppHandle, manager: AuthManager, fetch: F) -> Self
    where
        F: Fn(AppHandle, AuthManager) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = (bool, Option<String>)> + Send,
    {
        let (force_tx, mut force_rx) = tokio::sync::mpsc::unbounded_channel::<Duration>();

        tokio::spawn(async move {
            let mut force_active = false;
            let mut force_deadline = Instant::now();
            let mut first = true;

            loop {
                // Determine next interval (Anytype: resetTimer)
                let interval = if first {
                    first = false;
                    Duration::ZERO
                } else if force_active {
                    BILLING_FORCE_INTERVAL
                } else {
                    BILLING_NORMAL_INTERVAL
                };

                // Anytype: timer.Reset(interval) in the loop
                tokio::select! {
                    force_duration = force_rx.recv() => {
                        // Anytype: Force(duration) → extend deadline
                        let now = Instant::now();
                        let extend = force_duration.unwrap_or(BILLING_FORCE_WINDOW);
                        if !force_active {
                            force_active = true;
                            force_deadline = now + extend;
                        } else {
                            let new_deadline = now + extend;
                            if new_deadline > force_deadline {
                                force_deadline = new_deadline;
                            }
                        }
                        // Fall through to fetch immediately (anytype: resetTimer(timer, 0))
                    }
                    _ = tokio::time::sleep(interval) => {}
                }

                // Execute fetch (Anytype: rc.fetch(rc.ctx, forceActive))
                let (changed, fetch_err) = fetch(app.clone(), manager.clone()).await;

                // Anytype pattern: log.Warn on error, force mode continues
                if let Some(err) = fetch_err {
                    eprintln!("[BillingRefresh] fetch failed (force={force_active}): {err}");
                }

                // Update force mode (Anytype: switch { case changed: ... case deadline: ... })
                if force_active {
                    if changed {
                        force_active = false;
                    } else if Instant::now() >= force_deadline {
                        eprintln!("[BillingRefresh] force window expired before data changed");
                        force_active = false;
                    }
                }
            }
        });

        Self { force_tx }
    }

    /// Enter force-refresh mode. Modeled after Anytype's `Force(duration)`.
    /// Pass a custom duration, or None for the default 30min window.
    fn force(&self, duration: Option<Duration>) {
        let d = duration.unwrap_or(BILLING_FORCE_WINDOW);
        let _ = self.force_tx.send(d);
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthUser {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub email: String,
    pub avatar_url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredAuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at_ms: i64,
    pub user: AuthUser,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum AuthBootstrapState {
    LoginRequired,
    Restored { user: AuthUser },
}

impl AuthBootstrapState {
    pub fn login_required() -> Self {
        Self::LoginRequired
    }

    pub fn restored(user: AuthUser) -> Self {
        Self::Restored { user }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSuccessPayload {
    pub user: AuthUser,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingProfilePayload {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub avatar_url: String,
    pub user_tier: String,
    pub payment_provider: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_plan_code: Option<String>,
    pub billing_tier: String,
    pub max_devices: i32,
    pub ai_access_level: String,
    pub can_sync: bool,
    pub active_plan_code: Option<String>,
    pub has_active_subscription: bool,
    pub subscription_end_date: Option<String>,
    pub cancel_at_period_end: Option<bool>,
    /// Anytype finalization pattern: payment succeeded but user must complete setup.
    #[serde(default)]
    pub requires_finalization: bool,
    /// Monotonic version counter for cache invalidation detection.
    #[serde(default)]
    pub cache_version: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum BillingTier {
    Free,
    Core,
    Pro,
    Power,
}

impl BillingTier {
    fn display_label(self) -> &'static str {
        match self {
            BillingTier::Free => "Free",
            BillingTier::Core => "Core",
            BillingTier::Pro => "Pro",
            BillingTier::Power => "Power",
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            BillingTier::Free => "free",
            BillingTier::Core => "core",
            BillingTier::Pro => "pro",
            BillingTier::Power => "power",
        }
    }

    fn max_devices(self) -> i32 {
        match self {
            BillingTier::Free | BillingTier::Core => 1,
            BillingTier::Pro => 3,
            BillingTier::Power => 99,
        }
    }

    fn ai_access_level(self) -> &'static str {
        match self {
            BillingTier::Free | BillingTier::Core => "none",
            BillingTier::Pro => "basic",
            BillingTier::Power => "advanced",
        }
    }

    fn can_sync(self) -> bool {
        matches!(self, BillingTier::Pro | BillingTier::Power)
    }

    fn from_subscription(
        payment_provider: Option<&str>,
        subscription_status: Option<&str>,
        subscription_plan_code: Option<&str>,
        subscription_end_date: Option<&str>,
        cancel_at_period_end: Option<bool>,
    ) -> Self {
        if !subscription_is_access_active(
            payment_provider,
            subscription_status,
            subscription_end_date,
            cancel_at_period_end,
        ) {
            return BillingTier::Free;
        }

        match subscription_plan_code
            .map(str::trim)
            .map(str::to_lowercase)
            .as_deref()
        {
            // Accept both current and legacy plan codes for backward compatibility
            // with existing Supabase records from Paystack-era subscriptions.
            Some("core") | Some("creator") => BillingTier::Core,
            Some("pro") | Some("studio") => BillingTier::Pro,
            Some("power") | Some("empire") => BillingTier::Power,
            _ => BillingTier::Free,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthErrorPayload {
    pub message: String,
}

#[derive(Clone, Debug)]
struct AuthConfig {
    supabase_url: String,
    supabase_anon_key: String,
}

#[derive(Clone, Debug)]
struct ActiveAuthFlow {
    state: String,
    code_verifier: String,
    port: u16,
    started_at_ms: i64,
}

struct AuthRuntimeState {
    bootstrap: AuthBootstrapState,
    session: Option<StoredAuthSession>,
    active_flow: Option<ActiveAuthFlow>,
    refresh_task_started: bool,
    connectivity_task_started: bool,
    /// Guards against concurrent token refresh from multiple paths
    /// (connectivity monitor + refresh loop + explicit calls).
    refresh_in_progress: bool,
}

impl Default for AuthRuntimeState {
    fn default() -> Self {
        Self {
            bootstrap: AuthBootstrapState::login_required(),
            session: None,
            active_flow: None,
            refresh_task_started: false,
            connectivity_task_started: false,
            refresh_in_progress: false,
        }
    }
}

struct AuthInner {
    config: AuthConfig,
    state: Mutex<AuthRuntimeState>,
    billing_cache: Mutex<BillingCache>, // cached billing profile
    refresh_controller: Mutex<Option<BillingRefreshController>>, // background poller
    module_gate_cache: Mutex<ModuleGateCache>, // cached gating decisions per module
    data_dir: PathBuf,                  // app data directory — used for file-based session fallback
    app_handle: Mutex<Option<AppHandle>>,
    gate_denials: GateDenialCounter, // rate limiter for billing gate (clock rollback / brute force)
}

#[derive(Clone)]
pub struct AuthManager {
    inner: Arc<AuthInner>,
}

impl AuthManager {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        migrate_service_role_key_to_keyring();
        Ok(Self {
            inner: Arc::new(AuthInner {
                config: AuthConfig::from_env()?,
                state: Mutex::new(AuthRuntimeState::default()),
                billing_cache: Mutex::new(BillingCache::new(Some(
                    data_dir.join(BILLING_CACHE_FILENAME),
                ))),
                module_gate_cache: Mutex::new(ModuleGateCache::new(Some(
                    data_dir.join(MODULE_GATE_CACHE_FILENAME),
                ))),
                refresh_controller: Mutex::new(None),
                gate_denials: GateDenialCounter::new(),
                data_dir,
                app_handle: Mutex::new(None),
            }),
        })
    }

    pub async fn bootstrap(&self, app: AppHandle) -> Result<AuthBootstrapState, String> {
        *self.inner.app_handle.lock().await = Some(app.clone());
        let cached_bootstrap = {
            let state = self.inner.state.lock().await;
            match state.bootstrap {
                AuthBootstrapState::LoginRequired => None,
                AuthBootstrapState::Restored { ref user } => {
                    Some(AuthBootstrapState::Restored { user: user.clone() })
                }
            }
        };

        if let Some(bootstrap) = cached_bootstrap {
            return Ok(bootstrap);
        }

        let loaded_session = self.load_session_from_keyring()?;
        let next_state = match loaded_session {
            Some(session) => {
                if session.expires_at_ms <= unix_ms() {
                    match self.try_refresh_session(&session.refresh_token).await {
                        Ok(Some(refreshed)) => {
                            self.persist_session(&refreshed)?;
                            self.set_session(refreshed.clone()).await;
                            self.ensure_refresh_loop(app.clone());
                            self.spawn_profile_sync(refreshed.clone());
                            AuthBootstrapState::restored(refreshed.user)
                        }
                        Ok(None) => {
                            // Network error after sleep — keep cached session in memory so the
                            // UI renders and the refresh loop will retry in 5 minutes.
                            // Don't clear the keyring — the session is still valid there.
                            // Skip profile sync — network is unavailable.
                            eprintln!("[Auth] Token refresh failed on network error during bootstrap; keeping cached session.");
                            self.set_session(session.clone()).await;
                            self.ensure_refresh_loop(app.clone());
                            AuthBootstrapState::restored(session.user)
                        }
                        Err(_) => {
                            // REFRESH FAILED — but DO NOT destroy the cached session.
                            // The network may be flapping. Keep the keyring/file session
                            // so the user stays logged in. The refresh loop will retry.
                            eprintln!("[Auth] Bootstrap: refresh failed, keeping cached session from keyring.");
                            self.set_session(session.clone()).await;
                            self.ensure_refresh_loop(app.clone());
                            AuthBootstrapState::restored(session.user)
                        }
                    }
                } else {
                    self.set_session(session.clone()).await;
                    self.ensure_refresh_loop(app.clone());
                    self.spawn_profile_sync(session.clone());
                    AuthBootstrapState::restored(session.user)
                }
            }
            None => AuthBootstrapState::login_required(),
        };

        self.set_bootstrap(next_state.clone()).await;
        Ok(next_state)
    }

    pub async fn snapshot(&self) -> AuthBootstrapState {
        let state = self.inner.state.lock().await;
        match &state.bootstrap {
            AuthBootstrapState::LoginRequired => AuthBootstrapState::LoginRequired,
            AuthBootstrapState::Restored { user } => {
                AuthBootstrapState::Restored { user: user.clone() }
            }
        }
    }

    pub async fn start_google_login(&self, app: AppHandle) -> Result<String, String> {
        eprintln!("[auth] start_google_login: ENTERED");
        let config = self.inner.config.clone();
        let flow = self.new_flow();

        let stale_port = {
            let mut state = self.inner.state.lock().await;
            if let Some(active_flow) = state.active_flow.as_ref() {
                let age_ms = unix_ms().saturating_sub(active_flow.started_at_ms);
                if age_ms < SUPABASE_REDIRECT_STATE_TTL_MS {
                    return Err("An auth flow is already active.".to_string());
                }

                let stale_port = active_flow.port;
                state.active_flow = None;
                Some(stale_port)
            } else {
                None
            }
        };

        if let Some(stale_port) = stale_port.filter(|port| *port != 0) {
            let _ = tauri_plugin_oauth::cancel(stale_port);
        }

        {
            let mut state = self.inner.state.lock().await;
            state.active_flow = Some(flow.clone());
        }

        eprintln!("[auth] start_google_login: about to call start_with_config on port {SUPABASE_OAUTH_PORT}");
        let manager = self.clone();
        let app_for_callback = app.clone();
        let port = match start_with_config(
            OauthConfig {
                ports: Some(vec![SUPABASE_OAUTH_PORT]),
                response: None,
            },
            move |redirect_url| {
                eprintln!("[auth] OAuth server received redirect: {redirect_url}");
                let manager = manager.clone();
                let app = app_for_callback.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = manager.handle_redirect(app.clone(), redirect_url).await {
                        eprintln!("[auth] handle_redirect failed: {error}");
                        manager.emit_error(&app, error).await;
                    }
                });
            },
        ) {
            Ok(port) => {
                eprintln!("[auth] OAuth server started on port {port}");
                port
            }
            Err(error) => {
                eprintln!("[auth] start_with_config FAILED: {error}");
                self.clear_flow().await;
                return Err(error.to_string());
            }
        };

        {
            let mut state = self.inner.state.lock().await;
            if let Some(active_flow) = state.active_flow.as_mut() {
                active_flow.port = port;
            }
        }

        let auth_url = self.build_authorize_url(&flow, &config)?;

        self.spawn_timeout_watchdog(app.clone(), port, flow.started_at_ms);

        Ok(auth_url.to_string())
    }

    pub async fn prepare_login_window(window: WebviewWindow) -> Result<(), String> {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize::new(
                LOGIN_WINDOW_WIDTH,
                LOGIN_WINDOW_HEIGHT,
            )))
            .map_err(|error| error.to_string())?;
        window.center().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        #[cfg(debug_assertions)]
        {
            let _ = window.open_devtools();
        }
        Ok(())
    }

    pub async fn prepare_shell_window(window: WebviewWindow) -> Result<(), String> {
        use crate::window_bounds::transition_to_shell;
        transition_to_shell(&window).map_err(|error| error.to_string())
    }

    pub async fn sign_out(&self) -> Result<(), String> {
        // Invalidate module gate cache on sign out
        {
            let mut gate_cache = self.inner.module_gate_cache.lock().await;
            gate_cache.invalidate();
        }
        self.clear_session().await;
        self.delete_session_from_keyring();
        self.set_bootstrap(AuthBootstrapState::login_required())
            .await;
        Ok(())
    }

    /// Fetch billing profile with caching. Returns cached data if fresh, otherwise fetches from API.
    ///
    /// **Offline fallback:** If the fresh fetch fails (network unavailable, session refresh
    /// delayed), returns the last cached data even if the TTL has expired. This ensures
    /// the app remains usable offline with the user's last known subscription status.
    /// Returns an error only if there is NO cached data at all (first launch with no network).
    pub async fn get_billing_profile_cached(&self) -> Result<BillingProfilePayload, String> {
        // Check cache first (Anytype cache.go: CacheGet pattern)
        {
            let cache = self.inner.billing_cache.lock().await;
            if let Some(cached) = cache.get() {
                return Ok(cached.clone());
            }
        }

        // Cache miss or expired — fetch fresh
        let session = match self.current_valid_session().await {
            Ok(s) => s,
            Err(e) => {
                // Network or session error — fall back to stale cache so the app
                // stays usable offline. Only error if there's NO cache at all.
                eprintln!("[gate] billing fetch failed ({e}), falling back to stale cache");
                let cache = self.inner.billing_cache.lock().await;
                return cache.get_stale().cloned().ok_or_else(|| e); // Return the original error if no stale data
            }
        };

        let profile = match self.fetch_billing_profile(&session).await {
            Ok(p) => p,
            Err(e) => {
                // API error — same offline fallback
                eprintln!("[gate] billing API fetch failed ({e}), falling back to stale cache");
                let cache = self.inner.billing_cache.lock().await;
                return cache.get_stale().cloned().ok_or_else(|| e);
            }
        };

        // Update cache (Anytype cache.go: CacheSet pattern)
        {
            let mut cache = self.inner.billing_cache.lock().await;
            cache.set(profile.clone());
        }

        Ok(profile)
    }

    /// Force-invalidate the billing cache so the next call fetches fresh data.
    pub async fn invalidate_billing_cache(&self) {
        let mut cache = self.inner.billing_cache.lock().await;
        cache.invalidate();
        // Also invalidate module gate cache so stale decisions are cleared
        let mut gate_cache = self.inner.module_gate_cache.lock().await;
        gate_cache.invalidate();
    }

    /// Broadcast a billing status change event to the frontend.
    /// Anytype pattern: sendMembershipUpdateEvent() / sendMembershipV2UpdateEvent()
    /// uses eventSender.Broadcast() to push real-time updates to subscribers.
    /// Here we emit via Tauri's event system which the frontend EventBus picks up.
    pub async fn broadcast_billing_event(&self, app: &AppHandle) {
        // Fetch FRESH data (not cached) to avoid broadcasting stale state.
        // Anytype: fetchAndUpdate fetches first, then broadcasts with the fresh data.
        if let Ok(profile) = self.get_billing_profile().await {
            let _ = app.emit("billing:status-changed", &profile);
        }
    }

    /// Broadcast a tiers/products change event to the frontend.
    /// Anytype pattern: sendTiersUpdateEvent() / sendMembershipV2ProductsUpdateEvent()
    /// This is separate from the subscription status event so the UI can update
    /// pricing/feature lists without re-rendering the subscription card.
    pub async fn broadcast_tiers_event(&self, app: &AppHandle) {
        if let Ok(profile) = self.get_billing_profile().await {
            let _ = app.emit("billing:tiers-changed", &profile);
        }
    }

    /// Start (or ensure) the background billing refresh loop.
    /// If `force`, enter aggressive polling mode (10s for 30min).
    pub(crate) async fn start_billing_refresh(&self, app: AppHandle, force: bool) {
        // Invalidate cache on any payment action (Anytype cache invalidation pattern)
        self.invalidate_billing_cache().await;

        let mut rc_lock = self.inner.refresh_controller.lock().await;

        if rc_lock.is_none() {
            let app_for_fetch = app.clone();
            let fetch = move |_app: AppHandle, mgr: AuthManager| {
                let app = app_for_fetch.clone();
                async move {
                    // fetchAndUpdate pattern (Anytype payments.go: fetchAndUpdate / fetchAndUpdateV2).
                    // 1) Fetch profile from network
                    // 2) Compare with cached data
                    // 3) If changed → broadcast event + return changed=true
                    // 4) If same → just update cache (refresh TTL), no broadcast, return changed=false
                    // 5) On error → log, return changed=false to keep force mode alive
                    let session = mgr.current_session().await;
                    let Some(session) = session else {
                        return (false, Some("No active session".to_string()));
                    };

                    // Step 1: Fetch fresh data
                    match mgr.fetch_billing_profile(&session).await {
                        Ok(new_profile) => {
                            // Step 2: Compare with cached data (Anytype: fetchAndUpdate does deep comparison)
                            let changed = {
                                let cache = mgr.inner.billing_cache.lock().await;
                                match cache.get() {
                                    Some(cached) => {
                                        // Compare relevant fields (subscription status, plan, tier)
                                        cached.subscription_status
                                            != new_profile.subscription_status
                                            || cached.subscription_plan_code
                                                != new_profile.subscription_plan_code
                                            || cached.billing_tier != new_profile.billing_tier
                                            || cached.requires_finalization
                                                != new_profile.requires_finalization
                                    }
                                    None => true, // No cache → always changed
                                }
                            };

                            // Step 3-4: Update cache always (refreshes TTL)
                            {
                                let mut cache = mgr.inner.billing_cache.lock().await;
                                cache.set(new_profile.clone());
                            }

                            // Step 5: Only broadcast if data actually changed (Anytype pattern)
                            if changed {
                                let _ = app.emit("billing:status-changed", &new_profile);
                            }

                            (changed, None) // Anytype: fetch returns (changed, error)
                        }
                        Err(err) => {
                            // Anytype: log.Warn on error, force mode continues
                            (false, Some(err))
                        }
                    }
                }
            };

            let controller = BillingRefreshController::spawn(app.clone(), self.clone(), fetch);
            *rc_lock = Some(controller);
        }

        if force {
            if let Some(ref controller) = *rc_lock {
                // Anytype: Force(duration) pattern — pass default 30min window
                controller.force(None);
            }
        }
    }

    pub async fn get_billing_profile(&self) -> Result<BillingProfilePayload, String> {
        let session = self.current_valid_session().await?;
        self.fetch_billing_profile(&session).await
    }

    pub async fn update_display_name(&self, display_name: String) -> Result<AuthUser, String> {
        let trimmed = display_name.trim();
        if trimmed.is_empty() {
            return Err("Display name cannot be empty.".to_string());
        }
        if trimmed.len() > 100 {
            return Err("Display name must be 100 characters or fewer.".to_string());
        }

        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to update your display name.".to_string())?;
        if session.user.id.trim().is_empty() {
            return Err("Authenticated session is missing a user id.".to_string());
        }

        self.patch_profile_display_name(&session, trimmed).await?;

        let mut updated_session = session.clone();
        updated_session.user.name = trimmed.to_string();
        self.persist_session(&updated_session)?;
        self.set_session(updated_session.clone()).await;
        self.set_bootstrap(AuthBootstrapState::restored(updated_session.user.clone()))
            .await;

        Ok(updated_session.user)
    }

    pub async fn sync_profile_now(&self) -> Result<(), String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to sync your profile.".to_string())?;
        self.sync_profile_to_supabase(&session).await
    }

    pub async fn delete_account(&self) -> Result<(), String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to delete your account.".to_string())?;

        let service_role_key = get_service_role_key()?;

        if session.user.id.trim().is_empty() {
            return Err("Authenticated session is missing a user id.".to_string());
        }

        let client = Client::new();
        let url = format!(
            "{}/auth/v1/admin/users/{}",
            self.inner.config.supabase_url.trim_end_matches('/'),
            session.user.id
        );

        let response = client
            .delete(url)
            .header("apikey", &service_role_key)
            .header("Authorization", format!("Bearer {service_role_key}"))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase account deletion failed: {text}"));
        }

        self.clear_session().await;
        self.delete_session_from_keyring();
        self.set_bootstrap(AuthBootstrapState::login_required())
            .await;
        Ok(())
    }

    async fn set_session(&self, session: StoredAuthSession) {
        let mut state = self.inner.state.lock().await;
        state.session = Some(session);
    }

    pub async fn current_session(&self) -> Option<StoredAuthSession> {
        let state = self.inner.state.lock().await;
        state.session.clone()
    }

    async fn current_valid_session(&self) -> Result<StoredAuthSession, String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in before continuing.".to_string())?;
        if session.expires_at_ms - unix_ms() > 60_000 {
            return Ok(session);
        }

        match self.try_refresh_session(&session.refresh_token).await {
            Ok(Some(refreshed)) => {
                self.persist_session(&refreshed)?;
                self.set_session(refreshed.clone()).await;
                self.set_bootstrap(AuthBootstrapState::restored(refreshed.user.clone()))
                    .await;
                self.spawn_profile_sync(refreshed.clone());
                Ok(refreshed)
            }
            Ok(None) => {
                // Network error — return the stale session anyway; the caller
                // will get a network error downstream rather than a silent log-out.
                Err(
                    "Session refresh delayed: network unavailable. Please check your connection."
                        .to_string(),
                )
            }
            Err(error) => {
                // REFRESH FAILED — but DO NOT destroy the session.
                // Return the stale session anyway. The caller's downstream
                // network calls will fail gracefully. The background refresh
                // loop will retry on the next 5-minute tick.
                eprintln!(
                    "[Auth] current_valid_session: refresh failed, returning stale session: {error}"
                );
                Ok(session)
            }
        }
    }

    /// Returns (supabase_url, anon_key) for use in sync calls.
    pub fn supabase_config(&self) -> (String, String) {
        (
            self.inner.config.supabase_url.clone(),
            self.inner.config.supabase_anon_key.clone(),
        )
    }

    async fn clear_session(&self) {
        let mut state = self.inner.state.lock().await;
        state.session = None;
        state.active_flow = None;
        state.refresh_task_started = false;
        state.connectivity_task_started = false;
        state.refresh_in_progress = false;
    }

    /// Path to the file-based session fallback.
    fn session_file_path(&self) -> PathBuf {
        self.inner.data_dir.join(AUTH_SESSION_FILENAME)
    }

    /// Save session to a JSON file in the app data directory.
    /// Acts as a fallback when the OS keyring is unavailable.
    fn save_session_to_file(&self, session: &StoredAuthSession) -> Result<(), String> {
        let path = self.session_file_path();
        // Ensure the app data directory exists before writing
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let raw = serde_json::to_string(session).map_err(|e| e.to_string())?;
        std::fs::write(&path, &raw).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Load session from the file-based fallback.
    fn load_session_from_file(&self) -> Result<Option<StoredAuthSession>, String> {
        let path = self.session_file_path();
        if !path.exists() {
            return Ok(None);
        }
        let raw = match std::fs::read_to_string(&path) {
            Ok(content) => content,
            Err(err) => {
                eprintln!("[Auth] Failed to read session file: {err}");
                return Ok(None);
            }
        };
        match serde_json::from_str::<StoredAuthSession>(&raw) {
            Ok(session) => Ok(Some(session)),
            Err(err) => {
                eprintln!("[Auth] Corrupt session file, removing: {err}");
                let _ = std::fs::remove_file(&path);
                Ok(None)
            }
        }
    }

    /// Remove the file-based session fallback.
    fn delete_session_file(&self) {
        let path = self.session_file_path();
        if path.exists() {
            let _ = std::fs::remove_file(&path);
        }
    }

    fn delete_session_from_keyring(&self) {
        if let Ok(entry) = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_ACCOUNT) {
            let _ = entry.delete_credential();
        }
        // Also clean up file-based fallback
        self.delete_session_file();
    }

    async fn set_bootstrap(&self, bootstrap: AuthBootstrapState) {
        let mut state = self.inner.state.lock().await;
        if matches!(bootstrap, AuthBootstrapState::LoginRequired) && state.session.is_some() {
            return;
        }
        state.bootstrap = bootstrap;
    }

    fn ensure_refresh_loop(&self, _app: AppHandle) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            let should_start = {
                let mut state = manager.inner.state.lock().await;
                if state.refresh_task_started {
                    false
                } else {
                    state.refresh_task_started = true;
                    true
                }
            };

            if !should_start {
                return;
            }

            // Also start the connectivity monitor (has its own start-once guard)
            manager.start_connectivity_monitor();

            loop {
                sleep(Duration::from_millis(SUPABASE_REFRESH_CHECK_INTERVAL_MS)).await;

                let session = {
                    let state = manager.inner.state.lock().await;
                    state.session.clone()
                };

                let Some(session) = session else {
                    break;
                };

                if session.expires_at_ms - unix_ms() > SUPABASE_REFRESH_WINDOW_MS {
                    continue;
                }

                // Check concurrency guard (connectivity monitor may be refreshing)
                {
                    let mut state = manager.inner.state.lock().await;
                    if state.refresh_in_progress {
                        eprintln!("[Auth] Refresh loop: skipped (refresh in progress by monitor)");
                        continue;
                    }
                    state.refresh_in_progress = true;
                }

                match manager.try_refresh_session(&session.refresh_token).await {
                    Ok(Some(refreshed)) => {
                        if manager.persist_session(&refreshed).is_ok() {
                            manager.set_session(refreshed.clone()).await;
                            manager
                                .set_bootstrap(AuthBootstrapState::restored(refreshed.user.clone()))
                                .await;
                            manager.spawn_profile_sync(refreshed.clone());
                        }
                    }
                    Ok(None) => {
                        // Network error — don't clear session, keep trying on next tick.
                        eprintln!("[Auth] Refresh loop: network error, will retry.");
                    }
                    Err(error) => {
                        // REFRESH FAILED — but DO NOT destroy the session.
                        // The network may be flapping. Keep the session in memory
                        // so the user stays logged in. The loop continues and will
                        // retry on the next tick (5 minutes).
                        eprintln!(
                            "[Auth] Refresh loop: server rejected refresh, but keeping session: {error}"
                        );
                    }
                }

                // Release concurrency guard
                {
                    let mut state = manager.inner.state.lock().await;
                    state.refresh_in_progress = false;
                }
            }
        });
    }

    fn start_connectivity_monitor(&self) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            // ── Start-once guard ────────────────────────────────────
            {
                let mut state = manager.inner.state.lock().await;
                if state.connectivity_task_started {
                    return;
                }
                state.connectivity_task_started = true;
            }

            eprintln!("[connectivity] Monitor started");

            let client = match reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
            {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[connectivity] Failed to build HTTP client: {e}");
                    return;
                }
            };

            let mut was_offline = false;
            let mut offline_count: u64 = 0;
            let mut last_refresh_instant: Option<std::time::Instant> = None;
            const FLAP_COOLDOWN: Duration = Duration::from_secs(30);

            loop {
                // ── Check connectivity with fallback URLs ───────────
                let online = check_connectivity(&client).await;

                if online && was_offline {
                    // ── Network restored! ───────────────────────────
                    // Check flap cooldown: skip refresh if we just refreshed
                    let within_cooldown = last_refresh_instant
                        .map(|last| last.elapsed() < FLAP_COOLDOWN)
                        .unwrap_or(false);

                    if within_cooldown {
                        eprintln!("[connectivity] Network restored but within flap cooldown, skipping refresh.");
                        // was_offline and offline_count are set correctly
                        // at the bottom of the loop body — no need to touch them here.
                    } else {
                        eprintln!("[connectivity] Network restored — checking session...");
                        if let Some(session) = manager.current_session().await {
                            if session.expires_at_ms - unix_ms() <= 120_000 {
                                // Prevent concurrent refresh (monitor + refresh loop racing)
                                let should_refresh = {
                                    let mut state = manager.inner.state.lock().await;
                                    if state.refresh_in_progress {
                                        false
                                    } else {
                                        state.refresh_in_progress = true;
                                        true
                                    }
                                };

                                if should_refresh {
                                    eprintln!("[connectivity] Session near expiry, refreshing now...");
                                    last_refresh_instant = Some(std::time::Instant::now());
                                    match manager.try_refresh_session(&session.refresh_token).await {
                                        Ok(Some(refreshed)) => {
                                            let _ = manager.persist_session(&refreshed);
                                            manager.set_session(refreshed.clone()).await;
                                            manager
                                                .set_bootstrap(AuthBootstrapState::restored(
                                                    refreshed.user.clone(),
                                                ))
                                                .await;
                                            eprintln!("[connectivity] Session refreshed on network restore.");
                                        }
                                        Ok(None) => {
                                            eprintln!("[connectivity] Refresh blocked by network.");
                                        }
                                        Err(e) => {
                                            eprintln!("[connectivity] Refresh failed on network restore: {e}");
                                        }
                                    }
                                    // Release the concurrency guard
                                    let mut state = manager.inner.state.lock().await;
                                    state.refresh_in_progress = false;
                                }
                            } else {
                                eprintln!("[connectivity] Session still fresh.");
                            }
                        }
                        offline_count = 0;
                    }
                } else if !online {
                    offline_count += 1;
                }

                was_offline = !online;

                // ── Session cleared? (user signed out) ─────────────
                {
                    let state = manager.inner.state.lock().await;
                    if state.session.is_none() {
                        eprintln!("[connectivity] Session cleared, stopping.");
                        break;
                    }
                }

                // ── Exponential backoff with jitter ────────────────
                // After sustained offline, back off to 2min interval.
                // When online, use a shorter interval for fast detection.
                let interval_s = if online {
                    CONNECTIVITY_MIN_INTERVAL_S
                } else {
                    let backoff_steps = offline_count.min(CONNECTIVITY_BACKOFF_THRESHOLD);
                    // SAFETY: backoff_steps is capped at CONNECTIVITY_BACKOFF_THRESHOLD (6),
                // so 2^6 = 64 → well below u64 overflow. The .min(128) is a safety net.
                let base_s = CONNECTIVITY_MIN_INTERVAL_S * (2u64.pow(backoff_steps as u32).min(128));
                    base_s.min(CONNECTIVITY_MAX_INTERVAL_S)
                };

                // Add jitter: ±25% to desync from other timers
                let jitter_factor = 0.75 + (rand::random::<f64>() * 0.5);
                let actual_s = (interval_s as f64 * jitter_factor) as u64;

                sleep(Duration::from_secs(actual_s.max(1))).await;
            }
        });
    }

    fn spawn_timeout_watchdog(&self, app: AppHandle, port: u16, started_at_ms: i64) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_millis(SUPABASE_REDIRECT_STATE_TTL_MS as u64)).await;

            let is_still_active = {
                let state = manager.inner.state.lock().await;
                state
                    .active_flow
                    .as_ref()
                    .map(|flow| flow.port == port && flow.started_at_ms == started_at_ms)
                    .unwrap_or(false)
            };

            if !is_still_active {
                return;
            }

            let _ = tauri_plugin_oauth::cancel(port);
            manager.clear_flow().await;
            manager
                .emit_error(&app, "OAuth login timed out after 2 minutes.".to_string())
                .await;
        });
    }

    async fn clear_flow(&self) {
        let mut state = self.inner.state.lock().await;
        state.active_flow = None;
    }

    fn new_flow(&self) -> ActiveAuthFlow {
        ActiveAuthFlow {
            state: random_urlsafe_token(32),
            code_verifier: random_urlsafe_token(96),
            port: 0,
            started_at_ms: unix_ms(),
        }
    }

    fn build_authorize_url(
        &self,
        flow: &ActiveAuthFlow,
        config: &AuthConfig,
    ) -> Result<Url, String> {
        let mut url = Url::parse(&format!(
            "{}/auth/v1/authorize",
            config.supabase_url.trim_end_matches('/')
        ))
        .map_err(|error| error.to_string())?;

        let redirect_to = callback_url_with_state(&flow.state)?;
        let challenge = pkce_challenge(&flow.code_verifier);
        url.query_pairs_mut()
            .append_pair("provider", "google")
            .append_pair("redirect_to", redirect_to.as_str())
            .append_pair("code_challenge", &challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("prompt", "select_account");
        Ok(url)
    }

    async fn handle_redirect(&self, app: AppHandle, redirect_url: String) -> Result<(), String> {
        let flow = {
            let mut state = self.inner.state.lock().await;
            state.active_flow.take()
        }
        .ok_or_else(|| "No active auth flow is waiting for a callback.".to_string())?;

        let parsed = Url::parse(&redirect_url).map_err(|error| error.to_string())?;
        if let Some(error) = parsed
            .query_pairs()
            .find(|(key, _)| key == "error")
            .map(|(_, value)| value.to_string())
        {
            let _ = tauri_plugin_oauth::cancel(flow.port);
            let description = parsed
                .query_pairs()
                .find(|(key, _)| key == "error_description")
                .map(|(_, value)| value.to_string())
                .unwrap_or_else(|| "OAuth sign-in failed.".to_string());
            return Err(format!("{error}: {description}"));
        }

        let callback_state = parsed
            .query_pairs()
            .find(|(key, _)| key == "flow_state")
            .map(|(_, value)| value.to_string());
        if callback_state.as_deref() != Some(flow.state.as_str()) {
            let _ = tauri_plugin_oauth::cancel(flow.port);
            return Err("OAuth callback nonce mismatch.".to_string());
        }

        let code = parsed
            .query_pairs()
            .find(|(key, _)| key == "code")
            .map(|(_, value)| value.to_string())
            .ok_or_else(|| "OAuth callback did not include an authorization code.".to_string())?;

        let redirect_uri = callback_url_with_state(&flow.state)?.to_string();

        let session = self
            .exchange_code_for_session(&code, &flow.code_verifier, &redirect_uri)
            .await?;
        self.persist_session(&session)?;
        self.set_session(session.clone()).await;
        self.set_bootstrap(AuthBootstrapState::restored(session.user.clone()))
            .await;
        self.ensure_refresh_loop(app.clone());
        self.spawn_profile_sync(session.clone());
        let _ = tauri_plugin_oauth::cancel(flow.port);

        app.emit(
            "auth:success",
            AuthSuccessPayload {
                user: session.user.clone(),
            },
        )
        .map_err(|error| error.to_string())?;

        Ok(())
    }

    async fn emit_error(&self, app: &AppHandle, message: String) {
        let _ = app.emit("auth:error", AuthErrorPayload { message });
    }

    fn spawn_profile_sync(&self, session: StoredAuthSession) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = manager.sync_profile_to_supabase(&session).await {
                eprintln!("[Auth] Failed to sync profile to Supabase: {error}");
                if let Some(ref handle) = *manager.inner.app_handle.lock().await {
                    let _ = handle.emit(
                        "auth:error",
                        serde_json::json!({
                            "message": format!("Profile sync failed: {error}")
                        }),
                    );
                }
            }
        });
    }

    fn load_session_from_keyring(&self) -> Result<Option<StoredAuthSession>, String> {
        // Try OS keyring first (secure storage)
        let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_ACCOUNT)
            .map_err(|error| error.to_string())?;

        let keyring_result: Option<StoredAuthSession> = match entry.get_password() {
            Ok(raw) => {
                match serde_json::from_str::<StoredAuthSession>(&raw) {
                    Ok(session) => {
                        // Keyring hit — also persist to file so the file is fresh
                        let _ = self.save_session_to_file(&session);
                        return Ok(Some(session));
                    }
                    Err(_) => None, // Corrupt keyring entry, fall through to file
                }
            }
            Err(keyring::Error::NoEntry) => None, // Not in keyring, try file
            Err(error) => {
                // Keyring access error (e.g., credential service unavailable)
                eprintln!("[Auth] Keyring read failed, falling back to file: {error}");
                None
            }
        };

        // Fallback: try file-based session store
        if keyring_result.is_none() {
            eprintln!("[Auth] Keyring had no session, trying file-based fallback");
        }
        self.load_session_from_file()
    }

    fn persist_session(&self, session: &StoredAuthSession) -> Result<(), String> {
        let raw = serde_json::to_string(session).map_err(|error| error.to_string())?;

        // Always write to file-based fallback
        let file_result = self.save_session_to_file(session);
        if let Err(ref err) = file_result {
            eprintln!("[Auth] Failed to persist session to file: {err}");
        }

        // Try OS keyring (primary secure storage)
        match Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_ACCOUNT) {
            Ok(entry) => {
                if let Err(error) = entry.set_password(&raw) {
                    eprintln!("[Auth] Keyring write failed, file fallback is active: {error}");
                    // Don't fail — file fallback has the session
                }
            }
            Err(error) => {
                eprintln!("[Auth] Keyring entry creation failed, file fallback is active: {error}");
                // Don't fail — file fallback has the session
            }
        }

        // If file write also failed, only then report error
        file_result
    }

    async fn exchange_code_for_session(
        &self,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> Result<StoredAuthSession, String> {
        let config = self.inner.config.clone();
        let client = Client::new();
        let url = format!(
            "{}/auth/v1/token?grant_type=pkce",
            config.supabase_url.trim_end_matches('/')
        );

        let response = client
            .post(url)
            .header("apikey", &config.supabase_anon_key)
            .header(
                "Authorization",
                format!("Bearer {}", config.supabase_anon_key),
            )
            .header("Content-Type", "application/json")
            .json(&json!({
                "auth_code": code,
                "code_verifier": code_verifier,
                "redirect_uri": redirect_uri,
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase auth exchange failed: {text}"));
        }

        let token: SupabaseTokenResponse =
            response.json().await.map_err(|error| error.to_string())?;
        Ok(StoredAuthSession {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_at_ms: token
                .expires_at
                .map(|seconds| seconds.saturating_mul(1000))
                .unwrap_or_else(|| unix_ms() + (token.expires_in.saturating_mul(1000))),
            user: map_supabase_user(token.user),
        })
    }

    async fn sync_profile_to_supabase(&self, session: &StoredAuthSession) -> Result<(), String> {
        if session.user.id.trim().is_empty() {
            return Ok(());
        }

        let config = self.inner.config.clone();
        let client = Client::new();
        let url = format!(
            "{}/rest/v1/profiles?on_conflict=id",
            config.supabase_url.trim_end_matches('/')
        );

        let payload = json!({
            "id": session.user.id,
            "email": session.user.email,
            "full_name": session.user.name,
            "display_name": session.user.name,
            "avatar_url": if session.user.avatar_url.is_empty() {
                Value::Null
            } else {
                Value::String(session.user.avatar_url.clone())
            },
            "gamification_data": default_gamification_data(),
        });

        let response = client
            .post(url)
            .header("apikey", &config.supabase_anon_key)
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Content-Type", "application/json")
            .header(
                "Prefer",
                "resolution=merge-duplicates,return=representation",
            )
            .json(&payload)
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase profile sync failed: {text}"));
        }

        Ok(())
    }

    async fn patch_profile_display_name(
        &self,
        session: &StoredAuthSession,
        display_name: &str,
    ) -> Result<(), String> {
        let config = self.inner.config.clone();
        let client = Client::new();
        let url = format!(
            "{}/rest/v1/profiles?id=eq.{}",
            config.supabase_url.trim_end_matches('/'),
            session.user.id
        );

        let response = client
            .patch(url)
            .header("apikey", &config.supabase_anon_key)
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&json!({
                "display_name": display_name,
                "full_name": display_name,
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase profile update failed: {text}"));
        }

        Ok(())
    }

    /// Try to refresh a session, distinguishing transient network errors from permanent auth errors.
    ///
    /// Returns:
    /// - `Ok(Some(session))` — refresh succeeded, session is valid.
    /// - `Ok(None)` — transient error (network timeout, DNS failure, etc.).
    ///   Caller should keep the existing session and retry later.
    /// - `Err(String)` — permanent auth error (invalid/expired refresh token).
    ///   Caller should clear the session and force re-login.
    ///
    /// **Network-flap resilience:** On non-2xx response, waits 1 second and retries
    /// exactly once. This handles the rare race where Supabase consumes the refresh
    /// token (rotation) but the response is lost due to flapping WiFi. The brief delay
    /// lets the connection stabilize and Supabase's token-reuse grace period (10s) to
    /// pass so the retry gets fresh credentials.
    async fn try_refresh_session(
        &self,
        refresh_token: &str,
    ) -> Result<Option<StoredAuthSession>, String> {
        let attempt = |token: String| async move {
            // Helper: convert the builder error into the (bool, String) tuple
            fn make_client() -> Result<Client, (bool, String)> {
                Client::builder()
                    .timeout(Duration::from_secs(15))
                    .build()
                    .map_err(|e| (false, e.to_string()))
            }
            let config = self.inner.config.clone();
            let client = make_client()?;
            let url = format!(
                "{}/auth/v1/token?grant_type=refresh_token",
                config.supabase_url.trim_end_matches('/')
            );

            let response = match client
                .post(&url)
                .header("apikey", &config.supabase_anon_key)
                .header(
                    "Authorization",
                    format!("Bearer {}", config.supabase_anon_key),
                )
                .header("Content-Type", "application/json")
                .json(&json!({
                    "refresh_token": &token,
                }))
                .send()
                .await
            {
                Ok(resp) => resp,
                Err(error) => {
                    // Network error — transient.
                    return Err((false, format!("{error}")));
                }
            };

            if !response.status().is_success() {
                let text = response.text().await.unwrap_or_default();
                // Non-2xx — likely invalid/expired refresh token.
                return Err((true, format!("Supabase refresh failed: {text}")));
            }

            let token_resp: SupabaseTokenResponse =
                response.json().await.map_err(|error| (true, error.to_string()))?;

            Ok(Some(StoredAuthSession {
                access_token: token_resp.access_token,
                refresh_token: token_resp.refresh_token,
                expires_at_ms: token_resp
                    .expires_at
                    .map(|seconds| seconds.saturating_mul(1000))
                    .unwrap_or_else(|| unix_ms() + (token_resp.expires_in.saturating_mul(1000))),
                user: map_supabase_user(token_resp.user),
            }))
        };

        // ── First attempt ────────────────────────────────────────────
        let first = attempt(refresh_token.to_string()).await;

        match first {
            Ok(session) => return Ok(session),
            Err((reached_server, msg)) => {
                if !reached_server {
                    // Pure network error (timeout, DNS, connection reset) — transient.
                    eprintln!("[Auth] Network error during token refresh: {msg}");
                    return Ok(None);
                }

                // Server responded with an error — could be a stale token after a
                // network flap that consumed the token but lost the response.
                // Wait 1 second and retry exactly once.
                eprintln!(
                    "[Auth] Refresh rejected by server, retrying once after 1s: {msg}"
                );
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }

        // ── Second (final) attempt ───────────────────────────────────
        match attempt(refresh_token.to_string()).await {
            Ok(session) => {
                eprintln!("[Auth] Refresh succeeded on retry — network flap mitigated.");
                Ok(session)
            }
            Err((_reached_server, msg)) => {
                // Both attempts failed — genuinely invalid token.
                eprintln!("[Auth] Refresh failed after retry: {msg}");
                Err(msg)
            }
        }

    }

    async fn fetch_billing_profile(
        &self,
        session: &StoredAuthSession,
    ) -> Result<BillingProfilePayload, String> {
        let config = self.inner.config.clone();
        if session.user.id.trim().is_empty() {
            let billing_tier = BillingTier::Free;
            return Ok(BillingProfilePayload {
                id: String::new(),
                email: session.user.email.clone(),
                display_name: session.user.name.clone(),
                avatar_url: session.user.avatar_url.clone(),
                user_tier: billing_tier.display_label().to_string(),
                payment_provider: None,
                subscription_status: None,
                subscription_plan_code: None,
                billing_tier: billing_tier.as_str().to_string(),
                max_devices: billing_tier.max_devices(),
                ai_access_level: billing_tier.ai_access_level().to_string(),
                can_sync: billing_tier.can_sync(),
                active_plan_code: None,
                has_active_subscription: false,
                subscription_end_date: None,
                cancel_at_period_end: None,
                requires_finalization: false,
                cache_version: BILLING_CACHE_LAST_VERSION,
            });
        }

        let url = format!(
            "{}/rest/v1/profiles?id=eq.{}&select=id,email,display_name,full_name,avatar_url,user_tier,payment_provider,subscription_status,subscription_plan_code,subscription_end_date,cancel_at_period_end",
            config.supabase_url.trim_end_matches('/'),
            session.user.id
        );

        let response = Client::new()
            .get(url)
            .header("apikey", &config.supabase_anon_key)
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Billing profile lookup failed: {text}"));
        }

        let profiles: Vec<SupabaseProfileRecord> =
            response.json().await.map_err(|error| error.to_string())?;
        let profile = profiles.into_iter().next();
        let payment_provider = profile
            .as_ref()
            .and_then(|value| value.payment_provider.clone());
        let subscription_status = profile
            .as_ref()
            .and_then(|value| value.subscription_status.clone());
        let subscription_plan_code = profile
            .as_ref()
            .and_then(|value| value.subscription_plan_code.clone());
        let billing_tier = effective_billing_tier(
            payment_provider.as_deref(),
            subscription_status.as_deref(),
            subscription_plan_code.as_deref(),
            profile
                .as_ref()
                .and_then(|value| value.subscription_end_date.as_deref()),
            profile
                .as_ref()
                .and_then(|value| value.cancel_at_period_end),
        );
        let active_plan_code = resolve_active_plan_code(
            payment_provider.as_deref(),
            subscription_status.as_deref(),
            subscription_plan_code.as_deref(),
            profile
                .as_ref()
                .and_then(|value| value.subscription_end_date.as_deref()),
            profile
                .as_ref()
                .and_then(|value| value.cancel_at_period_end),
        );

        // Anytype finalization pattern
        let requires_finalization = subscription_needs_finalization(subscription_status.as_deref());
        // Cache version for frontend change detection (Anytype format version pattern).
        // Uses the format version constant so the frontend can detect schema changes.
        let cache_version = BILLING_CACHE_LAST_VERSION;

        Ok(BillingProfilePayload {
            id: profile
                .as_ref()
                .map(|value| value.id.clone())
                .unwrap_or_else(|| session.user.id.clone()),
            email: profile
                .as_ref()
                .and_then(|value| value.email.clone())
                .unwrap_or_else(|| session.user.email.clone()),
            display_name: profile
                .as_ref()
                .and_then(|value| {
                    value
                        .display_name
                        .clone()
                        .or_else(|| value.full_name.clone())
                })
                .unwrap_or_else(|| session.user.name.clone()),
            avatar_url: profile
                .as_ref()
                .and_then(|value| value.avatar_url.clone())
                .unwrap_or_else(|| session.user.avatar_url.clone()),
            user_tier: profile
                .as_ref()
                .and_then(|value| value.user_tier.clone())
                .map(|value| match value.trim().to_uppercase().as_str() {
                    "SPARK" => "Free".to_string(),
                    "CREATOR" => "Core".to_string(),
                    "STUDIO" => "Pro".to_string(),
                    "EMPIRE" => "Power".to_string(),
                    "CORE" => "Core".to_string(),
                    "PRO" => "Pro".to_string(),
                    "POWER" => "Power".to_string(),
                    "FREE" => "Free".to_string(),
                    other => other.to_string(),
                })
                .unwrap_or_else(|| billing_tier.display_label().to_string()),
            payment_provider,
            subscription_status,
            subscription_plan_code,
            billing_tier: billing_tier.as_str().to_string(),
            max_devices: billing_tier.max_devices(),
            ai_access_level: billing_tier.ai_access_level().to_string(),
            can_sync: billing_tier.can_sync(),
            active_plan_code: active_plan_code.clone(),
            has_active_subscription: active_plan_code.is_some(),
            subscription_end_date: profile
                .as_ref()
                .and_then(|value| value.subscription_end_date.clone()),
            cancel_at_period_end: profile
                .as_ref()
                .and_then(|value| value.cancel_at_period_end),
            requires_finalization,
            cache_version, // format version (Anytype cache.go: CurrentVersion)
        })
    }
}

fn resolve_active_plan_code(
    payment_provider: Option<&str>,
    subscription_status: Option<&str>,
    subscription_plan_code: Option<&str>,
    subscription_end_date: Option<&str>,
    cancel_at_period_end: Option<bool>,
) -> Option<String> {
    if !subscription_is_access_active(
        payment_provider,
        subscription_status,
        subscription_end_date,
        cancel_at_period_end,
    ) {
        return None;
    }

    let plan_code = subscription_plan_code?.trim().to_lowercase();
    match plan_code.as_str() {
        // Accept legacy Paystack-era codes for backward compat with existing Supabase rows.
        "core" | "creator" | "pro" | "studio" | "power" | "empire" => {
            Some(if plan_code == "creator" {
                "core".to_string()
            } else if plan_code == "studio" {
                "pro".to_string()
            } else if plan_code == "empire" {
                "power".to_string()
            } else {
                plan_code
            })
        }
        _ => None,
    }
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    #[serde(default)]
    expires_at: Option<i64>,
    user: SupabaseUser,
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseUser {
    id: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    user_metadata: Value,
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseProfileRecord {
    id: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
    #[serde(default)]
    user_tier: Option<String>,
    #[serde(default)]
    payment_provider: Option<String>,
    #[serde(default)]
    subscription_status: Option<String>,
    #[serde(default)]
    subscription_plan_code: Option<String>,
    #[serde(default)]
    subscription_end_date: Option<String>,
    #[serde(default)]
    cancel_at_period_end: Option<bool>,
}

fn map_supabase_user(user: SupabaseUser) -> AuthUser {
    let display_name = user
        .user_metadata
        .get("full_name")
        .and_then(Value::as_str)
        .or_else(|| user.user_metadata.get("name").and_then(Value::as_str))
        .or_else(|| {
            user.user_metadata
                .get("display_name")
                .and_then(Value::as_str)
        })
        .or(user.email.as_deref())
        .unwrap_or(&user.id)
        .to_string();

    let email = user.email.unwrap_or_default();
    let avatar_url = user
        .user_metadata
        .get("avatar_url")
        .and_then(Value::as_str)
        .or_else(|| user.user_metadata.get("picture").and_then(Value::as_str))
        .unwrap_or("")
        .to_string();

    AuthUser {
        id: user.id,
        name: display_name,
        email,
        avatar_url,
    }
}

fn default_gamification_data() -> Value {
    json!({
        "level": 1,
        "levelTitle": "Aspiring Author",
        "currentXP": 0,
        "nextLevelXP": 100,
        "booksCreatedCount": 0,
        "currentStreak": 0,
        "badges": [],
        "dailyChallenges": [],
    })
}

#[allow(dead_code)]
pub(crate) fn module_required_tier(module_id: &str) -> BillingTier {
    match module_id {
        "dashboard" | "settings" => BillingTier::Free,
        "notes" | "journal" | "tasks" | "passwords" | "budget" => BillingTier::Core,
        "ai" => BillingTier::Pro,
        "telemetry" | "habits" | "focus" | "health" | "sleep" | "nutrition" | "mood"
        | "flashcards" | "reading" | "grocery" | "recipes" | "time" | "goals" | "clipboard"
        | "breathing" | "voice-memos" | "countdown" => BillingTier::Pro,
        _ => BillingTier::Pro,
    }
}

/// Enforce that the current user's billing tier is sufficient for the given module.
///
/// This is the SINGLE entry point that ALL module-level Tauri commands must call.
/// It fetches the billing profile (cached), checks tier requirements, and logs
/// any denied access attempt as a suspicious event.
///
/// Returns `Ok(())` if access is allowed, `Err(String)` with a user-facing message
/// if the subscription is insufficient and a `SUSPICIOUS` audit event if suspicious.
pub(crate) async fn require_billing_tier(
    auth: &AuthManager,
    module_id: &str,
) -> Result<(), String> {
    // Dashboard and settings are always free
    if matches!(module_id, "dashboard" | "settings") {
        return Ok(());
    }

    // ── Rate limiter ──────────────────────────────────────────────────
    // If 10+ consecutive denials have been recorded without a reset,
    // throttle further attempts to prevent brute-force probing of the
    // gating system (e.g. rapid module switches looking for a race
    // window). The counter resets after 30s of no denials.
    if auth.inner.gate_denials.is_throttled() {
        emit_suspicious_event(
            "gate_throttled",
            &format!("module={module_id} — 10+ denials without reset"),
        );
        return Err(format!(
            "Too many access attempts. Please wait a moment before trying again."
        ));
    }

    // ── Module gate cache (disk-persisted) ────────────────────────────
    // Check if we already have a cached decision for this module that's
    // still valid (same profile_cache_version). This shortcut avoids
    // re-fetching and re-parsing the billing profile on every module switch.
    // On cold boot offline, these cached decisions are loaded from disk.
    let billing_profile = auth.get_billing_profile_cached().await.map_err(|e| {
        // Only log as SUSPICIOUS if the user IS signed in but billing fetch
        // still failed (network error, API failure). "Sign in before continuing"
        // is a normal auth state — no need to flag it.
        if !e.contains("Sign in before continuing")
            && !e.contains("Sign in to")
            && !e.contains("Session expired")
        {
            emit_suspicious_event("billing_fetch_failed", &format!("{module_id}: {e}"));
        }
        e
    })?;

    // ── Check gate cache ─────────────────────────────────────────────
    // If we have a cached decision that matches the billing profile's
    // cache_version, use it directly without re-computing the tier.
    {
        let gate_cache = auth.inner.module_gate_cache.lock().await;
        if let Some(cached) = gate_cache.get(module_id, billing_profile.cache_version) {
            if cached.allowed {
                auth.inner.gate_denials.reset();
                emit_gate_event(
                    module_id,
                    "allowed_cached",
                    &format!("user_tier_rank={}", cached.user_tier_rank),
                );
                return Ok(());
            } else {
                auth.inner.gate_denials.hit();
                emit_gate_event(
                    module_id,
                    "denied_cached",
                    &format!("user_tier_rank={}", cached.user_tier_rank),
                );
                return Err(format!("Upgrade required to use {module_id}."));
            }
        }
    }

    // ── Fresh evaluation ─────────────────────────────────────────────
    let tier = BillingTier::from_subscription(
        billing_profile.payment_provider.as_deref(),
        billing_profile.subscription_status.as_deref(),
        billing_profile.subscription_plan_code.as_deref(),
        billing_profile.subscription_end_date.as_deref(),
        billing_profile.cancel_at_period_end,
    );
    let user_tier_rank = tier_rank(tier);
    let required = module_required_tier(module_id);
    let allowed = user_tier_rank >= tier_rank(required);

    // ── Cache the decision ───────────────────────────────────────────
    // Persist to disk so it's available on cold boot offline.
    {
        let mut gate_cache = auth.inner.module_gate_cache.lock().await;
        gate_cache.set(ModuleGateEntry {
            module_id: module_id.to_string(),
            allowed,
            user_tier_rank,
            profile_cache_version: billing_profile.cache_version,
            cached_at_epoch_ms: unix_ms(),
        });
    }

    if allowed {
        // Allowed — reset the denial counter so the user isn't stuck throttled
        auth.inner.gate_denials.reset();
        emit_gate_event(
            module_id,
            "allowed",
            &format!("tier={:?} required={:?}", tier, required),
        );
        Ok(())
    } else {
        auth.inner.gate_denials.hit();
        emit_suspicious_event(
            "gate_denied",
            &format!("module={module_id} tier={tier:?} required={required:?}"),
        );
        Err(format!(
            "Upgrade required to use {module_id}. Current plan: {}. Required: {}.",
            tier.display_label(),
            required.display_label(),
        ))
    }
}

/// Return the tier requirement for a module as a string for frontend display.
#[tauri::command]
pub async fn get_module_required_tier(
    auth: State<'_, AuthManager>,
    module_id: String,
) -> Result<String, String> {
    // Check access first (triggers caching)
    require_billing_tier(&auth, &module_id).await?;
    Ok(module_required_tier(&module_id).display_label().to_string())
}

pub(crate) fn effective_billing_tier(
    payment_provider: Option<&str>,
    subscription_status: Option<&str>,
    subscription_plan_code: Option<&str>,
    subscription_end_date: Option<&str>,
    cancel_at_period_end: Option<bool>,
) -> BillingTier {
    BillingTier::from_subscription(
        payment_provider,
        subscription_status,
        subscription_plan_code,
        subscription_end_date,
        cancel_at_period_end,
    )
}

/// Check internet connectivity by probing multiple fallback endpoints.
/// Returns `true` if ANY of the configured URLs returns a success (2xx).
/// Uses short timeout per probe and stops at the first success.
async fn check_connectivity(client: &reqwest::Client) -> bool {
    const TIMEOUT: Duration = Duration::from_secs(4);
    for url in CONNECTIVITY_CHECK_URLS {
        let resp = timeout(TIMEOUT, client.get(*url).send()).await;
        if let Ok(Ok(response)) = resp {
            if response.status().is_success() {
                return true;
            }
        }
    }
    false
}

fn subscription_is_access_active(
    payment_provider: Option<&str>,
    subscription_status: Option<&str>,
    subscription_end_date: Option<&str>,
    cancel_at_period_end: Option<bool>,
) -> bool {
    // ── Clock rollback protection ─────────────────────────────────────
    // If the parsed subscription_end_date resolves to a time before the
    // compile-time BUILD_TIME_FLOOR, the system clock has been rolled back.
    // Treat the subscription as expired in that case.
    //
    // This prevents an attacker from setting the system clock to a past
    // date at which a paid subscription was still active.
    if let Some(end_str) = subscription_end_date {
        if let Some(end) = parse_rfc3339_to_utc(end_str) {
            if end < *BUILD_TIME_FLOOR {
                eprintln!(
                    "[gate] CLOCK ROLLBACK DETECTED: end_date={end:?} < build_floor={:?}",
                    *BUILD_TIME_FLOOR
                );
                emit_suspicious_event(
                    "clock_rollback",
                    &format!("end_date={end:?} build_floor={:?}", *BUILD_TIME_FLOOR),
                );
                return false;
            }
        }
    }
    if !matches!(
        payment_provider.map(str::trim),
        Some("dodo") | Some("paystack")
    ) {
        return false;
    }

    let subscription_active_until = subscription_end_date
        .and_then(parse_rfc3339_to_utc)
        .map(|end_date| end_date > Utc::now())
        .unwrap_or(true);

    match subscription_status.map(|value| value.trim()) {
        Some("active") => true,
        // Anytype finalization pattern: payment succeeded but user must complete setup.
        // During this window the tier is granted on a grace basis.
        Some("finalization_required") => true,
        Some("attention") => subscription_active_until,
        Some("non-renewing") => subscription_active_until,
        Some("cancelled") if cancel_at_period_end.unwrap_or(false) => subscription_end_date
            .and_then(parse_rfc3339_to_utc)
            .map(|end_date| end_date > Utc::now())
            .unwrap_or(subscription_active_until),
        _ => false,
    }
}

/// Returns true when the subscription status indicates finalization is needed.
/// Anytype pattern: after payment success, user must complete finalization steps.
fn subscription_needs_finalization(subscription_status: Option<&str>) -> bool {
    matches!(
        subscription_status.map(|v| v.trim()),
        Some("finalization_required")
    )
}

fn parse_rfc3339_to_utc(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date_time| date_time.with_timezone(&Utc))
}

#[allow(dead_code)]
pub(crate) fn module_allowed_by_tier(module_id: &str, tier: BillingTier) -> bool {
    tier_rank(tier) >= tier_rank(module_required_tier(module_id))
}

pub(crate) fn tier_rank(tier: BillingTier) -> u8 {
    match tier {
        BillingTier::Free => 0,
        BillingTier::Core => 1,
        BillingTier::Pro => 2,
        BillingTier::Power => 3,
    }
}

fn callback_url() -> String {
    format!("http://127.0.0.1:{SUPABASE_OAUTH_PORT}/auth/callback")
}

fn callback_url_with_state(flow_state: &str) -> Result<Url, String> {
    let mut redirect_to = Url::parse(&callback_url()).map_err(|error| error.to_string())?;
    redirect_to
        .query_pairs_mut()
        .append_pair("flow_state", flow_state);
    Ok(redirect_to)
}

fn random_urlsafe_token(bytes: usize) -> String {
    let mut data = vec![0_u8; bytes];
    thread_rng().fill_bytes(&mut data);
    URL_SAFE_NO_PAD.encode(data)
}

fn pkce_challenge(code_verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn unix_ms() -> i64 {
    crate::util::time::now_ms()
}

#[cfg(test)]
fn should_refresh_soon(expires_at_ms: i64) -> bool {
    expires_at_ms - unix_ms() <= SUPABASE_REFRESH_WINDOW_MS
}

impl AuthConfig {
    fn from_env() -> Result<Self, String> {
        let supabase_url = env::var("VITE_SUPABASE_URL")
            .or_else(|_| env::var("SUPABASE_URL"))
            .ok()
            .or_else(|| {
                let value = BUNDLED_SUPABASE_URL.trim();
                if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                }
            })
            .ok_or_else(|| "Missing SUPABASE_URL / VITE_SUPABASE_URL.".to_string())?;
        let supabase_anon_key = env::var("VITE_SUPABASE_ANON_KEY")
            .or_else(|_| env::var("SUPABASE_ANON_KEY"))
            .ok()
            .or_else(|| {
                let value = BUNDLED_SUPABASE_ANON_KEY.trim();
                if value.is_empty() {
                    None
                } else {
                    Some(value.to_string())
                }
            })
            .ok_or_else(|| "Missing SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY.".to_string())?;

        Ok(Self {
            supabase_url,
            supabase_anon_key,
        })
    }
}

/// Retrieve the Supabase service role key from the OS keyring.
/// Falls back to the SUPABASE_SERVICE_ROLE_KEY env var for migration.
fn get_service_role_key() -> Result<String, String> {
    let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_SERVICE_ROLE_ACCOUNT)
        .map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            // Migration fallback: try env var
            env::var("SUPABASE_SERVICE_ROLE_KEY")
                .map_err(|_| "Service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY env var or store it in the OS keychain.".to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Migrate SUPABASE_SERVICE_ROLE_KEY from env var into OS keyring on first launch.
fn migrate_service_role_key_to_keyring() {
    if let Ok(key) = env::var("SUPABASE_SERVICE_ROLE_KEY") {
        if !key.is_empty() {
            if let Ok(entry) = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_SERVICE_ROLE_ACCOUNT) {
                // Only store if no entry exists yet (first launch)
                if entry.get_password().is_err() {
                    let _ = entry.set_password(&key);
                }
            }
        }
    }
}

#[tauri::command]
pub async fn bootstrap_auth_state(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<AuthBootstrapState, String> {
    manager.bootstrap(app).await
}

#[tauri::command]
pub async fn get_auth_bootstrap_state(
    manager: State<'_, AuthManager>,
) -> Result<AuthBootstrapState, String> {
    Ok(manager.snapshot().await)
}

#[tauri::command]
pub async fn begin_google_auth(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<String, String> {
    eprintln!("[auth] begin_google_auth: COMMAND ENTERED");
    manager.start_google_login(app).await
}

#[tauri::command]
pub async fn prepare_login_window(window: WebviewWindow) -> Result<(), String> {
    AuthManager::prepare_login_window(window).await
}

#[tauri::command]
pub async fn prepare_shell_window(window: WebviewWindow) -> Result<(), String> {
    AuthManager::prepare_shell_window(window).await
}

#[tauri::command]
pub async fn sign_out(app: AppHandle, manager: State<'_, AuthManager>) -> Result<(), String> {
    let _ = app;
    manager.sign_out().await
}

#[tauri::command]
pub async fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(url.trim()).map_err(|error| error.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http(s) URLs can be opened externally.".to_string());
    }

    open_url_in_browser(&app, parsed.as_str()).await
}

#[tauri::command]
pub async fn get_billing_profile(
    manager: State<'_, AuthManager>,
) -> Result<BillingProfilePayload, String> {
    manager.get_billing_profile().await
}

/// Lightweight session validity check for wake-from-sleep / visibility-change events.
///
/// Unlike `bootstrap_auth_state`, this never clears the session on transient
/// network errors — it always returns the current user if a session exists.
/// If the token is expired but the network is unavailable, it returns `Restored`
/// with cached user data so the UI stays functional while the refresh loop retries.
#[tauri::command]
pub async fn check_auth_session(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<AuthBootstrapState, String> {
    let snapshot = manager.snapshot().await;

    // If already logged out, return immediately.
    let AuthBootstrapState::Restored { ref user } = snapshot else {
        return Ok(snapshot);
    };

    // Check if the in-memory session needs refreshing.
    let session = {
        let state = manager.inner.state.lock().await;
        state.session.clone()
    };

    let Some(session) = session else {
        // Session missing from memory but bootstrap says Restored? Try loading from keyring.
        return manager.bootstrap(app).await;
    };

    // Session is still fresh — return Restored.
    if session.expires_at_ms - unix_ms() > 120_000 {
        return Ok(AuthBootstrapState::restored(user.clone()));
    }

    // Session is expired or close to expiry — try refreshing.
    match manager.try_refresh_session(&session.refresh_token).await {
        Ok(Some(refreshed)) => {
            let _ = manager.persist_session(&refreshed);
            manager.set_session(refreshed.clone()).await;
            manager
                .set_bootstrap(AuthBootstrapState::restored(refreshed.user.clone()))
                .await;
            Ok(AuthBootstrapState::restored(refreshed.user))
        }
        Ok(None) => {
            // Network error — keep the current UI state, don't log out.
            eprintln!(
                "[Auth] check_auth_session: refresh blocked by network, keeping current session."
            );
            Ok(AuthBootstrapState::restored(user.clone()))
        }
        Err(error) => {
            // REFRESH FAILED — but DO NOT destroy the session.
            // The network may be flapping (WiFi just came back). Keeping the
            // cached session avoids a trust-breaking forced re-login. The
            // background refresh loop (5-min interval) will retry and can
            // handle eventual cleanup if the token is genuinely invalid.
            eprintln!(
                "[Auth] check_auth_session: refresh failed, but keeping cached session: {error}"
            );
            Ok(AuthBootstrapState::restored(user.clone()))
        }
    }
}

/// Set session from a deep link received from the web authentication flow.
/// This allows users who sign up and pay on the web to automatically
/// authenticate in the desktop app via a bento://auth deep link.
///
/// The deep link contains a Supabase access_token and refresh_token
/// which are used to create a local session.
#[tauri::command]
pub async fn set_session_from_deep_link(
    app: AppHandle,
    manager: State<'_, AuthManager>,
    access_token: String,
    refresh_token: String,
) -> Result<AuthSuccessPayload, String> {
    let config = manager.inner.config.clone();
    let client = reqwest::Client::new();

    // Validate the access token by fetching the user from Supabase
    let url = format!("{}/auth/v1/user", config.supabase_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("apikey", &config.supabase_anon_key)
        .header("Authorization", format!("Bearer {}", &access_token))
        .send()
        .await
        .map_err(|error| format!("Network error validating session: {error}"))?;

    if !response.status().is_success() {
        return Err(
            "The authentication link is invalid or expired. Please sign in manually.".to_string(),
        );
    }

    let supabase_user: SupabaseUser = response.json().await.map_err(|error| error.to_string())?;
    let user = map_supabase_user(supabase_user);

    // We don't know the exact expiry — use a reasonable default
    let expires_at_ms = unix_ms() + 3600_000; // 1 hour

    let session = StoredAuthSession {
        access_token: access_token.to_string(),
        refresh_token: refresh_token.to_string(),
        expires_at_ms,
        user: user.clone(),
    };

    manager.persist_session(&session)?;
    manager.set_session(session.clone()).await;
    manager
        .set_bootstrap(AuthBootstrapState::restored(user.clone()))
        .await;
    manager.ensure_refresh_loop(app.clone());
    manager.spawn_profile_sync(session.clone());

    app.emit("auth:success", AuthSuccessPayload { user: user.clone() })
        .map_err(|error| error.to_string())?;

    Ok(AuthSuccessPayload { user })
}

/// Fetch billing profile with caching (Anytype cache.go pattern).
#[tauri::command]
pub async fn get_billing_profile_cached(
    manager: State<'_, AuthManager>,
) -> Result<BillingProfilePayload, String> {
    manager.get_billing_profile_cached().await
}

/// Force-invalidate billing cache and trigger aggressive polling (Anytype ForceRefresh pattern).
/// Also broadcasts event to frontend (Anytype sendMembershipUpdateEvent).
#[tauri::command]
pub async fn force_refresh_billing(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<(), String> {
    manager.invalidate_billing_cache().await;
    manager.start_billing_refresh(app.clone(), true).await;

    // Broadcast current status to frontend (Anytype: eventSender.Broadcast)
    manager.broadcast_billing_event(&app).await;
    Ok(())
}

/// Finalize subscription after successful payment (Anytype finalization pattern).
/// Clears the `finalization_required` status on the user's profile.
/// After finalization, broadcasts event to frontend (Anytype sendMembershipUpdateEvent).
#[tauri::command]
pub async fn finalize_subscription(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<BillingProfilePayload, String> {
    let session = manager
        .current_session()
        .await
        .ok_or_else(|| "Sign in to finalize your subscription.".to_string())?;

    // Update the subscription_status in Supabase to "active"
    let client = Client::new();
    let url = format!(
        "{}/rest/v1/profiles?id=eq.{}",
        manager.inner.config.supabase_url.trim_end_matches('/'),
        session.user.id
    );

    let response = client
        .patch(url)
        .header("apikey", &manager.inner.config.supabase_anon_key)
        .header("Authorization", format!("Bearer {}", session.access_token))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=representation")
        .json(&json!({
            "subscription_status": "active",
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Subscription finalization failed: {text}"));
    }

    // Invalidate cache so next fetch returns fresh data
    manager.invalidate_billing_cache().await;

    // Fetch and broadcast the updated profile (Anytype: sendMembershipUpdateEvent)
    let profile = manager.get_billing_profile_cached().await?;
    let _ = app.emit("billing:status-changed", &profile);

    Ok(profile)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_required_is_the_default_bootstrap_state() {
        assert_eq!(
            AuthBootstrapState::login_required(),
            AuthBootstrapState::LoginRequired
        );
    }

    #[test]
    fn refresh_window_detection_triggers_within_ten_minutes() {
        assert!(should_refresh_soon(unix_ms() + 9 * 60 * 1000));
    }

    #[test]
    fn refresh_window_detection_stays_off_after_ten_minutes() {
        assert!(!should_refresh_soon(unix_ms() + 11 * 60 * 1000));
    }
}
