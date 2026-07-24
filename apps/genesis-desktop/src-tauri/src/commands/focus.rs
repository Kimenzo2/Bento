use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

use crate::db::BentoAppState;
use crate::util::time;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusPreset {
    pub label: String,
    pub description: Option<String>,
    pub minutes: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusCardItem {
    pub title: String,
    pub detail: String,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusReviewNote {
    pub title: String,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionEntry {
    pub id: String,
    pub label: String,
    pub duration: String,
    pub note: String,
    pub date: String,
    pub minutes: i64,
    pub logged_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusHistoryEntry {
    pub day: String,
    pub minutes: i64,
    pub sessions: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusSettings {
    #[serde(default)]
    pub timer_presets: Vec<FocusPreset>,
    #[serde(default)]
    pub sounds: Vec<FocusCardItem>,
    #[serde(default)]
    pub blockers: Vec<FocusCardItem>,
    #[serde(default)]
    pub review_notes: Vec<FocusReviewNote>,
    #[serde(default)]
    pub blocking_profile: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FocusDashboardData {
    pub timer_presets: Vec<FocusPreset>,
    pub sessions: Vec<FocusSessionEntry>,
    pub sounds: Vec<FocusCardItem>,
    pub blockers: Vec<FocusCardItem>,
    pub history: Vec<FocusHistoryEntry>,
    pub review_notes: Vec<FocusReviewNote>,
    pub today_minutes: i64,
    pub today_sessions: i64,
    pub this_week_sessions: i64,
    pub blocking_profile: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordFocusSessionParams {
    pub label: String,
    pub minutes: i64,
    #[serde(default)]
    pub note: Option<String>,
}

fn parse_metadata(raw: Option<String>) -> Value {
    raw.and_then(|value| serde_json::from_str::<Value>(&value).ok())
        .unwrap_or_else(|| json!({}))
}

fn focus_weekday_label(date: NaiveDate) -> String {
    match date.weekday().num_days_from_monday() {
        0 => "M",
        1 => "T",
        2 => "W",
        3 => "T",
        4 => "F",
        5 => "S",
        _ => "S",
    }
    .to_string()
}

fn relative_day_label(date_key: &str) -> String {
    let today_key = time::date_key(time::now_ms());
    let today = NaiveDate::parse_from_str(&today_key, "%Y-%m-%d").ok();
    let date = NaiveDate::parse_from_str(date_key, "%Y-%m-%d").ok();

    match (today, date) {
        (Some(today), Some(date)) if date == today => "Today".to_string(),
        (Some(today), Some(date)) if date == today.pred_opt().unwrap_or(today) => {
            "Yesterday".to_string()
        }
        (_, Some(date)) => date.format("%a").to_string(),
        _ => date_key.to_string(),
    }
}

fn format_duration(minutes: f64) -> String {
    let rounded = minutes.round().max(0.0) as i64;
    if rounded >= 60 {
        let hours = rounded / 60;
        let rest = rounded % 60;
        if rest == 0 {
            format!("{hours}h")
        } else {
            format!("{hours}h {rest}m")
        }
    } else {
        format!("{rounded} min")
    }
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn metadata_string(metadata: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = metadata.get(*key).and_then(|value| value.as_str()) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

fn load_focus_settings(value: Option<String>) -> FocusSettings {
    let raw = value.unwrap_or_else(|| "{}".to_string());
    serde_json::from_str::<FocusSettings>(&raw).unwrap_or_default()
}

#[tauri::command]
pub async fn get_focus_dashboard(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<FocusDashboardData, String> {
    crate::auth::require_billing_tier(&auth, "focus").await?;

    let db = state.db();
    let window_days = 7i64;
    let since = time::now_ms() - (window_days * 24 * 60 * 60 * 1000);

    let settings_row = sqlx::query("SELECT data FROM module_settings WHERE module_id = ?")
        .bind("focus")
        .fetch_optional(&db)
        .await
        .map_err(|error| error.to_string())?;

    let settings = settings_row
        .and_then(|row| row.try_get::<String, _>("data").ok())
        .map(|raw| load_focus_settings(Some(raw)))
        .unwrap_or_default();

    let rows = sqlx::query(
        r#"
        SELECT id, value, metadata, started_at, ended_at, logged_at
        FROM health_events
        WHERE module_id = 'focus'
          AND event_type = 'focus_session'
          AND logged_at >= ?
        ORDER BY logged_at DESC
        "#,
    )
    .bind(since)
    .fetch_all(&db)
    .await
    .map_err(|error| error.to_string())?;

    let today_key = time::date_key(time::now_ms());
    let today = NaiveDate::parse_from_str(&today_key, "%Y-%m-%d").ok();
    let mut history_map: std::collections::BTreeMap<String, (i64, i64)> =
        std::collections::BTreeMap::new();

    let mut sessions: Vec<FocusSessionEntry> = Vec::new();
    let mut today_minutes = 0i64;
    let mut today_sessions = 0i64;
    let mut blocking_profile = settings.blocking_profile.clone();

    for row in rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let value: f64 = row.try_get("value").unwrap_or(0.0);
        let logged_at: i64 = row.try_get("logged_at").unwrap_or(0);
        let started_at: Option<i64> = row.try_get("started_at").ok().flatten();
        let ended_at: Option<i64> = row.try_get("ended_at").ok().flatten();
        let metadata = parse_metadata(row.try_get::<String, _>("metadata").ok());

        let minutes = match (started_at, ended_at) {
            (Some(start), Some(end)) if end > start => {
                ((end - start) as f64 / 60_000.0).round() as i64
            }
            _ => value.round().max(0.0) as i64,
        };

        let date_key = started_at
            .or(Some(logged_at))
            .map(time::date_key)
            .unwrap_or_else(|| today_key.clone());

        let date_label = relative_day_label(&date_key);
        let label = metadata_string(&metadata, &["label", "title", "mode"])
            .unwrap_or_else(|| "Focus session".to_string());
        let note = metadata_string(&metadata, &["note", "description"])
            .unwrap_or_else(|| "Logged from the Focus timer.".to_string());

        if blocking_profile.is_none() {
            blocking_profile = metadata_string(&metadata, &["blockingProfile", "blocking_profile"]);
        }

        let entry = history_map.entry(date_key.clone()).or_insert((0, 0));
        entry.0 += minutes.max(0);
        entry.1 += 1;

        if Some(date_key.as_str())
            == today
                .as_ref()
                .map(|d| d.format("%Y-%m-%d").to_string())
                .as_deref()
        {
            today_minutes += minutes.max(0);
            today_sessions += 1;
        }

        sessions.push(FocusSessionEntry {
            id,
            label,
            duration: format_duration(minutes as f64),
            note,
            date: date_label,
            minutes,
            logged_at,
        });
    }

    let mut history: Vec<FocusHistoryEntry> = Vec::new();
    for offset in (0..window_days).rev() {
        let date = today
            .and_then(|value| value.checked_sub_days(chrono::Days::new(offset as u64)))
            .or_else(|| {
                NaiveDate::parse_from_str(
                    &time::date_key(since + offset * 24 * 60 * 60 * 1000),
                    "%Y-%m-%d",
                )
                .ok()
            })
            .unwrap_or_else(|| NaiveDate::parse_from_str(&today_key, "%Y-%m-%d").unwrap());
        let key = date.format("%Y-%m-%d").to_string();
        let (minutes, sessions_count) = history_map.get(&key).copied().unwrap_or((0, 0));
        history.push(FocusHistoryEntry {
            day: focus_weekday_label(date),
            minutes,
            sessions: sessions_count,
        });
    }

    let this_week_sessions = history.iter().map(|entry| entry.sessions).sum();

    Ok(FocusDashboardData {
        timer_presets: settings.timer_presets,
        sessions,
        sounds: settings.sounds,
        blockers: settings.blockers,
        history,
        review_notes: settings.review_notes,
        today_minutes,
        today_sessions,
        this_week_sessions,
        blocking_profile,
    })
}

#[tauri::command]
pub async fn record_focus_session(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    params: RecordFocusSessionParams,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "focus").await?;

    let label = params.label.trim();
    if label.is_empty() {
        return Err("Focus session label is required.".to_string());
    }

    let minutes = params.minutes.max(0);
    if minutes <= 0 {
        return Err("Focus session duration must be greater than zero.".to_string());
    }

    let db = state.db();
    let now = time::now_ms();
    let metadata = json!({
        "label": label,
        "note": params.note,
        "source": "focus"
    })
    .to_string();

    sqlx::query(
        r#"
        INSERT INTO health_events (
            module_id, event_type, value, unit, metadata, started_at, ended_at, logged_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind("focus")
    .bind("focus_session")
    .bind(minutes as f64)
    .bind("min")
    .bind(metadata)
    .bind(Some(now - minutes * 60_000))
    .bind(Some(now))
    .bind(now)
    .execute(&db)
    .await
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn export_focus_sessions(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<String, String> {
    crate::auth::require_billing_tier(&auth, "focus").await?;

    let db = state.db();
    let all_time = 0i64;

    let rows = sqlx::query(
        r#"
        SELECT id, value, metadata, started_at, ended_at, logged_at
        FROM health_events
        WHERE module_id = 'focus'
          AND event_type = 'focus_session'
          AND logged_at >= ?
        ORDER BY logged_at DESC
        "#,
    )
    .bind(all_time)
    .fetch_all(&db)
    .await
    .map_err(|error| error.to_string())?;

    let mut csv = String::from("Date,Label,Duration (min),Note,Logged At\n");
    for row in rows {
        let value: f64 = row.try_get("value").unwrap_or(0.0);
        let logged_at: i64 = row.try_get("logged_at").unwrap_or(0);
        let started_at: Option<i64> = row.try_get("started_at").ok().flatten();
        let ended_at: Option<i64> = row.try_get("ended_at").ok().flatten();
        let metadata = parse_metadata(row.try_get::<String, _>("metadata").ok());

        let minutes = match (started_at, ended_at) {
            (Some(start), Some(end)) if end > start => {
                ((end - start) as f64 / 60_000.0).round() as i64
            }
            _ => value.round().max(0.0) as i64,
        };

        let date_key = started_at
            .or(Some(logged_at))
            .map(time::date_key)
            .unwrap_or_else(|| "unknown".to_string());

        let label = metadata_string(&metadata, &["label", "title", "mode"])
            .unwrap_or_else(|| "Focus session".to_string());
        let note =
            metadata_string(&metadata, &["note", "description"]).unwrap_or_else(|| String::new());

        let logged_at_str = time::datetime_key(logged_at);

        csv.push_str(&format!(
            "{},{},{},{},{}\n",
            csv_escape(&date_key),
            csv_escape(&label),
            minutes,
            csv_escape(&note),
            csv_escape(&logged_at_str),
        ));
    }

    Ok(csv)
}
