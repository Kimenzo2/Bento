// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use super::{try_get_stdin_writer, SpectrumSidecarChild};

#[derive(specta::Type, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SocialAgentApplyResult {
    pub success: bool,
    pub sidecar_running: bool,
    pub message: String,
}

#[specta::specta]
#[tauri::command]
pub async fn apply_social_agent_config(app: AppHandle) -> Result<SocialAgentApplyResult, String> {
    let settings = crate::settings::current_settings(&app);

    if !settings.social_agents.enabled {
        return Ok(SocialAgentApplyResult {
            success: true,
            sidecar_running: false,
            message: "Social Agents are disabled. Enable them in settings to start the sidecar."
                .to_string(),
        });
    }

    let platforms = &settings.social_agents.platforms;
    let active_count = platforms.values().filter(|p| p.enabled && p.token.is_some()).count();
    let has_any_token = platforms.values().any(|p| p.token.is_some());

    if !has_any_token {
        return Ok(SocialAgentApplyResult {
            success: true,
            sidecar_running: false,
            message: "No platform tokens configured. Add at least one bot token to connect."
                .to_string(),
        });
    }

    let child_state = app.state::<SpectrumSidecarChild>();
    let sidecar_running = child_state.0.lock().map_err(|e| e.to_string())?.is_some();

    if let Some(writer) = try_get_stdin_writer(&app) {
        let config_msg = serde_json::json!({
            "type": "config",
            "enabled": true,
            "projectId": settings.social_agents.project_id,
            "projectSecret": settings.social_agents.project_secret,
            "platforms": platforms,
        });
        writer
            .send(config_msg.to_string())
            .map_err(|e| format!("failed to send config to sidecar: {e}"))?;
        info!("[spectrum] config sent to running sidecar ({active_count} platform(s))");

        return Ok(SocialAgentApplyResult {
            success: true,
            sidecar_running: true,
            message: format!(
                "Config sent to sidecar. {} platform(s) configured.",
                active_count
            ),
        });
    }

    if !sidecar_running {
        info!("[spectrum] sidecar not running, starting it now");
        match super::sidecar::spawn_spectrum_sidecar(app.clone()).await {
            Ok(_) => Ok(SocialAgentApplyResult {
                success: true,
                sidecar_running: true,
                message: format!(
                    "Sidecar started with {} platform(s).",
                    active_count
                ),
            }),
            Err(e) => {
                warn!("[spectrum] failed to start sidecar: {e}");
                Ok(SocialAgentApplyResult {
                    success: false,
                    sidecar_running: false,
                    message: format!("Failed to start sidecar: {e}"),
                })
            }
        }
    } else {
        warn!("[spectrum] sidecar registered but stdin writer gone — killing stale child and restarting");
        if let Ok(mut guard) = child_state.0.lock() {
            if let Some(child) = guard.take() {
                let pid = child.pid();
                let _ = child.kill();
                #[cfg(windows)]
                {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }
        }
        match super::sidecar::spawn_spectrum_sidecar(app.clone()).await {
            Ok(_) => Ok(SocialAgentApplyResult {
                success: true,
                sidecar_running: true,
                message: format!(
                    "Sidecar restarted with {} platform(s).",
                    active_count
                ),
            }),
            Err(e) => {
                warn!("[spectrum] failed to restart sidecar: {e}");
                Ok(SocialAgentApplyResult {
                    success: false,
                    sidecar_running: false,
                    message: format!("Failed to restart sidecar: {e}"),
                })
            }
        }
    }
}