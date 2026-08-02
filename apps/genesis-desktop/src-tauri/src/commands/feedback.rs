// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sysinfo::System;
use tauri::{AppHandle, State};

use crate::auth::AuthManager;

const VALID_SEVERITIES: &[&str] = &["critical", "high", "medium", "low"];
const VALID_CATEGORIES: &[&str] = &["ui", "performance", "new_feature", "integration", "other"];

#[derive(specta::Type, Debug, Serialize, Deserialize, Clone)]
pub struct SubmitFeedbackParams {
    #[serde(rename = "type")]
    pub feedback_type: String,
    pub title: String,
    pub description: String,
    pub severity: Option<String>,
    pub category: Option<String>,
    pub active_module: Option<String>,
}

#[derive(specta::Type, Debug, Serialize, Deserialize, Clone)]
pub struct FeedbackReport {
    pub id: String,
    pub user_id: String,
    #[serde(rename = "type")]
    pub feedback_type: String,
    pub title: String,
    pub description: String,
    pub severity: Option<String>,
    pub category: Option<String>,
    pub active_module: Option<String>,
    pub app_version: String,
    pub os_name: String,
    pub os_version: String,
    pub status: String,
    pub developer_note: Option<String>,
    pub github_issue_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(specta::Type, Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackRealtimeConfig {
    pub supabase_url: String,
    pub anon_key: String,
    pub access_token: String,
    pub user_id: String,
}

fn normalize_feedback_type(value: &str) -> Result<&'static str, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "bug" => Ok("bug"),
        "feature" => Ok("feature"),
        _ => Err("Type must be 'bug' or 'feature'.".to_string()),
    }
}

fn normalize_optional_value(
    value: Option<&str>,
    allowed: &[&'static str],
    default_value: &'static str,
    field_name: &str,
) -> Result<&'static str, String> {
    let normalized = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(default_value)
        .to_ascii_lowercase();

    allowed
        .iter()
        .copied()
        .find(|allowed_value| *allowed_value == normalized.as_str())
        .ok_or_else(|| format!("Invalid {field_name}."))
}

fn get_os_info() -> (String, String) {
    let os_name = System::name().unwrap_or_else(|| std::env::consts::OS.to_string());
    let os_version = System::os_version()
        .or_else(System::long_os_version)
        .unwrap_or_else(|| "unknown".to_string());

    (os_name, os_version)
}

fn auth_headers(manager: &AuthManager, access_token: &str) -> (String, String, String) {
    let (supabase_url, anon_key) = manager.supabase_config();
    (
        supabase_url.trim_end_matches('/').to_string(),
        anon_key,
        format!("Bearer {access_token}"),
    )
}

#[specta::specta]
#[tauri::command]
pub async fn submit_feedback(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    params: SubmitFeedbackParams,
) -> Result<String, String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in before submitting feedback.".to_string())?;

    let user_id = session.user.id.trim().to_string();
    if user_id.is_empty() {
        return Err("Authenticated session is missing a user id.".to_string());
    }

    let feedback_type = normalize_feedback_type(&params.feedback_type)?;
    let title = params.title.trim();
    let description = params.description.trim();

    if title.len() < 5 {
        return Err("Title must be at least 5 characters.".to_string());
    }
    if description.len() < 20 {
        return Err("Description must be at least 20 characters.".to_string());
    }

    let severity = if feedback_type == "bug" {
        Some(normalize_optional_value(
            params.severity.as_deref(),
            VALID_SEVERITIES,
            "medium",
            "severity",
        )?)
    } else {
        None
    };

    let category = if feedback_type == "feature" {
        Some(normalize_optional_value(
            params.category.as_deref(),
            VALID_CATEGORIES,
            "new_feature",
            "category",
        )?)
    } else {
        None
    };

    let app_version = app.package_info().version.to_string();
    let (os_name, os_version) = get_os_info();
    let active_module = params
        .active_module
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let mut payload = json!({
        "user_id": user_id,
        "type": feedback_type,
        "title": title,
        "description": description,
        "app_version": app_version,
        "os_name": os_name,
        "os_version": os_version,
        "status": "submitted",
    });

    if let Some(severity) = severity {
        payload["severity"] = json!(severity);
    }
    if let Some(category) = category {
        payload["category"] = json!(category);
    }
    if let Some(active_module) = active_module {
        payload["active_module"] = json!(active_module);
    }

    let (supabase_url, anon_key, authorization) = auth_headers(&auth, &session.access_token);
    let response = reqwest::Client::new()
        .post(format!("{supabase_url}/rest/v1/feedback_reports"))
        .header("apikey", anon_key)
        .header("Authorization", authorization)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("Prefer", "return=representation")
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Failed to submit feedback: {error}"))?;

    if !response.status().is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Supabase rejected the feedback insert: {body}"));
    }

    let rows: Vec<Value> = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse feedback response: {error}"))?;

    rows.first()
        .and_then(|row| row.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "Feedback was inserted, but Supabase returned no id.".to_string())
}

#[specta::specta]
#[tauri::command]
pub async fn get_my_feedback(auth: State<'_, AuthManager>) -> Result<Vec<FeedbackReport>, String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in to view your feedback.".to_string())?;

    let user_id = session.user.id.trim().to_string();
    if user_id.is_empty() {
        return Err("Authenticated session is missing a user id.".to_string());
    }

    let (supabase_url, anon_key, authorization) = auth_headers(&auth, &session.access_token);
    let response = reqwest::Client::new()
        .get(format!(
            "{supabase_url}/rest/v1/feedback_reports?user_id=eq.{user_id}&order=created_at.desc"
        ))
        .header("apikey", anon_key)
        .header("Authorization", authorization)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch feedback: {error}"))?;

    if !response.status().is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Supabase rejected the feedback fetch: {body}"));
    }

    response
        .json::<Vec<FeedbackReport>>()
        .await
        .map_err(|error| format!("Failed to parse feedback: {error}"))
}

#[specta::specta]
#[tauri::command]
pub async fn get_feedback_by_id(
    auth: State<'_, AuthManager>,
    id: String,
) -> Result<FeedbackReport, String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in to view feedback.".to_string())?;

    let user_id = session.user.id.trim().to_string();
    if user_id.is_empty() {
        return Err("Authenticated session is missing a user id.".to_string());
    }

    let id = id.trim();
    if id.is_empty() {
        return Err("Feedback id is required.".to_string());
    }

    let (supabase_url, anon_key, authorization) = auth_headers(&auth, &session.access_token);
    let response = reqwest::Client::new()
        .get(format!(
            "{supabase_url}/rest/v1/feedback_reports?id=eq.{id}&user_id=eq.{user_id}&limit=1"
        ))
        .header("apikey", anon_key)
        .header("Authorization", authorization)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch feedback: {error}"))?;

    if !response.status().is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Supabase rejected the feedback fetch: {body}"));
    }

    response
        .json::<Vec<FeedbackReport>>()
        .await
        .map_err(|error| format!("Failed to parse feedback: {error}"))?
        .into_iter()
        .next()
        .ok_or_else(|| "Feedback not found.".to_string())
}

#[specta::specta]
#[tauri::command]
pub async fn get_feedback_realtime_config(
    auth: State<'_, AuthManager>,
) -> Result<FeedbackRealtimeConfig, String> {
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in to subscribe to feedback updates.".to_string())?;

    let user_id = session.user.id.trim().to_string();
    if user_id.is_empty() {
        return Err("Authenticated session is missing a user id.".to_string());
    }

    let (supabase_url, anon_key) = auth.supabase_config();
    Ok(FeedbackRealtimeConfig {
        supabase_url,
        anon_key,
        access_token: session.access_token,
        user_id,
    })
}