// block/mod.rs — port of core/block types and the block-level CRUD
// Go source: core/block.go, core/block/service.go

pub mod state;
pub mod editor;

use serde::{Deserialize, Serialize};
use crate::domain::{Details, RelationKey};

// ── BlockType ─────────────────────────────────────────────────────────────
/// Mirrors Go: model.BlockContentCase / model.Block content types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BlockContent {
    /// model.BlockContentText
    Text {
        text:    String,
        style:   TextStyle,
        marks:   Vec<Mark>,
        checked: bool,
        color:   Option<String>,
        icon:    Option<BlockIcon>,
    },
    /// model.BlockContentDiv
    Div { style: DivStyle },
    /// model.BlockContentFile
    File {
        target_object_id: Option<String>,
        style:            FileStyle,
        name:             Option<String>,
    },
    /// model.BlockContentBookmark
    Bookmark {
        url:        String,
        title:      Option<String>,
        image_hash: Option<String>,
        favicon_hash: Option<String>,
        object_id:  Option<String>,
    },
    /// model.BlockContentLink
    Link {
        target_block_id: String,
        style:           LinkStyle,
        fields:          Option<Details>,
    },
    /// model.BlockContentLayout
    Layout { style: LayoutStyle },
    /// model.BlockContentRelation
    Relation { key: RelationKey },
    /// model.BlockContentLatex
    Latex { text: String },
    /// model.BlockContentTableOfContents
    TableOfContents,
    /// Blank / smart-block root
    SmartBlock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum TextStyle {
    Paragraph       = 0,
    Header1         = 1,
    Header2         = 2,
    Header3         = 3,
    Header4         = 4,
    Quote           = 5,
    Code            = 6,
    Title           = 7,
    Checkbox        = 8,
    Marked          = 9,   // bulleted list
    Numbered        = 10,
    Toggle          = 11,
    Description     = 12,
    Callout         = 13,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum DivStyle  { Line = 0, Dots = 1 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum FileStyle { Auto = 0, Link = 1, Embed = 2 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum LinkStyle { Page = 0, Card = 1, Inline = 2, Archive = 3 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum LayoutStyle { Row = 0, Column = 1, Div = 2, Header = 3, TableRows = 4, TableColumns = 5 }

/// Mirrors model.BlockContentTextMark
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Mark {
    pub range: Range,
    pub mark_type: MarkType,
    pub param:     Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Range { pub from: i32, pub to: i32 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum MarkType {
    Strikethrough = 0, Keyboard = 1, Italic = 2, Bold = 3,
    Underscored = 4, Link = 5, TextColor = 6, BackgroundColor = 7,
    Mention = 8, Emoji = 9, Object = 10, Latex = 11,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockIcon {
    pub emoji: Option<String>,
    pub image: Option<String>,
}

// ── Align / VerticalAlign ─────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum Align { Left = 0, Center = 1, Right = 2 }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum VerticalAlign { Top = 0, Middle = 1, Bottom = 2 }

// ── Block ─────────────────────────────────────────────────────────────────
/// Mirrors Go: model.Block — the universal block node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id:               String,
    pub children_ids:     Vec<String>,
    pub content:          BlockContent,
    pub background_color: Option<String>,
    pub align:            Align,
    pub vertical_align:   VerticalAlign,
    pub fields:           Option<Details>,
}

impl Block {
    pub fn new(id: impl Into<String>, content: BlockContent) -> Self {
        Self {
            id: id.into(),
            children_ids: vec![],
            content,
            background_color: None,
            align: Align::Left,
            vertical_align: VerticalAlign::Top,
            fields: None,
        }
    }
    pub fn new_text(id: impl Into<String>, text: impl Into<String>) -> Self {
        Self::new(id, BlockContent::Text {
            text: text.into(), style: TextStyle::Paragraph,
            marks: vec![], checked: false, color: None, icon: None,
        })
    }
}

// ── BlockPosition ─────────────────────────────────────────────────────────
/// Mirrors Go: model.Block_Inner (position enum for insert)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(i32)]
pub enum BlockPosition { None = 0, Top = 1, Bottom = 2, Left = 3, Right = 4, Inner = 5, Replace = 6, InnerFirst = 7 }

// ── Requests/Responses ────────────────────────────────────────────────────
/// Mirrors Go: pb.RpcBlockCreateRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockCreateRequest {
    pub context_id: String,
    pub target_id:  String,
    pub block:      Block,
    pub position:   BlockPosition,
}

/// Mirrors Go: pb.RpcBlockCreateResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockCreateResponse {
    pub block_id: String,
    pub error:    RpcError,
}

/// Mirrors Go: pb.RpcBlockListDeleteRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListDeleteRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
}

/// Mirrors Go: pb.RpcBlockListDeleteResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListDeleteResponse {
    pub error: RpcError,
}

/// Mirrors Go: pb.RpcBlockListDuplicateRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListDuplicateRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub target_id:  String,
    pub position:   BlockPosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListDuplicateResponse {
    pub block_ids: Vec<String>,
    pub error:     RpcError,
}

/// Mirrors Go: pb.RpcBlockReplaceRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockReplaceRequest {
    pub context_id: String,
    pub block_id:   String,
    pub block:      Block,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockReplaceResponse {
    pub block_id: String,
    pub error:    RpcError,
}

/// Mirrors Go: pb.RpcBlockSplitRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSplitRequest {
    pub context_id: String,
    pub block_id:   String,
    pub range:      Range,
    pub style:      TextStyle,
    pub mode:       i32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSplitResponse {
    pub block_id: String,
    pub error:    RpcError,
}

/// Mirrors Go: pb.RpcBlockMergeRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockMergeRequest {
    pub context_id:       String,
    pub first_block_id:   String,
    pub second_block_id:  String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockMergeResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockCopyRequest / Response (clipboard)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockCopyRequest {
    pub context_id: String,
    pub blocks:     Vec<Block>,
    pub selected_text_range: Range,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockCopyResponse {
    pub text_slot: String,
    pub html_slot: String,
    pub any_slot:  Vec<Block>,
    pub error:     RpcError,
}

/// Mirrors Go: pb.RpcBlockCutRequest / Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockCutRequest {
    pub context_id: String,
    pub blocks:     Vec<Block>,
    pub selected_text_range: Range,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockCutResponse {
    pub text_slot: String,
    pub html_slot: String,
    pub any_slot:  Vec<Block>,
    pub error:     RpcError,
}

/// Mirrors Go: pb.RpcBlockPasteRequest / Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockPasteRequest {
    pub context_id:           String,
    pub focus_block_id:       String,
    pub selected_text_range:  Range,
    pub is_part_of_block:     bool,
    pub text_slot:            String,
    pub html_slot:            String,
    pub any_slot:             Vec<Block>,
    pub file_slot:            Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockPasteResponse {
    pub block_ids:          Vec<String>,
    pub caret_position:     i32,
    pub is_same_block_caret: bool,
    pub error:              RpcError,
}

/// Mirrors Go: pb.RpcBlockSetFieldsRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSetFieldsRequest {
    pub context_id: String,
    pub block_id:   String,
    pub fields:     Details,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSetFieldsResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListSetFieldsRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetFieldsRequest {
    pub context_id:     String,
    pub block_fields:   Vec<BlockFields>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockFields { pub block_id: String, pub fields: Details }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetFieldsResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListMoveToExistingObjectRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListMoveToExistingRequest {
    pub context_id:    String,
    pub block_ids:     Vec<String>,
    pub target_id:     String,
    pub drop_target_id: String,
    pub position:      BlockPosition,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListMoveToExistingResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListMoveToNewObjectRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListMoveToNewObjectRequest {
    pub context_id:   String,
    pub block_ids:    Vec<String>,
    pub details:      Details,
    pub template_id:  String,
    pub object_type_unique_key: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListMoveToNewObjectResponse {
    pub link_id: String,
    pub error:   RpcError,
}

/// Mirrors Go: pb.RpcBlockTextSetTextRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetTextRequest {
    pub context_id: String,
    pub block_id:   String,
    pub text:       String,
    pub marks:      Vec<Mark>,
    pub is_bottom_of_empty_paragraph: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetTextResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextSetStyleRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetStyleRequest {
    pub context_id: String,
    pub block_id:   String,
    pub style:      TextStyle,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetStyleResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextSetCheckedRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetCheckedRequest {
    pub context_id: String,
    pub block_id:   String,
    pub checked:    bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetCheckedResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextSetColorRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetColorRequest {
    pub context_id: String,
    pub block_id:   String,
    pub color:      String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetColorResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextSetIconRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetIconRequest {
    pub context_id:  String,
    pub block_id:    String,
    pub icon_image:  String,
    pub icon_emoji:  String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextSetIconResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListSetAlignRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetAlignRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub align:      Align,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetAlignResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListSetVerticalAlignRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetVerticalAlignRequest {
    pub context_id:    String,
    pub block_ids:     Vec<String>,
    pub vertical_align: VerticalAlign,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetVerticalAlignResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListSetBackgroundColorRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetBackgroundColorRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub color:      String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListSetBackgroundColorResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockLatexSetTextRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockLatexSetTextRequest {
    pub context_id: String,
    pub block_id:   String,
    pub text:       String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockLatexSetTextResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextListSetStyleRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListSetStyleRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub style:      TextStyle,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListSetStyleResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextListSetColorRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListSetColorRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub color:      String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListSetColorResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextListSetMarkRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListSetMarkRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub mark:       Mark,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListSetMarkResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextListClearStyleRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListClearStyleRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListClearStyleResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockTextListClearContentRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListClearContentRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTextListClearContentResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockDivListSetStyleRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockDivListSetStyleRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub style:      DivStyle,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockDivListSetStyleResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockFileListSetStyleRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockFileListSetStyleRequest {
    pub context_id: String,
    pub block_ids:  Vec<String>,
    pub style:      FileStyle,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockFileListSetStyleResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockFileSetTargetObjectIdRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockFileSetTargetObjectIdRequest {
    pub context_id: String,
    pub block_id:   String,
    pub object_id:  String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockFileSetTargetObjectIdResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockLinkListSetAppearanceRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockLinkListSetAppearanceRequest {
    pub context_id:          String,
    pub block_ids:           Vec<String>,
    pub icon_size:           i32,
    pub card_style:          i32,
    pub description:         i32,
    pub relations:           Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockLinkListSetAppearanceResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockSetCarriageRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSetCarriageRequest {
    pub context_id: String,
    pub block_id:   String,
    pub range:      Range,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSetCarriageResponse { pub error: RpcError }

/// Mirrors Go: pb.RpcBlockListConvertToObjectsRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListConvertToObjectsRequest {
    pub context_id:             String,
    pub block_ids:              Vec<String>,
    pub object_type_unique_key: String,
    pub template_id:            String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockListConvertToObjectsResponse {
    pub link_ids: Vec<String>,
    pub error:    RpcError,
}

// ── Shared error type ─────────────────────────────────────────────────────
/// Mirrors Go: pb.Rpc*ResponseError pattern
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RpcError {
    pub code:        i32,   // 0 = NULL (success), non-zero = error
    pub description: String,
}

impl RpcError {
    pub fn ok() -> Self { Self { code: 0, description: String::new() } }
    pub fn unknown(msg: impl std::fmt::Display) -> Self {
        Self { code: 1, description: msg.to_string() }
    }
}
