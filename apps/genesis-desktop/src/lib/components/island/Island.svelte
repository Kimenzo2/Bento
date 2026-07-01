<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { islandStore } from "$lib/stores/island.store.svelte";
  import type { IslandItem } from "$lib/data/island-catalog";
  import { islandItems } from "$lib/data/island-catalog";
  import { getIcon } from "./island-icons";
  import { loadBuiltinWidgets } from "./widgets/widget-config";
  import { widgetStore } from "$lib/stores/widget.store.svelte";
  import ModuleActive from "./ModuleActive.svelte";

  const layoutGridIcon = getIcon("layout-grid");
  const clockIcon = getIcon("clock");
  const layoutDashboardIcon = getIcon("layout-dashboard");
  const searchIcon = getIcon("search");
  const xIcon = getIcon("x");
  const chevronDownIcon = getIcon("chevron-down");

  let { handleLaunch = (item: IslandItem) => {}, handleQuickAction = (action: string, item: IslandItem) => {} }: {
    handleLaunch?: (item: IslandItem) => void;
    handleQuickAction?: (action: string, item: IslandItem) => void;
  } = $props();

  let appGridEl = $state<HTMLElement | null>(null);
  let searchActive = $state(false);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  // ── Live recording timer for compact state ──
  let compactTimerStart = $state(0);
  let compactElapsed = $state(0);

  $effect(() => {
    const isRecording = islandStore.activeModule?.activityType === "recording";
    if (!isRecording) {
      compactElapsed = 0;
      return;
    }
    compactTimerStart = Date.now();
    const interval = setInterval(() => {
      compactElapsed = Math.floor((Date.now() - compactTimerStart) / 1000);
    }, 200);
    return () => clearInterval(interval);
  });

  function formatClock(seconds: number): string {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // Lazy color cache to avoid repeated lookups
  const accentColorCache = new Map<string, string>();
  function getAccentColor(id: string): string {
    let c = accentColorCache.get(id);
    if (!c) {
      const item = islandItems.find((i) => i.id === id);
      c = item?.accentColor ?? "#5f61ed";
      accentColorCache.set(id, c);
    }
    return c;
  }

  function closeSearch() {
    searchActive = false;
    islandStore.searchQuery = "";
  }

  function onLaunch(item: IslandItem) {
    closeSearch();
    islandStore.pushRecent(item.id);
    handleLaunch(item);
    islandStore.collapse();
  }

  function onQuickAction(action: string, item: IslandItem) {
    closeSearch();
    islandStore.pushRecent(item.id);
    handleQuickAction(action, item);
    // Don't collapse — the parent handler keeps the island open
    // and switches to module-active view.
  }

  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const inWidget = target.closest(".widget-card-w") || target.closest(".widget-wrapper");

    if (e.key === "Escape") {
      if (inWidget) return;
      if (searchActive) {
        searchActive = false;
        islandStore.searchQuery = "";
        return;
      }
      islandStore.collapse();
    }
  }

  function toggleSearch() {
    searchActive = !searchActive;
    if (searchActive) {
      islandStore.searchQuery = "";
      requestAnimationFrame(() => searchInputEl?.focus());
    } else {
      islandStore.searchQuery = "";
    }
  }

  function onClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (islandStore.mode === "expanded" && !target.closest(".island")) {
      islandStore.collapse();
    }
  }

  function getGridColumns(): number {
    if (!appGridEl) return 2;
    const first = appGridEl.querySelector<HTMLElement>(".widget-card");
    if (!first) return 2;
    const containerWidth = appGridEl.offsetWidth;
    const cardWidth = first.offsetWidth;
    if (!cardWidth) return 2;
    return Math.max(1, Math.round(containerWidth / (cardWidth + 8)));
  }

  function handleGridKeydown(e: KeyboardEvent) {
    const buttons = appGridEl?.querySelectorAll<HTMLButtonElement>(".widget-card");
    if (!buttons?.length) return;
    const cols = getGridColumns();
    const currentIndex = Array.from(buttons).findIndex((b) => b === document.activeElement);

    // Enter always launches the focused item
    if (e.key === "Enter") {
      e.preventDefault();
      const btn = buttons[currentIndex];
      if (btn) {
        const id = btn.dataset.itemId;
        if (id) {
          const item = islandStore.filteredItems.find((i) => i.id === id);
          if (item) onLaunch(item);
        }
      }
      return;
    }

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
    else if (e.key === "ArrowLeft") nextIndex = Math.max(currentIndex - 1, 0);
    else if (e.key === "ArrowDown") nextIndex = Math.min(currentIndex + cols, buttons.length - 1);
    else if (e.key === "ArrowUp") nextIndex = Math.max(currentIndex - cols, 0);
    else return;
    e.preventDefault();
    buttons[nextIndex]?.focus();
  }

  onMount(() => {
    loadBuiltinWidgets();
    widgetStore.load();
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
    onmousedown={(e) => { if (islandStore.mode === "expanded") e.stopPropagation(); }}
  >
    {#if islandStore.mode === "compact"}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="compact-body"
        class:compact-body--live={!!islandStore.activeModule}
        in:fade={{ duration: 350, easing: cubicOut }}
        out:fade={{ duration: 120 }}
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
          islandStore.expand();
        }}
        role="button"
        tabindex="0"
        aria-label={islandStore.activeModule ? `Show ${islandStore.activeModule.label}` : "Expand Bento launcher"}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            islandStore.expand();
          }
        }}
      >          {#if islandStore.activeModule}
            {@const CompactActiveIcon = getIcon(islandStore.activeModule.icon)}
            <div class="compact-live">
              <span class="compact-live-icon" style="color: {getAccentColor(islandStore.activeModule.id)}">
                <CompactActiveIcon size={12} strokeWidth={2.2} />
              </span>
              <span class="compact-live-label">{islandStore.activeModule.label}</span>
              <span class="compact-live-status">
                {#if islandStore.activeModule.activityType === "recording"}
                  {formatClock(compactElapsed)}
                  <span class="compact-live-dot"></span>
                {:else}
                  {islandStore.activeModule.status}
                {/if}
              </span>
            </div>
        {:else}
          <span class="compact-dot"></span>
        {/if}
      </div>
    {/if}
    {#if islandStore.mode === "expanded"}
      <div class="expanded-body" onclick={(e) => e.stopPropagation()} in:fade={{ duration: 300, easing: cubicOut, delay: 80 }} out:fade={{ duration: 120 }}>
        <div class="expanded-header">
          <div class="header-tabs" role="tablist" aria-label="Bento sections">
            <div class="tab-track">
              <div
                class="tab-indicator"
                style="transform: translateX({islandStore.page === "apps" ? 0 : islandStore.page === "actions" ? 100 : 200}%)"
              ></div>
              <button
                class="tab-btn"
                class:tab-btn--active={islandStore.page === "apps"}
                onclick={() => islandStore.setPage("apps")}
                role="tab"
                aria-selected={islandStore.page === "apps"}
                aria-controls="bento-panel-apps"
                aria-label="Apps"
              >
                <layoutGridIcon size={13} strokeWidth={1.8} />
              </button>
              <button
                class="tab-btn"
                class:tab-btn--active={islandStore.page === "actions"}
                onclick={() => islandStore.setPage("actions")}
                role="tab"
                aria-selected={islandStore.page === "actions"}
                aria-controls="bento-panel-recent"
                aria-label="Recent"
              >
                <clockIcon size={13} strokeWidth={1.8} />
              </button>
              <button
                class="tab-btn"
                class:tab-btn--active={islandStore.page === "widgets"}
                onclick={() => islandStore.setPage("widgets")}
                role="tab"
                aria-selected={islandStore.page === "widgets"}
                aria-controls="bento-panel-widgets"
                aria-label="Widgets"
              >
                <layoutDashboardIcon size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <div class="header-actions">
            <button
              class="search-icon-btn"
              class:search-icon-btn--active={searchActive}
              onclick={toggleSearch}
              aria-label="Search widgets"
            >
              <searchIcon size={14} strokeWidth={1.8} />
            </button>
            <button
              class="close-btn"
              onclick={() => islandStore.collapse()}
              aria-label="Close"
            >
              <xIcon size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {#if searchActive}
          <div class="search-active" in:fade={{ duration: 150 }}>
            <searchIcon size={11} color="rgba(255,255,255,0.25)" strokeWidth={2} />
            <input
              class="search-active-input"
              type="text"
              placeholder="Find widget…"
              aria-label="Search widgets"
              bind:value={islandStore.searchQuery}
              bind:this={searchInputEl}
              onkeydown={(e) => { if (e.key === "Escape") { e.stopPropagation(); searchActive = false; islandStore.searchQuery = ""; }}}
            />
          </div>
        {/if}
        {#if islandStore.activeModule}
          <!-- ── Module Active View ── -->
          <ModuleActive activeModule={islandStore.activeModule} />
        {:else if islandStore.page === "apps"}
          <div class="w-grid" bind:this={appGridEl} onkeydown={handleGridKeydown} role="listbox" tabindex="-1">
            {#each islandStore.filteredItems as item (item.id)}
              {@const w = item.widget}
              {@const ItemIcon = getIcon(item.icon)}
              <button
                class="widget-card"
                class:w-sm={w.width === "sm"}
                class:w-md={w.width === "md"}
                class:widget-card--selected={islandStore.selectedItemId === item.id}
                data-item-id={item.id}
                onclick={() => islandStore.selectItem(item.id)}
                ondblclick={() => onLaunch(item)}
                role="option"
                aria-selected={islandStore.selectedItemId === item.id}
              >
                <div class="widget-body">
                  <div class="widget-row">
                    <span class="w-icon" style="color: {item.accentColor}">
                      <ItemIcon size={13} strokeWidth={1.5} />
                    </span>
                    <span class="w-value">{w.primary}</span>
                    {#if w.unit}<span class="w-unit">{w.unit}</span>{/if}
                    <span class="w-secondary">{w.secondary}</span>
                  </div>
                  <div class="widget-footer">
                    <span class="widget-name">{item.name}</span>
                  </div>
                </div>
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
                    {@const ActionIcon = getIcon(action.icon)}
                    <button class="qa-btn" onclick={() => onQuickAction(action.action, item)}>
                      <ActionIcon size={11} strokeWidth={2} />
                      {action.label}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        {:else if islandStore.page === "widgets"}
          <div class="w-scroll">
            {#each widgetStore.enabledWidgets as w (w.id)}
              <div class="widget-card-w">
                <w.ExpandedComponent />
              </div>
            {/each}
            {#if widgetStore.enabledWidgets.length === 0}
              <div class="w-empty">
                <span>No widgets enabled</span>
                <button class="w-empty-btn" onclick={() => islandStore.setPage("apps")}>
                  Browse Apps
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="r-list">
            {#each islandStore.recentItems as item (item.id)}
              {@const RecentIcon = getIcon(item.icon)}
              <button class="r-item" onclick={() => onLaunch(item)}>
                <div class="r-item-icon" style="background: {item.accentColor}18; color: {item.accentColor}">
                  <RecentIcon size={14} strokeWidth={1.6} />
                </div>
                <div class="r-info">
                  <span class="r-name">{item.name}</span>
                  <span class="r-tagline">{item.tagline}</span>
                </div>
                <chevronDownIcon size={11} color="rgba(255,255,255,0.2)" strokeWidth={2.2} class="r-arrow" />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.island-overlay), :global(.island-overlay *) {
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
    outline: 1px solid rgba(255, 255, 255, 0.2);
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
    background: #0d0d0d;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
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
    top: -1px;
    left: -7px;
    width: 7px;
    height: 7px;
    z-index: 10;
    pointer-events: none;
    background: radial-gradient(circle at 0 100%, transparent 7px, #0d0d0d 7px);
  }

  .island::after {
    content: '';
    position: absolute;
    top: -1px;
    right: -7px;
    width: 7px;
    height: 7px;
    z-index: 10;
    pointer-events: none;
    background: radial-gradient(circle at 100% 100%, transparent 7px, #0d0d0d 7px);
  }

  .island--compact {
    width: 260px;
    height: 40px;
    border-radius: 0 0 14px 14px;
    cursor: pointer;
    border-top: none;
  }

  .island--compact::before,
  .island--compact::after {
    top: 0;
  }

  .island--compact:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .island--compact:active {
    background: #111;
  }

  .island--expanded {
    width: 560px;
    height: 480px;
    border-radius: 0 0 18px 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-top: none;
  }

  .island--expanded::before,
  .island--expanded::after {
    top: 0;
  }

  .compact-body {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    padding: 0 14px;
    height: 100%;
    width: 100%;
  }

  /* ── Live compact state (module active) ── */
  .compact-body--live {
    justify-content: space-between;
    gap: 4px;
    cursor: pointer;
  }

  .compact-live {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .compact-live-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .compact-live-label {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .compact-live-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.3);
    margin-left: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact-live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ef4444;
    animation: live-pulse 1s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(0.7); }
  }

  .compact-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #5f61ed;
    flex-shrink: 0;
  }

  .expanded-body {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .expanded-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
    flex-shrink: 0;
  }

  .header-tabs {
    display: flex;
    align-items: center;
  }

  .tab-track {
    position: relative;
    display: flex;
    background: rgba(255, 255, 255, 0.05);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    padding: 2px;
    height: 28px;
    width: 90px;
  }

  .tab-indicator {
    position: absolute;
    top: 2px;
    left: 2px;
    width: calc(33.33% - 3px);
    height: calc(100% - 4px);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: #2b2b2b;
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
    color: rgba(255, 255, 255, 0.65);
    padding: 0;
  }

  .tab-btn--active {
    color: #fff;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(255, 255, 255, 0.05);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    border-radius: 18px;
    padding: 2px;
    height: 28px;
  }

  .search-icon-btn,
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    transition: background 0.15s, color 0.15s;
  }

  .search-icon-btn:hover,
  .search-icon-btn--active,
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .search-icon-btn:active,
  .close-btn:active {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }

  .search-active {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 12px 8px;
    padding: 7px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }

  .search-active-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.85);
    font-family: inherit;
  }

  .search-active-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .w-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 12px 8px;
    overflow-y: auto;
    flex: 1;
    justify-content: center;
    align-content: start;
  }

  .widget-card {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 124px;
    border-radius: 12px;
    background: #141416;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: rgba(255, 255, 255, 0.75);
    overflow: hidden;
    padding: 0;
  }

  .widget-card.w-sm {
    width: calc(33.33% - 6px);
    min-width: 140px;
    flex: 1 1 calc(33.33% - 6px);
  }

  .widget-card.w-md {
    width: calc(50% - 4px);
    flex: 1 1 calc(50% - 4px);
  }

  .widget-card--selected {
    background: rgba(255, 255, 255, 0.06);
  }

  .widget-card:hover {
    background: #19191c;
  }

  .widget-card:active {
    background: #1c1c20;
  }

  .widget-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 14px 14px 10px;
    justify-content: space-between;
  }

  .widget-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }

  .w-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: 2px;
  }

  .w-value {
    font-size: 22px;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1;
  }

  .w-unit {
    font-size: 13px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.25);
  }

  .w-secondary {
    font-size: 11px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.35);
    flex: 1;
    text-align: right;
  }

  .widget-footer {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .widget-name {
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.18);
  }

  .quick-actions {
    border-top: 0.5px solid rgba(255, 255, 255, 0.06);
    padding: 8px 12px 10px;
    flex-shrink: 0;
  }

  .qa-label {
    font-size: 9px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.2);
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
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 400;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-family: inherit;
  }

  .qa-btn:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.04);
  }

  .w-scroll {
    display: flex;
    flex-direction: row;
    gap: 10px;
    padding: 4px 12px 10px;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    align-items: stretch;
  }

  .widget-card-w {
    flex: 1;
    min-width: 260px;
    max-width: 380px;
  }

  .w-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.15);
    font-size: 12px;
  }

  .w-empty-btn {
    padding: 6px 16px;
    border-radius: 8px;
    border: 0.5px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }

  .w-empty-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
  }

  .r-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 12px 10px;
    overflow-y: auto;
    flex: 1;
  }

  .r-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #141416;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font-family: inherit;
    border: none;
  }

  .r-item:hover {
    background: #19191c;
  }

  .r-item:active {
    background: #1c1c20;
  }

  .r-item-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .r-info {
    flex: 1;
    min-width: 0;
  }

  .r-name {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
  }

  .r-tagline {
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.r-arrow) {
    flex-shrink: 0;
    transform: rotate(-90deg);
  }

  /* Module Active styles now live in ModuleActive.svelte */
  /* (scoped styles kept there, nothing unused here) */
</style>
