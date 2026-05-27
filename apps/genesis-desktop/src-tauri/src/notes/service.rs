// ════════════════════════════════════════════════════════════════════════
// NOTES SERVICE — 1:1 Rust port of anytype-heart/core/block CRUD in Go
// ════════════════════════════════════════════════════════════════════════
//
// CRUD operation source mapping:
//
//  CREATE
//  ──────
//  objectcreator.CreateObject(ctx, spaceID, req)  →  create_note_object()
//  block.CreateBlock(ctx, req)                    →  block_create()
//
//  READ
//  ────
//  cache.Do(s, id, func(b SmartBlock))            →  get_note_object()
//  store/block.getBlocks(rootId)                  →  get_note_blocks()
//  store/block.getLeaf(rootId, id)                →  get_block_by_id()
//
//  UPDATE (from editor.go)
//  ───────────────────────
//  SetTextText(ctx, req)                          →  set_text_content()
//  SetTextStyle(ctx, contextId, style, ids…)      →  set_text_style()
//  SetTextChecked(ctx, req)                       →  set_text_checked()
//  SetTextMark(ctx, contextId, mark, ids…)        →  set_text_mark()
//  SetTextColor(ctx, contextId, color, ids…)      →  set_text_color()
//  ClearTextStyle(ctx, contextId, ids…)           →  clear_text_style()
//  ClearTextContent(ctx, contextId, ids…)         →  clear_text_content()
//  SetBackgroundColor(ctx, contextId, color, ids…)→  set_background_color()
//  SetAlign(ctx, contextId, align, ids…)          →  set_align()
//  TurnInto(ctx, contextId, style, ids…)          →  turn_into()
//  ReplaceBlock(ctx, req)                         →  replace_block()
//  DuplicateBlocks(sctx, req)                     →  duplicate_blocks()
//  MoveBlocks(ctx, req)                           →  move_blocks()
//  SetLayout(ctx, contextId, layout)              →  set_layout()
//  ObjectDuplicate(ctx, id)                       →  object_duplicate()
//  Undo(ctx, req)                                 →  undo()
//  Redo(ctx, req)                                 →  redo()
//
//  SPLIT / MERGE (from editor.go)
//  ───────────────────────────────
//  SplitBlock(ctx, req)                           →  split_block()
//  MergeBlock(ctx, req)                           →  merge_block()
//  UnlinkBlock(ctx, req)                          →  unlink_block()
//
//  DELETE (from delete.go)
//  ────────────────────────
//  DeleteObject(objectId)                         →  delete_note_object()
//  BeforeDelete(id, workspaceRemove)              →  before_delete()
//
//  SEARCH / LIST
//  ─────────────
//  objectstore.QueryObjectIds(query)              →  list_note_objects()
//  objectstore.GetDetails(id)                     →  get_note_details()
// ════════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::local_store::block::{BlockRow, TextStyle};
use crate::local_store::operations::{
    BlockAddParams, BlockMergeParams, BlockMoveParams, BlockSplitParams, BlockUpdateParams,
    OpResult, OperationError, block_add, block_delete, block_merge, block_move, block_split,
    block_update, create_object, delete_object, get_block_by_id, get_blocks_by_object,
};
use crate::search::{SearchDocument, SearchService};

use super::undo::{BlockSnapshot, Change, HistoryRegistry};

fn text_style_value(style: &str) -> Value {
    let style = style.trim();
    if let Ok(value) = style.parse::<i64>() {
        return json!(value);
    }

    let value = match style {
        "Header1" | "header1" | "h1" => TextStyle::Header1 as i64,
        "Header2" | "header2" | "h2" => TextStyle::Header2 as i64,
        "Header3" | "header3" | "h3" => TextStyle::Header3 as i64,
        "Header4" | "header4" | "h4" => TextStyle::Header4 as i64,
        "Quote" | "quote" => TextStyle::Quote as i64,
        "Code" | "code" => TextStyle::Code as i64,
        "Title" | "title" => TextStyle::Title as i64,
        "Checkbox" | "checkbox" | "todo" => TextStyle::Checkbox as i64,
        "Bulleted" | "bulleted" | "bullet" => TextStyle::Bulleted as i64,
        "Numbered" | "numbered" => TextStyle::Numbered as i64,
        "Toggle" | "toggle" => TextStyle::Toggle as i64,
        "Description" | "description" => TextStyle::Description as i64,
        "Callout" | "callout" => TextStyle::Callout as i64,
        "ToggleHeader1" | "toggleHeader1" => TextStyle::ToggleHeader1 as i64,
        "ToggleHeader2" | "toggleHeader2" => TextStyle::ToggleHeader2 as i64,
        "ToggleHeader3" | "toggleHeader3" => TextStyle::ToggleHeader3 as i64,
        _ => TextStyle::Paragraph as i64,
    };
    json!(value)
}

fn is_title_style(content: &Value) -> bool {
    match &content["style"] {
        Value::Number(value) => value.as_i64() == Some(TextStyle::Title as i64),
        Value::String(value) => value == "Title" || value == "title" || value == "7",
        _ => false,
    }
}

fn is_code_style(style: &str) -> bool {
    style.trim().eq_ignore_ascii_case("code")
        || style.trim() == (TextStyle::Code as i32).to_string()
}

fn is_checkbox_style(style: &str) -> bool {
    style.trim().eq_ignore_ascii_case("checkbox")
        || style.trim() == (TextStyle::Checkbox as i32).to_string()
}

// ─── Tree-copy helpers ────────────────────────────────────────────────────────

/// Go source: state.go — State.SelectRoots(ids []string) []string
///
/// Returns the subset of `ids` that are true roots — i.e. no other ID in the
/// set is an ancestor of them.  This prevents double-copying when both a parent
/// and one of its descendants appear in the requested list.
fn select_roots(all_blocks: &[BlockRow], ids: &[String]) -> Vec<String> {
    let id_set: HashSet<&str> = ids.iter().map(String::as_str).collect();

    // Build a quick parent-lookup: block_id → parent_id
    let parent_of: HashMap<&str, &str> = all_blocks
        .iter()
        .filter_map(|b| b.parent_id.as_deref().map(|p| (b.id.as_str(), p)))
        .collect();

    ids.iter()
        .filter(|id| {
            // Walk up the ancestor chain; if we hit another requested ID, this
            // block is NOT a root (its ancestor is already in the list).
            let mut cursor: &str = id.as_str();
            loop {
                match parent_of.get(cursor) {
                    None => break true,                            // reached top-level → is a root
                    Some(&p) if id_set.contains(p) => break false, // ancestor in set
                    Some(&p) => cursor = p,
                }
            }
        })
        .cloned()
        .collect()
}

/// Deep-copy a slice of block rows into `dest_object_id`, remapping every ID.
///
/// Go source: basic.go — copyBlocks(srcState, destState, sourceId string)
///
/// Algorithm (mirrors Go's recursive copyBlocks):
///   Pass 1 — pre-pass: assign a new UUID to every block in `blocks`.
///             Build old→new map.
///   Pass 2 — INSERT: for each block write new_id, dest_object_id, and the
///             *remapped* parent_id (old parent → new parent via the map).
///             If a parent is not in the map the block is treated as root-level
///             and its position is taken from `root_position` (roots only).
///
/// `root_position` is the desired DB `position` value for root-level blocks.
/// If None, the source block's position is kept as-is (used by object_duplicate
/// where positions are already correct relative to the new note).
async fn copy_block_tree_into(
    db: &SqlitePool,
    blocks: &[&BlockRow],
    dest_object_id: &str,
    root_position: Option<i32>,
) -> OpResult<Vec<BlockRow>> {
    if blocks.is_empty() {
        return Ok(vec![]);
    }

    let now = crate::util::time::now_ms();

    // Pass 1: build old→new UUID map for every block in the slice
    // Go: m.Id = ""  then result = simple.New(m)  which auto-assigns a UUID
    let id_map: HashMap<String, String> = blocks
        .iter()
        .map(|b| (b.id.clone(), Uuid::new_v4().to_string()))
        .collect();

    // Collect the IDs that are in this copy set (for parent remapping)
    let src_ids: HashSet<&str> = blocks.iter().map(|b| b.id.as_str()).collect();

    // Pass 2: INSERT each block with remapped IDs
    let mut inserted_ids: Vec<String> = Vec::with_capacity(blocks.len());

    for src in blocks {
        let new_id = id_map.get(&src.id).unwrap(); // always present
        let new_parent = src.parent_id.as_deref().and_then(|p| {
            if src_ids.contains(p) {
                id_map.get(p).map(String::as_str)
            } else {
                None
            }
        });

        // Root-level blocks get the caller-supplied position; children keep their
        // relative position within their (newly remapped) parent.
        // Go: InsertTo places each root after the previous one at Block_Bottom.
        let pos = if new_parent.is_none() {
            root_position.unwrap_or(src.position)
        } else {
            src.position
        };

        sqlx::query(
            "INSERT INTO blocks \
             (id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at) \
             VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        )
        .bind(new_id)
        .bind(dest_object_id)
        .bind(new_parent)
        .bind(&src.r#type)
        .bind(&src.content)
        .bind(&src.fields)
        .bind(src.align)
        .bind(&src.bg_color)
        .bind(pos)
        .bind(now)
        .bind(now)
        .execute(db)
        .await
        .map_err(OperationError::db_error)?;

        inserted_ids.push(new_id.clone());
    }

    // Fetch the freshly inserted rows in one query (preserves DB-generated timestamps)
    let mut result = Vec::with_capacity(inserted_ids.len());
    for id in &inserted_ids {
        if let Ok(Some(row)) = get_block_by_id(db, id).await {
            result.push(row);
        }
    }
    Ok(result)
}

// ─── Note-specific types ──────────────────────────────────────────────────────

/// Full note object with its block tree.
/// Go source: SmartBlock + store/block.getBlocks() combined response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteObject {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub cover: Option<String>,
    pub layout: String,
    pub pinned: bool,
    pub tags: Vec<String>,
    pub is_archived: bool,
    pub details: Value,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Note listing item (lightweight — no blocks).
/// Go source: objectstore.SpaceIndex.GetDetails() → ObjectSummary pattern.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub preview: String, // first 120 chars of body text
    pub tags: Vec<String>,
    pub pinned: bool,
    pub is_archived: bool,
    pub updated_at: i64,
    pub created_at: i64,
    pub block_count: i64,
}

/// Note with full block tree, returned by get_note_full().
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWithBlocks {
    pub note: NoteObject,
    pub blocks: Vec<BlockRow>,
}

/// Params for creating a new note.
/// Go source: objectcreator.CreateObjectRequest { Details, ObjectTypeKey: TypeKeyNote }
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteParams {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub pinned: bool,
}

/// Params for updating note metadata (not blocks).
/// Go source: block/details.go — SetDetails (top-level object fields)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateNoteParams {
    pub id: String,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub cover: Option<String>,
    pub tags: Option<Vec<String>>,
    pub pinned: Option<bool>,
    pub is_archived: Option<bool>,
    pub details: Option<Value>,
}

impl Default for UpdateNoteParams {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: None,
            icon: None,
            cover: None,
            tags: None,
            pinned: None,
            is_archived: None,
            details: None,
        }
    }
}

/// Result of Undo/Redo.
/// Go source: basic.HistoryInfo { PreviousText, NextText, Group }
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryInfo {
    pub can_undo: bool,
    pub can_redo: bool,
    pub restored_blocks: Vec<BlockRow>,
}

/// SetTextMark request params.
/// Go source: editor.go — SetTextMark(ctx, contextId, mark *model.BlockContentTextMark, blockIds…)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetMarkParams {
    pub note_id: String,
    pub block_ids: Vec<String>,
    pub mark_type: i32,
    pub param: Option<String>,
    pub range_from: i32,
    pub range_to: i32,
}

/// Block-create request params.
/// Go source: pb.RpcBlockCreateRequest { ContextId, TargetId, Block, Position }
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockCreateParams {
    pub note_id: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub target_id: Option<String>, // insert after this block
    pub block_type: String, // "text", "file", "bookmark", etc.
    pub content: Value,     // block content JSON
    #[serde(default)]
    pub position: i32,
    #[serde(default)]
    pub align: i32,
    #[serde(default)]
    pub bg_color: Option<String>,
}

/// DuplicateBlocks request params.
/// Go source: pb.RpcBlockListDuplicateRequest { ContextId, TargetId, BlockIds, Position }
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateBlocksParams {
    pub note_id: String,
    pub block_ids: Vec<String>,
    #[serde(default)]
    pub target_id: Option<String>, // insert after this block
}

/// MoveBlocks request params.
/// Go source: pb.RpcBlockListMoveToExistingObjectRequest
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveBlocksParams {
    pub note_id: String,
    pub block_ids: Vec<String>,
    #[serde(default)]
    pub target_parent_id: Option<String>,
    pub position: i32,
}

// ─── Helper: snapshot blocks before mutation (for undo) ──────────────────────

async fn snapshot_blocks(db: &SqlitePool, block_ids: &[String]) -> Vec<BlockSnapshot> {
    let mut snaps = Vec::with_capacity(block_ids.len());
    for id in block_ids {
        if let Ok(Some(row)) = get_block_by_id(db, id).await {
            snaps.push(BlockSnapshot {
                id: row.id,
                object_id: row.object_id,
                parent_id: row.parent_id,
                r#type: row.r#type,
                content: row.content,
                fields: row.fields,
                align: row.align,
                bg_color: row.bg_color,
                position: row.position,
                existed: true,
            });
        }
    }
    snaps
}

/// Restore a set of block snapshots to the database.
/// Used by Undo (restore `before`) and Redo (restore `after`).
async fn restore_snapshots(db: &SqlitePool, snaps: &[BlockSnapshot]) -> OpResult<Vec<BlockRow>> {
    let mut rows = Vec::with_capacity(snaps.len());
    for snap in snaps {
        if !snap.existed {
            // Block was created during the change — delete it for undo
            let _ = block_delete(db, &snap.id, &snap.object_id).await;
        } else {
            // Restore the previous state
            sqlx::query(
                "INSERT OR REPLACE INTO blocks (id,object_id,parent_id,type,content,fields,align,bg_color,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            )
            .bind(&snap.id)
            .bind(&snap.object_id)
            .bind(&snap.parent_id)
            .bind(&snap.r#type)
            .bind(&snap.content)
            .bind(&snap.fields)
            .bind(snap.align)
            .bind(&snap.bg_color)
            .bind(snap.position)
            .bind(crate::util::time::now_ms())
            .bind(crate::util::time::now_ms())
            .execute(db)
            .await
            .map_err(OperationError::db_error)?;

            if let Ok(Some(row)) = get_block_by_id(db, &snap.id).await {
                rows.push(row);
            }
        }
    }
    Ok(rows)
}

// ─── Note object CRUD ─────────────────────────────────────────────────────────

/// Create a new note object.
/// Go source: objectcreator.service.createCommonObject() for TypeKeyNote.
/// Also creates the mandatory title block (layout header block, TextStyle::Title).
pub async fn create_note_object(
    db: &SqlitePool,
    history: &HistoryRegistry,
    search: &SearchService,
    params: CreateNoteParams,
) -> OpResult<NoteWithBlocks> {
    let note_id = Uuid::new_v4().to_string();
    let now = crate::util::time::now_ms();
    let title = params.title.trim().to_string();
    let tags_json = serde_json::to_string(&params.tags).unwrap_or_else(|_| "[]".to_string());

    let details = json!({
        "layout": "note",
        "pinned": params.pinned,
        "tags": params.tags,
    });
    let details_str = serde_json::to_string(&details).unwrap_or_else(|_| "{}".to_string());

    // Insert into note_objects table (or fall back to legacy `notes` table)
    sqlx::query(
        r#"
        INSERT INTO note_objects
            (id, title, icon, tags, pinned, layout, is_archived, details, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'note', 0, ?, ?, ?)
        "#,
    )
    .bind(&note_id)
    .bind(&title)
    .bind(params.icon.as_deref())
    .bind(&tags_json)
    .bind(params.pinned)
    .bind(&details_str)
    .bind(now)
    .bind(now)
    .execute(db)
    .await
    .map_err(OperationError::db_error)?;

    // Also create entry in the generic objects table for the local_store layer.
    // Go source: objectcreator.CreateSmartBlockFromState → spc.CreateTreeObject
    create_object(db, &note_id, "note").await?;

    // Create the title block.
    // Go source: state.NewDoc().Add(simple.New(&model.Block{ Content: &model.BlockContentOfText{
    //   Text: &model.BlockContentText{Style: model.BlockContentText_Title}}}))
    let title_content = json!({
        "text": title,
        "style": TextStyle::Title as i32,
        "marks": [],
        "checked": false,
        "color": "",
        "iconEmoji": "",
        "iconImage": ""
    });
    let title_block = block_add(
        db,
        BlockAddParams {
            object_id: note_id.clone(),
            parent_id: None,
            r#type: "text".to_string(),
            content: title_content,
            position: 0,
            fields: None,
            align: Some(0),
            bg_color: None,
        },
    )
    .await?;

    // Create the first empty paragraph block (where the user types).
    // Go source: state.NewDoc() always has a root layout + one paragraph child
    let body_content = json!({
        "text": "",
        "style": TextStyle::Paragraph as i32,
        "marks": [],
        "checked": false,
        "color": "",
        "iconEmoji": "",
        "iconImage": ""
    });
    let body_block = block_add(
        db,
        BlockAddParams {
            object_id: note_id.clone(),
            parent_id: None,
            r#type: "text".to_string(),
            content: body_content,
            position: 1,
            fields: None,
            align: Some(0),
            bg_color: None,
        },
    )
    .await?;

    // Record in undo history (creation itself is undoable)
    history.push(
        &note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.clone(),
            description: format!("Create note: {title}"),
            before: vec![], // nothing existed before
            after: vec![
                BlockSnapshot {
                    id: title_block.block.id.clone(),
                    object_id: note_id.clone(),
                    parent_id: None,
                    r#type: "text".into(),
                    content: title_block.block.content.clone(),
                    fields: "{}".into(),
                    align: 0,
                    bg_color: "".into(),
                    position: 0,
                    existed: false,
                },
                BlockSnapshot {
                    id: body_block.block.id.clone(),
                    object_id: note_id.clone(),
                    parent_id: None,
                    r#type: "text".into(),
                    content: body_block.block.content.clone(),
                    fields: "{}".into(),
                    align: 0,
                    bg_color: "".into(),
                    position: 1,
                    existed: false,
                },
            ],
            created_at: now,
        },
    );

    // Index in search
    let _ = search
        .index_content(SearchDocument {
            module_id: "notes".to_string(),
            id: note_id.clone(),
            title: title.clone(),
            body: title.clone(),
            tags: params.tags.clone(),
            projects: vec![],
            kind: Some("note".to_string()),
            created_at: Some(now),
            updated_at: Some(now),
            source_ref: None,
            extra: json!({ "pinned": params.pinned }),
        })
        .await;

    let note = NoteObject {
        id: note_id,
        title,
        icon: params.icon,
        cover: None,
        layout: "note".to_string(),
        pinned: params.pinned,
        tags: params.tags,
        is_archived: false,
        details,
        created_at: now,
        updated_at: now,
    };
    let blocks = vec![title_block.block, body_block.block];

    Ok(NoteWithBlocks { note, blocks })
}

/// Get a note object by ID (without blocks).
/// Go source: cache.Do(s, id, func(b SmartBlock) { ... b.NewState().Details() })
pub async fn get_note_object(db: &SqlitePool, note_id: &str) -> OpResult<NoteObject> {
    let row = sqlx::query(
        "SELECT id, title, icon, cover, tags, pinned, layout, is_archived, details, created_at, updated_at FROM note_objects WHERE id = ?",
    )
    .bind(note_id)
    .fetch_optional(db)
    .await
    .map_err(OperationError::db_error)?
    .ok_or_else(|| OperationError::not_found("NoteObject", note_id))?;

    use sqlx::Row;
    let tags_str: String = row.try_get("tags").unwrap_or_else(|_| "[]".to_string());
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    let details_str: String = row.try_get("details").unwrap_or_else(|_| "{}".to_string());
    let details: Value = serde_json::from_str(&details_str).unwrap_or(json!({}));

    Ok(NoteObject {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        icon: row.try_get("icon").ok().flatten(),
        cover: row.try_get("cover").ok().flatten(),
        layout: row.try_get("layout").unwrap_or_else(|_| "note".to_string()),
        pinned: row.try_get::<bool, _>("pinned").unwrap_or(false),
        tags,
        is_archived: row.try_get::<bool, _>("is_archived").unwrap_or(false),
        details,
        created_at: row.try_get("created_at").unwrap_or(0),
        updated_at: row.try_get("updated_at").unwrap_or(0),
    })
}

/// Get a note with its full block tree.
/// Go source: cache.Do(s, id, …) + store/block.getBlocks(rootId)
pub async fn get_note_full(db: &SqlitePool, note_id: &str) -> OpResult<NoteWithBlocks> {
    let note = get_note_object(db, note_id).await?;
    let blocks = get_blocks_by_object(db, note_id).await?;
    Ok(NoteWithBlocks { note, blocks })
}

/// List note summaries (no blocks).
/// Go source: objectstore.SpaceIndex.QueryObjectIds + GetDetails.
pub async fn list_note_objects(
    db: &SqlitePool,
    include_archived: bool,
    limit: i64,
    offset: i64,
) -> OpResult<Vec<NoteSummary>> {
    use sqlx::Row;
    let archived_filter = if include_archived {
        "1=1"
    } else {
        "is_archived = 0"
    };
    let sql = format!(
        r#"
        SELECT
            n.id, n.title, n.icon, n.tags, n.pinned, n.is_archived,
            n.updated_at, n.created_at,
            COUNT(b.id) AS block_count
        FROM note_objects n
        LEFT JOIN blocks b ON b.object_id = n.id
        WHERE {archived_filter}
        GROUP BY n.id
        ORDER BY n.pinned DESC, n.updated_at DESC
        LIMIT ? OFFSET ?
        "#
    );

    let rows = sqlx::query(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(db)
        .await
        .map_err(OperationError::db_error)?;

    let mut summaries = Vec::with_capacity(rows.len());
    for row in rows {
        let tags_str: String = row.try_get("tags").unwrap_or_else(|_| "[]".to_string());
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();

        summaries.push(NoteSummary {
            id: row.try_get("id").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            icon: row.try_get("icon").ok().flatten(),
            preview: String::new(), // populated below from first body block
            tags,
            pinned: row.try_get::<bool, _>("pinned").unwrap_or(false),
            is_archived: row.try_get::<bool, _>("is_archived").unwrap_or(false),
            updated_at: row.try_get("updated_at").unwrap_or(0),
            created_at: row.try_get("created_at").unwrap_or(0),
            block_count: row.try_get::<i64, _>("block_count").unwrap_or(0),
        });
    }

    // Populate preview from the first non-title text block for each note
    for summary in &mut summaries {
        if let Ok(blocks) = get_blocks_by_object(db, &summary.id).await {
            for block in &blocks {
                if block.r#type == "text" {
                    if let Ok(c) = serde_json::from_str::<Value>(&block.content) {
                        if !is_title_style(&c) {
                            let text = c["text"].as_str().unwrap_or("").trim();
                            if !text.is_empty() {
                                summary.preview = text.chars().take(120).collect();
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(summaries)
}

/// Update note metadata.
/// Go source: block/details.go — SetDetails(ctx, objectId, details, true)
pub async fn update_note_object(
    db: &SqlitePool,
    search: &SearchService,
    params: UpdateNoteParams,
) -> OpResult<NoteObject> {
    let now = crate::util::time::now_ms();

    // Build SET clause dynamically
    let mut set_parts: Vec<String> = vec!["updated_at = ?".to_string()];
    let mut sql_params: Vec<String> = vec![now.to_string()];

    if let Some(ref title) = params.title {
        set_parts.push("title = ?".to_string());
        sql_params.push(title.clone());
    }
    if let Some(ref icon) = params.icon {
        set_parts.push("icon = ?".to_string());
        sql_params.push(icon.clone());
    }
    if let Some(ref cover) = params.cover {
        set_parts.push("cover = ?".to_string());
        sql_params.push(cover.clone());
    }
    if let Some(ref tags) = params.tags {
        set_parts.push("tags = ?".to_string());
        sql_params.push(serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string()));
    }
    if let Some(pinned) = params.pinned {
        set_parts.push("pinned = ?".to_string());
        sql_params.push(if pinned {
            "1".to_string()
        } else {
            "0".to_string()
        });
    }
    if let Some(archived) = params.is_archived {
        set_parts.push("is_archived = ?".to_string());
        sql_params.push(if archived {
            "1".to_string()
        } else {
            "0".to_string()
        });
    }

    let sql = format!(
        "UPDATE note_objects SET {} WHERE id = ?",
        set_parts.join(", ")
    );

    let mut query = sqlx::query(&sql);
    for p in &sql_params {
        query = query.bind(p);
    }
    query = query.bind(&params.id);
    query.execute(db).await.map_err(OperationError::db_error)?;

    let updated = get_note_object(db, &params.id).await?;

    // Update search index
    let _ = search
        .index_content(SearchDocument {
            module_id: "notes".to_string(),
            id: updated.id.clone(),
            title: updated.title.clone(),
            body: updated.title.clone(),
            tags: updated.tags.clone(),
            projects: vec![],
            kind: Some("note".to_string()),
            created_at: Some(updated.created_at),
            updated_at: Some(updated.updated_at),
            source_ref: None,
            extra: json!({ "pinned": updated.pinned }),
        })
        .await;

    Ok(updated)
}

/// Delete a note object and all its blocks.
/// Go source: block/delete.go — DeleteObject(objectId) → DeleteObjectByFullID → spc.DeleteTree
///            Also calls: BeforeDelete(id, nil) → b.SetIsDeleted(), objectStore.DeleteObject
pub async fn delete_note_object(
    db: &SqlitePool,
    history: &HistoryRegistry,
    search: &SearchService,
    note_id: &str,
) -> OpResult<()> {
    // before_delete: close sessions, archive favorites (no-op locally),
    // then mark deleted in the object store.
    // Go source: delete.go BeforeDelete()
    let _ = before_delete(db, note_id).await;

    // Hard delete all blocks first (matches Go: DeleteTree → removes tree from storage)
    sqlx::query("DELETE FROM blocks WHERE object_id = ?")
        .bind(note_id)
        .execute(db)
        .await
        .map_err(OperationError::db_error)?;

    // Hard delete the note object
    sqlx::query("DELETE FROM note_objects WHERE id = ?")
        .bind(note_id)
        .execute(db)
        .await
        .map_err(OperationError::db_error)?;

    // Remove from generic objects table
    delete_object(db, note_id).await?;

    // Clear undo history (Go: s.sendOnRemoveEvent → removes from cache)
    history.clear(note_id);

    // Remove from search
    let _ = search
        .delete_from_index("notes".to_string(), note_id.to_string())
        .await;

    Ok(())
}

/// Pre-delete cleanup.
/// Go source: block/delete.go — BeforeDelete(id FullID, workspaceRemove func() error)
/// Marks object as deleted in local object store. Clears is_favorite if needed.
pub async fn before_delete(db: &SqlitePool, note_id: &str) -> OpResult<()> {
    // Mark as deleted in the objects table (Go: objectStore.SpaceIndex.DeleteObject)
    delete_object(db, note_id).await?;
    Ok(())
}

/// Duplicate an entire note object with its full block tree.
///
/// Go source: block/create.go — ObjectDuplicate(ctx, id)
///   st = b.NewState().Copy()                        ← every block gets a new UUID
///   st.SetDetail(RelationKeySourceObject, sourceId) ← provenance detail
///   CreateSmartBlockFromState(…)                    ← writes new object + tree
///
/// The previous implementation was flat: it used position-index skipping and
/// copied raw `parent_id` values from the source, so any nested structure was
/// broken (children still pointed at source IDs that don't exist in the copy).
///
/// This version delegates to `copy_block_tree_into` which mirrors Go's
/// recursive `copyBlocks`:
///   1. Pre-pass: build old→new UUID map for every block to be copied.
///   2. INSERT pass: write each block with the new ID and remapped parent_id.
///   3. The title/body stubs that `create_note_object` already wrote are kept;
///      all subsequent blocks (position > 1 or any nested child) are deep-copied.
pub async fn object_duplicate(
    db: &SqlitePool,
    history: &HistoryRegistry,
    search: &SearchService,
    source_id: &str,
) -> OpResult<NoteWithBlocks> {
    let source = get_note_object(db, source_id).await?;
    let source_blocks = get_blocks_by_object(db, source_id).await?;

    // Create the shell note. This writes title (pos 0) + empty body (pos 1).
    let new_note = create_note_object(
        db,
        history,
        search,
        CreateNoteParams {
            title: format!("{} (copy)", source.title),
            icon: source.icon.clone(),
            tags: source.tags.clone(),
            pinned: false,
        },
    )
    .await?;
    let new_id = new_note.note.id.clone();

    // Select every block that is NOT one of the two auto-created stubs.
    // A block qualifies if it has a parent (it is nested) OR sits beyond pos 1.
    // Go: copyBlocks recurses the full ChildrenIds tree from each root.
    let non_stub: Vec<&BlockRow> = source_blocks
        .iter()
        .filter(|b| b.position > 1 || b.parent_id.is_some())
        .collect();

    let copied = copy_block_tree_into(db, &non_stub, &new_id, None).await?;

    // Record undo snapshot — all copied blocks are brand-new (no "before")
    let now = crate::util::time::now_ms();
    let after_snaps: Vec<BlockSnapshot> = copied
        .iter()
        .map(|row| BlockSnapshot {
            id: row.id.clone(),
            object_id: new_id.clone(),
            parent_id: row.parent_id.clone(),
            r#type: row.r#type.clone(),
            content: row.content.clone(),
            fields: row.fields.clone(),
            align: row.align,
            bg_color: row.bg_color.clone(),
            position: row.position,
            existed: false,
        })
        .collect();

    history.push(
        &new_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: new_id.clone(),
            description: format!("Duplicate note: {}", source.title),
            before: vec![],
            after: after_snaps,
            created_at: now,
        },
    );

    let mut all_blocks = new_note.blocks.clone();
    all_blocks.extend(copied);
    Ok(NoteWithBlocks {
        note: new_note.note,
        blocks: all_blocks,
    })
}

// ─── Block CRUD ───────────────────────────────────────────────────────────────

/// Create a new block inside a note at the given position.
/// Go source: editor.go — CreateBlock(ctx, req pb.RpcBlockCreateRequest) (id string, err error)
///   → cache.DoStateCtx(s, ctx, req.ContextId, func(st *state.State, b basic.Creatable) {
///       id, err = b.CreateBlock(st, req) })
pub async fn block_create(
    db: &SqlitePool,
    history: &HistoryRegistry,
    params: BlockCreateParams,
) -> OpResult<BlockRow> {
    let position = if let Some(target_id) = &params.target_id {
        if let Ok(Some(target)) = get_block_by_id(db, target_id).await {
            // Insert after target — shift siblings
            let now = crate::util::time::now_ms();
            sqlx::query(
                "UPDATE blocks SET position = position + 1, updated_at = ? WHERE object_id = ? AND position > ?"
            )
            .bind(now)
            .bind(&params.note_id)
            .bind(target.position)
            .execute(db)
            .await
            .map_err(OperationError::db_error)?;
            target.position + 1
        } else {
            params.position
        }
    } else {
        params.position
    };

    let result = block_add(
        db,
        BlockAddParams {
            object_id: params.note_id.clone(),
            parent_id: params.parent_id.clone(),
            r#type: params.block_type.clone(),
            content: params.content,
            position,
            fields: None,
            align: Some(params.align),
            bg_color: params.bg_color,
        },
    )
    .await?;

    let snap = BlockSnapshot {
        id: result.block.id.clone(),
        object_id: params.note_id.clone(),
        parent_id: params.parent_id,
        r#type: params.block_type,
        content: result.block.content.clone(),
        fields: "{}".into(),
        align: params.align,
        bg_color: result.block.bg_color.clone(),
        position,
        existed: false,
    };
    history.push(
        &params.note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: params.note_id.clone(),
            description: "Create block".into(),
            before: vec![],
            after: vec![snap],
            created_at: result.block.created_at,
        },
    );

    Ok(result.block)
}

/// Unlink (delete) one or more blocks from a note.
/// Go source: editor.go — UnlinkBlock(ctx, req pb.RpcBlockListDeleteRequest)
///   → cache.Do(s, req.ContextId, func(b basic.Unlinkable) { b.Unlink(ctx, req.BlockIds…) })
pub async fn unlink_block(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
) -> OpResult<()> {
    let before = snapshot_blocks(db, block_ids).await;

    for id in block_ids {
        block_delete(db, id, note_id).await?;
    }

    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Delete {} block(s)", block_ids.len()),
            before,
            after: vec![],
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(())
}

/// Split a text block at a given text offset.
/// Go source: editor.go — SplitBlock(ctx, req pb.RpcBlockSplitRequest)
///   → cache.Do(s, req.ContextId, func(b stext.Text) { b.Split(ctx, req) })
pub async fn split_block(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_id: &str,
    split_at: i32,
) -> OpResult<(BlockRow, BlockRow)> {
    let before = snapshot_blocks(db, &[block_id.to_string()]).await;

    let result = block_split(
        db,
        BlockSplitParams {
            block_id: block_id.to_string(),
            object_id: note_id.to_string(),
            split_range: (split_at, split_at),
        },
    )
    .await?;

    let after_orig = BlockSnapshot {
        id: result.original_block.id.clone(),
        object_id: note_id.to_string(),
        parent_id: result.original_block.parent_id.clone(),
        r#type: "text".into(),
        content: result.original_block.content.clone(),
        fields: "{}".into(),
        align: result.original_block.align,
        bg_color: result.original_block.bg_color.clone(),
        position: result.original_block.position,
        existed: true,
    };
    let after_new = BlockSnapshot {
        id: result.new_block.id.clone(),
        object_id: note_id.to_string(),
        parent_id: result.new_block.parent_id.clone(),
        r#type: "text".into(),
        content: result.new_block.content.clone(),
        fields: "{}".into(),
        align: result.new_block.align,
        bg_color: result.new_block.bg_color.clone(),
        position: result.new_block.position,
        existed: false,
    };

    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: "Split block".into(),
            before,
            after: vec![after_orig, after_new],
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok((result.original_block, result.new_block))
}

/// Merge two adjacent text blocks.
/// Go source: editor.go — MergeBlock(ctx, req pb.RpcBlockMergeRequest)
///   → cache.Do(s, req.ContextId, func(b stext.Text) { b.Merge(ctx, req.FirstBlockId, req.SecondBlockId) })
pub async fn merge_block(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    first_id: &str,
    second_id: &str,
) -> OpResult<BlockRow> {
    let before = snapshot_blocks(db, &[first_id.to_string(), second_id.to_string()]).await;

    let result = block_merge(
        db,
        BlockMergeParams {
            source_id: second_id.to_string(),
            target_id: first_id.to_string(),
            object_id: note_id.to_string(),
            merge_text: None,
        },
    )
    .await?;

    let after = snapshot_blocks(db, &[first_id.to_string()]).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: "Merge blocks".into(),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(result.target_block)
}

/// Replace a block's type and content entirely.
/// Go source: editor.go — ReplaceBlock(ctx, req pb.RpcBlockReplaceRequest)
///   → cache.Do(s, req.ContextId, func(b basic.Replaceable) { b.Replace(ctx, req.BlockId, req.Block) })
pub async fn replace_block(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_id: &str,
    new_type: &str,
    new_content: Value,
) -> OpResult<BlockRow> {
    let before = snapshot_blocks(db, &[block_id.to_string()]).await;

    let _updated = block_update(
        db,
        BlockUpdateParams {
            id: block_id.to_string(),
            content: Some(new_content),
            fields: None,
            align: None,
            bg_color: None,
        },
    )
    .await?;

    // Update type separately (block_update doesn't change type)
    sqlx::query("UPDATE blocks SET type = ?, updated_at = ? WHERE id = ?")
        .bind(new_type)
        .bind(crate::util::time::now_ms())
        .bind(block_id)
        .execute(db)
        .await
        .map_err(OperationError::db_error)?;

    let row = get_block_by_id(db, block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", block_id))?;

    let after = snapshot_blocks(db, &[block_id.to_string()]).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: "Replace block".into(),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(row)
}

/// Duplicate one or more blocks with their full subtrees, inserting copies after target.
///
/// Go source: editor.go — DuplicateBlocks(sctx, req pb.RpcBlockListDuplicateRequest)
///   → sb.Duplicate(srcState, srcState, req.TargetId, req.Position, req.BlockIds)
///
/// Go's Duplicate():
///   1. SelectRoots(blockIds) — prune IDs whose ancestor is also in the list
///   2. For each root: copyBlocks() recursively (new UUID per block, children remapped)
///   3. InsertTo(target, Block_Bottom) for each copied root in sequence
///
/// Previous implementation: flat copy only, raw parent_ids from source → broken nesting.
/// This version: uses `select_roots` + `copy_block_tree_into` for exact parity.
pub async fn duplicate_blocks(
    db: &SqlitePool,
    history: &HistoryRegistry,
    params: DuplicateBlocksParams,
) -> OpResult<Vec<BlockRow>> {
    let now = crate::util::time::now_ms();

    // Load the full block set so we can find children during tree collection
    let all_blocks = get_blocks_by_object(db, &params.note_id).await?;

    // Go: blockIds = srcState.SelectRoots(blockIds)
    // Drop any ID whose ancestor is also in the requested set — avoids double-copying subtrees
    let root_ids = select_roots(&all_blocks, &params.block_ids);
    if root_ids.is_empty() {
        return Ok(vec![]);
    }

    // Determine the base insert position (after the target block, or at tail)
    let base_pos: i32 = if let Some(target_id) = &params.target_id {
        get_block_by_id(db, target_id)
            .await?
            .map(|b| b.position + 1)
            .unwrap_or(0)
    } else {
        sqlx::query_scalar::<_, i32>(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM blocks WHERE object_id = ? AND parent_id IS NULL"
        )
        .bind(&params.note_id)
        .fetch_one(db)
        .await
        .unwrap_or(0)
    };

    // Make room at the insertion point for the root-level copies
    // Go: InsertTo shifts existing blocks automatically via the state layer
    sqlx::query(
        "UPDATE blocks SET position = position + ? \
         WHERE object_id = ? AND parent_id IS NULL AND position >= ?",
    )
    .bind(root_ids.len() as i32)
    .bind(&params.note_id)
    .bind(base_pos)
    .execute(db)
    .await
    .map_err(OperationError::db_error)?;

    // For each root: collect its full subtree from the in-memory snapshot and
    // copy the entire tree with remapped IDs into the same note.
    // Go: for each root → copyBlocks(srcState, destState, id) → InsertTo(target, Block_Bottom)
    let mut all_copied: Vec<BlockRow> = Vec::new();

    for (i, root_id) in root_ids.iter().enumerate() {
        let subtree: Vec<&BlockRow> = {
            // DFS from this root using the in-memory snapshot
            let mut ids: HashSet<String> = HashSet::new();
            let mut stack = vec![root_id.clone()];
            while let Some(id) = stack.pop() {
                if ids.insert(id.clone()) {
                    for b in &all_blocks {
                        if b.parent_id.as_deref() == Some(&id) {
                            stack.push(b.id.clone());
                        }
                    }
                }
            }
            all_blocks.iter().filter(|b| ids.contains(&b.id)).collect()
        };

        // The root copy lands at base_pos + i (root-level siblings, no parent)
        let root_target_pos = Some(base_pos + i as i32);
        let copied = copy_block_tree_into(db, &subtree, &params.note_id, root_target_pos).await?;
        all_copied.extend(copied);
    }

    // Undo snapshot
    let after_snaps: Vec<BlockSnapshot> = all_copied
        .iter()
        .map(|row| BlockSnapshot {
            id: row.id.clone(),
            object_id: params.note_id.clone(),
            parent_id: row.parent_id.clone(),
            r#type: row.r#type.clone(),
            content: row.content.clone(),
            fields: row.fields.clone(),
            align: row.align,
            bg_color: row.bg_color.clone(),
            position: row.position,
            existed: false,
        })
        .collect();

    history.push(
        &params.note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: params.note_id.clone(),
            description: format!("Duplicate {} block tree(s)", root_ids.len()),
            before: vec![],
            after: after_snaps,
            created_at: now,
        },
    );

    Ok(all_copied)
}

/// Move blocks to a new parent position within the same note.
/// Go source: editor.go — MoveBlocks(ctx, req pb.RpcBlockListMoveToExistingObjectRequest)
///   → sb.Move(srcState, destState, req.DropTargetId, req.Position, req.BlockIds)
pub async fn move_blocks(
    db: &SqlitePool,
    history: &HistoryRegistry,
    params: MoveBlocksParams,
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, &params.block_ids).await;

    let mut moved = Vec::with_capacity(params.block_ids.len());
    for (i, bid) in params.block_ids.iter().enumerate() {
        let row = block_move(
            db,
            BlockMoveParams {
                block_id: bid.clone(),
                object_id: params.note_id.clone(),
                target_parent_id: params.target_parent_id.clone(),
                position: params.position + i as i32,
            },
        )
        .await?;
        moved.push(row);
    }

    let after = snapshot_blocks(db, &params.block_ids).await;
    history.push(
        &params.note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: params.note_id.clone(),
            description: format!("Move {} block(s)", params.block_ids.len()),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(moved)
}

// ─── Text content operations ──────────────────────────────────────────────────

/// Update the text content of a block.
/// Go source: editor.go — SetTextText(ctx, req pb.RpcBlockTextSetTextRequest)
///   → cache.Do(s, req.ContextId, func(b stext.Text) { b.SetText(ctx, req) })
pub async fn set_text_content(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_id: &str,
    text: String,
    marks: Option<Value>,
) -> OpResult<BlockRow> {
    let before = snapshot_blocks(db, &[block_id.to_string()]).await;

    let existing = get_block_by_id(db, block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", block_id))?;
    let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));
    content["text"] = Value::String(text);
    if let Some(m) = marks {
        content["marks"] = m;
    }

    let updated = block_update(
        db,
        BlockUpdateParams {
            id: block_id.to_string(),
            content: Some(content),
            fields: None,
            align: None,
            bg_color: None,
        },
    )
    .await?;

    let after = snapshot_blocks(db, &[block_id.to_string()]).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: "Set text".into(),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Change the style of one or more text blocks.
/// Go source: editor.go — SetTextStyle(ctx, contextId, style, blockIds…)
///   → cache.Do(s, contextId, func(b stext.Text) { b.UpdateTextBlocks(ctx, blockIds, true, func(t text.Block){ t.SetStyle(style) }) })
pub async fn set_text_style(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
    style: &str,
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let existing = get_block_by_id(db, bid)
            .await?
            .ok_or_else(|| OperationError::not_found("Block", bid))?;
        let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));
        content["style"] = text_style_value(style);
        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: Some(content),
                fields: None,
                align: None,
                bg_color: None,
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Set style to {style}"),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Toggle checkbox checked state.
/// Go source: editor.go — SetTextChecked(ctx, req pb.RpcBlockTextSetCheckedRequest)
///   → cache.Do(s, req.ContextId, func(b stext.Text) { b.UpdateTextBlocks(ctx, []string{req.BlockId}, true, func(t text.Block){ t.SetChecked(req.Checked) }) })
pub async fn set_text_checked(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_id: &str,
    checked: bool,
) -> OpResult<BlockRow> {
    let before = snapshot_blocks(db, &[block_id.to_string()]).await;

    let existing = get_block_by_id(db, block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", block_id))?;
    let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));
    content["checked"] = Value::Bool(checked);

    let updated = block_update(
        db,
        BlockUpdateParams {
            id: block_id.to_string(),
            content: Some(content),
            fields: None,
            align: None,
            bg_color: None,
        },
    )
    .await?;

    let after = snapshot_blocks(db, &[block_id.to_string()]).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Set checked: {checked}"),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Set text color on one or more blocks.
/// Go source: editor.go — SetTextColor(ctx, contextId, color, blockIds…)
///   → cache.Do(s, contextId, func(b stext.Text) { b.UpdateTextBlocks(ctx, blockIds, true, func(t text.Block){ t.SetTextColor(color) }) })
pub async fn set_text_color(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
    color: &str,
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let existing = get_block_by_id(db, bid)
            .await?
            .ok_or_else(|| OperationError::not_found("Block", bid))?;
        let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));
        content["color"] = Value::String(color.to_string());
        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: Some(content),
                fields: None,
                align: None,
                bg_color: None,
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Set text color: {color}"),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Apply a text mark (bold, italic, link, etc.) to specified range on multiple blocks.
/// Go source: editor.go — SetTextMark(ctx, contextId, mark *model.BlockContentTextMark, blockIds…)
///   → cache.Do(s, contextId, func(b stext.Text) { b.SetMark(ctx, mark, blockIds…) })
pub async fn set_text_mark(
    db: &SqlitePool,
    history: &HistoryRegistry,
    params: SetMarkParams,
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, &params.block_ids).await;
    let mut updated = Vec::with_capacity(params.block_ids.len());

    let new_mark = json!({
        "type": params.mark_type,
        "param": params.param,
        "range": { "from": params.range_from, "to": params.range_to }
    });

    for bid in &params.block_ids {
        let existing = get_block_by_id(db, bid)
            .await?
            .ok_or_else(|| OperationError::not_found("Block", bid))?;
        let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));

        let marks = content["marks"].as_array_mut().map(|m| {
            // Remove overlapping marks of the same type
            m.retain(|mk| {
                let same_type = mk["type"].as_i64().unwrap_or(-1) == params.mark_type as i64;
                let mk_from = mk["range"]["from"].as_i64().unwrap_or(0);
                let mk_to = mk["range"]["to"].as_i64().unwrap_or(0);
                let overlaps = mk_from < params.range_to as i64 && mk_to > params.range_from as i64;
                !(same_type && overlaps)
            });
            m.push(new_mark.clone());
        });

        if marks.is_none() {
            content["marks"] = json!([new_mark.clone()]);
        }

        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: Some(content),
                fields: None,
                align: None,
                bg_color: None,
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, &params.block_ids).await;
    history.push(
        &params.note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: params.note_id.clone(),
            description: format!("Set text mark type={}", params.mark_type),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Clear all text formatting (style, marks, color) from blocks.
/// Go source: editor.go — ClearTextStyle(ctx, contextId, blockIds…)
///   Clears: BackgroundColor, Align, VerticalAlign, TextColor, Style, all mark types
///   (Strike, Keyboard, Italic, Bold, Underscored, TextColor, BgColor)
pub async fn clear_text_style(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let existing = get_block_by_id(db, bid)
            .await?
            .ok_or_else(|| OperationError::not_found("Block", bid))?;
        let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));

        // Go source: t.SetStyle(Paragraph), t.SetTextColor(""), t.Model().BackgroundColor = ""
        content["style"] = json!(TextStyle::Paragraph as i32);
        content["color"] = json!("");

        // Remove formatting marks only (keep Link, Mention, Object marks)
        // Go source: ClearTextStyle filters out Strike,Keyboard,Italic,Bold,Underscored,TextColor,BgColor
        let remove_types: &[i64] = &[0, 1, 2, 3, 4, 6, 7]; // Strike,Code,Italic,Bold,Underline,Color,BgColor
        if let Some(marks) = content["marks"].as_array_mut() {
            marks.retain(|m| {
                let t = m["type"].as_i64().unwrap_or(-1);
                !remove_types.contains(&t)
            });
        }

        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: Some(content),
                fields: None,
                align: Some(0),
                bg_color: Some("".to_string()),
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: "Clear text style".into(),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Clear text content of blocks.
/// Go source: editor.go — ClearTextContent(ctx, contextId, blockIds…)
///   → UpdateTextBlocks(…, func(t text.Block){ t.SetText("", nil) })
pub async fn clear_text_content(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let existing = get_block_by_id(db, bid)
            .await?
            .ok_or_else(|| OperationError::not_found("Block", bid))?;
        let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));
        content["text"] = json!("");
        content["marks"] = json!([]);
        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: Some(content),
                fields: None,
                align: None,
                bg_color: None,
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: "Clear text content".into(),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Set background color on blocks.
/// Go source: editor.go — SetBackgroundColor(ctx, contextId, color, blockIds…)
///   → cache.Do(s, contextId, func(b basic.Updatable) { b.Update(ctx, func(b simple.Block){ b.Model().BackgroundColor = color }) })
pub async fn set_background_color(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
    color: &str,
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: None,
                fields: None,
                align: None,
                bg_color: Some(color.to_string()),
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Set bg color: {color}"),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Set horizontal alignment on blocks.
/// Go source: editor.go — SetAlign(ctx, contextId, align model.BlockAlign, blockIds…)
///   → cache.DoStateCtx(s, ctx, contextId, func(st *state.State, sb SmartBlock) { st.SetAlign(align, blockIds…) })
pub async fn set_align(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
    align: i32, // 0=Left, 1=Center, 2=Right, 3=Justify (matches model.BlockAlign)
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: None,
                fields: None,
                align: Some(align),
                bg_color: None,
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Set align: {align}"),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Turn one or more text blocks into a different style.
/// Go source: editor.go — TurnInto(ctx, contextId, style model.BlockContentTextStyle, ids…)
///   → cache.Do(s, contextId, func(b stext.Text) { b.TurnInto(ctx, style, ids…) })
/// TurnInto differs from SetTextStyle in that it also resets checked/marks for incompatible styles.
pub async fn turn_into(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
    block_ids: &[String],
    style: &str,
) -> OpResult<Vec<BlockRow>> {
    let before = snapshot_blocks(db, block_ids).await;
    let mut updated = Vec::with_capacity(block_ids.len());

    for bid in block_ids {
        let existing = get_block_by_id(db, bid)
            .await?
            .ok_or_else(|| OperationError::not_found("Block", bid))?;
        let mut content: Value = serde_json::from_str(&existing.content).unwrap_or(json!({}));

        content["style"] = text_style_value(style);

        // Go: TurnInto resets checked if style is not Checkbox
        if !is_checkbox_style(style) {
            content["checked"] = json!(false);
        }

        // Go: TurnInto resets marks for Code style
        if is_code_style(style) {
            content["marks"] = json!([]);
        }

        let row = block_update(
            db,
            BlockUpdateParams {
                id: bid.clone(),
                content: Some(content),
                fields: None,
                align: None,
                bg_color: None,
            },
        )
        .await?;
        updated.push(row);
    }

    let after = snapshot_blocks(db, block_ids).await;
    history.push(
        note_id,
        Change {
            id: Uuid::new_v4().to_string(),
            object_id: note_id.to_string(),
            description: format!("Turn into {style}"),
            before,
            after,
            created_at: crate::util::time::now_ms(),
        },
    );

    Ok(updated)
}

/// Set the layout of the note (Page, Note, etc.).
/// Go source: editor.go — SetLayout(ctx, contextId, layout model.ObjectTypeLayout)
///   → cache.Do(s, contextId, func(sb basic.CommonOperations) { sb.SetLayout(ctx, layout) })
pub async fn set_layout(db: &SqlitePool, note_id: &str, layout: &str) -> OpResult<NoteObject> {
    sqlx::query("UPDATE note_objects SET layout = ?, updated_at = ? WHERE id = ?")
        .bind(layout)
        .bind(crate::util::time::now_ms())
        .bind(note_id)
        .execute(db)
        .await
        .map_err(OperationError::db_error)?;

    get_note_object(db, note_id).await
}

// ─── Undo / Redo ─────────────────────────────────────────────────────────────

/// Undo the most recent change on a note.
/// Go source: editor.go — Undo(ctx, req pb.RpcObjectUndoRequest)
///   → cache.Do(s, req.ContextId, func(b basic.IHistory) { b.Undo(ctx) })
pub async fn undo(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
) -> OpResult<HistoryInfo> {
    match history.undo(note_id) {
        None => Ok(HistoryInfo {
            can_undo: false,
            can_redo: history.can_redo(note_id),
            restored_blocks: vec![],
        }),
        Some(change) => {
            let restored = restore_snapshots(db, &change.before).await?;
            Ok(HistoryInfo {
                can_undo: history.can_undo(note_id),
                can_redo: history.can_redo(note_id),
                restored_blocks: restored,
            })
        }
    }
}

/// Redo the most recently undone change.
/// Go source: editor.go — Redo(ctx, req pb.RpcObjectRedoRequest)
///   → cache.Do(s, req.ContextId, func(b basic.IHistory) { b.Redo(ctx) })
pub async fn redo(
    db: &SqlitePool,
    history: &HistoryRegistry,
    note_id: &str,
) -> OpResult<HistoryInfo> {
    match history.redo(note_id) {
        None => Ok(HistoryInfo {
            can_undo: history.can_undo(note_id),
            can_redo: false,
            restored_blocks: vec![],
        }),
        Some(change) => {
            let restored = restore_snapshots(db, &change.after).await?;
            Ok(HistoryInfo {
                can_undo: history.can_undo(note_id),
                can_redo: history.can_redo(note_id),
                restored_blocks: restored,
            })
        }
    }
}
