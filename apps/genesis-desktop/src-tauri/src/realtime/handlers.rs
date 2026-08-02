// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Realtime handlers — read-only RPCs + reactive streams wired to the
//! SQLite database. Mirrors the clone's `src/live/*.js` modules: each
//! `live()` / `live.stream()` registration becomes a path a client can call.

use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager};

use crate::auth::AuthManager;

use super::{MergeStrategy, Registry, RpcError, StreamOptions};

/// Register all realtime handlers. Called once at server spawn.
pub async fn register(app: &AppHandle, _pool: &SqlitePool, registry: &Registry) {
    let _ = app;
    register_tasks(registry);
    register_notes(registry);
    register_habits(registry);
    register_health(registry);
    register_meta(registry);
}

// ── Tasks ────────────────────────────────────────────────────────────────

fn register_tasks(registry: &Registry) {
    // Reactive stream: full task list, live-updating via publish events.
    registry.stream(
        "tasks/list",
        |ctx, _args| async move {
            let rows = sqlx::query(
                "SELECT id, title, done, priority, project, tags, notes, due_at, due_time, \
                 start_at, estimated_minutes, tracked_minutes, recurrence_rule, archived, \
                 parent_id, completed_at, created_at, updated_at, sort_order \
                 FROM tasks WHERE archived = 0 ORDER BY sort_order ASC, created_at DESC",
            )
            .fetch_all(&ctx.pool)
            .await
            .map_err(|e| RpcError::new("DB_ERROR", format!("Failed to list tasks: {e}")))?;

            let tasks: Vec<Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "id": r.get::<String, _>("id"),
                        "title": r.get::<String, _>("title"),
                        "done": r.get::<i64, _>("done") != 0,
                        "priority": r.get::<Option<String>, _>("priority"),
                        "project": r.get::<Option<String>, _>("project"),
                        "tags": r.get::<Option<String>, _>("tags"),
                        "due_at": r.get::<Option<i64>, _>("due_at"),
                        "due_time": r.get::<Option<String>, _>("due_time"),
                        "start_at": r.get::<Option<i64>, _>("start_at"),
                        "estimated_minutes": r.get::<Option<i64>, _>("estimated_minutes"),
                        "tracked_minutes": r.get::<Option<i64>, _>("tracked_minutes"),
                        "archived": r.get::<i64, _>("archived") != 0,
                        "parent_id": r.get::<Option<String>, _>("parent_id"),
                        "completed_at": r.get::<Option<i64>, _>("completed_at"),
                        "created_at": r.get::<i64, _>("created_at"),
                        "updated_at": r.get::<i64, _>("updated_at"),
                        "sort_order": r.get::<f64, _>("sort_order"),
                    })
                })
                .collect();

            Ok(json!(tasks))
        },
        StreamOptions {
            merge: MergeStrategy::Crud,
            key: Some("id".to_string()),
            prepend: false,
            max: Some(500),
        },
    );

    // RPC: task count (cheap dashboard headline).
    registry.rpc("tasks/count", |ctx, _args| async move {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks WHERE archived = 0",
        )
        .fetch_one(&ctx.pool)
        .await
        .map_err(|e| RpcError::new("DB_ERROR", format!("Failed to count tasks: {e}")))?;
        Ok(json!({ "count": count }))
    });
}

// ── Notes ────────────────────────────────────────────────────────────────

fn register_notes(registry: &Registry) {
    // Reactive stream: note titles + updated_at for a live sidebar.
    registry.stream(
        "notes/list",
        |ctx, _args| async move {
            let rows = sqlx::query(
                "SELECT id, title, updated_at, created_at FROM note_objects ORDER BY updated_at DESC LIMIT 500",
            )
            .fetch_all(&ctx.pool)
            .await
            .map_err(|e| RpcError::new("DB_ERROR", format!("Failed to list notes: {e}")))?;

            let notes: Vec<Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "id": r.get::<String, _>("id"),
                        "title": r.get::<Option<String>, _>("title"),
                        "updated_at": r.get::<i64, _>("updated_at"),
                        "created_at": r.get::<i64, _>("created_at"),
                    })
                })
                .collect();

            Ok(json!(notes))
        },
        StreamOptions {
            merge: MergeStrategy::Crud,
            key: Some("id".to_string()),
            prepend: false,
            max: Some(500),
        },
    );
}

// ── Habits ───────────────────────────────────────────────────────────────

fn register_habits(registry: &Registry) {
    registry.stream(
        "habits/list",
        |ctx, _args| async move {
            let rows = sqlx::query(
                "SELECT id, name, emoji, color, kind, archived, completion_type, target_count, \
                 unit, frequency, why, sort_order, created_at, updated_at \
                 FROM habits ORDER BY sort_order ASC",
            )
            .fetch_all(&ctx.pool)
            .await
            .map_err(|e| RpcError::new("DB_ERROR", format!("Failed to list habits: {e}")))?;

            let habits: Vec<Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "id": r.get::<String, _>("id"),
                        "name": r.get::<String, _>("name"),
                        "emoji": r.get::<Option<String>, _>("emoji"),
                        "color": r.get::<Option<String>, _>("color"),
                        "kind": r.get::<String, _>("kind"),
                        "archived": r.get::<i64, _>("archived") != 0,
                        "completion_type": r.get::<Option<String>, _>("completion_type"),
                        "target_count": r.get::<Option<i64>, _>("target_count"),
                        "unit": r.get::<Option<String>, _>("unit"),
                        "frequency": r.get::<Option<String>, _>("frequency"),
                        "why": r.get::<Option<String>, _>("why"),
                        "sort_order": r.get::<i64, _>("sort_order"),
                        "created_at": r.get::<i64, _>("created_at"),
                        "updated_at": r.get::<i64, _>("updated_at"),
                    })
                })
                .collect();

            Ok(json!(habits))
        },
        StreamOptions {
            merge: MergeStrategy::Crud,
            key: Some("id".to_string()),
            prepend: false,
            max: Some(500),
        },
    );
}

// ── Health ───────────────────────────────────────────────────────────────

fn register_health(registry: &Registry) {
    // Reactive stream: daily health logs (mood/energy/sleep) for the phone.
    registry.stream(
        "health/daily",
        |ctx, _args| async move {
            let rows = sqlx::query(
                "SELECT date_key, mood, energy, water_glasses, sleep_hours, symptoms, note, logged_at \
                 FROM health_daily_logs ORDER BY date_key DESC LIMIT 365",
            )
            .fetch_all(&ctx.pool)
            .await
            .map_err(|e| RpcError::new("DB_ERROR", format!("Failed to load health logs: {e}")))?;

            let logs: Vec<Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "id": r.get::<String, _>("date_key"),
                        "dateKey": r.get::<String, _>("date_key"),
                        "mood": r.get::<String, _>("mood"),
                        "energy": r.get::<i64, _>("energy"),
                        "waterGlasses": r.get::<i64, _>("water_glasses"),
                        "sleepHours": r.get::<f64, _>("sleep_hours"),
                        "symptoms": r.get::<String, _>("symptoms"),
                        "note": r.get::<Option<String>, _>("note"),
                        "loggedAt": r.get::<i64, _>("logged_at"),
                    })
                })
                .collect();

            Ok(json!(logs))
        },
        StreamOptions {
            merge: MergeStrategy::Crud,
            key: Some("id".to_string()),
            prepend: false,
            max: Some(365),
        },
    );

    // RPC: wellness score headline computed from the latest log entry.
    registry.rpc("health/score", |ctx, _args| async move {
        let row = sqlx::query(
            "SELECT mood, energy, sleep_hours FROM health_daily_logs \
             ORDER BY date_key DESC LIMIT 1",
        )
        .fetch_optional(&ctx.pool)
        .await
        .map_err(|e| RpcError::new("DB_ERROR", format!("Failed to load wellness score: {e}")))?;

        let score: i64 = match row {
            Some(r) => {
                let mood: String = r.get("mood");
                let energy: i64 = r.get("energy");
                let sleep_hours: f64 = r.get("sleep_hours");
                let mood_pts = match mood.as_str() {
                    "energized" => 20,
                    "bright" => 17,
                    "great" => 18,
                    "steady" => 13,
                    "restless" => 8,
                    "drained" => 4,
                    _ => 10,
                };
                let sleep_pts = ((sleep_hours / 8.0).clamp(0.0, 1.0) * 30.0).round() as i64;
                (energy.clamp(0, 10) * 5) + sleep_pts + mood_pts
            }
            None => 0,
        };
        Ok(json!({ "score": score }))
    });
}

// ── Meta ─────────────────────────────────────────────────────────────────

fn register_meta(registry: &Registry) {
    // `set`-merge stream: the desktop's signed-in user + tier snapshot.
    registry.stream(
        "meta/self",
        |ctx, _args| async move {
            let user = match ctx.app.try_state::<AuthManager>() {
                Some(auth) => match auth.current_session().await {
                    Some(s) => json!({
                        "id": s.user.id,
                        "name": s.user.name,
                        "email": s.user.email,
                        "avatarUrl": s.user.avatar_url,
                    }),
                    None => Value::Null,
                },
                None => Value::Null,
            };
            Ok(user)
        },
        StreamOptions {
            merge: MergeStrategy::Set,
            key: None,
            prepend: false,
            max: None,
        },
    );

    // Server-initiated push demo: a ping that echoes the request id.
    registry.rpc("meta/ping", |ctx, _args| async move {
        Ok(json!({ "pong": true, "user": ctx.user_id, "requestId": ctx.request_id }))
    });

    // A stable stream the phone can subscribe to for dashboard "ready" signal.
    registry.stream(
        "meta/status",
        |_ctx, _args| async move {
            Ok(json!({
                "app": "bento-desktop",
                "version": env!("CARGO_PKG_VERSION"),
                "serverTime": crate::util::time::now_ms(),
            }))
        },
        StreamOptions {
            merge: MergeStrategy::Set,
            key: None,
            prepend: false,
            max: None,
        },
    );
}
