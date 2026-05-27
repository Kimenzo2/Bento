// session/mod.rs — port of core/session from Go
// Go source: core/session/*.go

use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Mirrors Go: session.Context  — carries a session token and accumulates
/// response events that get flushed back to the caller after each RPC.
#[derive(Debug, Clone)]
pub struct Context {
    pub session_token: Option<String>,
    events: Arc<Mutex<Vec<ResponseEvent>>>,
}

impl Context {
    pub fn new() -> Self {
        Self { session_token: None, events: Arc::new(Mutex::new(vec![])) }
    }

    pub fn with_session(token: impl Into<String>) -> Self {
        Self { session_token: Some(token.into()), events: Arc::new(Mutex::new(vec![])) }
    }

    /// Mirrors Go: session.Context.AddResponseEvent
    pub fn add_event(&self, event: ResponseEvent) {
        self.events.lock().unwrap().push(event);
    }

    /// Mirrors Go: session.Context.GetResponseEvent — drains accumulated events
    pub fn drain_events(&self) -> Vec<ResponseEvent> {
        let mut guard = self.events.lock().unwrap();
        std::mem::take(&mut *guard)
    }
}

impl Default for Context {
    fn default() -> Self { Self::new() }
}

/// A single event emitted during an operation.
/// Mirrors the pb.Event / pb.EventMessage structure.
#[derive(Debug, Clone)]
pub struct ResponseEvent {
    pub context_id: String,
    pub messages:   Vec<EventMessage>,
}

#[derive(Debug, Clone)]
pub enum EventMessage {
    ObjectDetailsSet { object_id: String, details: crate::domain::Details },
    BlockAdd         { context_id: String, block_id: String },
    BlockDelete      { context_id: String, block_id: String },
    BlockUpdate      { context_id: String, block_id: String },
}

/// Mirrors Go: getSessionToken() — extract token from request metadata
pub fn extract_token(token: Option<&str>) -> Option<String> {
    token.filter(|t| !t.is_empty()).map(|t| t.to_owned())
}

/// Mirrors Go: mw.newContext()
pub fn new_context(token: Option<&str>) -> Context {
    match extract_token(token) {
        Some(tok) => Context::with_session(tok),
        None      => Context::new(),
    }
}

/// Generate a new unique session token — mirrors bson.NewObjectId().Hex()
pub fn new_group_id() -> String {
    Uuid::new_v4().to_string().replace('-', "")
}
