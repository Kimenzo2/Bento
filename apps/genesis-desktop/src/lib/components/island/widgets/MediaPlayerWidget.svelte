<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import WidgetWrapper from "./WidgetWrapper.svelte";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  interface NowPlayingData {
    title: string | null;
    artist: string | null;
    album: string | null;
    artwork_base64: string | null;
    duration: number | null;
    elapsed_time: number | null;
    is_playing: boolean;
    audio_levels: number[] | null;
    app_name: string | null;
  }

  let data = $state<NowPlayingData | null>(null);
  let levels = $state<number[]>([0.15, 0.15, 0.15, 0.15, 0.15, 0.15]);
  let seekValue = $state(0);
  let dragging = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | undefined;
  let unlisten: (() => void) | undefined;

  async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    try {
      return await invoke<T>(cmd, args);
    } catch {
      return null;
    }
  }

  onMount(async () => {
    const { listen } = await import("@tauri-apps/api/event");
    unlisten = await listen<number[]>("audio-levels-update", (event) => {
      levels = event.payload;
    });

    await fetchNowPlaying();
    pollInterval = setInterval(() => fetchNowPlaying(), 1000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (unlisten) unlisten();
  });

  async function fetchNowPlaying() {
    const np = await invokeTauri<NowPlayingData>("get_now_playing");
    if (np && (np.is_playing || np.title)) {
      data = np;
      if (np.audio_levels) levels = np.audio_levels;
    } else if (np && !np.is_playing && !np.title) {
      data = null;
    }
  }

  async function handlePlayPause() {
    const prev = data?.is_playing ?? false;
    if (data) data = { ...data, is_playing: !prev };
    await invokeTauri("media_play_pause");
  }

  async function handleNext() {
    await invokeTauri("media_next_track");
  }

  async function handlePrev() {
    await invokeTauri("media_previous_track");
  }

  function handleSeekStart() {
    dragging = true;
  }

  function handleSeekEnd() {
    dragging = false;
    if (data?.duration) {
      const pos = (seekValue / 100) * data.duration;
      invokeTauri("media_seek", { position: pos });
    }
  }

  function handleSeekInput() {
    if (dragging && data?.duration) {
      const pos = (seekValue / 100) * data.duration;
      if (data) data = { ...data, elapsed_time: pos };
    }
  }

  function fmtTime(sec: number | null | undefined): string {
    if (sec == null || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  let progress = $derived(
    data?.duration && data.duration > 0
      ? dragging
        ? seekValue
        : ((data.elapsed_time ?? 0) / data.duration) * 100
      : 0
  );

  let artworkSrc = $derived(
    data?.artwork_base64 ? `data:image/png;base64,${data.artwork_base64}` : null
  );
</script>

<WidgetWrapper title="Media">
  {#if data}
    <div class="media-player">
      <div class="media-top">
        <div class="media-artwork-wrap">
          {#if artworkSrc}
            <img class="media-artwork" src={artworkSrc} alt={data.title ?? "Album art"} />
          {:else}
            <div class="media-artwork media-artwork--empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          {/if}
        </div>
        <div class="media-info">
          <div class="media-title" class:media-title--empty={!data.title}>{data.title || "No track"}</div>
          <div class="media-artist" class:media-artist--empty={!data.artist}>{data.artist || "Unknown artist"}</div>
          <div class="media-app">{data.app_name ?? ""}</div>
        </div>
      </div>

      <div class="media-levels">
        {#each levels as level}
          <div class="level-bar" style="height: {Math.max(2, level * 32)}px"></div>
        {/each}
      </div>

      <div class="media-seek">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          bind:value={seekValue}
          onmousedown={handleSeekStart}
          onmouseup={handleSeekEnd}
          ontouchstart={handleSeekStart}
          ontouchend={handleSeekEnd}
          oninput={handleSeekInput}
          class="seek-bar"
          aria-label="Seek"
        />
        <div class="seek-times">
          <span class="seek-time">{fmtTime(data.elapsed_time)}</span>
          <span class="seek-time">{fmtTime(data.duration)}</span>
        </div>
      </div>

      <div class="media-controls">
        <button class="ctrl-btn" onclick={handlePrev} aria-label="Previous track" use:tooltip={{ text: "Previous track" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="19 20 9 12 19 4 19 20" /><path d="M5 19V5" stroke="currentColor" stroke-width="2" fill="none" />
          </svg>
        </button>
        <button class="ctrl-btn ctrl-btn--play" onclick={handlePlayPause} aria-label={data.is_playing ? "Pause" : "Play"} use:tooltip={{ text: data.is_playing ? "Pause" : "Play" }}>
          {#if data.is_playing}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          {/if}
        </button>
        <button class="ctrl-btn" onclick={handleNext} aria-label="Next track" use:tooltip={{ text: "Next track" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="5 4 15 12 5 20 5 4" /><path d="M19 5v14" stroke="currentColor" stroke-width="2" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  {:else}
    <div class="media-empty">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span>No media playing</span>
    </div>
  {/if}
</WidgetWrapper>

<style>
  .media-player {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0;
  }

  .media-top {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .media-artwork-wrap {
    flex-shrink: 0;
  }

  .media-artwork {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    object-fit: cover;
  }

  .media-artwork--empty {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .media-info {
    flex: 1;
    min-width: 0;
  }

  .media-title {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .media-title--empty {
    color: rgba(255, 255, 255, 0.3);
  }

  .media-artist {
    font-size: 11px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .media-artist--empty {
    color: rgba(255, 255, 255, 0.2);
  }

  .media-app {
    font-size: 9px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.2);
    margin-top: 2px;
  }

  .media-levels {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 32px;
    padding: 0 2px;
  }

  .level-bar {
    flex: 1;
    border-radius: 2px;
    background: rgba(95, 97, 237, 0.5);
    transition: height 0.08s ease;
    min-height: 2px;
  }

  .media-seek {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .seek-bar {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    outline: none;
    cursor: pointer;
  }

  .seek-bar::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .seek-bar::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    border: none;
  }

  .seek-times {
    display: flex;
    justify-content: space-between;
  }

  .seek-time {
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.25);
    font-variant-numeric: tabular-nums;
  }

  .media-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 2px 0;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .ctrl-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }

  .ctrl-btn:active {
    background: rgba(255, 255, 255, 0.1);
  }

  .ctrl-btn--play {
    width: 34px;
    height: 34px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }

  .ctrl-btn--play:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  .media-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.15);
    font-size: 12px;
    padding: 8px 0;
  }
</style>
