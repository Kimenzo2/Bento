<script lang="ts">
  import "./focus.css";
  import { onDestroy, onMount } from "svelte";
  import BanIcon from "@lucide/svelte/icons/ban";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
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
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  const moduleId = "focus";
  const sectionLabels = ["Timer", "Sessions", "Sounds", "Blocking", "History", "Review"] as const;
  const selectedSection = $derived(
    getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels),
  );

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  let isRunning = $state(false);
  let timeRemaining = $state(25 * 60);
  let currentSession = $state("Pomodoro");
  let interval: ReturnType<typeof setInterval> | undefined;

  const sessions = [
    { label: "Morning writing", duration: "45 min", note: "Uninterrupted draft block." },
    { label: "Admin sweep", duration: "20 min", note: "Email and follow-ups." },
    { label: "Design review", duration: "30 min", note: "Crit session, chat off." },
  ];

  const sounds = [
    { title: "Brown noise", detail: "Low distraction", active: true },
    { title: "Rain", detail: "Soft ambient hiss", active: false },
    { title: "Lo-fi pulse", detail: "Light rhythm for planning", active: false },
  ];

  const blockers = [
    { title: "Social web", detail: "Blocked during sessions over 20 min", status: "Enabled" },
    { title: "Email", detail: "Muted until session ends", status: "Conditional" },
    { title: "Team chat", detail: "Starred contacts only", status: "Smart" },
  ];

  const history = [
    { day: "Mon", minutes: 162 },
    { day: "Tue", minutes: 128 },
    { day: "Wed", minutes: 184 },
    { day: "Thu", minutes: 96 },
    { day: "Fri", minutes: 140 },
  ];

  const reviewNotes = [
    { title: "Best window", note: "First block works best before opening messages." },
    { title: "Drop-off", note: "Afternoon context switches spike without ambient sound." },
    { title: "Tomorrow", note: "Try two 45-minute blocks instead of three short ones." },
  ];

  const ringLength = 2 * Math.PI * 44;

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function stopTimer() {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
    isRunning = false;
  }

  function toggleTimer() {
    if (isRunning) {
      stopTimer();
      return;
    }

    isRunning = true;
    interval = setInterval(() => {
      if (timeRemaining > 0) {
        timeRemaining -= 1;
      } else {
        stopTimer();
      }
    }, 1000);
  }

  function resetTimer() {
    stopTimer();
    timeRemaining = 25 * 60;
  }

  onDestroy(() => stopTimer());
</script>

<MiniAppRoot class="focus-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Focus"
    title="Deep work timer"
    description="Pomodoro presets, ambient sound, blocking rules, and session history."
  >
    {#snippet actions()}
      <Badge variant="outline">{selectedSection}</Badge>
      <Button variant="outline" type="button">
        <Volume2Icon data-icon="inline-start" />
        Sounds
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Deep work today", value: "2h 21m", hint: "Across 4 sessions" },
      { label: "Completed", value: "4", hint: "Sessions finished" },
      { label: "Profile", value: "Writing", hint: "Blocking mode" },
    ]}
  />

  <div class="focus-hero">
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)]">{currentSession}</CardTitle>
        <CardDescription>Tap play to start the current interval.</CardDescription>
      </CardHeader>
      <CardContent class="focus-timer-card__content">
        <div aria-hidden="true" class="focus-ring">
          <svg viewBox="0 0 100 100">
            <circle class="focus-ring__bg" cx="50" cy="50" r="44"></circle>
            <circle
              class="focus-ring__progress"
              cx="50"
              cy="50"
              r="44"
              style="stroke-dasharray:{ringLength};stroke-dashoffset:{ringLength * (1 - timeRemaining / (25 * 60))};"
            ></circle>
          </svg>
          <strong>{formatTime(timeRemaining)}</strong>
        </div>
        <div class="focus-controls" aria-label="Timer controls">
          <button type="button" onclick={resetTimer} aria-label="Reset timer">
            <RotateCcwIcon size={22} />
          </button>
          <button
            type="button"
            class="focus-controls__play"
            onclick={toggleTimer}
            aria-label={isRunning ? "Pause timer" : "Start timer"}
          >
            {#if isRunning}
              <PauseIcon size={28} />
            {:else}
              <PlayIcon size={28} />
            {/if}
          </button>
        </div>
      </CardContent>
    </Card>

    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Today</CardTitle>
        <CardDescription>Protected minutes at a glance.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        <article class="mini-app-row">
          <span class="text-sm text-[var(--muted)]">Deep work</span>
          <strong>2h 21m</strong>
        </article>
        <article class="mini-app-row">
          <span class="text-sm text-[var(--muted)]">Sessions</span>
          <strong>4</strong>
        </article>
        <article class="mini-app-row">
          <span class="text-sm text-[var(--muted)]">Blocking</span>
          <strong>Writing mode</strong>
        </article>
      </CardContent>
    </Card>
  </div>

  <Card class="focus-section-panel surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-xl">{selectedSection}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      {#if selectedSection === "Timer"}
        <div class="focus-preset-grid">
          {#each ["Pomodoro 25", "Deep work 45", "Break 10", "Review 15"] as preset}
            <button type="button">{preset}</button>
          {/each}
        </div>
      {:else if selectedSection === "Sessions"}
        {#each sessions as session (session.label)}
          <article class="mini-app-row">
            <div>
              <p class="font-medium text-[var(--foreground)]">{session.label}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{session.note}</p>
            </div>
            <span class="shrink-0 text-sm font-medium">{session.duration}</span>
          </article>
        {/each}
      {:else if selectedSection === "Sounds"}
        {#each sounds as sound (sound.title)}
          <article class="mini-app-row">
            <Volume2Icon class="size-[1.125rem] shrink-0 text-[var(--muted)]" />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-[var(--foreground)]">{sound.title}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{sound.detail}</p>
            </div>
            <Badge variant={sound.active ? "default" : "outline"}>
              {sound.active ? "On" : "Off"}
            </Badge>
          </article>
        {/each}
      {:else if selectedSection === "Blocking"}
        {#each blockers as blocker (blocker.title)}
          <article class="mini-app-row">
            <BanIcon class="size-[1.125rem] shrink-0 text-[var(--muted)]" />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-[var(--foreground)]">{blocker.title}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{blocker.detail}</p>
            </div>
            <Badge variant="secondary">{blocker.status}</Badge>
          </article>
        {/each}
      {:else if selectedSection === "History"}
        <div class="focus-history-chart">
          {#each history as item (item.day)}
            <article>
              <span class="text-xs font-medium text-[var(--muted)]">{item.day}</span>
              <i style="--bar:{Math.max(item.minutes / 2, 20)}px"></i>
              <strong class="text-sm">{item.minutes}m</strong>
            </article>
          {/each}
        </div>
      {:else}
        {#each reviewNotes as note (note.title)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{note.title}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{note.note}</p>
            </div>
          </article>
        {/each}
        <article class="mini-app-row">
          <div class="min-w-0">
            <p class="font-medium text-[var(--foreground)]">Export session log</p>
            <p class="mt-1 text-sm text-[var(--muted)]">Timeline and blocker profile for today.</p>
          </div>
          <Button variant="outline" type="button">
            <DownloadIcon data-icon="inline-start" />
            Export
          </Button>
        </article>
      {/if}
    </CardContent>
  </Card>
</MiniAppRoot>
