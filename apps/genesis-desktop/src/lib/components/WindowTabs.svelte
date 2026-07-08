<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "@mateothegreat/svelte5-router";
  import Sortable, { type SortableEvent } from "sortablejs";
  import {
    tabState,
    initTabSession,
    destroyTabSession,
    addTab,
    closeTab,
    switchTab,
    reorderTabs,
  } from "$lib/desktop/tab-session.svelte";
  import { getModuleCatalogEntry, hiddenModuleIds, moduleCatalog } from "$lib/data/module-catalog";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";
  import { activeModule } from "$lib/desktop/modules";
  import { billingProfile } from "$lib/stores/billing.store";
  import { isModuleVisibleByPlan } from "$lib/desktop/billing-access";
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

  // ── Drag state (mirrors Anytype's tabs.js exactly) ──────────────────
  let sortable: Sortable | null = null;
  let isDragging = $state(false);
  let draggedActiveId = "";   // id of active tab when drag started (for marker)

  // ── Helpers ─────────────────────────────────────────────────────────
  function getLabel(moduleId: string): string {
    return getModuleCatalogEntry(moduleId)?.navLabel ?? moduleId;
  }

  function getRoute(moduleId: string): string {
    return getModuleCatalogEntry(moduleId)?.route ?? "/";
  }

  const openModuleIds = $derived(new Set(tabs.map((t) => t.moduleId)));

  const availableModules = $derived(
    moduleCatalog.filter((m) =>
      m.id !== "dashboard"
      && !openModuleIds.has(m.id)
      && !hiddenModuleIds.has(m.id)
      && isModuleVisibleByPlan($billingProfile?.activePlanCode, m.id, $billingProfile?.hasActiveSubscription ?? false)
    ),
  );

  // ── Marker & Background Positioning (Anytype's exact logic) ─────────
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
    const firstTab = scrollEl.querySelector<HTMLElement>(".tab:not(.isAdd)");
    const addTabEl = scrollEl.querySelector<HTMLElement>(".tab.isAdd");
    const startEl = firstTab || addTabEl;
    if (!startEl) { tabsBgEl.style.width = "0"; return; }
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
      if (markerEl) { markerAnimate = false; void markerEl.offsetHeight; markerAnimate = true; }
    } else if (!markerAnimate) {
      markerAnimate = true;
    }
  }

  // Divider hide logic
  function getHideDiv(tabId: string): boolean {
    if (!tabs.length) return false;
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
    const thisIdx = tabs.findIndex((t) => t.id === tabId);
    return thisIdx === activeIdx - 1;
  }

  // Reactively update positions when tabs change (skip during drag — Anytype does this too)
  $effect(() => {
    void tabs.length;
    void activeTabId;
    if (!isDragging) {
      requestAnimationFrame(() => updateAllPositions(false));
    }
  });

  // Auto-create a tab for the currently active module when tabs are first enabled
  // after being in module-switcher mode (e.g. user was in Notes via ModuleSwitcher
  // then enables Tab mode — the Notes tab should appear automatically).
  //
  // IMPORTANT: `$activeModule` is read unconditionally at the top of the effect
  // so it is always tracked as a reactive dependency. If read only inside the `if`
  // body, it drops off the dependency list when the condition short-circuits,
  // causing the effect to miss `$activeModule` changes made while tabs were
  // disabled — and auto-create a tab for the wrong (stale) module.
  $effect(() => {
    const currentModuleId = $activeModule;
    if (tabsEnabled && tabs.length === 0 && tabState.initialized) {
      if (currentModuleId && currentModuleId !== "dashboard") {
        addTab(currentModuleId);
      }
    }
  });

  // ── Sortable init/destroy (Anytype pattern: re-init after every DOM change) ─
  function initSortable() {
    if (sortable) { sortable.destroy(); sortable = null; }
    if (!scrollEl) return;

    const tabEls = scrollEl.querySelectorAll(".tab:not(.isAdd)");
    if (!tabEls.length) return;

    sortable = new Sortable(scrollEl, ({
      animation: 150,
      easing: "ease-in-out",
      draggable: ".tab:not(.isAdd)",
      filter: ".icon.close",
      preventOnFilter: false,
      ghostClass: "sortable-drag",
      onMove(evt: any) {
        const dragged = evt.dragged as HTMLElement;
        const related = evt.related as HTMLElement;
        const draggedPinned = dragged.dataset.pinned === "true";
        const relatedPinned = related?.dataset?.pinned === "true";
        if (draggedPinned !== relatedPinned) return false;
        return true;
      },
      onStart(evt: SortableEvent) {
        isDragging = true;
        const item = evt.item as HTMLElement;
        item.style.visibility = "hidden";

        if (item.classList.contains("active")) {
          draggedActiveId = item.dataset.tabId ?? "";
          if (markerEl) {
            markerEl.classList.remove("anim");
            markerEl.style.pointerEvents = "none";
          }
        }
      },
      onChange(_evt: SortableEvent) {
        updateMarkerPosition(draggedActiveId || activeTabId);
        updateBackgroundPosition();
      },
      onEnd(evt: SortableEvent) {
        isDragging = false;
        draggedActiveId = "";

        const item = evt.item as HTMLElement;
        item.style.visibility = "";

        if (markerEl) {
          markerEl.classList.add("anim");
          markerEl.style.pointerEvents = "";
        }

        if (!scrollEl) return;
        const tabIds: string[] = [];
        scrollEl.querySelectorAll<HTMLElement>(".tab:not(.isAdd)").forEach((el) => {
          const id = el.dataset.tabId;
          if (id) tabIds.push(id);
        });

        if (tabIds.length > 0) {
          void reorderTabs(tabIds);
        }

        requestAnimationFrame(() => updateAllPositions(false));

        setTimeout(() => initSortable(), 10);
      },
    } as any));
  }

  // ── Tab actions ──────────────────────────────────────────────────────
  function onTabClick(tabId: string, moduleId: string) {
    tabState.activeTabId = tabId;
    tabState.tabs = tabState.tabs.map((t) => ({
      ...t,
      isForeground: t.id === tabId,
      state: t.id === tabId ? ("Active" as const) : ("Background" as const),
    }));
    void switchTab(tabId);
    goto(getRoute(moduleId));
  }

  function onTabClose(e: MouseEvent, tabId: string) {
    e.stopPropagation();
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

  function toggleAddMenu() { addMenuOpen = !addMenuOpen; }

  function onAddModule(moduleId: string) {
    const tab = addTab(moduleId);
    if (tab) goto(getRoute(moduleId));
    addMenuOpen = false;
  }

  function onOutsideClick(e: MouseEvent) {
    if (
      addMenuOpen &&
      scrollEl && !scrollEl.contains(e.target as Node) &&
      dropdownEl && !dropdownEl.contains(e.target as Node)
    ) { addMenuOpen = false; }
  }

  function onDropdownKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { addMenuOpen = false; addBtnEl?.focus(); }
  }

  // Re-init sortable whenever tabs list changes (same as Anytype: re-init after create/remove)
  $effect(() => {
    void tabs.length;
    if (!isDragging) {
      tick().then(() => setTimeout(() => initSortable(), 10));
    }
  });

  // ── Lifecycle ────────────────────────────────────────────────────────
  onMount(async () => {
    await initTabSession();
    await tick();
    requestAnimationFrame(() => updateAllPositions(true));
    setTimeout(() => initSortable(), 10);
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onDropdownKeydown as EventListener);
  });

  onDestroy(() => {
    if (sortable) { sortable.destroy(); sortable = null; }
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
        data-pinned="false"
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

  <!-- Add dropdown -->
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

  .window-tabs__scroll {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  .window-tabs__scroll::-webkit-scrollbar { display: none; }

  /* ── Anytype's #tabsBackground ── */
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

  /* ── Anytype's #marker ── */
  .window-tabs__marker {
    position: absolute;
    height: calc(100% - 4px);
    top: 2px;
    background: var(--background);
    border-radius: 18px;
    z-index: 1;
    pointer-events: none;
    will-change: left, width;
  }

  .window-tabs--anim .window-tabs__marker {
    transition: left 0.1s ease-in-out, width 0.1s ease-in-out;
  }

  /* ── .tab (Anytype exact) ── */
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

  .tab * { -webkit-app-region: no-drag; }

  .tab.active {
    color: var(--foreground);
    flex-shrink: 0;
    min-width: auto;
  }

  .tab.active .icon.close,
  .tab.active:hover .icon.close { opacity: 1 !important; }

  .tab.active .div,
  .tab.hideDiv .div { display: none; }

  /* ── Anytype ghost class: .sortable-drag ── */
  :global(.sortable-drag) {
    opacity: 1 !important;
    background: color-mix(in srgb, var(--foreground) 6%, var(--background)) !important;
    border-radius: 16px !important;
    color: var(--foreground) !important;
    -webkit-app-region: no-drag !important;
    visibility: visible !important;
  }

  /* ── Add button ── */
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

  .tab.isAdd .icon:hover .plus-icon { color: var(--foreground); }

  /* ── Clickable ── */
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

  /* ── Name ── */
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

  /* ── Icon base ── */
  .icon {
    transition: all 0.1s ease-in-out;
    cursor: default;
    -webkit-app-region: no-drag;
  }

  .icon.withBackground { border-radius: 10px; }

  .icon.withBackground:hover {
    background-color: color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  /* ── Close button ── */
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

  .tab:not(.active):hover .icon.close { opacity: 0.45; }
  .tab .icon.close:hover { opacity: 1 !important; background: color-mix(in srgb, var(--foreground) 12%, transparent); }

  .close-icon { width: 10px; height: 10px; }

  /* ── Divider ── */
  .tab .div {
    position: absolute;
    width: 1px;
    top: 50%;
    margin-top: -10px;
    height: 20px;
    background: color-mix(in srgb, var(--foreground) 11%, transparent);
    z-index: 0;
    right: 0;
  }

  /* ── Add dropdown ── */
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
    animation: tabs-dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes tabs-dropdown-in {
    from { opacity: 0; transform: translateX(4px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .window-tabs__add-dropdown-items {
    display: flex;
    flex-direction: column;
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

  .window-tabs__add-dropdown-item:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .window-tabs__add-dropdown-item:active { background: color-mix(in srgb, var(--foreground) 10%, transparent); }
</style>
