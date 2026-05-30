// ════════════════════════════════════════════════════════════════════════
// NOTES MODULE — 1:1 Rust port of anytype-heart/core/block CRUD in Go
// ════════════════════════════════════════════════════════════════════════
//
// Source mapping (Go → Rust):
//   core/block/editor.go             → service.rs  (all block edit ops)
//   core/block/create.go             → service.rs  (object_create, object_duplicate)
//   core/block/delete.go             → service.rs  (object_delete, before_delete)
//   core/block/object/objectcreator/ → service.rs  (create_note_object)
//   core/block/undo/                 → undo.rs     (history stack)
//
// Environment delta vs Go source:
//   Go: distributed CRDT / any-sync, space/spaceID, restrictions, event bus,
//       SmartBlock cache.Do(), domain.Details protobuf
//   Rust: local SQLite only, no space concept, all ops allowed locally,
//         direct sqlx pool, serde_json::Value for details, Tauri IPC events
// ════════════════════════════════════════════════════════════════════════

pub mod commands;
pub mod service;
pub mod undo;

pub use service::NoteFullCache;
