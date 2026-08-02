// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "log_health_checkin".into(),
            description: "Log a daily health check-in with mood, energy level (1-10), optional sleep hours, water glasses, symptoms, and note.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "mood": {"type": "integer", "description": "Mood rating 1-10 (required)"},
                    "energy": {"type": "integer", "description": "Energy level 1-10 (required)"},
                    "sleep_hours": {"type": "number", "description": "Hours of sleep last night"},
                    "water_glasses": {"type": "integer", "description": "Glasses of water today"},
                    "symptoms": {"type": "string", "description": "Any symptoms or health notes"},
                    "note": {"type": "string", "description": "General note"}
                },
                "required": ["mood", "energy"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_health_today".into(),
            description: "Get today's health check-in entry (mood, energy, sleep, water, symptoms).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_health_week".into(),
            description: "Get the last 7 days of health check-ins for weekly trends.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "log_vitals".into(),
            description: "Log a biometric vitals reading: blood pressure (e.g., '120/80'), heart rate (bpm), weight (kg), temperature (C), and SpO2 (%).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "bp": {"type": "string", "description": "Blood pressure as systolic/diastolic, e.g. '120/80'"},
                    "hr": {"type": "integer", "description": "Heart rate in bpm (0-350)"},
                    "weight": {"type": "number", "description": "Weight in kg (0-400)"},
                    "temp": {"type": "number", "description": "Body temperature in Celsius (34-43)"},
                    "spo2": {"type": "integer", "description": "Oxygen saturation percentage (0-100)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_vitals".into(),
            description: "Get recent vitals readings (blood pressure, heart rate, weight, temperature, SpO2).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results (default 10, max 100)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_medications".into(),
            description: "List active medications with today's taken status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "add_medication".into(),
            description: "Add a new medication with name, dose description, and optional time of day.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Medication name (required)"},
                    "dose": {"type": "string", "description": "Dose description, e.g. '50mg' (required)"},
                    "time_of_day": {"type": "string", "description": "When to take (morning/afternoon/evening/bedtime)"},
                    "notes": {"type": "string", "description": "Optional notes"}
                },
                "required": ["name", "dose"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "toggle_medication".into(),
            description: "Toggle a medication's taken status for today (mark as taken or undone).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "med_id": {"type": "string", "description": "The unique ID of the medication"}
                },
                "required": ["med_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_medication".into(),
            description: "Soft-delete a medication (deactivates it without removing history).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "med_id": {"type": "string", "description": "The unique ID of the medication to delete"}
                },
                "required": ["med_id"]
            }),
            auto_execute: false,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "log_health_checkin" => Ok(Some(log_health_checkin(args, pool).await?)),
        "get_health_today" => Ok(Some(get_health_today(pool).await?)),
        "get_health_week" => Ok(Some(get_health_week(pool).await?)),
        "log_vitals" => Ok(Some(log_vitals(args, pool).await?)),
        "get_vitals" => Ok(Some(get_vitals(args, pool).await?)),
        "list_medications" => Ok(Some(list_medications(pool).await?)),
        "add_medication" => Ok(Some(add_medication(args, pool).await?)),
        "toggle_medication" => Ok(Some(toggle_medication(args, pool).await?)),
        "delete_medication" => Ok(Some(delete_medication(args, pool).await?)),
        _ => Ok(None),
    }
}

async fn log_health_checkin(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let mood = args["mood"].as_i64().ok_or("mood is required")?;
    let energy = args["energy"].as_i64().ok_or("energy is required")?;
    if !(1..=10).contains(&mood) { return Err("Mood must be between 1 and 10.".to_string()); }
    if !(1..=10).contains(&energy) { return Err("Energy must be between 1 and 10.".to_string()); }

    let today = time::date_key(time::now_ms());
    let sleep_hours = args["sleep_hours"].as_f64();
    let water_glasses = args["water_glasses"].as_i64();
    let symptoms = args["symptoms"].as_str().unwrap_or("");
    let note = args["note"].as_str().unwrap_or("");

    sqlx::query(
        "INSERT INTO health_daily_logs (date_key, mood, energy, sleep_hours, water_glasses, symptoms, note, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(date_key) DO UPDATE SET mood=excluded.mood, energy=excluded.energy, sleep_hours=excluded.sleep_hours, water_glasses=excluded.water_glasses, symptoms=excluded.symptoms, note=excluded.note"
    )
    .bind(&today).bind(mood).bind(energy).bind(sleep_hours).bind(water_glasses).bind(symptoms).bind(note).bind(time::now_ms())
    .execute(pool).await
    .map_err(|e| format!("Failed to log health check-in: {e}"))?;

    Ok(json!({
        "date": today, "mood": mood, "energy": energy,
        "data_coverage": 1.0,
        "message": format!("Health check-in saved: mood {mood}/10, energy {energy}/10.")
    }))
}

async fn get_health_today(pool: &SqlitePool) -> Result<Value, String> {
    let today = time::date_key(time::now_ms());
    let row = sqlx::query_as::<_, (i64, i64, Option<f64>, Option<i64>, Option<String>, Option<String>)>(
        "SELECT mood, energy, sleep_hours, water_glasses, symptoms, note FROM health_daily_logs WHERE date_key = ?"
    )
    .bind(&today)
    .fetch_optional(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    match row {
        Some((mood, energy, sleep, water, symptoms, note)) => Ok(json!({
            "date": today, "mood": mood, "energy": energy,
            "sleepHours": sleep, "waterGlasses": water,
            "symptoms": symptoms, "note": note,
            "data_coverage": 1.0
        })),
        None => Ok(json!({ "date": today, "data_coverage": 0.0, "message": "No check-in today yet." })),
    }
}

async fn get_health_week(pool: &SqlitePool) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (String, i64, i64, Option<f64>, Option<i64>)>(
        "SELECT date_key, mood, energy, sleep_hours, water_glasses FROM health_daily_logs ORDER BY date_key DESC LIMIT 7"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let entries: Vec<Value> = rows.into_iter().map(|(date, mood, energy, sleep, water)| {
        json!({"date": date, "mood": mood, "energy": energy, "sleepHours": sleep, "waterGlasses": water})
    }).collect();

    Ok(json!({ "entries": entries, "count": entries.len() }))
}

async fn log_vitals(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let today = time::date_key(now_ms);
    let bp = args["bp"].as_str().unwrap_or("");
    let hr = args["hr"].as_i64();
    let weight = args["weight"].as_f64();
    let temp = args["temp"].as_f64();
    let spo2 = args["spo2"].as_i64();

    sqlx::query(
        "INSERT INTO health_vitals (id, bp, hr, weight, temp, spo2, logged_at, date_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(bp).bind(hr).bind(weight).bind(temp).bind(spo2).bind(now_ms).bind(&today)
    .execute(pool).await
    .map_err(|e| format!("Failed to log vitals: {e}"))?;

    Ok(json!({ "id": id, "data_coverage": 1.0, "message": "Vitals logged." }))
}

async fn get_vitals(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let limit = args["limit"].as_i64().unwrap_or(10).min(100);

    let rows = sqlx::query_as::<_, (String, Option<String>, Option<i64>, Option<f64>, Option<f64>, Option<i64>, i64)>(
        "SELECT id, bp, hr, weight, temp, spo2, logged_at FROM health_vitals ORDER BY logged_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get vitals: {e}"))?;

    let entries: Vec<Value> = rows.into_iter().map(|(id, bp, hr, weight, temp, spo2, logged_at)| {
        json!({"id": id, "bp": bp, "hr": hr, "weight": weight, "temp": temp, "spo2": spo2, "loggedAt": logged_at})
    }).collect();

    Ok(json!({ "entries": entries, "count": entries.len() }))
}

async fn list_medications(pool: &SqlitePool) -> Result<Value, String> {
    let today = time::date_key(time::now_ms());

    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, i64)>(
        "SELECT m.id, m.name, m.dose, m.time_of_day, m.notes, CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END as taken_today FROM health_meds m LEFT JOIN health_doses d ON d.med_id = m.id AND d.date_key = ? WHERE m.active = 1 ORDER BY m.time_of_day, m.name"
    )
    .bind(&today)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to list medications: {e}"))?;

    let meds: Vec<Value> = rows.into_iter().map(|(id, name, dose, time_of_day, notes, taken)| {
        json!({"id": id, "name": name, "dose": dose, "timeOfDay": time_of_day, "notes": notes, "takenToday": taken == 1})
    }).collect();

    Ok(json!({ "medications": meds, "count": meds.len() }))
}

async fn add_medication(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?;
    let dose = args["dose"].as_str().ok_or("dose is required")?;
    let id = Uuid::new_v4().to_string();
    let time_of_day = args["time_of_day"].as_str().unwrap_or("");
    let notes = args["notes"].as_str().unwrap_or("");
    let now_ms = time::now_ms();

    sqlx::query(
        "INSERT INTO health_meds (id, name, dose, time_of_day, notes, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
    )
    .bind(&id).bind(name).bind(dose).bind(time_of_day).bind(notes).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to add medication: {e}"))?;

    Ok(json!({ "id": id, "name": name, "dose": dose, "data_coverage": 1.0, "message": format!("Medication \"{name}\" added.") }))
}

async fn toggle_medication(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let med_id = args["med_id"].as_str().ok_or("med_id is required")?;
    let today = time::date_key(time::now_ms());

    let existing: Option<String> = sqlx::query_scalar("SELECT id FROM health_doses WHERE med_id = ? AND date_key = ?")
        .bind(med_id).bind(&today)
        .fetch_optional(pool).await
        .map_err(|e| format!("DB error: {e}"))?;

    if let Some(dose_id) = existing {
        sqlx::query("DELETE FROM health_doses WHERE id = ?").bind(&dose_id)
            .execute(pool).await.ok();
        Ok(json!({ "medId": med_id, "taken": false, "data_coverage": 1.0, "message": "Medication marked as not taken." }))
    } else {
        let dose_id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        sqlx::query("INSERT INTO health_doses (id, med_id, taken_at, date_key) VALUES (?, ?, ?, ?)")
            .bind(&dose_id).bind(med_id).bind(now_ms).bind(&today)
            .execute(pool).await
            .map_err(|e| format!("Failed to log dose: {e}"))?;
        Ok(json!({ "medId": med_id, "taken": true, "data_coverage": 1.0, "message": "Medication marked as taken." }))
    }
}

async fn delete_medication(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let med_id = args["med_id"].as_str().ok_or("med_id is required")?;
    let result = sqlx::query("UPDATE health_meds SET active = 0 WHERE id = ?")
        .bind(med_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to deactivate medication: {e}"))?;
    if result.rows_affected() == 0 {
        return Err(format!("Medication \"{med_id}\" not found."));
    }
    Ok(json!({ "id": med_id, "data_coverage": 1.0, "message": "Medication deactivated." }))
}
