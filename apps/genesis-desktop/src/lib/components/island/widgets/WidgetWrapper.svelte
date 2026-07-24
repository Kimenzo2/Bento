<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    headerActions,
    children,
  }: {
    title?: string;
    headerActions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div
  class="widget-wrapper"
  onclick={(e: MouseEvent) => e.stopPropagation()}
  role="region"
  aria-label={title}
>
  {#if title || headerActions}
    <div class="ww-header">
      {#if title}<span class="ww-title">{title}</span>{/if}
      {#if headerActions}
        <div class="ww-actions">
          {@render headerActions()}
        </div>
      {/if}
    </div>
  {/if}
  <div class="ww-body">
    {@render children()}
  </div>
</div>

<style>
  .widget-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 260px;
    flex: 1;
    overflow: hidden;
    border-radius: 18px;
    border: 0.5px solid oklch(1 0 89.876 / 0.08);
    background: oklch(0.191 0.002 264.364 / 0.85);
    padding: 14px;
  }

  .ww-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .ww-title {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: oklch(1 0 89.876 / 0.5);
  }

  .ww-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ww-actions :global(button) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: oklch(1 0 89.876 / 0.35);
    padding: 0;
  }

  .ww-actions :global(button:hover) {
    background: oklch(1 0 89.876 / 0.06);
    color: oklch(1 0 89.876 / 0.7);
  }

  .ww-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
</style>
