<script lang="ts">
  import "./passwords.css";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  let { moduleId = "passwords", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  type VaultEntry = {
    id: number;
    site: string;
    user: string;
    url: string;
    pass: string;
  };

  type VaultGroup = {
    section: string;
    items: VaultEntry[];
  };

  let searchQuery = $state("");
  let showDetail = $state<VaultEntry | null>(null);
  let revealPassword = $state(false);
  let activeCategory = $state("All");

  // ── Filter (ported from Anytype) ──────────────────────────────
  let isFocused = $state(false);
  let isActive = $state(false);
  let filterNode: HTMLDivElement | undefined = $state(undefined);
  let inputRef: HTMLInputElement | undefined = $state(undefined);

  function onIconClick() {
    isActive = !isActive;
    if (!isActive) searchQuery = "";
  }

  function onFocus() {
    isFocused = true;
  }

  function onBlur() {
    isFocused = false;
  }

  function clear() {
    searchQuery = "";
    inputRef?.focus();
  }

  function onClearHandler(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    clear();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      clear();
    }
  }

  $effect(() => {
    if (isActive) {
      requestAnimationFrame(() => inputRef?.focus());
      const onDocClick = (e: MouseEvent) => {
        if (filterNode && !filterNode.contains(e.target as Node)) {
          isActive = false;
        }
      };
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }
  });

  const categories = ["All", "Login", "Cards", "Notes", "Identity"];

  const recentLogins: VaultEntry[] = [
    { id: 1, site: "GitHub", user: "kimenzo", url: "github.com", pass: "gh_token_9xV…" },
    { id: 2, site: "Stripe", user: "admin@corp.com", url: "stripe.com", pass: "str_live_…" },
    { id: 3, site: "AWS Console", user: "root-dev", url: "aws.amazon.com", pass: "aws_19192…" },
  ];

  const vault: VaultGroup[] = [
    {
      section: "A",
      items: [
        { id: 4, site: "Apple", user: "steve@mac.com", url: "apple.com", pass: "apple_xZ91…" },
        { id: 5, site: "Adobe", user: "design@ui.com", url: "adobe.com", pass: "dobe_pass…" },
      ],
    },
    {
      section: "G",
      items: [
        { id: 1, site: "GitHub", user: "kimenzo", url: "github.com", pass: "gh_token_9xV…" },
        { id: 6, site: "Google", user: "kimenzo@gmail.com", url: "google.com", pass: "g_99182…" },
      ],
    },
  ];

  function copyPass(pass: string) {
    void pass;
  }

  function openDetail(item: VaultEntry) {
    showDetail = item;
    revealPassword = false;
  }

  function closeDetail() {
    showDetail = null;
    revealPassword = false;
  }
</script>

<MiniAppRoot class="passwords-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Vault"
    title="Password vault"
    description="Local-first logins, secure notes, and passkeys — encrypted on this device."
  >
    {#snippet actions()}
      <Button type="button" variant="outline" size="icon" aria-label="Add item">
        <PlusIcon />
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    columns={3}
    stats={[
      { label: "Saved items", value: "128", hint: "Across all categories" },
      { label: "Health score", value: "94", hint: "Strong passwords" },
      { label: "Breaches", value: "0", hint: "Monitored emails" },
    ]}
  />

  <section class="passwords-toolbar">
    <div class="passwords-toolbar-left">
      <span class="passwords-section-title">Vault</span>
    </div>
    <div class="passwords-toolbar-right">
      <button
        type="button"
        class="icon passwords-search-icon"
        onclick={onIconClick}
        aria-label={isActive ? "Close search" : "Search vault"}
      >
        <SearchIcon />
      </button>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="filterWrap"
        class:active={isActive}
        bind:this={filterNode}
      >
        <div
          class="filter size28 withIcon"
          class:isFocused
          class:active={searchQuery.length > 0}
        >
          <div class="inner">
            <span class="icon search-icon">
              <SearchIcon />
            </span>
            <div class="filterInputWrap">
              <input
                bind:this={inputRef}
                bind:value={searchQuery}
                type="text"
                placeholder="Search vault…"
                class="input"
                onfocus={onFocus}
                onblur={onBlur}
                onkeydown={onKeyDown}
              />
            </div>
            <button type="button" class="icon commonClear" onclick={onClearHandler}>
              <XIcon />
            </button>
          </div>
          <div class="line"></div>
        </div>
      </div>
    </div>
  </section>

  <section class="passwords-categories">
    {#each categories as cat (cat)}
      <Button
        type="button"
        variant={activeCategory === cat ? "default" : "outline"}
        size="sm"
        class="rounded-full"
        onclick={() => (activeCategory = cat)}
      >
        {cat}
      </Button>
    {/each}
  </section>

  <section class="passwords-scroll grid gap-1">
    {#if !searchQuery}
      <p class="passwords-section-title">Recently used</p>
      {#each recentLogins as entry (entry.id)}
        <button type="button" class="mini-app-row w-full text-left" onclick={() => openDetail(entry)}>
          <span class="flex min-w-0 items-center gap-3">
            <span class="passwords-favicon">{entry.site.charAt(0)}</span>
            <span class="min-w-0">
              <span class="block truncate font-medium text-[var(--foreground)]">{entry.site}</span>
              <span class="block truncate text-sm text-[var(--muted)]">{entry.user}</span>
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Copy password"
            onclick={(e) => {
              e.stopPropagation();
              copyPass(entry.pass);
            }}
          >
            <CopyIcon class="size-4" />
          </Button>
        </button>
      {/each}

      {#each vault as group (group.section)}
        <p class="passwords-alpha">{group.section}</p>
        {#each group.items as entry (entry.id)}
          <button type="button" class="mini-app-row w-full text-left" onclick={() => openDetail(entry)}>
            <span class="flex min-w-0 items-center gap-3">
              <span class="passwords-favicon">{entry.site.charAt(0)}</span>
              <span class="min-w-0">
                <span class="block truncate font-medium text-[var(--foreground)]">{entry.site}</span>
                <span class="block truncate text-sm text-[var(--muted)]">{entry.user}</span>
              </span>
            </span>
            <CopyIcon class="size-4 shrink-0 text-[var(--muted)]" />
          </button>
        {/each}
      {/each}
    {:else}
      <p class="passwords-section-title">Results</p>
      {#each recentLogins as entry (entry.id)}
        <button type="button" class="mini-app-row w-full text-left" onclick={() => openDetail(entry)}>
          <span class="flex min-w-0 items-center gap-3">
            <span class="passwords-favicon">{entry.site.charAt(0)}</span>
            <span class="min-w-0">
              <span class="block truncate font-medium">{entry.site}</span>
              <span class="block truncate text-sm text-[var(--muted)]">{entry.user}</span>
            </span>
          </span>
        </button>
      {/each}
    {/if}
  </section>

  {#if showDetail}
    {@const detail = showDetail}
    <div class="passwords-detail-overlay" role="presentation">
      <button type="button" class="absolute inset-0" aria-label="Close detail" onclick={closeDetail}></button>
      <div class="passwords-detail-pane relative z-10">
        <div class="mb-6 flex items-start justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] pb-5">
          <span class="flex items-center gap-3">
            <span class="passwords-favicon passwords-favicon--lg">{detail.site.charAt(0)}</span>
            <span>
              <h2 class="font-[var(--font-heading)] text-xl font-semibold">{detail.site}</h2>
              <Badge variant="outline" class="mt-1">Login</Badge>
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm">Edit</Button>
        </div>

        <div class="grid gap-4">
          <div class="passwords-field">
            <span class="passwords-field-label">Username</span>
            <div class="passwords-field-row">
              <span class="passwords-field-value">{detail.user}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy username">
                <CopyIcon class="size-4" />
              </Button>
            </div>
          </div>

          <div class="passwords-field">
            <span class="passwords-field-label">Password</span>
            <div class="passwords-field-row">
              <span class="passwords-field-value passwords-field-value--mono">
                {revealPassword ? detail.pass : "••••••••••••"}
              </span>
              <span class="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={revealPassword ? "Hide password" : "Show password"}
                  onclick={() => (revealPassword = !revealPassword)}
                >
                  {#if revealPassword}
                    <EyeOffIcon class="size-4" />
                  {:else}
                    <EyeIcon class="size-4" />
                  {/if}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy password"
                  onclick={() => copyPass(detail.pass)}
                >
                  <CopyIcon class="size-4" />
                </Button>
              </span>
            </div>
          </div>

          <section class="passwords-field">
            <span class="passwords-field-label">Website</span>
            <div class="passwords-field-row">
              <span class="passwords-field-value passwords-field-value--link">{detail.url}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Open website">
                <ExternalLinkIcon class="size-4" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  {/if}
</MiniAppRoot>
