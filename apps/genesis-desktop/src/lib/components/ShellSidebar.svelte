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
  import { demoProjects } from "$lib/data/app-data";
  import type { PageKey } from "$lib/router/routes";
  import { toggleSidebar, workspaceStore } from "$lib/stores/workspace.store";

  let {
    currentPage,
  }: {
    currentPage: PageKey;
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

  const navigateTo = (path: string) => goto(path);
</script>

<aside class:sidebar-collapsed={$workspaceStore.sidebarCollapsed} class="desktop-sidebar">
  <div class="desktop-sidebar__header">
    <button class="desktop-sidebar__brand" type="button" onclick={() => goto("/")}>
      <span class="desktop-sidebar__brand-mark"></span>
      {#if !$workspaceStore.sidebarCollapsed}
        <span class="font-[var(--font-heading)] text-xl font-semibold">Genesis</span>
      {/if}
    </button>
    <Button class="rounded-full" size="icon-sm" variant="ghost" onclick={toggleSidebar}>
      <LayoutDashboardIcon />
    </Button>
  </div>

  <nav class="desktop-sidebar__nav">
    {#each navigationItems as item}
      <button
        class:desktop-sidebar__nav-item--active={currentPage === item.key}
        class="desktop-sidebar__nav-item"
        type="button"
        onclick={() => navigateTo(item.path)}
      >
        <item.icon />
        {#if !$workspaceStore.sidebarCollapsed}
          <span>{item.label}</span>
        {/if}
      </button>
    {/each}
  </nav>
</aside>
