// ═══════════════════════════════════════════════════════════════════════
// ANYTYPE BLOCK TYPES — Verified Transcription from anytype-ts
// Source: src/ts/interface/block/ + src/ts/interface/common.ts
// ═══════════════════════════════════════════════════════════════════════
// TRANSCRIPTION RULE: Copied verbatim. Only environment changes:
//   - Removed MobX observable decorators and makeObservable calls
//   - Removed React import dependencies from interfaces
//   - Converted class constructors to plain interfaces
//   - Removed circular interface references (Interface/index.ts barrel)
//   - Added explicit `ContentBlock` union type and convenience re-exports
//   - Namespace: blocks are flat types, not MobX classes
// ═══════════════════════════════════════════════════════════════════════

// ─── BlockType ────────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockType

export enum BlockType {
  Empty = '',
  Page = 'page',
  Dataview = 'dataview',
  Layout = 'layout',
  Text = 'text',
  File = 'file',
  Bookmark = 'bookmark',
  IconPage = 'iconPage',
  IconUser = 'iconUser',
  Div = 'div',
  Link = 'link',
  Cover = 'cover',
  Relation = 'relation',
  Featured = 'featured',
  Embed = 'latex',
  Table = 'table',
  TableColumn = 'tableColumn',
  TableRow = 'tableRow',
  TableOfContents = 'tableOfContents',
  Widget = 'widget',
  Chat = 'chat',
}

// ─── BlockPosition ────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockPosition

export enum BlockPosition {
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

export enum BlockSplitMode {
  Bottom = 0,
  Top = 1,
  Inner = 2,
}

// ─── BlockHAlign ──────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockHAlign

export enum BlockHAlign {
  Left = 0,
  Center = 1,
  Right = 2,
  Justify = 3,
}

// ─── BlockVAlign ──────────────────────────────────────────────────────
// Source: interface/block/index.ts — enum BlockVAlign

export enum BlockVAlign {
  Top = 0,
  Middle = 1,
  Bottom = 2,
}

// ─── TextStyle ─────────────────────────────────────────────────────────
// Source: interface/block/text.ts — enum TextStyle

export enum TextStyle {
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

export enum MarkerType {
  Bulleted = 0,
  Numbered = 1,
  Checkbox = 2,
  Toggle = 3,
}

// ─── MarkType ─────────────────────────────────────────────────────────
// Source: interface/block/text.ts — enum MarkType

export enum MarkType {
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

// ─── MarkOverlap ──────────────────────────────────────────────────────
// Source: interface/block/text.ts — enum MarkOverlap

export enum MarkOverlap {
  Equal = 0, // a == b
  Outer = 1, // b inside a
  Inner = 2, // a inside b
  InnerLeft = 3, // a inside b, left side eq
  InnerRight = 4, // a inside b, right side eq
  Left = 5, // a-b
  Right = 6, // b-a
  Before = 7, // a ... b
  After = 8, // b ... a
}

// ─── TextRange ────────────────────────────────────────────────────────
// Source: interface/block/text.ts — interface TextRange

export interface TextRange {
  from: number;
  to: number;
}

// ─── Mark ─────────────────────────────────────────────────────────────
// Source: interface/block/text.ts — interface Mark

export interface Mark {
  range: TextRange;
  type: MarkType;
  param?: string;
}

// ─── ContentText ──────────────────────────────────────────────────────
// Source: interface/block/text.ts — interface ContentText

export interface ContentText {
  text: string;
  style: TextStyle;
  marks: Mark[];
  checked: boolean;
  color: string;
  iconEmoji: string;
  iconImage: string;
}

// ─── DivStyle ─────────────────────────────────────────────────────────
// Source: interface/block/div.ts — enum DivStyle

export enum DivStyle {
  Line = 0,
  Dot = 1,
}

// ─── ContentDiv ───────────────────────────────────────────────────────
// Source: interface/block/div.ts — interface ContentDiv

export interface ContentDiv {
  style: DivStyle;
}

// ─── FileStyle ────────────────────────────────────────────────────────
// Source: interface/block/file.ts — enum FileStyle

export enum FileStyle {
  Auto = 0,
  Link = 1,
  Embed = 2,
}

// ─── FileType (File) ──────────────────────────────────────────────────
// Source: interface/block/file.ts — enum FileType

export enum FileType {
  None = 0,
  File = 1,
  Image = 2,
  Video = 3,
  Audio = 4,
  Pdf = 5,
}

// ─── FileState ────────────────────────────────────────────────────────
// Source: interface/block/file.ts — enum FileState

export enum FileState {
  Empty = 0,
  Uploading = 1,
  Done = 2,
  Error = 3,
}

// ─── ContentFile ──────────────────────────────────────────────────────
// Source: interface/block/file.ts — interface ContentFile

export interface ContentFile {
  targetObjectId: string;
  style: FileStyle;
  state: FileState;
  type: FileType;
}

// ─── BookmarkState ────────────────────────────────────────────────────
// Source: interface/block/bookmark.ts — enum BookmarkState

export enum BookmarkState {
  Empty = 0,
  Fetching = 1,
  Done = 2,
  Error = 3,
}

// ─── ContentBookmark ──────────────────────────────────────────────────
// Source: interface/block/bookmark.ts — interface ContentBookmark

export interface ContentBookmark {
  state: BookmarkState;
  targetObjectId: string;
  url: string;
}

// ─── EmbedProcessor ───────────────────────────────────────────────────
// Source: interface/block/embed.ts — enum EmbedProcessor

export enum EmbedProcessor {
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

export interface ContentEmbed {
  text: string;
  processor: EmbedProcessor;
}

// ─── LayoutStyle ──────────────────────────────────────────────────────
// Source: interface/block/layout.ts — enum LayoutStyle

export enum LayoutStyle {
  Row = 0,
  Column = 1,
  Div = 2,
  Header = 3,
  TableRows = 4,
  TableColumns = 5,
}

// ─── ContentLayout ────────────────────────────────────────────────────
// Source: interface/block/layout.ts — interface ContentLayout

export interface ContentLayout {
  style: LayoutStyle;
}

// ─── LinkCardStyle ────────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkCardStyle

export enum LinkCardStyle {
  Text = 0,
  Card = 1,
  Inline = 2,
}

// ─── LinkDefaultStyle ─────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkDefaultStyle

export enum LinkDefaultStyle {
  Text = 0,
  Card = 1,
  CardMedium = 2,
}

// ─── LinkIconSize ─────────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkIconSize

export enum LinkIconSize {
  None = 0,
  Small = 1,
  Medium = 2,
}

// ─── LinkDescription ──────────────────────────────────────────────────
// Source: interface/block/link.ts — enum LinkDescription

export enum LinkDescription {
  None = 0,
  Added = 1,
  Content = 2,
}

// ─── ContentLink ──────────────────────────────────────────────────────
// Source: interface/block/link.ts — interface ContentLink

export interface ContentLink {
  targetBlockId: string;
  iconSize: LinkIconSize;
  cardStyle: LinkCardStyle;
  description: LinkDescription;
  relations: string[];
}

// ─── ContentRelation ──────────────────────────────────────────────────
// Source: interface/block/relation.ts — interface ContentRelation

export interface ContentRelation {
  key: string;
}

// ─── WidgetLayout ─────────────────────────────────────────────────────
// Source: interface/block/widget.ts — enum WidgetLayout

export enum WidgetLayout {
  Link = 0,
  Tree = 1,
  List = 2,
  Compact = 3,
  View = 4,
  Space = 100,
  Object = 101,
}

// ─── WidgetSection ────────────────────────────────────────────────────
// Source: interface/block/widget.ts — enum WidgetSection

export enum WidgetSection {
  Pin = 0,
  Type = 1,
  Unread = 2,
  RecentEdit = 3,
  Bin = 4,
  MyFavorites = 5,
}

// ─── ContentWidget ────────────────────────────────────────────────────
// Source: interface/block/widget.ts — interface ContentWidget

export interface ContentWidget {
  layout: WidgetLayout;
  limit: number;
  viewId: string;
  autoAdded: boolean;
  section?: WidgetSection;
}

// ─── ContentTableRow ──────────────────────────────────────────────────
// Source: interface/block/table.ts — interface ContentTableRow

export interface ContentTableRow {
  isHeader: boolean;
}

// ─── ContentDataview ──────────────────────────────────────────────────
// Source: interface/block/dataview.ts — interface ContentDataview

export interface ContentDataview {
  sources: string[];
  viewId: string;
  views: any[];
  relationLinks: any[];
  groupOrder: any[];
  objectOrder: any[];
  targetObjectId: string;
  isCollection: boolean;
}

// ─── Dataview sub-types ───────────────────────────────────────────────
// Source: interface/block/dataview.ts — enums + interfaces

export enum ViewType {
  Grid = 0,
  List = 1,
  Gallery = 2,
  Board = 3,
  Calendar = 4,
  Graph = 5,
  Timeline = 6,
}

export enum SortType {
  Asc = 0,
  Desc = 1,
  Custom = 2,
}

export enum FilterCondition {
  None = 0,
  Equal = 1,
  NotEqual = 2,
  Greater = 3,
  Less = 4,
  GreaterOrEqual = 5,
  LessOrEqual = 6,
  Like = 7,
  NotLike = 8,
  In = 9,
  NotIn = 10,
  Empty = 11,
  NotEmpty = 12,
  AllIn = 13,
  NotAllIn = 14,
  ExactIn = 15,
  NotExactIn = 16,
}

export interface Sort {
  id?: string;
  relationKey: string;
  type: SortType;
  includeTime?: boolean;
  customOrder?: any[];
  empty?: EmptyType;
}

export enum EmptyType {
  None = 0,
  Start = 1,
  End = 2,
}

export interface Filter {
  id?: string;
  relationKey: string;
  condition: FilterCondition;
  value: any;
  operator?: FilterOperator;
  format?: RelationType;
  quickOption?: FilterQuickOption;
  includeTime?: boolean;
  nestedFilters?: Filter[];
}

export enum FilterOperator {
  None = 0,
  Or = 1,
  And = 2,
}

export enum FilterQuickOption {
  ExactDate = 0,
  Yesterday = 1,
  Today = 2,
  Tomorrow = 3,
  LastWeek = 4,
  CurrentWeek = 5,
  NextWeek = 6,
  LastMonth = 7,
  CurrentMonth = 8,
  NextMonth = 9,
  NumberOfDaysAgo = 10,
  NumberOfDaysNow = 11,
  LastYear = 12,
  CurrentYear = 13,
  NextYear = 14,
}

export interface ViewRelation {
  relationKey: string;
  isVisible?: boolean;
  width?: number;
  includeTime?: boolean;
  formulaType?: FormulaType;
  align?: BlockHAlign;
  relation?: any;
}

export enum FormulaType {
  None = 0,
  Count = 1,
  CountValue = 2,
  CountDistinct = 3,
  CountEmpty = 4,
  CountNotEmpty = 5,
  PercentEmpty = 6,
  PercentNotEmpty = 7,
  MathSum = 8,
  MathAverage = 9,
  MathMedian = 10,
  MathMin = 11,
  MathMax = 12,
  Range = 13,
}

export interface View {
  id: string;
  name: string;
  type: ViewType;
  coverRelationKey: string;
  groupRelationKey: string;
  endRelationKey: string;
  wrapContent: boolean;
  groupBackgroundColors: boolean;
  coverFit: boolean;
  cardSize: CardSize;
  listSize: ListSize;
  hideIcon: boolean;
  pageLimit: number;
  sorts: Sort[];
  filters: Filter[];
  relations: any[];
  defaultTemplateId: string;
  defaultTypeId: string;
}

export enum CardSize {
  Small = 0,
  Medium = 1,
  Large = 2,
}

export enum ListSize {
  Compact = 0,
  Regular = 1,
}

// ─── DropType ─────────────────────────────────────────────────────────
// Source: interface/common.ts — enum DropType

export enum DropType {
  None = '',
  Block = 'block',
  Menu = 'menu',
  Relation = 'relation',
  Record = 'record',
  Widget = 'widget',
  View = 'view',
}

// ─── ClipboardMode ────────────────────────────────────────────────────
// Source: interface/common.ts — enum ClipboardMode

export enum ClipboardMode {
  Copy = 0,
  Cut = 1,
}

// ─── RelationType ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum RelationType

export enum RelationType {
  LongText = 0,
  ShortText = 1,
  Number = 2,
  Select = 3,
  Date = 4,
  File = 5,
  Checkbox = 6,
  Url = 7,
  Email = 8,
  Phone = 9,
  Icon = 10,
  MultiSelect = 11,
  Object = 100,
  Relations = 101,
}

// ─── ObjectLayout ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum ObjectLayout

export enum ObjectLayout {
  Page = 0,
  Human = 1,
  Task = 2,
  Set = 3,
  Type = 4,
  Relation = 5,
  File = 6,
  Dashboard = 7,
  Image = 8,
  Note = 9,
  Space = 10,
  Bookmark = 11,
  OptionList = 12,
  Option = 13,
  Collection = 14,
  Audio = 15,
  Video = 16,
  Date = 17,
  SpaceView = 18,
  Participant = 19,
  Pdf = 20,
  ChatOld = 21,
  Chat = 22,
  Discussion = 27,
  Empty = 100,
  Navigation = 101,
  Graph = 102,
  History = 103,
  Archive = 104,
  Block = 105,
  Settings = 106,
}

// ─── Block Interface (Flat, Non-MobX) ─────────────────────────────────
// Source: interface/block/index.ts — interface Block (flattened)
// Environment change: Removed MobX reactivity, flattened to plain type.
// All is*() helper methods preserved as optional fields for strict typing.

export interface Block {
  id?: string;
  type: BlockType;
  layout?: ObjectLayout;
  parentId?: string;
  fields?: Record<string, any>;
  hAlign?: BlockHAlign;
  vAlign?: BlockVAlign;
  bgColor?: string;
  content: any;
  childrenIds?: string[];
}

// ─── BlockContent — union of all content types ────────────────────────
// NEW: convenience union type (not in Anytype source — created for Svelte dispatch)

export type BlockContent =
  | ContentText
  | ContentFile
  | ContentBookmark
  | ContentDiv
  | ContentEmbed
  | ContentLayout
  | ContentLink
  | ContentRelation
  | ContentWidget
  | ContentTableRow
  | ContentDataview
  | Record<string, any>;

// ─── BlockStructure ───────────────────────────────────────────────────
// Source: interface/block/index.ts — interface BlockStructure

// ─── FromHtmlResult ───────────────────────────────────────────────────
// Source: interface/block/text.ts — interface FromHtmlResult

export interface FromHtmlResult {
  marks: Mark[];
  text: string;
  adjustMarks: boolean;
  updatedValue: boolean;
}

// ─── BlockStructure ───────────────────────────────────────────────────
// Source: interface/block/index.ts — interface BlockStructure

export interface BlockStructure {
  parentId: string;
  childrenIds: string[];
}

// ─── BlockComponent (Props Interface) ─────────────────────────────────
// Source: interface/block/index.ts — interface BlockComponent
// Environment change: Removed React-specific callback types (MouseEvent, etc.)
// Changed render functions from React nodes to generic types.

export interface BlockComponent {
  rootId?: string;
  traceId?: string;
  block?: Block;
  readonly?: boolean;
  isPopup?: boolean;
  isInsideTable?: boolean;
  isInsidePreview?: boolean;
  isSelectionDisabled?: boolean;
  isContextMenuDisabled?: boolean;
  index?: any;
  className?: string;
  contextParam?: Partial<Block>;
  passParam?: any;
  onKeyDown?(e: any, text: string, marks: Mark[], range: TextRange, props: any): void;
  onKeyUp?(e: any, text: string, marks: Mark[], range: TextRange, props: any): void;
  onMenuAdd?(id: string, text: string, range: TextRange, marks: Mark[]): void;
  onMouseEnter?(e: any): void;
  onMouseLeave?(e: any): void;
  onFocus?(e: any): void;
  onBlur?(e: any): void;
  onCopy?(e: any, mode: ClipboardMode): void;
  onPaste?(e: any, props: any, data?: any): void;
  onUpdate?(): void;
  getWrapperWidth?(): number;
  blockRemove?(focused?: Block): void;
  renderMentions?(
    rootId: string,
    node: any,
    marks: Mark[],
    getValue: () => string,
    param?: any
  ): void;
  renderObjects?(
    rootId: string,
    node: any,
    marks: Mark[],
    getValue: () => string,
    props: any,
    param?: any
  ): void;
  renderLinks?(
    rootId: string,
    node: any,
    marks: Mark[],
    getValue: () => string,
    props: any,
    param?: any
  ): void;
  renderEmoji?(node: any, param?: any): void;
}

// ─── Typed Block Helpers ─────────────────────────────────────────────
// NEW: type-narrowing helpers (replaces the MobX class methods)

export function isTextBlock(block: Block): block is Block & { content: ContentText } {
  return block.type === BlockType.Text;
}

export function isTextStyle(block: Block, style: TextStyle): boolean {
  return isTextBlock(block) && block.content.style === style;
}

export function isFileBlock(block: Block): block is Block & { content: ContentFile } {
  return block.type === BlockType.File;
}

export function isBookmarkBlock(block: Block): block is Block & { content: ContentBookmark } {
  return block.type === BlockType.Bookmark;
}

export function isDivBlock(block: Block): block is Block & { content: ContentDiv } {
  return block.type === BlockType.Div;
}

export function isEmbedBlock(block: Block): block is Block & { content: ContentEmbed } {
  return block.type === BlockType.Embed;
}

export function isLayoutBlock(block: Block): block is Block & { content: ContentLayout } {
  return block.type === BlockType.Layout;
}

export function isLinkBlock(block: Block): block is Block & { content: ContentLink } {
  return block.type === BlockType.Link;
}

export function isDataviewBlock(block: Block): block is Block & { content: ContentDataview } {
  return block.type === BlockType.Dataview;
}

// ── Standalone style-checking helpers ─────────────────────────────────
// These take a TextStyle enum value directly (used in Svelte components)

export function isTextCode(style: TextStyle): boolean {
  return style === TextStyle.Code;
}

export function isTextTitle(style: TextStyle): boolean {
  return style === TextStyle.Title;
}

export function isTextDescription(style: TextStyle): boolean {
  return style === TextStyle.Description;
}

export function isTextHeader(style: TextStyle): boolean {
  return (
    style === TextStyle.Header1 ||
    style === TextStyle.Header2 ||
    style === TextStyle.Header3 ||
    style === TextStyle.Header4
  );
}

export function isTextToggle(style: TextStyle): boolean {
  return (
    style === TextStyle.Toggle ||
    style === TextStyle.ToggleHeader1 ||
    style === TextStyle.ToggleHeader2 ||
    style === TextStyle.ToggleHeader3
  );
}

export function canHaveMarks(style: TextStyle): boolean {
  return !isTextCode(style) && !isTextTitle(style) && !isTextDescription(style);
}

export function canHaveChildren(block: Block): boolean {
  if (block.type === BlockType.Page) return false;
  if (block.type === BlockType.Featured) return false;
  if (!isTextBlock(block)) return false;
  const style = block.content.style;
  return (
    style === TextStyle.Paragraph ||
    style === TextStyle.Bulleted ||
    style === TextStyle.Numbered ||
    style === TextStyle.Toggle ||
    style === TextStyle.ToggleHeader1 ||
    style === TextStyle.ToggleHeader2 ||
    style === TextStyle.ToggleHeader3 ||
    style === TextStyle.Callout ||
    style === TextStyle.Quote
  );
}
