// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::integrations::{ConnectionStatus, IntegrationConnection};
use keyring::Entry;
use sqlx::Row;
use tokio::task::spawn_blocking;

const KEYRING_SERVICE: &str = "Bento Desktop";
const KEYRING_INTEGRATIONS_ACCOUNT: &str = "integrations-api-key";

/// Compiled-in default Composio API key (project key for Bento Desktop).
/// This is the developer's key — users don't need to manage their own.
/// Rotate via composio.dev/dashboard → Settings → API Keys if compromised.
const COMPOSIO_DEFAULT_API_KEY: Option<&str> = option_env!("COMPOSIO_API_KEY");

pub async fn init_table(pool: &sqlx::SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS integrations (
            app_key TEXT PRIMARY KEY,
            connection_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'connected',
            created_at_ms INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn save_connection(
    pool: &sqlx::SqlitePool,
    app_key: &str,
    connection_id: &str,
) -> Result<(), String> {
    let now_ms = crate::util::time::now_ms();
    // On reconnect the original creation time is preserved — reconnecting is
    // not the same as installing the app for the first time.
    sqlx::query(
        "INSERT INTO integrations (app_key, connection_id, status, created_at_ms)
         VALUES (?, ?, 'connected', ?)
         ON CONFLICT(app_key) DO UPDATE SET
            connection_id = excluded.connection_id,
            status = excluded.status,
            created_at_ms = integrations.created_at_ms",
    )
    .bind(app_key)
    .bind(connection_id)
    .bind(now_ms)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to save connection: {e}"))?;
    Ok(())
}

pub async fn get_connections(
    pool: &sqlx::SqlitePool,
) -> Result<Vec<IntegrationConnection>, String> {
    let rows = sqlx::query(
        "SELECT app_key, connection_id, status, created_at_ms FROM integrations ORDER BY created_at_ms DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch connections: {e}"))?;

    let conns = rows
        .iter()
        .map(|row| {
            let status_str: String = row.get("status");
            let status = match status_str.as_str() {
                "connected" => ConnectionStatus::Connected,
                "connecting" => ConnectionStatus::Connecting,
                "disconnected" => ConnectionStatus::Disconnected,
                _ => ConnectionStatus::Error(status_str),
            };
            IntegrationConnection {
                id: row.get("connection_id"),
                app_key: row.get("app_key"),
                status,
                created_at_ms: row.get("created_at_ms"),
            }
        })
        .collect();
    Ok(conns)
}

pub async fn get_connection(
    pool: &sqlx::SqlitePool,
    app_key: &str,
) -> Result<Option<IntegrationConnection>, String> {
    let row = sqlx::query(
        "SELECT app_key, connection_id, status, created_at_ms FROM integrations WHERE app_key = ?",
    )
    .bind(app_key)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch connection: {e}"))?;

    Ok(row.map(|r| {
        let status_str: String = r.get("status");
        let status = match status_str.as_str() {
            "connected" => ConnectionStatus::Connected,
            "connecting" => ConnectionStatus::Connecting,
            "disconnected" => ConnectionStatus::Disconnected,
            _ => ConnectionStatus::Error(status_str),
        };
        IntegrationConnection {
            id: r.get("connection_id"),
            app_key: r.get("app_key"),
            status,
            created_at_ms: r.get("created_at_ms"),
        }
    }))
}

pub async fn delete_connection(pool: &sqlx::SqlitePool, app_key: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM integrations WHERE app_key = ?")
        .bind(app_key)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete connection: {e}"))?;
    Ok(())
}

pub async fn connected_app_keys(pool: &sqlx::SqlitePool) -> Result<Vec<String>, String> {
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT app_key FROM integrations WHERE status = 'connected' ORDER BY app_key",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch connected apps: {e}"))?;
    Ok(rows)
}

// ── API Key management (OS keyring) ──

pub async fn save_api_key_async(api_key: String) -> Result<(), String> {
    spawn_blocking(move || save_api_key(&api_key))
        .await
        .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn get_api_key_async() -> Result<Option<String>, String> {
    spawn_blocking(get_api_key)
        .await
        .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn has_api_key_async() -> bool {
    spawn_blocking(has_api_key)
        .await
        .unwrap_or(false)
}

pub async fn delete_api_key_async() -> Result<(), String> {
    spawn_blocking(delete_api_key)
        .await
        .map_err(|e| format!("Task join failed: {e}"))?
}

pub fn save_api_key(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    if !trimmed.starts_with("ak_") {
        return Err("Invalid API key format — Composio keys start with 'ak_'".to_string());
    }
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_INTEGRATIONS_ACCOUNT)
        .map_err(|e| format!("Keyring error: {e}"))?;
    entry
        .set_password(trimmed)
        .map_err(|e| format!("Failed to save API key: {e}"))?;
    Ok(())
}

pub fn get_api_key() -> Result<Option<String>, String> {
    // 1. Check OS keyring first (developer-set override)
    let entry = match Entry::new(KEYRING_SERVICE, KEYRING_INTEGRATIONS_ACCOUNT) {
        Ok(e) => e,
        Err(_) => {
            // Keyring unavailable — fall through to default
            return Ok(COMPOSIO_DEFAULT_API_KEY.map(|k| k.to_string()));
        }
    };
    match entry.get_password() {
        Ok(key) if !key.is_empty() => return Ok(Some(key)),
        Ok(_) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(format!("Failed to read API key: {e}")),
    }

    // 2. Fall back to compiled-in default
    Ok(COMPOSIO_DEFAULT_API_KEY.map(|k| k.to_string()))
}

pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_INTEGRATIONS_ACCOUNT)
        .map_err(|e| format!("Keyring error: {e}"))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        // No stored key is not an error — deleting an absent key must succeed
        // (e.g. when the app only ever used the compiled-in default).
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete API key from keyring: {e}")),
    }
}

pub fn has_api_key() -> bool {
    // get_api_key() already falls back to the compiled-in default key,
    // so no separate COMPOSIO_DEFAULT_API_KEY check is needed.
    get_api_key().ok().flatten().is_some()
}

pub async fn get_user_api_key_async() -> Result<Option<String>, String> {
    spawn_blocking(get_user_api_key)
        .await
        .map_err(|e| format!("Task join failed: {e}"))?
}

/// Read only the user-set key from the OS keyring, without the compiled-in
/// default fallback. Lets callers distinguish "the user configured a key" from
/// "a developer fallback is silently backing requests".
pub fn get_user_api_key() -> Result<Option<String>, String> {
    let entry = match Entry::new(KEYRING_SERVICE, KEYRING_INTEGRATIONS_ACCOUNT) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };
    match entry.get_password() {
        Ok(k) if !k.is_empty() => Ok(Some(k)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read API key: {e}")),
    }
}

// ── Per-app credential management (OS keyring) ──

fn app_keyring_account(app_key: &str, kind: &str) -> String {
    format!("integrations-{kind}-{app_key}")
}

pub async fn save_app_api_key_async(app_key: &str, api_key: &str) -> Result<(), String> {
    let account = app_keyring_account(app_key, "key");
    let api_key = api_key.to_string();
    spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Keyring error: {e}"))?;
        entry
            .set_password(&api_key)
            .map_err(|e| format!("Failed to save app API key: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn get_app_api_key_async(app_key: &str) -> Result<Option<String>, String> {
    let account = app_keyring_account(app_key, "key");
    spawn_blocking(move || {
        let entry = match Entry::new(KEYRING_SERVICE, &account) {
            Ok(e) => e,
            Err(_) => return Ok(None),
        };
        match entry.get_password() {
            Ok(k) if !k.is_empty() => Ok(Some(k)),
            Ok(_) => Ok(None),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to read app API key: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn delete_app_api_key_async(app_key: &str) -> Result<(), String> {
    let account = app_keyring_account(app_key, "key");
    spawn_blocking(move || {
        let entry = Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Keyring error: {e}"))?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete app API key: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn save_app_oauth_creds_async(
    app_key: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<(), String> {
    let account = app_keyring_account(app_key, "oauth");
    let payload = serde_json::json!({ "client_id": client_id, "client_secret": client_secret })
        .to_string();
    spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Keyring error: {e}"))?;
        entry
            .set_password(&payload)
            .map_err(|e| format!("Failed to save OAuth credentials: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn delete_app_oauth_creds_async(app_key: &str) -> Result<(), String> {
    let account = app_keyring_account(app_key, "oauth");
    spawn_blocking(move || {
        let entry = Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Keyring error: {e}"))?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete OAuth credentials: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}
