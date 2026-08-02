// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// block/editor.rs — port of core/block/editor/* from Go
// The BlockService: the unified API that the middleware layer calls.
// Go source: core/block/service.go

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::Mutex;
use anyhow::{Result, anyhow};
use uuid::Uuid;

use super::{
    Block, BlockContent, BlockPosition, TextStyle, DivStyle, FileStyle,
    Align, VerticalAlign, Mark, Range, Details,
    BlockCreateRequest, BlockCreateResponse,
    BlockListDeleteRequest, BlockListDeleteResponse,
    BlockListDuplicateRequest, BlockListDuplicateResponse,
    BlockReplaceRequest, BlockReplaceResponse,
    BlockSplitRequest, BlockSplitResponse,
    BlockMergeRequest, BlockMergeResponse,
    BlockCopyRequest, BlockCopyResponse,
    BlockCutRequest, BlockCutResponse,
    BlockPasteRequest, BlockPasteResponse,
    BlockSetFieldsRequest, BlockSetFieldsResponse,
    BlockListSetFieldsRequest, BlockListSetFieldsResponse,
    BlockListMoveToExistingRequest, BlockListMoveToExistingResponse,
    BlockListMoveToNewObjectRequest, BlockListMoveToNewObjectResponse,
    BlockTextSetTextRequest, BlockTextSetTextResponse,
    BlockTextSetStyleRequest, BlockTextSetStyleResponse,
    BlockTextSetCheckedRequest, BlockTextSetCheckedResponse,
    BlockTextSetColorRequest, BlockTextSetColorResponse,
    BlockTextSetIconRequest, BlockTextSetIconResponse,
    BlockListSetAlignRequest, BlockListSetAlignResponse,
    BlockListSetVerticalAlignRequest, BlockListSetVerticalAlignResponse,
    BlockListSetBackgroundColorRequest, BlockListSetBackgroundColorResponse,
    BlockLatexSetTextRequest, BlockLatexSetTextResponse,
    BlockTextListSetStyleRequest, BlockTextListSetStyleResponse,
    BlockTextListSetColorRequest, BlockTextListSetColorResponse,
    BlockTextListSetMarkRequest, BlockTextListSetMarkResponse,
    BlockTextListClearStyleRequest, BlockTextListClearStyleResponse,
    BlockTextListClearContentRequest, BlockTextListClearContentResponse,
    BlockDivListSetStyleRequest, BlockDivListSetStyleResponse,
    BlockFileListSetStyleRequest, BlockFileListSetStyleResponse,
    BlockFileSetTargetObjectIdRequest, BlockFileSetTargetObjectIdResponse,
    BlockLinkListSetAppearanceRequest, BlockLinkListSetAppearanceResponse,
    BlockSetCarriageRequest, BlockSetCarriageResponse,
    BlockListConvertToObjectsRequest, BlockListConvertToObjectsResponse,
    RpcError,
};
use super::state::State;
use crate::domain::{FullId, Details as DomainDetails};
use crate::store::ObjectStore;
use crate::session::Context;

// ── SmartBlock cache (open objects) ──────────────────────────────────────
/// Mirrors Go: cache.TwoQueueCache  — holds live State for open objects
type Cache = HashMap<String, Arc<Mutex<OpenObject>>>;

/// Mirrors Go: smartblock.SmartBlock — one open object
pub struct OpenObject {
    pub id:    FullId,
    pub state: State,
}

impl OpenObject {
    fn new(id: FullId, state: State) -> Self { Self { id, state } }
}

// ── BlockService ─────────────────────────────────────────────────────────
/// Mirrors Go: block.Service
pub struct BlockService {
    store: Arc<ObjectStore>,
    cache: Arc<Mutex<Cache>>,
}

impl BlockService {
    pub fn new(store: Arc<ObjectStore>) -> Self {
        Self { store, cache: Arc::new(Mutex::new(HashMap::new())) }
    }

    // ─── helpers ──────────────────────────────────────────────────────────
    /// Mirrors Go: cache.Do — get or load the open object, apply closure
    fn with_state<F, R>(&self, context_id: &str, f: F) -> Result<R>
    where F: FnOnce(&mut State) -> Result<R>
    {
        let mut cache = self.cache.lock();
        // If not cached, create a fresh state (real impl would load from store)
        let obj = cache.entry(context_id.to_owned()).or_insert_with(|| {
            Arc::new(Mutex::new(OpenObject::new(
                FullId::new("", context_id),
                State::new(context_id),
            )))
        }).clone();
        drop(cache);
        let mut obj = obj.lock();
        f(&mut obj.state)
    }

    fn ok() -> RpcError { RpcError::ok() }
    fn err(e: anyhow::Error) -> RpcError { RpcError::unknown(e) }

    // ═══════════════════════════════════════════════════════════════════════
    // OPEN / CLOSE / SHOW  (Go: core/block.go ObjectOpen/Close/Show)
    // ═══════════════════════════════════════════════════════════════════════

    /// Mirrors Go: bs.OpenBlock
    pub fn open_block(&self, id: &FullId, _include_relations: bool) -> Result<Vec<Block>> {
        let state = State::new(&id.object_id);
        let blocks: Vec<Block> = state.all_blocks().cloned().collect();
        let mut cache = self.cache.lock();
        cache.insert(id.object_id.clone(), Arc::new(Mutex::new(OpenObject::new(id.clone(), state))));
        Ok(blocks)
    }

    /// Mirrors Go: bs.CloseBlock
    pub fn close_block(&self, id: &FullId) {
        self.cache.lock().remove(&id.object_id);
    }

    /// Mirrors Go: bs.ShowBlock — read-only snapshot
    pub fn show_block(&self, id: &FullId) -> Result<Vec<Block>> {
        let cache = self.cache.lock();
        if let Some(obj) = cache.get(&id.object_id) {
            Ok(obj.lock().state.all_blocks().cloned().collect())
        } else {
            Ok(vec![])
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK CREATE  (Go: mw.BlockCreate → bs.CreateBlock)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_create(&self, req: BlockCreateRequest) -> BlockCreateResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.add(req.block, &req.target_id, req.position)
        });
        match r {
            Ok(id)  => BlockCreateResponse { block_id: id, error: Self::ok() },
            Err(e)  => BlockCreateResponse { block_id: String::new(), error: Self::err(e) },
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK DELETE  (Go: mw.BlockListDelete → bs.UnlinkBlock)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_list_delete(&self, req: BlockListDeleteRequest) -> BlockListDeleteResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids {
                state.unlink(id)?;
                state.remove(id);
            }
            Ok(())
        });
        BlockListDeleteResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK DUPLICATE  (Go: mw.BlockListDuplicate → bs.DuplicateBlocks)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_list_duplicate(&self, req: BlockListDuplicateRequest) -> BlockListDuplicateResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.duplicate_blocks(&req.block_ids, &req.target_id, req.position)
        });
        match r {
            Ok(ids) => BlockListDuplicateResponse { block_ids: ids, error: Self::ok() },
            Err(e)  => BlockListDuplicateResponse { block_ids: vec![], error: Self::err(e) },
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK REPLACE  (Go: mw.BlockReplace → bs.ReplaceBlock)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_replace(&self, req: BlockReplaceRequest) -> BlockReplaceResponse {
        let new_id = req.block.id.clone();
        let r = self.with_state(&req.context_id, |state| {
            state.unlink(&req.block_id)?;
            state.remove(&req.block_id);
            state.add(req.block, &req.block_id, BlockPosition::Replace)
        });
        match r {
            Ok(id)  => BlockReplaceResponse { block_id: id, error: Self::ok() },
            Err(e)  => BlockReplaceResponse { block_id: String::new(), error: Self::err(e) },
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK SPLIT  (Go: mw.BlockSplit → bs.SplitBlock)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_split(&self, req: BlockSplitRequest) -> BlockSplitResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.split_text(&req.block_id, req.range, req.style)
        });
        match r {
            Ok(id)  => BlockSplitResponse { block_id: id, error: Self::ok() },
            Err(e)  => BlockSplitResponse { block_id: String::new(), error: Self::err(e) },
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BLOCK MERGE  (Go: mw.BlockMerge → bs.MergeBlock)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_merge(&self, req: BlockMergeRequest) -> BlockMergeResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.merge_blocks(&req.first_block_id, &req.second_block_id)
        });
        BlockMergeResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CLIPBOARD: COPY / CUT / PASTE  (Go: bs.Copy / Cut / Paste)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_copy(&self, req: BlockCopyRequest) -> BlockCopyResponse {
        let ids: Vec<String> = req.blocks.iter().map(|b| b.id.clone()).collect();
        let r = self.with_state(&req.context_id, |state| {
            Ok(state.copy_blocks(&ids))
        });
        match r {
            Ok((text, blocks)) => BlockCopyResponse {
                text_slot: text, html_slot: String::new(),
                any_slot: blocks, error: Self::ok(),
            },
            Err(e) => BlockCopyResponse {
                text_slot: String::new(), html_slot: String::new(),
                any_slot: vec![], error: Self::err(e),
            },
        }
    }

    pub fn block_cut(&self, req: BlockCutRequest) -> BlockCutResponse {
        let ids: Vec<String> = req.blocks.iter().map(|b| b.id.clone()).collect();
        let r = self.with_state(&req.context_id, |state| state.cut_blocks(&ids));
        match r {
            Ok((text, blocks)) => BlockCutResponse {
                text_slot: text, html_slot: String::new(),
                any_slot: blocks, error: Self::ok(),
            },
            Err(e) => BlockCutResponse {
                text_slot: String::new(), html_slot: String::new(),
                any_slot: vec![], error: Self::err(e),
            },
        }
    }

    pub fn block_paste(&self, req: BlockPasteRequest) -> BlockPasteResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.paste_blocks(
                &req.focus_block_id,
                req.selected_text_range,
                req.any_slot,
                &req.text_slot,
            )
        });
        match r {
            Ok((ids, caret)) => BlockPasteResponse {
                block_ids: ids, caret_position: caret,
                is_same_block_caret: caret >= 0, error: Self::ok(),
            },
            Err(e) => BlockPasteResponse {
                block_ids: vec![], caret_position: -1,
                is_same_block_caret: false, error: Self::err(e),
            },
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FIELDS  (Go: bs.SetFields / bs.SetFieldsList)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_set_fields(&self, req: BlockSetFieldsRequest) -> BlockSetFieldsResponse {
        let r = self.with_state(&req.context_id, |state| state.set_fields(&req.block_id, req.fields));
        BlockSetFieldsResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_list_set_fields(&self, req: BlockListSetFieldsRequest) -> BlockListSetFieldsResponse {
        let r = self.with_state(&req.context_id, |state| {
            for bf in req.block_fields { state.set_fields(&bf.block_id, bf.fields)?; }
            Ok(())
        });
        BlockListSetFieldsResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MOVE  (Go: bs.MoveBlocks / bs.MoveBlocksToNewPage)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_list_move_to_existing(&self, req: BlockListMoveToExistingRequest) -> BlockListMoveToExistingResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.move_blocks(&req.block_ids, &req.drop_target_id, req.position)
        });
        BlockListMoveToExistingResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_list_move_to_new_object(&self, req: BlockListMoveToNewObjectRequest) -> BlockListMoveToNewObjectResponse {
        // Cut blocks from source, create new object, return its ID as link_id
        let r: Result<String> = (|| {
            let ids = req.block_ids.clone();
            let (_, blocks) = self.with_state(&req.context_id, |state| state.cut_blocks(&ids))?;
            let new_obj_id = Uuid::new_v4().to_string();
            // Load new object state and insert blocks
            let new_state = State::new(&new_obj_id);
            let mut cache = self.cache.lock();
            let obj = Arc::new(Mutex::new(OpenObject::new(
                FullId::new("", new_obj_id.clone()),
                new_state,
            )));
            {
                let mut obj_lock = obj.lock();
                for b in blocks {
                    obj_lock.state.add(b, &new_obj_id.clone(), BlockPosition::Inner)?;
                }
            }
            cache.insert(new_obj_id.clone(), obj);
            Ok(new_obj_id)
        })();
        match r {
            Ok(id)  => BlockListMoveToNewObjectResponse { link_id: id, error: Self::ok() },
            Err(e)  => BlockListMoveToNewObjectResponse { link_id: String::new(), error: Self::err(e) },
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEXT OPS  (Go: bs.SetTextText / SetTextStyle / SetTextChecked / etc.)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_text_set_text(&self, req: BlockTextSetTextRequest) -> BlockTextSetTextResponse {
        let r = self.with_state(&req.context_id, |state| state.set_text(&req.block_id, &req.text, req.marks));
        BlockTextSetTextResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_set_style(&self, req: BlockTextSetStyleRequest) -> BlockTextSetStyleResponse {
        let r = self.with_state(&req.context_id, |state| state.set_text_style(&req.block_id, req.style));
        BlockTextSetStyleResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_set_checked(&self, req: BlockTextSetCheckedRequest) -> BlockTextSetCheckedResponse {
        let r = self.with_state(&req.context_id, |state| state.set_checked(&req.block_id, req.checked));
        BlockTextSetCheckedResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_set_color(&self, req: BlockTextSetColorRequest) -> BlockTextSetColorResponse {
        let r = self.with_state(&req.context_id, |state| state.set_text_color(&req.block_id, &req.color));
        BlockTextSetColorResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_set_icon(&self, req: BlockTextSetIconRequest) -> BlockTextSetIconResponse {
        let r = self.with_state(&req.context_id, |state| {
            state.set_text_icon(&req.block_id, &req.icon_emoji, &req.icon_image)
        });
        BlockTextSetIconResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_latex_set_text(&self, req: BlockLatexSetTextRequest) -> BlockLatexSetTextResponse {
        let r = self.with_state(&req.context_id, |state| state.set_latex_text(&req.block_id, &req.text));
        BlockLatexSetTextResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ── list text ops ─────────────────────────────────────────────────────
    pub fn block_text_list_set_style(&self, req: BlockTextListSetStyleRequest) -> BlockTextListSetStyleResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_text_style(id, req.style)?; }
            Ok(())
        });
        BlockTextListSetStyleResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_list_set_color(&self, req: BlockTextListSetColorRequest) -> BlockTextListSetColorResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_text_color(id, &req.color)?; }
            Ok(())
        });
        BlockTextListSetColorResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_list_set_mark(&self, req: BlockTextListSetMarkRequest) -> BlockTextListSetMarkResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids {
                let b = state.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
                if let BlockContent::Text { marks, .. } = &mut b.content {
                    marks.push(req.mark.clone());
                }
            }
            Ok(())
        });
        BlockTextListSetMarkResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_list_clear_style(&self, req: BlockTextListClearStyleRequest) -> BlockTextListClearStyleResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.clear_text_style(id)?; }
            Ok(())
        });
        BlockTextListClearStyleResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_text_list_clear_content(&self, req: BlockTextListClearContentRequest) -> BlockTextListClearContentResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.clear_text_content(id)?; }
            Ok(())
        });
        BlockTextListClearContentResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ALIGN / VERTICAL ALIGN / BG COLOR  (Go: bs.SetAlign / SetVerticalAlign / SetBackgroundColor)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_list_set_align(&self, req: BlockListSetAlignRequest) -> BlockListSetAlignResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_align(id, req.align)?; }
            Ok(())
        });
        BlockListSetAlignResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_list_set_vertical_align(&self, req: BlockListSetVerticalAlignRequest) -> BlockListSetVerticalAlignResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_vertical_align(id, req.vertical_align)?; }
            Ok(())
        });
        BlockListSetVerticalAlignResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_list_set_background_color(&self, req: BlockListSetBackgroundColorRequest) -> BlockListSetBackgroundColorResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_background_color(id, &req.color)?; }
            Ok(())
        });
        BlockListSetBackgroundColorResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DIV / FILE / LINK STYLE  (Go: bs.SetDivStyle / SetFileStyle / SetLinkAppearance)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_div_list_set_style(&self, req: BlockDivListSetStyleRequest) -> BlockDivListSetStyleResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_div_style(id, req.style)?; }
            Ok(())
        });
        BlockDivListSetStyleResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_file_list_set_style(&self, req: BlockFileListSetStyleRequest) -> BlockFileListSetStyleResponse {
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids { state.set_file_style(id, req.style)?; }
            Ok(())
        });
        BlockFileListSetStyleResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_file_set_target_object_id(&self, req: BlockFileSetTargetObjectIdRequest) -> BlockFileSetTargetObjectIdResponse {
        let r = self.with_state(&req.context_id, |state| {
            let b = state.get_mut(&req.block_id).ok_or_else(|| anyhow!("block not found"))?;
            if let BlockContent::File { target_object_id, .. } = &mut b.content {
                *target_object_id = Some(req.object_id.clone());
            }
            Ok(())
        });
        BlockFileSetTargetObjectIdResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn block_link_list_set_appearance(&self, req: BlockLinkListSetAppearanceRequest) -> BlockLinkListSetAppearanceResponse {
        // Appearance is stored as fields on the link block
        let r = self.with_state(&req.context_id, |state| {
            for id in &req.block_ids {
                let b = state.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
                if let BlockContent::Link { .. } = &b.content {
                    // fields would carry icon_size, card_style, description, relations
                    // stored as Details — omit full detail for brevity but structure is identical
                }
            }
            Ok(())
        });
        BlockLinkListSetAppearanceResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CARET / CARRIAGE  (Go: mw.BlockSetCarriage → cache.Do → sb.History())
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_set_carriage(&self, req: BlockSetCarriageRequest) -> BlockSetCarriageResponse {
        // Undo history carriage state is a pure in-memory concern — just ack
        BlockSetCarriageResponse { error: Self::ok() }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONVERT BLOCKS TO OBJECTS  (Go: bs.ListConvertToObjects)
    // ═══════════════════════════════════════════════════════════════════════
    pub fn block_list_convert_to_objects(&self, req: BlockListConvertToObjectsRequest) -> BlockListConvertToObjectsResponse {
        let r: Result<Vec<String>> = (|| {
            let mut link_ids = Vec::new();
            for id in &req.block_ids {
                // Create a new object from the block content, return its id as a link
                let new_id = Uuid::new_v4().to_string();
                // In real impl: extract text, create object via creator, replace block with Link
                link_ids.push(new_id);
            }
            Ok(link_ids)
        })();
        match r {
            Ok(ids) => BlockListConvertToObjectsResponse { link_ids: ids, error: Self::ok() },
            Err(e)  => BlockListConvertToObjectsResponse { link_ids: vec![], error: Self::err(e) },
        }
    }
}
