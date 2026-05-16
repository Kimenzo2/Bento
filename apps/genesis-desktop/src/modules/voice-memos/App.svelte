<script lang="ts">
  import MicIcon from "@lucide/svelte/icons/mic";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  let { moduleId = "voice-memos", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  const recordings = [
    {
      id: "1",
      title: "Board review for client launch",
      duration: "18:42",
      tag: "Product research",
      summary: "Speaker labels and action items are ready for export.",
    },
    {
      id: "2",
      title: "Championship viewing party notes",
      duration: "06:12",
      tag: "Personal",
      summary: "Venue, snacks, and guest list captured from voice.",
    },
    {
      id: "3",
      title: "Morning standup recap",
      duration: "04:05",
      tag: "Work",
      summary: "Blockers, owners, and follow-ups transcribed automatically.",
    },
  ];
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Voice memos"
    title="Capture, transcribe, and search recordings"
    description="One-tap record, AI titles, speaker labels, and export-ready transcripts — all on-device."
  >
    {#snippet actions()}
      <Button variant="outline" type="button">
        <SearchIcon data-icon="inline-start" />
        Search
      </Button>
      <Button type="button">
        <MicIcon data-icon="inline-start" />
        Record
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Minutes transcribed", value: "345", hint: "This week" },
      { label: "Recordings", value: "4,569", hint: "Library total" },
      { label: "AI titles", value: "92%", hint: "Auto-labeled last 30 days" },
    ]}
  />

  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Quick capture</CardTitle>
        <CardDescription>Natural-language search across transcript text.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-3">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input class="pl-9" placeholder="Search inside recordings…" />
        </div>
        <Button class="w-full sm:w-auto" type="button">
          <SparklesIcon data-icon="inline-start" />
          Transcribe latest clip
        </Button>
      </CardContent>
    </Card>

    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Recent recordings</CardTitle>
        <CardDescription>Tap a row to open transcript and export options.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each recordings as item (item.id)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="truncate font-medium text-[var(--foreground)]">{item.title}</p>
              <p class="mt-1 truncate text-sm text-[var(--muted)]">{item.summary}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1 text-right">
              <span class="text-sm font-medium text-[var(--foreground)]">{item.duration}</span>
              <span class="text-xs text-[var(--muted)]">{item.tag}</span>
            </div>
          </article>
        {/each}
      </CardContent>
    </Card>
  </div>
</MiniAppRoot>
