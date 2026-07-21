pub mod actors;
pub mod agent;
pub mod agent_core;
pub mod ai;
pub mod audio;
pub mod auth;
pub mod budget;
pub mod byok;
pub mod chatgpt_auth;
pub mod clipboard;
pub mod cloud_backup;
pub mod commands;
pub mod crypto;
pub mod crypto_commands;
pub mod db;
pub mod goals;
pub mod habits;
pub mod health;
pub mod ipc_util;
pub mod island;
pub mod local_store;
pub mod mcp;
pub mod media_player;
pub mod modules;
pub mod mood;
pub mod notes;
pub mod notifications;
pub mod payments;
pub mod ping;
pub mod runtime;
pub mod scheduler;
pub mod search;
pub mod session;
pub mod settings;
pub mod share;
pub mod sleep;
pub mod util;
pub mod window_bounds;
pub mod window_effects;

use chrono::Utc;
use serde::Serialize;
use std::{
    env, fs,
    panic::PanicHookInfo,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_shell::ShellExt;

#[cfg(not(debug_assertions))]
use tauri_plugin_deep_link::DeepLinkExt;
#[cfg(not(debug_assertions))]
use tauri_plugin_window_state::StateFlags;

use crate::auth::AuthManager;
// Disabled: cloud backup not ready yet.
// use crate::cloud_backup::{
//     apply_pending_restore, backup_now, clear_service_role_key, delete_backup, get_key_state,
//     get_state, restore_backup, set_service_role_key, spawn_cloud_backup_worker, test_connection,
// };
use crate::commands::{
    backup_desktop_settings, begin_background_task, clear_webview_browsing_data,
    consume_pending_deep_link, emit_main_window_event, export_content_to_file,
    export_focus_sessions, finish_background_task, get_dashboard_data, get_feedback_by_id,
    get_feedback_realtime_config, get_focus_dashboard, get_lifecycle_state, get_my_feedback,
    load_desktop_settings, pick_export_directory, pick_import_file, pick_transcription_model,
    quit_app, record_focus_session, restore_desktop_settings_backup, restore_window,
    save_desktop_settings, save_export_manifest, submit_feedback, write_debug_log, DashboardCache,
    PendingDeepLink,
};
use crate::crypto::CryptoService;
use crate::db::{
    create_quick_task, enforce_auth_user_boundary, flush_module_state, get_module_context,
    get_module_fonts, save_module_context, set_module_fonts, BentoAppState,
};
use crate::modules::{
    fetch_module_registry, get_active_module, get_installed_modules, get_module_settings,
    install_module, register_local_module, set_active_module, set_module_settings,
    uninstall_module,
};
use crate::notes::undo::HistoryRegistry;
use crate::notes::NoteFullCache;
use crate::runtime::DesktopRuntime;
use crate::search::SearchService;
use crate::session::ManagedTabSession;
use sysinfo::System;
use tracing::{error, info, warn};

/// Set by `recover_from_startup_crash()` when it performs a WebView2
/// profile reset. Checked in `setup()` to notify the frontend via the
/// `StartupDegraded` mechanism.
static RECOVERY_PERFORMED: AtomicBool = AtomicBool::new(false);

/// Tracks whether the app started in degraded mode (e.g., in-memory DB fallback).
/// Frontend queries this on mount to show appropriate warnings.
struct StartupDegraded {
    is_degraded: AtomicBool,
    reason: std::sync::Mutex<String>,
}

impl StartupDegraded {
    fn new() -> Self {
        Self {
            is_degraded: AtomicBool::new(false),
            reason: std::sync::Mutex::new(String::new()),
        }
    }

    fn mark(&self, reason: String) {
        self.is_degraded
            .store(true, std::sync::atomic::Ordering::Release);
        if let Ok(mut r) = self.reason.lock() {
            *r = reason;
        }
    }
}

#[tauri::command]
fn get_startup_degraded_state(
    state: tauri::State<'_, StartupDegraded>,
) -> Result<Option<String>, String> {
    if state.is_degraded.load(std::sync::atomic::Ordering::Acquire) {
        Ok(state.reason.lock().ok().map(|r| r.clone()))
    } else {
        Ok(None)
    }
}

#[derive(Clone, Serialize)]
struct CrashPayload {
    message: String,
    log_path: String,
    timestamp: String,
}

fn panic_message(info: &PanicHookInfo<'_>) -> String {
    if let Some(message) = info.payload().downcast_ref::<&str>() {
        (*message).to_string()
    } else if let Some(message) = info.payload().downcast_ref::<String>() {
        message.clone()
    } else {
        "Rust backend panic".to_string()
    }
}

fn write_crash_log(
    app: Option<&AppHandle>,
    message: &str,
    info: &PanicHookInfo<'_>,
) -> Option<CrashPayload> {
    let timestamp = Utc::now().to_rfc3339();
    let location = info
        .location()
        .map(|value| format!("{}:{}:{}", value.file(), value.line(), value.column()))
        .unwrap_or_else(|| "unknown".to_string());

    let crash_dir = if let Some(app) = app {
        app.path().app_data_dir().ok()?.join("crash")
    } else {
        std::env::temp_dir().join("bento-desktop").join("crash")
    };

    fs::create_dir_all(&crash_dir).ok()?;

    let filename = format!("crash-{}.log", Utc::now().format("%Y%m%dT%H%M%SZ"));
    let log_path = crash_dir.join(filename);
    let payload = format!("timestamp: {timestamp}\nlocation: {location}\nmessage: {message}\n");

    fs::write(&log_path, payload).ok()?;

    Some(CrashPayload {
        message: message.to_string(),
        log_path: log_path.to_string_lossy().to_string(),
        timestamp,
    })
}

pub fn install_panic_bootstrap() {
    std::panic::set_hook(Box::new(|info| {
        let message = panic_message(info);
        let _ = write_crash_log(None, &message, info);
    }));
}

fn install_runtime_panic_hook(app: AppHandle) {
    std::panic::set_hook(Box::new(move |info| {
        let message = panic_message(info);
        let location = info
            .location()
            .map(|value| format!("{}:{}:{}", value.file(), value.line(), value.column()))
            .unwrap_or_else(|| "unknown".to_string());

        error!(target: "panic", "{location}: {message}");

        if let Some(payload) = write_crash_log(Some(&app), &message, info) {
            let _ = emit_main_window_event(&app, "bento://crash", payload.clone());
        }

        thread::sleep(Duration::from_millis(200));
    }));
}

#[cfg(windows)]
fn configure_webview2_user_data_folder() {
    if env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_some() {
        return;
    }

    let base = env::var_os("LOCALAPPDATA")
.map(std::path::PathBuf::from)
        .unwrap_or_else(|| env::temp_dir());
    let folder = base.join("Bento").join("WebView2").join("User Data");

    if let Err(error) = fs::create_dir_all(&folder) {
        warn!(target: "startup", "failed to create WebView2 user data folder {}: {error}", folder.display());
        return;
    }

    env::set_var("WEBVIEW2_USER_DATA_FOLDER", &folder);
}

#[cfg(not(windows))]
fn configure_webview2_user_data_folder() {}

fn load_desktop_env() {
    let mut candidates = Vec::new();

    if let Ok(cwd) = env::current_dir() {
        candidates.push(cwd.join(".env"));
        candidates.push(cwd.join(".env.local"));
        candidates.push(cwd.join("apps").join("genesis-desktop").join(".env"));
        candidates.push(cwd.join("apps").join("genesis-desktop").join(".env.local"));
    }

    if let Ok(exe) = env::current_exe() {
        for ancestor in exe.ancestors() {
            candidates.push(ancestor.join(".env.local"));
            candidates.push(ancestor.join(".env"));
        }
    }

    for path in candidates {
        if !path.exists() {
            continue;
        }

        if dotenvy::from_path(&path).is_ok() {
            info!(target: "startup", "loaded env from {}", path.display());
            if env::var("VITE_SUPABASE_URL").is_ok() && env::var("VITE_SUPABASE_ANON_KEY").is_ok() {
                break;
            }
        }
    }
}

#[allow(dead_code)]
fn extract_deep_link(args: impl IntoIterator<Item = String>) -> Option<String> {
    args.into_iter().find(|value| value.starts_with("bento://"))
}

#[allow(dead_code)]
fn queue_deep_link(app: &AppHandle, pending: &PendingDeepLink, url: String) {
    pending.set(url.clone());
    let _ = emit_main_window_event(app, "bento://deep-link", url);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(dependency_on_unit_never_type_fallback)]
/// Maximum size for the startup log before truncation (1 MB).
const STARTUP_LOG_MAX_BYTES: u64 = 1_048_576;

/// Write a startup log line to a file in the temp directory.
/// This survives crashes because it doesn't depend on app_data_dir.
/// In production (no console), this is the only way to diagnose startup failures.
/// Log is capped at 1 MB; head is truncated (tail preserved) when limit exceeded.
fn write_startup_log(line: &str) {
    let log_dir = std::env::temp_dir().join("bento-desktop");
    let _ = std::fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("startup.log");
    let ts = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S%.3f");

    // Truncate if log exceeds 1 MB (keep last 512 KB)
    if let Ok(meta) = std::fs::metadata(&log_path) {
        if meta.len() > STARTUP_LOG_MAX_BYTES {
            let half = STARTUP_LOG_MAX_BYTES / 2;
            if let Ok(content) = std::fs::read_to_string(&log_path) {
                let chars: std::vec::Vec<char> = content.chars().collect();
                let start = chars.len().saturating_sub(half as usize);
                let trimmed: String = chars[start..].iter().collect();
                let _ = std::fs::write(&log_path, &trimmed);
            }
        }
    }

    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "[{ts}] {line}")
        });
}

// ────────────────────────────────────────────────────────────────────
// Startup Crash Recovery — Sentinel-based WebView2 profile recovery
// ────────────────────────────────────────────────────────────────────
//
// Pattern (used by Chrome, VS Code, Electron apps):
//   1. Write a sentinel file BEFORE WebView2 initialization
//   2. Delete the sentinel AFTER successful setup completes
//   3. On next launch, if sentinel exists → previous session crashed
//   4. Escalate recovery: delete WebView2 profile → nuke on loop
//
// This recovers from corrupted WebView2 user data, silent WebView2 init
// failures, and deadlock-on-start that bypass Rust's panic hook.

/// Startup sentinel written before WebView2 init, deleted after setup.
/// Existence on next launch = previous startup crashed.
const STARTUP_SENTINEL: &str = ".bento-startup-sentinel";

/// Consecutive crash counter file. Keeps track so we don't infinitely
/// attempt recovery. Reset to 0 on successful startup.
const CRASH_COUNTER: &str = ".bento-crash-count";

/// After this many consecutive crash detections, nuke the entire
/// WebView2 profile instead of just deleting the User Data folder.
const MAX_CRASH_LOOP: u32 = 3;

fn sentinel_path() -> PathBuf {
    std::env::temp_dir()
        .join("bento-desktop")
        .join(STARTUP_SENTINEL)
}

fn crash_counter_path() -> PathBuf {
    std::env::temp_dir()
        .join("bento-desktop")
        .join(CRASH_COUNTER)
}

fn read_crash_count() -> u32 {
    std::fs::read_to_string(crash_counter_path())
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}

fn write_crash_count(n: u32) {
    let p = crash_counter_path();
    let _ = std::fs::create_dir_all(
        p.parent()
            .expect("crash counter path must have a parent dir"),
    );
    let _ = std::fs::write(&p, n.to_string());
}

fn reset_crash_count() {
    write_crash_count(0);
}

/// Delete the WebView2 User Data folder. The folder is recreated
/// automatically by WebView2 on the next environment creation.
#[cfg(windows)]
fn delete_webview2_profile() {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| env::temp_dir());
    let folder = base.join("Bento").join("WebView2").join("User Data");

    if folder.exists() {
        info!(
            "[startup] removing corrupt WebView2 profile: {}",
            folder.display()
        );
        write_startup_log(&format!("removing WebView2 profile: {}", folder.display()));
        if let Err(e) = std::fs::remove_dir_all(&folder) {
            warn!("[startup] WARN: failed to remove WebView2 profile: {e}");
                write_startup_log(&format!("WARN: remove_dir_all failed: {e}"));
        } else {
            write_startup_log("WebView2 profile removed successfully");
        }
    }
}

#[cfg(not(windows))]
fn delete_webview2_profile() {}

/// Called at the very start of `run()`, before WebView2 init.
/// Checks the sentinel to detect previous startup crashes and
/// recovers by deleting the corrupt WebView2 profile.
fn recover_from_startup_crash() {
    let sentinel = sentinel_path();

    if sentinel.exists() {
        let count = read_crash_count() + 1;
        write_crash_count(count);

        info!("[startup] sentinel found — previous launch crashed (crash #{count})");
        write_startup_log(&format!("crash sentinel found (#{count})"));

        if count >= MAX_CRASH_LOOP {
            // Nuclear: nuke whole profile
            info!("[startup] crash loop detected ({count}+), nuking WebView2 profile");
            write_startup_log("crash loop — nuking WebView2 profile");
            delete_webview2_profile();
            RECOVERY_PERFORMED.store(true, Ordering::Release);
            reset_crash_count();
        } else if count > 1 {
            // Escalating: delete user data folder
            info!("[startup] deleting WebView2 profile for recovery (crash #{count})");
            write_startup_log(&format!("deleting WebView2 profile (crash #{count})"));
            delete_webview2_profile();
            RECOVERY_PERFORMED.store(true, Ordering::Release);
        }
        // First crash (count == 1): log only, no action yet.
        // The sentinel is from the previous attempt; the next init
        // may succeed as a transient failure.
    } else {
        reset_crash_count();
    }

    // Write current sentinel — will be deleted by clear_startup_sentinel()
    // after setup completes successfully.
    // Ensure the parent temp dir exists (write_startup_log creates it later,
    // but we need it now for the sentinel file).
    if let Some(parent) = sentinel.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&sentinel, std::process::id().to_string());
}

/// Called after setup completes successfully to clear the sentinel
/// and mark this startup as clean.
fn clear_startup_sentinel() {
    let _ = std::fs::remove_file(sentinel_path());
    reset_crash_count();
    write_startup_log("startup sentinel cleared");
}

/// Kill any stale bento-desktop processes from previous sessions that
/// were left running but invisible (zombie instances). Prevents the
/// single-instance plugin from silently blocking new launches.
fn cleanup_stale_processes() {
    let current_pid = std::process::id();
    let system = System::new_all();
    for (pid, process) in system.processes() {
        let pid_u32 = pid.as_u32();
        if pid_u32 == current_pid {
            continue;
        }
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("bento-desktop") || name.contains("bento_desktop") {
            info!("[startup] killing stale process PID={pid_u32} name={name}");
                write_startup_log(&format!("killing stale process PID={pid_u32}"));
            process.kill();
        }
    }
}

const CHATGPT_PROXY_PORT: u16 = 3001;

/// Spawn the ChatGPT proxy sidecar (compiled Express server) and wait
/// for it to become healthy using exponential backoff.
/// Stores the child handle for clean shutdown and detects process crashes
/// by polling the sidecar's event stream in a tokio::select! loop.
async fn spawn_chatgpt_proxy(app: AppHandle) -> Result<u16, String> {
    use tauri_plugin_shell::process::CommandEvent;

    let port = CHATGPT_PROXY_PORT;

    // ── Step 1: Check if port is already in use (stale proxy) ─────────
    if let Ok(resp) = reqwest::get(&format!("http://127.0.0.1:{port}/api/health")).await {
        if resp.status().is_success() {
            info!("[chatgpt] proxy already running on port {port}, reusing");
            let state = app.state::<crate::chatgpt_auth::ChatGptClient>();
            *state.server_url.lock().map_err(|e| format!("Lock: {e}"))? =
                Some(format!("http://127.0.0.1:{port}"));
            return Ok(port);
        }
    }

    // ── Step 2: Spawn the sidecar ───────────────────────────────────
    let sidecar = app
        .shell()
        .sidecar("chatgpt-proxy")
        .map_err(|e| format!("Failed to create sidecar command: {e}"))?;

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn ChatGPT proxy: {e}"))?;

    // Store the child handle so Drop kills it on exit
    let child_state = app.state::<crate::chatgpt_auth::ChatGptProxyChild>();
    *child_state.0.lock().map_err(|e| format!("Lock: {e}"))? = Some(child);

    // ── Step 3: Exponential backoff health check with crash detection ─
    let delays = [
        100, 100, 100, 100, 100,    // 5 × 100ms
        250, 250, 250, 250,          // 4 × 250ms
        500, 500, 500,                // 3 × 500ms
        1000, 1000, 1000, 1000, 1000, // 5 × 1s
    ];

    for (i, &delay_ms) in delays.iter().enumerate() {
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(delay_ms)) => {}
            event = rx.recv() => {
                let msg = match event {
                    Some(CommandEvent::Terminated(payload)) => {
                        format!("ChatGPT proxy exited with code {:?} before becoming healthy", payload.code)
                    }
                    Some(CommandEvent::Error(e)) => {
                        format!("ChatGPT proxy error: {e}")
                    }
                    _ => "ChatGPT proxy stream ended before becoming healthy".into(),
                };
                return Err(msg);
            }
        }

        let ok = reqwest::get(&format!("http://127.0.0.1:{port}/api/health"))
            .await
            .ok()
            .map_or(false, |r| r.status().is_success());
        if ok {
            let state = app.state::<crate::chatgpt_auth::ChatGptClient>();
            *state.server_url.lock().map_err(|e| format!("Lock: {e}"))? =
                Some(format!("http://127.0.0.1:{port}"));
            info!("[chatgpt] proxy ready (attempt {} after {delay_ms}ms)", i + 1);
            return Ok(port);
        }
    }

    Err("ChatGPT proxy failed to become healthy within timeout".into())
}

pub fn run() {
    tracing_subscriber::fmt::init();
    cleanup_stale_processes();
    recover_from_startup_crash();
    configure_webview2_user_data_folder();
    load_desktop_env();
    write_startup_log("Bento Desktop starting...");

    let mut builder = tauri::Builder::default()
        .manage(PendingDeepLink::default())
        .manage(DashboardCache::new())
        .manage(Arc::new(NoteFullCache::new()))
        .manage(Arc::new(HistoryRegistry::new()))
        .manage(ManagedTabSession::new())
        .manage(StartupDegraded::new())
        .manage(crate::chatgpt_auth::ChatGptClient::new())
        .manage(crate::chatgpt_auth::ChatGptProxyChild::new());

    #[cfg(not(debug_assertions))]
    {
        let window_state_plugin = tauri_plugin_window_state::Builder::new()
            .with_state_flags(StateFlags::all())
            .skip_initial_state("main")
            .skip_initial_state("island")
            .build();

        builder = builder.plugin(window_state_plugin);
    }

    #[cfg(all(desktop, not(debug_assertions)))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Focus and show the existing main window — handles the case where
            // the user double-clicks the exe but the first instance is already
            // running but invisible (e.g., hiding in background after a crash
            // or a start_hidden=true session).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.center();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            let pending = app.state::<PendingDeepLink>().inner().clone();
            if let Some(url) = extract_deep_link(argv) {
                queue_deep_link(app, &pending, url);
            }
        }));
    }

    builder = builder
        .register_uri_scheme_protocol("module", modules::module_protocol)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_liquid_glass::init());

    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    fn setup_data_dir(app: &AppHandle) -> PathBuf {
        match app.path().app_data_dir() {
            Ok(d) => d,
            Err(e) => {
                let fallback = std::env::temp_dir().join("bento-desktop").join("data");
                warn!("[init] WARN: app_data_dir failed ({e}), using {}", fallback.display());
                write_startup_log(&format!(
                    "app_data_dir failed, fallback: {}",
                    fallback.display()
                ));
                let _ = std::fs::create_dir_all(&fallback);
                fallback
            }
        }
    }

    builder = builder.setup(|app| {
        // ── Phase 0: Panic hook (always first) ──────────────────────────
        let mut t0 = Instant::now();
        install_runtime_panic_hook(app.handle().clone());

        let log_phase = |phase: &str, elapsed: &str| {
            let msg = format!("[init] {phase}  +{elapsed}ms");
            info!("{msg}");
                write_startup_log(&msg);
        };
        log_phase("phase=0 install_runtime_panic_hook", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Phase 1: App data directory (non-fatal — temp dir fallback) ─
        t0 = Instant::now();
        let data_dir = setup_data_dir(app.handle());
        write_startup_log(&format!("app_data_dir: {}", data_dir.display()));
        log_phase("phase=1 app_data_dir", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Phase 2: Pending restore (disabled — cloud backup not ready) ─

        // ── Phase 3: Load desktop settings + register shortcuts ────────
        t0 = Instant::now();
        let settings = settings::load_desktop_settings(app.handle());
        app.manage(DesktopRuntime::new(settings.clone()));
        if let Err(e) = settings::apply_configured_shortcuts(app.handle(), &settings) {
            warn!("[init] apply_configured_shortcuts failed: {e}");
                write_startup_log(&format!("apply_configured_shortcuts failed: {e}"));
        }
        log_phase("phase=3 load_desktop_settings", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Show main window early (before DB init, for perceived speed) ─
        // Uses set_resizable toggle as Tauri #11856 workaround for Windows
        // input death after showing a hidden window.
        if let Some(window) = app.get_webview_window("main") {
            if !settings.window.start_hidden {
                if let Err(e) = window.set_background_color(Some(tauri::webview::Color(23, 23, 23, 255))) {
                    warn!("[window] set_background_color failed: {e}");
}
                // Tauri #11856 workaround: toggle resizable AFTER show() to
                // prevent input death on Windows. Must happen before any IPC.
                if let Err(e) = window.show() {
                    warn!("[window] show() failed: {e}");
                    write_startup_log(&format!("window.show() failed: {e}"));
                } else {
                    // Tauri #11856: visible(false) + show() kills input on Windows.
                    // Toggling resizable re-enables it. Log failures for diagnostics.
                    if let Err(e) = window.set_resizable(false) {
                        warn!("[window] set_resizable(false) failed: {e}");
                        write_startup_log(&format!("set_resizable(false) failed: {e}"));
                    }
                    if let Err(e) = window.set_resizable(true) {
                        warn!("[window] set_resizable(true) failed: {e}");
                        write_startup_log(&format!("set_resizable(true) failed: {e}"));
                    }
                    // Force-center + focus — ensures window is visible on the
                    // active monitor even if window-state plugin or previous
                    // session left it off-screen or corrupt.
                    if let Err(e) = window.center() {
                        warn!("[window] center() failed: {e}");
                        write_startup_log(&format!("window.center() failed: {e}"));
                    } else {
                        write_startup_log("window.center() OK");
                    }
                    if let Err(e) = window.set_focus() {
                        warn!("[window] set_focus() failed: {e}");
                        write_startup_log(&format!("window.set_focus() failed: {e}"));
                    } else {
                        write_startup_log("window.set_focus() OK");
                    }
                    info!("[init] main window shown early (start_hidden=false)");
                    write_startup_log("window.show() + center + focus OK");
                }
            } else {
                info!("[init] start_hidden=true, deferring main window show");
}

            // ── IPC custom protocol fallback ──
            // Tauri 2.x uses a custom protocol (ipc://) for invoke calls.
            // On some WebView2 versions, fetch(ipc://...) hangs silently.
            // We rely on Tauri's built-in postMessage fallback (which activates
            // automatically when the custom protocol fails) — no need to
            // force-reject via eval interceptors.
            //
            // Note: the "forced ipc fallback" console warnings are harmless
            // diagnostics from Tauri internals during the fallback handshake.
        }

        // ── Dynamic Island overlay window ────────────────────────────
        t0 = Instant::now();
        if let Err(e) = crate::island::setup_island_window(app) {
            error!("[island] failed to setup island window (non-fatal): {e}");
            write_startup_log(&format!("setup_island_window failed: {e}"));
        }
        log_phase("phase=4 setup_island_window", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Agent dock window (always pre-created so set_agent_dock_enabled
        //     never triggers WebviewWindowBuilder::build() on a background
        //     thread — Windows Win32 thread affinity requires builder calls
        //     on the main thread). The window starts hidden; the setting
        //     controls whether show()/hide() is called later.
        t0 = Instant::now();
        if let Err(e) = crate::agent::setup_agent_window(app) {
            error!("[agent] failed to setup agent window (non-fatal): {e}");
            write_startup_log(&format!("setup_agent_window failed: {e}"));
        }
        log_phase("phase=5 setup_agent_window", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── System tray icon ─────────────────────────────────────────
        t0 = Instant::now();
        if settings.agent_dock_enabled {
            if let Err(e) = crate::agent::setup_tray(app) {
                error!("[agent] failed to setup tray icon (non-fatal): {e}");
                write_startup_log(&format!("setup_tray failed: {e}"));
            }
        } else {
            info!("[agent] tray disabled via settings, skipping");
}
        log_phase("phase=6 setup_tray", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Global shortcut: Ctrl+Shift+A → toggle agent ──
        // Registered even when agent dock is disabled so the shortcut always works.
        t0 = Instant::now();
        {
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyA);
            match app.global_shortcut().on_shortcut(
                shortcut,
                |app_handle: &AppHandle,
                 _shortcut: &Shortcut,
                 event: tauri_plugin_global_shortcut::ShortcutEvent| {
                    if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        return;
                    }
                    let _ = crate::agent::toggle_agent(app_handle.clone());
                },
            ) {
                Ok(_) => warn!("[shortcut] registered Ctrl+Shift+A for agent toggle"),
                Err(e) => {
                    info!("[shortcut] failed to register agent shortcut: {e}");
                write_startup_log(&format!("register agent shortcut failed: {e}"));
                }
            }
        }
        log_phase("phase=7 register_shortcut_agent_toggle", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Database (always succeeds — in-memory fallback on fatal error) ─
        t0 = Instant::now();
        let (db_writer, db_reader) = match tauri::async_runtime::block_on(db::init_db(app.handle())) {
            Ok((writer, reader)) => {
                info!("[init] phase=8 init_db OK (writer=1, reader=4)  +{:.2}ms", t0.elapsed().as_secs_f64() * 1000.0);
                write_startup_log(&format!("init_db OK (writer=1, reader=4)"));
                (writer, reader)
            }
            Err(error) => {
                let elapsed = t0.elapsed().as_secs_f64() * 1000.0;
                let msg = format!("init_db FAILED after {elapsed:.2}ms: {error}");
                info!("[init] {msg}");
                write_startup_log(&msg);
                // In-memory fallback: BentoAppState always needs a valid pool pair
                warn!("[init] using in-memory DB fallback (degraded mode)");
                write_startup_log("using in-memory DB fallback (degraded mode)");
                let _ = app.emit("bento://startup-degraded", serde_json::json!({
                    "reason": "db_init_failed",
                    "detail": &msg,
                }));
                if let Some(degraded) = app.try_state::<StartupDegraded>() {
                    degraded.mark(format!("DB init failed: {}", msg.lines().next().unwrap_or(&msg)));
                }
                match tauri::async_runtime::block_on(db::init_in_memory_db()) {
                    Ok((w, r)) => (w, r),
                    Err(fatal) => {
                        error!("[init] FATAL: in-memory DB also failed: {fatal}");
                write_startup_log(&format!("FATAL: in-memory DB also failed: {fatal}"));
                        return Err(std::io::Error::other(fatal).into());
                    }
                }
            }
        };
        app.manage(BentoAppState::new(db_writer, db_reader));

        // ── Agent memory tables (non-fatal) ──────────────────────────
        {
            let pool = app.state::<BentoAppState>().inner().db();
            if let Err(e) = tauri::async_runtime::block_on(crate::ai::agent_memory::ensure_tables(&pool)) {
                warn!("[ai] failed to create agent memory tables: {e}");
}
        }

        // ── Encryption service ────────────────────────────────────────
        t0 = Instant::now();
        let crypto = CryptoService::new(data_dir.clone());
        app.manage(crypto.clone());
        log_phase("phase=9 crypto_service", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Voice Engine audio state ────────────────────────────────
        t0 = Instant::now();
        {
            let audio_state = crate::audio::AudioState::new(
                data_dir.clone(),
                app.state::<BentoAppState>().inner().db(),
                Some(app.handle().clone()),
            );
            app.manage(audio_state);
        }
        log_phase("phase=10 audio_state", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Media player audio state ────────────────────────────────
        t0 = Instant::now();
        crate::media_player::init_audio_state();
        crate::media_player::setup_audio_monitoring(app.handle().clone());
        log_phase("phase=11 media_player", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Global shortcut: Ctrl+Shift+D → toggle island ──
        // Matches the AgentDock pattern: only fires on Pressed (not Released),
        // and toggles window visibility at the Rust level so the shortcut always
        // works even when the island was hidden (e.g., via settings toggle).
        t0 = Instant::now();
        {
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);
            match app
                .global_shortcut()
                .on_shortcut(shortcut, |handle: &AppHandle,
                 _shortcut: &Shortcut,
                 event: tauri_plugin_global_shortcut::ShortcutEvent| {
                    if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        return;
                    }
                    if let Some(window) = handle.get_webview_window("island") {
                        // Show/hide toggle like toggle_agent, not compact↔expanded.
                        // Use the atomic ISLAND_VISIBLE to avoid a blocking
                        // is_visible() WebView2 IPC call from the shortcut thread.
                        let is_visible = crate::island::ISLAND_VISIBLE
                            .load(std::sync::atomic::Ordering::SeqCst);
                        // Persist the setting so the island state survives restarts
                        let _ = crate::settings::update_desktop_settings(handle, |s| {
                            s.dynamic_island_enabled = !is_visible;
                        });
                        if is_visible {
                            let _ = window.hide();
                            crate::island::ISLAND_VISIBLE.store(false, std::sync::atomic::Ordering::SeqCst);
                        } else {
                            let _ = window.show();
                            crate::island::ISLAND_VISIBLE.store(true, std::sync::atomic::Ordering::SeqCst);
                            let _ = crate::island::position_top_center(&window);
                            let _ = window.emit("island:hide", ());
                        }
                    }
                }) {
                Ok(_) => warn!("[shortcut] registered Ctrl+Shift+D for island toggle"),
                Err(e) => {
                    info!("[shortcut] failed to register island shortcut: {e}");
                write_startup_log(&format!("register island shortcut failed: {e}"));
                }
            }
        }
        log_phase("phase=12 register_shortcut_island_toggle", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Search service (non-fatal — temp dir fallback) ──────────
        t0 = Instant::now();
        let search_base_dir = match app.path().app_data_dir() {
            Ok(d) => d,
            Err(e) => {
                warn!("[init] WARN: app_data_dir unavailable for search, using temp fallback: {e}");
                write_startup_log(&format!("search fallback: {e}"));
                std::env::temp_dir().join("bento-desktop").join("search")
            }
        };
        match SearchService::new(search_base_dir) {
            Ok(service) => {
                app.manage(service);
                log_phase("phase=13 search_service OK", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));
            }
            Err(e) => {
                let msg = format!("search_service FAILED on primary dir: {e}");
                info!("[init] {msg}");
                write_startup_log(&msg);
                // Retry with temp dir fallback so State<SearchService> never panics
                warn!("[init] search_service degraded (using temp fallback)");
                write_startup_log("search_service degraded (using temp fallback)");
                let _ = app.emit("bento://startup-degraded", serde_json::json!({
                    "reason": "search_fallback",
                    "detail": &msg,
                }));
                if let Some(degraded) = app.try_state::<StartupDegraded>() {
                    degraded.mark(format!("Search init failed: {}", msg.lines().next().unwrap_or(&msg)));
                }
                let fallback = std::env::temp_dir().join("bento-desktop").join("search-fallback");
                match SearchService::new(fallback) {
                    Ok(service) => {
                        warn!("[init] search_service OK on temp fallback");
                write_startup_log("search_service OK on temp fallback");
                        app.manage(service);
                    }
                    Err(e2) => {
                        error!("[init] search_service ALSO failed on temp fallback: {e2}");
                write_startup_log(&format!("search_service fallback also failed: {e2}"));
                    }
                }
                log_phase("phase=13 search_service fallback", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));
            }
        }

        // ── Auth manager (non-fatal — bundled fallback should always work) ─
        t0 = Instant::now();
        match AuthManager::new(data_dir.clone()) {
            Ok(am) => {
                app.manage(am);
                log_phase("phase=14 auth_manager OK", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));
            }
            Err(e) => {
                let msg = format!("auth_manager FAILED: {e}");
                info!("[init] {msg}");
                write_startup_log(&msg);
                log_phase("phase=14 auth_manager FAILED (skipped)", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));
            }
        }

        t0 = Instant::now();
        #[cfg(not(debug_assertions))]
        {
            #[cfg(any(windows, target_os = "linux"))]
            if let Err(error) = app.deep_link().register_all() {
                info!("deep-link registration skipped: {error}");
}

            let pending = app.state::<PendingDeepLink>().inner().clone();

            if let Ok(Some(urls)) = app.deep_link().get_current() {
                if let Some(url) = urls.first() {
                    queue_deep_link(app.handle(), &pending, url.as_str().to_string());
                }
            }

            let app_handle = app.handle().clone();
            let listener_pending = pending.clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().first() {
                    queue_deep_link(&app_handle, &listener_pending, url.to_string());
                }
            });

            if let Some(url) = extract_deep_link(std::env::args().collect::<Vec<_>>()) {
                queue_deep_link(app.handle(), &pending, url);
            }
        }
        log_phase("phase=15 production_deep_link_setup", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        // ── Agent core — state channel (additive, non-fatal) ────────
        t0 = Instant::now();
        crate::agent_core::setup(app.handle());
        log_phase("phase=16 agent_core_setup", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        t0 = Instant::now();
        crate::scheduler::spawn_scheduler_worker(
            app.state::<BentoAppState>().inner().clone(),
            app.handle().clone(),
        );

        // spawn_cloud_backup_worker(app.handle().clone());

        crate::sleep::spawn_last_active_tracker();
        crate::sleep::spawn_sleep_monitor(app.handle().clone());

        // Clipboard tables + monitor
        let clipboard_pool = app.state::<BentoAppState>().inner().db();
        if let Err(e) = tauri::async_runtime::block_on(crate::clipboard::ensure_clipboard_tables(
            &clipboard_pool,
        )) {
            warn!("[clipboard] failed to ensure clipboard tables: {e}");
}
        crate::clipboard::spawn_clipboard_monitor(app.handle().clone());

        // ── Agent action log table (moved to DB init later, but ensure here too) ─
        {
            let pool = app.state::<BentoAppState>().inner().db();
            if let Err(e) = tauri::async_runtime::block_on(
                crate::agent_core::action_gate::ensure_action_log_table(&pool),
            ) {
                warn!("[agent_core] failed to create action_log table: {e}");
}
        }

        // ── Spawn MCP Streamable HTTP server ────────────────────────────
        {
            let pool = app.state::<BentoAppState>().inner().db();
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match crate::mcp::spawn_mcp_server(app_handle, pool).await {
                    Ok((port, _)) => {
                        info!("[mcp] MCP server started on port {port}");
}
                    Err(e) => {
                        error!("[mcp] Failed to start MCP server: {e}");
}
                }
            });
        }
        // ── Spawn ChatGPT proxy sidecar ───────────────────────────────
        {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match spawn_chatgpt_proxy(app_handle).await {
                    Ok(port) => info!("[chatgpt] proxy sidecar running on port {port}"),
                    Err(e) => warn!("[chatgpt] failed to start proxy sidecar: {e}"),
                }
            });
        }
        log_phase("phase=17 background_workers", &format!("{:.2}", t0.elapsed().as_secs_f64() * 1000.0));

        write_startup_log("setup complete — app is running");
        info!("[init] phase=18 setup_complete");
// Startup sentinel: mark as clean so crash recovery knows
        // the next boot wasn't a crash.
        clear_startup_sentinel();

        // If we recovered from a startup crash, notify the frontend
        // via the existing StartupDegraded mechanism so it can show
        // a toast or notification to the user.
        if RECOVERY_PERFORMED.swap(false, Ordering::AcqRel) {
            info!("[init] startup crash recovery was performed");
                write_startup_log("startup crash recovery was performed — WebView2 profile reset");
            if let Some(degraded) = app.try_state::<StartupDegraded>() {
                degraded.mark(
                    "WebView2 profile was reset due to a startup crash. Some site data may have been lost."
                        .to_string(),
                );
            }
            // Emit event for frontend to show a toast/notification
            let _ = app.emit(
                "bento://startup-degraded",
                serde_json::json!({
                    "reason": "webview2_crash_recovery",
                    "detail": "WebView2 profile was reset due to a startup crash. Some site data may have been lost.",
                }),
            );
        }

        Ok(())
    });

    builder
        .invoke_handler(tauri::generate_handler![
            crate::ping::ping,
            load_desktop_settings,
            save_desktop_settings,
            // get_state,
            // test_connection,
            // backup_now,
            // restore_backup,
            // delete_backup,
            // get_key_state,
            // set_service_role_key,
            // clear_service_role_key,
            backup_desktop_settings,
            restore_desktop_settings_backup,
            write_debug_log,
            pick_export_directory,
            pick_transcription_model,
            save_export_manifest,
            get_lifecycle_state,
            begin_background_task,
            finish_background_task,
            restore_window,
            quit_app,
            clear_webview_browsing_data,
            get_dashboard_data,
            get_focus_dashboard,
            get_module_context,
            save_module_context,
            flush_module_state,
            get_module_fonts,
            set_module_fonts,
            export_content_to_file,
            pick_import_file,
            create_quick_task,
            enforce_auth_user_boundary,
            get_active_module,
            set_active_module,
            get_installed_modules,
            fetch_module_registry,
            get_module_settings,
            set_module_settings,
            register_local_module,
            install_module,
            uninstall_module,
            // MCP Streamable HTTP Server
            crate::mcp::get_mcp_connection_info,
            crate::search::service::index_content,
            crate::search::service::search_in_module,
            crate::search::service::rebuild_index,
            crate::search::service::delete_from_index,
            consume_pending_deep_link,
            // Anytype-style local store
            crate::local_store::operations::local_store_block_add,
            crate::local_store::operations::local_store_block_update,
            crate::local_store::operations::local_store_block_delete,
            crate::local_store::operations::local_store_block_move,
            crate::local_store::operations::local_store_block_split,
            crate::local_store::operations::local_store_block_merge,
            crate::local_store::operations::local_store_get_blocks,
            crate::local_store::operations::local_store_get_block_children,
            crate::local_store::operations::local_store_create_object,
            crate::local_store::operations::local_store_get_object,
            crate::local_store::operations::local_store_get_objects,
            crate::local_store::operations::local_store_update_object,
            crate::local_store::operations::local_store_delete_object,
            crate::local_store::operations::local_store_search_objects,
            crate::local_store::operations::local_store_get_recent_objects,
            crate::local_store::operations::local_store_get_favorite_objects,
            crate::local_store::operations::local_store_toggle_favorite,
            crate::local_store::operations::local_store_set_relation,
            crate::local_store::operations::local_store_get_relations,
            crate::local_store::operations::local_store_get_objects_by_relation,
            crate::local_store::operations::local_store_delete_relation,
            // Notes Anytype-heart CRUD port
            crate::notes::commands::notes_object_create,
            crate::notes::commands::notes_object_get,
            crate::notes::commands::notes_object_full,
            crate::notes::commands::notes_list,
            crate::notes::commands::notes_object_update,
            crate::notes::commands::notes_object_delete,
            crate::notes::commands::notes_object_duplicate,
            crate::notes::commands::notes_block_create,
            crate::notes::commands::notes_block_unlink,
            crate::notes::commands::notes_block_split,
            crate::notes::commands::notes_block_merge,
            crate::notes::commands::notes_block_replace,
            crate::notes::commands::notes_block_duplicate,
            crate::notes::commands::notes_block_move,
            crate::notes::commands::notes_set_text_content,
            crate::notes::commands::notes_set_text_style,
            crate::notes::commands::notes_set_text_checked,
            crate::notes::commands::notes_set_text_color,
            crate::notes::commands::notes_set_text_mark,
            crate::notes::commands::notes_clear_text_style,
            crate::notes::commands::notes_clear_text_content,
            crate::notes::commands::notes_set_background_color,
            crate::notes::commands::notes_set_align,
            crate::notes::commands::notes_turn_into,
            crate::notes::commands::notes_set_layout,
            crate::notes::commands::notes_set_block_fields,
            crate::notes::commands::notes_undo,
            crate::notes::commands::notes_redo,
            crate::notes::commands::notes_set_icon,
            crate::notes::commands::notes_get_blocks,
            crate::notes::commands::notes_search,
            crate::notes::commands::notes_get_backlinks,
            crate::notes::commands::notes_find_by_title,
            crate::notes::commands::notes_search_by_title,
            crate::notes::commands::notes_index_wikilinks,
            crate::notes::commands::notes_daily_note,
            crate::notes::commands::notes_templates_list,
            crate::notes::commands::notes_template_create,
            crate::notes::commands::notes_create_from_template,
            crate::notes::commands::notes_tags_list,
            crate::notes::commands::notes_tags_rename,
            crate::notes::commands::notes_tags_delete,
            crate::auth::bootstrap_auth_state,
            crate::auth::get_auth_bootstrap_state,
            crate::auth::check_auth_session,
            crate::auth::begin_google_auth,
            crate::auth::set_session_from_deep_link,
            crate::auth::prepare_login_window,
            crate::auth::prepare_shell_window,
            crate::auth::sign_out,
            crate::auth::open_external_url,
            crate::auth::get_billing_profile,
            crate::auth::get_billing_profile_cached,
            crate::auth::force_refresh_billing,
            crate::auth::finalize_subscription,
            crate::auth::get_module_required_tier,
            // AI — Completion & streaming commands
            crate::ai::ai_complete,
            crate::ai::ai_stream,
            crate::ai::list_ai_models,
            crate::ai::get_ai_provider_status,
            // AI — Multi-turn chat with tool calling
            crate::ai::ai_chat_stream,
            crate::ai::ai_chat_complete,
            // AI — Agent conversation memory
            crate::ai::ai_conversation_list,
            crate::ai::ai_conversation_get,
            crate::ai::ai_conversation_delete,
            crate::ai::ai_conversation_save,
            crate::ai::ai_conversation_rename,
            crate::ai::ai_conversation_search,
            // AI — Tool definitions
            crate::ai::ai_tools_list,
            // BYOK — Bring Your Own Key
            crate::byok::commands::byok_save_key,
            crate::byok::commands::byok_get_key_preview,
            crate::byok::commands::byok_list_providers,
            crate::byok::commands::byok_delete_key,
            crate::byok::commands::byok_test_connection,
            crate::byok::commands::byok_get_settings,
            crate::byok::commands::byok_update_settings,
            crate::byok::commands::byok_toggle_enabled,
            crate::byok::commands::byok_dismiss_onboarding,
            crate::byok::commands::byok_validate_key,
            // ChatGPT — Sign in with ChatGPT
            crate::chatgpt_auth::commands::chatgpt_start_device_flow,
            crate::chatgpt_auth::commands::chatgpt_check_device_flow,
            crate::chatgpt_auth::commands::chatgpt_get_session,
            crate::chatgpt_auth::commands::chatgpt_sign_out,
            crate::chatgpt_auth::commands::chatgpt_test_connection,
            // Clipboard Manager
            crate::clipboard::clipboard_list,
            crate::clipboard::clipboard_get,
            crate::clipboard::clipboard_save,
            crate::clipboard::clipboard_pin,
            crate::clipboard::clipboard_favorite,
            crate::clipboard::clipboard_copy,
            crate::clipboard::clipboard_toggle_pin,
            crate::clipboard::clipboard_toggle_favorite,
            crate::clipboard::clipboard_delete,
            crate::clipboard::clipboard_delete_batch,
            crate::clipboard::clipboard_clear_unpinned,
            crate::clipboard::clipboard_clear_all,
            crate::clipboard::clipboard_search,
            crate::clipboard::clipboard_count,
            crate::clipboard::clipboard_expire_sensitive,
            crate::clipboard::clipboard_gc,
            crate::clipboard::clipboard_get_image_data,
            crate::clipboard::clipboard_get_image_path,
            crate::clipboard::clipboard_get_image_paths,
            crate::clipboard::clipboard_inject_stress,
            // Budget — Intelligent Budget Planner
            crate::budget::budget_list_categories,
            crate::budget::budget_suggest_limits,
            crate::budget::budget_set_category_budget,
            crate::budget::budget_add_transaction,
            crate::budget::budget_list_transactions,
            crate::budget::budget_delete_transaction,
            crate::budget::budget_update_transaction,
            crate::budget::budget_add_bill,
            crate::budget::budget_list_bills,
            crate::budget::budget_toggle_bill_paid,
            crate::budget::budget_delete_bill,
            crate::budget::budget_add_ai_cost,
            crate::budget::budget_list_ai_costs,
            crate::budget::budget_ai_cost_summary,
            crate::budget::budget_delete_ai_cost,
            crate::budget::budget_monthly_overview,
            crate::budget::budget_financial_health,
            crate::budget::budget_cash_flow_forecast,
            crate::budget::budget_cross_module_spending,
            crate::budget::budget_save_template,
            crate::budget::budget_list_templates,
            crate::budget::budget_delete_template,
            crate::budget::budget_forecast_chart_data,
            crate::budget::budget_export_pdf,
            crate::budget::budget_export_csv,
            // Audio recording & playback
            crate::audio::start_recording,
            crate::audio::stop_recording,
            crate::audio::pause_recording,
            crate::audio::resume_recording,
            crate::audio::get_recording_status,
            crate::audio::get_current_session,
            crate::audio::list_audio_devices,
            crate::audio::list_recordings,
            crate::audio::delete_recording,
            crate::audio::update_recording_title,
            crate::audio::playback_start,
            crate::audio::playback_pause,
            crate::audio::playback_resume,
            crate::audio::playback_stop,
            crate::audio::playback_is_playing,
            crate::audio::cancel_recording,
            crate::audio::retry_recording,
            crate::audio::check_microphone_permission,
            crate::audio::transcribe_recording,
            // Media player
            crate::media_player::get_now_playing,
            crate::media_player::get_audio_levels,
            crate::media_player::media_play_pause,
            crate::media_player::media_next_track,
            crate::media_player::media_previous_track,
            crate::media_player::media_seek,
            crate::media_player::activate_media_app,
            // Scheduler
            crate::scheduler::create_schedule,
            crate::scheduler::update_schedule,
            crate::scheduler::delete_schedule,
            crate::scheduler::get_schedules,
            crate::scheduler::get_due_schedules,
            // Notifications
            crate::notifications::send_module_notification,
            crate::notifications::dismiss_notification,
            crate::notifications::snooze_notification,
            crate::notifications::get_notification_history,
            // Health tracker
            crate::health::health_log_save,
            crate::health::health_log_today,
            crate::health::health_logs_week,
            crate::health::health_vitals_save,
            crate::health::health_vitals_list,
            crate::health::health_meds_list,
            crate::health::health_med_add,
            crate::health::health_med_toggle,
            crate::health::health_med_delete,
            // Mood tracker
            crate::mood::mood_checkin_save,
            crate::mood::mood_checkins_today,
            crate::mood::mood_checkins_month,
            crate::mood::mood_checkins_recent,
            crate::mood::mood_checkin_delete,
            crate::mood::mood_stats,
            crate::mood::mood_activity_library,
            crate::mood::mood_activity_add,
            crate::mood::mood_activity_delete,
            crate::mood::mood_patterns,
            crate::mood::mood_private_note_save,
            crate::mood::mood_private_notes_list,
            crate::mood::mood_private_note_delete,

            // Sleep — session system (OS + manual)
            crate::sleep::get_sleep_sessions,
            crate::sleep::get_last_night,
            crate::sleep::get_sleep_goal,
            crate::sleep::update_sleep_goal,
            crate::sleep::add_manual_sleep_session,
            crate::sleep::delete_sleep_session,
            crate::sleep::confirm_sleep_session,
            crate::sleep::get_sleep_stats,
            // Sleep — legacy manual logs
            crate::sleep::sleep_log_save,
            crate::sleep::sleep_log_save_for_date,
            crate::sleep::sleep_log_today,
            crate::sleep::sleep_log_get,
            crate::sleep::sleep_logs_week,
            crate::sleep::sleep_logs_recent,
            crate::sleep::sleep_log_delete,
            // Sleep — legacy routines
            crate::sleep::sleep_routine_list,
            crate::sleep::sleep_routine_save,
            crate::sleep::sleep_routine_delete,
            crate::sleep::sleep_routine_reorder,
            crate::sleep::sleep_routine_status,
            crate::sleep::sleep_routine_toggle,
            // Sleep — legacy alarms
            crate::sleep::sleep_alarm_list,
            crate::sleep::sleep_alarm_save,
            crate::sleep::sleep_alarm_delete,
            crate::sleep::sleep_alarm_toggle,
            // Countdown — events, milestones, birthdays
            crate::commands::countdown::countdown_list_events,
            crate::commands::countdown::countdown_save_event,
            crate::commands::countdown::countdown_delete_event,
            crate::commands::countdown::countdown_list_milestones,
            crate::commands::countdown::countdown_save_milestone,
            crate::commands::countdown::countdown_update_milestone_progress,
            crate::commands::countdown::countdown_delete_milestone,
            crate::commands::countdown::countdown_list_birthdays,
            crate::commands::countdown::countdown_save_birthday,
            crate::commands::countdown::countdown_delete_birthday,
            // Nutrition — hydration, meals, macros, goals, reminders
            crate::commands::nutrition::nutrition_log_water,
            crate::commands::nutrition::nutrition_get_today_water,
            crate::commands::nutrition::nutrition_reset_water,
            crate::commands::nutrition::nutrition_get_weekly_water,
            crate::commands::nutrition::nutrition_log_meal,
            crate::commands::nutrition::nutrition_get_today_meals,
            crate::commands::nutrition::nutrition_get_meals_for_date,
            crate::commands::nutrition::nutrition_delete_meal,
            crate::commands::nutrition::nutrition_add_food_to_meal,
            crate::commands::nutrition::nutrition_get_goals,
            crate::commands::nutrition::nutrition_update_goals,
            crate::commands::nutrition::nutrition_get_today_summary,
            crate::commands::nutrition::nutrition_get_macro_totals,
            crate::commands::nutrition::nutrition_get_reminders,
            crate::commands::nutrition::nutrition_save_reminder,
            crate::commands::nutrition::nutrition_delete_reminder,
            crate::commands::nutrition::nutrition_toggle_reminder,
            crate::commands::nutrition::nutrition_get_hydration_stats,
            crate::commands::nutrition::nutrition_export_data,

            // Habits — Habit Tracker
            crate::habits::habits_list,
            crate::habits::habits_save,
            crate::habits::habits_delete,
            crate::habits::habits_toggle_complete,
            crate::habits::habits_increment,
            crate::habits::habits_get_stats,
            crate::habits::habits_export_csv,
            crate::habits::habits_get_freeze_state,
            crate::habits::habits_save_freeze_state,
            crate::habits::habits_skip_today,
            crate::habits::habits_unskip_today,
            crate::habits::habits_freeze_streak,
            crate::habits::habits_unfreeze_streak,
            // Goals — Goal Tracker
            crate::goals::goals_list,
            crate::goals::goals_save,
            crate::goals::goals_delete,
            crate::goals::goals_progress_update,
            crate::goals::goal_subtasks_list,
            crate::goals::goal_subtask_save,
            crate::goals::goal_subtask_toggle,
            crate::goals::goal_add_review,
            crate::goals::goal_reviews_list,
            crate::goals::goals_toggle_big_3,
            crate::goals::focus_areas_list,
            crate::goals::focus_area_save,
            crate::goals::focus_area_delete,

            // Tab session
            crate::session::tab_open,
            crate::session::tab_close,
            crate::session::tab_switch,
            crate::session::tab_set_foreground,
            crate::session::tab_list,
            crate::session::tab_get_foreground,
            crate::session::tab_get,
            crate::session::tab_is_module_open,
            crate::session::tab_restore,
            crate::session::tab_handle_sync_event,
            // Journal
            crate::commands::journal::create_journal_entry,
            crate::commands::journal::save_journal_entry,
            crate::commands::journal::get_journal_entry,
            crate::commands::journal::list_journal_entries,
            crate::commands::journal::delete_journal_entry,
            // Tasks
            crate::commands::tasks::save_task,
            crate::commands::tasks::update_task,
            crate::commands::tasks::toggle_task,
            crate::commands::tasks::get_task,
            crate::commands::tasks::list_tasks,
            crate::commands::tasks::get_task_count,
            crate::commands::tasks::delete_task,
            crate::commands::tasks::log_activity_entry,
            crate::commands::tasks::list_activity_for_task,
            crate::commands::tasks::archive_task,
            crate::commands::tasks::duplicate_task,
            crate::commands::tasks::save_subtask,
            crate::commands::tasks::delete_subtask,
            crate::commands::tasks::list_subtasks_for_task,
            crate::commands::tasks::update_subtask_status,
            crate::commands::tasks::reorder_tasks,
            record_focus_session,
            export_focus_sessions,
            // Passwords Vault (E2EE SQLCipher)
            crate::commands::passwords::passwords_list,
            crate::commands::passwords::passwords_get,
            crate::commands::passwords::passwords_search,
            crate::commands::passwords::passwords_save,
            crate::commands::passwords::passwords_delete,
            crate::commands::passwords::passwords_migrate_from_storage,
            // AI Features Prefs (persisted via settings.json)
            crate::settings::commands::load_ai_features_prefs,
            crate::settings::commands::save_ai_features_prefs,
            // Language & Region
            crate::settings::commands::get_active_language,
            crate::settings::commands::set_interface_language,
            crate::settings::commands::get_supported_languages,
            // Share — central middle layer
            crate::share::share_content,
            crate::share::share_markdown,
            crate::share::share_json_to_file,
            crate::share::share_csv_to_file,
            // Feedback & Bug Reports
            submit_feedback,
            get_my_feedback,
            get_feedback_by_id,
            get_feedback_realtime_config,
            // Database encryption
            crate::crypto_commands::crypto_get_status,
            crate::crypto_commands::crypto_setup_master_password,
            crate::crypto_commands::crypto_unlock_database,
            crate::crypto_commands::crypto_lock_database,
            crate::crypto_commands::crypto_change_master_password,
            crate::crypto_commands::crypto_migrate_unencrypted_db,
            crate::crypto_commands::crypto_create_backup,
            crate::window_effects::set_window_glass,
            // Agent dock
            crate::agent::toggle_agent,
            crate::agent::show_agent,
            crate::agent::hide_agent,
            crate::agent::agent_start_drag,
            crate::agent::agent_set_size,
            crate::agent::focus_main_from_agent,
            crate::agent::capture_screen,
            // Voice Engine
            crate::commands::voice::voice_start,
            crate::commands::voice::voice_stop,
            crate::commands::voice::voice_pause,
            crate::commands::voice::voice_resume,
            crate::commands::voice::voice_cancel,
            // Voice Engine — Transcription & Dictation
            crate::commands::transcription::voice_paste_dictation,
            crate::commands::transcription::voice_save_note,
            crate::commands::transcription::voice_get_note,
            // Dictation post-processing (styles, filler stripping, agent detection)
            crate::commands::voice::dictation_process,
            crate::commands::voice::dictation_detect_agent,
            // Dynamic Island
            crate::island::toggle_island,
            crate::island::show_island,
            crate::island::hide_island,
            crate::island::island_compact,
            crate::island::island_expand,
            crate::island::island_start_drag,
            crate::island::island_set_ignore_cursor_events,
            crate::island::set_island_enabled,
            crate::agent::set_agent_dock_enabled,
            crate::island::focus_main_window,
            get_startup_degraded_state,
            // Agent Core — Action Layer (deep exposure)
            crate::agent_core::action_gate::confirm_agent_action,
            crate::agent_core::action_gate::cancel_agent_action,
            crate::agent_core::action_gate::get_agent_action_log,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| {
            let msg = format!("FATAL: Tauri run failed: {error}");
            info!("[startup] {msg}");
                write_startup_log(&msg);
            std::process::exit(1);
        });
}
