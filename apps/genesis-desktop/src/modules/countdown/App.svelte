<script lang="ts">
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import HourglassIcon from "@lucide/svelte/icons/hourglass";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Share2Icon from "@lucide/svelte/icons/share-2";
  import { onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
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

  let { moduleId = "countdown", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  const sectionLabels = ["Events", "Birthdays", "Since", "Cards", "Widgets", "Export"] as const;
  const selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  type EventCategory = "Trip" | "Deadline" | "Birthday" | "Work" | "Anniversary";

  type CountdownEvent = {
    id: number;
    name: string;
    date: Date;
    category: EventCategory;
    cover?: string;
    accent: string;
  };

  const events: CountdownEvent[] = [
    {
      id: 1,
      name: "Hawaii Trip",
      date: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
      category: "Trip",
      cover: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800",
      accent: miniAppAccent(0),
    },
    {
      id: 2,
      name: "Product Launch",
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      category: "Deadline",
      accent: miniAppAccent(1),
    },
    {
      id: 3,
      name: "Mom's Birthday",
      date: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
      category: "Birthday",
      accent: miniAppAccent(2),
    },
    {
      id: 4,
      name: "Project Presentation",
      date: new Date(),
      category: "Work",
      accent: miniAppAccent(3),
    },
    {
      id: 5,
      name: "Genesis v1 ship",
      date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      category: "Anniversary",
      accent: miniAppAccent(4),
    },
  ];

  const shareCards = [
    { id: "c1", title: "Hawaii Trip", detail: "17 days · beach cover" },
    { id: "c2", title: "Mom's Birthday", detail: "42 days · confetti theme" },
  ];

  const widgets = [
    { id: "w1", label: "Lock screen", detail: "Next event + days remaining" },
    { id: "w2", label: "Menu bar", detail: "Compact countdown chip" },
  ];

  const exportOptions = [
    { label: "ICS calendar pack", detail: "All upcoming events with reminders" },
    { label: "Share card PNG", detail: "Social-ready countdown graphics" },
  ];

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  function formatDate(d: Date) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(d);
  }

  function getDaysAway(d: Date) {
    const diff = d.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const enrichedEvents = $derived(
    events
      .map((event) => ({ ...event, daysAway: getDaysAway(event.date) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
  );

  const filteredEvents = $derived.by(() => {
    if (selectedSection === "Birthdays") {
      return enrichedEvents.filter((e) => e.category === "Birthday");
    }
    if (selectedSection === "Since") {
      return enrichedEvents.filter((e) => e.daysAway <= 0);
    }
    return enrichedEvents.filter((e) => e.daysAway >= 0);
  });

  const heroEvent = $derived(filteredEvents.find((e) => e.daysAway > 0) ?? filteredEvents[0]);
  const timelineEvents = $derived(filteredEvents.filter((e) => e.id !== heroEvent?.id));
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Countdown"
    title="Events, birthdays, and days-since"
    description="Cover photos, shareable cards, and widgets — track what matters without leaving the shell."
  >
    {#snippet actions()}
      <Badge variant="outline">{selectedSection}</Badge>
      <Button type="button">
        <PlusIcon data-icon="inline-start" />
        Add event
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Upcoming", value: String(enrichedEvents.filter((e) => e.daysAway > 0).length), hint: "On calendar" },
      { label: "This month", value: "2", hint: "Birthdays & deadlines" },
      { label: "Share cards", value: String(shareCards.length), hint: "Ready to export" },
    ]}
  />

  {#if selectedSection === "Export"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Export</CardTitle>
        <CardDescription>Calendar feeds and shareable countdown graphics.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each exportOptions as option (option.label)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{option.label}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{option.detail}</p>
            </div>
            <Button variant="outline" size="sm" type="button">
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Cards"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Shareable cards</CardTitle>
        <CardDescription>Pre-styled countdown graphics for messages and social.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-3 sm:grid-cols-2">
        {#each shareCards as card (card.id)}
          <article class="mini-app-board flex flex-col gap-3">
            <HourglassIcon class="size-8 text-[var(--primary)]" />
            <div>
              <p class="font-medium text-[var(--foreground)]">{card.title}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{card.detail}</p>
            </div>
            <Button variant="outline" size="sm" type="button" class="w-fit">
              <Share2Icon data-icon="inline-start" />
              Share
            </Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Widgets"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Widgets</CardTitle>
        <CardDescription>Glanceable countdowns on desktop and mobile surfaces.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each widgets as widget (widget.id)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{widget.label}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{widget.detail}</p>
            </div>
            <Button variant="outline" size="sm" type="button">Configure</Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if heroEvent}
    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card
        class="surface-card overflow-hidden rounded-2xl border-none bg-transparent p-0 shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
      >
        <div
          class="relative flex min-h-[280px] flex-col justify-end p-6 text-[var(--foreground)]"
          style={heroEvent.cover
            ? `background-image: linear-gradient(to bottom, color-mix(in srgb, var(--background) 20%, transparent), color-mix(in srgb, var(--background) 88%, transparent)), url(${heroEvent.cover}); background-size: cover; background-position: center;`
            : `background: color-mix(in srgb, ${heroEvent.accent} 24%, var(--surface));`}
        >
          <Badge variant="outline" class="mb-3 w-fit bg-[color:color-mix(in_srgb,var(--card)_70%,transparent)]">
            {heroEvent.category}
          </Badge>
          <p class="font-[var(--font-heading)] text-5xl font-bold tracking-tight">
            {heroEvent.daysAway > 0 ? heroEvent.daysAway : "Today"}
            {#if heroEvent.daysAway > 0}
              <span class="text-2xl font-semibold text-[var(--muted)]"> days</span>
            {/if}
          </p>
          <h2 class="mt-2 font-[var(--font-heading)] text-2xl font-semibold">{heroEvent.name}</h2>
          <p class="mt-1 text-sm text-[var(--muted)]">{formatDate(heroEvent.date)}</p>
        </div>
      </Card>

      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">
            {selectedSection === "Since" ? "Days since" : selectedSection === "Birthdays" ? "Birthdays" : "Upcoming"}
          </CardTitle>
          <CardDescription>Timeline of everything else on your calendar.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-3">
          {#each timelineEvents as event (event.id)}
            <article class="mini-app-row">
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="size-2.5 shrink-0 rounded-full"
                  style:background={event.accent}
                  aria-hidden="true"
                ></span>
                <div class="min-w-0">
                  <p class="font-medium text-[var(--foreground)]">{event.name}</p>
                  <p class="mt-0.5 text-sm text-[var(--muted)]">{formatDate(event.date)}</p>
                </div>
              </div>
              <div class="shrink-0 text-right">
                {#if event.daysAway === 0}
                  <span class="text-sm font-semibold uppercase" style:color={event.accent}>Today</span>
                {:else if event.daysAway < 0}
                  <span class="text-lg font-bold text-[var(--foreground)]">{Math.abs(event.daysAway)}</span>
                  <span class="block text-xs text-[var(--muted)]">days ago</span>
                {:else}
                  <span class="text-lg font-bold text-[var(--foreground)]">{event.daysAway}</span>
                  <span class="block text-xs text-[var(--muted)]">days</span>
                {/if}
              </div>
            </article>
          {:else}
            <p class="py-6 text-center text-sm text-[var(--muted)]">No other events in this view.</p>
          {/each}

          <Button variant="outline" type="button" class="mt-2 w-full">
            View past events
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    </div>
  {/if}
</MiniAppRoot>
