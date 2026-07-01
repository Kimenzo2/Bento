<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { islandStore } from "$lib/stores/island.store.svelte";
  import type { IslandItem } from "$lib/data/island-catalog";
  import { getIcon } from "./island-icons";

  let { handleLaunch = (item: IslandItem) => {}, handleQuickAction = (action: string) => {} }: {
    handleLaunch?: (item: IslandItem) => void;
    handleQuickAction?: (action: string) => void;
  } = $props();

  let appGridEl = $state<HTMLElement | null>(null);

  function onLaunch(item: IslandItem) {
    islandStore.pushRecent(item.id);
    handleLaunch(item);
    islandStore.collapse();
  }

  function onQuickAction(action: string) {
    handleQuickAction(action);
    islandStore.collapse();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      islandStore.collapse();
    }
  }

  function onClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (islandStore.mode === "expanded" && !target.closest(".island")) {
      islandStore.collapse();
    }
  }

  function handleGridKeydown(e: KeyboardEvent) {
    const buttons = appGridEl?.querySelectorAll<HTMLButtonElement>(".app-card");
    if (!buttons?.length) return;
    const currentIndex = Array.from(buttons).findIndex((b) => b === document.activeElement);
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
    else if (e.key === "ArrowLeft") nextIndex = Math.max(currentIndex - 1, 0);
    else if (e.key === "ArrowDown") nextIndex = Math.min(currentIndex + 4, buttons.length - 1);
    else if (e.key === "ArrowUp") nextIndex = Math.max(currentIndex - 4, 0);
    else return;
    e.preventDefault();
    buttons[nextIndex]?.focus();
  }

  onMount(() => {
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  });
</script>

<div
  class="island-overlay"
  class:island-overlay--expanded={islandStore.mode === "expanded"}
>
  <div
    class="island"
    class:island--compact={islandStore.mode === "compact"}
    class:island--expanded={islandStore.mode === "expanded"}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); islandStore.toggle(); }}}
  >
    {#if islandStore.mode === "compact"}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="compact-body" in:fade={{ duration: 350, easing: cubicOut }} out:fade={{ duration: 120 }} onclick={() => islandStore.expand()} role="button" tabindex="0" aria-label="Expand Bento launcher" onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); islandStore.expand(); }}}>
        <div class="compact-brand">
          <svelte:component this={getIcon("layout-grid")} size={14} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
        </div>
        <div class="compact-content">
          <span class="compact-text">Bento</span>
        </div>
        <div class="compact-chevron">
          <svelte:component this={getIcon("chevron-down")} size={10} color="rgba(255,255,255,0.3)" strokeWidth={2.2} />
        </div>
      </div>
    {/if}
    {#if islandStore.mode === "expanded"}
      <div class="expanded-body" in:fade={{ duration: 300, easing: cubicOut, delay: 80 }} out:fade={{ duration: 120 }}>
        <div class="expanded-header">
          <div class="header-tabs">
            <div class="tab-track">
              <div
                class="tab-indicator"
                style="transform: translateX({islandStore.page === "apps" ? 0 : 100}%)"
              ></div>
              <button
                class="tab-btn"
                class:tab-btn--active={islandStore.page === "apps"}
                onclick={() => islandStore.setPage("apps")}
              >
                <svelte:component this={getIcon("layout-grid")} size={14} strokeWidth={2} />
              </button>
              <button
                class="tab-btn"
                class:tab-btn--active={islandStore.page === "actions"}
                onclick={() => islandStore.setPage("actions")}
              >
                <svelte:component this={getIcon("clock")} size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div class="header-spacer"></div>
          <button
            class="close-btn"
            onclick={() => islandStore.collapse()}
            aria-label="Close island"
          >
            <svelte:component this={getIcon("x")} size={14} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          </button>
        </div>

        {#if islandStore.page === "apps"}
          <div class="search-bar">
            <svelte:component this={getIcon("search")} size={12} color="rgba(255,255,255,0.35)" strokeWidth={2} />
            <input
              class="search-input"
              type="text"
              placeholder="Search apps…"
              bind:value={islandStore.searchQuery}
            />
          </div>

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="app-grid" bind:this={appGridEl} onkeydown={handleGridKeydown} role="listbox" tabindex="-1">
            {#each islandStore.filteredItems as item (item.id)}
              <button
                class="app-card"
                class:app-card--selected={islandStore.selectedItemId === item.id}
                onclick={() => { islandStore.selectItem(item.id); onLaunch(item); }}
                role="option"
                aria-selected={islandStore.selectedItemId === item.id}
              >
                <div class="app-icon" style="background: {item.accentColor}12; color: {item.accentColor}">
                  <svelte:component this={getIcon(item.icon)} size={18} strokeWidth={1.8} />
                </div>
                <div class="app-name">{item.name}</div>
              </button>
            {/each}
          </div>

          {#if islandStore.selectedItem}
            {@const item = islandStore.selectedItem}
            {#if item.quickActions.length}
              <div class="quick-actions">
                <div class="qa-label">Quick Actions</div>
                <div class="qa-grid">
                  {#each item.quickActions as action}
                    <button class="qa-btn" onclick={() => onQuickAction(action.action)}>
                      <svelte:component this={getIcon(action.icon)} size={12} strokeWidth={2} />
                      {action.label}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        {:else}
          <div class="recent-list">
            {#each islandStore.recentItems as item (item.id)}
              <button class="recent-item" onclick={() => onLaunch(item)}>
                <div class="app-icon app-icon--sm" style="background: {item.accentColor}12; color: {item.accentColor}">
                  <svelte:component this={getIcon(item.icon)} size={14} strokeWidth={2} />
                </div>
                <div class="recent-info">
                  <div class="recent-name">{item.name}</div>
                  <div class="recent-tagline">{item.tagline}</div>
                </div>
                <svelte:component this={getIcon("chevron-down")} size={12} color="rgba(255,255,255,0.25)" strokeWidth={2.2} class="recent-arrow" />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: transparent !important;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :focus-visible {
    outline: 1px solid rgba(255, 255, 255, 0.35);
    outline-offset: 2px;
  }

  .island-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    pointer-events: none;
  }

  .island-overlay > * {
    pointer-events: auto;
  }

  .island-overlay--expanded {
    z-index: 10000;
  }

  .island {
    position: relative;
    background: #070707;
    border-radius: 0 0 20px 20px;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    transition:
      width 0.55s cubic-bezier(0.34, 1.3, 0.64, 1),
      height 0.55s cubic-bezier(0.34, 1.3, 0.64, 1);
  }

  @supports (animation-timing-function: linear(0, 1)) {
    .island {
      transition:
        width 0.55s linear(0, 0.09 10%, 0.26 20%, 0.5 33%, 0.74 46%, 0.9 58%, 1.02 76%, 1 88%, 1),
        height 0.55s linear(0, 0.09 10%, 0.26 20%, 0.5 33%, 0.74 46%, 0.9 58%, 1.02 76%, 1 88%, 1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .island {
      transition: none;
    }
    .compact-body,
    .expanded-body {
      animation: none;
    }
  }

  .island::before {
    content: '';
    position: absolute;
    top: 0;
    left: -6px;
    width: 6px;
    height: 6px;
    z-index: 10;
    pointer-events: none;
    background: radial-gradient(circle at 0 100%, transparent 6px, #070707 6px);
  }

  .island::after {
    content: '';
    position: absolute;
    top: 0;
    right: -6px;
    width: 6px;
    height: 6px;
    z-index: 10;
    pointer-events: none;
    background: radial-gradient(circle at 100% 100%, transparent 6px, #070707 6px);
  }

  .island--compact {
    width: 260px;
    height: 40px;
    cursor: pointer;
  }

  .island--compact:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .island--compact:active {
    background: #0a0a0a;
  }

  .island--expanded {
    width: 320px;
    height: 480px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .compact-body {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    height: 100%;
    width: 100%;
  }

  .compact-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .compact-content {
    flex: 1;
    min-width: 0;
  }

  .compact-text {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.55);
  }

  .compact-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .expanded-body {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .expanded-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 8px;
  }

  .header-tabs {
    display: flex;
    align-items: center;
  }

  .tab-track {
    position: relative;
    display: flex;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    padding: 2px;
    height: 28px;
    width: 60px;
  }

  .tab-indicator {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(50% - 2px);
    height: calc(100% - 4px);
    background: rgba(255, 255, 255, 0.12);
    border-radius: 16px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    cursor: pointer;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    padding: 0;
  }

  .tab-btn--active {
    color: rgba(255, 255, 255, 0.9);
  }

  .header-spacer {
    width: 48px;
    height: 100%;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: transparent;
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    color: rgba(255, 255, 255, 0.4);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.75);
  }

  .close-btn:active {
    background: rgba(255, 255, 255, 0.12);
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 12px 8px;
    padding: 7px 10px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
  }

  .search-bar:focus-within {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.85);
    font-family: inherit;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 0 10px 12px;
    overflow-y: auto;
    max-height: 320px;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 4px 8px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .app-card:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .app-card:active {
    background: rgba(255, 255, 255, 0.08);
  }

  .app-card--selected {
    background: rgba(255, 255, 255, 0.06);
  }

  .app-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-icon--sm {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }

  .app-name {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: -0.01em;
    text-align: center;
    line-height: 1.2;
    color: rgba(255, 255, 255, 0.5);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-actions {
    border-top: 0.5px solid rgba(255, 255, 255, 0.06);
    padding: 10px 12px 10px;
  }

  .qa-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.2);
    margin-bottom: 8px;
  }

  .qa-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .qa-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.04);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-family: inherit;
  }

  .qa-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
  }

  .qa-btn:active {
    background: rgba(255, 255, 255, 0.12);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 8px 10px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
  }

  .recent-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .recent-item:active {
    background: rgba(255, 255, 255, 0.08);
  }

  .recent-info {
    flex: 1;
    min-width: 0;
  }

  .recent-name {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
  }

  .recent-tagline {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.recent-arrow) {
    flex-shrink: 0;
    transform: rotate(-90deg);
  }
</style>
