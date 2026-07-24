// ── Countdown — Events, Milestones, Birthdays ────────────────────────────
//
// Tables (in db.rs):
//   countdown_events     — id, name, target_ms, category, accent, note, created_at, updated_at
//   countdown_milestones — id, name, target_ms, progress, accent, note, created_at, updated_at
//   countdown_birthdays  — id, name, month, day, accent, created_at, updated_at

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ═══════════════════════════════════════════════════════════════════════════
// TABLE BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════

pub async fn ensure_countdown_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let ddl = [
        "CREATE TABLE IF NOT EXISTS countdown_events (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_ms INTEGER NOT NULL, category TEXT NOT NULL DEFAULT 'Personal', accent TEXT NOT NULL DEFAULT '#6366f1', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS countdown_milestones (id TEXT PRIMARY KEY, name TEXT NOT NULL, target_ms INTEGER NOT NULL, progress INTEGER NOT NULL DEFAULT 0, accent TEXT NOT NULL DEFAULT '#6366f1', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS countdown_birthdays (id TEXT PRIMARY KEY, name TEXT NOT NULL, month INTEGER NOT NULL, day INTEGER NOT NULL, accent TEXT NOT NULL DEFAULT '#6366f1', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    ];
    for sql in ddl {
        sqlx::query(sql).execute(pool).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn days_in_month(month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => 29,
        _ => 0,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownEvent {
    pub id: String,
    pub name: String,
    pub target_ms: i64,
    pub category: String,
    pub accent: String,
    #[serde(default)]
    pub note: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownEventSave {
    pub name: String,
    pub target_ms: i64,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub accent: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownMilestone {
    pub id: String,
    pub name: String,
    pub target_ms: i64,
    pub progress: i32,
    pub accent: String,
    #[serde(default)]
    pub note: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownMilestoneSave {
    pub name: String,
    pub target_ms: i64,
    #[serde(default)]
    pub progress: i32,
    #[serde(default)]
    pub accent: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownBirthday {
    pub id: String,
    pub name: String,
    pub month: i32,
    pub day: i32,
    pub accent: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownBirthdaySave {
    pub name: String,
    pub month: i32,
    pub day: i32,
    #[serde(default)]
    pub accent: String,
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn countdown_list_events(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<CountdownEvent>, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;
    ensure_countdown_tables(&state.db()).await?;

    let rows = sqlx::query(
        "SELECT id, name, target_ms, category, accent, note, created_at, updated_at FROM countdown_events ORDER BY target_ms ASC",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| CountdownEvent {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            target_ms: r.try_get("target_ms").unwrap_or(0),
            category: r.try_get("category").unwrap_or_default(),
            accent: r.try_get("accent").unwrap_or_default(),
            note: r.try_get("note").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn countdown_save_event(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    params: CountdownEventSave,
) -> Result<CountdownEvent, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;
    ensure_countdown_tables(&state.db()).await?;

    if params.name.trim().is_empty() {
        return Err("Event name cannot be empty".to_string());
    }
    if params.target_ms <= 0 {
        return Err("Target date must be a valid future timestamp".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let note = params.note.unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO countdown_events (id, name, target_ms, category, accent, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&params.name)
    .bind(params.target_ms)
    .bind(&params.category)
    .bind(&params.accent)
    .bind(&note)
    .bind(now)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(CountdownEvent {
        id,
        name: params.name,
        target_ms: params.target_ms,
        category: params.category,
        accent: params.accent,
        note,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn countdown_update_event(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
    params: CountdownEventSave,
) -> Result<CountdownEvent, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;

    if params.name.trim().is_empty() {
        return Err("Event name cannot be empty".to_string());
    }
    if params.target_ms <= 0 {
        return Err("Target date must be a valid future timestamp".to_string());
    }

    let now = time::now_ms();
    let note = params.note.unwrap_or_default();

    let result = sqlx::query(
        r#"
        UPDATE countdown_events SET name = ?, target_ms = ?, category = ?, accent = ?, note = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&params.name)
    .bind(params.target_ms)
    .bind(&params.category)
    .bind(&params.accent)
    .bind(&note)
    .bind(now)
    .bind(&id)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Event not found".to_string());
    }

    Ok(CountdownEvent {
        id,
        name: params.name,
        target_ms: params.target_ms,
        category: params.category,
        accent: params.accent,
        note,
        created_at: 0,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn countdown_delete_event(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;

    let result = sqlx::query("DELETE FROM countdown_events WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("Event not found".to_string());
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONES
// ═══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn countdown_list_milestones(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<CountdownMilestone>, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;
    ensure_countdown_tables(&state.db()).await?;

    let rows = sqlx::query(
        "SELECT id, name, target_ms, progress, accent, note, created_at, updated_at FROM countdown_milestones ORDER BY target_ms ASC",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| CountdownMilestone {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            target_ms: r.try_get("target_ms").unwrap_or(0),
            progress: r.try_get("progress").unwrap_or(0),
            accent: r.try_get("accent").unwrap_or_default(),
            note: r.try_get("note").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn countdown_save_milestone(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    params: CountdownMilestoneSave,
) -> Result<CountdownMilestone, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;
    ensure_countdown_tables(&state.db()).await?;

    if params.name.trim().is_empty() {
        return Err("Milestone name cannot be empty".to_string());
    }
    if params.target_ms <= 0 {
        return Err("Target date must be a valid future timestamp".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let note = params.note.unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO countdown_milestones (id, name, target_ms, progress, accent, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&params.name)
    .bind(params.target_ms)
    .bind(params.progress)
    .bind(&params.accent)
    .bind(&note)
    .bind(now)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(CountdownMilestone {
        id,
        name: params.name,
        target_ms: params.target_ms,
        progress: params.progress,
        accent: params.accent,
        note,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn countdown_update_milestone_progress(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
    progress: i32,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;

    let now = time::now_ms();
    let result = sqlx::query("UPDATE countdown_milestones SET progress = ?, updated_at = ? WHERE id = ?")
        .bind(progress.clamp(0, 100))
        .bind(now)
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("Milestone not found".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn countdown_delete_milestone(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;

    let result = sqlx::query("DELETE FROM countdown_milestones WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("Milestone not found".to_string());
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// BIRTHDAYS
// ═══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn countdown_list_birthdays(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<CountdownBirthday>, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;
    ensure_countdown_tables(&state.db()).await?;

    let rows = sqlx::query(
        "SELECT id, name, month, day, accent, created_at, updated_at FROM countdown_birthdays",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| CountdownBirthday {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            month: r.try_get("month").unwrap_or(1),
            day: r.try_get("day").unwrap_or(1),
            accent: r.try_get("accent").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn countdown_save_birthday(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    params: CountdownBirthdaySave,
) -> Result<CountdownBirthday, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;
    ensure_countdown_tables(&state.db()).await?;

    if params.name.trim().is_empty() {
        return Err("Birthday name cannot be empty".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    let month = params.month.clamp(1, 12);
    let max_day = days_in_month(month);
    let day = params.day.clamp(1, max_day);

    sqlx::query(
        r#"
        INSERT INTO countdown_birthdays (id, name, month, day, accent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&params.name)
    .bind(month)
    .bind(day)
    .bind(&params.accent)
    .bind(now)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(CountdownBirthday {
        id,
        name: params.name,
        month,
        day,
        accent: params.accent,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn countdown_update_birthday(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
    params: CountdownBirthdaySave,
) -> Result<CountdownBirthday, String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;

    if params.name.trim().is_empty() {
        return Err("Birthday name cannot be empty".to_string());
    }

    let now = time::now_ms();
    let month = params.month.clamp(1, 12);
    let max_day = days_in_month(month);
    let day = params.day.clamp(1, max_day);

    let result = sqlx::query(
        r#"
        UPDATE countdown_birthdays SET name = ?, month = ?, day = ?, accent = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&params.name)
    .bind(month)
    .bind(day)
    .bind(&params.accent)
    .bind(now)
    .bind(&id)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Birthday not found".to_string());
    }

    Ok(CountdownBirthday {
        id,
        name: params.name,
        month,
        day,
        accent: params.accent,
        created_at: 0,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn countdown_delete_birthday(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "countdown").await?;

    let result = sqlx::query("DELETE FROM countdown_birthdays WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("Birthday not found".to_string());
    }
    Ok(())
}
