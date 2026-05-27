<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "@mateothegreat/svelte5-router";
  import {
    tabState,
    initTabSession,
    destroyTabSession,
    addTab,
    closeTab,
    switchTab,
  } from "$lib/desktop/tab-session.svelte";
  import { getModuleCatalogEntry, moduleCatalog } from "$lib/data/module-catalog";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  // ── Reactive state from store ───────────────────────────────────────
  let tabs = $derived(tabState.tabs);
  let activeTabId = $derived(tabState.activeTabId);
  let tabsEnabled = $derived($desktopSettings.workspace.tabsEnabled);

  // ── UI state ────────────────────────────────────────────────────────
  let addMenuOpen = $state(false);
  let scrollEl: HTMLDivElement | undefined = $state();
  let markerEl: HTMLDivElement | undefined = $state();
  let tabsBgEl: HTMLDivElement | undefined = $state();
  let addBtnEl: HTMLElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();

  // Marker animation gate — first paint jumps, subsequent slides
  let markerAnimate = $state(false);

  // Marker and bg positioning done via direct DOM manipulation

  // ── Helpers ─────────────────────────────────────────────────────────
  function getLabel(moduleId: string): string {
    return getModuleCatalogEntry(moduleId)?.navLabel ?? moduleId;
  }

  function getRoute(moduleId: string): string {
    return getModuleCatalogEntry(moduleId)?.route ?? "/";
  }

  // Filter out: dashboard, and any module that already has an open tab
  const openModuleIds = $derived(new Set(tabs.map((t) => t.moduleId)));

  const availableModules = $derived(
    moduleCatalog.filter((m) => m.id !== "dashboard" && !openModuleIds.has(m.id)),
  );

  // ── Marker & Background Positioning (Anytype's exact logic) ────────
  function updateMarkerPosition(id: string | undefined) {
    if (!id || !scrollEl || !markerEl) return;

    const active = scrollEl.querySelector<HTMLElement>(`#tab-${id}`);
    if (!active) return;

    const containerRect = scrollEl.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    markerEl.style.width = `${activeRect.width - 4}px`;
    markerEl.style.left = `${activeRect.left - containerRect.left + 2}px`;
  }

  function updateBackgroundPosition() {
    if (!scrollEl || !tabsBgEl) return;

    // Start from first tab, or add button if no tabs
    const firstTab = scrollEl.querySelector<HTMLElement>(".tab:not(.isAdd)");
    const addTab = scrollEl.querySelector<HTMLElement>(".tab.isAdd");
    const startEl = firstTab || addTab;

    if (!startEl) {
      tabsBgEl.style.width = "0";
      return;
    }

    const containerRect = scrollEl.getBoundingClientRect();
    const startRect = startEl.getBoundingClientRect();
    const left = startRect.left - containerRect.left;

    tabsBgEl.style.left = `${left}px`;
    tabsBgEl.style.width = `${scrollEl.clientWidth - left}px`;
  }

  function updateAllPositions(skipAnim = false) {
    updateMarkerPosition(activeTabId);
    updateBackgroundPosition();

    if (skipAnim) {
      if (markerEl) {
        markerAnimate = false;
        void markerEl.offsetHeight;
        markerAnimate = true;
      }
    } else if (!markerAnimate) {
      markerAnimate = true;
    }
  }

  // ── Divider hide logic (Anytype: hide divider on previous tab + active tab) ──
  function getHideDiv(tabId: string): boolean {
    if (!tabs.length) return false;
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
    const thisIdx = tabs.findIndex((t) => t.id === tabId);
    // Hide divider if this tab is the one before the active tab
    return thisIdx === activeIdx - 1;
  }

  // Reactively update positions when tabs change
  $effect(() => {
    void tabs.length;
    void activeTabId;
    requestAnimationFrame(() => updateAllPositions(false));
  });

  // ── Tab actions ─────────────────────────────────────────────────────
  function onTabClick(tabId: string, moduleId: string) {
    // Always update local state first, regardless of Tauri availability
    tabState.activeTabId = tabId;
    tabState.tabs = tabState.tabs.map((t) => ({
      ...t,
      isForeground: t.id === tabId,
      state: t.id === tabId ? ("Active" as const) : ("Background" as const),
    }));
    // Then try backend sync (if available)
    void switchTab(tabId);
    goto(getRoute(moduleId));
  }

  function onTabClose(e: MouseEvent, tabId: string) {
    e.stopPropagation();
    // Closing the last tab disables tab mode entirely
    if (tabs.length <= 1) {
      void updateDesktopSettings((s) => ({
        ...s,
        workspace: { ...s.workspace, tabsEnabled: false },
      }));
      tabState.tabs = [];
      tabState.activeTabId = "";
      return;
    }
    void closeTab(tabId);
  }

  function toggleAddMenu() {
    addMenuOpen = !addMenuOpen;
  }

  function onAddModule(moduleId: string) {
    const tab = addTab(moduleId);
    if (tab) {
      goto(getRoute(moduleId));
    }
    addMenuOpen = false;
  }

  function onOutsideClick(e: MouseEvent) {
    if (
      addMenuOpen &&
      scrollEl &&
      !scrollEl.contains(e.target as Node) &&
      dropdownEl &&
      !dropdownEl.contains(e.target as Node)
    ) {
      addMenuOpen = false;
    }
  }

  function onDropdownKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      addMenuOpen = false;
      addBtnEl?.focus();
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────
  onMount(async () => {
    await initTabSession();
    await tick();
    requestAnimationFrame(() => updateAllPositions(true));
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onDropdownKeydown as EventListener);
  });

  onDestroy(() => {
    destroyTabSession();
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("keydown", onDropdownKeydown as EventListener);
  });
</script>

<div
  class="window-tabs"
  class:window-tabs--hidden={!tabsEnabled}
  class:window-tabs--anim={markerAnimate}
>
  <div class="window-tabs__scroll" bind:this={scrollEl}>
    {#each tabs as tab (tab.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        id="tab-{tab.id}"
        class="tab"
        class:active={tab.id === activeTabId}
        class:hideDiv={getHideDiv(tab.id)}
        data-tab-id={tab.id}
        data-module-id={tab.moduleId}
        role="button"
        tabindex="0"
        aria-label={getLabel(tab.moduleId)}
        onclick={() => onTabClick(tab.id, tab.moduleId)}
        onkeydown={(e) => e.key === "Enter" && onTabClick(tab.id, tab.moduleId)}
        use:tooltip={{ text: getLabel(tab.moduleId), typeY: "bottom", delay: 400 }}
      >
        <div class="clickable">
          <span class="name">{getLabel(tab.moduleId)}</span>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="icon close withBackground"
            role="button"
            tabindex="-1"
            aria-label="Close {getLabel(tab.moduleId)} tab"
            onclick={(e) => onTabClose(e, tab.id)}
          >
            <svg viewBox="0 0 10 10" class="close-icon">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
            </svg>
          </div>
        </div>
        <div class="div"></div>
      </div>
    {/each}

    <!-- Add (+) button -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tab isAdd"
      role="button"
      tabindex="0"
      aria-label="Open new tab"
      bind:this={addBtnEl}
      onclick={toggleAddMenu}
      onkeydown={(e) => e.key === "Enter" && toggleAddMenu()}
      use:tooltip={{ text: "Open app in new tab", typeY: "bottom", delay: 400 }}
    >
      <div class="icon withBackground">
        <svg viewBox="0 0 14 14" class="plus-icon">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </svg>
      </div>
    </div>
  </div>

  <!-- Background fill (Anytype's #tabsBackground) -->
  <div class="window-tabs__bg" bind:this={tabsBgEl}></div>

  <!-- Active tab pill marker (Anytype's #marker) -->
  <div class="window-tabs__marker" bind:this={markerEl}></div>

  <!-- Add dropdown — card-system floating sidebar, app names only -->
  {#if addMenuOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={dropdownEl}
      class="window-tabs__add-dropdown"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      role="menu"
      aria-label="Open app"
    >
      <div class="window-tabs__add-dropdown-items">
        {#each availableModules as mod (mod.id)}
          <button
            type="button"
            class="window-tabs__add-dropdown-item"
            onclick={() => onAddModule(mod.id)}
            role="menuitem"
          >
            {mod.navLabel}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     WINDOW TABS — 1:1 port from Anytype
     
     Structure (matches Anytype exactly):
       .window-tabs                 → #tabsWrapper
       .window-tabs__scroll         → #tabs
       .tab > .clickable > .name + .icon.close + .div  (matches Anytype)
       .tab.isAdd > .icon           → add button
       .window-tabs__bg             → #tabsBackground
       .window-tabs__marker         → #marker
     
     CSS variable mapping:
       --color-text-primary       → var(--foreground)
       --color-text-secondary     → color-mix(in srgb, var(--foreground) 51%, transparent)
       --color-bg-primary         → var(--background)
       --color-shape-tertiary     → color-mix(in srgb, var(--foreground) 6%, var(--background))
       --color-shape-highlight-dark  → color-mix(in srgb, var(--foreground) 11%, transparent)
       --color-shape-highlight-medium → color-mix(in srgb, var(--foreground) 5%, transparent)
     ═══════════════════════════════════════════════════════════════════ */

  /* ── Wrapper (Anytype: #tabsWrapper) ── */
  .window-tabs {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 36px;
    background: transparent;
    user-select: none;
    -webkit-app-region: drag;
    transition: opacity 0.15s ease-in-out;
  }

  .window-tabs--hidden {
    opacity: 0;
    pointer-events: none;
    -webkit-app-region: no-drag;
  }

  /* ── Scroll container (Anytype: #tabs) ── */
  .window-tabs__scroll {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  .window-tabs__scroll::-webkit-scrollbar {
    display: none;
  }

  /* ── Background fill (Anytype: #tabsBackground) ── */
  .window-tabs__bg {
    position: absolute;
    height: 100%;
    top: 0;
    background: color-mix(in srgb, var(--foreground) 6%, var(--background));
    border-radius: 18px;
    z-index: 0;
    pointer-events: none;
    transition: left 0.1s ease-in-out, width 0.1s ease-in-out;
  }

  /* ── Marker pill (Anytype: #marker) ──
     NOTE: Only the transition property is gated via .window-tabs--anim.
     The marker itself is ALWAYS visible (matching Anytype behavior).
  */
  .window-tabs__marker {
    position: absolute;
    height: calc(100% - 4px);
    top: 2px;
    background: var(--background);
    border-radius: 18px;
    z-index: 1;
    pointer-events: none;
    will-change: transform, left, width;
  }

  .window-tabs--anim .window-tabs__marker {
    transition: left 0.1s ease-in-out, width 0.1s ease-in-out;
  }

  /* ── Individual tab (Anytype: .tab) ── */
  .tab {
    padding: 8px 8px 8px 12px;
    cursor: default;
    min-width: 36px;
    max-width: 204px;
    flex: 1 1 204px;
    color: color-mix(in srgb, var(--foreground) 51%, transparent);
    display: flex;
    flex-direction: row;
    align-items: center;
    position: relative;
    z-index: 2;
    transition: color 0.1s ease-in-out;
    -webkit-app-region: no-drag;
  }

  .tab * {
    -webkit-app-region: no-drag;
  }

  /* noClose: hide close button when only 1 tab remains — REMOVED per user request.
     Single tab always shows close button; clicking it disables tab mode. */

  .tab.active {
    color: var(--foreground);
    flex-shrink: 0;
    min-width: auto;
  }

  .tab.active .icon.close {
    opacity: 1;
  }

  .tab.active:hover .icon.close {
    opacity: 1 !important;
  }

  .tab.active .div,
  .tab.hideDiv .div {
    display: none;
  }

  /* ── Add button (Anytype: .tab.isAdd) ── */
  .tab.isAdd {
    flex: 0 0 auto;
    min-width: 24px;
    padding: 4px;
    cursor: default;
    -webkit-app-region: no-drag;
  }

  .tab.isAdd .icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s ease-in-out, color 0.1s ease-in-out;
  }

  .tab.isAdd .icon:hover {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .plus-icon {
    width: 14px;
    height: 14px;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }

  .tab.isAdd .icon:hover .plus-icon {
    color: var(--foreground);
  }

  /* ── Clickable area (Anytype: .tab .clickable) ── */
  .tab .clickable {
    display: flex;
    flex-direction: row;
    gap: 6px;
    align-items: center;
    overflow: hidden;
    flex-grow: 1;
    position: relative;
    z-index: 2;
    -webkit-app-region: no-drag;
  }

  /* ── Tab name (Anytype: .tab .name) ── */
  .tab .name {
    height: 20px;
    line-height: 20px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-grow: 1;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: -0.01em;
    -webkit-app-region: no-drag;
  }

  /* ── Global icon base (Anytype: .icon) ── */
  .icon {
    transition: all 0.1s ease-in-out;
    cursor: default;
    -webkit-app-region: no-drag;
  }

  .icon.withBackground {
    border-radius: 10px;
  }

  .icon.withBackground:hover {
    background-color: color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  /* ── Close button (Anytype: .tab .icon.close) ── */
  .tab .icon.close {
    flex-shrink: 0;
    opacity: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.1s ease-in-out, background 0.1s ease-in-out;
    cursor: default;
  }

  .tab:not(.active):hover .icon.close {
    opacity: 0.45;
  }

  .tab .icon.close:hover {
    opacity: 1 !important;
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
  }

  .close-icon {
    width: 10px;
    height: 10px;
  }

  /* ── Divider (Anytype: .tab .div) ── */
  .tab .div {
    position: absolute;
    width: 1px;
    top: 50%;
    margin-top: -10px;
    height: 20px;
    background: color-mix(in srgb, var(--foreground) 11%, transparent);
    z-index: 0;
    right: 0;
    transition: opacity 0.1s ease-in-out;
  }

  /* ── Add dropdown — card-system sidebar, app names only ──
     Background: var(--background) per card system's dropdown spec.
     Border: 1px solid var(--border) retained (user-requested).
     No shadow, just the app name, compact items. */
  .window-tabs__add-dropdown {
    position: fixed;
    top: 48px;
    right: 0;
    width: 240px;
    background: var(--background);
    border: 1px solid var(--border);
    border-top-left-radius: 20px;
    border-bottom-left-radius: 20px;
    box-shadow: none;
    z-index: 9999;
    overflow: visible;
    animation: tabs-dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes tabs-dropdown-in {
    from {
      opacity: 0;
      transform: translateX(4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .window-tabs__add-dropdown-items {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 6px;
  }

  .window-tabs__add-dropdown-item {
    display: block;
    width: 100%;
    padding: 4px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--foreground);
    font-size: 13px;
    font-weight: 500;
    line-height: 22px;
    cursor: default;
    text-align: left;
    transition: background 0.1s ease-in-out;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .window-tabs__add-dropdown-item:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .window-tabs__add-dropdown-item:active {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
  }
</style>
