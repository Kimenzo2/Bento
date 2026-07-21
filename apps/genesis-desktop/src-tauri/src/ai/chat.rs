//! Agent chat engine — multi-turn streaming with tool calling support.
//!
//! Orchestrates provider-specific API requests, parses streaming responses
//! for both text tokens and tool calls, executes tools against the local
//! Bento database, and continues the tool-call loop automatically.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

use crate::agent_core::ui_schema::UiVocabulary;
use crate::util::time;

// ── Public types ──────────────────────────────────────────────────────────────

const VALID_ROLES: &[&str] = &["user", "assistant", "system", "tool"];

/// A single chat message in a conversation.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    /// Function name for the tool result (required by Gemini for functionResponse).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_name: Option<String>,
}

impl ChatMessage {
    /// Validate the role field; returns an error for unknown roles.
    pub fn validate(&self) -> Result<(), String> {
        if !VALID_ROLES.contains(&self.role.as_str()) {
            return Err(format!(
                "Invalid message role \"{}\". Must be one of: {}",
                self.role,
                VALID_ROLES.join(", ")
            ));
        }
        Ok(())
    }
}

/// A tool call from the AI.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: Value,
}

/// Event sent to the frontend during streaming.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatEvent {
    #[serde(rename = "token")]
    Token { content: String },
    #[serde(rename = "tool_call")]
    ToolCall { id: String, name: String, args: Value, auto_execute: bool },
    #[serde(rename = "tool_result")]
    ToolResult { id: String, name: String, result: Value, is_error: bool },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "done")]
    Done { finish_reason: Option<String>, usage: Option<UsageInfo> },
    #[serde(rename = "ui_update")]
    UiUpdate { ui: UiVocabulary },
}

/// Token usage information.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageInfo {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

/// A tool definition sent to the AI provider.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
    pub auto_execute: bool,
}

/// Parameters for a chat stream request.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatParams {
    pub messages: Vec<ChatMessage>,
    pub system: Option<String>,
    pub model: String,
    pub provider: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u64>,
    pub top_p: Option<f64>,
    pub top_k: Option<u64>,
    pub presence_penalty: Option<f64>,
    pub frequency_penalty: Option<f64>,
    pub stop_sequences: Option<Vec<String>>,
    pub enable_tools: Option<bool>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

// ── Built-in tools ──────────────────────────────────────────────────────────

static DEFAULT_TOOLS: LazyLock<Vec<ToolDefinition>> = LazyLock::new(|| {
    vec![
        ToolDefinition {
            name: "create_task".into(),
            description: "Create a new task with a title (required), optional due date (ISO 8601), priority level (low/medium/high), and project name. Returns the created task ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Task title (required)"},
                    "due_at": {"type": "string", "description": "Optional ISO 8601 due date string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"], "description": "Priority level, defaults to medium"},
                    "project": {"type": "string", "description": "Optional project/category name"}
                },
                "required": ["title"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_tasks".into(),
            description: "Retrieve tasks with optional filters: status (pending/completed/all), due_before (ISO 8601), project name. Returns task objects with id, title, priority, due date, and status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["pending", "completed", "all"], "description": "Filter by completion status, defaults to pending"},
                    "due_before": {"type": "string", "description": "Optional ISO 8601 cutoff — only tasks due before this"},
                    "project": {"type": "string", "description": "Optional project name filter"},
                    "limit": {"type": "integer", "description": "Max results (1-100), defaults to 20"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "complete_task".into(),
            description: "Mark a task as completed by its ID. Returns a confirmation with the task title.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to complete"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_task".into(),
            description: "Modify an existing task's title, priority, project, due date, or notes. Any field can be omitted to leave it unchanged.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to update"},
                    "title": {"type": "string", "description": "New title"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "project": {"type": "string", "description": "New project name"},
                    "due_at": {"type": "string", "description": "ISO 8601 due date, empty string to clear"},
                    "notes": {"type": "string", "description": "Notes or description"}
                },
                "required": ["task_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_task".into(),
            description: "Permanently delete a task by its ID. This action cannot be undone.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "The unique ID of the task to delete"}
                },
                "required": ["task_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "save_note".into(),
            description: "Save a new note with a title, content (plain text or markdown), and optional tags. Returns the note ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title (required)"},
                    "content": {"type": "string", "description": "Note body content (required)"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional tags"}
                },
                "required": ["title", "content"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "search_notes".into(),
            description: "Search notes by keyword, matching against titles and body content. Returns matching notes with id, title, excerpt, and updated_at.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword (required)"},
                    "limit": {"type": "integer", "description": "Max results (1-100), defaults to 10"}
                },
                "required": ["query"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_note".into(),
            description: "Modify an existing note's title, content, or tags. Any field can be omitted to leave it unchanged.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note to update"},
                    "title": {"type": "string", "description": "New title"},
                    "content": {"type": "string", "description": "New content body"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "New tags array"}
                },
                "required": ["note_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_note".into(),
            description: "Permanently delete a note by its ID. This action cannot be undone.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note to delete"}
                },
                "required": ["note_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "log_habit".into(),
            description: "Log a habit completion by habit name (case-insensitive, fuzzy matched). Returns the habit name and streak info.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "habit_name": {"type": "string", "description": "Name of the habit to mark as completed"}
                },
                "required": ["habit_name"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_today_summary".into(),
            description: "Get a summary of today's activity including tasks due, habits to complete, focus sessions, mood, and meals. Call this at the start of a conversation to ground the agent.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_current_time".into(),
            description: "Get the current date and time. Use this whenever you need to know what time it is or what today's date is.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
    ]
});

/// Return the default tool definitions (lazily constructed, shared reference).
pub fn default_tool_definitions() -> &'static [ToolDefinition] {
    &DEFAULT_TOOLS
}

/// Check if a provider supports tool calling.
fn provider_supports_tools(provider: &str) -> bool {
    matches!(provider, "openai" | "anthropic" | "gemini" | "grok" | "openrouter" | "chatgpt")
}

// ── Tool execution ──────────────────────────────────────────────────────────

/// Execute a tool by name with the given arguments.
async fn execute_tool(
    pool: &SqlitePool,
    name: &str,
    args: &Value,
) -> Result<Value, String> {
    match name {
        "get_current_time" => {
            let now = time::now_ms();
            let formatted = time::format_rfc3339(now);
            Ok(json!({
                "datetime": formatted,
                "timestamp_ms": now,
                "timezone": "UTC",
                "date": time::date_key(now),
                "time": time::time_key(now),
            }))
        }
        "create_task" => {
            let title = args["title"].as_str().ok_or("title is required")?;
            let cleaned = title.trim();
            if cleaned.is_empty() {
                return Err("Task title cannot be empty.".to_string());
            }
            let id = Uuid::new_v4().to_string();
            let now_ms = time::now_ms();
            let priority = args["priority"].as_str().unwrap_or("medium");
            let due_at_ms = args["due_at"].as_str()
                .and_then(|iso| chrono::DateTime::parse_from_rfc3339(iso).ok())
                .map(|dt| dt.timestamp_millis());
            let project = args["project"].as_str().unwrap_or("");

            sqlx::query(
                "INSERT INTO tasks (id, title, done, priority, project, due_at, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(cleaned)
            .bind(priority)
            .bind(project)
            .bind(due_at_ms)
            .bind(now_ms)
            .bind(now_ms)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to create task: {e}"))?;

            Ok(json!({
                "id": id,
                "title": cleaned,
                "data_coverage": 1.0,
                "message": format!("Task \"{cleaned}\" created.")
            }))
        }
        "get_tasks" => {
            let status_filter = args["status"].as_str().unwrap_or("pending");
            let max_results = args["limit"].as_i64().unwrap_or(20).min(100);
            let now_ms = time::now_ms();

            let mut sql = String::from("SELECT id, title, due_at, priority, done, project FROM tasks WHERE 1=1");
            match status_filter {
                "pending" => sql.push_str(" AND done = 0 AND (due_at IS NULL OR due_at > ?)"),
                "completed" => sql.push_str(" AND done = 1"),
                _ => {}
            }

            if let Some(proj) = args["project"].as_str() {
                if !proj.is_empty() {
                    sql.push_str(" AND project = ?");
                }
            }

            sql.push_str(" ORDER BY created_at DESC LIMIT ?");

            let mut query = sqlx::query_as::<_, (String, String, Option<i64>, String, i64, Option<String>)>(&sql);
            if status_filter == "pending" {
                query = query.bind(now_ms);
            }
            if let Some(proj) = args["project"].as_str() {
                if !proj.is_empty() {
                    query = query.bind(proj);
                }
            }
            query = query.bind(max_results);

            let rows = query.fetch_all(pool).await.map_err(|e| format!("Failed to query tasks: {e}"))?;

            let tasks: Vec<Value> = rows.into_iter().map(|(id, title, due_at, priority, done, project)| {
                json!({
                    "id": id, "title": title, "dueAt": due_at,
                    "priority": priority,
                    "status": if done == 1 { "completed" } else { "pending" },
                    "project": project,
                })
            }).collect();

            Ok(json!({ "tasks": tasks, "count": tasks.len() }))
        }
        "complete_task" => {
            let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
            let now_ms = time::now_ms();
            let result = sqlx::query("UPDATE tasks SET done = 1, completed_at = ?, updated_at = ? WHERE id = ? AND done = 0")
                .bind(now_ms).bind(now_ms).bind(task_id)
                .execute(pool).await.map_err(|e| format!("Failed to complete task: {e}"))?;

            if result.rows_affected() == 0 {
                return Err(format!("Task \"{task_id}\" not found or already completed."));
            }

            let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
                .bind(task_id).fetch_one(pool).await.map_err(|e| format!("Failed to get task: {e}"))?;

            Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" completed.") }))
        }
        "update_task" => {
            let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
            let now_ms = time::now_ms();
            let mut cols: Vec<&str> = Vec::new();

            if let Some(t) = args["title"].as_str() {
                if !t.trim().is_empty() { cols.push("title = ?"); }
            }
            if args.get("priority").is_some() { cols.push("priority = ?"); }
            if args.get("project").is_some() { cols.push("project = ?"); }
            if args.get("due_at").is_some() { cols.push("due_at = ?"); }
            if args.get("notes").is_some() { cols.push("notes = ?"); }
            if cols.is_empty() { return Err("No fields to update.".to_string()); }

            cols.push("updated_at = ?");
            let sql = format!("UPDATE tasks SET {} WHERE id = ?", cols.join(", "));
            let mut query = sqlx::query(&sql);

            if let Some(t) = args["title"].as_str() { if !t.trim().is_empty() { query = query.bind(t.trim()); } }
            if let Some(p) = args["priority"].as_str() { query = query.bind(p); }
            if let Some(p) = args["project"].as_str() { query = query.bind(p); }
            if let Some(d) = args["due_at"].as_str() {
                query = query.bind(if d.is_empty() { None } else { chrono::DateTime::parse_from_rfc3339(d).ok().map(|dt| dt.timestamp_millis()) });
            } else { query = query.bind(None::<i64>); }
            if let Some(n) = args["notes"].as_str() { query = query.bind(n); }

            query = query.bind(now_ms).bind(task_id);
            let result = query.execute(pool).await.map_err(|e| format!("Failed to update task: {e}"))?;
            if result.rows_affected() == 0 { return Err(format!("Task \"{task_id}\" not found.")); }

            let title: String = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
                .bind(task_id).fetch_one(pool).await.map_err(|e| format!("Failed to get task: {e}"))?;

            Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" updated.") }))
        }
        "delete_task" => {
            let task_id = args["task_id"].as_str().ok_or("task_id is required")?;
            let title: Option<String> = sqlx::query_scalar("SELECT title FROM tasks WHERE id = ?")
                .bind(task_id).fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;
            let title = title.ok_or_else(|| format!("Task \"{task_id}\" not found."))?;

            sqlx::query("DELETE FROM tasks WHERE parent_id = ?").bind(task_id).execute(pool).await.ok();
            sqlx::query("DELETE FROM tasks WHERE id = ?").bind(task_id).execute(pool).await.map_err(|e| format!("Failed to delete: {e}"))?;

            Ok(json!({ "id": task_id, "title": title, "data_coverage": 1.0, "message": format!("Task \"{title}\" deleted.") }))
        }
        "save_note" => {
            let title = args["title"].as_str().ok_or("title is required")?;
            let content = args["content"].as_str().ok_or("content is required")?;
            if title.trim().is_empty() || content.trim().is_empty() {
                return Err("Title and content are required.".to_string());
            }
            let object_id = Uuid::new_v4().to_string();
            let block_id = Uuid::new_v4().to_string();
            let now_ms = time::now_ms();
            let tags = args["tags"].as_array().map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string())).unwrap_or_else(|| "[]".to_string());

            let mut tx = pool.begin().await.map_err(|e| format!("Transaction error: {e}"))?;
            sqlx::query("INSERT INTO note_objects (id, title, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
                .bind(&object_id).bind(title.trim()).bind(&tags).bind(now_ms).bind(now_ms)
                .execute(&mut *tx).await.map_err(|e| format!("Failed to create note: {e}"))?;

            let block_content = json!({"text": content.trim()}).to_string();
            sqlx::query("INSERT INTO blocks (id, object_id, type, content, position, created_at, updated_at) VALUES (?, ?, 'text', ?, 0, ?, ?)")
                .bind(&block_id).bind(&object_id).bind(&block_content).bind(now_ms).bind(now_ms)
                .execute(&mut *tx).await.map_err(|e| format!("Failed to create block: {e}"))?;

            tx.commit().await.map_err(|e| format!("Commit error: {e}"))?;

            Ok(json!({ "id": object_id, "title": title.trim(), "data_coverage": 1.0, "message": format!("Note \"{}\" saved.", title.trim()) }))
        }
        "search_notes" => {
            let query_str = args["query"].as_str().ok_or("query is required")?;
            let limit = args["limit"].as_i64().unwrap_or(10).min(100);
            let pattern = format!("%{}%", query_str);

            let rows = sqlx::query_as::<_, (String, String, String, i64)>(
                r#"SELECT DISTINCT n.id, n.title,
                    COALESCE(substr(json_extract(b.content, '$.text'), 1, 200), '') as excerpt,
                    n.updated_at
                   FROM note_objects n
                   LEFT JOIN blocks b ON b.object_id = n.id
                   WHERE n.title LIKE ? OR json_extract(b.content, '$.text') LIKE ?
                   ORDER BY n.updated_at DESC
                   LIMIT ?"#,
            )
            .bind(&pattern).bind(&pattern).bind(limit)
            .fetch_all(pool).await.map_err(|e| format!("Search failed: {e}"))?;

            let notes: Vec<Value> = rows.into_iter().map(|(id, title, excerpt, updated_at)| {
                json!({ "id": id, "title": title, "excerpt": excerpt, "updatedAt": updated_at })
            }).collect();

            Ok(json!({ "notes": notes, "count": notes.len() }))
        }
        "update_note" => {
            let note_id = args["note_id"].as_str().ok_or("note_id is required")?;
            let now_ms = time::now_ms();
            let mut cols: Vec<&str> = Vec::new();

            if args.get("title").is_some() { cols.push("title = ?"); }
            if args.get("content").is_some() { cols.push("content = ?"); }
            if args.get("tags").is_some() { cols.push("tags = ?"); }
            if cols.is_empty() { return Err("No fields to update.".to_string()); }

            cols.push("updated_at = ?");
            let sql = format!("UPDATE note_objects SET {} WHERE id = ?", cols.join(", "));
            let mut query = sqlx::query(&sql);

            if let Some(t) = args["title"].as_str() { query = query.bind(t.trim()); }
            if let Some(c) = args["content"].as_str() { query = query.bind(c); }
            if let Some(t) = args["tags"].as_array() {
                query = query.bind(serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));
            }
            query = query.bind(now_ms).bind(note_id);

            let result = query.execute(pool).await.map_err(|e| format!("Failed to update note: {e}"))?;
            if result.rows_affected() == 0 { return Err(format!("Note \"{note_id}\" not found.")); }

            Ok(json!({ "id": note_id, "data_coverage": 1.0, "message": "Note updated." }))
        }
        "delete_note" => {
            let note_id = args["note_id"].as_str().ok_or("note_id is required")?;
            sqlx::query("DELETE FROM blocks WHERE object_id = ?").bind(note_id).execute(pool).await.ok();
            let result = sqlx::query("DELETE FROM note_objects WHERE id = ?").bind(note_id)
                .execute(pool).await.map_err(|e| format!("Failed to delete note: {e}"))?;
            if result.rows_affected() == 0 { return Err(format!("Note \"{note_id}\" not found.")); }
            Ok(json!({ "id": note_id, "data_coverage": 1.0, "message": "Note deleted." }))
        }
        "log_habit" => {
            let habit_name = args["habit_name"].as_str().ok_or("habit_name is required")?;
            let habit: Option<(String, String)> = sqlx::query_as(
                "SELECT id, name FROM habits WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE LOWER(?) LIMIT 1"
            )
            .bind(habit_name).bind(format!("%{}%", habit_name))
            .fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;

            let (habit_id, name) = habit.ok_or_else(|| format!("Habit \"{habit_name}\" not found."))?;
            let today = time::date_key(time::now_ms());

            let existing: Option<String> = sqlx::query_scalar("SELECT id FROM habit_completions WHERE habit_id = ? AND date_key = ?")
                .bind(&habit_id).bind(&today).fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;

            if existing.is_some() {
                return Ok(json!({ "habit": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" already completed today.") }));
            }

            let id = Uuid::new_v4().to_string();
            let now_ms = time::now_ms();
            sqlx::query("INSERT INTO habit_completions (id, habit_id, date_key, created_at) VALUES (?, ?, ?, ?)")
                .bind(&id).bind(&habit_id).bind(&today).bind(now_ms)
                .execute(pool).await.map_err(|e| format!("Failed to log habit: {e}"))?;

            Ok(json!({ "habit": name, "data_coverage": 1.0, "message": format!("Habit \"{name}\" logged for today.") }))
        }
        "get_today_summary" => {
            let today = time::date_key(time::now_ms());
            let today_ms = time::start_of_today();
            let tomorrow_ms = today_ms + 86_400_000;

            let pending_tasks: Vec<Value> = sqlx::query_as::<_, (String, String, Option<i64>, String)>(
                "SELECT id, title, due_at, priority FROM tasks WHERE done = 0 AND (due_at IS NULL OR due_at <= ?) ORDER BY due_at ASC LIMIT 10"
            )
            .bind(tomorrow_ms).fetch_all(pool).await.unwrap_or_default()
            .into_iter().map(|(id, title, due_at, priority)| json!({"id": id, "title": title, "dueAt": due_at, "priority": priority}))
            .collect();

            let habits_today: Vec<String> = sqlx::query_scalar(
                "SELECT h.name FROM habits h LEFT JOIN habit_completions hc ON hc.habit_id = h.id AND hc.date_key = ? WHERE hc.id IS NULL AND h.archived = 0"
            )
            .bind(&today).fetch_all(pool).await.unwrap_or_default();

            let focus_minutes: Option<i64> = sqlx::query_scalar(
                "SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_sessions WHERE date_key = ?"
            )
            .bind(&today).fetch_one(pool).await.unwrap_or(Some(0));

            let meals: Vec<Value> = sqlx::query_as::<_, (String, String, Option<i64>)>(
                "SELECT name, meal_type, total_kcal FROM meals WHERE date(logged_at / 1000, 'unixepoch') = ? ORDER BY logged_at"
            )
            .bind(&today).fetch_all(pool).await.unwrap_or_default()
            .into_iter().map(|(name, meal_type, kcal)| json!({"name": name, "mealType": meal_type, "calories": kcal}))
            .collect();

            Ok(json!({
                "date": today,
                "pendingTasks": pending_tasks,
                "habitsToComplete": habits_today,
                "focusMinutes": focus_minutes.unwrap_or(0),
                "mealsLogged": meals,
                "data_coverage": 1.0
            }))
        }
        _ => Err(format!("Unknown tool: {name}")),
    }
}

// ── Provider request builders ──────────────────────────────────────────────

/// Build an OpenAI/Grok-compatible chat completions request body.
fn build_openai_request(
    params: &ChatParams,
    include_tools: bool,
    stream: bool,
) -> Value {
    let mut body = json!({
        "model": params.model,
        "messages": build_openai_messages(params),
        "stream": stream,
    });

    if let Some(t) = params.temperature { body["temperature"] = json!(t); }
    if let Some(m) = params.max_tokens { body["max_completion_tokens"] = json!(m); }
    if let Some(p) = params.top_p { body["top_p"] = json!(p); }
    if let Some(p) = params.presence_penalty { body["presence_penalty"] = json!(p); }
    if let Some(f) = params.frequency_penalty { body["frequency_penalty"] = json!(f); }
    if let Some(s) = &params.stop_sequences { body["stop"] = json!(s); }

    if include_tools {
        let defs = default_tool_definitions();
        let tools: Vec<Value> = defs.iter().map(|t| json!({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.input_schema,
            }
        })).collect();
        body["tools"] = json!(tools);
        body["tool_choice"] = json!("auto");
    }

    body
}

fn build_openai_messages(params: &ChatParams) -> Vec<Value> {
    let mut msgs = Vec::new();
    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            msgs.push(json!({"role": "system", "content": sys}));
        }
    }
    for msg in &params.messages {
        let mut m = json!({"role": msg.role, "content": msg.content});
        if let Some(tcs) = &msg.tool_calls {
            let calls: Vec<Value> = tcs.iter().map(|tc| json!({
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.name,
                    "arguments": tc.args.to_string(),
                }
            })).collect();
            m["tool_calls"] = json!(calls);
        }
        if let Some(ref tid) = msg.tool_call_id {
            m["tool_call_id"] = json!(tid);
        }
        msgs.push(m);
    }
    msgs
}

/// Build an Anthropic messages request body.
fn build_anthropic_request(
    params: &ChatParams,
    include_tools: bool,
    stream: bool,
) -> Value {
    let mut body = json!({
        "model": params.model,
        "messages": build_anthropic_messages(params),
        "stream": stream,
        "max_tokens": params.max_tokens.unwrap_or(4096),
    });

    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            body["system"] = json!(sys);
        }
    }
    if let Some(t) = params.temperature { body["temperature"] = json!(t); }
    if let Some(p) = params.top_p { body["top_p"] = json!(p); }
    if let Some(s) = &params.stop_sequences { body["stop_sequences"] = json!(s); }

    if include_tools {
        let defs = default_tool_definitions();
        let tools: Vec<Value> = defs.iter().map(|t| json!({
            "name": t.name,
            "description": t.description,
            "input_schema": t.input_schema,
        })).collect();
        body["tools"] = json!(tools);
    }

    body
}

fn build_anthropic_messages(params: &ChatParams) -> Vec<Value> {
    let mut msgs = Vec::new();
    for msg in &params.messages {
        if msg.role == "system" { continue; }
        if msg.role == "tool" {
            msgs.push(json!({
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": msg.tool_call_id, "content": msg.content}]
            }));
            continue;
        }
        let mut content: Vec<Value> = vec![json!({"type": "text", "text": msg.content})];
        if let Some(tcs) = &msg.tool_calls {
            for tc in tcs {
                content.push(json!({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tc.name,
                    "input": tc.args,
                }));
            }
        }
        msgs.push(json!({"role": msg.role, "content": content}));
    }
    msgs
}

/// Build a Gemini request body.
fn build_gemini_request(
    params: &ChatParams,
    include_tools: bool,
    _stream: bool,
) -> Value {
    let mut body = json!({
        "contents": build_gemini_contents(params),
    });

    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            body["system_instruction"] = json!({"parts": [{"text": sys}]});
        }
    }
    let mut config = json!({});
    if let Some(t) = params.temperature { config["temperature"] = json!(t); }
    if let Some(m) = params.max_tokens { config["maxOutputTokens"] = json!(m); }
    if let Some(p) = params.top_p { config["topP"] = json!(p); }
    if let Some(k) = params.top_k { config["topK"] = json!(k); }
    if !config.as_object().map_or(true, |o| o.is_empty()) {
        body["generationConfig"] = config;
    }

    if include_tools {
        let defs = default_tool_definitions();
        let funcs: Vec<Value> = defs.iter().map(|t| json!({
            "name": t.name,
            "description": t.description,
            "parameters": t.input_schema,
        })).collect();
        body["tools"] = json!([{"function_declarations": funcs}]);
    }

    body
}

fn build_gemini_contents(params: &ChatParams) -> Vec<Value> {
    let mut contents = Vec::new();
    for (idx, msg) in params.messages.iter().enumerate() {
        if msg.role == "system" { continue; }
        let gemini_role = match msg.role.as_str() {
            "assistant" => "model",
            // Gemini v1beta only accepts "user" and "model" roles.
            // Function responses must be sent as "user" with functionResponse parts.
            "tool" => "user",
            r => r,
        };

        let mut parts: Vec<Value> = Vec::new();
        if !msg.content.is_empty() {
            parts.push(json!({"text": msg.content}));
        }
        if let Some(tcs) = &msg.tool_calls {
            for tc in tcs {
                parts.push(json!({
                    "functionCall": {"name": tc.name, "args": tc.args}
                }));
            }
        }
        if msg.tool_call_id.is_some() {
            let name = msg.tool_call_name.as_deref().unwrap_or_else(|| {
                // Fallback: look back through previous messages for the matching
                // tool call with this ID to extract the function name.
                params.messages[..idx]
                    .iter()
                    .rev()
                    .find(|m| {
                        m.tool_calls
                            .as_ref()
                            .is_some_and(|tcs| tcs.iter().any(|tc| tc.id == *msg.tool_call_id.as_deref().unwrap_or_default()))
                    })
                    .and_then(|m| m.tool_calls.as_ref())
                    .and_then(|tcs| tcs.iter().find(|tc| tc.id == *msg.tool_call_id.as_deref().unwrap_or_default()))
                    .map(|tc| tc.name.as_str())
                    .unwrap_or_default()
            });
            parts.push(json!({
                "functionResponse": {"name": name, "response": {"result": msg.content}}
            }));
        }

        contents.push(json!({"role": gemini_role, "parts": parts}));
    }
    contents
}

// ── Response parsers ────────────────────────────────────────────────────────

/// Parse an OpenAI/Grok SSE response for text deltas.
/// Tool call accumulation by index is handled by the caller.
fn parse_openai_sse_line(
    data: &str,
) -> Option<ChatEvent> {
    if data == "[DONE]" {
        return None;
    }
    let json: Value = serde_json::from_str(data).ok()?;
    let choice = json["choices"].as_array()?.first()?;

    let delta = &choice["delta"];
    let finish = choice["finish_reason"].as_str();

    if let Some(text) = delta["content"].as_str() {
        if !text.is_empty() {
            return Some(ChatEvent::Token { content: text.to_string() });
        }
    }

    if let Some(reason) = finish {
        if !reason.is_empty() && reason != "null" {
            return Some(ChatEvent::Done {
                finish_reason: Some(reason.to_string()),
                usage: None,
            });
        }
    }

    None
}

/// Parse and accumulate tool call deltas from an OpenAI/Grok SSE line.
/// OpenAI sends tool calls across multiple deltas (index-based), so the
/// caller must accumulate partial JSON arguments by index.
fn parse_openai_tool_deltas(
    data: &str,
    accumulator: &mut Vec<ToolCall>,
) {
    let json: Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return,
    };
    let choice = match json["choices"].as_array().and_then(|a| a.first()) {
        Some(c) => c,
        None => return,
    };
    let delta = &choice["delta"];
    let tcs = match delta["tool_calls"].as_array() {
        Some(t) => t,
        None => return,
    };

    for tc in tcs {
        let idx = tc["index"].as_i64().unwrap_or(0) as usize;
        let id = tc["id"].as_str().unwrap_or("").to_string();
        let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
        let args_str = tc["function"]["arguments"].as_str().unwrap_or("");

        if idx < accumulator.len() {
            // Merge with existing: update id/name if present, accumulate arguments
            if !id.is_empty() {
                accumulator[idx].id = id;
            }
            if !name.is_empty() {
                accumulator[idx].name = name;
            }
            if !args_str.is_empty() {
                let partial_args: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
                // Merge partial JSON into accumulator
                if let (Some(target), Some(source)) = (
                    accumulator[idx].args.as_object_mut(),
                    partial_args.as_object(),
                ) {
                    for (k, v) in source {
                        target.insert(k.clone(), v.clone());
                    }
                }
            }
        } else {
            // New tool call
            let args: Value = serde_json::from_str(args_str).unwrap_or(json!({}));
            accumulator.push(ToolCall { id, name, args });
        }
    }
}

/// Parse an Anthropic SSE line for text deltas and tool use blocks.
/// Tool call blocks are accumulated in the provided Vec by index.
fn parse_anthropic_sse_line(
    event_type: &str,
    data: &str,
    tool_accumulator: &mut Vec<(usize, String, String, String)>,
) -> Option<ChatEvent> {
    let json: Value = serde_json::from_str(data).ok()?;

    match event_type {
        "content_block_start" => {
            if json["content_block"]["type"].as_str() == Some("tool_use") {
                let idx = json["index"].as_i64().unwrap_or(0) as usize;
                let id = json["content_block"]["id"].as_str().unwrap_or("").to_string();
                let name = json["content_block"]["name"].as_str().unwrap_or("").to_string();
                // Initial input from content_block_start (may be empty, completed by input_json_delta)
                let initial_args = json["content_block"]["input"]
                    .as_object()
                    .map(|obj| serde_json::to_string(obj).unwrap_or_default())
                    .unwrap_or_default();
                tool_accumulator.push((idx, id, name, initial_args));

                // Don't emit ToolCall yet — wait for content_block_stop to accumulate complete args
            }
        }
        "content_block_delta" => {
            if json["delta"]["type"].as_str() == Some("text_delta") {
                if let Some(text) = json["delta"]["text"].as_str() {
                    if !text.is_empty() {
                        return Some(ChatEvent::Token { content: text.to_string() });
                    }
                }
            }
            // Accumulate partial JSON for tool_use input blocks
            if json["delta"]["type"].as_str() == Some("input_json_delta") {
                let idx = json["index"].as_i64().unwrap_or(0) as usize;
                if let Some(partial) = json["delta"]["partial_json"].as_str() {
                    if let Some(entry) = tool_accumulator.iter_mut().find(|(i, _, _, _)| *i == idx) {
                        entry.3.push_str(partial);
                    }
                }
            }
        }
        "content_block_stop" => {
            // Finalize tool call — parse accumulated JSON and emit
            let idx = json["index"].as_i64().unwrap_or(0) as usize;
            if let Some(pos) = tool_accumulator.iter().position(|(i, _, _, _)| *i == idx) {
                let (_, id, name, args_str) = tool_accumulator.remove(pos);
                let args: Value = serde_json::from_str(&args_str).unwrap_or(json!({}));
                return Some(ChatEvent::ToolCall {
                    id,
                    name,
                    args,
                    auto_execute: true,
                });
            }
        }
        "message_delta" => {
            let stop = json["delta"]["stop_reason"].as_str();
            return Some(ChatEvent::Done {
                finish_reason: stop.map(|s| s.to_string()),
                usage: if json["usage"].is_null() || json["usage"].as_object().map_or(true, |o| o.is_empty()) {
                    None
                } else {
                    Some(UsageInfo {
                        input_tokens: json["usage"]["input_tokens"].as_u64(),
                        output_tokens: json["usage"]["output_tokens"].as_u64(),
                    })
                },
            });
        }
        "message_stop" => {
            // Already handled by message_delta, just ignore
        }
        _ => {}
    }
    None
}

/// Parse a Gemini SSE line for text and function calls.
fn parse_gemini_sse_line(
    data: &str,
) -> Option<ChatEvent> {
    if data == "[DONE]" { return None; }
    let json: Value = serde_json::from_str(data).ok()?;
    let candidate = json["candidates"].as_array()?.first()?;

    // Check finish reason
    if let Some(reason) = candidate["finishReason"].as_str() {
        if !reason.is_empty() && reason != "STOP" {
            return Some(ChatEvent::Done {
                finish_reason: Some(reason.to_string()),
                usage: if json["usageMetadata"].is_null() {
                    None
                } else {
                    Some(UsageInfo {
                        input_tokens: json["usageMetadata"]["promptTokenCount"].as_u64(),
                        output_tokens: json["usageMetadata"]["candidatesTokenCount"].as_u64(),
                    })
                },
            });
        }
    }

    let parts = candidate["content"]["parts"].as_array()?;
    for part in parts {
        if let Some(text) = part["text"].as_str() {
            if !text.is_empty() {
                return Some(ChatEvent::Token { content: text.to_string() });
            }
        }
        if let Some(fc) = part["functionCall"].as_object() {
            let name = fc.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let args = fc.get("args").cloned().unwrap_or(json!({}));
            return Some(ChatEvent::ToolCall {
                id: Uuid::new_v4().to_string(),
                name: name.to_string(),
                args,
                auto_execute: true,
            });
        }
    }
    None
}

// ── HTTP client helpers ────────────────────────────────────────────────────

use std::sync::LazyLock;

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        // SSE streams can run for minutes, but a stalled stream should
        // eventually time out to prevent hanging indefinitely.
        .timeout(std::time::Duration::from_secs(300))
        .tcp_keepalive(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("reqwest::Client::builder() should always succeed with these settings")
});

fn http_client() -> &'static reqwest::Client {
    &HTTP_CLIENT
}

// ── Streaming functions ────────────────────────────────────────────────────

/// Stream a chat response through the given sender.
/// Handles the tool-calling loop automatically.
pub async fn stream_chat(
    params: ChatParams,
    pool: SqlitePool,
    tx: UnboundedSender<ChatEvent>,
) -> Result<(), String> {
    let provider = params.provider.to_lowercase();
    let api_key = params.api_key.clone();
    let base_url = params.base_url.clone();
    let enable_tools = params.enable_tools.unwrap_or(true) && provider_supports_tools(&provider);

    // Validate all messages before processing
    for (i, msg) in params.messages.iter().enumerate() {
        msg.validate().map_err(|e| format!("Message at index {i}: {e}"))?;
    }

    // We run the tool loop: up to 10 rounds to prevent infinite loops
    let mut current_messages = params.messages.clone();
    let max_rounds = 10;

    for round in 0..max_rounds {
        let chat_params = ChatParams {
            messages: current_messages.clone(),
            enable_tools: Some(enable_tools && round < max_rounds - 1),
            ..params.clone()
        };

        // Send the request
        let response = match provider.as_str() {
            "openai" | "grok" | "openrouter" | "chatgpt" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_openai_request(&chat_params, include_tools, true);
                send_openai_stream(&chat_params, &api_key, &base_url, body, &tx).await?
            }
            "anthropic" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_anthropic_request(&chat_params, include_tools, true);
                send_anthropic_stream(&chat_params, &api_key, &base_url, body, &tx).await?
            }
            "gemini" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_gemini_request(&chat_params, include_tools, true);
                send_gemini_stream(&chat_params, &api_key, &base_url, body, &tx).await?
            }
            "ollama" => {
                let body = build_openai_request(&chat_params, false, true);
                send_ollama_stream(&chat_params, &base_url, body, &tx).await?
            }
            _ => return Err(format!("Unknown provider: {provider}")),
        };

        // Check if there was a tool call to process
        match response {
            StreamResult::Done => return Ok(()),
            StreamResult::ToolCalls(tool_calls) => {
                let defs = default_tool_definitions();
                for tc in &tool_calls {
                    let def = defs.iter().find(|d| d.name == tc.name);
                    let auto_execute = def.map(|d| d.auto_execute).unwrap_or(true);

                    if !auto_execute {
                        tx.send(ChatEvent::ToolCall {
                            id: tc.id.clone(),
                            name: tc.name.clone(),
                            args: tc.args.clone(),
                            auto_execute: false,
                        }).ok();
                        continue;
                    }

                    tx.send(ChatEvent::ToolCall {
                        id: tc.id.clone(),
                        name: tc.name.clone(),
                        args: tc.args.clone(),
                        auto_execute: true,
                    }).ok();

                    let result = execute_tool(&pool, &tc.name, &tc.args).await;
                    match result {
                        Ok(value) => {
                            tx.send(ChatEvent::ToolResult {
                                id: tc.id.clone(),
                                name: tc.name.clone(),
                                result: value.clone(),
                                is_error: false,
                            }).ok();

                            current_messages.push(ChatMessage {
                                role: "assistant".into(),
                                content: "".into(),
                                tool_calls: Some(vec![tc.clone()]),
                                tool_call_id: None,
                                tool_call_name: None,
                            });
                            current_messages.push(ChatMessage {
                                role: "tool".into(),
                                content: value.to_string(),
                                tool_calls: None,
                                tool_call_id: Some(tc.id.clone()),
                                tool_call_name: Some(tc.name.clone()),
                            });
                        }
                        Err(e) => {
                            tx.send(ChatEvent::ToolResult {
                                id: tc.id.clone(),
                                name: tc.name.clone(),
                                result: json!({"error": e}),
                                is_error: true,
                            }).ok();

                            current_messages.push(ChatMessage {
                                role: "assistant".into(),
                                content: "".into(),
                                tool_calls: Some(vec![tc.clone()]),
                                tool_call_id: None,
                                tool_call_name: None,
                            });
                            current_messages.push(ChatMessage {
                                role: "tool".into(),
                                content: format!("Error: {e}"),
                                tool_calls: None,
                                tool_call_id: Some(tc.id.clone()),
                                tool_call_name: Some(tc.name.clone()),
                            });
                        }
                    }
                }
                if !tool_calls.is_empty() {
                    let all_waiting = tool_calls.iter().all(|tc| {
                        defs.iter().find(|d| d.name == tc.name).map(|d| !d.auto_execute).unwrap_or(false)
                    });
                    if all_waiting {
                        tx.send(ChatEvent::Done { finish_reason: Some("tool_use".into()), usage: None }).ok();
                        return Ok(());
                    }
                    continue;
                }
                return Ok(());
            }
            // Error events are sent through the channel directly; no StreamResult::Error variant needed.
        }
    }

    tx.send(ChatEvent::Done { finish_reason: Some("max_turns".into()), usage: None }).ok();
    Ok(())
}

enum StreamResult {
    Done,
    ToolCalls(Vec<ToolCall>),
}

async fn send_openai_stream(
    _params: &ChatParams,
    api_key: &Option<String>,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let key = api_key.as_deref().ok_or_else(|| "No API key for OpenAI/Grok".to_string())?;
    let client = http_client();
    let url = format!("{}/chat/completions", base_url.as_deref().unwrap_or("https://api.openai.com/v1"));

    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if !line.starts_with("data: ") { continue; }

            let data = &line[6..];
            if data == "[DONE]" { break; }

            // Accumulate tool call deltas by index (OpenAI sends partial arguments across chunks)
            parse_openai_tool_deltas(data, &mut tool_calls);

            if let Some(event) = parse_openai_sse_line(data) {
                match event {
                    ChatEvent::Token { .. } => { tx.send(event).ok(); }
                    ChatEvent::Done { .. } => {
                        if tool_calls.is_empty() {
                            tx.send(event).ok();
                            return Ok(StreamResult::Done);
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        Ok(StreamResult::ToolCalls(tool_calls))
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

async fn send_anthropic_stream(
    _params: &ChatParams,
    api_key: &Option<String>,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let key = api_key.as_deref().ok_or_else(|| "No API key for Anthropic".to_string())?;
    let client = http_client();
    let url = format!("{}/messages", base_url.as_deref().unwrap_or("https://api.anthropic.com/v1"));

    let resp = client.post(&url)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut current_event = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();
    // Anthropic sends tool_use input as structured JSON across content_block_start → input_json_delta → content_block_stop
    let mut tool_accumulator: Vec<(usize, String, String, String)> = Vec::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }

            if line.starts_with("event: ") {
                current_event = line[7..].to_string();
            } else if line.starts_with("data: ") {
                let data = &line[6..];
                if let Some(event) = parse_anthropic_sse_line(&current_event, data, &mut tool_accumulator) {
                    match event {
                        ChatEvent::Token { .. } => { tx.send(event).ok(); }
                        ChatEvent::ToolCall { id, name, args, .. } => {
                            tool_calls.push(ToolCall { id, name, args });
                        }
                        ChatEvent::Done { .. } => {
                            if tool_calls.is_empty() {
                                tx.send(event).ok();
                                return Ok(StreamResult::Done);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        Ok(StreamResult::ToolCalls(tool_calls))
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

async fn send_gemini_stream(
    params: &ChatParams,
    api_key: &Option<String>,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let key = api_key.as_deref().ok_or_else(|| "No API key for Gemini".to_string())?;
    let client = http_client();
    let base = base_url.as_deref().unwrap_or("https://generativelanguage.googleapis.com/v1beta");
    let url = format!("{base}/models/{model}:streamGenerateContent?alt=sse&key={key}", model = params.model);

    let resp = client.post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if !line.starts_with("data: ") { continue; }

            let data = &line[6..];
            if data == "[DONE]" { break; }

            if let Some(event) = parse_gemini_sse_line(data) {
                match event {
                    ChatEvent::Token { .. } => { tx.send(event).ok(); }
                    ChatEvent::ToolCall { id, name, args, .. } => {
                        tool_calls.push(ToolCall { id, name, args });
                    }
                    ChatEvent::Done { .. } => {
                        if tool_calls.is_empty() {
                            tx.send(event).ok();
                            return Ok(StreamResult::Done);
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        Ok(StreamResult::ToolCalls(tool_calls))
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

async fn send_ollama_stream(
    _params: &ChatParams,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let client = http_client();
    let url = format!("{}/api/chat", base_url.as_deref().unwrap_or("http://localhost:11434"));

    let resp = client.post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if let Ok(json) = serde_json::from_str::<Value>(&line) {
                if let Some(token) = json["message"]["content"].as_str() {
                    if !token.is_empty() {
                        tx.send(ChatEvent::Token { content: token.to_string() }).ok();
                    }
                }
                if json.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                    tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
                    return Ok(StreamResult::Done);
                }
            }
        }
    }

    tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
    Ok(StreamResult::Done)
}

/// Perform a non-streaming chat completion.
/// Uses the streaming engine internally for full tool-calling support.
pub async fn complete_chat(
    params: ChatParams,
    pool: SqlitePool,
) -> Result<String, String> {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ChatEvent>();

    let stream_params = ChatParams {
        enable_tools: Some(params.enable_tools.unwrap_or(false)),
        ..params
    };

    let error_tx = tx.clone();
    tokio::spawn(async move {
        if let Err(e) = stream_chat(stream_params, pool, tx).await {
            eprintln!("[ai] complete_chat error: {e}");
            let _ = error_tx.send(ChatEvent::Error { message: e });
        }
    });

    let mut text = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            ChatEvent::Token { content } => text.push_str(&content),
            ChatEvent::Error { message } => return Err(message),
            ChatEvent::Done { .. } => return Ok(text),
            _ => {}
        }
    }
    Err("Chat stream ended without completion".to_string())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_role_valid() {
        for role in &["user", "assistant", "system", "tool"] {
            let msg = ChatMessage {
                role: role.to_string(),
                content: "hello".into(),
                tool_calls: None,
                tool_call_id: None,
                tool_call_name: None,
            };
            assert!(msg.validate().is_ok());
        }
    }

    #[test]
    fn test_validate_role_invalid() {
        for role in &["assistent", "model", "function", ""] {
            let msg = ChatMessage {
                role: role.to_string(),
                content: "hello".into(),
                tool_calls: None,
                tool_call_id: None,
                tool_call_name: None,
            };
            assert!(msg.validate().is_err());
        }
    }

    #[test]
    fn test_validate_role_empty_content() {
        let msg = ChatMessage {
            role: "user".into(),
            content: "".into(),
            tool_calls: None,
            tool_call_id: None,
            tool_call_name: None,
        };
        assert!(msg.validate().is_ok());
    }

    #[test]
    fn test_provider_supports_tools() {
        assert!(super::provider_supports_tools("openai"));
        assert!(super::provider_supports_tools("anthropic"));
        assert!(super::provider_supports_tools("gemini"));
        assert!(super::provider_supports_tools("grok"));
        assert!(super::provider_supports_tools("chatgpt"));
        assert!(!super::provider_supports_tools("ollama"));
        assert!(!super::provider_supports_tools("unknown"));
    }

    #[test]
    fn test_default_tool_definitions_are_valid() {
        let defs = super::default_tool_definitions();
        assert!(!defs.is_empty());
        for tool in defs {
            assert!(!tool.name.is_empty(), "Tool name should not be empty");
            assert!(!tool.description.is_empty(), "Tool {} description should not be empty", tool.name);
            assert_eq!(tool.input_schema["type"], "object", "Tool {} input_schema should be object", tool.name);
        }
    }

    #[test]
    fn test_openai_tool_delta_accumulation() {
        // Simulate two chunks for the same tool call at index 0
        let mut acc: Vec<ToolCall> = Vec::new();

        // Chunk 1: id + name + empty args
        parse_openai_tool_deltas(
            r#"{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_tasks","arguments":""}}]}}]}"#,
            &mut acc,
        );
        assert_eq!(acc.len(), 1);
        assert_eq!(acc[0].id, "call_1");
        assert_eq!(acc[0].name, "get_tasks");

        // Chunk 2: partial args (no id/name)
        parse_openai_tool_deltas(
            r#"{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"status\":\"pending\"}"}}]}}]}"#,
            &mut acc,
        );
        assert_eq!(acc.len(), 1, "Should not add new entry for existing index");
        assert_eq!(acc[0].args["status"], "pending");
    }

    #[test]
    fn test_openai_tool_delta_multiple_calls() {
        let mut acc: Vec<ToolCall> = Vec::new();

        // Two tool calls in one chunk
        parse_openai_tool_deltas(
            r#"{"choices":[{"index":0,"delta":{"tool_calls":[
                {"index":0,"id":"call_1","function":{"name":"get_tasks","arguments":""}},
                {"index":1,"id":"call_2","function":{"name":"create_task","arguments":"{\"title\":\"test\"}"}}
            ]}}]}"#,
            &mut acc,
        );
        assert_eq!(acc.len(), 2);
        assert_eq!(acc[0].name, "get_tasks");
        assert_eq!(acc[1].name, "create_task");
        assert_eq!(acc[1].args["title"], "test");
    }

    #[test]
    fn test_anthropic_tool_accumulation_across_events() {
        // Simulate content_block_start → input_json_delta → content_block_stop
        let mut emitter: Vec<(usize, String, String, String)> = Vec::new();

        // Start
        assert!(parse_anthropic_sse_line(
            "content_block_start",
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"get_tasks","input":{}}}"#,
            &mut emitter,
        ).is_none());
        assert_eq!(emitter.len(), 1);
        assert_eq!(emitter[0].1, "toolu_1");
        assert_eq!(emitter[0].2, "get_tasks");

        // Delta
        assert!(parse_anthropic_sse_line(
            "content_block_delta",
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"status\":\"pending\"}"}}"#,
            &mut emitter,
        ).is_none());
        assert_eq!(emitter[0].3, "{\"status\":\"pending\"}");

        // Stop should emit ToolCall with accumulated args
        let event = parse_anthropic_sse_line(
            "content_block_stop",
            r#"{"type":"content_block_stop","index":0}"#,
            &mut emitter,
        ).expect("Should emit ToolCall on content_block_stop");
        assert!(emitter.is_empty(), "Accumulator should be cleared after stop");

        match event {
            ChatEvent::ToolCall { id, name, args, .. } => {
                assert_eq!(id, "toolu_1");
                assert_eq!(name, "get_tasks");
                assert_eq!(args["status"], "pending");
            }
            _ => panic!("Expected ToolCall event"),
        }
    }
}
