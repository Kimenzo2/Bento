// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// LOCALSTORE OBJECT TYPES — Rust transcription
// Source: src/ts/interface/object.ts + src/ts/interface/block/dataview.ts
// ═══════════════════════════════════════════════════════════════════════
// TRANSCRIPTION: Field names and enum values match LocalStore's TypeScript
// source exactly (converted to snake_case for Rust conventions).
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── ObjectLayout ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum ObjectLayout

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ObjectLayout {
    Page = 0,
    Human = 1,
    Task = 2,
    Set = 3,
    Type = 4,
    Relation = 5,
    File = 6,
    Dashboard = 7,
    Image = 8,
    Note = 9,
    Space = 10,
    Bookmark = 11,
    OptionList = 12,
    Option = 13,
    Collection = 14,
    Audio = 15,
    Video = 16,
    Date = 17,
    SpaceView = 18,
    Participant = 19,
    Pdf = 20,
    ChatOld = 21,
    Chat = 22,
    Discussion = 27,
    Empty = 100,
    Navigation = 101,
    Graph = 102,
    History = 103,
    Archive = 104,
    Block = 105,
    Settings = 106,
}

// ─── RelationType ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum RelationType

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RelationType {
    LongText = 0,
    ShortText = 1,
    Number = 2,
    Select = 3,
    Date = 4,
    File = 5,
    Checkbox = 6,
    Url = 7,
    Email = 8,
    Phone = 9,
    Icon = 10,
    MultiSelect = 11,
    Object = 100,
    Relations = 101,
}

// ─── RelationScope ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum RelationScope

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RelationScope {
    Object = 0,
    Type = 1,
    SetOfTheSameType = 2,
    ObjectsOfTheSameType = 3,
    Library = 4,
}

// ─── ObjectFlag ───────────────────────────────────────────────────────
// Source: interface/object.ts — enum ObjectFlag

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ObjectFlag {
    DeleteEmpty = 0,
    SelectTemplate = 2,
}

// ─── ObjectOrigin ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum ObjectOrigin

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ObjectOrigin {
    None = 0,
    Clipboard = 1,
    DragAndDrop = 2,
    Import = 3,
    Webclipper = 4,
    SharingExtension = 5,
    Usecase = 6,
    Builtin = 7,
    Bookmark = 8,
    Api = 9,
}

// ─── ImageKind ─────────────────────────────────────────────────────────
// Source: interface/object.ts — enum ImageKind

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ImageKind {
    Basic = 0,
    Cover = 1,
    Icon = 2,
    AutomaticallyAdded = 3,
}

// ─── LayoutFormat ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum LayoutFormat

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LayoutFormat {
    Page = 0,
    List = 1,
}

// ─── FeaturedRelationLayout ───────────────────────────────────────────
// Source: interface/object.ts — enum FeaturedRelationLayout

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FeaturedRelationLayout {
    Inline = 0,
    Column = 1,
}

// ─── ObjectRow ────────────────────────────────────────────────────────
// Database row for the `objects` table.
// Source: interface/object.ts — fields derived from Object properties

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ObjectRow {
    pub id: String,
    pub r#type: String,
    pub layout: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub cover: Option<String>,
    #[serde(default)]
    pub is_archived: bool,
    #[serde(default)]
    pub is_deleted: bool,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub space_id: Option<String>,
    #[serde(default)]
    pub details: String,
}

// ─── ObjectDetail ─────────────────────────────────────────────────────
// In-memory representation for API responses.
// Source: local_store's ObjectDetail pattern

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectDetail {
    pub id: String,
    pub details: serde_json::Value,
}

// ─── ObjectTree ────────────────────────────────────────────────────────
// Represents an object with its full block tree.
// Source: derived from BlockStructure pattern

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectTree {
    pub object: ObjectRow,
    pub blocks: Vec<super::block::Block>,
}

// ─── ObjectSummary ────────────────────────────────────────────────────
// Lightweight object summary for listings and search results.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSummary {
    pub id: String,
    pub name: Option<String>,
    pub r#type: String,
    pub layout: String,
    pub icon: Option<String>,
    pub updated_at: i64,
}

// ─── RelationRow ──────────────────────────────────────────────────────
// Database row for the `relations` table.

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RelationRow {
    pub id: String,
    pub object_id: String,
    pub key: String,
    pub value: String,
}

// ─── MarkRow ──────────────────────────────────────────────────────────
// Database row for the `marks` table.

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MarkRow {
    pub id: i64,
    pub block_id: String,
    pub r#type: i32,
    #[serde(default)]
    pub param: Option<String>,
    pub range_start: i32,
    pub range_end: i32,
}

// ─── ObjectChildrenRow ────────────────────────────────────────────────
// Database row for the `object_children` table.

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ObjectChildrenRow {
    pub object_id: String,
    pub block_id: String,
    pub child_id: String,
    pub position: i32,
}
