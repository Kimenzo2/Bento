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
    state: State<'_, BentoAppState>,
) -> Result<Vec<CountdownEvent>, String> {
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
    state: State<'_, BentoAppState>,
    params: CountdownEventSave,
) -> Result<CountdownEvent, String> {
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
pub async fn countdown_delete_event(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM countdown_events WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONES
// ═══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn countdown_list_milestones(
    state: State<'_, BentoAppState>,
) -> Result<Vec<CountdownMilestone>, String> {
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
    state: State<'_, BentoAppState>,
    params: CountdownMilestoneSave,
) -> Result<CountdownMilestone, String> {
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
    state: State<'_, BentoAppState>,
    id: String,
    progress: i32,
) -> Result<(), String> {
    let now = time::now_ms();
    sqlx::query("UPDATE countdown_milestones SET progress = ?, updated_at = ? WHERE id = ?")
        .bind(progress.clamp(0, 100))
        .bind(now)
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn countdown_delete_milestone(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM countdown_milestones WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// BIRTHDAYS
// ═══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn countdown_list_birthdays(
    state: State<'_, BentoAppState>,
) -> Result<Vec<CountdownBirthday>, String> {
    let rows = sqlx::query(
        "SELECT id, name, month, day, accent, created_at, updated_at FROM countdown_birthdays ORDER BY month ASC, day ASC",
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
    state: State<'_, BentoAppState>,
    params: CountdownBirthdaySave,
) -> Result<CountdownBirthday, String> {
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    let month = params.month.clamp(1, 12);
    let day = params.day.clamp(1, 31);

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
pub async fn countdown_delete_birthday(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM countdown_birthdays WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
