<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { fade } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { time } from "$lib/utils/time";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";

  type CountEvent = {
    id: string;
    title: string;
    targetDate: string;
    color: string;
    emoji: string;
    created: number;
  };

  let events = $state<CountEvent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showForm = $state(false);
  let formTitle = $state("");
  let formDate = $state("");
  let formColor = $state("var(--primary)");
  let formEmoji = $state("🎯");
  let now = $state(time.now());

  // ─── Edit State ───
  let editingId = $state<string | null>(null);
  let editTitle = $state('');
  let editDate = $state('');
  let editEmoji = $state('🎯');
  let editColor = $state('var(--primary)');

  // ─── Pin State ───
  let pinnedIds = $state<Set<string>>(new Set());

  const STORAGE_KEY = "bento_countdown";
  const colors = [
    "var(--primary)",
    "var(--accent, var(--primary))",
    "var(--success, var(--primary))",
    "var(--warning, var(--primary))",
    "var(--destructive, var(--primary))",
    "var(--foreground)",
    "var(--muted)",
  ];
  const emojis = ["🎯", "🎂", "🎄", "🎉", "✈️", "🏖️", "❤️", "🎓", "🏆", "⭐", "🎊", "🌸", "🍀", "🌴"];

  let _t = $derived.by(() => createTranslator($activeBundle));

  let timer: ReturnType<typeof setInterval> | undefined;

  const PIN_KEY = "bento_countdown_pins";

  function load() {
    try {
      const raw = browser ? localStorage.getItem(STORAGE_KEY) : null;
      events = raw ? JSON.parse(raw) : [];
      const pinRaw = browser ? localStorage.getItem(PIN_KEY) : null;
      pinnedIds = pinRaw ? new Set(JSON.parse(pinRaw)) : new Set();
    } catch {
      error = "Failed to load events";
      events = [];
    } finally {
      loading = false;
    }
  }

  function save() {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function savePins() {
    if (browser) localStorage.setItem(PIN_KEY, JSON.stringify([...pinnedIds]));
  }

  function togglePin(id: string) {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    pinnedIds = next;
    savePins();
  }

  function startEdit(event: CountEvent) {
    editingId = event.id;
    editTitle = event.title;
    editDate = event.targetDate;
    editEmoji = event.emoji;
    editColor = event.color;
  }

  function saveEdit() {
    if (!editingId) return;
    events = events.map(e =>
      e.id === editingId
        ? { ...e, title: editTitle.trim() || e.title, targetDate: editDate || e.targetDate, emoji: editEmoji, color: editColor }
        : e
    );
    save();
    editingId = null;
  }

  function cancelEdit() {
    editingId = null;
  }

  function addEvent() {
    if (!formTitle.trim() || !formDate) return;
    events = [
      { id: crypto.randomUUID(), title: formTitle.trim(), targetDate: formDate, color: formColor, emoji: formEmoji, created: time.now() },
      ...events,
    ];
    save();
    resetForm();
  }

  function deleteEvent(id: string) {
    events = events.filter((e) => e.id !== id);
    save();
  }

  function resetForm() {
    formTitle = "";
    formDate = "";
    formColor = "var(--primary)";
    formEmoji = "🎯";
    showForm = false;
  }

  function calcTimeLeft(target: string) {
    const diff = new Date(target).getTime() - now;
    if (diff <= 0) return null;
    const totalDays = diff / 86400000;
    const years = Math.floor(totalDays / 365);
    const days = Math.floor(totalDays % 365);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { years, days, hours, minutes, seconds, total: diff };
  }

  function calcProgress(created: number, target: string) {
    const total = new Date(target).getTime() - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  function getRingColor(color: string, progress: number) {
    if (progress >= 90) return 'var(--count-success)';
    if (progress >= 75) return 'var(--count-warning)';
    if (progress >= 50) return 'var(--count-accent)';
    return color;
  }

  // SVG ring constants
  const RING_RADIUS = 36;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  const eventList = $derived(
    [...events].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 0 : 1;
      const bPinned = pinnedIds.has(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    })
  );

  const upcomingEvents = $derived(eventList.filter((e) => new Date(e.targetDate).getTime() > now));
  const pastEvents = $derived(eventList.filter((e) => new Date(e.targetDate).getTime() <= now));

  onMount(() => {
    load();
    if (browser) timer = setInterval(() => (now = time.now()), 1000);
  });

  onDestroy(() => clearInterval(timer));
</script>

<main class="count-workspace module-root" data-module="countdown">
  <section class="count-shell">
    <header class="count-shell__header">
      <div class="count-shell__intro">
        <div class="count-shell__eyebrow">
          <span>{_t('moduleCountdownTitle')}</span>
          <Badge variant="outline">{events.length} event{events.length !== 1 ? "s" : ""}</Badge>
        </div>
        <h1>{_t('moduleCountdownDesc')}</h1>
        <p>{_t('moduleCountdownDesc2')}</p>
      </div>
      <div class="count-shell__actions">
        <Button onclick={() => (showForm = true)}>
          <PlusIcon data-icon="inline-start" />
          {_t('moduleCountdownNewEvent')}
        </Button>
      </div>
    </header>

    <!-- Loading -->
    {#if loading}
      <div class="count-shell__loading">
        {#each [1, 2] as _}
          <div class="count-skeleton"></div>
        {/each}
      </div>

    <!-- Error -->
    {:else if error}
      <Card class="count-panel">
        <CardContent>
          <p>{error}</p>
          <Button variant="outline" onclick={() => { error = null; load(); }}>{_t('commonRetry')}</Button>
        </CardContent>
      </Card>

    <!-- Empty -->
    {:else if events.length === 0}
      <Card class="count-panel count-panel--state">
        <CardContent>
          <div class="count-state">
            <span class="count-state-icon">📅</span>
            <h2 class="count-state-title">{_t('moduleCountdownEmpty')}</h2>
            <p class="count-state-desc">{_t('moduleCountdownEmptyDesc')}</p>
            <Button onclick={() => (showForm = true)}>
              <PlusIcon data-icon="inline-start" />
              {_t('moduleCountdownCreateFirst')}
            </Button>
          </div>
        </CardContent>
      </Card>

    <!-- Event Grid -->
    {:else}
      <section class="count-shell__body">
        <div class="count-grid" transition:fade>
          {#each eventList as event (event.id)}
            {@const timeLeft = calcTimeLeft(event.targetDate)}
            {@const progress = calcProgress(event.created, event.targetDate)}
            {@const ringColor = getRingColor(event.color, progress)}
            <Card class={`count-event-card${!timeLeft ? ' count-event-card--past' : ''}`}>
              <CardContent class="count-event-card__content">
                <!-- Top action bar -->
                <div class="count-event-card__actions">
                  <button type="button" class="count-card-action count-card-action--pin" class:active={pinnedIds.has(event.id)} onclick={() => togglePin(event.id)} title="Pin to top">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="{pinnedIds.has(event.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg>
                  </button>
                  <div class="count-card-actions-right">
                    <button type="button" class="count-card-action" onclick={() => startEdit(event)} title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" class="count-card-action count-card-action--delete" onclick={() => deleteEvent(event.id)} title="Delete">
                      <Trash2Icon size={13} />
                    </button>
                  </div>
                </div>

                <!-- Edit mode -->
                {#if editingId === event.id}
                  <div class="count-edit-inline">
                    <input type="text" class="count-edit-input" bind:value={editTitle} placeholder="Title" />
                    <input type="date" class="count-edit-input count-edit-date" bind:value={editDate} />
                    <div class="count-edit-inline-grid">
                      {#each ['🎯','🎂','🎄','🎉','✈️','🏖️','❤️','🎓','🏆','⭐','🎊','🌸','🍀','🌴'] as emoji}
                        <button class="count-emoji-btn count-emoji-sm" class:active={editEmoji === emoji} onclick={() => editEmoji = emoji}>{emoji}</button>
                      {/each}
                    </div>
                    <div class="count-edit-inline-actions">
                      <button class="count-edit-save" onclick={saveEdit}>Save</button>
                      <button class="count-edit-cancel" onclick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                {:else}
                  <div class="count-event-card__media" ondblclick={() => startEdit(event)}>
                    <svg class="count-progress-ring" viewBox="0 0 100 100">
                      <circle class="count-ring-bg" cx="50" cy="50" r="{RING_RADIUS}" />
                      <circle
                        class="count-ring-fill"
                        cx="50" cy="50" r="{RING_RADIUS}"
                        stroke="{ringColor}"
                        stroke-dasharray="{RING_CIRCUMFERENCE}"
                        stroke-dashoffset="{RING_CIRCUMFERENCE * (1 - progress / 100)}"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div class="count-event-card__emoji" style="background: color-mix(in srgb, {event.color} 20%, transparent)">
                      {event.emoji}
                    </div>
                  </div>
                  <h3 class="count-event-card__title" ondblclick={() => startEdit(event)}>{event.title}</h3>
                  {#if timeLeft}
                    <div class="count-event-card__timer">
                      {#if timeLeft.years > 0}
                        <div class="count-timer-unit">
                          <span class="count-timer-value">{timeLeft.years}</span>
                          <span class="count-timer-label">year{timeLeft.years !== 1 ? 's' : ''}</span>
                        </div>
                        <span class="count-timer-sep count-timer-sep--wide">·</span>
                      {/if}
                      <div class="count-timer-unit">
                        <span class="count-timer-value">{String(timeLeft.days).padStart(2, "0")}</span>
                        <span class="count-timer-label">day{timeLeft.days !== 1 ? 's' : ''}</span>
                      </div>
                      <span class="count-timer-sep">:</span>
                      <div class="count-timer-unit">
                        <span class="count-timer-value">{String(timeLeft.hours).padStart(2, "0")}</span>
                        <span class="count-timer-label">hr</span>
                      </div>
                      <span class="count-timer-sep">:</span>
                      <div class="count-timer-unit">
                        <span class="count-timer-value">{String(timeLeft.minutes).padStart(2, "0")}</span>
                        <span class="count-timer-label">min</span>
                      </div>
                      <span class="count-timer-sep">:</span>
                      <div class="count-timer-unit">
                        <span class="count-timer-value">{String(timeLeft.seconds).padStart(2, "0")}</span>
                        <span class="count-timer-label">sec</span>
                      </div>
                    </div>
                    <div class="count-progress-bar-track">
                      <div class="count-progress-bar-fill" style="width: {progress}%; background: {ringColor}"></div>
                    </div>
                  {:else}
                    <div class="count-event-card__done">🎉 Event passed!</div>
                  {/if}
                  <p class="count-event-card__date">
                    <CalendarIcon size={12} />
                    {formatDate(event.targetDate)}
                  </p>
                {/if}
              </CardContent>
            </Card>
          {/each}
        </div>

        <!-- Past events summary -->
        {#if pastEvents.length > 0}
          <details class="count-past-section">
            <summary class="count-past-summary">
              Past events ({pastEvents.length})
            </summary>
            <div class="count-past-grid">
              {#each pastEvents as event (event.id)}
                <div class="count-past-card">
                  <span class="count-past-emoji">{event.emoji}</span>
                  <span class="count-past-title">{event.title}</span>
                  <span class="count-past-date">{new Date(event.targetDate).toLocaleDateString()}</span>
                  <button class="count-past-delete" onclick={() => deleteEvent(event.id)} title="Delete">
                    <Trash2Icon size={12} />
                  </button>
                </div>
              {/each}
            </div>
          </details>
        {/if}
      </section>
    {/if}
  </section>
</main>

<!-- Form Overlay -->
{#if showForm}
  <div class="count-overlay" transition:fade onclick={resetForm} role="presentation"></div>
  <div class="count-form-panel" transition:fade={{ duration: 150 }}>
    <h2 class="count-form-title">{_t('moduleCountdownNewEvent')}</h2>
    <div class="count-form-group">
      <label class="count-label" for="countdown-title">{_t('moduleCountdownEventTitle')}</label>
      <input id="countdown-title" type="text" class="count-input" bind:value={formTitle} placeholder={_t('moduleCountdownPlaceholder')} />
    </div>
    <div class="count-form-group">
      <label class="count-label" for="countdown-date">{_t('commonDate')}</label>
      <input id="countdown-date" type="date" class="count-input" bind:value={formDate} />
    </div>
    <div class="count-form-group">
      <label class="count-label" for="countdown-emoji">{_t('moduleCountdownEmoji')}</label>
      <div class="count-form-grid">
        {#each emojis as emoji}
          <button
            type="button"
            class="count-emoji-btn"
            class:active={formEmoji === emoji}
            onclick={() => (formEmoji = emoji)}
          >{emoji}</button>
        {/each}
      </div>
    </div>
    <div class="count-form-group">
      <label class="count-label" for="countdown-color">{_t('moduleCountdownColor')}</label>
      <div class="count-form-grid count-form-grid--color" role="radiogroup" aria-label={_t('moduleCountdownColorPicker')}>
        {#each colors as c, i}
          <button
            type="button"
            class="count-color-btn"
            style="background: {c}"
            class:active={formColor === c}
            aria-label="Color {i + 1}"
            onclick={() => (formColor = c)}
          ></button>
        {/each}
      </div>
    </div>
    <div class="count-form-actions">
      <Button disabled={!formTitle.trim() || !formDate} onclick={addEvent}>
        <PlusIcon data-icon="inline-start" />
        {_t('moduleCountdownCreateEvent')}
      </Button>
      <Button variant="ghost" onclick={resetForm}>{_t('commonCancel')}</Button>
    </div>
  </div>
{/if}

<style>
  :global(.count-workspace) {
    --count-bg: var(--background);
    --count-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --count-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --count-border: color-mix(in srgb, var(--border) 86%, transparent);
    --count-ink: var(--foreground);
    --count-muted: var(--muted);
    --count-accent: var(--primary);
    --count-accent-foreground: var(--primary-foreground, var(--background));
    --count-success: var(--success, var(--primary));
    --count-warning: var(--warning, var(--primary));
    --count-danger: var(--destructive, var(--primary));
    height: 100%;
    padding: 28px 30px;
    background: var(--count-bg);
    color: var(--count-ink);
    overflow: hidden;
    font-family: var(--font-body);
  }

  :global(.count-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.count-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.count-shell__intro) { max-width: 56rem; }

  :global(.count-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--count-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.count-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.count-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--count-muted);
  }

  :global(.count-shell__actions) { display: flex; gap: 12px; }

  :global(.count-shell__loading) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.count-skeleton) {
    height: 160px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--count-border) 72%, transparent);
    animation: count-pulse 1.5s infinite;
  }

  @keyframes count-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  :global(.count-panel) {
    border-color: var(--count-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--count-surface) 98%, var(--background)),
        color-mix(in srgb, var(--count-surface) 86%, var(--background))
      );
  }

  :global(.count-panel--state) :global(.card-content) {
    display: flex;
    justify-content: center;
  }

  :global(.count-state) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    padding: 40px 20px;
  }

  :global(.count-state-icon) { font-size: 48px; }
  :global(.count-state-title) { font-size: 18px; font-weight: 600; margin: 0; }
  :global(.count-state-desc) { font-size: 14px; color: var(--count-muted); margin: 0; max-width: 320px; }

  :global(.count-shell__body),
  :global(.count-panel),
  :global(.count-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.count-shell__body) {
    overflow: auto;
  }

  :global(.count-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  :global(.count-event-card) {
    border-color: var(--count-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--count-surface) 98%, var(--background)),
        color-mix(in srgb, var(--count-surface) 86%, var(--background))
      );
  }

  :global(.count-event-card__content) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 24px;
    position: relative;
  }

  :global(.count-event-card__actions) {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 5;
  }
  :global(.count-event-card:hover .count-event-card__actions) { opacity: 1; }

  :global(.count-card-actions-right) {
    display: flex;
    gap: 4px;
  }

  :global(.count-card-action) {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--count-muted);
    transition: all 0.15s;
  }
  :global(.count-card-action:hover) {
    background: color-mix(in srgb, var(--count-border) 50%, transparent);
    color: var(--count-ink);
  }
  :global(.count-card-action--delete:hover) {
    background: color-mix(in srgb, var(--count-danger) 12%, transparent);
    color: var(--count-danger);
  }
  :global(.count-card-action--pin.active) {
    color: var(--count-warning);
  }

  :global(.count-event-card__media) {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.count-progress-ring) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  :global(.count-ring-bg) {
    fill: none;
    stroke: color-mix(in srgb, var(--count-border) 50%, transparent);
    stroke-width: 4;
  }

  :global(.count-ring-fill) {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s cubic-bezier(0.32, 0.72, 0, 1), stroke 0.5s;
  }

  :global(.count-event-card__emoji) {
    font-size: 30px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
  }

  :global(.count-progress-bar-track) {
    width: 100%;
    height: 3px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--count-border) 40%, transparent);
    overflow: hidden;
  }

  :global(.count-progress-bar-fill) {
    height: 100%;
    border-radius: 99px;
    transition: width 1s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(.count-timer-sep--wide) {
    margin: 0 2px;
    color: var(--count-muted);
    font-size: 16px;
  }

  :global(.count-event-card__title) {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
    text-align: center;
  }

  :global(.count-event-card__timer) {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  :global(.count-timer-unit) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  :global(.count-timer-value) {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  :global(.count-timer-label) {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--count-muted);
  }

  :global(.count-timer-sep) {
    font-size: 20px;
    font-weight: 700;
    color: var(--count-muted);
    margin-top: -16px;
  }

  :global(.count-event-card__done) {
    padding: 8px 16px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--count-success) 12%, transparent);
    color: var(--count-success);
    font-size: 16px;
    font-weight: 600;
  }

  :global(.count-event-card__date) {
    font-size: 12px;
    color: var(--count-muted);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.count-overlay) {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--background) 72%, transparent);
    z-index: 100;
  }

  :global(.count-form-panel) {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: var(--count-surface);
    border: 1px solid var(--count-border);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 80vh;
    width: min(440px, 90vw);
    overflow-y: auto;
  }
  :global(.count-form-title) { font-size: 17px; font-weight: 700; margin: 0; }
  :global(.count-form-group) { display: flex; flex-direction: column; gap: 6px; }
  :global(.count-label) { font-size: 13px; font-weight: 600; }

  :global(.count-input) {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--count-border);
    background: color-mix(in srgb, var(--count-surface-strong) 92%, transparent);
    color: var(--count-ink);
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }
  :global(.count-input:focus) { border-color: var(--count-accent); }

  :global(.count-form-grid) {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  :global(.count-form-grid--color) {
    gap: 6px;
  }

  :global(.count-emoji-btn) {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--count-border);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--count-surface);
    transition: all 0.15s;
  }
  :global(.count-emoji-btn.active) { border-color: var(--count-accent); background: color-mix(in srgb, var(--count-accent) 12%, transparent); }
  :global(.count-emoji-btn:hover) { border-color: var(--count-accent); }

  :global(.count-color-btn) {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
  }
  :global(.count-color-btn.active) { border-color: var(--count-ink); transform: scale(1.15); }
  :global(.count-color-btn:hover) { transform: scale(1.1); }

  :global(.count-form-actions) { display: flex; gap: 8px; margin-top: 4px; }

  /* ─── Inline Edit ─── */
  :global(.count-edit-inline) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  :global(.count-edit-input) {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--count-border);
    background: color-mix(in srgb, var(--count-surface-strong) 92%, transparent);
    color: var(--count-ink);
    font-size: 14px;
    outline: none;
    font-family: inherit;
  }
  :global(.count-edit-input:focus) { border-color: var(--count-accent); }
  :global(.count-edit-date) { width: 100%; }

  :global(.count-edit-inline-grid) {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  :global(.count-emoji-sm) {
    width: 30px;
    height: 30px;
    font-size: 15px;
  }

  :global(.count-edit-inline-actions) {
    display: flex;
    gap: 6px;
  }

  :global(.count-edit-save),
  :global(.count-edit-cancel) {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  :global(.count-edit-save) { background: var(--count-accent); color: var(--count-accent-foreground); }
  :global(.count-edit-save:hover) { filter: brightness(1.1); }
  :global(.count-edit-cancel) { background: var(--count-surface-strong); color: var(--count-muted); }
  :global(.count-edit-cancel:hover) { color: var(--count-ink); }

  /* ─── Past Section ─── */
  :global(.count-past-section) {
    margin-top: 24px;
    border-top: 1px solid var(--count-border);
    padding-top: 16px;
  }

  :global(.count-past-summary) {
    font-size: 13px;
    font-weight: 600;
    color: var(--count-muted);
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
  }
  :global(.count-past-summary:hover) { color: var(--count-ink); }

  :global(.count-past-grid) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  :global(.count-past-card) {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--count-surface) 94%, var(--background));
  }

  :global(.count-past-emoji) { font-size: 18px; }
  :global(.count-past-title) { font-size: 14px; font-weight: 500; flex: 1; }
  :global(.count-past-date) { font-size: 12px; color: var(--count-muted); }

  :global(.count-past-delete) {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--count-muted);
    opacity: 0;
    transition: opacity 0.15s;
  }
  :global(.count-past-card:hover .count-past-delete) { opacity: 1; }
  :global(.count-past-delete:hover) { background: color-mix(in srgb, var(--count-danger) 12%, transparent); color: var(--count-danger); }

  :global(.count-event-card--past) {
    opacity: 0.6;
  }
  :global(.count-event-card--past:hover) {
    opacity: 1;
  }
</style>
