//! BYOK Tauri Commands
//!
//! Provides `#[tauri::command]` functions for the frontend to manage
//! Bring Your Own Key (BYOK) operations.

use serde::{Deserialize, Serialize};
use std::str::FromStr;
use tauri::AppHandle;

use super::{ByokProvider, ByokSettings, ConnectionTestResult};
use crate::settings;

/// Full status of BYOK key configuration for a provider.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderKeyStatus {
    pub provider: String,
    pub display_name: String,
    pub is_configured: bool,
    pub key_preview: Option<String>,
    pub requires_key: bool,
    pub default_base_url: String,
}

/// Validate the format of an API key for a given provider.
/// Returns an error message if the format is invalid.
fn validate_key_format(provider: &ByokProvider, key: &str) -> Result<(), String> {
    let trimmed = key.trim();
    match provider {
        ByokProvider::OpenAI => {
            if !trimmed.starts_with("sk-") {
                return Err("OpenAI keys must start with 'sk-'".to_string());
            }
            if trimmed.len() < 28 {
                return Err("OpenAI key is too short (expected at least 28 characters)".to_string());
            }
        }
        ByokProvider::Anthropic => {
            if !trimmed.starts_with("sk-ant-") {
                return Err("Anthropic keys must start with 'sk-ant-'".to_string());
            }
            if trimmed.len() < 30 {
                return Err(
                    "Anthropic key is too short (expected at least 30 characters)".to_string(),
                );
            }
        }
        ByokProvider::Gemini => {
            if !trimmed.starts_with("AIza") {
                return Err("Gemini keys must start with 'AIza'".to_string());
            }
            if trimmed.len() < 30 {
                return Err("Gemini key is too short (expected at least 30 characters)".to_string());
            }
        }
        ByokProvider::Grok => {
            if !trimmed.starts_with("xai-") {
                return Err("Grok keys must start with 'xai-'".to_string());
            }
            if trimmed.len() < 20 {
                return Err("Grok key is too short (expected at least 20 characters)".to_string());
            }
        }
        ByokProvider::Ollama => {
            // Ollama doesn't use API keys
        }
    }
    Ok(())
}

/// Save an API key for a provider in the OS keyring.
/// Validates the key format before saving.
#[tauri::command]
pub async fn byok_save_key(app: AppHandle, provider: String, key: String) -> Result<(), String> {
    let byok_provider =
        ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;

    if key.trim().is_empty() {
        return Err("API key cannot be empty.".to_string());
    }

    if byok_provider.requires_key() {
        validate_key_format(&byok_provider, &key)?;
    }

    // Store in OS keyring
    super::save_api_key(&provider, key.trim())?;

    // Update DesktopSettings to track this configured provider
    settings::update_desktop_settings(&app, |next| {
        next.byok.refresh_configured_providers();
    })?;

    Ok(())
}

/// Get the masked preview of a stored API key.
/// Never returns the full key — only a masked version for UI display.
#[tauri::command]
pub async fn byok_get_key_preview(provider: String) -> Result<Option<String>, String> {
    ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;

    match super::get_api_key(&provider) {
        Ok(Some(key)) => Ok(Some(super::mask_api_key(&key))),
        Ok(None) => Ok(None),
        Err(e) => Err(e),
    }
}

/// List all providers with their key status.
#[tauri::command]
pub async fn byok_list_providers(_app: AppHandle) -> Result<Vec<ProviderKeyStatus>, String> {
    let mut results = Vec::new();
    for provider in ByokProvider::all() {
        let name = serde_json::to_value(&provider)
            .ok()
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_default();

        let has_key = super::has_api_key(&name);
        let preview = if has_key {
            super::get_api_key(&name)
                .ok()
                .flatten()
                .map(|k| super::mask_api_key(&k))
        } else {
            None
        };

        results.push(ProviderKeyStatus {
            provider: name,
            display_name: provider.display_name().to_string(),
            is_configured: has_key || !provider.requires_key(),
            key_preview: preview,
            requires_key: provider.requires_key(),
            default_base_url: provider.default_base_url().to_string(),
        });
    }

    Ok(results)
}

/// Delete an API key from the OS keyring.
#[tauri::command]
pub async fn byok_delete_key(app: AppHandle, provider: String) -> Result<(), String> {
    ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;

    super::delete_api_key(&provider)?;

    // Update settings to reflect the change
    settings::update_desktop_settings(&app, |next| {
        next.byok.refresh_configured_providers();
        // If the deleted provider was the active one, reset it
        if next.byok.active_provider.as_deref() == Some(&provider) {
            next.byok.active_provider = None;
            next.byok.active_model = None;
        }
    })?;

    Ok(())
}

/// Test a connection to an AI provider using the stored key.
/// Returns available models on success, or an error message on failure.
#[tauri::command]
pub async fn byok_test_connection(
    app: AppHandle,
    provider: String,
) -> Result<ConnectionTestResult, String> {
    ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;

    let settings = crate::settings::current_settings(&app);
    let base_url_overrides = settings.byok.base_url_overrides.clone();

    Ok(super::test_connection(&provider, &base_url_overrides).await)
}

/// Get the current BYOK settings.
#[tauri::command]
pub async fn byok_get_settings(app: AppHandle) -> Result<ByokSettings, String> {
    let settings = settings::current_settings(&app);
    Ok(settings.byok.clone())
}

/// Update BYOK settings (enable/disable, set active provider/model, etc.).
#[tauri::command]
pub async fn byok_update_settings(
    app: AppHandle,
    patch: ByokSettings,
) -> Result<ByokSettings, String> {
    settings::update_desktop_settings(&app, |next| {
        // Merge the patch — only update fields that are set (non-default)
        if patch.enabled != ByokSettings::default().enabled {
            next.byok.enabled = patch.enabled;
        }
        if patch.active_provider.is_some() {
            next.byok.active_provider = patch.active_provider;
        }
        if patch.active_model.is_some() {
            next.byok.active_model = patch.active_model;
        }
        if !patch.base_url_overrides.is_empty() {
            next.byok.base_url_overrides = patch.base_url_overrides;
        }
        if patch.onboarding_dismissed != ByokSettings::default().onboarding_dismissed {
            next.byok.onboarding_dismissed = patch.onboarding_dismissed;
        }
        next.byok.refresh_configured_providers();
    })?;

    let current = settings::current_settings(&app);
    Ok(current.byok.clone())
}

/// Toggle BYOK mode on/off.
#[tauri::command]
pub async fn byok_toggle_enabled(app: AppHandle, enabled: bool) -> Result<ByokSettings, String> {
    settings::update_desktop_settings(&app, |next| {
        next.byok.enabled = enabled;
        if !enabled {
            next.byok.active_provider = None;
            next.byok.active_model = None;
        }
    })?;

    let current = settings::current_settings(&app);
    Ok(current.byok.clone())
}

/// Validate an API key by calling the provider's validation endpoint.
/// Does NOT save the key — only checks if it's valid.
/// Returns the latency in ms on success, or an error on failure.
#[tauri::command]
pub async fn byok_validate_key(
    app: AppHandle,
    provider: String,
    key: String,
) -> Result<u64, String> {
    let byok_provider =
        ByokProvider::from_str(&provider).map_err(|_| format!("Unknown provider: {provider}"))?;

    if key.trim().is_empty() {
        return Err("API key cannot be empty.".to_string());
    }

    if byok_provider.requires_key() {
        validate_key_format(&byok_provider, &key)?;
    }

    let settings = crate::settings::current_settings(&app);
    let base_url_overrides = &settings.byok.base_url_overrides;

    let ai_provider = crate::ai::provider::create_provider(&provider, base_url_overrides)
        .map_err(|e| format!("Failed to create provider: {e}"))?;

    let start = std::time::Instant::now();
    ai_provider.validate_key(Some(&key)).await?;
    let elapsed = start.elapsed().as_millis() as u64;

    Ok(elapsed)
}

/// Dismiss the onboarding notice permanently.
#[tauri::command]
pub async fn byok_dismiss_onboarding(app: AppHandle) -> Result<(), String> {
    settings::update_desktop_settings(&app, |next| {
        next.byok.onboarding_dismissed = true;
    })?;
    Ok(())
}
