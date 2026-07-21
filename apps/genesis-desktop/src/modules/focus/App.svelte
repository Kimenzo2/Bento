<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { sanitizeError } from "$lib/utils/logger";
  import { exportContentToFile } from "$lib/services/task-service";
  import BanIcon from "@lucide/svelte/icons/ban";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TimerIcon from "@lucide/svelte/icons/timer";
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeXIcon from "@lucide/svelte/icons/volume-x";
  import { startAmbient, getActiveAmbient, stopAmbientImmediate, preloadSounds, ensureAudioContext, isSoundLoaded, type SoundName } from "$lib/services/sounds";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import TrafficLogsChart from "./TrafficLogsChart.svelte";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  const moduleId = "focus";
  const sectionLabels = ["Timer", "Sessions", "Sounds", "Blocking", "History", "Review"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  type FocusPreset = {
    label: string;
    description?: string | null;
    minutes?: number | null;
  };

  type FocusCardItem = {
    title: string;
    detail: string;
    status: string;
  };

  type FocusReviewNote = {
    title: string;
    note: string;
  };

  type FocusSessionEntry = {
    id: string;
    label: string;
    duration: string;
    note: string;
    date: string;
    minutes: number;
    loggedAt: number;
  };

  type FocusHistoryEntry = {
    day: string;
    minutes: number;
    sessions: number;
  };

  type FocusDashboardData = {
    timerPresets: FocusPreset[];
    sessions: FocusSessionEntry[];
    sounds: FocusCardItem[];
    blockers: FocusCardItem[];
    history: FocusHistoryEntry[];
    reviewNotes: FocusReviewNote[];
    todayMinutes: number;
    todaySessions: number;
    thisWeekSessions: number;
    blockingProfile: string | null;
  };

  function createEmptyFocusDashboard(): FocusDashboardData {
    return {
      timerPresets: [],
      sessions: [],
      sounds: [],
      blockers: [],
      history: [],
      reviewNotes: [],
      todayMinutes: 0,
      todaySessions: 0,
      thisWeekSessions: 0,
      blockingProfile: null,
    };
  }

  let focusDashboard = $state<FocusDashboardData>(createEmptyFocusDashboard());
  let focusLoading = $state(true);
  let focusError = $state<string | null>(null);

  // Sound player state
  const focusSounds: { name: SoundName; label: string }[] = [
    { name: "gentle-rain", label: "Gentle Rain" },
    { name: "ocean-waves", label: "Ocean Waves" },
    { name: "river-flow", label: "River Flow" },
    { name: "fire-crackling", label: "Fire Crackling" },
    { name: "forest-wind", label: "Forest Wind" },
    { name: "guitar-loop", label: "Guitar Loop" },
  ];
  let activeSoundName = $state<SoundName | null>(null);
  let soundLoading = $state(false);
  function loadVolume(): number {
    try { return parseFloat(localStorage.getItem("focus:soundVolume") ?? "0.5"); }
    catch { return 0.5; }
  }
  let soundVolume = $state(loadVolume());

  function persistVolume(v: number) {
    try { localStorage.setItem("focus:soundVolume", String(v)); } catch {}
  }

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    void loadFocusDashboard();
    // Preload ambient sounds in the background
    void preloadSounds(focusSounds.map(s => s.name));
  });

  let _t = $derived.by(() => createTranslator($activeBundle));

  function navigateToSection(section: typeof sectionLabels[number]) {
    setModuleSection(moduleId, section, sectionLabels);
  }

  async function loadFocusDashboard() {
    focusLoading = true;
    focusError = null;

    try {
      focusDashboard = await invoke<FocusDashboardData>("get_focus_dashboard");
    } catch (error) {
      console.warn("[focus] failed to load dashboard:", error);
      focusDashboard = createEmptyFocusDashboard();
      focusError = error instanceof Error ? sanitizeError(error.message) : "Could not load focus data.";
    } finally {
      focusLoading = false;
    }
  }

  async function logFocusSession(minutes: number, label = currentSession, note = "Timer completed in the Focus module.") {
    if (minutes <= 0) {
      return;
    }

    try {
      await invoke("record_focus_session", {
        params: {
          label,
          minutes,
          note,
        },
      });
      await loadFocusDashboard();
    } catch (error) {
      console.warn("[focus] failed to record session:", error);
    }
  }

  function getDefaultPresets(): FocusPreset[] {
    return [
      { label: "Pomodoro", description: "Classic 25 min", minutes: 25 },
      { label: "Short Break", description: "5 min reset", minutes: 5 },
      { label: "Long Break", description: "15 min recharge", minutes: 15 },
      { label: "Deep Focus", description: "52 min block", minutes: 52 },
    ];
  }

  let timerPresets = $derived(
    focusDashboard.timerPresets.length > 0
      ? focusDashboard.timerPresets
      : getDefaultPresets()
  );

  let isRunning = $state(false);
  let timeRemaining = $state(25 * 60);
  let totalDuration = $state(25 * 60);
  let currentSession = $state("Pomodoro");
  let interval: ReturnType<typeof setInterval> | undefined;

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function selectPreset(preset: FocusPreset) {
    if (isRunning) stopTimer();
    currentSession = preset.label;
    const mins = preset.minutes ?? 25;
    totalDuration = mins * 60;
    timeRemaining = mins * 60;
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
        // Timer completed — log the session via backend
        stopTimer();
        const elapsedMinutes = Math.round(totalDuration / 60);
        void logFocusSession(elapsedMinutes, currentSession);
      }
    }, 1000);
  }

  function resetTimer() {
    stopTimer();
    timeRemaining = totalDuration;
  }

  async function handleExport() {
    try {
      const csv = await invoke<string>("export_focus_sessions");
      const saved = await exportContentToFile(
        csv,
        "focus-sessions-export.csv",
        "csv",
        "CSV files"
      );
      if (saved) {
        console.log("[focus] export saved to:", saved);
      }
    } catch (error) {
      console.warn("[focus] export failed:", error);
    }
  }

  async function toggleFocusSound(name: SoundName) {
    const current = getActiveAmbient();
    if (current?.name === name) {
      await current.stop(200);
      activeSoundName = null;
      return;
    }
    ensureAudioContext();
    soundLoading = true;
    try {
      await startAmbient(name, { volume: soundVolume, fadeInMs: 300 });
      activeSoundName = name;
    } catch (e) {
      console.warn("[focus] Failed to start sound:", e);
    } finally {
      soundLoading = false;
    }
  }

  function updateSoundVolume(v: number) {
    soundVolume = v;
    persistVolume(v);
    const current = getActiveAmbient();
    if (current) current.setVolume(v, 150);
  }

  onDestroy(() => {
    stopAmbientImmediate();
  });
</script>

<main class="focus-workspace module-root" data-module="focus">
  <section class="focus-shell">

    {#if focusLoading}
      <div class="focus-status-banner" role="status" aria-live="polite">
        <span class="focus-status-banner__dot"></span>
        <span>Loading focus data…</span>
      </div>
    {:else if focusError}
      <div class="focus-status-banner focus-status-banner--error" role="alert">
        <span class="focus-status-banner__dot"></span>
        <span>{focusError}</span>
        <Button type="button" variant="outline" size="sm" onclick={() => void loadFocusDashboard()}>
          Retry
        </Button>
      </div>
    {/if}

    <header class="focus-shell__header">
      <div class="focus-shell__intro">
        <div class="focus-shell__eyebrow">
          <TimerIcon size={13}/><span>Focus</span><Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Deep work sessions</h1>
        <p>Block distractions, track time, and build focus habits.</p>
      </div>
    </header>

    {#if selectedSection === "Timer"}
    <section class="focus-hero-grid focus-hero-grid--full">
      <Card class="focus-timer-card">
        <CardHeader>
          <CardTitle>{currentSession}</CardTitle>
          <CardDescription>Single-session control stays front and center.</CardDescription>
        </CardHeader>
        <CardContent class="focus-timer-card__content">
          <div class="focus-ring">
            <PremiumRing
              size={200}
              thickness={13}
              segments={[{ value: totalDuration > 0 ? (timeRemaining / totalDuration) * 100 : 0, color: "var(--mod-accent)", label: "Remaining" }]}
              centerLabel={currentSession}
              centerValue={formatTime(timeRemaining)}
              centerNote={isRunning ? "In session" : "Ready"}
            />
          </div>
          <div class="focus-controls">
            <button
              type="button"
              class="focus-controls__button focus-controls__button--reset"
              aria-label={_t('commonRestart')}
              onclick={resetTimer}
            >
              <RotateCcwIcon size={20} />
            </button>
            <button
              type="button"
              class="focus-controls__button focus-controls__button--play"
              aria-label={isRunning ? _t('moduleFocusPause') : _t('moduleFocusStart')}
              onclick={toggleTimer}
            >
              {#if isRunning}
                <PauseIcon size={26} />
              {:else}
                <PlayIcon size={26} />
              {/if}
            </button>
          </div>
        </CardContent>
        <div class="focus-timer-presets">
          <div class="focus-preset-grid">
            {#each timerPresets as preset}
              <button
                type="button"
                class:focus-preset-btn--active={currentSession === preset.label}
                onclick={() => selectPreset(preset)}
                disabled={isRunning}
              >
                <strong>{preset.label}</strong>
                {#if preset.description}
                  <p>{preset.description}</p>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </Card>
        </section>
    {/if}



        {#if selectedSection !== "Timer"}
    <section class="focus-shell__body">
      {#if selectedSection === "Sessions"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusRecentSessions')}</CardTitle>
            <CardDescription>Track what actually got protected today.</CardDescription>
          </CardHeader>
          <CardContent class="focus-session-list">
            {#if focusLoading}
              <div class="focus-empty-state focus-empty-state--wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>
                </svg>
                <div>
                  <strong>Loading sessions</strong>
                  <p>Loading recent protected sessions.</p>
                </div>
              </div>
            {:else if focusDashboard.sessions.length === 0}
              <div class="focus-empty-state focus-empty-state--wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 7v5l3 2"></path>
                </svg>
                <div>
                  <strong>No sessions yet</strong>
                  <p>Once you complete a focus block, it will appear here.</p>
                </div>
              </div>
            {:else}
              {#each focusDashboard.sessions as session}
                <article>
                  <div>
                    <strong>{session.label}</strong>
                    <p>{session.note}</p>
                  </div>
                  <span>{session.duration}</span>
                </article>
              {/each}
            {/if}
          </CardContent>
        </Card>
      {:else if selectedSection === "Sounds"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusBackgroundSounds')}</CardTitle>
            <CardDescription>Pick an ambient sound to play during your focus session.</CardDescription>
          </CardHeader>
          <CardContent class="focus-sound-list">
            <div class="focus-sound-grid">
              {#each focusSounds as snd}
                {const isActive = activeSoundName === snd.name}
                <button
                  type="button"
                  class="focus-sound-card"
                  class:focus-sound-card--active={isActive}
                  class:focus-sound-card--loading={soundLoading && isActive}
                  disabled={soundLoading}
                  onclick={() => toggleFocusSound(snd.name)}
                  aria-pressed={isActive}
                  aria-label={isActive ? `Stop ${snd.label}` : `Play ${snd.label}`}
                >
                  {#if isActive}
                    <Volume2Icon size={20} />
                  {:else}
                    <VolumeXIcon size={20} />
                  {/if}
                  <span>{snd.label}</span>
                  {#if isActive}
                    <small class="focus-sound-card__badge">Playing</small>
                  {:else if soundLoading}
                    <small class="focus-sound-card__badge">Loading…</small>
                  {/if}
                </button>
              {/each}
            </div>
            <div class="focus-sound-volume">
              <label for="focus-volume">Volume</label>
              <input
                id="focus-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                oninput={(e) => updateSoundVolume(parseFloat((e.target as HTMLInputElement).value))}
              />
              <span>{Math.round(soundVolume * 100)}%</span>
            </div>
          </CardContent>
        </Card>
      {:else if selectedSection === "Blocking"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusBlockingRules')}</CardTitle>
            <CardDescription>Website and app blocking presented as focused rules, not another nav system.</CardDescription>
          </CardHeader>
          <CardContent class="focus-block-list">
            {#if focusLoading}
              <div class="focus-empty-state focus-empty-state--wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M8 8l8 8"></path><path d="M16 8l-8 8"></path>
                </svg>
                <div>
                  <strong>Loading blocking rules</strong>
                  <p>Loading blocking profiles.</p>
                </div>
              </div>
            {:else if focusDashboard.blockers.length === 0}
              <div class="focus-empty-state focus-empty-state--wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M8 8l8 8"></path><path d="M16 8l-8 8"></path>
                </svg>
                <div>
                  <strong>No blocking rules saved</strong>
                  <p>Keep this card for future rules without showing mock blockers.</p>
                </div>
              </div>
            {:else}
              {#each focusDashboard.blockers as blocker}
                <article>
                  <BanIcon size={18} />
                  <div>
                    <strong>{blocker.title}</strong>
                    <p>{blocker.detail}</p>
                  </div>
                  <Badge variant="secondary">{blocker.status}</Badge>
                </article>
              {/each}
            {/if}
          </CardContent>
        </Card>
      {:else if selectedSection === "History"}
        <TrafficLogsChart />
      {:else}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusReview')}</CardTitle>
            <CardDescription>Readable summaries instead of a generic performance dashboard.</CardDescription>
          </CardHeader>
          <CardContent class="focus-review-list">
            {#if focusLoading}
              <div class="focus-empty-state focus-empty-state--wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3l2.9 5.88L21 10l-4.5 4.38L17.88 21 12 17.88 6.12 21 7.5 14.38 3 10l6.1-1.12L12 3z"></path>
                </svg>
                <div>
                  <strong>Loading review notes</strong>
                  <p>Assembling the patterns for this section.</p>
                </div>
              </div>
            {:else if focusDashboard.reviewNotes.length === 0}
              <div class="focus-empty-state focus-empty-state--wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3l2.9 5.88L21 10l-4.5 4.38L17.88 21 12 17.88 6.12 21 7.5 14.38 3 10l6.1-1.12L12 3z"></path>
                </svg>
                <div>
                  <strong>No review notes yet</strong>
                  <p>Run a few focus sessions and patterns will start appearing here.</p>
                </div>
              </div>
            {:else}
              {#each focusDashboard.reviewNotes as note}
                <article>
                  <SparklesIcon size={18} />
                  <div>
                    <strong>{note.title}</strong>
                    <p>{note.note}</p>
                  </div>
                </article>
              {/each}
            {/if}
            <article class="focus-review-list__export">
              <div>
                <strong>Export session log</strong>
                <p>Download today’s timeline and blocker profile.</p>
              </div>
              <Button variant="outline" disabled={focusDashboard.sessions.length === 0} onclick={handleExport}>
                <DownloadIcon data-icon="inline-start" />
                {_t('commonExport')}
              </Button>
            </article>
          </CardContent>
        </Card>
      {/if}
    </section>
    {/if}
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
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    height: 100%;
    padding: 0;
    background: var(--focus-bg);
    color: var(--focus-ink);
    overflow: hidden;
    font-family: var(--font-body);
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(.focus-workspace) button,
  :global(.focus-workspace) input,
  :global(.focus-workspace) select {
    user-select: none;
  }

  :global(.focus-workspace) ::selection {
    background: color-mix(in srgb, var(--focus-accent) 22%, transparent);
    color: var(--focus-ink);
  }

  :global(.focus-shell) {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    min-height: 0;
    padding: 28px 30px;
    box-sizing: border-box;
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
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--focus-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.focus-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    font-family: var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  :global(.focus-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--focus-muted);
    font-size: 0.97rem;
    line-height: 1.55;
    text-wrap: pretty;
  }

  :global(.focus-status-banner) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: 1px solid var(--focus-border);
    border-radius: 16px;
    background: color-mix(in srgb, var(--focus-surface) 94%, var(--background));
    color: var(--focus-ink);
  }

  :global(.focus-status-banner--error) {
    border-color: color-mix(in srgb, #ef4444 38%, var(--focus-border));
    background: color-mix(in srgb, #ef4444 10%, var(--focus-surface));
  }

  :global(.focus-status-banner__dot) {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--focus-accent);
    flex-shrink: 0;
  }

  :global(.focus-status-banner--error) .focus-status-banner__dot {
    background: #ef4444;
  }

  :global(.focus-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 16px;
  }

  :global(.focus-hero-grid--full) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  :global(.focus-hero-grid--full > .focus-timer-card) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: calc(100% - 48px);
    border-radius: 16px;
    margin: 16px 24px 24px;
  }

  :global(.focus-timer-card),
  :global(.focus-panel) {
    border-color: var(--focus-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--focus-surface) 98%, var(--background)),
        color-mix(in srgb, var(--focus-surface) 86%, var(--background))
      );
  }

  :global(.focus-hero-grid--full > .focus-timer-card > div) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :global(.focus-timer-card__content) {
    flex: 1;
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
    /* Space Grotesk — timer digits ONLY. tnum keeps digits equal-width so
       the display never jumps as seconds change. */
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-size: 64px;
    font-weight: 700;
    letter-spacing: -0.03em;
    font-feature-settings: "tnum";
    line-height: 1;
  }

  :global(.focus-controls) {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  :global(.focus-controls__button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 160ms var(--ease-spring), background-color 160ms ease, border-color 160ms ease;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.focus-controls__button:hover) {
      transform: translateY(-1px);
    }
  }

  :global(.focus-controls__button:active) {
    transform: translateY(0) scale(0.96);
  }

  :global(.focus-controls__button--reset) {
    width: 52px;
    height: 52px;
    border: 1px solid var(--focus-border);
    background: color-mix(in srgb, var(--focus-surface-strong) 90%, transparent);
    color: var(--focus-ink);
  }

  :global(.focus-controls__button--reset:hover) {
    background: color-mix(in srgb, var(--focus-surface-strong) 100%, transparent);
    border-color: color-mix(in srgb, var(--focus-border) 140%, transparent);
  }

  :global(.focus-controls__button--play) {
    width: 68px;
    height: 68px;
    border: none;
    background: var(--focus-ink);
    color: var(--focus-bg);
  }

  :global(.focus-controls__button--play:hover) {
    background: color-mix(in srgb, var(--focus-ink) 88%, transparent);
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
  :global(.focus-block-list) article,
  :global(.focus-review-list) article {
    border: 1px solid color-mix(in srgb, var(--focus-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--focus-surface-strong) 92%, transparent);
  }

  :global(.focus-hero-list) article {
    padding: 16px 18px;
  }

  /* ── Sound grid ── */
  :global(.focus-sound-grid) {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  :global(.focus-sound-card) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 14px;
    border: 1px solid color-mix(in srgb, var(--focus-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--focus-surface-strong) 92%, transparent);
    color: var(--focus-ink);
    font: inherit;
    cursor: pointer;
    transition: border-color 160ms ease, background-color 160ms ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.focus-sound-card:hover) {
      border-color: color-mix(in srgb, var(--focus-accent) 40%, var(--focus-border));
      background: color-mix(in srgb, var(--focus-accent) 8%, var(--focus-surface-strong));
    }
  }

  :global(.focus-sound-card:active) {
    transform: scale(0.96);
  }

  :global(.focus-sound-card--active) {
    border-color: var(--focus-accent) !important;
    background: color-mix(in srgb, var(--focus-accent) 16%, var(--focus-surface)) !important;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-accent) 30%, transparent);
  }

  :global(.focus-sound-card--loading) {
    opacity: 0.6;
    cursor: wait;
  }

  :global(.focus-sound-card:disabled) {
    opacity: 0.5;
    cursor: default;
  }

  :global(.focus-sound-card span) {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
  }

  :global(.focus-sound-card__badge) {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--focus-accent);
  }

  :global(.focus-sound-volume) {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 12px 16px;
    border: 1px solid color-mix(in srgb, var(--focus-border) 92%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--focus-surface-strong) 94%, transparent);
  }

  :global(.focus-sound-volume label) {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--focus-muted);
    white-space: nowrap;
  }

  :global(.focus-sound-volume input[type="range"]) {
    flex: 1;
    accent-color: var(--focus-accent);
    height: 4px;
  }

  :global(.focus-sound-volume span) {
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    color: var(--focus-muted);
    min-width: 36px;
    text-align: right;
  }

  :global(.focus-empty-state) {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    min-height: 0;
    padding: 10px 0 0;
    color: var(--focus-muted);
  }

  :global(.focus-empty-state--center) {
    align-items: center;
  }

  :global(.focus-empty-state--wide) {
    padding-top: 6px;
  }

  :global(.focus-empty-state) svg {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    color: currentColor;
  }

  :global(.focus-empty-state p) {
    margin: 0;
    line-height: 1.45;
  }

  :global(.focus-empty-state strong) {
    display: block;
    margin-bottom: 2px;
    color: var(--focus-ink);
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

  :global(.focus-shell__body) {
    flex: 1;
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
    cursor: pointer;
    transition: transform 160ms var(--ease-spring), border-color 160ms ease, background-color 160ms ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  :global(.focus-preset-btn--active) {
    border-color: var(--focus-accent) !important;
    background: color-mix(in srgb, var(--focus-accent) 22%, var(--focus-surface)) !important;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-accent) 30%, transparent);
  }

  :global(.focus-preset-grid) button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.focus-preset-grid) button:not(:disabled):hover {
      border-color: color-mix(in srgb, var(--focus-accent) 60%, var(--focus-border));
      background: color-mix(in srgb, var(--focus-accent) 16%, var(--focus-surface));
    }
  }

  :global(.focus-preset-grid) button:active:not(:disabled) {
    transform: scale(0.96);
  }

  :global(.focus-preset-grid) button p {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--focus-muted);
  }

  :global(.focus-timer-presets) {
    padding: 0 24px 20px;
  }

  :global(.focus-session-list) article {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 16px 18px;
  }

  :global(.focus-block-list) article {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 16px 18px;
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

  /* ── Reduced Motion ─────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    :global(.focus-controls__button),
    :global(.focus-sound-card),
    :global(.focus-preset-grid) button {
      transition: none !important;
    }
    :global(.focus-controls__button:active),
    :global(.focus-sound-card:active),
    :global(.focus-preset-grid) button:active:not(:disabled) {
      transform: none !important;
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.focus-controls__button:hover),
      :global(.focus-sound-card:hover),
      :global(.focus-preset-grid) button:not(:disabled):hover {
        transform: none !important;
      }
    }
  }
</style>
