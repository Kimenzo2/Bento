// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═════════════════════════════════════════════════════════════════════════════
// Bookmarking Layer — Social/Content Platform URL Enrichment
//
// This module extends the Clipboard Manager with bookmark-specific behavior:
//   - URL classification by known platform (Are.na, Cosmos, Instagram, X,
//     YouTube, Reddit, Threads, TikTok)
//   - URL normalization (strip tracking params) for cross-session dedup
//   - OpenGraph enrichment (title, description, image, site_name)
//   - Platform-specific parsing (YouTube timestamps, Reddit comments)
//   - Recopy detection with re-surfacing toast notifications
//
// All enrichment is async and non-blocking — the clipboard entry is saved
// first, then enrichment fires as a background Tokio task.
// ═════════════════════════════════════════════════════════════════════════════

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{Mutex, Semaphore};

use crate::db::BentoAppState;
use crate::search::{SearchDocument, SearchService};
use crate::util::time;

// ─── Constants ───────────────────────────────────────────────────────────────

/// Minimum age (days) for an item to trigger a re-surface notification on recopy.
const RE_SURFACE_MIN_AGE_DAYS: i64 = 7;
/// Milliseconds per day.
const MS_PER_DAY: i64 = 86_400_000;
/// Maximum re-surface toasts per day (same throttle as Rhythm Engine).
const MAX_RESURFACE_TOASTS_PER_DAY: u32 = 2;

// ─── Shared HTTP Client ──────────────────────────────────────────────────────

/// Reusable reqwest Client with consistent timeout, user-agent, and TLS config.
/// Using a static LazyLock avoids creating a new Client on every enrichment call,
/// which saves on TCP connection overhead and DNS resolution.
static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Bento/1.0 (Bookmark Enrichment)")
        .danger_accept_invalid_certs(false)
        .pool_max_idle_per_host(4)
        .build()
        .unwrap_or_else(|e| {
            eprintln!("[bookmarks] failed to build HTTP client (TLS backend likely missing), using default: {e}");
            reqwest::Client::new()
        })
});
// ─── URL Classification ──────────────────────────────────────────────────────

/// Known content/social platforms.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum KnownPlatform {
    Arena,
    Cosmos,
    Instagram,
    Twitter,
    Youtube,
    Reddit,
    Threads,
    Tiktok,
    Other,
}

impl KnownPlatform {
    pub fn as_str(&self) -> &'static str {
        match self {
            KnownPlatform::Arena => "arena",
            KnownPlatform::Cosmos => "cosmos",
            KnownPlatform::Instagram => "instagram",
            KnownPlatform::Twitter => "twitter",
            KnownPlatform::Youtube => "youtube",
            KnownPlatform::Reddit => "reddit",
            KnownPlatform::Threads => "threads",
            KnownPlatform::Tiktok => "tiktok",
            KnownPlatform::Other => "other",
        }
    }

    pub fn from_hostname(hostname: &str) -> Self {
        match hostname.to_ascii_lowercase().as_str() {
            "arena.na" => KnownPlatform::Arena,
            "cosmos.so" => KnownPlatform::Cosmos,
            "instagram.com" => KnownPlatform::Instagram,
            "x.com" | "twitter.com" => KnownPlatform::Twitter,
            "youtube.com" | "youtu.be" => KnownPlatform::Youtube,
            "reddit.com" => KnownPlatform::Reddit,
            "threads.net" => KnownPlatform::Threads,
            "tiktok.com" => KnownPlatform::Tiktok,
            _ => KnownPlatform::Other,
        }
    }

    /// Known platforms that Bento specifically tracks (all except Other).
    pub fn is_known(&self) -> bool {
        !matches!(self, KnownPlatform::Other)
    }
}

/// URL classification metadata.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UrlClassification {
    pub is_url: bool,
    pub platform: Option<String>,
}

/// Enrichment state for bookmark items.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum EnrichmentStatus {
    None,
    Pending,
    Completed,
    Failed,
}

impl EnrichmentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            EnrichmentStatus::None => "none",
            EnrichmentStatus::Pending => "pending",
            EnrichmentStatus::Completed => "completed",
            EnrichmentStatus::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => EnrichmentStatus::Pending,
            "completed" => EnrichmentStatus::Completed,
            "failed" => EnrichmentStatus::Failed,
            _ => EnrichmentStatus::None,
        }
    }
}

/// Parsed OpenGraph / enrichment data stored on the clipboard row.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkEnrichment {
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image: Option<String>,
    pub og_site_name: Option<String>,
    pub saved_timestamp_seconds: Option<i64>,
    pub platform: Option<String>,
}

// ─── URL Detection ───────────────────────────────────────────────────────────

/// Lazy regex for URL detection.
static URL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^https?://[^\s/$.?#].[^\s]*$").unwrap());

/// Check if content is a URL.
pub fn is_url(content: &str) -> bool {
    URL_RE.is_match(content.trim())
}

/// Extract the hostname from a URL string.
pub fn url_to_hostname(url_str: &str) -> Option<String> {
    url::Url::parse(url_str.trim()).ok().map(|u| {
        let host = u.host_str().unwrap_or("");
        host.trim_start_matches("www.").to_string()
    })
}

/// Classify clipboard content — returns classification metadata.
pub fn classify_content(content: &str) -> UrlClassification {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return UrlClassification::default();
    }
    if is_url(trimmed) {
        let platform =
            url_to_hostname(trimmed).map(|h| KnownPlatform::from_hostname(&h).as_str().to_string());
        return UrlClassification {
            is_url: true,
            platform,
        };
    }
    UrlClassification::default()
}

// ─── URL Normalization ───────────────────────────────────────────────────────

/// Known tracking parameters to strip during URL normalization.
const TRACKING_PARAMS: &[&str] = &[
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "gbraid",
    "wbraid",
    "msclkid",
    "ref",
    "source",
    "si",
    "igsh",
    "mc_cid",
    "mc_eid",
    "_ga",
    "_gl",
    "_hsmi",
    "_hsenc",
];

/// Normalize a URL by stripping tracking parameters.
/// Returns the normalized URL string.
pub fn normalize_url(url_str: &str) -> String {
    let trimmed = url_str.trim();
    match url::Url::parse(trimmed) {
        Ok(mut parsed) => {
            // Collect non-tracking params from the decoded query pairs,
            // then rebuild the query using query_pairs_mut() which handles
            // percent-encoding of values correctly (fixes corruption when
            // values contain '&', '#', etc.).
            let keep_pairs: Vec<(String, String)> = parsed
                .query_pairs()
                .filter(|(key, _)| !TRACKING_PARAMS.contains(&key.as_ref()))
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();
            {
                let mut pairs = parsed.query_pairs_mut();
                pairs.clear();
                for (key, value) in &keep_pairs {
                    pairs.append_pair(key, value);
                }
            }
            // Strip fragment (#...) for canonical normalization
            parsed.set_fragment(None);
            // Normalize host: lowercase (already done by url crate) + strip www.
            // Clone host_str to avoid borrow conflict with set_host.
            let wwwless = parsed
                .host_str()
                .map(|h| h.trim_start_matches("www.").to_string());
            if let Some(host) = wwwless {
                let _ = parsed.set_host(Some(&host));
            }
            parsed.to_string()
        }
        Err(_) => trimmed.to_string(),
    }
}

/// Compute a normalized content hash for URL dedup.
/// Strips tracking params before hashing so the same URL with different
/// tracking is treated as a recopy rather than a new item.
pub fn normalized_url_hash(url_str: &str) -> String {
    use sha2::{Digest, Sha256};
    let normalized = normalize_url(url_str);
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    hex::encode(hasher.finalize())
}

// ─── OpenGraph Enrichment ────────────────────────────────────────────────────

/// Fetch a URL and extract OpenGraph metadata.
/// Returns None if fetching fails or no OG tags are found.
pub async fn fetch_opengraph(url_str: &str) -> Option<BookmarkEnrichment> {
    let resp = HTTP_CLIENT.get(url_str).send().await.ok()?;
    let status = resp.status();
    if !status.is_success() {
        eprintln!("[bookmarks] OG fetch returned {status} for {url_str}");
        return None;
    }

    let html = resp.text().await.ok()?;

    // Parse OpenGraph meta tags from the HTML
    // Pre-compute the lowercased HTML once to avoid 4 separate heap allocations.
    let html_lower = html.to_ascii_lowercase();
    let og_title = extract_og_tag(&html, &html_lower, "og:title");
    let og_description = extract_og_tag(&html, &html_lower, "og:description");
    let og_image = extract_og_tag(&html, &html_lower, "og:image");
    let og_site_name = extract_og_tag(&html, &html_lower, "og:site_name");

    // YouTube-specific: extract timestamp from URL
    let saved_timestamp_seconds = if url_str.contains("youtube.com") || url_str.contains("youtu.be")
    {
        parse_youtube_timestamp(url_str)
    } else {
        None
    };

    Some(BookmarkEnrichment {
        og_title,
        og_description,
        og_image,
        og_site_name,
        saved_timestamp_seconds,
        platform: url_to_hostname(url_str)
            .map(|h| KnownPlatform::from_hostname(&h).as_str().to_string()),
    })
}

/// Extract a meta tag's `content` attribute by property name.
/// Handles `<meta property="og:..." content="..." />` and
/// `<meta name="og:..." content="..." />` patterns.
/// Accepts a pre-lowercased copy of the HTML for case-insensitive searching
/// while extracting values from the original HTML to preserve character case.
/// Handles double-quoted (`content="..."`), single-quoted (`content='...'`),
/// and unquoted (`content=value`) attribute syntax.
fn extract_og_tag(html: &str, html_lower: &str, property: &str) -> Option<String> {
    let prop_lower = property.to_ascii_lowercase();
    // Pattern 1: <meta property="og:..." content="..." />
    let prop_pattern = format!("property=\"{}\"", prop_lower);
    // Pattern 2: <meta name="og:..." content="..." />
    let name_pattern = format!("name=\"{}\"", prop_lower);

    for pattern in &[&prop_pattern, &name_pattern] {
        if let Some(start) = html_lower.find(*pattern) {
            // Look for content=... after the property/name pattern
            // Search in the original HTML (preserving case) starting from `start`
            let after = &html[start..];
            if let Some(content_start) = after.to_ascii_lowercase().find("content=") {
                let val_area = &after[content_start + 8..]; // skip "content="
                let trimmed = val_area.trim_start();
                if trimmed.is_empty() {
                    continue;
                }
                match trimmed.as_bytes()[0] {
                    b'"' => {
                        // Double-quoted: content="..."
                        let inner = &trimmed[1..];
                        if let Some(end) = inner.find('"') {
                            let value = inner[..end].to_string();
                            if !value.is_empty() {
                                return Some(value);
                            }
                        }
                    }
                    b'\'' => {
                        // Single-quoted: content='...'
                        let inner = &trimmed[1..];
                        if let Some(end) = inner.find('\'') {
                            let value = inner[..end].to_string();
                            if !value.is_empty() {
                                return Some(value);
                            }
                        }
                    }
                    _ => {
                        // Unquoted: content=value (until whitespace or >)
                        let value: String = trimmed
                            .chars()
                            .take_while(|c| !c.is_whitespace() && *c != '>')
                            .collect();
                        if !value.is_empty() {
                            return Some(value);
                        }
                    }
                }
            }
        }
    }
    None
}

/// Parse a YouTube URL for a timestamp parameter (`t=` or `start=`).
fn parse_youtube_timestamp(url_str: &str) -> Option<i64> {
    let parsed = url::Url::parse(url_str).ok()?;
    for (key, value) in parsed.query_pairs() {
        match key.as_ref() {
            "t" | "start" => {
                let ts_str = value.trim();
                // Handle formats: "123", "1m30s", "1h2m30s"
                if let Ok(seconds) = ts_str.parse::<i64>() {
                    return Some(seconds);
                }
                // Parse duration format like "1m30s"
                return parse_duration_str(ts_str);
            }
            _ => continue,
        }
    }
    None
}

/// Parse a duration string like "1m30s" or "1h2m30s" into total seconds.
fn parse_duration_str(s: &str) -> Option<i64> {
    let mut total = 0i64;
    let mut current = 0i64;
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            current = current * 10 + (ch as i64 - '0' as i64);
        } else {
            match ch {
                'h' => {
                    total += current * 3600;
                    current = 0;
                }
                'm' => {
                    total += current * 60;
                    current = 0;
                }
                's' => {
                    total += current;
                    current = 0;
                }
                _ => return None,
            }
        }
    }
    // Flush any trailing bare number (e.g. "90" → 90, "1h30" → 5400 not 3600)
    // This matters when the URL param is just "90" with no suffix.
    total += current;
    // Reject zero-length or empty-parsed
    if total == 0 && current == 0 {
        return None;
    }
    Some(total)
}

/// Detect if a Reddit URL is a comment permalink.
/// Reddit URLs all contain "/comments/" (plural), but only comment
/// permalinks have an extra path segment after the post title:
///   Post:     /r/sub/comments/{id}/{title}/
///   Comment:  /r/sub/comments/{id}/{title}/{comment_id}/
/// We detect comments by checking for a 5th+ path segment.
pub fn is_reddit_comment(url_str: &str) -> bool {
    if let Ok(parsed) = url::Url::parse(url_str) {
        let path = parsed.path();
        if path.contains("/comments/") {
            let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
            // After /r/{sub}/comments/{id}/{title}[/{comment_id}]
            // segments[0]=r, [1]=sub, [2]=comments, [3]=id, [4]=title, [5]=comment_id
            segments.len() >= 6
        } else {
            false
        }
    } else {
        false
    }
}

/// Fetch Reddit comment text via the public JSON API.
/// Appends `.json` to the URL and parses the response.
pub async fn fetch_reddit_comment(url_str: &str) -> Option<String> {
    // Append .json to the URL for Reddit's public JSON API
    let json_url = if url_str.ends_with('/') {
        format!("{}comment/.json", url_str.trim_end_matches('/'))
    } else {
        format!("{}.json", url_str)
    };

    let resp = HTTP_CLIENT
        .get(&json_url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }

    // Reddit returns a JSON array: [post_data, comments_data]
    let body: serde_json::Value = resp.json().await.ok()?;
    let comments = body.as_array()?.get(1)?;
    let comment_data = comments.get("data")?;
    let children = comment_data.get("children")?;
    let first_child = children.as_array()?.first()?;
    let comment = first_child.get("data")?;
    let body_text = comment.get("body")?.as_str()?;

    Some(body_text.to_string())
}

// ─── Re-surface Toast Notification ───────────────────────────────────────────

/// Tracks the number of re-surface toasts shown today to enforce the throttle.
pub struct ResurfaceThrottle {
    /// Date string (YYYY-MM-DD) for the current throttle window.
    current_date: String,
    /// Number of toasts shown today.
    count: u32,
}

impl ResurfaceThrottle {
    pub fn new() -> Self {
        Self {
            current_date: Self::today_date(),
            count: 0,
        }
    }

    /// Check if we can show a re-surface toast (within throttle limits).
    pub fn can_show(&mut self) -> bool {
        let today = Self::today_date();
        if self.current_date != today {
            // New day — reset counter
            self.current_date = today;
            self.count = 0;
        }
        self.count < MAX_RESURFACE_TOASTS_PER_DAY
    }

    /// Record that a re-surface toast was shown.
    pub fn record(&mut self) {
        self.count += 1;
    }

    fn today_date() -> String {
        chrono::Utc::now().format("%Y-%m-%d").to_string()
    }
}

// Global re-surface throttle (shared across all clipboard saves).
// Uses a Mutex since this is called from async contexts.
static RESURFACE_THROTTLE: LazyLock<Mutex<ResurfaceThrottle>> =
    LazyLock::new(|| Mutex::new(ResurfaceThrottle::new()));

/// Emit a re-surface notification event if the recopy qualifies.
/// This fires a `clipboard://re-resurface` event that the frontend listens
/// for and displays as a Sonner toast.
async fn maybe_emit_resurface(
    app: &AppHandle,
    original_created_at: i64,
    now: i64,
    og_title: Option<&str>,
    og_image: Option<&str>,
    clip_id: &str,
) {
    let age_days = (now - original_created_at) / MS_PER_DAY;
    if age_days < RE_SURFACE_MIN_AGE_DAYS {
        return;
    }

    let mut throttle = RESURFACE_THROTTLE.lock().await;
    if !throttle.can_show() {
        // Daily throttle exceeded
        return;
    }
    throttle.record();
    drop(throttle);

    let _ = app.emit(
        "clipboard://re-surface",
        serde_json::json!({
            "clipId": clip_id,
            "title": og_title.unwrap_or("Saved link"),
            "imageUrl": og_image,
            "ageDays": age_days,
            "ageLabel": format!("{} days ago and hasn't been opened since. Here it is again.", age_days),
        }),
    );
}

// ─── Enrichment Concurrency Limit ─────────────────────────────────────────────

/// Maximum number of concurrent enrichment HTTP requests.
/// Prevents unbounded task spawning from overwhelming the async runtime
/// and the network stack during rapid clipboard bursts.
const MAX_CONCURRENT_ENRICHMENTS: usize = 16;

/// Semaphore to enforce backpressure on enrichment tasks.
/// Acquired inside `spawn_url_enrichment` before doing any HTTP work.
static ENRICHMENT_SEM: Semaphore = Semaphore::const_new(MAX_CONCURRENT_ENRICHMENTS);

// ─── Enrichment Entry Point ──────────────────────────────────────────────────

/// Spawn an async enrichment task for a URL clip.
/// This is called right after a new URL clip is saved.
/// Sets enrichment_status to 'pending', spawns a background task, and
/// updates the row with enrichment data when complete.
///
/// Enforces a concurrency limit via `ENRICHMENT_SEM` — the spawn itself
/// never blocks, but the task will wait at most 30s for a permit before
/// giving up, ensuring backpressure without head-of-line blocking.
pub fn spawn_url_enrichment(
    app: AppHandle,
    clip_id: String,
    url: String,
    platform: Option<String>,
) {
    tauri::async_runtime::spawn(async move {
        // Acquire a concurrency permit — if all 16 slots are busy, wait
        // up to 30 seconds before giving up on this enrichment.
        let _permit =
            tokio::time::timeout(std::time::Duration::from_secs(30), ENRICHMENT_SEM.acquire())
                .await
                .ok()
                .and_then(|r| r.ok());

        if _permit.is_none() {
            eprintln!("[bookmarks] enrichment semaphore timeout for {clip_id}, skipping");
            return;
        }

        let pool = app.state::<BentoAppState>().db();

        // Mark as pending
        if let Err(e) =
            sqlx::query("UPDATE clipboard_items SET enrichment_status = 'pending' WHERE id = ?")
                .bind(&clip_id)
                .execute(&pool)
                .await
        {
            eprintln!("[bookmarks] failed to set enrichment_status=pending for {clip_id}: {e}");
        }

        // Generic OpenGraph fetch
        let enrichment = fetch_opengraph(&url).await;

        // Compute outcome BEFORE match (match moves enrichment)
        let enrichment_outcome = if enrichment.is_some() {
            "completed"
        } else {
            "failed"
        };

        match enrichment {
            Some(mut meta) => {
                // Platform-specific enrichment
                if let Some(ref p) = platform {
                    match p.as_str() {
                        "reddit" if is_reddit_comment(&url) => {
                            // Fetch Reddit comment text as description fallback
                            if meta.og_description.is_none() {
                                meta.og_description = fetch_reddit_comment(&url).await;
                            }
                        }
                        "youtube" => {
                            // YouTube timestamp was already parsed in fetch_opengraph
                        }
                        "instagram" | "threads" | "tiktok" | "twitter" => {
                            // These platforms often block OG scraping. If OG data is
                            // just platform branding (generic), keep the raw URL.
                            // The frontend will use platform badge + raw URL.
                        }
                        _ => {}
                    }
                }

                // Update the row with enrichment data
                if let Err(e) = sqlx::query(
                    r#"UPDATE clipboard_items SET
                        enrichment_status = 'completed',
                        og_title = ?,
                        og_description = ?,
                        og_image = ?,
                        og_site_name = ?,
                        saved_timestamp_seconds = ?,
                        platform = COALESCE(?, platform)
                    WHERE id = ?"#,
                )
                .bind(&meta.og_title)
                .bind(&meta.og_description)
                .bind(&meta.og_image)
                .bind(&meta.og_site_name)
                .bind(meta.saved_timestamp_seconds)
                .bind(&meta.platform)
                .bind(&clip_id)
                .execute(&pool)
                .await
                {
                    eprintln!("[bookmarks] enrichment update failed for {clip_id}: {e}");
                }

                // Re-index in Tantivy with the OG title as the searchable title
                if let Some(search) = app.try_state::<SearchService>() {
                    let doc = SearchDocument {
                        module_id: "clipboard".to_string(),
                        id: clip_id.clone(),
                        title: meta.og_title.clone().unwrap_or_default(),
                        body: meta.og_description.clone().unwrap_or_default(),
                        tags: vec![
                            "bookmark".to_string(),
                            platform.as_deref().unwrap_or_default().to_string(),
                        ],
                        projects: Vec::new(),
                        kind: Some("bookmark".to_string()),
                        created_at: None,
                        updated_at: None,
                        source_ref: None,
                        extra: serde_json::json!({
                            "ogImage": meta.og_image,
                            "ogSiteName": meta.og_site_name,
                        }),
                    };
                    let _ = search.index_content(doc).await;
                }

                // Emit enrichment-complete event so the frontend can update the card
                // Use `id` (not `clipId`) to match ClipEntry.id that the frontend
                // listener expects when merging enrichment data into existing clips.
                let _ = app.emit(
                    "clipboard://enrichment-complete",
                    serde_json::json!({
                        "id": clip_id,
                        "ogTitle": meta.og_title,
                        "ogDescription": meta.og_description,
                        "ogImage": meta.og_image,
                        "ogSiteName": meta.og_site_name,
                        "platform": meta.platform,
                        "savedTimestampSeconds": meta.saved_timestamp_seconds,
                    }),
                );
            }
            None => {
                eprintln!("[bookmarks] enrichment fetch failed for {clip_id} (dead link, timeout, or blocked)");
                // Enrichment failed — mark as failed
                if let Err(e) = sqlx::query(
                    "UPDATE clipboard_items SET enrichment_status = 'failed' WHERE id = ?",
                )
                .bind(&clip_id)
                .execute(&pool)
                .await
                {
                    eprintln!(
                        "[bookmarks] failed to set enrichment_status=failed for {clip_id}: {e}"
                    );
                }
            }
        }

        // Log enrichment outcome regardless of success/failure
        eprintln!(
            "[bookmarks] ENRICHMENT id={:.12} outcome={enrichment_outcome} platform={:?}",
            clip_id,
            platform.as_deref()
        );
    });
}

// ─── Duplicate Detection with Normalized URL Matching ───────────────────────

/// Handle a URL clipboard save with normalized dedup and recopy tracking.
///
/// Instead of the standard content-hash dedup (which matches exact strings
/// including tracking params), this function:
/// 1. Normalizes the URL (strips tracking params)
/// 2. Computes a normalized hash
/// 3. Checks if a row with the same normalized URL already exists
/// 4. If found: increments recopy_count, updates timestamp, may fire re-surface
/// 5. If new: saves normally, then spawns enrichment
///
/// Returns the ClipEntry and whether it was a recopy.
pub async fn handle_url_save(
    app: &AppHandle,
    state: &BentoAppState,
    content: &str,
) -> Result<crate::clipboard::ClipEntry, String> {
    let pool = state.db();
    let trimmed = content.trim();
    let norm_hash = normalized_url_hash(trimmed);
    let now = time::now_ms();
    let id = uuid::Uuid::new_v4().to_string();

    // Classify the URL
    let classification = classify_content(trimmed);
    let platform = classification.platform.clone();
    // platform is already the as_str() output (e.g. "youtube"), not a raw hostname.
    // Avoid re-running from_hostname() which expects hostnames like "youtube.com".
    let is_known = platform.as_deref().map(|p| p != "other").unwrap_or(false);

    // Determine kind: known platform → Bookmark, otherwise Link
    let kind = if is_known {
        "bookmark".to_string()
    } else {
        "link".to_string()
    };

    // Check for existing normalized URL match
    let existing: Option<(String, i64, String, Option<String>)> = sqlx::query_as::<_, (String, i64, String, Option<String>)>(
        "SELECT id, created_at, og_title, og_image FROM clipboard_items WHERE content_hash = ? LIMIT 1"
    )
    .bind(&norm_hash)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((existing_id, original_created_at, og_title, og_image)) = existing {
        eprintln!("[bookmarks] RECOPY id={:.12} kind={kind} platform={:?} orig_created={original_created_at}", existing_id, platform);
        // ── Recopy detected — update existing row ──
        let _ = sqlx::query(
            r#"UPDATE clipboard_items SET
                recopy_count = recopy_count + 1,
                last_recopied_at = ?,
                updated_at = ?
            WHERE id = ?"#,
        )
        .bind(now)
        .bind(now)
        .bind(&existing_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        // After updating, fetch and return the existing entry WITH enrichment fields.
        // Previous query omitted og_title, og_image, platform, recopy_count etc.,
        // causing from_row() to return a stripped ClipEntry where recopy_count
        // appeared as 0 even though it was just incremented in the DB.
        let row = sqlx::query(
            "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \
             FROM clipboard_items WHERE id = ?"
        )
        .bind(&existing_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

        let entry = crate::clipboard::ClipEntry::from_row(row);

        // Maybe emit re-surface notification
        maybe_emit_resurface(
            app,
            original_created_at,
            now,
            Some(og_title.as_str()),
            og_image.as_deref(),
            &existing_id,
        )
        .await;

        // Index in Tantivy with updated timestamp
        crate::clipboard::index_clip_entry(app, &entry).await;

        return Ok(entry);
    }

    // ── New URL save ──
    eprintln!(
        "[bookmarks] NEW-SAVE id={:.12} kind={kind} platform={:?} is_known={is_known} url={}",
        id, platform, trimmed
    );
    let byte_size = content.len() as i64;
    let classification_json = serde_json::to_string(&classification).unwrap_or_default();
    // Use the normalized URL (without tracking params) for the preview,
    // so the list view shows a clean URL instead of one cluttered with
    // utm_source, fbclid, si=, etc.
    let normalized = normalize_url(trimmed);
    let preview = if normalized.len() > 200 {
        format!("{}…", &normalized[..197])
    } else {
        normalized
    };

    // Insert with normalized hash in the content_hash field for dedup,
    eprintln!(
        "[bookmarks] INSERT id={:.12} kind={kind} platform={:?} norm_hash={:.12}",
        id, platform, norm_hash
    );
    // but store both the original URL in content and track enrichment
    let _ = sqlx::query(
        r#"INSERT INTO clipboard_items
            (id, content_hash, kind, content, content_path, preview, source, byte_size,
             pinned, favorite, is_sensitive, created_at, updated_at,
             url_classification, enrichment_status, recopy_count, platform)
        VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, 0, 0, 0, ?, ?,
                ?, 'pending', 0, ?)"#,
    )
    .bind(&id)
    .bind(&norm_hash) // Use normalized hash for dedup
    .bind(&kind)
    .bind(content) // Original URL with tracking params preserved
    .bind(&preview)
    .bind(byte_size)
    .bind(now)
    .bind(now)
    .bind(&classification_json)
    .bind(&platform)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    // Build ClipEntry with REAL platform + enrichment_status so the frontend
    // immediately shows the platform badge and knows enrichment is pending.
    // Previously these were hardcoded to None / "none" which hid the platform
    // badge on the initial card and confused the frontend state machine.
    let entry = crate::clipboard::ClipEntry {
        id: id.clone(),
        kind: crate::clipboard::ClipKind::from_str(&kind),
        content: content.to_string(),
        content_hash: norm_hash,
        preview: Some(preview),
        source: None,
        byte_size,
        pinned: false,
        favorite: false,
        is_sensitive: false,
        timestamp: now,
        external_content: None,
        og_title: None,
        og_description: None,
        og_image: None,
        og_site_name: None,
        platform: platform.clone(), // ← real platform, not None
        saved_timestamp_seconds: None,
        recopy_count: 0,
        enrichment_status: "pending".to_string(), // ← real status, not "none"
    };

    // Index in Tantivy
    crate::clipboard::index_clip_entry(app, &entry).await;

    // Notify frontend with the correct ClipEntry
    let _ = app.emit("clipboard://new-entry", entry.clone());

    // Spawn async enrichment (fire-and-forget, never blocks the save)
    if is_known {
        eprintln!(
            "[bookmarks] SPAWN-ENRICHMENT id={:.12} platform={:?}",
            id, platform
        );
        spawn_url_enrichment(app.clone(), id, content.to_string(), platform.clone());
    } else {
        // For unknown platforms, still mark enrichment as failed immediately
        let _ = sqlx::query("UPDATE clipboard_items SET enrichment_status = 'none' WHERE id = ?")
            .bind(&id)
            .execute(&pool)
            .await;
    }

    Ok(entry)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_url() {
        assert!(is_url("https://example.com"));
        assert!(is_url("http://arena.na/block/123"));
        assert!(is_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
        assert!(!is_url("hello world"));
        assert!(!is_url("not-a-url"));
    }

    #[test]
    fn test_normalize_url_strips_tracking() {
        let url = "https://example.com/page?utm_source=twitter&id=123&utm_campaign=summer";
        let normalized = normalize_url(url);
        assert!(!normalized.contains("utm_source"));
        assert!(!normalized.contains("utm_campaign"));
        assert!(normalized.contains("id=123"));
    }

    #[test]
    fn test_normalize_url_strips_instagram_sharing() {
        let url = "https://instagram.com/p/ABC123/?igsh=somehash";
        let normalized = normalize_url(url);
        assert!(!normalized.contains("igsh"));
        assert!(normalized.contains("instagram.com/p/ABC123"));
    }

    #[test]
    fn test_normalize_url_strips_youtube_si() {
        let url = "https://youtube.com/watch?v=dQw4w9WgXcQ&si=abc123";
        let normalized = normalize_url(url);
        assert!(!normalized.contains("si="));
        assert!(normalized.contains("v=dQw4w9WgXcQ"));
    }

    #[test]
    fn test_normalize_url_preserves_essential_params() {
        let url = "https://youtube.com/watch?v=dQw4w9WgXcQ&t=120";
        let normalized = normalize_url(url);
        assert!(normalized.contains("v=dQw4w9WgXcQ"));
        assert!(normalized.contains("t=120"));
    }

    #[test]
    fn test_known_platforms() {
        assert_eq!(
            KnownPlatform::from_hostname("youtube.com"),
            KnownPlatform::Youtube
        );
        assert_eq!(
            KnownPlatform::from_hostname("x.com"),
            KnownPlatform::Twitter
        );
        assert_eq!(
            KnownPlatform::from_hostname("reddit.com"),
            KnownPlatform::Reddit
        );
        assert_eq!(
            KnownPlatform::from_hostname("instagram.com"),
            KnownPlatform::Instagram
        );
        assert_eq!(
            KnownPlatform::from_hostname("arena.na"),
            KnownPlatform::Arena
        );
        assert_eq!(
            KnownPlatform::from_hostname("cosmos.so"),
            KnownPlatform::Cosmos
        );
        assert_eq!(
            KnownPlatform::from_hostname("threads.net"),
            KnownPlatform::Threads
        );
        assert_eq!(
            KnownPlatform::from_hostname("tiktok.com"),
            KnownPlatform::Tiktok
        );
        assert_eq!(
            KnownPlatform::from_hostname("unknown-site.com"),
            KnownPlatform::Other
        );
    }

    #[test]
    fn test_parse_youtube_timestamp() {
        assert_eq!(
            parse_youtube_timestamp("https://youtube.com/watch?v=test&t=120"),
            Some(120)
        );
        assert_eq!(
            parse_youtube_timestamp("https://youtu.be/test?t=1m30s"),
            Some(90)
        );
        assert_eq!(
            parse_youtube_timestamp("https://youtube.com/watch?v=test&start=60"),
            Some(60)
        );
        assert_eq!(
            parse_youtube_timestamp("https://youtube.com/watch?v=test"),
            None
        );
    }

    #[test]
    fn test_is_reddit_comment() {
        // Comment permalink: has extra segment after title
        assert!(is_reddit_comment(
            "https://reddit.com/r/programming/comments/abc123/some_title/def456/"
        ));
        assert!(is_reddit_comment(
            "https://reddit.com/r/programming/comments/abc123/some_title/def456"
        ));
        // Post link: four segments after domain, no extra comment segment
        assert!(!is_reddit_comment(
            "https://reddit.com/r/programming/comments/abc123/some_title/"
        ));
        assert!(!is_reddit_comment(
            "https://reddit.com/r/programming/comments/abc123/"
        ));
        assert!(!is_reddit_comment("https://reddit.com/r/programming"));
    }

    #[test]
    fn test_platform_is_known() {
        assert!(KnownPlatform::Youtube.is_known());
        assert!(KnownPlatform::Arena.is_known());
        assert!(!KnownPlatform::Other.is_known());
    }
}
