//! Bento AI Backend — provider implementations and Tauri commands.
//!
//! This module provides the five AI provider implementations (Anthropic, OpenAI,
//! Grok, Ollama, Gemini) and the Tauri commands that wire them together with
//! keychain-based API key storage and user-configured settings.
//!
//! Architecture:
//!   - Each provider implements `complete` (non-streaming) and `stream` (streaming)
//!   - The `AiProvider` enum in `provider.rs` dispatches to the right provider
//!   - `stream.rs` handles SSE and newline-delimited JSON parsing
//!   - Tauri commands read active provider/model from settings, get key from keychain

pub mod anthropic;
pub mod gemini;
pub mod grok;
pub mod ollama;
pub mod openai;
pub mod provider;
pub mod stream;

use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle};
use tokio::sync::mpsc;

use crate::byok;
use crate::settings;
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

    // Get the provider instance
    let provider = create_provider(&provider_name, overrides)?;

    // Get the API key from keychain (Ollama doesn't need one)
    let api_key = if provider_name != "ollama" {
        Some(
            byok::get_api_key(&provider_name)?
                .ok_or_else(|| format!("No API key configured for {provider_name}"))?,
        )
    } else {
        None // Ollama — no key needed
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

    // Get the API key (Ollama doesn't need one)
    let api_key = if provider_name != "ollama" {
        Some(
            byok::get_api_key(&provider_name)?
                .ok_or_else(|| format!("No API key for {provider_name}"))?,
        )
    } else {
        None
    };

    // Create a channel to bridge provider stream → Tauri Channel
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Spawn the streaming task
    let provider_clone = provider;
    let model_clone = model.clone();
    let key_clone = api_key.as_deref().map(String::from);
    let prompt_clone = prompt.clone();

    tokio::spawn(async move {
        let result = provider_clone
            .stream(&model_clone, key_clone.as_deref(), &prompt_clone, tx)
            .await;
        if let Err(_e) = result {
            // If stream() returns an error, make sure we signal it
            // (stream() itself sends __ERROR__ before returning Err)
        }
    });

    // Forward tokens from the mpsc channel to Tauri's Channel
    while let Some(token) = rx.recv().await {
        let _ = on_token.send(token.clone());
        if token == "__DONE__" || token.starts_with("__ERROR__:") {
            break;
        }
    }

    Ok(())
}

/// List available models for a given provider.
///
/// For Ollama, this dynamically fetches the list from the local server.
/// For all others, returns the known model list (or fetches via API if key is set).
#[tauri::command]
pub async fn list_ai_models(app: AppHandle, provider_name: String) -> Result<Vec<String>, String> {
    let settings = settings::current_settings(&app);
    let overrides = &settings.byok.base_url_overrides;

    let provider = create_provider(&provider_name, overrides)?;

    let api_key = if provider_name != "ollama" {
        byok::get_api_key(&provider_name).ok().flatten()
    } else {
        None
    };

    provider.list_models(api_key.as_deref()).await
}

/// Get the status of all AI providers.
///
/// Returns a list of `AiProviderStatus` with info about whether
/// each provider has a key configured, needs a key, and is the active provider.
#[tauri::command]
pub async fn get_ai_provider_status(app: AppHandle) -> Result<Vec<AiProviderStatus>, String> {
    let settings = settings::current_settings(&app);
    let active_provider = settings.byok.active_provider.as_deref().unwrap_or("");

    let mut results = Vec::new();
    for bp in byok::ByokProvider::all() {
        let name = serde_json::to_value(&bp)
            .ok()
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_default();

        let has_key = byok::has_api_key(&name);

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

    Ok(results)
}
