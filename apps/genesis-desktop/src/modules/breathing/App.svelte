<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { time } from "$lib/utils/time";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  const moduleId = "breathing";
  const sectionLabels = ["Breathe", "Exercises", "History"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  type Exercise = {
    id: string;
    name: string;
    pattern: number[];
    totalSeconds: number;
  };

  type Session = {
    id: string;
    exerciseId: string;
    duration: number;
    completed: number;
  };

  const exercises: Exercise[] = [
    { id: "box", name: "Box Breathing", pattern: [4, 4, 4, 4], totalSeconds: 16 },
    { id: "478", name: "4-7-8 Breathing", pattern: [4, 7, 8], totalSeconds: 19 },
    { id: "sigh", name: "Physiological Sigh", pattern: [2, 1, 4], totalSeconds: 7 },
    { id: "relax", name: "Progressive Relaxation", pattern: [4, 2, 6], totalSeconds: 12 },
  ];

  let sessions = $state<Session[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeExercise = $state<Exercise | null>(null);
  let activePhase = $state(0);
  let phaseRemaining = $state(0);
  let activeTimer: ReturnType<typeof setInterval> | undefined;
  let activeRunning = $state(false);
  let sessionStartTime = $state(0);

  const STORAGE_KEY = "bento_breathing";
  const phaseLabels = ["Breathe In", "Hold", "Breathe Out", "Hold"];

  function load() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      sessions = raw ? JSON.parse(raw) : [];
    } catch {
      error = "Failed to load session history";
      sessions = [];
    } finally {
      loading = false;
    }
  }

  function save() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }

  function startExercise(ex: Exercise) {
    if (activeRunning) return;
    activeExercise = ex;
    activePhase = 0;
    phaseRemaining = ex.pattern[0];
    activeRunning = true;
    sessionStartTime = time.now();

    let phaseIdx = 0;
    let currentRemaining = ex.pattern[0];

    activeTimer = setInterval(() => {
      currentRemaining--;
      phaseRemaining = currentRemaining;
      if (currentRemaining <= 0) {
        phaseIdx++;
        if (phaseIdx >= ex.pattern.length) {
          phaseIdx = 0;
          currentRemaining = ex.pattern[0];
        } else {
          currentRemaining = ex.pattern[phaseIdx];
        }
        activePhase = phaseIdx;
        phaseRemaining = currentRemaining;
      }
    }, 1000);

    setTimeout(() => {
      stopExercise();
    }, 300000);
  }

  function stopExercise() {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = undefined;

    if (activeExercise && activeRunning) {
      const session: Session = {
        id: crypto.randomUUID(),
        exerciseId: activeExercise.id,
        duration: Math.floor((time.now() - sessionStartTime) / 1000),
        completed: time.now(),
      };
      sessions = [session, ...sessions];
      save();
    }

    activeRunning = false;
    activePhase = 0;
    phaseRemaining = 0;
    activeExercise = null;
  }

  function getPhaseLabel(idx: number): string {
    switch (idx) {
      case 0: return "Breathe In";
      case 1: return phaseLabels[1];
      case 2: return "Breathe Out";
      case 3: return phaseLabels[3];
      default: return "";
    }
  }

  function sessionCount(exId: string) {
    return sessions.filter((s) => s.exerciseId === exId).length;
  }

  onMount(() => load());
  onDestroy(() => {
    if (activeTimer) clearInterval(activeTimer);
  });
</script>

<main class="breathing-workspace module-root" data-module="breathing">
  <section class="breathing-shell">
    <header class="breathing-shell__header">
      <div class="breathing-shell__intro">
        <div class="breathing-shell__eyebrow">
          <span>{_t('moduleBreathingTitle')}</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>{_t('moduleBreathingDesc')}</h1>
        <p>{_t('moduleBreathingChoosePattern')}</p>
      </div>

      <div class="breathing-shell__actions">
        <Button variant="outline" onclick={() => load()}>
          {_t('commonRefresh')}
        </Button>
      </div>
    </header>

    {#if loading}
      <div class="breathing-loading">
        {#each [1, 2] as _}
          <div class="breathing-skeleton"></div>
        {/each}
      </div>

    {:else if error}
      <Card class="breathing-panel">
        <CardContent>
          <p>{error}</p>
          <Button variant="outline" onclick={() => { error = null; load(); }}>{_t('commonRetry')}</Button>
        </CardContent>
      </Card>

    {:else}
      {#if activeRunning && activeExercise}
        <section class="breathing-hero-grid">
          <Card class="breathing-active-card">
            <CardContent class="breathing-active-card__content">
              <div class="breathing-ring" class:inhale={activePhase === 0} class:hold={activePhase === 1 || activePhase === 3} class:exhale={activePhase === 2}>
                <div class="breathing-ring__inner"></div>
                <strong class="breathing-ring__label">{getPhaseLabel(activePhase)}</strong>
                <span class="breathing-ring__count">{phaseRemaining}s</span>
              </div>
              <p class="breathing-active-name">{activeExercise.name}</p>
              <Button variant="outline" onclick={stopExercise}>{_t('commonStop')}</Button>
            </CardContent>
          </Card>

          <Card class="breathing-panel">
            <CardHeader>
              <CardTitle>{_t('moduleBreathingSessionInfo')}</CardTitle>
              <CardDescription>{_t('moduleBreathingSessionInfoDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="breathing-info-list">
              <article><span>{_t('moduleBreathingPattern')}</span><strong>{activeExercise.pattern.join("-")}s</strong></article>
              <article><span>{_t('moduleBreathingTotalCycles')}</span><strong>{Math.floor((time.now() - sessionStartTime) / 1000 / activeExercise.totalSeconds)}</strong></article>
            </CardContent>
          </Card>
        </section>

      {:else}
        <section class="breathing-hero-grid">
          {#each exercises as ex}
            <Card class="breathing-exercise-card">
              <CardHeader>
                <CardTitle>{ex.name}</CardTitle>
                <CardDescription>{ex.pattern.join("-")}s pattern</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{sessionCount(ex.id)} {_t('moduleBreathingSessionsCompleted')}</p>
                <Button onclick={() => startExercise(ex)}>{_t('commonStart')}</Button>
              </CardContent>
            </Card>
          {/each}
        </section>

        {#if sessions.length > 0}
          <section class="breathing-shell__body">
            <Card class="breathing-panel breathing-panel--full">
              <CardHeader>
                <CardTitle>{_t('moduleBreathingRecentSessions')}</CardTitle>
                <CardDescription>{_t('moduleBreathingRecentSessionsDesc')}</CardDescription>
              </CardHeader>
              <CardContent class="breathing-session-list">
                {#each sessions.slice(0, 10) as session (session.id)}
                  <article>
                    <div>
                      <strong>{exercises.find((e) => e.id === session.exerciseId)?.name ?? session.exerciseId}</strong>
                      <p>{time.format(session.completed)}</p>
                    </div>
                    <span>{Math.floor(session.duration / 60)}m {session.duration % 60}s</span>
                  </article>
                {/each}
              </CardContent>
            </Card>
          </section>
        {:else}
          <section class="breathing-shell__body">
            <Card class="breathing-panel breathing-panel--full">
              <CardHeader>
                <CardTitle>{_t('commonWelcome')}</CardTitle>
                <CardDescription>{_t('moduleBreathingWelcomeDesc')}</CardDescription>
              </CardHeader>
            </Card>
          </section>
        {/if}
      {/if}
    {/if}
  </section>
</main>

<style>
  :global(.breathing-workspace) {
    --breathing-bg: var(--background);
    --breathing-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --breathing-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --breathing-border: color-mix(in srgb, var(--border) 86%, transparent);
    --breathing-ink: var(--foreground);
    --breathing-muted: var(--muted);
    --breathing-accent: var(--primary);
    height: 100%;
    padding: 28px 30px;
    background: var(--breathing-bg);
    color: var(--breathing-ink);
    overflow: hidden;
    font-family: var(--font-body);
  }

  :global(.breathing-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.breathing-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.breathing-shell__intro) {
    max-width: 56rem;
  }

  :global(.breathing-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--breathing-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.breathing-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.breathing-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--breathing-muted);
  }

  :global(.breathing-shell__actions) {
    display: flex;
    gap: 12px;
  }

  :global(.breathing-hero-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  :global(.breathing-exercise-card),
  :global(.breathing-panel),
  :global(.breathing-active-card) {
    border-color: var(--breathing-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--breathing-surface) 98%, var(--background)),
        color-mix(in srgb, var(--breathing-surface) 86%, var(--background))
      );
  }

  :global(.breathing-active-card) {
    grid-column: 1 / -1;
  }

  :global(.breathing-active-card__content) {
    display: grid;
    place-items: center;
    gap: 16px;
    padding: 32px;
  }

  :global(.breathing-ring) {
    position: relative;
    width: 140px;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
  }

  :global(.breathing-ring__inner) {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--breathing-accent) 16%, transparent);
    transition: transform 0.6s ease, opacity 0.6s ease;
  }

  :global(.breathing-ring.inhale .breathing-ring__inner) {
    transform: scale(1.35);
    opacity: 0.3;
  }

  :global(.breathing-ring.exhale .breathing-ring__inner) {
    transform: scale(0.65);
    opacity: 0.1;
  }

  :global(.breathing-ring__label) {
    z-index: 1;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--breathing-accent);
  }

  :global(.breathing-ring__count) {
    z-index: 1;
    font-size: 2.4rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  :global(.breathing-active-name) {
    color: var(--breathing-muted);
    font-size: 0.9rem;
  }

  :global(.breathing-info-list) {
    display: grid;
    gap: 12px;
  }

  :global(.breathing-info-list) article {
    display: flex;
    justify-content: space-between;
    padding: 16px 18px;
    border: 1px solid color-mix(in srgb, var(--breathing-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--breathing-surface-strong) 92%, transparent);
  }

  :global(.breathing-info-list) span {
    color: var(--breathing-muted);
  }

  :global(.breathing-shell__body),
  :global(.breathing-panel),
  :global(.breathing-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.breathing-panel) {
    display: flex;
    flex-direction: column;
  }

  :global(.breathing-panel--full) {
    height: 100%;
  }

  :global(.breathing-session-list) {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
  }

  :global(.breathing-session-list) article {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 16px 18px;
    border: 1px solid color-mix(in srgb, var(--breathing-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--breathing-surface-strong) 92%, transparent);
  }

  :global(.breathing-session-list) p {
    color: var(--breathing-muted);
  }

  :global(.breathing-session-list) span {
    color: var(--breathing-muted);
    font-variant-numeric: tabular-nums;
  }

  :global(.breathing-loading) {
    display: grid;
    gap: 12px;
  }

  :global(.breathing-skeleton) {
    height: 100px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--breathing-border) 72%, transparent);
    animation: breathing-pulse 1.5s infinite;
  }

  @keyframes breathing-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
