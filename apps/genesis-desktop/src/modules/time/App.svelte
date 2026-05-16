<script lang="ts">
  import "./time.css";
  import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SquareIcon from "@lucide/svelte/icons/square";
  import TagIcon from "@lucide/svelte/icons/tag";
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
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  let { moduleId = "time", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  let isTracking = $state(false);
  let currentTask = $state("");
  const currentTimer = "00:45:12";

  const weekDays = [
    { day: "M", hours: 6.5, height: "65%", active: false },
    { day: "T", hours: 7.2, height: "72%", active: false },
    { day: "W", hours: 8.0, height: "80%", active: false },
    { day: "T", hours: 5.4, height: "54%", active: false },
    { day: "F", hours: 2.1, height: "21%", active: true },
    { day: "S", hours: 0, height: "0%", active: false },
    { day: "S", hours: 0, height: "0%", active: false },
  ];

  const recentEntries = [
    { id: 1, task: "Genesis desktop shell", project: "Genesis", duration: "02:15:00", tone: "a" },
    { id: 2, task: "Weekly sync", project: "Internal", duration: "00:45:00", tone: "b" },
    { id: 3, task: "Email processing", project: "Admin", duration: "00:22:30", tone: "c" },
  ];
</script>

<MiniAppRoot class="time-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Time"
    title="Time tracker"
    description="One-tap timers, project tags, and a weekly hours overview."
  >
    {#snippet actions()}
      <Badge variant="outline">Today 2h 15m</Badge>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Today", value: "2h 15m", hint: "Billable + internal" },
      { label: "This week", value: "29.2h", hint: "Mon–Sun" },
      { label: "Active timer", value: isTracking ? "Running" : "Idle", hint: currentTask || "No task" },
    ]}
  />

  <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardContent class={`time-timer-panel${isTracking ? " is-tracking" : ""}`}>
      <label class="grid w-full max-w-md gap-3">
        <span class="sr-only">Task name</span>
        <Input
          bind:value={currentTask}
          placeholder="What are you working on?"
          class="time-task-input h-auto border-0 bg-transparent text-center text-xl shadow-none"
        />
        <Button type="button" variant="outline" size="sm" class="mx-auto w-fit">
          <TagIcon data-icon="inline-start" />
          Add project
        </Button>
      </label>
      <p class="time-display" aria-live="polite">{currentTimer}</p>
      <button
        type="button"
        class="time-toggle"
        class:time-toggle--start={!isTracking}
        class:time-toggle--stop={isTracking}
        aria-label={isTracking ? "Stop timer" : "Start timer"}
        onclick={() => (isTracking = !isTracking)}
      >
        {#if isTracking}
          <SquareIcon class="size-7" fill="currentColor" />
        {:else}
          <PlayIcon class="size-7" fill="currentColor" />
        {/if}
      </button>
    </CardContent>
  </Card>

  <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardHeader class="flex-row items-end justify-between space-y-0">
      <CardTitle class="font-(--font-heading) text-xl">This week</CardTitle>
      <CardDescription>29.2h total</CardDescription>
    </CardHeader>
    <CardContent>
      <section class="time-week-chart" aria-label="Weekly hours">
        {#each weekDays as day (`${day.day}-${day.height}`)}
          <span class="time-day-col">
            <span class="time-bar-track">
              <span
                class="time-bar-fill"
                class:is-today={day.active}
                style="height:{day.height}"
              ></span>
            </span>
            <span class="time-day-label" class:is-today={day.active}>{day.day}</span>
          </span>
        {/each}
      </section>
    </CardContent>
  </Card>

  <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardHeader class="flex-row items-center justify-between space-y-0">
      <CardTitle class="font-(--font-heading) text-xl">Recent entries</CardTitle>
      <Button type="button" variant="ghost" size="sm">View all</Button>
    </CardHeader>
    <CardContent class="grid gap-2">
      {#each recentEntries as entry (entry.id)}
        <article class="mini-app-row">
          <span class="flex min-w-0 items-center gap-3">
            <span class="time-project-dot time-project-dot--{entry.tone}"></span>
            <span class="min-w-0">
              <span class="block truncate font-medium">{entry.task}</span>
              <span class="block truncate text-sm text-muted-foreground">{entry.project}</span>
            </span>
          </span>
          <span class="flex items-center gap-2">
            <span class="font-mono text-sm font-semibold">{entry.duration}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Resume entry">
              <PlayIcon class="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="More options">
              <MoreHorizontalIcon class="size-4" />
            </Button>
          </span>
        </article>
      {/each}
    </CardContent>
  </Card>
</MiniAppRoot>
