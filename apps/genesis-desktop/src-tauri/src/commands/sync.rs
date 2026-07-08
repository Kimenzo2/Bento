// src-tauri/src/commands/sync.rs
//
// Supabase sync — disabled (cloud infrastructure not ready).
// All internal code retained for when this feature is re-enabled.

use sqlx::SqlitePool;

use crate::auth::AuthManager;

pub async fn sync_user_data(_pool: &SqlitePool, _auth: &AuthManager) -> Result<(), String> {
    Ok(())
}
