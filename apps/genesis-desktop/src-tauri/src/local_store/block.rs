// ═══════════════════════════════════════════════════════════════════════
// LOCALSTORE BLOCK TYPES — Rust transcription
// Source: src/ts/interface/block/index.ts + src/ts/interface/block/*.ts
// ═══════════════════════════════════════════════════════════════════════
// TRANSCRIPTION: Field names and enum values match LocalStore's TypeScript
// source exactly (converted to snake_case for Rust conventions).
// Environment changes required:
//   - string → String, number → i32, boolean → bool, Array<T> → Vec<T>
//   - T | undefined → Option<T>
//   - MobX class methods → free functions
//   - content: any → Content enum with serde(tag = "type")
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── BlockType ────────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockType
// Environment: TypeScript string enum → Rust string enum with serde

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BlockType {
    #[serde(rename = "")]
    Empty,
    #[serde(rename = "page")]
    Page,
    #[serde(rename = "dataview")]
    Dataview,
    #[serde(rename = "layout")]
    Layout,
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "file")]
    File,
    #[serde(rename = "bookmark")]
    Bookmark,
    #[serde(rename = "iconPage")]
    IconPage,
    #[serde(rename = "iconUser")]
    IconUser,
    #[serde(rename = "div")]
    Div,
    #[serde(rename = "link")]
    Link,
    #[serde(rename = "cover")]
    Cover,
    #[serde(rename = "relation")]
    Relation,
    #[serde(rename = "featured")]
    Featured,
    #[serde(rename = "latex")]
    Embed,
    #[serde(rename = "table")]
    Table,
    #[serde(rename = "tableColumn")]
    TableColumn,
    #[serde(rename = "tableRow")]
    TableRow,
    #[serde(rename = "tableOfContents")]
    TableOfContents,
    #[serde(rename = "widget")]
    Widget,
    #[serde(rename = "chat")]
    Chat,
}

// ─── BlockPosition ────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockPosition

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BlockPosition {
    None = 0,
    Top = 1,
    Bottom = 2,
    Left = 3,
    Right = 4,
    Inner = 5,
    Replace = 6,
    InnerFirst = 7,
}

// ─── BlockSplitMode ───────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockSplitMode

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BlockSplitMode {
    Bottom = 0,
    Top = 1,
    Inner = 2,
}

// ─── BlockHAlign ──────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockHAlign

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum BlockHAlign {
    #[default]
    Left = 0,
    Center = 1,
    Right = 2,
    Justify = 3,
}

// ─── BlockVAlign ──────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockVAlign

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum BlockVAlign {
    #[default]
    Top = 0,
    Middle = 1,
    Bottom = 2,
}

// ─── TextStyle ─────────────────────────────────────────────────────────
// Source: interface/block/text.ts — enum TextStyle

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TextStyle {
    Paragraph = 0,
    Header1 = 1,
    Header2 = 2,
    Header3 = 3,
    Header4 = 4,
    Quote = 5,
    Code = 6,
    Title = 7,
    Checkbox = 8,
    Bulleted = 9,
    Numbered = 10,
    Toggle = 11,
    Description = 12,
    Callout = 13,
    ToggleHeader1 = 14,
    ToggleHeader2 = 15,
    ToggleHeader3 = 16,
}

// ─── MarkerType ───────────────────────────────────────────────────────
// Source: interface/block/text.ts — enum MarkerType

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MarkerType {
    Bulleted = 0,
    Numbered = 1,
    Checkbox = 2,
    Toggle = 3,
}

// ─── MarkType ─────────────────────────────────────────────────────────
// Source: interface/block/text.ts — enum MarkType

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MarkType {
    Strike = 0,
    Code = 1,
    Italic = 2,
    Bold = 3,
    Underline = 4,
    Link = 5,
    Color = 6,
    BgColor = 7,
    Mention = 8,
    Emoji = 9,
    Object = 10,
    Latex = 11,
    Change = 100,
    Highlight = 101,
    Search = 102,
}

// ─── TextRange ────────────────────────────────────────────────────────
// Source: interface/block/text.ts — interface TextRange

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextRange {
    pub from: i32,
    pub to: i32,
}

// ─── Mark ─────────────────────────────────────────────────────────────
// Source: interface/block/text.ts — interface Mark

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Mark {
    pub range: TextRange,
    pub r#type: MarkType,
    #[serde(default)]
    pub param: Option<String>,
}

// ─── ContentText ──────────────────────────────────────────────────────
// Source: interface/block/text.ts — interface ContentText

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentText {
    pub text: String,
    pub style: TextStyle,
    #[serde(default)]
    pub marks: Vec<Mark>,
    #[serde(default)]
    pub checked: bool,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub icon_emoji: String,
    #[serde(default)]
    pub icon_image: String,
}

// ─── DivStyle ─────────────────────────────────────────────────────────
// Source: interface/block/div.ts — enum DivStyle

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DivStyle {
    Line = 0,
    Dot = 1,
}

// ─── ContentDiv ───────────────────────────────────────────────────────
// Source: interface/block/div.ts — interface ContentDiv

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentDiv {
    pub style: DivStyle,
}

// ─── FileStyle ────────────────────────────────────────────────────────
// Source: interface/block/file.ts — enum FileStyle

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileStyle {
    Auto = 0,
    Link = 1,
    Embed = 2,
}

// ─── FileType (File) ──────────────────────────────────────────────────
// Source: interface/block/file.ts — enum FileType

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileTypeEnum {
    None = 0,
    File = 1,
    Image = 2,
    Video = 3,
    Audio = 4,
    Pdf = 5,
}

// ─── FileState ────────────────────────────────────────────────────────
// Source: interface/block/file.ts — enum FileState

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileState {
    Empty = 0,
    Uploading = 1,
    Done = 2,
    Error = 3,
}

// ─── ContentFile ──────────────────────────────────────────────────────
// Source: interface/block/file.ts — interface ContentFile

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentFile {
    pub target_object_id: String,
    pub style: FileStyle,
    pub state: FileState,
    pub r#type: FileTypeEnum,
}

// ─── BookmarkState ────────────────────────────────────────────────────
// Source: interface/block/bookmark.ts — enum BookmarkState

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BookmarkState {
    Empty = 0,
    Fetching = 1,
    Done = 2,
    Error = 3,
}

// ─── ContentBookmark ──────────────────────────────────────────────────
// Source: interface/block/bookmark.ts — interface ContentBookmark

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentBookmark {
    pub state: BookmarkState,
    pub target_object_id: String,
    pub url: String,
}

// ─── EmbedProcessor ───────────────────────────────────────────────────
// Source: interface/block/embed.ts — enum EmbedProcessor

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EmbedProcessor {
    Latex = 0,
    Mermaid = 1,
    Chart = 2,
    Youtube = 3,
    Vimeo = 4,
    Soundcloud = 5,
    GoogleMaps = 6,
    Miro = 7,
    Figma = 8,
    Twitter = 9,
    OpenStreetMap = 10,
    Reddit = 11,
    Facebook = 12,
    Instagram = 13,
    Telegram = 14,
    GithubGist = 15,
    Codepen = 16,
    Bilibili = 17,
    Excalidraw = 18,
    Kroki = 19,
    Graphviz = 20,
    Sketchfab = 21,
    Image = 22,
    Drawio = 23,
    Spotify = 24,
    Bandcamp = 25,
    AppleMusic = 26,
}

// ─── ContentEmbed ─────────────────────────────────────────────────────
// Source: interface/block/embed.ts — interface ContentEmbed

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentEmbed {
    pub text: String,
    pub processor: EmbedProcessor,
}

// ─── LayoutStyle ──────────────────────────────────────────────────────
// Source: interface/block/layout.ts — enum LayoutStyle

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LayoutStyle {
    Row = 0,
    Column = 1,
    Div = 2,
    Header = 3,
    TableRows = 4,
    TableColumns = 5,
}

// ─── ContentLayout ────────────────────────────────────────────────────
// Source: interface/block/layout.ts — interface ContentLayout

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentLayout {
    pub style: LayoutStyle,
}

// ─── LinkCardStyle ────────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkCardStyle

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LinkCardStyle {
    Text = 0,
    Card = 1,
    Inline = 2,
}

// ─── LinkIconSize ─────────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkIconSize

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LinkIconSize {
    None = 0,
    Small = 1,
    Medium = 2,
}

// ─── LinkDescription ──────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkDescription

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LinkDescription {
    None = 0,
    Added = 1,
    Content = 2,
}

// ─── ContentLink ──────────────────────────────────────────────────────
// Source: interface/block/link.ts — interface ContentLink

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentLink {
    pub target_block_id: String,
    pub icon_size: LinkIconSize,
    pub card_style: LinkCardStyle,
    pub description: LinkDescription,
    #[serde(default)]
    pub relations: Vec<String>,
}

// ─── ContentRelation ──────────────────────────────────────────────────
// Source: interface/block/relation.ts — interface ContentRelation

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentRelation {
    pub key: String,
}

// ─── WidgetLayout ─────────────────────────────────────────────────────
// Source: interface/block/widget.ts — enum WidgetLayout

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WidgetLayout {
    Link = 0,
    Tree = 1,
    List = 2,
    Compact = 3,
    View = 4,
    Space = 100,
    Object = 101,
}

// ─── ContentWidget ────────────────────────────────────────────────────
// Source: interface/block/widget.ts — interface ContentWidget

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentWidget {
    pub layout: WidgetLayout,
    pub limit: i32,
    pub view_id: String,
    pub auto_added: bool,
    #[serde(default)]
    pub section: Option<i32>,
}

// ─── ContentTableRow ──────────────────────────────────────────────────
// Source: interface/block/table.ts — interface ContentTableRow

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentTableRow {
    pub is_header: bool,
}

// ─── ContentDataview ──────────────────────────────────────────────────
// Source: interface/block/dataview.ts — interface ContentDataview

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentDataview {
    #[serde(default)]
    pub sources: Vec<String>,
    #[serde(default)]
    pub view_id: String,
    #[serde(default)]
    pub views: Vec<serde_json::Value>,
    #[serde(default)]
    pub relation_links: Vec<serde_json::Value>,
    #[serde(default)]
    pub group_order: Vec<serde_json::Value>,
    #[serde(default)]
    pub object_order: Vec<serde_json::Value>,
    #[serde(default)]
    pub target_object_id: String,
    #[serde(default)]
    pub is_collection: bool,
}

// ─── BlockContent — tagged union ──────────────────────────────────────
// Environment change: TypeScript has content: any with per-type interfaces.
// Rust uses a tagged enum to match on block type.

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "value")]
pub enum BlockContent {
    #[serde(rename = "text")]
    Text(ContentText),
    #[serde(rename = "file")]
    File(ContentFile),
    #[serde(rename = "bookmark")]
    Bookmark(ContentBookmark),
    #[serde(rename = "div")]
    Div(ContentDiv),
    #[serde(rename = "latex")]
    Embed(ContentEmbed),
    #[serde(rename = "layout")]
    Layout(ContentLayout),
    #[serde(rename = "link")]
    Link(ContentLink),
    #[serde(rename = "relation")]
    Relation(ContentRelation),
    #[serde(rename = "widget")]
    Widget(ContentWidget),
    #[serde(rename = "tableRow")]
    TableRow(ContentTableRow),
    #[serde(rename = "dataview")]
    Dataview(ContentDataview),
    #[serde(rename = "empty")]
    Empty,
}

// ─── Block — database row ─────────────────────────────────────────────
// Maps to the `blocks` table in SQLite.
// Source: interface/block/index.ts — interface Block (flat, non-MobX)

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BlockRow {
    pub id: String,
    pub object_id: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub r#type: String,
    pub content: String,
    #[serde(default)]
    pub fields: String,
    #[serde(default)]
    pub align: i32,
    #[serde(default)]
    pub bg_color: String,
    pub position: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

// ─── Block — in-memory representation ─────────────────────────────────
// Not a database row — used for API responses and in-memory manipulation.

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Block {
    pub id: String,
    pub r#type: BlockType,
    pub content: BlockContent,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub children_ids: Vec<String>,
    #[serde(default)]
    pub fields: serde_json::Value,
    #[serde(default)]
    pub h_align: BlockHAlign,
    #[serde(default)]
    pub v_align: BlockVAlign,
    #[serde(default)]
    pub bg_color: String,
}

// ─── BlockStructure ───────────────────────────────────────────────────
// Source: interface/block/index.ts — interface BlockStructure

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockStructure {
    pub parent_id: String,
    pub children_ids: Vec<String>,
}

// ─── Type-narrowing helpers ──────────────────────────────────────────
// Environment change: Replaces the 30+ MobX class methods on Block.
// Source: src/ts/model/block.ts — all is*() methods

pub fn block_type_name(block: &Block) -> Option<&str> {
    match &block.content {
        BlockContent::Text(_) => Some("text"),
        BlockContent::Div(_) => Some("div"),
        _ => None,
    }
}

pub fn is_text_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Text)
}

pub fn is_file_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::File)
}

pub fn is_div_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Div)
}

pub fn is_bookmark_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Bookmark)
}

pub fn is_embed_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Embed)
}

pub fn is_layout_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Layout)
}

pub fn is_link_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Link)
}

pub fn is_dataview_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Dataview)
}

pub fn is_page_block(block: &Block) -> bool {
    matches!(block.r#type, BlockType::Page)
}

pub fn is_system_block(block: &Block) -> bool {
    is_page_block(block) || is_layout_block(block)
}

pub fn can_have_children(block: &Block) -> bool {
    if is_system_block(block) {
        return false;
    }
    if !is_text_block(block) {
        return false;
    }
    match &block.content {
        BlockContent::Text(text) => matches!(
            text.style,
            TextStyle::Paragraph
                | TextStyle::Bulleted
                | TextStyle::Numbered
                | TextStyle::Toggle
                | TextStyle::ToggleHeader1
                | TextStyle::ToggleHeader2
                | TextStyle::ToggleHeader3
                | TextStyle::Callout
                | TextStyle::Quote
        ),
        _ => false,
    }
}

pub fn can_have_marks(block: &Block) -> bool {
    if !is_text_block(block) {
        return false;
    }
    match &block.content {
        BlockContent::Text(text) => !matches!(
            text.style,
            TextStyle::Title | TextStyle::Description | TextStyle::Code
        ),
        _ => false,
    }
}
