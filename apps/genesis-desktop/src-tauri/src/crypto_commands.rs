//! Tauri commands for database encryption management.
//! All commands are zero-trust: passwords never leave Rust.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::crypto::{create_backup, CryptoService, CryptoStatus};
use crate::db::BentoAppState;

// ── Response types ─────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CryptoStatusResponse {
    pub status: CryptoStatus,
    pub is_configured: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub created_at: String,
}

// ── Commands ───────────────────────────────────────────────────────────────

/// Returns the current crypto status (NotConfigured / Locked / Unlocked).
/// Safe to call at startup to decide which UI to show.
#[tauri::command]
pub async fn crypto_get_status(
    crypto: State<'_, CryptoService>,
) -> Result<CryptoStatusResponse, String> {
    Ok(CryptoStatusResponse {
        status: crypto.status().await,
        is_configured: crypto.is_configured().await,
    })
}

/// First-time setup: set master password and encrypt all databases.
/// Must only be called when status == NotConfigured.
#[tauri::command]
pub async fn crypto_setup_master_password(
    app: AppHandle,
    crypto: State<'_, CryptoService>,
    password: String,
) -> Result<CryptoStatusResponse, String> {
    if crypto.is_configured().await {
        return Err(
            "Master password is already configured. Use change_master_password to update it."
                .to_string(),
        );
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // ── CRITICAL: close the plain pool BEFORE SQLCipher opens the same file ──
    // We need a temporary placeholder so BentoAppState is never pool-less.
    // Create a fresh in-memory pool as placeholder, atomically replace + close old.
    let placeholder = {
        use sqlx::sqlite::SqliteConnectOptions;
        use sqlx::sqlite::SqlitePoolOptions;
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(":memory:")
                    .create_if_missing(true),
            )
            .await
            .map_err(|e| e.to_string())?
    };

    if let Some(state) = app.try_state::<BentoAppState>() {
        // Atomically close the plain pool and install the placeholder.
        state.close_and_replace(placeholder).await;
    }

    // Now setup encryption — no other pool holds app.db open.
    crypto.setup_master_password(&password, &data_dir).await?;

    // Hot-swap in the real encrypted pool.
    if let Some(state) = app.try_state::<BentoAppState>() {
        let encrypted_pool = crypto.main_pool().await?;
        state.replace_pool(encrypted_pool);
    }

    Ok(CryptoStatusResponse {
        status: CryptoStatus::Unlocked,
        is_configured: true,
    })
}

/// Unlock an encrypted database with the master password.
/// Must only be called when status == Locked.
#[tauri::command]
pub async fn crypto_unlock_database(
    app: AppHandle,
    crypto: State<'_, CryptoService>,
    password: String,
) -> Result<CryptoStatusResponse, String> {
    // Close the stale plain pool before opening the encrypted one.
    let placeholder = {
        use sqlx::sqlite::SqliteConnectOptions;
        use sqlx::sqlite::SqlitePoolOptions;
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(":memory:")
                    .create_if_missing(true),
            )
            .await
            .map_err(|e| e.to_string())?
    };
    if let Some(state) = app.try_state::<BentoAppState>() {
        state.close_and_replace(placeholder).await;
    }

    crypto.unlock(&password).await?;

    // Install the real encrypted pool.
    if let Some(state) = app.try_state::<BentoAppState>() {
        let pool = crypto.main_pool().await?;
        state.replace_pool(pool);
    }

    Ok(CryptoStatusResponse {
        status: CryptoStatus::Unlocked,
        is_configured: true,
    })
}

/// Lock the database (close pools, drop key from memory).
#[tauri::command]
pub async fn crypto_lock_database(
    crypto: State<'_, CryptoService>,
) -> Result<CryptoStatusResponse, String> {
    crypto.lock().await;
    Ok(CryptoStatusResponse {
        status: CryptoStatus::Locked,
        is_configured: true,
    })
}

/// Change master password. Creates a backup first, re-encrypts atomically.
#[tauri::command]
pub async fn crypto_change_master_password(
    app: AppHandle,
    crypto: State<'_, CryptoService>,
    current_password: String,
    new_password: String,
) -> Result<BackupInfo, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = data_dir.join("backups");

    let backup_path = crypto
        .change_master_password(&current_password, &new_password, &data_dir, &backup_dir)
        .await?;

    // Update BentoAppState pool with new key's pool
    if let Some(state) = app.try_state::<BentoAppState>() {
        let pool = crypto.main_pool().await?;
        state.replace_pool(pool);
    }

    Ok(BackupInfo {
        path: backup_path.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Migrate a legacy unencrypted database to encrypted storage.
/// The frontend should call this after setup_master_password if old plain DBs exist.
#[tauri::command]
pub async fn crypto_migrate_unencrypted_db(
    app: AppHandle,
    crypto: State<'_, CryptoService>,
    module: String,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = data_dir.join("backups").join("pre-encryption");

    // Find the plain DB path for this module
    let filename = crate::crypto::MODULE_DB_FILES
        .iter()
        .find(|(m, _)| *m == module.as_str())
        .map(|(_, f)| *f)
        .ok_or_else(|| format!("Unknown module: {module}"))?;

    let plain_path = data_dir.join(filename);
    crypto
        .migrate_unencrypted(&plain_path, &module, &backup_dir)
        .await
}

/// Create a manual backup of all encrypted databases (e.g. before export/share).
#[tauri::command]
pub async fn crypto_create_backup(app: AppHandle) -> Result<BackupInfo, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_dir = data_dir.join("backups");
    let path = create_backup(&data_dir, &backup_dir)?;
    Ok(BackupInfo {
        path: path.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}
