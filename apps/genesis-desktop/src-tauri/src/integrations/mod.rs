// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

pub mod apps;
pub mod auth;
pub mod commands;
pub mod native;
pub mod store;
pub mod tools;

const COMPOSIO_BASE: &str = "https://backend.composio.dev/api/v3.1";

/// Default per-request timeout for most Composio calls.
const DEFAULT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(60);
/// Longer timeout for tool execution, which can legitimately take a while.
const EXECUTE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(180);
/// Shorter timeout for metadata list endpoints.
const LIST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
/// Max retries for transient failures (transport errors / HTTP 429).
const MAX_RETRIES: u32 = 3;
/// Base backoff in ms; doubles per attempt when no Retry-After header is sent.
const BACKOFF_BASE_MS: u64 = 400;
/// Page size used when paginating `/toolkits`.
const TOOLKITS_PAGE_SIZE: u32 = 200;

pub use native::NativeFlow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthType {
    ManagedOAuth,
    ApiKey,
    CustomOAuth,
    Mixed,
    NoAuth,
    Native,
    Unavailable,
}

impl AuthType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ManagedOAuth => "managed_oauth",
            Self::ApiKey => "api_key",
            Self::CustomOAuth => "custom_oauth",
            Self::Mixed => "mixed",
            Self::NoAuth => "no_auth",
            Self::Native => "native",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum IntegrationCategory {
    Communication,
    Calendar,
    Finance,
    Health,
    Documents,
    Maps,
    Shopping,
    Social,
    Entertainment,
    Learning,
    Proactive,
    Home,
}

impl IntegrationCategory {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Communication => "Communication",
            Self::Calendar => "Calendar & Time",
            Self::Finance => "Money & Finance",
            Self::Health => "Health & Body",
            Self::Documents => "Documents & Files",
            Self::Maps => "Maps & Travel",
            Self::Shopping => "Shopping & Home",
            Self::Social => "Social & Identity",
            Self::Entertainment => "Entertainment & Media",
            Self::Learning => "Learning & Growth",
            Self::Proactive => "Proactive Intelligence",
            Self::Home => "Home & Environment",
        }
    }

    pub const ALL: &'static [IntegrationCategory] = &[
        Self::Communication,
        Self::Calendar,
        Self::Finance,
        Self::Health,
        Self::Documents,
        Self::Maps,
        Self::Shopping,
        Self::Social,
        Self::Entertainment,
        Self::Learning,
        Self::Proactive,
        Self::Home,
    ];
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppDefinition {
    pub key: String,
    pub name: String,
    pub description: String,
    pub category: IntegrationCategory,
    pub icon_key: String,
    pub auth_type: AuthType,
    /// Present only for `AuthType::Native` apps — tells the UI which connect
    /// flow to render (browser OAuth vs paste credential).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_flow: Option<NativeFlow>,
}

impl AppDefinition {
    pub fn icon_url(&self) -> String {
        format!("https://cdn.simpleicons.org/{}", self.icon_key)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IntegrationConnection {
    pub id: String,
    pub app_key: String,
    pub status: ConnectionStatus,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ConnectionStatus {
    Connected,
    Connecting,
    Disconnected,
    Error(String),
}

pub struct ComposioClient {
    api_key: String,
    client: reqwest::Client,
}

impl ComposioClient {
    pub fn new(api_key: &str) -> Self {
        let client = reqwest::Client::builder()
            // Base timeout; callers override with a per-request timeout where
            // the operation needs more or less headroom.
            .timeout(DEFAULT_TIMEOUT)
            .connect_timeout(std::time::Duration::from_secs(15))
            .build()
            .expect("reqwest Client::builder() should always succeed with default settings");
        Self {
            api_key: api_key.to_string(),
            client,
        }
    }

    fn headers(&self) -> Result<reqwest::header::HeaderMap, String> {
        let mut h = reqwest::header::HeaderMap::new();
        h.insert(
            "x-api-key",
            reqwest::header::HeaderValue::from_str(&self.api_key)
                .map_err(|e| format!("Invalid API key: {e}"))?,
        );
        h.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        Ok(h)
    }

    /// Send a request with retry-on-transient-failure semantics:
    ///   - network/transport errors are retried with exponential backoff;
    ///   - HTTP 429 honours `Retry-After` when present, otherwise backs off.
    /// Non-transient HTTP responses are returned as-is so callers can surface
    /// the real status + error body.
    async fn send_with_retry(
        client: &reqwest::Client,
        request: reqwest::Request,
    ) -> Result<reqwest::Response, String> {
        let mut attempt: u32 = 0;
        loop {
            let current = request
                .try_clone()
                .ok_or_else(|| "Request body is not retryable".to_string())?;
            let resp = match client.execute(current).await {
                Ok(r) => r,
                Err(e) if attempt < MAX_RETRIES => {
                    attempt += 1;
                    Self::backoff_sleep(attempt, None).await;
                    continue;
                }
                Err(e) => return Err(format!("Request failed: {e}")),
            };

            if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS && attempt < MAX_RETRIES {
                let retry_after = resp
                    .headers()
                    .get(reqwest::header::RETRY_AFTER)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok());
                attempt += 1;
                Self::backoff_sleep(attempt, retry_after).await;
                continue;
            }

            return Ok(resp);
        }
    }

    async fn backoff_sleep(attempt: u32, retry_after: Option<u64>) {
        let ms = retry_after
            .or_else(|| Some(BACKOFF_BASE_MS << attempt.saturating_sub(1).min(6)))
            .unwrap_or(BACKOFF_BASE_MS);
        tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
    }

    /// Extract a human-readable error message from a Composio error body.
    fn error_message(body: &serde_json::Value) -> String {
        for key in ["message", "error", "detail"] {
            if let Some(s) = body.get(key).and_then(|v| v.as_str()) {
                return s.to_string();
            }
        }
        serde_json::to_string(body).unwrap_or_default()
    }

    /// Validate the HTTP status of a response, consuming it into a typed body.
    async fn ensure_success<T: serde::de::DeserializeOwned>(
        resp: reqwest::Response,
        what: &str,
    ) -> Result<T, String> {
        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("{what}: failed to parse response body: {e}"))?;
        if !status.is_success() {
            return Err(format!(
                "{what} failed (HTTP {status}): {}",
                Self::error_message(&body)
            ));
        }
        serde_json::from_value(body).map_err(|e| format!("{what}: failed to deserialize: {e}"))
    }

    pub async fn test_connection(&self) -> Result<bool, String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/toolkits"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.query_pairs_mut().append_pair("limit", "1");
        let request = self
            .client
            .get(url)
            .headers(self.headers()?)
            .timeout(LIST_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Connection test failed: {e}"))?;
        Ok(resp.status().is_success())
    }

    pub async fn list_toolkits(&self) -> Result<Vec<ComposioToolkit>, String> {
        let mut all: Vec<ComposioToolkit> = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut page: u32 = 0;

        loop {
            let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/toolkits"))
                .map_err(|e| format!("Invalid URL: {e}"))?;
            url.query_pairs_mut()
                .append_pair("limit", &TOOLKITS_PAGE_SIZE.to_string())
                .append_pair("page", &page.to_string());
            let request = self
                .client
                .get(url)
                .headers(self.headers()?)
                .timeout(LIST_TIMEOUT)
                .build()
                .map_err(|e| format!("Failed to build request: {e}"))?;
            let resp = Self::send_with_retry(&self.client, request)
                .await
                .map_err(|e| format!("Failed to fetch toolkits: {e}"))?;

            let status = resp.status();
            let body: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse toolkits: {e}"))?;
            if !status.is_success() {
                return Err(format!(
                    "Failed to fetch toolkits (HTTP {status}): {}",
                    Self::error_message(&body)
                ));
            }

            let items = body["items"]
                .as_array()
                .ok_or_else(|| "Unexpected toolkits response".to_string())?
                .clone();
            if items.is_empty() {
                break;
            }

            let page_toolkits: Vec<ComposioToolkit> =
                serde_json::from_value(serde_json::Value::Array(items))
                    .map_err(|e| format!("Failed to deserialize toolkits: {e}"))?;

            let mut added = 0;
            for tk in page_toolkits {
                if seen.insert(tk.slug.clone()) {
                    all.push(tk);
                    added += 1;
                }
            }
            // Stop when the server stopped returning new entries (or doesn't
            // support pagination) to avoid an infinite loop.
            if added == 0 || (TOOLKITS_PAGE_SIZE as usize > 0 && added < TOOLKITS_PAGE_SIZE as usize) {
                break;
            }
            page += 1;
        }

        Ok(all)
    }

    pub async fn get_auth_config_id(
        &self,
        toolkit_slug: &str,
        custom_oauth: Option<(&str, &str)>,
    ) -> Result<String, String> {
        // Step 1: Try to find existing auth config
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/auth_configs"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.query_pairs_mut().append_pair("toolkit_slug", toolkit_slug);
        let request = self
            .client
            .get(url)
            .headers(self.headers()?)
            .timeout(LIST_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to fetch auth configs: {e}"))?;
        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse auth configs: {e}"))?;

        // Any non-success here (e.g. 401/403) means we must not silently fall
        // through to creating a new config — surface the real error instead.
        if !status.is_success() {
            return Err(format!(
                "Failed to fetch auth configs (HTTP {status}): {}",
                Self::error_message(&body)
            ));
        }

        if let Some(items) = body["items"].as_array() {
            for item in items {
                // A config whose `is_composio_managed` flag is absent is
                // treated as managed — only reuse configs that are explicitly
                // user-owned so we never silently ignore the user's creds.
                let is_managed = item
                    .get("is_composio_managed")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                if is_managed {
                    continue;
                }
                if let Some((client_id, _)) = custom_oauth {
                    // Reusing a config whose stored client_id differs from the
                    // user's would silently drop their credentials — create a
                    // fresh config instead.
                    let stored_client_id = item.get("client_id").and_then(|v| v.as_str());
                    if stored_client_id != Some(client_id) {
                        continue;
                    }
                }
                if let Some(id) = item["id"].as_str() {
                    return Ok(id.to_string());
                }
            }
        }

        // Step 2: Create new auth config
        let url = format!("{COMPOSIO_BASE}/auth_configs");
        let create_body = match custom_oauth {
            // Custom OAuth: tell Composio to use the user's own app credentials
            // instead of a Composio-managed OAuth app.
            Some((client_id, client_secret)) => serde_json::json!({
                "toolkit": { "slug": toolkit_slug },
                "auth_config": {
                    "type": "use_custom_auth",
                    "auth_scheme": "OAUTH2",
                    "credentials": {
                        "client_id": client_id,
                        "client_secret": client_secret,
                    }
                }
            }),
            None => serde_json::json!({
                "toolkit": { "slug": toolkit_slug }
            }),
        };
        let request = self
            .client
            .post(url)
            .headers(self.headers()?)
            .json(&create_body)
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to create auth config: {e}"))?;
        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse auth config creation: {e}"))?;

        if !status.is_success() {
            return Err(format!(
                "Create auth config failed (HTTP {status}): {}",
                Self::error_message(&body)
            ));
        }

        // Try multiple response shapes
        if let Some(id) = body["auth_config"]["id"].as_str() {
            return Ok(id.to_string());
        }
        if let Some(id) = body["id"].as_str() {
            return Ok(id.to_string());
        }
        if let Some(id) = body["data"]["id"].as_str() {
            return Ok(id.to_string());
        }
        if let Some(id) = body["toolkit"]["auth_config_id"].as_str() {
            return Ok(id.to_string());
        }

        Err(format!(
            "No auth_config_id found in response for '{}': {}",
            toolkit_slug,
            serde_json::to_string_pretty(&body).unwrap_or_default()
        ))
    }

    pub async fn create_auth_link(
        &self,
        auth_config_id: &str,
        user_id: &str,
        callback_url: &str,
    ) -> Result<ComposioAuthLink, String> {
        let url = format!("{COMPOSIO_BASE}/connected_accounts/link");
        let body = serde_json::json!({
            "auth_config_id": auth_config_id,
            "user_id": user_id,
            "callback_url": callback_url,
        });
        let request = self
            .client
            .post(url)
            .headers(self.headers()?)
            .json(&body)
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to create auth link: {e}"))?;
        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse auth link: {e}"))?;
        if !status.is_success() {
            return Err(format!(
                "Failed to create auth link (HTTP {status}): {}",
                Self::error_message(&body)
            ));
        }
        serde_json::from_value(body)
            .map_err(|e| format!("Failed to deserialize auth link: {e}"))
    }

    pub async fn list_connections(
        &self,
        user_id: &str,
    ) -> Result<Vec<ComposioConnectedAccount>, String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/connected_accounts"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.query_pairs_mut().append_pair("user_ids", user_id);
        let request = self
            .client
            .get(url)
            .headers(self.headers()?)
            .timeout(LIST_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to fetch connections: {e}"))?;
        Self::ensure_success(resp, "Fetch connections").await
    }

    pub async fn delete_connection(&self, connected_account_id: &str) -> Result<(), String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/connected_accounts"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.path_segments_mut()
            .map_err(|_| "Cannot modify URL path".to_string())?
            .push(connected_account_id);
        let request = self
            .client
            .delete(url)
            .headers(self.headers()?)
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to delete connection: {e}"))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body: serde_json::Value = resp
                .json()
                .await
                .unwrap_or(serde_json::Value::Null);
            return Err(format!(
                "Delete failed with status {status}: {}",
                Self::error_message(&body)
            ));
        }
        Ok(())
    }

    pub async fn execute_tool(
        &self,
        tool_slug: &str,
        connected_account_id: &str,
        entity_id: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/tools/execute"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.path_segments_mut()
            .map_err(|_| "Cannot modify URL path".to_string())?
            .push(tool_slug);
        let body = serde_json::json!({
            "connected_account_id": connected_account_id,
            "entity_id": entity_id,
            "arguments": arguments,
        });
        let request = self
            .client
            .post(url)
            .headers(self.headers()?)
            .json(&body)
            .timeout(EXECUTE_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to execute tool: {e}"))?;
        // BUG-1: never return an error envelope as Ok — surface HTTP failures.
        Self::ensure_success(resp, "Tool execution").await
    }

    /// Execute a tool for an app that authenticates with an API key rather than a
    /// Composio connected account. Composio accepts the key via
    /// `custom_connection_data` with `authScheme: "API_KEY"` (verified against
    /// their v3.1 API reference).
    pub async fn execute_tool_with_api_key(
        &self,
        tool_slug: &str,
        toolkit_slug: &str,
        api_key: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/tools/execute"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.path_segments_mut()
            .map_err(|_| "Cannot modify URL path".to_string())?
            .push(tool_slug);
        let body = serde_json::json!({
            "custom_connection_data": {
                "authScheme": "API_KEY",
                "toolkitSlug": toolkit_slug,
                "val": { "api_key": api_key }
            },
            "arguments": arguments,
        });
        let request = self
            .client
            .post(url)
            .headers(self.headers()?)
            .json(&body)
            .timeout(EXECUTE_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to execute tool: {e}"))?;
        // BUG-2: never return an error envelope as Ok — surface HTTP failures.
        Self::ensure_success(resp, "Tool execution").await
    }

    /// Execute a public (no-auth) tool. Composio executes these without a
    /// connected account — sending a literal placeholder id would be rejected.
    pub async fn execute_tool_no_auth(
        &self,
        tool_slug: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/tools/execute"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.path_segments_mut()
            .map_err(|_| "Cannot modify URL path".to_string())?
            .push(tool_slug);
        let body = serde_json::json!({
            "arguments": arguments,
        });
        let request = self
            .client
            .post(url)
            .headers(self.headers()?)
            .json(&body)
            .timeout(EXECUTE_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to execute tool: {e}"))?;
        Self::ensure_success(resp, "Tool execution").await
    }

    pub async fn list_tools(&self, toolkit_slug: &str) -> Result<Vec<ComposioTool>, String> {
        let mut url = url::Url::parse(&format!("{COMPOSIO_BASE}/tools"))
            .map_err(|e| format!("Invalid URL: {e}"))?;
        url.query_pairs_mut().append_pair("toolkit_slugs", toolkit_slug);
        let request = self
            .client
            .get(url)
            .headers(self.headers()?)
            .timeout(LIST_TIMEOUT)
            .build()
            .map_err(|e| format!("Failed to build request: {e}"))?;
        let resp = Self::send_with_retry(&self.client, request)
            .await
            .map_err(|e| format!("Failed to fetch tools: {e}"))?;
        Self::ensure_success(resp, "Fetch tools").await
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ComposioToolkit {
    pub slug: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub logo: Option<String>,
    #[serde(default)]
    pub categories: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ComposioTool {
    pub slug: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub toolkit_slug: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ComposioAuthLink {
    pub redirect_url: String,
    #[serde(default)]
    pub connected_account_id: Option<String>,
    #[serde(default)]
    pub link_token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ComposioConnectedAccount {
    pub id: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub toolkit: Option<ComposioToolkitRef>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ComposioToolkitRef {
    pub slug: String,
}

pub use apps::curated_apps;
