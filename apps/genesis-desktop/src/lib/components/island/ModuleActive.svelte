<script lang="ts">
  import { fly } from "svelte/transition";
  import type { ActiveModuleState } from "$lib/stores/island.store.svelte";
  import { getIslandItem } from "$lib/data/island-catalog";
  import { getIcon } from "./island-icons";
  import { islandStore } from "$lib/stores/island.store.svelte";

  /** Waveform bar count — constant to avoid array allocation on every render. */
  const WAVEFORM_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  let { activeModule }: { activeModule: NonNullable<ActiveModuleState> } = $props();

  // ── Derived: resolve icon + color once ──
  const islandItem = $derived(getIslandItem(activeModule.id));
  const accentColor = $derived(islandItem?.accentColor ?? "#5f61ed");
  const ActiveIcon = $derived(getIcon(activeModule.icon));

  // ── Recording timer ──
  let recordingStart = $state(Date.now());
  let elapsed = $state(0);

  $effect(() => {
    if (activeModule.activityType !== "recording") return;
    recordingStart = Date.now();
    elapsed = 0;
    const interval = setInterval(() => {
      elapsed = Math.max(0, Math.floor((Date.now() - recordingStart) / 1000));
    }, 200);
    return () => clearInterval(interval);
  });

  function formatTime(seconds: number): string {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function goBack() {
    islandStore.activeModule = null;
  }
</script>

<div class="module-active" transition:fly={{ duration: 200, y: 12 }}>
  <div class="ma-header">
    <div class="ma-info">
      <span class="ma-icon" style="color: {accentColor}">
        <ActiveIcon size={18} strokeWidth={1.6} />
      </span>
      <div class="ma-titles">
        <span class="ma-name">{activeModule.label}</span>
        <span class="ma-status">
          {#if activeModule.activityType === "recording"}
            {formatTime(elapsed)}
          {:else}
            {activeModule.status}
          {/if}
        </span>
      </div>
    </div>
    <button
      class="ma-back"
      onclick={goBack}
      aria-label="Back to apps"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
    </button>
  </div>

  <div class="ma-body">
    <div class="ma-card">
      {#if activeModule.activityType === "recording"}
        <div class="ma-recording">
          <!-- Live waveform bars (decorative animation) -->
          <div class="mar-waveform">
            {#each WAVEFORM_INDICES as i}
              <div
                class="mar-bar"
                style="animation-delay: {i * 0.08}s; height: {20 + Math.sin(i * 1.2) * 12}px"
              ></div>
            {/each}
          </div>
          <div class="mar-label">
            <span class="mar-dot"></span>
            <span class="mar-time">{formatTime(elapsed)}</span>
          </div>
          <!-- Dismiss to background — the full recording UI is in the main window -->
          <button class="ma-back-btn" onclick={goBack} aria-label="Dismiss recording">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to apps
          </button>
        </div>
      {:else}
        <div class="ma-default">
          <span class="mad-icon">
            <ActiveIcon size={24} strokeWidth={1.5} />
          </span>
          <span class="mad-label">{activeModule.status}</span>
        </div>
      {/if}
      <span class="ma-hint">
        Open in main window for full controls
      </span>
    </div>
  </div>
</div>

<style>
  .module-active {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 0 12px 10px;
    min-height: 0;
  }

  .ma-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0 10px;
    flex-shrink: 0;
  }

  .ma-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ma-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
  }

  .ma-titles {
    display: flex;
    flex-direction: column;
  }

  .ma-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
  }

  .ma-status {
    font-size: 11px;
    font-family: "SF Mono", "Geist Mono", "SF Pro Text", monospace;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.35);
  }

  .ma-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.35);
    transition: background 0.15s, color 0.15s;
  }

  .ma-back:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }

  .ma-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 0;
  }

  .ma-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 24px 20px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.06);
    width: 100%;
    max-width: 380px;
  }

  .ma-hint {
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.2);
    text-align: center;
  }

  /* ── Recording layout ── */
  .ma-recording {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .mar-waveform {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    height: 32px;
  }

  .mar-bar {
    width: 4px;
    border-radius: 2px;
    background: #8b5cf6;
    animation: mar-bounce 0.6s ease-in-out infinite alternate;
    transform-origin: bottom;
    min-height: 4px;
  }

  @keyframes mar-bounce {
    0% { transform: scaleY(0.3); }
    100% { transform: scaleY(1); }
  }

  .mar-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
  }

  .mar-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    animation: live-pulse 1s ease-in-out infinite;
  }

  .mar-time {
    font-family: "SF Mono", "Geist Mono", "SF Pro Text", monospace;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(0.7); }
  }

  .ma-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 400;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.05);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .ma-back-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  /* ── Default layout ── */
  .ma-default {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .mad-icon {
    display: flex;
    color: rgba(255, 255, 255, 0.25);
  }

  .mad-label {
    font-size: 12px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.35);
  }
</style>
