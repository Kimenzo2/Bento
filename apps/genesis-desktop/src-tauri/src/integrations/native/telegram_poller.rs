// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Real-time Telegram bot poller — long-polling background task.
//!
//! Pattern borrowed from Hermes (python-telegram-bot) and OpenClaw (grammY):
//! 1. deleteWebhook on start (clear stale webhooks)
//! 2. Loop: GET /getUpdates?timeout=30
//! 3. Route messages to AI agent (with full tools, memory, correct provider)
//! 4. Send agent responses back
//! 5. Error recovery with exponential backoff
//! 6. 409 conflict detection and recovery
//! 7. Heartbeat via getMe probe

use std::collections::HashMap;
use std::sync::LazyLock;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::time::sleep;

use crate::byok;
use crate::db::BentoAppState;

const POLL_TIMEOUT: u64 = 30;
const HEARTBEAT_INTERVAL: u64 = 90;
const MAX_NETWORK_RETRIES: u32 = 10;
const BASE_BACKOFF: u64 = 5;
const MAX_BACKOFF: u64 = 60;
const MAX_CONFLICT_RETRIES: u32 = 5;
const CONFLICT_BASE_DELAY: u64 = 15;
const MAX_HISTORY: usize = 16;

/// Events emitted from the poller to the Tauri frontend.
#[derive(Clone, Debug, serde::Serialize)]
pub struct TelegramIncomingMessage {
    pub message_id: i64,
    pub chat_id: i64,
    pub from_name: String,
    pub from_id: i64,
    pub text: String,
    pub date: i64,
}

/// Handle to a running Telegram poller. Drop to stop.
pub struct TelegramPollerHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl Drop for TelegramPollerHandle {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

/// Start a real-time Telegram poller for the given bot token.
pub fn start_poller(
    bot_token: String,
    app_handle: tauri::AppHandle,
) -> (TelegramPollerHandle, mpsc::Receiver<TelegramIncomingMessage>) {
    let (msg_tx, msg_rx) = mpsc::channel::<TelegramIncomingMessage>(64);
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    tokio::spawn(polling_loop(bot_token, app_handle, msg_tx, shutdown_rx));

    (TelegramPollerHandle { shutdown_tx: Some(shutdown_tx) }, msg_rx)
}

/// Per-chat conversation memory. Maps chat_id → conversation_id.
/// Static so the in-memory cache survives across messages within a session.
static CHAT_MEMORY: LazyLock<Mutex<HashMap<i64, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Get or create a conversation_id for a chat. Persists in SQLite.
async fn get_or_create_conversation(
    pool: &sqlx::SqlitePool,
    chat_id: i64,
) -> Result<String, String> {
    // Check in-memory cache first
    {
        let map = CHAT_MEMORY.lock().await;
        if let Some(id) = map.get(&chat_id) {
            return Ok(id.clone());
        }
    }

    // Check SQLite for an existing conversation for this chat_id
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT conversation_id FROM telegram_chats WHERE chat_id = ?",
    )
    .bind(chat_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    let conv_id = match row {
        Some((id,)) => id,
        None => {
            let id = crate::ai::agent_memory::create_conversation(pool).await?;
            sqlx::query(
                "INSERT OR IGNORE INTO telegram_chats (chat_id, conversation_id, created_at) VALUES (?, ?, ?)",
            )
            .bind(chat_id)
            .bind(&id)
            .bind(crate::util::time::now_ms())
            .execute(pool)
            .await
            .map_err(|e| format!("DB error: {e}"))?;
            id
        }
    };

    // Cache in memory
    {
        let mut map = CHAT_MEMORY.lock().await;
        map.insert(chat_id, conv_id.clone());
    }
    Ok(conv_id)
}

/// Ensure the telegram_chats table exists.
pub async fn ensure_telegram_memory(pool: &sqlx::SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS telegram_chats (
            chat_id INTEGER PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create telegram_chats table: {e}"))?;
    Ok(())
}

/// Core long-polling loop with error recovery.
async fn polling_loop(
    bot_token: String,
    app_handle: tauri::AppHandle,
    msg_tx: mpsc::Sender<TelegramIncomingMessage>,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    let base_url = format!("https://api.telegram.org/bot{bot_token}");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(POLL_TIMEOUT + 10))
        .build()
        .unwrap_or_default();

    // Clear stale webhooks on start (Hermes pattern)
    let _ = client
        .post(format!("{base_url}/deleteWebhook"))
        .send()
        .await;

    let mut offset: i64 = 0;
    let mut network_errors: u32 = 0;
    let mut conflict_count: u32 = 0;

    let client_clone = client.clone();
    let base_url_clone = base_url.clone();
    let app_clone = app_handle.clone();
    let heartbeat_handle = tokio::spawn(async move {
        heartbeat_loop(client_clone, base_url_clone, app_clone).await;
    });

    eprintln!("[telegram] Poller started for token prefix: {}...", &bot_token[..20.min(bot_token.len())]);

    loop {
        if shutdown_rx.try_recv().is_ok() {
            break;
        }

        let url = format!(
            "{base_url}/getUpdates?timeout={POLL_TIMEOUT}&offset={offset}&limit=100"
        );

        match client.get(&url).send().await {
            Ok(resp) => {
                let status = resp.status();
                if !status.is_success() {
                    let body = resp.text().await.unwrap_or_default();
                    if status.as_u16() == 409 {
                        conflict_count += 1;
                        eprintln!("[telegram] 409 Conflict (attempt {conflict_count}/{MAX_CONFLICT_RETRIES})");
                        if conflict_count > MAX_CONFLICT_RETRIES {
                            eprintln!("[telegram] FATAL: Too many conflicts, stopping poller");
                            break;
                        }
                        let delay = CONFLICT_BASE_DELAY + (conflict_count as u64 * 10);
                        sleep(Duration::from_secs(delay)).await;
                        continue;
                    }
                    eprintln!("[telegram] getUpdates HTTP {status}: {body}");
                    network_errors += 1;
                    let delay = backoff_delay(network_errors);
                    sleep(Duration::from_secs(delay)).await;
                    continue;
                }

                network_errors = 0;
                conflict_count = 0;

                match resp.json::<serde_json::Value>().await {
                    Ok(body) => {
                        if let Some(updates) = body.get("result").and_then(|v| v.as_array()) {
                            for update in updates {
                                if let Some(uid) = update.get("update_id").and_then(|v| v.as_i64()) {
                                    offset = uid + 1;
                                }

                                if let Some(msg) = update.get("message") {
                                    if let Some(event) = parse_message(msg) {
                                        let response = route_to_agent(&app_handle, &event).await;

                                        if !response.is_empty() {
                                            let _ = send_telegram_message(
                                                &client,
                                                &base_url,
                                                event.chat_id,
                                                &response,
                                            ).await;
                                        }

                                        let _ = app_handle.emit("telegram-incoming", &event);
                                        let _ = msg_tx.send(event).await;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[telegram] Failed to parse getUpdates response: {e}");
                    }
                }
            }
            Err(e) => {
                network_errors += 1;
                eprintln!("[telegram] Network error (attempt {network_errors}/{MAX_NETWORK_RETRIES}): {e}");
                if network_errors > MAX_NETWORK_RETRIES {
                    eprintln!("[telegram] FATAL: Too many network errors, stopping poller");
                    break;
                }
                let delay = backoff_delay(network_errors);
                sleep(Duration::from_secs(delay)).await;
            }
        }
    }

    heartbeat_handle.abort();
    eprintln!("[telegram] Poller stopped");
}

/// Parse a Telegram message update into our internal event type.
fn parse_message(msg: &serde_json::Value) -> Option<TelegramIncomingMessage> {
    let message_id = msg.get("message_id")?.as_i64()?;
    let chat = msg.get("chat")?;
    let chat_id = chat.get("id")?.as_i64()?;
    let from = msg.get("from")?;
    let from_name = from
        .get("first_name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let from_id = from.get("id")?.as_i64()?;
    let text = msg
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let date = msg.get("date").and_then(|v| v.as_i64()).unwrap_or(0);

    if from.get("is_bot").and_then(|v| v.as_bool()).unwrap_or(false) {
        return None;
    }

    if text.is_empty() {
        return None;
    }

    Some(TelegramIncomingMessage {
        message_id,
        chat_id,
        from_name,
        from_id,
        text,
        date,
    })
}

/// Route an incoming message to the AI agent — mirrors `ai_chat_stream` exactly.
async fn route_to_agent(
    app_handle: &tauri::AppHandle,
    event: &TelegramIncomingMessage,
) -> String {
    let pool = {
        let state = app_handle.state::<BentoAppState>();
        state.db()
    };

    // ── Per-chat memory ────────────────────────────────────────────
    let conv_id = match get_or_create_conversation(&pool, event.chat_id).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("[telegram] Failed to get/create conversation: {e}");
            // Fall back to a fresh one-shot
            return route_to_agent_oneshot(app_handle, event).await;
        }
    };

    // Load conversation history
    let history = match crate::ai::agent_memory::get_conversation(&pool, &conv_id).await {
        Ok(Some(c)) => c.messages,
        _ => Vec::new(),
    };

    // ── Provider/model resolution (same as ai_chat_stream) ─────────
    let settings = crate::settings::current_settings(app_handle);

    let provider_name = settings
        .byok
        .active_provider
        .clone()
        .unwrap_or_else(|| "openai".to_string());
    let model_name = settings
        .byok
        .active_model
        .clone()
        .unwrap_or_else(|| "gpt-4o".to_string());

    // ── API key + base URL (handles chatgpt cookie branch) ─────────
    let (api_key, base_url, cookie) = if provider_name == "chatgpt" {
        let chatgpt_state = app_handle.state::<crate::chatgpt_auth::ChatGptClient>();
        let server_url = crate::chatgpt_auth::load_server_url()
            .ok()
            .flatten()
            .or_else(|| {
                chatgpt_state.server_url
                    .lock()
                    .map_err(|e| format!("Lock error: {e}"))
                    .ok()
                    .and_then(|g| g.as_ref().cloned())
            })
            .ok_or_else(|| "No ChatGPT server URL.".to_string());
        match server_url {
            Ok(url) => {
                let session_cookie = chatgpt_state.session_cookie
                    .lock()
                    .map_err(|e| format!("Lock error: {e}"))
                    .ok()
                    .and_then(|c| c.as_ref().cloned());
                (None, Some(format!("{url}/api/chatgpt")), session_cookie)
            }
            Err(_) => (None, None, None),
        }
    } else {
        let key = if provider_name != "ollama" {
            Some(match byok::get_api_key(&provider_name, &settings.byok) {
                Ok(Some(k)) => k,
                Ok(None) => {
                    return "No API key configured. Go to Settings \u{2192} AI \u{2192} Credentials.".to_string();
                }
                Err(e) => return format!("Failed to read API key: {e}"),
            })
        } else {
            None
        };
        let url = crate::ai::resolve_base_url(&provider_name, &settings.byok);
        (key, url, None)
    };

    // ── System prompt: Bento identity + Connected Integrations ─────
    let base_system = Some(settings.ai.system_prompt.clone());
    let system = match crate::ai::enrich_system_prompt_with_integrations(
        app_handle,
        &pool,
        base_system,
    )
    .await
    {
        Ok(s) => s,
        Err(_) => settings.ai.system_prompt.clone().into(),
    };

    // ── Integration tools ──────────────────────────────────────────
    let extra_tools = crate::ai::connected_integration_tools(&pool)
        .await
        .unwrap_or_default();

    // ── Build messages (history + new user message) ────────────────
    let mut messages: Vec<crate::ai::chat::ChatMessage> = history;
    // Trim to last MAX_HISTORY so context window doesn't explode
    if messages.len() > MAX_HISTORY {
        messages = messages[messages.len() - MAX_HISTORY..].to_vec();
    }
    messages.push(crate::ai::chat::ChatMessage {
        role: "user".into(),
        content: format!(
            "[Telegram message from {} (chat_id: {})]: {}",
            event.from_name, event.chat_id, event.text
        ),
        tool_calls: None,
        tool_call_id: None,
        tool_call_name: None,
        created_at: None,
    });

    // ── Call agent (full tool-calling loop) ────────────────────────
    let params = crate::ai::chat::ChatParams {
        messages,
        system,
        model: model_name,
        provider: provider_name,
        temperature: None,
        max_tokens: None,
        top_p: None,
        top_k: None,
        presence_penalty: None,
        frequency_penalty: None,
        stop_sequences: None,
        enable_tools: Some(true),
        api_key,
        base_url,
        cookie,
        extra_tools: Some(extra_tools),
    };

    let result = crate::ai::chat::complete_chat(params, pool.clone(), app_handle.clone()).await;
    let response = match result {
        Ok(text) => text,
        Err(e) => format!("AI error: {e}"),
    };

    // ── Save to conversation memory ────────────────────────────────
    let user_msg = crate::ai::chat::ChatMessage {
        role: "user".into(),
        content: format!(
            "[Telegram message from {} (chat_id: {})]: {}",
            event.from_name, event.chat_id, event.text
        ),
        tool_calls: None,
        tool_call_id: None,
        tool_call_name: None,
        created_at: None,
    };
    let assistant_msg = crate::ai::chat::ChatMessage {
        role: "assistant".into(),
        content: response.clone(),
        tool_calls: None,
        tool_call_id: None,
        tool_call_name: None,
        created_at: None,
    };
    let _ = crate::ai::agent_memory::append_messages(
        &pool,
        &conv_id,
        &[user_msg, assistant_msg],
    )
    .await;

    response
}

/// Fallback one-shot without memory (if memory setup fails).
async fn route_to_agent_oneshot(
    app_handle: &tauri::AppHandle,
    event: &TelegramIncomingMessage,
) -> String {
    let pool = {
        let state = app_handle.state::<BentoAppState>();
        state.db()
    };
    let settings = crate::settings::current_settings(app_handle);
    let provider_name = settings.byok.active_provider.clone().unwrap_or_else(|| "openai".to_string());
    let model_name = settings.byok.active_model.clone().unwrap_or_else(|| "gpt-4o".to_string());

    let key = if provider_name != "ollama" {
        Some(match byok::get_api_key(&provider_name, &settings.byok) {
            Ok(Some(k)) => k,
            _ => return "No API key.".to_string(),
        })
    } else {
        None
    };
    let base_url = crate::ai::resolve_base_url(&provider_name, &settings.byok);
    let system = crate::ai::enrich_system_prompt_with_integrations(
        app_handle,
        &pool,
        settings.ai.system_prompt.clone().into(),
    )
    .await
    .ok()
    .flatten();

    let params = crate::ai::chat::ChatParams {
        messages: vec![crate::ai::chat::ChatMessage {
            role: "user".into(),
            content: format!(
                "[Telegram message from {} (chat_id: {})]: {}",
                event.from_name, event.chat_id, event.text
            ),
            tool_calls: None,
            tool_call_id: None,
            tool_call_name: None,
            created_at: None,
        }],
        system,
        model: model_name,
        provider: provider_name,
        temperature: None,
        max_tokens: None,
        top_p: None,
        top_k: None,
        presence_penalty: None,
        frequency_penalty: None,
        stop_sequences: None,
        enable_tools: Some(true),
        api_key: key,
        base_url,
        cookie: None,
        extra_tools: Some(
            crate::ai::connected_integration_tools(&pool)
                .await
                .unwrap_or_default(),
        ),
    };

    match crate::ai::chat::complete_chat(params, pool, app_handle.clone()).await {
        Ok(text) => text,
        Err(e) => format!("AI error: {e}"),
    }
}

/// Send a message via Telegram Bot API.
async fn send_telegram_message(
    client: &reqwest::Client,
    base_url: &str,
    chat_id: i64,
    text: &str,
) -> Result<(), String> {
    let url = format!("{base_url}/sendMessage");
    let body = serde_json::json!({
        "chat_id": chat_id,
        "text": text,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to send message: {e}"))?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        return Err(format!("Telegram sendMessage failed: {err}"));
    }

    Ok(())
}

/// Heartbeat loop — probe getMe periodically to detect dead sockets.
async fn heartbeat_loop(
    client: reqwest::Client,
    base_url: String,
    app_handle: tauri::AppHandle,
) {
    loop {
        sleep(Duration::from_secs(HEARTBEAT_INTERVAL)).await;

        let url = format!("{base_url}/getMe");
        match tokio::time::timeout(Duration::from_secs(15), client.get(&url).send()).await {
            Ok(Ok(resp)) if resp.status().is_success() => {}
            Ok(Ok(resp)) => {
                eprintln!("[telegram] Heartbeat failed: HTTP {}", resp.status());
                let _ = app_handle.emit("telegram-heartbeat-error", format!("HTTP {}", resp.status()));
            }
            Ok(Err(e)) => {
                eprintln!("[telegram] Heartbeat network error: {e}");
                let _ = app_handle.emit("telegram-heartbeat-error", e.to_string());
            }
            Err(_) => {
                eprintln!("[telegram] Heartbeat timeout");
                let _ = app_handle.emit("telegram-heartbeat-error", "timeout".to_string());
            }
        }
    }
}

/// Exponential backoff delay calculation.
fn backoff_delay(attempt: u32) -> u64 {
    let delay = BASE_BACKOFF * 2u64.pow(attempt.saturating_sub(1));
    delay.min(MAX_BACKOFF)
}
