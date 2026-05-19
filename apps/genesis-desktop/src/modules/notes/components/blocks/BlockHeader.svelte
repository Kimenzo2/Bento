<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { LayoutStyle } from '$lib/local-store/block';

  export let block: Block;
  // rootId and readonly accepted via $$restProps

  let content = block.content as any;
  let style: LayoutStyle = content?.style ?? LayoutStyle.Row;
</script>

<div class="block-header"  class:is-divider={style === LayoutStyle.Div}>
  {#if style === LayoutStyle.Header || style === LayoutStyle.TableRows || style === LayoutStyle.TableColumns}
    <div class="header-layout">
      <span class="header-badge">Layout: {style}</span>
    </div>
  {:else if style === LayoutStyle.Div}
    <div class="header-divider"></div>
  {:else}
    <div class="header-layout header-generic">
      <span class="header-badge">Layout</span>
    </div>
  {/if}
</div>

<style>
  .block-header {
    width: 100%;
  }

  .header-layout {
    display: flex;
    align-items: center;
    padding: 8px 0;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-divider {
    height: 2px;
    background: repeating-linear-gradient(
      90deg,
      var(--border) 0px,
      var(--border) 4px,
      transparent 4px,
      transparent 8px
    );
    border-radius: 1px;
  }

  .header-generic {
    justify-content: center;
    opacity: 0.5;
  }
</style>
