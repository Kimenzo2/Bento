<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import BanIcon from "@lucide/svelte/icons/ban";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
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
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  const moduleId = "focus";
  const sectionLabels = ["Timer", "Sessions", "Sounds", "Blocking", "History", "Review"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  function navigateToSection(section: typeof sectionLabels[number]) {
    setModuleSection(moduleId, section, sectionLabels);
  }

  let isRunning = false;
  let timeRemaining = 25 * 60;
  let currentSession = "Pomodoro";
  let interval: ReturnType<typeof setInterval> | undefined;

  const sessions = [
    { label: "Morning writing", duration: "45 min", note: "Best uninterrupted block today." },
    { label: "Admin sweep", duration: "20 min", note: "Email and follow-ups only." },
    { label: "Design review", duration: "30 min", note: "Shared crit session with no chat." },
  ];

  const sounds = [
    { title: "Brown noise", detail: "Low distraction, no melody", active: true },
    { title: "Rain tape", detail: "Soft ambience with gentle hiss", active: false },
    { title: "Lo-fi pulse", detail: "Light rhythmic support for planning", active: false },
  ];

  const blockers = [
    { title: "Social web", detail: "Blocked for focus sessions over 20 minutes", status: "Enabled" },
    { title: "Email", detail: "Muted until session ends", status: "Conditional" },
    { title: "Team chat", detail: "Allowed only for starred contacts", status: "Smart" },
  ];

  const history = [
    { day: "Mon", minutes: 162 },
    { day: "Tue", minutes: 128 },
    { day: "Wed", minutes: 184 },
    { day: "Thu", minutes: 96 },
    { day: "Fri", minutes: 140 },
  ];

  const reviewNotes = [
    { title: "Best window", note: "First session lands fastest when started before messages open." },
    { title: "Drop-off trigger", note: "Context switching spikes after lunch unless sounds stay on." },
    { title: "Suggestion", note: "Try two 45 minute blocks instead of three shorter cycles tomorrow." },
  ];

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

<main class="focus-workspace module-root">
  <section class="focus-shell">
    <header class="focus-shell__header">
      <div class="focus-shell__intro">
        <div class="focus-shell__eyebrow">
          <span>Focus</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Keep the timer-first feel, then add sessions, sounds, blocking, history, and review inside one viewport.</h1>
        <p>The original focus timer remains the center of gravity while the shell sections unlock adjacent tools.</p>
      </div>

      <div class="focus-shell__actions">
        <Button variant="outline">
          <Volume2Icon data-icon="inline-start" />
          Sounds
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          AI review
        </Button>
      </div>
    </header>

    <section class="focus-hero-grid">
      <Card class="focus-timer-card">
        <CardHeader>
          <CardTitle>{currentSession}</CardTitle>
          <CardDescription>Single-session control stays front and center.</CardDescription>
        </CardHeader>
        <CardContent class="focus-timer-card__content">
          <div class="focus-ring">
            <svg viewBox="0 0 100 100">
              <circle class="focus-ring__bg" cx="50" cy="50" r="44"></circle>
              <circle
                class="focus-ring__progress"
                cx="50"
                cy="50"
                r="44"
                style={`stroke-dasharray:${2 * Math.PI * 44};stroke-dashoffset:${2 * Math.PI * 44 * (1 - timeRemaining / (25 * 60))};`}
              ></circle>
            </svg>
            <strong>{formatTime(timeRemaining)}</strong>
          </div>
          <div class="focus-controls">
            <button type="button" onclick={resetTimer}><RotateCcwIcon size={22} /></button>
            <button type="button" class="focus-controls__play" onclick={toggleTimer}>
              {#if isRunning}
                <PauseIcon size={28} />
              {:else}
                <PlayIcon size={28} />
              {/if}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card class="focus-hero-card">
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>Deep work minutes and protected time.</CardDescription>
        </CardHeader>
        <CardContent class="focus-hero-list">
          <article><span>Deep work</span><strong>2h 21m</strong></article>
          <article><span>Completed sessions</span><strong>4</strong></article>
          <article><span>Blocking profile</span><strong>Writing mode</strong></article>
        </CardContent>
      </Card>
    </section>

    <section class="focus-shell__body">
      {#if selectedSection === "Timer"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>Timer presets</CardTitle>
            <CardDescription>Stay close to the original timer screen while adding session variants.</CardDescription>
          </CardHeader>
          <CardContent class="focus-preset-grid">
            {#each ["Pomodoro 25", "Deep work 45", "Reset 10", "Review 15"] as preset}
              <button type="button">{preset}</button>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Sessions"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>Track what actually got protected today.</CardDescription>
          </CardHeader>
          <CardContent class="focus-session-list">
            {#each sessions as session}
              <article>
                <div>
                  <strong>{session.label}</strong>
                  <p>{session.note}</p>
                </div>
                <span>{session.duration}</span>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Sounds"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>Background sounds</CardTitle>
            <CardDescription>Light audio control without turning the module into a media player.</CardDescription>
          </CardHeader>
          <CardContent class="focus-sound-list">
            {#each sounds as sound}
              <article>
                <Volume2Icon size={18} />
                <div>
                  <strong>{sound.title}</strong>
                  <p>{sound.detail}</p>
                </div>
                <Badge variant={sound.active ? "default" : "outline"}>{sound.active ? "Active" : "Available"}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "Blocking"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>Blocking rules</CardTitle>
            <CardDescription>Website and app blocking presented as focused rules, not another nav system.</CardDescription>
          </CardHeader>
          <CardContent class="focus-block-list">
            {#each blockers as blocker}
              <article>
                <BanIcon size={18} />
                <div>
                  <strong>{blocker.title}</strong>
                  <p>{blocker.detail}</p>
                </div>
                <Badge variant="secondary">{blocker.status}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else if selectedSection === "History"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>Weekly history</CardTitle>
            <CardDescription>Compact charting that still fits inside the desktop shell.</CardDescription>
          </CardHeader>
          <CardContent class="focus-history-chart">
            {#each history as item}
              <article>
                <span>{item.day}</span>
                <i style={`--bar:${Math.max(item.minutes / 2, 20)}px`}></i>
                <strong>{item.minutes}m</strong>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>Focus review</CardTitle>
            <CardDescription>Readable summaries instead of a generic performance dashboard.</CardDescription>
          </CardHeader>
          <CardContent class="focus-review-list">
            {#each reviewNotes as note}
              <article>
                <SparklesIcon size={18} />
                <div>
                  <strong>{note.title}</strong>
                  <p>{note.note}</p>
                </div>
              </article>
            {/each}
            <article class="focus-review-list__export">
              <div>
                <strong>Export session log</strong>
                <p>Download today’s timeline and blocker profile.</p>
              </div>
              <Button variant="outline">
                <DownloadIcon data-icon="inline-start" />
                Export
              </Button>
            </article>
          </CardContent>
        </Card>
      {/if}
    </section>
  </section>
</main>

<style>
  :global(.focus-workspace) {
    --focus-bg: var(--background);
    --focus-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --focus-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --focus-border: color-mix(in srgb, var(--border) 86%, transparent);
    --focus-ink: var(--foreground);
    --focus-muted: var(--muted);
    --focus-accent: var(--primary);
    height: 100%;
    padding: 28px 30px;
    background: var(--focus-bg);
    color: var(--focus-ink);
    overflow: hidden;
    font-family: "Nunito", sans-serif;
  }

  :global(.focus-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.focus-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.focus-shell__intro) {
    max-width: 56rem;
  }

  :global(.focus-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--focus-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.focus-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.focus-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--focus-muted);
  }

  :global(.focus-shell__actions) {
    display: flex;
    gap: 12px;
  }

  :global(.focus-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 16px;
  }

  :global(.focus-timer-card),
  :global(.focus-hero-card),
  :global(.focus-panel) {
    border-color: var(--focus-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--focus-surface) 98%, var(--background)),
        color-mix(in srgb, var(--focus-surface) 86%, var(--background))
      );
  }

  :global(.focus-timer-card__content) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: center;
  }

  :global(.focus-ring) {
    position: relative;
    width: 220px;
    aspect-ratio: 1;
  }

  :global(.focus-ring) svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  :global(.focus-ring__bg),
  :global(.focus-ring__progress) {
    fill: none;
    stroke-width: 8;
  }

  :global(.focus-ring__bg) {
    stroke: color-mix(in srgb, var(--focus-border) 72%, transparent);
  }

  :global(.focus-ring__progress) {
    stroke: var(--focus-accent);
    stroke-linecap: round;
  }

  :global(.focus-ring) strong {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 700 2.8rem "JetBrains Mono", monospace;
  }

  :global(.focus-controls) {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  :global(.focus-controls) button {
    width: 56px;
    height: 56px;
    border: 1px solid var(--focus-border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--focus-surface-strong) 96%, transparent);
    color: inherit;
  }

  :global(.focus-controls__play) {
    width: 72px !important;
    height: 72px !important;
    background: var(--foreground) !important;
    color: var(--background) !important;
  }

  :global(.focus-hero-list),
  :global(.focus-session-list),
  :global(.focus-sound-list),
  :global(.focus-block-list),
  :global(.focus-review-list) {
    display: grid;
    gap: 12px;
  }

  :global(.focus-hero-list) article,
  :global(.focus-session-list) article,
  :global(.focus-sound-list) article,
  :global(.focus-block-list) article,
  :global(.focus-review-list) article {
    border: 1px solid color-mix(in srgb, var(--focus-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--focus-surface-strong) 92%, transparent);
  }

  :global(.focus-hero-list) article {
    padding: 16px 18px;
  }

  :global(.focus-hero-list) span,
  :global(.focus-session-list) p,
  :global(.focus-sound-list) p,
  :global(.focus-block-list) p,
  :global(.focus-review-list) p {
    color: var(--focus-muted);
  }

  :global(.focus-shell__body),
  :global(.focus-panel),
  :global(.focus-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.focus-panel) {
    display: flex;
    flex-direction: column;
  }

  :global(.focus-panel--full) {
    height: 100%;
  }

  :global(.focus-preset-grid),
  :global(.focus-session-list),
  :global(.focus-sound-list),
  :global(.focus-block-list),
  :global(.focus-history-chart),
  :global(.focus-review-list) {
    min-height: 0;
    overflow: auto;
  }

  :global(.focus-preset-grid) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  :global(.focus-preset-grid) button {
    padding: 18px 16px;
    border: 1px solid color-mix(in srgb, var(--focus-accent) 38%, var(--focus-border));
    border-radius: 20px;
    background: color-mix(in srgb, var(--focus-accent) 10%, var(--focus-surface));
    color: inherit;
    font: inherit;
  }

  :global(.focus-session-list) article {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 16px 18px;
  }

  :global(.focus-sound-list) article,
  :global(.focus-block-list) article {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 16px 18px;
  }

  :global(.focus-history-chart) {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
    align-items: end;
    height: 100%;
  }

  :global(.focus-history-chart) article {
    display: grid;
    justify-items: center;
    gap: 10px;
  }

  :global(.focus-history-chart) i {
    display: block;
    width: 34px;
    height: var(--bar);
    border-radius: 999px;
    background: linear-gradient(180deg, var(--focus-accent), color-mix(in srgb, var(--accent) 36%, var(--focus-accent)));
  }

  :global(.focus-review-list) article {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 12px;
    padding: 16px 18px;
  }

  :global(.focus-review-list__export) {
    grid-template-columns: 1fr auto !important;
    align-items: center;
  }
</style>
