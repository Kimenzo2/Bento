// ═══════════════════════════════════════════════════════════════════════
// LOCALSTORE TRANSCRIPTION — Rust backend module
// Source: local_store-ts Interface layer (interface/block/*.ts, interface/object.ts)
// ═══════════════════════════════════════════════════════════════════════
// This module mirrors LocalStore's block + object type system for use in
// the Genesis Desktop Notes, Tasks, Journal, and other content modules.
//
// TypeScript → Rust migration strategy:
//   - Enums → Rust enums with serde (rename_all/camelCase)
//   - Interfaces → Rust structs with Serialize/Deserialize
//   - content: any → BlockContent tagged union enum
//   - MobX class methods → free helper functions
// ═══════════════════════════════════════════════════════════════════════

pub mod block;
pub mod object;
pub mod operations;

pub use block::*;
pub use object::*;
pub use operations::*;

// ─── LocalStore SQL Schema (embedded for reference) ──────────────────────
// The actual tables are created in src-tauri/src/db.rs via run_migrations().
// This constant provides the SQL as a single string for documentation
// and potential test database initialization.

pub const LOCALSTORE_SCHEMA_SQL: &str = include_str!("../../migrations/0002_local_store_schema.sql");
