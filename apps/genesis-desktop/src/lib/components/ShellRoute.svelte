<script lang="ts">
  import type { Component } from "svelte";
  import type { RouteResult } from "@mateothegreat/svelte5-router";
  import ShellLayout from "$lib/components/ShellLayout.svelte";
  import type { PageKey } from "$lib/router/routes";
  import DashboardPage from "../../routes/pages/DashboardPage.svelte";
  import EditorPage from "../../routes/pages/EditorPage.svelte";
  import LifeInColourPage from "../../routes/pages/LifeInColourPage.svelte";
  import ProjectViewPage from "../../routes/pages/ProjectViewPage.svelte";

  let {
    page,
    route,
  }: {
    page: PageKey;
    route?: RouteResult;
  } = $props();

  const projectId = $derived(
    ((route?.result.path.params as Record<string, string> | undefined)?.projectId ?? "")
  );

  type SecondaryPageKey =
    | "visualStudio"
    | "export"
    | "settings"
    | "pricing"
    | "gamification"
    | "account"
    | "infographics"
    | "legal"
    | "viewer";

  type SecondaryPageModule = {
    default: Component<Record<string, never>>;
  };

  const secondaryPageLoaders = {
    visualStudio: () => import("../../routes/pages/VisualStudioPage.svelte"),
    export: () => import("../../routes/pages/ExportPage.svelte"),
    settings: () => import("../../routes/pages/SettingsPage.svelte"),
    pricing: () => import("../../routes/pages/PricingPage.svelte"),
    gamification: () => import("../../routes/pages/GamificationPage.svelte"),
    account: () => import("../../routes/pages/AccountPage.svelte"),
    infographics: () => import("../../routes/pages/InfographicsPage.svelte"),
    legal: () => import("../../routes/pages/LegalPage.svelte"),
    viewer: () => import("../../routes/pages/ViewerPage.svelte"),
  } satisfies Record<SecondaryPageKey, () => Promise<SecondaryPageModule>>;

  const secondaryPageCache = new Map<SecondaryPageKey, Promise<SecondaryPageModule>>();

  function loadSecondaryPageModule(currentPage: PageKey) {
    if (!(currentPage in secondaryPageLoaders)) {
      throw new Error(`Page ${currentPage} is part of the eager shell path.`);
    }

    const secondaryPage = currentPage as SecondaryPageKey;
    const cachedModule = secondaryPageCache.get(secondaryPage);
    if (cachedModule) {
      return cachedModule;
    }

    const modulePromise = secondaryPageLoaders[secondaryPage]();
    secondaryPageCache.set(secondaryPage, modulePromise);
    return modulePromise;
  }
</script>

<ShellLayout page={page}>
  {#if page === "dashboard"}
    <DashboardPage />
  {:else if page === "project"}
    <ProjectViewPage projectId={projectId} />
  {:else if page === "lifeInColour"}
    <LifeInColourPage />
  {:else if page === "editor"}
    <EditorPage />
  {:else}
    {#await loadSecondaryPageModule(page)}
      <section class="desktop-loading-shell surface-card">
        <p class="text-sm font-medium text-[var(--muted)]">Loading page…</p>
      </section>
    {:then module}
      <module.default />
    {:catch}
      <section class="desktop-loading-shell surface-card">
        <p class="text-sm font-semibold text-[var(--foreground)]">This page failed to load.</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          Reload the desktop shell and retry the route.
        </p>
      </section>
    {/await}
  {/if}
</ShellLayout>
