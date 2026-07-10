<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { slide } from "svelte/transition";
  import WidgetWrapper from "./WidgetWrapper.svelte";
  import { getIcon } from "../island-icons";

  const sessionPlusIcon = getIcon("plus");
  const sessionPlayIcon = getIcon("play");
  const activityIcon = getIcon("activity");
  const squareIcon = getIcon("square");

  interface ActiveSession {
    id: string;
    name: string;
    startTime: number;
  }

  interface BackendSession {
    id: string;
    label: string;
    duration: string;
    minutes: number;
    loggedAt: number;
  }

  let active = $state<ActiveSession[]>([]);
  let completed = $state<BackendSession[]>([]);
  let showAdd = $state(false);
  let newName = $state("");
  let elapsed = $state<Record<string, number>>({});
  let addInputEl = $state<HTMLInputElement | null>(null);

  async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    try {
      return await invoke<T>(cmd, args);
    } catch {
      return null;
    }
  }

  async function loadCompleted() {
    const data = await invokeTauri<{ sessions: BackendSession[] }>("get_focus_dashboard");
    if (data?.sessions) {
      completed = data.sessions;
    }
  }

  onMount(() => {
    loadCompleted();
    updateElapsed();
  });

  let tickInterval: ReturnType<typeof setInterval> | undefined;

  $effect(() => {
    const hasActive = active.length > 0;
    if (hasActive && !tickInterval) {
      tickInterval = setInterval(() => updateElapsed(), 1000);
    } else if (!hasActive && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = undefined;
    }
    return () => {
      if (tickInterval) clearInterval(tickInterval);
    };
  });

  function updateElapsed() {
    const now = Date.now();
    const map: Record<string, number> = {};
    for (const s of active) {
      map[s.id] = Math.floor((now - s.startTime) / 1000);
    }
    elapsed = map;
  }

  function startSession() {
    const name = newName.trim() || `Session ${active.length + 1}`;
    const session: ActiveSession = {
      id: `session-${Date.now()}`,
      name,
      startTime: Date.now(),
    };
    active = [session, ...active];
    showAdd = false;
    newName = "";
  }

  async function stopSession(id: string) {
    const s = active.find((a) => a.id === id);
    if (!s) return;
    const dur = Math.round((Date.now() - s.startTime) / 60000);
    active = active.filter((a) => a.id !== id);
    if (dur > 0) {
      await invokeTauri("record_focus_session", {
        params: { label: s.name, minutes: dur, note: "Session completed in island widget" },
      });
      await loadCompleted();
    }
  }

  function fmtTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function fmtDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) return "Today";
    if (diff < 172800000 && d.getDate() === now.getDate() - 1) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
</script>

<WidgetWrapper title="Sessions">
  {#snippet headerActions()}
    {#if !showAdd}
      <button onclick={() => { showAdd = true; requestAnimationFrame(() => addInputEl?.focus()); }} aria-label="Add session">
        <sessionPlusIcon size={14} strokeWidth={1.8}></sessionPlusIcon>
      </button>
    {/if}
  {/snippet}

  {#if showAdd}
    <div class="session-add">
      <input
        class="session-add-input"
        type="text"
        placeholder="Session name…"
        bind:value={newName}
        onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter") startSession(); if (e.key === "Escape") { showAdd = false; newName = ""; }}}
        bind:this={addInputEl}
      />
      <div class="session-add-actions">
        <button class="add-btn" onclick={startSession}>
          <sessionPlayIcon size={12} strokeWidth={2.5}></sessionPlayIcon>
          Start
        </button>
        <button class="cancel-btn" onclick={() => { showAdd = false; newName = ""; }}>Cancel</button>
      </div>
    </div>
  {:else if active.length === 0 && completed.length === 0}
    <div class="session-empty">
      <span>No sessions</span>
      <button class="empty-btn" onclick={() => showAdd = true}>Start Session</button>
    </div>
  {:else}
    <div class="session-list">
      {#each active as session (session.id)}
        <div class="session-row session-row--active" in:slide={{ duration: 200 }} out:slide={{ duration: 150 }}>
          <div class="session-icon">
            <activityIcon size={16} strokeWidth={1.6}></activityIcon>
          </div>
          <div class="session-info">
            <div class="session-time">{fmtTime(elapsed[session.id] || 0)}</div>
            <div class="session-name">{session.name}</div>
          </div>
          <button class="action-btn stop-btn" onclick={() => stopSession(session.id)} aria-label="Stop session">
            <squareIcon size={13} strokeWidth={2.5}></squareIcon>
          </button>
        </div>
      {/each}

      {#if active.length > 0 && completed.length > 0}
        <div class="session-sep"></div>
      {/if}

      {#each completed.slice(0, 5) as session (session.id)}
        <div class="session-row session-row--completed" in:slide={{ duration: 200 }} out:slide={{ duration: 150 }}>
          <div class="session-icon dim">
            <activityIcon size={16} strokeWidth={1.6}></activityIcon>
          </div>
          <div class="session-info">
            <div class="session-time dim">{session.duration}</div>
            <div class="session-name dim">{session.label}</div>
          </div>
          <div class="session-date">{fmtDate(session.loggedAt)}</div>
        </div>
      {/each}
    </div>
  {/if}
</WidgetWrapper>

<style>
  .session-add {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
  }

  .session-add-input {
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.85);
    font-family: inherit;
    outline: none;
  }

  .session-add-input:focus {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .session-add-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .session-add-actions {
    display: flex;
    gap: 6px;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border-radius: 8px;
    border: none;
    background: rgba(95, 97, 237, 0.2);
    color: #8b8df0;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .add-btn:hover {
    background: rgba(95, 97, 237, 0.3);
  }

  .cancel-btn {
    padding: 5px 12px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.3);
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }

  .cancel-btn:hover {
    color: rgba(255, 255, 255, 0.6);
  }

  .session-empty {
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

  .session-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow-y: auto;
  }

  .session-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    cursor: default;
  }

  .session-row--active {
    background: rgba(95, 97, 237, 0.06);
    border: 0.5px solid rgba(95, 97, 237, 0.12);
  }

  .session-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(95, 97, 237, 0.15);
    color: #8b8df0;
    flex-shrink: 0;
  }

  .session-icon.dim {
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.35);
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-time {
    font-size: 20px;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .session-time.dim {
    color: rgba(255, 255, 255, 0.5);
  }

  .session-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    margin-top: 3px;
  }

  .session-name.dim {
    color: rgba(255, 255, 255, 0.25);
  }

  .session-date {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .stop-btn {
    background: rgba(255, 69, 58, 0.1);
    color: #ff453a;
  }

  .stop-btn:hover {
    background: rgba(255, 69, 58, 0.2);
  }

  .session-sep {
    height: 0.5px;
    background: rgba(255, 255, 255, 0.06);
    margin: 4px 0;
  }
</style>
