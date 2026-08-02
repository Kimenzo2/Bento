// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use std::{fs, panic::PanicHookInfo, thread, time::Duration};

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::runtime::DesktopRuntime;

#[derive(Clone, Serialize)]
pub struct CrashPayload {
    pub message: String,
    pub log_path: String,
    pub timestamp: String,
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

pub fn write_crash_log(
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

fn telemetry_endpoint() -> Option<String> {
    std::env::var("BENTO_DESKTOP_TELEMETRY_ENDPOINT")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn try_upload_crash_report(app: &AppHandle, payload: &CrashPayload) {
    let Some(endpoint) = telemetry_endpoint() else {
        return;
    };

    let Some(runtime) = app.try_state::<DesktopRuntime>() else {
        return;
    };

    let settings = runtime.settings();
    if !(settings.telemetry.consented && settings.telemetry.crash_reports) {
        return;
    }

    let payload = payload.clone();
    thread::spawn(move || {
        let body = serde_json::json!({
            "kind": "crash",
            "timestamp": payload.timestamp,
            "message": payload.message,
            "logPath": payload.log_path,
        });
        let body = body.to_string();

        let _ = ureq::post(&endpoint)
            .content_type("application/json")
            .send(body);
    });
}

pub fn install_panic_bootstrap() {
    std::panic::set_hook(Box::new(|info| {
        let message = panic_message(info);
        let _ = write_crash_log(None, &message, info);
    }));
}

pub fn install_runtime_panic_hook(app: AppHandle) {
    std::panic::set_hook(Box::new(move |info| {
        let message = panic_message(info);

        if let Some(payload) = write_crash_log(Some(&app), &message, info) {
            let _ = try_emit_crash_event(&app, &payload);
            try_upload_crash_report(&app, &payload);
        }

        thread::sleep(Duration::from_millis(200));
    }));
}

fn try_emit_crash_event(app: &AppHandle, payload: &CrashPayload) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.emit("bento://crash", payload.clone())?;
    }

    Ok(())
}
