// src-tauri/src/commands/sync.rs
//
// Pulls the user's data from Supabase (tasks, habits, habit_completions,
// health_logs) and upserts it into the local SQLite DB so the dashboard
// always shows live counts rather than zeros.
//
// Called from get_dashboard_data before the DB queries run.

use reqwest::Client;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::{sync::OnceLock, time::Duration};
use tokio::sync::Mutex;

use crate::auth::{AuthManager, StoredAuthSession};

static SYNC_USER_DATA_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

// ── Supabase row shapes ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SbTask {
    id: String,
    title: String,
    #[serde(default)]
    is_complete: bool,
    #[serde(default)]
    priority: Option<String>,
    #[serde(default)]
    due_date: Option<String>, // ISO-8601 or null
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SbHabit {
    id: String,
    name: String,
    #[serde(default)]
    frequency: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SbHabitCompletion {
    habit_id: String,
    #[serde(default)]
    completed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SbHealthLog {
    id: String,
    #[serde(rename = "type")]
    log_type: String,
    #[serde(default)]
    value: Option<f64>,
    #[serde(default)]
    unit: Option<String>,
    #[serde(default)]
    logged_at: Option<String>,
}

// ── ISO-8601 → unix-ms helper ────────────────────────────────────────────────

fn iso_to_ms(s: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis())
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

// ── PostgREST helper ─────────────────────────────────────────────────────────

async fn sb_get<T: for<'de> Deserialize<'de>>(
    client: &Client,
    url: &str,
    session: &StoredAuthSession,
    anon_key: &str,
) -> Result<Vec<T>, String> {
    let resp = client
        .get(url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {}", session.access_token))
        .header("Accept", "application/json")
        // Only return rows belonging to the authenticated user (RLS enforces this).
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Supabase {status}: {body}"));
    }

    resp.json::<Vec<T>>().await.map_err(|e| e.to_string())
}

// ── Per-table sync functions ─────────────────────────────────────────────────

async fn sync_tasks(
    pool: &SqlitePool,
    client: &Client,
    base_url: &str,
    anon_key: &str,
    session: &StoredAuthSession,
) -> Result<usize, String> {
    // Limit to 200 most-recently-updated tasks so the sync stays fast.
    let url = format!(
        "{}/rest/v1/tasks?select=id,title,is_complete,priority,due_date,created_at,updated_at&order=updated_at.desc&limit=200",
        base_url.trim_end_matches('/')
    );

    let rows: Vec<SbTask> = match sb_get(client, &url, session, anon_key).await {
        Ok(r) => r,
        Err(e) => {
            if !e.contains("PGRST205") {
                eprintln!("[sync] tasks fetch failed: {e}");
            }
            return Ok(0);
        }
    };

    let count = rows.len();
    for row in rows {
        let done: i64 = if row.is_complete { 1 } else { 0 };
        let priority = row.priority.as_deref().unwrap_or("medium");
        let due_at: Option<i64> = row.due_date.as_deref().map(iso_to_ms);
        let created_at = row
            .created_at
            .as_deref()
            .map(iso_to_ms)
            .unwrap_or_else(now_ms);
        let updated_at = row
            .updated_at
            .as_deref()
            .map(iso_to_ms)
            .unwrap_or_else(now_ms);

        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, done, priority, due_at, parent_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title      = excluded.title,
                done       = excluded.done,
                priority   = excluded.priority,
                due_at     = excluded.due_at,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&row.id)
        .bind(&row.title)
        .bind(done)
        .bind(priority)
        .bind(due_at)
        .bind(created_at)
        .bind(updated_at)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

async fn sync_habits(
    pool: &SqlitePool,
    client: &Client,
    base_url: &str,
    anon_key: &str,
    session: &StoredAuthSession,
) -> Result<usize, String> {
    let url = format!(
        "{}/rest/v1/habits?select=id,name,frequency,created_at&limit=200",
        base_url.trim_end_matches('/')
    );

    let rows: Vec<SbHabit> = match sb_get(client, &url, session, anon_key).await {
        Ok(r) => r,
        Err(e) => {
            if !e.contains("PGRST205") {
                eprintln!("[sync] habits fetch failed: {e}");
            }
            return Ok(0);
        }
    };

    let count = rows.len();
    for row in rows {
        let frequency = row.frequency.as_deref().unwrap_or("daily");
        let created_at = row
            .created_at
            .as_deref()
            .map(iso_to_ms)
            .unwrap_or_else(now_ms);

        sqlx::query(
            r#"
            INSERT INTO habits (id, name, frequency, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name      = excluded.name,
                frequency = excluded.frequency
            "#,
        )
        .bind(&row.id)
        .bind(&row.name)
        .bind(frequency)
        .bind(created_at)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

async fn sync_habit_completions(
    pool: &SqlitePool,
    client: &Client,
    base_url: &str,
    anon_key: &str,
    session: &StoredAuthSession,
) -> Result<usize, String> {
    // Pull the last 90 days of completions only.
    let since = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(90))
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    let url = format!(
        "{}/rest/v1/habit_completions?select=habit_id,completed_at&completed_at=gte.{}&limit=2000",
        base_url.trim_end_matches('/'),
        since
    );

    let rows: Vec<SbHabitCompletion> = match sb_get(client, &url, session, anon_key).await {
        Ok(r) => r,
        Err(e) => {
            if !e.contains("PGRST205") {
                eprintln!("[sync] habit_completions fetch failed: {e}");
            }
            return Ok(0);
        }
    };

    let count = rows.len();
    for row in rows {
        let completed_at = row
            .completed_at
            .as_deref()
            .map(iso_to_ms)
            .unwrap_or_else(now_ms);

        // INSERT OR IGNORE — primary key is (habit_id, completed_at).
        // Supabase should only return valid rows, but local startup sync must
        // never fail because a remote completion outlives its habit locally.
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO habit_completions (habit_id, completed_at)
            SELECT ?, ?
            WHERE EXISTS (SELECT 1 FROM habits WHERE id = ?)
            "#,
        )
        .bind(&row.habit_id)
        .bind(completed_at)
        .bind(&row.habit_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

async fn sync_health_logs(
    pool: &SqlitePool,
    client: &Client,
    base_url: &str,
    anon_key: &str,
    session: &StoredAuthSession,
) -> Result<usize, String> {
    let url = format!(
        "{}/rest/v1/health_logs?select=id,type,value,unit,logged_at&order=logged_at.desc&limit=500",
        base_url.trim_end_matches('/')
    );

    let rows: Vec<SbHealthLog> = match sb_get(client, &url, session, anon_key).await {
        Ok(r) => r,
        Err(e) => {
            if !e.contains("PGRST205") {
                eprintln!("[sync] health_logs fetch failed: {e}");
            }
            return Ok(0);
        }
    };

    let count = rows.len();
    for row in rows {
        let logged_at = row
            .logged_at
            .as_deref()
            .map(iso_to_ms)
            .unwrap_or_else(now_ms);

        sqlx::query(
            r#"
            INSERT INTO health_logs (id, type, value, unit, metadata, logged_at)
            VALUES (?, ?, ?, ?, '{}', ?)
            ON CONFLICT(id) DO UPDATE SET
                value     = excluded.value,
                unit      = excluded.unit,
                logged_at = excluded.logged_at
            "#,
        )
        .bind(&row.id)
        .bind(&row.log_type)
        .bind(row.value)
        .bind(row.unit.as_deref())
        .bind(logged_at)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

// ── Public entry point ───────────────────────────────────────────────────────

/// Pull the user's live data from Supabase and upsert into local SQLite.
/// Silent on per-table errors — the dashboard degrades gracefully if one
/// table is missing or has a different schema.
pub async fn sync_user_data(pool: &SqlitePool, auth: &AuthManager) -> Result<(), String> {
    let sync_lock = SYNC_USER_DATA_LOCK.get_or_init(|| Mutex::new(()));
    let _sync_guard = match sync_lock.try_lock() {
        Ok(guard) => guard,
        Err(_) => {
            eprintln!("[sync] Supabase sync already running — skipping duplicate startup sync");
            return Ok(());
        }
    };

    // Need a live session with an access token.
    let session = match auth.current_session().await {
        Some(s) => s,
        None => {
            eprintln!("[sync] No active session — skipping Supabase sync");
            return Ok(());
        }
    };

    // Get Supabase URL + anon key from the AuthManager config.
    let (base_url, anon_key) = auth.supabase_config();

    let client = Client::builder()
        .timeout(Duration::from_millis(2500))
        .build()
        .map_err(|e| e.to_string())?;

    // SQLite is a single-writer database. Running these upserts concurrently
    // during dashboard startup can exhaust the pool or race habit completions
    // before their habits exist. Keep startup deterministic: one sync at a time,
    // and local writes in dependency order.
    let tasks_r = sync_tasks(pool, &client, &base_url, &anon_key, &session).await;
    let habits_r = sync_habits(pool, &client, &base_url, &anon_key, &session).await;
    let completions_r = sync_habit_completions(pool, &client, &base_url, &anon_key, &session).await;
    let health_r = sync_health_logs(pool, &client, &base_url, &anon_key, &session).await;

    eprintln!(
        "[sync] tasks={}, habits={}, completions={}, health={}",
        tasks_r.unwrap_or(0),
        habits_r.unwrap_or(0),
        completions_r.unwrap_or(0),
        health_r.unwrap_or(0),
    );

    Ok(())
}
