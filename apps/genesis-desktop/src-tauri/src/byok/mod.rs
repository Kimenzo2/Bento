//! BYOK — Bring Your Own Key (Power Plan feature)
//!
//! Users on the Power plan can store their own API keys for AI providers
//! (OpenAI, Anthropic, Gemini, Grok, Ollama) in the OS keyring.
//!
//! Architecture:
//!   - Each key is stored as a separate keyring entry:
//!     service = "Bento Desktop BYOK"
//!     account = "{provider}"
//!   - Provider metadata (which providers have keys configured) is tracked
//!     in `DesktopSettings.byok` so we don't have to iterate all keyring entries.
//!   - Keys are never sent to any server — they stay in the local keyring.

pub mod commands;

use keyring::Entry;
use serde::{Deserialize, Serialize};

/// Canonical provider identifiers.
/// Each corresponds to a known AI API provider.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ByokProvider {
    OpenAI,
    Anthropic,
    Gemini,
    Grok,
    Ollama,
}

impl std::str::FromStr for ByokProvider {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_lowercase().as_str() {
            "openai" => Ok(Self::OpenAI),
            "anthropic" => Ok(Self::Anthropic),
            "gemini" => Ok(Self::Gemini),
            "grok" => Ok(Self::Grok),
            "ollama" => Ok(Self::Ollama),
            other => Err(format!("Unknown BYOK provider: {other}")),
        }
    }
}

impl ByokProvider {
    /// All supported providers.
    pub fn all() -> Vec<Self> {
        vec![
            Self::OpenAI,
            Self::Anthropic,
            Self::Gemini,
            Self::Grok,
            Self::Ollama,
        ]
    }

    /// Human-readable display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::OpenAI => "OpenAI",
            Self::Anthropic => "Anthropic",
            Self::Gemini => "Gemini (Google)",
            Self::Grok => "Grok (xAI)",
            Self::Ollama => "Ollama (Local)",
        }
    }

    /// Whether this provider requires an API key (Ollama is local, optional).
    pub fn requires_key(&self) -> bool {
        !matches!(self, Self::Ollama)
    }

    /// Default base URL for API requests.
    pub fn default_base_url(&self) -> &'static str {
        match self {
            Self::OpenAI => "https://api.openai.com/v1",
            Self::Anthropic => "https://api.anthropic.com/v1",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta",
            Self::Grok => "https://api.x.ai/v1",
            Self::Ollama => "http://localhost:11434",
        }
    }

    /// Known model IDs for this provider.
    pub fn known_models(&self) -> Vec<&'static str> {
        match self {
            Self::OpenAI => vec![
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4.1-nano",
                "o3",
                "o3-mini",
                "o4-mini",
            ],
            Self::Anthropic => vec![
                "claude-sonnet-4-20250514",
                "claude-sonnet-4",
                "claude-haiku-4-5-20251001",
                "claude-opus-4-5",
            ],
            Self::Gemini => vec!["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
            Self::Grok => vec!["grok-3", "grok-3-mini", "grok-2"],
            Self::Ollama => vec![], // Models are fetched dynamically from the server
        }
    }
}

// ── Keyring Operations ───────────────────────────────────────────────────────

const BYOK_KEYRING_SERVICE: &str = "Bento Desktop BYOK";

/// Store an API key for a provider in the OS keyring.
pub fn save_api_key(provider: &str, key: &str) -> Result<(), String> {
    let entry =
        Entry::new(BYOK_KEYRING_SERVICE, provider).map_err(|e| format!("Keyring error: {e}"))?;
    entry
        .set_password(key)
        .map_err(|e| format!("Failed to save key for {provider}: {e}"))
}

/// Retrieve an API key from the OS keyring.
/// Returns `Ok(None)` if no key is stored for this provider.
pub fn get_api_key(provider: &str) -> Result<Option<String>, String> {
    let entry =
        Entry::new(BYOK_KEYRING_SERVICE, provider).map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read key for {provider}: {e}")),
    }
}

/// Delete an API key from the OS keyring.
pub fn delete_api_key(provider: &str) -> Result<(), String> {
    let entry =
        Entry::new(BYOK_KEYRING_SERVICE, provider).map_err(|e| format!("Keyring error: {e}"))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already absent — not an error
        Err(e) => Err(format!("Failed to delete key for {provider}: {e}")),
    }
}

/// Check whether a key exists in the keyring for a given provider.
pub fn has_api_key(provider: &str) -> bool {
    get_api_key(provider).ok().flatten().is_some()
}

/// Return the masked version of a key for display (e.g. "sk-...abcd").
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "••••••••".to_string();
    }
    let prefix = &key[..4];
    let suffix = &key[key.len() - 4..];
    format!("{prefix}••••{suffix}")
}

// ── Settings Integration ─────────────────────────────────────────────────────

/// BYOK settings stored in DesktopSettings.
/// Note: the actual API keys are stored in the OS keyring, NOT in settings.json.
/// This struct only tracks which providers are configured and the user's preferences.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ByokSettings {
    /// Whether BYOK mode is enabled (only meaningful for Power plan users).
    #[serde(default)]
    pub enabled: bool,

    /// The currently active provider (for AI features).
    #[serde(default)]
    pub active_provider: Option<String>,

    /// The currently active model for the active provider.
    #[serde(default)]
    pub active_model: Option<String>,

    /// List of providers that have keys configured in the keyring.
    /// This is a cached list — we check the keyring on load to verify.
    #[serde(default)]
    pub configured_providers: Vec<String>,

    /// Optional base URL override for Ollama (or other self-hosted providers).
    #[serde(default)]
    pub base_url_overrides: std::collections::HashMap<String, String>,

    /// Whether the user has dismissed the BYOK onboarding notice.
    #[serde(default)]
    pub onboarding_dismissed: bool,
}



impl ByokSettings {
    /// Verify which providers actually have keys, and update the configured list.
    pub fn refresh_configured_providers(&mut self) {
        let mut configured = Vec::new();
        for provider in ByokProvider::all() {
            let name = serde_json::to_value(&provider)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_default();
            if has_api_key(&name) || !provider.requires_key() {
                configured.push(name);
            }
        }
        self.configured_providers = configured;
    }

    /// Returns true if a provider is configured (has a key or is local).
    pub fn is_provider_configured(&self, provider: &str) -> bool {
        // Check the cached list first
        if self.configured_providers.iter().any(|p| p == provider) {
            return true;
        }
        // Fall back to checking the keyring directly
        has_api_key(provider)
    }
}

// ── Connection Testing ───────────────────────────────────────────────────────

/// Result of testing a connection to an AI provider.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
    pub available_models: Vec<String>,
}

/// Test a connection to an AI provider using the stored key.
/// This performs a lightweight API call (list models or a simple completion).
pub async fn test_connection(provider: &str) -> ConnectionTestResult {
    use std::time::Instant;
    let start = Instant::now();

    // Get the key
    let key = match get_api_key(provider) {
        Ok(Some(k)) => k,
        Ok(None) => {
            return ConnectionTestResult {
                ok: false,
                error: Some(format!("No API key configured for {provider}")),
                latency_ms: None,
                available_models: Vec::new(),
            };
        }
        Err(e) => {
            return ConnectionTestResult {
                ok: false,
                error: Some(format!("Keyring error: {e}")),
                latency_ms: None,
                available_models: Vec::new(),
            };
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    let result = match provider {
        "openai" => test_openai_connection(&client, &key).await,
        "anthropic" => test_anthropic_connection(&client, &key).await,
        "gemini" => test_gemini_connection(&client, &key).await,
        "grok" => test_grok_connection(&client, &key).await,
        "ollama" => test_ollama_connection(&client).await,
        _ => Err(format!("Unknown provider: {provider}")),
    };

    let elapsed = start.elapsed().as_millis() as u64;

    match result {
        Ok(models) => ConnectionTestResult {
            ok: true,
            error: None,
            latency_ms: Some(elapsed),
            available_models: models,
        },
        Err(e) => ConnectionTestResult {
            ok: false,
            error: Some(e),
            latency_ms: Some(elapsed),
            available_models: Vec::new(),
        },
    }
}

async fn test_openai_connection(
    client: &reqwest::Client,
    key: &str,
) -> Result<Vec<String>, String> {
    let resp = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {key}"))
        .send()
        .await
        .map_err(|e| format!("OpenAI connection failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI returned {status}: {body}"));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
    let models = body["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

async fn test_anthropic_connection(
    client: &reqwest::Client,
    key: &str,
) -> Result<Vec<String>, String> {
    // Anthropic doesn't have a list-models endpoint that's easily accessible.
    // We'll do a lightweight ping instead.
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic connection failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic returned {status}: {body}"));
    }

    // Return the known models for Anthropic
    let provider = ByokProvider::Anthropic;
    Ok(provider
        .known_models()
        .into_iter()
        .map(String::from)
        .collect())
}

async fn test_gemini_connection(
    client: &reqwest::Client,
    key: &str,
) -> Result<Vec<String>, String> {
    let resp = client
        .get(format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={key}"
        ))
        .send()
        .await
        .map_err(|e| format!("Gemini connection failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini returned {status}: {body}"));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
    let models = body["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

async fn test_grok_connection(client: &reqwest::Client, key: &str) -> Result<Vec<String>, String> {
    let resp = client
        .get("https://api.x.ai/v1/models")
        .header("Authorization", format!("Bearer {key}"))
        .send()
        .await
        .map_err(|e| format!("Grok connection failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Grok returned {status}: {body}"));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
    let models = body["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

async fn test_ollama_connection(client: &reqwest::Client) -> Result<Vec<String>, String> {
    let resp = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("Ollama connection failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {body}"));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
    let models = body["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}
