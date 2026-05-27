// ─────────────────────────────────────────────────────────────────────────────
// Health Tauri Commands — SQLite-backed, no stubs
// Tables used:
//   health_logs   (id, type, value, unit, metadata, logged_at)
//   health_vitals (id, bp, hr, weight_kg, temp_c, spo2, logged_at)
//   health_meds   (id, name, dose, time_of_day, notes, active, created_at)
//   health_doses  (id, med_id, taken_at, date_key)
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ── Shared date helper ────────────────────────────────────────────────────────

fn today_key() -> String {
    time::date_key(time::now_ms())
}

// ═════════════════════════════════════════════════════════════════════════════
// DAILY LOG
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyLogEntry {
    pub id: Option<String>,
    pub mood: String,
    pub energy: u8,
    pub water_glasses: u8,
    pub sleep_hours: f64,
    pub symptoms: Vec<String>,
    pub note: Option<String>,
    pub logged_at: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyLogRow {
    pub id: String,
    pub mood: String,
    pub energy: u8,
    pub water_glasses: u8,
    pub sleep_hours: f64,
    pub symptoms: Vec<String>,
    pub note: Option<String>,
    pub logged_at: i64,
    pub date_key: String,
}

/// Save or upsert today's daily check-in. One log per calendar day.
#[tauri::command]
pub async fn health_log_save(
    state: State<'_, BentoAppState>,
    entry: DailyLogEntry,
) -> Result<DailyLogRow, String> {
    ensure_health_tables(&state.db()).await?;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let date = today_key();
    let symptoms_json = serde_json::to_string(&entry.symptoms).map_err(|e| e.to_string())?;

    // Upsert by date_key — only one check-in per day
    sqlx::query(
        r#"
        INSERT INTO health_daily_logs
            (id, mood, energy, water_glasses, sleep_hours, symptoms, note, logged_at, date_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date_key) DO UPDATE SET
            mood         = excluded.mood,
            energy       = excluded.energy,
            water_glasses = excluded.water_glasses,
            sleep_hours  = excluded.sleep_hours,
            symptoms     = excluded.symptoms,
            note         = excluded.note,
            logged_at    = excluded.logged_at
        "#,
    )
    .bind(&id)
    .bind(&entry.mood)
    .bind(entry.energy as i64)
    .bind(entry.water_glasses as i64)
    .bind(entry.sleep_hours)
    .bind(&symptoms_json)
    .bind(&entry.note)
    .bind(now)
    .bind(&date)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(DailyLogRow {
        id,
        mood: entry.mood,
        energy: entry.energy,
        water_glasses: entry.water_glasses,
        sleep_hours: entry.sleep_hours,
        symptoms: entry.symptoms,
        note: entry.note,
        logged_at: now,
        date_key: date,
    })
}

/// Load today's check-in (if any).
#[tauri::command]
pub async fn health_log_today(
    state: State<'_, BentoAppState>,
) -> Result<Option<DailyLogRow>, String> {
    ensure_health_tables(&state.db()).await?;
    let date = today_key();

    let row = sqlx::query(
        "SELECT id, mood, energy, water_glasses, sleep_hours, symptoms, note, logged_at, date_key
         FROM health_daily_logs WHERE date_key = ?",
    )
    .bind(&date)
    .fetch_optional(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let Some(row) = row else { return Ok(None) };

    use sqlx::Row;
    let symptoms_raw: String = row.try_get("symptoms").unwrap_or_else(|_| "[]".into());
    let symptoms: Vec<String> = serde_json::from_str(&symptoms_raw).unwrap_or_default();

    Ok(Some(DailyLogRow {
        id: row.try_get("id").unwrap_or_default(),
        mood: row.try_get("mood").unwrap_or_else(|_| "steady".into()),
        energy: row.try_get::<i64, _>("energy").unwrap_or(7) as u8,
        water_glasses: row.try_get::<i64, _>("water_glasses").unwrap_or(0) as u8,
        sleep_hours: row.try_get("sleep_hours").unwrap_or(0.0),
        symptoms,
        note: row.try_get("note").unwrap_or(None),
        logged_at: row.try_get("logged_at").unwrap_or(0),
        date_key: row.try_get("date_key").unwrap_or(date),
    }))
}

/// Last 7 days of check-ins for the weekly chart.
#[tauri::command]
pub async fn health_logs_week(state: State<'_, BentoAppState>) -> Result<Vec<DailyLogRow>, String> {
    ensure_health_tables(&state.db()).await?;

    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, mood, energy, water_glasses, sleep_hours, symptoms, note, logged_at, date_key
         FROM health_daily_logs
         ORDER BY date_key DESC LIMIT 7",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let symptoms_raw: String = row.try_get("symptoms").unwrap_or_else(|_| "[]".into());
            let symptoms: Vec<String> = serde_json::from_str(&symptoms_raw).unwrap_or_default();
            DailyLogRow {
                id: row.try_get("id").unwrap_or_default(),
                mood: row.try_get("mood").unwrap_or_else(|_| "steady".into()),
                energy: row.try_get::<i64, _>("energy").unwrap_or(7) as u8,
                water_glasses: row.try_get::<i64, _>("water_glasses").unwrap_or(0) as u8,
                sleep_hours: row.try_get("sleep_hours").unwrap_or(0.0),
                symptoms,
                note: row.try_get("note").unwrap_or(None),
                logged_at: row.try_get("logged_at").unwrap_or(0),
                date_key: row.try_get("date_key").unwrap_or_default(),
            }
        })
        .collect())
}

// ═════════════════════════════════════════════════════════════════════════════
// VITALS
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VitalsEntry {
    pub bp: Option<String>,
    pub hr: Option<String>,
    pub weight: Option<String>,
    pub temp: Option<String>,
    pub spo2: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VitalsRow {
    pub id: String,
    pub bp: Option<String>,
    pub hr: Option<String>,
    pub weight: Option<String>,
    pub temp: Option<String>,
    pub spo2: Option<String>,
    pub logged_at: i64,
    pub date_key: String,
}

#[tauri::command]
pub async fn health_vitals_save(
    state: State<'_, BentoAppState>,
    entry: VitalsEntry,
) -> Result<VitalsRow, String> {
    ensure_health_tables(&state.db()).await?;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let date = today_key();

    sqlx::query(
        r#"
        INSERT INTO health_vitals (id, bp, hr, weight, temp, spo2, logged_at, date_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&entry.bp)
    .bind(&entry.hr)
    .bind(&entry.weight)
    .bind(&entry.temp)
    .bind(&entry.spo2)
    .bind(now)
    .bind(&date)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(VitalsRow {
        id,
        bp: entry.bp,
        hr: entry.hr,
        weight: entry.weight,
        temp: entry.temp,
        spo2: entry.spo2,
        logged_at: now,
        date_key: date,
    })
}

#[tauri::command]
pub async fn health_vitals_list(state: State<'_, BentoAppState>) -> Result<Vec<VitalsRow>, String> {
    ensure_health_tables(&state.db()).await?;

    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, bp, hr, weight, temp, spo2, logged_at, date_key
         FROM health_vitals ORDER BY logged_at DESC LIMIT 30",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| VitalsRow {
            id: row.try_get("id").unwrap_or_default(),
            bp: row.try_get("bp").unwrap_or(None),
            hr: row.try_get("hr").unwrap_or(None),
            weight: row.try_get("weight").unwrap_or(None),
            temp: row.try_get("temp").unwrap_or(None),
            spo2: row.try_get("spo2").unwrap_or(None),
            logged_at: row.try_get("logged_at").unwrap_or(0),
            date_key: row.try_get("date_key").unwrap_or_default(),
        })
        .collect())
}

// ═════════════════════════════════════════════════════════════════════════════
// MEDICATIONS
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MedRow {
    pub id: String,
    pub name: String,
    pub dose: String,
    pub time_of_day: String,
    pub notes: String,
    pub taken_today: bool,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewMedEntry {
    pub name: String,
    pub dose: String,
    pub time_of_day: String,
    pub notes: String,
}

#[tauri::command]
pub async fn health_meds_list(state: State<'_, BentoAppState>) -> Result<Vec<MedRow>, String> {
    ensure_health_tables(&state.db()).await?;
    let date = today_key();

    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT m.id, m.name, m.dose, m.time_of_day, m.notes, m.created_at,
               CASE WHEN d.med_id IS NOT NULL THEN 1 ELSE 0 END AS taken_today
        FROM health_meds m
        LEFT JOIN health_doses d ON d.med_id = m.id AND d.date_key = ?
        WHERE m.active = 1
        ORDER BY m.time_of_day, m.name
        "#,
    )
    .bind(&date)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| MedRow {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            dose: row.try_get("dose").unwrap_or_default(),
            time_of_day: row.try_get("time_of_day").unwrap_or_default(),
            notes: row.try_get("notes").unwrap_or_default(),
            taken_today: row.try_get::<i64, _>("taken_today").unwrap_or(0) == 1,
            created_at: row.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn health_med_add(
    state: State<'_, BentoAppState>,
    entry: NewMedEntry,
) -> Result<MedRow, String> {
    ensure_health_tables(&state.db()).await?;

    if entry.name.trim().is_empty() {
        return Err("Medication name is required.".into());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO health_meds (id, name, dose, time_of_day, notes, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)",
    )
    .bind(&id)
    .bind(entry.name.trim())
    .bind(entry.dose.trim())
    .bind(entry.time_of_day.trim())
    .bind(entry.notes.trim())
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(MedRow {
        id,
        name: entry.name,
        dose: entry.dose,
        time_of_day: entry.time_of_day,
        notes: entry.notes,
        taken_today: false,
        created_at: now,
    })
}

#[tauri::command]
pub async fn health_med_toggle(
    state: State<'_, BentoAppState>,
    med_id: String,
) -> Result<bool, String> {
    ensure_health_tables(&state.db()).await?;
    let date = today_key();
    let now = time::now_ms();

    // Check if a dose record exists for today
    let existing = sqlx::query("SELECT id FROM health_doses WHERE med_id = ? AND date_key = ?")
        .bind(&med_id)
        .bind(&date)
        .fetch_optional(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    if existing.is_some() {
        // Remove — untake
        sqlx::query("DELETE FROM health_doses WHERE med_id = ? AND date_key = ?")
            .bind(&med_id)
            .bind(&date)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        // Insert — mark taken
        let dose_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO health_doses (id, med_id, taken_at, date_key) VALUES (?, ?, ?, ?)",
        )
        .bind(&dose_id)
        .bind(&med_id)
        .bind(now)
        .bind(&date)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn health_med_delete(
    state: State<'_, BentoAppState>,
    med_id: String,
) -> Result<(), String> {
    ensure_health_tables(&state.db()).await?;

    sqlx::query("UPDATE health_meds SET active = 0 WHERE id = ?")
        .bind(&med_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE BOOTSTRAP
// ═════════════════════════════════════════════════════════════════════════════

pub async fn ensure_health_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let migrations = [
        r#"CREATE TABLE IF NOT EXISTS health_daily_logs (
            id           TEXT    PRIMARY KEY,
            mood         TEXT    NOT NULL DEFAULT 'steady',
            energy       INTEGER NOT NULL DEFAULT 7,
            water_glasses INTEGER NOT NULL DEFAULT 0,
            sleep_hours  REAL    NOT NULL DEFAULT 0,
            symptoms     TEXT    NOT NULL DEFAULT '[]',
            note         TEXT,
            logged_at    INTEGER NOT NULL,
            date_key     TEXT    NOT NULL UNIQUE
        )"#,
        r#"CREATE TABLE IF NOT EXISTS health_vitals (
            id        TEXT    PRIMARY KEY,
            bp        TEXT,
            hr        TEXT,
            weight    TEXT,
            temp      TEXT,
            spo2      TEXT,
            logged_at INTEGER NOT NULL,
            date_key  TEXT    NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS health_meds (
            id          TEXT    PRIMARY KEY,
            name        TEXT    NOT NULL,
            dose        TEXT    NOT NULL DEFAULT '',
            time_of_day TEXT    NOT NULL DEFAULT '08:00',
            notes       TEXT    NOT NULL DEFAULT '',
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS health_doses (
            id       TEXT    PRIMARY KEY,
            med_id   TEXT    NOT NULL REFERENCES health_meds(id) ON DELETE CASCADE,
            taken_at INTEGER NOT NULL,
            date_key TEXT    NOT NULL,
            UNIQUE(med_id, date_key)
        )"#,
    ];

    for sql in migrations {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
