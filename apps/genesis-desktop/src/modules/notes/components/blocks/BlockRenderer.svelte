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
  import { editorStore, getToggleStateVersion } from '$lib/local-store/store';
  import type { Block, ContentText } from '$lib/local-store/block';
  import { TextStyle as TS, isTextToggle } from '$lib/local-store/block';

  let toggleStateVersion = $derived(getToggleStateVersion());

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

  let liveBlock = $derived.by(() => block);
  let togglePulse = $derived(toggleStateVersion);

  // ── Toggle open/closed state ────────────────────────────────────────
  let isToggleBlock = $derived.by(() => {
    const live = liveBlock;
    if (!live.content || !('style' in live.content)) return false;
    return isTextToggle((live.content as ContentText).style);
  });

  let toggleOpen = $derived.by(() => {
    void togglePulse;
    const live = liveBlock;
    if (!isToggleBlock || !live.id) return false;
    return editorStore.isToggleOpen(live.id);
  });

  let childBlocks = $derived.by(() => {
    void togglePulse;
    const live = liveBlock;
    if (!isToggleBlock || !live.id) return [];
    return (live.childrenIds ?? [])
      .map((id) => editorStore.getBlock(id))
      .filter((b): b is Block => !!b);
  });

  function handleToggle(blockId?: string) {
    const id = blockId ?? liveBlock.id;
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
      const live = liveBlock;
      if (!b?.id || !live.id) return;
      const before = value.slice(0, range.from);
      const after = value.slice(range.from);
      await editorStore.persistBlockText(b.id, before);
      editorStore.syncBlockTextToStore(b.id);
      const newId = await editorStore.addChildBlock(live.id, after);
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
  data-block-id={liveBlock.id}
  data-block-type={liveBlock.type}
  data-depth={depth}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
>
  {#if !readonly}
    <BlockActionMenu block={liveBlock} {rootId} />
  {/if}
  {#if liveBlock.type === 'text'}
    <BlockText
      block={liveBlock}
      {rootId}
      {readonly}
      {blockIndex}
      {onUpdate}
      {onFocus}
      {onBlur}
      {onKeyDown}
      {onKeyUp}
      onToggle={() => handleToggle(liveBlock.id)}
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

  {:else if liveBlock.type === 'div'}
    <BlockDiv block={liveBlock} {rootId} {readonly} {onKeyDown} {onKeyUp} />

  {:else if liveBlock.type === 'file'}
    <BlockFile block={liveBlock} />

  {:else if liveBlock.type === 'bookmark'}
    <BlockBookmark block={liveBlock} />

  {:else if liveBlock.type === 'layout'}
    <BlockHeader block={liveBlock} />

  {:else if liveBlock.type === 'latex'}
    <BlockEmbed block={liveBlock} {readonly} />

  {:else if liveBlock.type === 'table'}
    <BlockTable block={liveBlock} {rootId} {readonly} />

  {:else if liveBlock.type === 'tableOfContents'}
    <BlockTableOfContents block={liveBlock} />

  {:else if liveBlock.type === 'link'}
    <BlockLink block={liveBlock} {readonly} />

  {:else if liveBlock.type === 'relation'}
    <BlockRelation block={liveBlock} {readonly} objectId={rootId} />

  {:else if liveBlock.type === 'page' || liveBlock.type === 'dataview'}
    <!-- Dataview/page blocks render as a styled placeholder — not interactive in notes -->
    <div class="block-placeholder">
      <span class="block-type-badge">{liveBlock.type}</span>
    </div>

  {:else if liveBlock.type !== 'iconPage' && liveBlock.type !== 'iconUser' && liveBlock.type !== 'cover' && liveBlock.type !== 'featured'}
    <!-- Unknown block types get a subtle placeholder; system blocks (icon, cover) are silently skipped -->
    <div class="block-placeholder">
      <span class="block-type-badge">{liveBlock.type}</span>
      <span class="block-placeholder-text">{liveBlock.type} block</span>
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
