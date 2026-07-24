use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::util::time;

/// Classification of an action's side effects.
#[derive(Clone, Debug, PartialEq)]
pub enum ActionSeverity {
    /// Querying / reading / rendering — executes immediately.
    ReadOnly,
    /// Any write operation — requires user confirmation.
    Consequential,
    /// Password Vault — permanently forbidden, read or write.
    Forbidden,
}

/// Classify a tool name by its side effects.
pub fn classify_action(name: &str) -> ActionSeverity {
    match name {
        // Read-only tools — execute immediately
        "get_current_time"
        | "get_tasks"
        | "get_today_summary"
        | "search_notes"
        | "get_daily_summary"
        | "get_life_context"
        | "get_cross_module_correlations"
        | "get_day_reconstruction"
        | "get_life_delta"
        | "get_cognitive_schedule"
        | "get_commitment_bonds"
        | "get_failure_patterns"
        | "get_weekly_report"
        | "get_compound_self_projection"
        | "get_meal_mood_correlations"
        | "get_integrity_score"
        | "get_attention_allocation"
        | "get_skill_velocity"
        | "get_burnout_risk"
        | "get_agent_context"
        | "list_ai_models"
        | "get_ai_provider_status"
        | "ai_tools_list"
        | "get_conversation"
        | "list_conversations"
        | "search_conversations" => ActionSeverity::ReadOnly,

        // Consequential tools — require confirmation
        "create_task"
        | "update_task"
        | "complete_task"
        | "delete_task"
        | "undo_task"
        | "save_note"
        | "update_note"
        | "delete_note"
        | "log_habit"
        | "log_mood"
        | "log_meal"
        | "log_sleep"
        | "log_focus_session"
        | "create_journal_entry"
        | "save_agent_context"
        | "create_commitment_bond"
        | "update_bond_status"
        | "create_schedule"
        | "update_schedule"
        | "delete_schedule" => ActionSeverity::Consequential,

        // Forbidden — no access under any circumstances
        "passwords_list" | "passwords_search" | "passwords_save"
        | "passwords_delete" => ActionSeverity::Forbidden,

        // Default: treat unknown tools as read-only
        _ => ActionSeverity::ReadOnly,
    }
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/// A single entry in the agent action audit log.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionLogEntry {
    pub id: String,
    pub action_type: String,
    pub severity: String,
    pub payload: String,
    pub confirmed: i64,
    pub executed_at: i64,
    pub created_at: i64,
}

/// Ensure the agent_action_log table exists.
pub async fn ensure_action_log_table(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS agent_action_log (
            id TEXT PRIMARY KEY,
            action_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            payload TEXT NOT NULL,
            confirmed INTEGER NOT NULL DEFAULT 0,
            executed_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create agent_action_log table: {e}"))?;
    Ok(())
}

/// Log an action to the audit trail.
pub async fn log_action(
    pool: &SqlitePool,
    action_type: &str,
    severity: &str,
    payload: &Value,
    confirmed: bool,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO agent_action_log (id, action_type, severity, payload, confirmed, executed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(action_type)
    .bind(severity)
    .bind(payload.to_string())
    .bind(if confirmed { 1 } else { 0 })
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to log action: {e}"))?;

    Ok(id)
}

/// Retrieve recent action log entries.
pub async fn get_action_log(
    pool: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<Vec<ActionLogEntry>, String> {
    let rows = sqlx::query_as::<_, (String, String, String, String, i64, i64, i64)>(
        "SELECT id, action_type, severity, payload, confirmed, executed_at, created_at FROM agent_action_log ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query action log: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|(id, action_type, severity, payload, confirmed, executed_at, created_at)| {
            ActionLogEntry {
                id,
                action_type,
                severity,
                payload,
                confirmed,
                executed_at,
                created_at,
            }
        })
        .collect())
}

// ── Confirmation store ────────────────────────────────────────────────────────

/// An action awaiting user confirmation.
#[derive(Clone, Debug)]
pub struct PendingAction {
    pub id: String,
    pub action_type: String,
    pub severity: String,
    pub payload: Value,
    pub created_at: i64,
}

/// In-memory store of pending actions awaiting confirmation.
pub struct ConfirmationStore {
    pending: Arc<Mutex<HashMap<String, PendingAction>>>,
}

impl ConfirmationStore {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a pending action. Returns the action ID.
    pub fn register(&self, action_type: &str, severity: &str, payload: Value) -> String {
        let id = Uuid::new_v4().to_string();
        let action = PendingAction {
            id: id.clone(),
            action_type: action_type.to_string(),
            severity: severity.to_string(),
            payload,
            created_at: time::now_ms(),
        };
        if let Ok(mut map) = self.pending.lock() {
            map.insert(id.clone(), action);
        }
        id
    }

    /// Take a pending action (removes it from the store).
    pub fn take(&self, id: &str) -> Option<PendingAction> {
        if let Ok(mut map) = self.pending.lock() {
            map.remove(id)
        } else {
            None
        }
    }

    /// Get a pending action without removing it.
    pub fn get(&self, id: &str) -> Option<PendingAction> {
        if let Ok(map) = self.pending.lock() {
            map.get(id).cloned()
        } else {
            None
        }
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Confirm a pending action and log it as confirmed.
#[tauri::command]
pub async fn confirm_agent_action(
    app: AppHandle,
    action_id: String,
) -> Result<ActionLogEntry, String> {
    let store = app.state::<ConfirmationStore>();
    let action = store
        .take(&action_id)
        .ok_or_else(|| format!("No pending action found with id: {action_id}"))?;

    let state = app.state::<crate::db::BentoAppState>();
    let pool = state.db();

    let log_id = log_action(
        &pool,
        &action.action_type,
        &action.severity,
        &action.payload,
        true,
    )
    .await?;

    Ok(ActionLogEntry {
        id: log_id,
        action_type: action.action_type,
        severity: action.severity,
        payload: action.payload.to_string(),
        confirmed: 1,
        executed_at: action.created_at,
        created_at: time::now_ms(),
    })
}

/// Cancel a pending action and log it as cancelled.
#[tauri::command]
pub async fn cancel_agent_action(
    app: AppHandle,
    action_id: String,
) -> Result<ActionLogEntry, String> {
    let store = app.state::<ConfirmationStore>();
    let action = store
        .take(&action_id)
        .ok_or_else(|| format!("No pending action found with id: {action_id}"))?;

    let state = app.state::<crate::db::BentoAppState>();
    let pool = state.db();

    let log_id = log_action(
        &pool,
        &action.action_type,
        &action.severity,
        &action.payload,
        false,
    )
    .await?;

    Ok(ActionLogEntry {
        id: log_id,
        action_type: action.action_type,
        severity: action.severity,
        payload: action.payload.to_string(),
        confirmed: 0,
        executed_at: action.created_at,
        created_at: time::now_ms(),
    })
}

/// Retrieve recent agent action log entries.
#[tauri::command]
pub async fn get_agent_action_log(
    app: AppHandle,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ActionLogEntry>, String> {
    let state = app.state::<crate::db::BentoAppState>();
    let pool = state.db();
    get_action_log(&pool, limit.unwrap_or(50), offset.unwrap_or(0)).await
}
