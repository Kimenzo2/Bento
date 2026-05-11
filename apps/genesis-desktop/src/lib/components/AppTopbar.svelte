<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import BellIcon from "@lucide/svelte/icons/bell";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import type { PageKey } from "$lib/router/routes";
  import { pageMeta } from "$lib/router/routes";
  import { isDark, toggleMode } from "$lib/stores/theme.store";

  let {
    currentPage,
    title,
    subtitle,
  }: {
    currentPage: PageKey;
    title?: string;
    subtitle?: string;
  } = $props();

  const meta = $derived({
    title: title ?? pageMeta[currentPage].title,
    subtitle: subtitle ?? pageMeta[currentPage].subtitle,
  });

  const openAlertsPanel = async () => {
    console.info("[Genesis Desktop] Alerts button clicked", { currentPage });

    if (currentPage !== "settings") {
      await goto("/settings");
      toast.info("Opened Settings for alerts and telemetry.");
      return;
    }

    document.getElementById("settings-alerts")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    toast.info("Jumped to alerts and telemetry.");
  };

  const toggleThemeWithLog = async () => {
    const nextMode = $isDark ? "light" : "dark";
    console.info("[Genesis Desktop] Theme toggle clicked", {
      currentPage,
      nextMode,
    });

    try {
      await toggleMode();
      toast.success(`Theme switched to ${nextMode}.`);
    } catch (error) {
      console.error("[Genesis Desktop] Theme toggle failed", error);
      toast.error(error instanceof Error ? error.message : "Theme toggle failed.");
    }
  };
</script>

<div class="desktop-topbar">
  <div>
    <p class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
      {meta.title}
    </p>
    <p class="mt-2 text-sm text-[var(--muted)]">{meta.subtitle}</p>
  </div>

  <div class="desktop-topbar__actions">
    {#if currentPage === "dashboard"}
      <label class="desktop-topbar__search">
        <SearchIcon />
        <Input class="border-none bg-transparent shadow-none focus-visible:ring-0" placeholder="Search projects, assets, or commands" />
      </label>
    {/if}

    <div class="desktop-topbar__buttons">
      <Button class="rounded-full" size="icon" variant="outline" aria-label="Toggle theme" onclick={toggleThemeWithLog}>
        {#if $isDark}
          <SunIcon />
        {:else}
          <MoonIcon />
        {/if}
      </Button>

      <Button class="rounded-full" size="icon" variant="outline" aria-label="Open alerts" onclick={openAlertsPanel}>
        <BellIcon />
      </Button>
    </div>
  </div>
</div>
