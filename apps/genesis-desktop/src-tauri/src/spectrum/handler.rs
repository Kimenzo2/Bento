// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::ai::chat::{self, ChatEvent, ChatMessage, ChatParams};
use crate::db::BentoAppState;
use serde::Deserialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use super::{try_get_stdin_writer, AppToSidecar, cleanup_sidecar_state};

const DEBUG_CONFIG_ID: &str = "debug-config";

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum SidecarToApp {
    Chat {
        id: String,
        messages: Vec<IncomingMessage>,
        platform: String,
        user_id: String,
        #[allow(dead_code)]
        space_id: String,
    },
    Config {
        #[allow(dead_code)]
        platforms: serde_json::Value,
    },
    Ready {
        platforms: Vec<String>,
    },
    Ping,
    Error {
        id: String,
        message: String,
    },
}

#[derive(Deserialize)]
struct IncomingMessage {
    role: String,
    content: String,
}

async fn send_to_sidecar(app: &AppHandle, msg: &AppToSidecar) {
    if let Ok(json) = serde_json::to_string(msg) {
        if let Some(writer) = try_get_stdin_writer(app) {
            let _ = writer.send(json);
        }
    }
}

pub async fn handle_sidecar_events(
    app: AppHandle,
    rx: &mut mpsc::Receiver<CommandEvent>,
) {
    let settings = crate::settings::current_settings(&app);
    if let Some(writer) = try_get_stdin_writer(&app) {
        let platforms_val = serde_json::to_value(&settings.social_agents.platforms).unwrap_or_default();
        let enabled = settings.social_agents.enabled;
        info!("[spectrum] sending config to sidecar: enabled={enabled} platforms={}", platforms_val.to_string());
        let config_msg = serde_json::json!({
            "type": "config",
            "enabled": enabled,
            "projectId": settings.social_agents.project_id,
            "projectSecret": settings.social_agents.project_secret,
            "platforms": platforms_val,
        });
        let _ = writer.send(config_msg.to_string());
    }

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(data) => {
                let line = String::from_utf8_lossy(&data);
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<SidecarToApp>(trimmed) {
                    Ok(SidecarToApp::Chat {
                        id,
                        messages,
                        platform,
                        user_id,
                        space_id: _,
                    }) => {
                        let app = app.clone();
                        tokio::spawn(async move {
                            if let Err(e) =
                                process_chat(&app, &id, &messages, &platform, &user_id).await
                            {
                                send_to_sidecar(
                                    &app,
                                    &AppToSidecar::Error {
                                        id,
                                        message: e,
                                    },
                                )
                                .await;
                            }
                        });
                    }
                    Ok(SidecarToApp::Ping) => {
                        info!("[spectrum] sidecar ping");
                    }
                    Ok(SidecarToApp::Ready { platforms }) => {
                        info!("[spectrum] sidecar ready on platforms: {:?}", platforms);
                    }
                    Ok(SidecarToApp::Error { id, message }) => {
                        if id == DEBUG_CONFIG_ID {
                            info!("[spectrum] sidecar debug: {message}");
                        } else {
                            error!("[spectrum] sidecar error [{id}]: {message}");
                        }
                    }
                    Ok(SidecarToApp::Config { .. }) => {}
                    Err(e) => {
                        warn!("[spectrum] unparseable stdout: {e}: {trimmed}");
                    }
                }
            }
            CommandEvent::Stderr(data) => {
                let line = String::from_utf8_lossy(&data);
                warn!("[spectrum] stderr: {line}");
            }
            CommandEvent::Terminated(payload) => {
                info!("[spectrum] sidecar terminated: {:?}", payload.code);
                cleanup_sidecar_state(&app);
                break;
            }
            CommandEvent::Error(e) => {
                error!("[spectrum] sidecar error: {e}");
                cleanup_sidecar_state(&app);
                break;
            }
            _ => {}
        }
    }
}

async fn process_chat(
    app: &AppHandle,
    msg_id: &str,
    messages: &[IncomingMessage],
    platform: &str,
    _user_id: &str,
) -> Result<(), String> {
    let pool = app.state::<BentoAppState>().inner().db();
    let settings = crate::settings::current_settings(app);

    let provider = settings
        .byok
        .active_provider
        .clone()
        .unwrap_or_else(|| "openai".into());
    let model = settings
        .byok
        .active_model
        .clone()
        .unwrap_or_else(|| "gpt-4o".into());

    let byok_settings = settings.byok.clone();
    let api_key = crate::byok::get_api_key(&provider, &byok_settings)
        .ok()
        .flatten();

    let chat_messages: Vec<ChatMessage> = messages
        .iter()
        .map(|m| ChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
            tool_calls: None,
            tool_call_id: None,
            tool_call_name: None,
            created_at: None,
        })
        .collect();

    let system = Some(format!(
        "You are Bento, the user's personal AI assistant. \
         You are chatting via {platform}. Keep responses concise. \
         Use the user's data to provide personalized help."
    ));

    let params = ChatParams {
        messages: chat_messages,
        system,
        model,
        provider: provider.clone(),
        temperature: Some(0.7),
        max_tokens: Some(1024),
        top_p: None,
        top_k: None,
        presence_penalty: None,
        frequency_penalty: None,
        stop_sequences: None,
        enable_tools: Some(true),
        api_key,
        base_url: byok_settings.base_url_overrides.get(&provider).cloned(),
        cookie: None,
        extra_tools: None,
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<ChatEvent>();
    let error_tx = tx.clone();
    let pool_clone = pool.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        if let Err(e) = chat::stream_chat(params, pool_clone, app_clone, tx).await {
            let _ = error_tx.send(ChatEvent::Error { message: e });
        }
    });

    let mut full = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            ChatEvent::Token { content } => {
                full.push_str(&content);
                send_to_sidecar(
                    app,
                    &AppToSidecar::Token {
                        id: msg_id.into(),
                        content,
                    },
                )
                .await;
            }
            ChatEvent::Error { message } => {
                let msg_clone = message.clone();
                send_to_sidecar(
                    app,
                    &AppToSidecar::Error {
                        id: msg_id.into(),
                        message,
                    },
                )
                .await;
                return Err(msg_clone);
            }
            ChatEvent::Done { .. } => {
                send_to_sidecar(
                    app,
                    &AppToSidecar::Done {
                        id: msg_id.into(),
                        content: full,
                    },
                )
                .await;
                return Ok(());
            }
            _ => {}
        }
    }

    Ok(())
}
