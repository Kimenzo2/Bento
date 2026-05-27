<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { activeBundle, createTranslator } from "$lib/i18n";
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
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  const moduleId = "focus";
  const sectionLabels = ["Timer", "Sessions", "Sounds", "Blocking", "History", "Review", "Quick Timer"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  let _t = $derived.by(() => createTranslator($activeBundle));

  function navigateToSection(section: typeof sectionLabels[number]) {
    setModuleSection(moduleId, section, sectionLabels);
  }

  let isRunning = $state(false);
  let timeRemaining = $state(25 * 60);
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

  // ── Quick Timer (ported from Journal's Focus section) ────────────────
  let qtActive = $state(false);
  let qtSeconds = $state(25 * 60);
  let qtInterval: ReturnType<typeof setInterval> | null = null;

  let qtSessions = $state([
    { label: 'Morning deep work', duration: '52 min', date: 'Today' },
    { label: 'Writing block', duration: '25 min', date: 'Today' },
    { label: 'Research reading', duration: '40 min', date: 'Yesterday' },
  ]);
  let qtWeekCount = $state([3, 5, 2, 4, 4, 0, 0]);

  let qtMin = $derived(String(Math.floor(qtSeconds / 60)).padStart(2, '0'));
  let qtSec = $derived(String(qtSeconds % 60).padStart(2, '0'));
  let qtProgress = $derived(1 - qtSeconds / (25 * 60));

  let totalQtMin = $derived(
    qtSessions
      .filter(s => s.date === 'Today')
      .reduce((acc, s) => acc + (parseInt(s.duration) || 0), 0)
  );
  let totalQtSessions = $derived(qtSessions.length);

  function toggleQtTimer() {
    if (qtActive) {
      if (qtInterval) clearInterval(qtInterval);
      qtActive = false;
      qtInterval = null;
      const elapsed = 25 * 60 - qtSeconds;
      if (elapsed > 60) {
        const mins = Math.round(elapsed / 60);
        qtSessions = [
          { label: `Focus session`, duration: `${mins} min`, date: 'Today' },
          ...qtSessions,
        ];
      }
    } else {
      qtActive = true;
      qtInterval = setInterval(() => {
        if (qtSeconds > 0) qtSeconds--;
        else {
          if (qtInterval) clearInterval(qtInterval);
          qtActive = false;
          qtInterval = null;
          qtSeconds = 25 * 60;
          qtSessions = [{ label: `Completed focus`, duration: '25 min', date: 'Today' }, ...qtSessions];
        }
      }, 1000);
    }
  }

  function resetQtTimer() {
    if (qtInterval) clearInterval(qtInterval);
    qtActive = false;
    qtInterval = null;
    qtSeconds = 25 * 60;
  }
</script>

<main class="focus-workspace module-root" data-module="focus">
  <section class="focus-shell">
    <header class="focus-shell__header">
      <div class="focus-shell__intro">
        <div class="focus-shell__eyebrow">
          <span>{_t('moduleFocusTitle')}</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>{_t('moduleFocusDesc')}</h1>
        <p>The original focus timer remains the center of gravity while the shell sections unlock adjacent tools.</p>
      </div>

      <div class="focus-shell__actions">
        <Button variant="outline">
          <Volume2Icon data-icon="inline-start" />
          {_t('moduleFocusSounds')}
        </Button>
        <Button>
          <SparklesIcon data-icon="inline-start" />
          {_t('moduleFocusAIReview')}
        </Button>
      </div>
    </header>

    {#if selectedSection === "Timer"}
    <section class="focus-hero-grid">
      <Card class="focus-timer-card">
        <CardHeader>
          <CardTitle>{currentSession}</CardTitle>
          <CardDescription>Single-session control stays front and center.</CardDescription>
        </CardHeader>
        <CardContent class="focus-timer-card__content">
          <div class="focus-ring">
            <PremiumRing
              size={148}
              thickness={12}
              segments={[{ value: (timeRemaining / (25 * 60)) * 100, color: "var(--mod-accent)", label: "Remaining" }]}
              centerLabel={currentSession}
              centerValue={formatTime(timeRemaining)}
              centerNote={isRunning ? "In session" : "Ready"}
            />
          </div>
          <div class="focus-controls">
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="focus-controls__button focus-controls__button--reset"
              aria-label={_t('commonRestart')}
              onclick={resetTimer}
            >
              <RotateCcwIcon size={22} />
            </Button>
            <Button
              type="button"
              variant="default"
              class="focus-controls__button focus-controls__button--play"
              aria-label={isRunning ? _t('moduleFocusPause') : _t('moduleFocusStart')}
              onclick={toggleTimer}
            >
              {#if isRunning}
                <PauseIcon size={28} />
              {:else}
                <PlayIcon size={28} />
              {/if}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card class="focus-hero-card">
        <CardHeader>
          <CardTitle>{_t('moduleFocusToday')}</CardTitle>
          <CardDescription>Deep work minutes and protected time.</CardDescription>
        </CardHeader>
        <CardContent class="focus-hero-list">
          <article><span>Deep work</span><strong>2h 21m</strong></article>
          <article><span>Completed sessions</span><strong>4</strong></article>
          <article><span>Blocking profile</span><strong>Writing mode</strong></article>
        </CardContent>
      </Card>
    </section>
    {/if}

    {#if selectedSection === "Quick Timer"}
    <!-- Ported exactly from Journal's Focus section — bento cards -->
    <section class="qt-bento">
      <!-- TIMER RING CARD (accent) -->
      <div class="qt-card qt-card--accent qt-card--timer">
        <div class="qt-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M12 2v2"/><path d="M10 2h4"/></svg>
          {_t('moduleFocusPomodoro')}
        </div>
        <div class="qt-ring-wrap">
          <PremiumRing
            size={156}
            thickness={12}
            segments={[{ value: qtProgress * 100, color: "var(--mod-accent)", label: "Progress" }]}
            centerLabel="Pomodoro"
            centerValue={`${qtMin}:${qtSec}`}
            centerNote={qtActive ? _t('moduleFocusInSession') : _t('moduleFocusReady')}
          />
        </div>
        <div class="qt-timer-btns">
          <button class="qt-timer-btn qt-timer-btn--main" onclick={toggleQtTimer}>
            {#if qtActive}
              <PauseIcon size={18} strokeWidth={2.4} />
              {_t('moduleFocusPause')}
            {:else}
              <PlayIcon size={18} strokeWidth={2.4} />
              {_t('moduleFocusStart')}
            {/if}
          </button>
          <button class="qt-timer-btn qt-timer-btn--ghost" onclick={resetQtTimer} title={_t('commonRestart')}>
            <RotateCcwIcon size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <!-- SESSIONS LOG CARD (surface) -->
      <div class="qt-card qt-card--surface qt-card--log">
        <div class="qt-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          {_t('moduleFocusRecentSessions')}
        </div>
        {#if qtSessions.length === 0}
        <div class="qt-empty-small">
          <span class="qt-card-hint">{_t('moduleFocusNoSessions')}</span>
        </div>
        {:else}
          {#each qtSessions.slice(0, 8) as s}
          <div class="qt-session-row">
            <div class="qt-session-dot"></div>
            <div class="qt-session-info">
              <span class="qt-session-label">{s.label}</span>
              <span class="qt-session-meta">{s.date}</span>
            </div>
            <span class="qt-session-dur">{s.duration}</span>
          </div>
          {/each}
        {/if}
        <div class="qt-session-total">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          {totalQtMin} {_t('moduleFocusMinTotal')}
        </div>
      </div>

      <!-- WEEKLY STATS CARD (dark) -->
      <div class="qt-card qt-card--dark qt-card--stats">
        <div class="qt-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          {_t('moduleFocusThisWeek')}
        </div>
        <div class="qt-stat-big" style="color:#10b981">{totalQtSessions}<span class="qt-stat-unit">{_t('moduleFocusSessions')}</span></div>
        <p class="qt-card-hint" style="color:#22c55e">{_t('moduleFocusIncrease')}</p>
        <div class="qt-mini-bars">
          {#each qtWeekCount as h, i}
            <div class="qt-mini-bar-wrap">
              <div class="qt-mini-bar" style="height:{h*14}px;background:#10b981"></div>
              <span class="qt-mini-bar-label">{['M','T','W','T','F','S','S'][i]}</span>
            </div>
          {/each}
        </div>
      </div>

    </section>
    {/if}

    <section class="focus-shell__body">
      {#if selectedSection === "Timer"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusTimerPresets')}</CardTitle>
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
            <CardTitle>{_t('moduleFocusRecentSessions')}</CardTitle>
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
            <CardTitle>{_t('moduleFocusBackgroundSounds')}</CardTitle>
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
            <CardTitle>{_t('moduleFocusBlockingRules')}</CardTitle>
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
            <CardTitle>{_t('moduleFocusWeeklyHistory')}</CardTitle>
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
      {:else if selectedSection === "Quick Timer"}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusQuickTimer')}</CardTitle>
            <CardDescription>{_t('moduleFocusQuickTimerDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="focus-quick-info">
            <p>{_t('moduleFocusQuickTimerInfo')}</p>
          </CardContent>
        </Card>
      {:else}
        <Card class="focus-panel focus-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleFocusReview')}</CardTitle>
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
                {_t('commonExport')}
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
    font-family: var(--font-body);
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
    transition:
      transform 160ms ease,
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
  }

  :global(.focus-controls__button:hover) {
    transform: translateY(-1px);
  }

  :global(.focus-controls__button:active) {
    transform: translateY(0) scale(0.98);
  }

  :global(.focus-controls__button--reset) {
    width: 56px;
    height: 56px;
    border: 1px solid var(--focus-border);
    background: color-mix(in srgb, var(--focus-surface-strong) 96%, transparent);
    color: inherit;
  }

  :global(.focus-controls__button--play) {
    width: 72px !important;
    height: 72px !important;
    background: var(--foreground) !important;
    color: var(--background) !important;
  }

  :global(.focus-controls__button--play:hover) {
    background: color-mix(in srgb, var(--foreground) 92%, white) !important;
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

  /* ── Quick Timer bento cards (ported from Journal's Focus section) ── */
  .qt-bento {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 16px;
  }

  .qt-card {
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s ease;
  }

  .qt-card--accent {
    background: var(--focus-accent, var(--primary));
    color: #fff;
  }

  .qt-card--surface {
    background: var(--card);
    border: 1px solid var(--border);
  }

  .qt-card--dark {
    background: var(--surface);
    color: var(--surface-foreground, #fff);
  }

  .qt-card-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .qt-card-label svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .qt-card-hint {
    font-size: 12px;
    opacity: 0.65;
    margin: 0;
  }

  /* Timer ring */
  .qt-card--timer {
    align-items: center;
    text-align: center;
  }

  .qt-ring-wrap {
    position: relative;
    width: 140px;
    height: 140px;
    margin: 0 auto;
  }

  .qt-ring-svg {
    width: 100%;
    height: 100%;
  }

  .qt-ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .qt-ring-time {
    font-size: 26px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .qt-ring-sub {
    font-size: 11px;
    opacity: 0.65;
    margin-top: 4px;
  }

  .qt-timer-btns {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .qt-timer-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: 999px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .qt-timer-btn--main {
    background: rgba(255,255,255,0.2);
    color: #fff;
  }

  .qt-timer-btn--main:hover {
    background: rgba(255,255,255,0.3);
  }

  .qt-timer-btn--ghost {
    background: none;
    color: rgba(255,255,255,0.6);
    padding: 10px;
  }

  .qt-timer-btn--ghost:hover {
    color: #fff;
  }

  .qt-timer-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Session log */
  .qt-card--log {
    padding: 18px;
  }

  .qt-session-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .qt-session-row:last-child {
    border-bottom: none;
  }

  .qt-session-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--focus-accent, var(--primary));
    flex-shrink: 0;
  }

  .qt-session-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .qt-session-label {
    font-size: 13px;
    font-weight: 500;
  }

  .qt-session-meta {
    font-size: 11px;
    color: var(--muted);
  }

  .qt-session-dur {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  .qt-session-total {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    font-size: 13px;
    font-weight: 600;
    color: var(--focus-accent, var(--primary));
  }

  .qt-session-total svg {
    width: 14px;
    height: 14px;
  }

  .qt-empty-small {
    padding: 12px 0;
    text-align: center;
  }

  /* Stats card */
  .qt-card--stats {
    padding: 22px;
  }

  .qt-stat-big {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .qt-stat-unit {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.6;
  }

  .qt-mini-bars {
    display: flex;
    gap: 6px;
    justify-content: center;
    margin-top: 8px;
  }

  .qt-mini-bar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .qt-mini-bar {
    width: 16px;
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }

  .qt-mini-bar-label {
    font-size: 9px;
    opacity: 0.5;
  }

  @media (max-width: 860px) {
    .qt-bento { grid-template-columns: 1fr; }
  }
</style>
