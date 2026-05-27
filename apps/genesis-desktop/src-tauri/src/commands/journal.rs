use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::search::{SearchDocument, SearchService};

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn journal_search_document(entry: &JournalEntry) -> SearchDocument {
    SearchDocument {
        module_id: "journal".to_string(),
        id: entry.id.clone(),
        title: entry.date.clone(),
        body: entry.blocks.clone(),
        tags: entry
            .mood
            .iter()
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty())
            .collect(),
        projects: vec![],
        kind: Some("journal-entry".to_string()),
        created_at: Some(entry.created_at),
        updated_at: Some(entry.updated_at),
        source_ref: Some(entry.date.clone()),
        extra: serde_json::json!({
            "wordCount": entry.word_count,
            "mood": entry.mood,
        }),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: String,
    pub date: String,
    pub blocks: String, // JSON array of Block objects
    pub word_count: i32,
    pub mood: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveEntryParams {
    pub date: String,
    pub blocks: String,
    pub word_count: i32,
    pub mood: Option<String>,
}

/// Save (upsert) a journal entry for a given date.
/// If an entry for that date already exists, it is replaced.
#[tauri::command]
pub async fn save_journal_entry(
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    params: SaveEntryParams,
) -> Result<JournalEntry, String> {
    let db = state.db();
    let now = now_ms();
    let id = Uuid::new_v4().to_string();

    // Check if an entry already exists for this date
    let existing: Option<String> = sqlx::query("SELECT id FROM journal_entries WHERE date = ?")
        .bind(&params.date)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?
        .map(|row| row.try_get("id").unwrap_or_default());

    match existing {
        Some(existing_id) => {
            // Update existing entry
            sqlx::query(
                "UPDATE journal_entries SET blocks = ?, word_count = ?, mood = ?, updated_at = ? WHERE id = ?",
            )
            .bind(&params.blocks)
            .bind(params.word_count)
            .bind(&params.mood)
            .bind(now)
            .bind(&existing_id)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;

            let entry = JournalEntry {
                id: existing_id,
                date: params.date,
                blocks: params.blocks,
                word_count: params.word_count,
                mood: params.mood,
                created_at: now,
                updated_at: now,
            };

            if let Err(error) = search.index_content(journal_search_document(&entry)).await {
                eprintln!("journal search index update failed: {error}");
            }

            Ok(entry)
        }
        None => {
            // Insert new entry
            sqlx::query(
                "INSERT INTO journal_entries (id, date, blocks, word_count, mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(&params.date)
            .bind(&params.blocks)
            .bind(params.word_count)
            .bind(&params.mood)
            .bind(now)
            .bind(now)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;

            let entry = JournalEntry {
                id,
                date: params.date,
                blocks: params.blocks,
                word_count: params.word_count,
                mood: params.mood,
                created_at: now,
                updated_at: now,
            };

            if let Err(error) = search.index_content(journal_search_document(&entry)).await {
                eprintln!("journal search index update failed: {error}");
            }

            Ok(entry)
        }
    }
}

/// Get today's journal entry (or any date in 'YYYY-MM-DD' format).
#[tauri::command]
pub async fn get_journal_entry(
    state: State<'_, BentoAppState>,
    date: String,
) -> Result<Option<JournalEntry>, String> {
    let db = state.db();

    let row = sqlx::query(
        "SELECT id, date, blocks, word_count, mood, created_at, updated_at FROM journal_entries WHERE date = ?",
    )
    .bind(&date)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some(r) => Ok(Some(JournalEntry {
            id: r.try_get("id").unwrap_or_default(),
            date: r.try_get("date").unwrap_or_default(),
            blocks: r.try_get("blocks").unwrap_or_else(|_| "[]".to_string()),
            word_count: r.try_get("word_count").unwrap_or(0),
            mood: r.try_get("mood").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })),
        None => Ok(None),
    }
}

/// Delete a journal entry by ID.
#[tauri::command]
pub async fn delete_journal_entry(
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    id: String,
) -> Result<(), String> {
    let db = state.db();
    sqlx::query("DELETE FROM journal_entries WHERE id = ?")
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    if let Err(error) = search.delete_from_index("journal".to_string(), id).await {
        eprintln!("journal search delete failed: {error}");
    }
    Ok(())
}

/// List recent journal entries (newest first).
#[tauri::command]
pub async fn list_journal_entries(
    state: State<'_, BentoAppState>,
    limit: Option<i32>,
) -> Result<Vec<JournalEntry>, String> {
    let db = state.db();
    let limit = limit.unwrap_or(30).max(1).min(365);

    let rows = sqlx::query(
        "SELECT id, date, blocks, word_count, mood, created_at, updated_at FROM journal_entries ORDER BY date DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let entries: Vec<JournalEntry> = rows
        .into_iter()
        .map(|r| JournalEntry {
            id: r.try_get("id").unwrap_or_default(),
            date: r.try_get("date").unwrap_or_default(),
            blocks: r.try_get("blocks").unwrap_or_else(|_| "[]".to_string()),
            word_count: r.try_get("word_count").unwrap_or(0),
            mood: r.try_get("mood").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })
        .collect();

    Ok(entries)
}
