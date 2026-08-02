// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// store/mod.rs — port of pkg/lib/localstore/objectstore from Go
// Go source: pkg/lib/localstore/objectstore/objectstore.go

use std::path::Path;
use std::sync::Arc;
use parking_lot::RwLock;
use rusqlite::{Connection, params};
use anyhow::{Result, anyhow};
use serde_json;
use tracing::{debug, error};

use crate::domain::{Details, FullId, RelationKey, DetailValue, relation_key};

// ── Query ─────────────────────────────────────────────────────────────────
/// Mirrors Go: database.Query
#[derive(Debug, Default, Clone)]
pub struct Query {
    pub space_id:          Option<String>,
    pub filters:           Vec<Filter>,
    pub sorts:             Vec<Sort>,
    pub text_query:        Option<String>,
    pub prefix_name_query: bool,
    pub limit:             usize,
    pub offset:            usize,
    pub keys:              Vec<RelationKey>,
}

/// Mirrors Go: database.FilterRequest
#[derive(Debug, Clone)]
pub struct Filter {
    pub relation_key: RelationKey,
    pub condition:    FilterCondition,
    pub value:        FilterValue,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FilterCondition {
    Equal,
    NotEqual,
    Greater,
    Less,
    Like,
    In,
    NotIn,
    Empty,
    NotEmpty,
}

#[derive(Debug, Clone)]
pub enum FilterValue {
    Str(String),
    Bool(bool),
    Int(i64),
    StrList(Vec<String>),
    Null,
}

/// Mirrors Go: database.SortRequest
#[derive(Debug, Clone)]
pub struct Sort {
    pub relation_key: RelationKey,
    pub ascending:    bool,
}

// ── Record ────────────────────────────────────────────────────────────────
/// Mirrors Go: database.Record { Details *domain.Details, Meta SearchMeta }
#[derive(Debug, Clone)]
pub struct Record {
    pub details: Details,
}

// ── ObjectStore ───────────────────────────────────────────────────────────
/// Mirrors Go: objectstore.ObjectStore interface + SpaceIndex
/// Backed by SQLite (rusqlite). One DB per data directory.
pub struct ObjectStore {
    conn: Arc<RwLock<Connection>>,
}

impl ObjectStore {
    /// Open (or create) the SQLite store at `db_path`.
    /// Mirrors Go: objectstore.New() / Init()
    pub fn open(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)
            .map_err(|e| anyhow!("failed to open object store: {e}"))?;
        let store = Self { conn: Arc::new(RwLock::new(conn)) };
        store.init_schema()?;
        Ok(store)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.read();
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS objects (
                id          TEXT NOT NULL,
                space_id    TEXT NOT NULL,
                details     TEXT NOT NULL,  -- JSON blob of Details
                is_archived INTEGER NOT NULL DEFAULT 0,
                is_deleted  INTEGER NOT NULL DEFAULT 0,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL,
                PRIMARY KEY (space_id, id)
            );
            CREATE INDEX IF NOT EXISTS idx_objects_space ON objects(space_id);
            CREATE INDEX IF NOT EXISTS idx_objects_archived ON objects(space_id, is_archived);
        ")?;
        Ok(())
    }

    // ── CREATE ────────────────────────────────────────────────────────────
    /// Mirrors Go: objectstore.ObjectStore.UpdateObjectDetails (upsert on create)
    pub fn upsert(&self, space_id: &str, object_id: &str, details: &Details) -> Result<()> {
        let conn = self.conn.write();
        let json = serde_json::to_string(details)?;
        let now  = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT INTO objects (id, space_id, details, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(space_id, id) DO UPDATE SET
               details    = excluded.details,
               updated_at = excluded.updated_at",
            params![object_id, space_id, json, now],
        )?;
        debug!("upserted object {object_id} in space {space_id}");
        Ok(())
    }

    // ── READ ──────────────────────────────────────────────────────────────
    /// Mirrors Go: objectstore.SpaceIndex.Query()
    pub fn query(&self, q: &Query) -> Result<Vec<Record>> {
        let conn = self.conn.read();

        // Build WHERE clauses. Always filter by space + not deleted.
        let mut where_parts: Vec<String> = vec!["is_deleted = 0".into()];
        let mut bound: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if let Some(ref sid) = q.space_id {
            where_parts.push("space_id = ?".into());
            bound.push(Box::new(sid.clone()));
        }

        // Full-text: simple LIKE on JSON blob — real impl would use FTS5
        if let Some(ref txt) = q.text_query {
            if !txt.is_empty() {
                where_parts.push("details LIKE ?".into());
                bound.push(Box::new(format!("%{txt}%")));
            }
        }

        let where_sql = where_parts.join(" AND ");
        let order_sql = if q.sorts.is_empty() {
            "updated_at DESC".to_owned()
        } else {
            q.sorts.iter().map(|s| {
                let dir = if s.ascending { "ASC" } else { "DESC" };
                // We sort by JSON extract — good enough for non-perf path
                format!("json_extract(details, '$.0.{key}') {dir}", key = s.relation_key.as_str())
            }).collect::<Vec<_>>().join(", ")
        };

        let limit_sql = if q.limit > 0 {
            format!("LIMIT {} OFFSET {}", q.limit, q.offset)
        } else {
            String::new()
        };

        let sql = format!("SELECT details FROM objects WHERE {where_sql} ORDER BY {order_sql} {limit_sql}");

        let refs: Vec<&dyn rusqlite::ToSql> = bound.iter().map(|b| b.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(refs.as_slice(), |row| {
            let json: String = row.get(0)?;
            Ok(json)
        })?;

        let mut records = Vec::new();
        for row in rows {
            let json = row?;
            match serde_json::from_str::<Details>(&json) {
                Ok(details) => {
                    // Apply post-filter for in-memory filters (complex ones)
                    if self.apply_filters(&details, &q.filters) {
                        let details = if q.keys.is_empty() {
                            details
                        } else {
                            details.copy_only_keys(&q.keys)
                        };
                        records.push(Record { details });
                    }
                }
                Err(e) => error!("failed to deserialize details: {e}"),
            }
        }
        Ok(records)
    }

    /// Mirrors Go: database.FiltersFromProto — apply filters in-memory
    fn apply_filters(&self, details: &Details, filters: &[Filter]) -> bool {
        for f in filters {
            let val = details.get(&f.relation_key);
            let pass = match (&f.condition, &f.value, val) {
                (FilterCondition::Equal, FilterValue::Str(s), Some(DetailValue::String(v))) => v == s,
                (FilterCondition::Equal, FilterValue::Bool(b), Some(DetailValue::Bool(v))) => v == b,
                (FilterCondition::NotEqual, FilterValue::Str(s), Some(DetailValue::String(v))) => v != s,
                (FilterCondition::Empty,    _, None) => true,
                (FilterCondition::NotEmpty, _, Some(_)) => true,
                (FilterCondition::Like, FilterValue::Str(s), Some(DetailValue::String(v))) => {
                    v.to_lowercase().contains(&s.to_lowercase())
                }
                (FilterCondition::In, FilterValue::StrList(list), Some(DetailValue::String(v))) => {
                    list.contains(v)
                }
                _ => false,
            };
            if !pass { return false; }
        }
        true
    }

    // ── READ single ───────────────────────────────────────────────────────
    /// Mirrors Go: objectstore.SpaceIndex.GetById
    pub fn get_by_id(&self, space_id: &str, object_id: &str) -> Result<Option<Details>> {
        let conn = self.conn.read();
        let mut stmt = conn.prepare(
            "SELECT details FROM objects WHERE space_id = ?1 AND id = ?2 AND is_deleted = 0"
        )?;
        let mut rows = stmt.query_map(params![space_id, object_id], |row| {
            row.get::<_, String>(0)
        })?;
        if let Some(row) = rows.next() {
            let json = row?;
            let details = serde_json::from_str::<Details>(&json)?;
            Ok(Some(details))
        } else {
            Ok(None)
        }
    }

    // ── UPDATE ────────────────────────────────────────────────────────────
    /// Mirrors Go: objectstore.ObjectStore.ModifyDetails
    pub fn modify_details<F>(&self, space_id: &str, object_id: &str, f: F) -> Result<Details>
    where
        F: FnOnce(Details) -> Result<Details>,
    {
        let current = self.get_by_id(space_id, object_id)?
            .unwrap_or_default();
        let updated = f(current)?;
        self.upsert(space_id, object_id, &updated)?;
        Ok(updated)
    }

    // ── ARCHIVE / FAVORITE ────────────────────────────────────────────────
    /// Mirrors Go: detailservice.SetIsArchived
    pub fn set_archived(&self, space_id: &str, object_id: &str, archived: bool) -> Result<()> {
        let conn = self.conn.write();
        let now  = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE objects SET is_archived = ?1, updated_at = ?2
             WHERE space_id = ?3 AND id = ?4",
            params![archived as i32, now, space_id, object_id],
        )?;
        // Also write into details JSON
        drop(conn);
        self.modify_details(space_id, object_id, |mut d| {
            d.set_bool(relation_key::is_archived(), archived);
            Ok(d)
        })?;
        Ok(())
    }

    /// Mirrors Go: detailservice.SetIsFavorite
    pub fn set_favorite(&self, space_id: &str, object_id: &str, favorite: bool) -> Result<()> {
        self.modify_details(space_id, object_id, |mut d| {
            d.set_bool(relation_key::is_favorite(), favorite);
            Ok(d)
        })?;
        Ok(())
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    /// Mirrors Go: block.Service.DeleteArchivedObjects — hard-delete list
    pub fn delete_objects(&self, space_id: &str, object_ids: &[String]) -> Result<Vec<String>> {
        let conn = self.conn.write();
        let now  = chrono::Utc::now().timestamp();
        let mut deleted = Vec::new();
        for id in object_ids {
            let n = conn.execute(
                "UPDATE objects SET is_deleted = 1, updated_at = ?1
                 WHERE space_id = ?2 AND id = ?3 AND is_archived = 1",
                params![now, space_id, id],
            )?;
            if n > 0 { deleted.push(id.clone()); }
        }
        Ok(deleted)
    }

    /// Mirrors Go: objectstore.SpaceIndex — list all for a space (not archived/deleted)
    pub fn list_space(&self, space_id: &str) -> Result<Vec<Record>> {
        self.query(&Query {
            space_id: Some(space_id.to_owned()),
            ..Default::default()
        })
    }
}
