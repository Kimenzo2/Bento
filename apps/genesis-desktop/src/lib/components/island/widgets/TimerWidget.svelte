<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import WidgetWrapper from "./WidgetWrapper.svelte";
  import { getIcon } from "../island-icons";

  const timerPlusIcon = getIcon("plus");
  const timerPlayIcon = getIcon("play");
  const checkIcon = getIcon("check");
  const pauseIcon = getIcon("pause");
  const refreshIcon = getIcon("refresh");
  const trashIcon = getIcon("trash");

  interface Timer {
    id: string;
    name: string;
    duration: number;
    remaining: number;
    isRunning: boolean;
    lastStartTime?: number;
  }

  interface FocusPreset {
    label: string;
    minutes?: number | null;
  }

  let timers = $state<Timer[]>([]);
  let presets = $state<FocusPreset[]>([{ label: "25m", minutes: 25 }]);
  let displayTimers = $derived.by(() => {
    const now = Date.now();
    return timers.map((t) => {
      let remaining = t.remaining;
      if (t.isRunning && t.lastStartTime) {
        remaining = Math.max(0, t.remaining - (now - t.lastStartTime) / 1000);
      }
      return { ...t, remaining: Math.ceil(remaining) };
    });
  });
  let showAdd = $state(false);
  let newLabel = $state("");
  let newMinutes = $state(25);

  function clampMinutes(e: Event) {
    const el = e.target as HTMLInputElement;
    const v = parseInt(el.value, 10);
    if (isNaN(v) || v < 1) el.value = "1";
    else if (v > 1440) el.value = "1440";
  }

  async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(cmd, args);
    } catch {
      return null;
    }
  }

  onMount(async () => {
    try {
      const saved = localStorage.getItem("bento:widget:timers");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          timers = parsed.map((t: Timer) => ({ ...t, isRunning: false, lastStartTime: undefined }));
        }
      }
    } catch { /* corrupted data */ }

    const dashboard = await invokeTauri<{ timerPresets: FocusPreset[] }>("get_focus_dashboard");
    if (dashboard?.timerPresets?.length) {
      presets = dashboard.timerPresets;
    }
  });

  let tickInterval: ReturnType<typeof setInterval> | undefined;

  $effect(() => {
    const hasRunning = timers.some((t) => t.isRunning);
    if (hasRunning && !tickInterval) {
      tickInterval = setInterval(() => tick(), 1000);
    } else if (!hasRunning && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = undefined;
    }
    return () => {
      if (tickInterval) clearInterval(tickInterval);
    };
  });

  let prevTimersJson = $state("");
  $effect(() => {
    const json = JSON.stringify(timers.map(({ remaining: _, isRunning: _r, lastStartTime: _l, ...rest }) => rest));
    if (json !== prevTimersJson) {
      prevTimersJson = json;
      localStorage.setItem("bento:widget:timers", json);
    }
  });

  function tick() {
    const now = Date.now();
    const completed: Timer[] = [];
    timers = timers.map((t) => {
      if (!t.isRunning || !t.lastStartTime) return t;
      const elapsed = (now - t.lastStartTime) / 1000;
      const remaining = Math.max(0, t.remaining - elapsed);
      if (remaining <= 0) {
        completed.push(t);
        return { ...t, remaining: 0, isRunning: false, lastStartTime: undefined };
      }
      return { ...t, remaining };
    });
    for (const t of completed) {
      playSound();
      invokeTauri("record_focus_session", {
        params: { label: t.name, minutes: Math.round(t.duration / 60), note: "Timer completed in island widget" },
      });
    }
  }

  function playSound() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.start(now);
      osc.stop(now + 1.5);
    } catch {}
  }

  function addTimer(seconds: number, label?: string) {
    const t: Timer = {
      id: `timer-${Date.now()}`,
      name: label || newLabel.trim() || `Timer ${timers.length + 1}`,
      duration: seconds,
      remaining: seconds,
      isRunning: false,
    };
    timers = [...timers, t];
    showAdd = false;
    newLabel = "";
    newMinutes = 25;
  }

  function toggleTimer(id: string) {
    timers = timers.map((t) => {
      if (t.id !== id) return t;
      if (t.isRunning) {
        const elapsed = t.lastStartTime ? (Date.now() - t.lastStartTime) / 1000 : 0;
        return { ...t, isRunning: false, remaining: Math.max(0, t.remaining - elapsed), lastStartTime: undefined };
      }
      if (t.remaining <= 0) return t;
      return { ...t, isRunning: true, lastStartTime: Date.now() };
    });
  }

  function resetTimer(id: string) {
    timers = timers.map((t) =>
      t.id === id ? { ...t, remaining: t.duration, isRunning: false, lastStartTime: undefined } : t
    );
  }

  function removeTimer(id: string) {
    timers = timers.filter((t) => t.id !== id);
  }

  function fmtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
</script>

<WidgetWrapper title="Timers">
  {#snippet headerActions()}
    {#if !showAdd}
      <button onclick={() => showAdd = true} aria-label="Add timer" title="Add timer">
        <timerPlusIcon size={14} strokeWidth={1.8}></timerPlusIcon>
      </button>
    {/if}
  {/snippet}

  {#if showAdd}
    <div class="timer-add">
      <input
        class="timer-add-input"
        type="text"
        placeholder="Label (optional)…"
        bind:value={newLabel}
        onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter") addTimer(newMinutes * 60); if (e.key === "Escape") { showAdd = false; }}}
      />
      <div class="timer-mins">
        <input
          class="timer-mins-input"
          type="number"
          min="1"
          max="1440"
          bind:value={newMinutes}
          onchange={clampMinutes}
          onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter") addTimer(newMinutes * 60); }}
        />
        <span class="timer-mins-label">min</span>
      </div>
      <div class="timer-presets">
        {#each presets as p (p.label)}
          {#if p.minutes != null}
            <button class="preset-btn" onclick={() => addTimer((p.minutes as number) * 60, p.label)}>{p.label}</button>
          {/if}
        {/each}
      </div>
      <button class="start-timer-btn" onclick={() => addTimer(newMinutes * 60)}>
        <timerPlayIcon size={12} strokeWidth={2.5}></timerPlayIcon>
        Start Timer
      </button>
    </div>
  {:else if displayTimers.length === 0}
    <div class="timer-empty">
      <span>No active timers</span>
      <button class="empty-btn" onclick={() => showAdd = true}>Create Timer</button>
    </div>
  {:else}
    <div class="timer-list">
      {#each displayTimers as timer (timer.id)}
        {const pct = timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0}
        <div class="timer-row" class:timer-row--done={timer.remaining <= 0} in:slide={{ duration: 200 }} out:slide={{ duration: 150 }}>
          <div class="timer-ring" onclick={() => toggleTimer(timer.id)} role="button" tabindex="0" onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter") toggleTimer(timer.id); }}>
            <svg viewBox="0 0 44 44" class="ring-svg">
              <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
              <circle
                cx="22" cy="22" r="20"
                fill="none"
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray={2 * Math.PI * 20}
                stroke-dashoffset={(2 * Math.PI * 20) * (1 - pct / 100)}
                class="ring-progress"
                class:ring-progress--done={timer.remaining <= 0}
              />
            </svg>
            <div class="ring-icon">
              {#if timer.remaining <= 0}
                <checkIcon size={14} color="rgba(255,69,58,0.6)" strokeWidth={2.5}></checkIcon>
              {:else if timer.isRunning}
                <pauseIcon size={14} color="rgba(255,255,255,0.3)" strokeWidth={2.5}></pauseIcon>
              {:else}
                <timerPlayIcon size={14} color="rgba(255,255,255,0.3)" strokeWidth={2.5}></timerPlayIcon>
              {/if}
            </div>
          </div>
          <div class="timer-info">
            <div class="timer-value" class:timer-value--done={timer.remaining <= 0}>{fmtTime(timer.remaining)}</div>
            {#if timer.name}<div class="timer-name">{timer.name}</div>{/if}
          </div>
          <div class="timer-actions">
            <button class="t-action-btn" onclick={() => resetTimer(timer.id)} aria-label="Reset" title="Reset">
              <refreshIcon size={13} strokeWidth={1.8}></refreshIcon>
            </button>
            <button class="t-action-btn danger" onclick={() => removeTimer(timer.id)} aria-label="Delete" title="Delete">
              <trashIcon size={13} strokeWidth={1.8}></trashIcon>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</WidgetWrapper>

<style>
  .timer-add {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
  }

  .timer-add-input {
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.85);
    font-family: inherit;
    outline: none;
  }

  .timer-add-input:focus {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .timer-add-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .timer-mins {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .timer-mins-input {
    width: 70px;
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
    font-family: inherit;
    outline: none;
  }

  .timer-mins-input:focus {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .timer-mins-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  .timer-presets {
    display: flex;
    gap: 4px;
  }

  .preset-btn {
    flex: 1;
    padding: 5px 0;
    border-radius: 8px;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .preset-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
  }

  .start-timer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 0;
    border-radius: 8px;
    border: none;
    background: rgba(95, 97, 237, 0.2);
    color: #8b8df0;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .start-timer-btn:hover {
    background: rgba(95, 97, 237, 0.3);
  }

  .timer-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.2);
    font-size: 12px;
  }

  .empty-btn {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    padding: 6px 14px;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .empty-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .timer-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow-y: auto;
  }

  .timer-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 12px;
  }

  .timer-row--done {
    background: rgba(255, 69, 58, 0.04);
  }

  .timer-row:hover .timer-actions {
    opacity: 1;
  }

  .timer-ring {
    position: relative;
    width: 36px;
    height: 36px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .ring-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .ring-progress {
    stroke: rgba(95, 97, 237, 0.7);
    transition: stroke-dashoffset 0.8s linear;
  }

  .ring-progress--done {
    transition: none;
  }

  .ring-progress--done {
    stroke: rgba(255, 69, 58, 0.6);
  }

  .ring-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .timer-info {
    flex: 1;
    min-width: 0;
  }

  .timer-value {
    font-size: 20px;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .timer-value--done {
    color: rgba(255, 69, 58, 0.6);
  }

  .timer-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    margin-top: 2px;
  }

  .timer-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .t-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .t-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .danger:hover {
    background: rgba(255, 69, 58, 0.15);
    color: #ff453a;
  }
</style>
