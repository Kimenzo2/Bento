// ═══════════════════════════════════════════════════════════════════════
// EDITOR-STATE — Svelte 5 runes port of Anytype's MobX observable pattern
//
// Anytype uses MobX `@observable` on a class so that each field has its
// own dependency tracking.  Here we use Svelte 5 module-level `$state`
// runes which give the same granularity: components that only read
// `rootBlocks` re-run only when the rootChildren or blocks change, NOT
// when the entire store changes.
//
// Architecture (mapped from anytype-ts/src/ts/store/block.ts):
//   MobX @observable  →  $state           (reactive fields)
//   MobX @computed    →  $derived         (derived values)
//   MobX @action      →  exported fn      (sync mutations)
//   makeObservable()  →  handled by runes  (automatic)
// ═══════════════════════════════════════════════════════════════════════

import { invoke } from '@tauri-apps/api/core';
import { SvelteMap } from 'svelte/reactivity';
import type { Block, ContentText, TextStyle, Mark, TextRange } from './block';
import { BlockType as BT, TextStyle as TS, MarkType, isTextBlock } from './block';

// ─── Interface types ─────────────────────────────────────────────────

type TypeDef = { id: string; name: string; layout: string; icon: string; description: string };
type RelationDef = { id: string; key: string; name: string; type: number; format: string };
interface BlockRow {
  id: string;
  objectId: string;
  parentId?: string | null;
  type: string;
  content: string;
  fields: string;
  align: number;
  bgColor: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}
interface NoteWithBlocks {
  note: {
    id: string;
    title: string;
    icon?: string | null;
    cover?: string | null;
    layout: string;
    pinned: boolean;
    tags: string[];
    isArchived: boolean;
    details: unknown;
    createdAt: number;
    updatedAt: number;
  };
  blocks: BlockRow[];
}

// ─── Parsing helpers ─────────────────────────────────────────────────

function parseContentText(s: string): ContentText {
  try {
    const p = JSON.parse(s);
    return {
      text: p.text ?? '',
      style: normStyle(p.style),
      marks: p.marks ?? [],
      checked: p.checked ?? false,
      color: p.color ?? '',
      iconEmoji: p.iconEmoji ?? '',
      iconImage: p.iconImage ?? '',
    };
  } catch {
    return {
      text: '',
      style: TS.Paragraph,
      marks: [],
      checked: false,
      color: '',
      iconEmoji: '',
      iconImage: '',
    };
  }
}
function normStyle(style: unknown): TextStyle {
  if (typeof style === 'number') return style as TextStyle;
  if (typeof style === 'string') {
    const n = Number(style);
    if (Number.isFinite(n)) return n as TextStyle;
    const m: Record<string, TextStyle> = {
      paragraph: TS.Paragraph,
      header1: TS.Header1,
      h1: TS.Header1,
      header2: TS.Header2,
      h2: TS.Header2,
      header3: TS.Header3,
      h3: TS.Header3,
      header4: TS.Header4,
      h4: TS.Header4,
      quote: TS.Quote,
      code: TS.Code,
      title: TS.Title,
      checkbox: TS.Checkbox,
      todo: TS.Checkbox,
      bulleted: TS.Bulleted,
      bullet: TS.Bulleted,
      numbered: TS.Numbered,
      toggle: TS.Toggle,
      description: TS.Description,
      callout: TS.Callout,
      toggleheader1: TS.ToggleHeader1,
      toggleheader2: TS.ToggleHeader2,
      toggleheader3: TS.ToggleHeader3,
    };
    return m[style.toLowerCase()] ?? TS.Paragraph;
  }
  return TS.Paragraph;
}
function rowToBlock(row: BlockRow): Block {
  return {
    id: row.id,
    type: row.type as any,
    parentId: row.parentId ?? undefined,
    content: parseContentText(row.content),
    childrenIds: [],
    bgColor: row.bgColor || undefined,
    fields: row.fields ? tryJson(row.fields) : undefined,
  };
}
function tryJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
function mkContent(text: string, style: TextStyle, marks?: Mark[], checked?: boolean) {
  return {
    text,
    style,
    marks: marks ?? [],
    checked: checked ?? false,
    color: '',
    iconEmoji: '',
    iconImage: '',
  };
}

const SYSTEM_TYPES: TypeDef[] = [
  { id: 'type-note', name: 'Note', layout: 'note', icon: '📄', description: 'Rich text document' },
  { id: 'type-task', name: 'Task', layout: 'task', icon: '✅', description: 'Task' },
  {
    id: 'type-journal',
    name: 'Journal',
    layout: 'journal',
    icon: '📓',
    description: 'Daily journal',
  },
  { id: 'type-set', name: 'Set', layout: 'set', icon: '📁', description: 'Collection' },
  {
    id: 'type-bookmark',
    name: 'Bookmark',
    layout: 'bookmark',
    icon: '🔖',
    description: 'Saved link',
  },
];
const SYSTEM_RELATIONS: RelationDef[] = [
  { id: 'rel-tags', key: 'tags', name: 'Tags', type: 11, format: 'multiSelect' },
  { id: 'rel-priority', key: 'priority', name: 'Priority', type: 3, format: 'select' },
  { id: 'rel-dueDate', key: 'dueDate', name: 'Due Date', type: 4, format: 'date' },
  { id: 'rel-status', key: 'status', name: 'Status', type: 3, format: 'select' },
  { id: 'rel-assignee', key: 'assignee', name: 'Assignee', type: 5, format: 'object' },
];

// ═══════════════════════════════════════════════════════════════════════
// MODULE-LEVEL $STATE — Anytype's MobX observables ported to Svelte 5 runes
//
// These are never reassigned as a whole — only mutated in-place.
// This is exactly equivalent to Anytype's:
//   @observable blockMap: Map<string, Block>
//   @observable rootChildren: string[]
// ═══════════════════════════════════════════════════════════════════════

/** Reactive block map — Anytype's `@observable blockMap` */
let blocks = $state<Map<string, Block>>(new SvelteMap());

/** Root-level block order — Anytype's tree ordering */
let rootChildren = $state<string[]>([]);

/** Currently focused block */
let focusedId = $state<string | null>(null);

/** Title block detection */
let titleBlockId = $state<string | null>(null);
let descriptionBlockId = $state<string | null>(null);

/** Current object being edited */
let objectId = $state<string | null>(null);

/** Loading/loaded state */
let loaded = $state(false);
let loading = $state(false);

// ═══════════════════════════════════════════════════════════════════════
// $DERIVED — Anytype's @computed values ported to Svelte 5 runes
//
// These re-evaluate ONLY when their specific dependencies change.
// `rootBlocks` only depends on `rootChildren` and `blocks.get(id)` calls.
// `titleBlock` only depends on `titleBlockId` and `blocks.get()`.
// This is the exact same granularity as Anytype's MobX @computed.
// ═══════════════════════════════════════════════════════════════════════

/** Derived: root-level blocks in order — Anytype's `@computed get rootBlocks()` */
const _rootBlocks: Block[] = $derived(
  rootChildren.map((id) => blocks.get(id)).filter((b): b is Block => !!b)
);
export function getRootBlocks(): Block[] {
  return _rootBlocks;
}

/** Derived: title block — Anytype's `@computed get titleBlock()` */
const _titleBlock: Block | null = $derived(
  titleBlockId ? (blocks.get(titleBlockId) ?? null) : null
);
export function getTitleBlock(): Block | null {
  return _titleBlock;
}

/** Derived: focused block — Anytype's `@computed get focusedBlock()` */
const _focusedBlock: Block | null = $derived(focusedId ? (blocks.get(focusedId) ?? null) : null);
export function getFocusedBlock(): Block | null {
  return _focusedBlock;
}

/** Derived: loading state */
const _isEditorLoading: boolean = $derived(loading);
export function getIsEditorLoading(): boolean {
  return _isEditorLoading;
}

/** Derived: loaded state */
const _isEditorLoaded: boolean = $derived(loaded);
export function getIsEditorLoaded(): boolean {
  return _isEditorLoaded;
}

/** Toggle open/closed state — kept in a plain Map (not reactive), updated via revision counter */
const toggleOpenState = new Map<string, boolean>();
let toggleRevision = $state(0);

/** Toggle state version — increments whenever any toggle opens/closes */
const _toggleStateVersion: number = $derived(toggleRevision);
export function getToggleStateVersion(): number {
  return _toggleStateVersion;
}

// ═══════════════════════════════════════════════════════════════════════
// NON-REACTIVE STATE — live text cache, pending saves, race guards
// These don't need Svelte reactivity; they're internal plumbing.
// ═══════════════════════════════════════════════════════════════════════

const liveText = new Map<string, { text: string; marks: Mark[] }>();
const pendingSaves = new Map<string, { text: string; marks?: Mark[]; noteId: string }>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let flushingSaves: Promise<void> | null = null;
let pendingInitId: string | null = null;

// ═══════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════

async function flushSaves() {
  if (flushingSaves) return flushingSaves;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSaves.size === 0) return;

  const entries = [...pendingSaves.entries()];
  pendingSaves.clear();

  flushingSaves = Promise.all(
    entries.map(([blockId, { text, marks, noteId }]) =>
      invoke('notes_set_text_content', { noteId, blockId, text, marks: marks ?? [] }).catch((e) =>
        console.error('[editor-state] flush failed', e)
      )
    )
  ).then(() => {
    flushingSaves = null;
  });

  return flushingSaves;
}

function scheduleSave(blockId: string, text: string, marks: Mark[] | undefined, noteId: string) {
  pendingSaves.set(blockId, { text, marks, noteId });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushSaves();
  }, 250);
}

function getCurrentObjectId(): string {
  return objectId ?? '';
}

// ═══════════════════════════════════════════════════════════════════════
// MUTATIONS — Anytype's @action methods ported to exported functions
// ═══════════════════════════════════════════════════════════════════════

/**
 * Apply row data from the backend into the reactive state.
 * Anytype equivalent: the block store's `applyBlockRows()` action that
 * replaces `this.blockMap` in-place.
 */
function applyRows(newObjectId: string, rows: BlockRow[]) {
  const newBlocks = new SvelteMap<string, Block>();
  const newRootChildren: string[] = [];
  const byParent = new Map<string, string[]>();
  let tid: string | null = null;
  let did: string | null = null;
  const posMap = new Map<string, number>();

  for (const row of rows) {
    posMap.set(row.id, row.position);
    const b = rowToBlock(row);
    newBlocks.set(b.id!, b);
    if (!row.parentId) {
      newRootChildren.push(b.id!);
    } else {
      if (!byParent.has(row.parentId)) byParent.set(row.parentId, []);
      byParent.get(row.parentId)!.push(b.id!);
    }
    if (b.content && 'style' in b.content) {
      const ct = b.content as ContentText;
      if (ct.style === TS.Title && !tid) tid = b.id!;
      else if (ct.style === TS.Description && !did) did = b.id!;
    }
  }

  for (const [pid, cids] of byParent) {
    const p = newBlocks.get(pid);
    if (p) {
      cids.sort((a, b) => (posMap.get(a) ?? 0) - (posMap.get(b) ?? 0));
      newBlocks.set(pid, { ...p, childrenIds: cids });
    }
  }

  newRootChildren.sort((a, b) => (posMap.get(a) ?? 0) - (posMap.get(b) ?? 0));

  // Assign new Maps/arrays — $state will propagate changes granularly
  blocks = newBlocks;
  rootChildren = newRootChildren;
  titleBlockId = tid;
  descriptionBlockId = did;
  objectId = newObjectId;
}

/** Read a journal entry from localStorage by ID (fallback for when Tauri backend is unavailable). */
function getJournalEntryFromLocalStorage(id: string): {
  id: string;
  date: string;
  blocks: string;
  wordCount: number;
  mood: string | null;
  createdAt: number;
  updatedAt: number;
} | null {
  try {
    const raw = localStorage.getItem(`journal:id:${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Init empty state (local fallback).
 */
function initEmpty(newObjectId: string) {
  const tid = crypto.randomUUID();
  const pid = crypto.randomUUID();
  const newBlocks = new SvelteMap<string, Block>();
  newBlocks.set(tid, {
    id: tid,
    type: BT.Text,
    childrenIds: [],
    content: mkContent('', TS.Title) as ContentText,
  });
  newBlocks.set(pid, {
    id: pid,
    type: BT.Text,
    childrenIds: [],
    content: mkContent('', TS.Paragraph) as ContentText,
  });
  blocks = newBlocks;
  rootChildren = [tid, pid];
  titleBlockId = tid;
  descriptionBlockId = null;
  objectId = newObjectId;
  loaded = true;
  loading = false;
}

/**
 * Init the editor for a given object — Anytype's `page.tsx useEffect([rootId])`.
 * @param forceEmpty — when true, skip backend fetch and start with a blank document immediately.
 */
export async function init(
  objectIdParam: string,
  source: 'notes' | 'journal' = 'notes',
  forceEmpty = false
) {
  pendingInitId = objectIdParam;
  const cur = () => pendingInitId === objectIdParam;
  await flushSaves();
  liveText.clear();
  if (!cur()) return;

  objectId = objectIdParam;
  loading = true;
  loaded = false;
  if (!cur()) return;

  // When forceEmpty, skip the backend fetch entirely — start with a blank document.
  if (forceEmpty) {
    initEmpty(objectIdParam);
    return;
  }

  try {
    if (source === 'journal') {
      // Try Tauri backend first — objectIdParam is now a UUID, so use `id`
      const journalEntry: {
        id: string;
        date: string;
        blocks: string;
        wordCount: number;
        mood: string | null;
        createdAt: number;
        updatedAt: number;
      } | null = await invoke('get_journal_entry', { id: objectIdParam });
      if (!cur()) return;
      if (journalEntry?.blocks) {
        try {
          const p: any[] = JSON.parse(journalEntry.blocks);
          if (Array.isArray(p) && p.length > 0) {
            const fakeRows: BlockRow[] = p.map((b, i) => ({
              id: b.id ?? crypto.randomUUID(),
              objectId: objectIdParam,
              parentId: null,
              type: b.type ?? 'text',
              content:
                typeof b.content === 'string'
                  ? b.content
                  : JSON.stringify(b.content ?? { text: '', style: 0, marks: [], checked: false }),
              fields: '{}',
              align: 0,
              bgColor: '',
              position: i,
              createdAt: 0,
              updatedAt: 0,
            }));
            if (!cur()) return;
            applyRows(objectIdParam, fakeRows);
            if (!cur()) return;
            loading = false;
            loaded = true;
            return;
          }
        } catch {
          /* fall through */
        }
      }
      // If backend returned nothing, try localStorage fallback (keyed by UUID now)
      if (!cur()) return;
      const fallbackEntry = getJournalEntryFromLocalStorage(objectIdParam);
      if (!cur()) return;
      if (fallbackEntry?.blocks) {
        try {
          const p: any[] = JSON.parse(fallbackEntry.blocks);
          if (Array.isArray(p) && p.length > 0) {
            const fakeRows: BlockRow[] = p.map((b, i) => ({
              id: b.id ?? crypto.randomUUID(),
              objectId: objectIdParam,
              parentId: null,
              type: b.type ?? 'text',
              content:
                typeof b.content === 'string'
                  ? b.content
                  : JSON.stringify(b.content ?? { text: '', style: 0, marks: [], checked: false }),
              fields: '{}',
              align: 0,
              bgColor: '',
              position: i,
              createdAt: 0,
              updatedAt: 0,
            }));
            if (!cur()) return;
            applyRows(objectIdParam, fakeRows);
            if (!cur()) return;
            loading = false;
            loaded = true;
            return;
          }
        } catch {
          /* fall through */
        }
      }
      if (!cur()) return;
      initEmpty(objectIdParam);
      return;
    }

    const full = await invoke<NoteWithBlocks>('notes_object_full', { noteId: objectIdParam });
    if (!cur()) return;

    if (full.blocks.length === 0) {
      initEmpty(objectIdParam);
    } else {
      applyRows(objectIdParam, full.blocks);
    }
    if (!cur()) return;
    loading = false;
    loaded = true;
  } catch (e) {
    if (!cur()) return;
    console.error('[editor-state] init failed:', e);
    initEmpty(objectIdParam);
  }
}

/** Focus a block */
export function focusBlock(id: string) {
  focusedId = id;
}

/** Blur (clear focus) */
export function blurBlock() {
  focusedId = null;
}

// ─── Text write-through cache (NO reactive update on keystrokes) ─────

/** Persist text to the live cache + debounced backend save */
export async function persistBlockText(blockId: string, text: string, marks?: Mark[]) {
  liveText.set(blockId, { text, marks: marks ?? [] });
  scheduleSave(blockId, text, marks, getCurrentObjectId());
}

/**
 * Sync live text back into the reactive $state blocks map.
 * Called only at structured points (blur, enter, slash), not on every keystroke.
 * Anytype equivalent: `textBlock.setText()` → triggers @computed re-evaluations.
 */
export function syncBlockTextToStore(blockId: string) {
  const live = liveText.get(blockId);
  if (!live) return;
  const block = blocks.get(blockId);
  if (!block || !isTextBlock(block)) return;
  const ct = block.content as ContentText;
  if (ct.text === live.text) return;

  // Mutate the block in-place to trigger derived re-evaluations
  blocks.set(blockId, { ...block!, content: { ...ct, text: live.text, marks: live.marks } });
}

/** Set block text (alias for persistBlockText) */
export async function setBlockText(id: string, text: string, marks?: Mark[]) {
  await persistBlockText(id, text, marks);
}

/** Flush pending saves */
export async function flushPendingSaves() {
  await flushSaves();
}

// ─── Marks ────────────────────────────────────────────────────────────

export async function toggleMark(
  blockId: string,
  markType: MarkType,
  range: TextRange,
  param?: string
) {
  const block = blocks.get(blockId);
  if (!block || !isTextBlock(block)) return;
  const ct = block.content as ContentText;
  let marks = [...(ct.marks ?? [])];
  const ei = marks.findIndex(
    (m) => m.type === markType && m.range.from === range.from && m.range.to === range.to
  );
  if (ei >= 0) marks.splice(ei, 1);
  else {
    marks = marks.filter(
      (m) => m.type !== markType || !(m.range.from < range.to && m.range.to > range.from)
    );
    marks.push({ type: markType, range, param });
  }
  marks.sort((a, b) => a.range.from - b.range.from);

  blocks.set(blockId, { ...block!, content: { ...ct, marks } });

  try {
    await invoke('notes_set_text_content', {
      noteId: getCurrentObjectId(),
      blockId,
      text: ct.text,
      marks,
    });
  } catch (e) {
    console.error('[editor-state] toggleMark', e);
  }
}

export async function applyMarkToSelection(blockId: string, markType: MarkType) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
  if (!el) return;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const from = pre.toString().length;
  const to = from + r.toString().length;
  if (from === to) return;
  await toggleMark(blockId, markType, { from, to });
}

export function hasMarkAtSelection(blockId: string, markType: MarkType): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
  if (!el) return false;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const from = pre.toString().length;
  const to = from + r.toString().length;
  if (from === to) return false;
  const block = blocks.get(blockId);
  if (!block || !isTextBlock(block)) return false;
  return ((block.content as ContentText).marks ?? []).some(
    (m) => m.type === markType && m.range.from <= from && m.range.to >= to
  );
}

// ─── Block mutations ──────────────────────────────────────────────────

export async function setBlockChecked(blockId: string, checked: boolean) {
  const b = blocks.get(blockId);
  if (!b || !isTextBlock(b)) return;
  const ct = b.content as ContentText;
  blocks.set(blockId, { ...b!, content: { ...ct, checked } });
  try {
    await invoke('notes_set_text_checked', { noteId: getCurrentObjectId(), blockId, checked });
  } catch (e) {
    console.error('[editor-state] setBlockChecked', e);
  }
}

export async function convertBlockStyle(blockId: string, newStyle: TextStyle) {
  const b = blocks.get(blockId);
  if (!b || !isTextBlock(b)) return;
  const ct = b.content as ContentText;

  // Update title/description tracking
  const styleNum = Number(newStyle);
  if (styleNum === TS.Title) {
    titleBlockId = blockId;
  } else if (titleBlockId === blockId && styleNum !== TS.Title) {
    titleBlockId = null;
  }
  if (styleNum === TS.Description) {
    descriptionBlockId = blockId;
  } else if (descriptionBlockId === blockId && styleNum !== TS.Description) {
    descriptionBlockId = null;
  }

  blocks.set(blockId, { ...b!, content: { ...ct, style: newStyle } });
  try {
    await invoke('notes_set_text_style', {
      noteId: getCurrentObjectId(),
      blockIds: [blockId],
      style: String(newStyle),
    });
  } catch (e) {
    console.error('[editor-state] convertBlockStyle', e);
  }
}

export async function addBlock(
  afterId?: string,
  text = '',
  style: TextStyle = TS.Paragraph
): Promise<string> {
  const oid = objectId;
  if (!oid) return '';
  const children = rootChildren;
  let position = children.length;
  if (afterId) {
    const idx = children.indexOf(afterId);
    if (idx !== -1) position = idx + 1;
  }
  try {
    const result: BlockRow = await invoke('notes_block_create', {
      params: {
        noteId: oid,
        parentId: null,
        targetId: afterId ?? null,
        blockType: 'text',
        content: mkContent(text, style),
        position,
        align: 0,
        bgColor: null,
      },
    });
    const newBlock = rowToBlock(result);
    const newId = newBlock.id!;
    blocks.set(newId, newBlock);
    if (afterId) {
      const idx = rootChildren.indexOf(afterId);
      if (idx !== -1) rootChildren.splice(idx + 1, 0, newId);
      else rootChildren.push(newId);
    } else rootChildren.push(newId);
    return newId;
  } catch (e) {
    console.error('[editor-state] addBlock', e);
    return '';
  }
}

export async function deleteBlock(blockId: string) {
  if (titleBlockId === blockId || descriptionBlockId === blockId) return;
  const oid = objectId;
  if (!oid) return;
  const childIds = blocks.get(blockId)?.childrenIds ?? [];
  blocks.delete(blockId);
  for (const c of childIds) blocks.delete(c);
  for (let i = rootChildren.length - 1; i >= 0; i--) {
    if (rootChildren[i] === blockId || childIds.includes(rootChildren[i])) {
      rootChildren.splice(i, 1);
    }
  }
  if (focusedId === blockId) focusedId = null;
  try {
    await invoke('notes_block_unlink', { noteId: oid, blockIds: [blockId, ...childIds] });
  } catch (e) {
    console.error('[editor-state] deleteBlock', e);
  }
}

export async function moveBlock(blockId: string, newIndex: number) {
  const oid = objectId;
  if (!oid) return;
  const idx = rootChildren.indexOf(blockId);
  if (idx === -1) return;
  rootChildren.splice(idx, 1);
  rootChildren.splice(Math.min(newIndex, rootChildren.length), 0, blockId);
  try {
    await invoke('notes_block_move', {
      params: { noteId: oid, blockIds: [blockId], targetParentId: null, position: newIndex },
    });
  } catch (e) {
    console.error('[editor-state] moveBlock', e);
  }
}

export async function duplicateBlock(blockId: string): Promise<string> {
  const oid = objectId;
  if (!oid || !blocks.get(blockId)) return '';
  try {
    const rows = await invoke<BlockRow[]>('notes_block_duplicate', {
      params: { noteId: oid, blockIds: [blockId], targetId: blockId },
    });
    const first = rows[0];
    if (!first) return '';
    const nb2 = rowToBlock(first);
    blocks.set(nb2.id!, nb2);
    const idx = rootChildren.indexOf(blockId);
    if (idx >= 0) rootChildren.splice(idx + 1, 0, nb2.id!);
    else rootChildren.push(nb2.id!);
    return nb2.id!;
  } catch (e) {
    console.error('[editor-state] duplicateBlock', e);
    return '';
  }
}

export async function addChildBlock(
  parentId: string,
  text = '',
  style: TextStyle = TS.Paragraph
): Promise<string> {
  const oid = objectId;
  if (!oid) return '';
  const position = (blocks.get(parentId)?.childrenIds ?? []).length;
  try {
    const result: BlockRow = await invoke('notes_block_create', {
      params: {
        noteId: oid,
        parentId,
        targetId: null,
        blockType: 'text',
        content: mkContent(text, style),
        position,
        align: 0,
        bgColor: null,
      },
    });
    const nb2 = rowToBlock(result);
    const newId = nb2.id!;
    blocks.set(newId, nb2);
    const ep = blocks.get(parentId);
    if (ep) blocks.set(parentId, { ...ep, childrenIds: [...(ep.childrenIds ?? []), newId] });
    return newId;
  } catch (e) {
    console.error('[editor-state] addChildBlock', e);
    return '';
  }
}

export async function setBlockColor(blockId: string, color: string) {
  const b = blocks.get(blockId);
  if (!b || !isTextBlock(b)) return;
  const ct = b.content as ContentText;
  blocks.set(blockId, { ...b!, content: { ...ct, color } });
  try {
    await invoke('notes_set_text_color', {
      noteId: getCurrentObjectId(),
      blockIds: [blockId],
      color,
    });
  } catch (e) {
    console.error('[editor-state] setBlockColor', e);
  }
}

export async function setBlockBgColor(blockId: string, bgColor: string) {
  const b = blocks.get(blockId);
  if (!b) return;
  blocks.set(blockId, { ...b!, bgColor: bgColor === 'default' ? undefined : bgColor });
  try {
    await invoke('notes_set_background_color', {
      noteId: getCurrentObjectId(),
      blockIds: [blockId],
      color: bgColor,
    });
  } catch (e) {
    console.error('[editor-state] setBlockBgColor', e);
  }
}

export async function setBlockAlign(blockId: string, align: string) {
  const aMap: Record<string, number> = { left: 0, center: 1, right: 2, justify: 3 };
  const b = blocks.get(blockId);
  if (b) {
    blocks.set(blockId, { ...b, fields: { ...(b.fields ?? {}), hAlign: align } });
  }
  try {
    await invoke('notes_set_align', {
      noteId: getCurrentObjectId(),
      blockIds: [blockId],
      align: aMap[align] ?? 0,
    });
  } catch (e) {
    console.error('[editor-state] setBlockAlign', e);
  }
}

export async function clearBlockStyle(blockId: string) {
  const b = blocks.get(blockId);
  if (!b || !isTextBlock(b)) return;
  const ct = b.content as ContentText;
  blocks.set(blockId, { ...b!, content: { ...ct, marks: [], color: '' } });
  try {
    await invoke('notes_clear_text_style', { noteId: getCurrentObjectId(), blockIds: [blockId] });
  } catch (e) {
    console.error('[editor-state] clearBlockStyle', e);
  }
}

// ─── Read helpers (snapshot access for imperative contexts) ──────────

export function getBlock(id: string): Block | undefined {
  return blocks.get(id);
}

export function getChildren(): Block[] {
  return rootChildren.map((id) => blocks.get(id)).filter((b): b is Block => !!b);
}

export function getBlockChildren(pid: string): Block[] {
  const p = blocks.get(pid);
  if (!p) return [];
  return (p.childrenIds ?? []).map((id) => blocks.get(id)).filter((b): b is Block => !!b);
}

/** Get current objectId — for imperative use */
export function getObjectId(): string {
  return objectId ?? '';
}

// ─── Toggle state ─────────────────────────────────────────────────────

export function isToggleOpen(id: string): boolean {
  return toggleOpenState.get(id) ?? false;
}

export function setToggleOpen(id: string, open: boolean) {
  if (toggleOpenState.get(id) === open) return;
  toggleOpenState.set(id, open);
  toggleRevision++;
}

// ─── System types ─────────────────────────────────────────────────────

export function getSystemTypes() {
  return SYSTEM_TYPES;
}
export function getSystemRelations() {
  return SYSTEM_RELATIONS;
}
export function getTypeById(id: string) {
  return SYSTEM_TYPES.find((t) => t.id === id);
}

// ─── Clear blocks (used by JournalEditor) ────────────────────────────

export function clearBlocks() {
  const pid = crypto.randomUUID();
  const newBlocks = new SvelteMap<string, Block>();
  newBlocks.set(pid, {
    id: pid,
    type: BT.Text,
    childrenIds: [],
    content: mkContent('', TS.Paragraph) as ContentText,
  });
  blocks = newBlocks;
  rootChildren = [pid];
  focusedId = null;
}

// ─── `editorStore` wrapper object — backward-compat for method calls ────
// Anytype equivalent: the store instance that holds all @action methods.

export const editorStore = {
  init,
  focusBlock,
  blurBlock,
  setBlockText,
  setBlockChecked,
  convertBlockStyle,
  toggleMark,
  applyMarkToSelection,
  hasMarkAtSelection,
  addBlock,
  deleteBlock,
  moveBlock,
  duplicateBlock,
  addChildBlock,
  setBlockColor,
  setBlockBgColor,
  setBlockAlign,
  clearBlockStyle,
  persistBlockText,
  syncBlockTextToStore,
  flushPendingSaves,
  getBlock,
  getChildren,
  getBlockChildren,
  getObjectId,
  isToggleOpen,
  setToggleOpen,
  getSystemTypes,
  getSystemRelations,
  getTypeById,
  clearBlocks,
};

// ─── `blockById` — snapshot accessor for imperative contexts ────

export function blockById(id: string): Block | undefined {
  return blocks.get(id);
}
