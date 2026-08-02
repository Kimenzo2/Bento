**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Flashcards (Bento Recall) — Complete Frontend → Backend Mapping

## Overview

The Flashcards module (`src/modules/flashcards/App.svelte`) is a **spaced-repetition flashcard system** that was fully migrated from client-side mock data + localStorage to **Tauri IPC + SQLite** backend.

---

## What Changed

### REMOVED (mock data + localStorage):

- `import { browser } from "$app/environment"` — removed, no longer needed
- `type PersistedState` — entire interface removed
- `const STORAGE_KEY` / `const LEGACY_KEY` — removed
- `seedState()` — removed (was 170+ lines of hardcoded decks/cards)
- `migrateLegacyState()` — removed
- `persistState()` — removed
- `loadState()` — removed — replaced by `loadAll()`
- All `localStorage.getItem` / `setItem` calls — removed
- `syncFlashcardsIndex()` on mount — now only called per mutation
- `seedExamples()` — removed (no "install example packs" CTA)

### ADDED:

- `import { invoke } from '@tauri-apps/api/core'`
- `type RawRecallCard` / `type RawRecallDeck` — for serde JSON from Rust
- `mapCard()` / `mapDeck()` — adapters: `RawRecallCard`→`RecallCard`
- `loadAll()` — calls `invoke("flashcards_list")`, handles error, no fallback
- `createDeck()` → calls `invoke("flashcards_deck_create", { payload })`
- `addCue()` → calls `invoke("flashcards_card_create", { payload })`
- `togglePin()` → calls `invoke("flashcards_card_toggle_pin", { cardId })`
- `archiveCard()` → calls `invoke("flashcards_card_archive", { cardId })`
- `restoreCard()` → calls `invoke("flashcards_card_restore", { cardId })`
- `gradeCard(SRS)` → calls `invoke("flashcards_card_grade", { payload })`

### KEPT EXACTLY (zero changes):

- ALL template/HTML (`<main class="recall-workspace">` and all sections)
- ALL CSS (`<style>` — 890 lines unchanged)
- ALL derived variables (`$derived`)
- ALL pure helper functions: `isDue`, `formatDue`, `clamp`, `sameDay`, `iconGlyph`, `buttonIcon`, `contextIcon`, `dueLabel`, `contextCards`, `progressLabel`, etc.
- ALL SVG icons and `contextMeta`
- ALL translation / i18n references (`_t(...)`)

### MODIFIED (minor):

- `captureDeckId` type: `string | null` → `string | undefined`
- `resolveDeck` parameter: `string | null` → `string | null | undefined`
- `gradeCard` local variable typing to resolve `never` issue
- `onMount` calls `loadAll()` instead of `loadState()` + `syncFlashcardsIndex`

---

## New Empty State for First-Time Users

Added a full-screen empty state when `decks.length === 0`:

```
┌──────────────────────────────────┐
│                                  │
│          [brain icon]            │
│                                  │
│    No decks yet. Create your     │
│    first deck to start using     │
│    spaced repetition.            │
│                                  │
│    [Create your first deck]      │
│                                  │
└──────────────────────────────────┘
```

Also added:

- `:global(.recall-empty-state)` — grid centered with 64px icon
- `:global(.recall-empty-state__actions)` — CTA button area

---

## Rust Backend: `flashcards.rs` (350 lines)

### Schema: 2 tables + 3 indexes

```sql
CREATE TABLE IF NOT EXISTS flashcard_decks (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL,
    context    TEXT    NOT NULL DEFAULT 'Focus',
    note       TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    archived   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flashcard_cards (
    id             TEXT    PRIMARY KEY,
    deck_id        TEXT    NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    context        TEXT    NOT NULL DEFAULT 'Focus',
    cue            TEXT    NOT NULL,
    anchor         TEXT    NOT NULL,
    created_at     INTEGER NOT NULL,
    due_at         INTEGER NOT NULL,
    reviewed_at    INTEGER,
    interval_days  INTEGER NOT NULL DEFAULT 1,
    ease           REAL    NOT NULL DEFAULT 2.0,
    streak         INTEGER NOT NULL DEFAULT 0,
    mastery        INTEGER NOT NULL DEFAULT 0,
    pinned         INTEGER NOT NULL DEFAULT 0,
    archived       INTEGER NOT NULL DEFAULT 0,
    source         TEXT    NOT NULL DEFAULT ''
);
```

### Commands registered in `lib.rs`:

| Command                      | Input                                                            | Output               | Purpose                                                         |
| ---------------------------- | ---------------------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| `flashcards_list`            | —                                                                | `Vec<RecallDeckRow>` | Load all decks with nested cards                                |
| `flashcards_deck_create`     | `{title, context, note}`                                         | `RecallDeckRow`      | Create new empty deck                                           |
| `flashcards_deck_delete`     | `{deck_id}`                                                      | `void`               | Delete deck + cascade cards                                     |
| `flashcards_card_create`     | `{deck_id, cue, anchor, context}`                                | `RecallCardRow`      | Add flashcard to deck                                           |
| `flashcards_card_grade`      | `{card_id, grade, due_at, interval_days, ease, streak, mastery}` | `RecallCardRow`      | Persist SRS update                                              |
| `flashcards_card_toggle_pin` | `{card_id}`                                                      | `RecallCardRow`      | Toggle pinned state                                             |
| `flashcards_card_archive`    | `{card_id}`                                                      | `void`               | Soft-delete card                                                |
| `flashcards_card_restore`    | `{card_id}`                                                      | `void`               | Restore archived card                                           |
| `flashcards_search`          | `{query}`                                                        | `Vec<RecallDeckRow>` | Full-text search across title/note/cue/anchor                   |
| `flashcards_review_queue`    | `{deck_id?: Option<String>}`                                     | `Vec<RecallCardRow>` | Get due cards (pinned first, due ascending, mastery descending) |

### SRS Algorithm: Client-Side (kept in App.svelte)

```typescript
"again" → interval=1d, ease-=0.18, streak=0, mastery-=9
"hard"  → interval*=1.2, ease-=0.08, mastery+=4
"good"  → interval*=ease, ease+=0.02, streak+=1, mastery+=8
"easy"  → interval*=(ease+0.75), ease+=0.08, streak+=2, mastery+=12
```

The frontend computes the new SRS values, then sends them to the backend via `flashcards_card_grade` for persistence.

---

## File Structure

```
apps/genesis-desktop/src/modules/flashcards/
└── App.svelte              ← single file, 2184 lines (was 2384)

apps/genesis-desktop/src-tauri/src/
├── flashcards.rs           ← NEW: full SQLite-backed backend (10 commands)
├── lib.rs                  ← modified: added `pub mod flashcards` + 10 command registrations
```

---

## Verification

- `bun run type-check` must pass
- A production frontend build should be run when Svelte/CSS changes
- The Rust backend can be compiled with `cargo build` in `src-tauri/`
