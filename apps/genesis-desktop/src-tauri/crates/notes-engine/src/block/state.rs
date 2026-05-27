// block/state.rs — port of core/block/editor/state from Go
// Stores the live in-memory tree of blocks for an open object.
// Go source: core/block/editor/state/state.go

use std::collections::HashMap;
use uuid::Uuid;
use anyhow::{Result, anyhow};

use super::{Block, BlockContent, BlockPosition, TextStyle, Mark, Range,
            Align, VerticalAlign, DivStyle, FileStyle, BlockIcon};
use crate::domain::Details;

/// Mirrors Go: state.State — the mutable block tree for one smart-block
#[derive(Debug, Clone)]
pub struct State {
    pub root_id:  String,
    blocks:       HashMap<String, Block>,
    /// change log — mirrors Go: state.Change slice used for undo/redo
    pub changes:  Vec<Change>,
}

impl State {
    pub fn new(root_id: impl Into<String>) -> Self {
        let root_id = root_id.into();
        let mut blocks = HashMap::new();
        blocks.insert(root_id.clone(), Block::new(root_id.clone(), BlockContent::SmartBlock));
        Self { root_id, blocks, changes: vec![] }
    }

    // ── Accessors ─────────────────────────────────────────────────────────
    pub fn get(&self, id: &str) -> Option<&Block> { self.blocks.get(id) }
    pub fn get_mut(&mut self, id: &str) -> Option<&mut Block> { self.blocks.get_mut(id) }
    pub fn all_blocks(&self) -> impl Iterator<Item = &Block> { self.blocks.values() }
    pub fn root(&self) -> &Block { self.blocks.get(&self.root_id).unwrap() }

    // ── CREATE ────────────────────────────────────────────────────────────
    /// Mirrors Go: state.State.Add + insertBlock
    /// Inserts `block` relative to `target_id` at `position`.
    pub fn add(&mut self, block: Block, target_id: &str, position: BlockPosition) -> Result<String> {
        let id = block.id.clone();
        self.blocks.insert(id.clone(), block);
        self.attach(target_id, &id, position)?;
        self.changes.push(Change::BlockAdd(id.clone()));
        Ok(id)
    }

    /// Mirrors Go: state.State.Create — generate id then add
    pub fn create(&mut self, content: BlockContent, target_id: &str, position: BlockPosition) -> Result<String> {
        let id = new_block_id();
        let block = Block::new(id.clone(), content);
        self.add(block, target_id, position)
    }

    // ── READ ──────────────────────────────────────────────────────────────
    /// Mirrors Go: state.State.PickOrigin  
    pub fn pick(&self, id: &str) -> Option<&Block> { self.get(id) }

    // ── UPDATE helpers ────────────────────────────────────────────────────
    /// Mirrors Go: state.State.SetText
    pub fn set_text(&mut self, id: &str, text: impl Into<String>, marks: Vec<Mark>) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Text { text: t, marks: m, .. } = &mut b.content {
            *t = text.into(); *m = marks;
            self.changes.push(Change::BlockUpdate(id.to_owned()));
            Ok(())
        } else { Err(anyhow!("block {id} is not a text block")) }
    }

    /// Mirrors Go: state.State.SetTextStyle
    pub fn set_text_style(&mut self, id: &str, style: TextStyle) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Text { style: s, .. } = &mut b.content { *s = style; }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetTextChecked
    pub fn set_checked(&mut self, id: &str, checked: bool) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Text { checked: c, .. } = &mut b.content { *c = checked; }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetTextColor
    pub fn set_text_color(&mut self, id: &str, color: impl Into<String>) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Text { color: c, .. } = &mut b.content {
            *c = Some(color.into());
        }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetTextIcon
    pub fn set_text_icon(&mut self, id: &str, emoji: impl Into<String>, image: impl Into<String>) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        let emoji = emoji.into(); let image = image.into();
        if let BlockContent::Text { icon, .. } = &mut b.content {
            *icon = Some(BlockIcon {
                emoji: if emoji.is_empty() { None } else { Some(emoji) },
                image: if image.is_empty() { None } else { Some(image) },
            });
        }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetBackgroundColor
    pub fn set_background_color(&mut self, id: &str, color: impl Into<String>) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        b.background_color = Some(color.into());
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetAlign
    pub fn set_align(&mut self, id: &str, align: Align) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        b.align = align;
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetVerticalAlign
    pub fn set_vertical_align(&mut self, id: &str, va: VerticalAlign) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        b.vertical_align = va;
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetFields
    pub fn set_fields(&mut self, id: &str, fields: Details) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        b.fields = Some(fields);
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetDivStyle
    pub fn set_div_style(&mut self, id: &str, style: DivStyle) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Div { style: s } = &mut b.content { *s = style; }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetFileStyle
    pub fn set_file_style(&mut self, id: &str, style: FileStyle) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::File { style: s, .. } = &mut b.content { *s = style; }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.SetLatexText
    pub fn set_latex_text(&mut self, id: &str, text: impl Into<String>) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Latex { text: t } = &mut b.content { *t = text.into(); }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    /// Mirrors Go: state.State.Unlink — remove from parent children list
    pub fn unlink(&mut self, id: &str) -> Result<()> {
        // find parent
        let parent_id = self.find_parent(id).ok_or_else(|| anyhow!("parent not found for {id}"))?;
        let parent = self.get_mut(&parent_id).unwrap();
        parent.children_ids.retain(|c| c != id);
        self.changes.push(Change::BlockDelete(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: state.State.CleanupBlock — remove from map after unlink
    pub fn remove(&mut self, id: &str) -> Option<Block> {
        self.blocks.remove(id)
    }

    // ── SPLIT / MERGE ─────────────────────────────────────────────────────
    /// Mirrors Go: editor/basic.split
    /// Splits a text block at `range` — the second part becomes a new block.
    pub fn split_text(&mut self, id: &str, range: Range, style: TextStyle) -> Result<String> {
        let (full_text, marks, checked, color, icon) = {
            let b = self.get(id).ok_or_else(|| anyhow!("block {id} not found"))?;
            if let BlockContent::Text { text, marks, checked, color, icon, .. } = &b.content {
                (text.clone(), marks.clone(), *checked, color.clone(), icon.clone())
            } else { return Err(anyhow!("not a text block")); }
        };
        let split_at = range.to as usize;
        let (first, second) = full_text.split_at(split_at.min(full_text.len()));
        // Update existing block
        self.set_text(id, first.to_owned(), marks.clone())?;
        // Create new block after
        let new_id = new_block_id();
        let (_, second_marks): (Vec<_>, Vec<_>) = marks.into_iter()
            .partition(|m| m.range.to <= range.to);
        let new_block = Block::new(new_id.clone(), BlockContent::Text {
            text:    second.to_owned(),
            style,
            marks:   second_marks,
            checked: false,
            color,
            icon,
        });
        let parent_id = self.find_parent(id).ok_or_else(|| anyhow!("no parent for {id}"))?;
        self.add(new_block, id, BlockPosition::Bottom)?;
        Ok(new_id)
    }

    /// Mirrors Go: editor/basic.merge
    /// Merges `second_id` text into `first_id`, then unlinks second.
    pub fn merge_blocks(&mut self, first_id: &str, second_id: &str) -> Result<()> {
        let (second_text, second_marks, second_offset) = {
            let b = self.get(second_id).ok_or_else(|| anyhow!("block {second_id} not found"))?;
            if let BlockContent::Text { text, marks, .. } = &b.content {
                let offset = self.get(first_id)
                    .and_then(|b| if let BlockContent::Text { text, .. } = &b.content { Some(text.len() as i32) } else { None })
                    .unwrap_or(0);
                (text.clone(), marks.clone(), offset)
            } else { return Err(anyhow!("not a text block")); }
        };
        // Append text and shift marks
        {
            let b = self.get_mut(first_id).ok_or_else(|| anyhow!("block {first_id} not found"))?;
            if let BlockContent::Text { text, marks, .. } = &mut b.content {
                text.push_str(&second_text);
                for mut m in second_marks {
                    m.range.from += second_offset;
                    m.range.to   += second_offset;
                    marks.push(m);
                }
            }
        }
        self.changes.push(Change::BlockUpdate(first_id.to_owned()));
        self.unlink(second_id)?;
        self.remove(second_id);
        Ok(())
    }

    // ── DUPLICATE ─────────────────────────────────────────────────────────
    /// Mirrors Go: state.State.DuplicateBlocks
    pub fn duplicate_blocks(&mut self, ids: &[String], target_id: &str, position: BlockPosition) -> Result<Vec<String>> {
        let mut new_ids = Vec::new();
        let mut current_target = target_id.to_owned();
        let mut current_pos    = position;
        for id in ids {
            let block = self.get(id).ok_or_else(|| anyhow!("block {id} not found"))?.clone();
            let new_id = new_block_id();
            let mut new_block = block.clone();
            new_block.id           = new_id.clone();
            new_block.children_ids = vec![];
            self.add(new_block, &current_target, current_pos)?;
            // Recursively duplicate children
            let child_ids = block.children_ids.clone();
            self.duplicate_blocks(&child_ids, &new_id, BlockPosition::Inner)?;
            new_ids.push(new_id.clone());
            current_target = new_id;
            current_pos    = BlockPosition::Bottom;
        }
        Ok(new_ids)
    }

    // ── MOVE ──────────────────────────────────────────────────────────────
    /// Mirrors Go: bs.MoveBlocks
    pub fn move_blocks(&mut self, ids: &[String], drop_target_id: &str, position: BlockPosition) -> Result<()> {
        // Unlink from current parents first
        for id in ids {
            self.unlink(id)?;
        }
        // Re-attach at target
        let mut current = drop_target_id.to_owned();
        let mut pos = position;
        for id in ids {
            self.attach(&current, id, pos)?;
            current = id.clone();
            pos = BlockPosition::Bottom;
        }
        Ok(())
    }

    // ── CLIPBOARD ─────────────────────────────────────────────────────────
    /// Mirrors Go: clipboard.Service.Copy
    pub fn copy_blocks(&self, ids: &[String]) -> (String, Vec<Block>) {
        let mut text_parts = Vec::new();
        let mut blocks     = Vec::new();
        for id in ids {
            if let Some(b) = self.get(id) {
                if let BlockContent::Text { text, .. } = &b.content {
                    text_parts.push(text.clone());
                }
                blocks.push(b.clone());
            }
        }
        (text_parts.join("\n"), blocks)
    }

    /// Mirrors Go: clipboard.Service.Cut — copy then unlink
    pub fn cut_blocks(&mut self, ids: &[String]) -> Result<(String, Vec<Block>)> {
        let (text, blocks) = self.copy_blocks(ids);
        for id in ids { self.unlink(id)?; }
        Ok((text, blocks))
    }

    /// Mirrors Go: clipboard.Service.Paste — insert any_slot blocks
    pub fn paste_blocks(
        &mut self,
        target_id: &str,
        range: Range,
        blocks: Vec<Block>,
        text_slot: &str,
    ) -> Result<(Vec<String>, i32)> {
        // If any_slot has blocks — insert them
        if !blocks.is_empty() {
            let mut inserted = Vec::new();
            let mut current = target_id.to_owned();
            for b in blocks {
                let id = b.id.clone();
                self.blocks.insert(id.clone(), b);
                self.attach(&current, &id, BlockPosition::Bottom)?;
                current = id.clone();
                inserted.push(id);
            }
            return Ok((inserted, -1));
        }
        // Text slot — append to focused block
        if !text_slot.is_empty() {
            if let Some(b) = self.get(target_id) {
                if let BlockContent::Text { text, .. } = &b.content {
                    let mut combined = text[..range.from as usize].to_owned();
                    combined.push_str(text_slot);
                    let caret = combined.len() as i32;
                    self.set_text(target_id, combined, vec![])?;
                    return Ok((vec![target_id.to_owned()], caret));
                }
            }
        }
        Ok((vec![], -1))
    }

    // ── CLEAR ─────────────────────────────────────────────────────────────
    /// Mirrors Go: editor/text.ClearTextStyle
    pub fn clear_text_style(&mut self, id: &str) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Text { marks, style, .. } = &mut b.content {
            marks.clear();
            *style = TextStyle::Paragraph;
        }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    /// Mirrors Go: editor/text.ClearTextContent
    pub fn clear_text_content(&mut self, id: &str) -> Result<()> {
        let b = self.get_mut(id).ok_or_else(|| anyhow!("block {id} not found"))?;
        if let BlockContent::Text { text, marks, .. } = &mut b.content {
            text.clear(); marks.clear();
        }
        self.changes.push(Change::BlockUpdate(id.to_owned()));
        Ok(())
    }

    // ── INTERNAL HELPERS ──────────────────────────────────────────────────
    fn attach(&mut self, target_id: &str, block_id: &str, position: BlockPosition) -> Result<()> {
        let parent_id = match position {
            BlockPosition::Inner | BlockPosition::InnerFirst => target_id.to_owned(),
            _ => self.find_parent(target_id).unwrap_or_else(|| target_id.to_owned()),
        };
        let parent = self.blocks.get_mut(&parent_id)
            .ok_or_else(|| anyhow!("parent block {parent_id} not found"))?;
        match position {
            BlockPosition::Top | BlockPosition::InnerFirst => {
                parent.children_ids.insert(0, block_id.to_owned());
            }
            BlockPosition::Replace => {
                if let Some(idx) = parent.children_ids.iter().position(|c| c == target_id) {
                    parent.children_ids[idx] = block_id.to_owned();
                } else {
                    parent.children_ids.push(block_id.to_owned());
                }
            }
            _ => {
                // Bottom, Left, Right, Inner — append after target
                if target_id != parent_id {
                    if let Some(idx) = parent.children_ids.iter().position(|c| c == target_id) {
                        parent.children_ids.insert(idx + 1, block_id.to_owned());
                    } else {
                        parent.children_ids.push(block_id.to_owned());
                    }
                } else {
                    parent.children_ids.push(block_id.to_owned());
                }
            }
        }
        Ok(())
    }

    fn find_parent(&self, child_id: &str) -> Option<String> {
        for (id, b) in &self.blocks {
            if b.children_ids.iter().any(|c| c == child_id) {
                return Some(id.clone());
            }
        }
        None
    }
}

fn new_block_id() -> String { Uuid::new_v4().to_string().replace('-', "") }

/// Mirrors Go: state.Change — tracks what changed for event emission
#[derive(Debug, Clone)]
pub enum Change {
    BlockAdd(String),
    BlockUpdate(String),
    BlockDelete(String),
}
