<script lang="ts">
  import MoonStarIcon from "@lucide/svelte/icons/moon-star";
  import DownloadIcon from "@lucide/svelte/icons/download";
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
  import {
    MiniAppRoot,
    MiniAppHeader,
    MiniAppStatGrid,
  } from "$lib/modules/mini-app/index.js";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import "./sleep.css";

  const moduleId = "sleep";
  const sectionLabels = ["Tonight", "Score", "Routine", "Trends", "Alarm", "Export"] as const;

  const selectedSection = $derived(
    getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels),
  );

  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  const tonightFocus = [
    { label: "Wind-down", value: "22:15", note: "Reading lamp, no inbox after 10pm." },
    { label: "Target sleep", value: "7h 50m", note: "Recovery for tomorrow's training." },
    { label: "Bedroom", value: "19°C", note: "Cooling starts 30 min before bed." },
  ];

  const sleepStages = [
    { label: "Deep", value: "2h 04m", fill: 72 },
    { label: "REM", value: "1h 41m", fill: 58 },
    { label: "Light", value: "3h 57m", fill: 83 },
    { label: "Awake", value: "18m", fill: 16 },
  ];

  const routine = [
    { title: "Dim lights", status: "Done", note: "45 min before bed." },
    { title: "Phone docked", status: "Done", note: "Charging outside the room." },
    { title: "Stretch shoulders", status: "Next", note: "6 min unwind queued." },
    { title: "Set smart alarm", status: "Ready", note: "Wake window 06:15–06:45." },
  ];

  const weeklyTrend = [
    { day: "Mon", score: 62 },
    { day: "Tue", score: 74 },
    { day: "Wed", score: 58 },
    { day: "Thu", score: 82 },
    { day: "Fri", score: 69 },
    { day: "Sat", score: 77 },
    { day: "Sun", score: 71 },
  ];

  const alarms = [
    { label: "Weekday sunrise", time: "06:35", window: "20 min light-sleep window", mode: "Smart" },
    { label: "Saturday recovery", time: "07:25", window: "Gentle chime + blinds", mode: "Flexible" },
    { label: "Travel fallback", time: "06:00", window: "Hotel vibration only", mode: "Backup" },
  ];

  const exportOptions = [
    { title: "Sleep PDF", detail: "Last 30 nights with score and routine adherence." },
    { title: "CSV stages", detail: "Deep, REM, and wake events for analysis." },
    { title: "Shareable recap", detail: "One-page summary for coach or clinician." },
  ];
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Sleep"
    title="Last night"
    description="Score, stages, routine, and smart alarms in one place."
  >
    {#snippet actions()}
      <Badge variant="outline" class="rounded-full">{selectedSection}</Badge>
      <Button variant="outline" type="button">
        <MoonStarIcon data-icon="inline-start" />
        Night mode
      </Button>
      <Button type="button">
        <SparklesIcon data-icon="inline-start" />
        Bedtime tips
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    columns={3}
    stats={[
      { label: "Sleep score", value: "82", hint: "+11% vs weekly avg" },
      { label: "Duration", value: "7h 42m", hint: "Last night" },
      { label: "Smart wake", value: "06:35", hint: "Target window" },
    ]}
  />

  <div class="grid gap-4 lg:grid-cols-2">
    <Card
      class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
    >
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Recovery</CardTitle>
        <CardDescription>7h 42m total with a strong deep-sleep share.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-6">
        <div class="sleep-orb" style="--sleep-fill: 82%">
          <strong>82</strong>
          <small>score</small>
        </div>
        <div class="grid flex-1 gap-3 min-w-[12rem]">
          <div>
            <strong class="text-xl text-[var(--foreground)]">+11%</strong>
            <p class="text-sm text-[var(--muted)]">vs weekly average</p>
          </div>
          <div>
            <strong class="text-xl text-[var(--foreground)]">06:35</strong>
            <p class="text-sm text-[var(--muted)]">Smart wake target</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card
      class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
    >
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Tonight</CardTitle>
        <CardDescription>Wind-down and environment targets.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each tonightFocus as item (item.label)}
          <article class="mini-app-row flex-col items-start gap-1 sm:flex-row sm:items-center">
            <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{item.label}</span>
            <strong class="text-[var(--foreground)]">{item.value}</strong>
            <p class="text-sm text-[var(--muted)] sm:ml-auto sm:text-right">{item.note}</p>
          </article>
        {/each}
      </CardContent>
    </Card>
  </div>

  <section class="grid gap-4">
    {#if selectedSection === "Tonight"}
      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Tonight plan</CardTitle>
            <CardDescription>Targets before lights out.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2">
            {#each tonightFocus as item (item.label)}
              <article class="mini-app-row flex-col items-start gap-1">
                <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{item.label}</span>
                <strong>{item.value}</strong>
                <p class="text-sm text-[var(--muted)]">{item.note}</p>
              </article>
            {/each}
          </CardContent>
        </Card>
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Pre-sleep checklist</CardTitle>
            <CardDescription>Routine steps for tonight.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2">
            {#each routine as step (step.title)}
              <article class="mini-app-row">
                <div class="min-w-0">
                  <strong class="text-[var(--foreground)]">{step.title}</strong>
                  <p class="text-sm text-[var(--muted)]">{step.note}</p>
                </div>
                <Badge variant={step.status === "Done" ? "default" : "secondary"}>{step.status}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Score"}
      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Stage balance</CardTitle>
            <CardDescription>What drove last night's score.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-3">
            {#each sleepStages as stage (stage.label)}
              <article class="grid gap-2">
                <div class="flex justify-between gap-2 text-sm">
                  <strong>{stage.label}</strong>
                  <span class="text-[var(--muted)]">{stage.value}</span>
                </div>
                <div class="mini-app-progress h-2">
                  <span style={`width: ${stage.fill}%`}></span>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Breakdown</CardTitle>
            <CardDescription>Duration, consistency, and recovery.</CardDescription>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-3">
            {#each [
              { label: "Duration", value: "88" },
              { label: "Consistency", value: "79" },
              { label: "Recovery", value: "84" },
              { label: "Wake stability", value: "81" },
            ] as row (row.label)}
              <article class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--card)_96%,var(--background))] p-4">
                <span class="text-sm text-[var(--muted)]">{row.label}</span>
                <strong class="mt-2 block text-3xl text-[var(--foreground)]">{row.value}</strong>
              </article>
            {/each}
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Routine"}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Bedtime routine</CardTitle>
          <CardDescription>Ordered steps with status.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each routine as step, index (step.title)}
            <article class="mini-app-row">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--primary)_14%,var(--card))] text-sm font-semibold text-[var(--foreground)]"
              >
                {index + 1}
              </span>
              <div class="min-w-0 flex-1">
                <strong>{step.title}</strong>
                <p class="text-sm text-[var(--muted)]">{step.note}</p>
              </div>
              <Badge variant={step.status === "Done" ? "default" : "outline"}>{step.status}</Badge>
            </article>
          {/each}
        </CardContent>
      </Card>
    {:else if selectedSection === "Trends"}
      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Weekly trend</CardTitle>
            <CardDescription>Seven-day sleep scores.</CardDescription>
          </CardHeader>
          <CardContent class="sleep-trend-chart">
            {#each weeklyTrend as item (item.day)}
              <article>
                <span class="text-xs text-[var(--muted)]">{item.day}</span>
                <i style={`--bar: ${item.score}%`}></i>
                <strong class="text-sm">{item.score}</strong>
              </article>
            {/each}
          </CardContent>
        </Card>
        <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <CardHeader>
            <CardTitle class="font-[var(--font-heading)] text-xl">Notes</CardTitle>
            <CardDescription>Patterns from the past week.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-2">
            <article class="mini-app-row flex-col items-start gap-1">
              <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Best night</span>
              <strong>Thursday</strong>
              <p class="text-sm text-[var(--muted)]">Longest deep sleep after screens off by 9:30 PM.</p>
            </article>
            <article class="mini-app-row flex-col items-start gap-1">
              <span class="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Weakest</span>
              <strong>Wednesday</strong>
              <p class="text-sm text-[var(--muted)]">Late caffeine shortened recovery.</p>
            </article>
          </CardContent>
        </Card>
      </div>
    {:else if selectedSection === "Alarm"}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Alarms</CardTitle>
          <CardDescription>Smart wake presets and backups.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each alarms as alarm (alarm.label)}
            <article class="mini-app-row">
              <div class="min-w-0">
                <strong>{alarm.label}</strong>
                <p class="text-sm text-[var(--muted)]">{alarm.window}</p>
              </div>
              <span class="shrink-0 font-mono text-lg font-semibold tabular-nums">{alarm.time}</span>
              <Badge variant="secondary">{alarm.mode}</Badge>
            </article>
          {/each}
        </CardContent>
      </Card>
    {:else}
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-xl">Export</CardTitle>
          <CardDescription>Download sleep history.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each exportOptions as option (option.title)}
            <article class="mini-app-row">
              <div class="min-w-0">
                <strong>{option.title}</strong>
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
  </section>
</MiniAppRoot>
