// ─────────────────────────────────────────────────────────────────────────────
// Mood Tauri Commands — SQLite-backed, zero stubs
// Tables:
//   mood_checkins       (id, mood, intensity, note, activities, logged_at, date_key)
//   mood_activities     (id, name, created_at)
//   mood_private_notes  (id, content, created_at)
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

fn today_key() -> String {
    time::date_key(time::now_ms())
}

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckinEntry {
    pub mood: String,
    pub intensity: u8,
    pub note: Option<String>,
    pub activities: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckinRow {
    pub id: String,
    pub mood: String,
    pub intensity: u8,
    pub note: Option<String>,
    pub activities: Vec<String>,
    pub logged_at: i64,
    pub date_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodStats {
    pub streak: u32,
    pub total: u32,
    pub great_days: u32,
    pub calm_days: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRow {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodPattern {
    pub label: String,
    pub value: u8,
    pub note: String,
    pub positive: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivateNoteRow {
    pub id: String,
    pub content: String,
    pub created_at: i64,
}

// ═════════════════════════════════════════════════════════════════════════════
// CHECK-IN COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn mood_checkin_save(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    entry: CheckinEntry,
) -> Result<CheckinRow, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;

    if entry.mood.trim().is_empty() {
        return Err("Mood is required.".into());
    }

    let intensity = entry.intensity.clamp(0, 100);
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let date = today_key();
    let acts_json = serde_json::to_string(&entry.activities).map_err(|e| e.to_string())?;

    sqlx::query(
        r#"INSERT INTO mood_checkins (id, mood, intensity, note, activities, logged_at, date_key)
           VALUES (?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(entry.mood.trim())
    .bind(intensity as i64)
    .bind(&entry.note)
    .bind(&acts_json)
    .bind(now)
    .bind(&date)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(CheckinRow {
        id,
        mood: entry.mood,
        intensity,
        note: entry.note,
        activities: entry.activities,
        logged_at: now,
        date_key: date,
    })
}

#[tauri::command]
pub async fn mood_checkins_today(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<CheckinRow>, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;

    let rows = sqlx::query(
        "SELECT id, mood, intensity, note, activities, logged_at, date_key
         FROM mood_checkins WHERE date_key = ? ORDER BY logged_at ASC",
    )
    .bind(today_key())
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(map_checkin_row).collect())
}

#[tauri::command]
pub async fn mood_checkins_month(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    month: String,
) -> Result<Vec<CheckinRow>, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;

    let prefix = format!("{}%", month.trim());
    let rows = sqlx::query(
        "SELECT id, mood, intensity, note, activities, logged_at, date_key
         FROM mood_checkins WHERE date_key LIKE ? ORDER BY logged_at ASC",
    )
    .bind(&prefix)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(map_checkin_row).collect())
}

#[tauri::command]
pub async fn mood_checkins_recent(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    limit: Option<i64>,
) -> Result<Vec<CheckinRow>, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;

    let n = limit.unwrap_or(30).clamp(1, 365);
    let rows = sqlx::query(
        "SELECT id, mood, intensity, note, activities, logged_at, date_key
         FROM mood_checkins ORDER BY logged_at DESC LIMIT ?",
    )
    .bind(n)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(map_checkin_row).collect())
}

#[tauri::command]
pub async fn mood_checkin_delete(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    sqlx::query("DELETE FROM mood_checkins WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn mood_stats(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<MoodStats, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mood_checkins")
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    let great: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT date_key) FROM mood_checkins WHERE mood IN ('energized','bright')",
    )
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let calm: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT date_key) FROM mood_checkins WHERE mood = 'steady'",
    )
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let date_rows: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT date_key FROM mood_checkins ORDER BY date_key DESC LIMIT 90",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(MoodStats {
        streak: compute_streak(&date_rows),
        total: total as u32,
        great_days: great as u32,
        calm_days: calm as u32,
    })
}

fn compute_streak(desc_dates: &[String]) -> u32 {
    if desc_dates.is_empty() {
        return 0;
    }
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let yesterday = (chrono::Utc::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();
    let first = &desc_dates[0];
    if first != &today && first != &yesterday {
        return 0;
    }
    let mut streak: u32 = 1;
    for i in 1..desc_dates.len() {
        let prev = chrono::NaiveDate::parse_from_str(&desc_dates[i - 1], "%Y-%m-%d");
        let curr = chrono::NaiveDate::parse_from_str(&desc_dates[i], "%Y-%m-%d");
        match (prev, curr) {
            (Ok(p), Ok(c)) if (p - c).num_days() == 1 => streak += 1,
            _ => break,
        }
    }
    streak
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTIVITY LIBRARY
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn mood_activity_library(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<ActivityRow>, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    seed_default_activities(&state.db()).await?;

    let rows = sqlx::query("SELECT id, name, created_at FROM mood_activities ORDER BY name")
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| ActivityRow {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn mood_activity_add(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    name: String,
) -> Result<ActivityRow, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Activity name is required.".into());
    }

    // Deduplicate case-insensitively
    let existing: Option<String> =
        sqlx::query_scalar("SELECT id FROM mood_activities WHERE LOWER(name) = LOWER(?)")
            .bind(&trimmed)
            .fetch_optional(&state.db())
            .await
            .map_err(|e| e.to_string())?;

    if let Some(id) = existing {
        let created_at: i64 =
            sqlx::query_scalar("SELECT created_at FROM mood_activities WHERE id = ?")
                .bind(&id)
                .fetch_one(&state.db())
                .await
                .map_err(|e| e.to_string())?;
        return Ok(ActivityRow {
            id,
            name: trimmed,
            created_at,
        });
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    sqlx::query("INSERT INTO mood_activities (id, name, created_at) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&trimmed)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActivityRow {
        id,
        name: trimmed,
        created_at: now,
    })
}

#[tauri::command]
pub async fn mood_activity_delete(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    sqlx::query("DELETE FROM mood_activities WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// PATTERN ANALYSIS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn mood_patterns(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<MoodPattern>, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;

    let rows: Vec<(String, i64, String)> = sqlx::query_as(
        "SELECT mood, intensity, activities FROM mood_checkins ORDER BY logged_at DESC LIMIT 30",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    if rows.len() < 3 {
        return Ok(vec![]);
    }

    let avg = |v: &[f64]| -> f64 {
        if v.is_empty() {
            0.0
        } else {
            v.iter().sum::<f64>() / v.len() as f64
        }
    };

    let mut act_scores: std::collections::HashMap<String, Vec<f64>> = Default::default();
    let mut exercise_on: Vec<f64> = vec![];
    let mut exercise_off: Vec<f64> = vec![];
    let mut meeting_on: Vec<f64> = vec![];
    let mut meeting_off: Vec<f64> = vec![];
    let mut weekend_scores: Vec<f64> = vec![];
    let mut weekday_scores: Vec<f64> = vec![];

    for (date_key, intensity, acts_json) in &rows {
        let acts: Vec<String> = serde_json::from_str(acts_json).unwrap_or_default();
        let s = *intensity as f64;

        let is_exercise = acts.iter().any(|a| {
            let l = a.to_lowercase();
            l.contains("exercise")
                || l.contains("workout")
                || l.contains("gym")
                || l.contains("walk")
        });
        let is_meeting = acts.iter().any(|a| a.to_lowercase().contains("meeting"));

        if is_exercise {
            exercise_on.push(s);
        } else {
            exercise_off.push(s);
        }
        if is_meeting {
            meeting_on.push(s);
        } else {
            meeting_off.push(s);
        }

        if let Ok(d) = chrono::NaiveDate::parse_from_str(date_key, "%Y-%m-%d") {
            use chrono::Datelike;
            if matches!(d.weekday(), chrono::Weekday::Sat | chrono::Weekday::Sun) {
                weekend_scores.push(s);
            } else {
                weekday_scores.push(s);
            }
        }

        for a in &acts {
            act_scores.entry(a.clone()).or_default().push(s);
        }
    }

    let mut out: Vec<MoodPattern> = vec![];

    if exercise_on.len() >= 2 && exercise_off.len() >= 2 {
        let diff = avg(&exercise_on) - avg(&exercise_off);
        if diff.abs() > 5.0 {
            out.push(MoodPattern {
                label: "Exercise days".into(),
                value: avg(&exercise_on).round() as u8,
                note: format!(
                    "Avg intensity {:.0} on exercise days vs {:.0} without.",
                    avg(&exercise_on),
                    avg(&exercise_off)
                ),
                positive: diff > 0.0,
            });
        }
    }

    if meeting_on.len() >= 2 && meeting_off.len() >= 2 {
        let diff = avg(&meeting_on) - avg(&meeting_off);
        if diff.abs() > 4.0 {
            out.push(MoodPattern {
                label: "Meeting-heavy days".into(),
                value: avg(&meeting_on).round() as u8,
                note: format!(
                    "Mood is {:.0} pts {} on meeting days.",
                    diff.abs(),
                    if diff < 0.0 { "lower" } else { "higher" }
                ),
                positive: diff > 0.0,
            });
        }
    }

    if weekend_scores.len() >= 2 && weekday_scores.len() >= 2 {
        let diff = avg(&weekend_scores) - avg(&weekday_scores);
        if diff.abs() > 3.0 {
            out.push(MoodPattern {
                label: "Weekend resets".into(),
                value: avg(&weekend_scores).round() as u8,
                note: format!(
                    "Weekends avg {:.0} vs {:.0} on weekdays.",
                    avg(&weekend_scores),
                    avg(&weekday_scores)
                ),
                positive: diff > 0.0,
            });
        }
    }

    let mut top: Vec<(String, f64)> = act_scores
        .into_iter()
        .filter(|(_, v)| v.len() >= 2)
        .map(|(k, v)| (k, avg(&v)))
        .collect();
    top.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    if let Some((act, score)) = top.first() {
        out.push(MoodPattern {
            label: format!("\"{}\" days", act),
            value: score.round() as u8,
            note: format!(
                "Highest avg intensity ({:.0}) across all tagged activities.",
                score
            ),
            positive: true,
        });
    }

    let high = rows.iter().filter(|(_, i, _)| *i >= 75).count();
    if high > 0 {
        let pct = (high as f64 / rows.len() as f64 * 100.0).round() as u8;
        out.push(MoodPattern {
            label: "High-intensity days".into(),
            value: pct,
            note: format!("{}% of recent check-ins were bright or energized.", pct),
            positive: pct >= 50,
        });
    }

    Ok(out)
}

// ═════════════════════════════════════════════════════════════════════════════
// PRIVATE NOTES
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn mood_private_note_save(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    content: String,
) -> Result<PrivateNoteRow, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    let trimmed = content.trim().to_string();
    if trimmed.is_empty() {
        return Err("Note content is required.".into());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    sqlx::query("INSERT INTO mood_private_notes (id, content, created_at) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&trimmed)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    Ok(PrivateNoteRow {
        id,
        content: trimmed,
        created_at: now,
    })
}

#[tauri::command]
pub async fn mood_private_notes_list(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<PrivateNoteRow>, String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    let rows = sqlx::query(
        "SELECT id, content, created_at FROM mood_private_notes ORDER BY created_at DESC",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| PrivateNoteRow {
            id: r.try_get("id").unwrap_or_default(),
            content: r.try_get("content").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn mood_private_note_delete(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "mood").await?;

    ensure_mood_tables(&state.db()).await?;
    sqlx::query("DELETE FROM mood_private_notes WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE BOOTSTRAP + SEEDS
// ═════════════════════════════════════════════════════════════════════════════

pub async fn ensure_mood_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    for sql in [
        r#"CREATE TABLE IF NOT EXISTS mood_checkins (
            id         TEXT    PRIMARY KEY,
            mood       TEXT    NOT NULL,
            intensity  INTEGER NOT NULL DEFAULT 50,
            note       TEXT,
            activities TEXT    NOT NULL DEFAULT '[]',
            logged_at  INTEGER NOT NULL,
            date_key   TEXT    NOT NULL
        )"#,
        "CREATE INDEX IF NOT EXISTS idx_mood_ck_date ON mood_checkins(date_key DESC)",
        "CREATE INDEX IF NOT EXISTS idx_mood_ck_ts   ON mood_checkins(logged_at DESC)",
        r#"CREATE TABLE IF NOT EXISTS mood_activities (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS mood_private_notes (
            id         TEXT PRIMARY KEY,
            content    TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
    ] {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

const DEFAULT_ACTIVITIES: &[&str] = &[
    "Deep work",
    "Exercise",
    "Family time",
    "Reading",
    "Outside walk",
    "Journaling",
    "Meals",
    "Meetings",
    "Creative work",
    "Social time",
    "Rest",
    "Meditation",
];

async fn seed_default_activities(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mood_activities")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if count > 0 {
        return Ok(());
    }
    let now = time::now_ms();
    for name in DEFAULT_ACTIVITIES {
        sqlx::query(
            "INSERT OR IGNORE INTO mood_activities (id, name, created_at) VALUES (?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(name)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn map_checkin_row(row: sqlx::sqlite::SqliteRow) -> CheckinRow {
    let acts: Vec<String> = serde_json::from_str(
        &row.try_get::<String, _>("activities")
            .unwrap_or_else(|_| "[]".into()),
    )
    .unwrap_or_default();
    CheckinRow {
        id: row.try_get("id").unwrap_or_default(),
        mood: row.try_get("mood").unwrap_or_else(|_| "steady".into()),
        intensity: row.try_get::<i64, _>("intensity").unwrap_or(50) as u8,
        note: row.try_get("note").unwrap_or(None),
        activities: acts,
        logged_at: row.try_get("logged_at").unwrap_or(0),
        date_key: row.try_get("date_key").unwrap_or_default(),
    }
}
