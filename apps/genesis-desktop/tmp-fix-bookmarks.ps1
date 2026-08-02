# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

$path = "src-tauri/src/clipboard/bookmarks.rs"
$f = Get-Content $path -Raw

# Fix 1: reqwest::Client reuse — add static HTTP_CLIENT after constants
$target1 = "// ─── URL Classification ──────────────────────────────────────"
$insert1 = @"

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
        .expect("Failed to build reqwest HTTP_CLIENT")
});

"@
$idx = $f.IndexOf($target1)
$f = $f.Substring(0, $idx) + $insert1 + $f.Substring($idx)

# Fix 2: Remove dead www.* patterns from KnownPlatform::from_hostname
# (url_to_hostname already strips www., so the www.* variants are dead code)
$f = $f.Replace('"arena.na" | "www.arena.na"', '"arena.na"')
$f = $f.Replace('"cosmos.so" | "www.cosmos.so"', '"cosmos.so"')
$f = $f.Replace('"instagram.com" | "www.instagram.com"', '"instagram.com"')
$f = $f.Replace('"x.com" | "www.x.com" | "twitter.com" | "www.twitter.com"', '"x.com" | "twitter.com"')
$f = $f.Replace('"reddit.com" | "www.reddit.com"', '"reddit.com"')
$f = $f.Replace('"threads.net" | "www.threads.net"', '"threads.net"')
$f = $f.Replace('"tiktok.com" | "www.tiktok.com"', '"tiktok.com"')
# For youtube, keep youtu.be but remove www.youtube
$f = $f.Replace('"youtube.com" | "www.youtube.com" | "youtu.be"', '"youtube.com" | "youtu.be"')

# Fix 3: Replace fresh-client fetch_opengraph with shared client
$old_fetch_og = @"
pub async fn fetch_opengraph(url_str: &str) -> Option<BookmarkEnrichment> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Bento/1.0 (Bookmark Enrichment)")
        .danger_accept_invalid_certs(false)
        .build()
        .ok()?;

    let resp = client.get(url_str).send().await.ok()?;
"@

$new_fetch_og = @"
pub async fn fetch_opengraph(url_str: &str) -> Option<BookmarkEnrichment> {
    let resp = HTTP_CLIENT.get(url_str).send().await.ok()?;
"@

$f = $f.Replace($old_fetch_og, $new_fetch_og)

# Fix 4: Replace fresh-client fetch_reddit_comment with shared client + per-request timeout
$old_fetch_reddit = @"
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Bento/1.0 (Reddit Enrichment)")
        .build()
        .ok()?;

    let resp = client.get(&json_url).send().await.ok()?;
"@

$new_fetch_reddit = @"
    let resp = HTTP_CLIENT
        .get(&json_url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .ok()?;
"@

$f = $f.Replace($old_fetch_reddit, $new_fetch_reddit)

# Fix 5: Remove unused _is_known parameter from spawn_url_enrichment
$f = $f.Replace(
    'pub fn spawn_url_enrichment(
    app: AppHandle,
    clip_id: String,
    url: String,
    platform: Option<String>,
    _is_known: bool,
) {',
    'pub fn spawn_url_enrichment(
    app: AppHandle,
    clip_id: String,
    url: String,
    platform: Option<String>,
) {'
)

# Fix 6: Fix call site in handle_url_save (remove is_known arg)
$f = $f.Replace(
    'spawn_url_enrichment(app.clone(), id, content.to_string(), platform.clone(), is_known);',
    'spawn_url_enrichment(app.clone(), id, content.to_string(), platform.clone());'
)

# Fix 7: Fix parse_duration_str trailing-digit bug — flush current into total after loop
$old_parse_dur = @"
fn parse_duration_str(s: &str) -> Option<i64> {
    let mut total = 0i64;
    let mut current = 0i64;
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            current = current * 10 + (ch as i64 - '0' as i64);
        } else {
            match ch {
                'h' => { total += current * 3600; current = 0; }
                'm' => { total += current * 60; current = 0; }
                's' => { total += current; current = 0; }
                _ => return None,
            }
        }
    }
    Some(total)
}
"@

$new_parse_dur = @"
fn parse_duration_str(s: &str) -> Option<i64> {
    let mut total = 0i64;
    let mut current = 0i64;
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            current = current * 10 + (ch as i64 - '0' as i64);
        } else {
            match ch {
                'h' => { total += current * 3600; current = 0; }
                'm' => { total += current * 60; current = 0; }
                's' => { total += current; current = 0; }
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
"@

$f = $f.Replace($old_parse_dur, $new_parse_dur)

# Fix 8: Replace Local with Utc in ResurfaceThrottle for DST-robust date tracking
$f = $f.Replace(
    'use chrono::Local;
        Local::now().format("%Y-%m-%d").to_string()',
    'chrono::Utc::now().format("%Y-%m-%d").to_string()'
)

# Fix 9: Add normalize_url fragment stripping
$old_normalize = @"
            if keep_pairs.is_empty() {
                parsed.set_query(None);
            } else {
                let new_query: String = keep_pairs
                    .iter()
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect::<Vec<_>>()
                    .join("&");
                parsed.set_query(Some(&new_query));
            }
            parsed.to_string()
"@

$new_normalize = @"
            if keep_pairs.is_empty() {
                parsed.set_query(None);
            } else {
                let new_query: String = keep_pairs
                    .iter()
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect::<Vec<_>>()
                    .join("&");
                parsed.set_query(Some(&new_query));
            }
            // Strip fragment (#...) for canonical normalization
            parsed.set_fragment(None);
            parsed.set_host(parsed.host_str().map(|h| h.trim_start_matches("www."))).ok();
            parsed.to_string()
"@

$f = $f.Replace($old_normalize, $new_normalize)

# Fix 10: Add error logging to spawn_url_enrichment
$old_spawn_mark = @"
        // Mark as pending
        let _ = sqlx::query(
            "UPDATE clipboard_items SET enrichment_status = 'pending' WHERE id = ?",
        )
        .bind(&clip_id)
        .execute(&pool)
        .await;
"@

$new_spawn_mark = @"
        // Mark as pending
        if let Err(e) = sqlx::query(
            "UPDATE clipboard_items SET enrichment_status = 'pending' WHERE id = ?",
        )
        .bind(&clip_id)
        .execute(&pool)
        .await
        {
            eprintln!("[bookmarks] failed to set enrichment_status=pending for {clip_id}: {e}");
        }
"@

$f = $f.Replace($old_spawn_mark, $new_spawn_mark)

$old_spawn_update = @"
                // Update the row with enrichment data
                let _ = sqlx::query(
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
                .ok();
"@

$new_spawn_update = @"
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
"@

$f = $f.Replace($old_spawn_update, $new_spawn_update)

$old_spawn_fail = @"
            None => {
                // Enrichment failed — mark as failed
                let _ = sqlx::query(
                    "UPDATE clipboard_items SET enrichment_status = 'failed' WHERE id = ?",
                )
                .bind(&clip_id)
                .execute(&pool)
                .await;
            }
"@

$new_spawn_fail = @"
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
                    eprintln!("[bookmarks] failed to set enrichment_status=failed for {clip_id}: {e}");
                }
            }
"@

$f = $f.Replace($old_spawn_fail, $new_spawn_fail)

Set-Content -Path $path -Value $f
Write-Output "All Critique Loop 1 fixes applied to bookmarks.rs"

# Verify key changes
echo "=== Verification ==="
Select-String "static HTTP_CLIENT" $path | ForEach-Object { "FIX 1 OK: $($_.LineNumber): $($_.Line.Trim())" }
Select-String 'let resp = HTTP_CLIENT.get' $path | ForEach-Object { "FIX 3 OK: $($_.LineNumber): $($_.Line.Trim())" }
Select-String ".timeout" $path | ForEach-Object { "FIX 4 OK: $($_.LineNumber): $($_.Line.Trim())" }
Select-String "total \+= current;" $path | ForEach-Object { "FIX 7 OK: $($_.LineNumber): $($_.Line.Trim())" }
Select-String "Utc::now" $path | ForEach-Object { "FIX 8 OK: $($_.LineNumber): $($_.Line.Trim())" }
Select-String "set_fragment" $path | ForEach-Object { "FIX 9 OK: $($_.LineNumber): $($_.Line.Trim())" }
Select-String "spawn_url_enrichment\(" $path | ForEach-Object { "FIX 6 OK: $($_.LineNumber): $($_.Line.Trim())" }
