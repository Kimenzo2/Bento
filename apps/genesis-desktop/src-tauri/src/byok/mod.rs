//! BYOK — Bring Your Own Key (Power Plan feature)
//!
//! Users on the Power plan can store their own API keys for AI providers
//! (OpenAI, Anthropic, Gemini, Grok, Ollama).
//!
//! Architecture:
//!   - Primary storage: OS keyring (Windows Credential Manager, macOS Keychain,
//!     Linux Secret Service) via the `keyring` crate.
//!   - Fallback storage: `DesktopSettings.byok.fallback_keys` (base64-encoded)
//!     — used when the OS keyring is unavailable or fails.
//!   - Each key is stored in the keyring as a separate entry:
//!     service = "Bento Desktop BYOK", account = "{provider}".
//!   - Provider metadata (which providers have keys configured) is tracked
//!     in `DesktopSettings.byok.configured_providers`.
//!   - Keys are never sent to any server — they stay on the local machine.

pub mod commands;

use base64::Engine as _;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Canonical provider identifiers.
/// Each corresponds to a known AI API provider.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ByokProvider {
    OpenAI,
    Anthropic,
    Gemini,
    Grok,
    OpenRouter,
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
            "openrouter" => Ok(Self::OpenRouter),
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
            Self::OpenRouter,
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
            Self::OpenRouter => "OpenRouter",
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
            Self::OpenRouter => "https://openrouter.ai/api/v1",
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
            Self::Gemini => vec![
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.0-flash",
            ],
            Self::Grok => vec!["grok-3", "grok-3-mini", "grok-2"],
            Self::OpenRouter => vec![
                "openai/gpt-4o",
                "openai/gpt-4o-mini",
                "openai/gpt-4.1",
                "openai/gpt-4.1-mini",
                "anthropic/claude-sonnet-4",
                "anthropic/claude-haiku-4.5",
                "google/gemini-2.5-pro",
                "google/gemini-2.5-flash",
                "meta-llama/llama-4-scout",
                "meta-llama/llama-4-maverick",
                "deepseek/deepseek-chat",
                "mistral/mistral-large-latest",
            ],
            Self::Ollama => vec![], // Models are fetched dynamically from the server
        }
    }
}

// ── Key Storage Operations ────────────────────────────────────────────────────

const BYOK_KEYRING_SERVICE: &str = "Bento Desktop BYOK";

/// Store an API key for a provider.
///
/// Always stores in `settings.fallback_keys` (base64-encoded) as a safety net.
/// Also best-effort stores in the OS keyring — failures there are logged but
/// do not prevent the save from succeeding.
pub fn save_api_key(provider: &str, key: &str, settings: &mut ByokSettings) {
    use base64::engine::general_purpose::STANDARD as BASE64;

    settings
        .fallback_keys
        .insert(provider.to_string(), BASE64.encode(key.as_bytes()));

    match Entry::new(BYOK_KEYRING_SERVICE, provider) {
        Ok(entry) => {
            if let Err(e) = entry.set_password(key) {
                eprintln!("[byok] Keyring save failed for {provider}: {e}");
            }
        }
        Err(e) => {
            eprintln!("[byok] Keyring entry creation failed for {provider}: {e}");
        }
    }
}

/// Retrieve an API key for a provider.
///
/// Tries the OS keyring first; falls back to `settings.fallback_keys` (base64).
pub fn get_api_key(provider: &str, settings: &ByokSettings) -> Result<Option<String>, String> {
    use base64::engine::general_purpose::STANDARD as BASE64;

    if let Ok(entry) = Entry::new(BYOK_KEYRING_SERVICE, provider) {
        match entry.get_password() {
            Ok(key) => return Ok(Some(key)),
            Err(keyring::Error::NoEntry) => { /* check fallback */ }
            Err(e) => {
                eprintln!("[byok] Keyring read failed for {provider}: {e}");
            }
        }
    }

    Ok(settings
        .fallback_keys
        .get(provider)
        .and_then(|encoded| {
            BASE64
                .decode(encoded.as_bytes())
                .ok()
                .and_then(|bytes| String::from_utf8(bytes).ok())
        }))
}

/// Delete an API key for a provider from both keyring and fallback.
pub fn delete_api_key(provider: &str, settings: &mut ByokSettings) {
    settings.fallback_keys.remove(provider);

    match Entry::new(BYOK_KEYRING_SERVICE, provider) {
        Ok(entry) => {
            if let Err(e) = entry.delete_credential() {
                if !matches!(e, keyring::Error::NoEntry) {
                    eprintln!("[byok] Keyring delete failed for {provider}: {e}");
                }
            }
        }
        Err(e) => {
            eprintln!("[byok] Keyring entry creation failed for {provider}: {e}");
        }
    }
}

/// Check whether a key exists for a provider (keyring or fallback).
pub fn has_api_key(provider: &str, settings: &ByokSettings) -> bool {
    if settings.fallback_keys.contains_key(provider) {
        return true;
    }
    if let Ok(entry) = Entry::new(BYOK_KEYRING_SERVICE, provider) {
        if entry.get_password().is_ok() {
            return true;
        }
    }
    false
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
///
/// Primary key storage: OS keyring (Windows Credential Manager, macOS Keychain,
/// Linux Secret Service). Fallback: `fallback_keys` in this JSON file (base64
/// encoded) — used when the OS keyring is unavailable or fails.
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

    /// List of providers that have keys configured.
    /// This is a cached list — verified on load and refreshed on save/delete.
    #[serde(default)]
    pub configured_providers: Vec<String>,

    /// Optional base URL override for Ollama (or other self-hosted providers).
    #[serde(default)]
    pub base_url_overrides: HashMap<String, String>,

    /// Whether the user has dismissed the BYOK onboarding notice.
    #[serde(default)]
    pub onboarding_dismissed: bool,

    /// Fallback key storage when the OS keyring is unavailable.
    /// Keys are base64-encoded (obfuscated, not encrypted — the OS keyring is
    /// the primary secure storage). This ensures keys survive keyring failures.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub fallback_keys: HashMap<String, String>,
}

/// Partial patch for updating BYOK settings.
/// All fields are optional — only provided fields are applied.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ByokSettingsPatch {
    pub enabled: Option<bool>,
    pub active_provider: Option<String>,
    pub active_model: Option<String>,
    pub base_url_overrides: HashMap<String, String>,
    pub onboarding_dismissed: Option<bool>,
    pub fallback_keys: HashMap<String, String>,
}

impl ByokSettings {
    /// Apply a partial patch to these settings.
    pub fn apply_patch(&mut self, patch: ByokSettingsPatch) {
        if let Some(v) = patch.enabled {
            self.enabled = v;
        }
        if patch.active_provider.is_some() {
            self.active_provider = patch.active_provider;
        }
        if patch.active_model.is_some() {
            self.active_model = patch.active_model;
        }
        if !patch.base_url_overrides.is_empty() {
            self.base_url_overrides = patch.base_url_overrides;
        }
        if let Some(v) = patch.onboarding_dismissed {
            self.onboarding_dismissed = v;
        }
        self.fallback_keys.extend(patch.fallback_keys);
        self.refresh_configured_providers();
    }

    /// Verify which providers actually have keys, and update the configured list.
    pub fn refresh_configured_providers(&mut self) {
        let mut configured = Vec::new();
        for provider in ByokProvider::all() {
            let name = serde_json::to_value(&provider)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_default();
            if has_api_key(&name, self) || !provider.requires_key() {
                configured.push(name);
            }
        }
        self.configured_providers = configured;
    }

    /// Returns true if a provider is configured (has a key or is local).
    pub fn is_provider_configured(&self, provider: &str) -> bool {
        if self.configured_providers.iter().any(|p| p == provider) {
            return true;
        }
        has_api_key(provider, self)
    }
}

// ── Connection Testing ───────────────────────────────────────────────────────

use rand::Rng;
use std::str::FromStr;
use std::sync::OnceLock;
use std::time::Duration;

/// Structured error code for test connection failures.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum ConnectionErrorCode {
    NoKey,
    KeyringError,
    NetworkError,
    DnsFailure,
    Timeout,
    SslError,
    AuthFailed,
    RateLimited,
    ServerError,
    ParseError,
    UnknownProvider,
    Offline,
    Unknown,
}

/// Structured connection error with a machine-readable code and human message.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionError {
    pub code: ConnectionErrorCode,
    pub message: String,
    pub status_code: Option<u16>,
}

impl std::fmt::Display for ConnectionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

/// Result of testing a connection to an AI provider.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub error: Option<ConnectionError>,
    pub latency_ms: Option<u64>,
    pub available_models: Vec<String>,
}

fn classify_reqwest_error(e: &reqwest::Error) -> (ConnectionErrorCode, Option<u16>) {
    if e.is_timeout() {
        return (ConnectionErrorCode::Timeout, None);
    }
    if e.is_connect() {
        if e.to_string().contains("dns") || e.to_string().contains("resolve") {
            return (ConnectionErrorCode::DnsFailure, None);
        }
        if e.to_string().contains("ssl") || e.to_string().contains("certificate") {
            return (ConnectionErrorCode::SslError, None);
        }
        return (ConnectionErrorCode::NetworkError, None);
    }
    if e.is_status() {
        if let Some(status) = e.status() {
            let code = status.as_u16();
            match code {
                401 | 403 => return (ConnectionErrorCode::AuthFailed, Some(code)),
                429 => return (ConnectionErrorCode::RateLimited, Some(code)),
                s if s >= 500 => return (ConnectionErrorCode::ServerError, Some(code)),
                _ => return (ConnectionErrorCode::Unknown, Some(code)),
            }
        }
    }
    (ConnectionErrorCode::NetworkError, None)
}

fn classify_status_code(status: u16) -> ConnectionErrorCode {
    match status {
        401 | 403 => ConnectionErrorCode::AuthFailed,
        429 => ConnectionErrorCode::RateLimited,
        s if s >= 500 => ConnectionErrorCode::ServerError,
        _ => ConnectionErrorCode::Unknown,
    }
}

/// Build (or retrieve from cache) a reqwest client for test connections.
/// Cached globally so connection pools are reused across test calls.
fn test_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|e| format!("Failed to build HTTP client: {e}"))
        })
        .as_ref()
        .map_err(|e| e.clone())
}

const RETRY_BASE_MS: u64 = 500;
const RETRY_MAX_MS: u64 = 30_000;

/// Compute exponential backoff delay with full jitter for a given attempt (0-indexed).
fn backoff_delay(attempt: u32) -> Duration {
    let exp = RETRY_BASE_MS * 2u64.saturating_pow(attempt);
    let capped = exp.min(RETRY_MAX_MS);
    let jittered = rand::thread_rng().gen_range(0..=capped);
    Duration::from_millis(jittered)
}

/// Retry a single HTTP request up to `max_retries` times with exponential backoff + full jitter.
/// Respects `Retry-After` headers on 429 responses.
/// Only retries transient failures (NetworkError, Timeout, DnsFailure, 5xx, 429).
async fn retry_request(
    _client: &reqwest::Client,
    build_request: impl Fn() -> reqwest::RequestBuilder,
    max_retries: u32,
) -> Result<reqwest::Response, ConnectionError> {
    let mut last_err = None;
    for attempt in 0..=max_retries {
        let req = build_request();
        match req.send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                if status >= 500 && attempt < max_retries {
                    tokio::time::sleep(backoff_delay(attempt)).await;
                    last_err = Some(ConnectionError {
                        code: ConnectionErrorCode::ServerError,
                        message: format!("Server returned {status}, retrying..."),
                        status_code: Some(status),
                    });
                    continue;
                }
                if status == 429 && attempt < max_retries {
                    let retry_after = resp
                        .headers()
                        .get("retry-after")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| s.parse::<u64>().ok())
                        .map(Duration::from_secs)
                        .unwrap_or_else(|| backoff_delay(attempt));
                    tokio::time::sleep(retry_after).await;
                    last_err = Some(ConnectionError {
                        code: ConnectionErrorCode::RateLimited,
                        message: "Rate limited, retrying...".to_string(),
                        status_code: Some(429),
                    });
                    continue;
                }
                return Ok(resp);
            }
            Err(e) => {
                let (code, sc) = classify_reqwest_error(&e);
                let can_retry = matches!(
                    code,
                    ConnectionErrorCode::NetworkError
                        | ConnectionErrorCode::Timeout
                        | ConnectionErrorCode::DnsFailure
                );
                if can_retry && attempt < max_retries {
                    tokio::time::sleep(backoff_delay(attempt)).await;
                    last_err = Some(ConnectionError {
                        code,
                        message: e.to_string(),
                        status_code: sc,
                    });
                    continue;
                }
                return Err(ConnectionError {
                    code,
                    message: e.to_string(),
                    status_code: sc,
                });
            }
        }
    }
    Err(last_err.unwrap_or(ConnectionError {
        code: ConnectionErrorCode::Unknown,
        message: "Max retries reached".to_string(),
        status_code: None,
    }))
}

/// Test a connection to an AI provider using the stored key.
/// Uses free validation endpoints (list models) where possible.
/// Accepts base URL overrides for self-hosted providers like Ollama.
pub async fn test_connection(
    provider: &str,
    base_url_overrides: &HashMap<String, String>,
    byok: &ByokSettings,
) -> ConnectionTestResult {
    use std::time::Instant;
    let start = Instant::now();

    // Get the key (Ollama doesn't need one)
    let key = if <ByokProvider as FromStr>::from_str(provider)
        .map(|p: ByokProvider| p.requires_key())
        .unwrap_or(true)
    {
        match get_api_key(provider, byok) {
            Ok(Some(k)) => Some(k),
            Ok(None) => {
                return ConnectionTestResult {
                    ok: false,
                    error: Some(ConnectionError {
                        code: ConnectionErrorCode::NoKey,
                        message: format!("No API key configured for {provider}"),
                        status_code: None,
                    }),
                    latency_ms: None,
                    available_models: Vec::new(),
                };
            }
            Err(e) => {
                return ConnectionTestResult {
                    ok: false,
                    error: Some(ConnectionError {
                        code: ConnectionErrorCode::KeyringError,
                        message: format!("Keyring error: {e}"),
                        status_code: None,
                    }),
                    latency_ms: None,
                    available_models: Vec::new(),
                };
            }
        }
    } else {
        None
    };

    let client = match test_client() {
        Ok(c) => c,
        Err(e) => {
            return ConnectionTestResult {
                ok: false,
                error: Some(ConnectionError {
                    code: ConnectionErrorCode::Unknown,
                    message: e,
                    status_code: None,
                }),
                latency_ms: None,
                available_models: Vec::new(),
            };
        }
    };

    let result = match provider {
        "openai" => {
            let base_url = base_url_overrides
                .get("openai")
                .map(|s| s.as_str())
                .unwrap_or("https://api.openai.com/v1");
            test_openai_connection(client, &key.unwrap_or_default(), base_url).await
        }
        "anthropic" => {
            let base_url = base_url_overrides
                .get("anthropic")
                .map(|s| s.as_str())
                .unwrap_or("https://api.anthropic.com/v1");
            test_anthropic_connection(client, &key.unwrap_or_default(), base_url).await
        }
        "gemini" => {
            let base_url = base_url_overrides
                .get("gemini")
                .map(|s| s.as_str())
                .unwrap_or("https://generativelanguage.googleapis.com/v1beta");
            test_gemini_connection(client, &key.unwrap_or_default(), base_url).await
        }
        "grok" => {
            let base_url = base_url_overrides
                .get("grok")
                .map(|s| s.as_str())
                .unwrap_or("https://api.x.ai/v1");
            test_grok_connection(client, &key.unwrap_or_default(), base_url).await
        }
        "openrouter" => {
            let base_url = base_url_overrides
                .get("openrouter")
                .map(|s| s.as_str())
                .unwrap_or("https://openrouter.ai/api/v1");
            // OpenRouter is OpenAI-compatible, reuse the same connection test.
            test_openai_connection(client, &key.unwrap_or_default(), base_url).await
        }
        "ollama" => {
            let base_url = base_url_overrides
                .get("ollama")
                .map(|s| s.as_str())
                .unwrap_or("http://localhost:11434");
            test_ollama_connection(client, base_url).await
        }
        _ => Err(ConnectionError {
            code: ConnectionErrorCode::UnknownProvider,
            message: format!("Unknown provider: {provider}"),
            status_code: None,
        }),
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

/// Test connection via list-models endpoint (free, no token cost).
async fn test_openai_connection(
    client: &reqwest::Client,
    key: &str,
    base_url: &str,
) -> Result<Vec<String>, ConnectionError> {
    // Use validate_key-style: GET /models — free endpoint.
    let resp = retry_request(
        client,
        || {
            client
                .get(format!("{base_url}/models"))
                .header("Authorization", format!("Bearer {key}"))
        },
        1,
    )
    .await?;

    match resp.status().as_u16() {
        200 => {}
        401 | 403 => {
            return Err(ConnectionError {
                code: ConnectionErrorCode::AuthFailed,
                message: "Invalid API key".to_string(),
                status_code: Some(resp.status().as_u16()),
            });
        }
        status => {
            return Err(ConnectionError {
                code: classify_status_code(status),
                message: format!("OpenAI returned HTTP {status}"),
                status_code: Some(status),
            });
        }
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| ConnectionError {
        code: ConnectionErrorCode::ParseError,
        message: format!("Parse error: {e}"),
        status_code: None,
    })?;

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

/// Test Anthropic connection via models list endpoint (free, no cost).
async fn test_anthropic_connection(
    client: &reqwest::Client,
    key: &str,
    base_url: &str,
) -> Result<Vec<String>, ConnectionError> {
    let resp = retry_request(
        client,
        || {
            client
                .get(format!("{base_url}/models"))
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
        },
        1,
    )
    .await?;

    match resp.status().as_u16() {
        200 => {}
        401 | 403 => {
            return Err(ConnectionError {
                code: ConnectionErrorCode::AuthFailed,
                message: "Invalid API key".to_string(),
                status_code: Some(resp.status().as_u16()),
            });
        }
        status => {
            return Err(ConnectionError {
                code: classify_status_code(status),
                message: format!("Anthropic returned HTTP {status}"),
                status_code: Some(status),
            });
        }
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| ConnectionError {
        code: ConnectionErrorCode::ParseError,
        message: format!("Parse error: {e}"),
        status_code: None,
    })?;

    let models: Vec<String> = body["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    if models.is_empty() {
        Ok(ByokProvider::Anthropic
            .known_models()
            .into_iter()
            .map(String::from)
            .collect())
    } else {
        Ok(models)
    }
}

/// Test Gemini connection via models list endpoint.
/// Uses `x-goog-api-key` header (not query param) per Google security best practices.
async fn test_gemini_connection(
    client: &reqwest::Client,
    key: &str,
    base_url: &str,
) -> Result<Vec<String>, ConnectionError> {
    let resp = retry_request(
        client,
        || {
            client
                .get(format!("{base_url}/models"))
                .header("x-goog-api-key", key)
        },
        1,
    )
    .await?;

    match resp.status().as_u16() {
        200 => {}
        401 | 403 => {
            return Err(ConnectionError {
                code: ConnectionErrorCode::AuthFailed,
                message: "Invalid API key".to_string(),
                status_code: Some(resp.status().as_u16()),
            });
        }
        status => {
            return Err(ConnectionError {
                code: classify_status_code(status),
                message: format!("Gemini returned HTTP {status}"),
                status_code: Some(status),
            });
        }
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| ConnectionError {
        code: ConnectionErrorCode::ParseError,
        message: format!("Parse error: {e}"),
        status_code: None,
    })?;

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

/// Test Grok connection via models list endpoint (free).
async fn test_grok_connection(
    client: &reqwest::Client,
    key: &str,
    base_url: &str,
) -> Result<Vec<String>, ConnectionError> {
    let resp = retry_request(
        client,
        || {
            client
                .get(format!("{base_url}/models"))
                .header("Authorization", format!("Bearer {key}"))
        },
        1,
    )
    .await?;

    match resp.status().as_u16() {
        200 => {}
        401 | 403 => {
            return Err(ConnectionError {
                code: ConnectionErrorCode::AuthFailed,
                message: "Invalid API key".to_string(),
                status_code: Some(resp.status().as_u16()),
            });
        }
        status => {
            return Err(ConnectionError {
                code: classify_status_code(status),
                message: format!("Grok returned HTTP {status}"),
                status_code: Some(status),
            });
        }
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| ConnectionError {
        code: ConnectionErrorCode::ParseError,
        message: format!("Parse error: {e}"),
        status_code: None,
    })?;

    let models: Vec<String> = body["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

/// Test Ollama connection using base_url from settings.
async fn test_ollama_connection(
    client: &reqwest::Client,
    base_url: &str,
) -> Result<Vec<String>, ConnectionError> {
    let resp = retry_request(
        client,
        || {
            client
                .get(format!("{base_url}/api/tags"))
                .timeout(Duration::from_secs(5))
        },
        1,
    )
    .await?;

    match resp.status().as_u16() {
        200 => {}
        status => {
            return Err(ConnectionError {
                code: classify_status_code(status),
                message: format!("Ollama returned HTTP {status}"),
                status_code: Some(status),
            });
        }
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| ConnectionError {
        code: ConnectionErrorCode::ParseError,
        message: format!("Parse error: {e}"),
        status_code: None,
    })?;

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
