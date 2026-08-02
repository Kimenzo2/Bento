# Realtime Consumption Bridge — Implementation Plan

**Status:** Approved · **Owner:** Agent · **Created:** 2026-08-02
**Product vision:** Agent→UI realtime, Module→Module realtime, Agent→Social integrations, Settings integrations→realtime. (Desktop-to-phone push is NOT in scope.)

---

## 1. Why this exists (audit findings — do not forget)

The realtime engine (WS client, Rust hub, merge engine, stream bridge) is built and **well tested**
(198 TS tests + Rust integration tests). `emit_change()` is called on **~36 topics** across every
module. **BUT the WebView consumes none of it:**

- ❌ No component calls `realtimeStream()` (only tests do).
- ❌ Nothing listens for the `bento://data-changed` Tauri event that `emit_change` fires on every mutation.
- ❌ Modules still refresh the old way: `bento://dashboard-refresh` → `window.dispatchEvent(...)` → manual re-fetch.
- ⚠️ ~30 emitted topics have **no registered stream** in `handlers.rs`. This is only a problem IF the
  phone ever returns — **NOT in scope now** (deprioritized). Do NOT chase it.

So `emit_change` today fans out to zero WS subscribers and its `data-changed` event has zero listeners.
The Rust→UI realtime payoff is the **consumption half**, which is not wired yet. This plan builds it.

---

## 2. Design

### 2a. Rust side: emit a topic-scoped `data-changed` (already done)
`RealtimeHub::emit_change(topic, event, data)` already does two things (src-tauri/src/realtime/mod.rs:355):
1. `hub.publish_volatile(topic, event, data)` → WS subscribers (none today, fine).
2. `app.emit("bento://data-changed", json!({"topic", "event"}))` → **this is our trigger.**

No Rust change needed to emit. ✅ Already wired on all 36 topics.

### 2b. TS side: a central `data-changed` listener → module refresh bus
New file: `src/lib/realtime/data-changed.ts` (a `.ts` module, NOT a `.svelte` component, so it's
testable without a DOM shell).

Responsibilities:
- `initDataChangedListener()` — once, from `RuntimeBridge.svelte` (near the existing
  `bento://dashboard-refresh` listener at RuntimeBridge.svelte:208). Registers
  `listen<{topic, event}>("bento://data-changed", ...)` via `@tauri-apps/api/event`.
  **Never rejects** — if the listener can't attach (non-Tauri runtime), it warns and returns a
  no-op cleanup so the bridge teardown chain is never poisoned.
- Maintains a **topic→refresher map**: `registerRefresher(topic, refresher)` where `refresher` is a
  `() => void | Promise<void>` that re-fetches a module store. Returns an unregister fn; a stale
  unregister closure can never wipe a re-registered topic.
- On a `data-changed` event, look up `topic`:
  - Exact match → run its refresher.
  - Prefix match (`tasks/list` matches registered `tasks/*`) → run all matching refreshers.
  - Global catch-all (`*`) → matches every topic (used by the dashboard's cross-module summary).
  - No match → silently ignore (each module that cares registers its own refresher).
- Debounce: coalesce bursts within ~150ms per topic so a 10-row write doesn't trigger 10 re-fetches.
- **TakeLatest-with-trailing concurrency**: at most ONE refresh runs per topic at a time. Events
  that arrive during an in-flight refresh set a "rerun" flag; exactly one trailing refresh runs
  after the current one settles. This prevents out-of-order responses from writing stale data
  over fresh data (the classic debounce+fetch race). Promises are awaited (never dangling) and
  rejections are logged + counted.
- Idempotent init: safe to call multiple times (returns the unlisten fn; guards against double-listen).
- Observability: `getStats()` exposes `eventsHandled / refreshesRun / refreshesFailed /
  burstsCoalesced` for tooling and the Settings realtime panel.

### 2c. Opt-in true live-merge via `realtimeStream` (where it adds value)
For stores where a full live-merge beats re-fetch (e.g. tasks sidebar counts, notes sidebar), wire
`realtimeStream("tasks/list")` / `realtimeStream("notes/list")` into the existing stores
(`task-service.ts`, notes equivalent). This is **incremental** — do NOT rip out the invoke-based loads.
The `data-changed` bus covers correctness for every module; live-merge is a polish layer for the two
modules already registered.

### 2d. No Rust handler registration for the ~30 unregistered topics (explicitly OUT of scope)
The audit showed ~30 emitted topics have no `registry.stream(...)`. Subscribing to them returns
`NOT_FOUND`. Since the phone is deprioritized and the desktop consumes via `data-changed`, we do
NOT register them. Revisit only if the phone / clone returns.

---

## 3. New tests (must be written with the feature)

### 3a. `src/lib/realtime/data-changed.test.ts` (~15 cases)
Fake the `@tauri-apps/api/event` `listen` (mirror how bridge.test.ts mocks `invoke`). Cases:
1. `initDataChangedListener` registers one `listen` call for `bento://data-changed`.
2. Exact-topic match runs the refresher.
3. Prefix match (`tasks/*`) runs all matching refreshers for `tasks/list`.
4. Unknown topic is a safe no-op (no throw).
5. No match does NOT dispatch a legacy `bento:dashboard-refresh` window event by default.
6. Debounce coalesces a burst of N events into 1 refresh (fake timers).
7. Debounce resets the window per topic (tasks vs notes refresh independently in a burst).
8. `unregisterRefresher` stops future refreshes.
9. Double `initDataChangedListener` does not double-register the Tauri listener.
10. The returned cleanup fn unlistens (calls the Tauri unlisten).
11. A throwing refresher does not break the listener or other refreshers.
12. `event` payload ignored / missing `topic` is a safe no-op.
13. Registering the same topic twice keeps both refreshers (fan-out, pinned).
14. Async refresher is awaited (not left dangling) before the next coalesced batch.
15. Timer-based debounce is cleared on cleanup (no late fires after unlisten).
16. **TakeLatest**: events during an in-flight refresh do NOT start a parallel refresh; exactly one
    trailing refresh runs after it settles.
17. **Never-reject init** when the Tauri listener cannot attach (no-op cleanup, graceful).
18. **Global catch-all (`*`)** matches every topic (dashboard).
19. **Stale unregister closure** cannot wipe a re-registered topic.
20. **Stats**: eventsHandled / burstsCoalesced / refreshesRun / refreshesFailed counters.
Implementing note: totals ~26 tests.

### 3b. `bridge.test.ts` additions (live-merge wiring, ~4 cases)
- `realtimeStream("tasks/list")` already covered; add: subscribing the tasks store via
  `realtimeStream` + applying a `created` event updates the store.
- Two live-merge stores on one path stay independent (already in adversarial; keep parity here).

### 3c. Rust: `realtime_hub.rs` addition (~2 cases)
- `emit_change` publishes to the hub AND emits `bento://data-changed` with `{topic, event}` payload
  (test via the hub's event hook, not a real AppHandle — use the existing test seam).

---

## 4. Open decisions to confirm while implementing
- **a.** Debounce window value (proposed 150ms) — tune to feel "instant".
- **b.** `registerRefresher` collision policy (multi-refresher fan-out vs last-wins) — see test #13.
- **c.** Whether unknown topics should fall back to the legacy `bento:dashboard-refresh` dispatch.
  Proposed: **no fallback by default**; modules register explicitly. (Prevents double-refresh storms.)

---

## 5. Implementation order
1. Write `data-changed.ts` + `data-changed.test.ts` (TDD: tests first, then implementation).
2. Wire `initDataChangedListener()` into `RuntimeBridge.svelte`.
3. Register refreshers in the first wave of modules: **tasks, notes** (the two with realtime streams).
4. Add live-merge stores for tasks/notes via `realtimeStream` (optional polish, incremental).
5. Register refreshers for remaining modules (budget, sleep, mood, nutrition, goals, health, journal,
   passwords, voice, countdown, habits, meta) — each maps its emitted topics to its existing
   load/refresh function. Do NOT touch their invoke-based loads; just add the refresh hook.
6. Add the Rust `emit_change` → `bento://data-changed` test.
7. Run: `bunx vitest run src/lib/realtime` + `bunx vitest run src/lib/realtime/data-changed.test.ts`
   + `cargo test --test realtime_hub` (in src-tauri/).
8. Final audit: re-run the emit-vs-register cross-check; confirm no new gaps introduced.

---

## 6. Verification commands
- `bunx vitest run src/lib/realtime` (all realtime TS tests, incl. new data-changed.test.ts)
- `cargo test --test realtime_hub` (run in `src-tauri/`)
- `cargo check` (run in `src-tauri/`) — catches compile issues in any Rust touched.

---

## 7. Files touched
- NEW `src/lib/realtime/data-changed.ts` — the consumption bridge.
- NEW `src/lib/realtime/data-changed.test.ts` — its tests.
- `src/lib/components/RuntimeBridge.svelte` — init the listener once.
- `src/modules/tasks/App.svelte` (or `task-service.ts`) + notes equivalent — register refreshers +
  optional live-merge store.
- `src-tauri/tests/realtime_hub.rs` — the `emit_change`→`data-changed` test.
- OTHER module App.svelte files (step 5) — register refreshers only.
- NO changes to `src-tauri/src/realtime/handlers.rs` (the 30 unregistered topics stay unregistered).

---

## 8. Explicitly NOT doing (guard against scope creep)
- ❌ Registering the ~30 unregistered realtime streams in handlers.rs (phone deprioritized).
- ❌ Replacing invoke-based module loads with realtime streams wholesale.
- ❌ Any desktop→phone push / LAN phone features.
- ❌ Changes to the merge engine / client / hub logic (they're done and tested).
