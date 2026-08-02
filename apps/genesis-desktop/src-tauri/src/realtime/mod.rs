// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Realtime Server — native WebSocket RPC + reactive subscriptions.
//!
//! Harvested design from svelte-realtime (lanteanio), rewritten natively:
//!   - Server functions (RPC) callable over WebSocket.
//!   - Reactive streams with initial data + live merge events.
//!   - Envelope protocol: `{ rpc, id, args }` / `{ rpc, args }` (volatile) /
//!     `{ rpc, id, args, stream: true }` (subscribe) / `{ batch: [...] }`.
//!   - Responses on channel `__rpc`, stream events on the topic channel.
//!   - Server-authoritative merge opts (`merge`, `key`, `prepend`, `max`)
//!     delivered in the subscribe response.
//!
//! Binds `0.0.0.0:14873` so the phone can connect over the LAN. Auth is a
//! Supabase session binding handshake, tier-gated on `can_sync()`.

pub mod auth;
pub mod handlers;

use std::{
    collections::HashMap,
    future::Future,
    net::SocketAddr,
    pin::Pin,
    sync::Arc,
};

use futures_util::{SinkExt, StreamExt};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    net::TcpListener as TokioTcpListener,
    sync::{mpsc, Mutex as TokioMutex},
};
use tokio_tungstenite::tungstenite::protocol::Message;

use crate::auth::AuthManager;

/// Default realtime port. Falls back to a random available port if taken.
const DEFAULT_REALTIME_PORT: u16 = 14873;

/// Max accepted JSON frame bytes (matches the clone's 1 MB default cap).
const MAX_FRAME_BYTES: usize = 1024 * 1024;

/// Max frames queued to a backpressured subscriber before drops.
const MAX_OUTBOX: usize = 1024;

// ── Wire protocol types ───────────────────────────────────────────────────

/// A live function's execution context. Mirrors the clone's `ctx` argument.
#[derive(Clone)]
pub struct LiveCtx {
    pub user_id: String,
    pub user_name: String,
    pub device_id: String,
    pub request_id: String,
    pub app: AppHandle,
    pub pool: SqlitePool,
    /// Publish an event to all subscribers of a topic. Rejects `__`-prefixed
    /// topics (framework-internal channels).
    pub publish: PublishFn,
}

#[derive(Clone)]
pub struct PublishFn {
    pub hub: TopicHub,
}

impl PublishFn {
    /// Publish an event to a topic. Rejects `__`-prefixed topics with
    /// `INVALID_TOPIC` — those are reserved for framework channels.
    pub async fn publish(
        &self,
        topic: &str,
        event: &str,
        data: Value,
    ) -> Result<(), RpcError> {
        if topic.starts_with("__") {
            return Err(RpcError::invalid_topic());
        }
        self.hub.publish(topic, event, data).await;
        Ok(())
    }

    /// Volatile publish: drop on backpressure instead of queueing.
    pub async fn publish_volatile(
        &self,
        topic: &str,
        event: &str,
        data: Value,
    ) -> Result<(), RpcError> {
        if topic.starts_with("__") {
            return Err(RpcError::invalid_topic());
        }
        self.hub.publish_volatile(topic, event, data).await;
        Ok(())
    }
}

/// RPC error, serialized as `{ ok: false, code, error }`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RpcError {
    pub code: String,
    pub error: String,
}

impl RpcError {
    pub fn new(code: &str, error: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            error: error.into(),
        }
    }
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::new("UNAUTHORIZED", msg)
    }
    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::new("FORBIDDEN", msg)
    }
    pub fn not_found() -> Self {
        Self::new("NOT_FOUND", "Not found")
    }
    pub fn invalid_request(msg: impl Into<String>) -> Self {
        Self::new("INVALID_REQUEST", msg)
    }
    pub fn invalid_topic() -> Self {
        Self::new("INVALID_TOPIC", "Topic uses reserved prefix '__'")
    }
    pub fn internal() -> Self {
        Self::new("INTERNAL_ERROR", "Internal server error")
    }
}

// ── Merge strategies (harvested from svelte-realtime shared/merge) ───────

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MergeStrategy {
    Crud,
    Latest,
    Set,
    Presence,
    Cursor,
}

impl Default for MergeStrategy {
    fn default() -> Self {
        Self::Crud
    }
}

/// Server-authoritative stream options, delivered to the client in the
/// subscribe response (client-supplied opts are overridden — server wins).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamOptions {
    pub merge: MergeStrategy,
    pub key: Option<String>,
    #[serde(default)]
    pub prepend: bool,
    pub max: Option<u32>,
}

// ── Handler registry ──────────────────────────────────────────────────────

type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

pub type RpcHandler = Arc<
    dyn Fn(LiveCtx, Vec<Value>) -> BoxFuture<'static, Result<Value, RpcError>>
        + Send
        + Sync,
>;

pub struct StreamDecl {
    pub loader: RpcHandler,
    pub options: StreamOptions,
}

/// Registry of RPC + stream handlers, keyed by path (e.g. `tasks/list`).
#[derive(Clone, Default)]
pub struct Registry {
    inner: Arc<std::sync::RwLock<HashMap<String, RegistryEntry>>>,
}

#[derive(Clone)]
enum RegistryEntry {
    Rpc(RpcHandler),
    Stream(Arc<StreamDecl>),
}

impl Registry {
    /// Register an RPC handler — mirrors `live(fn)` from the clone.
    pub fn rpc<F, Fut>(&self, path: &str, f: F)
    where
        F: Fn(LiveCtx, Vec<Value>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Value, RpcError>> + Send + 'static,
    {
        let handler: RpcHandler = Arc::new(move |ctx, args| Box::pin(f(ctx, args)));
        self.inner
            .write()
            .unwrap()
            .insert(path.to_string(), RegistryEntry::Rpc(handler));
    }

    /// Register a typed RPC handler (args deserialized by serde).
    pub fn rpc_typed<A, F, Fut>(&self, path: &str, f: F)
    where
        A: DeserializeOwned + Send + 'static,
        F: Fn(LiveCtx, A) -> Fut + Send + Sync + Clone + 'static,
        Fut: Future<Output = Result<Value, RpcError>> + Send + 'static,
    {
        let handler: RpcHandler = Arc::new(move |ctx, args| {
            let f = f.clone();
            Box::pin(async move {
                let arg: A = parse_single_arg(&args).map_err(RpcError::invalid_request)?;
                f(ctx, arg).await
            })
        });
        self.inner
            .write()
            .unwrap()
            .insert(path.to_string(), RegistryEntry::Rpc(handler));
    }

    /// Register a reactive stream — mirrors `live.stream(topic, loader, opts)`.
    pub fn stream<F, Fut>(&self, path: &str, loader: F, options: StreamOptions)
    where
        F: Fn(LiveCtx, Vec<Value>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Value, RpcError>> + Send + 'static,
    {
        let handler: RpcHandler = Arc::new(move |ctx, args| Box::pin(loader(ctx, args)));
        let decl = Arc::new(StreamDecl {
            loader: handler,
            options,
        });
        self.inner
            .write()
            .unwrap()
            .insert(path.to_string(), RegistryEntry::Stream(decl));
    }

    fn get(&self, path: &str) -> Option<RegistryEntry> {
        self.inner
            .read()
            .unwrap()
            .get(path)
            .cloned()
    }
}

fn parse_single_arg<A: DeserializeOwned>(args: &[Value]) -> Result<A, String> {
    let value = args.first().cloned().unwrap_or(Value::Null);
    serde_json::from_value(value).map_err(|e| format!("Invalid args: {e}"))
}

// ── Topic hub (publish/subscribe) ─────────────────────────────────────────

type OutboxSender = mpsc::Sender<Message>;

/// Per-topic fan-out registry. Volatile publishes drop on backpressure.
#[derive(Clone, Default)]
pub struct TopicHub {
    topics: Arc<TokioMutex<HashMap<String, HashMap<u64, OutboxSender>>>>,
}

impl TopicHub {
    /// Attach a subscriber's outbox to a topic. Public so integration tests
    /// can exercise fan-out end-to-end (publish is already public).
    pub async fn subscribe(&self, topic: &str, conn_id: u64, tx: OutboxSender) {
        let mut map = self.topics.lock().await;
        map.entry(topic.to_string())
            .or_default()
            .insert(conn_id, tx);
    }

    pub async fn unsubscribe(&self, topic: &str, conn_id: u64) {
        let mut map = self.topics.lock().await;
        if let Some(txns) = map.get_mut(topic) {
            txns.remove(&conn_id);
            if txns.is_empty() {
                map.remove(topic);
            }
        }
    }

    pub async fn unsubscribe_all(&self, conn_id: u64) {
        let mut map = self.topics.lock().await;
        for txns in map.values_mut() {
            txns.remove(&conn_id);
        }
        map.retain(|_, txns| !txns.is_empty());
    }

    /// Reliable fan-out: await each subscriber's outbox so the frame is
    /// guaranteed queued. Bounded by `MAX_OUTBOX`; a subscriber that never
    /// drains gets backpressure (never silent drops on the reliable path).
    pub async fn publish(&self, topic: &str, event: &str, data: Value) {
        let frame = json!({ "channel": topic, "event": event, "data": data });
        let payload = frame.to_string();
        let map = self.topics.lock().await;
        if let Some(txns) = map.get(topic) {
            for tx in txns.values() {
                let _ = tx.send(Message::Text(payload.clone().into())).await;
            }
        }
    }

    /// Volatile fan-out: drop on backpressure (best-effort). Never blocks the
    /// publisher on a slow subscriber.
    pub async fn publish_volatile(&self, topic: &str, event: &str, data: Value) {
        let frame = json!({ "channel": topic, "event": event, "data": data });
        let payload = frame.to_string();
        let map = self.topics.lock().await;
        if let Some(txns) = map.get(topic) {
            for tx in txns.values() {
                let _ = tx.try_send(Message::Text(payload.clone().into()));
            }
        }
    }
}

// ── Managed hub (Tauri commands → publish events) ────────────────────────

/// Newtype wrapper so Tauri can manage the `TopicHub` as app state.
/// Mutation commands (save_task, toggle_habit, etc.) hold `State<'_, RealtimeHub>`
/// and call `emit_change(...)` after every DB write. Holds the `AppHandle` so a
/// single call fans out to realtime subscribers AND emits `bento://data-changed`
/// to the main window for module-level refresh.
#[derive(Clone)]
pub struct RealtimeHub {
    pub hub: TopicHub,
    app: AppHandle,
}

impl RealtimeHub {
    pub fn new(app: AppHandle) -> Self {
        Self {
            hub: TopicHub::default(),
            app,
        }
    }

    /// Publish a CRUD event to a topic. Volatile is fine — the UI will
    /// re-fetch on reconnect if it misses a frame.
    pub async fn emit(&self, topic: &str, event: &str, data: Value) {
        self.hub.publish_volatile(topic, event, data).await;
    }

    /// Central mutation hook: fan a CRUD event out to realtime subscribers
    /// (the WebView + any phone) AND emit a `bento://data-changed` Tauri event
    /// to the main window so every open module re-fetches. Call after every DB write.
    pub async fn emit_change(&self, topic: &str, event: &str, data: Value) {
        self.emit(topic, event, data).await;
        let _ = self.app.emit(
            "bento://data-changed",
            json!({ "topic": topic, "event": event }),
        );
    }
}

// ── Connection info (Tauri command → Settings UI) ─────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeConnectionInfo {
    /// LAN URL the phone should connect to: `ws://<lan-ip>:<port>`.
    pub url: String,
    /// Loopback URL the desktop WebView connects to.
    pub local_url: String,
    pub port: u16,
    pub lan_ip: Option<String>,
    pub status: String,
}

/// Tauri command — return realtime connection info for the Settings UI.
#[tauri::command]
pub async fn get_realtime_connection_info(app: AppHandle) -> Result<RealtimeConnectionInfo, String> {
    app.try_state::<RealtimeConnectionInfo>()
        .ok_or_else(|| "Realtime server not initialized".to_string())
        .map(|info| info.inner().clone())
}

/// Session info the desktop WebView needs for the auth handshake.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeAuthInfo {
    pub access_token: String,
    pub user_id: String,
}

/// Tauri command — return the current session's Supabase access token for the
/// realtime auth handshake. The desktop WebView authenticates to its own local
/// realtime server with the same token the phone will present.
#[tauri::command]
pub async fn get_realtime_auth(app: AppHandle) -> Result<Option<RealtimeAuthInfo>, String> {
    let auth = app
        .try_state::<AuthManager>()
        .ok_or_else(|| "Auth manager not initialized".to_string())?;
    let session = auth.current_session().await;
    Ok(session.map(|s| RealtimeAuthInfo {
        access_token: s.access_token,
        user_id: s.user.id,
    }))
}

// ── Server bootstrap ──────────────────────────────────────────────────────

/// Try the default port first, then fall back to a random available port.
/// Binds `0.0.0.0` so phones on the LAN can connect.
async fn find_available_port() -> Result<(TokioTcpListener, u16), String> {
    match TokioTcpListener::bind(format!("0.0.0.0:{DEFAULT_REALTIME_PORT}")).await {
        Ok(listener) => {
            let port = listener
                .local_addr()
                .map_err(|e| format!("Failed to get local address: {e}"))?
                .port();
            eprintln!("[realtime] using default port {port}");
            Ok((listener, port))
        }
        Err(_) => {
            eprintln!("[realtime] default port {DEFAULT_REALTIME_PORT} taken, using random port");
            let listener = TokioTcpListener::bind("0.0.0.0:0")
                .await
                .map_err(|e| format!("Failed to bind port: {e}"))?;
            let port = listener
                .local_addr()
                .map_err(|e| format!("Failed to get local address: {e}"))?
                .port();
            Ok((listener, port))
        }
    }
}

/// Best-effort LAN IP for the phone pairing URL. Uses the UDP "connect" trick:
/// the OS picks the default-route local address without sending any packets.
fn lan_ip() -> Option<String> {
    use std::net::UdpSocket;
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    let ip = sock.local_addr().ok()?.ip();
    if ip.is_unspecified() || ip.is_loopback() {
        None
    } else {
        Some(ip.to_string())
    }
}

/// Spawn the realtime server as a Tokio task inside the Tauri backend.
///
/// Called from lib.rs setup after the SqlitePool and AuthManager are
/// initialized. Returns the bound port.
pub async fn spawn_realtime_server(
    app: AppHandle,
    pool: SqlitePool,
    hub: RealtimeHub,
) -> Result<u16, String> {
    let (listener, port) = find_available_port().await?;
    let lan_ip = lan_ip();
    let url = match &lan_ip {
        Some(ip) => format!("ws://{ip}:{port}"),
        None => format!("ws://127.0.0.1:{port}"),
    };
    let local_url = format!("ws://127.0.0.1:{port}");

    eprintln!("[realtime] starting realtime server on {url}");

    // Build the handler registry (RPC + streams).
    let registry = Arc::new(Registry::default());
    handlers::register(&app, &pool, &registry).await;

    // Store connection info in Tauri state.
    app.manage(RealtimeConnectionInfo {
        url: url.clone(),
        local_url,
        port,
        lan_ip,
        status: "running".to_string(),
    });

    // Spawn the accept loop.
    let app_handle = app.clone();
    let registry_clone = registry.clone();
    let hub_clone = hub.hub.clone();
    tokio::spawn(async move {
        eprintln!("[realtime] listening on port {port}");
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    let app = app_handle.clone();
                    let registry = registry_clone.clone();
                    let hub = hub_clone.clone();
                    let pool = pool.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_connection(app, registry, hub, pool, stream, addr).await
                        {
                            eprintln!("[realtime] connection {addr} closed: {e}");
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[realtime] accept error: {e}");
                }
            }
        }
    });

    // Signal that realtime is ready.
    let _ = app.emit(
        "bento://realtime-ready",
        json!({ "url": url, "port": port }),
    );

    Ok(port)
}

// ── Connection handling ───────────────────────────────────────────────────

pub(crate) struct Peer {
    conn_id: u64,
    user_id: String,
    user_name: String,
    device_id: String,
}

async fn handle_connection(
    app: AppHandle,
    registry: Arc<Registry>,
    hub: TopicHub,
    pool: SqlitePool,
    stream: tokio::net::TcpStream,
    addr: SocketAddr,
) -> Result<(), String> {
    let ws_stream = tokio_tungstenite::accept_async(stream)
        .await
        .map_err(|e| format!("WebSocket handshake failed: {e}"))?;
    eprintln!("[realtime] connection established: {addr}");

    let (mut ws_sink, mut ws_stream) = ws_stream.split();

    // ── Auth handshake ────────────────────────────────────────────────
    let peer = match auth::authenticate(&app, &pool, &mut ws_sink, &mut ws_stream).await? {
        Some(peer) => peer,
        None => return Ok(()), // handshake rejected, connection closed
    };
    let conn_id = peer.conn_id;
    let user_id = peer.user_id.clone();
    let user_name = peer.user_name.clone();
    let device_id = peer.device_id.clone();

    // ── Outbox → socket write pump ────────────────────────────────────
    let (tx, mut rx) = mpsc::channel::<Message>(MAX_OUTBOX);
    let mut sink = ws_sink;
    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    // ── Inbound message loop ──────────────────────────────────────────
    loop {
        let msg = match ws_stream.next().await {
            Some(Ok(msg)) => msg,
            Some(Err(_)) | None => break,
        };

        let text = match msg {
            Message::Text(t) => t.to_string(),
            Message::Binary(_) => continue, // binary RPC not yet supported
            Message::Close(_) => break,
            Message::Ping(p) => {
                let _ = tx.send(Message::Pong(p)).await;
                continue;
            }
            Message::Pong(_) | Message::Frame(_) => continue,
        };

        if text.len() > MAX_FRAME_BYTES {
            let _ = tx.send(Message::Text(
                json!({ "channel": "__rpc", "event": "", "data": { "ok": false, "code": "PAYLOAD_TOO_LARGE", "error": "Frame exceeds 1 MB" } })
                    .to_string()
                    .into(),
            ))
            .await;
            break;
        }

        let parsed: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => {
                let _ = tx.send(Message::Text(
                    json!({ "channel": "__rpc", "event": "", "data": { "ok": false, "code": "INVALID_REQUEST", "error": "Malformed frame" } })
                        .to_string()
                        .into(),
                ))
                .await;
                continue;
            }
        };

        let ctx = LiveCtx {
            user_id: user_id.clone(),
            user_name: user_name.clone(),
            device_id: device_id.clone(),
            request_id: format!("{conn_id}-{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)),
            app: app.clone(),
            pool: pool.clone(),
            publish: PublishFn { hub: hub.clone() },
        };

        // Batch frame: `{ "batch": [...] }`
        if let Some(batch) = parsed.get("batch").and_then(|b| b.as_array()) {
            let mut results = Vec::with_capacity(batch.len());
            for item in batch {
                let rpc = item.get("rpc").and_then(|r| r.as_str()).unwrap_or("");
                let id = item.get("id").and_then(|r| r.as_str()).unwrap_or("");
                let args = item.get("args").and_then(|a| a.as_array()).cloned().unwrap_or_default();
                let stream = item.get("stream").and_then(|s| s.as_bool()).unwrap_or(false);
                let result = dispatch(&registry, &ctx, &hub, conn_id, &tx, rpc, &args, stream, id).await;
                results.push(result);
            }
            let _ = tx.send(Message::Text(
                json!({ "channel": "__rpc", "event": "__batch", "data": { "ok": true, "batch": results } })
                    .to_string()
                    .into(),
            ))
            .await;
            continue;
        }

        let rpc = parsed.get("rpc").and_then(|r| r.as_str()).unwrap_or("");
        let id = parsed.get("id").and_then(|r| r.as_str()).unwrap_or("");
        let args = parsed.get("args").and_then(|a| a.as_array()).cloned().unwrap_or_default();
        let stream = parsed.get("stream").and_then(|s| s.as_bool()).unwrap_or(false);

        // Volatile RPC: frames with no `id` signal "no reply expected".
        if id.is_empty() && !stream {
            let _ = dispatch(&registry, &ctx, &hub, conn_id, &tx, rpc, &args, false, "").await;
            continue;
        }

        let result = dispatch(&registry, &ctx, &hub, conn_id, &tx, rpc, &args, stream, id).await;
        // Frame to client: `{ channel: "__rpc", event: <id>, data: <result> }`
        let envelope = json!({ "channel": "__rpc", "event": id, "data": result });
        let _ = tx.send(Message::Text(envelope.to_string().into())).await;
    }

    // Cleanup
    hub.unsubscribe_all(conn_id).await;
    let _ = write_task.await;
    eprintln!("[realtime] connection {addr} disconnected");
    Ok(())
}

/// Dispatch a single RPC / subscribe and build the response payload.
///
/// Response payload shape (harvested from svelte-realtime):
///   success RPC:   `{ ok: true, data, requestId }`
///   success stream: `{ ok: true, data, topic, requestId, merge, key, prepend, max }`
///   failure:        `{ ok: false, code, error, requestId }`
async fn dispatch(
    registry: &Registry,
    ctx: &LiveCtx,
    hub: &TopicHub,
    conn_id: u64,
    tx: &OutboxSender,
    rpc: &str,
    args: &[Value],
    stream: bool,
    _id: &str,
) -> Value {
    let entry = match registry.get(rpc) {
        Some(e) => e,
        None => {
            return json!({
                "ok": false, "code": "NOT_FOUND", "error": format!("Not found: {rpc}")
            });
        }
    };

    let request_id = ctx.request_id.clone();

    match entry {
        RegistryEntry::Rpc(handler) => {
            if stream {
                return json!({
                    "ok": false, "code": "INVALID_REQUEST", "error": "Stream not registered"
                });
            }
            let ctx = ctx.clone();
            let args = args.to_vec();
            match handler(ctx, args).await {
                Ok(data) => json!({ "ok": true, "data": data, "requestId": request_id }),
                Err(e) => json!({ "ok": false, "code": e.code, "error": e.error, "requestId": request_id }),
            }
        }
        RegistryEntry::Stream(decl) => {
            if !stream {
                // A plain RPC against a stream path: execute the loader once.
                let ctx = ctx.clone();
                let args = args.to_vec();
                return match (decl.loader)(ctx, args).await {
                    Ok(data) => json!({ "ok": true, "data": data, "requestId": request_id }),
                    Err(e) => json!({ "ok": false, "code": e.code, "error": e.error, "requestId": request_id }),
                };
            }

            // Subscribe: attach this connection to the topic hub so live
            // publish events fan out to it, then run the loader for initial
            // data, and return the server-authoritative merge options.
            hub.subscribe(rpc, conn_id, tx.clone()).await;
            let opts = decl.options.clone();
            let loader = decl.loader.clone();
            let ctx = ctx.clone();
            let args = args.to_vec();
            match loader(ctx, args).await {
                Ok(data) => json!({
                    "ok": true,
                    "data": data,
                    "topic": rpc,
                    "requestId": request_id,
                    "merge": opts.merge,
                    "key": opts.key,
                    "prepend": opts.prepend,
                    "max": opts.max,
                }),
                Err(e) => {
                    hub.unsubscribe(rpc, conn_id).await;
                    json!({ "ok": false, "code": e.code, "error": e.error, "requestId": request_id })
                }
            }
        }
    }
}
