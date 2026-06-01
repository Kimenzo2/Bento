<script lang="ts">
  // ════════════════════════════════════════════════════════════════════
  // BlockTableOfContents.svelte
  // Port of anytype-ts/block/tableOfContents.tsx
  // Reads all header blocks from the editor and renders clickable links
  // ════════════════════════════════════════════════════════════════════
  import { getRootBlocks } from '$lib/local-store/store';

  let rootBlocks = $derived(getRootBlocks());
  import { TextStyle } from '$lib/local-store/block';
  import type { Block } from '$lib/local-store/block';

  let { block }: { block: Block } = $props();

  const HEADER_STYLES = new Set([
    TextStyle.Header1, TextStyle.Header2, TextStyle.Header3, TextStyle.Header4,
    TextStyle.Title,
  ]);

  const DEPTH_MAP: Record<number, number> = {
    [TextStyle.Title]: 0,
    [TextStyle.Header1]: 1,
    [TextStyle.Header2]: 2,
    [TextStyle.Header3]: 3,
    [TextStyle.Header4]: 4,
  };

  // $rootBlocks is reactive — auto-updates when the store changes
  let items = $derived(
    rootBlocks
      .filter((b) => {
        if (b.type !== 'text' || !b.content) return false;
        const c = b.content as any;
        return HEADER_STYLES.has(c.style);
      })
      .map((b) => {
        const c = b.content as any;
        return {
          id: b.id,
          text: c.text ?? '',
          style: c.style as TextStyle,
          depth: DEPTH_MAP[c.style as TextStyle] ?? 1,
        };
      })
  );

  function scrollToBlock(id: string | undefined) {
    if (!id) return;
    const el = document.querySelector(`[data-block-id="${id}"] .editable`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<div class="block-toc">
  {#if items.length === 0}
    <p class="toc-empty">Add headings to create a table of contents</p>
  {:else}
    <nav class="toc-nav" aria-label="Table of contents">
      {#each items as item (item.id)}
        <button
          class="toc-item depth-{item.depth}"
          style="padding-left: {(item.depth - 1) * 20}px"
          onclick={() => scrollToBlock(item.id)}
        >
          {item.text || '(Untitled heading)'}
        </button>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .block-toc {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }

  .toc-empty {
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .toc-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toc-item {
    all: unset;
    display: block;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.9rem;
    color: var(--foreground);
    cursor: pointer;
    transition: background 0.12s;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toc-item:hover {
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    color: var(--primary);
  }

  .toc-item.depth-0 { font-weight: 700; font-size: 1rem; }
  .toc-item.depth-1 { font-weight: 600; }
  .toc-item.depth-2 { font-weight: 500; opacity: 0.85; }
  .toc-item.depth-3 { font-weight: 400; opacity: 0.7; font-size: 0.85rem; }
  .toc-item.depth-4 { font-weight: 400; opacity: 0.6; font-size: 0.82rem; }
</style>
