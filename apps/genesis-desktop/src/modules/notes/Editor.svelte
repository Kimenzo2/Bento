<script lang="ts">
  import { tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Plus, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, CheckSquare, Minus, Bold, Italic, Underline, Strikethrough, Link2, GripVertical, Trash2, Copy } from 'lucide-svelte';
  import { BlockRenderer } from './components/blocks/index.js';
  import { editorStore, rootBlocks, titleBlock, focusedBlock, isEditorLoading } from '$lib/local-store/store.js';
  import { TextStyle, MarkType } from '$lib/local-store/block.js';
  import type { Block, ContentText, Mark, TextRange } from '$lib/local-store/block.js';
  import { isTextBlock, isTextCode, isTextTitle, isTextDescription, isTextHeader, canHaveMarks } from '$lib/local-store/block.js';

  let { objectId = '', onTitleChange = undefined }: {
    objectId?: string;
    onTitleChange?: (id: string, title: string) => void;
  } = $props();

  // ── Init store on mount ───────────────────────────────────────────
  let blocks = $derived($rootBlocks);
  let title = $derived($titleBlock);
  let focused = $derived($focusedBlock);
  let loading = $derived($isEditorLoading);

  // ── Floating UI state ────────────────────────────────────────────
  let showBlockActions = $state<string | null>(null);
  let actionMenuStyle = $state({ top: '0px', left: '0px' });
  let showFormatToolbar = $state(false);
  let formatToolbarStyle = $state({ top: '0px', left: '0px' });
  let formatBlockId = $state<string | null>(null);
  let showSlashMenu = $state(false);
  let slashMenuStyle = $state({ top: '0px', left: '0px' });
  let slashQuery = $state('');
  let slashMenuIndex = $state(0);
  let slashAnchorBlockId = $state<string | null>(null);
  let editorEl: HTMLDivElement;

  // ── Drag reorder state ──────────────────────────────────────────
  let dragBlockId = $state<string | null>(null);
  let dragOverBlockId = $state<string | null>(null);
  let dragOverPos = $state<'top' | 'bottom'>('bottom');

  function onDragStart(e: DragEvent, blockId: string) {
    dragBlockId = blockId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockId);
    }
  }

  function onDragOver(e: DragEvent, blockId: string) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = 'move';
    dragOverBlockId = blockId;
    const el = (e.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    dragOverPos = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
  }

  function onDragLeave() {
    dragOverBlockId = null;
  }

  async function onDrop(e: DragEvent, targetBlockId: string) {
    e.preventDefault();
    const sourceId = dragBlockId;
    dragBlockId = null;
    dragOverBlockId = null;
    if (!sourceId || sourceId === targetBlockId) return;

    // Compute new index
    const ids = blocks.map(b => b.id!);
    const fromIdx = ids.indexOf(sourceId);
    let toIdx = ids.indexOf(targetBlockId);
    if (dragOverPos === 'bottom') toIdx += 1;
    if (fromIdx === -1 || toIdx === -1) return;
    const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
    await editorStore.moveBlock(sourceId, adjusted);
  }

  function onDragEnd() {
    dragBlockId = null;
    dragOverBlockId = null;
  }

  // ── Slash command definitions ────────────────────────────────────
  const SLASH_COMMANDS = [
    { type: 'paragraph', icon: Plus, label: 'Text', style: TextStyle.Paragraph },
    { type: 'h1', icon: Heading1, label: 'Heading 1', style: TextStyle.Header1 },
    { type: 'h2', icon: Heading2, label: 'Heading 2', style: TextStyle.Header2 },
    { type: 'h3', icon: Heading3, label: 'Heading 3', style: TextStyle.Header3 },
    { type: 'bullet', icon: List, label: 'Bulleted list', style: TextStyle.Bulleted },
    { type: 'numbered', icon: ListOrdered, label: 'Numbered list', style: TextStyle.Numbered },
    { type: 'todo', icon: CheckSquare, label: 'To-do list', style: TextStyle.Checkbox },
    { type: 'quote', icon: Quote, label: 'Quote', style: TextStyle.Quote },
    { type: 'code', icon: Code2, label: 'Code block', style: TextStyle.Code },
    { type: 'divider', icon: Minus, label: 'Divider', style: null },
  ];

  let filteredCommands = $derived.by(() => {
    if (!slashQuery) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((c) => c.label.toLowerCase().includes(slashQuery.toLowerCase()));
  });

  let loadedObjectId = '';

  $effect(() => {
    if (!objectId || objectId === loadedObjectId) return;
    loadedObjectId = objectId;
    void editorStore.init(objectId);
  });

  // ── DOM focus helper ──────────────────────────────────────────────
  // After the store creates a new block, focus its contenteditable
  // with the cursor placed at the given position.
  async function focusBlockElement(blockId: string, cursorPos: number = 0) {
    await tick(); // wait for Svelte to flush DOM updates
    const el = document.querySelector<HTMLElement>(
      `[data-block-id="${blockId}"] .editable`,
    );
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let charIndex = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const nextIndex = charIndex + node.textContent!.length;
      if (charIndex <= cursorPos && cursorPos <= nextIndex) {
        range.setStart(node, cursorPos - charIndex);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      charIndex = nextIndex;
    }
    // Fallback: cursor at end
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── Local click: close floating menus when clicking outside ──────
  function handleEditorMouseDown(e: MouseEvent) {
    const target = e.target as Node;
    // Only process clicks within the editor
    if (!editorEl?.contains(target)) {
      // Click outside editor — close all floating UIs
      if (showSlashMenu) showSlashMenu = false;
      if (showBlockActions) showBlockActions = null;
      if (showFormatToolbar) showFormatToolbar = false;
      return;
    }
    if (showSlashMenu && !target.closest?.('.slash-menu')) showSlashMenu = false;
    if (showBlockActions && !target.closest?.('.block-actions')) showBlockActions = null;
    if (showFormatToolbar && !target.closest?.('.format-toolbar')) showFormatToolbar = false;
  }

  // ── Handlers ──────────────────────────────────────────────────────

  function handleFocus(e?: any) {
    // Focus tracking is delegated to BlockText
  }

  function handleBlur() {
    editorStore.blurBlock();
  }

  /** Persist text changes to the store (and thus to SQLite). */
  function handleUpdate(blockId: string, text: string, marks: Mark[]) {
    if (!blockId) return;
    editorStore.setBlockText(blockId, text, marks);
    // If this is the title block, notify the parent (sidebar list update)
    if ($titleBlock?.id === blockId && onTitleChange) {
      onTitleChange(objectId, text);
      void invoke('notes_object_update', { params: { id: objectId, title: text } })
        .catch((err) => console.error('[notes] title metadata update failed:', err));
    }
  }

  /** Convert a block's style (e.g. from markdown trigger like `# ` → H1). */
  function handleStyleConvert(blockId: string, style: TextStyle) {
    if (!blockId) return;
    editorStore.convertBlockStyle(blockId, style);
  }

  async function handleKeyDown(
    e: any,
    value: string,
    marks: any[],
    range: TextRange,
    props: { block: Block; rootId: string; readonly: boolean },
  ) {
    const { block } = props;
    const blockId = block.id;
    if (!blockId) return;

    // Enter pressed on text block — split into two blocks
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const text = value;
      const before = text.slice(0, range.from);
      const after = text.slice(range.from);

      // Save text before cursor
      await editorStore.setBlockText(blockId, before);

      // Create new block after current one
      const newId = await editorStore.addBlock(blockId, after, (block.content as ContentText)?.style);

      // Focus the new block
      if (newId) {
        editorStore.focusBlock(newId);
        focusBlockElement(newId, 0);
      }
      return;
    }      // Backspace on empty block — merge with previous
    if (e.key === 'Backspace' && value === '' && range.from === 0) {
      e.preventDefault();
      if (blocks.length <= 1) return;

      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx <= 0) return;

      const prev = blocks[idx - 1];
      const prevId = prev.id;
      if (!prevId) return;

      const prevText = (prev.content as ContentText)?.text ?? '';
      await editorStore.setBlockText(prevId, prevText + value);

      await editorStore.deleteBlock(blockId);
      editorStore.focusBlock(prevId);
      focusBlockElement(prevId);
      return;
    }

    // Arrow up at start — focus previous block
    if (e.key === 'ArrowUp' && range.from === 0) {
      e.preventDefault();
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx > 0) {
        const prevId = blocks[idx - 1].id;
        if (prevId) {
          editorStore.focusBlock(prevId);
          const prevText = (blocks[idx - 1].content as ContentText)?.text ?? '';
          focusBlockElement(prevId, prevText.length);
        }
      }
      return;
    }

    // Arrow down at end — focus next block
    if (e.key === 'ArrowDown' && range.from >= value.length) {
      e.preventDefault();
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx < blocks.length - 1) {
        const nextId = blocks[idx + 1].id;
        if (nextId) {
          editorStore.focusBlock(nextId);
          focusBlockElement(nextId, 0);
        }
      }
      return;
    }

    // Escape — close floating menus
    if (e.key === 'Escape') {
      if (showSlashMenu) { showSlashMenu = false; return; }
      if (showBlockActions) { showBlockActions = null; return; }
      if (showFormatToolbar) { showFormatToolbar = false; return; }
    }
  }

  function handleKeyUp(e: any, value: string, marks: any[], range: TextRange, props: any) {
    // Delegate markdown trigger handling to BlockText
    const blockId = props.block?.id;
    if (!blockId) return;

    // Slash trigger
    if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      if (el && editorEl) {
        const rect = el.getBoundingClientRect();
        const edRect = editorEl.getBoundingClientRect();
        slashMenuStyle = { top: `${rect.top - edRect.top + rect.height}px`, left: '24px' };
      }
      showSlashMenu = true;
      slashQuery = '';
      slashMenuIndex = 0;
      slashAnchorBlockId = blockId;
      return;
    }

    // Filter slash menu
    if (showSlashMenu && slashAnchorBlockId === blockId) {
      const before = value.slice(0, range.from);
      const si = before.lastIndexOf('/');
      if (si >= 0) slashQuery = before.slice(si + 1);
    }
  }

  async function handleSlashSelect(command: typeof SLASH_COMMANDS[0]) {
    if (!slashAnchorBlockId) return;
    if (command.style !== null) {
      const block = editorStore.getBlock(slashAnchorBlockId);
      const content = block && isTextBlock(block) ? (block.content as ContentText).text.replace(/\/.*$/, '').trim() : '';
      if (content === '') {
        await editorStore.convertBlockStyle(slashAnchorBlockId, command.style);
      } else {
        const newId = await editorStore.addBlock(slashAnchorBlockId, '', command.style);
        if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
      }
    } else {
      const newId = await editorStore.addBlock(slashAnchorBlockId, '');
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    }
    showSlashMenu = false;
    slashAnchorBlockId = null;
  }

  function openBlockActions(blockId: string, e: MouseEvent) {
    e.stopPropagation();
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (el && editorEl) {
      const rect = el.getBoundingClientRect();
      const edRect = editorEl.getBoundingClientRect();
      actionMenuStyle = { top: `${rect.top - edRect.top}px`, left: '-8px' };
    }
    showBlockActions = blockId;
  }

  async function handleDuplicateBlock(blockId: string) {
    await editorStore.duplicateBlock(blockId);
    showBlockActions = null;
  }

  async function handleDeleteBlock(blockId: string) {
    await editorStore.deleteBlock(blockId);
    showBlockActions = null;
  }

  function handleTextSelection(blockId: string) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !editorEl) { showFormatToolbar = false; return; }
    const el = document.querySelector(`[data-block-id="${blockId}"] .editable`);
    if (!el) { showFormatToolbar = false; return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const edRect = editorEl.getBoundingClientRect();
    formatToolbarStyle = {
      top: `${rect.top - edRect.top - 40}px`,
      left: `${(rect.left - edRect.left) + (rect.width / 2)}px`,
    };
    formatBlockId = blockId;
    showFormatToolbar = true;
  }

  async function handleFormatAction(markType: MarkType) {
    if (!formatBlockId) return;
    await editorStore.applyMarkToSelection(formatBlockId, markType);
    showFormatToolbar = false;
  }

  async function addBlockBelow(blockId?: string) {
    if (blockId) {
      const newId = await editorStore.addBlock(blockId);
      if (newId) { editorStore.focusBlock(newId); focusBlockElement(newId, 0); }
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.id) addBlockBelow(last.id);
    }
  }

  function handleToggle(blockId?: string) {
    if (!blockId) return;
    editorStore.setToggleOpen(blockId, !editorStore.isToggleOpen(blockId));
  }
</script>

<div class="notes-editor" bind:this={editorEl} onmousedown={handleEditorMouseDown}>
  {#if loading}
    <div class="editor-loading">
      <div class="loading-spinner"></div>
      <p>Loading document…</p>
    </div>
  {:else}
    <!-- ── Title ─────────────────────────────────────────────────────────── -->
    <div class="editor-header">
      {#if title}
        <BlockRenderer
          block={title}
          rootId="root"
          blockIndex={0}
          onUpdate={handleUpdate}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onToggle={handleToggle}
          onStyleConvert={handleStyleConvert}
        />
      {/if}
    </div>

    <!-- ── Description ──────────────────────────────────────────────────── -->
    {#each blocks as block, i (block.id)}
      {#if block.content && 'style' in block.content && isTextDescription((block.content as ContentText).style)}
        <div class="editor-description">
          <BlockRenderer
            {block}
            rootId="root"
            blockIndex={i}
            onUpdate={handleUpdate}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onToggle={handleToggle}
            onStyleConvert={handleStyleConvert}
          />
        </div>
      {/if}
    {/each}

    <!-- ── Content blocks (non-title, non-description) ──────────────────── -->
    <div class="editor-blocks">
      {#each blocks as block, i (block.id)}
        {#if !('style' in (block.content ?? {})) || (!isTextTitle((block.content as ContentText).style) && !isTextDescription((block.content as ContentText).style))}
          <div
            class="block-wrapper"
            class:is-dragging={dragBlockId === block.id}
            class:drag-over-top={dragOverBlockId === block.id && dragOverPos === 'top'}
            class:drag-over-bottom={dragOverBlockId === block.id && dragOverPos === 'bottom'}
            draggable={true}
            ondragstart={(e) => onDragStart(e, block.id!)}
            ondragover={(e) => onDragOver(e, block.id!)}
            ondragleave={onDragLeave}
            ondrop={(e) => onDrop(e, block.id!)}
            ondragend={onDragEnd}
          >
            <!-- ── Grip handle ── -->
            <div class="block-controls">
              <button
                class="block-grip"
                aria-label="Drag to reorder"
                title="Drag to reorder"
                tabindex="-1"
              >
                <GripVertical size={14} />
              </button>
              <button
                class="block-add-button"
                onclick={(e) => { e.stopPropagation(); addBlockBelow(block.id); }}
                aria-label="Add block below"
                title="Add block"
              >
                <Plus size={14} />
              </button>
            </div>

            <BlockRenderer
              {block}
              rootId="root"
              blockIndex={i}
              onUpdate={handleUpdate}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onToggle={handleToggle}
              onStyleConvert={handleStyleConvert}
            />
          </div>
        {/if}
      {/each}

      <!-- ── Empty state ── -->
      {#if blocks.length === 0}
        <div class="editor-empty">
          <p>Press <kbd>Enter</kbd> to start writing, or use <kbd>/</kbd> for commands</p>
        </div>
      {/if}
    </div>

    <!-- ── Slash Menu ──────────────────────────────────────────────── -->
    {#if showSlashMenu}
      <div class="slash-menu" style="top: {slashMenuStyle.top}; left: {slashMenuStyle.left};" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} tabindex="0" role="listbox" aria-label="Block type menu">
        <div class="slash-menu-header">Basic Blocks</div>
        <div class="slash-menu-items">
          {#each filteredCommands as cmd, i}
            {@const Icon = cmd.icon}
            <button
              class="slash-menu-item"
              class:active={i === slashMenuIndex}
              type="button"
              onclick={() => handleSlashSelect(cmd)}
            >
              <span class="slash-menu-item-icon"><Icon size={16} /></span>
              <span class="slash-menu-item-label">{cmd.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Format Toolbar ──────────────────────────────────────────── -->
    {#if showFormatToolbar}
      <div
        class="format-toolbar"
        style="top: {formatToolbarStyle.top}; left: {formatToolbarStyle.left};"
        class:show={showFormatToolbar}
        onclick={(e) => e.stopPropagation()}
        onmousedown={(e) => e.preventDefault()}
        role="toolbar"
        aria-label="Text formatting"
        tabindex="0"
      >
        <button class="format-toolbar-btn" type="button" aria-label="Bold" onclick={() => handleFormatAction(MarkType.Bold)}><Bold size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Italic" onclick={() => handleFormatAction(MarkType.Italic)}><Italic size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Underline" onclick={() => handleFormatAction(MarkType.Underline)}><Underline size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Strikethrough" onclick={() => handleFormatAction(MarkType.Strike)}><Strikethrough size={14} /></button>
        <div class="format-toolbar-sep"></div>
        <button class="format-toolbar-btn" type="button" aria-label="Code" onclick={() => handleFormatAction(MarkType.Code)}><Code2 size={14} /></button>
        <button class="format-toolbar-btn" type="button" aria-label="Link" onclick={() => handleFormatAction(MarkType.Link)}><Link2 size={14} /></button>
      </div>
    {/if}

    <!-- ── Block Actions ───────────────────────────────────────────── -->
    {#if showBlockActions}
      <div
        class="block-actions"
        style="top: {actionMenuStyle.top}; left: {actionMenuStyle.left};"
        onclick={(e) => e.stopPropagation()}
        onmousedown={(e) => e.preventDefault()}
        role="menu"
        aria-label="Block actions"
        tabindex="0"
      >
        <button class="block-actions-btn" type="button" onclick={() => handleDuplicateBlock(showBlockActions!)}>
          <Copy size={14} />
          <span>Duplicate</span>
        </button>
        <button class="block-actions-btn danger" type="button" onclick={() => handleDeleteBlock(showBlockActions!)}>
          <Trash2 size={14} />
          <span>Delete</span>
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ── Instrument Serif — editor body text only ───────────────────────
     Title (.editor-header) stays Bricolage Grotesque (h1/h2/h3 global rule).
     Sidebar UI stays General Sans (the global default).
     Only the body blocks the user actually types in get Instrument Serif.
  ─────────────────────────────────────────────────────────────────────── */
  .notes-editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    max-width: 740px;
    margin: 0 auto;
    padding: 40px 24px 120px 80px;
    min-height: 100%;
  }

  .editor-header {
    margin-bottom: 8px;
  }

  .editor-description {
    margin-bottom: 16px;
    opacity: 0.7;
  }

  .editor-blocks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .block-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    width: 100%;
    border-radius: 6px;
    transition: background 0.1s;
  }

  /* Drag states */
  .block-wrapper.is-dragging {
    opacity: 0.4;
  }

  .block-wrapper.drag-over-top {
    box-shadow: 0 -2px 0 var(--primary);
  }

  .block-wrapper.drag-over-bottom {
    box-shadow: 0 2px 0 var(--primary);
  }

  /* ── Block controls (grip + add) ────────────────────────────────── */
  .block-controls {
    position: absolute;
    left: -56px;
    top: 4px;
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.12s;
    pointer-events: none;
  }

  .block-wrapper:hover .block-controls {
    opacity: 1;
    pointer-events: all;
  }

  .block-grip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: grab;
    transition: background 0.12s, color 0.12s;
  }

  .block-grip:active {
    cursor: grabbing;
  }

  .block-grip:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }

  .block-add-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  .block-add-button:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }

  .editor-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    color: var(--muted);
    font-size: 0.95rem;
    text-align: center;
  }

  .editor-empty kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    font-family: inherit;
    font-size: 0.85rem;
    color: var(--foreground);
  }

  .editor-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    gap: 16px;
    color: var(--muted);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Body text blocks — Instrument Serif ────────────────────────────
     Targets the contenteditable divs inside .editor-blocks.
     Does NOT touch .editor-header (title) or any UI chrome.
  ─────────────────────────────────────────────────────────────────────── */
  .editor-blocks :global([contenteditable]) {
    font-family: 'Instrument Serif', serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.75;
  }

  /* Code blocks inside the editor keep JetBrains Mono */
  .editor-blocks :global(code),
  .editor-blocks :global(pre) {
    font-family: var(--font-mono, 'JetBrains Mono Variable', ui-monospace, monospace);
    font-size: 13px;
    font-weight: 400;
  }

  /* ── Slash Menu ────────────────────────────────────────────────── */
  .slash-menu {
    position: absolute;
    z-index: 100;
    width: 260px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .slash-menu-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }

  .slash-menu-items {
    display: flex;
    flex-direction: column;
    padding: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  .slash-menu-item {
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

  .slash-menu-item:hover,
  .slash-menu-item.active {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .slash-menu-item-icon {
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

  .slash-menu-item-label {
    flex: 1;
  }

  /* ── Format Toolbar ────────────────────────────────────────────── */
  .format-toolbar {
    position: absolute;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transform: translateX(-50%);
  }

  .format-toolbar-btn {
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

  .format-toolbar-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }

  .format-toolbar-sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 2px;
  }

  /* ── Block Actions ─────────────────────────────────────────────── */
  .block-actions {
    position: absolute;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    min-width: 120px;
  }

  .block-actions-btn {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: default;
    font-size: 13px;
    color: var(--foreground);
    transition: background 120ms ease;
  }

  .block-actions-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .block-actions-btn.danger {
    color: var(--destructive, #ef4444);
  }

  .block-actions-btn.danger:hover {
    background: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
  }
</style>
