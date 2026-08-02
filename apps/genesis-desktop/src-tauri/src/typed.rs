// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.
//!
//! Typesafe IPC bridge (Rust -> TypeScript) built on `tauri-specta` + `specta`.
//!
//! The [`Builder`] here is used in two independent ways:
//! - [`export_bindings`] regenerates `src/lib/bindings.ts` (env-gated) for the frontend.
//! - The same command/event set is registered at runtime so the app keeps working.
//!
//! IMPORTANT: the runtime `tauri::generate_handler![...]` in `lib.rs` remains the
//! source of truth until every command there is also present in `collect_commands!`
//! below. Never register a command here that isn't annotated `#[specta::specta]`.

use serde::Serialize;
use specta::Type;
use specta_typescript::Typescript;
use tauri_specta::{Builder, Event};

// ───────────────────────────────────────────────────────────────────
// Events
// ───────────────────────────────────────────────────────────────────
// Each compiled event carries its real payload type so the frontend's
// `listen`/`emit` helpers are fully typed.

#[derive(Clone, Debug, Serialize, Type, Event)]
#[tauri_specta(event_name = "bento://lifecycle")]
pub struct LifecycleEvent(crate::runtime::LifecycleState);

#[derive(Clone, Debug, Serialize, Type, Event)]
#[tauri_specta(event_name = "app:locked")]
pub struct AppLockedEvent;

#[derive(Clone, Debug, Serialize, Type, Event)]
#[tauri_specta(event_name = "bento://startup-degraded")]
pub struct StartupDegradedEvent {
    reason: String,
    detail: Option<String>,
}

/// Commands collected for Specta export + runtime registration.
///
/// NOTE: expand this list as more commands are annotated with `#[specta::specta]`.
pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            crate::ping::ping,
            crate::commands::get_lifecycle_state,
            crate::commands::quit_app,
            crate::commands::write_debug_log,
            crate::commands::pick_export_directory,
            crate::commands::clear_webview_browsing_data,
            crate::commands::finish_background_task,
            crate::commands::consume_pending_deep_link,
            crate::commands::begin_background_task,
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
        ])
        .events(tauri_specta::collect_events![
            crate::typed::LifecycleEvent,
            crate::typed::AppLockedEvent,
            crate::typed::StartupDegradedEvent,
        ])
}

/// Regenerate `src/lib/bindings.ts`. Gated behind `BENTO_GEN_BINDINGS=1`
/// so production/CI builds use the committed file instead of rewriting it.
pub fn export_bindings() -> Result<(), String> {
    if std::env::var_os("BENTO_GEN_BINDINGS").is_none() {
        return Ok(());
    }
    let builder = builder();
    builder
        .export(Typescript::default(), "../src/lib/bindings.ts")
        .map_err(|e| format!("web failed to export TypeScript bindings: {e}"))
}

#[cfg(test)]
mod regeneration {
    use super::*;

    #[test]
    fn regenerate_typescript_bindings() {
        builder()
            .export(Typescript::default(), "../src/lib/bindings.ts")
            .expect("failed to export TypeScript bindings");
    }
}