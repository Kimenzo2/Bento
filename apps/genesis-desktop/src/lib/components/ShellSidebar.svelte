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

  $effect(() => {
    if (activeStarterApp) {
      ensureModuleSection(activeStarterApp.id, appSectionLabels);
    }
  });

  const navigateTo = (path: string) => goto(path);
</script>

<aside class:sidebar-collapsed={$workspaceStore.sidebarCollapsed} class="desktop-sidebar">
  <TooltipProvider delayDuration={0}>
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
