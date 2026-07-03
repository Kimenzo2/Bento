// ════════════════════════════════════════════════════════════════════════
// NOTES COMMANDS — Tauri IPC layer for the Notes CRUD service
// ════════════════════════════════════════════════════════════════════════
//
// Every #[tauri::command] here is a 1:1 surface of a service.rs function.
// Go source equivalents are noted per command.
//
// Pattern:  Go proto RPC handler  →  service fn  →  Tauri command
//   e.g.:   pb.RpcObjectCreate    →  create_note_object()  →  notes_create_object
// ════════════════════════════════════════════════════════════════════════

use std::sync::Arc;
use tauri::State;

use crate::db::BentoAppState;
use crate::search::SearchService;

use super::service::{
    block_create, clear_text_content, clear_text_style, create_note_object, delete_note_object,
    duplicate_blocks, get_note_full_cached, get_note_object, list_note_objects, merge_block,
    move_blocks, object_duplicate, redo, replace_block, set_align, set_background_color,
    set_layout, set_text_checked, set_text_color, set_text_content, set_text_mark, set_text_style,
    split_block, turn_into, undo, unlink_block, update_note_object, BlockCreateParams,
    CreateNoteParams, DuplicateBlocksParams, HistoryInfo, MoveBlocksParams, NoteObject,
    NoteSummary, NoteWithBlocks, SetMarkParams, UpdateNoteParams,
};
use super::undo::HistoryRegistry;

// ─── State accessor helpers ───────────────────────────────────────────────────

fn db(state: &BentoAppState) -> sqlx::SqlitePool {
    state.db()
}

// ─── Object commands ─────────────────────────────────────────────────────────

/// Create a new note object with an initial title block and empty paragraph.
/// Go source: objectcreator.CreateObject(ctx, spaceID, CreateObjectRequest{ObjectTypeKey: TypeKeyNote})
#[tauri::command]
pub async fn notes_object_create(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    search: State<'_, SearchService>,
    cache: State<'_, Arc<super::NoteFullCache>>,
    params: CreateNoteParams,
) -> Result<NoteWithBlocks, String> {
    create_note_object(
        &db(&state),
        &history,
        &search,
        cache.inner().as_ref(),
        params,
    )
    .await
    .map_err(|e| e.message)
}

/// Get a note object by ID (metadata only, no blocks).
/// Go source: cache.Do(s, id, func(b SmartBlock) { b.NewState().Details() })
#[tauri::command]
pub async fn notes_object_get(
    state: State<'_, BentoAppState>,
    note_id: String,
) -> Result<NoteObject, String> {
    get_note_object(&db(&state), &note_id)
        .await
        .map_err(|e| e.message)
}

/// Get a note with its full block tree.
/// Go source: cache.Do(s, id, …) + store/block.getBlocks(rootId)
#[tauri::command]
pub async fn notes_object_full(
    state: State<'_, BentoAppState>,
    cache: State<'_, Arc<super::NoteFullCache>>,
    note_id: String,
) -> Result<NoteWithBlocks, String> {
    get_note_full_cached(&db(&state), cache.inner().as_ref(), &note_id)
        .await
        .map_err(|e| e.message)
}

/// List note summaries with optional archived filter and pagination.
/// Go source: objectstore.SpaceIndex.QueryObjectIds + GetDetails batch
#[tauri::command]
pub async fn notes_list(
    state: State<'_, BentoAppState>,
    include_archived: Option<bool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<NoteSummary>, String> {
    list_note_objects(
        &db(&state),
        include_archived.unwrap_or(false),
        limit.unwrap_or(100),
        offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.message)
}

/// Update note metadata (title, icon, cover, tags, pinned, archived).
/// Go source: block/details.go SetDetails(ctx, objectId, details, true)
#[tauri::command]
pub async fn notes_object_update(
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    params: UpdateNoteParams,
) -> Result<NoteObject, String> {
    update_note_object(&db(&state), &search, params)
        .await
        .map_err(|e| e.message)
}

/// Delete a note object and all its blocks.
/// Go source: block/delete.go DeleteObject(objectId) → DeleteObjectByFullID → spc.DeleteTree
#[tauri::command]
pub async fn notes_object_delete(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    search: State<'_, SearchService>,
    cache: State<'_, Arc<super::NoteFullCache>>,
    note_id: String,
) -> Result<(), String> {
    delete_note_object(
        &db(&state),
        &history,
        &search,
        cache.inner().as_ref(),
        &note_id,
    )
    .await
    .map_err(|e| e.message)
}

/// Duplicate a note object (all blocks copied).
/// Go source: block/create.go ObjectDuplicate(ctx, id)
#[tauri::command]
pub async fn notes_object_duplicate(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    search: State<'_, SearchService>,
    cache: State<'_, Arc<super::NoteFullCache>>,
    source_id: String,
) -> Result<NoteWithBlocks, String> {
    object_duplicate(
        &db(&state),
        &history,
        &search,
        cache.inner().as_ref(),
        &source_id,
    )
    .await
    .map_err(|e| e.message)
}

// ─── Block commands ───────────────────────────────────────────────────────────

/// Create a new block at a position inside a note.
/// Go source: editor.go CreateBlock(ctx, pb.RpcBlockCreateRequest)
#[tauri::command]
pub async fn notes_block_create(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    params: BlockCreateParams,
) -> Result<crate::local_store::block::BlockRow, String> {
    block_create(&db(&state), &history, params)
        .await
        .map_err(|e| e.message)
}

/// Unlink (delete) one or more blocks from a note.
/// Go source: editor.go UnlinkBlock(ctx, pb.RpcBlockListDeleteRequest)
#[tauri::command]
pub async fn notes_block_unlink(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
) -> Result<(), String> {
    unlink_block(&db(&state), &history, &note_id, &block_ids)
        .await
        .map_err(|e| e.message)
}

/// Split a text block at the given character offset.
/// Go source: editor.go SplitBlock(ctx, pb.RpcBlockSplitRequest)
#[tauri::command]
pub async fn notes_block_split(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_id: String,
    split_at: i32,
) -> Result<
    (
        crate::local_store::block::BlockRow,
        crate::local_store::block::BlockRow,
    ),
    String,
> {
    split_block(&db(&state), &history, &note_id, &block_id, split_at)
        .await
        .map_err(|e| e.message)
}

/// Merge two adjacent text blocks (Backspace at block start).
/// Go source: editor.go MergeBlock(ctx, pb.RpcBlockMergeRequest)
#[tauri::command]
pub async fn notes_block_merge(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    first_id: String,
    second_id: String,
) -> Result<crate::local_store::block::BlockRow, String> {
    merge_block(&db(&state), &history, &note_id, &first_id, &second_id)
        .await
        .map_err(|e| e.message)
}

/// Replace a block's type and content entirely.
/// Go source: editor.go ReplaceBlock(ctx, pb.RpcBlockReplaceRequest)
#[tauri::command]
pub async fn notes_block_replace(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_id: String,
    new_type: String,
    new_content: serde_json::Value,
) -> Result<crate::local_store::block::BlockRow, String> {
    replace_block(
        &db(&state),
        &history,
        &note_id,
        &block_id,
        &new_type,
        new_content,
    )
    .await
    .map_err(|e| e.message)
}

/// Duplicate one or more blocks within a note.
/// Go source: editor.go DuplicateBlocks(sctx, pb.RpcBlockListDuplicateRequest)
#[tauri::command]
pub async fn notes_block_duplicate(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    params: DuplicateBlocksParams,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    duplicate_blocks(&db(&state), &history, params)
        .await
        .map_err(|e| e.message)
}

/// Move blocks to a new parent/position within a note.
/// Go source: editor.go MoveBlocks(ctx, pb.RpcBlockListMoveToExistingObjectRequest)
#[tauri::command]
pub async fn notes_block_move(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    params: MoveBlocksParams,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    move_blocks(&db(&state), &history, params)
        .await
        .map_err(|e| e.message)
}

// ─── Text content commands ────────────────────────────────────────────────────

/// Set text content of a block.
/// Go source: editor.go SetTextText(ctx, pb.RpcBlockTextSetTextRequest)
#[tauri::command]
pub async fn notes_set_text_content(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_id: String,
    text: String,
    marks: Option<serde_json::Value>,
) -> Result<crate::local_store::block::BlockRow, String> {
    set_text_content(&db(&state), &history, &note_id, &block_id, text, marks)
        .await
        .map_err(|e| e.message)
}

/// Set text style on one or more blocks.
/// Go source: editor.go SetTextStyle(ctx, contextId, style, blockIds…)
#[tauri::command]
pub async fn notes_set_text_style(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
    style: String,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    set_text_style(&db(&state), &history, &note_id, &block_ids, &style)
        .await
        .map_err(|e| e.message)
}

/// Toggle checkbox checked state.
/// Go source: editor.go SetTextChecked(ctx, pb.RpcBlockTextSetCheckedRequest)
#[tauri::command]
pub async fn notes_set_text_checked(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_id: String,
    checked: bool,
) -> Result<crate::local_store::block::BlockRow, String> {
    set_text_checked(&db(&state), &history, &note_id, &block_id, checked)
        .await
        .map_err(|e| e.message)
}

/// Set text color on one or more blocks.
/// Go source: editor.go SetTextColor(ctx, contextId, color, blockIds…)
#[tauri::command]
pub async fn notes_set_text_color(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
    color: String,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    set_text_color(&db(&state), &history, &note_id, &block_ids, &color)
        .await
        .map_err(|e| e.message)
}

/// Apply a text formatting mark to one or more blocks.
/// Go source: editor.go SetTextMark(ctx, contextId, mark, blockIds…)
/// Go source: stext.SetMark — toggles marks if all blocks already have it (reverse logic)
#[tauri::command]
pub async fn notes_set_text_mark(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    params: SetMarkParams,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    set_text_mark(&db(&state), &history, params)
        .await
        .map_err(|e| e.message)
}

/// Clear all text formatting from blocks (style→Paragraph, marks removed, color cleared).
/// Go source: editor.go ClearTextStyle(ctx, contextId, blockIds…)
///   Clears: Strike, Keyboard, Italic, Bold, Underscored, TextColor, BgColor marks
#[tauri::command]
pub async fn notes_clear_text_style(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    clear_text_style(&db(&state), &history, &note_id, &block_ids)
        .await
        .map_err(|e| e.message)
}

/// Clear text content of blocks (text→"", marks→[]).
/// Go source: editor.go ClearTextContent(ctx, contextId, blockIds…)
#[tauri::command]
pub async fn notes_clear_text_content(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    clear_text_content(&db(&state), &history, &note_id, &block_ids)
        .await
        .map_err(|e| e.message)
}

/// Set background color on blocks.
/// Go source: editor.go SetBackgroundColor(ctx, contextId, color, blockIds…)
#[tauri::command]
pub async fn notes_set_background_color(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
    color: String,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    set_background_color(&db(&state), &history, &note_id, &block_ids, &color)
        .await
        .map_err(|e| e.message)
}

/// Set horizontal alignment on blocks.
/// Go source: editor.go SetAlign(ctx, contextId, align, blockIds…)
///   align: 0=Left, 1=Center, 2=Right, 3=Justify (model.BlockAlign)
#[tauri::command]
pub async fn notes_set_align(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
    align: i32,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    set_align(&db(&state), &history, &note_id, &block_ids, align)
        .await
        .map_err(|e| e.message)
}

/// Turn blocks into a different text style with layout adjustments.
/// Go source: editor.go TurnInto(ctx, contextId, style, ids…)
///   Also ported: stext.TurnInto — moves children for Header/Code, resets color for Code,
///   resets align for Checkbox/Marked/Numbered/Callout/Toggle
#[tauri::command]
pub async fn notes_turn_into(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_ids: Vec<String>,
    style: String,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    turn_into(&db(&state), &history, &note_id, &block_ids, &style)
        .await
        .map_err(|e| e.message)
}

/// Set the layout of a note object.
/// Go source: editor.go SetLayout(ctx, contextId, layout model.ObjectTypeLayout)
#[tauri::command]
pub async fn notes_set_layout(
    state: State<'_, BentoAppState>,
    note_id: String,
    layout: String,
) -> Result<NoteObject, String> {
    set_layout(&db(&state), &note_id, &layout)
        .await
        .map_err(|e| e.message)
}

// ─── History commands ─────────────────────────────────────────────────────────

/// Undo the most recent change on a note.
/// Go source: editor.go Undo(ctx, pb.RpcObjectUndoRequest)
#[tauri::command]
pub async fn notes_undo(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
) -> Result<HistoryInfo, String> {
    undo(&db(&state), &history, &note_id)
        .await
        .map_err(|e| e.message)
}

/// Redo the most recently undone change.
/// Go source: editor.go Redo(ctx, pb.RpcObjectRedoRequest)
#[tauri::command]
pub async fn notes_redo(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
) -> Result<HistoryInfo, String> {
    redo(&db(&state), &history, &note_id)
        .await
        .map_err(|e| e.message)
}

/// Set a callout icon on one or more text blocks.
/// Go source: stext.SetIcon(ctx, image, emoji, blockIds…)
#[tauri::command]
pub async fn notes_set_icon(
    state: State<'_, BentoAppState>,
    _history: State<'_, Arc<HistoryRegistry>>,
    _note_id: String,
    block_ids: Vec<String>,
    image: String,
    emoji: String,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    let db = db(&state);
    let mut updated = Vec::new();
    for bid in &block_ids {
        let existing = crate::local_store::operations::get_block_by_id(&db, bid)
            .await
            .map_err(|e| e.message)?;
        if let Some(row) = existing {
            let mut content: serde_json::Value =
                serde_json::from_str(&row.content).unwrap_or(serde_json::json!({}));
            if !image.is_empty() {
                content["iconImage"] = serde_json::json!(image.clone());
            }
            if !emoji.is_empty() {
                content["iconEmoji"] = serde_json::json!(emoji.clone());
            }
            let r = crate::local_store::operations::block_update(
                &db,
                crate::local_store::operations::BlockUpdateParams {
                    id: bid.clone(),
                    content: Some(content),
                    fields: None,
                    align: None,
                    bg_color: None,
                },
            )
            .await
            .map_err(|e| e.message)?;
            updated.push(r);
        }
    }
    Ok(updated)
}

/// Get all blocks for a note.
/// Go source: store/block.ts — getBlocks(rootId)
#[tauri::command]
pub async fn notes_get_blocks(
    state: State<'_, BentoAppState>,
    note_id: String,
) -> Result<Vec<crate::local_store::block::BlockRow>, String> {
    crate::local_store::operations::get_blocks_by_object(&db(&state), &note_id)
        .await
        .map_err(|e| e.message)
}

/// Search notes by title and content.
/// Go source: objectstore.SpaceIndex.QueryObjectIds + FTS
#[tauri::command]
pub async fn notes_search(
    state: State<'_, BentoAppState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<NoteSummary>, String> {
    use sqlx::Row;
    let db = db(&state);
    let q = format!("%{}%", query.to_lowercase());
    let limit = limit.unwrap_or(50);

    let rows = sqlx::query(
        r#"
        SELECT
            n.id, n.title, n.icon, n.tags, n.pinned, n.is_archived,
            n.updated_at, n.created_at,
            COUNT(b.id) AS block_count
        FROM note_objects n
        LEFT JOIN blocks b ON b.object_id = n.id AND b.type = 'text'
        WHERE n.is_archived = 0
          AND (LOWER(n.title) LIKE ? OR b.content LIKE ?)
        GROUP BY n.id
        ORDER BY n.updated_at DESC
        LIMIT ?
        "#,
    )
    .bind(&q)
    .bind(&q)
    .bind(limit)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let summaries = rows
        .into_iter()
        .map(|row| {
            let tags_str: String = row.try_get("tags").unwrap_or_else(|_| "[]".to_string());
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            NoteSummary {
                id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                icon: row.try_get("icon").ok().flatten(),
                preview: String::new(),
                tags,
                pinned: row.try_get::<bool, _>("pinned").unwrap_or(false),
                is_archived: row.try_get::<bool, _>("is_archived").unwrap_or(false),
                updated_at: row.try_get("updated_at").unwrap_or(0),
                created_at: row.try_get("created_at").unwrap_or(0),
                block_count: row.try_get::<i64, _>("block_count").unwrap_or(0),
            }
        })
        .collect();

    Ok(summaries)
}
