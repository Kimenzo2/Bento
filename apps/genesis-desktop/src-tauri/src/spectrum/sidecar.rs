// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::sync::mpsc;
use tracing::info;

use super::{SpectrumSidecarChild, SpectrumStdinWriter};

pub async fn spawn_spectrum_sidecar(app: AppHandle) -> Result<(), String> {
    let settings = crate::settings::current_settings(&app);
    if !settings.social_agents.enabled {
        info!("[spectrum] social agents disabled, skipping sidecar");
        return Ok(());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;

    let sidecar = app
        .shell()
        .sidecar("bento-spectrum")
        .map_err(|e| format!("create sidecar: {e}"))?
        .args(["--app-data-dir", &app_data_dir.to_string_lossy()]);

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("spawn: {e}"))?;

    let child_state = app.state::<SpectrumSidecarChild>();
    *child_state.0.lock().map_err(|e| format!("lock: {e}"))? = Some(child);

    let (stdin_tx, mut stdin_rx) = mpsc::unbounded_channel::<String>();
    let writer_state = app.state::<SpectrumStdinWriter>();
    *writer_state.0.lock().map_err(|e| format!("lock: {e}"))? = Some(stdin_tx);

    let child_for_stdin = child_state.0.clone();
    tokio::spawn(async move {
        while let Some(line) = stdin_rx.recv().await {
            if let Ok(mut guard) = child_for_stdin.lock() {
                if let Some(child) = guard.as_mut() {
                    let payload = format!("{line}\n");
                    let _ = child.write(payload.as_bytes());
                }
            }
        }
    });

    let app_clone = app.clone();
    tokio::spawn(async move {
        use crate::spectrum::handler::handle_sidecar_events;
        handle_sidecar_events(app_clone, &mut rx).await;
    });

    info!("[spectrum] sidecar started");
    Ok(())
}
