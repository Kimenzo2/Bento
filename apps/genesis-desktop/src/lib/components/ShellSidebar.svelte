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
  import { toggleAgentPanel, agentPanelOpen } from "$lib/stores/agent-panel.store";
  import TasksRecurringPanel from "$lib/components/tasks/TasksRecurringPanel.svelte";
  import TasksTagsPanel from "$lib/components/tasks/TasksTagsPanel.svelte";
  import TasksViewsPanel from "$lib/components/tasks/TasksViewsPanel.svelte";
  import TasksActivityPanel from "$lib/components/tasks/TasksActivityPanel.svelte";
  import TasksSearchPanel from "$lib/components/tasks/TasksSearchPanel.svelte";
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

  /** Map of icon name strings → Lucide Svelte components for sidebar nav items */
  import HistoryIcon from "@lucide/svelte/icons/history";
  import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
  import Grid3X3Icon from "@lucide/svelte/icons/grid-3x3";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import SearchIcon from "@lucide/svelte/icons/search";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import AlarmClockIcon from "@lucide/svelte/icons/alarm-clock";
  import ArrowRightLeftIcon from "@lucide/svelte/icons/arrow-right-left";
  import BanIcon from "@lucide/svelte/icons/ban";
  import BellIcon from "@lucide/svelte/icons/bell";
  import BookHeartIcon from "@lucide/svelte/icons/book-heart";
  import BookOpenTextIcon from "@lucide/svelte/icons/book-open-text";
  import BookmarkIcon from "@lucide/svelte/icons/bookmark";
  import BotIcon from "@lucide/svelte/icons/bot";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import CakeIcon from "@lucide/svelte/icons/cake";
  import CalendarCheckIcon from "@lucide/svelte/icons/calendar-check";
  import ChartLineIcon from "@lucide/svelte/icons/chart-line";
  import Clock4Icon from "@lucide/svelte/icons/clock-4";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
  import CompassIcon from "@lucide/svelte/icons/compass";
  import CookingPotIcon from "@lucide/svelte/icons/cooking-pot";
  import DropletsIcon from "@lucide/svelte/icons/droplets";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import FlagIcon from "@lucide/svelte/icons/flag";
  import FlameIcon from "@lucide/svelte/icons/flame";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import GaugeIcon from "@lucide/svelte/icons/gauge";
  import HeartIcon from "@lucide/svelte/icons/heart";
  import HighlighterIcon from "@lucide/svelte/icons/highlighter";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import ListIcon from "@lucide/svelte/icons/list";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import MusicIcon from "@lucide/svelte/icons/music";
  import PieChartIcon from "@lucide/svelte/icons/pie-chart";
  import PillIcon from "@lucide/svelte/icons/pill";
  import PinIcon from "@lucide/svelte/icons/pin";
  import PlaneIcon from "@lucide/svelte/icons/plane";
  import ReceiptIcon from "@lucide/svelte/icons/receipt";
  import ScissorsIcon from "@lucide/svelte/icons/scissors";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
  import SmilePlusIcon from "@lucide/svelte/icons/smile-plus";
  import TagIcon from "@lucide/svelte/icons/tag";
  import TargetIcon from "@lucide/svelte/icons/target";
  import TimelineIcon from "@lucide/svelte/icons/timeline";
  import TimerIcon from "@lucide/svelte/icons/timer";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import UsersIcon from "@lucide/svelte/icons/users";
  import UtensilsCrossedIcon from "@lucide/svelte/icons/utensils-crossed";
  import WalletIcon from "@lucide/svelte/icons/wallet";
  import WindIcon from "@lucide/svelte/icons/wind";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import CheckSquareIcon from "@lucide/svelte/icons/check-square";
  import InboxIcon from "@lucide/svelte/icons/inbox";
  import Repeat2Icon from "@lucide/svelte/icons/repeat-2";
  import TagsIcon from "@lucide/svelte/icons/tags";

  const sidebarIconMap: Record<string, typeof LayoutDashboardIcon> = {
    'activity': ActivityIcon,
    'alarm-clock': AlarmClockIcon,
    'arrow-right-left': ArrowRightLeftIcon,
    'ban': BanIcon,
    'bell': BellIcon,
    'book-heart': BookHeartIcon,
    'book-open': BookOpenIcon,
    'book-open-text': BookOpenTextIcon,
    'bookmark': BookmarkIcon,
    'bot': BotIcon,
    'brain': BrainIcon,
    'cake': CakeIcon,
    'calendar-check': CalendarCheckIcon,
    'calendar-days': CalendarDaysIcon,
    'chart-line': ChartLineIcon,
    'clock': ClockIcon,
    'clock-4': Clock4Icon,
    'clipboard-list': ClipboardListIcon,
    'compass': CompassIcon,
    'cooking-pot': CookingPotIcon,
    'download': DownloadIcon,
    'droplets': DropletsIcon,
    'eye': EyeIcon,
    'file-text': FileTextIcon,
    'flag': FlagIcon,
    'flame': FlameIcon,
    'folder': FolderIcon,
    'folder-open': FolderOpenIcon,
    'gauge': GaugeIcon,
    'grid-3x3': Grid3X3Icon,
    'heart': HeartIcon,
    'highlighter': HighlighterIcon,
    'history': HistoryIcon,
    'image': ImageIcon,
    'key-round': KeyRoundIcon,
    'layers': LayersIcon,
    'layout-dashboard': LayoutDashboardIcon,
    'layout-grid': LayoutGridIcon,
    'list': ListIcon,
    'list-checks': ListChecksIcon,
    'message-circle': MessageCircleIcon,
    'mic': MicIcon,
    'moon': MoonIcon,
    'music': MusicIcon,
    'pie-chart': PieChartIcon,
    'pill': PillIcon,
    'pin': PinIcon,
    'plane': PlaneIcon,
    'receipt': ReceiptIcon,
    'scissors': ScissorsIcon,
    'search': SearchIcon,
    'settings': SettingsIcon,
    'shield': ShieldIcon,
    'shield-check': ShieldCheckIcon,
    'shopping-cart': ShoppingCartIcon,
    'smile-plus': SmilePlusIcon,
    'sparkles': SparklesIcon,
    'tag': TagIcon,
    'target': TargetIcon,
    'timer': TimerIcon,
    'timeline': TimelineIcon,
    'trending-up': TrendingUpIcon,
    'upload': UploadIcon,
    'users': UsersIcon,
    'utensils-crossed': UtensilsCrossedIcon,
    'wallet': WalletIcon,
    'wind': WindIcon,
    'zap': ZapIcon,
    'alert-circle': AlertCircleIcon,
    'archive': ArchiveIcon,
    'check-square': CheckSquareIcon,
    'inbox': InboxIcon,
    'repeat-2': Repeat2Icon,
    'tags': TagsIcon,
  };

  const fallbackSidebarIcon = LayoutDashboardIcon;
  const legacyFallbackIcons = [LayoutDashboardIcon, BookOpenIcon, BarChart3Icon, SparklesIcon, PackageIcon, SettingsIcon];

  // ── Flyout panel state (Avnac-style) ──
  let flyoutPanel = $state<{ moduleId: string; item: { label: string; icon: typeof LayoutDashboardIcon } } | null>(null);
  let flyoutTargetTop = $state(0);

  function closeFlyout() {
    flyoutPanel = null;
  }

  function openFlyout(moduleId: string, item: { label: string; icon: typeof LayoutDashboardIcon }, event: Event) {
    // Avnac-style: clicking always opens/swaps the panel. Panel aligns to the icon's Y position.
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    flyoutTargetTop = rect.top;
    flyoutPanel = { moduleId, item };
  }

  function handleFlyoutNavigate(taskId: string) {
    closeFlyout();
    window.dispatchEvent(new CustomEvent('bento:tasks-navigate', { detail: { taskId } }));
  }

  /**
   * Derive nav items with per-app icons. Handles both:
   * - Plain strings (legacy) → cycles through fallback icons
   * - Objects with `label` + `icon` → uses the specified icon
   */
  const appNavigationItems = $derived(
    activeStarterApp?.sidebar
      ? activeStarterApp.sidebar.items.map((item, index) => {
          if (typeof item === 'string') {
            // Legacy format: cycle through fallback icons
            return { label: item, icon: legacyFallbackIcons[index % legacyFallbackIcons.length] };
          }
          // New format: use the specified icon from the map
          return {
            label: item.label,
            icon: sidebarIconMap[item.icon] ?? fallbackSidebarIcon,
            action: item.action,
          };
        })
      : []
  );

  /** Extract just the label strings for the module-sections store.
   *  Items with `action: 'flyout'` are excluded since they don't set sections. */
  const appSectionLabels = $derived(
    activeStarterApp?.sidebar
      ? activeStarterApp.sidebar.items
          .filter((item) => typeof item === 'string' || item.action !== 'flyout')
          .map((item) =>
              typeof item === 'string' ? item : item.label
            )
      : []
  );
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

  // Track sidebar element width so flyout panels can position correctly
  let sidebarEl = $state<HTMLElement | null>(null);

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
  style={`--desktop-sidebar-top:${$workspaceStore.sidebarTop}px;--desktop-sidebar-width:${$workspaceStore.sidebarWidth}px`}
  bind:this={sidebarEl}
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
        <span class="font-[var(--font-heading)] text-xl" style="font-family: 'Biscotti', var(--font-heading), system-ui, sans-serif; font-weight: 400;">Bento</span>
      </button>
      <Tooltip>
        <TooltipTrigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="rounded-full"
              size="icon-sm"
              variant="ghost"
              aria-label={$agentPanelOpen ? 'Close agent panel' : 'Open agent panel'}
              onclick={toggleAgentPanel}
            >
              <BotIcon size={16} />
            </Button>
          {/snippet}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {$agentPanelOpen ? 'Close agent' : 'Open agent'}
        </TooltipContent>
      </Tooltip>
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
          {const isFlyout = item.action === 'flyout'}
          {const isActive = isFlyout ? flyoutPanel?.item.label === item.label : item.label === selectedAppSection}
          {#if $workspaceStore.sidebarCollapsed}
            <Tooltip>
              <TooltipTrigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    class:desktop-sidebar__nav-item--active={isActive}
                    class="desktop-sidebar__nav-item desktop-sidebar__nav-item--app"
                    class:desktop-sidebar__nav-item--flyout={isFlyout}
                    aria-label={item.label}
                    type="button"                      onclick={(e) => {
                      if (isFlyout && activeStarterApp) {
                        openFlyout(activeStarterApp.id, item, e);
                      } else if (activeStarterApp) {
                        setModuleSection(activeStarterApp.id, item.label, appSectionLabels);
                      }
                    }}
                  >
                    <item.icon />
                  </button>
                {/snippet}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
            </Tooltip>
          {:else}
            <button
              class:desktop-sidebar__nav-item--active={isActive}
              class="desktop-sidebar__nav-item desktop-sidebar__nav-item--app"
              class:desktop-sidebar__nav-item--flyout={isFlyout}
              aria-label={item.label}
              type="button"
              onclick={(e) => {
                if (isFlyout && activeStarterApp) {
                  openFlyout(activeStarterApp.id, item, e);
                } else if (activeStarterApp) {
                  setModuleSection(activeStarterApp.id, item.label, appSectionLabels);
                }
              }}
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

<!-- ─── FLYOUT PANELS (Avnac-style) ─── -->
{#if flyoutPanel && flyoutPanel.moduleId === 'tasks'}
  <div
    style={`--sidebar-actual-width:${sidebarEl?.offsetWidth ?? 240}px; --flyout-target-top:${flyoutTargetTop}px`}
  >
    {#if flyoutPanel.item.label === 'Recurring'}
      <TasksRecurringPanel open={true} onClose={closeFlyout} />
    {:else if flyoutPanel.item.label === 'Tags'}
      <TasksTagsPanel open={true} onClose={closeFlyout} />
    {:else if flyoutPanel.item.label === 'Views'}
      <TasksViewsPanel open={true} onClose={closeFlyout} />
    {:else if flyoutPanel.item.label === 'History'}
      <TasksActivityPanel open={true} onClose={closeFlyout} onNavigate={handleFlyoutNavigate} />
    {:else if flyoutPanel.item.label === 'Search'}
      <TasksSearchPanel open={true} onClose={closeFlyout} onNavigate={handleFlyoutNavigate} />
    {/if}
  </div>
{/if}
