// ═══════════════════════════════════════════════════════════════════════
// ANYTYPE BLOCK OPERATIONS — Rust transcription
// Source: src/ts/store/block.ts + src/ts/model/block.ts
// ═══════════════════════════════════════════════════════════════════════
// TRANSCRIPTION: MobX store methods → Rust async SQLite functions.
// Environment changes REQUIRED:
//   - MobX in-memory Map operations → SQL INSERT/UPDATE/DELETE
//   - MobX `set(block, param)` → partial JSON merge on content column
//   - MobX computed values → pure function return values
//   - React event system → Tauri IPC commands
//   - `S.Block.getLeaf()` → direct SQL SELECT
//   - `S.Block.set()` → SQL INSERT OR REPLACE
//   - `S.Block.delete()` → SQL DELETE + CASCADE handling
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};

use crate::util::time;
use serde_json::Value;
use sqlx::SqlitePool;
use uuid::Uuid;

use super::block::BlockRow;
use super::object::{ObjectRow, RelationRow};

// ─── OperationError ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationError {
    pub code: String,
    pub message: String,
}

impl OperationError {
    pub fn not_found(entity: &str, id: &str) -> Self {
        Self {
            code: "NOT_FOUND".into(),
            message: format!("{entity} not found: {id}"),
        }
    }

    pub fn invalid_content(detail: &str) -> Self {
        Self {
            code: "INVALID_CONTENT".into(),
            message: detail.into(),
        }
    }

    pub fn db_error(error: impl ToString) -> Self {
        Self {
            code: "DB_ERROR".into(),
            message: error.to_string(),
        }
    }
}

impl From<String> for OperationError {
    fn from(message: String) -> Self {
        Self {
            code: "OPERATION_FAILED".into(),
            message,
        }
    }
}

// ─── OperationResult ─────────────────────────────────────────────────

pub type OpResult<T> = Result<T, OperationError>;

// ─── BlockAdd params ─────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BlockAddParams {
    pub object_id: String,
    pub parent_id: Option<String>,
    pub r#type: String,
    pub content: Value,
    pub position: i32,
    pub fields: Option<Value>,
    pub align: Option<i32>,
    pub bg_color: Option<String>,
}

// ─── BlockUpdate params ──────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BlockUpdateParams {
    pub id: String,
    pub fields: Option<Value>,
    pub content: Option<Value>,
    pub align: Option<i32>,
    pub bg_color: Option<String>,
}

// ─── BlockMove params ────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BlockMoveParams {
    pub block_id: String,
    pub object_id: String,
    pub target_parent_id: Option<String>,
    pub position: i32,
}

// ─── BlockSplit params ───────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BlockSplitParams {
    pub block_id: String,
    pub object_id: String,
    pub split_range: (i32, i32), // (from, to) where to split the text
}

// ─── BlockMerge params ───────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BlockMergeParams {
    pub source_id: String, // block being merged (the one that will be deleted)
    pub target_id: String, // block being merged into
    pub object_id: String, // owning object
    pub merge_text: Option<String>, // text to append to target
}

// ─── BlockAddResult ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockAddResult {
    pub created_id: String,
    pub block: BlockRow,
}

// ─── BlockSplitResult ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockSplitResult {
    pub original_block: BlockRow,
    pub new_block: BlockRow,
}

// ─── BlockMergeResult ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockMergeResult {
    pub target_block: BlockRow,
    pub merged: bool,
}

// ═══════════════════════════════════════════════════════════════════════
// OPERATIONS
// ═══════════════════════════════════════════════════════════════════════

/// Inserts a new block into the blocks table.
/// Source: store/block.ts — add(rootId, block)
pub async fn block_add(db: &SqlitePool, params: BlockAddParams) -> OpResult<BlockAddResult> {
    let block_id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    let content_str = serde_json::to_string(&params.content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;
    let fields_str = params
        .fields
        .map(|f| serde_json::to_string(&f).unwrap_or_else(|_| "{}".into()))
        .unwrap_or_else(|| "{}".into());

    let parent = params.parent_id.clone();

    sqlx::query(
        r#"
        INSERT INTO blocks (id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&block_id)
    .bind(&params.object_id)
    .bind(parent)
    .bind(&params.r#type)
    .bind(&content_str)
    .bind(&fields_str)
    .bind(params.align.unwrap_or(0))
    .bind(params.bg_color.as_deref().unwrap_or(""))
    .bind(params.position)
    .bind(now)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    // Update the object's updated_at timestamp
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&params.object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    let row = get_block_by_id(db, &block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &block_id))?;

    Ok(BlockAddResult {
        created_id: block_id,
        block: row,
    })
}

/// Updates an existing block's fields.
/// Source: store/block.ts — update(rootId, blockId, param)
pub async fn block_update(db: &SqlitePool, params: BlockUpdateParams) -> OpResult<BlockRow> {
    let now = time::now_ms();

    let existing = get_block_by_id(db, &params.id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.id))?;

    // Merge fields JSON
    let merged_fields = if let Some(new_fields) = params.fields {
        merge_json(&existing.fields, &new_fields)
    } else {
        existing.fields.clone()
    };

    // Merge content JSON
    let merged_content = if let Some(new_content) = params.content {
        merge_json(&existing.content, &new_content)
    } else {
        existing.content.clone()
    };

    let align = params.align.unwrap_or(existing.align);
    let bg_color = params.bg_color.as_deref().unwrap_or(&existing.bg_color);

    sqlx::query(
        r#"
        UPDATE blocks
        SET content = ?, fields = ?, align = ?, bg_color = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&merged_content)
    .bind(&merged_fields)
    .bind(align)
    .bind(bg_color)
    .bind(now)
    .bind(&params.id)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    // Update the object's updated_at
    sqlx::query(
        "UPDATE objects SET updated_at = ? WHERE id = (SELECT object_id FROM blocks WHERE id = ?)",
    )
    .bind(now)
    .bind(&params.id)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    get_block_by_id(db, &params.id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.id))
}

/// Deletes a block from the blocks table.
/// Source: store/block.ts — delete(rootId, id)
pub async fn block_delete(db: &SqlitePool, block_id: &str, object_id: &str) -> OpResult<()> {
    let existing = get_block_by_id(db, block_id).await?;
    if existing.is_none() {
        return Err(OperationError::not_found("Block", block_id));
    }

    let now = time::now_ms();

    // Delete children first (iterative)
    delete_block_tree(db, block_id).await?;

    // Update object timestamp
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    Ok(())
}

/// Moves a block to a new parent and position.
/// Source: store/block.ts — updateStructure + S.Block.set()
pub async fn block_move(db: &SqlitePool, params: BlockMoveParams) -> OpResult<BlockRow> {
    let now = time::now_ms();

    get_block_by_id(db, &params.block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.block_id))?;

    sqlx::query(
        r#"
        UPDATE blocks
        SET parent_id = ?, position = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&params.target_parent_id)
    .bind(params.position)
    .bind(now)
    .bind(&params.block_id)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    // Re-index positions of siblings
    reindex_positions(db, &params.object_id, params.target_parent_id.as_deref()).await?;

    // Update object timestamp
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&params.object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    get_block_by_id(db, &params.block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.block_id))
}

/// Splits a text block into two blocks at the given range.
/// Source: model/block.ts — blockSplit behavior (Enter keypress)
pub async fn block_split(db: &SqlitePool, params: BlockSplitParams) -> OpResult<BlockSplitResult> {
    let block = get_block_by_id(db, &params.block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.block_id))?;

    if block.r#type != "text" {
        return Err(OperationError::invalid_content(
            "Only text blocks can be split",
        ));
    }

    // Parse the text content
    let content_value: Value = serde_json::from_str(&block.content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;

    let text = content_value["text"].as_str().unwrap_or("");
    let (from, _to) = params.split_range;

    if from as usize > text.len() {
        return Err(OperationError::invalid_content(
            "Split position is beyond text length",
        ));
    }

    // Split text: left part stays in original, right part goes to new block
    let left_text = &text[..from as usize];
    let right_text = &text[from as usize..];

    let now = time::now_ms();
    let new_id = Uuid::new_v4().to_string();

    // Update original block's text (left part)
    let mut left_content = content_value.clone();
    left_content["text"] = Value::String(left_text.to_string());
    // Keep marks only in the left range
    if let Some(marks) = left_content["marks"].as_array() {
        let filtered_marks: Vec<Value> = marks
            .iter()
            .filter(|m| {
                let range_to = m["range"]["to"].as_i64().unwrap_or(0);
                range_to <= from as i64
            })
            .cloned()
            .collect();
        left_content["marks"] = Value::Array(filtered_marks);
    }

    let left_content_str = serde_json::to_string(&left_content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;

    sqlx::query("UPDATE blocks SET content = ?, updated_at = ? WHERE id = ?")
        .bind(&left_content_str)
        .bind(now)
        .bind(&params.block_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    // Create new block with right part of text
    let mut right_content = content_value.clone();
    right_content["text"] = Value::String(right_text.to_string());
    // Copy marks with adjusted range
    if let Some(marks) = right_content["marks"].as_array() {
        let adjusted_marks: Vec<Value> = marks
            .iter()
            .filter_map(|m| {
                let range_from = m["range"]["from"].as_i64().unwrap_or(0);
                let range_to = m["range"]["to"].as_i64().unwrap_or(0);
                if range_to > from as i64 {
                    let mut adjusted = m.clone();
                    let new_from = (range_from - from as i64).max(0);
                    let new_to = range_to - from as i64;
                    adjusted["range"]["from"] = Value::Number(serde_json::Number::from(new_from));
                    adjusted["range"]["to"] = Value::Number(serde_json::Number::from(new_to));
                    Some(adjusted)
                } else {
                    None
                }
            })
            .collect();
        right_content["marks"] = Value::Array(adjusted_marks);
    }

    let right_content_str = serde_json::to_string(&right_content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;

    let parent_id = block.parent_id.clone();
    let new_position = block.position + 1;

    // Shift existing blocks at this position or later
    sqlx::query(
        "UPDATE blocks SET position = position + 1 WHERE object_id = ? AND position >= ? AND id != ?",
    )
    .bind(&block.object_id)
    .bind(new_position)
    .bind(&params.block_id)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    sqlx::query(
        r#"
        INSERT INTO blocks (id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&new_id)
    .bind(&block.object_id)
    .bind(parent_id)
    .bind("text")
    .bind(&right_content_str)
    .bind("{}")
    .bind(0)
    .bind("")
    .bind(new_position)
    .bind(now)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    // Update object timestamp
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&block.object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    let original = get_block_by_id(db, &params.block_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.block_id))?;
    let new_block = get_block_by_id(db, &new_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &new_id))?;

    Ok(BlockSplitResult {
        original_block: original,
        new_block,
    })
}

/// Merges two adjacent text blocks.
/// Source: model/block.ts — blockMerge behavior (Backspace at start of block)
pub async fn block_merge(db: &SqlitePool, params: BlockMergeParams) -> OpResult<BlockMergeResult> {
    let source = get_block_by_id(db, &params.source_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.source_id))?;
    let target = get_block_by_id(db, &params.target_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.target_id))?;

    if source.r#type != "text" || target.r#type != "text" {
        return Err(OperationError::invalid_content(
            "Only text blocks can be merged",
        ));
    }

    let now = time::now_ms();

    // Parse content JSON for both blocks
    let mut target_content: Value = serde_json::from_str(&target.content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;
    let source_content: Value = serde_json::from_str(&source.content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;

    // Merge text: append source text to target
    let target_text = target_content["text"].as_str().unwrap_or("").to_string();
    let source_text = source_content["text"].as_str().unwrap_or("").to_string();
    let target_len = target_text.len() as i64;
    let merged_text = if let Some(append_text) = &params.merge_text {
        format!("{}{}", target_text, append_text)
    } else {
        format!("{}{}", target_text, source_text)
    };
    target_content["text"] = Value::String(merged_text);

    // Merge marks: offset source marks by target text length
    if let Some(source_marks) = source_content["marks"].as_array() {
        let mut merged_marks: Vec<Value> = target_content["marks"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        for mark in source_marks {
            let mut adjusted = mark.clone();
            if let (Some(from), Some(to)) = (
                adjusted["range"]["from"].as_i64(),
                adjusted["range"]["to"].as_i64(),
            ) {
                adjusted["range"]["from"] =
                    Value::Number(serde_json::Number::from(from + target_len));
                adjusted["range"]["to"] = Value::Number(serde_json::Number::from(to + target_len));
            }
            merged_marks.push(adjusted);
        }
        target_content["marks"] = Value::Array(merged_marks);
    }

    let target_content_str = serde_json::to_string(&target_content)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;

    // Update target block with merged content
    sqlx::query("UPDATE blocks SET content = ?, updated_at = ? WHERE id = ?")
        .bind(&target_content_str)
        .bind(now)
        .bind(&params.target_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    // Delete the source block (and its children)
    delete_block_tree(db, &params.source_id).await?;

    // Update object timestamp
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&params.object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    let target_block = get_block_by_id(db, &params.target_id)
        .await?
        .ok_or_else(|| OperationError::not_found("Block", &params.target_id))?;

    Ok(BlockMergeResult {
        target_block,
        merged: true,
    })
}

// ─── Query helpers ───────────────────────────────────────────────────

/// Fetches a single block by ID from the database.
/// Source: store/block.ts — getLeaf(rootId, id)
pub async fn get_block_by_id(db: &SqlitePool, block_id: &str) -> OpResult<Option<BlockRow>> {
    let row = sqlx::query_as::<_, BlockRow>(
        "SELECT id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at FROM blocks WHERE id = ?",
    )
    .bind(block_id)
    .fetch_optional(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    Ok(row)
}

/// Fetches all blocks for a given object, ordered by position.
/// Source: store/block.ts — getBlocks(rootId)
pub async fn get_blocks_by_object(db: &SqlitePool, object_id: &str) -> OpResult<Vec<BlockRow>> {
    let rows = sqlx::query_as::<_, BlockRow>(
        "SELECT id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at FROM blocks WHERE object_id = ? ORDER BY position ASC",
    )
    .bind(object_id)
    .fetch_all(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    Ok(rows)
}

/// Fetches child blocks for a given parent, ordered by position.
/// Source: store/block.ts — getChildren(rootId, blockId)
pub async fn get_block_children(
    db: &SqlitePool,
    object_id: &str,
    parent_id: &str,
) -> OpResult<Vec<BlockRow>> {
    let rows = sqlx::query_as::<_, BlockRow>(
        "SELECT id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at FROM blocks WHERE object_id = ? AND parent_id = ? ORDER BY position ASC",
    )
    .bind(object_id)
    .bind(parent_id)
    .fetch_all(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    Ok(rows)
}

/// Gets the next block in tree order (depth-first).
/// Source: store/block.ts — getNextBlock(rootId, id, dir)
pub async fn get_next_block(
    db: &SqlitePool,
    object_id: &str,
    block_id: &str,
    direction: i32,
) -> OpResult<Option<BlockRow>> {
    if direction > 0 {
        get_next_block_forward(db, object_id, block_id).await
    } else {
        get_prev_block_backward(db, object_id, block_id).await
    }
}

async fn get_next_block_forward(
    db: &SqlitePool,
    object_id: &str,
    block_id: &str,
) -> OpResult<Option<BlockRow>> {
    // Try children first
    let children = get_block_children(db, object_id, block_id).await?;
    if let Some(child) = children.first() {
        return Ok(Some(child.clone()));
    }

    // No children — find next sibling or ancestor's sibling
    get_next_sibling_or_ancestor(db, object_id, block_id).await
}

async fn get_next_sibling_or_ancestor(
    db: &SqlitePool,
    object_id: &str,
    block_id: &str,
) -> OpResult<Option<BlockRow>> {
    let block = get_block_by_id(db, block_id).await?;
    let block = match block {
        Some(b) => b,
        None => return Ok(None),
    };

    if let Some(parent_id) = &block.parent_id {
        let siblings = get_block_children(db, object_id, parent_id).await?;
        let idx = siblings.iter().position(|b| b.id == block_id);

        if let Some(i) = idx {
            if i + 1 < siblings.len() {
                return Ok(Some(siblings[i + 1].clone()));
            }
        }

        // No next sibling — check parent's next sibling
        return Box::pin(get_next_sibling_or_ancestor(db, object_id, parent_id)).await;
    }

    Ok(None)
}

async fn get_prev_block_backward(
    db: &SqlitePool,
    object_id: &str,
    block_id: &str,
) -> OpResult<Option<BlockRow>> {
    let block = get_block_by_id(db, block_id).await?;
    let block = match block {
        Some(b) => b,
        None => return Ok(None),
    };

    if let Some(parent_id) = &block.parent_id {
        let siblings = get_block_children(db, object_id, parent_id).await?;
        let idx = siblings.iter().position(|b| b.id == block_id);

        if let Some(i) = idx {
            if i > 0 {
                // Get last descendant of previous sibling
                return get_last_descendant(db, object_id, &siblings[i - 1].id).await;
            }
        }

        // No previous sibling — return parent
        let parent = get_block_by_id(db, parent_id).await?;
        return Ok(parent);
    }

    Ok(None)
}

async fn get_last_descendant(
    db: &SqlitePool,
    object_id: &str,
    block_id: &str,
) -> OpResult<Option<BlockRow>> {
    let children = get_block_children(db, object_id, block_id).await?;
    if let Some(last_child) = children.last() {
        return Box::pin(get_last_descendant(db, object_id, &last_child.id)).await;
    }
    get_block_by_id(db, block_id).await
}

// ─── Internal helpers ────────────────────────────────────────────────

/// Iteratively deletes a block and all of its descendants.
/// Uses explicit stack instead of recursion to avoid stack overflow on deep nesting.
async fn delete_block_tree(db: &SqlitePool, root_id: &str) -> OpResult<()> {
    let mut stack = vec![root_id.to_string()];
    let mut ordered: Vec<String> = Vec::new();

    // Phase 1: collect all descendants in pre-order using a stack (DFS)
    while let Some(id) = stack.pop() {
        ordered.push(id.clone());

        let children = sqlx::query_as::<_, BlockRow>(
            "SELECT id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at FROM blocks WHERE parent_id = ?",
        )
        .bind(&id)
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

        for child in &children {
            stack.push(child.id.clone());
        }
    }

    // Phase 2: delete in reverse order (children before parents)
    for block_id in ordered.iter().rev() {
        // Delete marks for this block
        sqlx::query("DELETE FROM marks WHERE block_id = ?")
            .bind(block_id)
            .execute(db)
            .await
            .map_err(|e| OperationError::db_error(e))?;

        // Delete from object_children
        sqlx::query("DELETE FROM object_children WHERE block_id = ? OR child_id = ?")
            .bind(block_id)
            .bind(block_id)
            .execute(db)
            .await
            .map_err(|e| OperationError::db_error(e))?;

        // Delete the block itself
        sqlx::query("DELETE FROM blocks WHERE id = ?")
            .bind(block_id)
            .execute(db)
            .await
            .map_err(|e| OperationError::db_error(e))?;
    }

    Ok(())
}

/// Re-orders the position values for all children of a given parent.
async fn reindex_positions(
    db: &SqlitePool,
    object_id: &str,
    parent_id: Option<&str>,
) -> OpResult<()> {
    let children = if let Some(parent_id) = parent_id {
        sqlx::query_as::<_, BlockRow>(
            "SELECT id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at FROM blocks WHERE object_id = ? AND parent_id = ? ORDER BY position ASC, created_at ASC",
        )
        .bind(object_id)
        .bind(parent_id)
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))?
    } else {
        sqlx::query_as::<_, BlockRow>(
            "SELECT id, object_id, parent_id, type, content, fields, align, bg_color, position, created_at, updated_at FROM blocks WHERE object_id = ? AND parent_id IS NULL ORDER BY position ASC, created_at ASC",
        )
        .bind(object_id)
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))?
    };

    for (i, child) in children.iter().enumerate() {
        let new_pos = i as i32;
        if child.position != new_pos {
            sqlx::query("UPDATE blocks SET position = ? WHERE id = ?")
                .bind(new_pos)
                .bind(&child.id)
                .execute(db)
                .await
                .map_err(|e| OperationError::db_error(e))?;
        }
    }

    Ok(())
}

/// Deep-merges a JSON update into a JSON string, returning the new JSON string.
fn merge_json(existing: &str, update: &Value) -> String {
    let mut base: Value =
        serde_json::from_str(existing).unwrap_or(Value::Object(Default::default()));
    merge_values(&mut base, update);
    serde_json::to_string(&base).unwrap_or_else(|_| "{}".into())
}

fn merge_values(base: &mut Value, update: &Value) {
    match (base, update) {
        (Value::Object(base_map), Value::Object(update_map)) => {
            for (key, value) in update_map {
                if value.is_null() {
                    base_map.remove(key);
                } else if base_map.contains_key(key) {
                    merge_values(&mut base_map[key], value);
                } else {
                    base_map.insert(key.clone(), value.clone());
                }
            }
        }
        (base, update) => {
            *base = update.clone();
        }
    }
}

// ─── Object operations ──────────────────────────────────────────────

/// Creates a new object in the objects table (if it doesn't already exist).
pub async fn create_object(db: &SqlitePool, object_id: &str, object_type: &str) -> OpResult<()> {
    let now = time::now_ms();
    sqlx::query(
        "INSERT OR IGNORE INTO objects (id, type, layout, name, icon, cover, is_archived, is_deleted, space_id, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?, ?)",
    )
    .bind(object_id)
    .bind(object_type)
    .bind(object_type)
    .bind("Untitled")
    .bind(Option::<&str>::None)
    .bind(Option::<&str>::None)
    .bind("{}")
    .bind(now)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;
    Ok(())
}

/// Fetches a single object by ID.
pub async fn get_object(db: &SqlitePool, object_id: &str) -> OpResult<ObjectRow> {
    sqlx::query_as::<_, ObjectRow>(
        "SELECT id, type, layout, name, icon, cover, is_archived, is_deleted, created_at, updated_at, space_id, details FROM objects WHERE id = ?",
    )
    .bind(object_id)
    .fetch_optional(db)
    .await
    .map_err(|e| OperationError::db_error(e))?
    .ok_or_else(|| OperationError::not_found("Object", object_id))
}

/// Fetches all objects matching optional type/layout filters with pagination.
pub async fn get_objects(
    db: &SqlitePool,
    type_filter: Option<&str>,
    layout_filter: Option<&str>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> OpResult<Vec<ObjectRow>> {
    let mut sql = String::from(
        "SELECT id, type, layout, name, icon, cover, is_archived, is_deleted, created_at, updated_at, space_id, details FROM objects WHERE is_deleted = 0",
    );
    let mut params: Vec<String> = vec![];

    if let Some(t) = type_filter {
        params.push(t.to_string());
        sql.push_str(&format!(" AND type = ?{}", params.len()));
    }
    if let Some(l) = layout_filter {
        params.push(l.to_string());
        sql.push_str(&format!(" AND layout = ?{}", params.len()));
    }

    let limit_val = limit.unwrap_or(100);
    let offset_val = offset.unwrap_or(0);

    sql.push_str(" ORDER BY updated_at DESC LIMIT ? OFFSET ?");

    let mut query = sqlx::query_as::<_, ObjectRow>(&sql);
    for p in &params {
        query = query.bind(p);
    }
    query = query.bind(limit_val).bind(offset_val);

    query
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateObjectParams {
    pub id: String,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub cover: Option<String>,
    pub is_archived: Option<bool>,
    pub is_deleted: Option<bool>,
    pub details: Option<Value>,
    pub layout: Option<String>,
    pub r#type: Option<String>,
}

// Note: UpdateObjectParams is defined with its own #[derive] higher up

/// Updates an object's properties.
pub async fn update_object(db: &SqlitePool, params: UpdateObjectParams) -> OpResult<ObjectRow> {
    let now = time::now_ms();
    let existing = get_object(db, &params.id).await?;

    let name = params
        .name
        .unwrap_or_else(|| existing.name.unwrap_or_default());
    let icon = params.icon.or(existing.icon);
    let cover = params.cover.or(existing.cover);
    let is_archived = params.is_archived.unwrap_or(existing.is_archived);
    let is_deleted = params.is_deleted.unwrap_or(existing.is_deleted);
    let layout = params.layout.unwrap_or(existing.layout);
    let r#type = params.r#type.unwrap_or(existing.r#type);

    let details = if let Some(new_details) = params.details {
        let mut current: Value =
            serde_json::from_str(&existing.details).unwrap_or(Value::Object(Default::default()));
        merge_values(&mut current, &new_details);
        serde_json::to_string(&current)
            .map_err(|e| OperationError::invalid_content(&e.to_string()))?
    } else {
        existing.details.clone()
    };

    sqlx::query(
        "UPDATE objects SET name = ?, icon = ?, cover = ?, is_archived = ?, is_deleted = ?, layout = ?, type = ?, details = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(icon.as_deref())
    .bind(cover.as_deref())
    .bind(is_archived)
    .bind(is_deleted)
    .bind(&layout)
    .bind(&r#type)
    .bind(&details)
    .bind(now)
    .bind(&params.id)
    .execute(db)
    .await
    .map_err(|e| OperationError::db_error(e))?;

    get_object(db, &params.id).await
}

/// Soft-deletes an object by setting is_deleted = 1.
pub async fn delete_object(db: &SqlitePool, object_id: &str) -> OpResult<()> {
    let now = time::now_ms();
    sqlx::query("UPDATE objects SET is_deleted = 1, updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;
    Ok(())
}

/// Search objects by name with optional type/layout filters.
pub async fn search_objects(
    db: &SqlitePool,
    query: &str,
    type_filter: Option<&str>,
    layout_filter: Option<&str>,
    limit: Option<i64>,
) -> OpResult<Vec<ObjectRow>> {
    let pattern = format!("%{}%", query);
    let limit_val = limit.unwrap_or(50);

    let mut sql = String::from(
        "SELECT id, type, layout, name, icon, cover, is_archived, is_deleted, created_at, updated_at, space_id, details FROM objects WHERE is_deleted = 0 AND name LIKE ?1",
    );
    let mut param_idx = 1;

    if type_filter.is_some() {
        param_idx += 1;
        sql.push_str(&format!(" AND type = ?{param_idx}"));
    }
    if layout_filter.is_some() {
        param_idx += 1;
        sql.push_str(&format!(" AND layout = ?{param_idx}"));
    }

    param_idx += 1;
    sql.push_str(&format!(" ORDER BY updated_at DESC LIMIT ?{param_idx}"));

    let mut query = sqlx::query_as::<_, ObjectRow>(&sql).bind(&pattern);
    if let Some(t) = type_filter {
        query = query.bind(t);
    }
    if let Some(l) = layout_filter {
        query = query.bind(l);
    }
    query = query.bind(limit_val);

    query
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))
}

/// Gets recently updated objects for a given type, limited to n results.
pub async fn get_recent_objects(
    db: &SqlitePool,
    type_filter: Option<&str>,
    layout_filter: Option<&str>,
    limit: Option<i64>,
) -> OpResult<Vec<ObjectRow>> {
    get_objects(db, type_filter, layout_filter, Some(0), limit).await
}

/// Gets objects marked as favorite in their details JSON.
pub async fn get_favorite_objects(
    db: &SqlitePool,
    type_filter: Option<&str>,
    layout_filter: Option<&str>,
) -> OpResult<Vec<ObjectRow>> {
    let mut sql = String::from(
        "SELECT id, type, layout, name, icon, cover, is_archived, is_deleted, created_at, updated_at, space_id, details FROM objects WHERE is_deleted = 0 AND json_extract(details, '$.is_favorite') = 1",
    );
    let mut params: Vec<String> = vec![];

    if let Some(t) = type_filter {
        params.push(t.to_string());
        sql.push_str(&format!(" AND type = ?{}", params.len()));
    }
    if let Some(l) = layout_filter {
        params.push(l.to_string());
        sql.push_str(&format!(" AND layout = ?{}", params.len()));
    }

    sql.push_str(" ORDER BY updated_at DESC");

    let mut query = sqlx::query_as::<_, ObjectRow>(&sql);
    for p in &params {
        query = query.bind(p);
    }

    query
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))
}

/// Toggles the `is_favorite` flag in an object's details.
pub async fn toggle_object_favorite(db: &SqlitePool, object_id: &str) -> OpResult<ObjectRow> {
    let existing = get_object(db, object_id).await?;
    let mut details: Value =
        serde_json::from_str(&existing.details).unwrap_or(Value::Object(Default::default()));

    let is_fav = details["is_favorite"].as_bool().unwrap_or(false);
    details["is_favorite"] = Value::Bool(!is_fav);

    let details_str = serde_json::to_string(&details)
        .map_err(|e| OperationError::invalid_content(&e.to_string()))?;
    let now = time::now_ms();

    sqlx::query("UPDATE objects SET details = ?, updated_at = ? WHERE id = ?")
        .bind(&details_str)
        .bind(now)
        .bind(object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    get_object(db, object_id).await
}

// ─── Relation operations ────────────────────────────────────────────

/// Sets a relation value on an object (inserts or replaces).
pub async fn set_relation(
    db: &SqlitePool,
    object_id: &str,
    key: &str,
    value: &str,
) -> OpResult<RelationRow> {
    let rel_id = uuid::Uuid::new_v4().to_string();

    sqlx::query("INSERT OR REPLACE INTO relations (id, object_id, key, value) VALUES (?, ?, ?, ?)")
        .bind(&rel_id)
        .bind(object_id)
        .bind(key)
        .bind(value)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    let row = sqlx::query_as::<_, RelationRow>(
        "SELECT id, object_id, key, value FROM relations WHERE object_id = ? AND key = ?",
    )
    .bind(object_id)
    .bind(key)
    .fetch_optional(db)
    .await
    .map_err(|e| OperationError::db_error(e))?
    .ok_or_else(|| OperationError::not_found("Relation", &format!("{}/{}", object_id, key)))?;

    // Also update object updated_at
    let now = time::now_ms();
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    Ok(row)
}

/// Gets all relations for an object.
pub async fn get_relations(db: &SqlitePool, object_id: &str) -> OpResult<Vec<RelationRow>> {
    sqlx::query_as::<_, RelationRow>(
        "SELECT id, object_id, key, value FROM relations WHERE object_id = ?",
    )
    .bind(object_id)
    .fetch_all(db)
    .await
    .map_err(|e| OperationError::db_error(e))
}

/// Gets objects that have a relation with a specific key and value.
pub async fn get_objects_by_relation(
    db: &SqlitePool,
    key: &str,
    value: &str,
    type_filter: Option<&str>,
    layout_filter: Option<&str>,
) -> OpResult<Vec<ObjectRow>> {
    let mut sql = String::from(
        "SELECT o.id, o.type, o.layout, o.name, o.icon, o.cover, o.is_archived, o.is_deleted, o.created_at, o.updated_at, o.space_id, o.details FROM objects o INNER JOIN relations r ON o.id = r.object_id WHERE o.is_deleted = 0 AND r.key = ?1 AND r.value = ?2",
    );
    let mut params: Vec<String> = vec![];
    let mut _next_param = 3; // ?1 and ?2 are key and value

    if let Some(t) = type_filter {
        sql.push_str(&format!(" AND o.type = ?{_next_param}"));
        params.push(t.to_string());
        _next_param += 1;
    }
    if let Some(l) = layout_filter {
        sql.push_str(&format!(" AND o.layout = ?{_next_param}"));
        params.push(l.to_string());
        _next_param += 1;
    }

    sql.push_str(" ORDER BY o.updated_at DESC");

    let mut query = sqlx::query_as::<_, ObjectRow>(&sql).bind(key).bind(value);
    for p in &params {
        query = query.bind(p);
    }

    query
        .fetch_all(db)
        .await
        .map_err(|e| OperationError::db_error(e))
}

/// Deletes a relation from an object.
pub async fn delete_relation(db: &SqlitePool, object_id: &str, key: &str) -> OpResult<()> {
    sqlx::query("DELETE FROM relations WHERE object_id = ? AND key = ?")
        .bind(object_id)
        .bind(key)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    let now = time::now_ms();
    sqlx::query("UPDATE objects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(object_id)
        .execute(db)
        .await
        .map_err(|e| OperationError::db_error(e))?;

    Ok(())
}

// ─── Tauri command wrappers ─────────────────────────────────────────

#[tauri::command]
pub async fn local_store_block_add(
    db: tauri::State<'_, crate::db::BentoAppState>,
    params: BlockAddParams,
) -> Result<BlockAddResult, String> {
    let pool = db.db();
    block_add(&pool, params).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_block_update(
    db: tauri::State<'_, crate::db::BentoAppState>,
    params: BlockUpdateParams,
) -> Result<BlockRow, String> {
    let pool = db.db();
    block_update(&pool, params).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_block_delete(
    db: tauri::State<'_, crate::db::BentoAppState>,
    block_id: String,
    object_id: String,
) -> Result<(), String> {
    let pool = db.db();
    block_delete(&pool, &block_id, &object_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_block_move(
    db: tauri::State<'_, crate::db::BentoAppState>,
    params: BlockMoveParams,
) -> Result<BlockRow, String> {
    let pool = db.db();
    block_move(&pool, params).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_block_split(
    db: tauri::State<'_, crate::db::BentoAppState>,
    params: BlockSplitParams,
) -> Result<BlockSplitResult, String> {
    let pool = db.db();
    block_split(&pool, params).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_block_merge(
    db: tauri::State<'_, crate::db::BentoAppState>,
    params: BlockMergeParams,
) -> Result<BlockMergeResult, String> {
    let pool = db.db();
    block_merge(&pool, params).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_blocks(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
) -> Result<Vec<BlockRow>, String> {
    let pool = db.db();
    get_blocks_by_object(&pool, &object_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_block_children(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
    parent_id: String,
) -> Result<Vec<BlockRow>, String> {
    let pool = db.db();
    get_block_children(&pool, &object_id, &parent_id)
        .await
        .map_err(|e| e.message)
}

// ─── Object Tauri command wrappers ──────────────────────────────────

#[tauri::command]
pub async fn local_store_create_object(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
    object_type: String,
) -> Result<(), String> {
    let pool = db.db();
    create_object(&pool, &object_id, &object_type)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_object(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
) -> Result<ObjectRow, String> {
    let pool = db.db();
    get_object(&pool, &object_id).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_objects(
    db: tauri::State<'_, crate::db::BentoAppState>,
    type_filter: Option<String>,
    layout_filter: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<ObjectRow>, String> {
    let pool = db.db();
    get_objects(
        &pool,
        type_filter.as_deref(),
        layout_filter.as_deref(),
        offset,
        limit,
    )
    .await
    .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_update_object(
    db: tauri::State<'_, crate::db::BentoAppState>,
    params: UpdateObjectParams,
) -> Result<ObjectRow, String> {
    let pool = db.db();
    update_object(&pool, params).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_delete_object(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
) -> Result<(), String> {
    let pool = db.db();
    delete_object(&pool, &object_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_search_objects(
    db: tauri::State<'_, crate::db::BentoAppState>,
    query: String,
    type_filter: Option<String>,
    layout_filter: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ObjectRow>, String> {
    let pool = db.db();
    search_objects(
        &pool,
        &query,
        type_filter.as_deref(),
        layout_filter.as_deref(),
        limit,
    )
    .await
    .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_recent_objects(
    db: tauri::State<'_, crate::db::BentoAppState>,
    type_filter: Option<String>,
    layout_filter: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ObjectRow>, String> {
    let pool = db.db();
    get_recent_objects(
        &pool,
        type_filter.as_deref(),
        layout_filter.as_deref(),
        limit,
    )
    .await
    .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_favorite_objects(
    db: tauri::State<'_, crate::db::BentoAppState>,
    type_filter: Option<String>,
    layout_filter: Option<String>,
) -> Result<Vec<ObjectRow>, String> {
    let pool = db.db();
    get_favorite_objects(&pool, type_filter.as_deref(), layout_filter.as_deref())
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_toggle_favorite(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
) -> Result<ObjectRow, String> {
    let pool = db.db();
    toggle_object_favorite(&pool, &object_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_set_relation(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
    key: String,
    value: String,
) -> Result<RelationRow, String> {
    let pool = db.db();
    set_relation(&pool, &object_id, &key, &value)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_relations(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
) -> Result<Vec<RelationRow>, String> {
    let pool = db.db();
    get_relations(&pool, &object_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_get_objects_by_relation(
    db: tauri::State<'_, crate::db::BentoAppState>,
    key: String,
    value: String,
    type_filter: Option<String>,
    layout_filter: Option<String>,
) -> Result<Vec<ObjectRow>, String> {
    let pool = db.db();
    get_objects_by_relation(
        &pool,
        &key,
        &value,
        type_filter.as_deref(),
        layout_filter.as_deref(),
    )
    .await
    .map_err(|e| e.message)
}

#[tauri::command]
pub async fn local_store_delete_relation(
    db: tauri::State<'_, crate::db::BentoAppState>,
    object_id: String,
    key: String,
) -> Result<(), String> {
    let pool = db.db();
    delete_relation(&pool, &object_id, &key)
        .await
        .map_err(|e| e.message)
}
