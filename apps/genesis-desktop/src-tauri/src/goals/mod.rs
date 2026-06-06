// ─────────────────────────────────────────────────────────────────────────────
// Goals — SQLite-backed goal tracking with weekly/monthly/yearly horizons
// Tables: goals, goal_subtasks, goal_reviews, focus_areas
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ═══ TYPES ═══════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalRow {
    pub id: String,
    pub title: String,
    pub description: String,
    pub horizon: String,
    pub progress: i32,
    pub target_date: Option<String>,
    pub success_criteria: Option<String>,
    pub notes: Option<String>,
    pub image_data: Option<String>,
    pub update_history: String, // JSON array of epoch-ms timestamps
    pub is_big_3: bool,
    pub focus_area_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalReviewRow {
    pub id: String,
    pub goal_id: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalReviewPayload {
    pub goal_id: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalSubtaskRow {
    pub id: String,
    pub goal_id: String,
    pub title: String,
    pub completed: bool,
    pub position: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusAreaRow {
    pub id: String,
    pub name: String,
    pub position: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusAreaSavePayload {
    pub id: Option<String>,
    pub name: String,
    pub position: Option<i32>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalSavePayload {
    pub id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub horizon: String,
    pub progress: Option<i32>,
    pub target_date: Option<String>,
    pub success_criteria: Option<String>,
    pub notes: Option<String>,
    pub image_data: Option<String>,
    pub is_big_3: Option<bool>,
    pub focus_area_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalProgressPayload {
    pub id: String,
    pub progress: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalSubtaskSavePayload {
    pub id: Option<String>,
    pub goal_id: String,
    pub title: String,
    pub position: Option<i32>,
}

// ═══ TABLE BOOTSTRAP ══════════════════════════════════════════════════════════

pub async fn ensure_goals_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let ddl = [
        r#"CREATE TABLE IF NOT EXISTS goals (
            id               TEXT PRIMARY KEY,
            title            TEXT NOT NULL,
            description      TEXT NOT NULL DEFAULT '',
            horizon          TEXT NOT NULL DEFAULT 'weekly',
            progress         INTEGER NOT NULL DEFAULT 0,
            target_date      TEXT,
            success_criteria TEXT,
            notes            TEXT,
            image_data       TEXT,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS goal_subtasks (
            id        TEXT PRIMARY KEY,
            goal_id   TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
            title     TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            position  INTEGER NOT NULL DEFAULT 0
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_goal_subtasks_goal_id ON goal_subtasks(goal_id)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_goals_horizon ON goals(horizon)"#,
        r#"CREATE TABLE IF NOT EXISTS goal_reviews (
            id         TEXT PRIMARY KEY,
            goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
            content    TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_goal_reviews_goal_id ON goal_reviews(goal_id)"#,
        r#"CREATE TABLE IF NOT EXISTS focus_areas (
            id       TEXT PRIMARY KEY,
            name     TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_focus_areas_position ON focus_areas(position)"#,
    ];
    for sql in ddl {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Migration: add update_history column if not present
    let cols1: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM pragma_table_info('goals') WHERE name = 'update_history'",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    if cols1.is_empty() {
        let _ = sqlx::query(
            "ALTER TABLE goals ADD COLUMN update_history TEXT NOT NULL DEFAULT '[]'",
        )
        .execute(pool)
        .await;
    }

    // Migration: add is_big_3 column if not present
    let cols2: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM pragma_table_info('goals') WHERE name = 'is_big_3'",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    if cols2.is_empty() {
        let _ = sqlx::query(
            "ALTER TABLE goals ADD COLUMN is_big_3 INTEGER NOT NULL DEFAULT 0",
        )
        .execute(pool)
        .await;
    }

    // Migration: add focus_area_id column if not present
    let cols3: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM pragma_table_info('goals') WHERE name = 'focus_area_id'",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    if cols3.is_empty() {
        let _ = sqlx::query(
            "ALTER TABLE goals ADD COLUMN focus_area_id TEXT REFERENCES focus_areas(id)",
        )
        .execute(pool)
        .await;
    }

    Ok(())
}

/// Append a timestamp (epoch ms) to the goal's update_history JSON array.
async fn append_update_history(pool: &sqlx::SqlitePool, goal_id: &str, now: &str) {
    let current: Option<(String,)> = sqlx::query_as(
        "SELECT update_history FROM goals WHERE id = ?",
    )
    .bind(goal_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let updated = if let Some((history,)) = current {
        if history == "[]" || history.is_empty() {
            format!(r#"["{}"]"#, now)
        } else {
            let trimmed = history.trim_end();
            if trimmed.ends_with(']') {
                let base = trimmed[..trimmed.len() - 1].trim_end().to_string();
                format!(r#"{},{}"]"#, base, now)
            } else {
                format!(r#"["{}"]"#, now)
            }
        }
    } else {
        format!(r#"["{}"]"#, now)
    };

    let _ = sqlx::query("UPDATE goals SET update_history = ? WHERE id = ?")
        .bind(&updated)
        .bind(goal_id)
        .execute(pool)
        .await;
}

// ═══ HELPERS ═══════════════════════════════════════════════════════════════════

fn row_to_goal(row: sqlx::sqlite::SqliteRow) -> GoalRow {
    GoalRow {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        description: row.try_get("description").unwrap_or_default(),
        horizon: row.try_get("horizon").unwrap_or_else(|_| "weekly".to_string()),
        progress: row.try_get("progress").unwrap_or(0),
        target_date: row.try_get("target_date").ok().flatten(),
        success_criteria: row.try_get("success_criteria").ok().flatten(),
        notes: row.try_get("notes").ok().flatten(),
        image_data: row.try_get("image_data").ok().flatten(),
        update_history: row.try_get("update_history").unwrap_or_else(|_| "[]".to_string()),
        is_big_3: row.try_get::<i64, _>("is_big_3").unwrap_or(0) == 1,
        focus_area_id: row.try_get("focus_area_id").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_default(),
        updated_at: row.try_get("updated_at").unwrap_or_default(),
    }
}

/// Shared SELECT column list (excluding id for the leading comma).
const GOAL_COLS: &str = "id, title, description, horizon, progress, target_date, success_criteria, notes, image_data, update_history, is_big_3, focus_area_id, created_at, updated_at";

async fn fetch_goal(pool: &sqlx::SqlitePool, id: &str) -> Result<GoalRow, String> {
    let q = format!("SELECT {} FROM goals WHERE id = ?", GOAL_COLS);
    let row = sqlx::query(&q)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row_to_goal(row))
}

// ═══ GOALS_LIST ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn goals_list(
    state: State<'_, BentoAppState>,
    horizon: Option<String>,
) -> Result<Vec<GoalRow>, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let rows = if let Some(ref h) = horizon {
        let q = format!(
            "SELECT {} FROM goals WHERE horizon = ? ORDER BY created_at DESC",
            GOAL_COLS
        );
        sqlx::query(&q)
            .bind(h)
            .fetch_all(&db)
            .await
            .map_err(|e| e.to_string())?
    } else {
        let q = format!(
            "SELECT {} FROM goals ORDER BY \
             CASE horizon WHEN 'weekly' THEN 0 WHEN 'monthly' THEN 1 WHEN 'yearly' THEN 2 ELSE 3 END, \
             created_at DESC",
            GOAL_COLS
        );
        sqlx::query(&q)
            .fetch_all(&db)
            .await
            .map_err(|e| e.to_string())?
    };

    Ok(rows.into_iter().map(row_to_goal).collect())
}

// ═══ GOALS_SAVE ═══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn goals_save(
    state: State<'_, BentoAppState>,
    payload: GoalSavePayload,
) -> Result<GoalRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let title = payload.title.trim().to_string();
    if title.is_empty() {
        return Err("Goal title is required.".to_string());
    }

    let now = time::now_ms().to_string();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let description = payload.description.unwrap_or_default();
    let horizon = payload.horizon.trim().to_lowercase();
    if !matches!(horizon.as_str(), "weekly" | "monthly" | "yearly") {
        return Err("Horizon must be 'weekly', 'monthly', or 'yearly'.".to_string());
    }
    let progress = payload.progress.unwrap_or(0).clamp(0, 100);
    let target_date = payload.target_date;
    let success_criteria = payload.success_criteria;
    let notes = payload.notes;
    let image_data = payload.image_data;
    let is_big_3 = if payload.is_big_3.unwrap_or(false) { 1i64 } else { 0i64 };
    let focus_area_id = payload.focus_area_id;

    // Check if goal exists (upsert)
    let existing: Option<(String, String, String)> =
        sqlx::query_as::<_, (String, String, String)>(
            "SELECT id, created_at, update_history FROM goals WHERE id = ?",
        )
        .bind(&id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?;

    if let Some((_, created_at, update_history)) = existing {
        sqlx::query(
            "UPDATE goals SET title=?, description=?, horizon=?, progress=?, target_date=?, \
             success_criteria=?, notes=?, image_data=?, is_big_3=?, focus_area_id=?, updated_at=? WHERE id=?",
        )
        .bind(&title)
        .bind(&description)
        .bind(&horizon)
        .bind(progress)
        .bind(&target_date)
        .bind(&success_criteria)
        .bind(&notes)
        .bind(&image_data)
        .bind(is_big_3)
        .bind(&focus_area_id)
        .bind(&now)
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(GoalRow {
            id,
            title,
            description,
            horizon,
            progress,
            target_date,
            success_criteria,
            notes,
            image_data,
            update_history,
            is_big_3: is_big_3 == 1,
            focus_area_id,
            created_at,
            updated_at: now,
        })
    } else {
        let created_at = now.clone();
        sqlx::query(
            "INSERT INTO goals (id, title, description, horizon, progress, target_date, \
             success_criteria, notes, image_data, update_history, is_big_3, focus_area_id, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&title)
        .bind(&description)
        .bind(&horizon)
        .bind(progress)
        .bind(&target_date)
        .bind(&success_criteria)
        .bind(&notes)
        .bind(&image_data)
        .bind("[]")
        .bind(is_big_3)
        .bind(&focus_area_id)
        .bind(&created_at)
        .bind(&now)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(GoalRow {
            id,
            title,
            description,
            horizon,
            progress,
            target_date,
            success_criteria,
            notes,
            image_data,
            update_history: "[]".to_string(),
            is_big_3: is_big_3 == 1,
            focus_area_id,
            created_at,
            updated_at: now,
        })
    }
}

// ═══ GOALS_DELETE ═════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn goals_delete(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    sqlx::query("DELETE FROM goals WHERE id = ?")
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ═══ GOALS_PROGRESS_UPDATE ═══════════════════════════════════════════════════

#[tauri::command]
pub async fn goals_progress_update(
    state: State<'_, BentoAppState>,
    payload: GoalProgressPayload,
) -> Result<GoalRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let progress = payload.progress.clamp(0, 100);
    let now = time::now_ms().to_string();

    let affected = sqlx::query("UPDATE goals SET progress = ?, updated_at = ? WHERE id = ?")
        .bind(progress)
        .bind(&now)
        .bind(&payload.id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    if affected.rows_affected() == 0 {
        return Err(format!("Goal not found: {}", payload.id));
    }

    append_update_history(&db, &payload.id, &now).await;

    fetch_goal(&db, &payload.id).await
}

// ═══ GOAL_SUBTASKS_LIST ═════════════════════════════════════════════════════

#[tauri::command]
pub async fn goal_subtasks_list(
    state: State<'_, BentoAppState>,
    goal_id: String,
) -> Result<Vec<GoalSubtaskRow>, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let rows = sqlx::query(
        "SELECT id, goal_id, title, completed, position FROM goal_subtasks \
         WHERE goal_id = ? ORDER BY position ASC, id ASC",
    )
    .bind(&goal_id)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| GoalSubtaskRow {
            id: r.try_get("id").unwrap_or_default(),
            goal_id: r.try_get("goal_id").unwrap_or_default(),
            title: r.try_get("title").unwrap_or_default(),
            completed: r.try_get::<i64, _>("completed").unwrap_or(0) == 1,
            position: r.try_get("position").unwrap_or(0),
        })
        .collect())
}

// ═══ GOAL_SUBTASK_SAVE ═══════════════════════════════════════════════════════

#[tauri::command]
pub async fn goal_subtask_save(
    state: State<'_, BentoAppState>,
    payload: GoalSubtaskSavePayload,
) -> Result<GoalSubtaskRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let title = payload.title.trim().to_string();
    if title.is_empty() {
        return Err("Subtask title is required.".to_string());
    }

    let id = payload.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let position = payload.position.unwrap_or(0);

    let existing: Option<(String,)> = sqlx::query_as::<_, (String,)>(
        "SELECT id FROM goal_subtasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    if existing.is_some() {
        sqlx::query("UPDATE goal_subtasks SET title = ?, position = ? WHERE id = ?")
            .bind(&title)
            .bind(position)
            .bind(&id)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;

        let row = sqlx::query(
            "SELECT id, goal_id, title, completed, position FROM goal_subtasks WHERE id = ?",
        )
        .bind(&id)
        .fetch_one(&db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(GoalSubtaskRow {
            id: row.try_get("id").unwrap_or_default(),
            goal_id: row.try_get("goal_id").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            completed: row.try_get::<i64, _>("completed").unwrap_or(0) == 1,
            position: row.try_get("position").unwrap_or(0),
        })
    } else {
        sqlx::query(
            "INSERT INTO goal_subtasks (id, goal_id, title, completed, position) VALUES (?, ?, ?, 0, ?)",
        )
        .bind(&id)
        .bind(&payload.goal_id)
        .bind(&title)
        .bind(position)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

        let now = time::now_ms().to_string();
        let _ = sqlx::query("UPDATE goals SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(&payload.goal_id)
            .execute(&db)
            .await;

        Ok(GoalSubtaskRow {
            id,
            goal_id: payload.goal_id,
            title,
            completed: false,
            position,
        })
    }
}

// ═══ GOAL_SUBTASK_TOGGLE ═════════════════════════════════════════════════════

#[tauri::command]
pub async fn goal_subtask_toggle(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<GoalSubtaskRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let row = sqlx::query(
        "SELECT id, goal_id, title, completed, position FROM goal_subtasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    let (goal_id, current_completed): (String, i64) = row
        .map(|r| {
            (
                r.try_get::<String, _>("goal_id").unwrap_or_default(),
                r.try_get::<i64, _>("completed").unwrap_or(0),
            )
        })
        .ok_or_else(|| format!("Subtask not found: {id}"))?;

    let new_completed = if current_completed == 0 { 1i64 } else { 0i64 };

    sqlx::query("UPDATE goal_subtasks SET completed = ? WHERE id = ?")
        .bind(new_completed)
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    let now = time::now_ms().to_string();
    let _ = sqlx::query("UPDATE goals SET updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&goal_id)
        .execute(&db)
        .await;

    let updated = sqlx::query(
        "SELECT id, goal_id, title, completed, position FROM goal_subtasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(GoalSubtaskRow {
        id: updated.try_get("id").unwrap_or_default(),
        goal_id: updated.try_get("goal_id").unwrap_or_default(),
        title: updated.try_get("title").unwrap_or_default(),
        completed: updated.try_get::<i64, _>("completed").unwrap_or(0) == 1,
        position: updated.try_get("position").unwrap_or(0),
    })
}

// ═══ GOAL_ADD_REVIEW ═══════════════════════════════════════════════════════

#[tauri::command]
pub async fn goal_add_review(
    state: State<'_, BentoAppState>,
    payload: GoalReviewPayload,
) -> Result<GoalReviewRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let content = payload.content.trim().to_string();
    if content.is_empty() {
        return Err("Review content cannot be empty.".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms().to_string();

    sqlx::query(
        "INSERT INTO goal_reviews (id, goal_id, content, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.goal_id)
    .bind(&content)
    .bind(&now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    append_update_history(&db, &payload.goal_id, &now).await;

    let _ = sqlx::query("UPDATE goals SET updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&payload.goal_id)
        .execute(&db)
        .await;

    Ok(GoalReviewRow {
        id,
        goal_id: payload.goal_id,
        content,
        created_at: now,
    })
}

// ═══ GOAL_REVIEWS_LIST ═════════════════════════════════════════════════════

#[tauri::command]
pub async fn goal_reviews_list(
    state: State<'_, BentoAppState>,
    goal_id: String,
) -> Result<Vec<GoalReviewRow>, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let rows = sqlx::query(
        "SELECT id, goal_id, content, created_at FROM goal_reviews \
         WHERE goal_id = ? ORDER BY created_at DESC",
    )
    .bind(&goal_id)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| GoalReviewRow {
            id: r.try_get("id").unwrap_or_default(),
            goal_id: r.try_get("goal_id").unwrap_or_default(),
            content: r.try_get("content").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or_default(),
        })
        .collect())
}

// ═══ GOALS_TOGGLE_BIG_3 ═════════════════════════════════════════════════════

/// Toggle a goal's big-3 status. If setting to true, un-set any existing big-3
/// goals first so there are at most 3.
#[tauri::command]
pub async fn goals_toggle_big_3(
    state: State<'_, BentoAppState>,
    id: String,
    is_big_3: bool,
) -> Result<GoalRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    if is_big_3 {
        // Count current Big 3 goals, un-set oldest if at 3
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM goals WHERE is_big_3 = 1 AND id != ?",
        )
        .bind(&id)
        .fetch_one(&db)
        .await
        .map_err(|e| e.to_string())?;

        if count.0 >= 3 {
            // Un-set the oldest big-3 goal (by updated_at ASC)
            let _ = sqlx::query(
                "UPDATE goals SET is_big_3 = 0 WHERE id IN (\
                 SELECT id FROM goals WHERE is_big_3 = 1 AND id != ? \
                 ORDER BY updated_at ASC LIMIT 1)",
            )
            .bind(&id)
            .execute(&db)
            .await;
        }
    }

    let val = if is_big_3 { 1i64 } else { 0i64 };
    let now = time::now_ms().to_string();

    sqlx::query("UPDATE goals SET is_big_3 = ?, updated_at = ? WHERE id = ?")
        .bind(val)
        .bind(&now)
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    fetch_goal(&db, &id).await
}

// ═══ FOCUS_AREAS_LIST ══════════════════════════════════════════════════════

#[tauri::command]
pub async fn focus_areas_list(
    state: State<'_, BentoAppState>,
) -> Result<Vec<FocusAreaRow>, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let rows = sqlx::query(
        "SELECT id, name, position FROM focus_areas ORDER BY position ASC, name ASC",
    )
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| FocusAreaRow {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            position: r.try_get("position").unwrap_or(0),
        })
        .collect())
}

// ═══ FOCUS_AREA_SAVE ═══════════════════════════════════════════════════════

#[tauri::command]
pub async fn focus_area_save(
    state: State<'_, BentoAppState>,
    payload: FocusAreaSavePayload,
) -> Result<FocusAreaRow, String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("Focus area name is required.".to_string());
    }

    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let position = payload.position.unwrap_or(0);

    let existing: Option<(String,)> = sqlx::query_as::<_, (String,)>(
        "SELECT id FROM focus_areas WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    if existing.is_some() {
        sqlx::query("UPDATE focus_areas SET name = ?, position = ? WHERE id = ?")
            .bind(&name)
            .bind(position)
            .bind(&id)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query("INSERT INTO focus_areas (id, name, position) VALUES (?, ?, ?)")
            .bind(&id)
            .bind(&name)
            .bind(position)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(FocusAreaRow {
        id,
        name,
        position,
    })
}

// ═══ FOCUS_AREA_DELETE ═════════════════════════════════════════════════════

#[tauri::command]
pub async fn focus_area_delete(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db();
    ensure_goals_tables(&db).await?;

    // Un-set focus_area_id on any goals referencing this area
    let _ = sqlx::query("UPDATE goals SET focus_area_id = NULL WHERE focus_area_id = ?")
        .bind(&id)
        .execute(&db)
        .await;

    sqlx::query("DELETE FROM focus_areas WHERE id = ?")
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
