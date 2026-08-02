// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

pub mod commands;
pub mod handler;
pub mod sidecar;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::mpsc;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SocialAgentsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub project_secret: Option<String>,
    #[serde(default)]
    pub platforms: HashMap<String, SocialAgentPlatformConfig>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SocialAgentPlatformConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub bot_username: Option<String>,
    #[serde(default)]
    pub additional_config: HashMap<String, String>,
    #[serde(default)]
    pub connected_at: Option<String>,
}

pub struct SpectrumSidecarChild(pub Arc<Mutex<Option<CommandChild>>>);

impl SpectrumSidecarChild {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

impl Drop for SpectrumSidecarChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                let pid = child.pid();
                // Try graceful kill first, then force kill on Windows
                if child.kill().is_err() {
                    #[cfg(windows)]
                    {
                        let _ = std::process::Command::new("taskkill")
                            .args(["/F", "/T", "/PID", &pid.to_string()])
                            .output();
                    }
                }
            }
        }
    }
}

pub struct SpectrumStdinWriter(pub Arc<Mutex<Option<mpsc::UnboundedSender<String>>>>);

impl SpectrumStdinWriter {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

pub struct SpectrumConversationMap(pub Mutex<HashMap<String, String>>);

impl SpectrumConversationMap {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AppToSidecar {
    Token {
        id: String,
        content: String,
    },
    Done {
        id: String,
        content: String,
    },
    Error {
        id: String,
        message: String,
    },
    Config {
        platforms: serde_json::Value,
    },
}

pub fn try_get_stdin_writer(app: &AppHandle) -> Option<mpsc::UnboundedSender<String>> {
    app.try_state::<SpectrumStdinWriter>()?
        .0
        .lock()
        .ok()?
        .clone()
}

pub fn cleanup_sidecar_state(app: &AppHandle) {
    if let Some(child_state) = app.try_state::<SpectrumSidecarChild>() {
        if let Ok(mut guard) = child_state.0.lock() {
            let _: Option<CommandChild> = guard.take();
        }
    }
    if let Some(writer_state) = app.try_state::<SpectrumStdinWriter>() {
        if let Ok(mut guard) = writer_state.0.lock() {
            let _: Option<mpsc::UnboundedSender<String>> = guard.take();
        }
    }
}
