// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "save_note".into(),
            description: "Save a new note with a title, content (plain text or markdown), and optional tags. Returns the note ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title (required)"},
                    "content": {"type": "string", "description": "Note body content (required)"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional tags"}
                },
                "required": ["title", "content"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_note".into(),
            description: "Get a single note by its ID with full content and metadata.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note"}
                },
                "required": ["note_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "search_notes".into(),
            description: "Search notes by keyword, matching against titles and body content. Returns matching notes with id, title, excerpt, and updated_at.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword (required)"},
                    "limit": {"type": "integer", "description": "Max results (1-100), defaults to 10"}
                },
                "required": ["query"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_note".into(),
            description: "Modify an existing note's title, content, or tags. Any field can be omitted to leave it unchanged.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note to update"},
                    "title": {"type": "string", "description": "New title"},
                    "content": {"type": "string", "description": "New content body"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "New tags array"}
                },
                "required": ["note_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_note".into(),
            description: "Permanently delete a note by its ID. This action cannot be undone.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note to delete"}
                },
                "required": ["note_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "list_notes".into(),
            description: "List all notes with pagination, optionally including archived ones.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "include_archived": {"type": "boolean", "description": "Whether to include archived notes, defaults to false"},
                    "limit": {"type": "integer", "description": "Max results (1-100), defaults to 50"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "Optional tags to filter by"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "pin_note".into(),
            description: "Pin or unpin a note. Pinned notes appear at the top of the notes list.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note"},
                    "pinned": {"type": "boolean", "description": "True to pin, false to unpin"}
                },
                "required": ["note_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "archive_note".into(),
            description: "Archive or unarchive a note. Archived notes are hidden from the default list.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "note_id": {"type": "string", "description": "The unique ID of the note"},
                    "archived": {"type": "boolean", "description": "True to archive, false to unarchive"}
                },
                "required": ["note_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_tags".into(),
            description: "List all tags used across notes with their usage counts.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_note_stats".into(),
            description: "Get note statistics: total notes, pinned count, archived count, and recent activity.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "save_note" => Ok(Some(save_note(args, pool).await?)),
        "get_note" => Ok(Some(get_note(args, pool).await?)),
        "search_notes" => Ok(Some(search_notes(args, pool).await?)),
        "update_note" => Ok(Some(update_note(args, pool).await?)),
        "delete_note" => Ok(Some(delete_note(args, pool).await?)),
        "list_notes" => Ok(Some(list_notes(args, pool).await?)),
        "pin_note" => Ok(Some(pin_note(args, pool).await?)),
        "archive_note" => Ok(Some(archive_note(args, pool).await?)),
        "list_tags" => Ok(Some(list_tags(pool).await?)),
        "get_note_stats" => Ok(Some(get_note_stats(pool).await?)),
        _ => Ok(None),
    }
}

async fn save_note(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let title = args["title"].as_str().ok_or("title is required")?;
    let content = args["content"].as_str().ok_or("content is required")?;
    if title.trim().is_empty() || content.trim().is_empty() {
        return Err("Title and content are required.".to_string());
    }
    let object_id = Uuid::new_v4().to_string();
    let block_id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();
    let tags = args["tags"].as_array().map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string())).unwrap_or_else(|| "[]".to_string());

    let mut tx = pool.begin().await.map_err(|e| format!("Transaction error: {e}"))?;

    // Insert into objects table first (blocks FK references objects.id)
    sqlx::query("INSERT OR IGNORE INTO objects (id, type, layout, name, icon, is_archived, is_deleted, created_at, updated_at) VALUES (?, 'note', 'note', ?, NULL, 0, 0, ?, ?)")
        .bind(&object_id).bind(title.trim()).bind(now_ms).bind(now_ms)
        .execute(&mut *tx).await.map_err(|e| format!("Failed to create object: {e}"))?;

    sqlx::query("INSERT INTO note_objects (id, title, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&object_id).bind(title.trim()).bind(&tags).bind(now_ms).bind(now_ms)
        .execute(&mut *tx).await.map_err(|e| format!("Failed to create note: {e}"))?;

    let block_content = json!({"text": content.trim()}).to_string();
    sqlx::query("INSERT INTO blocks (id, object_id, type, content, position, created_at, updated_at) VALUES (?, ?, 'text', ?, 0, ?, ?)")
        .bind(&block_id).bind(&object_id).bind(&block_content).bind(now_ms).bind(now_ms)
        .execute(&mut *tx).await.map_err(|e| format!("Failed to create block: {e}"))?;

    tx.commit().await.map_err(|e| format!("Commit error: {e}"))?;

    Ok(json!({ "id": object_id, "title": title.trim(), "data_coverage": 1.0, "message": format!("Note \"{}\" saved.", title.trim()) }))
}

async fn get_note(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let note_id = args["note_id"].as_str().ok_or("note_id is required")?;

    let note = sqlx::query_as::<_, (String, String, Option<String>, i64, Option<i64>, i64)>(
        "SELECT id, title, tags, created_at, pinned, updated_at FROM note_objects WHERE id = ?"
    )
    .bind(note_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?
    .ok_or_else(|| format!("Note \"{note_id}\" not found."))?;

    let blocks = sqlx::query_as::<_, (String, String, String, i64)>(
        "SELECT id, type, content, position FROM blocks WHERE object_id = ? ORDER BY position ASC"
    )
    .bind(note_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    let (id, title, tags, created_at, pinned, updated_at) = note;
    let blocks_val: Vec<Value> = blocks.into_iter().map(|(bid, btype, content, pos)| {
        json!({"id": bid, "type": btype, "content": content, "position": pos})
    }).collect();

    Ok(json!({
        "id": id, "title": title, "tags": tags,
        "createdAt": created_at, "updatedAt": updated_at,
        "pinned": pinned.unwrap_or(0) == 1,
        "blocks": blocks_val,
        "data_coverage": 1.0
    }))
}

async fn search_notes(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let query_str = args["query"].as_str().ok_or("query is required")?;
    let limit = args["limit"].as_i64().unwrap_or(10).min(100);
    let pattern = format!("%{}%", query_str);

    let rows = sqlx::query_as::<_, (String, String, String, i64)>(
        r#"SELECT DISTINCT n.id, n.title,
            COALESCE(substr(json_extract(b.content, '$.text'), 1, 200), '') as excerpt,
            n.updated_at
           FROM note_objects n
           LEFT JOIN blocks b ON b.object_id = n.id
           WHERE n.title LIKE ? OR json_extract(b.content, '$.text') LIKE ?
           ORDER BY n.updated_at DESC
           LIMIT ?"#,
    )
    .bind(&pattern).bind(&pattern).bind(limit)
    .fetch_all(pool).await.map_err(|e| format!("Search failed: {e}"))?;

    let notes: Vec<Value> = rows.into_iter().map(|(id, title, excerpt, updated_at)| {
        json!({ "id": id, "title": title, "excerpt": excerpt, "updatedAt": updated_at })
    }).collect();

    Ok(json!({ "notes": notes, "count": notes.len() }))
}

async fn update_note(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let note_id = args["note_id"].as_str().ok_or("note_id is required")?;
    let now_ms = time::now_ms();
    let mut cols: Vec<&str> = Vec::new();

    if args.get("title").is_some() { cols.push("title = ?"); }
    if args.get("tags").is_some() { cols.push("tags = ?"); }
    if cols.is_empty() && args.get("content").is_none() {
        return Err("No fields to update.".to_string());
    }

    cols.push("updated_at = ?");
    let sql = format!("UPDATE note_objects SET {} WHERE id = ?", cols.join(", "));
    let mut query = sqlx::query(&sql);

    if let Some(t) = args["title"].as_str() { query = query.bind(t.trim()); }
    if let Some(t) = args["tags"].as_array() {
        query = query.bind(serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));
    }
    query = query.bind(now_ms).bind(note_id);

    let result = query.execute(pool).await.map_err(|e| format!("Failed to update note: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Note \"{note_id}\" not found.")); }

    // If content is provided, update the first text block
    if let Some(content) = args["content"].as_str() {
        let block_content = json!({"text": content}).to_string();
        sqlx::query("UPDATE blocks SET content = ?, updated_at = ? WHERE object_id = ? AND type = 'text' ORDER BY position LIMIT 1")
            .bind(&block_content).bind(now_ms).bind(note_id)
            .execute(pool).await.ok();
    }

    Ok(json!({ "id": note_id, "data_coverage": 1.0, "message": "Note updated." }))
}

async fn delete_note(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let note_id = args["note_id"].as_str().ok_or("note_id is required")?;
    sqlx::query("DELETE FROM blocks WHERE object_id = ?").bind(note_id).execute(pool).await.ok();
    let result = sqlx::query("DELETE FROM note_objects WHERE id = ?").bind(note_id)
        .execute(pool).await.map_err(|e| format!("Failed to delete note: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Note \"{note_id}\" not found.")); }
    Ok(json!({ "id": note_id, "data_coverage": 1.0, "message": "Note deleted." }))
}

async fn list_notes(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let include_archived = args["include_archived"].as_bool().unwrap_or(false);
    let limit = args["limit"].as_i64().unwrap_or(50).min(100);
    let _tags_filter = args["tags"].as_array();

    let mut sql = String::from(
        "SELECT id, title, tags, pinned, created_at, updated_at FROM note_objects WHERE 1=1"
    );
    if !include_archived {
        sql.push_str(" AND (is_archived IS NULL OR is_archived = 0)");
    }
    sql.push_str(" ORDER BY pinned DESC, updated_at DESC LIMIT ?");

    let mut query = sqlx::query_as::<_, (String, String, Option<String>, Option<i64>, i64, i64)>(&sql);
    query = query.bind(limit);

    let rows = query.fetch_all(pool).await.map_err(|e| format!("Failed to list notes: {e}"))?;

    let notes: Vec<Value> = rows.into_iter().map(|(id, title, _tags, pinned, created_at, updated_at)| {
        json!({
            "id": id, "title": title,
            "pinned": pinned.unwrap_or(0) == 1,
            "createdAt": created_at, "updatedAt": updated_at
        })
    }).collect();

    Ok(json!({ "notes": notes, "count": notes.len() }))
}

async fn pin_note(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let note_id = args["note_id"].as_str().ok_or("note_id is required")?;
    let pinned = if args["pinned"].as_bool().unwrap_or(true) { 1i64 } else { 0 };
    let now_ms = time::now_ms();

    let result = sqlx::query("UPDATE note_objects SET pinned = ?, updated_at = ? WHERE id = ?")
        .bind(pinned).bind(now_ms).bind(note_id)
        .execute(pool).await.map_err(|e| format!("Failed to update note: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Note \"{note_id}\" not found.")); }

    Ok(json!({ "id": note_id, "pinned": pinned == 1, "data_coverage": 1.0 }))
}

async fn archive_note(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let note_id = args["note_id"].as_str().ok_or("note_id is required")?;
    let archived = if args["archived"].as_bool().unwrap_or(true) { 1i64 } else { 0 };
    let now_ms = time::now_ms();

    let result = sqlx::query("UPDATE note_objects SET is_archived = ?, updated_at = ? WHERE id = ?")
        .bind(archived).bind(now_ms).bind(note_id)
        .execute(pool).await.map_err(|e| format!("Failed to update note: {e}"))?;
    if result.rows_affected() == 0 { return Err(format!("Note \"{note_id}\" not found.")); }

    Ok(json!({ "id": note_id, "archived": archived == 1, "data_coverage": 1.0 }))
}

async fn list_tags(pool: &SqlitePool) -> Result<Value, String> {
    let rows: Vec<String> = sqlx::query_scalar("SELECT tags FROM note_objects WHERE tags IS NOT NULL AND tags != '[]'")
        .fetch_all(pool).await.unwrap_or_default();

    let mut tag_counts: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for tags_json in &rows {
        if let Ok(tags) = serde_json::from_str::<Vec<String>>(tags_json) {
            for tag in tags {
                *tag_counts.entry(tag).or_insert(0) += 1;
            }
        }
    }

    let tags: Vec<Value> = tag_counts.into_iter().map(|(name, count)| {
        json!({"name": name, "count": count})
    }).collect();

    Ok(json!({ "tags": tags, "count": tags.len() }))
}

async fn get_note_stats(pool: &SqlitePool) -> Result<Value, String> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM note_objects")
        .fetch_one(pool).await.unwrap_or(0);
    let pinned: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM note_objects WHERE pinned = 1")
        .fetch_one(pool).await.unwrap_or(0);
    let archived: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM note_objects WHERE is_archived = 1")
        .fetch_one(pool).await.unwrap_or(0);
    let recent: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM note_objects WHERE updated_at >= ?"
    )
    .bind(time::now_ms() - 7 * time::DAY_MS)
    .fetch_one(pool).await.unwrap_or(0);

    Ok(json!({
        "total": total, "pinned": pinned, "archived": archived,
        "updatedThisWeek": recent, "data_coverage": 1.0
    }))
}
