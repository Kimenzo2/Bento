use std::{
    collections::BTreeMap,
    io::{Cursor, Read, Seek},
    path::Path,
};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use chrono::Utc;
use lopdf::Document as PdfDocument;
use mobi::Mobi;
use roxmltree::Document as XmlDocument;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;
use zip::ZipArchive;

use crate::{
    crypto::CryptoService,
    search::{SearchDocument, SearchService},
};

const DISCOVERY_CACHE_TTL_MS: i64 = 60 * 60 * 1000;
const DISCOVERY_DETAIL_TTL_MS: i64 = 24 * 60 * 60 * 1000;
const DEFAULT_LIBRARY_LIMIT: i64 = 250;
const DEFAULT_DISCOVER_LIMIT: usize = 24;

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

fn normalize_text(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn string_or_empty(value: Option<String>) -> String {
    value
        .map(|text| normalize_text(&text))
        .unwrap_or_default()
}

fn json_vec<T: Serialize>(values: &[T]) -> String {
    serde_json::to_string(values).unwrap_or_else(|_| "[]".to_string())
}

fn parse_json_vec<T: for<'de> Deserialize<'de>>(value: Option<String>) -> Vec<T> {
    value
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn parse_string_vec(value: Option<String>) -> Vec<String> {
    parse_json_vec(value)
}

fn book_progress(current_page: i64, page_count: i64) -> f64 {
    if page_count <= 0 {
        return 0.0;
    }
    let current = current_page.clamp(0, page_count.saturating_sub(1));
    (current as f64 / page_count as f64) * 100.0
}

fn strip_html_tags(source: &str) -> String {
    let mut result = String::with_capacity(source.len());
    let mut in_tag = false;
    for ch in source.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    normalize_text(&result)
}

fn guess_title_from_filename(name: &str) -> String {
    let stem = Path::new(name)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string());
    let mut out = String::with_capacity(stem.len());
    let mut capitalize = true;
    for ch in stem.chars() {
        if matches!(ch, '_' | '-' | '.' | '(' | ')' | '[' | ']') {
            out.push(' ');
            capitalize = true;
            continue;
        }
        if capitalize {
            out.extend(ch.to_uppercase());
            capitalize = false;
        } else {
            out.push(ch);
        }
    }
    normalize_text(&out)
}

fn guess_author_from_filename(name: &str) -> String {
    let stem = Path::new(name)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string());
    let lower = stem.to_lowercase();
    for marker in [" - ", "_", "--"] {
        if let Some(idx) = lower.find(marker) {
            return normalize_text(&stem[..idx]);
        }
    }
    String::new()
}

fn count_words(text: &str) -> i64 {
    text.split_whitespace().count() as i64
}

fn chunk_text(text: &str, target_chars: usize) -> Vec<String> {
    let mut pages = Vec::new();
    let mut current = String::new();

    for paragraph in text
        .split("\n\n")
        .map(normalize_text)
        .filter(|value| !value.is_empty())
    {
        if !current.is_empty() && current.len() + paragraph.len() + 2 > target_chars {
            pages.push(current.trim().to_string());
            current.clear();
        }
        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(&paragraph);
    }

    if !current.trim().is_empty() {
        pages.push(current.trim().to_string());
    }

    if pages.is_empty() && !text.trim().is_empty() {
        pages.push(normalize_text(text));
    }

    pages
}

fn title_case(value: &str) -> String {
    value
        .split_whitespace()
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => {
                    let mut out = String::new();
                    out.extend(first.to_uppercase());
                    out.push_str(chars.as_str().to_lowercase().as_str());
                    out
                }
                None => String::new(),
            }
        })
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn file_extension(name: &str) -> String {
    Path::new(name)
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn cache_key(parts: &[&str]) -> String {
    parts.join("::")
}

async fn ensure_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_books (
            id               TEXT PRIMARY KEY,
            title            TEXT NOT NULL,
            author           TEXT NOT NULL DEFAULT '',
            subtitle         TEXT NOT NULL DEFAULT '',
            description      TEXT NOT NULL DEFAULT '',
            source           TEXT NOT NULL DEFAULT 'local',
            source_ref       TEXT NOT NULL DEFAULT '',
            format           TEXT NOT NULL DEFAULT '',
            language         TEXT NOT NULL DEFAULT '',
            isbn             TEXT NOT NULL DEFAULT '',
            publisher        TEXT NOT NULL DEFAULT '',
            published_at     TEXT NOT NULL DEFAULT '',
            cover_url        TEXT NOT NULL DEFAULT '',
            status           TEXT NOT NULL DEFAULT 'unread',
            tags             TEXT NOT NULL DEFAULT '[]',
            genres           TEXT NOT NULL DEFAULT '[]',
            collection_ids   TEXT NOT NULL DEFAULT '[]',
            page_count       INTEGER NOT NULL DEFAULT 0,
            current_page     INTEGER NOT NULL DEFAULT 0,
            progress_percent REAL NOT NULL DEFAULT 0,
            word_count       INTEGER NOT NULL DEFAULT 0,
            content_text     TEXT NOT NULL DEFAULT '',
            page_texts       TEXT NOT NULL DEFAULT '[]',
            toc_json         TEXT NOT NULL DEFAULT '[]',
            file_name        TEXT NOT NULL DEFAULT '',
            file_size        INTEGER NOT NULL DEFAULT 0,
            public_domain    INTEGER NOT NULL DEFAULT 0,
            added_at         INTEGER NOT NULL,
            updated_at       INTEGER NOT NULL,
            last_opened_at   INTEGER
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_collections (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            color       TEXT NOT NULL DEFAULT '',
            icon        TEXT NOT NULL DEFAULT '',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_bookmarks (
            id            TEXT PRIMARY KEY,
            book_id       TEXT NOT NULL,
            page_number   INTEGER NOT NULL DEFAULT 0,
            position      INTEGER NOT NULL DEFAULT 0,
            label         TEXT NOT NULL DEFAULT '',
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_highlights (
            id            TEXT PRIMARY KEY,
            book_id       TEXT NOT NULL,
            page_number   INTEGER NOT NULL DEFAULT 0,
            start_offset  INTEGER NOT NULL DEFAULT 0,
            end_offset    INTEGER NOT NULL DEFAULT 0,
            quote         TEXT NOT NULL DEFAULT '',
            note          TEXT NOT NULL DEFAULT '',
            color         TEXT NOT NULL DEFAULT '',
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_notes (
            id            TEXT PRIMARY KEY,
            book_id       TEXT NOT NULL,
            page_number   INTEGER NOT NULL DEFAULT 0,
            title         TEXT NOT NULL DEFAULT '',
            body          TEXT NOT NULL DEFAULT '',
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_sessions (
            id            TEXT PRIMARY KEY,
            book_id       TEXT NOT NULL,
            start_page    INTEGER NOT NULL DEFAULT 0,
            end_page      INTEGER NOT NULL DEFAULT 0,
            started_at    INTEGER NOT NULL,
            ended_at      INTEGER,
            duration_ms   INTEGER NOT NULL DEFAULT 0,
            pages_read    INTEGER NOT NULL DEFAULT 0,
            notes         TEXT NOT NULL DEFAULT ''
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reading_discovery_cache (
            cache_key     TEXT PRIMARY KEY,
            source        TEXT NOT NULL,
            payload       TEXT NOT NULL,
            cached_at     INTEGER NOT NULL,
            expires_at    INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reading_books_updated ON reading_books(updated_at DESC)")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reading_books_title ON reading_books(title)")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id)")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reading_notes_book_id ON reading_notes(book_id)")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reading_highlights_book_id ON reading_highlights(book_id)")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reading_bookmarks_book_id ON reading_bookmarks(book_id)")
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(())
}

async fn cache_get(pool: &sqlx::SqlitePool, key: &str) -> Result<Option<String>, String> {
    let row = sqlx::query("SELECT payload, expires_at FROM reading_discovery_cache WHERE cache_key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return Ok(None);
    };

    let payload: String = row.try_get("payload").unwrap_or_default();
    let expires_at: i64 = row.try_get("expires_at").unwrap_or_default();
    if expires_at <= now_ms() {
        let _ = sqlx::query("DELETE FROM reading_discovery_cache WHERE cache_key = ?")
            .bind(key)
            .execute(pool)
            .await;
        return Ok(None);
    }

    Ok(Some(payload))
}

async fn cache_set(
    pool: &sqlx::SqlitePool,
    key: &str,
    source: &str,
    payload: &str,
    ttl_ms: i64,
) -> Result<(), String> {
    let now = now_ms();
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO reading_discovery_cache
            (cache_key, source, payload, cached_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(key)
    .bind(source)
    .bind(payload)
    .bind(now)
    .bind(now + ttl_ms)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingTocItem {
    pub id: String,
    pub title: String,
    pub level: i64,
    pub page: i64,
    pub anchor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingBookmark {
    pub id: String,
    pub book_id: String,
    pub page_number: i64,
    pub position: i64,
    pub label: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingHighlight {
    pub id: String,
    pub book_id: String,
    pub page_number: i64,
    pub start_offset: i64,
    pub end_offset: i64,
    pub quote: String,
    pub note: String,
    pub color: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingNote {
    pub id: String,
    pub book_id: String,
    pub page_number: i64,
    pub title: String,
    pub body: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSession {
    pub id: String,
    pub book_id: String,
    pub start_page: i64,
    pub end_page: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_ms: i64,
    pub pages_read: i64,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingCollection {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingBookSummary {
    pub id: String,
    pub title: String,
    pub author: String,
    pub subtitle: String,
    pub description: String,
    pub source: String,
    pub source_ref: String,
    pub format: String,
    pub language: String,
    pub isbn: String,
    pub publisher: String,
    pub published_at: String,
    pub cover_url: String,
    pub status: String,
    pub tags: Vec<String>,
    pub genres: Vec<String>,
    pub collection_ids: Vec<String>,
    pub page_count: i64,
    pub current_page: i64,
    pub progress_percent: f64,
    pub word_count: i64,
    pub file_name: String,
    pub file_size: i64,
    pub public_domain: bool,
    pub added_at: i64,
    pub updated_at: i64,
    pub last_opened_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingBookDetail {
    #[serde(flatten)]
    pub book: ReadingBookSummary,
    pub content_text: String,
    pub page_texts: Vec<String>,
    pub toc: Vec<ReadingTocItem>,
    pub bookmarks: Vec<ReadingBookmark>,
    pub highlights: Vec<ReadingHighlight>,
    pub notes: Vec<ReadingNote>,
    pub sessions: Vec<ReadingSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingBookDraft {
    pub id: Option<String>,
    pub title: String,
    pub author: String,
    pub subtitle: String,
    pub description: String,
    pub source: String,
    pub source_ref: String,
    pub format: String,
    pub language: String,
    pub isbn: String,
    pub publisher: String,
    pub published_at: String,
    pub cover_url: String,
    pub status: String,
    pub tags: Vec<String>,
    pub genres: Vec<String>,
    pub collection_ids: Vec<String>,
    pub page_count: i64,
    pub current_page: i64,
    pub word_count: i64,
    pub content_text: String,
    pub page_texts: Vec<String>,
    pub toc: Vec<ReadingTocItem>,
    pub file_name: String,
    pub file_size: i64,
    pub public_domain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingListQuery {
    pub search: Option<String>,
    pub author: Option<String>,
    pub genre: Option<String>,
    pub tag: Option<String>,
    pub collection_id: Option<String>,
    pub status: Option<String>,
    pub source: Option<String>,
    pub sort: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingProgressUpdate {
    pub book_id: String,
    pub current_page: i64,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingCollectionInput {
    pub id: Option<String>,
    pub name: String,
    pub color: String,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingBookmarkInput {
    pub book_id: String,
    pub page_number: i64,
    pub position: i64,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingHighlightInput {
    pub book_id: String,
    pub page_number: i64,
    pub start_offset: i64,
    pub end_offset: i64,
    pub quote: String,
    pub note: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingNoteInput {
    pub book_id: String,
    pub page_number: i64,
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSessionStartInput {
    pub book_id: String,
    pub start_page: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSessionEndInput {
    pub session_id: String,
    pub end_page: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingImportInput {
    pub name: String,
    pub relative_path: String,
    pub mime: String,
    pub data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingImportResult {
    pub books: Vec<ReadingBookSummary>,
    pub failed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingDiscoverSource {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingDiscoverFormat {
    pub label: String,
    pub mime: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingDiscoverBookSummary {
    pub source: String,
    pub source_ref: String,
    pub id: String,
    pub title: String,
    pub author: String,
    pub category: String,
    pub language: String,
    pub image_url: String,
    pub description: String,
    pub tags: Vec<String>,
    pub download_url: Option<String>,
    pub public_domain: bool,
    pub year: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingDiscoverBookDetail {
    #[serde(flatten)]
    pub summary: ReadingDiscoverBookSummary,
    pub summary_text: String,
    pub subjects: Vec<String>,
    pub authors: Vec<String>,
    pub formats: Vec<ReadingDiscoverFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingDiscoverSearchResult {
    pub source: String,
    pub query: String,
    pub cached_at: i64,
    pub items: Vec<ReadingDiscoverBookSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingDiscoverCategory {
    pub id: String,
    pub name: String,
    pub source: String,
    pub query: String,
}

fn reading_search_document(book: &ReadingBookSummary) -> SearchDocument {
    SearchDocument {
        module_id: "reading".to_string(),
        id: book.id.clone(),
        title: book.title.clone(),
        body: format!(
            "{}\n{}\n{}\n{}\n{}",
            book.title,
            book.author,
            book.description,
            book.tags.join(" "),
            book.genres.join(" ")
        ),
        tags: book
            .tags
            .iter()
            .chain(book.genres.iter())
            .map(|value| value.to_lowercase())
            .collect(),
        projects: book.collection_ids.clone(),
        kind: Some(book.status.clone()),
        created_at: Some(book.added_at),
        updated_at: Some(book.updated_at),
        source_ref: Some(book.source_ref.clone()),
        extra: serde_json::json!({
            "author": book.author,
            "progress": book.progress_percent,
            "source": book.source,
            "format": book.format,
            "pageCount": book.page_count,
        }),
    }
}

fn row_to_book_summary(row: &sqlx::sqlite::SqliteRow) -> ReadingBookSummary {
    ReadingBookSummary {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        author: row.try_get("author").unwrap_or_default(),
        subtitle: row.try_get("subtitle").unwrap_or_default(),
        description: row.try_get("description").unwrap_or_default(),
        source: row.try_get("source").unwrap_or_default(),
        source_ref: row.try_get("source_ref").unwrap_or_default(),
        format: row.try_get("format").unwrap_or_default(),
        language: row.try_get("language").unwrap_or_default(),
        isbn: row.try_get("isbn").unwrap_or_default(),
        publisher: row.try_get("publisher").unwrap_or_default(),
        published_at: row.try_get("published_at").unwrap_or_default(),
        cover_url: row.try_get("cover_url").unwrap_or_default(),
        status: row.try_get("status").unwrap_or_default(),
        tags: parse_string_vec(row.try_get("tags").ok()),
        genres: parse_string_vec(row.try_get("genres").ok()),
        collection_ids: parse_string_vec(row.try_get("collection_ids").ok()),
        page_count: row.try_get("page_count").unwrap_or(0),
        current_page: row.try_get("current_page").unwrap_or(0),
        progress_percent: row.try_get("progress_percent").unwrap_or(0.0),
        word_count: row.try_get("word_count").unwrap_or(0),
        file_name: row.try_get("file_name").unwrap_or_default(),
        file_size: row.try_get("file_size").unwrap_or(0),
        public_domain: row.try_get::<i64, _>("public_domain").unwrap_or(0) == 1,
        added_at: row.try_get("added_at").unwrap_or(0),
        updated_at: row.try_get("updated_at").unwrap_or(0),
        last_opened_at: row.try_get("last_opened_at").ok().flatten(),
    }
}

async fn load_book_detail(pool: &sqlx::SqlitePool, book_id: &str) -> Result<Option<ReadingBookDetail>, String> {
    let row = sqlx::query("SELECT * FROM reading_books WHERE id = ?")
        .bind(book_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return Ok(None);
    };

    let summary = row_to_book_summary(&row);
    let bookmarks = load_bookmarks(pool, book_id).await?;
    let highlights = load_highlights(pool, book_id).await?;
    let notes = load_notes(pool, book_id).await?;
    let sessions = load_sessions(pool, Some(book_id)).await?;
    let page_texts = parse_json_vec(row.try_get("page_texts").ok());
    let toc = parse_json_vec(row.try_get("toc_json").ok());
    let content_text = row.try_get("content_text").unwrap_or_default();

    Ok(Some(ReadingBookDetail {
        book: summary,
        content_text,
        page_texts,
        toc,
        bookmarks,
        highlights,
        notes,
        sessions,
    }))
}

async fn save_book_internal(
    pool: &sqlx::SqlitePool,
    search: &SearchService,
    draft: ReadingBookDraft,
) -> Result<ReadingBookSummary, String> {
    ensure_tables(pool).await?;

    if draft.title.trim().is_empty() {
        return Err("Book title is required.".to_string());
    }

    let now = now_ms();
    let id = draft.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing_added_at: Option<i64> = sqlx::query("SELECT added_at FROM reading_books WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?
        .and_then(|row| row.try_get("added_at").ok());

    let added_at = existing_added_at.unwrap_or(now);
    let page_count = if draft.page_count > 0 {
        draft.page_count
    } else {
        draft.page_texts.len() as i64
    };
    let current_page = draft.current_page.clamp(0, page_count.saturating_sub(1).max(0));
    let progress_percent = book_progress(current_page, page_count);
    let content_text = normalize_text(&draft.content_text);
    let content_text = if content_text.is_empty() {
        draft.page_texts.join("\n\n")
    } else {
        content_text
    };
    let word_count = if draft.word_count > 0 {
        draft.word_count
    } else {
        count_words(&content_text)
    };

    sqlx::query(
        r#"
        INSERT INTO reading_books
            (id, title, author, subtitle, description, source, source_ref, format,
             language, isbn, publisher, published_at, cover_url, status, tags, genres,
             collection_ids, page_count, current_page, progress_percent, word_count,
             content_text, page_texts, toc_json, file_name, file_size, public_domain,
             added_at, updated_at, last_opened_at)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            subtitle = excluded.subtitle,
            description = excluded.description,
            source = excluded.source,
            source_ref = excluded.source_ref,
            format = excluded.format,
            language = excluded.language,
            isbn = excluded.isbn,
            publisher = excluded.publisher,
            published_at = excluded.published_at,
            cover_url = excluded.cover_url,
            status = excluded.status,
            tags = excluded.tags,
            genres = excluded.genres,
            collection_ids = excluded.collection_ids,
            page_count = excluded.page_count,
            current_page = excluded.current_page,
            progress_percent = excluded.progress_percent,
            word_count = excluded.word_count,
            content_text = excluded.content_text,
            page_texts = excluded.page_texts,
            toc_json = excluded.toc_json,
            file_name = excluded.file_name,
            file_size = excluded.file_size,
            public_domain = excluded.public_domain,
            updated_at = excluded.updated_at,
            last_opened_at = excluded.last_opened_at
        "#,
    )
    .bind(&id)
    .bind(&draft.title)
    .bind(&draft.author)
    .bind(&draft.subtitle)
    .bind(&draft.description)
    .bind(&draft.source)
    .bind(&draft.source_ref)
    .bind(&draft.format)
    .bind(&draft.language)
    .bind(&draft.isbn)
    .bind(&draft.publisher)
    .bind(&draft.published_at)
    .bind(&draft.cover_url)
    .bind(&draft.status)
    .bind(json_vec(&draft.tags))
    .bind(json_vec(&draft.genres))
    .bind(json_vec(&draft.collection_ids))
    .bind(page_count)
    .bind(current_page)
    .bind(progress_percent)
    .bind(word_count)
    .bind(&content_text)
    .bind(json_vec(&draft.page_texts))
    .bind(json_vec(&draft.toc))
    .bind(&draft.file_name)
    .bind(draft.file_size)
    .bind(if draft.public_domain { 1i64 } else { 0i64 })
    .bind(added_at)
    .bind(now)
    .bind(Some(now))
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    let summary = load_book_summary(pool, &id).await?.ok_or_else(|| "Saved book could not be loaded.".to_string())?;
    if let Err(error) = search.index_content(reading_search_document(&summary)).await {
        eprintln!("reading search index update failed: {error}");
    }

    Ok(summary)
}

async fn load_book_summary(pool: &sqlx::SqlitePool, book_id: &str) -> Result<Option<ReadingBookSummary>, String> {
    let row = sqlx::query("SELECT * FROM reading_books WHERE id = ?")
        .bind(book_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(row.map(|row| row_to_book_summary(&row)))
}

fn to_toc_items(items: Vec<(String, i64, i64)>) -> Vec<ReadingTocItem> {
    items
        .into_iter()
        .enumerate()
        .map(|(index, (title, level, page))| ReadingTocItem {
            id: Uuid::new_v4().to_string(),
            title,
            level,
            page,
            anchor: format!("toc-{index}"),
        })
        .collect()
}

fn xhtml_text_and_headings(source: &str, start_page: i64) -> (String, Vec<(String, i64, i64)>) {
    let Ok(doc) = XmlDocument::parse(source) else {
        return (strip_html_tags(source), vec![]);
    };

    let mut lines = Vec::new();
    let mut headings = Vec::new();

    for node in doc.descendants() {
        if !node.is_element() {
            continue;
        }
        let name = node.tag_name().name().to_lowercase();
        if matches!(name.as_str(), "h1" | "h2" | "h3" | "p" | "li" | "title") {
            let text = normalize_text(&node.text().unwrap_or_default());
            if text.is_empty() {
                continue;
            }
            if matches!(name.as_str(), "h1" | "h2" | "h3") {
                let level = match name.as_str() {
                    "h1" => 1,
                    "h2" => 2,
                    _ => 3,
                };
                headings.push((text.clone(), level, start_page));
            }
            lines.push(text);
        }
    }

    let text = normalize_text(&lines.join("\n\n"));
    (text, headings)
}

fn opf_base_dir(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}

fn resolve_zip_path(base: &str, relative: &str) -> String {
    let mut parts = Vec::new();
    if !base.is_empty() {
        parts.push(base.trim_matches('/').to_string());
    }
    parts.push(relative.trim_matches('/').to_string());
    parts.join("/")
}

fn unzip_file_to_string<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    path: &str,
) -> Result<String, String> {
    let mut file = archive
        .by_name(path)
        .map_err(|error| format!("Missing ZIP entry {path}: {error}"))?;
    let mut buffer = String::new();
    file.read_to_string(&mut buffer)
        .map_err(|error| error.to_string())?;
    Ok(buffer)
}

fn extract_epub_import(
    name: &str,
    bytes: &[u8],
    source: &str,
    source_ref: &str,
) -> Result<ReadingBookDraft, String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| format!("Invalid EPUB archive: {error}"))?;

    let container = unzip_file_to_string(&mut archive, "META-INF/container.xml")?;
    let container_doc = XmlDocument::parse(&container).map_err(|error| format!("EPUB container parse failed: {error}"))?;
    let rootfile = container_doc
        .descendants()
        .find(|node| node.is_element() && node.tag_name().name() == "rootfile")
        .and_then(|node| node.attribute("full-path"))
        .ok_or_else(|| "EPUB container did not expose a rootfile.".to_string())?;

    let opf_text = unzip_file_to_string(&mut archive, rootfile)?;
    let opf_doc = XmlDocument::parse(&opf_text).map_err(|error| format!("EPUB package parse failed: {error}"))?;

    let mut title = String::new();
    let mut author = String::new();
    let mut subtitle = String::new();
    let mut description = String::new();
    let mut language = String::new();
    let mut publisher = String::new();
    let mut published_at = String::new();
    let mut subjects = Vec::new();
    let mut cover_id = String::new();

    for node in opf_doc.descendants().filter(|node| node.is_element()) {
        let local = node.tag_name().name();
        let text = normalize_text(node.text().unwrap_or_default());
        match local {
            "title" if title.is_empty() => title = text,
            "creator" if author.is_empty() => author = text,
            "language" if language.is_empty() => language = text,
            "description" if description.is_empty() => description = text,
            "publisher" if publisher.is_empty() => publisher = text,
            "date" if published_at.is_empty() => published_at = text,
            "subject" if !text.is_empty() => subjects.push(text),
            "meta" => {
                if node.attribute("name") == Some("cover") {
                    cover_id = node.attribute("content").unwrap_or_default().to_string();
                }
            }
            _ => {}
        }
    }

    let base_dir = opf_base_dir(rootfile);
    let mut manifest: BTreeMap<String, (String, String)> = BTreeMap::new();
    for node in opf_doc.descendants().filter(|node| node.is_element() && node.tag_name().name() == "item") {
        let id = node.attribute("id").unwrap_or_default().to_string();
        let href = node.attribute("href").unwrap_or_default().to_string();
        let media_type = node.attribute("media-type").unwrap_or_default().to_string();
        if !id.is_empty() && !href.is_empty() {
            manifest.insert(id, (href, media_type));
        }
    }

    let mut spine_hrefs = Vec::new();
    for node in opf_doc.descendants().filter(|node| node.is_element() && node.tag_name().name() == "itemref") {
        let idref = node.attribute("idref").unwrap_or_default();
        if let Some((href, _media_type)) = manifest.get(idref) {
            spine_hrefs.push(resolve_zip_path(&base_dir, href));
        }
    }

    if title.is_empty() {
        title = guess_title_from_filename(name);
    }
    if author.is_empty() {
        author = guess_author_from_filename(name);
    }
    if subtitle.is_empty() && !subjects.is_empty() {
        subtitle = subjects.first().cloned().unwrap_or_default();
    }

    let mut toc = Vec::<(String, i64, i64)>::new();
    let mut pages = Vec::<String>::new();

    for (index, href) in spine_hrefs.iter().enumerate() {
        let page_number = index as i64;
        let raw = unzip_file_to_string(&mut archive, href)?;
        let (text, mut headings) = xhtml_text_and_headings(&raw, page_number);
        if !text.trim().is_empty() {
            pages.push(text.clone());
        }
        toc.append(&mut headings);
    }

    if pages.is_empty() {
        let mut fallback_pages = Vec::new();
        for index in 0..archive.len() {
            let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
            let path = file.name().to_string();
            if !path.ends_with(".xhtml") && !path.ends_with(".html") && !path.ends_with(".htm") {
                continue;
            }
            let mut raw = String::new();
            file.read_to_string(&mut raw).map_err(|error| error.to_string())?;
            let text = strip_html_tags(&raw);
            if !text.trim().is_empty() {
                fallback_pages.push(text);
            }
        }
        pages = fallback_pages;
    }

    let content_text = pages.join("\n\n");
    let toc_items = to_toc_items(toc);
    let cover_url = cover_id
        .split_whitespace()
        .next()
        .map(|value| format!("https://covers.openlibrary.org/b/id/{}-L.jpg", value))
        .unwrap_or_default();

    Ok(ReadingBookDraft {
        id: None,
        title,
        author,
        subtitle,
        description,
        source: source.to_string(),
        source_ref: source_ref.to_string(),
        format: "epub".to_string(),
        language,
        isbn: String::new(),
        publisher,
        published_at,
        cover_url,
        status: "unread".to_string(),
        tags: subjects.iter().take(8).cloned().collect(),
        genres: subjects,
        collection_ids: vec![],
        page_count: pages.len() as i64,
        current_page: 0,
        word_count: count_words(&content_text),
        content_text,
        page_texts: pages,
        toc: toc_items,
        file_name: name.to_string(),
        file_size: bytes.len() as i64,
        public_domain: true,
    })
}

fn extract_docx_import(
    name: &str,
    bytes: &[u8],
    source: &str,
    source_ref: &str,
) -> Result<ReadingBookDraft, String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| format!("Invalid DOCX archive: {error}"))?;

    let document_xml = unzip_file_to_string(&mut archive, "word/document.xml")?;
    let document_doc = XmlDocument::parse(&document_xml)
        .map_err(|error| format!("DOCX document parse failed: {error}"))?;

    let mut paragraphs = Vec::new();
    let mut toc = Vec::<(String, i64, i64)>::new();

    for node in document_doc.descendants().filter(|node| node.is_element() && node.tag_name().name() == "p") {
        let mut text_parts = Vec::new();
        let mut heading_level = 0i64;
        for child in node.descendants() {
            if child.is_element() {
                if child.tag_name().name() == "pStyle" {
                    let style = child.attribute("val").or_else(|| child.attribute("w:val")).unwrap_or_default();
                    let style_lower = style.to_lowercase();
                    if style_lower.contains("heading1") || style_lower.contains("heading 1") {
                        heading_level = 1;
                    } else if style_lower.contains("heading2") || style_lower.contains("heading 2") {
                        heading_level = 2;
                    } else if style_lower.contains("heading3") || style_lower.contains("heading 3") {
                        heading_level = 3;
                    }
                }
                if child.tag_name().name() == "t" {
                    let text = normalize_text(child.text().unwrap_or_default());
                    if !text.is_empty() {
                        text_parts.push(text);
                    }
                }
            }
        }
        let paragraph = normalize_text(&text_parts.join(" "));
        if paragraph.is_empty() {
            continue;
        }
        if heading_level > 0 {
            toc.push((paragraph.clone(), heading_level, paragraphs.len() as i64));
        }
        paragraphs.push(paragraph);
    }

    let core_xml = unzip_file_to_string(&mut archive, "docProps/core.xml").unwrap_or_default();
    let core_doc = XmlDocument::parse(&core_xml).ok();

    let mut title = guess_title_from_filename(name);
    let mut author = guess_author_from_filename(name);
    let mut subtitle = String::new();
    let mut description = String::new();
    let mut language = String::new();
    let mut publisher = String::new();
    let mut published_at = String::new();

    if let Some(doc) = core_doc {
        for node in doc.descendants().filter(|node| node.is_element()) {
            let local = node.tag_name().name();
            let text = normalize_text(node.text().unwrap_or_default());
            match local {
                "title" if !text.is_empty() => title = text,
                "creator" if !text.is_empty() => author = text,
                "description" if !text.is_empty() => description = text,
                "language" if !text.is_empty() => language = text,
                "subject" if subtitle.is_empty() && !text.is_empty() => subtitle = text,
                "publisher" if !text.is_empty() => publisher = text,
                "date" if !text.is_empty() => published_at = text,
                _ => {}
            }
        }
    }

    let content_text = paragraphs.join("\n\n");
    let pages = chunk_text(&content_text, 2500);
    let toc_items = to_toc_items(toc);

    Ok(ReadingBookDraft {
        id: None,
        title,
        author,
        subtitle,
        description,
        source: source.to_string(),
        source_ref: source_ref.to_string(),
        format: "docx".to_string(),
        language,
        isbn: String::new(),
        publisher,
        published_at,
        cover_url: String::new(),
        status: "unread".to_string(),
        tags: vec![],
        genres: vec![],
        collection_ids: vec![],
        page_count: pages.len() as i64,
        current_page: 0,
        word_count: count_words(&content_text),
        content_text,
        page_texts: pages,
        toc: toc_items,
        file_name: name.to_string(),
        file_size: bytes.len() as i64,
        public_domain: false,
    })
}

fn extract_pdf_import(
    name: &str,
    bytes: &[u8],
    source: &str,
    source_ref: &str,
) -> Result<ReadingBookDraft, String> {
    let document = PdfDocument::load_mem(bytes).map_err(|error| format!("PDF parse failed: {error}"))?;
    let pages_map = document.get_pages();
    let mut page_numbers = pages_map.keys().cloned().collect::<Vec<u32>>();
    page_numbers.sort_unstable();

    let mut pages = Vec::new();
    for page_number in page_numbers {
        let text = document
            .extract_text(&[page_number])
            .unwrap_or_default();
        let cleaned = normalize_text(&text);
        if !cleaned.is_empty() {
            pages.push(cleaned);
        }
    }

    let content_text = pages.join("\n\n");
    let title = guess_title_from_filename(name);
    let author = guess_author_from_filename(name);

    Ok(ReadingBookDraft {
        id: None,
        title,
        author,
        subtitle: String::new(),
        description: String::new(),
        source: source.to_string(),
        source_ref: source_ref.to_string(),
        format: "pdf".to_string(),
        language: String::new(),
        isbn: String::new(),
        publisher: String::new(),
        published_at: String::new(),
        cover_url: String::new(),
        status: "unread".to_string(),
        tags: vec![],
        genres: vec![],
        collection_ids: vec![],
        page_count: pages.len() as i64,
        current_page: 0,
        word_count: count_words(&content_text),
        content_text,
        page_texts: pages,
        toc: vec![],
        file_name: name.to_string(),
        file_size: bytes.len() as i64,
        public_domain: false,
    })
}

fn extract_mobi_import(
    name: &str,
    bytes: &[u8],
    source: &str,
    source_ref: &str,
) -> Result<ReadingBookDraft, String> {
    let mobi = Mobi::new(bytes.to_vec()).map_err(|error| format!("MOBI parse failed: {error}"))?;
    let title = normalize_text(&mobi.title());
    let author = mobi
        .author()
        .as_deref()
        .map(normalize_text)
        .unwrap_or_else(|| guess_author_from_filename(name));
    let subtitle = mobi.contributor().as_deref().map(normalize_text).unwrap_or_default();
    let description = mobi.description().as_deref().map(normalize_text).unwrap_or_default();
    let isbn = mobi.isbn().as_deref().map(normalize_text).unwrap_or_default();
    let published_at = mobi.publish_date().as_deref().map(normalize_text).unwrap_or_default();
    let publisher = mobi.publisher().as_deref().map(normalize_text).unwrap_or_default();
    let content_text = match mobi.content_as_string() {
        Ok(text) => normalize_text(&text),
        Err(_) => String::new(),
    };
    let pages = chunk_text(&content_text, 2500);
    let toc = pages
        .iter()
        .enumerate()
        .filter_map(|(index, page)| {
            let first_line = page.lines().next().unwrap_or_default().trim();
            if first_line.to_lowercase().starts_with("chapter ") {
                Some((first_line.to_string(), 1, index as i64))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    Ok(ReadingBookDraft {
        id: None,
        title: if title.is_empty() {
            guess_title_from_filename(name)
        } else {
            title
        },
        author,
        subtitle,
        description,
        source: source.to_string(),
        source_ref: source_ref.to_string(),
        format: "mobi".to_string(),
        language: String::new(),
        isbn,
        publisher,
        published_at,
        cover_url: String::new(),
        status: "unread".to_string(),
        tags: vec![],
        genres: vec![],
        collection_ids: vec![],
        page_count: pages.len() as i64,
        current_page: 0,
        word_count: count_words(&content_text),
        content_text,
        page_texts: pages,
        toc: to_toc_items(toc),
        file_name: name.to_string(),
        file_size: bytes.len() as i64,
        public_domain: false,
    })
}

fn extract_plain_text_import(
    name: &str,
    bytes: &[u8],
    source: &str,
    source_ref: &str,
) -> Result<ReadingBookDraft, String> {
    let raw = String::from_utf8_lossy(bytes).to_string();
    let ext = file_extension(name);
    let content_text = if ext == "html" || ext == "htm" || raw.contains("<html") || raw.contains("<body") {
        strip_html_tags(&raw)
    } else {
        normalize_text(&raw)
    };
    let pages = chunk_text(&content_text, 2500);

    Ok(ReadingBookDraft {
        id: None,
        title: guess_title_from_filename(name),
        author: guess_author_from_filename(name),
        subtitle: String::new(),
        description: String::new(),
        source: source.to_string(),
        source_ref: source_ref.to_string(),
        format: ext,
        language: String::new(),
        isbn: String::new(),
        publisher: String::new(),
        published_at: String::new(),
        cover_url: String::new(),
        status: "unread".to_string(),
        tags: vec![],
        genres: vec![],
        collection_ids: vec![],
        page_count: pages.len() as i64,
        current_page: 0,
        word_count: count_words(&content_text),
        content_text,
        page_texts: pages,
        toc: vec![],
        file_name: name.to_string(),
        file_size: bytes.len() as i64,
        public_domain: false,
    })
}

fn parse_import_blob(
    name: &str,
    relative_path: &str,
    mime: &str,
    bytes: &[u8],
) -> Result<ReadingBookDraft, String> {
    let source_ref = if relative_path.trim().is_empty() {
        name.to_string()
    } else {
        relative_path.to_string()
    };
    let source = "local".to_string();
    let extension = file_extension(name);
    let mime_lower = mime.to_lowercase();

    if extension == "pdf" || mime_lower.contains("pdf") {
        return extract_pdf_import(name, bytes, &source, &source_ref);
    }
    if extension == "epub" || mime_lower.contains("epub") {
        return extract_epub_import(name, bytes, &source, &source_ref);
    }
    if extension == "docx" || mime_lower.contains("word") || mime_lower.contains("document") {
        return extract_docx_import(name, bytes, &source, &source_ref);
    }
    if extension == "mobi" || extension == "azw" || mime_lower.contains("mobi") {
        return extract_mobi_import(name, bytes, &source, &source_ref);
    }
    extract_plain_text_import(name, bytes, &source, &source_ref)
}

async fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .user_agent("BentoDesktop/Reading")
        .build()
        .map_err(|error| error.to_string())?;

    let response = client.get(url).send().await.map_err(|error| {
        if error.is_timeout() {
            "The reading source timed out. Check your connection.".to_string()
        } else if error.is_connect() {
            "Could not reach the reading source. You may be offline.".to_string()
        } else {
            format!("Download failed: {error}")
        }
    })?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    response.bytes().await.map(|value| value.to_vec()).map_err(|error| error.to_string())
}

fn build_discover_cover_url(source: &str, source_ref: &str, image_url: Option<&str>, cover_id: Option<i64>) -> String {
    if let Some(url) = image_url {
        if !url.trim().is_empty() {
            return url.to_string();
        }
    }

    if source == "gutenberg" {
        if let Ok(id) = source_ref.parse::<i64>() {
            return format!("https://www.gutenberg.org/cache/epub/{id}/pg{id}.cover.medium.jpg");
        }
    }

    if let Some(cover_id) = cover_id {
        return format!("https://covers.openlibrary.org/b/id/{cover_id}-L.jpg");
    }

    String::new()
}

fn best_download_url(formats: &BTreeMap<String, String>) -> Option<ReadingDiscoverFormat> {
    let preferred = [
        ("application/epub+zip", "EPUB"),
        ("text/plain; charset=utf-8", "Plain text"),
        ("text/plain", "Plain text"),
        ("text/html; charset=utf-8", "HTML"),
        ("text/html", "HTML"),
        ("application/x-mobipocket-ebook", "MOBI"),
        ("application/octet-stream", "Binary"),
    ];

    for (mime, label) in preferred {
        if let Some(url) = formats.get(mime) {
            return Some(ReadingDiscoverFormat {
                label: label.to_string(),
                mime: mime.to_string(),
                url: url.to_string(),
            });
        }
    }

    formats
        .iter()
        .find(|(mime, _)| mime.starts_with("text/") || mime.contains("epub") || mime.contains("mobi"))
        .map(|(mime, url)| ReadingDiscoverFormat {
            label: mime.clone(),
            mime: mime.clone(),
            url: url.clone(),
        })
}

#[derive(Debug, Deserialize)]
struct OpenLibrarySearchResponse {
    docs: Vec<OpenLibrarySearchDoc>,
}

#[derive(Debug, Deserialize)]
struct OpenLibrarySearchDoc {
    key: Option<String>,
    title: Option<String>,
    author_name: Option<Vec<String>>,
    first_publish_year: Option<i64>,
    subject: Option<Vec<String>>,
    cover_i: Option<i64>,
    language: Option<Vec<String>>,
    ia: Option<Vec<String>>,
    publisher: Option<Vec<String>>,
    isbn: Option<Vec<String>>,
    description: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct OpenLibraryWorkResponse {
    title: Option<String>,
    description: Option<OpenLibraryDescription>,
    subjects: Option<Vec<String>>,
    covers: Option<Vec<i64>>,
    first_publish_date: Option<String>,
    languages: Option<Vec<OpenLibraryLanguage>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum OpenLibraryDescription {
    Text(String),
    Object { value: String },
}

#[derive(Debug, Deserialize)]
struct OpenLibraryLanguage {
    key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GutendexResponse {
    results: Vec<GutendexBook>,
}

#[derive(Debug, Deserialize)]
struct GutendexBook {
    id: i64,
    title: String,
    subjects: Vec<String>,
    authors: Vec<GutendexPerson>,
    summaries: Vec<String>,
    bookshelves: Vec<String>,
    languages: Vec<String>,
    copyright: Option<bool>,
    formats: BTreeMap<String, String>,
    download_count: i64,
}

#[derive(Debug, Deserialize)]
struct GutendexPerson {
    name: String,
}

async fn load_bookmarks(pool: &sqlx::SqlitePool, book_id: &str) -> Result<Vec<ReadingBookmark>, String> {
    let rows = sqlx::query(
        "SELECT id, book_id, page_number, position, label, created_at, updated_at FROM reading_bookmarks WHERE book_id = ? ORDER BY page_number ASC, position ASC, created_at ASC",
    )
    .bind(book_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ReadingBookmark {
            id: row.try_get("id").unwrap_or_default(),
            book_id: row.try_get("book_id").unwrap_or_default(),
            page_number: row.try_get("page_number").unwrap_or(0),
            position: row.try_get("position").unwrap_or(0),
            label: row.try_get("label").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

async fn load_highlights(pool: &sqlx::SqlitePool, book_id: &str) -> Result<Vec<ReadingHighlight>, String> {
    let rows = sqlx::query(
        "SELECT id, book_id, page_number, start_offset, end_offset, quote, note, color, created_at, updated_at FROM reading_highlights WHERE book_id = ? ORDER BY created_at DESC",
    )
    .bind(book_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ReadingHighlight {
            id: row.try_get("id").unwrap_or_default(),
            book_id: row.try_get("book_id").unwrap_or_default(),
            page_number: row.try_get("page_number").unwrap_or(0),
            start_offset: row.try_get("start_offset").unwrap_or(0),
            end_offset: row.try_get("end_offset").unwrap_or(0),
            quote: row.try_get("quote").unwrap_or_default(),
            note: row.try_get("note").unwrap_or_default(),
            color: row.try_get("color").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

async fn load_notes(pool: &sqlx::SqlitePool, book_id: &str) -> Result<Vec<ReadingNote>, String> {
    let rows = sqlx::query(
        "SELECT id, book_id, page_number, title, body, created_at, updated_at FROM reading_notes WHERE book_id = ? ORDER BY updated_at DESC",
    )
    .bind(book_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ReadingNote {
            id: row.try_get("id").unwrap_or_default(),
            book_id: row.try_get("book_id").unwrap_or_default(),
            page_number: row.try_get("page_number").unwrap_or(0),
            title: row.try_get("title").unwrap_or_default(),
            body: row.try_get("body").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

async fn load_sessions(
    pool: &sqlx::SqlitePool,
    book_id: Option<&str>,
) -> Result<Vec<ReadingSession>, String> {
    let rows = match book_id {
        Some(book_id) => {
            sqlx::query(
                "SELECT id, book_id, start_page, end_page, started_at, ended_at, duration_ms, pages_read, notes FROM reading_sessions WHERE book_id = ? ORDER BY started_at DESC",
            )
            .bind(book_id)
            .fetch_all(pool)
            .await
            .map_err(|error| error.to_string())?
        }
        None => {
            sqlx::query(
                "SELECT id, book_id, start_page, end_page, started_at, ended_at, duration_ms, pages_read, notes FROM reading_sessions ORDER BY started_at DESC LIMIT 100",
            )
            .fetch_all(pool)
            .await
            .map_err(|error| error.to_string())?
        }
    };

    Ok(rows
        .into_iter()
        .map(|row| ReadingSession {
            id: row.try_get("id").unwrap_or_default(),
            book_id: row.try_get("book_id").unwrap_or_default(),
            start_page: row.try_get("start_page").unwrap_or(0),
            end_page: row.try_get("end_page").unwrap_or(0),
            started_at: row.try_get("started_at").unwrap_or(0),
            ended_at: row.try_get("ended_at").ok().flatten(),
            duration_ms: row.try_get("duration_ms").unwrap_or(0),
            pages_read: row.try_get("pages_read").unwrap_or(0),
            notes: row.try_get("notes").unwrap_or_default(),
        })
        .collect())
}

fn discover_categories() -> Vec<ReadingDiscoverCategory> {
    vec![
        ReadingDiscoverCategory { id: "classics".into(), name: "Classics".into(), source: "gutenberg".into(), query: "classics".into() },
        ReadingDiscoverCategory { id: "fiction".into(), name: "Fiction".into(), source: "gutenberg".into(), query: "fiction".into() },
        ReadingDiscoverCategory { id: "science-fiction".into(), name: "Science Fiction".into(), source: "gutenberg".into(), query: "science fiction".into() },
        ReadingDiscoverCategory { id: "mystery".into(), name: "Mystery".into(), source: "gutenberg".into(), query: "mystery".into() },
        ReadingDiscoverCategory { id: "romance".into(), name: "Romance".into(), source: "gutenberg".into(), query: "romance".into() },
        ReadingDiscoverCategory { id: "history".into(), name: "History".into(), source: "open-library".into(), query: "history".into() },
        ReadingDiscoverCategory { id: "poetry".into(), name: "Poetry".into(), source: "open-library".into(), query: "poetry".into() },
        ReadingDiscoverCategory { id: "philosophy".into(), name: "Philosophy".into(), source: "open-library".into(), query: "philosophy".into() },
        ReadingDiscoverCategory { id: "business".into(), name: "Business".into(), source: "open-library".into(), query: "business".into() },
        ReadingDiscoverCategory { id: "children".into(), name: "Children".into(), source: "gutenberg".into(), query: "children".into() },
        ReadingDiscoverCategory { id: "adventure".into(), name: "Adventure".into(), source: "gutenberg".into(), query: "adventure".into() },
        ReadingDiscoverCategory { id: "biography".into(), name: "Biography".into(), source: "open-library".into(), query: "biography".into() },
    ]
}

async fn discover_open_library(
    query: &ReadingListQuery,
    limit: usize,
) -> Result<Vec<ReadingDiscoverBookSummary>, String> {
    let mut url = reqwest::Url::parse("https://openlibrary.org/search.json").map_err(|error| error.to_string())?;
    {
        let mut params = url.query_pairs_mut();
        if let Some(search) = &query.search {
            params.append_pair("q", search);
        }
        if let Some(author) = &query.author {
            params.append_pair("author", author);
        }
        if let Some(genre) = &query.genre {
            params.append_pair("subject", genre);
        }
        if let Some(tag) = &query.tag {
            params.append_pair("subject", tag);
        }
        params.append_pair("limit", &limit.to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("BentoDesktop/Reading")
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Open Library search failed with status {}", response.status()));
    }

    let payload: OpenLibrarySearchResponse = response.json().await.map_err(|error| error.to_string())?;
    let items = payload
        .docs
        .into_iter()
        .filter_map(|doc| {
            let title = doc.title.unwrap_or_default();
            if title.trim().is_empty() {
                return None;
            }
            let author = doc.author_name.unwrap_or_default().first().cloned().unwrap_or_default();
            let category = doc
                .subject
                .clone()
                .unwrap_or_default()
                .first()
                .cloned()
                .unwrap_or_else(|| "Open Library".to_string());
            let source_ref = doc.key.unwrap_or_default();
            let cover_url = build_discover_cover_url("open-library", &source_ref, None, doc.cover_i);
            let tags = doc.subject.unwrap_or_default().into_iter().take(8).collect::<Vec<_>>();
            let year = doc.first_publish_year.and_then(|value| i32::try_from(value).ok());
            let description = match doc.description {
                Some(Value::String(text)) => text,
                Some(Value::Object(map)) => map
                    .get("value")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| category.clone()),
                _ => category.clone(),
            };

            Some(ReadingDiscoverBookSummary {
                source: "open-library".to_string(),
                source_ref: source_ref.clone(),
                id: source_ref,
                title,
                author,
                category,
                language: doc
                    .language
                    .unwrap_or_default()
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "en".to_string()),
                image_url: cover_url,
                description,
                tags,
                download_url: None,
                public_domain: false,
                year,
            })
        })
        .take(limit)
        .collect::<Vec<_>>();

    Ok(items)
}

async fn discover_gutenberg(
    query: &ReadingListQuery,
    limit: usize,
) -> Result<Vec<ReadingDiscoverBookSummary>, String> {
    let mut url = reqwest::Url::parse("https://gutendex.com/books/").map_err(|error| error.to_string())?;
    {
        let mut params = url.query_pairs_mut();
        params.append_pair("languages", "en");
        if let Some(search) = &query.search {
            params.append_pair("search", search);
        }
        if let Some(genre) = &query.genre {
            params.append_pair("topic", genre);
        }
        if let Some(tag) = &query.tag {
            params.append_pair("topic", tag);
        }
        let page = query.limit.unwrap_or(limit as i64).max(1).min(10) as usize;
        params.append_pair("page", &page.to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("BentoDesktop/Reading")
        .build()
        .map_err(|error| error.to_string())?;
    let response = client.get(url).send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Project Gutenberg search failed with status {}", response.status()));
    }

    let payload: GutendexResponse = response.json().await.map_err(|error| error.to_string())?;
    let items = payload
        .results
        .into_iter()
        .filter_map(|book| {
            let author = book.authors.first().map(|person| person.name.clone()).unwrap_or_default();
            let category = book
                .bookshelves
                .first()
                .cloned()
                .or_else(|| book.subjects.first().cloned())
                .unwrap_or_else(|| "Project Gutenberg".to_string());
            let image_url = build_discover_cover_url("gutenberg", &book.id.to_string(), None, None);
            let download = best_download_url(&book.formats);
            let download_url = download.as_ref().map(|format| format.url.clone());
            let description = book
                .summaries
                .first()
                .cloned()
                .unwrap_or_else(|| category.clone());

            Some(ReadingDiscoverBookSummary {
                source: "gutenberg".to_string(),
                source_ref: book.id.to_string(),
                id: book.id.to_string(),
                title: book.title,
                author,
                category,
                language: book.languages.first().cloned().unwrap_or_else(|| "en".to_string()),
                image_url,
                description,
                tags: book
                    .subjects
                    .iter()
                    .chain(book.bookshelves.iter())
                    .take(10)
                    .cloned()
                    .collect(),
                download_url,
                public_domain: book.copyright != Some(true),
                year: None,
            })
        })
        .take(limit)
        .collect::<Vec<_>>();

    Ok(items)
}

async fn discover_search_core(
    pool: &sqlx::SqlitePool,
    query: &ReadingListQuery,
) -> Result<ReadingDiscoverSearchResult, String> {
    ensure_tables(pool).await?;
    let limit = query
        .limit
        .unwrap_or(DEFAULT_DISCOVER_LIMIT as i64)
        .clamp(1, 64) as usize;
    let source_filter = query
        .source
        .as_deref()
        .unwrap_or_default()
        .to_lowercase();
    let requested_source = query
        .sort
        .as_deref()
        .unwrap_or_default()
        .to_lowercase();

    let source_choice = if requested_source.contains("open") {
        "open-library"
    } else if requested_source.contains("guten") {
        "gutenberg"
    } else if source_filter.contains("open") {
        "open-library"
    } else if source_filter.contains("guten") {
        "gutenberg"
    } else {
        "all"
    };

    let cache_key = cache_key(&[
        "discover-search",
        source_choice,
        query.search.as_deref().unwrap_or_default(),
        query.author.as_deref().unwrap_or_default(),
        query.genre.as_deref().unwrap_or_default(),
        query.tag.as_deref().unwrap_or_default(),
        query.status.as_deref().unwrap_or_default(),
        query.collection_id.as_deref().unwrap_or_default(),
        &limit.to_string(),
    ]);

    if let Some(payload) = cache_get(pool, &cache_key).await? {
        if let Ok(result) = serde_json::from_str::<ReadingDiscoverSearchResult>(&payload) {
            return Ok(result);
        }
    }

    let mut items = Vec::new();
    if source_choice == "open-library" || source_choice == "all" {
        if let Ok(mut results) = discover_open_library(query, limit).await {
            items.append(&mut results);
        }
    }
    if source_choice == "gutenberg" || source_choice == "all" {
        if let Ok(mut results) = discover_gutenberg(query, limit).await {
            items.append(&mut results);
        }
    }

    items.sort_by(|left, right| right
        .year
        .unwrap_or_default()
        .cmp(&left.year.unwrap_or_default())
        .then_with(|| left.title.cmp(&right.title)));
    items.truncate(limit);

    let result = ReadingDiscoverSearchResult {
        source: source_choice.to_string(),
        query: query.search.clone().unwrap_or_default(),
        cached_at: now_ms(),
        items,
    };
    cache_set(pool, &cache_key, "discover-search", &serde_json::to_string(&result).map_err(|error| error.to_string())?, DISCOVERY_CACHE_TTL_MS).await?;
    Ok(result)
}

#[tauri::command]
pub async fn reading_list_books(
    crypto: State<'_, CryptoService>,
    query: Option<ReadingListQuery>,
) -> Result<Vec<ReadingBookSummary>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;

    let query = query.unwrap_or(ReadingListQuery {
        search: None,
        author: None,
        genre: None,
        tag: None,
        collection_id: None,
        status: None,
        source: None,
        sort: Some("recent".to_string()),
        limit: Some(DEFAULT_LIBRARY_LIMIT),
    });
    let limit = query.limit.unwrap_or(DEFAULT_LIBRARY_LIMIT).clamp(1, 1000);

    let mut sql = String::from("SELECT * FROM reading_books");
    let mut conditions = Vec::<String>::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(search) = query.search.as_deref().map(normalize_text).filter(|value| !value.is_empty()) {
        conditions.push("(title LIKE ? OR author LIKE ? OR description LIKE ? OR tags LIKE ? OR genres LIKE ? OR content_text LIKE ?)".to_string());
        let needle = format!("%{search}%");
        bind_values.extend(vec![needle.clone(), needle.clone(), needle.clone(), needle.clone(), needle.clone(), needle]);
    }
    if let Some(author) = query.author.as_deref().map(normalize_text).filter(|value| !value.is_empty()) {
        conditions.push("author LIKE ?".to_string());
        bind_values.push(format!("%{author}%"));
    }
    if let Some(genre) = query.genre.as_deref().map(normalize_text).filter(|value| !value.is_empty()) {
        conditions.push("(genres LIKE ? OR tags LIKE ?)".to_string());
        let needle = format!("%{genre}%");
        bind_values.push(needle.clone());
        bind_values.push(needle);
    }
    if let Some(tag) = query.tag.as_deref().map(normalize_text).filter(|value| !value.is_empty()) {
        conditions.push("tags LIKE ?".to_string());
        bind_values.push(format!("%{tag}%"));
    }
    if let Some(status) = query.status.as_deref().map(normalize_text).filter(|value| !value.is_empty()) {
        conditions.push("status = ?".to_string());
        bind_values.push(status);
    }
    if let Some(collection_id) = query.collection_id.as_deref().map(normalize_text).filter(|value| !value.is_empty()) {
        conditions.push("collection_ids LIKE ?".to_string());
        bind_values.push(format!("%{collection_id}%"));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    match query.sort.as_deref().unwrap_or("recent") {
        "title" => sql.push_str(" ORDER BY title COLLATE NOCASE ASC, updated_at DESC"),
        "author" => sql.push_str(" ORDER BY author COLLATE NOCASE ASC, updated_at DESC"),
        "progress" => sql.push_str(" ORDER BY progress_percent DESC, updated_at DESC"),
        "status" => sql.push_str(" ORDER BY status ASC, updated_at DESC"),
        _ => sql.push_str(" ORDER BY updated_at DESC, added_at DESC"),
    }
    sql.push_str(" LIMIT ?");

    let mut request = sqlx::query(&sql);
    for value in bind_values {
        request = request.bind(value);
    }
    request = request.bind(limit);

    let rows = request
        .fetch_all(&pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(rows.into_iter().map(|row| row_to_book_summary(&row)).collect())
}

#[tauri::command]
pub async fn reading_get_book(
    crypto: State<'_, CryptoService>,
    book_id: String,
) -> Result<Option<ReadingBookDetail>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    load_book_detail(&pool, &book_id).await
}

#[tauri::command]
pub async fn reading_save_book(
    crypto: State<'_, CryptoService>,
    search: State<'_, SearchService>,
    draft: ReadingBookDraft,
) -> Result<ReadingBookSummary, String> {
    let pool = crypto.pool("reading").await?;
    save_book_internal(&pool, &search, draft).await
}

#[tauri::command]
pub async fn reading_delete_book(
    crypto: State<'_, CryptoService>,
    search: State<'_, SearchService>,
    book_id: String,
) -> Result<(), String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;

    sqlx::query("DELETE FROM reading_bookmarks WHERE book_id = ?")
        .bind(&book_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM reading_highlights WHERE book_id = ?")
        .bind(&book_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM reading_notes WHERE book_id = ?")
        .bind(&book_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM reading_sessions WHERE book_id = ?")
        .bind(&book_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM reading_books WHERE id = ?")
        .bind(&book_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;

    if let Err(error) = search.delete_from_index("reading".to_string(), book_id).await {
        eprintln!("reading search delete failed: {error}");
    }

    Ok(())
}

#[tauri::command]
pub async fn reading_update_progress(
    crypto: State<'_, CryptoService>,
    search: State<'_, SearchService>,
    update: ReadingProgressUpdate,
) -> Result<ReadingBookSummary, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;

    let current = load_book_summary(&pool, &update.book_id)
        .await?
        .ok_or_else(|| "Book not found.".to_string())?;
    let page_count = current.page_count.max(0);
    let current_page = update.current_page.clamp(0, page_count.saturating_sub(1).max(0));
    let status = update.status.unwrap_or_else(|| {
        if page_count > 0 && current_page >= page_count.saturating_sub(1) {
            "finished".to_string()
        } else if current_page > 0 {
            "reading".to_string()
        } else {
            current.status.clone()
        }
    });
    let progress_percent = book_progress(current_page, page_count);
    let now = now_ms();

    sqlx::query(
        "UPDATE reading_books SET current_page = ?, progress_percent = ?, status = ?, last_opened_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(current_page)
    .bind(progress_percent)
    .bind(&status)
    .bind(Some(now))
    .bind(now)
    .bind(&update.book_id)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    let summary = load_book_summary(&pool, &update.book_id)
        .await?
        .ok_or_else(|| "Book not found after progress update.".to_string())?;
    if let Err(error) = search.index_content(reading_search_document(&summary)).await {
        eprintln!("reading search index update failed: {error}");
    }
    Ok(summary)
}

#[tauri::command]
pub async fn reading_list_collections(
    crypto: State<'_, CryptoService>,
) -> Result<Vec<ReadingCollection>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let rows = sqlx::query(
        "SELECT id, name, color, icon, created_at, updated_at FROM reading_collections ORDER BY updated_at DESC, created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ReadingCollection {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            color: row.try_get("color").unwrap_or_default(),
            icon: row.try_get("icon").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn reading_save_collection(
    crypto: State<'_, CryptoService>,
    input: ReadingCollectionInput,
) -> Result<ReadingCollection, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = now_ms();

    sqlx::query(
        r#"
        INSERT INTO reading_collections (id, name, color, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            color = excluded.color,
            icon = excluded.icon,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.color)
    .bind(&input.icon)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ReadingCollection {
        id,
        name: input.name,
        color: input.color,
        icon: input.icon,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn reading_delete_collection(
    crypto: State<'_, CryptoService>,
    collection_id: String,
) -> Result<(), String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    sqlx::query("DELETE FROM reading_collections WHERE id = ?")
        .bind(&collection_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;

    let books = sqlx::query("SELECT id, collection_ids FROM reading_books WHERE collection_ids LIKE ?")
        .bind(format!("%{collection_id}%"))
        .fetch_all(&pool)
        .await
        .map_err(|error| error.to_string())?;

    for row in books {
        let id: String = row.try_get("id").unwrap_or_default();
        let mut collection_ids: Vec<String> = parse_string_vec(row.try_get("collection_ids").ok());
        collection_ids.retain(|value| value != &collection_id);
        sqlx::query("UPDATE reading_books SET collection_ids = ?, updated_at = ? WHERE id = ?")
            .bind(json_vec(&collection_ids))
            .bind(now_ms())
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn reading_set_book_collections(
    crypto: State<'_, CryptoService>,
    search: State<'_, SearchService>,
    book_id: String,
    collection_ids: Vec<String>,
) -> Result<ReadingBookSummary, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let now = now_ms();
    sqlx::query("UPDATE reading_books SET collection_ids = ?, updated_at = ? WHERE id = ?")
        .bind(json_vec(&collection_ids))
        .bind(now)
        .bind(&book_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;

    let summary = load_book_summary(&pool, &book_id)
        .await?
        .ok_or_else(|| "Book not found.".to_string())?;
    if let Err(error) = search.index_content(reading_search_document(&summary)).await {
        eprintln!("reading search index update failed: {error}");
    }
    Ok(summary)
}

#[tauri::command]
pub async fn reading_add_bookmark(
    crypto: State<'_, CryptoService>,
    input: ReadingBookmarkInput,
) -> Result<ReadingBookmark, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO reading_bookmarks (id, book_id, page_number, position, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.book_id)
    .bind(input.page_number)
    .bind(input.position)
    .bind(&input.label)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ReadingBookmark {
        id,
        book_id: input.book_id,
        page_number: input.page_number,
        position: input.position,
        label: input.label,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn reading_delete_bookmark(
    crypto: State<'_, CryptoService>,
    bookmark_id: String,
) -> Result<(), String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    sqlx::query("DELETE FROM reading_bookmarks WHERE id = ?")
        .bind(bookmark_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reading_add_highlight(
    crypto: State<'_, CryptoService>,
    input: ReadingHighlightInput,
) -> Result<ReadingHighlight, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO reading_highlights (id, book_id, page_number, start_offset, end_offset, quote, note, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.book_id)
    .bind(input.page_number)
    .bind(input.start_offset)
    .bind(input.end_offset)
    .bind(&input.quote)
    .bind(&input.note)
    .bind(&input.color)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ReadingHighlight {
        id,
        book_id: input.book_id,
        page_number: input.page_number,
        start_offset: input.start_offset,
        end_offset: input.end_offset,
        quote: input.quote,
        note: input.note,
        color: input.color,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn reading_delete_highlight(
    crypto: State<'_, CryptoService>,
    highlight_id: String,
) -> Result<(), String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    sqlx::query("DELETE FROM reading_highlights WHERE id = ?")
        .bind(highlight_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reading_add_note(
    crypto: State<'_, CryptoService>,
    input: ReadingNoteInput,
) -> Result<ReadingNote, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO reading_notes (id, book_id, page_number, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.book_id)
    .bind(input.page_number)
    .bind(&input.title)
    .bind(&input.body)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ReadingNote {
        id,
        book_id: input.book_id,
        page_number: input.page_number,
        title: input.title,
        body: input.body,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn reading_delete_note(
    crypto: State<'_, CryptoService>,
    note_id: String,
) -> Result<(), String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    sqlx::query("DELETE FROM reading_notes WHERE id = ?")
        .bind(note_id)
        .execute(&pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reading_start_session(
    crypto: State<'_, CryptoService>,
    input: ReadingSessionStartInput,
) -> Result<ReadingSession, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO reading_sessions (id, book_id, start_page, end_page, started_at, duration_ms, pages_read, notes) VALUES (?, ?, ?, ?, ?, 0, 0, '')",
    )
    .bind(&id)
    .bind(&input.book_id)
    .bind(input.start_page)
    .bind(input.start_page)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ReadingSession {
        id,
        book_id: input.book_id,
        start_page: input.start_page,
        end_page: input.start_page,
        started_at: now,
        ended_at: None,
        duration_ms: 0,
        pages_read: 0,
        notes: String::new(),
    })
}

#[tauri::command]
pub async fn reading_end_session(
    crypto: State<'_, CryptoService>,
    input: ReadingSessionEndInput,
) -> Result<ReadingSession, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let row = sqlx::query("SELECT id, book_id, start_page, started_at, notes FROM reading_sessions WHERE id = ?")
        .bind(&input.session_id)
        .fetch_one(&pool)
        .await
        .map_err(|error| error.to_string())?;

    let started_at: i64 = row.try_get("started_at").unwrap_or(now_ms());
    let started_page: i64 = row.try_get("start_page").unwrap_or(0);
    let ended_at = now_ms();
    let duration_ms = ended_at.saturating_sub(started_at);
    let pages_read = (input.end_page - started_page).abs().max(1);
    let notes = input.notes.unwrap_or_default();

    sqlx::query(
        "UPDATE reading_sessions SET end_page = ?, ended_at = ?, duration_ms = ?, pages_read = ?, notes = ? WHERE id = ?",
    )
    .bind(input.end_page)
    .bind(ended_at)
    .bind(duration_ms)
    .bind(pages_read)
    .bind(&notes)
    .bind(&input.session_id)
    .execute(&pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(ReadingSession {
        id: input.session_id,
        book_id: row.try_get("book_id").unwrap_or_default(),
        start_page: started_page,
        end_page: input.end_page,
        started_at,
        ended_at: Some(ended_at),
        duration_ms,
        pages_read,
        notes,
    })
}

#[tauri::command]
pub async fn reading_list_sessions(
    crypto: State<'_, CryptoService>,
    book_id: Option<String>,
) -> Result<Vec<ReadingSession>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    load_sessions(&pool, book_id.as_deref()).await
}

#[tauri::command]
pub async fn reading_list_bookmarks(
    crypto: State<'_, CryptoService>,
    book_id: String,
) -> Result<Vec<ReadingBookmark>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    load_bookmarks(&pool, &book_id).await
}

#[tauri::command]
pub async fn reading_list_highlights(
    crypto: State<'_, CryptoService>,
    book_id: String,
) -> Result<Vec<ReadingHighlight>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    load_highlights(&pool, &book_id).await
}

#[tauri::command]
pub async fn reading_list_notes(
    crypto: State<'_, CryptoService>,
    book_id: String,
) -> Result<Vec<ReadingNote>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    load_notes(&pool, &book_id).await
}

#[tauri::command]
pub async fn reading_discover_categories(
    crypto: State<'_, CryptoService>,
) -> Result<Vec<ReadingDiscoverCategory>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    Ok(discover_categories())
}

#[tauri::command]
pub async fn reading_discover_search(
    crypto: State<'_, CryptoService>,
    query: ReadingListQuery,
) -> Result<ReadingDiscoverSearchResult, String> {
    let pool = crypto.pool("reading").await?;
    discover_search_core(&pool, &query).await
}

#[tauri::command]
pub async fn reading_discover_detail(
    crypto: State<'_, CryptoService>,
    source: String,
    source_ref: String,
) -> Result<Option<ReadingDiscoverBookDetail>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let cache_key = cache_key(&["discover-detail", &source, &source_ref]);
    if let Some(payload) = cache_get(&pool, &cache_key).await? {
        if let Ok(detail) = serde_json::from_str::<ReadingDiscoverBookDetail>(&payload) {
            return Ok(Some(detail));
        }
    }

    let detail = if source == "gutenberg" {
        let url = format!("https://gutendex.com/books/{source_ref}");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .user_agent("BentoDesktop/Reading")
            .build()
            .map_err(|error| error.to_string())?;
        let response = client.get(url).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Ok(None);
        }
        let book: GutendexBook = response.json().await.map_err(|error| error.to_string())?;
        let author = book.authors.first().map(|person| person.name.clone()).unwrap_or_default();
        let category = book
            .bookshelves
            .first()
            .cloned()
            .or_else(|| book.subjects.first().cloned())
            .unwrap_or_else(|| "Project Gutenberg".to_string());
        let summary = ReadingDiscoverBookSummary {
            source: source.clone(),
            source_ref: source_ref.clone(),
            id: source_ref.clone(),
            title: book.title.clone(),
            author: author.clone(),
            category: category.clone(),
            language: book.languages.first().cloned().unwrap_or_else(|| "en".to_string()),
            image_url: build_discover_cover_url("gutenberg", &source_ref, None, None),
            description: book.summaries.first().cloned().unwrap_or_else(|| category.clone()),
            tags: book.subjects.iter().chain(book.bookshelves.iter()).take(12).cloned().collect(),
            download_url: best_download_url(&book.formats).map(|value| value.url),
            public_domain: book.copyright != Some(true),
            year: None,
        };
        Some(ReadingDiscoverBookDetail {
            summary,
            summary_text: book.summaries.first().cloned().unwrap_or_default(),
            subjects: book.subjects,
            authors: book.authors.into_iter().map(|person| person.name).collect(),
            formats: book
                .formats
                .into_iter()
                .map(|(mime, url)| ReadingDiscoverFormat {
                    label: mime.clone(),
                    mime,
                    url,
                })
                .collect(),
        })
    } else if source == "open-library" {
        let detail_url = if source_ref.starts_with('/') {
            format!("https://openlibrary.org{source_ref}.json")
        } else {
            format!("https://openlibrary.org/{source_ref}.json")
        };
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .user_agent("BentoDesktop/Reading")
            .build()
            .map_err(|error| error.to_string())?;
        let response = client.get(detail_url).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Ok(None);
        }
        let work: OpenLibraryWorkResponse = response.json().await.map_err(|error| error.to_string())?;
        let summary = ReadingDiscoverBookSummary {
            source: source.clone(),
            source_ref: source_ref.clone(),
            id: source_ref.clone(),
            title: work.title.clone().unwrap_or_else(|| title_case(&source_ref.replace('/', " "))),
            author: String::new(),
            category: work
                .subjects
                .clone()
                .unwrap_or_default()
                .first()
                .cloned()
                .unwrap_or_else(|| "Open Library".to_string()),
            language: work
                .languages
                .as_ref()
                .and_then(|values| values.first())
                .and_then(|value| value.key.clone())
                .unwrap_or_else(|| "en".to_string()),
            image_url: work
                .covers
                .as_ref()
                .and_then(|covers| covers.first().cloned())
                .map(|id| format!("https://covers.openlibrary.org/b/id/{id}-L.jpg"))
                .unwrap_or_default(),
            description: work
                .description.clone()
                .map(|desc| match desc {
                    OpenLibraryDescription::Text(text) => text,
                    OpenLibraryDescription::Object { value } => value,
                })
                .unwrap_or_default(),
            tags: work.subjects.clone().unwrap_or_default(),
            download_url: None,
            public_domain: false,
            year: None,
        };
        Some(ReadingDiscoverBookDetail {
            summary,
            summary_text: work
                .description
                .map(|desc| match desc {
                    OpenLibraryDescription::Text(text) => text,
                    OpenLibraryDescription::Object { value } => value,
                })
                .unwrap_or_default(),
            subjects: work.subjects.unwrap_or_default(),
            authors: vec![],
            formats: vec![],
        })
    } else {
        None
    };

    if let Some(detail) = &detail {
        cache_set(
            &pool,
            &cache_key,
            "discover-detail",
            &serde_json::to_string(detail).map_err(|error| error.to_string())?,
            DISCOVERY_DETAIL_TTL_MS,
        )
        .await?;
    }

    Ok(detail)
}

#[tauri::command]
pub async fn reading_discover_random(
    crypto: State<'_, CryptoService>,
) -> Result<Option<ReadingDiscoverBookSummary>, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;
    let categories = discover_categories();
    let category = categories
        .get((now_ms().unsigned_abs() as usize) % categories.len())
        .cloned()
        .ok_or_else(|| "No discover categories available.".to_string())?;

    let query = ReadingListQuery {
        search: None,
        author: None,
        genre: Some(category.query.clone()),
        tag: None,
        collection_id: None,
        status: Some(category.source.clone()),
        source: Some(category.source.clone()),
        sort: Some(category.source.clone()),
        limit: Some(8),
    };

    let result = discover_search_core(&pool, &query).await?;
    Ok(result.items.into_iter().next())
}

#[tauri::command]
pub async fn reading_import_files(
    crypto: State<'_, CryptoService>,
    search: State<'_, SearchService>,
    files: Vec<ReadingImportInput>,
) -> Result<ReadingImportResult, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;

    let mut books = Vec::new();
    let mut failed = Vec::new();

    for file in files {
        let name = file.name.clone();
        let relative_path = file.relative_path.clone();
        let mime = file.mime.clone();
        let bytes = STANDARD
            .decode(file.data_base64.as_bytes())
            .map_err(|error| format!("Failed to decode {}: {error}", file.name))?;

        let parse_result = tokio::task::spawn_blocking(move || parse_import_blob(&name, &relative_path, &mime, &bytes))
            .await
            .map_err(|error| error.to_string())?;

        match parse_result {
            Ok(mut draft) => {
                draft.source = "local".to_string();
                let source_ref = if draft.source_ref.is_empty() {
                    file.relative_path.clone()
                } else {
                    draft.source_ref.clone()
                };
                draft.source_ref = source_ref;
                match save_book_internal(&pool, &search, draft).await {
                    Ok(book) => books.push(book),
                    Err(error) => failed.push(format!("{}: {error}", file.name)),
                }
            }
            Err(error) => failed.push(format!("{}: {error}", file.name)),
        }
    }

    Ok(ReadingImportResult { books, failed })
}

#[tauri::command]
pub async fn reading_import_discover_book(
    crypto: State<'_, CryptoService>,
    search: State<'_, SearchService>,
    detail: ReadingDiscoverBookDetail,
) -> Result<ReadingBookSummary, String> {
    let pool = crypto.pool("reading").await?;
    ensure_tables(&pool).await?;

    if let Some(download_url) = detail.summary.download_url.clone() {
        let bytes = download_bytes(&download_url).await?;
        let mime = detail
            .formats
            .iter()
            .find(|format| format.url == download_url)
            .map(|format| format.mime.clone())
            .unwrap_or_else(|| {
                if download_url.contains(".epub") {
                    "application/epub+zip".to_string()
                } else if download_url.contains(".mobi") {
                    "application/x-mobipocket-ebook".to_string()
                } else if download_url.contains(".html") {
                    "text/html".to_string()
                } else {
                    "text/plain".to_string()
                }
            });
        let file_name = format!(
            "{}-{}.{}",
            detail.summary.title.replace('/', "_"),
            detail.summary.source_ref,
            if mime.contains("epub") {
                "epub"
            } else if mime.contains("mobi") {
                "mobi"
            } else if mime.contains("html") {
                "html"
            } else {
                "txt"
            }
        );
        let summary = detail.summary.clone();
        let bytes_clone = bytes.clone();
        let mime_clone = mime.clone();
        let parsed = tokio::task::spawn_blocking(move || {
            parse_import_blob(&file_name, &summary.source_ref, &mime_clone, &bytes_clone)
        })
        .await
        .map_err(|error| error.to_string())??;

        let mut draft = parsed;
        draft.source = detail.summary.source.clone();
        draft.source_ref = detail.summary.source_ref.clone();
        draft.public_domain = detail.summary.public_domain;
        if draft.cover_url.is_empty() {
            draft.cover_url = detail.summary.image_url.clone();
        }
        return save_book_internal(&pool, &search, draft).await;
    }

    let draft = ReadingBookDraft {
        id: None,
        title: detail.summary.title.clone(),
        author: detail.summary.author.clone(),
        subtitle: detail.summary.category.clone(),
        description: detail.summary.description.clone(),
        source: detail.summary.source.clone(),
        source_ref: detail.summary.source_ref.clone(),
        format: "metadata".to_string(),
        language: detail.summary.language.clone(),
        isbn: String::new(),
        publisher: String::new(),
        published_at: detail.summary.year.map(|value| value.to_string()).unwrap_or_default(),
        cover_url: detail.summary.image_url.clone(),
        status: "unread".to_string(),
        tags: detail.summary.tags.clone(),
        genres: detail.subjects.clone(),
        collection_ids: vec![],
        page_count: 0,
        current_page: 0,
        word_count: 0,
        content_text: detail.summary_text.clone(),
        page_texts: vec![],
        toc: vec![],
        file_name: detail.summary.title.replace('/', "_"),
        file_size: 0,
        public_domain: detail.summary.public_domain,
    };

    save_book_internal(&pool, &search, draft).await
}

fn parse_plain_text_discover_book(
    file_name: &str,
    bytes: &[u8],
    detail: &ReadingDiscoverBookDetail,
) -> Result<ReadingBookDraft, String> {
    let content_text = normalize_text(&String::from_utf8_lossy(bytes));
    let pages = chunk_text(&content_text, 2500);
    Ok(ReadingBookDraft {
        id: None,
        title: detail.summary.title.clone(),
        author: detail.summary.author.clone(),
        subtitle: detail.summary.category.clone(),
        description: detail.summary.description.clone(),
        source: detail.summary.source.clone(),
        source_ref: detail.summary.source_ref.clone(),
        format: "text".to_string(),
        language: detail.summary.language.clone(),
        isbn: String::new(),
        publisher: String::new(),
        published_at: detail.summary.year.map(|value| value.to_string()).unwrap_or_default(),
        cover_url: detail.summary.image_url.clone(),
        status: "unread".to_string(),
        tags: detail.summary.tags.clone(),
        genres: detail.subjects.clone(),
        collection_ids: vec![],
        page_count: pages.len() as i64,
        current_page: 0,
        word_count: count_words(&content_text),
        content_text,
        page_texts: pages,
        toc: vec![],
        file_name: file_name.to_string(),
        file_size: bytes.len() as i64,
        public_domain: detail.summary.public_domain,
    })
}

fn infer_import_draft(file: &ReadingImportInput) -> Result<ReadingBookDraft, String> {
    let bytes = STANDARD
        .decode(file.data_base64.as_bytes())
        .map_err(|error| format!("Failed to decode {}: {error}", file.name))?;
    parse_import_blob(&file.name, &file.relative_path, &file.mime, &bytes)
}
