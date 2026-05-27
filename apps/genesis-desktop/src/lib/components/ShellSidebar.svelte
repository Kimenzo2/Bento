<script lang="ts">
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
  import SidebarToggleIcon from "$lib/components/anytype-icons/SidebarToggleIcon.svelte";
  import { demoProjects } from "$lib/data/app-data";
  import { getStarterModuleEntry } from "$lib/data/module-catalog";
  import { ensureModuleSection, getModuleSectionLabel, moduleSectionStore, setModuleSection } from "$lib/stores/module-sections.store";
  import type { PageKey } from "$lib/router/routes";
  import {
    persistSidebarTop,
    setSidebarTop,
    toggleSidebar,
    workspaceStore,
  } from "$lib/stores/workspace.store";
  import { desktopSettings } from "$lib/desktop/settings";
  import { activeBundle, createTranslator } from "$lib/i18n";

  // Reactive translation helper
  let _t = $derived.by(() => createTranslator($activeBundle));

  let {
    currentPage,
    activeAppId,
  }: {
    currentPage: PageKey;
    activeAppId?: string;
  } = $props();

  const navigationItems = $derived([
    { key: "dashboard" as const, label: _t('navDashboard'), path: "/", icon: LayoutDashboardIcon },
    { key: "project" as const, label: _t('navProjectView'), path: `/project/${demoProjects[0].id}`, icon: FolderOpenIcon },
    { key: "lifeInColour" as const, label: _t('navAssetManager'), path: "/life-in-colour", icon: SparklesIcon },
    { key: "notes" as const, label: "Notes", path: "/notes", icon: BookOpenIcon },
    { key: "visualStudio" as const, label: _t('navVisualStudio'), path: "/visual-studio", icon: ImageIcon },
    { key: "export" as const, label: _t('navExport'), path: "/export", icon: PackageIcon },
    { key: "infographics" as const, label: _t('navInfographics'), path: "/infographics", icon: BarChart3Icon },
    { key: "gamification" as const, label: _t('navRewards'), path: "/gamification", icon: TrophyIcon },
    { key: "account" as const, label: _t('navAccount'), path: "/account", icon: UserIcon },
    { key: "settings" as const, label: _t('navSettings'), path: "/settings", icon: SettingsIcon },
  ]);

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

  // ── Consciousness: sidebar height is now fit-content in CSS ──────────────
  // No JS height calculation needed — the browser measures the content naturally.
  // We only need navCount to keep getSidebarMaxTop() accurate for drag clamping.

  const navCount = $derived(
    activeStarterApp ? appNavigationItems.length : navigationItems.length
  );

  // ── Drag: moves sidebar up/down, never resizes ─────────────────────────────
  //
  // sidebarMinTop must account for the tab bar when tabs are enabled.
  //   - No tabs:   36px window chrome only  → minTop = 54px  (original)
  //   - Tabs on:   36px chrome + 36px tabs  → minTop = 90px
  //
  // This prevents the sidebar from ever sliding up into / behind the tab bar.
  const TAB_BAR_HEIGHT   = 36;
  const BASE_MIN_TOP     = 54;
  const sidebarBottomGap = 12;
  const sidebarSnapThreshold = 8;

  const sidebarMinTop = $derived(
    $desktopSettings.workspace.tabsEnabled
      ? BASE_MIN_TOP + TAB_BAR_HEIGHT   // 90px when tabs visible
      : BASE_MIN_TOP                     // 54px when no tabs
  );

  // Whenever tabs are toggled ON, if the persisted top is below the new
  // minimum, push it up immediately so the sidebar never overlaps the tab bar.
  $effect(() => {
    const minTop = sidebarMinTop;
    if ($workspaceStore.sidebarTop < minTop) {
      setSidebarTop(minTop);
      persistSidebarTop(minTop);
    }
  });

  type SidebarDragState = {
    startY: number;
    top: number;
    pointerId: number;
    moved: boolean;
  };

  let sidebarDrag = $state<SidebarDragState | null>(null);

  function getSidebarMaxTop() {
    if (typeof window === "undefined") return sidebarMinTop;
    const sidebar = document.querySelector<HTMLElement>(".desktop-sidebar");
    const h = sidebar ? sidebar.offsetHeight : 300;
    return Math.max(sidebarMinTop, window.innerHeight - h - sidebarBottomGap);
  }

  function clampSidebarTop(nextTop: number) {
    return Math.max(sidebarMinTop, Math.min(getSidebarMaxTop(), Math.round(nextTop)));
  }

  function finishSidebarDrag(nextTop: number) {
    const clampedTop = clampSidebarTop(nextTop);
    const maxTop     = getSidebarMaxTop();
    const middleTop  = sidebarMinTop + Math.max(0, (maxTop - sidebarMinTop) / 2);
    const snapPoints = [sidebarMinTop, middleTop, maxTop].map((v) => Math.round(v));
    const snappedTop =
      Math.abs(clampedTop - sidebarMinTop) <= sidebarSnapThreshold
        ? sidebarMinTop
        : snapPoints.reduce((closest, val) =>
            Math.abs(val - clampedTop) < Math.abs(closest - clampedTop) ? val : closest
          );
    setSidebarTop(snappedTop);
    persistSidebarTop(snappedTop);
  }

  function beginSidebarDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    sidebarDrag = {
      startY: event.clientY,
      top: $workspaceStore.sidebarTop,
      pointerId: event.pointerId,
      moved: false,
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor     = document.body.style.cursor;
    document.body.classList.add("sidebar-dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor     = "grabbing";

    const onPointerMove = (e: PointerEvent) => {
      if (!sidebarDrag || e.pointerId !== sidebarDrag.pointerId) return;
      const deltaY = e.clientY - sidebarDrag.startY;
      if (!sidebarDrag.moved && Math.abs(deltaY) > 4) {
        sidebarDrag = { ...sidebarDrag, moved: true };
      }
      setSidebarTop(clampSidebarTop(sidebarDrag.top + deltaY));
    };

    const stopDragging = (e: PointerEvent) => {
      if (!sidebarDrag || e.pointerId !== sidebarDrag.pointerId) return;
      finishSidebarDrag(sidebarDrag.top + (e.clientY - sidebarDrag.startY));
      sidebarDrag = null;
      document.body.classList.remove("sidebar-dragging");
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor     = previousCursor;
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup",   stopDragging,  true);
      window.removeEventListener("pointercancel", stopDragging, true);
    };

    window.addEventListener("pointermove",   onPointerMove, true);
    window.addEventListener("pointerup",     stopDragging,  true);
    window.addEventListener("pointercancel", stopDragging,  true);
  }

  $effect(() => {
    if (activeStarterApp) {
      ensureModuleSection(activeStarterApp.id, appSectionLabels);
    }
  });

  const navigateTo = (path: string) => goto(path);
</script>

<aside
  class:desktop-sidebar--hidden={$workspaceStore.sidebarHidden}
  class:sidebar-collapsed={$workspaceStore.sidebarCollapsed}
  class="desktop-sidebar"
  style={`--desktop-sidebar-top:${$workspaceStore.sidebarTop}px`}
>
  <TooltipProvider delayDuration={0}>
    <button
      aria-label="Move sidebar"
      class="desktop-sidebar__move-handle"
      title="Drag to reposition sidebar"
      type="button"
      onpointerdown={beginSidebarDrag}
    >
      <span class="desktop-sidebar__move-handle-dots" aria-hidden="true">
        {#each Array.from({ length: 6 }) as _}
          <span></span>
        {/each}
      </span>
    </button>

    <div class="desktop-sidebar__header">
      <button aria-label={_t('navGoToDashboard')} class="desktop-sidebar__brand" type="button" onclick={() => goto("/")}>
        <span class="font-[var(--font-heading)] text-xl font-semibold">Bento</span>
      </button>
      <Tooltip>
        <TooltipTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="rounded-full"
              size="icon-sm"
              variant="ghost"
              aria-label={$workspaceStore.sidebarCollapsed ? _t('navExpandSidebar') : _t('navCollapseSidebar')}
              onclick={toggleSidebar}
            >
              <SidebarToggleIcon />
            </Button>
          {/snippet}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {#if $workspaceStore.sidebarCollapsed}
            {_t('navExpandSidebar')}
          {:else}
            {_t('navCollapseSidebar')}
          {/if}
        </TooltipContent>
      </Tooltip>
    </div>

    <nav class="desktop-sidebar__nav" aria-label="Bento navigation">
      {#if activeStarterApp}
        {#if !$workspaceStore.sidebarCollapsed}
          <p class="desktop-sidebar__section-label">{activeStarterApp.sidebar?.sectionLabel ?? activeStarterApp.navLabel}</p>
        {/if}

        {#each appNavigationItems as item}
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
          <p class="desktop-sidebar__section-label">{_t('navSectionCore')}</p>
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
