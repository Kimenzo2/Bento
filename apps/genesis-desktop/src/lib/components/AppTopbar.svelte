<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import BellIcon from "@lucide/svelte/icons/bell";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import type { PageKey } from "$lib/router/routes";
  import { pageMeta } from "$lib/router/routes";
  import { networkStore } from "$lib/stores/network.store";
  import { isDark, toggleMode } from "$lib/stores/theme.store";

  let {
    currentPage,
  }: {
    currentPage: PageKey;
  } = $props();

  const meta = $derived(pageMeta[currentPage]);
</script>

<div class="desktop-topbar">
  <div>
    <p class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
      {meta.title}
    </p>
    <p class="mt-2 text-sm text-[var(--muted)]">{meta.subtitle}</p>
  </div>

  <div class="desktop-topbar__actions">
    <label class="desktop-topbar__search">
      <SearchIcon />
      <Input class="border-none bg-transparent shadow-none focus-visible:ring-0" placeholder="Search projects, assets, or commands" />
    </label>

    <span class:desktop-topbar__network--offline={!$networkStore.online} class="desktop-topbar__network">
      {$networkStore.online ? "Online" : "Offline"}
    </span>

    <Button class="rounded-full" size="icon" variant="outline" onclick={toggleMode}>
      {#if $isDark}
        <SunIcon />
      {:else}
        <MoonIcon />
      {/if}
    </Button>

    <Button class="rounded-full" size="icon" variant="outline" onclick={() => goto("/settings")}>
      <BellIcon />
    </Button>
  </div>
</div>
