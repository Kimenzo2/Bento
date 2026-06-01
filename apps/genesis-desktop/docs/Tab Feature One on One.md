# Tab Feature — One on One (Research TODO)

> **Purpose**: This is a TODO document. The gaps are TODOs. Treat every gap listed here as a backend implementation task.
> **Scope**: BACKEND ONLY. Ignore frontend. Focus on Rust TabSessionManager, module actors, sync handling.
> **Core Architecture**: "Open App as Tab" — each tab has a frontend half (WebView) AND a backend half (Rust ModuleActor). Both must stay in sync.

---

## Gap 9 — Workflow Mode sync interaction (UNDEFINED)

**Problem**: When the user is in Workflow Mode with Tasks and Notes as tabs, and a sync event arrives for the Health module (not in workflow), what happens?

The TabSessionManager has no handler for sync events targeting non-active, non-workflow modules. Sync data arrives in Rust, tries to emit an update to the frontend, and the frontend has no listener because Health is not mounted.

**Questions to resolve**:

- Does the data get applied to SQLite silently?
- Does it get queued?
- Does it fail?
- This interaction was never designed.

**Solution**: Sync data for non-mounted modules should be applied to SQLite silently. When the user later opens that module's tab, the context loads from already-updated SQLite. No stale data, no loading flicker.

---

## Gap 10 — Long session memory leak in background tab actors

**Problem**: If the user runs Workflow Mode for 8 hours, adds and removes tabs multiple times, Rust actors spawned for each module are never explicitly shut down when a tab is removed from the workflow.

The actor handle is dropped from TabSessionManager but the Tokio task continues running until garbage collected. Under heavy use this accumulates. The telemetry brain would eventually detect rising memory with no clear cause.

**Solution**: Explicit actor shutdown sequence on tab removal. Dropping the actor handle must trigger a clean shutdown of the Tokio task.

---

## Gap 11 — Non-installed module requested in Workflow Mode (NO HANDLER)

**Problem**: User has 15 of 21 modules installed. They try to add Recipes to a workflow but Recipes is not installed. TabSessionManager tries to start the Recipes backend actor and load its module bundle. Neither exists.

**Solution**: Error path must check module registry first. If module is not installed, return a clean error to frontend — do not attempt to start an actor or load a bundle.

---

## Architecture: The Rust TabSessionManager

**Purpose**: Lives in Rust permanently. Owns the full session state for every open tab.

**Tracks per tab**:

- Which module it contains
- When it was opened
- Last known scroll position and UI context
- Whether it has unsaved changes
- Whether its sync queue has pending operations
- Its current Rust actor handle

**Tab open sequence**: When a tab is opened, TabSessionManager starts the Rust backend actor for that module immediately — not when the user clicks on it, but the moment it is added to the tab bar. The actor begins loading data from SQLite and connecting to the sync layer.

---

## Tab Switch Sequence (3 phases)

**Phase 1 — Departing module flush**: Before any visual change, Rust synchronously flushes all pending writes for the current module.

- Auto-save runs one final time
- Sync queue notified of pending context switch
- UI context (scroll position, cursor position, open items) written to SQLite
- Takes 10-50ms on a healthy database
- Must complete before Phase 2 begins

**Phase 2 — Incoming module context load**: Rust reads the incoming module's last UI context from SQLite and sends it to the frontend as part of the tab switch event payload.

- Frontend receives the context before rendering
- Tab opens exactly where user left it — correct scroll position, correct open note, correct cursor position

**Phase 3 — Telemetry handover**: Telemetry brain notified of the switch. Stops attributing metrics to departing module, starts attributing to incoming module. Background tabs continue reporting heartbeats but marked as BACKGROUND state.

---

## Background Tab Behavior

- Background tabs are NOT paused — Rust actors continue running with reduced frequency
- Foreground auto-save: every 500ms
- Background auto-save: every 5 seconds
- Sync queue processes for all tabs regardless of visibility
- If background tab receives sync data from another device, changes are applied silently
- When user switches to that tab, they see already-merged latest state

---

## Sync Events and Tab Visibility

If Tasks is foreground:

- Sync update applied AND WebView notified immediately via Tauri channel

If Tasks is background:

- Sync update applied to SQLite silently
- When user switches to Tasks tab, Phase 2 loads already-updated context
- User never sees loading state or sync indicator

---

## IGNORED: Rust-Native any-sync Equivalent

- iroh (P2P transport)
- Automerge (CRDT merge layer)
- age encryption (document encryption)
- Device registry in SQLite

These are NOT part of this TODO. Focus on the TabSessionManager architecture only.

---

## Gaps (TODOs) Summary

- [ ] **Gap 9**: Sync events for non-mounted modules → apply to SQLite silently
- [ ] **Gap 10**: Orphaned Rust actors on tab removal → explicit shutdown sequence
- [ ] **Gap 11**: Non-installed module requested → check registry, return clean error

## Implementation Milestones

- [ ] **Backend**: Rust TabSessionManager struct with per-tab state tracking
- [ ] **Backend**: Tab open → start ModuleActor immediately
- [ ] **Backend**: Tab switch → Phase 1 flush + Phase 2 load context + Phase 3 telemetry
- [ ] **Backend**: Background tab throttling (auto-save 5s, sync full speed)
- [ ] **Backend**: Sync event dispatch by tab visibility
- [ ] **Backend**: Actor shutdown on tab removal
- [ ] **Backend**: Module registry check before actor spawn

## Architecture Diagram

```
USER SWITCHES TO NOTES TAB
         │
         ▼
  TabSessionManager (Rust)
         │
         ├── Phase 1: Flush Tasks module
         │   ├── Tasks auto-save (synchronous)
         │   ├── Tasks UI context → SQLite
         │   └── Tasks actor → BACKGROUND state
         │
         ├── Phase 2: Load Notes context
         │   ├── Notes UI context ← SQLite
         │   ├── Notes actor → FOREGROUND state
         │   └── Emit tab:switched { context } → Frontend
         │
         ├── Phase 3: Telemetry handover
         │   ├── Brain.set_foreground("notes")
         │   └── Brain.set_background("tasks")
         │
         └── Frontend renders Notes with context
             Zero loading state. Zero flicker.

BACKGROUND (tasks actor — still running):
├── Auto-save every 5s (throttled)
├── Sync queue processing (full speed)
└── Receives device sync updates silently
```
