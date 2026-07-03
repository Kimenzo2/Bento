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

use rand::Rng;
use std::collections::HashMap;
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
) -> ConnectionTestResult {
    use std::time::Instant;
    let start = Instant::now();

    // Get the key (Ollama doesn't need one)
    let key = if <ByokProvider as FromStr>::from_str(provider)
        .map(|p: ByokProvider| p.requires_key())
        .unwrap_or(true)
    {
        match get_api_key(provider) {
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
