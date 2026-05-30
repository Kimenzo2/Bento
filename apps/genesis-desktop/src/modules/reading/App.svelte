<script lang="ts">
  import "./reading.css";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  let { moduleId = "reading", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  const currentBook = {
    title: "Dune",
    author: "Frank Herbert",
    genre: "Sci-Fi",
    currentPage: 342,
    totalPages: 896,
  };

  const recentlyFinished = [
    { title: "Project Hail Mary" },
    { title: "The Martian" },
    { title: "Foundation" },
  ];

  const challenge = { read: 8, target: 24, aheadBy: 4 };
  const ringLength = 251.2;
  const progress = $derived(currentBook.currentPage / currentBook.totalPages);
</script>

<MiniAppRoot class="reading-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Reading"
    title="Reading tracker"
    description="Log sessions, track annual goals, and keep your current book visible."
  >
    {#snippet actions()}
      <Button type="button" variant="outline">
        <PlusIcon data-icon="inline-start" />
        Add book
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Streak", value: "14 days", hint: "Daily reading" },
      { label: "This year", value: "8 books", hint: "Finished" },
      { label: "Pace", value: "284 pg/wk", hint: "4-week average" },
    ]}
  />

  <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-xl">Currently reading</CardTitle>
    </CardHeader>
    <CardContent>
      <article class="reading-current">
        <span class="reading-cover-placeholder" aria-hidden="true">Cover</span>
        <span class="reading-meta">
          <h2 class="font-[var(--font-heading)] text-xl font-semibold">{currentBook.title}</h2>
          <p class="text-sm text-[var(--muted)]">{currentBook.author}</p>
          <span class="reading-genre">{currentBook.genre}</span>
          <span class="flex justify-between text-sm text-[var(--muted)]">
            <span>Page {currentBook.currentPage} of {currentBook.totalPages}</span>
            <span class="font-medium text-[var(--foreground)]">{Math.round(progress * 100)}%</span>
          </span>
          <span class="reading-progress-track">
            <span class="reading-progress-fill" style="width:{progress * 100}%"></span>
          </span>
          <span class="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm">Update progress</Button>
            <Button type="button" size="sm" variant="outline">Mark finished</Button>
          </span>
        </span>
      </article>
    </CardContent>
  </Card>

  <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-xl">2026 challenge</CardTitle>
      <CardDescription>{challenge.read} of {challenge.target} books</CardDescription>
    </CardHeader>
    <CardContent>
      <article class="reading-challenge">
        <span class="reading-ring" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <circle class="reading-ring__bg" cx="50" cy="50" r="40"></circle>
            <circle
              class="reading-ring__fill"
              cx="50"
              cy="50"
              r="40"
              style="stroke-dasharray:{ringLength};stroke-dashoffset:{ringLength - ringLength * (challenge.read / challenge.target)}"
            ></circle>
          </svg>
          <span class="reading-ring__label">
            {challenge.read}<span class="text-xs font-normal text-[var(--muted)]">/{challenge.target}</span>
          </span>
        </span>
        <span class="reading-status">{challenge.aheadBy} books ahead of plan</span>
      </article>
    </CardContent>
  </Card>

  <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardHeader class="flex-row items-center justify-between space-y-0">
      <CardTitle class="font-[var(--font-heading)] text-xl">Recently finished</CardTitle>
      <Button type="button" variant="ghost" size="sm">View all</Button>
    </CardHeader>
    <CardContent>
      <span class="reading-shelf">
        {#each recentlyFinished as book (book.title)}
          <span class="reading-shelf-item">
            <span class="reading-shelf-cover" title={book.title}></span>
            <span class="mt-2 block truncate text-xs text-[var(--muted)]">{book.title}</span>
          </span>
        {/each}
        <button type="button" class="reading-shelf-item reading-shelf-add">
          <PlusIcon class="size-5" />
          <span class="text-xs">Add</span>
        </button>
      </span>
    </CardContent>
  </Card>
</MiniAppRoot>
