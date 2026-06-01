<script lang="ts">
  import "./clipboard.css";
  import CodeIcon from "@lucide/svelte/icons/code";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Link2Icon from "@lucide/svelte/icons/link-2";
  import PinIcon from "@lucide/svelte/icons/pin";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import TypeIcon from "@lucide/svelte/icons/type";
  import { onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    MiniAppHeader,
    MiniAppRoot,
    MiniAppStatGrid,
    miniAppAccent,
  } from "$lib/modules/mini-app/index.js";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  let { moduleId = "clipboard", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  const sectionLabels = ["History", "Pinned", "Snippets", "Images", "Sensitive", "Settings"] as const;
  const selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  type ClipType = "text" | "code" | "link" | "image";
  type Clip = { id: string; type: ClipType; content: string; time: string; isPinned?: boolean };

  let searchQuery = $state("");

  const pinnedClips: Clip[] = [
    { id: "p1", type: "code", content: "npm install -D tailwindcss postcss autoprefixer", time: "2d ago", isPinned: true },
    { id: "p2", type: "text", content: "0x98fB...12aE (Wallet Address)", time: "1w ago", isPinned: true },
  ];

  const recentClips: Clip[] = [
    { id: "1", type: "text", content: "Meeting notes from today: Need to hit the Q3 metrics before we scale the marketing spend.", time: "2m ago" },
    { id: "2", type: "link", content: "https://github.com/Kimenzo/Bento/pulls", time: "15m ago" },
    { id: "3", type: "image", content: "Screenshot 2026-05-09 175836.png [1034x601]", time: "1h ago" },
    { id: "4", type: "code", content: "const app = express(); app.use(express.json());", time: "3h ago" },
    { id: "5", type: "text", content: "Check out the new design system specs attached.", time: "5h ago" },
  ];

  const snippets = [
    { id: "s1", label: "git status", content: "git status --short --branch" },
    { id: "s2", label: "Supabase URL", content: "VITE_SUPABASE_URL=https://..." },
    { id: "s3", label: "Standup", content: "Yesterday: … | Today: … | Blockers: …" },
  ];

  const sensitiveClips = [
    { id: "x1", content: "API key sk_live_••••••••", expires: "Expires in 4m" },
    { id: "x2", content: "One-time backup codes", expires: "Expires in 12m" },
  ];

  const settingsRows = [
    { label: "History limit", value: "500 items" },
    { label: "Sensitive auto-expire", value: "15 minutes" },
    { label: "Sync across devices", value: "Off (local only)" },
  ];

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  function iconFor(type: ClipType) {
    if (type === "code") return CodeIcon;
    if (type === "link") return Link2Icon;
    if (type === "image") return ImageIcon;
    return TypeIcon;
  }

  function accentFor(type: ClipType, index: number) {
    if (type === "code") return miniAppAccent(0);
    if (type === "link") return miniAppAccent(1);
    if (type === "image") return miniAppAccent(2);
    return miniAppAccent(index + 3);
  }

  const allClips = $derived([...pinnedClips, ...recentClips]);

  const visibleClips = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    let pool: Clip[] = allClips;

    if (selectedSection === "Pinned") pool = pinnedClips;
    else if (selectedSection === "Images") pool = allClips.filter((c) => c.type === "image");
    else if (selectedSection === "History") pool = recentClips;

    if (!q) return pool;
    return pool.filter((c) => c.content.toLowerCase().includes(q));
  });

  function copyAction(text: string) {
    void text;
  }
</script>

<MiniAppRoot class="clipboard-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Clipboard"
    title="History, snippets, and sensitive clips"
    description="Persistent clipboard history with pins, search, and auto-expire for secrets — all on-device."
  >
    {#snippet actions()}
      <Badge variant="outline">{selectedSection}</Badge>
      <Button variant="outline" type="button">
        <DownloadIcon data-icon="inline-start" />
        Export
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Items saved", value: "247", hint: "Last 30 days" },
      { label: "Pinned", value: String(pinnedClips.length), hint: "Quick access" },
      { label: "Sensitive", value: "2", hint: "Auto-expiring" },
    ]}
  />

  {#if selectedSection === "Settings"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Clipboard settings</CardTitle>
        <CardDescription>Retention, privacy, and sync preferences.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each settingsRows as row (row.label)}
          <article class="mini-app-row">
            <span class="text-sm text-[var(--muted)]">{row.label}</span>
            <span class="text-sm font-medium text-[var(--foreground)]">{row.value}</span>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Snippets"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Snippet templates</CardTitle>
        <CardDescription>Reusable blocks for standups, git, and env vars.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each snippets as snippet (snippet.id)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{snippet.label}</p>
              <p class="mt-1 truncate font-mono text-sm text-[var(--muted)]">{snippet.content}</p>
            </div>
            <Button variant="ghost" size="icon" type="button" onclick={() => copyAction(snippet.content)} aria-label="Copy snippet">
              <CopyIcon class="size-4" />
            </Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Sensitive"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Sensitive clips</CardTitle>
        <CardDescription>Short-lived entries with automatic purge.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each sensitiveClips as clip (clip.id)}
          <article class="mini-app-row">
            <div class="flex min-w-0 items-center gap-3">
              <ShieldIcon class="size-4 shrink-0 text-[var(--destructive)]" />
              <div class="min-w-0">
                <p class="truncate font-mono text-sm text-[var(--foreground)]">{clip.content}</p>
                <p class="mt-1 text-xs text-[var(--muted)]">{clip.expires}</p>
              </div>
            </div>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Search history</CardTitle>
          <CardDescription>Full-text search across text, links, code, and images.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-3">
          <div class="relative">
            <SearchIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input class="pl-9" placeholder="Search clipboard history…" bind:value={searchQuery} />
          </div>
          {#if selectedSection === "Pinned"}
            <p class="text-sm text-[var(--muted)]">Showing pinned clips only.</p>
          {:else if selectedSection === "Images"}
            <p class="text-sm text-[var(--muted)]">Filtering image captures from history.</p>
          {/if}
        </CardContent>
      </Card>

      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">
            {selectedSection === "Pinned" ? "Pinned" : selectedSection === "Images" ? "Images" : "Recent history"}
          </CardTitle>
          <CardDescription>Click a row to copy. Pin favorites from the actions.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each visibleClips as clip, index (clip.id)}
            {@const Icon = iconFor(clip.type)}
            <article
              class="mini-app-row cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => copyAction(clip.content)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyAction(clip.content);
                }
              }}
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <div
                  class="flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ring-[color:color-mix(in_srgb,var(--border)_82%,transparent)]"
                  style:color={accentFor(clip.type, index)}
                >
                  <Icon class="size-4" />
                </div>
                <p class="min-w-0 flex-1 truncate font-mono text-sm text-[var(--foreground)]">{clip.content}</p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span class="text-xs text-[var(--muted)]">{clip.time}</span>
                {#if clip.isPinned}
                  <PinIcon class="size-4 text-[var(--primary)]" />
                {/if}
                <Button variant="ghost" size="icon" type="button" aria-label="Copy" onclick={(e) => { e.stopPropagation(); copyAction(clip.content); }}>
                  <CopyIcon class="size-4" />
                </Button>
              </div>
            </article>
          {:else}
            <p class="py-8 text-center text-sm text-[var(--muted)]">No clips match this view.</p>
          {/each}
        </CardContent>
      </Card>
    </div>
  {/if}
</MiniAppRoot>
