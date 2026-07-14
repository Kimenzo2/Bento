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
    set_block_fields, set_layout, set_text_checked, set_text_color, set_text_content, set_text_mark,
    set_text_style, split_block, turn_into, undo, unlink_block, update_note_object,
    BlockCreateParams, CreateNoteParams, DuplicateBlocksParams, HistoryInfo, MoveBlocksParams,
    NoteObject, NoteSummary, NoteWithBlocks, SetMarkParams, UpdateNoteParams,
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

/// Get all backlinks (wiki links that point to this note).
#[tauri::command]
pub async fn notes_get_backlinks(
    state: State<'_, BentoAppState>,
    note_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    use sqlx::Row;
    let db = db(&state);
    let rows = sqlx::query(
        r#"
        SELECT nl.id, nl.source_note_id, nl.target_title, nl.created_at,
               no.title AS source_title, no.icon AS source_icon
        FROM note_links nl
        LEFT JOIN note_objects no ON nl.source_note_id = no.id
        WHERE nl.target_note_id = ?
        ORDER BY nl.created_at DESC
        "#,
    )
    .bind(&note_id)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let backlinks: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "sourceNoteId": row.try_get::<String, _>("source_note_id").unwrap_or_default(),
            "sourceTitle": row.try_get::<String, _>("source_title").unwrap_or_else(|_| "Untitled".to_string()),
            "sourceIcon": row.try_get::<Option<String>, _>("source_icon").ok().flatten(),
            "targetTitle": row.try_get::<String, _>("target_title").unwrap_or_default(),
            "createdAt": row.try_get::<i64, _>("created_at").unwrap_or(0),
        })
    }).collect();

    Ok(backlinks)
}

/// Find a note by exact title match (for wiki link resolution).
#[tauri::command]
pub async fn notes_find_by_title(
    state: State<'_, BentoAppState>,
    title: String,
) -> Result<Option<serde_json::Value>, String> {
    use sqlx::Row;
    let db = db(&state);
    let row = sqlx::query(
        r#"
        SELECT id, title, icon
        FROM note_objects
        WHERE LOWER(title) = LOWER(?) AND is_archived = 0
        LIMIT 1
        "#,
    )
    .bind(&title)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|r| {
        serde_json::json!({
            "id": r.try_get::<String, _>("id").unwrap_or_default(),
            "title": r.try_get::<String, _>("title").unwrap_or_default(),
            "icon": r.try_get::<Option<String>, _>("icon").ok().flatten(),
        })
    }))
}

/// Search notes by title prefix (for wiki link autocomplete).
#[tauri::command]
pub async fn notes_search_by_title(
    state: State<'_, BentoAppState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<serde_json::Value>, String> {
    use sqlx::Row;
    let db = db(&state);
    let q = format!("%{}%", query);
    let limit = limit.unwrap_or(10);
    let rows = sqlx::query(
        r#"
        SELECT id, title, icon
        FROM note_objects
        WHERE LOWER(title) LIKE LOWER(?) AND is_archived = 0
        ORDER BY
            CASE WHEN LOWER(title) = LOWER(?) THEN 0
                 WHEN LOWER(title) LIKE LOWER(?) THEN 1
                 ELSE 2
            END,
            updated_at DESC
        LIMIT ?
        "#,
    )
    .bind(&q)
    .bind(&query)
    .bind(&format!("{}%", query))
    .bind(limit)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let results: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "title": row.try_get::<String, _>("title").unwrap_or_default(),
            "icon": row.try_get::<Option<String>, _>("icon").ok().flatten(),
        })
    }).collect();

    Ok(results)
}

/// Index wiki links found in a note's blocks (call after saving).
#[tauri::command]
pub async fn notes_index_wikilinks(
    state: State<'_, BentoAppState>,
    note_id: String,
) -> Result<i64, String> {
    use sqlx::Row;
    let db = db(&state);

    // Clear existing links for this note
    sqlx::query("DELETE FROM note_links WHERE source_note_id = ?")
        .bind(&note_id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    // Get all text blocks for this note
    let blocks = sqlx::query(
        "SELECT id, content FROM blocks WHERE object_id = ? AND type = 'text'",
    )
    .bind(&note_id)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let link_re = regex::Regex::new(r"\[\[([^\]\n]+?)(?:\|([^\]\n]+))?\]\]").unwrap();
    let mut count = 0i64;
    let now = chrono::Utc::now().timestamp_millis();

    for block in &blocks {
        let content_str: String = block.try_get("content").unwrap_or_default();
        if let Ok(content_val) = serde_json::from_str::<serde_json::Value>(&content_str) {
            let text = content_val.get("text").and_then(|v| v.as_str()).unwrap_or("");
            for cap in link_re.captures_iter(text) {
                let target_title = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("").to_string();
                if target_title.is_empty() { continue; }

                // Resolve the target note
                let target = sqlx::query(
                    "SELECT id FROM note_objects WHERE LOWER(title) = LOWER(?) AND is_archived = 0 LIMIT 1",
                )
                .bind(&target_title)
                .fetch_optional(&db)
                .await
                .map_err(|e| e.to_string())?;

                let link_id = uuid::Uuid::new_v4().to_string();
                let target_id: Option<String> = target.map(|r| r.try_get("id").unwrap_or_default());

                sqlx::query(
                    "INSERT INTO note_links (id, source_note_id, target_note_id, target_title, created_at) VALUES (?, ?, ?, ?, ?)",
                )
                .bind(&link_id)
                .bind(&note_id)
                .bind(&target_id)
                .bind(&target_title)
                .bind(now)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())?;

                count += 1;
            }
        }
    }

    Ok(count)
}

/// Get or create today's daily note.
#[tauri::command]
pub async fn notes_daily_note(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    search: State<'_, SearchService>,
    cache: State<'_, Arc<super::NoteFullCache>>,
) -> Result<NoteWithBlocks, String> {
    use sqlx::Row;
    let db = db(&state);
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let title = format!("Daily Note - {}", today);

    // Try to find existing daily note
    let existing = sqlx::query(
        "SELECT id FROM note_objects WHERE title = ? AND is_archived = 0 LIMIT 1",
    )
    .bind(&title)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(row) = existing {
        let note_id: String = row.try_get("id").map_err(|e| e.to_string())?;
        crate::notes::service::get_note_full_cached(&db, cache.inner().as_ref(), &note_id)
            .await
            .map_err(|e| e.message)
    } else {
        // Create today's daily note
        let params = crate::notes::service::CreateNoteParams {
            title: title.clone(),
            icon: Some("📅".to_string()),
            tags: vec!["daily".to_string()],
            pinned: false,
        };
        crate::notes::service::create_note_object(
            &db,
            &history,
            &search,
            cache.inner().as_ref(),
            params,
        )
        .await
        .map_err(|e| e.message)
    }
}

/// List all note templates.
#[tauri::command]
pub async fn notes_templates_list(
    state: State<'_, BentoAppState>,
) -> Result<Vec<serde_json::Value>, String> {
    use sqlx::Row;
    let db = db(&state);
    let rows = sqlx::query(
        "SELECT id, name, description, icon, created_at FROM note_templates ORDER BY name ASC",
    )
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let templates: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.try_get::<String, _>("id").unwrap_or_default(),
            "name": row.try_get::<String, _>("name").unwrap_or_default(),
            "description": row.try_get::<String, _>("description").unwrap_or_default(),
            "icon": row.try_get::<String, _>("icon").unwrap_or_else(|_| "📄".to_string()),
            "createdAt": row.try_get::<i64, _>("created_at").unwrap_or(0),
        })
    }).collect();

    Ok(templates)
}

/// Create a note template from an existing note's blocks.
#[tauri::command]
pub async fn notes_template_create(
    state: State<'_, BentoAppState>,
    name: String,
    description: String,
    icon: String,
    source_note_id: String,
) -> Result<serde_json::Value, String> {
    use sqlx::Row;
    let db = db(&state);

    // Get blocks from source note
    let blocks = sqlx::query(
        "SELECT id, type, content, fields, align, bg_color, position FROM blocks WHERE object_id = ? ORDER BY position ASC",
    )
    .bind(&source_note_id)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let blocks_json: Vec<serde_json::Value> = blocks.into_iter().map(|row| {
        let content_str: String = row.try_get("content").unwrap_or_else(|_| "{}".to_string());
        let content_val: serde_json::Value = serde_json::from_str(&content_str).unwrap_or(serde_json::json!({}));
        serde_json::json!({
            "type": row.try_get::<String, _>("type").unwrap_or_default(),
            "content": content_val,
            "style": content_val.get("style"),
        })
    }).collect();

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let blocks_str = serde_json::to_string(&blocks_json).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "INSERT INTO note_templates (id, name, description, icon, blocks_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&description)
    .bind(&icon)
    .bind(&blocks_str)
    .bind(now)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "id": id,
        "name": name,
        "description": description,
        "icon": icon,
        "createdAt": now,
    }))
}

/// Create a note from a template.
#[tauri::command]
pub async fn notes_create_from_template(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    search: State<'_, SearchService>,
    cache: State<'_, Arc<super::NoteFullCache>>,
    template_id: String,
    title: String,
) -> Result<NoteWithBlocks, String> {
    use sqlx::Row;
    let db = db(&state);

    // Get template
    let template = sqlx::query(
        "SELECT blocks_json FROM note_templates WHERE id = ?",
    )
    .bind(&template_id)
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Template not found".to_string())?;

    let blocks_json_str: String = template.try_get("blocks_json").unwrap_or_else(|_| "[]".to_string());

    // Create the note
    let params = crate::notes::service::CreateNoteParams {
        title: if title.is_empty() { "Untitled".to_string() } else { title },
        icon: Some("📄".to_string()),
        tags: vec![],
        pinned: false,
    };

    let created = crate::notes::service::create_note_object(
        &db,
        &history,
        &search,
        cache.inner().as_ref(),
        params,
    )
    .await
    .map_err(|e| e.message)?;

    // Parse template blocks and create them in the new note
    if let Ok(blocks) = serde_json::from_str::<Vec<serde_json::Value>>(&blocks_json_str) {
        let now = chrono::Utc::now().timestamp_millis();
        for (pos_i, block_data) in blocks.iter().enumerate() {
            let pos = pos_i as i64;
            let block_type = block_data.get("type").and_then(|v| v.as_str()).unwrap_or("text");
            let content = block_data.get("content").cloned().unwrap_or(serde_json::json!({}));

            let block_id = uuid::Uuid::new_v4().to_string();
            let content_str = serde_json::to_string(&content).unwrap_or_else(|_| "{}".to_string());

            sqlx::query(
                "INSERT INTO blocks (id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, '{}', 0, '', ?, ?, ?)",
            )
            .bind(&block_id)
            .bind(&created.note.id)
            .bind(block_type)
            .bind(&content_str)
            .bind(pos)
            .bind(now)
            .bind(now)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;

            // Link child
            if pos == 0 {
                sqlx::query(
                    "INSERT INTO object_children (object_id, block_id, child_id, position) VALUES (?, ?, ?, ?)",
                )
                .bind(&created.note.id)
                .bind(&created.note.id)
                .bind(&block_id)
                .bind(pos)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())?;
            }

            if pos > 0 {
                let prev = sqlx::query(
                    "SELECT child_id FROM object_children WHERE object_id = ? AND block_id = ? ORDER BY position DESC LIMIT 1",
                )
                .bind(&created.note.id)
                .bind(&created.note.id)
                .fetch_optional(&db)
                .await
                .map_err(|e| e.to_string())?;

                if let Some(prev_row) = prev {
                    let prev_child: String = prev_row.try_get("child_id").map_err(|e| e.to_string())?;
                    sqlx::query(
                        "INSERT INTO object_children (object_id, block_id, child_id, position) VALUES (?, ?, ?, ?)",
                    )
                    .bind(&created.note.id)
                    .bind(&prev_child)
                    .bind(&block_id)
                    .bind(pos)
                    .execute(&db)
                    .await
                    .map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Return the created note
    crate::notes::service::get_note_full_cached(&db, cache.inner().as_ref(), &created.note.id)
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

/// List all tags with note counts, sorted by count descending.
#[tauri::command]
pub async fn notes_tags_list(
    state: State<'_, BentoAppState>,
) -> Result<Vec<serde_json::Value>, String> {
    use sqlx::Row;
    let db = db(&state);
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT j.value AS tag,
               COUNT(*) OVER (PARTITION BY j.value) AS count
        FROM note_objects,
             json_each(COALESCE(note_objects.tags, '[]')) AS j
        WHERE note_objects.is_archived = 0
        ORDER BY count DESC, tag ASC
        "#,
    )
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let tags: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "name": row.try_get::<String, _>("tag").unwrap_or_default(),
            "count": row.try_get::<i64, _>("count").unwrap_or(0),
        })
    }).collect();

    Ok(tags)
}

/// Rename a tag across all notes.
#[tauri::command]
pub async fn notes_tags_rename(
    state: State<'_, BentoAppState>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let db = db(&state);
    let notes = sqlx::query_as::<_, (String, String)>(
        "SELECT id, tags FROM note_objects WHERE is_archived = 0",
    )
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    for (note_id, tags_str) in notes {
        if let Ok(mut tags) = serde_json::from_str::<Vec<String>>(&tags_str) {
            if let Some(pos) = tags.iter().position(|t| t == &old_name) {
                tags[pos] = new_name.clone();
                let updated = serde_json::to_string(&tags).unwrap_or(tags_str);
                sqlx::query("UPDATE note_objects SET tags = ? WHERE id = ?")
                    .bind(&updated)
                    .bind(&note_id)
                    .execute(&db)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Delete a tag from all notes.
#[tauri::command]
pub async fn notes_tags_delete(
    state: State<'_, BentoAppState>,
    name: String,
) -> Result<(), String> {
    let db = db(&state);
    let notes = sqlx::query_as::<_, (String, String)>(
        "SELECT id, tags FROM note_objects WHERE is_archived = 0",
    )
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    for (note_id, tags_str) in notes {
        if let Ok(mut tags) = serde_json::from_str::<Vec<String>>(&tags_str) {
            tags.retain(|t| t != &name);
            let updated = serde_json::to_string(&tags).unwrap_or(tags_str);
            sqlx::query("UPDATE note_objects SET tags = ? WHERE id = ?")
                .bind(&updated)
                .bind(&note_id)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn notes_set_block_fields(
    state: State<'_, BentoAppState>,
    history: State<'_, Arc<HistoryRegistry>>,
    note_id: String,
    block_id: String,
    fields: serde_json::Value,
) -> Result<crate::local_store::block::BlockRow, String> {
    set_block_fields(&db(&state), &history, &note_id, &block_id, fields)
        .await
        .map_err(|e| e.message)
}
