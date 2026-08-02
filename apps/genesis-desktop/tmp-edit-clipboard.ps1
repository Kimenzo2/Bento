# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

# PowerShell script to edit clipboard/mod.rs
$file = "src-tauri/src/clipboard/mod.rs"
$f = Get-Content $file -Raw

# 1. Add 'pub mod bookmarks;' and bookmarks import after 'use crate::util::time;'
$old1 = 'use crate::db::BentoAppState;
use crate::search::{SearchDocument, SearchService};
use crate::util::time;'
$new1 = 'pub mod bookmarks;

use crate::db::BentoAppState;
use crate::search::{SearchDocument, SearchService};
use crate::util::time;
use bookmarks::handle_url_save;'
$f = $f.Replace($old1, $new1)

# 2. Remove the duplicate URL classification block from mod.rs (everything from "// ─── URL Classification" to "// ─── Generate a preview string")
# Find and replace the entire duplicate block
$old2 = "// ─── URL Classification ───────────────────────────────────────────────────────

/// Known platforms for bookmark identification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = ""camelCase"")]
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
    fn as_str(&self) -> &'static str {
        match self {
            KnownPlatform::Arena => ""arena"",
            KnownPlatform::Cosmos => ""cosmos"",
            KnownPlatform::Instagram => ""instagram"",
            KnownPlatform::Twitter => ""twitter"",
            KnownPlatform::Youtube => ""youtube"",
            KnownPlatform::Reddit => ""reddit"",
            KnownPlatform::Threads => ""threads"",
            KnownPlatform::Tiktok => ""tiktok"",
            KnownPlatform::Other => ""other"",
        }
    }

    fn from_hostname(hostname: &str) -> Self {
        match hostname.to_ascii_lowercase().as_str() {
            ""arena.na"" | ""www.arena.na"" => KnownPlatform::Arena,
            ""cosmos.so"" | ""www.cosmos.so"" => KnownPlatform::Cosmos,
            ""instagram.com"" | ""www.instagram.com"" => KnownPlatform::Instagram,
            ""x.com"" | ""www.x.com"" | ""twitter.com"" | ""www.twitter.com"" => KnownPlatform::Twitter,
            ""youtube.com"" | ""www.youtube.com"" | ""youtu.be"" => KnownPlatform::Youtube,
            ""reddit.com"" | ""www.reddit.com"" => KnownPlatform::Reddit,
            ""threads.net"" | ""www.threads.net"" => KnownPlatform::Threads,
            ""tiktok.com"" | ""www.tiktok.com"" => KnownPlatform::Tiktok,
            _ => KnownPlatform::Other,
        }
    }
}"

# Check if this block exists before trying to remove
if ($f.Contains("KnownPlatform")) {
    Write-Output "KnownPlatform block found - removing duplicate"
    # Remove the entire URL Classification section
    $startMarker = "// ─── URL Classification ───────────────────────────────────────────────────────"
    $endMarker = "// ─── Generate a preview string from full content."
    $startIdx = $f.IndexOf($startMarker)
    $endIdx = $f.IndexOf($endMarker)
    if ($startIdx -ge 0 -and $endIdx -gt $startIdx) {
        $f = $f.Substring(0, $startIdx) + "// ─── Generate a preview string from full content." + $f.Substring($endIdx + $endMarker.Length)
        Write-Output "Removed URL Classification block"
    }
}

# 3. Add new migration columns
$old3 = "r#""ALTER TABLE clipboard_items ADD COLUMN content_path TEXT""#,"
$new3 = "r#""ALTER TABLE clipboard_items ADD COLUMN content_path TEXT""#,
        // Bookmarking Layer columns
        r#""ALTER TABLE clipboard_items ADD COLUMN url_classification TEXT NOT NULL DEFAULT '{}'""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN enrichment_status TEXT NOT NULL DEFAULT 'none'""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN og_title TEXT""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN og_description TEXT""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN og_image TEXT""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN og_site_name TEXT""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN recopy_count INTEGER NOT NULL DEFAULT 0""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN last_recopied_at INTEGER""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN saved_timestamp_seconds INTEGER""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN platform TEXT""#,
        r#""ALTER TABLE clipboard_items ADD COLUMN routed_to TEXT""#,"
$f = $f.Replace($old3, $new3)

# 4. Make index_clip_entry pub(crate) - change "async fn index_clip_entry" to "pub(crate) async fn index_clip_entry"
$f = $f.Replace("/// Index a clipboard entry in Tantivy.
async fn index_clip_entry(", "/// Index a clipboard entry in Tantivy.
pub(crate) async fn index_clip_entry(")

# 5. Make ClipEntry::from_row pub(crate)
$f = $f.Replace("impl ClipEntry {
    fn from_row(", "impl ClipEntry {
    pub(crate) fn from_row(")

# 6. Update save_clipboard_entry to route URLs through bookmarks module
# First, find the save_clipboard_entry function and add URL routing
$oldSaveStart = "/// Save a clipboard entry from the monitoring system.
async fn save_clipboard_entry("
$oldSaveEnd = "    ) as i64;
    let byte_size = content.len() as i64;"

# Check if save_clipboard_entry contains the URL routing already
if ($f.Contains("handle_url_save")) {
    Write-Output "save_clipboard_entry already has URL routing"
} else {
    # Add URL detection at the start of the function body
    $insertPoint = "    let kind = detect_kind(content);"
    $insertText = "    // If content is a URL for a known platform, route through bookmark enrichment
    let classification = bookmarks::classify_content(content);
    if classification.is_url && classification.platform.as_deref().map(|p| bookmarks::KnownPlatform::from_hostname(p).is_known()).unwrap_or(false) {
        let _ = handle_url_save(app, state, content).await?;
        return Ok(());
    }
"
    $f = $f.Replace($insertPoint, $insertText + $insertPoint)
}

# Write the modified file
Set-Content -Path $file -Value $f -NoNewline
Write-Output "Done - file modified successfully"
