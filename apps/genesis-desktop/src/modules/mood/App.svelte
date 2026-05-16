<script lang="ts">
  import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import { onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    MiniAppRoot,
    MiniAppHeader,
    MiniAppStatGrid,
  } from "$lib/modules/mini-app/index.js";
  import { cn } from "$lib/utils.js";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import "./mood.css";

  const moduleId = "mood";
  const sectionLabels = ["Check-in", "Calendar", "Activities", "Patterns", "Therapist", "Export"] as const;
  const selectedSection = $derived(
    getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels),
  );

  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  const moods = [
    { id: "drained", label: "Drained", emoji: "😞", intensity: 24 },
    { id: "restless", label: "Restless", emoji: "😕", intensity: 39 },
    { id: "steady", label: "Steady", emoji: "🙂", intensity: 64 },
    { id: "bright", label: "Bright", emoji: "😊", intensity: 82 },
    { id: "energized", label: "Energized", emoji: "🤩", intensity: 91 },
  ] as const;

  const activityLibrary = [
    "Deep work",
    "Exercise",
    "Family time",
    "Reading",
    "Outside walk",
    "Journaling",
    "Meals",
    "Meetings",
  ];

  const checkIns = [
    { time: "08:10", mood: "Steady", note: "Quiet morning, focused start." },
    { time: "11:45", mood: "Bright", note: "Energy after shipping planning deck." },
    { time: "15:20", mood: "Restless", note: "Too many context switches." },
    { time: "20:40", mood: "Steady", note: "Recovered after a walk." },
  ];

  const patterns = [
    { label: "Exercise days", value: 88, note: "Best stability after movement." },
    { label: "Meeting-heavy days", value: 42, note: "Dips after 3+ calls." },
    { label: "Sleep over 7h", value: 79, note: "Calmer afternoons." },
    { label: "Weekend resets", value: 93, note: "Strongest rebounds on Sundays." },
  ];

  const therapistCards = [
    { title: "Share summary", description: "Monthly overview with check-ins and trends." },
    { title: "Flag patterns", description: "Recurring low-mood days and session prompts." },
    { title: "Private notes", description: "Sensitive reflections kept off the main timeline." },
  ];

  const exportOptions = [
    { label: "Therapist PDF", detail: "Calendar, patterns, and selected notes." },
    { label: "CSV timeline", detail: "Check-ins with activity tags and intensity." },
    { label: "Weekly recap", detail: "Short summary for your archive." },
  ];

  let selectedMood = $state("steady");
  let noteText = $state("");
  let selectedActivities = $state(["Deep work", "Reading"]);

  const selectedMoodEntry = $derived(moods.find((mood) => mood.id === selectedMood) ?? moods[2]);

  function toggleActivity(activity: string) {
    selectedActivities = selectedActivities.includes(activity)
      ? selectedActivities.filter((entry) => entry !== activity)
      : [...selectedActivities, activity];
  }
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Mood"
    title="Check-in"
    description="Log how you feel, tag activities, and review patterns."
  >
    {#snippet actions()}
      <Badge variant="outline" class="rounded-full">{selectedSection}</Badge>
      <Button variant="outline" type="button">
        <CalendarDaysIcon data-icon="inline-start" />
        Month
      </Button>
      <Button type="button">
        <SparklesIcon data-icon="inline-start" />
        Recap
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    columns={3}
    stats={[
      { label: "Streak", value: "11 days", hint: "Daily check-ins" },
      { label: "Entries", value: "56", hint: "This month" },
      { label: "Great days", value: "83%", hint: "Bright or energized" },
    ]}
  />

  {#if selectedSection === "Check-in"}
    <div class="grid gap-4 lg:grid-cols-2">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">How do you feel?</CardTitle>
          <CardDescription>Tap a mood and add context.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="mood-picker grid grid-cols-2 gap-2 sm:grid-cols-5">
            {#each moods as mood (mood.id)}
              <button
                type="button"
                class={cn(
                  "mood-picker__item rounded-2xl border p-3 text-center transition-colors",
                  selectedMood === mood.id && "mood-picker__item--active",
                )}
                onclick={() => (selectedMood = mood.id)}
              >
                <span class="text-2xl">{mood.emoji}</span>
                <strong class="mt-2 block text-sm">{mood.label}</strong>
              </button>
            {/each}
          </div>
          <Input bind:value={noteText} placeholder="What influenced this feeling?" />
          <div class="flex flex-wrap gap-2">
            {#each selectedActivities as activity (activity)}
              <Badge variant="outline">{activity}</Badge>
            {/each}
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
            <span>Intensity {selectedMoodEntry.intensity}%</span>
            <Button type="button">
              <PlusIcon data-icon="inline-start" />
              Save check-in
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Today</CardTitle>
          <CardDescription>Recent check-ins.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each checkIns as entry (entry.time)}
            <article class="mini-app-row">
              <span class="w-14 shrink-0 text-sm tabular-nums text-[var(--muted)]">{entry.time}</span>
              <div class="min-w-0 flex-1">
                <strong>{entry.mood}</strong>
                <p class="text-sm text-[var(--muted)]">{entry.note}</p>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
    </div>
  {:else if selectedSection === "Calendar"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Month</CardTitle>
        <CardDescription>One emoji per day at a glance.</CardDescription>
      </CardHeader>
      <CardContent class="mood-calendar grid grid-cols-4 gap-2 sm:grid-cols-6">
        {#each Array.from({ length: 30 }, (_, index) => index + 1) as day (day)}
          <button type="button" class="mood-calendar__day">
            <small class="text-[var(--muted)]">{day}</small>
            <span>{moods[day % moods.length].emoji}</span>
          </button>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Activities"}
    <div class="grid gap-4 lg:grid-cols-2">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Activity tags</CardTitle>
          <CardDescription>Link context to each check-in.</CardDescription>
        </CardHeader>
        <CardContent class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {#each activityLibrary as activity (activity)}
            <button
              type="button"
              class={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                selectedActivities.includes(activity)
                  ? "border-[color:color-mix(in_srgb,var(--primary)_38%,var(--border))] bg-[color:color-mix(in_srgb,var(--primary)_12%,var(--card))]"
                  : "border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--card)_96%,var(--background))]",
              )}
              onclick={() => toggleActivity(activity)}
            >
              {activity}
            </button>
          {/each}
        </CardContent>
      </Card>
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Selected</CardTitle>
          <CardDescription>Tags tied to steadier moods this month.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each selectedActivities as activity (activity)}
            <article class="mini-app-row flex-col items-start gap-1">
              <strong>{activity}</strong>
              <p class="text-sm text-[var(--muted)]">Often appears on steady and bright days.</p>
            </article>
          {/each}
        </CardContent>
      </Card>
    </div>
  {:else if selectedSection === "Patterns"}
    <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Patterns</CardTitle>
          <CardDescription>Correlations from repeated check-ins.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-3">
          {#each patterns as pattern (pattern.label)}
            <article class="mini-app-row flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <div class="min-w-0 flex-1">
                <strong>{pattern.label}</strong>
                <p class="text-sm text-[var(--muted)]">{pattern.note}</p>
              </div>
              <div class="mood-pattern-bar w-full sm:w-44" style={`--fill: ${pattern.value}%`}>
                <span class="mt-1 block text-right text-sm tabular-nums text-[var(--muted)]">{pattern.value}%</span>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Summary</CardTitle>
          <CardDescription>Plain-language read on this month.</CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-relaxed text-[var(--muted)]">
            Strongest days cluster around movement, quiet mornings, and fewer than three meetings. The
            biggest dips follow long meeting blocks without a reset.
          </p>
        </CardContent>
      </Card>
    </div>
  {:else if selectedSection === "Therapist"}
    <div class="grid gap-4 lg:grid-cols-2">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Therapy prep</CardTitle>
          <CardDescription>Exports and prompts for your next session.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each therapistCards as card (card.title)}
            <article class="mini-app-row flex-col items-start gap-1">
              <strong>{card.title}</strong>
              <p class="text-sm text-[var(--muted)]">{card.description}</p>
            </article>
          {/each}
        </CardContent>
      </Card>
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Talking points</CardTitle>
          <CardDescription>High-signal prompts from this month.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          <article class="mini-app-row flex-col items-start gap-1">
            <strong>Meeting overload</strong>
            <p class="text-sm text-[var(--muted)]">Why stacked calls raise anxiety faster than solo work.</p>
          </article>
          <article class="mini-app-row flex-col items-start gap-1">
            <strong>Weekend reset</strong>
            <p class="text-sm text-[var(--muted)]">Which Sunday rituals produce the rebound.</p>
          </article>
        </CardContent>
      </Card>
    </div>
  {:else}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Export</CardTitle>
        <CardDescription>Download timeline data with context.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each exportOptions as option (option.label)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <strong>{option.label}</strong>
              <p class="text-sm text-[var(--muted)]">{option.detail}</p>
            </div>
            <Button variant="outline" type="button">
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {/if}
</MiniAppRoot>
