<script lang="ts">
  import { browser } from "$app/environment";
  import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { SortableEvent } from "sortablejs";
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import { goto } from "@mateothegreat/svelte5-router";
import { pageMeta, type PageKey } from "$lib/router/routes";
import { routePatterns } from "$lib/router/route-patterns";
import { moduleCatalog } from "$lib/data/module-catalog";
import { moduleFromPath } from "$lib/desktop/modules";
  import {
    initTabSession,
    destroyTabSession,
    openTab as backendOpenTab,
    closeTab as backendCloseTab,
    switchTab as backendSwitchTab,
    getTabs,
    getActiveTabId,
    isSessionInitialized,
  } from "$lib/desktop/tab-session.svelte";

  type WindowBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  type CursorPoint = {
    x: number;
    y: number;
  };

  type TabPayload = {
    title: string;
    route: string;
    subtitle?: string;
    isPinned?: boolean;
    icon?: string;
    layout?: number;
    spaceType?: number;
    isImage?: boolean;
  };

  type TabItem = {
    id: string;
    data: TabPayload;
  };

  const DEFAULT_ROUTE = "/";
  const isDesktop = isTauri();

  let tabsElement: HTMLDivElement | null = null;
  let sortable: { destroy: () => void } | null = null;
  let sortableFactory: (typeof import("sortablejs"))["default"] | null = null;
  let layoutFrame = 0;

  let tabsData = $state<TabItem[]>([]);
  let activeId = $state("");
  let ready = $state(false);
  let isDragging = $state(false);
  let isSwitching = $state(false);
  let addMenuOpen = $state(false);
  let draggedTabId = $state<string | null>(null);
  let draggedActiveId = $state<string | null>(null);
  let windowBounds = $state<WindowBounds | null>(null);
  let lastCursorPos = $state<CursorPoint | null>(null);
  let tabsWrapperElement: HTMLDivElement | null = null;
  let addButtonElement: HTMLDivElement | null = null;

  // Cursor polling for drag-outside-window detection
  let cursorPollInterval: ReturnType<typeof setInterval> | null = null;
  const CURSOR_POLL_MS = 100;

  const activeIndex = $derived(tabsData.findIndex((tab) => tab.id === activeId));
  const isHidden = $derived(!ready);
  const availableStarterTabs = $derived(
    moduleCatalog.filter((entry) => {
      if (entry.host !== "starter") {
        return false;
      }

      return !tabsData.some((tab) => getRouteModuleId(tab.data.route) === entry.id);
    })
  );

  function createId(prefix = "tab") {
    if (browser && globalThis.crypto?.randomUUID) {
      return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function parseRoute(route: string) {
    const url = new URL(route || DEFAULT_ROUTE, browser ? window.location.href : "http://localhost");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    return {
      pathname,
      normalized: `${pathname}${url.search}${url.hash}`,
    };
  }

  function currentRoute() {
    if (!browser) {
      return DEFAULT_ROUTE;
    }

    return `${window.location.pathname}${window.location.search}${window.location.hash}` || DEFAULT_ROUTE;
  }

  function getRouteModuleId(route: string) {
    const { pathname } = parseRoute(route);

    if (!pathname.startsWith("/apps/")) {
      return null;
    }

    const [, , moduleId] = pathname.split("/");
    return moduleId && moduleCatalog.some((entry) => entry.id === moduleId) ? moduleId : null;
  }

  function titleFromPath(pathname: string) {
    const segments = pathname.split("/").filter(Boolean);
    const segment = segments[segments.length - 1] ?? "";

    if (!segment) {
      return pageMeta.dashboard.title;
    }

    return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function resolvePageKey(pathname: string): PageKey | null {
    if (pathname === "/" || pathname === "") {
      return "dashboard";
    }

    if (pathname === "/create" || routePatterns.project.test(pathname)) {
      return "project";
    }

    if (pathname === "/life-in-colour") {
      return "lifeInColour";
    }

    if (pathname === "/editor") {
      return "editor";
    }

    if (pathname === "/visual-studio") {
      return "visualStudio";
    }

    if (pathname === "/export") {
      return "export";
    }

    if (pathname === "/settings") {
      return "settings";
    }

    if (pathname === "/pricing") {
      return "pricing";
    }

    if (pathname === "/gamification") {
      return "gamification";
    }

    if (pathname === "/account") {
      return "account";
    }

    if (pathname === "/infographics") {
      return "infographics";
    }

    if (pathname === "/legal") {
      return "legal";
    }

    if (pathname === "/viewer" || routePatterns.shared.test(pathname)) {
      return "viewer";
    }

    if (routePatterns.starterApp.test(pathname) || pathname.startsWith("/apps/")) {
      return "starterApp";
    }

    return null;
  }

  function resolveTabPayload(route: string, overrides: Partial<TabPayload> = {}): TabPayload {
    const { pathname, normalized } = parseRoute(route);
    const pageKey = resolvePageKey(pathname);
    const meta = pageKey ? pageMeta[pageKey] : null;

    return {
      title: overrides.title ?? meta?.title ?? titleFromPath(pathname),
      route: normalized,
      subtitle: overrides.subtitle ?? meta?.subtitle,
      isPinned: overrides.isPinned ?? false,
      icon: overrides.icon,
      layout: overrides.layout,
      spaceType: overrides.spaceType,
      isImage: overrides.isImage,
    };
  }

  function createTab(route: string, overrides: Partial<TabPayload> = {}): TabItem {
    return {
      id: createId(),
      data: resolveTabPayload(route, overrides),
    };
  }

  function updateBodyFlags() {
    if (!browser) {
      return;
    }

    document.body.classList.toggle("tabsHidden", isHidden);
    document.body.classList.toggle("draggingOutside", isDragging);
  }

  function loadTabs() {
    const fallback = createTab(currentRoute());
    tabsData = [fallback];
    activeId = fallback.id;
    ready = true;
    updateBodyFlags();
    scheduleLayout();
    initSortable();
  }

  function scheduleLayout() {
    if (!browser) {
      return;
    }

    window.cancelAnimationFrame(layoutFrame);
    layoutFrame = window.requestAnimationFrame(() => {
      updateLayout();
    });
  }

  function updateLayout() {
    if (!browser || !tabsElement) {
      return;
    }

    const markerElement = document.getElementById("marker");
    const backgroundElement = document.getElementById("tabsBackground");
    if (!markerElement || !backgroundElement) {
      return;
    }

    const activeTabId = draggedActiveId ?? activeId;
    const activeTab = tabsElement.querySelector<HTMLElement>(`#tab-${activeTabId}`);
    const firstUnpinned = tabsElement.querySelector<HTMLElement>(".tab:not(.isAdd):not(.isPinned)");
    const fallbackStart = firstUnpinned ?? tabsElement.querySelector<HTMLElement>(".tab.isAdd");

    if (activeTab) {
      const tabsRect = tabsElement.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      const left = Math.max(0, activeRect.left - tabsRect.left + tabsElement.scrollLeft + 2);
      const width = Math.max(0, activeRect.width - 4);

      markerElement.style.left = `${left}px`;
      markerElement.style.width = `${width}px`;
      markerElement.style.opacity = "1";
    } else {
      markerElement.style.width = "0px";
      markerElement.style.opacity = "0";
    }

    if (fallbackStart) {
      const tabsRect = tabsElement.getBoundingClientRect();
      const startRect = fallbackStart.getBoundingClientRect();
      const left = Math.max(0, startRect.left - tabsRect.left + tabsElement.scrollLeft);
      const width = Math.max(0, tabsRect.width - left);

      backgroundElement.style.left = `${left}px`;
      backgroundElement.style.width = `${width}px`;
      backgroundElement.style.opacity = "1";
    } else {
      backgroundElement.style.width = "0px";
      backgroundElement.style.opacity = "0";
    }
  }

  function destroySortable() {
    sortable?.destroy();
    sortable = null;
  }

  function syncTabsOrderFromDom() {
    if (!tabsElement) {
      return;
    }

    const orderedIds = Array.from(tabsElement.querySelectorAll<HTMLElement>(".tab:not(.isAdd)"))
      .map((element) => element.dataset.id)
      .filter((id): id is string => Boolean(id));

    if (orderedIds.length !== tabsData.length) {
      return;
    }

    const nextTabs = orderedIds
      .map((id) => tabsData.find((tab) => tab.id === id))
      .filter((tab): tab is TabItem => Boolean(tab));

    if (nextTabs.length === tabsData.length) {
      tabsData = nextTabs;
    }
  }

  function getCursorPoint(event: Event | null) {
    if (!browser || !event) {
      return null;
    }

    const pointerEvent = event as MouseEvent;
    if (typeof pointerEvent.screenX !== "number" || typeof pointerEvent.screenY !== "number") {
      return null;
    }

    const scale = window.devicePixelRatio || 1;

    return {
      x: Math.round(pointerEvent.screenX * scale),
      y: Math.round(pointerEvent.screenY * scale),
    };
  }

  function isOutsideWindow(point: CursorPoint) {
    if (!windowBounds) {
      return false;
    }

    const padding = 10;
    return (
      point.x < windowBounds.x - padding ||
      point.x > windowBounds.x + windowBounds.width + padding ||
      point.y < windowBounds.y - padding ||
      point.y > windowBounds.y + windowBounds.height + padding
    );
  }

  function setActiveTab(tabId: string) {
    if (!tabsData.some((entry) => entry.id === tabId)) {
      return;
    }

    activeId = tabId;
    updateBodyFlags();
    scheduleLayout();
  }

  function closeAddMenu() {
    addMenuOpen = false;
  }

  function toggleAddMenu() {
    if (isSwitching) {
      return;
    }

    addMenuOpen = !addMenuOpen;
  }

  async function openTabFromRoute(route: string, overrides: Partial<TabPayload> = {}) {
    closeAddMenu();

    try {
      let tabId = "";

      if (isDesktop) {
        const moduleId = getRouteModuleId(route) ?? moduleFromPath(route);
        const tabInfo = await backendOpenTab(moduleId);
        if (tabInfo) {
          tabId = tabInfo.id;
        }
      }

      if (tabId) {
        const existingTab = tabsData.find((tab) => tab.id === tabId);
        if (existingTab) {
          await openTab(existingTab);
          return;
        }
      }

      const activeTab = tabsData.find((tab) => tab.id === activeId) ?? tabsData[0];
      const nextTab = createTab(route, {
        ...activeTab?.data,
        ...overrides,
        isPinned: false,
      });

      if (tabId) {
        nextTab.id = tabId;
      }

      tabsData = [...tabsData, nextTab];

      activeId = nextTab.id;
      updateBodyFlags();
      scheduleLayout();

      if (isDesktop) {
        const switched = await backendSwitchTab(nextTab.id);
        if (!switched) {
          throw new Error("Unable to switch tab.");
        }
      }

      if (browser && route && currentRoute() !== route) {
        await goto(route);
      }

      destroySortable();
      initSortable();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open tab.");
    }
  }

  async function openTab(tab: TabItem) {
    if (isSwitching) {
      return;
    }

    closeAddMenu();
    const previousActiveId = activeId;
    isSwitching = true;

    try {
      if (isDesktop) {
        const payload = await backendSwitchTab(tab.id);
        if (!payload) {
          throw new Error("Unable to switch tab.");
        }
      }

      activeId = tab.id;
      updateBodyFlags();
      scheduleLayout();

      if (browser && tab.data.route && currentRoute() !== tab.data.route) {
        await goto(tab.data.route);
      }
    } catch (error) {
      activeId = previousActiveId;
      updateBodyFlags();
      scheduleLayout();
      toast.error(error instanceof Error ? error.message : "Failed to switch tab.");
    } finally {
      isSwitching = false;
    }
  }

  async function closeTab(tabId: string) {
    if (isSwitching) {
      return;
    }

    closeAddMenu();
    resetTooltip();
    if (tabsData.length <= 1) {
      return;
    }

    const index = tabsData.findIndex((tab) => tab.id === tabId);
    if (index < 0) {
      return;
    }

    if (isDesktop) {
      try {
        const closed = await backendCloseTab(tabId);
        if (!closed) {
          throw new Error("Unable to close tab.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to close tab.");
        return;
      }
    }

    const nextTabs = tabsData.filter((tab) => tab.id !== tabId);
    tabsData = nextTabs;

    if (activeId === tabId) {
      const nextActive = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0];
      activeId = nextActive?.id ?? "";
    }

    if (!activeId && nextTabs[0]) {
      activeId = nextTabs[0].id;
    }

    if (tabsData.length === 0) {
      const fallback = createTab(currentRoute());
      tabsData = [fallback];
      activeId = fallback.id;
    }

    const nextActiveTab = tabsData.find((tab) => tab.id === activeId) ?? tabsData[0];
    if (browser && nextActiveTab?.data.route && currentRoute() !== nextActiveTab.data.route) {
      await goto(nextActiveTab.data.route);
    }

    destroySortable();
    initSortable();
    updateBodyFlags();
    scheduleLayout();
  }

  async function detachTab(tab: TabItem, cursor: CursorPoint) {
    const routeUrl = new URL(tab.data.route || currentRoute(), window.location.href).toString();

    if (!isDesktop) {
      window.open(routeUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const label = `tab-${tab.id}-${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9\-/:_]/g, "-");
    const x = Math.max(0, cursor.x - 240);
    const y = Math.max(0, cursor.y - 120);

    try {
      const detachedWindow = new WebviewWindow(label, {
        url: routeUrl,
        title: tab.data.title,
        width: 1280,
        height: 800,
        x,
        y,
        decorations: false,
      });

      void detachedWindow.once("tauri://error", () => {
        toast.error("Failed to open detached tab.");
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open detached tab.");
      return;
    }

    tabsData = tabsData.filter((entry) => entry.id !== tab.id);

    if (activeId === tab.id) {
      const nextActive = tabsData[Math.max(0, tabsData.length - 1)];
      activeId = nextActive?.id ?? "";
    }

    if (tabsData.length === 0) {
      const fallback = createTab(currentRoute());
      tabsData = [fallback];
      activeId = fallback.id;
    }

    destroySortable();
    initSortable();
    updateBodyFlags();
    scheduleLayout();
  }

  // ── Tooltip state (Anytype 1:1: tab bar dispatches events with visible flag + short delay) ──

  let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
  let tooltipHideTimeout: ReturnType<typeof setTimeout> | null = null;
  let isContextMenuOpen = $state(false);
  let tooltipVisible = $state(false);
  const TOOLTIP_DELAY = 650;
  const TOOLTIP_DELAY_SHORT = 50;

  function resetTooltip() {
    if (tooltipTimeout !== null) clearTimeout(tooltipTimeout);
    if (tooltipHideTimeout !== null) clearTimeout(tooltipHideTimeout);
    tooltipTimeout = null;
    tooltipHideTimeout = null;
    tooltipVisible = false;
    window.dispatchEvent(new CustomEvent("genesis:tab:tooltip-hide"));
  }

  // ── Context menu: Anytype-style IPC dispatch ──

  function handleTabContextMenu(tabId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    resetTooltip();
    isContextMenuOpen = true;
    const tab = tabsData.find((t) => t.id === tabId);
    if (!tab) return;
    window.dispatchEvent(new CustomEvent("genesis:tab:context-menu", {
      detail: {
        tabId: tab.id,
        isPinned: Boolean(tab.data.isPinned),
        clientX: event.clientX,
        clientY: event.clientY,
      },
    }));
  }

  function handleContextMenuClosed() {
    isContextMenuOpen = false;
  }

  // ── Cursor polling for drag-outside-window detection ──

  function startCursorPolling() {
    if (!isDesktop) return;
    stopCursorPolling();
    cursorPollInterval = setInterval(async () => {
      try {
        const pos = await invoke<{ x: number; y: number }>("get_cursor_screen_position");
        lastCursorPos = pos;
        if (windowBounds) {
          const isOutside =
            pos.x < windowBounds.x - 10 ||
            pos.x > windowBounds.x + windowBounds.width + 10 ||
            pos.y < windowBounds.y - 10 ||
            pos.y > windowBounds.y + windowBounds.height + 10;
          document.body.classList.toggle("draggingOutside", isOutside);
        }
      } catch {
        // Cursor polling best-effort; fall back to pointer events
      }
    }, CURSOR_POLL_MS);
  }

  function stopCursorPolling() {
    if (cursorPollInterval !== null) {
      clearInterval(cursorPollInterval);
      cursorPollInterval = null;
    }
  }

  // ── Dimmer overlay (Anytype-style: add/remove showDimmer class on body) ──

  function handleDimmerShow() {
    document.body.classList.add("showDimmer");
  }

  function handleDimmerHide() {
    document.body.classList.remove("showDimmer");
  }

  function handleNewTabEvent() {
    toggleAddMenu();
  }

  function handleWindowResize() {
    if (!browser) {
      return;
    }

    scheduleLayout();

    if (isDesktop) {
      void refreshWindowBounds();
    }
  }

  function handleTabsScroll() {
    scheduleLayout();
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!addMenuOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (tabsWrapperElement?.contains(target) || addButtonElement?.contains(target)) {
      return;
    }

    closeAddMenu();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging) {
      return;
    }

    lastCursorPos = getCursorPoint(event);
    document.body.classList.toggle("draggingOutside", Boolean(lastCursorPos && isOutsideWindow(lastCursorPos)));
  }

  async function refreshWindowBounds() {
    if (!isDesktop) {
      return;
    }

    try {
      const currentWindow = getCurrentWebviewWindow();
      const [position, size] = await Promise.all([currentWindow.outerPosition(), currentWindow.outerSize()]);
      windowBounds = {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };
    } catch {
      windowBounds = null;
    }
  }

  function initSortable() {
    destroySortable();

    if (!tabsElement || tabsData.length < 2 || !sortableFactory) {
      return;
    }

    sortable = new sortableFactory(tabsElement, {
      animation: 150,
      easing: "ease-in-out",
      draggable: ".tab:not(.isAdd)",
      filter: ".icon.close",
      preventOnFilter: false,
      onMove: (evt: SortableEvent) => {
        const dragged = evt.dragged as HTMLElement | null;
        const related = evt.related as HTMLElement | null;
        const draggedPinned = dragged?.dataset.pinned === "true";
        const relatedPinned = related?.dataset.pinned === "true";

        if (draggedPinned !== relatedPinned) {
          return false;
        }

        return true;
      },
      onStart: async (evt: SortableEvent) => {
        isDragging = true;
        resetTooltip();
        draggedTabId = (evt.item as HTMLElement).dataset.id ?? null;
        draggedActiveId = draggedTabId === activeId ? activeId : null;
        updateBodyFlags();
        scheduleLayout();

        if (isDesktop) {
          await refreshWindowBounds();
          startCursorPolling();
        }
      },
      onChange: () => {
        scheduleLayout();
      },
      onEnd: async (evt: SortableEvent) => {
        stopCursorPolling();
        const tabId = draggedTabId;
        const tab = tabId ? tabsData.find((entry) => entry.id === tabId) : null;
        const cursor = getCursorPoint(evt.originalEvent) ?? lastCursorPos;
        const shouldDetach =
          Boolean(tab && tab.data.isPinned !== true && tabsData.length > 1 && cursor && windowBounds && isOutsideWindow(cursor));

        if (shouldDetach && tab && cursor) {
          await detachTab(tab, cursor);
        } else {
          syncTabsOrderFromDom();
        }

        isDragging = false;
        draggedTabId = null;
        draggedActiveId = null;
        windowBounds = null;
        lastCursorPos = null;
        document.body.classList.remove("draggingOutside");
        updateBodyFlags();
        scheduleLayout();
      },
    });
  }

  function restoreSessionOrFallback() {
    // Kick off async init — don't await inside onMount to avoid
    // type collision between async + cleanup function returns.
    (async () => {
      if (!browser) return;

      // Restore existing backend tabs first (desktop mode)
      if (isDesktop) {
        await initTabSession();
        const sessionTabs = getTabs();
        const sessionActiveId = getActiveTabId();

        if (sessionTabs.length > 0 && sessionActiveId) {
          tabsData = sessionTabs.map((t) => {
            const tab: TabItem = createTab(`/apps/${t.moduleId}`, {
              title: t.moduleId.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            });
            tab.id = t.id;
            return tab;
          });
          activeId = sessionActiveId;
          ready = true;
          updateBodyFlags();
          scheduleLayout();
          initSortable();
          const activeTab = tabsData.find((tab) => tab.id === activeId);
          if (browser && activeTab && activeTab.data.route && currentRoute() !== activeTab.data.route) {
            void goto(activeTab.data.route);
          }
          return;
        }
      }

      // Fallback: frontend-only init (web mode or no backend tabs)
      if (!ready) {
        loadTabs();
      }
    })().catch((e) => {
      // Fallback on error: frontend-only init
      if (!ready) loadTabs();
    });
  }

  onMount(() => {
    if (browser) {
      restoreSessionOrFallback();
      void refreshWindowBounds();
      void import("sortablejs").then((module) => {
        sortableFactory = module.default;
        // Always try init — safe: initSortable has internal guards
        // (checks tabsElement, tabsData.length, sortableFactory).
        // Ensures sortable inits even if loadTabs() ran before import resolved.
        initSortable();
        scheduleLayout();
      });

      window.addEventListener("resize", handleWindowResize);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerdown", handleWindowPointerDown, true);
      window.addEventListener("genesis:tabs:new", handleNewTabEvent as EventListener);
      window.addEventListener("genesis:dimmer:show", handleDimmerShow);
      window.addEventListener("genesis:dimmer:hide", handleDimmerHide);
      window.addEventListener("genesis:tab:context-menu-closed", handleContextMenuClosed);
      tabsElement?.addEventListener("scroll", handleTabsScroll);
    }

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handleWindowPointerDown, true);
      window.removeEventListener("genesis:tabs:new", handleNewTabEvent as EventListener);
      window.removeEventListener("genesis:dimmer:show", handleDimmerShow);
      window.removeEventListener("genesis:dimmer:hide", handleDimmerHide);
      window.removeEventListener("genesis:tab:context-menu-closed", handleContextMenuClosed);
      tabsElement?.removeEventListener("scroll", handleTabsScroll);
      destroySortable();
      stopCursorPolling();
      window.cancelAnimationFrame(layoutFrame);
      destroyTabSession();
    };
  });
</script><section class="window-tabs">
  <div bind:this={tabsWrapperElement} class:isHidden={isHidden} class="window-tabs__wrapper" id="tabsWrapper">
    <div id="tabsBackground" aria-hidden="true"></div>
    <div id="marker" aria-hidden="true"></div>

    <div bind:this={tabsElement} class:dropTarget={isDragging} id="tabs" role="tablist">
      {#each tabsData as tab, index (tab.id)}
        <div
          id={`tab-${tab.id}`}
          class:active={tab.id === activeId}
          class:hideDiv={index === activeIndex - 1 && activeIndex > 0}
          class:isPinned={Boolean(tab.data.isPinned)}
          class:noClose={tabsData.length === 1}
          class="tab"
          data-id={tab.id}
          data-pinned={String(Boolean(tab.data.isPinned))}
          role="tab"
          tabindex="0"
          aria-selected={tab.id === activeId}
          oncontextmenu={(e) => handleTabContextMenu(tab.id, e)}
          onmouseenter={() => {
            if (isDragging || isContextMenuOpen) return;
            if (tooltipTimeout !== null) clearTimeout(tooltipTimeout);
            if (tooltipHideTimeout !== null) clearTimeout(tooltipHideTimeout);
            const delay = tooltipVisible ? TOOLTIP_DELAY_SHORT : TOOLTIP_DELAY;
            tooltipTimeout = setTimeout(() => {
              tooltipVisible = true;
              window.dispatchEvent(new CustomEvent("genesis:tab:tooltip-show", {
                detail: {
                  tabId: tab.id,
                  title: tab.data.title || "New tab",
                  subtitle: tab.data.subtitle || "",
                  isPinned: Boolean(tab.data.isPinned),
                },
              }));
            }, delay);
          }}
          onmouseleave={() => {
            if (tooltipTimeout !== null) clearTimeout(tooltipTimeout);
            tooltipHideTimeout = setTimeout(() => {
              tooltipVisible = false;
              window.dispatchEvent(new CustomEvent("genesis:tab:tooltip-hide"));
            }, 100);
          }}
        >
          <div
            class="clickable"
            onclick={() => void openTab(tab)}
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void openTab(tab);
              }
            }}
            role="button"
            tabindex="0"
          >
            {#if tab.data.icon}
              <div class="iconWrapper">
                <div
                  class:isImage={Boolean(tab.data.isImage)}
                  class="icon object"
                  class:layout1={tab.data.layout === 1}
                  class:layout10={tab.data.layout === 10}
                  class:layout18={tab.data.layout === 18}
                  class:layout22={tab.data.layout === 22}
                  style={`background-image: url('${tab.data.icon}')`}
                ></div>
              </div>
            {/if}

            <div class="name">{tab.data.title || "New tab"}</div>

            <div
              aria-label={`Close ${tab.data.title || "tab"}`}
              class="icon close withBackground"
              role="button"
              tabindex="0"
              onclick={async (event) => {
                event.stopPropagation();
                await closeTab(tab.id);
              }}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                  void closeTab(tab.id);
                }
              }}
            ></div>
          </div>

          <div class="div"></div>
        </div>
      {/each}

      <div
        class="tab isAdd"
        bind:this={addButtonElement}
        onclick={toggleAddMenu}
        onkeydown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleAddMenu();
          }
        }}
        role="button"
        tabindex="0"
      >
        <div class="icon"></div>
      </div>
    </div>

    {#if addMenuOpen}
      <div class="tab-add-menu" role="menu" aria-label="Open another app tab">
        {#if availableStarterTabs.length > 0}
          {#each availableStarterTabs as entry}
            <button class="tab-add-menu__item" type="button" role="menuitem" onclick={() => void openTabFromRoute(entry.route, { title: entry.navLabel, subtitle: entry.subtitle })}>
              <span class="tab-add-menu__title">{entry.navLabel}</span>
            </button>
          {/each}
        {:else}
          <div class="tab-add-menu__empty">All app tabs are already open.</div>
        {/if}
      </div>
    {/if}
  </div>
</section>
