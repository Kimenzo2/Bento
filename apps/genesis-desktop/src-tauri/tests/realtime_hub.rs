// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Adversarial integration tests for the native realtime hub.
//
// These live OUTSIDE src/ (Cargo integration tests) and exercise the PUBLIC
// API of the `bento_desktop_lib` crate: the wire contract the TS client
// parses (`MergeStrategy`/`StreamOptions`/`RpcError` serde), the TopicHub
// fan-out (multi-subscriber, topic isolation, unsubscribe), reliable vs
// volatile backpressure, and the reserved `__` topic guard.
//
// Compile/run with `cargo test --test realtime_hub`.
// ═══════════════════════════════════════════════════════════════════════

use bento_desktop_lib::realtime::{
    MergeStrategy, PublishFn, RealtimeHub, RpcError, StreamOptions, TopicHub,
};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::Listener;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message;

/// Subscribe a fresh outbox to `topic`; returns the receiver to assert frames.
async fn subscribe(hub: &TopicHub, conn_id: u64, topic: &str, cap: usize) -> mpsc::Receiver<Message> {
    let (tx, rx) = mpsc::channel(cap);
    hub.subscribe(topic, conn_id, tx).await;
    rx
}

/// Drain one text frame and parse it as a Value (panics on binary/none).
async fn next_frame(rx: &mut mpsc::Receiver<Message>) -> Value {
    let msg = rx.recv().await.expect("expected a frame");
    match msg {
        Message::Text(t) => serde_json::from_str(&t).expect("frame must be valid JSON"),
        other => panic!("expected Text frame, got {other:?}"),
    }
}

// ── Wire contract (what bridge.ts / protocol.ts parse) ───────────────────

#[test]
fn merge_strategy_serializes_lowercase_and_round_trips() {
    let cases = [
        (MergeStrategy::Crud, "crud"),
        (MergeStrategy::Latest, "latest"),
        (MergeStrategy::Set, "set"),
        (MergeStrategy::Presence, "presence"),
        (MergeStrategy::Cursor, "cursor"),
    ];
    for (variant, name) in cases {
        assert_eq!(serde_json::to_string(&variant).unwrap(), format!("\"{name}\""));
        let back: MergeStrategy = serde_json::from_str(&format!("\"{name}\"")).unwrap();
        assert_eq!(back, variant);
    }
}

#[test]
fn merge_strategy_default_is_crud() {
    assert_eq!(MergeStrategy::default(), MergeStrategy::Crud);
}

#[test]
fn stream_options_serialize_camel_case_like_the_client_expects() {
    // bridge.ts reads response.merge/key/prepend/max — the Rust struct must
    // serialize to exactly those camelCase keys, or the client silently
    // ignores the server's merge opts and falls back to `set`.
    let opts = StreamOptions {
        merge: MergeStrategy::Crud,
        key: Some("id".to_string()),
        prepend: false,
        max: Some(500),
    };
    let v = serde_json::to_value(&opts).unwrap();
    let obj = v.as_object().expect("opts must serialize to an object");
    assert_eq!(obj.get("merge"), Some(&json!("crud")));
    assert_eq!(obj.get("key"), Some(&json!("id")));
    assert_eq!(obj.get("prepend"), Some(&json!(false)));
    assert_eq!(obj.get("max"), Some(&json!(500)));
}

#[test]
fn stream_options_prepend_defaults_false_when_absent() {
    // A hand-written frame `{ merge: "crud", key: "id", max: 10 }` (no prepend)
    // must deserialize to prepend=false, matching how handlers.rs builds them.
    let opts: StreamOptions =
        serde_json::from_str(r#"{ "merge": "crud", "key": "id", "max": 10 }"#).unwrap();
    assert!(!opts.prepend);
    assert_eq!(opts.max, Some(10));
    assert_eq!(opts.key.as_deref(), Some("id"));
}

#[test]
fn stream_options_round_trips_all_fields() {
    let opts = StreamOptions {
        merge: MergeStrategy::Presence,
        key: Some("key".to_string()),
        prepend: true,
        max: Some(7),
    };
    let json = serde_json::to_string(&opts).unwrap();
    let back: StreamOptions = serde_json::from_str(&json).unwrap();
    assert_eq!(back.merge, MergeStrategy::Presence);
    assert_eq!(back.key.as_deref(), Some("key"));
    assert!(back.prepend);
    assert_eq!(back.max, Some(7));
}

#[test]
fn rpc_error_serializes_to_code_and_error() {
    let err = RpcError::new("NOT_FOUND", "gone");
    let v = serde_json::to_value(&err).unwrap();
    assert_eq!(v, json!({ "code": "NOT_FOUND", "error": "gone" }));
    // TS: `new RpcError(result.code, result.error)` — must be a plain object pair.
    let obj = v.as_object().unwrap();
    assert_eq!(obj.len(), 2, "no extra fields may leak into the wire error");
}

#[test]
fn rpc_error_constructors_produce_the_documented_codes() {
    let cases = [
        (RpcError::unauthorized("x"), "UNAUTHORIZED"),
        (RpcError::forbidden("x"), "FORBIDDEN"),
        (RpcError::not_found(), "NOT_FOUND"),
        (RpcError::invalid_request("x"), "INVALID_REQUEST"),
        (RpcError::invalid_topic(), "INVALID_TOPIC"),
        (RpcError::internal(), "INTERNAL_ERROR"),
    ];
    for (err, code) in cases {
        assert_eq!(err.code, code);
    }
}

// ── TopicHub fan-out ──────────────────────────────────────────────────────

#[tokio::test]
async fn publish_delivers_the_exact_wire_frame_to_a_subscriber() {
    let hub = TopicHub::default();
    let mut rx = subscribe(&hub, 1, "tasks/list", 4).await;

    hub.publish("tasks/list", "created", json!({ "id": "t1", "title": "hi" }))
        .await;

    let frame = next_frame(&mut rx).await;
    // bridge.ts routes on msg.channel === topic, and applyMerge reads event/data.
    assert_eq!(
        frame,
        json!({
            "channel": "tasks/list",
            "event": "created",
            "data": { "id": "t1", "title": "hi" }
        })
    );
}

#[tokio::test]
async fn publish_volatile_delivers_the_same_wire_frame() {
    let hub = TopicHub::default();
    let mut rx = subscribe(&hub, 1, "habits/list", 4).await;

    hub.publish_volatile("habits/list", "updated", json!({ "id": "h1", "name": "x" }))
        .await;

    let frame = next_frame(&mut rx).await;
    assert_eq!(frame["channel"], "habits/list");
    assert_eq!(frame["event"], "updated");
    assert_eq!(frame["data"]["name"], "x");
}

#[tokio::test]
async fn publish_to_a_topic_with_no_subscribers_is_a_no_op() {
    let hub = TopicHub::default();
    // Should not panic, not queue, not hang.
    hub.publish("orphan/topic", "created", json!({})).await;
    hub.publish_volatile("orphan/topic", "created", json!({})).await;
}

#[tokio::test]
async fn multiple_subscribers_on_the_same_topic_all_receive() {
    let hub = TopicHub::default();
    let mut rx1 = subscribe(&hub, 1, "tasks/list", 4).await;
    let mut rx2 = subscribe(&hub, 2, "tasks/list", 4).await;

    hub.publish("tasks/list", "created", json!({ "id": 1 })).await;

    assert_eq!(next_frame(&mut rx1).await["data"], json!({ "id": 1 }));
    assert_eq!(next_frame(&mut rx2).await["data"], json!({ "id": 1 }));
}

#[tokio::test]
async fn topics_are_isolated_from_each_other() {
    let hub = TopicHub::default();
    let mut rx_tasks = subscribe(&hub, 1, "tasks/list", 4).await;
    let mut rx_notes = subscribe(&hub, 1, "notes/list", 4).await;

    hub.publish("tasks/list", "created", json!({ "id": 1 })).await;

    // Only the tasks subscriber hears it.
    assert_eq!(next_frame(&mut rx_tasks).await["channel"], "tasks/list");
    // The notes subscriber must get nothing — assert with a short timeout.
    assert!(
        tokio::time::timeout(Duration::from_millis(50), rx_notes.recv())
            .await
            .is_err(),
        "notes subscriber must not receive a tasks event"
    );
}

#[tokio::test]
async fn unsubscribe_stops_delivery_for_that_connection() {
    let hub = TopicHub::default();
    let mut rx1 = subscribe(&hub, 1, "tasks/list", 4).await;
    let mut rx2 = subscribe(&hub, 2, "tasks/list", 4).await;

    hub.unsubscribe("tasks/list", 1).await;
    hub.publish("tasks/list", "created", json!({ "id": 1 })).await;

    assert_eq!(next_frame(&mut rx2).await["data"], json!({ "id": 1 }));
    // A connection that unsubscribed must NOT receive the event. Two outcomes
    // are both correct: (a) the channel stays open but times out, or (b) the
    // hub dropped its only sender, closing the channel (recv -> None, i.e. an
    // Ok(None) from timeout, not Err). Either way a message must not arrive.
    assert!(
        no_frame(&mut rx1).await,
        "unsubscribed connection must not receive the event"
    );
}

/// Return true (assert-safe) if `rx` does NOT deliver a text frame within
/// 50 ms. Accepts both a timeout (channel still open) and a closed channel
/// (`Ok(None)`), because unsubscribing drops the hub's only sender.
async fn no_frame(rx: &mut mpsc::Receiver<Message>) -> bool {
    match tokio::time::timeout(Duration::from_millis(50), rx.recv()).await {
        Err(_) => true,                    // timed out, nothing arrived
        Ok(None) => true,                  // sender dropped, channel closed
        Ok(Some(_)) => false,              // a frame arrived — not "no frame"
    }
}

#[tokio::test]
async fn unsubscribe_all_removes_a_connection_from_every_topic() {
    let hub = TopicHub::default();
    let mut rx_a = subscribe(&hub, 1, "tasks/list", 4).await;
    let mut rx_b = subscribe(&hub, 1, "notes/list", 4).await;

    hub.unsubscribe_all(1).await;

    hub.publish("tasks/list", "created", json!({ "id": 1 })).await;
    hub.publish("notes/list", "created", json!({ "id": 2 })).await;

    assert!(no_frame(&mut rx_a).await);
    assert!(no_frame(&mut rx_b).await);
}

#[tokio::test]
async fn one_connection_can_subscribe_to_multiple_topics_and_receive_both() {
    let hub = TopicHub::default();
    let mut rx_tasks = subscribe(&hub, 1, "tasks/list", 8).await;
    let mut rx_notes = subscribe(&hub, 1, "notes/list", 8).await;

    hub.publish("tasks/list", "created", json!({ "id": 1 })).await;
    hub.publish("notes/list", "created", json!({ "id": 2 })).await;

    // Both frames arrive (order matches publish order).
    let tasks_frame = next_frame(&mut rx_tasks).await;
    let notes_frame = next_frame(&mut rx_notes).await;
    assert_eq!(tasks_frame["channel"], "tasks/list");
    assert_eq!(tasks_frame["data"], json!({ "id": 1 }));
    assert_eq!(notes_frame["channel"], "notes/list");
    assert_eq!(notes_frame["data"], json!({ "id": 2 }));
}

// ── Reliable vs volatile backpressure ────────────────────────────────────

#[tokio::test]
async fn reliable_publish_backpressures_a_full_outbox() {
    let hub = TopicHub::default();
    let mut rx = subscribe(&hub, 1, "tasks/list", 1).await;

    // Fill the outbox.
    hub.publish("tasks/list", "created", json!({ "id": 1 })).await;

    // Second reliable publish must BLOCK (await) because the subscriber never
    // drains — the reliable path never silently drops. Assert via timeout.
    let blocked = tokio::time::timeout(
        Duration::from_millis(80),
        hub.publish("tasks/list", "created", json!({ "id": 2 })),
    )
    .await;
    assert!(blocked.is_err(), "reliable publish must backpressure, not drop");

    // Drain one frame and the blocked publish completes, delivering the rest.
    assert_eq!(next_frame(&mut rx).await["data"], json!({ "id": 1 }));
    blocked.unwrap_err(); // the await is still pending in the timed-out future
    // After draining, a fresh publish goes through immediately.
    hub.publish("tasks/list", "created", json!({ "id": 3 })).await;
    assert_eq!(next_frame(&mut rx).await["data"], json!({ "id": 3 }));
}

#[tokio::test]
async fn volatile_publish_drops_on_backpressure_without_blocking() {
    let hub = TopicHub::default();
    let mut rx = subscribe(&hub, 1, "tasks/list", 1).await;

    // Fill the outbox.
    hub.publish_volatile("tasks/list", "created", json!({ "id": 1 })).await;

    // Second volatile publish must return immediately (try_send) and drop.
    let ok = tokio::time::timeout(
        Duration::from_millis(80),
        hub.publish_volatile("tasks/list", "created", json!({ "id": 2 })),
    )
    .await;
    assert!(ok.is_ok(), "volatile publish must never block");

    // Only the first frame was delivered; the overflow frame was dropped.
    assert_eq!(next_frame(&mut rx).await["data"], json!({ "id": 1 }));
    assert!(
        tokio::time::timeout(Duration::from_millis(50), rx.recv())
            .await
            .is_err(),
        "overflowed volatile frame must be dropped, not queued"
    );
}

// ── Reserved `__` topic guard (PublishFn) ────────────────────────────────

#[tokio::test]
async fn publish_fn_rejects_reserved_topics() {
    let hub = TopicHub::default();
    let mut rx = subscribe(&hub, 1, "__rpc", 4).await;
    let pfn = PublishFn { hub };

    let err = pfn.publish("__rpc", "created", json!({})).await.unwrap_err();
    assert_eq!(err.code, "INVALID_TOPIC");
    let err = pfn.publish_volatile("__rpc", "created", json!({})).await.unwrap_err();
    assert_eq!(err.code, "INVALID_TOPIC");

    // Nothing was delivered despite a subscriber listening.
    assert!(
        tokio::time::timeout(Duration::from_millis(50), rx.recv())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn publish_fn_allows_legitimate_topics() {
    let hub = TopicHub::default();
    let mut rx = subscribe(&hub, 1, "notes/list", 4).await;
    let pfn = PublishFn { hub };

    pfn.publish("notes/list", "created", json!({ "id": "n1" }))
        .await
        .expect("a normal topic must be allowed");
    assert_eq!(next_frame(&mut rx).await["data"], json!({ "id": "n1" }));
}

// ── Topic string hygiene ─────────────────────────────────────────────────

#[tokio::test]
async fn topics_with_nested_namespace_are_distinct() {
    let hub = TopicHub::default();
    let mut rx_a = subscribe(&hub, 1, "nutrition/meals", 4).await;
    let mut rx_b = subscribe(&hub, 1, "nutrition/goals", 4).await;

    hub.publish("nutrition/meals", "created", json!({ "id": 1 })).await;

    assert_eq!(next_frame(&mut rx_a).await["channel"], "nutrition/meals");
    assert!(
        tokio::time::timeout(Duration::from_millis(50), rx_b.recv())
            .await
            .is_err(),
        "nutrition/goals must not hear nutrition/meals"
    );
}

// ── RealtimeHub::emit_change → bento://data-changed (consumption bridge) ──

/// Build a real Wry-runtime App (no windows) so `RealtimeHub::new` gets the
/// concrete `AppHandle` it stores. `any_thread()` lets the event loop be
/// created on the test's worker thread; `mock_context(noop_assets())` avoids
/// needing a full `generate_context!`/frontend build.
///
/// NOTE: `mock_app()` is NOT used here — it produces a `MockRuntime` app whose
/// `AppHandle<MockRuntime>` is a different type than `RealtimeHub`'s Wry
/// `AppHandle`. Building the default (Wry) runtime is the documented way to
/// exercise the real emit path (see tauri::test docs).
// ═══════════════════════════════════════════════════════════════════════
// emit_change → bento://data-changed (consumption bridge)
//
// THESE MUST LIVE IN ONE `#[test]`: building a real Wry/GTK `tauri::App`
// seeds glib's process-global main context, which is never fully released
// when the App drops. A SECOND `mock_wry_app()` in the same process then
// panics at init ("Failed to acquire ownership of main context, already
// acquired by another thread"). See GH Actions on the headless ubuntu
// runner. One App, all assertions; split into multiple GTK-app tests ONLY
// if they are moved to separate processes.
// ═══════════════════════════════════════════════════════════════════════

/// Build a real Wry-runtime App (no windows) so `RealtimeHub::new` gets the
/// concrete `AppHandle` it stores. `any_thread()` lets the event loop be
/// created on the test's worker thread; `mock_context(noop_assets())` avoids
/// needing a full `generate_context!`/frontend build.
///
/// NOTE: `mock_app()` is NOT used here — it produces a `MockRuntime` app whose
/// `AppHandle<MockRuntime>` is a different type than `RealtimeHub`'s Wry
/// `AppHandle`. Building the default (Wry) runtime is the documented way to
/// exercise the real emit path (see tauri::test docs).
fn mock_wry_app() -> tauri::App {
    tauri::Builder::default()
        .any_thread()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("failed to build mock Wry app")
}

/// Combine the previous two emit_change tests into a single process so only
/// ONE GTK/Wry app is ever built. Verifies:
///   - hub fan-out delivers the exact wire frame bridge.ts routes on;
///   - a `bento://data-changed` event fires with EXACTLY `{ topic, event }`
///     (the payload `initDataChangedListener` parses) — no `data` leak.
#[tokio::test]
async fn emit_change_fans_out_to_hub_and_emits_data_changed_event() {
    let app = mock_wry_app();
    let app_handle = app.handle().clone();
    let hub = RealtimeHub::new(app_handle.clone());

    // 1) A realtime subscriber on the topic hears the CRUD frame (hub fan-out).
    let mut rx = subscribe(&hub.hub, 1, "tasks/list", 4).await;

    // 2) A Rust-side listener captures the `bento://data-changed` Tauri event
    //    the WebView's `initDataChangedListener` will consume.
    let (tx, mut rx_event) = mpsc::channel::<String>(4);
    app_handle.listen("bento://data-changed", move |event| {
        let _ = tx.try_send(event.payload().to_string());
    });

    hub.emit_change("tasks/list", "created", json!({ "id": "t1" })).await;

    // Hub fan-out: the exact wire frame bridge.ts routes on.
    let frame = next_frame(&mut rx).await;
    assert_eq!(
        frame,
        json!({
            "channel": "tasks/list",
            "event": "created",
            "data": { "id": "t1" }
        })
    );

    // Consumption bridge: the payload initDataChangedListener parses.
    let payload = rx_event.recv().await.expect("expected a data-changed event");
    let v: Value = serde_json::from_str(&payload).expect("payload must be JSON");
    assert_eq!(
        v,
        json!({ "topic": "tasks/list", "event": "created" }),
        "data-changed payload must be {{ topic, event }} for the TS bridge"
    );

    // 3) A different topic/event flows through the SAME app + hub: the reported
    //    topic/event must round-trip exactly, and -- critically -- the full CRUD
    //    `data` payload must NOT be part of the data-changed event (modules
    //    re-fetch rather than consume the mutation payload). This assertion
    //    previously lived in a second test whose second `mock_wry_app()` could
    //    not init (glib main-context ownership).
    let (tx2, mut rx_event2) = mpsc::channel::<String>(4);
    app_handle.listen("bento://data-changed", move |event| {
        let _ = tx2.try_send(event.payload().to_string());
    });

    hub.emit_change("sleep/routine-status", "created", json!({ "routineId": "r1" }))
        .await;

    let payload2 = rx_event2.recv().await.expect("expected a data-changed event");
    let v2: Value = serde_json::from_str(&payload2).unwrap();
    assert_eq!(v2["topic"], "sleep/routine-status");
    assert_eq!(v2["event"], "created");
    // The data payload is NOT part of the data-changed event — modules re-fetch.
    assert_eq!(v2.get("data"), None);
}
