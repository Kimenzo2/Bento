<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "@mateothegreat/svelte5-router";
  import BarChart3Icon from "@lucide/svelte/icons/bar-chart-3";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import FolderOpenIcon from "@lucide/svelte/icons/folder-open";
  import ImageIcon from "@lucide/svelte/icons/image";
  import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
  import PackageIcon from "@lucide/svelte/icons/package";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TrophyIcon from "@lucide/svelte/icons/trophy";
  import UserIcon from "@lucide/svelte/icons/user";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "$lib/components/ui/tooltip/index.js";
  import { demoProjects } from "$lib/data/app-data";
  import { getStarterModuleEntry } from "$lib/data/module-catalog";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";
  import type { PageKey } from "$lib/router/routes";
  import { toggleSidebar, workspaceStore } from "$lib/stores/workspace.store";

  let {
    currentPage,
    activeAppId,
  }: {
    currentPage: PageKey;
    activeAppId?: string;
  } = $props();

  const navigationItems = [
    { key: "dashboard" as const, label: "Dashboard", path: "/", icon: LayoutDashboardIcon },
    { key: "project" as const, label: "Project View", path: `/project/${demoProjects[0].id}`, icon: FolderOpenIcon },
    { key: "lifeInColour" as const, label: "Asset Manager", path: "/life-in-colour", icon: SparklesIcon },
    { key: "editor" as const, label: "Canvas Editor", path: "/editor", icon: BookOpenIcon },
    { key: "visualStudio" as const, label: "Visual Studio", path: "/visual-studio", icon: ImageIcon },
    { key: "export" as const, label: "Export", path: "/export", icon: PackageIcon },
    { key: "infographics" as const, label: "Infographics", path: "/infographics", icon: BarChart3Icon },
    { key: "gamification" as const, label: "Rewards", path: "/gamification", icon: TrophyIcon },
    { key: "account" as const, label: "Account", path: "/account", icon: UserIcon },
    { key: "settings" as const, label: "Settings", path: "/settings", icon: SettingsIcon },
  ];

  const activeStarterApp = $derived(getStarterModuleEntry(activeAppId));

  const appNavIcons = [LayoutDashboardIcon, BookOpenIcon, BarChart3Icon, SparklesIcon, PackageIcon, SettingsIcon];

  const appNavigationItems = $derived(
    activeStarterApp?.sidebar
      ? activeStarterApp.sidebar.items.map((label, index) => ({
          label,
          icon: appNavIcons[index % appNavIcons.length],
        }))
      : []
  );

  const appSectionLabels = $derived(activeStarterApp?.sidebar?.items ?? []);
  const selectedAppSection = $derived(
    activeStarterApp ? getModuleSectionLabel($moduleSectionStore, activeStarterApp.id, appSectionLabels) : ""
  );

  const dragDots = Array.from({ length: 6 }, (_, index) => index);
  const SIDEBAR_TOP_STORAGE_KEY = "genesis_desktop_sidebar_top";
  const SIDEBAR_TOP_BOUND_PX = 54;
  const SIDEBAR_BOTTOM_GAP_PX = 12;

  type DragState = {
    startY: number;
    top: number;
  };

  let sidebarRef: HTMLElement | null = $state(null);
  let dragRef: DragState | null = null;
  let sidebarTop = $state<number | null>(null);
  let dragging = $state(false);
  let sidebarTopHydrated = false;
  let sidebarTopForResize: number | null = null;

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function readStoredSidebarTop() {
    if (!browser) return null;

    try {
      const raw = window.localStorage.getItem(SIDEBAR_TOP_STORAGE_KEY);
      if (raw === null) return null;

      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function persistSidebarTop(top: number | null) {
    if (!browser) return;

    try {
      if (top === null) {
        window.localStorage.removeItem(SIDEBAR_TOP_STORAGE_KEY);
      } else {
        window.localStorage.setItem(SIDEBAR_TOP_STORAGE_KEY, String(Math.round(top)));
      }
    } catch {
      // Sidebar position should still work if storage is unavailable.
    }
  }

  function clampSidebarTop(top: number) {
    const sidebar = sidebarRef;
    const minTop = SIDEBAR_TOP_BOUND_PX;
    if (!sidebar || !browser) return Math.max(top, minTop);
    const maxTop = Math.max(minTop, window.innerHeight - sidebar.offsetHeight - SIDEBAR_BOTTOM_GAP_PX);
    return clamp(top, minTop, maxTop);
  }

  function snapSidebarTop(top: number) {
    const sidebar = sidebarRef;
    const minTop = SIDEBAR_TOP_BOUND_PX;
    if (!sidebar) return clampSidebarTop(top);
    const maxTop = Math.max(minTop, window.innerHeight - sidebar.offsetHeight - SIDEBAR_BOTTOM_GAP_PX);
    const middleTop = minTop + Math.max(0, (maxTop - minTop) / 2);
    const clampedTop = clamp(top, minTop, maxTop);
    const snapPoints = [minTop, middleTop, maxTop].map((value) => Math.round(value));
    return snapPoints.reduce((closest, value) =>
      Math.abs(value - clampedTop) < Math.abs(closest - clampedTop) ? value : closest
    );
  }

  $effect(() => {
    if (activeStarterApp) {
      ensureModuleSection(activeStarterApp.id, appSectionLabels);
    }
  });

  $effect(() => {
    if (!browser || !sidebarRef || sidebarTopHydrated) return;
    sidebarTopHydrated = true;

    const storedTop = readStoredSidebarTop();
    if (storedTop === null) return;

    sidebarTop = clampSidebarTop(storedTop);
  });

  $effect(() => {
    sidebarTopForResize = sidebarTop;
  });

  $effect(() => {
    if (!browser) return;
    const onResize = () => {
      if (sidebarTopForResize === null) return;

      const nextTop = clampSidebarTop(sidebarTopForResize);
      if (nextTop !== sidebarTopForResize) {
        sidebarTop = nextTop;
        persistSidebarTop(nextTop);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  $effect(() => {
    if (!browser || !sidebarRef || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (sidebarTopForResize === null) return;

      const nextTop = clampSidebarTop(sidebarTopForResize);
      if (nextTop !== sidebarTopForResize) {
        sidebarTop = nextTop;
        persistSidebarTop(nextTop);
      }
    });

    observer.observe(sidebarRef);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!browser || !dragging) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef;
      if (!drag) return;
      sidebarTop = clampSidebarTop(drag.top + event.clientY - drag.startY);
    };

    const stopDragging = () => {
      dragRef = null;
      sidebarTop = sidebarTop === null ? sidebarTop : snapSidebarTop(sidebarTop);
      if (sidebarTop !== null) {
        persistSidebarTop(sidebarTop);
      }
      dragging = false;
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", stopDragging, true);
    window.addEventListener("pointercancel", stopDragging, true);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", stopDragging, true);
      window.removeEventListener("pointercancel", stopDragging, true);
    };
  });

  const navigateTo = (path: string) => goto(path);

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerTarget = event.currentTarget;
    if (pointerTarget instanceof HTMLElement) {
      try {
        pointerTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; window listeners still keep the drag alive.
      }
    }
    const sidebar = sidebarRef;
    const currentTop = clampSidebarTop(
      sidebarTop ?? sidebar?.getBoundingClientRect().top ?? SIDEBAR_TOP_BOUND_PX
    );
    sidebarTop = currentTop;
    dragRef = {
      startY: event.clientY,
      top: currentTop,
    };
    dragging = true;
  }
</script>

<aside
  bind:this={sidebarRef}
  class:sidebar-collapsed={$workspaceStore.sidebarCollapsed}
  class="desktop-sidebar desktop-sidebar--draggable"
  style:top={sidebarTop === null ? undefined : `${Math.round(sidebarTop)}px`}
  style:bottom={sidebarTop === null ? undefined : "auto"}
>
  <TooltipProvider delayDuration={0}>
    <button
      type="button"
      class="desktop-sidebar__drag-handle"
      title="Move sidebar"
      aria-label="Move sidebar"
      onclick={(event) => event.preventDefault()}
      onpointerdown={handlePointerDown}
      style="touch-action: none;"
    >
      <span class="desktop-sidebar__drag-grip" aria-hidden="true">
        {#each dragDots as dot}
          <span class="desktop-sidebar__drag-dot"></span>
        {/each}
      </span>
    </button>

    <div class="desktop-sidebar__header">
      <button aria-label="Go to Genesis dashboard" class="desktop-sidebar__brand" type="button" onclick={() => goto("/")}>
        <span class="font-[var(--font-heading)] text-xl font-semibold">Genesis</span>
      </button>
      <Tooltip>
        <TooltipTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="rounded-full"
              size="icon-sm"
              variant="ghost"
              aria-label={ $workspaceStore.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar" }
              onclick={toggleSidebar}
            >
              <LayoutDashboardIcon />
            </Button>
          {/snippet}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {#if $workspaceStore.sidebarCollapsed}
            Expand sidebar
          {:else}
            Collapse sidebar
          {/if}
        </TooltipContent>
      </Tooltip>
    </div>

    <nav class="desktop-sidebar__nav" aria-label="Genesis navigation">
      {#if activeStarterApp}
        {#if !$workspaceStore.sidebarCollapsed}
          <p class="desktop-sidebar__section-label">{activeStarterApp.sidebar?.sectionLabel ?? activeStarterApp.navLabel}</p>
        {/if}

        {#each appNavigationItems as item, index}
          {#if $workspaceStore.sidebarCollapsed}
            <Tooltip>
              <TooltipTrigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    class:desktop-sidebar__nav-item--active={item.label === selectedAppSection}
                    class="desktop-sidebar__nav-item desktop-sidebar__nav-item--app"
                    aria-label={item.label}
                    type="button"
                    onclick={() => activeStarterApp && setModuleSection(activeStarterApp.id, item.label, appSectionLabels)}
                  >
                    <item.icon />
                  </button>
                {/snippet}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
            </Tooltip>
          {:else}
            <button
              class:desktop-sidebar__nav-item--active={item.label === selectedAppSection}
              class="desktop-sidebar__nav-item desktop-sidebar__nav-item--app"
              aria-label={item.label}
              type="button"
              onclick={() => activeStarterApp && setModuleSection(activeStarterApp.id, item.label, appSectionLabels)}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          {/if}
        {/each}

      {:else}
        {#if !$workspaceStore.sidebarCollapsed}
          <p class="desktop-sidebar__section-label">Core</p>
        {/if}
        {#each navigationItems as item}
          {#if $workspaceStore.sidebarCollapsed}
            <Tooltip>
              <TooltipTrigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    class:desktop-sidebar__nav-item--active={currentPage === item.key}
                    class="desktop-sidebar__nav-item"
                    aria-label={item.label}
                    type="button"
                    onclick={() => navigateTo(item.path)}
                  >
                    <item.icon />
                  </button>
                {/snippet}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
            </Tooltip>
          {:else}
            <button
              class:desktop-sidebar__nav-item--active={currentPage === item.key}
              class="desktop-sidebar__nav-item"
              aria-label={item.label}
              type="button"
              onclick={() => navigateTo(item.path)}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          {/if}
        {/each}
      {/if}
    </nav>
  </TooltipProvider>
</aside>

<style>
  .desktop-sidebar--draggable {
    overflow: visible;
  }

  .desktop-sidebar__drag-handle {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    margin: 0 auto 0.35rem;
    border: 1px solid color-mix(in srgb, var(--border) 58%, transparent);
    border-radius: 9999px;
    background: color-mix(in srgb, var(--background) 54%, transparent);
    color: color-mix(in srgb, var(--foreground) 58%, var(--muted));
    cursor: grab;
    transition:
      transform 180ms ease,
      background 180ms ease,
      color 180ms ease,
      border-color 180ms ease;
  }

  .desktop-sidebar__drag-handle:hover,
  .desktop-sidebar__drag-handle:focus-visible {
    border-color: color-mix(in srgb, var(--border) 88%, transparent);
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    color: var(--foreground);
    outline: none;
  }

  .desktop-sidebar__drag-handle:active {
    cursor: grabbing;
    transform: translateY(1px) scale(0.98);
  }

  .desktop-sidebar__drag-grip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.14rem;
  }

  .desktop-sidebar__drag-dot {
    width: 0.23rem;
    height: 0.23rem;
    border-radius: 9999px;
    background: currentColor;
  }
</style>
