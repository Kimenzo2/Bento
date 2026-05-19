<script lang="ts">
  import BlockText from './BlockText.svelte';
  import BlockDiv from './BlockDiv.svelte';
  import BlockFile from './BlockFile.svelte';
  import BlockBookmark from './BlockBookmark.svelte';
  import BlockHeader from './BlockHeader.svelte';
  import type { Block, BlockType } from '$lib/local-store/block';

  export let block: Block;
  export let rootId: string;
  export let readonly: boolean = false;
  export let blockIndex: number = 0;
  // ── Events forwarded upward ─────────────────────────────────────────
  export let onUpdate: (blockId: string, text: string, marks: any[]) => void = () => {};
  export let onFocus: (e?: any) => void = () => {};
  export let onBlur: (e?: any) => void = () => {};
  export let onKeyDown: (e: any, value: string, marks: any[], range: any, props: any) => void = () => {};
  export let onKeyUp: (e: any, value: string, marks: any[], range: any, props: any) => void = () => {};
  export let onToggle: (e?: any) => void = () => {};
  export let onStyleConvert: (blockId: string, style: any) => void = () => {};

  function handleToggle(e?: any) {
    onToggle(e);
  }

  function handleStyleConvert(blockId: string, style: any) {
    onStyleConvert(blockId, style);
  }
</script>

<div
  class="block-renderer"
  class:is-drag-over={false}
  data-block-id={block.id}
  data-block-type={block.type}
>
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
      onToggle={handleToggle}
      onStyleConvert={handleStyleConvert}
    />

  {:else if block.type === 'div'}
    <BlockDiv {block} {rootId} {readonly} {onKeyDown} {onKeyUp} />

  {:else if block.type === 'file'}
    <BlockFile {block} />

  {:else if block.type === 'bookmark'}
    <BlockBookmark {block} />

  {:else if block.type === 'layout'}
    <BlockHeader {block} />

  {:else if block.type === 'page' || block.type === 'dataview'}
    <div class="block-placeholder">
      <span class="block-type-badge">{block.type}</span>
      <span class="block-placeholder-text">Block type not yet rendered</span>
    </div>

  {:else}
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
  }

  .block-renderer.is-drag-over {
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    border-radius: 6px;
  }

  .block-placeholder {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--muted-surface);
    color: var(--muted);
    font-size: 0.9rem;
  }

  .block-type-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--foreground);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
