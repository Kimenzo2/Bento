// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "get_journal_entry".into(),
            description: "Get a specific journal entry by date (YYYY-MM-DD) or by ID. Returns the entry with content blocks.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "entry_id": {"type": "string", "description": "Entry ID (alternative to date)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "save_journal_entry".into(),
            description: "Save or update a journal entry. Provide content as an array of text blocks. Optionally set mood and weather.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format (required)"},
                    "content": {"type": "string", "description": "Journal content text (required)"},
                    "mood": {"type": "string", "description": "Optional mood for the day"},
                    "weather": {"type": "string", "description": "Optional weather description"}
                },
                "required": ["date", "content"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_journal_entries".into(),
            description: "List recent journal entries with dates, mood, and word count.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results (default 30, max 365)"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_journal_entry".into(),
            description: "Delete a journal entry by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "entry_id": {"type": "string", "description": "The unique ID of the journal entry to delete"}
                },
                "required": ["entry_id"]
            }),
            auto_execute: false,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "get_journal_entry" => Ok(Some(get_journal_entry(args, pool).await?)),
        "save_journal_entry" => Ok(Some(save_journal_entry(args, pool).await?)),
        "list_journal_entries" => Ok(Some(list_journal_entries(args, pool).await?)),
        "delete_journal_entry" => Ok(Some(delete_journal_entry(args, pool).await?)),
        _ => Ok(None),
    }
}

async fn get_journal_entry(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let entry = if let Some(date) = args["date"].as_str() {
        sqlx::query_as::<_, (String, String, String, i64, Option<String>, Option<String>)>(
            "SELECT id, date, blocks, word_count, mood, weather FROM journal_entries WHERE date = ?"
        )
        .bind(date)
        .fetch_optional(pool).await
    } else if let Some(entry_id) = args["entry_id"].as_str() {
        sqlx::query_as::<_, (String, String, String, i64, Option<String>, Option<String>)>(
            "SELECT id, date, blocks, word_count, mood, weather FROM journal_entries WHERE id = ?"
        )
        .bind(entry_id)
        .fetch_optional(pool).await
    } else {
        return Err("Provide either 'date' (YYYY-MM-DD) or 'entry_id'.".to_string());
    }.map_err(|e| format!("DB error: {e}"))?;

    match entry {
        Some((id, date, blocks, word_count, mood, weather)) => {
            let blocks_val: Vec<Value> = serde_json::from_str::<Vec<Value>>(&blocks).unwrap_or_default();
            Ok(json!({
                "id": id, "date": date, "blocks": blocks_val,
                "wordCount": word_count, "mood": mood, "weather": weather,
                "data_coverage": 1.0
            }))
        }
        None => Ok(json!({ "data_coverage": 0.0, "message": "No journal entry found for this date." })),
    }
}

async fn save_journal_entry(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let date = args["date"].as_str().ok_or("date is required")?;
    let content = args["content"].as_str().ok_or("content is required")?;
    let mood = args["mood"].as_str();
    let weather = args["weather"].as_str();
    let now_ms = time::now_ms();

    let word_count = content.split_whitespace().count() as i64;
    let blocks = json!([{"type": "text", "content": content}]).to_string();

    let existing: Option<String> = sqlx::query_scalar("SELECT id FROM journal_entries WHERE date = ?")
        .bind(date).fetch_optional(pool).await.map_err(|e| format!("DB error: {e}"))?;

    if let Some(entry_id) = existing {
        sqlx::query(
            "UPDATE journal_entries SET blocks = ?, word_count = ?, mood = ?, weather = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&blocks).bind(word_count).bind(mood).bind(weather).bind(now_ms).bind(&entry_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to update journal: {e}"))?;

        Ok(json!({ "id": entry_id, "date": date, "data_coverage": 1.0, "message": "Journal entry updated." }))
    } else {
        let entry_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO journal_entries (id, date, blocks, word_count, mood, weather, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&entry_id).bind(date).bind(&blocks).bind(word_count).bind(mood).bind(weather).bind(now_ms).bind(now_ms)
        .execute(pool).await
        .map_err(|e| format!("Failed to save journal: {e}"))?;

        Ok(json!({ "id": entry_id, "date": date, "data_coverage": 1.0, "message": "Journal entry saved." }))
    }
}

async fn list_journal_entries(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let limit = args["limit"].as_i64().unwrap_or(30).min(365);

    let rows = sqlx::query_as::<_, (String, String, i64, Option<String>)>(
        "SELECT id, date, word_count, mood FROM journal_entries ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let entries: Vec<Value> = rows.into_iter().map(|(id, date, words, mood)| {
        json!({"id": id, "date": date, "wordCount": words, "mood": mood})
    }).collect();

    Ok(json!({ "entries": entries, "count": entries.len() }))
}

async fn delete_journal_entry(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let entry_id = args["entry_id"].as_str().ok_or("entry_id is required")?;
    let result = sqlx::query("DELETE FROM journal_entries WHERE id = ?")
        .bind(entry_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete entry: {e}"))?;
    if result.rows_affected() == 0 {
        return Err(format!("Journal entry \"{entry_id}\" not found."));
    }
    Ok(json!({ "id": entry_id, "data_coverage": 1.0, "message": "Journal entry deleted." }))
}
