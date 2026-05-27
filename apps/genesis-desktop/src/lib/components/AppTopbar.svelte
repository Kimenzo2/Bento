<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import BellIcon from "@lucide/svelte/icons/bell";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button/index.js";
  import { activeBundle, createTranslator } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));
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
    console.info("[Bento Desktop] Alerts button clicked", { currentPage });
    if (currentPage !== "settings") {
      await goto("/settings");
      toast.info(_t('topbarOpenedSettings'));
      return;
    }
    document.getElementById("settings-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.info(_t('topbarJumpedToAlerts'));
  };

  const toggleThemeWithLog = async () => {
    const nextMode = $isDark ? "light" : "dark";
    try {
      await toggleMode();
      toast.success(_t('topbarThemeSwitched').replace('{mode}', nextMode));
    } catch (error) {
      console.error("[Bento Desktop] Theme toggle failed", error);
      toast.error(error instanceof Error ? error.message : _t('topbarThemeToggleFailed'));
    }
  };
</script>

<div class="desktop-topbar">
  <div class="desktop-topbar__identity">
    <div class="desktop-topbar__title-row">
      {#if currentPage === "pricing"}
        <button
          class="desktop-topbar__back-btn"
          type="button"
          aria-label={_t('topbarBackToSettings')}
          onclick={() => void goto("/settings")}
        >
          <ArrowLeftIcon size={18} />
        </button>
      {/if}
      <h1 class="desktop-topbar__title">{meta.title}</h1>
    </div>
    <p class="desktop-topbar__subtitle">{meta.subtitle}</p>
  </div>

  <div class="desktop-topbar__actions">
    <!-- dashboard search bar removed -->

    <div class="desktop-topbar__buttons">
      <Button class="rounded-full" size="icon" variant="outline" aria-label={_t('topbarToggleTheme')} onclick={toggleThemeWithLog}>
        {#if $isDark}
          <SunIcon />
        {:else}
          <MoonIcon />
        {/if}
      </Button>

      <Button class="rounded-full" size="icon" variant="outline" aria-label={_t('topbarOpenAlerts')} onclick={openAlertsPanel}>
        <BellIcon />
      </Button>
    </div>
  </div>
</div>

<style>
  .desktop-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 4.5rem;
  }

  .desktop-topbar__identity {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .desktop-topbar__title-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .desktop-topbar__back-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 2rem;
    height: 2rem;
    margin: 0;
    border-radius: 9999px;
    border: 0;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    color: var(--foreground);
    cursor: pointer;
    padding: 0;
  }

  .desktop-topbar__back-btn :global(svg) {
    flex: 0 0 auto;
  }

  .desktop-topbar__title {
    margin: 0;
    font-size: clamp(1.7rem, 2.2vw, 2.35rem);
    font-weight: 750;
    letter-spacing: -0.04em;
    line-height: 1.02;
  }

  .desktop-topbar__subtitle {
    margin: 0;
    max-width: min(64rem, 70vw);
    color: var(--muted);
    font-size: 0.98rem;
    line-height: 1.45;
  }

  .desktop-topbar__actions {
    flex-shrink: 0;
  }
</style>
