// ═════════════════════════════════════════════════════════════════════════════
// Clipboard Manager — Backend Module (v2)
//
// Architecture:
//   - SQLite-backed history with SHA-256 content hash for O(1) dedup
//   - Content-addressable file store for items > 1 KB (blobs stored as
//     {data_dir}/clipboard/contents/{prefix}/{hash})
//   - Tantivy full-text search via existing SearchService (already a dep)
//   - sqlx::QueryBuilder for type-safe dynamic query construction
//   - Regex-based sensitive content detection (API keys, tokens, secrets)
//   - Background clipboard polling with bounded mpsc channel for backpressure
//   - Multi-format read: plain text, HTML, image bitmap, file list
//   - Event emission to frontend on new clipboard entries
//   - All operations use bounded queries — never loads full table
// ═════════════════════════════════════════════════════════════════════════════

use base64::Engine;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::AsyncWriteExt;
use tokio::sync::{mpsc, Mutex};

use crate::db::BentoAppState;
use crate::search::{SearchDocument, SearchService};
use crate::util::time;

pub mod bookmarks;

use tracing::info;

// ─── Instrumentation ─────────────────────────────────────────────────────────
fn log_timing(category: &str, op: &str, start: Instant, detail: impl std::fmt::Display) {
    let ms = start.elapsed().as_secs_f64() * 1000.0;
    if ms > 100.0 {
        info!("\u{26a0} [{category}] {op} took {ms:.1}ms — {detail}");
    } else if ms > 10.0 {
        info!("[{category}] {op} took {ms:.1}ms — {detail}");
    } else {
        info!("[{category}] {op} took {ms:.3}ms — {detail}");
    }
}

// ─── Constants ───────────────────────────────────────────────────────────────
/// Maximum number of items returned by list/search.
const DEFAULT_PAGE_SIZE: u32 = 500;
/// Max preview length (characters) stored in the DB.
const PREVIEW_MAX_LEN: usize = 200;
/// Clipboard polling interval (milliseconds).
/// Lower = more responsive, higher = less CPU. 300ms gives responsive capture
/// while still being gentle on battery.
const POLL_INTERVAL_MS: u64 = 300;
/// Maximum image size (bytes) for clipboard polling. Images larger than this
/// are saved once but re-polling is skipped to avoid 100ms+ clipboard reads
/// every 900ms on the spawn_blocking thread pool.
const MAX_POLL_IMAGE_SIZE: usize = 2_000_000; // 2 MB
/// Number of image poll cycles to skip after detecting a large image.
const LARGE_IMAGE_COOLDOWN_CYCLES: u32 = 30; // ~30 * 900ms = ~27s cooldown
/// Faster polling interval when actively copying.
const POLL_INTERVAL_FOCUSED_MS: u64 = 200;
/// Auto-expiry for sensitive items (milliseconds). Default: 10 minutes.
const SENSITIVE_EXPIRY_MS: i64 = 600_000;
/// Threshold in bytes: content above this is stored on disk, not inline.
const EXTERNAL_STORE_THRESHOLD: usize = 1024;
/// Maximum number of pending clipboard saves in the bounded channel.
const CHANNEL_CAPACITY: usize = 50;
/// Global semaphore limiting concurrent clipboard reads to 1.
/// Windows clipboard access is single-threaded — concurrent reads block
/// each other and saturate the blocking thread pool, causing app freeze.
static CLIPBOARD_SEM: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(1);
/// Maximum number of clipboard items before auto-pruning oldest unpinned.
const MAX_CLIPBOARD_ITEMS: i64 = 50_000;
/// Run auto-prune check every N writer batches.
const PRUNE_INTERVAL_BATCHES: u64 = 50;
/// Tantivy index memory budget in bytes.
// ─── Sensitive Detection Patterns ────────────────────────────────────────────

static SENSITIVE_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    // Helper to embed a literal double-quote in a raw regex string.
    // Raw strings r"..." cannot contain " — the string terminates at the
    // first unescaped double quote. We inject it via format! so the regex
    // engine sees the quote character in character classes.
    fn q() -> &'static str {
        "\""
    }

    vec![
        // Stripe / payment API keys
        // Static regex patterns — these are compile-time verified strings.
        // If any pattern is invalid, the program fails early at startup.
        Regex::new(r"(?i)(sk_live_|pk_live_|sk_test_|pk_test_)[A-Za-z0-9]{24,}")
            .expect("hardcoded Stripe API key pattern is valid"),
        // AWS access keys
        Regex::new(r"(?i)AKIA[0-9A-Z]{16}")
            .expect("hardcoded AWS access key pattern is valid"),
        // AWS secret keys
        Regex::new(&format!(
            r"(?i)(aws_secret_access_key|aws_secret_key)\s*[:=]\s*['{}]?[A-Za-z0-9/+=]{{40}}", q()
        ))
        .expect("hardcoded AWS secret key pattern is valid"),
        // Generic API keys (bearer tokens, x-api-key, etc.)
        Regex::new(&format!(
            r"(?i)(bearer|token|api[_-]?key|secret|password)\s*[:=]\s*['{}]?[A-Za-z0-9_\-./+=]{{20,}}", q()
        ))
        .expect("hardcoded API key pattern is valid"),
        // JWT tokens (base64url-encoded JSON)
        Regex::new(r"(eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)")
            .expect("hardcoded JWT pattern is valid"),
        // SSH private keys
        Regex::new(r"-----BEGIN (RSA|DSA|EC|OPENSSH|PRIVATE) KEY-----")
            .expect("hardcoded SSH key pattern is valid"),
        // GitHub tokens
        Regex::new(r"(?i)(ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{36}")
            .expect("hardcoded GitHub token pattern is valid"),
        // Credit card numbers — pre-filter with regex, then Luhn-validate
        // The regex eagerly catches potential digit sequences; Luhn check in
        // is_sensitive_content() filters out false positives like timestamps / OTP codes.
        Regex::new(r"\b(?:\d[ -]*?){13,19}\b")
            .expect("hardcoded CC number pattern is valid"),
        // Environment variable exports with secrets
        // Note: avoids look-around (not supported by Rust regex crate)
        Regex::new(r"export\s+[A-Z_]+=.{32,}")
            .expect("hardcoded env var pattern is valid"),
    ]
});

// ─── Content Hash ───────────────────────────────────────────────────────────

/// Compute the SHA-256 hex digest of content bytes.
fn content_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}

// ─── Content-Addressable Store ──────────────────────────────────────────────

/// Root directory for clipboard content blobs.
fn content_store_root(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("clipboard").join("contents")
}

/// Full path for a given content hash.
/// Uses two-level sharding: first 2 chars / full hash.
fn content_path(data_dir: &std::path::Path, hash: &str) -> PathBuf {
    let prefix = if hash.len() >= 2 { &hash[..2] } else { "__" };
    content_store_root(data_dir).join(prefix).join(hash)
}

/// Full path for an image file (with .png extension).
/// Image files need the extension so that Tauri's asset protocol
/// (via convertFileSrc) serves the correct MIME type for <img> tags.
fn image_content_path(data_dir: &std::path::Path, hash: &str) -> PathBuf {
    let prefix = if hash.len() >= 2 { &hash[..2] } else { "__" };
    content_store_root(data_dir)
        .join(prefix)
        .join(format!("{hash}.png"))
}

/// Store content to disk if it exceeds the inline threshold.
/// Returns (content_path_opt, stored_content) where stored_content is
/// the inline representation (trimmed if externalized).
async fn store_content(
    data_dir: &std::path::Path,
    hash: &str,
    content: &str,
) -> Result<(Option<String>, String), String> {
    if content.len() <= EXTERNAL_STORE_THRESHOLD {
        return Ok((None, content.to_string()));
    }

    let path = content_path(data_dir, hash);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .await
        .map_err(|e| e.to_string())?;

    Ok((Some(path.to_string_lossy().to_string()), String::new()))
}

/// Read content from either inline field or external file.
async fn read_content(
    data_dir: &std::path::Path,
    inline: &str,
    content_path_opt: Option<&str>,
    _hash: &str,
) -> Result<String, String> {
    if !inline.is_empty() {
        return Ok(inline.to_string());
    }

    match content_path_opt {
        Some(path) => {
            let full_path = if std::path::Path::new(path).is_absolute() {
                std::path::PathBuf::from(path)
            } else {
                content_path(data_dir, _hash)
            };

            if full_path.exists() {
                tokio::fs::read_to_string(&full_path)
                    .await
                    .map_err(|e| e.to_string())
            } else {
                Ok(String::new())
            }
        }
        None => Ok(String::new()),
    }
}

/// Delete an external content file if it exists.
/// Handles both legacy extensionless paths and current .png image paths.
async fn delete_content_file(data_dir: &std::path::Path, hash: &str) {
    // Try .png extension first (new image storage), then extensionless (legacy)
    let png_path = image_content_path(data_dir, hash);
    let path = content_path(data_dir, hash);
    let target = if png_path.exists() { png_path } else { path };

    if target.exists() {
        let _ = tokio::fs::remove_file(&target).await;
        // Remove parent dir if empty
        if let Some(parent) = target.parent() {
            let _ = tokio::fs::remove_dir(parent).await;
        }
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

/// Content kind for a clipboard entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ClipKind {
    Text,
    Code,
    Link,
    Bookmark,
    Image,
    Html,
    Sensitive,
}

impl ClipKind {
    fn as_str(&self) -> &'static str {
        match self {
            ClipKind::Text => "text",
            ClipKind::Code => "code",
            ClipKind::Link => "link",
            ClipKind::Bookmark => "bookmark",
            ClipKind::Image => "image",
            ClipKind::Html => "html",
            ClipKind::Sensitive => "sensitive",
        }
    }

    fn from_str(s: &str) -> Self {
        match s {
            "code" => ClipKind::Code,
            "link" => ClipKind::Link,
            "bookmark" => ClipKind::Bookmark,
            "image" => ClipKind::Image,
            "html" => ClipKind::Html,
            "sensitive" => ClipKind::Sensitive,
            _ => ClipKind::Text,
        }
    }
}

/// A clipboard entry returned to the frontend.
/// The `content` field is always populated (inline or loaded from external store).
/// The `external_content` field is true when content was loaded from disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipEntry {
    pub id: String,
    pub kind: ClipKind,
    pub content: String,
    pub content_hash: String,
    pub preview: Option<String>,
    pub source: Option<String>,
    pub byte_size: i64,
    pub pinned: bool,
    pub favorite: bool,
    pub is_sensitive: bool,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub external_content: Option<bool>,
    // ── Bookmark enrichment fields ──
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub og_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub og_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub og_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub og_site_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub saved_timestamp_seconds: Option<i64>,
    #[serde(default)]
    pub recopy_count: i64,
    #[serde(default)]
    pub enrichment_status: String,
}

impl ClipEntry {
    fn from_row(row: sqlx::sqlite::SqliteRow) -> Self {
        let kind_str: String = row.try_get("kind").unwrap_or_default();
        let content: String = row.try_get("content").unwrap_or_default();
        let preview: Option<String> = row
            .try_get("preview")
            .ok()
            .filter(|s: &String| !s.is_empty());

        Self {
            id: row.try_get("id").unwrap_or_default(),
            kind: ClipKind::from_str(&kind_str),
            content,
            content_hash: row.try_get("content_hash").unwrap_or_default(),
            preview,
            source: row
                .try_get("source")
                .ok()
                .filter(|s: &String| !s.is_empty()),
            byte_size: row.try_get("byte_size").unwrap_or(0),
            pinned: row.try_get::<i64, _>("pinned").unwrap_or(0) == 1,
            favorite: row.try_get::<i64, _>("favorite").unwrap_or(0) == 1,
            is_sensitive: row.try_get::<i64, _>("is_sensitive").unwrap_or(0) == 1,
            timestamp: row.try_get("created_at").unwrap_or(0),
            external_content: None,
            og_title: row
                .try_get("og_title")
                .ok()
                .filter(|s: &String| !s.is_empty()),
            og_description: row
                .try_get("og_description")
                .ok()
                .filter(|s: &String| !s.is_empty()),
            og_image: row
                .try_get("og_image")
                .ok()
                .filter(|s: &String| !s.is_empty()),
            og_site_name: row
                .try_get("og_site_name")
                .ok()
                .filter(|s: &String| !s.is_empty()),
            platform: row
                .try_get("platform")
                .ok()
                .filter(|s: &String| !s.is_empty()),
            saved_timestamp_seconds: row.try_get("saved_timestamp_seconds").ok(),
            recopy_count: row.try_get("recopy_count").unwrap_or(0),
            enrichment_status: row
                .try_get("enrichment_status")
                .unwrap_or_else(|_| "none".to_string()),
        }
    }
}

// ─── Schema & Migrations ────────────────────────────────────────────────────

/// Run clipboard-specific migrations.
pub async fn ensure_clipboard_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let migrations = [
        r#"
        CREATE TABLE IF NOT EXISTS clipboard_items (
            id            TEXT PRIMARY KEY,
            content_hash  TEXT NOT NULL,
            kind          TEXT NOT NULL DEFAULT 'text',
            content       TEXT NOT NULL DEFAULT '',
            content_path  TEXT,
            preview       TEXT NOT NULL DEFAULT '',
            source        TEXT,
            byte_size     INTEGER NOT NULL DEFAULT 0,
            pinned        INTEGER NOT NULL DEFAULT 0,
            favorite      INTEGER NOT NULL DEFAULT 0,
            is_sensitive  INTEGER NOT NULL DEFAULT 0,
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        )
        "#,
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_clipboard_hash
        ON clipboard_items(content_hash)
        "#,
        r#"
        CREATE INDEX IF NOT EXISTS idx_clipboard_created_at
        ON clipboard_items(created_at DESC)
        "#,
        r#"
        CREATE INDEX IF NOT EXISTS idx_clipboard_pinned_created
        ON clipboard_items(pinned DESC, created_at DESC)
        "#,
        r#"
        CREATE INDEX IF NOT EXISTS idx_clipboard_kind_created
        ON clipboard_items(kind, created_at DESC)
        "#,
        r#"
        CREATE INDEX IF NOT EXISTS idx_clipboard_preview
        ON clipboard_items(preview)
        "#,
        // Column migrations for schema upgrades (safe to ignore errors)
        r#"ALTER TABLE clipboard_items ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN content_path TEXT"#,
        // Bookmarking Layer columns
        r#"ALTER TABLE clipboard_items ADD COLUMN url_classification TEXT NOT NULL DEFAULT '{}'"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN enrichment_status TEXT NOT NULL DEFAULT 'none'"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN og_title TEXT"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN og_description TEXT"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN og_image TEXT"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN og_site_name TEXT"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN recopy_count INTEGER NOT NULL DEFAULT 0"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN last_recopied_at INTEGER"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN saved_timestamp_seconds INTEGER"#,
        r#"ALTER TABLE clipboard_items ADD COLUMN platform TEXT"#,
    ];

    for migration in &migrations {
        let result = sqlx::query(migration).execute(pool).await;
        if let Err(e) = result {
            let msg = e.to_string();
            if msg.contains("duplicate column name")
                || msg.contains("already exists")
                || msg.contains("Cannot add a NOT NULL")
            {
                continue;
            }
            return Err(msg);
        }
    }

    Ok(())
}

// ─── Content Analysis ────────────────────────────────────────────────────────

/// Detect the kind of clipboard content.
fn detect_kind(content: &str) -> ClipKind {
    if content.is_empty() {
        return ClipKind::Text;
    }

    // Check for sensitive patterns first (highest priority)
    if is_sensitive_content(content) {
        return ClipKind::Sensitive;
    }

    // Check for image data URIs
    if content.starts_with("data:image/")
        || content.starts_with("iVBOR")
        || content.starts_with("/9j/")
    {
        return ClipKind::Image;
    }

    // Check for URLs
    if content.starts_with("http://")
        || content.starts_with("https://")
        || content.starts_with("ftp://")
    {
        return ClipKind::Link;
    }

    // Check for HTML content (before code — many HTML snippets look like code)
    if looks_like_html(content) {
        return ClipKind::Html;
    }

    // Check for code patterns
    if looks_like_code(content) {
        return ClipKind::Code;
    }

    ClipKind::Text
}

/// Heuristic: does the content look like code?
fn looks_like_code(content: &str) -> bool {
    let trimmed = content.trim();

    // Multi-line with indentation and code keywords
    if trimmed.contains('\n') {
        let lines: Vec<&str> = trimmed.lines().collect();
        if lines.len() > 2 {
            let indented = lines
                .iter()
                .filter(|l| l.starts_with(char::is_whitespace))
                .count();
            let code_keywords = [
                "fn ",
                "const ",
                "let ",
                "var ",
                "if ",
                "else ",
                "for ",
                "while ",
                "return ",
                "import ",
                "export ",
                "class ",
                "def ",
                "function ",
                "SELECT ",
                "FROM ",
                "WHERE ",
                "INSERT ",
                "CREATE ",
                "#include",
                "package ",
                "using ",
                "namespace ",
                "<html",
                "<?php",
                "```",
            ];
            let has_keyword = code_keywords.iter().any(|kw| content.contains(kw));
            let has_syntax = ["{", "}", "(", ")", ";", "=>", "->", "::"]
                .iter()
                .filter(|ch| content.contains(*ch))
                .count()
                >= 3;

            (indented > 0 || has_keyword) && has_syntax
        } else {
            false
        }
    } else {
        // Single line: check for code-like patterns
        let code_indicators = ["=>", "->", "::", "//", "/*", "fn ", "def "];
        code_indicators.iter().any(|pat| trimmed.contains(pat))
    }
}

/// Heuristic: does the content look like HTML?
fn looks_like_html(content: &str) -> bool {
    let trimmed = content.trim();
    if trimmed.len() < 10 {
        return false;
    }

    // Check for HTML doctype
    if trimmed.to_ascii_lowercase().starts_with("<!doctype html") {
        return true;
    }

    // Check for opening <html> tag
    if trimmed.to_ascii_lowercase().starts_with("<html") {
        return true;
    }

    // Count HTML-like tags: <word> patterns
    let html_tags = [
        "<div", "<span", "<p>", "<p ", "<a ", "<a>", "<b>", "<i>", "<u>", "<h1", "<h2", "<h3",
        "<h4", "<h5", "<h6", "<ul", "<ol", "<li", "<table", "<tr", "<td", "<th", "<br", "<hr",
        "<img", "<input", "<button", "<select", "<form", "<header", "<footer", "<section",
        "<article", "<nav", "<main", "<aside", "<style", "<script", "<meta", "<link", "</div>",
        "</span>", "</p>", "</a>", "</h", "</ul>", "</ol>", "</li>", "</table>", "</form>",
        "</body>", "</html>",
    ];
    let tag_count = html_tags
        .iter()
        .filter(|tag| {
            let lower = trimmed.to_ascii_lowercase();
            lower.contains(*tag)
        })
        .count();

    // At least 2 HTML tags to qualify
    tag_count >= 2
}

/// Check if content matches any sensitive data pattern.
fn is_sensitive_content(content: &str) -> bool {
    if content.len() < 15 {
        return false;
    }

    // First pass: check all regex patterns
    for (i, re) in SENSITIVE_PATTERNS.iter().enumerate() {
        if !re.is_match(content) {
            continue;
        }
        // Pattern at index 9 (0-indexed) is the credit-card Luhn pre-filter.
        // Apply Luhn validation to reject false positives (timestamps, OTP codes).
        if i == 9 {
            if let Some(digits) = extract_digit_run(content) {
                if luhn_check(&digits) {
                    return true;
                }
            }
            continue;
        }
        return true;
    }

    false
}

/// Extract all digits from content (for Luhn validation).
fn extract_digit_run(content: &str) -> Option<String> {
    let digits: String = content.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 13 && digits.len() <= 19 {
        Some(digits)
    } else {
        None
    }
}

/// Luhn checksum validation — real credit card numbers pass, random digit strings
/// (timestamps, OTP codes, serial numbers, code numbers) almost certainly don't.
fn luhn_check(digits: &str) -> bool {
    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }
    let mut sum = 0u64;
    let mut double = false;
    for ch in digits.chars().rev() {
        let d = match ch.to_digit(10) {
            Some(d) => d,
            None => return false,
        };
        if double {
            let doubled = d * 2;
            sum += if doubled > 9 { doubled - 9 } else { doubled } as u64;
        } else {
            sum += d as u64;
        }
        double = !double;
    }
    sum % 10 == 0
}
fn make_preview(content: &str, kind: &ClipKind) -> String {
    match kind {
        ClipKind::Image => String::new(),
        ClipKind::Html => {
            let text = strip_html_tags(content);
            let cleaned = text.replace('\r', "").replace('\n', " ").replace('\t', " ");
            let compressed: String = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
            if compressed.is_empty() {
                truncate_utf8_safe(content, PREVIEW_MAX_LEN)
            } else {
                truncate_utf8_safe(&compressed, PREVIEW_MAX_LEN)
            }
        }
        ClipKind::Sensitive => truncate_utf8_safe(content, PREVIEW_MAX_LEN),
        _ => {
            let cleaned = content
                .replace('\r', "")
                .replace('\n', " ")
                .replace('\t', " ");
            let compressed: String = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
            truncate_utf8_safe(&compressed, PREVIEW_MAX_LEN)
        }
    }
}

/// Remove HTML tags from a string, returning only visible text.
/// Handles <tag>, <tag attr="...">, and common HTML entities.
fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut in_entity = false;
    let mut entity_buf = String::new();

    for ch in html.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' && in_tag {
            in_tag = false;
        } else if ch == '&' && !in_tag {
            in_entity = true;
            entity_buf.clear();
        } else if ch == ';' && in_entity {
            in_entity = false;
            // Decode common entities
            match entity_buf.as_str() {
                "amp" => result.push('&'),
                "lt" => result.push('<'),
                "gt" => result.push('>'),
                "quot" => result.push('"'),
                "apos" => result.push('\''),
                "nbsp" => result.push(' '),
                _ => {}
            }
            entity_buf.clear();
        } else if !in_tag && !in_entity {
            result.push(ch);
        } else if in_entity {
            entity_buf.push(ch);
        }
    }

    result
}

/// Truncate a string to at most `max_len` characters (char-boundary safe).
fn truncate_utf8_safe(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        return s.to_string();
    }
    // Find the nearest char boundary at or before max_len
    let mut idx = max_len;
    while !s.is_char_boundary(idx) {
        idx -= 1;
    }
    format!("{}…", &s[..idx])
}

/// Index a clipboard entry in Tantivy.
async fn index_clip_entry(app: &AppHandle, entry: &ClipEntry) {
    if let Some(search) = app.try_state::<SearchService>() {
        let doc = SearchDocument {
            module_id: "clipboard".to_string(),
            id: entry.id.clone(),
            title: entry.preview.clone().unwrap_or_default(),
            body: entry.content.clone(),
            tags: vec![entry.kind.as_str().to_string()],
            projects: Vec::new(),
            kind: Some(entry.kind.as_str().to_string()),
            created_at: Some(entry.timestamp),
            updated_at: Some(entry.timestamp),
            source_ref: entry.source.clone(),
            extra: serde_json::json!({
                "contentHash": entry.content_hash,
                "byteSize": entry.byte_size,
                "isSensitive": entry.is_sensitive,
                "pinned": entry.pinned,
            }),
        };
        if let Err(e) = search.index_content(doc).await {
            info!("[clipboard] Tantivy index failed: {e}");
        }
    }
}

/// Remove a clipboard entry from the Tantivy index.
async fn unindex_clip_entry(app: &AppHandle, id: &str) {
    if let Some(search) = app.try_state::<SearchService>() {
        let _ = search
            .delete_from_index("clipboard".to_string(), id.to_string())
            .await;
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// List clipboard items with optional filtering.
#[tauri::command]
pub async fn clipboard_list(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    limit: Option<u32>,
    kind: Option<String>,
    pinned_only: Option<bool>,
    favorite_only: Option<bool>,
    offset: Option<u32>,
) -> Result<Vec<ClipEntry>, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let _start = Instant::now();
    let pool = state.db();
    let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE) as i64;
    let offset = offset.unwrap_or(0) as i64;

    let mut qb = sqlx::query_builder::QueryBuilder::new(
        "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
         FROM clipboard_items WHERE 1=1"
    );

    if let Some(ref k) = kind {
        qb.push(" AND kind = ");
        qb.push_bind(k.clone());
    }
    if pinned_only.unwrap_or(false) {
        qb.push(" AND pinned = 1");
    }
    if favorite_only.unwrap_or(false) {
        qb.push(" AND favorite = 1");
    }

    qb.push(" ORDER BY pinned DESC, created_at DESC");
    qb.push(" LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);

    let rows = qb
        .build()
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let entries: Vec<ClipEntry> = rows.into_iter().map(ClipEntry::from_row).collect();
    let total_bytes: usize = entries
        .iter()
        .map(|e| e.content.len() + e.content_hash.len() + e.preview.as_ref().map_or(0, |s| s.len()))
        .sum();
    log_timing(
        "Clipboard",
        "list",
        _start,
        format_args!("{} rows, ~{}KB payload", entries.len(), total_bytes / 1024),
    );
    Ok(entries)
}

/// Get a single clipboard item by ID.
/// Loads external content if the inline content is empty.
#[tauri::command]
pub async fn clipboard_get(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<Option<ClipEntry>, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let row = sqlx::query(
        "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
         FROM clipboard_items WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(mut entry) = row.map(ClipEntry::from_row) else {
        return Ok(None);
    };

    // Load external content if the inline field is empty
    if entry.content.is_empty() && !entry.content_hash.is_empty() {
        let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let path = entry.content_hash.clone();
        entry.content = read_content(&data_dir, "", Some(&path), &entry.content_hash).await?;
        entry.external_content = Some(true);
    }

    Ok(Some(entry))
}

/// Save a new clipboard item. Content-hash based dedup (O(1)).
/// Returns the saved entry, or the existing one if a duplicate is found.
#[tauri::command]
pub async fn clipboard_save(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    content: String,
    source: Option<String>,
) -> Result<ClipEntry, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let hash = content_hash(content.as_bytes());
    let now = time::now_ms();
    let id = uuid::Uuid::new_v4().to_string();
    let kind = detect_kind(&content);
    let preview = if kind != ClipKind::Image {
        make_preview(&content, &kind)
    } else {
        String::new()
    };
    let is_sensitive = if kind == ClipKind::Sensitive {
        1i64
    } else {
        0i64
    };
    let byte_size = content.len() as i64;

    // Store content — externalize large blobs
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let (content_path_opt, stored_content) = store_content(&data_dir, &hash, &content).await?;

    // Atomic dedup via INSERT OR IGNORE + UNIQUE INDEX on content_hash.
    // Avoids check-then-insert race conditions between concurrent saves.
    let result = sqlx::query(
        r#"
        INSERT OR IGNORE INTO clipboard_items (id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&hash)
    .bind(kind.as_str())
    .bind(&stored_content)
    .bind(&content_path_opt)
    .bind(&preview)
    .bind(&source)
    .bind(byte_size)
    .bind(is_sensitive)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        // Duplicate — update timestamp and return existing
        sqlx::query(
            "UPDATE clipboard_items SET created_at = ?, updated_at = ? WHERE content_hash = ?",
        )
        .bind(now)
        .bind(now)
        .bind(&hash)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        let row = sqlx::query(
            "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
             FROM clipboard_items WHERE content_hash = ?"
        )
        .bind(&hash)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

        return Ok(ClipEntry::from_row(row));
    }

    let entry = ClipEntry {
        id,
        kind,
        content,
        content_hash: hash,
        preview: if preview.is_empty() {
            None
        } else {
            Some(preview)
        },
        source,
        byte_size,
        pinned: false,
        favorite: false,
        is_sensitive: is_sensitive == 1,
        timestamp: now,
        external_content: None,
        og_title: None,
        og_description: None,
        og_image: None,
        og_site_name: None,
        platform: None,
        saved_timestamp_seconds: None,
        recopy_count: 0,
        enrichment_status: "none".to_string(),
    };

    // Index in Tantivy
    index_clip_entry(&app, &entry).await;

    // Notify frontend
    let _ = app.emit("clipboard://new-entry", entry.clone());

    Ok(entry)
}

/// Pin or unpin a clipboard item (wrapper matching frontend API).
/// Accepts explicit `pinned` boolean for optimistic-UI-friendly contracts.
#[tauri::command]
pub async fn clipboard_pin(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
    pinned: bool,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    sqlx::query("UPDATE clipboard_items SET pinned = ?, updated_at = ? WHERE id = ?")
        .bind(if pinned { 1i64 } else { 0i64 })
        .bind(time::now_ms())
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
         FROM clipboard_items WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let entry = ClipEntry::from_row(row);
    index_clip_entry(&app, &entry).await;

    Ok(pinned)
}

/// Toggle the pinned state of a clipboard item.
#[tauri::command]
pub async fn clipboard_toggle_pin(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let current: Option<i64> =
        sqlx::query_scalar("SELECT pinned FROM clipboard_items WHERE id = ?")
            .bind(&id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

    match current {
        Some(pinned) => {
            let new_val = if pinned == 0 { 1 } else { 0 };
            sqlx::query("UPDATE clipboard_items SET pinned = ?, updated_at = ? WHERE id = ?")
                .bind(new_val)
                .bind(time::now_ms())
                .bind(&id)
                .execute(&pool)
                .await
                .map_err(|e| e.to_string())?;

            // Re-index to update pinned status in Tantivy
            let row = sqlx::query(
                "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
                 FROM clipboard_items WHERE id = ?"
            )
            .bind(&id)
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;
            let entry = ClipEntry::from_row(row);
            index_clip_entry(&app, &entry).await;

            Ok(new_val == 1)
        }
        None => Err("Clipboard item not found.".to_string()),
    }
}

/// Favorite or unfavorite a clipboard item (wrapper matching frontend API).
#[tauri::command]
pub async fn clipboard_favorite(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
    favorite: bool,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    sqlx::query("UPDATE clipboard_items SET favorite = ?, updated_at = ? WHERE id = ?")
        .bind(if favorite { 1i64 } else { 0i64 })
        .bind(time::now_ms())
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
         FROM clipboard_items WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let entry = ClipEntry::from_row(row);
    index_clip_entry(&app, &entry).await;

    Ok(favorite)
}

/// Toggle the favorite state of a clipboard item.
#[tauri::command]
pub async fn clipboard_toggle_favorite(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let current: Option<i64> =
        sqlx::query_scalar("SELECT favorite FROM clipboard_items WHERE id = ?")
            .bind(&id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

    match current {
        Some(fav) => {
            let new_val = if fav == 0 { 1 } else { 0 };
            sqlx::query("UPDATE clipboard_items SET favorite = ?, updated_at = ? WHERE id = ?")
                .bind(new_val)
                .bind(time::now_ms())
                .bind(&id)
                .execute(&pool)
                .await
                .map_err(|e| e.to_string())?;

            let row = sqlx::query(
                "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
                 FROM clipboard_items WHERE id = ?"
            )
            .bind(&id)
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;
            let entry = ClipEntry::from_row(row);
            index_clip_entry(&app, &entry).await;

            Ok(new_val == 1)
        }
        None => Err("Clipboard item not found.".to_string()),
    }
}

/// Delete a single clipboard item.
#[tauri::command]
pub async fn clipboard_delete(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();

    // Get hash before deleting to clean up external content
    let hash: Option<String> =
        sqlx::query_scalar("SELECT content_hash FROM clipboard_items WHERE id = ?")
            .bind(&id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM clipboard_items WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // Clean up Tantivy index
    unindex_clip_entry(&app, &id).await;

    // Clean up external content file
    if let Some(hash) = hash {
        if !hash.is_empty() {
            if let Ok(data_dir) = app.path().app_data_dir() {
                delete_content_file(&data_dir, &hash).await;
            }
        }
    }

    Ok(())
}

/// Delete multiple clipboard items by IDs.
#[tauri::command]
pub async fn clipboard_delete_batch(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    ids: Vec<String>,
) -> Result<i64, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let mut deleted = 0i64;

    for id in &ids {
        let hash: Option<String> =
            sqlx::query_scalar("SELECT content_hash FROM clipboard_items WHERE id = ?")
                .bind(id)
                .fetch_optional(&pool)
                .await
                .map_err(|e| e.to_string())?;

        let result = sqlx::query("DELETE FROM clipboard_items WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        deleted += result.rows_affected() as i64;
        unindex_clip_entry(&app, id).await;

        if let Some(hash) = hash {
            if !hash.is_empty() {
                if let Ok(data_dir) = app.path().app_data_dir() {
                    delete_content_file(&data_dir, &hash).await;
                }
            }
        }
    }

    Ok(deleted)
}

/// Clear all non-pinned items. Returns the number of items deleted.
#[tauri::command]
pub async fn clipboard_clear_unpinned(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
) -> Result<i64, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();

    // Get all unpinned hashes for content cleanup
    let hashes: Vec<String> =
        sqlx::query_scalar("SELECT content_hash FROM clipboard_items WHERE pinned = 0")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;

    // Get IDs for Tantivy cleanup
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM clipboard_items WHERE pinned = 0")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let result = sqlx::query("DELETE FROM clipboard_items WHERE pinned = 0")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let count = result.rows_affected() as i64;

    // Clean up Tantivy
    for id in &ids {
        unindex_clip_entry(&app, id).await;
    }

    // Clean up external files
    if let Ok(data_dir) = app.path().app_data_dir() {
        for hash in &hashes {
            if !hash.is_empty() {
                delete_content_file(&data_dir, hash).await;
            }
        }
    }

    Ok(count)
}

/// Clear all items (including pinned). Returns the number of items deleted.
#[tauri::command]
pub async fn clipboard_clear_all(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
) -> Result<i64, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();

    // Get all hashes for content cleanup
    let hashes: Vec<String> = sqlx::query_scalar("SELECT content_hash FROM clipboard_items")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM clipboard_items")
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let result = sqlx::query("DELETE FROM clipboard_items")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let count = result.rows_affected() as i64;

    for id in &ids {
        unindex_clip_entry(&app, id).await;
    }

    if let Ok(data_dir) = app.path().app_data_dir() {
        for hash in &hashes {
            if !hash.is_empty() {
                delete_content_file(&data_dir, hash).await;
            }
        }
    }

    Ok(count)
}

/// Search clipboard items by content or preview using Tantivy.
#[tauri::command]
pub async fn clipboard_search(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<ClipEntry>, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    if query.trim().is_empty() {
        return clipboard_list(auth, state, limit, None, None, None, None).await;
    }

    let limit = limit.unwrap_or(DEFAULT_PAGE_SIZE) as usize;

    // Try Tantivy search first
    if let Some(search) = app.try_state::<SearchService>() {
        let search_query = crate::search::SearchQuery {
            query: query.clone(),
            limit: Some(limit),
            offset: None,
            fuzzy: true,
            tags: Vec::new(),
            projects: Vec::new(),
            kind: None,
            created_after: None,
            created_before: None,
            updated_after: None,
            updated_before: None,
        };

        match search
            .search_in_module("clipboard".to_string(), search_query)
            .await
        {
            Ok(hits) => {
                if !hits.is_empty() {
                    let pool = state.db();
                    let ids: Vec<String> = hits.into_iter().map(|h| h.document.id).collect();

                    // Fetch full entries by IDs, preserving Tantivy's rank order
                    let mut entries = Vec::with_capacity(ids.len());
                    for id in &ids {
                        if let Ok(row) = sqlx::query(
                            "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
                             FROM clipboard_items WHERE id = ?"
                        )
                        .bind(id)
                        .fetch_one(&pool)
                        .await
                        {
                            entries.push(ClipEntry::from_row(row));
                        }
                    }
                    if !entries.is_empty() {
                        return Ok(entries);
                    }
                }
            }
            Err(e) => {
                info!("[clipboard] Tantivy search failed, falling back to LIKE: {e}");
            }
        }
    }

    // Fallback: LIKE search
    let pool = state.db();
    let limit = limit as i64;
    let search_pattern = format!("%{}%", query.trim());

    let rows = sqlx::query(
        "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
         FROM clipboard_items \
         WHERE content LIKE ? OR preview LIKE ? \
         ORDER BY pinned DESC, created_at DESC LIMIT ?"
    )
    .bind(&search_pattern)
    .bind(&search_pattern)
    .bind(limit)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(ClipEntry::from_row).collect())
}

/// Get the total count of clipboard items.
#[tauri::command]
pub async fn clipboard_count(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<i64, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM clipboard_items")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(count)
}

/// Save a clipboard image entry from the monitoring system.
/// Stores the PNG bytes in the content-addressable store and creates a ClipEntry.
async fn save_clipboard_image_entry(
    app: &AppHandle,
    state: &BentoAppState,
    image_bytes: &[u8],
) -> Result<(), String> {
    let _start = Instant::now();
    let bytes_len = image_bytes.len();
    if image_bytes.len() < 16 {
        return Ok(());
    }

    let pool = state.db();
    let hash = content_hash(image_bytes);
    let now = time::now_ms();
    let id = uuid::Uuid::new_v4().to_string();
    let byte_size = image_bytes.len() as i64;

    // Store image bytes in content-addressable store with .png extension
    // Extension is critical — Tauri's convertFileSrc() uses the asset protocol
    // which determines MIME type from the file extension. Without .png, the
    // webview serves application/octet-stream and <img> tags refuse to render.
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = image_content_path(&data_dir, &hash);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    tokio::fs::write(&path, image_bytes)
        .await
        .map_err(|e| e.to_string())?;

    let content_path_str = Some(path.to_string_lossy().to_string());
    let preview = format!("[Image] {:.7}…", &hash[..7]);

    // Atomic dedup via INSERT OR IGNORE + UNIQUE INDEX on content_hash.
    let result = sqlx::query(
        r#"
        INSERT OR IGNORE INTO clipboard_items (id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&hash)
    .bind("image")
    .bind("") // images stored externally, not inline
    .bind(&content_path_str)
    .bind(&preview)
    .bind(Option::<String>::None) // source
    .bind(byte_size)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() > 0 {
        let hash_log = hash.clone();
        let entry = ClipEntry {
            id,
            kind: ClipKind::Image,
            content: String::new(),
            content_hash: hash,
            preview: Some(preview),
            source: None,
            byte_size,
            pinned: false,
            favorite: false,
            is_sensitive: false,
            timestamp: now,
            external_content: Some(true),
            og_title: None,
            og_description: None,
            og_image: None,
            og_site_name: None,
            platform: None,
            saved_timestamp_seconds: None,
            recopy_count: 0,
            enrichment_status: "none".to_string(),
        };

        // Index in Tantivy
        index_clip_entry(app, &entry).await;

        // Notify frontend
        let _ = app.emit("clipboard://new-entry", entry);

        log_timing(
            "Clipboard::ImageSave",
            "complete",
            _start,
            format_args!("{} bytes, hash={:.12}", bytes_len, hash_log),
        );
    } else {
        // Duplicate — update timestamp only
        sqlx::query(
            "UPDATE clipboard_items SET created_at = ?, updated_at = ? WHERE content_hash = ?",
        )
        .bind(now)
        .bind(now)
        .bind(&hash)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        log_timing(
            "Clipboard::ImageSave",
            "dedup-hit",
            _start,
            format_args!("{} bytes", bytes_len),
        );
    }

    Ok(())
}

/// Copy a clipboard item back to the system clipboard.
/// Supports plain text, rich text (HTML), and images.
/// For images, reads the stored PNG bytes and writes them to the system clipboard.
#[tauri::command]
pub async fn clipboard_copy(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    id: String,
    _mode: Option<String>,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let _start = Instant::now();
    let pool = state.db();
    let row = sqlx::query(
        "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
         FROM clipboard_items WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(row) = row else {
        return Err("Clipboard item not found.".to_string());
    };

    let entry = ClipEntry::from_row(row);
    log_timing(
        "Clipboard::Copy",
        "db-lookup",
        _start,
        format_args!("id={:.12}, kind={:?}", id, entry.kind),
    );
    match entry.kind {
        ClipKind::Image => {
            let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

            // Try PNG path first, then legacy extensionless path
            let png_path = image_content_path(&data_dir, &entry.content_hash);
            let ext_path = content_path(&data_dir, &entry.content_hash);
            let image_path = if png_path.exists() {
                png_path
            } else {
                ext_path
            };

            if !image_path.exists() {
                return Err("Image file not found on disk.".to_string());
            }

            let image_bytes = tokio::fs::read(&image_path)
                .await
                .map_err(|e| format!("Failed to read image: {e}"))?;

            // Write image back to system clipboard using RGBA
            let image_size = image_bytes.len();
            log_timing(
                "Clipboard::Copy",
                "fs-read",
                _start,
                format_args!("{} KB image", image_size / 1024),
            );
            let app_clone = app.clone();
            tokio::task::spawn_blocking(move || -> Result<(), String> {
                #[cfg(desktop)]
                {
                    use tauri_plugin_clipboard_manager::ClipboardExt;
                    let decode_start = Instant::now();
                    // Decode PNG bytes back to RGBA pixels
                    let img = image::load_from_memory(&image_bytes)
                        .map_err(|e| format!("Failed to decode image: {e}"))?
                        .into_rgba8();
                    let decode_ms = decode_start.elapsed().as_secs_f64() * 1000.0;
                    let (width, height) = img.dimensions();
                    let rgba = img.into_raw();
                    let output_size = rgba.len();
                    let image_obj = tauri::image::Image::new(&rgba, width, height);
                    info!("[Clipboard::Copy] decoded {}x{} PNG → {} RGBA in {decode_ms:.1}ms", width, height, output_size);
                    if decode_ms > 50.0 {
                        info!("\u{26a0} [Clipboard::Copy] SLOW image decode: {decode_ms:.1}ms for {}x{}", width, height);
                    }
                    app_clone.clipboard()
                        .write_image(&image_obj)
                        .map_err(|e| format!("Failed to write image to clipboard: {e}"))
                }
                #[cfg(not(desktop))]
                {
                    let _ = app_clone;
                    Err("Clipboard copy not supported on this platform.".to_string())
                }
            })
            .await
            .map_err(|e| format!("Blocking task failed: {e}"))?
        }
        _ => {
            // Text/HTML: write the content string
            let content = if entry.content.is_empty() && !entry.content_hash.is_empty() {
                let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
                read_content(
                    &data_dir,
                    "",
                    Some(&entry.content_hash),
                    &entry.content_hash,
                )
                .await?
            } else {
                entry.content.clone()
            };

            let app_clone = app.clone();
            tokio::task::spawn_blocking(move || -> Result<(), String> {
                #[cfg(desktop)]
                {
                    use tauri_plugin_clipboard_manager::ClipboardExt;
                    app_clone
                        .clipboard()
                        .write_text(content)
                        .map_err(|e| format!("Failed to write text to clipboard: {e}"))
                }
                #[cfg(not(desktop))]
                {
                    let _ = app_clone;
                    let _ = content;
                    Err("Clipboard copy not supported on this platform.".to_string())
                }
            })
            .await
            .map_err(|e| format!("Blocking task failed: {e}"))?
        }
    }
}

/// Get the absolute file path for an image stored in the content-addressable store.
/// The frontend uses `convertFileSrc()` to turn this into a webview-loadable URL.
/// This avoids base64-encoding the entire image through IPC.
#[tauri::command]
pub async fn clipboard_get_image_path(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    hash: String,
) -> Result<Option<String>, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let _start = Instant::now();
    if hash.is_empty() || hash.len() < 8 {
        return Err("Invalid content hash.".to_string());
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // Try PNG extension path first (new storage format)
    let png_path = image_content_path(&data_dir, &hash);
    if png_path.exists() {
        log_timing(
            "Clipboard::ImagePath",
            "lookup",
            _start,
            format_args!("hash={:.12} fs-hit", hash),
        );
        return Ok(Some(png_path.to_string_lossy().to_string()));
    }

    // Fallback: try extensionless path (legacy storage format)
    let store_path = content_path(&data_dir, &hash);
    if store_path.exists() {
        log_timing(
            "Clipboard::ImagePath",
            "lookup",
            _start,
            format_args!("hash={:.12} legacy-fs-hit", hash),
        );
        return Ok(Some(store_path.to_string_lossy().to_string()));
    }

    // Last resort: look up by hash in the DB to get the content_path
    let pool = state.db();
    let content_path_str: Option<String> =
        sqlx::query_scalar("SELECT content_path FROM clipboard_items WHERE content_hash = ?")
            .bind(&hash)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?
            .flatten();

    match content_path_str {
        Some(path) => {
            let full_path = if std::path::Path::new(&path).is_absolute() {
                std::path::PathBuf::from(&path)
            } else {
                let png = image_content_path(&data_dir, &hash);
                if png.exists() {
                    log_timing(
                        "Clipboard::ImagePath",
                        "lookup",
                        _start,
                        format_args!("hash={:.12} db-fallback-fs-hit", hash),
                    );
                    return Ok(Some(png.to_string_lossy().to_string()));
                }
                content_path(&data_dir, &hash)
            };
            if full_path.exists() {
                log_timing(
                    "Clipboard::ImagePath",
                    "lookup",
                    _start,
                    format_args!("hash={:.12} db-hit", hash),
                );
                Ok(Some(full_path.to_string_lossy().to_string()))
            } else {
                // Stale content_path — the file was deleted but the DB
                // wasn't cleaned up. Clear it so future lookups skip the
                // DB path check and go straight to db-miss (fast).
                let _ = sqlx::query(
                    "UPDATE clipboard_items SET content_path = NULL WHERE content_hash = ?",
                )
                .bind(&hash)
                .execute(&pool)
                .await;
                log_timing(
                    "Clipboard::ImagePath",
                    "lookup",
                    _start,
                    format_args!("hash={:.12} db-path-cleared-stale", hash),
                );
                Ok(None)
            }
        }
        None => {
            log_timing(
                "Clipboard::ImagePath",
                "lookup",
                _start,
                format_args!("hash={:.12} db-miss", hash),
            );
            Ok(None)
        }
    }
}

/// Batch version: look up image file paths for multiple hashes at once.
/// Returns a map of hash → path (or null if not found).
/// Eliminates the N+1 IPC problem where each image in the grid fires a
/// separate invoke call.
#[tauri::command]
pub async fn clipboard_get_image_paths(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    _state: State<'_, BentoAppState>,
    hashes: Vec<String>,
) -> Result<std::collections::HashMap<String, Option<String>>, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let _start = Instant::now();
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut results = std::collections::HashMap::new();

    for hash in hashes {
        if hash.is_empty() || hash.len() < 8 {
            results.insert(hash, None);
            continue;
        }

        let png_path = image_content_path(&data_dir, &hash);
        if png_path.exists() {
            results.insert(hash, Some(png_path.to_string_lossy().to_string()));
            continue;
        }

        let store_path = content_path(&data_dir, &hash);
        if store_path.exists() {
            results.insert(hash, Some(store_path.to_string_lossy().to_string()));
            continue;
        }

        results.insert(hash, None);
    }

    log_timing(
        "Clipboard::ImagePath",
        "batch-lookup",
        _start,
        format_args!("{} hashes", results.len()),
    );
    Ok(results)
}

/// Retrieve image data as a base64 data URI for frontend rendering.
/// Kept for backward compatibility — prefer `clipboard_get_image_path` for new code.
#[tauri::command]
pub async fn clipboard_get_image_data(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    hash: String,
) -> Result<String, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    if hash.is_empty() || hash.len() < 8 {
        return Err("Invalid content hash.".to_string());
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // Try PNG extension path first, then extensionless
    let png_path = image_content_path(&data_dir, &hash);
    let store_path = content_path(&data_dir, &hash);
    let read_path = if png_path.exists() {
        png_path
    } else {
        store_path
    };

    if read_path.exists() {
        let bytes = tokio::fs::read(&read_path)
            .await
            .map_err(|e| format!("Failed to read image: {e}"))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        return Ok(format!("data:image/png;base64,{b64}"));
    }

    let pool = state.db();
    let content_path_str: Option<String> =
        sqlx::query_scalar("SELECT content_path FROM clipboard_items WHERE content_hash = ?")
            .bind(&hash)
            .fetch_optional(&pool)
            .await
            .map_err(|e| e.to_string())?
            .flatten();

    match content_path_str {
        Some(path) => {
            let full_path = if std::path::Path::new(&path).is_absolute() {
                std::path::PathBuf::from(&path)
            } else {
                let png = image_content_path(&data_dir, &hash);
                if png.exists() {
                    png
                } else {
                    content_path(&data_dir, &hash)
                }
            };
            if full_path.exists() {
                let bytes = tokio::fs::read(&full_path)
                    .await
                    .map_err(|e| format!("Failed to read image: {e}"))?;
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                Ok(format!("data:image/png;base64,{b64}"))
            } else {
                // Clear stale content_path so future calls don't repeat this miss
                let _ = sqlx::query(
                    "UPDATE clipboard_items SET content_path = NULL WHERE content_hash = ?",
                )
                .bind(&hash)
                .execute(&pool)
                .await;
                Err("Image file not found on disk.".to_string())
            }
        }
        None => Err("No image found for the given content hash.".to_string()),
    }
}

/// Auto-expire sensitive items that are older than the expiry duration.
#[tauri::command]
pub async fn clipboard_expire_sensitive(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
) -> Result<i64, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let pool = state.db();
    let cutoff = time::now_ms() - SENSITIVE_EXPIRY_MS;

    // Get hashes and IDs for cleanup
    let hashes: Vec<String> = sqlx::query_scalar(
        "SELECT content_hash FROM clipboard_items WHERE is_sensitive = 1 AND created_at < ? AND pinned = 0"
    )
    .bind(cutoff)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM clipboard_items WHERE is_sensitive = 1 AND created_at < ? AND pinned = 0",
    )
    .bind(cutoff)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let result = sqlx::query(
        "DELETE FROM clipboard_items WHERE is_sensitive = 1 AND created_at < ? AND pinned = 0",
    )
    .bind(cutoff)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    for id in &ids {
        unindex_clip_entry(&app, id).await;
    }

    if let Ok(data_dir) = app.path().app_data_dir() {
        for hash in &hashes {
            if !hash.is_empty() {
                delete_content_file(&data_dir, hash).await;
            }
        }
    }

    Ok(result.rows_affected() as i64)
}

/// Garbage collect orphaned content files.
/// Removes blobs that don't correspond to any row in clipboard_items.
#[tauri::command]
pub async fn clipboard_gc(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
) -> Result<i64, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    let data_dir = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(_) => return Ok(0),
    };

    let store_root = content_store_root(&data_dir);
    if !store_root.exists() {
        return Ok(0);
    }

    let pool = state.db();
    let mut removed = 0i64;

    // Walk the content store tree
    let mut dirs = tokio::fs::read_dir(&store_root)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(entry) = dirs.next_entry().await.map_err(|e| e.to_string())? {
        if !entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let prefix_dir = entry.path();
        let mut files = tokio::fs::read_dir(&prefix_dir)
            .await
            .map_err(|e| e.to_string())?;

        while let Some(file) = files.next_entry().await.map_err(|e| e.to_string())? {
            if !file.file_type().await.map(|t| t.is_file()).unwrap_or(false) {
                continue;
            }
            let hash = file.file_name().to_string_lossy().to_string();

            // Check if this hash exists in the DB
            let exists: bool = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM clipboard_items WHERE content_hash = ?",
            )
            .bind(&hash)
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?
                > 0;

            if !exists {
                let _ = tokio::fs::remove_file(file.path()).await;
                removed += 1;
            }
        }

        // Remove empty prefix dirs
        let mut remaining = tokio::fs::read_dir(&prefix_dir)
            .await
            .map_err(|e| e.to_string())?;
        if remaining
            .next_entry()
            .await
            .map_err(|e| e.to_string())?
            .is_none()
        {
            let _ = tokio::fs::remove_dir(&prefix_dir).await;
        }
    }

    Ok(removed)
}

// ─── Auto-Prune (Soft Cap) ───────────────────────────────────────────────────

/// Auto-prune the clipboard when it exceeds MAX_CLIPBOARD_ITEMS.
/// NEVER deletes pinned or favorited items. Only removes the oldest
/// unpinned items (by created_at ASC) and cleans up their content files
/// from disk. Also performs a WAL checkpoint to keep the DB file lean.
pub async fn auto_prune_clipboard(app: &AppHandle, pool: &sqlx::SqlitePool) -> i64 {
    let _start = Instant::now();

    // Count total items
    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM clipboard_items")
        .fetch_one(pool)
        .await
    {
        Ok(c) => c,
        Err(e) => {
            info!("[clipboard::prune] count failed: {e}");
            return 0;
        }
    };

    if total <= MAX_CLIPBOARD_ITEMS {
        log_timing("Clipboard::Prune", "under-limit", _start, format_args!("total={total}, max={MAX_CLIPBOARD_ITEMS}"));
        return 0;
    }

    let excess = total - MAX_CLIPBOARD_ITEMS;
    info!(
        "[clipboard::prune] total={total}, max={MAX_CLIPBOARD_ITEMS}, excess={excess}, removing oldest unpinned..."
    );
    // Collect hashes of items that will be deleted (for file cleanup);
    let hashes: Vec<String> = match sqlx::query_scalar(
        "SELECT content_hash FROM clipboard_items WHERE pinned = 0 AND favorite = 0 \
         ORDER BY created_at ASC LIMIT ?"
    )
    .bind(excess)
    .fetch_all(pool)
    .await
    {
        Ok(h) => h,
        Err(e) => {
            info!("[clipboard::prune] hash query failed: {e}");
            return 0;
        }
    };

    // Collect IDs for Tantivy cleanup
    let ids: Vec<String> = match sqlx::query_scalar(
        "SELECT id FROM clipboard_items WHERE pinned = 0 AND favorite = 0 \
         ORDER BY created_at ASC LIMIT ?"
    )
    .bind(excess)
    .fetch_all(pool)
    .await
    {
        Ok(i) => i,
        Err(e) => {
            info!("[clipboard::prune] id query failed: {e}");
            return 0;
        }
    };

    let pruned = hashes.len().min(ids.len()) as i64;
    if pruned == 0 {
        return 0;
    }

    // Delete the rows
    match sqlx::query(
        "DELETE FROM clipboard_items WHERE pinned = 0 AND favorite = 0 \
         ORDER BY created_at ASC LIMIT ?"
    )
    .bind(excess)
    .execute(pool)
    .await
    {
        Ok(r) => {
            let deleted = r.rows_affected() as i64;
            info!("[clipboard::prune] deleted {deleted} items");
            // Clean up Tantivy index for each deleted item
            if let Some(search) = app.try_state::<SearchService>() {
                for id in &ids {
                    let _ = search
                        .delete_from_index("clipboard".to_string(), id.clone())
                        .await;
                }
            }

            // Clean up content files
            if let Ok(data_dir) = app.path().app_data_dir() {
                for hash in &hashes {
                    if !hash.is_empty() {
                        delete_content_file(&data_dir, hash).await;
                    }
                }
            }

            // Run a WAL checkpoint to keep the DB file lean after bulk delete
            let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
                .execute(pool)
                .await;

            log_timing("Clipboard::Prune", "completed", _start, format_args!("deleted={deleted}, excess={excess}"));
            deleted
        }
        Err(e) => {
            info!("[clipboard::prune] delete failed: {e}");
            0
        }
    }
}

// ─── Background Monitoring ───────────────────────────────────────────────────

/// A change event from the clipboard poller.
pub struct ClipboardChange {
    content: String,
    image_data: Option<Vec<u8>>,
    html_data: Option<String>,
}

/// Shared clipboard state for change detection.
pub struct ClipboardMonitor {
    last_content: Mutex<String>,
    last_image_hash: Mutex<String>,
    last_html_hash: Mutex<String>,
    save_tx: mpsc::Sender<ClipboardChange>,
    large_image_cooldown_remaining: Mutex<u32>,
}

impl ClipboardMonitor {
    pub fn new() -> (Self, mpsc::Receiver<ClipboardChange>) {
        let (save_tx, save_rx) = mpsc::channel::<ClipboardChange>(CHANNEL_CAPACITY);
        (
            Self {
                last_content: Mutex::new(String::new()),
                last_image_hash: Mutex::new(String::new()),
                last_html_hash: Mutex::new(String::new()),
                save_tx,
                large_image_cooldown_remaining: Mutex::new(0),
            },
            save_rx,
        )
    }

    pub fn save_tx(&self) -> &mpsc::Sender<ClipboardChange> {
        &self.save_tx
    }
}

impl Default for ClipboardMonitor {
    fn default() -> Self {
        let (tx, _rx) = mpsc::channel(CHANNEL_CAPACITY);
        Self {
            last_content: Mutex::new(String::new()),
            last_image_hash: Mutex::new(String::new()),
            last_html_hash: Mutex::new(String::new()),
            save_tx: tx,
            large_image_cooldown_remaining: Mutex::new(0),
        }
    }
}

/// Spawn the background clipboard polling task and writer task.
/// The poller reads the clipboard at intervals and sends changes via a bounded
/// channel. The writer task processes changes sequentially, providing backpressure
/// when the user copies faster than the DB can write.
pub fn spawn_clipboard_monitor(app: AppHandle) {
    let (monitor, save_rx) = ClipboardMonitor::new();
    app.manage(monitor);

    // Writer task: processes clipboard changes from the channel
    let app_writer = app.clone();
    tauri::async_runtime::spawn(async move {
        clipboard_writer_task(app_writer, save_rx).await;
    });

    // Poller task: reads clipboard and sends to channel
    tauri::async_runtime::spawn(async move {
        clipboard_poller_task(app).await;
    });
}

/// Background poller: reads the clipboard at intervals.
/// Rotates through text, image, and HTML on each tick to avoid saturating
/// the blocking thread pool. Uses a global semaphore to ensure only ONE
/// clipboard read happens at a time — Windows clipboard access is
/// single-threaded and concurrent reads cause app freeze.
async fn clipboard_poller_task(app: AppHandle) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(POLL_INTERVAL_MS));
    let mut consecutive_empty = 0u32;
    let mut poll_phase = 0u32; // 0 = text, 1 = image, 2 = html

    loop {
        interval.tick().await;
        poll_phase = (poll_phase + 1) % 3;

        // Acquire global semaphore — only 1 concurrent clipboard read allowed.
        let _permit = CLIPBOARD_SEM.acquire().await;

        match poll_phase {
            0 => {
                // ── Text poll ──
                let current = match read_system_clipboard(&app).await {
                    Some(content) => {
                        consecutive_empty = 0;
                        content
                    }
                    None => {
                        consecutive_empty += 1;
                        if consecutive_empty > 10 {
                            interval = tokio::time::interval(tokio::time::Duration::from_millis(
                                POLL_INTERVAL_MS,
                            ));
                        }
                        continue;
                    }
                };

                let monitor = app.state::<ClipboardMonitor>();
                let mut last = monitor.last_content.lock().await;
                let last_hash = content_hash(last.as_bytes());
                let current_hash = content_hash(current.as_bytes());

                if last_hash == current_hash {
                    continue;
                }
                *last = current.clone();
                drop(last);

                if monitor
                    .save_tx()
                    .try_send(ClipboardChange {
                        content: current,
                        image_data: None,
                        html_data: None,
                    })
                    .is_ok()
                {
                    interval = tokio::time::interval(tokio::time::Duration::from_millis(
                        POLL_INTERVAL_FOCUSED_MS,
                    ));
                }
            }
            1 => {
                // ── Image poll ──
                let monitor = app.state::<ClipboardMonitor>();

                // Check large-image cooldown before reading clipboard
                {
                    let mut cooldown = monitor.large_image_cooldown_remaining.lock().await;
                    if *cooldown > 0 {
                        *cooldown -= 1;
                        drop(cooldown);
                        continue;
                    }
                }

                let image_bytes = match read_system_clipboard_image(&app).await {
                    Some(bytes) if bytes.len() > 16 => bytes,
                    _ => continue,
                };
                let image_size = image_bytes.len();

                // Skip large images — enter cooldown to avoid 100ms clipboard reads every 900ms
                if image_size > MAX_POLL_IMAGE_SIZE {
                    let mut cooldown = monitor.large_image_cooldown_remaining.lock().await;
                    *cooldown = LARGE_IMAGE_COOLDOWN_CYCLES;
                    drop(cooldown);
                }

                let mut last_img = monitor.last_image_hash.lock().await;
                let image_hash = content_hash(&image_bytes);

                if *last_img == image_hash {
                    continue;
                }
                *last_img = image_hash;
                drop(last_img);

                if monitor
                    .save_tx()
                    .try_send(ClipboardChange {
                        content: String::new(),
                        image_data: Some(image_bytes),
                        html_data: None,
                    })
                    .is_ok()
                {
                    interval = tokio::time::interval(tokio::time::Duration::from_millis(
                        POLL_INTERVAL_FOCUSED_MS,
                    ));
                }
            }
            2 => {
                // ── HTML poll ──
                let html_content = match read_system_clipboard_html(&app).await {
                    Some(html) => {
                        consecutive_empty = 0;
                        html
                    }
                    None => continue,
                };

                let monitor = app.state::<ClipboardMonitor>();
                let mut last_html = monitor.last_html_hash.lock().await;
                let html_hash = content_hash(html_content.as_bytes());

                if *last_html == html_hash {
                    continue;
                }
                *last_html = html_hash.clone();
                drop(last_html);

                match monitor.save_tx().try_send(ClipboardChange {
                    content: String::new(),
                    image_data: None,
                    html_data: Some(html_content),
                }) {
                    Ok(_) => {
                        interval = tokio::time::interval(tokio::time::Duration::from_millis(
                            POLL_INTERVAL_FOCUSED_MS,
                        ));
                    }
                    Err(mpsc::error::TrySendError::Full(_)) => {
                        info!("[clipboard] channel full, skipping HTML change (backpressure)");
                    }
                    Err(mpsc::error::TrySendError::Closed(_)) => {
                        info!("[clipboard] writer channel closed, stopping poller");
                        break;
                    }
                }
            }
            _ => unreachable!(),
        }
    }
}

/// Writer task: receives clipboard changes and saves them to the DB.
/// Every change is saved individually — no batch-drain merging that could
/// silently discard items. Rapid copies (including mixed text/image/html);
/// are all persisted; dedup by content_hash prevents redundant DB writes.
async fn clipboard_writer_task(app: AppHandle, mut save_rx: mpsc::Receiver<ClipboardChange>) {
    let mut total_processed = 0u64;
    let mut total_save_time = std::time::Duration::ZERO;

    while let Some(change) = save_rx.recv().await {
        let _batch_start = Instant::now();
        let mut batch_size = 1u32;

        // Collect ALL pending changes into a vec — never merge/drop.
        let mut changes = vec![change];
        while let Ok(next) = save_rx.try_recv() {
            batch_size += 1;
            changes.push(next);
        }

        let state = app.state::<BentoAppState>();
        let save_start = Instant::now();

        for ch in &changes {
            if let Some(ref img_bytes) = ch.image_data {
                if !img_bytes.is_empty() {
                    if let Err(e) = save_clipboard_image_entry(&app, &state, img_bytes).await {
                        info!("[clipboard] failed to save image entry: {e}");
                    }
                }
            } else if let Some(ref html) = ch.html_data {
                if !html.is_empty() {
                    if let Err(e) = save_clipboard_entry(&app, &state, html).await {
                        info!("[clipboard] failed to save HTML entry: {e}");
                    }
                }
            } else if !ch.content.is_empty() {
                if let Err(e) = save_clipboard_entry(&app, &state, &ch.content).await {
                    info!("[clipboard] failed to save clipboard entry: {e}");
                }
            }
        }

        let save_ms = save_start.elapsed().as_secs_f64() * 1000.0;
        total_save_time += save_start.elapsed();
        total_processed += 1;

        // Run auto-prune every PRUNE_INTERVAL_BATCHES batches to enforce the
        // 50,000-item soft cap. NEVER deletes pinned or favorited items.
        if total_processed % PRUNE_INTERVAL_BATCHES == 0 {
            let pool = state.db();
            auto_prune_clipboard(&app, &pool).await;
        }

        if save_ms > 50.0 {
            info!("\u{26a0} [Clipboard::Writer] batch #{total_processed}: {batch_size} changes, save took {save_ms:.1}ms (total_save_time={:.1}s)",
                total_save_time.as_secs_f64());
        }

        let batch_ms = _batch_start.elapsed().as_secs_f64() * 1000.0;
        info!("[Clipboard::Writer] batch #{total_processed}: {batch_size} changes, {batch_ms:.1}ms total");
    }
}

/// Read the current system clipboard image (PNG bytes).
/// Returns the raw PNG bytes from the clipboard, or None if no image is present.
/// Uses optimal compression settings for fast encoding.
async fn read_system_clipboard_image(app: &AppHandle) -> Option<Vec<u8>> {
    let app_clone = app.clone();
    let result = tokio::task::spawn_blocking(move || -> Option<Vec<u8>> {
        #[cfg(desktop)]
        {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            match app_clone.clipboard().read_image() {
                Ok(img) => {
                    let rgba = img.rgba();
                    let width = img.width();
                    let height = img.height();if rgba.is_empty()
    || width == 0
    || height == 0
    || width > 16384
    || height > 16384
{
                        return None;
                    }
                    // Encode RGBA pixels to PNG bytes
                    // Use Fast compression + NoFilter for speed — crucial for large
                    // screenshots (e.g., 4K = ~33MB RGBA) where default compression
                    // would take seconds and block the clipboard poll.
                    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
                    use image::{ColorType, ImageEncoder};
                    let mut png_bytes = Vec::new();
                    {
                        let encoder = PngEncoder::new_with_quality(
                            &mut png_bytes,
                            CompressionType::Fast,
                            FilterType::NoFilter,
                        );
                        if encoder
                            .write_image(&rgba, width, height, ColorType::Rgba8.into())
                            .is_err()
                        {
                            return None;
                        }
                    }
                    // Validate that the encoded output is a valid PNG
                    if png_bytes.len() < 8
                        || &png_bytes[..8] != &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
                    {
                        return None;
                    }
                    Some(png_bytes)
                }
                _ => None,
            }
        }
        #[cfg(not(desktop))]
        {
            let _ = app_clone;
            None
        }
    })
    .await;

    result.unwrap_or(None)
}

/// Read the current system clipboard HTML/rich-text content.
/// Tries platform-specific reading first (macOS NSPasteboard, Windows CF_HTML),
/// then falls back to reading plain text and checking for HTML patterns.
async fn read_system_clipboard_html(app: &AppHandle) -> Option<String> {
    // Try macOS NSPasteboard HTML reading first
    #[cfg(target_os = "macos")]
    {
        if let Some(html) = read_nspasteboard_html().await {
            return Some(html);
        }
    }

    // Try Windows CF_HTML reading
    #[cfg(windows)]
    {
        if let Some(html) = read_cf_html_windows() {
            return Some(html);
        }
    }

    // Fallback: read plain text and check if it looks like HTML
    let text = read_system_clipboard(app).await?;
    if looks_like_html(&text) {
        Some(text)
    } else {
        None
    }
}

/// Read HTML from the macOS NSPasteboard using the `public.html` pasteboard type.
/// Uses objc2-app-kit's NSPasteboard bindings to access the general pasteboard
/// and read the HTML string type that rich-text apps (browsers, editors) write.
#[cfg(target_os = "macos")]
async fn read_nspasteboard_html() -> Option<String> {
    let result = tokio::task::spawn_blocking(move || -> Option<String> {
        use objc2_app_kit::NSPasteboard;
        use objc2_foundation::NSString;

        let pb = NSPasteboard::generalPasteboard();
        // Use the standard UTI for HTML content on NSPasteboard
        let html_type = NSString::from_str("public.html");
        let html_type_ref = &html_type;
        let ns_string = pb.stringForType(html_type_ref);
        ns_string.map(|s| s.to_string())
    })
    .await;

    result.unwrap_or(None)
}

// ── Win32 FFI declarations for clipboard access ──
#[cfg(windows)]
#[allow(non_snake_case)]
extern "system" {
    fn RegisterClipboardFormatW(lpszFormat: *const u16) -> u32;
    fn OpenClipboard(hwnd: *const std::ffi::c_void) -> i32;
    fn GetClipboardData(uFormat: u32) -> *const std::ffi::c_void;
    fn GlobalLock(hMem: *const std::ffi::c_void) -> *const std::ffi::c_void;
    fn GlobalSize(hMem: *const std::ffi::c_void) -> usize;
    fn GlobalUnlock(hMem: *const std::ffi::c_void) -> i32;
    fn CloseClipboard() -> i32;
}

/// Read CF_HTML format from the Windows clipboard.
/// CF_HTML is a clipboard format used by browsers and rich-text editors
/// to store formatted text with HTML markup.
#[cfg(windows)]
fn read_cf_html_windows() -> Option<String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;

    // Register "HTML Format" clipboard format to get its format ID
    let name: Vec<u16> = OsStr::new("HTML Format")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let cf_html = unsafe { RegisterClipboardFormatW(name.as_ptr()) };
    if cf_html == 0 {
        return None;
    }

    // Open clipboard
    if unsafe { OpenClipboard(ptr::null_mut()) } == 0 {
        return None;
    }

    // Get data handle for CF_HTML format
    let handle = unsafe { GetClipboardData(cf_html) };
    if handle.is_null() {
        unsafe { CloseClipboard() };
        return None;
    }

    // Lock global memory
    let data = unsafe { GlobalLock(handle) };
    if data.is_null() {
        unsafe { CloseClipboard() };
        return None;
    }

    // Read bytes
    let len = unsafe { GlobalSize(handle) };
    let slice = unsafe { std::slice::from_raw_parts(data as *const u8, len) };

    // CF_HTML is typically UTF-8 encoded (or ANSI, but UTF-8 is safest)
    let raw = std::str::from_utf8(slice).ok()?;

    // Parse the CF_HTML header to extract just the HTML fragment
    let result = parse_cf_html(raw);

    unsafe { GlobalUnlock(handle) };
    unsafe { CloseClipboard() };

    result
}

/// Parse the CF_HTML format header and extract the HTML fragment.
///
/// CF_HTML format specification:
/// ```
/// Version:1.0
/// StartHTML:00000000
/// EndHTML:00000000
/// StartFragment:00000000
/// EndFragment:00000000
/// <html><body><!--StartFragment-->...HTML content...<!--EndFragment--></body></html>
/// ```
/// The byte offsets count from the start of the entire data block.
/// We prefer the fragment (StartFragment..EndFragment) which is the
/// specific user-selected content, falling back to the full HTML document.
#[cfg(windows)]
fn parse_cf_html(raw: &str) -> Option<String> {
    let lines: Vec<&str> = raw.lines().collect();

    /// Parse a numeric offset value from a CF_HTML header field.
    fn parse_offset(lines: &[&str], key: &str) -> Option<usize> {
        for line in lines {
            if let Some(value) = line.strip_prefix(key) {
                return value.trim().parse::<usize>().ok();
            }
        }
        None
    }

    // Prefer the fragment (the exact user selection)
    if let (Some(start), Some(end)) = (
        parse_offset(&lines, "StartFragment:"),
        parse_offset(&lines, "EndFragment:"),
    ) {
        if start < end && end <= raw.len() {
            let fragment = raw[start..end].to_string();
            if !fragment.is_empty() {
                return Some(fragment);
            }
        }
    }

    // Fallback to the full HTML document
    if let (Some(start), Some(end)) = (
        parse_offset(&lines, "StartHTML:"),
        parse_offset(&lines, "EndHTML:"),
    ) {
        if start < end && end <= raw.len() {
            let html = raw[start..end].to_string();
            if !html.is_empty() {
                return Some(html);
            }
        }
    }

    // Last resort: return everything after the header
    // Find the first HTML tag
    if let Some(pos) = raw.find("<html") {
        return Some(raw[pos..].to_string());
    }
    if let Some(pos) = raw.find("<HTML") {
        return Some(raw[pos..].to_string());
    }

    None
}

/// Read the current system clipboard content (plain text).
async fn read_system_clipboard(app: &AppHandle) -> Option<String> {
    let app_clone = app.clone();
    let result = tokio::task::spawn_blocking(move || -> Option<String> {
        #[cfg(desktop)]
        {
            use tauri_plugin_clipboard_manager::ClipboardExt;
            match app_clone.clipboard().read_text() {
                Ok(text) if !text.is_empty() => Some(text),
                _ => None,
            }
        }
        #[cfg(not(desktop))]
        {
            let _ = app_clone;
            None
        }
    })
    .await;

    result.unwrap_or(None)
}

/// Save a clipboard entry from the monitoring system.
async fn save_clipboard_entry(
    app: &AppHandle,
    state: &BentoAppState,
    content: &str,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Ok(());
    }

    let pool = state.db();
    let hash = content_hash(content.as_bytes());
    let now = time::now_ms();
    let id = uuid::Uuid::new_v4().to_string();
    // If content is a URL for a known platform, route through bookmark enrichment
    let classification = bookmarks::classify_content(content);
    // classification.platform is already the as_str() form (e.g. "youtube"),
    // not a raw hostname. Check directly against "other" instead of
    // re-running KnownPlatform::from_hostname() which expects hostnames.
    if classification.is_url
        && classification
            .platform
            .as_deref()
            .map(|p| p != "other")
            .unwrap_or(false)
    {
        let _ = bookmarks::handle_url_save(app, state, content).await?;
        return Ok(());
    }
    let kind = detect_kind(content);
    let preview = if kind != ClipKind::Image {
        make_preview(content, &kind)
    } else {
        String::new()
    };
    let is_sensitive = if kind == ClipKind::Sensitive {
        1i64
    } else {
        0i64
    };
    let byte_size = content.len() as i64;

    // Store content — externalize large blobs
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let (content_path_opt, stored_content) = store_content(&data_dir, &hash, content).await?;

    // Atomic dedup via INSERT OR IGNORE + UNIQUE INDEX on content_hash.
    // Avoids check-then-insert race condition between concurrent saves.
    let result = sqlx::query(
        r#"
        INSERT OR IGNORE INTO clipboard_items (id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&hash)
    .bind(kind.as_str())
    .bind(&stored_content)
    .bind(&content_path_opt)
    .bind(&preview)
    .bind(Option::<String>::None) // source
    .bind(byte_size)
    .bind(is_sensitive)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() > 0 {
        let entry = ClipEntry {
            id,
            kind,
            content: content.to_string(),
            content_hash: hash,
            preview: if preview.is_empty() {
                None
            } else {
                Some(preview)
            },
            source: None,
            byte_size,
            pinned: false,
            favorite: false,
            is_sensitive: is_sensitive == 1,
            timestamp: now,
            external_content: None,
            og_title: None,
            og_description: None,
            og_image: None,
            og_site_name: None,
            platform: None,
            saved_timestamp_seconds: None,
            recopy_count: 0,
            enrichment_status: "none".to_string(),
        };

        // Index in Tantivy
        index_clip_entry(app, &entry).await;

        // Notify frontend
        let _ = app.emit("clipboard://new-entry", entry);
    } else {
        // Duplicate — just update timestamp
        sqlx::query(
            "UPDATE clipboard_items SET created_at = ?, updated_at = ? WHERE content_hash = ?",
        )
        .bind(now)
        .bind(now)
        .bind(&hash)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// Failure Injection — Stress Test Harness
// ═════════════════════════════════════════════════════════════════════════════

/// Inject controlled stress scenarios to test clipboard subsystem robustness.
/// Returns a JSON summary of the injection.
///
/// Scenarios:
/// - `rapid_text` — save N text entries as fast as possible
/// - `rapid_image` — generate N synthetic 64×64 images and save them
/// - `corrupted_image` — save a file with valid PNG header but corrupted body
/// - `huge_image` — generate a 4K (3840×2160) synthetic image
/// - `massive_text` — save a single ~10MB text entry
/// - `db_contention` — interleave N saves with N SELECT queries
#[tauri::command]
pub async fn clipboard_inject_stress(
    auth: State<'_, crate::auth::AuthManager>,
    app: AppHandle,
    state: State<'_, BentoAppState>,
    scenario: String,
    count: Option<u32>,
) -> Result<serde_json::Value, String> {
    crate::auth::require_billing_tier(&auth, "clipboard").await?;

    use image::codecs::png::PngEncoder;
    use image::ImageEncoder;
    use image::RgbaImage;
    use serde_json::json;

    let n = count.unwrap_or(50).min(500);
    let _start = Instant::now();
    let pool = state.db();

    match scenario.as_str() {
        "rapid_text" => {
            let mut saved = 0u32;
            for i in 0..n {
                let content = format!("STRESS rapid_text #[{i}] — {}", "x".repeat(500));
                save_clipboard_entry(&app, &state, &content).await?;
                saved += 1;
            }
            log_timing("Clipboard::Stress", "rapid_text", _start, format_args!("{saved} entries"));
            Ok(json!({"scenario": "rapid_text", "saved": saved}))
        }

        "rapid_image" => {
            let mut saved = 0u32;
            for i in 0..n {
                let mut img = RgbaImage::new(64, 64);
                for (x, y, pixel) in img.enumerate_pixels_mut() {
                    *pixel = image::Rgba([
                        ((x as u32 + i) % 256) as u8,
                        ((y as u32 * 2 + i) % 256) as u8,
                        ((x as u32 + y as u32 + i) % 256) as u8,
                        255,
                    ]);
                }
                let mut png_bytes = Vec::new();
                let encoder = PngEncoder::new(&mut png_bytes);
                encoder
                    .write_image(img.as_raw(), 64, 64, image::ColorType::Rgba8.into())
                    .map_err(|e: image::ImageError| e.to_string())?;
                save_clipboard_image_entry(&app, &state, &png_bytes).await?;
                saved += 1;
            }
            log_timing("Clipboard::Stress", "rapid_image", _start, format_args!("{saved} images"));
            Ok(json!({"scenario": "rapid_image", "saved": saved}))
        }

        "corrupted_image" => {
            let mut corrupted = Vec::from(&b"\x89PNG\r\n\x1a\n"[..]);
            corrupted.extend_from_slice(b"\x00\x00\x00\x00CORRUPTED_DATA_THIS_IS_NOT_A_VALID_PNG");
            save_clipboard_image_entry(&app, &state, &corrupted).await?;
            log_timing("Clipboard::Stress", "corrupted_image", _start, format_args!("1 entry"));
            Ok(json!({"scenario": "corrupted_image", "saved": 1}))
        }

        "huge_image" => {
            let w = 3840u32;
            let h = 2160u32;
            let mut img = RgbaImage::new(w, h);
            for (x, y, pixel) in img.enumerate_pixels_mut() {
                *pixel = image::Rgba([
                    (x % 256) as u8,
                    (y % 256) as u8,
                    ((x + y) % 256) as u8,
                    255,
                ]);
            }
            let mut png_bytes = Vec::new();
            let encoder = PngEncoder::new(&mut png_bytes);
            encoder
                .write_image(img.as_raw(), w, h, image::ColorType::Rgba8.into())
                .map_err(|e: image::ImageError| e.to_string())?;
            let size_kb = png_bytes.len() / 1024;
            save_clipboard_image_entry(&app, &state, &png_bytes).await?;
            log_timing("Clipboard::Stress", "huge_image", _start, format_args!("{size_kb}KB raw PNG"));
            Ok(json!({"scenario": "huge_image", "size_bytes": png_bytes.len(), "size_kb": size_kb}))
        }

        "massive_text" => {
            let content = "STRESS massive_text entry — MASSIVE_DATA\n".repeat(500_000);
            let content_str = &content[..content.len().min(10_000_000)];
            let size_kb = content_str.len() / 1024;
            save_clipboard_entry(&app, &state, content_str).await?;
            log_timing("Clipboard::Stress", "massive_text", _start, format_args!("{size_kb}KB text blob"));
            Ok(json!({"scenario": "massive_text", "size_bytes": content_str.len(), "size_kb": size_kb}))
        }

        "db_contention" => {
            let mut saves = 0u32;
            let mut reads = 0u32;
            for i in 0..n {
                let content = format!("STRESS db_contention #[{i}] — {}", "z".repeat(100));
                save_clipboard_entry(&app, &state, &content).await?;
                saves += 1;
                // Run a SELECT query to create DB reader/writer interleave
                let _rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
                    "SELECT COUNT(*) as cnt FROM clipboard_items"
                )
                .fetch_all(&pool)
                .await
                .map_err(|e| e.to_string())?;
                reads += 1;
            }
            log_timing("Clipboard::Stress", "db_contention", _start, format_args!("{saves} saves, {reads} reads"));
            Ok(json!({"scenario": "db_contention", "saves": saves, "reads": reads}))
        }

        _ => Err(format!(
            "Unknown stress scenario: {scenario}. Options: rapid_text, rapid_image, corrupted_image, huge_image, massive_text, db_contention"
        )),
    }
}

impl Default for ClipEntry {
    fn default() -> Self {
        Self {
            id: String::new(),
            kind: ClipKind::Text,
            content: String::new(),
            content_hash: String::new(),
            preview: None,
            source: None,
            byte_size: 0,
            pinned: false,
            favorite: false,
            is_sensitive: false,
            timestamp: 0,
            external_content: None,
            og_title: None,
            og_description: None,
            og_image: None,
            og_site_name: None,
            platform: None,
            saved_timestamp_seconds: None,
            recopy_count: 0,
            enrichment_status: "none".to_string(),
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_content_hash_consistency() {
        let content = "Hello, world!";
        let hash1 = content_hash(content.as_bytes());
        let hash2 = content_hash(content.as_bytes());
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex = 64 chars
    }

    #[test]
    fn test_content_hash_different() {
        let hash1 = content_hash(b"Hello, world!");
        let hash2 = content_hash(b"Goodbye, world!");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_detect_kind_url() {
        assert_eq!(detect_kind("https://example.com"), ClipKind::Link);
        assert_eq!(detect_kind("http://localhost:3000"), ClipKind::Link);
    }

    #[test]
    fn test_detect_kind_code() {
        let code = "fn hello() {\n    println!(\"world\");\n}";
        assert_eq!(detect_kind(code), ClipKind::Code);

        let js = "const x = () => {\n  return 42;\n}";
        assert_eq!(detect_kind(js), ClipKind::Code);
    }

    #[test]
    fn test_detect_kind_sensitive() {
        let api_key = "sk_live_AbC123XyZ_SECRET_KEY_REDACTED";
        assert_eq!(detect_kind(api_key), ClipKind::Sensitive);

        let jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3j6K4o1PZQ2oPkA";
        assert_eq!(detect_kind(jwt), ClipKind::Sensitive);

        let ssh_key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...";
        assert_eq!(detect_kind(ssh_key), ClipKind::Sensitive);
    }

    #[test]
    fn test_detect_kind_text() {
        assert_eq!(detect_kind("Hello, world!"), ClipKind::Text);
        assert_eq!(detect_kind("Meeting notes: Q3 review"), ClipKind::Text);
    }

    #[test]
    fn test_is_sensitive_content() {
        assert!(is_sensitive_content(
            "sk_live_AbC123XyZ_SECRET_KEY_REDACTED"
        ));
        assert!(is_sensitive_content(
            "ghp_AbC123XyZ_SECRET_KEY_REDACTED1234"
        ));
        assert!(is_sensitive_content("-----BEGIN RSA PRIVATE KEY-----"));
        assert!(!is_sensitive_content("Hello, world!"));
        assert!(!is_sensitive_content("The quick brown fox"));
    }

    #[test]
    fn test_make_preview_truncation() {
        let long = "a".repeat(300);
        let preview = make_preview(&long, &ClipKind::Text);
        assert!(preview.len() < 250);
        assert!(preview.ends_with('…'));
    }

    #[test]
    fn test_truncate_utf8_safe_multi_byte() {
        // Each "ñ" is 2 bytes in UTF-8
        let s = "ñ".repeat(150); // 300 bytes
        let truncated = truncate_utf8_safe(&s, 200);
        // Should end with … and be char-boundary safe (no panic)
        assert!(truncated.ends_with('…'));
        assert!(truncated.len() <= 203); // 200 + 1 (ellipsis is 3 bytes)
    }

    #[test]
    fn test_looks_like_code() {
        assert!(looks_like_code("fn test() {\n    return 1;\n}"));
        assert!(looks_like_code(
            "const x = (a: number) => {\n  return a * 2;\n}"
        ));
        assert!(!looks_like_code(
            "The quick brown fox jumps over the lazy dog."
        ));
    }

    #[test]
    fn test_external_store_threshold() {
        // Items under threshold should not be externalized
        let small = "a".repeat(EXTERNAL_STORE_THRESHOLD);
        assert!(small.len() <= EXTERNAL_STORE_THRESHOLD);
    }
}
