<script lang="ts">
  import { tick } from 'svelte';
  import BlockText from './BlockText.svelte';
  import BlockDiv from './BlockDiv.svelte';
  import BlockFile from './BlockFile.svelte';
  import BlockBookmark from './BlockBookmark.svelte';
  import BlockHeader from './BlockHeader.svelte';
  import BlockEmbed from './BlockEmbed.svelte';
  import BlockTable from './BlockTable.svelte';
  import BlockTableOfContents from './BlockTableOfContents.svelte';
  import BlockLink from './BlockLink.svelte';
  import BlockRelation from './BlockRelation.svelte';
  import BlockRendererSelf from './BlockRenderer.svelte';
  import BlockActionMenu from './BlockActionMenu.svelte';
  import { editorStore } from '$lib/local-store/store';
  import { TextStyle as TS, isTextToggle } from '$lib/local-store/block';
  import type { Block, ContentText } from '$lib/local-store/block';

  // ── Props (Svelte 5 runes) ──────────────────────────────────────────
  let {
    block,
    rootId,
    readonly = false,
    blockIndex = 0,
    depth = 0,
    onUpdate = () => {},
    onFocus = () => {},
    onBlur = () => {},
    onKeyDown = () => {},
    onKeyUp = () => {},
    onToggle = () => {},
    onStyleConvert = () => {},
    onDuplicate = () => {},
    onDelete = () => {},
    onColorChange = () => {},
    onBgChange = () => {},
    onAlignChange = () => {},
    onClearStyle = () => {},
  }: {
    block: Block;
    rootId: string;
    readonly?: boolean;
    blockIndex?: number;
    depth?: number;
    onUpdate?: (blockId: string, text: string, marks: any[]) => void;
    onFocus?: (e?: any) => void;
    onBlur?: (e?: any) => void;
    onKeyDown?: (e: any, value: string, marks: any[], range: any, props: any) => void;
    onKeyUp?: (e: any, value: string, marks: any[], range: any, props: any) => void;
    onToggle?: (blockId: string) => void;
    onStyleConvert?: (blockId: string, style: any) => void;
    onDuplicate?: (blockId: string) => void;
    onDelete?: (blockId: string) => void;
    onColorChange?: (blockId: string, color: string) => void;
    onBgChange?: (blockId: string, color: string) => void;
    onAlignChange?: (blockId: string, align: string) => void;
    onClearStyle?: (blockId: string) => void;
  } = $props();

  // ── Toggle open/closed state ────────────────────────────────────────
  // Subscribe to editorStore to get reactive toggle open state
  let storeState = $derived($editorStore);

  let isToggleBlock = $derived.by(() => {
    if (!block.content || !('style' in block.content)) return false;
    return isTextToggle((block.content as ContentText).style);
  });

  let toggleOpen = $derived.by(() => {
    if (!isToggleBlock || !block.id) return false;
    return editorStore.isToggleOpen(block.id);
  });

  let childBlocks = $derived.by(() => {
    if (!isToggleBlock || !block.id || !storeState) return [];
    return editorStore.getBlockChildren(block.id);
  });

  function handleToggle(blockId?: string) {
    const id = blockId ?? block.id;
    if (!id) return;
    editorStore.setToggleOpen(id, !editorStore.isToggleOpen(id));
    onToggle(id);
  }

  async function handleChildKeyDown(
    e: any, value: string, marks: any[], range: any, props: any
  ) {
    // Enter at end of child → add sibling child
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const b = props.block as Block;
      if (!b?.id || !block.id) return;
      const before = value.slice(0, range.from);
      const after = value.slice(range.from);
      await editorStore.persistBlockText(b.id, before);
      editorStore.syncBlockTextToStore(b.id);
      const newId = await editorStore.addChildBlock(block.id, after);
      if (newId) {
        editorStore.focusBlock(newId);
        await tick();
        const el = document.querySelector<HTMLElement>(`[data-block-id="${newId}"] .editable`);
        el?.focus();
      }
      return;
    }
    // Delegate everything else upward
    onKeyDown(e, value, marks, range, props);
  }
  let isHovered = $state(false);
</script>

<div
  class="block-renderer"
  class:is-toggle={isToggleBlock}
  class:toggle-open={isToggleBlock && toggleOpen}
  class:is-hovered={isHovered}
  data-block-id={block.id}
  data-block-type={block.type}
  data-depth={depth}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  {#if !readonly}
    <BlockActionMenu {block} {rootId} />
  {/if}
  {#if block.type === 'text'}
    <BlockText
      {block}
      {rootId}
      {readonly}
      {blockIndex}
      {onUpdate}
      {onFocus}
      {onBlur}
      {onKeyDown}
      {onKeyUp}
      onToggle={() => handleToggle(block.id)}
      {onStyleConvert}
    />

    <!-- ── Toggle children ─────────────────────────────────────────── -->
    {#if isToggleBlock && toggleOpen && childBlocks.length > 0}
      <div class="toggle-children" style="padding-left: {20 + depth * 8}px">
        {#each childBlocks as child, i (child.id)}
          <BlockRendererSelf
            block={child}
            {rootId}
            {readonly}
            blockIndex={i}
            depth={depth + 1}
            {onUpdate}
            {onFocus}
            {onBlur}
            onKeyDown={handleChildKeyDown}
            {onKeyUp}
            {onToggle}
            {onStyleConvert}
          />
        {/each}
      </div>
    {/if}

  {:else if block.type === 'div'}
    <BlockDiv {block} {rootId} {readonly} {onKeyDown} {onKeyUp} />

  {:else if block.type === 'file'}
    <BlockFile {block} />

  {:else if block.type === 'bookmark'}
    <BlockBookmark {block} />

  {:else if block.type === 'layout'}
    <BlockHeader {block} />

  {:else if block.type === 'latex'}
    <BlockEmbed {block} {readonly} />

  {:else if block.type === 'table'}
    <BlockTable {block} {rootId} {readonly} />

  {:else if block.type === 'tableOfContents'}
    <BlockTableOfContents {block} />

  {:else if block.type === 'link'}
    <BlockLink {block} {readonly} />

  {:else if block.type === 'relation'}
    <BlockRelation {block} {readonly} objectId={rootId} />

  {:else if block.type === 'page' || block.type === 'dataview'}
    <!-- Dataview/page blocks render as a styled placeholder — not interactive in notes -->
    <div class="block-placeholder">
      <span class="block-type-badge">{block.type}</span>
    </div>

  {:else if block.type !== 'iconPage' && block.type !== 'iconUser' && block.type !== 'cover' && block.type !== 'featured'}
    <!-- Unknown block types get a subtle placeholder; system blocks (icon, cover) are silently skipped -->
    <div class="block-placeholder">
      <span class="block-type-badge">{block.type}</span>
      <span class="block-placeholder-text">{block.type} block</span>
    </div>
  {/if}
</div>

<style>
  .block-renderer {
    position: relative;
    width: 100%;
    min-height: 28px;
    /* Give room on the left for the drag handle */
    padding-left: 0;
  }

  /* Show drag handle on hover — handle's opacity is managed inside BlockActionMenu */
  .block-renderer.is-hovered :global(.drag-handle) {
    opacity: 1;
  }

  /* ── Toggle children ─────────────────────────────────────────────── */
  .toggle-children {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 2px;
    border-left: 2px solid color-mix(in srgb, var(--border) 60%, transparent);
    padding-left: 20px;
  }

  /* ── Placeholders ────────────────────────────────────────────────── */
  .block-placeholder {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
    color: var(--muted);
    font-size: 0.85rem;
  }

  .block-type-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .block-placeholder-text {
    color: var(--muted);
    opacity: 0.6;
  }
</style>
