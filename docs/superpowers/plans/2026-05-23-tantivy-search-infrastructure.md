# Tantivy Search Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-first Tantivy search layer with one index per eligible module, reusable Rust commands, and renderer adapters for the modules that already have search or obviously benefit from it.

**Architecture:** A shared Rust `SearchService` owns per-module Tantivy indexes and a lightweight snapshot store so indexing stays incremental and `rebuild_index` can replay the last known documents without re-scraping live UI state. Renderer modules send normalized search documents into the backend through generic Tauri commands, and the backend returns ranked results with tag/project/date filters. Notes and Tasks are excluded from this pass because they need separate rebuild work.

**Tech Stack:** Rust, Tantivy, Tauri 2, SQLite/JSON snapshot persistence, Svelte 5 stores/composables.

---

### Task 1: Add the shared Rust search service

**Files:**
- Modify: `apps/genesis-desktop/src-tauri/Cargo.toml`
- Create: `apps/genesis-desktop/src-tauri/src/search/mod.rs`
- Create: `apps/genesis-desktop/src-tauri/src/search/service.rs`
- Create: `apps/genesis-desktop/src-tauri/src/search/schema.rs`
- Create: `apps/genesis-desktop/src-tauri/src/search/snapshot.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing compile surface**

```rust
// src-tauri/src/search/mod.rs
pub mod schema;
pub mod service;
pub mod snapshot;

pub use service::{SearchService, SearchDocument, SearchHit, SearchQuery};
```

- [ ] **Step 2: Run the build once to confirm Tantivy and the missing module fail**

Run: `cargo check -p bento-desktop`
Expected: fail until the new search module exists and Tantivy is added.

- [ ] **Step 3: Implement the minimal search service**

```rust
// src-tauri/src/search/service.rs
use std::collections::HashMap;
use std::path::PathBuf;
use tantivy::{Index, IndexWriter};

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchDocument {
    pub module_id: String,
    pub id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub projects: Vec<String>,
    pub kind: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub extra: serde_json::Value,
}

pub struct SearchService {
    // one index per module
}
```

- [ ] **Step 4: Run the build again to verify the core service compiles**

Run: `cargo check -p bento-desktop`
Expected: Tantivy compiles and the search module is reachable from `lib.rs`.

### Task 2: Expose the Tauri search commands

**Files:**
- Modify: `apps/genesis-desktop/src-tauri/src/lib.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/commands/mod.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/search/service.rs`

- [ ] **Step 1: Add command signatures**

```rust
#[tauri::command]
pub async fn index_content(...)
#[tauri::command]
pub async fn search_in_module(...)
#[tauri::command]
pub async fn rebuild_index(...)
#[tauri::command]
pub async fn delete_from_index(...)
```

- [ ] **Step 2: Wire the commands into the app handler**

```rust
// lib.rs invoke_handler additions
index_content,
search_in_module,
rebuild_index,
delete_from_index,
```

- [ ] **Step 3: Verify the commands compile**

Run: `cargo check -p bento-desktop`
Expected: command registration succeeds.

### Task 3: Integrate Recipes and Journal

**Files:**
- Modify: `apps/genesis-desktop/src/modules/recipes/App.svelte`
- Modify: `apps/genesis-desktop/src/modules/journal/App.svelte`
- Modify: `apps/genesis-desktop/src-tauri/src/recipes/mod.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/commands/journal.rs`

- [ ] **Step 1: Index recipes when they change**

```rust
// After recipe save/delete/favorite updates, send a SearchDocument for that recipe.
```

- [ ] **Step 2: Index journal entries when they change**

```rust
// After journal save/delete, send the entry title/body/tags into search.
```

- [ ] **Step 3: Replace frontend-only filtering with backend search calls**

```svelte
// searchQuery -> invoke('search_in_module', { moduleId: 'recipes', query: searchQuery })
```

- [ ] **Step 4: Verify recipes and journal search still render results**

Run: `cargo check -p bento-desktop`
Expected: no compile regressions.

### Task 4: Integrate clipboard, reading, and optional module bridges

**Files:**
- Create: `apps/genesis-desktop/src/lib/services/search.ts`
- Modify: `apps/genesis-desktop/src/modules/clipboard/App.svelte`
- Modify: `apps/genesis-desktop/src/modules/reading/App.svelte`
- Modify: `apps/genesis-desktop/src/modules/flashcards/App.svelte`
- Modify: `apps/genesis-desktop/src/modules/grocery/App.svelte`

- [ ] **Step 1: Add a shared Svelte search helper**

```ts
export async function searchInModule(moduleId: string, query: string, filters?: Record<string, unknown>) {
  return invoke<SearchHit[]>('search_in_module', { moduleId, query, filters });
}
```

- [ ] **Step 2: Bridge clipboard mutations into indexing**

```ts
// On clipboard save/delete/pin, call index_content/delete_from_index.
```

- [ ] **Step 3: Bridge reading and other eligible modules where search UI already exists**

```ts
// Replace local filtering with backend search on the active search view.
```

- [ ] **Step 4: Verify renderer builds still pass**

Run: `bun run type-check`
Expected: search helpers compile and modules still render.

### Task 5: Rebuild support and cleanup

**Files:**
- Modify: `apps/genesis-desktop/src-tauri/src/search/snapshot.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/search/service.rs`

- [ ] **Step 1: Persist module snapshots**

```rust
// Save the latest indexed documents to disk so rebuild_index can replay them.
```

- [ ] **Step 2: Add delete and rebuild semantics**

```rust
// delete_from_index removes both Tantivy docs and the snapshot entry.
// rebuild_index clears the module index and replays the snapshot store.
```

- [ ] **Step 3: Verify rebuild does not cross module boundaries**

Run: `cargo test -p bento-desktop search`
Expected: per-module isolation remains intact.
