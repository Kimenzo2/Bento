<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { DivStyle } from '$lib/local-store/block';

  let { block, rootId, readonly = false, onKeyDown = () => {}, onKeyUp = () => {} }: {
    block: Block;
    rootId: string;
    readonly?: boolean;
    onKeyDown?: (e: any, value: string, marks: any[], range: any, props: any) => void;
    onKeyUp?: (e: any, value: string, marks: any[], range: any, props: any) => void;
  } = $props();

  let content = $derived(block.content as any);
  let style: DivStyle = $derived(content?.style ?? DivStyle.Line);

  function handleKeyDown(e: KeyboardEvent) {
    onKeyDown(e, '', [], { from: 0, to: 0 }, { block, rootId, readonly });
  }

  function handleKeyUp(e: KeyboardEvent) {
    onKeyUp(e, '', [], { from: 0, to: 0 }, { block, rootId, readonly });
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
  class="block-div"
  class:is-line={style === DivStyle.Line}
  class:is-dot={style === DivStyle.Dot}
  tabindex="0"
  role="separator"
  aria-orientation="horizontal"
  onkeydown={handleKeyDown}
  onkeyup={handleKeyUp}
>
  {#if style === DivStyle.Line}
    <div class="div-line"></div>
  {:else if style === DivStyle.Dot}
    <div class="div-dots">
      {#each { length: 3 } as _, i}
        <div class="div-dot" style="animation-delay: {i * 0.12}s"></div>
      {/each}
    </div>
  {:else}
    <div class="div-line"></div>
  {/if}
</div>

<style>
  .block-div {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    cursor: default;
    outline: none;
    min-height: 32px;
    width: 100%;
  }

  .block-div:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .div-line {
    width: 100%;
    height: 1px;
    background: var(--border);
    border-radius: 1px;
  }

  .div-dots {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .div-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--muted);
    opacity: 0.6;
    animation: dot-breathe 2s ease-in-out infinite;
  }

  @keyframes dot-breathe {
    0%, 100% {
      opacity: 0.4;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.2);
    }
  }
</style>
