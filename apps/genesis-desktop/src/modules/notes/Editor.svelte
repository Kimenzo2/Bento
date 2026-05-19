<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { Plus, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, CheckSquare, Minus } from 'lucide-svelte';
  import { BlockRenderer } from './components/blocks/index.js';
  import { editorStore, rootBlocks, titleBlock, focusedBlock, isEditorLoading } from '$lib/local-store/store.js';
  import { TextStyle } from '$lib/local-store/block.js';
  import type { Block, ContentText, Mark, TextRange } from '$lib/local-store/block.js';
  import { isTextBlock, isTextTitle, isTextDescription, isTextHeader } from '$lib/local-store/block.js';

  // ── Persistent object ID ──────────────────────────────────────────
  // Each Notes document gets a stable UUID stored in localStorage so
  // edits survive reloads. In a full multi-document app this would
  // come from a document list / URL param.

  const STORAGE_KEY = 'bento-notes-object-id';

  function getOrCreateObjectId(): string {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, newId);
    return newId;
  }

  const objectId = getOrCreateObjectId();

  // ── Init store on mount ───────────────────────────────────────────
  $: blocks = $rootBlocks;
  $: title = $titleBlock;
  $: focused = $focusedBlock;
  $: loading = $isEditorLoading;

  onMount(async () => {
    await editorStore.init(objectId);
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
    }

    // Backspace on empty block — merge with previous
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
  }

  function handleKeyUp(e: any, value: string, marks: any[], range: TextRange, props: any) {
    // Delegate markdown trigger handling to BlockText via events
  }

  function handlePaste(e: any, props: any, pasteData: any) {
    // Handle paste events
  }

  function handleMenuAdd(id: string, value: string, range: TextRange, marks: any[]) {
    // Open slash command menu
  }

  function handleToggle(e?: any) {
    // Toggle block
  }

  async function addBlockBelow(blockId?: string) {
    if (blockId) {
      await editorStore.addBlock(blockId);
    } else {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock?.id) {
        await editorStore.addBlock(lastBlock.id);
      }
    }
  }

  async function addNewBlock() {
    if (blocks.length === 0) {
      await editorStore.init(objectId);
    } else {
      const last = blocks[blocks.length - 1];
      await addBlockBelow(last?.id);
    }
  }
</script>

<div class="notes-editor">
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onToggle={handleToggle}
        />
      {/if}
    </div>

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
        {#if block.content && 'style' in block.content}
          {#if !isTextTitle((block.content as ContentText).style) && !isTextDescription((block.content as ContentText).style)}
            <div class="block-wrapper">
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

              <!-- ── Add-block placeholder ── -->
              <button
                class="block-add-button"
                on:click|stopPropagation={() => addBlockBelow(block.id)}
                aria-label="Add block below"
              >
                <Plus size={14} />
              </button>
            </div>
          {/if}
        {:else}
          <div class="block-wrapper">
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

            <button
              class="block-add-button"
              on:click|stopPropagation={() => addBlockBelow(block.id)}
              aria-label="Add block below"
            >
              <Plus size={14} />
            </button>
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
  {/if}
</div>

<style>
  .notes-editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    max-width: 740px;
    margin: 0 auto;
    padding: 40px 24px 120px;
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
  }

  .block-add-button {
    position: absolute;
    left: -36px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s, color 0.15s;
  }

  .block-wrapper:hover .block-add-button {
    opacity: 0.5;
  }

  .block-add-button:hover {
    opacity: 1 !important;
    background: var(--muted-surface);
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
</style>
