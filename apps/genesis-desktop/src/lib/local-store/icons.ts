import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code2,
  List,
  ListOrdered,
  CheckSquare,
  ToggleLeft,
  Minus,
  Image,
  Link,
  Bookmark,
  Table,
  Layout,
  Columns,
  Grid3X3,
  File,
  Globe,
} from "lucide-svelte";
import type { ComponentType } from "svelte";
import type { TextStyle } from "./block";
import { TextStyle as TS } from "./block";

type IconComponent = ComponentType;

// ── Style icon map ──────────────────────────────────────────────────
// Maps Anytype TextStyle values to Lucide icons for the block toolbar

export const styleIconMap: Partial<Record<TextStyle, IconComponent>> = {
  [TS.Paragraph]: Type,
  [TS.Header1]: Heading1,
  [TS.Header2]: Heading2,
  [TS.Header3]: Heading3,
  [TS.Quote]: Quote,
  [TS.Code]: Code2,
  [TS.Bulleted]: List,
  [TS.Numbered]: ListOrdered,
  [TS.Checkbox]: CheckSquare,
  [TS.Toggle]: ToggleLeft,
  [TS.ToggleHeader1]: Heading1,
  [TS.ToggleHeader2]: Heading2,
  [TS.ToggleHeader3]: Heading3,
};

// ── Style label map ─────────────────────────────────────────────────
export const styleLabelMap: Partial<Record<TextStyle, string>> = {
  [TS.Paragraph]: "Paragraph",
  [TS.Header1]: "Heading 1",
  [TS.Header2]: "Heading 2",
  [TS.Header3]: "Heading 3",
  [TS.Header4]: "Heading 4",
  [TS.Quote]: "Quote",
  [TS.Code]: "Code",
  [TS.Title]: "Title",
  [TS.Checkbox]: "Checkbox",
  [TS.Bulleted]: "Bulleted",
  [TS.Numbered]: "Numbered",
  [TS.Toggle]: "Toggle",
  [TS.Description]: "Description",
  [TS.Callout]: "Callout",
  [TS.ToggleHeader1]: "Toggle Heading 1",
  [TS.ToggleHeader2]: "Toggle Heading 2",
  [TS.ToggleHeader3]: "Toggle Heading 3",
};

// ── Block type icon map ─────────────────────────────────────────────
// Maps Anytype BlockType values to Lucide icons
export const blockTypeIconMap: Partial<Record<string, IconComponent>> = {
  page: File,
  dataview: Grid3X3,
  text: Type,
  file: Image,
  bookmark: Bookmark,
  div: Minus,
  link: Link,
  relation: Columns,
  table: Table,
  tableRow: List,
  tableColumn: Columns,
  layout: Layout,
  widget: Grid3X3,
  chat: Globe,
};

// ── Block type label map ────────────────────────────────────────────
export const blockTypeLabelMap: Record<string, string> = {
  page: "Page",
  dataview: "Dataview",
  layout: "Layout",
  text: "Text",
  file: "File",
  bookmark: "Bookmark",
  div: "Divider",
  link: "Link",
  relation: "Relation",
  featured: "Featured",
  embed: "Embed",
  table: "Table",
  tableColumn: "Column",
  tableRow: "Row",
  tableOfContents: "Table of Contents",
  widget: "Widget",
  chat: "Chat",
  cover: "Cover",
  iconPage: "Icon",
  iconUser: "Icon",
};

// ── Style color suggestions ─────────────────────────────────────────
export const styleColorMap: Partial<Record<TextStyle, string>> = {
  [TS.Header1]: "var(--foreground)",
  [TS.Header2]: "var(--foreground)",
  [TS.Header3]: "var(--foreground)",
  [TS.Quote]: "var(--muted)",
  [TS.Code]: "var(--accent)",
  [TS.Callout]: "var(--primary)",
};

// ── Style font size suggestions (in rem) ────────────────────────────
export const styleFontSizeMap: Partial<Record<TextStyle, number>> = {
  [TS.Paragraph]: 1,
  [TS.Header1]: 1.8,
  [TS.Header2]: 1.5,
  [TS.Header3]: 1.25,
  [TS.Header4]: 1.1,
  [TS.Title]: 2.2,
  [TS.Quote]: 1,
  [TS.Code]: 0.9,
  [TS.Description]: 0.95,
  [TS.ToggleHeader1]: 1.8,
  [TS.ToggleHeader2]: 1.5,
  [TS.ToggleHeader3]: 1.25,
};

export const defaultStyle = TS.Paragraph;
