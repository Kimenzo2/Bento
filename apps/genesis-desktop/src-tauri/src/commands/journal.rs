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
            "weather": entry.weather,
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
    pub weather: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEntryParams {
    pub id: String,
    pub date: String,
    pub blocks: String,
    pub word_count: i32,
    pub mood: Option<String>,
    pub weather: Option<String>,
}

/// Create a new blank journal entry for the given date.
/// Returns the new entry with empty blocks.
#[tauri::command]
pub async fn create_journal_entry(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    date: String,
) -> Result<JournalEntry, String> {
    crate::auth::require_billing_tier(&auth, "journal").await?;

    let db = state.db();
    let now = now_ms();
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO journal_entries (id, date, blocks, word_count, mood, weather, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&date)
    .bind("[]")
    .bind(0)
    .bind(&None::<String>)
    .bind(&None::<String>)
    .bind(now)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    let entry = JournalEntry {
        id,
        date,
        blocks: "[]".to_string(),
        word_count: 0,
        mood: None,
        weather: None,
        created_at: now,
        updated_at: now,
    };

    if let Err(error) = search.index_content(journal_search_document(&entry)).await {
        eprintln!("journal search index update failed: {error}");
    }

    Ok(entry)
}

/// Save (update) a journal entry by ID.
/// If the ID doesn't exist, inserts a new row.
#[tauri::command]
pub async fn save_journal_entry(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    params: SaveEntryParams,
) -> Result<JournalEntry, String> {
    crate::auth::require_billing_tier(&auth, "journal").await?;

    let db = state.db();
    let now = now_ms();

    // Check if the entry exists by ID
    let exists: bool = sqlx::query("SELECT 1 FROM journal_entries WHERE id = ?")
        .bind(&params.id)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string())?
        .is_some();

    if exists {
        sqlx::query(
            "UPDATE journal_entries SET blocks = ?, word_count = ?, mood = ?, weather = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&params.blocks)
        .bind(params.word_count)
        .bind(&params.mood)
        .bind(&params.weather)
        .bind(now)
        .bind(&params.id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    } else {
        // Insert a new row (shouldn't normally happen — use create_journal_entry instead)
        sqlx::query(
            "INSERT INTO journal_entries (id, date, blocks, word_count, mood, weather, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&params.id)            .bind(&params.date)
            .bind(&params.blocks)
        .bind(params.word_count)
        .bind(&params.mood)
        .bind(&params.weather)
        .bind(now)
        .bind(now)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Fetch the full row to return accurate data (including date, created_at)
    let row = sqlx::query(
        "SELECT id, date, blocks, word_count, mood, weather, created_at, updated_at FROM journal_entries WHERE id = ?",
    )
    .bind(&params.id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Entry not found after save".to_string())?;

    let entry = JournalEntry {
        id: row.try_get("id").unwrap_or_default(),
        date: row.try_get("date").unwrap_or_default(),
        blocks: row.try_get("blocks").unwrap_or_else(|_| "[]".to_string()),
        word_count: row.try_get("word_count").unwrap_or(0),
        mood: row.try_get("mood").ok().flatten(),
        weather: row.try_get("weather").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or(0),
        updated_at: row.try_get("updated_at").unwrap_or(0),
    };

    if let Err(error) = search.index_content(journal_search_document(&entry)).await {
        eprintln!("journal search index update failed: {error}");
    }

    Ok(entry)
}

/// Get a journal entry by its ID.
#[tauri::command]
pub async fn get_journal_entry(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<Option<JournalEntry>, String> {
    crate::auth::require_billing_tier(&auth, "journal").await?;

    let db = state.db();

    let row = sqlx::query(
        "SELECT id, date, blocks, word_count, mood, weather, created_at, updated_at FROM journal_entries WHERE id = ?",
    )
    .bind(&id)
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
            weather: r.try_get("weather").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })),
        None => Ok(None),
    }
}

/// Delete a journal entry by ID.
#[tauri::command]
pub async fn delete_journal_entry(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "journal").await?;

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

/// List recent journal entries (newest first, by created_at).
#[tauri::command]
pub async fn list_journal_entries(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    limit: Option<i32>,
) -> Result<Vec<JournalEntry>, String> {
    crate::auth::require_billing_tier(&auth, "journal").await?;

    let db = state.db();
    let limit = limit.unwrap_or(30).clamp(1, 365);

    let rows = sqlx::query(
        "SELECT id, date, blocks, word_count, mood, weather, created_at, updated_at FROM journal_entries ORDER BY created_at DESC LIMIT ?",
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
            weather: r.try_get("weather").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or(0),
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })
        .collect();

    Ok(entries)
}
