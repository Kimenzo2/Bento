<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getModuleSectionLabel, ensureModuleSection, moduleSectionStore } from '$lib/stores/module-sections.store';
  import { Plus, FileText, Star, Clock, BookOpen, ArrowLeft, Download } from 'lucide-svelte';
  import TypeIcon from '@lucide/svelte/icons/type';
  import Heading1Icon from '@lucide/svelte/icons/heading-1';
  import Heading2Icon from '@lucide/svelte/icons/heading-2';
  import CheckSquareIcon from '@lucide/svelte/icons/check-square';
  import ListIcon from '@lucide/svelte/icons/list';
  import QuoteIcon from '@lucide/svelte/icons/quote';
  import MinusIcon from '@lucide/svelte/icons/minus';
  import BoldIcon from '@lucide/svelte/icons/bold';
  import ItalicIcon from '@lucide/svelte/icons/italic';
  import UnderlineIcon from '@lucide/svelte/icons/underline';
  import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
  import CodeIcon from '@lucide/svelte/icons/code';
  import LinkIcon from '@lucide/svelte/icons/link';
  import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
  import { TextStyle as TS } from '$lib/local-store/block';
  import type { ContentText } from '$lib/local-store/block';

  let { moduleId = 'notes' } = $props();

  // ── Types ────────────────────────────────────────────────────────────

  interface ObjectRow {
    id: string;
    type: string;
    layout: string;
    name: string | null;
    icon: string | null;
    cover: string | null;
    isFavorite: boolean;
    isArchived: boolean;
    isDeleted: boolean;
    createdAt: number;
    updatedAt: number;
    spaceId: string | null;
    details: string | null;
  }

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

  type BlockType = 'text' | 'heading1' | 'heading2' | 'todo' | 'bullet' | 'quote' | 'divider';

  interface EditorBlock {
    id: string;
    objectId: string;
    type: BlockType;
    content: string;
    checked: boolean;
    position: number;
  }

  interface RelationRow {
    id: string;
    objectId: string;
    key: string;
    value: string;
  }

  const VALID_BLOCK_TYPES = new Set(['text', 'heading1', 'heading2', 'todo', 'bullet', 'quote', 'divider']);

  // ── Section navigation ───────────────────────────────────────────────

  const sectionLabels = ['All Notes', 'Recent', 'Favorites', 'Tags', 'Export'] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  // ── State ─────────────────────────────────────────────────────────────

  let objects = $state<ObjectRow[]>([]);
  let loading = $state(true);
  let error = $state('');

  // Editor state
  let activeObjectId = $state<string | null>(null);
  let activeObjectName = $state('');
  let activeObjectIcon = $state('');
  let activeObjectCover = $state('');
  let blocks = $state<EditorBlock[]>([]);
  let editorLoading = $state(false);

  // Tags state
  let allRelations = $state<RelationRow[]>([]);
  let selectedTag = $state<string | null>(null);

  // ── Block conversion (backward-compat with old JSON content format) ──

  function blockTypeFromRow(row: BlockRow): BlockType {
    if (VALID_BLOCK_TYPES.has(row.type)) return row.type as BlockType;
    // Old format: extract style from JSON content to infer type
    try {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === 'object') {
        const s = parsed.style;
        if (s === TS.Header1) return 'heading1';
        if (s === TS.Header2) return 'heading2';
        if (s === TS.Checkbox || s === TS.Bulleted || s === TS.Numbered) return 'todo';
        if (s === TS.Quote) return 'quote';
        if (s === TS.Toggle || s === TS.ToggleHeader1) return 'bullet';
      }
    } catch {}
    return 'text';
  }

  function blockTextFromRow(row: BlockRow): string {
    // New format: content is plain text
    if (VALID_BLOCK_TYPES.has(row.type)) return row.content || '';
    // Old format: content is JSON with .text field
    try {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') return parsed.text;
    } catch {}
    return row.content || '';
  }

  function blockCheckedFromRow(row: BlockRow): boolean {
    try {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === 'object') return !!parsed.checked;
    } catch {}
    return false;
  }

  function rowsToEditorBlocks(rows: BlockRow[]): EditorBlock[] {
    return rows.map((r) => ({
      id: r.id,
      objectId: r.objectId,
      type: blockTypeFromRow(r),
      content: blockTextFromRow(r),
      checked: blockCheckedFromRow(r),
      position: r.position,
    }));
  }

  // ── Object operations ─────────────────────────────────────────────────

  async function loadObjects(layoutFilter?: string) {
    loading = true;
    error = '';
    try {
      objects = await invoke<ObjectRow[]>('local_store_get_objects', {
        typeFilter: null,
        layoutFilter: layoutFilter ?? null,
      });
    } catch (err) {
      console.error('[notes] load objects failed:', err);
      error = 'Failed to load notes.';
    } finally {
      loading = false;
    }
  }

  async function loadRecentObjects() {
    loading = true;
    error = '';
    try {
      objects = await invoke<ObjectRow[]>('local_store_get_recent_objects', {
        typeFilter: null,
        layoutFilter: 'note',
      });
    } catch (err) {
      console.error('[notes] load recent failed:', err);
      error = 'Failed to load recent notes.';
      objects = [];
    } finally {
      loading = false;
    }
  }

  async function loadFavoriteObjects() {
    loading = true;
    error = '';
    try {
      objects = await invoke<ObjectRow[]>('local_store_get_favorite_objects', {
        typeFilter: null,
        layoutFilter: 'note',
      });
    } catch (err) {
      console.error('[notes] load favorites failed:', err);
      error = 'Failed to load favorites.';
      objects = [];
    } finally {
      loading = false;
    }
  }

  async function createNote() {
    const id = crypto.randomUUID();
    try {
      await invoke('local_store_create_object', { objectId: id, objectType: 'note' });
      await loadObjects('note');
      openNote(id);
    } catch (err) {
      console.error('[notes] create failed:', err);
    }
  }

  async function deleteNote(id: string, e: Event) {
    e.stopPropagation();
    try {
      await invoke('local_store_delete_object', { objectId: id });
      if (activeObjectId === id) {
        activeObjectId = null;
      }
      await loadObjects('note');
    } catch (err) {
      console.error('[notes] delete failed:', err);
    }
  }

  async function toggleFavorite(id: string, e: Event) {
    e.stopPropagation();
    try {
      await invoke('local_store_toggle_favorite', { objectId: id });
      objects = objects.map((o) =>
        o.id === id ? { ...o, details: o.details ? JSON.stringify({ ...JSON.parse(o.details), favorite: !isFavorite(o) }) : '{"favorite":true}' } : o
      );
    } catch (err) {
      console.error('[notes] toggle favorite failed:', err);
    }
  }

  function isFavorite(obj: ObjectRow): boolean {
    if (!obj.details) return false;
    try {
      const d = JSON.parse(obj.details);
      return !!d.favorite;
    } catch {
      return false;
    }
  }

  function getObjectPreview(obj: ObjectRow): string {
    if (obj.details) {
      try {
        const d = JSON.parse(obj.details);
        if (d.preview) return d.preview;
      } catch {}
    }
    return 'No content yet';
  }

  function getObjectTags(obj: ObjectRow): string[] {
    if (!obj.details) return [];
    try {
      const d = JSON.parse(obj.details);
      return d.tags ?? [];
    } catch {
      return [];
    }
  }

  // ── Editor operations ────────────────────────────────────────────────

  async function openNote(id: string) {
    activeObjectId = id;
    activeObjectName = '';
    activeObjectIcon = '';
    activeObjectCover = '';
    blocks = [];
    editorLoading = true;

    try {
      const obj = await invoke<ObjectRow>('local_store_get_object', { objectId: id });
      activeObjectName = obj.name || 'Untitled';
      activeObjectIcon = obj.icon || '';
      activeObjectCover = obj.cover || '';
    } catch {}

    try {
      const rows = await invoke<BlockRow[]>('local_store_get_blocks', { objectId: id });
      blocks = rowsToEditorBlocks(rows);
    } catch (err) {
      console.error('[notes] load blocks failed:', err);
    } finally {
      editorLoading = false;
    }
  }

  function closeEditor() {
    activeObjectId = null;
    activeObjectName = '';
    activeObjectIcon = '';
    activeObjectCover = '';
    blocks = [];
  }

  async function updateNoteName(name: string) {
    activeObjectName = name;
    if (!activeObjectId) return;
    try {
      await invoke('local_store_update_object', {
        params: {
          id: activeObjectId,
          name,
          icon: activeObjectIcon || null,
          cover: activeObjectCover || null,
          layout: 'note',
          details: null,
        },
      });
    } catch {}
  }

  async function updateBlockText(blockId: string, text: string) {
    blocks = blocks.map((b) => (b.id === blockId ? { ...b, content: text } : b));
    if (!activeObjectId) return;
    try {
      await invoke('local_store_block_update', {
        params: {
          id: blockId,
          content: text,
          fields: null,
          align: null,
          bgColor: null,
        },
      });
    } catch {}
  }

  async function updateBlockType(blockId: string, type: BlockType) {
    blocks = blocks.map((b) => (b.id === blockId ? { ...b, type } : b));
    // Type changes require no backend update — type is derived from content format;
    // next block save will persist the type via updateBlockText
  }

  async function updateBlockChecked(blockId: string, checked: boolean) {
    blocks = blocks.map((b) => (b.id === blockId ? { ...b, checked } : b));
  }

  async function addBlock(afterId?: string, blockType: BlockType = 'text') {
    if (!activeObjectId) return;
    try {
      const idx = afterId ? blocks.findIndex((b) => b.id === afterId) : blocks.length - 1;
      const pos = idx >= 0 && idx < blocks.length ? blocks[idx].position + 1 : blocks.length;
      // Shift positions of blocks after insertion point
      const shifted = blocks.map((b) => (b.position >= pos ? { ...b, position: b.position + 1 } : b));

      const result: any = await invoke('local_store_block_add', {
        params: {
          objectId: activeObjectId,
          parentId: null,
          type: blockType,
          content: '',
          position: pos,
          fields: null,
          align: null,
          bgColor: null,
        },
      });
      const newBlock: EditorBlock = {
        id: result.block.id,
        objectId: activeObjectId,
        type: blockType,
        content: '',
        checked: false,
        position: pos,
      };
      const insertIdx = idx >= 0 && idx < blocks.length ? idx + 1 : blocks.length;
      blocks = [...shifted.slice(0, insertIdx), newBlock, ...shifted.slice(insertIdx)];
      // Focus new block after render
      await tick();
      focusBlockEditable(newBlock.id);
    } catch {}
  }

  async function deleteBlock(blockId: string) {
    if (!activeObjectId) return;
    const idx = blocks.findIndex((b) => b.id === blockId);
    blocks = blocks.filter((b) => b.id !== blockId);
    try {
      await invoke('local_store_block_delete', { blockId, objectId: activeObjectId });
    } catch {}
    // Focus previous block
    if (idx > 0 && blocks[idx - 1]) {
      await tick();
      focusBlockEditable(blocks[idx - 1].id);
    }
  }

  function focusBlockEditable(blockId: string) {
    const el = document.querySelector(`[data-block-id="${blockId}"] [contenteditable]`);
    if (el instanceof HTMLElement) el.focus();
  }

  // ── Slash menu ──

  let showSlashMenu = $state(false);
  let slashMenuBlockId = $state<string | null>(null);
  let slashQuery = $state('');

  const slashCommands: { label: string; icon: any; type: BlockType }[] = [
    { label: 'Text', icon: TypeIcon, type: 'text' },
    { label: 'Heading 1', icon: Heading1Icon, type: 'heading1' },
    { label: 'Heading 2', icon: Heading2Icon, type: 'heading2' },
    { label: 'To-do', icon: CheckSquareIcon, type: 'todo' },
    { label: 'Bullet list', icon: ListIcon, type: 'bullet' },
    { label: 'Quote', icon: QuoteIcon, type: 'quote' },
    { label: 'Divider', icon: MinusIcon, type: 'divider' },
  ];

  let filteredSlashCommands = $derived(
    slashQuery.trim()
      ? slashCommands.filter((c) => c.label.toLowerCase().includes(slashQuery.toLowerCase()))
      : slashCommands
  );

  function handleSlashInput(blockId: string, value: string) {
    // Detect / command trigger
    if (value.endsWith('/') || (value.match(/\//g)?.length ?? 0) > (slashMenuBlockId === blockId ? 1 : 0)) {
      const slashIndex = value.lastIndexOf('/');
      const query = value.slice(slashIndex + 1);
      // Prevent showing menu mid-word
      if (value.slice(0, slashIndex).length <= 1) {
        showSlashMenu = true;
        slashMenuBlockId = blockId;
        slashQuery = query;
        return;
      }
    }
    if (showSlashMenu && slashMenuBlockId === blockId) {
      showSlashMenu = false;
      slashMenuBlockId = null;
      slashQuery = '';
    }
  }

  function insertBlock(type: BlockType, label: string) {
    if (!slashMenuBlockId) return;
    const idx = blocks.findIndex((b) => b.id === slashMenuBlockId);
    if (idx === -1) return;

    // Remove /command text from current block
    const currentBlock = blocks[idx];
    const slashIndex = currentBlock.content.lastIndexOf('/');
    currentBlock.content = currentBlock.content.slice(0, Math.max(0, slashIndex)).trimEnd();
    updateBlockText(currentBlock.id, currentBlock.content);

    showSlashMenu = false;
    slashMenuBlockId = null;
    slashQuery = '';

    // Insert new block after current
    addBlock(currentBlock.id, type);
  }

  // ── Format toolbar ──

  let showFormatToolbar = $state(false);
  let formatToolbarBlockId = $state<string | null>(null);

  function handleBlockMouseUp(event: MouseEvent, blockId: string) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      showFormatToolbar = true;
      formatToolbarBlockId = blockId;
    } else {
      showFormatToolbar = false;
      formatToolbarBlockId = null;
    }
  }

  function toggleFormat(format: string) {
    showFormatToolbar = false;
    formatToolbarBlockId = null;
  }

  function handleGlobalClick() {
    showSlashMenu = false;
    slashMenuBlockId = null;
    showFormatToolbar = false;
    formatToolbarBlockId = null;
  }

  // ── Block key handlers ──

  function handleBlockKeydown(e: KeyboardEvent, blockId: string) {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock(blockId);
    }

    if (e.key === 'Backspace' && block.content === '' && blocks.length > 1) {
      e.preventDefault();
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx > 0) {
        deleteBlock(blockId);
      }
    }

    if (e.key === 'Backspace' && block.content === '' && blocks.length === 1) {
      e.preventDefault();
    }
  }

  // ── Tags ──────────────────────────────────────────────────────────────

  async function loadAllTags() {
    loading = true;
    error = '';
    try {
      const objectsList: ObjectRow[] = await invoke('local_store_get_objects', {
        typeFilter: null,
        layoutFilter: 'note',
      });
      objects = objectsList;
      const tagSet = new Set<string>();
      for (const obj of objectsList) {
        const tags = getObjectTags(obj);
        for (const t of tags) tagSet.add(t);
      }
      allRelations = Array.from(tagSet).map((t, i) => ({
        id: `tag-${i}`,
        objectId: '',
        key: 'tag',
        value: t,
      }));
    } catch (err) {
      console.error('[notes] load tags failed:', err);
      error = 'Failed to load tags.';
    } finally {
      loading = false;
    }
  }

  let filteredByTag = $derived(
    selectedTag
      ? objects.filter((o) => getObjectTags(o).includes(selectedTag!))
      : objects
  );

  // ── Auto-open most recent note on initial load ───────────────────────

  let hasAutoOpened = false;

  async function loadAndAutoOpen() {
    await loadObjects('note');
    if (objects.length > 0) {
      const sorted = [...objects].sort((a, b) => b.updatedAt - a.updatedAt);
      openNote(sorted[0].id);
    }
  }

  $effect(() => {
    const section = selectedSection;
    if (section === 'All Notes') {
      if (hasAutoOpened) {
        loadObjects('note');
      } else {
        hasAutoOpened = true;
        loadAndAutoOpen();
      }
    } else if (section === 'Recent') {
      loadRecentObjects();
    } else if (section === 'Favorites') {
      loadFavoriteObjects();
    } else if (section === 'Tags') {
      loadAllTags();
    }
  });

  // ── Export ────────────────────────────────────────────────────────────

  async function exportAllNotes(format: 'markdown' | 'json') {
    try {
      const allObjects: ObjectRow[] = await invoke('local_store_get_objects', {
        typeFilter: null,
        layoutFilter: 'note',
      });

      if (format === 'markdown') {
        for (const obj of allObjects) {
          const rows: BlockRow[] = await invoke('local_store_get_blocks', { objectId: obj.id });
          const editorBlocks = rowsToEditorBlocks(rows);
          const mdContent = editorBlocks.map((b) => b.content).filter(Boolean).join('\n\n');
          const header = `# ${obj.name || 'Untitled'}\n\n`;
          const blob = new Blob([header + mdContent], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${obj.name || 'untitled'}.md`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const data = await Promise.all(
          allObjects.map(async (obj) => {
            const rows: BlockRow[] = await invoke('local_store_get_blocks', { objectId: obj.id });
            return {
              id: obj.id,
              name: obj.name,
              icon: obj.icon,
              cover: obj.cover,
              createdAt: obj.createdAt,
              updatedAt: obj.updatedAt,
              blocks: rowsToEditorBlocks(rows),
            };
          })
        );
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bento-notes-export.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[notes] export failed:', err);
    }
  }

  // Editing focus tracking
  let editingBlockId = $state<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────

  function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function blockIcon(type: BlockType) {
    switch (type) {
      case 'heading1': return Heading1Icon;
      case 'heading2': return Heading2Icon;
      case 'todo': return CheckSquareIcon;
      case 'bullet': return ListIcon;
      case 'quote': return QuoteIcon;
      case 'divider': return MinusIcon;
      default: return null;
    }
  }
</script>

<svelte:window onclick={handleGlobalClick} />

<main class="notes-workspace module-root">
  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="notes-header-top">
    <h1>Notes</h1>
    <p class="notes-subtitle">Capture everything with the rich block editor</p>
  </div>

  {#if activeObjectId}
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- EDITOR VIEW — Anytype-style rich block editor                 -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="editor-view">
      <!-- Back button -->
      <div class="editor-toolbar">
        <button class="toolbar-btn" onclick={closeEditor} aria-label="Back to notes">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
      </div>

      {#if editorLoading}
        <div class="editor-loading">
          <div class="loading-spinner"></div>
          <p>Loading note…</p>
        </div>
      {:else}
        <div class="editor-canvas">
          <div class="editor-canvas__inner">
            <!-- Page title with blur placeholder -->
            <div class="editor-title">
              <span class="editor-title__icon">{activeObjectIcon || '📄'}</span>
              <div class="editor-title__field-wrapper">
                <input
                  type="text"
                  class="editor-title__input"
                  placeholder="Untitled"
                  value={activeObjectName}
                  oninput={(e) => updateNoteName(e.currentTarget.value)}
                />
              </div>
            </div>

            <!-- Blocks -->
            <div class="editor-blocks">
              {#each blocks as block, idx (block.id)}
                <div
                  class="editor-block"
                  class:editor-block--empty={block.content === '' && block.type === 'text'}
                  data-block-id={block.id}
                >
                  <!-- Grip handle -->
                  <div class="editor-block__grip">
                    <GripVerticalIcon size={12} class="editor-block__grip-icon" />
                  </div>

                  {#if block.type === 'heading1'}
                    <h2 class="editor-block__heading1">{block.content}</h2>

                  {:else if block.type === 'heading2'}
                    <h3 class="editor-block__heading2">{block.content}</h3>

                  {:else if block.type === 'todo'}
                    <div class="editor-block__todo" role="button" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}>
                      <input
                        type="checkbox"
                        checked={block.checked}
                        onchange={() => updateBlockChecked(block.id, !block.checked)}
                      />
                      <span class:editor-block__todo--done={block.checked}>
                        {block.content}
                      </span>
                    </div>

                  {:else if block.type === 'bullet'}
                    <div class="editor-block__bullet">
                      <span class="editor-block__bullet-marker">•</span>
                      <span>{block.content}</span>
                    </div>

                  {:else if block.type === 'quote'}
                    <blockquote class="editor-block__quote">{block.content}</blockquote>

                  {:else if block.type === 'divider'}
                    <div class="editor-block__divider">
                      <hr />
                    </div>

                  {:else}
                    <!-- Default text block (contenteditable) -->
                    <div class="editor-block__content" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                      {#if true}
                        <div
                          class="editor-block__text"
                          contenteditable={true}
                          role="textbox"
                          aria-multiline="false"
                          tabindex="0"
                          aria-label="Block content"
                          onfocus={(e) => {
                            editingBlockId = block.id;
                          }}
                          onblur={() => {
                            if (block.content === '') editingBlockId = null;
                          }}
                          oninput={(e) => {
                            const target = e.currentTarget;
                            const text = target.textContent ?? '';
                            updateBlockText(block.id, text);
                            handleSlashInput(block.id, text);
                          }}
                          onkeydown={(e) => handleBlockKeydown(e, block.id)}
                          onmouseup={(e) => handleBlockMouseUp(e, block.id)}
                          ondragstart={() => false}
                        >{block.content}</div>
                      {/if}

                      <!-- Placeholder -->
                      {#if block.content === ''}
                        <span class="editor-block__placeholder">
                          Type / for commands, or just start typing…
                        </span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}

              <!-- Empty state -->
              {#if blocks.length === 0}
                <div class="editor-block editor-block--empty">
                  <div class="editor-block__grip">
                    <GripVerticalIcon size={12} class="editor-block__grip-icon" />
                  </div>
                  <div class="editor-block__content">
                    <div
                      class="editor-block__text"
                      contenteditable={true}
                      role="textbox"
                      tabindex="0"
                      aria-label="Block content"
                      oninput={(e) => {
                        const text = e.currentTarget.textContent ?? '';
                        if (text.trim()) addBlock(undefined, 'text');
                      }}
                      onfocus={(e) => { editingBlockId = '__new'; }}
                      onblur={() => { editingBlockId = null; }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          addBlock(undefined, 'text');
                        }
                      }}
                    ></div>
                    <span class="editor-block__placeholder">
                      Start writing, or type / for commands…
                    </span>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Slash command menu -->
      {#if showSlashMenu}
        <div class="editor-slash-menu" role="dialog" aria-label="Block type selector" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <div class="editor-slash-menu__header">
            <span class="editor-slash-menu__title">Basic blocks</span>
          </div>
          <div class="editor-slash-menu__items">
            {#each filteredSlashCommands as cmd}
              <button
                class="editor-slash-menu__item"
                onclick={() => insertBlock(cmd.type, cmd.label)}
                type="button"
              >
                <span class="editor-slash-menu__item-icon">
                  <cmd.icon size={16} />
                </span>
                <span class="editor-slash-menu__item-label">{cmd.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Format toolbar -->
      {#if showFormatToolbar}
        <div class="editor-format-toolbar" role="toolbar" aria-label="Text formatting" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <button class="editor-format-toolbar__btn" onclick={() => toggleFormat('bold')} type="button" aria-label="Bold">
            <BoldIcon size={14} />
          </button>
          <button class="editor-format-toolbar__btn" onclick={() => toggleFormat('italic')} type="button" aria-label="Italic">
            <ItalicIcon size={14} />
          </button>
          <button class="editor-format-toolbar__btn" onclick={() => toggleFormat('underline')} type="button" aria-label="Underline">
            <UnderlineIcon size={14} />
          </button>
          <button class="editor-format-toolbar__btn" onclick={() => toggleFormat('strikethrough')} type="button" aria-label="Strikethrough">
            <StrikethroughIcon size={14} />
          </button>
          <div class="editor-format-toolbar__sep"></div>
          <button class="editor-format-toolbar__btn" onclick={() => toggleFormat('code')} type="button" aria-label="Code">
            <CodeIcon size={14} />
          </button>
          <button class="editor-format-toolbar__btn" onclick={() => toggleFormat('link')} type="button" aria-label="Link">
            <LinkIcon size={14} />
          </button>
        </div>
      {/if}
    </div>

  {:else if selectedSection === 'All Notes'}
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- ALL NOTES — Object library                                    -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="section-content">
      <div class="section-toolbar">
        <button class="create-btn" onclick={createNote}>
          <Plus size={16} />
          <span>New Note</span>
        </button>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading notes…</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <button class="retry-btn" onclick={() => loadObjects('note')}>Retry</button>
        </div>
      {:else}
        {#if objects.length === 0}
          <div class="empty-state">
            <FileText size={48} class="empty-icon" />
            <p class="empty-title">No notes yet</p>
            <p class="empty-desc">Create your first note to start capturing ideas.</p>
            <button class="create-btn" onclick={createNote}>
              <Plus size={16} />
              <span>Create Note</span>
            </button>
          </div>
        {:else}
          <div class="notes-grid">
            {#each objects as obj (obj.id)}
              <div class="note-card" role="button" tabindex="0" onclick={() => openNote(obj.id)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openNote(obj.id))}>
                <div class="note-card-header">
                  <span class="note-card-icon">{obj.icon || '📄'}</span>
                  <button
                    class="fav-btn"
                    class:faved={isFavorite(obj)}
                    onclick={(e) => { e.stopPropagation(); toggleFavorite(obj.id, e); }}
                    aria-label={isFavorite(obj) ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star size={14} />
                  </button>
                </div>
                <h3 class="note-card-title">{obj.name || 'Untitled'}</h3>
                <p class="note-card-preview">{truncate(getObjectPreview(obj), 100)}</p>
                <div class="note-card-footer">
                  <span class="note-card-date">
                    <Clock size={12} />
                    {formatDate(obj.updatedAt)}
                  </span>
                  {#if getObjectTags(obj).length > 0}
                    <div class="note-card-tags">
                      {#each getObjectTags(obj).slice(0, 2) as tag}
                        <span class="mini-tag">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

  {:else if selectedSection === 'Recent'}
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- RECENT — Recently edited notes                                -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="section-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading recent notes…</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
        </div>
      {:else if objects.length === 0}
        <div class="empty-state">
          <Clock size={48} class="empty-icon" />
          <p class="empty-title">No recent activity</p>
          <p class="empty-desc">Your recently edited notes will appear here.</p>
        </div>
      {:else}
        <div class="recent-list">
          {#each objects as obj (obj.id)}
            <button class="recent-item" onclick={() => openNote(obj.id)}>
              <div class="recent-item-icon">{obj.icon || '📄'}</div>
              <div class="recent-item-body">
                <span class="recent-item-title">{obj.name || 'Untitled'}</span>
                <span class="recent-item-preview">{truncate(getObjectPreview(obj), 80)}</span>
              </div>
              <div class="recent-item-meta">
                <span class="recent-item-time">{formatDate(obj.updatedAt)}</span>
                {#if isFavorite(obj)}
                  <Star size={12} class="faved-icon" />
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

  {:else if selectedSection === 'Favorites'}
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- FAVORITES — Starred notes                                     -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="section-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading favorites…</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
        </div>
      {:else if objects.length === 0}
        <div class="empty-state">
          <Star size={48} class="empty-icon" />
          <p class="empty-title">No favorites yet</p>
          <p class="empty-desc">Star notes to save them here for quick access.</p>
        </div>
      {:else}
        <div class="notes-grid">
          {#each objects as obj (obj.id)}
            <div class="note-card faved" role="button" tabindex="0" onclick={() => openNote(obj.id)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openNote(obj.id))}>
              <div class="note-card-header">
                <span class="note-card-icon">{obj.icon || '📄'}</span>
                <Star size={14} class="faved-icon" />
              </div>
              <h3 class="note-card-title">{obj.name || 'Untitled'}</h3>
              <p class="note-card-preview">{truncate(getObjectPreview(obj), 100)}</p>
              <div class="note-card-footer">
                <span class="note-card-date">
                  <Clock size={12} />
                  {formatDate(obj.updatedAt)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if selectedSection === 'Tags'}
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- TAGS — Tag cloud + filtered note list                         -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="section-content">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading tags…</p>
        </div>
      {:else}
        <div class="tags-layout">
          <div class="tag-cloud">
            <h3 class="tags-section-title">Tags</h3>
            {#if allRelations.length === 0}
              <p class="tags-empty">No tags yet. Add tags to your notes to see them here.</p>
            {:else}
              <div class="tag-list">
                <button
                  class="tag-chip {selectedTag === null ? 'active' : ''}"
                  onclick={() => { selectedTag = null; }}
                >All</button>
                {#each allRelations as rel}
                  <button
                    class="tag-chip {selectedTag === rel.value ? 'active' : ''}"
                    onclick={() => { selectedTag = rel.value; }}
                  >{rel.value}</button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="tagged-notes">
            <h3 class="tags-section-title">
              {selectedTag ? `Notes tagged "${selectedTag}"` : 'All Notes'}
            </h3>
            {#if filteredByTag.length === 0}
              <p class="tags-empty">No notes with this tag.</p>
            {:else}
              <div class="notes-list">
                {#each filteredByTag as obj (obj.id)}
                  <button class="note-row" onclick={() => openNote(obj.id)}>
                    <span class="note-row-icon">{obj.icon || '📄'}</span>
                    <span class="note-row-title">{obj.name || 'Untitled'}</span>
                    <span class="note-row-date">{formatDate(obj.updatedAt)}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

  {:else if selectedSection === 'Export'}
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- EXPORT — Export notes as Markdown, JSON                       -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="section-content">
      <div class="export-layout">
        <div class="export-card" role="button" tabindex="0" onclick={() => exportAllNotes('markdown')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), exportAllNotes('markdown'))}>
          <BookOpen size={32} class="export-card-icon" />
          <h3 class="export-card-title">Markdown</h3>
          <p class="export-card-desc">Export all notes as individual .md files</p>
        </div>
        <div class="export-card" role="button" tabindex="0" onclick={() => exportAllNotes('json')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), exportAllNotes('json'))}>
          <Download size={32} class="export-card-icon" />
          <h3 class="export-card-title">JSON Backup</h3>
          <p class="export-card-desc">Full data export for backup or migration</p>
        </div>
      </div>
      <div class="export-info">
        <p>Your notes are stored locally in the SQLite database. Export formats let you back up or transfer your data.</p>
      </div>
    </div>
  {/if}
</main>

<style>
  /* ════════════════════════════════════════════════════════════════════════
     NOTES WORKSPACE
     ════════════════════════════════════════════════════════════════════════ */

  .notes-workspace {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: 100%;
    padding: 32px 32px 40px;
    gap: 24px;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: var(--shell-scrollbar-thumb) var(--shell-scrollbar-track);
    background: var(--background);
    color: var(--foreground);
  }

  .notes-workspace::-webkit-scrollbar { width: var(--shell-scrollbar-size); }
  .notes-workspace::-webkit-scrollbar-track { background: var(--shell-scrollbar-track); }
  .notes-workspace::-webkit-scrollbar-thumb {
    border: 0.08rem solid transparent;
    border-radius: 999px;
    background-clip: padding-box;
    background: var(--shell-scrollbar-thumb);
  }

  .notes-header-top {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }

  .notes-header-top h1 {
    margin: 0;
    font-size: clamp(2rem, 2.8vw, 2.9rem);
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  .notes-subtitle {
    margin: 0;
    color: var(--muted);
    font-size: 1rem;
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 10px;
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .create-btn:hover { opacity: 0.9; }

  /* ── Editor view ──────────────────────────────────────────────────── */

  .editor-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;
  }

  .toolbar-btn:hover {
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  .editor-canvas {
    display: flex;
    justify-content: center;
  }

  .editor-canvas__inner {
    width: 100%;
    max-width: 720px;
    position: relative;
  }

  /* ── Page Title ── */

  .editor-title {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 32px;
  }

  .editor-title__icon {
    font-size: 36px;
    line-height: 1;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .editor-title__field-wrapper {
    flex: 1;
    position: relative;
  }

  .editor-title__input {
    width: 100%;
    border: none;
    background: transparent;
    outline: none;
    font-family: var(--font-heading);
    font-size: 40px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--foreground);
    padding: 0;
    margin: 0;
  }

  .editor-title__input::placeholder {
    color: var(--muted);
    opacity: 0.3;
    filter: blur(4px);
  }

  /* ── Block Editor ── */

  .editor-blocks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .editor-block {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 3px 0;
    position: relative;
    min-height: 28px;
  }

  .editor-block--empty {
    min-height: 28px;
  }

  /* Grip handle */
  .editor-block__grip {
    position: absolute;
    left: -32px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 120ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 24px;
    cursor: grab;
    color: var(--muted);
  }

  .editor-block:hover .editor-block__grip {
    opacity: 0.5;
  }

  .editor-block__grip:hover {
    opacity: 1 !important;
  }

  :global(.editor-block__grip-icon) {
    display: block;
  }

  /* Default text block */
  .editor-block__content {
    flex: 1;
    position: relative;
    min-height: 24px;
  }

  .editor-block__text {
    font-size: 15px;
    line-height: 1.6;
    color: var(--foreground);
    outline: none;
    min-height: 24px;
    padding: 2px 0;
    caret-color: var(--foreground);
  }

  .editor-block__placeholder {
    position: absolute;
    left: 0;
    top: 2px;
    font-size: 15px;
    line-height: 1.6;
    color: var(--muted);
    opacity: 0.4;
    pointer-events: none;
  }

  /* Heading 1 */
  .editor-block__heading1 {
    font-family: var(--font-heading);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--foreground);
    margin: 8px 0 4px;
  }

  /* Heading 2 */
  .editor-block__heading2 {
    font-family: var(--font-heading);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.015em;
    color: var(--foreground);
    margin: 6px 0 4px;
  }

  /* To-do */
  .editor-block__todo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 0;
    cursor: default;
  }

  .editor-block__todo input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border: 2px solid color-mix(in srgb, var(--foreground) 24%, transparent);
    border-radius: 4px;
    flex-shrink: 0;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .editor-block__todo input[type="checkbox"]:checked {
    background: var(--foreground);
    border-color: var(--foreground);
  }

  .editor-block__todo input[type="checkbox"]:checked::after {
    content: "";
    width: 5px;
    height: 9px;
    border: solid var(--background);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-top: -1px;
  }

  .editor-block__todo span {
    font-size: 15px;
    line-height: 1.6;
    color: var(--foreground);
  }

  .editor-block__todo--done {
    text-decoration: line-through;
    color: var(--muted) !important;
  }

  /* Bullet */
  .editor-block__bullet {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 2px 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--foreground);
  }

  .editor-block__bullet-marker {
    color: var(--muted);
    flex-shrink: 0;
    width: 18px;
    text-align: center;
  }

  /* Quote */
  .editor-block__quote {
    margin: 8px 0;
    padding: 8px 0 8px 20px;
    border-left: 3px solid color-mix(in srgb, var(--foreground) 16%, transparent);
    font-size: 16px;
    line-height: 1.6;
    color: var(--muted);
    font-style: italic;
  }

  /* Divider */
  .editor-block__divider {
    padding: 12px 0;
  }

  .editor-block__divider hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0;
  }

  /* ── Slash Menu ── */

  .editor-slash-menu {
    position: absolute;
    left: 60px;
    top: 280px;
    width: 260px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    overflow: hidden;
    z-index: 100;
  }

  .editor-slash-menu__header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }

  .editor-slash-menu__items {
    display: flex;
    flex-direction: column;
    padding: 4px;
  }

  .editor-slash-menu__item {
    all: unset;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: default;
    font-size: 13px;
    color: var(--foreground);
    transition: background 120ms ease;
  }

  .editor-slash-menu__item:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .editor-slash-menu__item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    color: var(--muted);
    flex-shrink: 0;
  }

  /* ── Format Toolbar ── */

  .editor-format-toolbar {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 240px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    z-index: 100;
  }

  .editor-format-toolbar__btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: default;
    color: var(--muted);
    transition: background 120ms ease, color 120ms ease;
  }

  .editor-format-toolbar__btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }

  .editor-format-toolbar__sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 2px;
  }

  /* ── Notes grid ──────────────────────────────────────────────────── */

  .notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .note-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    width: 100%;
  }

  .note-card:hover {
    background: color-mix(in srgb, var(--foreground) 4%, var(--surface));
  }

  .note-card.faved {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  }

  .note-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .note-card-icon {
    font-size: 1.8rem;
    line-height: 1;
  }

  .fav-btn {
    padding: 4px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .fav-btn.faved { color: var(--accent); }
  .fav-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  :global(.faved-icon) { color: var(--accent); }

  .note-card-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--foreground);
  }

  .note-card-preview {
    margin: 0;
    font-size: 0.88rem;
    color: var(--muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .note-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: auto;
    padding-top: 8px;
  }

  .note-card-date {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    color: var(--muted);
  }

  .note-card-tags { display: flex; gap: 4px; }
  .mini-tag {
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--border) 60%, transparent);
    font-size: 0.72rem;
    color: var(--muted);
  }

  /* ── Recent list ──────────────────────────────────────────────────── */

  .recent-list { display: flex; flex-direction: column; gap: 4px; }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    width: 100%;
  }

  .recent-item:hover { background: color-mix(in srgb, var(--foreground) 3%, var(--surface)); }
  .recent-item-icon { font-size: 1.5rem; flex-shrink: 0; }

  .recent-item-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .recent-item-title {
    font-weight: 600;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recent-item-preview {
    font-size: 0.85rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recent-item-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .recent-item-time { white-space: nowrap; }

  /* ── Tags layout ──────────────────────────────────────────────────── */

  .tags-layout { display: flex; flex-direction: column; gap: 24px; }

  .tags-section-title {
    margin: 0 0 8px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--foreground);
  }

  .tag-cloud {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
  }

  .tag-list { display: flex; flex-wrap: wrap; gap: 8px; }

  .tag-chip {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font-size: 0.85rem;
    cursor: pointer;
    font: inherit;
  }

  .tag-chip:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }
  .tag-chip.active {
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    border-color: var(--primary);
  }

  .tags-empty { color: var(--muted); font-size: 0.9rem; }

  .tagged-notes {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
  }

  .notes-list { display: flex; flex-direction: column; gap: 4px; }

  .note-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    border: none;
    background: transparent;
    width: 100%;
  }

  .note-row:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .note-row-icon { font-size: 1.2rem; flex-shrink: 0; }
  .note-row-title { flex: 1; font-weight: 500; font-size: 0.92rem; }
  .note-row-date { font-size: 0.8rem; color: var(--muted); flex-shrink: 0; }

  /* ── Export ────────────────────────────────────────────────────────── */

  .export-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  .export-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 24px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    cursor: pointer;
    text-align: center;
    color: inherit;
    font: inherit;
  }

  .export-card:hover { background: color-mix(in srgb, var(--foreground) 3%, var(--surface)); }
  :global(.export-card-icon) { color: var(--primary); }
  .export-card-title { margin: 0; font-size: 1.1rem; font-weight: 700; }
  .export-card-desc { margin: 0; font-size: 0.88rem; color: var(--muted); }

  .export-info {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface) 96%, var(--background));
  }

  .export-info p { margin: 0; font-size: 0.9rem; color: var(--muted); }

  /* ── State indicators ──────────────────────────────────────────────── */

  .loading-state, .editor-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 24px;
    color: var(--muted);
  }

  .loading-spinner {
    width: 22px;
    height: 22px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 24px;
    color: var(--destructive, #ef4444);
  }

  .retry-btn {
    padding: 6px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 60px 24px;
    text-align: center;
  }

  :global(.empty-icon) { color: var(--muted); opacity: 0.4; }
  .empty-title { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--foreground); }
  .empty-desc { margin: 0; font-size: 0.92rem; color: var(--muted); }

  @media (max-width: 720px) {
    .notes-workspace { padding: 24px 18px 32px; }
    .notes-grid { grid-template-columns: 1fr; }
    .export-layout { grid-template-columns: 1fr; }
  }
</style>
