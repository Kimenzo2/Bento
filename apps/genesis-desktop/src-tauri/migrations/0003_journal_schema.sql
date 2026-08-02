-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

-- ═══════════════════════════════════════════════════════════════════════
-- JOURNAL ENTRIES SCHEMA — Daily journal with offset-based marks blocks
-- ═══════════════════════════════════════════════════════════════════════
-- Each row is one day's entry. Blocks are stored as a JSON text array.
-- This keeps reads/writes atomic (one row per day) and avoids N+1.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS journal_entries (
    id              TEXT PRIMARY KEY,         -- UUID v4
    date            TEXT NOT NULL UNIQUE,     -- ISO date string 'YYYY-MM-DD'
    blocks          TEXT NOT NULL DEFAULT '[]',  -- JSON array of Block objects
    word_count      INTEGER DEFAULT 0,
    mood            TEXT,                     -- Optional mood tag
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
