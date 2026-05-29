<script lang="ts">
  // BlockHeader.svelte — Port of anytype-ts/block/index.tsx layout handling
  // Layout blocks (Row, Column, Div, Header, TableRows, TableColumns) are
  // structural scaffolding — they have no visual representation in the editor.
  // The Div layout style is handled by BlockDiv; all others render nothing.
  import type { Block } from '$lib/local-store/block';
  import { LayoutStyle } from '$lib/local-store/block';

  let { block }: { block: Block } = $props();

  let content = $derived(block.content as any);
  let style: LayoutStyle = $derived(content?.style ?? LayoutStyle.Row);
</script>

{#if style === LayoutStyle.Div}
  <!-- Div-style layout renders a horizontal rule -->
  <div class="layout-divider" role="separator" aria-orientation="horizontal"></div>
{/if}
<!-- All other layout styles (Row, Column, Header, TableRows, TableColumns) are invisible -->

<style>
  .layout-divider {
    width: 100%;
    height: 1px;
    background: var(--border);
    margin: 8px 0;
  }
</style>
