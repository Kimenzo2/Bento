import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Block, ContentText, TextStyle, Mark, TextRange } from './block';
import { BlockType as BT, TextStyle as TS, MarkType, isTextBlock } from './block';

// ── Types ───────────────────────────────────────────────────────────

type EditorStore = {
  blocks: Map<string, Block>;
  rootChildren: string[];
  focusedId: string | null;
  titleBlockId: string | null;
  descriptionBlockId: string | null;
  objectId: string | null;
  loaded: boolean;
  loading: boolean;
};

type TypeDef = {
  id: string;
  name: string;
  layout: string;
  icon: string;
  description: string;
};

type RelationDef = {
  id: string;
  key: string;
  name: string;
  type: number; // RelationType
  format: string;
};

/** Shape of a BlockRow returned from the Rust backend */
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

// ── System Types (Anytype-style type registry) ─────────────────────

const SYSTEM_TYPES: TypeDef[] = [
  { id: 'type-note', name: 'Note', layout: 'note', icon: '📄', description: 'Rich text document' },
  { id: 'type-task', name: 'Task', layout: 'task', icon: '✅', description: 'Task with due date and status' },
  { id: 'type-journal', name: 'Journal', layout: 'journal', icon: '📔', description: 'Daily journal entry' },
  { id: 'type-set', name: 'Set', layout: 'set', icon: '📊', description: 'Collection of objects' },
  { id: 'type-bookmark', name: 'Bookmark', layout: 'bookmark', icon: '🔖', description: 'Saved link' },
];

const SYSTEM_RELATIONS: RelationDef[] = [
  { id: 'rel-tags', key: 'tags', name: 'Tags', type: 11, format: 'multiSelect' },
  { id: 'rel-priority', key: 'priority', name: 'Priority', type: 3, format: 'select' },
  { id: 'rel-dueDate', key: 'dueDate', name: 'Due Date', type: 4, format: 'date' },
  { id: 'rel-status', key: 'status', name: 'Status', type: 3, format: 'select' },
  { id: 'rel-assignee', key: 'assignee', name: 'Assignee', type: 5, format: 'object' },
];

// ── Helpers ─────────────────────────────────────────────────────────

function parseContentText(contentStr: string): ContentText {
  try {
    const parsed = JSON.parse(contentStr);
    return {
      text: parsed.text ?? '',
      style: normalizeTextStyle(parsed.style),
      marks: parsed.marks ?? [],
      checked: parsed.checked ?? false,
      color: parsed.color ?? '',
      iconEmoji: parsed.iconEmoji ?? '',
      iconImage: parsed.iconImage ?? '',
    };
  } catch {
    return { text: '', style: TS.Paragraph, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' };
  }
}

function normalizeTextStyle(style: unknown): TextStyle {
  if (typeof style === 'number') return style as TextStyle;
  if (typeof style === 'string') {
    const numeric = Number(style);
    if (Number.isFinite(numeric)) return numeric as TextStyle;
    const map: Record<string, TextStyle> = {
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
    return map[style.toLowerCase()] ?? TS.Paragraph;
  }
  return TS.Paragraph;
}

function blockRowToBlock(row: BlockRow): Block {
  return {
    id: row.id,
    type: row.type as any,
    parentId: row.parentId ?? undefined,
    content: parseContentText(row.content),
    childrenIds: [],
    bgColor: row.bgColor || undefined,
    fields: row.fields ? tryParseJson(row.fields) : undefined,
  };
}

function tryParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

function buildContentPayload(
  text: string,
  style: TextStyle,
  marks?: Mark[],
  checked?: boolean,
) {
  return { text, style, marks: marks ?? [], checked: checked ?? false, color: '', iconEmoji: '', iconImage: '' };
}

// ── Store ───────────────────────────────────────────────────────────

function createEditorStore() {
  const { subscribe, update, set } = writable<EditorStore>({
    blocks: new Map(),
    rootChildren: [],
    focusedId: null,
    titleBlockId: null,
    descriptionBlockId: null,
    objectId: null,
    loaded: false,
    loading: false,
  });

  // ── Toggle state — kept OUTSIDE the writable so toggling never
  //    triggers rootBlocks / titleBlock derived stores (fixes freeze) ──
  const toggleOpenState = new Map<string, boolean>();

  let _pendingInitId: string | null = null;

  // ── Init / Load ─────────────────────────────────────────────────

  async function init(objectId: string, source: 'notes' | 'journal' = 'notes'): Promise<void> {
    // Track the current request — ignore stale responses.
    // This prevents the race condition where init(noteA) finishes AFTER
    // init(noteB) has already started, overwriting the store with wrong data.
    _pendingInitId = objectId;
    const current = () => _pendingInitId === objectId;

    if (!current()) return;

    // Flush any pending text saves for the PREVIOUS note before resetting.
    // This ensures text typed right before a note switch isn't lost.
    // Because noteId was captured at schedule time, each save goes to its
    // correct note — even if the store has already been reset for the new one.
    _flushTextSaves();
    // Clear the live text cache for the old note — prevents 
    // unbounded memory growth across many note switches.
    _liveTextContent.clear();

    if (!current()) return;

    // Always reset fully — never guard with loadedObjectId here.
    // The guard in Editor.svelte ($effect) is the right place; the store
    // itself must be stateless between note switches to avoid content bleed.
    set({
      blocks: new Map(),
      rootChildren: [],
      focusedId: null,
      titleBlockId: null,
      descriptionBlockId: null,
      objectId,
      loaded: false,
      loading: true,
    });

    if (!current()) return;

    try {
      if (source === 'journal') {
        const result = await invoke<{ blocks: string } | null>('get_journal_entry', { date: objectId });
        if (!current()) return;
        if (result?.blocks) {
          try {
            const parsed: any[] = JSON.parse(result.blocks);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const fakeRows: BlockRow[] = parsed.map((b, i) => ({
                id: b.id ?? crypto.randomUUID(),
                objectId,
                parentId: null,
                type: b.type ?? 'text',
                content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? { text: '', style: 0, marks: [], checked: false }),
                fields: '{}',
                align: 0,
                bgColor: '',
                position: i,
                createdAt: 0,
                updatedAt: 0,
              }));
              if (!current()) return;
              applyLoadedRows(objectId, fakeRows);
              if (!current()) return;
              update((s) => ({ ...s, loading: false, loaded: true }));
              return;
            }
          } catch { /* fall through */ }
        }
        if (!current()) return;
        initEmptyLocal(objectId);
        if (!current()) return;
        update((s) => ({ ...s, loading: false, loaded: true }));
        return;
      }

      // Notes source — load from backend
      const full = await invoke<NoteWithBlocks>('notes_object_full', { noteId: objectId });
      if (!current()) return;

      // NEVER call createInitialBlocks here — if the DB returned no blocks the
      // Rust create_note_object already wrote the title+paragraph stubs.
      // Calling it again was creating N duplicate ghost blocks on every load.
      // If rows are genuinely empty (corrupted note), show one empty paragraph
      // without writing anything to the DB.
      if (full.blocks.length === 0) {
        initEmptyLocal(objectId);
      } else {
        applyLoadedRows(objectId, full.blocks);
      }
      if (!current()) return;
      update((s) => ({ ...s, loading: false, loaded: true }));
    } catch (err) {
      if (!current()) return;
      console.error('[local-store] init failed:', err);
      initEmptyLocal(objectId);
      if (!current()) return;
      update((s) => ({ ...s, loading: false, loaded: true }));
    }
  }

  function applyLoadedRows(objectId: string, rows: BlockRow[]): void {
    const blocks = new Map<string, Block>();
    const rootChildren: string[] = [];
    const childrenByParent = new Map<string, string[]>();
    let titleBlockId: string | null = null;
    let descriptionBlockId: string | null = null;
    const posMap = new Map<string, number>();

    for (const row of rows) {
      posMap.set(row.id, row.position);
      const block = blockRowToBlock(row);
      blocks.set(block.id!, block);
      if (!row.parentId) {
        rootChildren.push(block.id!);
      } else {
        if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
        childrenByParent.get(row.parentId)!.push(block.id!);
      }
      if (block.content && 'style' in block.content) {
        const ct = block.content as ContentText;
        if (ct.style === TS.Title && !titleBlockId) titleBlockId = block.id!;
        else if (ct.style === TS.Description && !descriptionBlockId) descriptionBlockId = block.id!;
      }
    }

    // Wire childrenIds
    for (const [parentId, childIds] of childrenByParent) {
      const parent = blocks.get(parentId);
      if (parent) {
        childIds.sort((a, b) => (posMap.get(a) ?? 0) - (posMap.get(b) ?? 0));
        blocks.set(parentId, { ...parent, childrenIds: childIds });
      }
    }

    rootChildren.sort((a, b) => (posMap.get(a) ?? 0) - (posMap.get(b) ?? 0));

    update((s) => ({
      ...s,
      blocks,
      rootChildren,
      titleBlockId,
      descriptionBlockId,
      objectId,
    }));
  }

  async function initEmptyLocal(objectId: string): Promise<void> {
    // First, create the stub blocks in the backend so they actually persist.
    // Previously we created them only in memory with random UUIDs — the
    // backend didn't know about them, so setBlockText's invoke() call would
    // silently fail and the user's text would vanish on next navigation.
    let titleId = crypto.randomUUID();
    let firstId = crypto.randomUUID();
    try {
      const titleRow = await invoke<BlockRow>('notes_block_create', {
        params: {
          noteId: objectId, parentId: null, targetId: null,
          blockType: 'text',
          content: buildContentPayload('', TS.Title),
          position: 0, align: 0, bgColor: null,
        },
      });
      titleId = titleRow.id;
      const paraRow = await invoke<BlockRow>('notes_block_create', {
        params: {
          noteId: objectId, parentId: null, targetId: titleId,
          blockType: 'text',
          content: buildContentPayload('', TS.Paragraph),
          position: 1, align: 0, bgColor: null,
        },
      });
      firstId = paraRow.id;
    } catch (err) {
      // Backend unavailable — fall back to local-only blocks (text won't persist across navigation)
      console.warn('[local-store] initEmptyLocal backend create failed:', err);
    }
    const blocks = new Map<string, Block>();
    blocks.set(titleId, {
      id: titleId, type: BT.Text, childrenIds: [],
      content: { text: '', style: TS.Title, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' } as ContentText,
    });
    blocks.set(firstId, {
      id: firstId, type: BT.Text, childrenIds: [],
      content: { text: '', style: TS.Paragraph, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' } as ContentText,
    });
    update((s) => ({
      ...s, blocks,
      rootChildren: [titleId, firstId],
      titleBlockId: titleId,
      descriptionBlockId: null,
      objectId,
    }));
  }

  // ── Focus ────────────────────────────────────────────────────────

  function focusBlock(blockId: string): void {
    update((state) => ({ ...state, focusedId: blockId }));
  }

  function blurBlock(): void {
    update((state) => ({ ...state, focusedId: null }));
  }

  // ── Mark Operations (Anytype-style inline formatting) ──────────

  /** Toggle a mark type on the current selection range of a block */
  async function toggleMark(blockId: string, markType: MarkType, range: TextRange, param?: string): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return;

    const content = block.content as ContentText;
    let marks = [...(content.marks ?? [])];

    // Check if this exact mark already exists on this range
    const existingIdx = marks.findIndex(
      (m) => m.type === markType && m.range.from === range.from && m.range.to === range.to
    );

    if (existingIdx >= 0) {
      // Remove the mark (toggle off)
      marks.splice(existingIdx, 1);
    } else {
      // Remove existing same-type marks that overlap with this range (replace)
      marks = marks.filter((m) => {
        if (m.type !== markType) return true;
        // Keep marks that don't overlap with the new range
        return !(m.range.from < range.to && m.range.to > range.from);
      });
      // Add new mark
      marks.push({ type: markType, range, param });
    }

    // Sort marks by range.from ascending
    marks.sort((a, b) => a.range.from - b.range.from);

    // Optimistic local update
    update((state) => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(blockId, { ...block!, content: { ...content, marks } });
      return { ...state, blocks: newBlocks };
    });

    try {
      await invoke('notes_set_text_content', { noteId: stateObjectId(), blockId, text: content.text, marks });
    } catch (err) {
      console.error('[local-store] toggleMark failed:', err);
    }
  }

  /** Apply a mark to a text selection (used by format toolbar) */
  async function applyMarkToSelection(blockId: string, markType: MarkType, selText?: string): Promise<void> {
    // Get the selection range from the DOM
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
    if (!el) return;

    const range = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const from = pre.toString().length;
    const to = from + range.toString().length;

    if (from === to) return;
    await toggleMark(blockId, markType, { from, to });
  }

  /** Check if a mark exists at the current selection (for toolbar state) */
  function hasMarkAtSelection(blockId: string, markType: MarkType): boolean {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
    if (!el) return false;
    const range = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const from = pre.toString().length;
    const to = from + range.toString().length;
    if (from === to) return false;

    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return false;
    const marks = (block.content as ContentText).marks ?? [];
    return marks.some((m) => m.type === markType && m.range.from <= from && m.range.to >= to);
  }

  // ── Text Mutations ───────────────────────────────────────────────
  //
  // DESIGN: Match Anytype-ts where text content is kept OUTSIDE the main
  // store during active editing. Only the debounced backend persistence runs
  // on every keystroke. The store is only updated on blur or note switch.
  // This prevents cascading derived-store re-evaluations on every keystroke,
  // which was the root cause of the editor freeze.
  //
  // Two separate maps:
  //   _pendingTextSaves  — debounced backend persists (keyed by blockId)
  //   _liveTextContent   — in-memory text state during editing (mirror of contenteditable)
  //

  // Coalesce pending persistence calls per block so we don't flood the
  // backend with an invoke() on every single keystroke.
  // CRITICAL: capture the noteId AT SCHEDULE TIME, not at flush time.
  const _pendingTextSaves = new Map<string, { text: string; marks?: Mark[]; noteId: string }>();
  let _saveTimer: ReturnType<typeof setTimeout> | null = null;

  function _flushTextSaves() {
    _saveTimer = null;
    const entries = [..._pendingTextSaves.entries()];
    _pendingTextSaves.clear();
    for (const [blockId, { text, marks, noteId }] of entries) {
      invoke('notes_set_text_content', {
        noteId,
        blockId,
        text,
        marks: marks ? JSON.stringify(marks) : null,
      }).catch((err) => console.error('[local-store] persistBlockText failed:', err));
    }
  }

  function _scheduleTextSave(blockId: string, text: string, marks: Mark[] | undefined, noteId: string) {
    _pendingTextSaves.set(blockId, { text, marks, noteId });
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_flushTextSaves, 250);
  }

  // In-memory text cache during active editing — avoids touching the writable store
  // on every keystroke, which was causing cascading derived-store re-evaluations (freeze).
  const _liveTextContent = new Map<string, { text: string; marks: Mark[] }>();

  /**
   * Persist text to backend (debounced) and cache in the live map.
   * Does NOT update the writable store — matching Anytype's approach where
   * the block tree isn't re-rendered on every keystroke.
   */
  async function persistBlockText(blockId: string, text: string, marks?: Mark[]): Promise<void> {
    _liveTextContent.set(blockId, { text, marks: marks ?? [] });
    const currentNoteId = stateObjectId();
    _scheduleTextSave(blockId, text, marks, currentNoteId);
  }

  /**
   * Sync the live text cache into the writable store for a given block.
   * Called on blur or note switch to make the text visible to derived stores.
   */
  function syncBlockTextToStore(blockId: string): void {
    const live = _liveTextContent.get(blockId);
    if (!live) return;
    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return;
    const content = block.content as ContentText;
    if (content.text === live.text) return; // no change
    update((state) => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(blockId, { ...block!, content: { ...content, text: live.text, marks: live.marks } });
      return { ...state, blocks: newBlocks };
    });
  }

  // Keep backward-compatible alias — now only persists, doesn't update the writable store.
  // Use syncBlockTextToStore() when the store needs to reflect live text (on blur, split, merge).
  async function setBlockText(blockId: string, text: string, marks?: Mark[]): Promise<void> {
    await persistBlockText(blockId, text, marks);
  }

  async function setBlockChecked(blockId: string, checked: boolean): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return;
    const content = block.content as ContentText;
    update((state) => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(blockId, { ...block!, content: { ...content, checked } });
      return { ...state, blocks: newBlocks };
    });

    try {
      await invoke('notes_set_text_checked', { noteId: stateObjectId(), blockId, checked });
    } catch (err) {
      console.error('[local-store] setBlockChecked failed:', err);
    }
  }

  async function convertBlockStyle(blockId: string, newStyle: TextStyle): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return;
    const content = block.content as ContentText;
    update((state) => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(blockId, { ...block!, content: { ...content, style: newStyle } });
      return { ...state, blocks: newBlocks };
    });

    try {
      await invoke('notes_set_text_style', { noteId: stateObjectId(), blockIds: [blockId], style: String(newStyle) });
    } catch (err) {
      console.error('[local-store] convertBlockStyle failed:', err);
    }
  }

  // ── Block Structure ──────────────────────────────────────────────

  async function addBlock(afterId?: string, text: string = '', style: TextStyle = TS.Paragraph): Promise<string> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    if (!objectId) { console.warn('[local-store] addBlock: no objectId'); return ''; }

    const children = state?.rootChildren ?? [];
    let position = children.length;
    if (afterId) {
      const idx = children.indexOf(afterId);
      if (idx !== -1) position = idx + 1;
    }

    const content = buildContentPayload(text, style);
    try {
      const result: BlockRow = await invoke('notes_block_create', { params: { noteId: objectId, parentId: null, targetId: afterId ?? null, blockType: 'text', content, position, align: 0, bgColor: null } });
      const newBlock = blockRowToBlock(result);
      const newId = newBlock.id!;

      update((s) => {
        const newBlocks = new Map(s.blocks);
        newBlocks.set(newId, newBlock);
        const newChildren = [...s.rootChildren];
        if (afterId) {
          const idx = newChildren.indexOf(afterId);
          if (idx !== -1) newChildren.splice(idx + 1, 0, newId);
          else newChildren.push(newId);
        } else newChildren.push(newId);
        return { ...s, blocks: newBlocks, rootChildren: newChildren };
      });
      return newId;
    } catch (err) {
      console.error('[local-store] addBlock failed:', err);
      return '';
    }
  }

  async function deleteBlock(blockId: string): Promise<void> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    if (state?.titleBlockId === blockId || state?.descriptionBlockId === blockId) return;
    const objectId = state?.objectId;
    if (!objectId) return;

    // Also delete any children
    const block = state?.blocks.get(blockId);
    const childIds = block?.childrenIds ?? [];

    update((s) => {
      if (s.titleBlockId === blockId || s.descriptionBlockId === blockId) return s;
      const newBlocks = new Map(s.blocks);
      newBlocks.delete(blockId);
      for (const cid of childIds) newBlocks.delete(cid);
      return { ...s, blocks: newBlocks, rootChildren: s.rootChildren.filter((id) => id !== blockId && !childIds.includes(id)), focusedId: s.focusedId === blockId ? null : s.focusedId };
    });

    try {
      await invoke('notes_block_unlink', { noteId: objectId, blockIds: [blockId, ...childIds] });
    } catch (err) {
      console.error('[local-store] deleteBlock failed:', err);
    }
  }

  async function moveBlock(blockId: string, newIndex: number): Promise<void> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    if (!objectId) return;
    const idx = state?.rootChildren.indexOf(blockId) ?? -1;
    if (idx === -1) return;

    update((s) => {
      const children = [...s.rootChildren];
      children.splice(idx, 1);
      children.splice(Math.min(newIndex, children.length), 0, blockId);
      return { ...s, rootChildren: children };
    });

    try {
      await invoke('notes_block_move', { params: { noteId: objectId, blockIds: [blockId], targetParentId: null, position: newIndex } });
    } catch (err) {
      console.error('[local-store] moveBlock failed:', err);
    }
  }

  /** Duplicate a block (creates copy right after original) */
  async function duplicateBlock(blockId: string): Promise<string> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    if (!objectId) return '';

    const block = state?.blocks.get(blockId);
    if (!block) return '';

    try {
      const rows = await invoke<BlockRow[]>('notes_block_duplicate', { params: { noteId: objectId, blockIds: [blockId], targetId: blockId } });
      const first = rows[0];
      if (!first) return '';
      const newBlock = blockRowToBlock(first);
      update((s) => {
        const newBlocks = new Map(s.blocks);
        newBlocks.set(newBlock.id!, newBlock);
        const children = [...s.rootChildren];
        const idx = children.indexOf(blockId);
        if (idx >= 0) children.splice(idx + 1, 0, newBlock.id!);
        else children.push(newBlock.id!);
        return { ...s, blocks: newBlocks, rootChildren: children };
      });
      return newBlock.id!;
    } catch (err) {
      console.error('[local-store] duplicateBlock failed:', err);
      return '';
    }
  }

  /** Set text color on a block — port of C.BlockTextListSetColor */
  async function setBlockColor(blockId: string, color: string): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return;
    const content = block.content as ContentText;

    update((s) => {
      const nb = new Map(s.blocks);
      nb.set(blockId, { ...block!, content: { ...content, color } });
      return { ...s, blocks: nb };
    });

    try {
      await invoke('notes_set_text_color', { noteId: stateObjectId(), blockId, color });
    } catch (err) {
      console.error('[local-store] setBlockColor failed:', err);
    }
  }

  /** Set background color on a block — port of C.BlockListSetBackgroundColor */
  async function setBlockBgColor(blockId: string, bgColor: string): Promise<void> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    const block = state?.blocks.get(blockId);
    if (!objectId || !block) return;

    update((s) => {
      const nb = new Map(s.blocks);
      nb.set(blockId, { ...block!, bgColor: bgColor === 'default' ? undefined : bgColor });
      return { ...s, blocks: nb };
    });

    try {
      await invoke('notes_set_background_color', { noteId: objectId, blockIds: [blockId], color: bgColor });
    } catch (err) {
      console.error('[local-store] setBlockBgColor failed:', err);
    }
  }

  /** Set horizontal alignment — port of C.BlockListSetAlign */
  async function setBlockAlign(blockId: string, align: string): Promise<void> {
    const alignMap: Record<string, number> = { left: 0, center: 1, right: 2, justify: 3 };
    const alignNum = alignMap[align] ?? 0;
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    if (!objectId) return;

    // Optimistic: store align in block.fields
    const block = state?.blocks.get(blockId);
    if (block) {
      update((s) => {
        const nb = new Map(s.blocks);
        nb.set(blockId, { ...block, fields: { ...(block.fields ?? {}), hAlign: align } });
        return { ...s, blocks: nb };
      });
    }

    try {
      await invoke('notes_set_align', { noteId: objectId, blockIds: [blockId], align: alignNum });
    } catch (err) {
      console.error('[local-store] setBlockAlign failed:', err);
    }
  }

  /** Clear all text style marks — port of C.BlockTextListClearStyle */
  async function clearBlockStyle(blockId: string): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => { block = s.blocks.get(blockId); });
    unsub();
    if (!block || !isTextBlock(block)) return;
    const content = block.content as ContentText;
    // Remove all formatting marks; keep text and style intact
    const clearedMarks: Mark[] = [];

    update((s) => {
      const nb = new Map(s.blocks);
      nb.set(blockId, { ...block!, content: { ...content, marks: clearedMarks, color: '' } });
      return { ...s, blocks: nb };
    });

    try {
      await invoke('notes_clear_text_style', { noteId: stateObjectId(), blockId });
    } catch (err) {
      console.error('[local-store] clearBlockStyle failed:', err);
    }
  }

  function stateObjectId(): string {
    let objectId = '';
    const unsub = subscribe((s) => { objectId = s.objectId ?? ''; });
    unsub();
    return objectId;
  }

  // ── Type / Relation System ───────────────────────────────────────

  function getSystemTypes(): TypeDef[] {
    return SYSTEM_TYPES;
  }

  function getSystemRelations(): RelationDef[] {
    return SYSTEM_RELATIONS;
  }

  function getTypeById(typeId: string): TypeDef | undefined {
    return SYSTEM_TYPES.find((t) => t.id === typeId);
  }

  // ── Sync Readers ────────────────────────────────────────────────

  function getBlock(blockId: string): Block | undefined {
    let result: Block | undefined;
    const unsub = subscribe((s) => { result = s.blocks.get(blockId); });
    unsub();
    return result;
  }

  function getChildren(): Block[] {
    let result: Block[] = [];
    const unsub = subscribe((s) => {
      result = s.rootChildren.map((id) => s.blocks.get(id)).filter((b): b is Block => b !== undefined);
    });
    unsub();
    return result;
  }

  /** Get child blocks of a given parent block (for toggle/nested rendering) */
  function getBlockChildren(parentId: string): Block[] {
    let result: Block[] = [];
    const unsub = subscribe((s) => {
      const parent = s.blocks.get(parentId);
      if (!parent) return;
      result = (parent.childrenIds ?? [])
        .map((id) => s.blocks.get(id))
        .filter((b): b is Block => b !== undefined);
    });
    unsub();
    return result;
  }

  /** Add a child block under a parent block (for toggle indent) */
  async function addChildBlock(
    parentId: string,
    text: string = '',
    style: TextStyle = TS.Paragraph,
  ): Promise<string> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    if (!objectId) return '';

    const parent = state?.blocks.get(parentId);
    const position = (parent?.childrenIds ?? []).length;
    const content = buildContentPayload(text, style);

    try {
      const result: BlockRow = await invoke('notes_block_create', {
        params: {
          noteId: objectId,
          parentId,
          targetId: null,
          blockType: 'text',
          content,
          position,
          align: 0,
          bgColor: null,
        },
      });
      const newBlock = blockRowToBlock(result);
      const newId = newBlock.id!;

      update((s) => {
        const newBlocks = new Map(s.blocks);
        newBlocks.set(newId, newBlock);
        const existingParent = newBlocks.get(parentId);
        if (existingParent) {
          newBlocks.set(parentId, {
            ...existingParent,
            childrenIds: [...(existingParent.childrenIds ?? []), newId],
          });
        }
        return { ...s, blocks: newBlocks };
      });
      return newId;
    } catch (err) {
      console.error('[local-store] addChildBlock failed:', err);
      return '';
    }
  }

  function isToggleOpen(blockId: string): boolean {
    return toggleOpenState.get(blockId) ?? false;
  }

  function setToggleOpen(blockId: string, open: boolean): void {
    const prev = toggleOpenState.get(blockId);
    if (prev === open) return;
    toggleOpenState.set(blockId, open);
    // Trigger reactive update so template re-renders with new toggle state
    update((s) => ({ ...s }));
  }

  return {
    subscribe,
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
    getBlock,
    getChildren,
    getBlockChildren,
    isToggleOpen,
    setToggleOpen,
    getSystemTypes,
    getSystemRelations,
    getTypeById,
    // ── clearBlocks: reset to a single empty paragraph (used by JournalEditor clear) ──
    clearBlocks(): void {
      const paraId = crypto.randomUUID();
      update((s) => ({
        ...s,
        blocks: new Map([[paraId, {
          id: paraId,
          type: BT.Text,
          content: { text: '', style: TS.Paragraph, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' } as ContentText,
          childrenIds: [],
        }]]),
        rootChildren: [paraId],
        focusedId: null,
      }));
    },
  };
}

export const editorStore = createEditorStore();

// ── Derived stores ──────────────────────────────────────────────────

export const rootBlocks = derived(editorStore, ($store) =>
  $store.rootChildren.map((id) => $store.blocks.get(id)).filter((b): b is Block => b !== undefined),
);

export const titleBlock = derived(editorStore, ($store) =>
  $store.titleBlockId ? $store.blocks.get($store.titleBlockId) ?? null : null,
);

export const focusedBlock = derived(editorStore, ($store) =>
  $store.focusedId ? $store.blocks.get($store.focusedId) ?? null : null,
);

export const isEditorLoading = derived(editorStore, ($store) => $store.loading);
export const isEditorLoaded = derived(editorStore, ($store) => $store.loaded);
