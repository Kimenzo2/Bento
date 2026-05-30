use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::commands::DashboardCache;
use crate::db::BentoAppState;
use crate::util::time;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEntry {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub priority: String,
    pub project: String,
    pub tags: String, // JSON array of tag strings
    pub notes: String,
    pub due_at: Option<i64>,
    pub due_time: Option<String>,
    pub start_at: Option<i64>,
    pub estimated_minutes: Option<i64>,
    pub tracked_minutes: i64,
    pub recurrence_rule: Option<String>,
    pub archived: bool,
    pub parent_id: Option<String>,
    pub completed_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub sort_order: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderItem {
    pub id: String,
    pub sort_order: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTaskParams {
    pub title: String,
    pub priority: Option<String>,
    pub project: Option<String>,
    pub tags: Option<String>,
    pub notes: Option<String>,
    pub due_at: Option<i64>,
    pub due_time: Option<String>,
    pub start_at: Option<i64>,
    pub estimated_minutes: Option<i64>,
    pub recurrence_rule: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskParams {
    pub id: String,
    pub title: Option<String>,
    pub done: Option<bool>,
    pub priority: Option<String>,
    pub project: Option<String>,
    pub tags: Option<String>,
    pub notes: Option<String>,
    /// None = keep existing, Some(None) = clear, Some(Some(v)) = set
    pub due_at: Option<Option<i64>>,
    pub due_time: Option<Option<String>>,
    pub start_at: Option<Option<i64>>,
    pub estimated_minutes: Option<Option<i64>>,
    pub tracked_minutes: Option<i64>,
    pub recurrence_rule: Option<Option<String>>,
    pub archived: Option<bool>,
    pub completed_at: Option<Option<i64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogActivityParams {
    pub task_id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub id: String,
    pub task_id: String,
    pub text: String,
    pub timestamp: i64,
}

fn row_to_task(row: sqlx::sqlite::SqliteRow) -> TaskEntry {
    TaskEntry {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        done: row.try_get::<i64, _>("done").unwrap_or(0) == 1,
        priority: row
            .try_get("priority")
            .unwrap_or_else(|_| "none".to_string()),
        project: row
            .try_get("project")
            .unwrap_or_else(|_| "inbox".to_string()),
        tags: row.try_get("tags").unwrap_or_else(|_| "[]".to_string()),
        notes: row.try_get("notes").unwrap_or_default(),
        due_at: row.try_get("due_at").ok().flatten(),
        due_time: row.try_get("due_time").ok().flatten(),
        start_at: row.try_get("start_at").ok().flatten(),
        estimated_minutes: row.try_get("estimated_minutes").ok().flatten(),
        tracked_minutes: row.try_get("tracked_minutes").unwrap_or(0),
        recurrence_rule: row.try_get("recurrence_rule").ok().flatten(),
        archived: row.try_get::<i64, _>("archived").unwrap_or(0) == 1,
        parent_id: row.try_get("parent_id").ok().flatten(),
        completed_at: row.try_get("completed_at").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or(0),
        updated_at: row.try_get("updated_at").unwrap_or(0),
        sort_order: row.try_get("sort_order").unwrap_or(0.0),
    }
}

/// Save (insert) a new task.
#[tauri::command]
pub async fn save_task(
    state: State<'_, BentoAppState>,
    cache: State<'_, DashboardCache>,
    params: SaveTaskParams,
) -> Result<TaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();
    let id = Uuid::new_v4().to_string();

    let title = params.title.trim().to_string();
    if title.is_empty() {
        return Err("Task title is required.".to_string());
    }

    let priority = params.priority.unwrap_or_else(|| "none".to_string());
    let project = params.project.unwrap_or_else(|| "inbox".to_string());
    let tags = params.tags.unwrap_or_else(|| "[]".to_string());
    let notes = params.notes.unwrap_or_default();

    sqlx::query(
        "INSERT INTO tasks (id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, sort_order, parent_id, completed_at, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, NULL, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&priority)
    .bind(&project)
    .bind(&tags)
    .bind(&notes)
    .bind(params.due_at)
    .bind(&params.due_time)
    .bind(params.start_at)
    .bind(params.estimated_minutes)
    .bind(&params.recurrence_rule)
    .bind(now as f64)
    .bind(&params.parent_id)
    .bind(now)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    let result = TaskEntry {
        id,
        title,
        done: false,
        priority,
        project,
        tags,
        notes,
        due_at: params.due_at,
        due_time: params.due_time,
        start_at: params.start_at,
        estimated_minutes: params.estimated_minutes,
        tracked_minutes: 0,
        recurrence_rule: params.recurrence_rule,
        archived: false,
        sort_order: now as f64,
        parent_id: params.parent_id,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };
    // Invalidate dashboard cache so next poll reflects the new task
    cache.invalidate();
    Ok(result)
}

/// Update an existing task (partial update — only provided fields change).
#[tauri::command]
pub async fn update_task(
    state: State<'_, BentoAppState>,
    cache: State<'_, DashboardCache>,
    params: UpdateTaskParams,
) -> Result<TaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();

    let existing = sqlx::query("SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE id = ?")
        .bind(&params.id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?
        .map(row_to_task)
        .ok_or_else(|| format!("Task not found: {}", params.id))?;

    let title = params.title.unwrap_or(existing.title);
    let done = params.done.unwrap_or(existing.done);
    let priority = params.priority.unwrap_or(existing.priority);
    let project = params.project.unwrap_or(existing.project);
    let tags = params.tags.unwrap_or(existing.tags);
    let notes = params.notes.unwrap_or(existing.notes);
    // Double-Option: None=unchanged, Some(None)=clear, Some(Some(v))=set
    let due_at = match params.due_at {
        None => existing.due_at,
        Some(v) => v,
    };
    let due_time = match params.due_time {
        None => existing.due_time,
        Some(v) => v,
    };
    let start_at = match params.start_at {
        None => existing.start_at,
        Some(v) => v,
    };
    let estimated_minutes = match params.estimated_minutes {
        None => existing.estimated_minutes,
        Some(v) => v,
    };
    let tracked_minutes = params.tracked_minutes.unwrap_or(existing.tracked_minutes);
    let recurrence_rule = match params.recurrence_rule {
        None => existing.recurrence_rule,
        Some(v) => v,
    };
    let archived = params.archived.unwrap_or(existing.archived);
    let completed_at = match params.completed_at {
        None => existing.completed_at,
        Some(v) => v,
    };
    let sort_order = existing.sort_order;

    sqlx::query(
        "UPDATE tasks SET title = ?, done = ?, priority = ?, project = ?, tags = ?, notes = ?, due_at = ?, due_time = ?, start_at = ?, estimated_minutes = ?, tracked_minutes = ?, recurrence_rule = ?, archived = ?, completed_at = ?, sort_order = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(if done { 1i64 } else { 0i64 })
    .bind(&priority)
    .bind(&project)
    .bind(&tags)
    .bind(&notes)
    .bind(due_at)
    .bind(&due_time)
    .bind(start_at)
    .bind(estimated_minutes)
    .bind(tracked_minutes)
    .bind(&recurrence_rule)
    .bind(if archived { 1i64 } else { 0i64 })
    .bind(completed_at)
    .bind(sort_order)
    .bind(now)
    .bind(&params.id)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    let updated = TaskEntry {
        id: existing.id,
        title,
        done,
        priority,
        project,
        tags,
        notes,
        due_at,
        due_time,
        start_at,
        estimated_minutes,
        tracked_minutes,
        recurrence_rule,
        archived,
        sort_order,
        parent_id: existing.parent_id,
        completed_at,
        created_at: existing.created_at,
        updated_at: now,
    };
    cache.invalidate();
    Ok(updated)
}

/// Toggle a task's done state. If the task has a recurrence rule,
/// auto-generate the next instance on completion.
#[tauri::command]
pub async fn toggle_task(
    state: State<'_, BentoAppState>,
    cache: State<'_, DashboardCache>,
    id: String,
) -> Result<TaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();

    let row = sqlx::query("SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Task not found: {id}"))?;

    let current_done: i64 = row.try_get("done").unwrap_or(0);
    let new_done = current_done == 0;
    let completed_at = if new_done { Some(now) } else { None };

    // If completing a recurring task and it has a recurrence rule, generate the next instance
    if new_done {
        let recurrence_rule: Option<String> = row.try_get("recurrence_rule").ok().flatten();
        if let Some(ref rule) = recurrence_rule {
            if !rule.is_empty() {
                let new_id = Uuid::new_v4().to_string();
                let new_due_at = advance_recurrence(
                    rule,
                    row.try_get::<Option<i64>, _>("due_at").ok().flatten(),
                );

                sqlx::query(
                    "INSERT INTO tasks (id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, sort_order, parent_id, completed_at, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)",
                )
                .bind(&new_id)
                .bind(row.try_get::<String, _>("title").unwrap_or_default())
                .bind(row.try_get::<String, _>("priority").unwrap_or_else(|_| "none".to_string()))
                .bind(row.try_get::<String, _>("project").unwrap_or_else(|_| "inbox".to_string()))
                .bind(row.try_get::<String, _>("tags").unwrap_or_else(|_| "[]".to_string()))
                .bind(row.try_get::<String, _>("notes").unwrap_or_default())
                .bind(new_due_at)
                .bind(row.try_get::<Option<String>, _>("due_time").ok().flatten())
                .bind(row.try_get::<Option<i64>, _>("start_at").ok().flatten())
                .bind(row.try_get::<Option<i64>, _>("estimated_minutes").ok().flatten())
                .bind(row.try_get::<i64, _>("tracked_minutes").unwrap_or(0))
                .bind(rule)
                .bind(now as f64)
                .bind(row.try_get::<Option<String>, _>("parent_id").ok().flatten())
                .bind(now)
                .bind(now)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())?;
            }
        }
    }

    sqlx::query("UPDATE tasks SET done = ?, completed_at = ?, updated_at = ? WHERE id = ?")
        .bind(if new_done { 1i64 } else { 0i64 })
        .bind(completed_at)
        .bind(now)
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    let updated = sqlx::query("SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_one(&db)
        .await
        .map_err(|e| e.to_string())?;

    let task = row_to_task(updated);
    cache.invalidate();
    Ok(task)
}

/// Advance a due_at date by one recurrence interval.
fn advance_recurrence(rule: &str, current_due: Option<i64>) -> Option<i64> {
    let due_ms = current_due?;
    let interval_days: i64 = match rule {
        r if r.starts_with("daily") => 1,
        r if r.starts_with("weekly") => 7,
        r if r.starts_with("biweekly") || r == "every 2 weeks" => 14,
        r if r.starts_with("monthly") => 30,
        r if r.starts_with("yearly") => 365,
        _ => {
            // Try to parse "every N days/weeks"
            let parts: Vec<&str> = rule.split_whitespace().collect();
            if parts.len() >= 3 && parts[0] == "every" {
                if let Ok(n) = parts[1].parse::<i64>() {
                    return match parts[2] {
                        "days" | "day" => Some(due_ms + n * 86_400_000),
                        "weeks" | "week" => Some(due_ms + n * 7 * 86_400_000),
                        "months" | "month" => Some(due_ms + n * 30 * 86_400_000),
                        _ => Some(due_ms + 86_400_000),
                    };
                }
            }
            1
        }
    };
    Some(due_ms + interval_days * 86_400_000)
}

/// Get a task by ID.
#[tauri::command]
pub async fn get_task(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<Option<TaskEntry>, String> {
    let db = state.db();

    let row = sqlx::query("SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(row_to_task))
}

/// Delete a task by ID.
#[tauri::command]
pub async fn delete_task(
    state: State<'_, BentoAppState>,
    cache: State<'_, DashboardCache>,
    id: String,
) -> Result<(), String> {
    let db = state.db();
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    cache.invalidate();
    Ok(())
}

/// List tasks with optional filters.
#[tauri::command]
pub async fn list_tasks(
    state: State<'_, BentoAppState>,
    project: Option<String>,
    priority: Option<String>,
    done: Option<bool>,
    due_before: Option<i64>,
    due_after: Option<i64>,
    archived: Option<bool>,
    limit: Option<i32>,
) -> Result<Vec<TaskEntry>, String> {
    let db = state.db();
    let limit = limit.unwrap_or(100).max(1).min(10000);

    let mut q = sqlx::query_builder::QueryBuilder::new(
        "SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE 1=1",
    );

    // Default: exclude archived tasks unless explicitly requested
    if let Some(a) = archived {
        q.push(" AND archived = ");
        q.push_bind(if a { 1i64 } else { 0i64 });
    } else {
        q.push(" AND archived = 0");
    }

    if let Some(ref p) = project {
        q.push(" AND project = ");
        q.push_bind(p.clone());
    }
    if let Some(ref p) = priority {
        q.push(" AND priority = ");
        q.push_bind(p.clone());
    }
    if let Some(d) = done {
        q.push(" AND done = ");
        q.push_bind(if d { 1i64 } else { 0i64 });
    }
    if let Some(before) = due_before {
        q.push(" AND (due_at IS NOT NULL AND due_at <= ");
        q.push_bind(before);
        q.push(")");
    }
    if let Some(after) = due_after {
        q.push(" AND (due_at IS NOT NULL AND due_at >= ");
        q.push_bind(after);
        q.push(")");
    }

    q.push(" ORDER BY done ASC, archived ASC, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC, due_at ASC NULLS LAST, created_at DESC");
    q.push(" LIMIT ");
    q.push_bind(limit as i64);

    let query = q.build();

    let rows = query.fetch_all(&db).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(row_to_task).collect())
}

/// Log an activity entry for a task.
#[tauri::command]
pub async fn log_activity_entry(
    state: State<'_, BentoAppState>,
    params: LogActivityParams,
) -> Result<ActivityEntry, String> {
    let db = state.db();
    let now = time::now_ms();
    let id = Uuid::new_v4().to_string();

    // Create the activity_logs table if it doesn't exist (inline migration)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )",
    )
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO activity_logs (id, task_id, text, timestamp) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&params.task_id)
        .bind(&params.text)
        .bind(now)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActivityEntry {
        id,
        task_id: params.task_id,
        text: params.text,
        timestamp: now,
    })
}

/// Archive a task (set archived = true).
#[tauri::command]
pub async fn archive_task(
    state: State<'_, BentoAppState>,
    cache: State<'_, DashboardCache>,
    id: String,
) -> Result<TaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();

    let existing = sqlx::query("SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?
        .map(row_to_task)
        .ok_or_else(|| format!("Task not found: {}", id))?;

    sqlx::query("UPDATE tasks SET archived = 1, updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    cache.invalidate();
    Ok(TaskEntry {
        archived: true,
        updated_at: now,
        ..existing
    })
}

/// Duplicate a task (copy with new ID).
#[tauri::command]
pub async fn duplicate_task(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<TaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();

    let existing = sqlx::query("SELECT id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at, sort_order FROM tasks WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?
        .map(row_to_task)
        .ok_or_else(|| format!("Task not found: {}", id))?;

    let new_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO tasks (id, title, done, priority, project, tags, notes, due_at, due_time, start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, parent_id, completed_at, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)",
    )
    .bind(&new_id)
    .bind(format!("{} (copy)", existing.title))
    .bind(&existing.priority)
    .bind(&existing.project)
    .bind(&existing.tags)
    .bind(&existing.notes)
    .bind(existing.due_at)
    .bind(&existing.due_time)
    .bind(existing.start_at)
    .bind(existing.estimated_minutes)
    .bind(existing.tracked_minutes)
    .bind(&existing.recurrence_rule)
    .bind(now)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(TaskEntry {
        id: new_id,
        done: false,
        archived: false,
        completed_at: None,
        created_at: now,
        updated_at: now,
        ..existing
    })
}

// ─── Subtask types ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtaskEntry {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub done: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSubtaskParams {
    pub task_id: String,
    pub title: String,
}

/// Save (insert) a new subtask.
#[tauri::command]
pub async fn save_subtask(
    state: State<'_, BentoAppState>,
    params: SaveSubtaskParams,
) -> Result<SubtaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();
    let id = Uuid::new_v4().to_string();

    let title = params.title.trim().to_string();
    if title.is_empty() {
        return Err("Subtask title is required.".to_string());
    }

    sqlx::query(
        "INSERT INTO subtasks (id, task_id, title, done, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
    )
    .bind(&id)
    .bind(&params.task_id)
    .bind(&title)
    .bind(now)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(SubtaskEntry {
        id,
        task_id: params.task_id,
        title,
        done: false,
        created_at: now,
        updated_at: now,
    })
}

/// Delete a subtask by ID.
#[tauri::command]
pub async fn delete_subtask(state: State<'_, BentoAppState>, id: String) -> Result<(), String> {
    let db = state.db();
    sqlx::query("DELETE FROM subtasks WHERE id = ?")
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// List all subtasks for a given task.
#[tauri::command]
pub async fn list_subtasks_for_task(
    state: State<'_, BentoAppState>,
    task_id: String,
) -> Result<Vec<SubtaskEntry>, String> {
    let db = state.db();
    let rows = sqlx::query(
        "SELECT id, task_id, title, done, created_at, updated_at FROM subtasks WHERE task_id = ? ORDER BY created_at ASC"
    )
    .bind(&task_id)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| SubtaskEntry {
            id: row.try_get("id").unwrap_or_default(),
            task_id: row.try_get("task_id").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            done: row.try_get::<i64, _>("done").unwrap_or(0) == 1,
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

/// Update a subtask's done status.
#[tauri::command]
pub async fn update_subtask_status(
    state: State<'_, BentoAppState>,
    id: String,
    done: bool,
) -> Result<SubtaskEntry, String> {
    let db = state.db();
    let now = time::now_ms();

    sqlx::query("UPDATE subtasks SET done = ?, updated_at = ? WHERE id = ?")
        .bind(if done { 1i64 } else { 0i64 })
        .bind(now)
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, task_id, title, done, created_at, updated_at FROM subtasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(SubtaskEntry {
        id: row.try_get("id").unwrap_or_default(),
        task_id: row.try_get("task_id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        done: row.try_get::<i64, _>("done").unwrap_or(0) == 1,
        created_at: row.try_get("created_at").unwrap_or(0),
        updated_at: row.try_get("updated_at").unwrap_or(0),
    })
}

/// Reorder tasks in bulk (set sort_order for each).
#[tauri::command]
pub async fn reorder_tasks(
    state: State<'_, BentoAppState>,
    cache: State<'_, DashboardCache>,
    items: Vec<ReorderItem>,
) -> Result<(), String> {
    let db = state.db();
    for item in &items {
        sqlx::query("UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?")
            .bind(item.sort_order)
            .bind(time::now_ms())
            .bind(&item.id)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;
    }
    cache.invalidate();
    Ok(())
}

/// List activity entries for a task.
#[tauri::command]
pub async fn list_activity_for_task(
    state: State<'_, BentoAppState>,
    task_id: String,
    limit: Option<i32>,
) -> Result<Vec<ActivityEntry>, String> {
    let db = state.db();
    let limit = limit.unwrap_or(50).max(1).min(200);

    // Ensure table exists
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )",
    )
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    let rows = sqlx::query(
        "SELECT id, task_id, text, timestamp FROM activity_logs WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?"
    )
    .bind(&task_id)
    .bind(limit as i64)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ActivityEntry {
            id: row.try_get("id").unwrap_or_default(),
            task_id: row.try_get("task_id").unwrap_or_default(),
            text: row.try_get("text").unwrap_or_default(),
            timestamp: row.try_get("timestamp").unwrap_or(0),
        })
        .collect())
}
