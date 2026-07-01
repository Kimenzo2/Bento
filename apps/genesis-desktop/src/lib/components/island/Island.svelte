<script lang="ts">
  import { onMount } from "svelte";
  import { islandStore } from "$lib/stores/island.store.svelte";
  import type { IslandItem } from "$lib/data/island-catalog";
  import { getIcon } from "./island-icons";

  let { handleLaunch = (item: IslandItem) => {}, handleQuickAction = (action: string) => {} }: {
    handleLaunch?: (item: IslandItem) => void;
    handleQuickAction?: (action: string) => void;
  } = $props();

  let isReady = $state(false);
  let reducedMotion = $state(false);
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
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => (isReady = true));
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
    class:island--ready={isReady}
    class:island--reduced={reducedMotion}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); islandStore.toggle(); }}}
  >
    {#if islandStore.mode === "compact"}
      <div class="compact-body" onclick={() => islandStore.expand()} role="button" tabindex="0" onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); islandStore.expand(); }}}>
        <div class="compact-brand">
          <svelte:component this={getIcon("layout-grid")} size={14} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
        </div>
        <div class="compact-content">
          <span class="compact-text">Bento</span>
        </div>
        <div class="compact-chevron">
          <svelte:component this={getIcon("chevron-down")} size={10} color="rgba(255,255,255,0.25)" strokeWidth={2.2} />
        </div>
      </div>
    {:else}
      <div class="expanded-body">
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
            <svelte:component this={getIcon("x")} size={14} color="rgba(255,255,255,0.4)" strokeWidth={2} />
          </button>
        </div>

        {#if islandStore.page === "apps"}
          <div class="search-bar">
            <svelte:component this={getIcon("search")} size={12} color="rgba(255,255,255,0.3)" strokeWidth={2} />
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
                <div class="app-icon" style="background: {item.accentColor}15; color: {item.accentColor}">
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
                <div class="app-icon app-icon--sm" style="background: {item.accentColor}15; color: {item.accentColor}">
                  <svelte:component this={getIcon(item.icon)} size={14} strokeWidth={2} />
                </div>
                <div class="recent-info">
                  <div class="recent-name">{item.name}</div>
                  <div class="recent-tagline">{item.tagline}</div>
                </div>
                <svelte:component this={getIcon("chevron-down")} size={12} color="rgba(255,255,255,0.2)" strokeWidth={2} class="recent-arrow" />
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
    outline: 1px solid rgba(255, 255, 255, 0.3);
    outline-offset: 1px;
  }

  .island-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .island-overlay--expanded {
    z-index: 10000;
  }

  .island {
    position: relative;
    background: black;
    border-radius: 0 0 20px 20px;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0.5px solid rgba(255, 255, 255, 0.10);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    color: white;
    opacity: 0;
    transform: translateY(-4px) scale(0.97) translateZ(0);
    will-change: transform, opacity;
    isolation: isolate;
  }

  .island--reduced {
    transition: none;
    opacity: 1;
    transform: none;
  }

  :not(.island--reduced) > .island {
    transition: opacity 0.2s ease-out, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
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
    background: radial-gradient(circle at 0 100%, transparent 6px, black 6px);
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
    background: radial-gradient(circle at 100% 100%, transparent 6px, black 6px);
  }

  .island--ready {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .island--compact {
    width: 260px;
    height: 40px;
    cursor: pointer;
  }

  .island--compact:hover {
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
    backface-visibility: hidden;
  }

  .island--expanded {
    width: 320px;
    max-height: min(90vh - 24px, 520px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .compact-body {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
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
    background: rgba(255, 255, 255, 0.08);
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
    color: rgba(255, 255, 255, 0.5);
  }

  .compact-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
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
    padding: 10px 12px 6px;
    position: relative;
  }

  .header-tabs {
    display: flex;
    align-items: center;
  }

  .tab-track {
    position: relative;
    display: flex;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 2px;
    height: 30px;
    width: 64px;
  }

  .tab-indicator {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(50% - 2px);
    height: calc(100% - 4px);
    background: rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
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
    transition: color 0.2s ease;
    padding: 0;
  }

  .tab-btn--active {
    color: white;
  }

  .header-spacer {
    width: 48px;
    height: 100%;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    color: rgba(255, 255, 255, 0.4);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.75);
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 12px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    transition: all 0.2s ease;
  }

  .search-bar:focus-within {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.08);
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
    color: rgba(255, 255, 255, 0.25);
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    padding: 4px 12px 12px;
    overflow-y: auto;
    max-height: 320px;
  }

  .app-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 8px 4px 6px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    will-change: transform;
  }

  :not(.island--reduced) > .expanded-body .app-card {
    transition: all 0.15s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .app-card:hover {
    background: rgba(255, 255, 255, 0.06);
    transform: scale(1.04);
  }

  .app-card--selected {
    background: rgba(255, 255, 255, 0.08);
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
    color: rgba(255, 255, 255, 0.55);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-actions {
    border-top: 0.5px solid rgba(255, 255, 255, 0.06);
    padding: 8px 12px 10px;
  }

  .qa-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.25);
    margin-bottom: 6px;
  }

  .qa-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .qa-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.05);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .qa-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.85);
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px 10px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
    font-family: inherit;
  }

  .recent-item:hover {
    background: rgba(255, 255, 255, 0.06);
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
