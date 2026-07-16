<script lang="ts">
  import { agentMorph } from "$lib/stores/agent-morph.svelte";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

  type MorphItem = {
    id: string;
    label: string;
    icon?: any;
  };

  type ContentPanel = {
    component?: any;
    height?: number;
  };

  let {
    items = [],
    contents = {},
    onitemclick,
  }: {
    items: MorphItem[];
    contents?: Record<string, ContentPanel>;
    onitemclick?: (id: string) => void;
  } = $props();

  const ITEM_HEIGHT = 40;
  const CONTENT_PAD_V = 10;
  const MENU_WIDTH = 220;

  let menuHeight = $derived(items.length * ITEM_HEIGHT + CONTENT_PAD_V * 2);

  let activeContent = $derived(
    agentMorph.renderedId ? contents[agentMorph.renderedId] : null,
  );

  function staggerDelay(index: number): string {
    return `${0.15 + index * 0.1}s`;
  }

  let prevMounted = $state(false);
  let morphKey = $state(0);

  $effect(() => {
    if (agentMorph.mounted && !prevMounted) {
      morphKey += 1;
    }
    prevMounted = agentMorph.mounted;
  });
</script>

{#if agentMorph.mounted}
  <div
    class="morph-backdrop"
    class:morph-backdrop--visible={agentMorph.state !== "closed"}
    onclick={agentMorph.close}
    role="presentation"
    aria-hidden="true"
  ></div>

  {#key morphKey}
    <div
      class="morph-surface"
      class:morph-surface--menu={agentMorph.state === "menu"}
      class:morph-surface--extended={agentMorph.state === "extended"}
      role="menu"
      aria-label="Attachment options"
      style={agentMorph.state === "extended"
        ? `bottom: ${agentMorph.inputBottom}px;`
        : `width: ${MENU_WIDTH}px; height: ${menuHeight}px; bottom: ${agentMorph.inputBottom}px;`}
    >
      <div
        class="morph-items"
        class:morph-items--hidden={agentMorph.state === "extended"}
      >
        {#each items as item, i (item.id)}
          <button
            class="morph-item"
            role="menuitem"
            style="--stagger-delay: {staggerDelay(i)};"
            onclick={() => onitemclick ? onitemclick(item.id) : agentMorph.open(item.id)}
          >
            <span class="morph-item__icon">
              {#if item.icon}
                <svelte:component this={item.icon} size={16} />
              {/if}
            </span>
            <span class="morph-item__label">{item.label}</span>
          </button>
        {/each}
      </div>

      <div
        class="morph-grid"
        class:morph-grid--visible={agentMorph.state === "extended"}
      >
        {#if activeContent}
          <div class="morph-grid__body">
            {#if activeContent.component}
              <svelte:component this={activeContent.component} />
            {:else if agentMorph.renderedId}
              <div class="morph-grid__placeholder">
                <p>{agentMorph.renderedId} panel</p>
              </div>
            {/if}
          </div>
        {/if}

        {#if agentMorph.renderedId}
          <div class="morph-controls">
            <button
              class="morph-back-btn"
              onclick={agentMorph.back}
              aria-label="Back"
            >
              <ChevronLeftIcon size={18} />
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/key}
{/if}

<style>
  .morph-backdrop {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .morph-backdrop--visible {
    pointer-events: auto;
  }

  .morph-surface {
    position: absolute;
    left: 12px;
    bottom: 116px;
    z-index: 6;
    overflow: hidden;
    background: color-mix(in srgb, var(--background) 96%, var(--foreground));
    border: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
    border-radius: 14px;
    transform: scale(0);
    opacity: 0;
    transform-origin: bottom left;
    transition:
      transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.25s ease;
    will-change: transform, opacity;
  }

  .morph-surface--menu {
    transform: scale(1);
    opacity: 1;
  }

  .morph-surface--extended {
    left: 0;
    right: 0;
    top: 56px;
    width: auto;
    height: auto;
    border: none;
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    transform: scale(1);
    opacity: 1;
    overflow: hidden;
  }

  .morph-items {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    padding: 6px;
    transition: opacity 0.15s ease;
  }

  .morph-items--hidden {
    opacity: 0;
    pointer-events: none;
  }

  .morph-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 40px;
    padding: 0 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 13px;
    font-weight: 400;
    cursor: pointer;
    text-align: left;
    opacity: 0;
    transform: translateY(8px);
    animation: morph-item-in 0.34s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: var(--stagger-delay, 0s);
  }

  @keyframes morph-item-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .morph-item:active {
    transform: scale(0.97);
  }

  .morph-item:hover {
    color: var(--accent);
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .morph-item__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    flex-shrink: 0;
  }

  .morph-item__label {
    flex: 1;
  }

  .morph-grid {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: scale(0.98);
    pointer-events: none;
    transition:
      opacity 0.25s ease,
      transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .morph-grid--visible {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }

  .morph-grid__body {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .morph-grid__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted);
    font-size: 14px;
  }

  .morph-controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 56px;
    display: flex;
    align-items: center;
    padding-left: 12px;
  }

  .morph-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--foreground);
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .morph-back-btn:hover {
    background: color-mix(in srgb, var(--foreground) 16%, transparent);
  }

  .morph-back-btn:active {
    transform: scale(0.96);
  }

  @media (prefers-reduced-motion: reduce) {
    .morph-surface {
      transition: none;
      transform: none;
      opacity: 0;
    }
    .morph-surface--menu,
    .morph-surface--extended {
      opacity: 1;
    }
    .morph-item {
      animation: none;
      opacity: 1;
      transform: none;
    }
    .morph-grid {
      transition: none;
    }
  }
</style>
