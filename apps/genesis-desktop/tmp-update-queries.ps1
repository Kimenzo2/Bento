# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

$modPath = "src-tauri/src/clipboard/mod.rs"
$bookmarksPath = "src-tauri/src/clipboard/bookmarks.rs"

# ── Update mod.rs: replace the long column list with one that includes bookmark fields ──
$oldSelect = "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at"
$newSelect = "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status"

$f = Get-Content $modPath -Raw
$count = [System.Text.RegularExpressions.Regex]::Matches($f, [System.Text.RegularExpressions.Regex]::Escape($oldSelect)).Count
Write-Output "Found $count occurrences of SELECT in mod.rs"
$f = $f.Replace($oldSelect, $newSelect)
Set-Content -Path $modPath -Value $f
Write-Output "Updated mod.rs"

# ── Update bookmarks.rs: the recopy fetch in handle_url_save needs the new columns too ──
$bf = Get-Content $bookmarksPath -Raw
$oldRecopy = "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at \ FROM clipboard_items WHERE id = ?"
$newRecopy = "SELECT id, content_hash, kind, content, content_path, preview, source, byte_size, pinned, favorite, is_sensitive, created_at, og_title, og_description, og_image, og_site_name, platform, saved_timestamp_seconds, recopy_count, enrichment_status \ FROM clipboard_items WHERE id = ?"
$bf = $bf.Replace($oldRecopy, $newRecopy)
Set-Content -Path $bookmarksPath -Value $bf
Write-Output "Updated bookmarks.rs"

# ── Verify ──
$after = Get-Content $modPath -Raw
$afterCount = [System.Text.RegularExpressions.Regex]::Matches($after, [System.Text.RegularExpressions.Regex]::Escape($newSelect.Substring(0, 60))).Count
Write-Output "Verified: $afterCount SELECT occurrences with new columns in mod.rs"
