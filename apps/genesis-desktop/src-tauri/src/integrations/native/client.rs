// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::integrations::native::registry::{
    native_config, AuthInjection, NativeAction, NativeAppConfig, NativeMethod,
};
use crate::integrations::native::token::NativeCredentials;
use base64::Engine as _;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

const MAX_RETRIES: u32 = 3;
const BASE_BACKOFF_MS: u64 = 500;

/// Executes a native action against the app's configured API.
///
/// Every outbound call goes through this one chokepoint so the domain
/// allowlist and auth injection are enforced uniformly.
/// Includes retry with exponential backoff for transient failures (429, 5xx, network).
pub async fn execute(
    app_key: &str,
    action_slug: &str,
    input: Value,
) -> Result<Value, String> {
    let app = native_config(app_key)
        .ok_or_else(|| format!("Unknown native integration '{app_key}'"))?;
    let action = app
        .actions
        .iter()
        .find(|a| a.slug == action_slug)
        .ok_or_else(|| format!("Unknown action '{action_slug}' for '{app_key}'"))?;

    let creds = crate::integrations::native::token::get(app_key)
        .await?
        .ok_or_else(|| format!("'{app_key}' is not connected. Connect it first."))?;

    let url = build_url(app, action, &input, &creds)?;

    let mut last_err = String::new();
    for attempt in 0..MAX_RETRIES {
        let request = build_request(app, action, &url, &creds, &input)?;
        let client = reqwest::Client::new();

        match client.execute(request).await {
            Ok(resp) => {
                let status = resp.status();
                let headers = resp.headers().clone();

                // Retry on 429 (rate limit) and 5xx (server errors)
                if status.as_u16() == 429 || status.is_server_error() {
                    let delay = BASE_BACKOFF_MS * 2u64.pow(attempt);
                    // Respect Retry-After header if present
                    let retry_after = if status.as_u16() == 429 {
                        headers
                            .get("retry-after")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.parse::<u64>().ok())
                            .unwrap_or(delay / 1000)
                            .max(1)
                    } else {
                        delay / 1000
                    };
                    eprintln!(
                        "[native] {} {} returned HTTP {} (attempt {}/{retry_after}s) — retrying",
                        action.method.as_str(),
                        url,
                        status,
                        attempt + 1,
                    );
                    tokio::time::sleep(Duration::from_secs(retry_after)).await;
                    last_err = format!("HTTP {status}");
                    continue;
                }

                let body = resp.text().await.unwrap_or_default();

                if !status.is_success() {
                    return Err(format!(
                        "{} {} returned HTTP {}: {}",
                        action.method.as_str(),
                        url,
                        status,
                        truncate(&body, 500)
                    ));
                }

                if body.trim().is_empty() {
                    return Ok(serde_json::json!({ "ok": true }));
                }
                return match serde_json::from_str::<Value>(&body) {
                    Ok(v) => Ok(v),
                    Err(_) => Ok(Value::String(body)),
                };
            }
            Err(e) => {
                let delay = BASE_BACKOFF_MS * 2u64.pow(attempt);
                eprintln!(
                    "[native] {} {} network error (attempt {}/{}): {e}",
                    action.method.as_str(),
                    url,
                    attempt + 1,
                    MAX_RETRIES,
                );
                tokio::time::sleep(Duration::from_millis(delay)).await;
                last_err = e.to_string();
                continue;
            }
        }
    }

    Err(format!(
        "{} {} failed after {MAX_RETRIES} attempts: {last_err}",
        action.method.as_str(),
        url,
    ))
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        // UTF-8 safe truncation — find the last char boundary before max
        let mut end = max;
        while end > 0 && !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    }
}

fn build_url(
    app: &'static NativeAppConfig,
    action: &'static NativeAction,
    input: &Value,
    creds: &NativeCredentials,
) -> Result<String, String> {
    let mut path = action.path.to_string();

    // Resolve {param} placeholders from input first, then from stored creds.
    let mut subs: HashMap<String, String> = HashMap::new();
    if let Some(obj) = input.as_object() {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                subs.insert(k.clone(), s.to_string());
            } else if !v.is_null() {
                subs.insert(k.clone(), v.to_string());
            }
        }
    }
    if let Some(t) = creds.token.as_deref() {
        subs.entry("token".to_string()).or_insert_with(|| t.to_string());
    }
    // Also allow {token} to resolve from api_key (for apps like Telegram where
    // the bot token is the API key and goes in the URL path).
    if let Some(k) = creds.api_key.as_deref() {
        subs.entry("token".to_string()).or_insert_with(|| k.to_string());
    }
    if let Some(u) = creds.username.as_deref() {
        subs.entry("username".to_string()).or_insert_with(|| u.to_string());
    }
    if let Some(p) = creds.password.as_deref() {
        subs.entry("password".to_string()).or_insert_with(|| p.to_string());
    }

    for (k, v) in &subs {
        path = path.replace(&format!("{{{k}}}"), v);
    }

    // Any leftover placeholder means the caller omitted a required field.
    if path.contains('{') {
        return Err(format!(
            "Missing parameter for action '{}'. Required path fields not provided.",
            action.slug
        ));
    }

    let url = format!("{}{}", app.base_url, path);
    enforce_domain(app, &url)?;
    Ok(url)
}

/// Refuses any request whose host is not on the app's allowlist
/// (token-vault pattern — a compromised caller can never pivot to new hosts).
fn enforce_domain(app: &'static NativeAppConfig, url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("Invalid URL '{url}': {e}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| format!("URL '{url}' has no host"))?;
    if !app.allowed_domains.iter().any(|d| d == &host) {
        return Err(format!(
            "Domain '{host}' is not allowed for '{}'. Allowed: {}",
            app.key,
            app.allowed_domains.join(", ")
        ));
    }
    Ok(())
}

fn build_request(
    app: &'static NativeAppConfig,
    action: &'static NativeAction,
    url: &str,
    creds: &NativeCredentials,
    input: &Value,
) -> Result<reqwest::Request, String> {
    let method = match action.method {
        NativeMethod::Get => reqwest::Method::GET,
        NativeMethod::Post => reqwest::Method::POST,
        NativeMethod::Put => reqwest::Method::PUT,
        NativeMethod::Patch => reqwest::Method::PATCH,
        NativeMethod::Delete => reqwest::Method::DELETE,
    };

    let mut req = reqwest::Client::new().request(method, url);

    // Query params declared on the action are pulled from input.
    let mut query: Vec<(String, String)> = Vec::new();
    if let Some(obj) = input.as_object() {
        for qp in action.query_params {
            if let Some(v) = obj.get(*qp) {
                if let Some(s) = v.as_str() {
                    query.push((qp.to_string(), s.to_string()));
                } else if !v.is_null() {
                    query.push((qp.to_string(), v.to_string()));
                }
            }
        }
    }

    // Auth injection.
    match action.auth {
        AuthInjection::Bearer => {
            let token = creds
                .oauth_access_token()
                .or(creds.token.as_deref())
                .ok_or_else(|| format!("'{}' has no token stored", app.key))?;
            req = req.header(AUTHORIZATION, format!("Bearer {token}"));
        }
        AuthInjection::HeaderApiKey => {
            let key = creds
                .api_key
                .as_deref()
                .ok_or_else(|| format!("'{}' has no API key stored", app.key))?;
            req = req.header("X-Api-Key", key);
        }
        AuthInjection::QueryApiKey => {
            let key = creds
                .api_key
                .as_deref()
                .ok_or_else(|| format!("'{}' has no API key stored", app.key))?;
            query.push(("key".to_string(), key.to_string()));
        }
        AuthInjection::Basic => {
            let user = creds
                .username
                .as_deref()
                .ok_or_else(|| format!("'{}' has no username stored", app.key))?;
            let pass = creds
                .password
                .as_deref()
                .ok_or_else(|| format!("'{}' has no password stored", app.key))?;
            let encoded = base64::engine::general_purpose::STANDARD
                .encode(format!("{user}:{pass}"));
            req = req.header(AUTHORIZATION, format!("Basic {encoded}"));
        }
        AuthInjection::None => {}
    }

    if !query.is_empty() {
        req = req.query(&query);
    }

    if action.body {
        req = req.header(CONTENT_TYPE, "application/json").json(input);
    }

    Ok(req.build().map_err(|e| format!("Failed to build request: {e}"))?)
}
