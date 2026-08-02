// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// src-tauri/src/commands/sync.rs
//
// Supabase sync — disabled (cloud infrastructure not ready).
// All internal code retained for when this feature is re-enabled.

use sqlx::SqlitePool;

use crate::auth::AuthManager;

pub async fn sync_user_data(_pool: &SqlitePool, _auth: &AuthManager) -> Result<(), String> {
    Ok(())
}
