// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Bento AI Backend — provider implementations, multi-turn chat, and Tauri commands.
//!
//! This module provides:
//! - Five AI provider implementations (Anthropic, OpenAI, Grok, Ollama, Gemini)
//! - A multi-turn chat engine with tool calling support (`chat`)
//! - Agent conversation memory persistence (`agent_memory`)
//! - Tauri commands for streaming and non-streaming chat, tools, and memory

pub mod agent_memory;
pub mod anthropic;
pub mod chat;
pub mod chatgpt;
pub mod gemini;
pub mod grok;
pub mod ollama;
pub mod openai;
pub mod provider;
pub mod stream;
pub mod tools;

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::{ipc::Channel, AppHandle, Manager};
use tokio::sync::mpsc;

use crate::byok;
use crate::byok::ByokProvider;
use crate::chatgpt_auth;
use crate::db::BentoAppState;
use crate::settings;
use chat::ChatEvent;
use provider::create_provider;

/// Result of querying all provider statuses.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStatus {
    pub provider: String,
    pub display_name: String,
    pub is_configured: bool,
    pub requires_key: bool,
    pub has_key: bool,
    pub is_active: bool,
    pub default_base_url: String,
}

/// Perform a non-streaming AI completion.
///
/// Reads the active provider and model from settings,
/// retrieves the API key from the OS keyring,
/// and returns the full response text.
#[tauri::command]
pub async fn ai_complete(app: AppHandle, prompt: String) -> Result<String, String> {
    let settings = settings::current_settings(&app);

    let provider_name = settings
        .byok
        .active_provider
        .as_deref()
        .ok_or_else(|| "No AI provider configured. Go to Settings → AI to set one up.".to_string())?
        .to_string();

    let model = settings
        .byok
        .active_model
        .as_deref()
        .ok_or_else(|| "No AI model selected. Go to Settings → AI to choose a model.".to_string())?
        .to_string();

    let overrides = &settings.byok.base_url_overrides;

    let provider = create_provider(&provider_name, overrides)?;

    let api_key = if provider_name != "ollama" {
        Some(
                match byok::get_api_key(&provider_name, &settings.byok) {
                    Ok(Some(k)) => k,
                    Ok(None) => {
                        return Err(format!(
                            "No API key configured for {provider_name}. Go to Settings → AI → Credentials to add one."
                        ));
                    }
                    Err(e) => {
                        return Err(format!("Failed to read API key for {provider_name}: {e}"));
                    }
                },
        )
    } else {
        None
    };

    provider.complete(&model, api_key.as_deref(), &prompt).await
}

/// Stream a completion token-by-token to the frontend.
///
/// Uses Tauri's `Channel<String>` to send tokens as they arrive.
/// Sends `__DONE__` when streaming is complete,
/// or `__ERROR__:{message}` if streaming fails mid-way.
#[tauri::command]
pub async fn ai_stream(
    app: AppHandle,
    prompt: String,
    on_token: Channel<String>,
) -> Result<(), String> {
    let settings = settings::current_settings(&app);

    let provider_name = settings
        .byok
        .active_provider
        .as_deref()
        .ok_or_else(|| "No AI provider configured.".to_string())?
        .to_string();

    let model = settings
        .byok
        .active_model
        .as_deref()
        .ok_or_else(|| "No AI model selected.".to_string())?
        .to_string();

    let overrides = &settings.byok.base_url_overrides;

    let provider = create_provider(&provider_name, overrides)?;

    let api_key = if provider_name != "ollama" {
        Some(match byok::get_api_key(&provider_name, &settings.byok) {
            Ok(Some(k)) => k,
            Ok(None) => {
                return Err(format!(
                    "No API key configured for {provider_name}. Go to Settings → AI → Credentials to add one."
                ));
            }
            Err(e) => {
                return Err(format!("Failed to read API key for {provider_name}: {e}"));
            }
        })
    } else {
        None
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    let provider_clone = provider;
    let model_clone = model.clone();
    let key_clone = api_key.as_deref().map(String::from);
    let prompt_clone = prompt.clone();

    tokio::spawn(async move {
        if let Err(e) = provider_clone
            .stream(&model_clone, key_clone.as_deref(), &prompt_clone, tx)
            .await
        {
            eprintln!("[ai] stream error: {e}");
        }
    });

    while let Some(token) = rx.recv().await {
        let _ = on_token.send(token.clone());
        if token == "__DONE__" || token.starts_with("__ERROR__:") {
            break;
        }
    }

    Ok(())
}

/// List available models for a given provider.
#[tauri::command]
pub async fn list_ai_models(app: AppHandle, provider_name: String) -> Result<Vec<String>, String> {
    if provider_name == "chatgpt" {
        // Return known chat models available via ChatGPT proxy
        return Ok(vec![
            "gpt-4o".into(),
            "gpt-4o-mini".into(),
            "gpt-4.1".into(),
            "gpt-4.1-mini".into(),
            "gpt-4.1-nano".into(),
            "o3".into(),
            "o3-mini".into(),
            "o4-mini".into(),
        ]);
    }

    let settings = settings::current_settings(&app);
    let overrides = &settings.byok.base_url_overrides;

    let provider = create_provider(&provider_name, overrides)?;

    let api_key = if provider_name != "ollama" {
        byok::get_api_key(&provider_name, &settings.byok)
            .ok()
            .flatten()
    } else {
        None
    };

    provider.list_models(api_key.as_deref()).await
}

/// Get the status of all AI providers.
#[tauri::command]
pub async fn get_ai_provider_status(app: AppHandle) -> Result<Vec<AiProviderStatus>, String> {
    let settings = settings::current_settings(&app);
    let active_provider = settings.byok.active_provider.as_deref().unwrap_or("");

    let mut results = Vec::new();

    // BYOK providers
    for bp in byok::ByokProvider::all() {
        let name = serde_json::to_value(&bp)
            .ok()
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_default();

        let has_key = byok::has_api_key(&name, &settings.byok);

        results.push(AiProviderStatus {
            provider: name.clone(),
            display_name: bp.display_name().to_string(),
            is_configured: has_key || !bp.requires_key(),
            requires_key: bp.requires_key(),
            has_key,
            is_active: active_provider == name,
            default_base_url: bp.default_base_url().to_string(),
        });
    }

    // ChatGPT (Sign in with ChatGPT) — cookie-based session
    let has_chatgpt_url = chatgpt_auth::load_server_url().ok().flatten().is_some();
    results.push(AiProviderStatus {
        provider: "chatgpt".into(),
        display_name: "ChatGPT (Sign in)".into(),
        is_configured: has_chatgpt_url,
        requires_key: false,
        has_key: has_chatgpt_url,
        is_active: active_provider == "chatgpt",
        default_base_url: "".into(),
    });

    Ok(results)
}

// ── Multi-turn chat commands ─────────────────────────────────────────────────

/// Stream a multi-turn chat response with tool calling support.
///
/// Sends `ChatEvent` objects through the channel:
///   - `{ type: "token", content: "..." }` — text token
///   - `{ type: "tool_call", id, name, args, autoExecute }` — tool invocation
///   - `{ type: "tool_result", id, name, result, isError }` — tool execution result
///   - `{ type: "error", message: "..." }` — error
///   - `{ type: "done", finishReason, usage }` — stream complete
///
/// Automatically executes tools flagged with `autoExecute: true` and feeds
/// results back to the model. Tools flagged `autoExecute: false` are sent
/// to the frontend for user approval.
#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    messages: Vec<chat::ChatMessage>,
    system: Option<String>,
    model: Option<String>,
    provider: Option<String>,
    temperature: Option<f64>,
    max_tokens: Option<u64>,
    top_p: Option<f64>,
    top_k: Option<u64>,
    presence_penalty: Option<f64>,
    frequency_penalty: Option<f64>,
    stop_sequences: Option<Vec<String>>,
    enable_tools: Option<bool>,
    on_event: Channel<ChatEvent>,
) -> Result<(), String> {
    let settings = settings::current_settings(&app);
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };

    let provider_name = provider
        .unwrap_or_else(|| {
            settings
                .byok
                .active_provider
                .clone()
                .unwrap_or_else(|| "openai".to_string())
        });
    let model_name = model
        .unwrap_or_else(|| {
            settings
                .byok
                .active_model
                .clone()
                .unwrap_or_else(|| "gpt-4o".to_string())
        });

    let (api_key, base_url, cookie) = if provider_name == "chatgpt" {
        // ChatGPT uses cookie-based auth — extract session cookie from managed client
        let chatgpt_state = app.state::<chatgpt_auth::ChatGptClient>();
        let server_url = chatgpt_auth::load_server_url()
            .ok()
            .flatten()
            .or_else(|| {
                chatgpt_state.server_url
                    .lock()
                    .map_err(|e| format!("Lock error: {e}"))
                    .ok()
                    .and_then(|g| g.clone())
            })
            .ok_or_else(|| "No ChatGPT server URL. Sign in from Settings → AI.".to_string())?;
        let session_cookie = chatgpt_state.session_cookie
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?
            .clone();
        (None, Some(format!("{server_url}/api/chatgpt")), session_cookie)
    } else {
        let key = if provider_name != "ollama" {
            Some(match byok::get_api_key(&provider_name, &settings.byok) {
                Ok(Some(k)) => k,
                Ok(None) => {
                    return Err(format!(
                        "No API key configured for {provider_name}. Go to Settings → AI → Credentials to add one."
                    ));
                }
                Err(e) => {
                    return Err(format!("Failed to read API key for {provider_name}: {e}"));
                }
            })
        } else {
            None
        };
        let url = resolve_base_url(&provider_name, &settings.byok);
        (key, url, None)
    };

    // Enrich system prompt with connected integration info so the model
    // knows which external apps it can use.
    let system = enrich_system_prompt_with_integrations(&app, &pool, system).await?;

    let params = chat::ChatParams {
        messages,
        system,
        model: model_name,
        provider: provider_name,
        temperature,
        max_tokens,
        top_p,
        top_k,
        presence_penalty,
        frequency_penalty,
        stop_sequences,
        enable_tools,
        api_key,
        base_url,
        cookie,
        extra_tools: Some(connected_integration_tools(&pool).await?),
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<ChatEvent>();

    let error_tx = tx.clone();
    let stream_app = app.clone();
    tokio::spawn(async move {
        if let Err(e) = chat::stream_chat(params, pool, stream_app, tx).await {
            eprintln!("[ai] chat stream error: {e}");
            let _ = error_tx.send(ChatEvent::Error { message: e });
        }
    });

    while let Some(event) = rx.recv().await {
        if on_event.send(event.clone()).is_err() {
            // Frontend disconnected — drop the tx to stop the spawned task
            break;
        }
        if matches!(event, ChatEvent::Done { .. } | ChatEvent::Error { .. }) {
            break;
        }
    }

    Ok(())
}

/// Perform a non-streaming multi-turn chat completion.
#[tauri::command]
pub async fn ai_chat_complete(
    app: AppHandle,
    messages: Vec<chat::ChatMessage>,
    system: Option<String>,
    model: Option<String>,
    provider: Option<String>,
    temperature: Option<f64>,
    max_tokens: Option<u64>,
    top_p: Option<f64>,
    top_k: Option<u64>,
    presence_penalty: Option<f64>,
    frequency_penalty: Option<f64>,
    stop_sequences: Option<Vec<String>>,
    enable_tools: Option<bool>,
) -> Result<String, String> {
    let settings = settings::current_settings(&app);
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };

    let provider_name = provider
        .unwrap_or_else(|| {
            settings
                .byok
                .active_provider
                .clone()
                .unwrap_or_else(|| "openai".to_string())
        });
    let model_name = model
        .unwrap_or_else(|| {
            settings
                .byok
                .active_model
                .clone()
                .unwrap_or_else(|| "gpt-4o".to_string())
        });

    let (api_key, base_url, cookie) = if provider_name == "chatgpt" {
        let chatgpt_state = app.state::<chatgpt_auth::ChatGptClient>();
        let server_url = chatgpt_auth::load_server_url()
            .ok()
            .flatten()
            .or_else(|| {
                chatgpt_state.server_url
                    .lock()
                    .map_err(|e| format!("Lock error: {e}"))
                    .ok()
                    .and_then(|g| g.clone())
            })
            .ok_or_else(|| "No ChatGPT server URL. Sign in from Settings → AI.".to_string())?;
        let session_cookie = chatgpt_state.session_cookie
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?
            .clone();
        (None, Some(format!("{server_url}/api/chatgpt")), session_cookie)
    } else {
        let key = if provider_name != "ollama" {
            Some(match byok::get_api_key(&provider_name, &settings.byok) {
                Ok(Some(k)) => k,
                Ok(None) => {
                    return Err(format!(
                        "No API key configured for {provider_name}. Go to Settings → AI → Credentials to add one."
                    ));
                }
                Err(e) => {
                    return Err(format!("Failed to read API key for {provider_name}: {e}"));
                }
            })
        } else {
            None
        };
        let url = resolve_base_url(&provider_name, &settings.byok);
        (key, url, None)
    };

    let system = enrich_system_prompt_with_integrations(&app, &pool, system).await?;

    let params = chat::ChatParams {
        messages,
        system,
        model: model_name,
        provider: provider_name,
        temperature,
        max_tokens,
        top_p,
        top_k,
        presence_penalty,
        frequency_penalty,
        stop_sequences,
        enable_tools,
        api_key,
        base_url,
        cookie,
        extra_tools: Some(connected_integration_tools(&pool).await?),
    };

    chat::complete_chat(params, pool, app).await
}

// ── Helper ───────────────────────────────────────────────────────────────────

/// Resolve the base URL for a provider: check overrides first, then fall back
/// to the provider's known default base URL.
pub(crate) fn resolve_base_url(provider_name: &str, byok: &byok::ByokSettings) -> Option<String> {
    if let Some(override_url) = byok.base_url_overrides.get(provider_name) {
        return Some(override_url.clone());
    }
    // Fall back to the provider's well-known default
    provider_name.parse::<ByokProvider>().ok().map(|p| p.default_base_url().to_string())
}

// ── Agent memory commands ────────────────────────────────────────────────────

/// List saved conversations.
#[tauri::command]
pub async fn ai_conversation_list(
    app: AppHandle,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<agent_memory::ConversationSummary>, String> {
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    agent_memory::list_conversations(&pool, limit.unwrap_or(50), offset.unwrap_or(0)).await
}

/// Get a single conversation with all messages.
#[tauri::command]
pub async fn ai_conversation_get(
    app: AppHandle,
    id: String,
) -> Result<Option<agent_memory::Conversation>, String> {
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    agent_memory::get_conversation(&pool, &id).await
}

/// Delete a conversation.
#[tauri::command]
pub async fn ai_conversation_delete(app: AppHandle, id: String) -> Result<(), String> {
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    agent_memory::delete_conversation(&pool, &id).await
}

/// Save or append messages to a conversation.
/// When `append` is true, messages are added without deleting existing ones.
#[tauri::command]
pub async fn ai_conversation_save(
    app: AppHandle,
    id: String,
    messages: Vec<chat::ChatMessage>,
    append: Option<bool>,
) -> Result<(), String> {
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    if append.unwrap_or(false) {
        agent_memory::append_messages(&pool, &id, &messages).await
    } else {
        agent_memory::save_messages(&pool, &id, &messages).await
    }
}

/// Update a conversation's title.
#[tauri::command]
pub async fn ai_conversation_rename(
    app: AppHandle,
    id: String,
    title: String,
) -> Result<(), String> {
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    agent_memory::update_conversation_title(&pool, &id, &title).await
}

/// Search conversations by title or message content.
#[tauri::command]
pub async fn ai_conversation_search(
    app: AppHandle,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<agent_memory::ConversationSummary>, String> {
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    agent_memory::search_conversations(&pool, &query, limit.unwrap_or(20)).await
}

/// List available tool definitions for the agent.
#[tauri::command]
pub async fn ai_tools_list(app: AppHandle) -> Result<Vec<chat::ToolDefinition>, String> {
    let mut defs = chat::default_tool_definitions();
    let pool = {
        let state = app.state::<BentoAppState>();
        state.db()
    };
    defs.extend(connected_integration_tools(&pool).await?);
    Ok(defs)
}

/// Build the integration tool definitions for currently connected apps.
pub(crate) async fn connected_integration_tools(
    pool: &sqlx::SqlitePool,
) -> Result<Vec<chat::ToolDefinition>, String> {
    let connected = crate::integrations::store::connected_app_keys(pool).await?;
    let set: HashSet<String> = connected.into_iter().collect();
    Ok(crate::ai::tools::integrations::definitions(&set))
}

/// Canonical default system prompt for the Bento agent — identity + tools + personality.
/// Kept in sync with the frontend `prompts.ts getDefaultSystemPrompt()`.
pub fn default_agent_system_prompt() -> String {
    "## Identity\n\n\
     You are Bento \u{2014} a personal life-OS assistant. You live on the user's desktop as a built-in feature of the Bento app. You are NOT a generic chatbot. You are NOT a language model. You are Bento, a product made by the Bento team.\n\n\
     CRITICAL RULES:\n\
     - NEVER say you are \"trained by Google\" or \"trained by OpenAI\" or \"a large language model\"\n\
     - NEVER say you don't have a name \u{2014} your name is Bento\n\
     - NEVER break character or reveal you are an AI model\n\
     - If asked \"who are you?\" say \"I'm Bento, your personal life-OS assistant\"\n\
     - If asked \"what are you?\" say \"I'm Bento \u{2014} I help you manage your life from your desktop\"\n\
     - You are a product, not a research model. Act like a product.\n\n\
     ## What You Do\n\n\
     You help people manage their daily lives across these areas:\n\
     - Tasks and to-dos (create, prioritize, complete)\n\
     - Journaling and reflection\n\
     - Habit tracking and streaks\n\
     - Focus and deep work sessions\n\
     - Health, sleep, and nutrition tracking\n\
     - Mood check-ins and emotional awareness\n\
     - Budget and money management\n\
     - Goal setting and milestones\n\
     - Notes and knowledge capture\n\
     - Voice memos and transcription\n\
     - Breathing exercises and calm sessions\n\
     - Countdowns to important events\n\n\
     ## Personality\n\n\
     - Warm, encouraging, and concise\n\
     - You care about the user's wellbeing, not just productivity\n\
     - You notice patterns: \"You've been sleeping less this week\" or \"You skipped your morning routine 3 days in a row\"\n\
     - You celebrate wins: \"Nice \u{2014} that's a 7-day streak!\"\n\
     - You gently nudge when something's off: \"You logged 'stressed' mood 4 days straight. Want to check your mood or habits?\"\n\n\
     ## Using Tools\n\n\
     - Always use tools to get real data before giving advice\n\
     - Never fabricate data \u{2014} report what the tools return\n\
     - When you create or update something, confirm what you did\n\
     - Format responses in Markdown when helpful (lists, bold, code blocks for data)\n\n\
     You have access to the user's Bento data through tools. Use them proactively to give personalized, data-driven help \u{2014} not generic advice."
        .to_string()
}

/// Enrich a system prompt with the `## Connected Integrations` section that tells the
/// model which external apps are available and how to use them.
pub(crate) async fn enrich_system_prompt_with_integrations(
    _app: &AppHandle,
    pool: &sqlx::SqlitePool,
    system: Option<String>,
) -> Result<Option<String>, String> {
    let connected_keys = crate::integrations::store::connected_app_keys(pool).await?;
    if connected_keys.is_empty() {
        return Ok(system);
    }

    let integration_defs = crate::ai::tools::integrations::definitions(
        &connected_keys.iter().cloned().collect::<HashSet<_>>(),
    );
    let mut app_tools: std::collections::BTreeMap<String, Vec<String>> = std::collections::BTreeMap::new();
    for def in &integration_defs {
        let app_name = crate::ai::tools::integrations::resolve_app(&def.name)
            .unwrap_or("unknown")
            .to_string();
        app_tools.entry(app_name).or_default().push(def.name.clone());
    }

    let mut tool_list = String::new();
    for (app_name, tools) in &app_tools {
        let suffix = if app_name == "telegram" {
            match crate::integrations::native::token::get("telegram").await {
                Ok(Some(creds)) => {
                    let mut parts = Vec::new();
                    if let Some(cid) = &creds.username {
                        parts.push(format!("default chat_id: {cid}"));
                    }
                    if !parts.is_empty() {
                        format!(" ({})", parts.join(", "))
                    } else {
                        String::new()
                    }
                }
                _ => String::new(),
            }
        } else {
            String::new()
        };
        tool_list.push_str(&format!("- **{}**{}: {}\n", app_name, suffix, tools.join(", ")));
    }

    let integration_hint = format!(
        "\n\n## Connected Integrations\n\
         You have access to these connected external apps:\n{tool_list}\n\
         Use the corresponding tools to interact with these services. \
         Always use tools to interact with these services \u{2014} never fabricate results."
    );

    Ok(Some(match system {
        Some(s) => format!("{s}{integration_hint}"),
        None => integration_hint.trim_start().to_string(),
    }))
}
