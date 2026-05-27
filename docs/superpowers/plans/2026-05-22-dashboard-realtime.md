# Dashboard Realtime Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dashboard fallback behavior on desktop with a live Rust-backed data stream for recent activity, recent modules, last-opened app continuation, and the three dashboard pills.

**Architecture:** Keep SQLite as the source of truth, add a lightweight dashboard event log and invalidation helpers in Rust, and have the Svelte dashboard refresh from a backend event instead of waiting only on polling. The dashboard keeps a browser-only fallback path for non-Tauri preview, but the desktop path becomes event-driven and always consumes real data from the local database.

**Tech Stack:** Rust + Tauri 2, SQLite via sqlx, Svelte 5, Tauri events, existing module-context/runtime-state tables.

---

### Task 1: Add a dashboard activity log in Rust

**Files:**
- Modify: `apps/genesis-desktop/src-tauri/src/db.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/commands/dashboard.rs`

- [ ] **Step 1: Write the failing test**

Add a Rust test in `dashboard.rs` that seeds `runtime_state` and `module_context`, writes one dashboard event, and asserts that the recent-modules query returns the active module first and that the event query returns the latest event first.

```rust
#[tokio::test]
async fn test_dashboard_event_log_orders_latest_first() {
    let pool = setup_test_db().await;
    seed_fixtures(&pool).await;

    write_dashboard_event(&pool, "module_switch", "focus", Some("tasks"), Some(json!({"from":"tasks","to":"focus"}))).await.unwrap();
    write_dashboard_event(&pool, "module_open", "recipes", None, Some(json!({"source":"dashboard"}))).await.unwrap();

    let events = list_dashboard_events(&pool, 5).await.unwrap();
    assert_eq!(events.first().unwrap().module_id, "recipes");
    assert_eq!(events.first().unwrap().event_type, "module_open");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p genesis-desktop test_dashboard_event_log_orders_latest_first -- --nocapture`
Expected: fail because the dashboard event table/helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a new `dashboard_events` table in the SQLite migration list and add helpers:

```rust
pub async fn write_dashboard_event(
    pool: &SqlitePool,
    event_type: &str,
    module_id: &str,
    related_module_id: Option<&str>,
    payload: Option<Value>,
) -> Result<(), String> {
    let payload = payload.unwrap_or_else(|| json!({}));
    sqlx::query(
        r#"
        INSERT INTO dashboard_events (event_type, module_id, related_module_id, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(event_type)
    .bind(module_id)
    .bind(related_module_id)
    .bind(serde_json::to_string(&payload).map_err(|error| error.to_string())?)
    .bind(now_ms())
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}
```

Add a `list_dashboard_events(pool, limit)` helper that returns the latest rows ordered by `created_at DESC`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p genesis-desktop test_dashboard_event_log_orders_latest_first -- --nocapture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/genesis-desktop/src-tauri/src/db.rs apps/genesis-desktop/src-tauri/src/commands/dashboard.rs
git commit -m "feat(desktop): add local dashboard activity log for realtime summaries"
```

### Task 2: Invalidate the dashboard from backend writes

**Files:**
- Modify: `apps/genesis-desktop/src-tauri/src/db.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/commands/dashboard.rs`
- Modify: `apps/genesis-desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

Add a Rust test that calls `flush_module_state` with a `from_module` and `to_module`, then asserts `runtime_state.last_active_module` updates and a dashboard invalidation event can be emitted.

```rust
#[tokio::test]
async fn test_flush_module_state_updates_last_active_module() {
    let pool = setup_test_db().await;
    seed_fixtures(&pool).await;
    let state = BentoAppState::new(pool.clone());

    let context = ModuleContext {
        module: Some("tasks".to_string()),
        scroll_position: 42.0,
        last_open_id: Some("task-1".to_string()),
        cursor_position: None,
        extra: json!({}),
    };

    let receipt = flush_module_state(state, "tasks".to_string(), "focus".to_string(), context).await.unwrap();
    assert!(receipt.committed);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p genesis-desktop test_flush_module_state_updates_last_active_module -- --nocapture`
Expected: fail until the backend writes `last_active_module` and emits a refresh signal.

- [ ] **Step 3: Write minimal implementation**

Teach `flush_module_state` to:
- write the outgoing module context
- write `runtime_state.last_active_module`
- write a dashboard event row for the switch
- emit a Tauri event like `bento://dashboard-refresh`

Use a small helper in `commands/dashboard.rs`:

```rust
fn emit_dashboard_refresh(app: &tauri::AppHandle) {
    let _ = emit_main_window_event(app, "bento://dashboard-refresh", json!({
        "source": "rust",
        "reason": "module_switch"
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p genesis-desktop test_flush_module_state_updates_last_active_module -- --nocapture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/genesis-desktop/src-tauri/src/db.rs apps/genesis-desktop/src-tauri/src/commands/dashboard.rs apps/genesis-desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): emit dashboard refreshes from module state writes"
```

### Task 3: Make the dashboard consume live refresh events

**Files:**
- Modify: `apps/genesis-desktop/src/routes/pages/DashboardPage.svelte`

- [ ] **Step 1: Write the failing test**

Add a small frontend unit test or component assertion for the dashboard page that confirms the desktop path registers a `bento://dashboard-refresh` listener and calls `loadDashboard()` when the event fires. If there is no existing test harness, use a narrow browser-based smoke check after implementation.

- [ ] **Step 2: Run test to verify it fails**

Run the existing dashboard page in the browser and confirm that the dashboard does not refresh when a backend module switch is emitted yet.

- [ ] **Step 3: Write minimal implementation**

In `DashboardPage.svelte`, listen for `bento://dashboard-refresh` when `canUseTauri` is true and call `loadDashboard()` immediately. Keep the existing browser-only fallback, but reduce the Tauri polling to a safety net rather than the primary update path.

```ts
let unlistenDashboardRefresh: (() => void) | null = null;

onMount(async () => {
  void loadDashboard();
  if (canUseTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    unlistenDashboardRefresh = await listen("bento://dashboard-refresh", () => {
      void loadDashboard();
    });
  }
  return () => {
    unlistenDashboardRefresh?.();
    unlistenDashboardRefresh = null;
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run the desktop app and switch modules; the dashboard should refresh without waiting for the polling interval.

- [ ] **Step 5: Commit**

```bash
git add apps/genesis-desktop/src/routes/pages/DashboardPage.svelte
git commit -m "feat(desktop): refresh dashboard from backend invalidation events"
```

### Task 4: Verify the real dashboard data paths end to end

**Files:**
- Modify: `apps/genesis-desktop/src-tauri/src/commands/dashboard.rs`
- Modify: `apps/genesis-desktop/src/routes/pages/DashboardPage.svelte`

- [ ] **Step 1: Write the failing test**

Use the existing dashboard query tests to add one more case proving `recent_modules` prefers the durable `last_active_module` value and that the featured card still comes from real SQLite rows rather than hard-coded sample data.

```rust
#[tokio::test]
async fn test_dashboard_prefers_last_active_module_for_continue_button() {
    let pool = setup_test_db().await;
    seed_fixtures(&pool).await;

    sqlx::query(
        "INSERT INTO runtime_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind("last_active_module")
    .bind("focus")
    .execute(&pool)
    .await
    .unwrap();

    let result = query_recent_modules(&pool, Some("focus")).await.unwrap();
    assert_eq!(result.first().map(|m| m.id.as_str()), Some("focus"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p genesis-desktop test_dashboard_prefers_last_active_module_for_continue_button -- --nocapture`
Expected: fail until the backend uses the durable runtime-state value consistently.

- [ ] **Step 3: Write minimal implementation**

Keep `get_dashboard_data` fully real on the Tauri path:
- query SQLite for featured module, activity, streaks, metrics, and recent modules
- use `runtime_state.last_active_module` for `Continue in ...`
- reserve fallback data only for browser-only preview

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p genesis-desktop test_dashboard_prefers_last_active_module_for_continue_button -- --nocapture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/genesis-desktop/src-tauri/src/commands/dashboard.rs apps/genesis-desktop/src/routes/pages/DashboardPage.svelte
git commit -m "feat(desktop): keep dashboard cards bound to local SQLite state"
```

