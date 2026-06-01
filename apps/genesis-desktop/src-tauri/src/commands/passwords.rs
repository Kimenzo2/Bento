//! Password Vault — E2EE-backed storage using SQLCipher-encrypted `passwords.db`.
//!
//! This module stores credentials in the dedicated `passwords.db` SQLCipher
//! database, which is encrypted at rest with the user's master password
//! (Argon2id → SQLCipher AES-256-CBC + HMAC-SHA512).
//!
//! The encryption is transparent at the SQLite page level — the Rust code
//! writes plaintext but the data on disk is ciphertext. No manual
//! encrypt/decrypt is needed in this module.

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;

use crate::crypto::CryptoService;

// ── Schema migration ───────────────────────────────────────────────────────────

/// Ensure the `passwords` table exists in the dedicated `passwords.db`.
/// This runs every time a pool is first obtained, since `passwords.db` is a
/// separate SQLCipher database file and does not inherit migrations from the
/// main `app.db`.
async fn ensure_passwords_table(pool: &sqlx::SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS passwords (
            id                TEXT PRIMARY KEY,
            site              TEXT NOT NULL,
            username          TEXT NOT NULL,
            password_encrypted TEXT NOT NULL DEFAULT '',
            notes_encrypted   TEXT NOT NULL DEFAULT '',
            created_at        INTEGER NOT NULL,
            updated_at        INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub id: String,
    pub site: String,
    pub username: String,
    pub password: String,
    pub notes: String,
    pub created: i64,
    pub updated: i64,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// List all password vault entries from the encrypted DB, newest-first.
///
/// Returns an error if the crypto service is locked or not configured.
#[tauri::command]
pub async fn passwords_list(crypto: State<'_, CryptoService>) -> Result<Vec<VaultEntry>, String> {
    let pool = crypto.pool("passwords").await?;
    ensure_passwords_table(&pool).await?;

    let rows = sqlx::query(
        "SELECT id, site, username, password_encrypted, notes_encrypted, \
                created_at, updated_at \
         FROM passwords \
         ORDER BY updated_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows
        .iter()
        .map(|row| VaultEntry {
            id: row.try_get::<String, _>("id").unwrap_or_default(),
            site: row.try_get::<String, _>("site").unwrap_or_default(),
            username: row.try_get::<String, _>("username").unwrap_or_default(),
            password: row
                .try_get::<String, _>("password_encrypted")
                .unwrap_or_default(),
            notes: row
                .try_get::<String, _>("notes_encrypted")
                .unwrap_or_default(),
            created: row.try_get::<i64, _>("created_at").unwrap_or(0),
            updated: row.try_get::<i64, _>("updated_at").unwrap_or(0),
        })
        .collect();

    Ok(entries)
}

/// Save (create or update) a password vault entry in the encrypted DB.
#[tauri::command]
pub async fn passwords_save(
    crypto: State<'_, CryptoService>,
    entry: VaultEntry,
) -> Result<(), String> {
    let pool = crypto.pool("passwords").await?;
    ensure_passwords_table(&pool).await?;

    sqlx::query(
        "INSERT INTO passwords \
            (id, site, username, password_encrypted, notes_encrypted, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
            site               = excluded.site, \
            username           = excluded.username, \
            password_encrypted = excluded.password_encrypted, \
            notes_encrypted    = excluded.notes_encrypted, \
            updated_at         = excluded.updated_at",
    )
    .bind(&entry.id)
    .bind(&entry.site)
    .bind(&entry.username)
    .bind(&entry.password)
    .bind(&entry.notes)
    .bind(entry.created)
    .bind(entry.updated)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get a single password vault entry by ID.
#[tauri::command]
pub async fn passwords_get(
    crypto: State<'_, CryptoService>,
    id: String,
) -> Result<Option<VaultEntry>, String> {
    let pool = crypto.pool("passwords").await?;
    ensure_passwords_table(&pool).await?;

    let row = sqlx::query(
        "SELECT id, site, username, password_encrypted, notes_encrypted, \
                created_at, updated_at \
         FROM passwords \
         WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|r| VaultEntry {
        id: r.try_get::<String, _>("id").unwrap_or_default(),
        site: r.try_get::<String, _>("site").unwrap_or_default(),
        username: r.try_get::<String, _>("username").unwrap_or_default(),
        password: r
            .try_get::<String, _>("password_encrypted")
            .unwrap_or_default(),
        notes: r
            .try_get::<String, _>("notes_encrypted")
            .unwrap_or_default(),
        created: r.try_get::<i64, _>("created_at").unwrap_or(0),
        updated: r.try_get::<i64, _>("updated_at").unwrap_or(0),
    }))
}

/// Search password vault entries by site or username.
#[tauri::command]
pub async fn passwords_search(
    crypto: State<'_, CryptoService>,
    query: String,
) -> Result<Vec<VaultEntry>, String> {
    let pool = crypto.pool("passwords").await?;
    ensure_passwords_table(&pool).await?;
    let pattern = format!("%{}%", query);

    let rows = sqlx::query(
        "SELECT id, site, username, password_encrypted, notes_encrypted, \
                created_at, updated_at \
         FROM passwords \
         WHERE site LIKE ? OR username LIKE ? \
         ORDER BY updated_at DESC",
    )
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let entries = rows
        .iter()
        .map(|row| VaultEntry {
            id: row.try_get::<String, _>("id").unwrap_or_default(),
            site: row.try_get::<String, _>("site").unwrap_or_default(),
            username: row.try_get::<String, _>("username").unwrap_or_default(),
            password: row
                .try_get::<String, _>("password_encrypted")
                .unwrap_or_default(),
            notes: row
                .try_get::<String, _>("notes_encrypted")
                .unwrap_or_default(),
            created: row.try_get::<i64, _>("created_at").unwrap_or(0),
            updated: row.try_get::<i64, _>("updated_at").unwrap_or(0),
        })
        .collect();

    Ok(entries)
}

/// Delete a password vault entry by ID.
#[tauri::command]
pub async fn passwords_delete(crypto: State<'_, CryptoService>, id: String) -> Result<(), String> {
    let pool = crypto.pool("passwords").await?;
    ensure_passwords_table(&pool).await?;

    sqlx::query("DELETE FROM passwords WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Migrate existing localStorage passwords into the encrypted DB.
///
/// Accepts a JSON string (the full `bento_passwords` localStorage value) and
/// inserts all entries that don't already exist (idempotent — safe to call
/// multiple times). Returns the count of entries migrated.
#[tauri::command]
pub async fn passwords_migrate_from_storage(
    crypto: State<'_, CryptoService>,
    entries_json: String,
) -> Result<usize, String> {
    let entries: Vec<VaultEntry> =
        serde_json::from_str(&entries_json).map_err(|e| format!("Invalid entries JSON: {e}"))?;

    let pool = crypto.pool("passwords").await?;
    ensure_passwords_table(&pool).await?;
    let count = entries.len();

    for entry in &entries {
        sqlx::query(
            "INSERT OR IGNORE INTO passwords \
                (id, site, username, password_encrypted, notes_encrypted, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry.id)
        .bind(&entry.site)
        .bind(&entry.username)
        .bind(&entry.password)
        .bind(&entry.notes)
        .bind(entry.created)
        .bind(entry.updated)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(count)
}
