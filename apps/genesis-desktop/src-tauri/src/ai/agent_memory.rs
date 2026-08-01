// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Agent memory — conversation persistence via SQLite.
//!
//! Provides CRUD for conversations and their messages, enabling the agent
//! to maintain context across sessions.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;

use super::chat::{ChatMessage, ToolCall};

// ── Types ────────────────────────────────────────────────────────────────────

/// Summary info about a saved conversation.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummary {
    pub id: String,
    pub title: String,
    pub message_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Full conversation with all messages.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: i64,
    pub updated_at: i64,
}

// ── Table management ─────────────────────────────────────────────────────────

/// Ensure the agent memory tables exist.
pub async fn ensure_tables(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS agent_conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 0
        )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create agent_conversations table: {e}"))?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS agent_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tool_calls TEXT,
            tool_call_id TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create agent_messages table: {e}"))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_agent_messages_conv ON agent_messages(conversation_id, position)",
    )
    .execute(pool)
    .await
    .ok();

    Ok(())
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/// Create a new conversation and return its ID.
#[allow(dead_code)]
pub async fn create_conversation(pool: &SqlitePool) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    sqlx::query(
        "INSERT INTO agent_conversations (id, title, created_at, updated_at) VALUES (?, '', ?, ?)",
    )
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create conversation: {e}"))?;
    Ok(id)
}

/// Delete a conversation and all its messages.
pub async fn delete_conversation(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM agent_messages WHERE conversation_id = ?")
        .bind(id)
        .execute(pool)
        .await
        .ok();
    sqlx::query("DELETE FROM agent_conversations WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete conversation: {e}"))?;
    Ok(())
}

/// List all conversations, most recent first.
pub async fn list_conversations(
    pool: &SqlitePool,
    limit: i64,
    offset: i64,
) -> Result<Vec<ConversationSummary>, String> {
    let rows = sqlx::query_as::<_, (String, String, i64, i64, i64)>(
        "SELECT id, title, message_count, created_at, updated_at FROM agent_conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to list conversations: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|(id, title, count, created, updated)| ConversationSummary {
            id,
            title,
            message_count: count,
            created_at: created,
            updated_at: updated,
        })
        .collect())
}

/// Get a single conversation with all its messages.
pub async fn get_conversation(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Conversation>, String> {
    let conv = sqlx::query_as::<_, (String, String, i64, i64, i64)>(
        "SELECT id, title, message_count, created_at, updated_at FROM agent_conversations WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get conversation: {e}"))?;

    let conv = match conv {
        Some(c) => c,
        None => return Ok(None),
    };

    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, i64, i64)>(
        "SELECT role, content, tool_calls, tool_call_id, position, created_at FROM agent_messages WHERE conversation_id = ? ORDER BY position",
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get messages: {e}"))?;

    let messages: Vec<ChatMessage> = rows
        .into_iter()
        .map(|(role, content, tool_calls_json, tool_call_id, _pos, created_at)| {
        let tool_calls = tool_calls_json
            .and_then(|json| serde_json::from_str::<Vec<ToolCall>>(&json).ok())
            .filter(|v| !v.is_empty());
            ChatMessage {
                role,
                content,
                tool_calls,
                tool_call_id,
                tool_call_name: None,
                created_at: Some(created_at),
            }
        })
        .collect();

    Ok(Some(Conversation {
        id: conv.0,
        title: conv.1,
        messages,
        created_at: conv.3,
        updated_at: conv.4,
    }))
}

/// Save a list of messages to a conversation.
/// This replaces all existing messages for the conversation.
pub async fn save_messages(
    pool: &SqlitePool,
    conversation_id: &str,
    messages: &[ChatMessage],
) -> Result<(), String> {
    let now = time::now_ms();

    // Delete existing messages
    sqlx::query("DELETE FROM agent_messages WHERE conversation_id = ?")
        .bind(conversation_id)
        .execute(pool)
        .await
        .ok();

    // Ensure the conversation exists
    let exists: Option<String> =
        sqlx::query_scalar("SELECT id FROM agent_conversations WHERE id = ?")
            .bind(conversation_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("DB error: {e}"))?;

    if exists.is_none() {
        sqlx::query(
            "INSERT INTO agent_conversations (id, title, created_at, updated_at) VALUES (?, '', ?, ?)",
        )
        .bind(conversation_id)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to create conversation: {e}"))?;
    }

    // Insert messages starting at position 0 (full replace)
    insert_messages_internal(pool, conversation_id, messages, 0, now).await?;

    // Update conversation metadata
    let title = messages.first().and_then(|m| {
        if m.role == "user" && !m.content.is_empty() {
            Some(truncate_title(&m.content))
        } else {
            None
        }
    });

    sqlx::query(
        "UPDATE agent_conversations SET title = COALESCE(NULLIF(?, ''), title), message_count = ?, updated_at = ? WHERE id = ?",
    )
    .bind(title)
    .bind(messages.len() as i64)
    .bind(now)
    .bind(conversation_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update conversation: {e}"))?;

    Ok(())
}

/// Append messages to an existing conversation (no delete).
pub async fn append_messages(
    pool: &SqlitePool,
    conversation_id: &str,
    messages: &[ChatMessage],
) -> Result<(), String> {
    if messages.is_empty() {
        return Ok(());
    }
    let now = time::now_ms();

    // Get the next position
    let next_pos: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM agent_messages WHERE conversation_id = ?"
    )
    .bind(conversation_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    insert_messages_internal(pool, conversation_id, messages, next_pos, now).await?;

    // Update conversation metadata
    let added = messages.len() as i64;
    sqlx::query(
        "UPDATE agent_conversations SET message_count = message_count + ?, updated_at = ? WHERE id = ?",
    )
    .bind(added)
    .bind(now)
    .bind(conversation_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update conversation: {e}"))?;

    Ok(())
}

async fn insert_messages_internal(
    pool: &SqlitePool,
    conversation_id: &str,
    messages: &[ChatMessage],
    start_position: i64,
    now: i64,
) -> Result<(), String> {
    for (i, msg) in messages.iter().enumerate() {
        let msg_id = Uuid::new_v4().to_string();
        let tool_calls_json = msg
            .tool_calls
            .as_ref()
            .filter(|tc| !tc.is_empty())
            .map(|tc| serde_json::to_string(tc).unwrap_or_default());

        sqlx::query(
            "INSERT INTO agent_messages (id, conversation_id, role, content, tool_calls, tool_call_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&msg_id)
        .bind(conversation_id)
        .bind(&msg.role)
        .bind(&msg.content)
        .bind(tool_calls_json)
        .bind(&msg.tool_call_id)
        .bind(start_position + i as i64)
        .bind(msg.created_at.unwrap_or(now))
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to save message: {e}"))?;
    }
    Ok(())
}

/// Search conversations by title or message content.
pub async fn search_conversations(
    pool: &SqlitePool,
    query: &str,
    limit: i64,
) -> Result<Vec<ConversationSummary>, String> {
    let pattern = format!("%{query}%");
    let rows = sqlx::query_as::<_, (String, String, i64, i64, i64)>(
        r#"SELECT DISTINCT c.id, c.title, c.message_count, c.created_at, c.updated_at
           FROM agent_conversations c
           LEFT JOIN agent_messages m ON m.conversation_id = c.id
           WHERE c.title LIKE ? OR m.content LIKE ?
           ORDER BY c.updated_at DESC
           LIMIT ?"#,
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Search failed: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|(id, title, count, created, updated)| ConversationSummary {
            id,
            title,
            message_count: count,
            created_at: created,
            updated_at: updated,
        })
        .collect())
}

/// Update a conversation's title.
pub async fn update_conversation_title(
    pool: &SqlitePool,
    id: &str,
    title: &str,
) -> Result<(), String> {
    let now = time::now_ms();
    sqlx::query("UPDATE agent_conversations SET title = ?, updated_at = ? WHERE id = ?")
        .bind(title)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update title: {e}"))?;
    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn truncate_title(text: &str) -> String {
    let cleaned = text.trim();
    let char_count: usize = cleaned.chars().count();
    if char_count <= 60 {
        cleaned.to_string()
    } else {
        cleaned.chars().take(57).collect::<String>() + "..."
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_title() {
        assert_eq!(truncate_title("Hello"), "Hello");
        assert_eq!(truncate_title(""), "");
        let long = "a".repeat(100);
        assert_eq!(truncate_title(&long).len(), 60);
    }
}
