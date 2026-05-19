import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Block, ContentText, TextStyle, Mark } from './block';
import { BlockType as BT, TextStyle as TS, isTextBlock } from './block';

// ── Types ───────────────────────────────────────────────────────────

type EditorStore = {
  /** Blocks in the current document, indexed by id */
  blocks: Map<string, Block>;
  /** Order of top-level block IDs */
  rootChildren: string[];
  /** Currently focused block ID */
  focusedId: string | null;
  /** Document / page title block */
  titleBlockId: string | null;
  /** Document description block */
  descriptionBlockId: string | null;
  /** The object ID in the `objects` table */
  objectId: string | null;
  /** Whether blocks have been loaded from the DB */
  loaded: boolean;
  /** Whether a load/init is in progress */
  loading: boolean;
};

/** Shape of a BlockRow returned from the Rust backend */
interface BlockRow {
  id: string;
  objectId: string;
  parentId?: string | null;
  type: string;
  content: string; // JSON string
  fields: string;  // JSON string
  align: number;
  bgColor: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

/** Shape returned from local-store_block_add */
interface BlockAddResult {
  createdId: string;
  block: BlockRow;
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseContentText(contentStr: string): ContentText {
  try {
    const parsed = JSON.parse(contentStr);
    return {
      text: parsed.text ?? '',
      style: parsed.style ?? TS.Paragraph,
      marks: parsed.marks ?? [],
      checked: parsed.checked ?? false,
      color: parsed.color ?? '',
      iconEmoji: parsed.iconEmoji ?? '',
      iconImage: parsed.iconImage ?? '',
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
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function buildContentPayload(
  text: string,
  style: TextStyle,
  marks?: Mark[],
  checked?: boolean,
) {
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

/** Extract a content JSON blob suitable for sending to `local-store_block_update`. */
function blockToContentPayload(block: Block): Record<string, any> {
  if (isTextBlock(block)) {
    const ct = block.content as ContentText;
    return {
      text: ct.text,
      style: ct.style,
      marks: ct.marks ?? [],
      checked: ct.checked ?? false,
      color: ct.color ?? '',
      iconEmoji: ct.iconEmoji ?? '',
      iconImage: ct.iconImage ?? '',
    };
  }
  return {};
}

// ── Store ───────────────────────────────────────────────────────────

function createEditorStore() {
  const { subscribe, set, update } = writable<EditorStore>({
    blocks: new Map(),
    rootChildren: [],
    focusedId: null,
    titleBlockId: null,
    descriptionBlockId: null,
    objectId: null,
    loaded: false,
    loading: false,
  });

  // ── Init / Load ─────────────────────────────────────────────────

  /**
   * Initialise the store for a given object/document.
   * Loads existing blocks from the DB, or creates the initial
   * document structure (title + description + first paragraph).
   */
  async function init(objectId: string): Promise<void> {
    update((s) => ({ ...s, objectId, loading: true }));

    try {
      // Ensure the object exists in the `objects` table
      await invoke('local_store_create_object', {
        objectId,
        objectType: 'note',
      });

      // Load existing blocks
      const rows: BlockRow[] = await invoke('local_store_get_blocks', {
        objectId,
      });

      if (rows.length === 0) {
        // Fresh document — create initial blocks via DB
        await createInitialBlocks(objectId);
      } else {
        // Reconstruct state from DB rows
        applyLoadedRows(rows);
      }

      update((s) => ({ ...s, loading: false, loaded: true }));
    } catch (err) {
      console.error('[local-store] init failed:', err);
      // Fall back to an empty local-only state so the UI still works
      initEmptyLocal();
      update((s) => ({ ...s, loading: false, loaded: true }));
    }
  }

  /** Create the three default blocks (title, description, paragraph). */
  async function createInitialBlocks(objectId: string): Promise<void> {
    const content = (text: string, style: TextStyle) =>
      buildContentPayload(text, style);

    // Title block (position 0)
    const titleResult: BlockAddResult = await invoke('local_store_block_add', {
      params: {
        objectId,
        parentId: null,
        type: 'text',
        content: content('', TS.Title),
        position: 0,
        fields: null,
        align: null,
        bgColor: null,
      },
    });

    // Description block (position 1)
    const descResult: BlockAddResult = await invoke('local_store_block_add', {
      params: {
        objectId,
        parentId: null,
        type: 'text',
        content: content('', TS.Description),
        position: 1,
        fields: null,
        align: null,
        bgColor: null,
      },
    });

    // First paragraph block (position 2)
    const paraResult: BlockAddResult = await invoke('local_store_block_add', {
      params: {
        objectId,
        parentId: null,
        type: 'text',
        content: content('', TS.Paragraph),
        position: 2,
        fields: null,
        align: null,
        bgColor: null,
      },
    });

    update((state) => {
      const blocks = new Map<string, Block>();

      const titleBlock = blockRowToBlock(titleResult.block);
      blocks.set(titleBlock.id!, titleBlock);

      const descBlock = blockRowToBlock(descResult.block);
      blocks.set(descBlock.id!, descBlock);

      const paraBlock = blockRowToBlock(paraResult.block);
      blocks.set(paraBlock.id!, paraBlock);

      return {
        ...state,
        blocks,
        rootChildren: [titleBlock.id!, descBlock.id!, paraBlock.id!],
        titleBlockId: titleBlock.id!,
        descriptionBlockId: descBlock.id!,
      };
    });
  }

  /** Re-build the store state from a set of BlockRows returned by the DB. */
  function applyLoadedRows(rows: BlockRow[]): void {
    const blocks = new Map<string, Block>();
    const rootChildren: string[] = [];
    let titleBlockId: string | null = null;
    let descriptionBlockId: string | null = null;

    for (const row of rows) {
      const block = blockRowToBlock(row);
      blocks.set(block.id!, block);

      // Root-level blocks have no parentId
      if (!row.parentId) {
        rootChildren.push(block.id!);
      }

      // Identify title/description by style
      if (block.content && 'style' in block.content) {
        const ct = block.content as ContentText;
        if (ct.style === TS.Title) {
          titleBlockId = block.id!;
        } else if (ct.style === TS.Description) {
          descriptionBlockId = block.id!;
        }
      }
    }

    // Sort root children by position
    const posMap = new Map<string, number>();
    for (const row of rows) {
      posMap.set(row.id, row.position);
    }
    rootChildren.sort((a, b) => (posMap.get(a) ?? 0) - (posMap.get(b) ?? 0));

    update((state) => ({
      ...state,
      blocks,
      rootChildren,
      titleBlockId,
      descriptionBlockId,
    }));
  }

  /** Fallback: set up a minimal local-only document when DB is unavailable. */
  function initEmptyLocal(): void {
    const titleId = crypto.randomUUID();
    const descId = crypto.randomUUID();
    const firstId = crypto.randomUUID();

    const blocks = new Map<string, Block>();
    blocks.set(titleId, { id: titleId, type: BT.Text, content: { text: '', style: TS.Title, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' } as ContentText, childrenIds: [] });
    blocks.set(descId, { id: descId, type: BT.Text, content: { text: '', style: TS.Description, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' } as ContentText, childrenIds: [] });
    blocks.set(firstId, { id: firstId, type: BT.Text, content: { text: '', style: TS.Paragraph, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' } as ContentText, childrenIds: [] });

    update((state) => ({
      ...state,
      blocks,
      rootChildren: [titleId, descId, firstId],
      titleBlockId: titleId,
      descriptionBlockId: descId,
    }));
  }

  // ── Focus ────────────────────────────────────────────────────────

  function focusBlock(blockId: string): void {
    update((state) => ({ ...state, focusedId: blockId }));
  }

  function blurBlock(): void {
    update((state) => ({ ...state, focusedId: null }));
  }

  // ── Text Mutations ───────────────────────────────────────────────

  async function setBlockText(
    blockId: string,
    text: string,
    marks?: Mark[],
  ): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => {
      block = s.blocks.get(blockId);
    });
    unsub();
    if (!block || !isTextBlock(block)) return;

    const content = block.content as ContentText;
    const contentPayload = buildContentPayload(text, content.style, marks ?? content.marks, content.checked);

    // Optimistic local update
    update((state) => {
      const newBlocks = new Map(state.blocks);
      const updated = { ...block!, content: { ...content, text, marks: marks ?? content.marks } };
      newBlocks.set(blockId, updated);
      return { ...state, blocks: newBlocks };
    });

    // Persist to DB
    try {
      await invoke('local_store_block_update', {
        params: { id: blockId, content: contentPayload, fields: null, align: null, bgColor: null },
      });
    } catch (err) {
      console.error('[local-store] setBlockText failed:', err);
    }
  }

  async function setBlockChecked(
    blockId: string,
    checked: boolean,
  ): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => {
      block = s.blocks.get(blockId);
    });
    unsub();
    if (!block || !isTextBlock(block)) return;

    const content = block.content as ContentText;
    const contentPayload = buildContentPayload(content.text, content.style, content.marks, checked);

    update((state) => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(blockId, { ...block!, content: { ...content, checked } });
      return { ...state, blocks: newBlocks };
    });

    try {
      await invoke('local_store_block_update', {
        params: { id: blockId, content: contentPayload, fields: null, align: null, bgColor: null },
      });
    } catch (err) {
      console.error('[local-store] setBlockChecked failed:', err);
    }
  }

  async function convertBlockStyle(
    blockId: string,
    newStyle: TextStyle,
  ): Promise<void> {
    let block: Block | undefined;
    const unsub = subscribe((s) => {
      block = s.blocks.get(blockId);
    });
    unsub();
    if (!block || !isTextBlock(block)) return;

    const content = block.content as ContentText;
    const contentPayload = buildContentPayload(content.text, newStyle, content.marks, content.checked);

    update((state) => {
      const newBlocks = new Map(state.blocks);
      newBlocks.set(blockId, { ...block!, content: { ...content, style: newStyle } });
      return { ...state, blocks: newBlocks };
    });

    try {
      await invoke('local_store_block_update', {
        params: { id: blockId, content: contentPayload, fields: null, align: null, bgColor: null },
      });
    } catch (err) {
      console.error('[local-store] convertBlockStyle failed:', err);
    }
  }

  // ── Block Structure ──────────────────────────────────────────────

  async function addBlock(
    afterId?: string,
    text: string = '',
    style: TextStyle = TS.Paragraph,
  ): Promise<string> {
    let state: EditorStore | undefined;
    const unsub = subscribe((s) => { state = s; });
    unsub();
    const objectId = state?.objectId;
    if (!objectId) {
      console.warn('[local-store] addBlock: no objectId');
      return '';
    }

    // Calculate position
    const children = state?.rootChildren ?? [];
    let position = children.length;
    if (afterId) {
      const idx = children.indexOf(afterId);
      if (idx !== -1) {
        position = idx + 1;
      }
    }

    const content = buildContentPayload(text, style);

    try {
      const result: BlockAddResult = await invoke('local_store_block_add', {
        params: {
          objectId,
          parentId: null,
          type: 'text',
          content,
          position,
          fields: null,
          align: null,
          bgColor: null,
        },
      });

      const newBlock = blockRowToBlock(result.block);
      const newId = newBlock.id!;

      update((s) => {
        const newBlocks = new Map(s.blocks);
        newBlocks.set(newId, newBlock);
        const newChildren = [...s.rootChildren];
        if (afterId) {
          const idx = newChildren.indexOf(afterId);
          if (idx !== -1) {
            newChildren.splice(idx + 1, 0, newId);
          } else {
            newChildren.push(newId);
          }
        } else {
          newChildren.push(newId);
        }
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

    // Never delete title or description blocks
    if (state?.titleBlockId === blockId || state?.descriptionBlockId === blockId) {
      return;
    }

    const objectId = state?.objectId;
    if (!objectId) return;

    // Optimistic local removal
    update((s) => {
      if (s.titleBlockId === blockId || s.descriptionBlockId === blockId) {
        return s;
      }
      const newBlocks = new Map(s.blocks);
      newBlocks.delete(blockId);
      return {
        ...s,
        blocks: newBlocks,
        rootChildren: s.rootChildren.filter((id) => id !== blockId),
        focusedId: s.focusedId === blockId ? null : s.focusedId,
      };
    });

    try {
      await invoke('local_store_block_delete', { blockId, objectId });
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

    // Optimistic local reorder
    update((s) => {
      const children = [...s.rootChildren];
      children.splice(idx, 1);
      children.splice(Math.min(newIndex, children.length), 0, blockId);
      return { ...s, rootChildren: children };
    });

    try {
      await invoke('local_store_block_move', {
        params: {
          blockId,
          objectId,
          targetParentId: objectId, // root = object itself
          position: newIndex,
        },
      });
    } catch (err) {
      console.error('[local-store] moveBlock failed:', err);
    }
  }

  // ── Sync Readers ────────────────────────────────────────────────

  function getBlock(blockId: string): Block | undefined {
    let result: Block | undefined;
    const unsub = subscribe((s) => {
      result = s.blocks.get(blockId);
    });
    unsub();
    return result;
  }

  function getChildren(): Block[] {
    let result: Block[] = [];
    const unsub = subscribe((s) => {
      result = s.rootChildren
        .map((id) => s.blocks.get(id))
        .filter((b): b is Block => b !== undefined);
    });
    unsub();
    return result;
  }

  return {
    subscribe,
    init,
    focusBlock,
    blurBlock,
    setBlockText,
    setBlockChecked,
    convertBlockStyle,
    addBlock,
    deleteBlock,
    moveBlock,
    getBlock,
    getChildren,
  };
}

export const editorStore = createEditorStore();

// ── Derived stores ──────────────────────────────────────────────────

export const rootBlocks = derived(editorStore, ($store) =>
  $store.rootChildren
    .map((id) => $store.blocks.get(id))
    .filter((b): b is Block => b !== undefined),
);

export const titleBlock = derived(editorStore, ($store) =>
  $store.titleBlockId ? $store.blocks.get($store.titleBlockId) ?? null : null,
);

export const focusedBlock = derived(editorStore, ($store) =>
  $store.focusedId ? $store.blocks.get($store.focusedId) ?? null : null,
);

export const isEditorLoading = derived(editorStore, ($store) => $store.loading);
export const isEditorLoaded = derived(editorStore, ($store) => $store.loaded);
