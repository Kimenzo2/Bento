// ════════════════════════════════════════════════════════════════════════
// NOTES UNDO/REDO — Rust port of anytype-heart/core/block/undo
// ════════════════════════════════════════════════════════════════════════
//
// Go source: core/block/undo/history.go
//   type History struct { changes []*Change; pos int; limit int }
//   func (h *History) Add(c *Change)
//   func (h *History) Previous() (c *Change, err error)
//   func (h *History) Next() (c *Change, err error)
//
// Port decisions:
//   - Go uses an in-memory Change list per SmartBlock session.
//   - Rust: same approach — per-note in-memory undo stack behind a Mutex.
//   - Changes are serialized snapshots of the affected block's SQL row,
//     so Undo/Redo are pure SQL restores — no CRDT replay needed.
//   - Max history: 100 changes per note (matches anytype-heart default).
// ════════════════════════════════════════════════════════════════════════

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Maximum number of undo steps kept per note object.
/// Go source: undo/history.go — const undoLimit = 100
pub const UNDO_LIMIT: usize = 100;

/// A single undoable change.
/// Go source: undo/history.go — type Change struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    /// Unique change ID (UUID).
    pub id: String,
    /// The note object this change belongs to.
    pub object_id: String,
    /// Human-readable description of the change.
    pub description: String,
    /// Blocks before the change (for Undo). JSON-serialized Vec<BlockSnapshot>.
    pub before: Vec<BlockSnapshot>,
    /// Blocks after the change (for Redo). JSON-serialized Vec<BlockSnapshot>.
    pub after: Vec<BlockSnapshot>,
    /// Timestamp (ms since epoch).
    pub created_at: i64,
}

/// Snapshot of a single block row sufficient to restore it.
/// Source: the fields of local_store::block::BlockRow that matter for history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSnapshot {
    pub id: String,
    pub object_id: String,
    pub parent_id: Option<String>,
    pub r#type: String,
    pub content: String, // JSON string
    pub fields: String,  // JSON string
    pub align: i32,
    pub bg_color: String,
    pub position: i32,
    /// None means the block did not exist before the change (was created).
    pub existed: bool,
}

/// Per-note undo history.
/// Go source: undo/history.go — type History struct { changes []*Change; pos int }
#[derive(Debug, Default)]
pub struct NoteHistory {
    /// Ordered list of changes (oldest → newest).
    pub changes: Vec<Change>,
    /// Current position. Starts at 0 (nothing undone).
    /// `pos == changes.len()` means we are at the head (nothing to redo).
    pub pos: usize,
}

impl NoteHistory {
    /// Add a new change, discarding any future (redoable) changes.
    /// Go source: History.Add(c *Change)
    pub fn push(&mut self, change: Change) {
        // Truncate redo branch
        self.changes.truncate(self.pos);
        self.changes.push(change);
        if self.changes.len() > UNDO_LIMIT {
            self.changes.remove(0);
        } else {
            self.pos += 1;
        }
    }

    /// Returns the change to undo (moves cursor back).
    /// Go source: History.Previous() (*Change, error)
    pub fn undo(&mut self) -> Option<&Change> {
        if self.pos == 0 {
            return None;
        }
        self.pos -= 1;
        self.changes.get(self.pos)
    }

    /// Returns the change to redo (moves cursor forward).
    /// Go source: History.Next() (*Change, error)
    pub fn redo(&mut self) -> Option<&Change> {
        if self.pos >= self.changes.len() {
            return None;
        }
        let c = self.changes.get(self.pos);
        self.pos += 1;
        c
    }

    pub fn can_undo(&self) -> bool {
        self.pos > 0
    }
    pub fn can_redo(&self) -> bool {
        self.pos < self.changes.len()
    }
}

/// Global in-memory history registry (note_id → NoteHistory).
/// Go source: the per-SmartBlock session that holds History in memory.
pub struct HistoryRegistry {
    inner: Mutex<HashMap<String, NoteHistory>>,
}

impl HistoryRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn push(&self, note_id: &str, change: Change) {
        let mut map = self.inner.lock().unwrap();
        map.entry(note_id.to_string()).or_default().push(change);
    }

    pub fn undo(&self, note_id: &str) -> Option<Change> {
        let mut map = self.inner.lock().unwrap();
        map.entry(note_id.to_string()).or_default().undo().cloned()
    }

    pub fn redo(&self, note_id: &str) -> Option<Change> {
        let mut map = self.inner.lock().unwrap();
        map.entry(note_id.to_string()).or_default().redo().cloned()
    }

    pub fn can_undo(&self, note_id: &str) -> bool {
        self.inner
            .lock()
            .unwrap()
            .get(note_id)
            .map_or(false, |h| h.can_undo())
    }

    pub fn can_redo(&self, note_id: &str) -> bool {
        self.inner
            .lock()
            .unwrap()
            .get(note_id)
            .map_or(false, |h| h.can_redo())
    }

    /// Clear history for a note (called on object delete).
    pub fn clear(&self, note_id: &str) {
        self.inner.lock().unwrap().remove(note_id);
    }
}

impl Default for HistoryRegistry {
    fn default() -> Self {
        Self::new()
    }
}
