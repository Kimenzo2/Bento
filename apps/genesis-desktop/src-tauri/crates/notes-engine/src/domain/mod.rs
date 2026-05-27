// domain/mod.rs — 1:1 port of core/domain types from Go
// Go source: core/domain/*.go

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ── FullID ────────────────────────────────────────────────────────────────
/// Mirrors Go: domain.FullID { SpaceID, ObjectID }
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FullId {
    pub space_id:  String,
    pub object_id: String,
}

impl FullId {
    pub fn new(space_id: impl Into<String>, object_id: impl Into<String>) -> Self {
        Self { space_id: space_id.into(), object_id: object_id.into() }
    }
}

// ── RelationKey ───────────────────────────────────────────────────────────
/// Mirrors Go: domain.RelationKey (typed string)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RelationKey(pub String);

impl RelationKey {
    pub fn new(k: impl Into<String>) -> Self { Self(k.into()) }
    pub fn as_str(&self) -> &str { &self.0 }
}

impl From<&str> for RelationKey {
    fn from(s: &str) -> Self { Self(s.to_owned()) }
}

// ── DetailValue ───────────────────────────────────────────────────────────
/// Mirrors Go: domain.Value  (wraps proto types.Value variants)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum DetailValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
    StringList(Vec<String>),
    Timestamp(DateTime<Utc>),
}

impl DetailValue {
    pub fn as_string(&self) -> Option<&str> {
        if let Self::String(s) = self { Some(s) } else { None }
    }
    pub fn as_bool(&self) -> Option<bool> {
        if let Self::Bool(b) = self { Some(*b) } else { None }
    }
    pub fn as_string_list(&self) -> Option<&[String]> {
        if let Self::StringList(v) = self { Some(v) } else { None }
    }
}

// ── Details ───────────────────────────────────────────────────────────────
/// Mirrors Go: domain.Details  (typed key→value map)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Details(pub HashMap<RelationKey, DetailValue>);

impl Details {
    pub fn new() -> Self { Self(HashMap::new()) }

    pub fn set(&mut self, key: RelationKey, value: DetailValue) {
        self.0.insert(key, value);
    }

    pub fn get(&self, key: &RelationKey) -> Option<&DetailValue> {
        self.0.get(key)
    }

    pub fn has(&self, key: &RelationKey) -> bool {
        self.0.contains_key(key)
    }

    pub fn get_string(&self, key: &RelationKey) -> Option<&str> {
        self.get(key).and_then(|v| v.as_string())
    }

    pub fn get_bool(&self, key: &RelationKey) -> Option<bool> {
        self.get(key).and_then(|v| v.as_bool())
    }

    pub fn get_string_list(&self, key: &RelationKey) -> Option<&[String]> {
        self.get(key).and_then(|v| v.as_string_list())
    }

    pub fn set_string(&mut self, key: RelationKey, val: impl Into<String>) {
        self.set(key, DetailValue::String(val.into()));
    }

    pub fn set_string_list(&mut self, key: RelationKey, val: Vec<String>) {
        self.set(key, DetailValue::StringList(val));
    }

    pub fn set_bool(&mut self, key: RelationKey, val: bool) {
        self.set(key, DetailValue::Bool(val));
    }

    /// Return a copy with only the requested keys (mirrors Go: Details.CopyOnlyKeys)
    pub fn copy_only_keys(&self, keys: &[RelationKey]) -> Self {
        let mut out = Self::new();
        for k in keys {
            if let Some(v) = self.get(k) {
                out.set(k.clone(), v.clone());
            }
        }
        out
    }

    pub fn merge(&mut self, other: &Details) {
        for (k, v) in &other.0 {
            self.0.insert(k.clone(), v.clone());
        }
    }
}

// ── Built-in relation keys ────────────────────────────────────────────────
/// Mirrors Go: pkg/lib/bundle relation key constants
pub mod relation_key {
    use super::RelationKey;
    pub fn id()            -> RelationKey { RelationKey::new("id") }
    pub fn space_id()      -> RelationKey { RelationKey::new("spaceId") }
    pub fn name()          -> RelationKey { RelationKey::new("name") }
    pub fn description()   -> RelationKey { RelationKey::new("description") }
    pub fn created_date()  -> RelationKey { RelationKey::new("createdDate") }
    pub fn last_modified() -> RelationKey { RelationKey::new("lastModifiedDate") }
    pub fn is_archived()   -> RelationKey { RelationKey::new("isArchived") }
    pub fn is_favorite()   -> RelationKey { RelationKey::new("isFavorite") }
    pub fn object_type()   -> RelationKey { RelationKey::new("type") }
    pub fn set_of()        -> RelationKey { RelationKey::new("setOf") }
    pub fn relation_key()  -> RelationKey { RelationKey::new("relationKey") }
    pub fn layout()        -> RelationKey { RelationKey::new("layout") }
    pub fn icon_emoji()    -> RelationKey { RelationKey::new("iconEmoji") }
    pub fn icon_image()    -> RelationKey { RelationKey::new("iconImage") }
}

// ── ObjectType ───────────────────────────────────────────────────────────
/// Mirrors Go: model.ObjectType layout enum values used in object creation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ObjectTypeKey {
    Note,
    Page,
    Task,
    Set,
    Collection,
    Bookmark,
    ObjectType,
    Relation,
    RelationOption,
    Template,
}

impl ObjectTypeKey {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Note          => "ot-note",
            Self::Page          => "ot-page",
            Self::Task          => "ot-task",
            Self::Set           => "ot-set",
            Self::Collection    => "ot-collection",
            Self::Bookmark      => "ot-bookmark",
            Self::ObjectType    => "ot-objectType",
            Self::Relation      => "ot-relation",
            Self::RelationOption=> "ot-relationOption",
            Self::Template      => "ot-template",
        }
    }
}

// ── Layout ────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum Layout {
    Basic       = 0,
    Profile     = 1,
    Todo        = 2,
    Set         = 3,
    ObjectType  = 4,
    Relation    = 5,
    File        = 6,
    Dashboard   = 7,
    Image       = 8,
    Note        = 9,
    Bookmark    = 10,
    Collection  = 11,
}

// ── InternalFlag ─────────────────────────────────────────────────────────
/// Mirrors Go: model.InternalFlag
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum InternalFlag {
    SuppressWorkspaceOpen = 0,
    EditorDeleteEmpty     = 1,
    EditorSelectType      = 2,
    EditorSelectTemplate  = 3,
}
