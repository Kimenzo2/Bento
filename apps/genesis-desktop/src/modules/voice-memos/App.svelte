<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { fade, slide } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";
  import MicIcon from "@lucide/svelte/icons/mic";

  let _t = $derived.by(() => createTranslator($activeBundle));

  let t = (key: string, fallback?: string) => _t(key, fallback);
  import PlayIcon from "@lucide/svelte/icons/play";
  import SquareIcon from "@lucide/svelte/icons/square";
  import StopCircleIcon from "@lucide/svelte/icons/stop-circle";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";

  type Memo = {
    id: string;
    title: string;
    duration: number;
    blobUrl: string;
    created: number;
  };

  let memos = $state<Memo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let recording = $state(false);
  let currentTitle = $state("");
  let playingId = $state<string | null>(null);
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let recordingStart = 0;
  let recordingTimer: ReturnType<typeof setInterval> | undefined;
  let recordingDuration = $state(0);
  let audioContext: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let audioLevel = $state(0);
  let analyserInterval: ReturnType<typeof setInterval> | undefined;

  const STORAGE_KEY = "bento_voice_memos";

  function load() {
    try {
      const raw = browser ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        memos = parsed.filter((m: Memo) => m.title && m.created);
      } else {
        memos = [];
      }
    } catch {
      error = _t("moduleVoiceMemosErrorLoad", "Failed to load memos");
      memos = [];
    } finally {
      loading = false;
    }
  }

  function save() {
    const safe = memos.map((m) => ({ id: m.id, title: m.title, duration: m.duration, blobUrl: "", created: m.created }));
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      audioChunks = chunks;

      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);

      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      analyserInterval = setInterval(() => {
        analyserNode?.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        audioLevel = avg / 255;
      }, 50);

      const recorder = new MediaRecorder(stream);
      mediaRecorder = recorder;
      recordingStart = time.now();
      recordingDuration = 0;
      audioLevel = 0;

      recordingTimer = setInterval(() => {
        recordingDuration = Math.floor((time.now() - recordingStart) / 1000);
      }, 100);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const title = currentTitle.trim() || `${_t("moduleVoiceMemosMemo", "Memo")} ${memos.length + 1}`;
        const memo: Memo = {
          id: crypto.randomUUID(),
          title,
          duration: recordingDuration,
          blobUrl: url,
          created: time.now(),
        };
        memos = [memo, ...memos];
        save();
        currentTitle = "";
        recordingDuration = 0;
        audioLevel = 0;
        stream.getTracks().forEach((t) => t.stop());
        audioContext?.close();
        audioContext = null;
        analyserNode = null;
        clearInterval(analyserInterval);
        clearInterval(recordingTimer);
      };

      recorder.start();
      recording = true;
    } catch {
      error = _t("moduleVoiceMemosMicDenied", "Microphone access denied. Please allow microphone permissions.");
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    recording = false;
  }

  function playMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (!memo || !memo.blobUrl) return;
    if (playingId === id) {
      playingId = null;
      return;
    }
    playingId = id;
    const audio = new Audio(memo.blobUrl);
    audio.onended = () => { playingId = null; };
    audio.play().catch(() => { playingId = null; });
  }

  function deleteMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (memo?.blobUrl) URL.revokeObjectURL(memo.blobUrl);
    memos = memos.filter((m) => m.id !== id);
    if (playingId === id) playingId = null;
    save();
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const totalMemos = $derived(memos.length);

  onMount(() => load());
  onDestroy(() => {
    clearInterval(recordingTimer);
    clearInterval(analyserInterval);
    audioContext?.close();
  });
</script>

<main class="memo-workspace module-root" data-module="voice-memos">
  <section class="memo-shell">
    <header class="memo-shell__header">
      <div class="memo-shell__intro">
        <div class="memo-shell__eyebrow">
          <span>{_t("moduleVoiceMemosTitle", "Voice Memos")}</span>
          <Badge variant="outline">{totalMemos} {totalMemos !== 1 ? _t("moduleVoiceMemosRecordings", "recordings") : _t("moduleVoiceMemosRecording", "recording")}</Badge>
        </div>
        <h1>{_t("moduleVoiceMemosDesc", "Record, play back, and keep voice notes.")}</h1>
        <p>{_t("moduleVoiceMemosDescLong", "Capture ideas and reminders with your voice. All recordings stay local.")}</p>
      </div>
      <div class="memo-shell__actions">
        {#if !recording}
          <Button onclick={startRecording}>
            <MicIcon data-icon="inline-start" />
            {_t("moduleVoiceMemosRecord", "Record")}
          </Button>
        {:else}
          <Button variant="outline" onclick={stopRecording}>
            <StopCircleIcon data-icon="inline-start" />
            {_t("moduleVoiceMemosStop", "Stop")}
          </Button>
        {/if}
      </div>
    </header>

    <!-- Recording active -->
    {#if recording}
      <div transition:fade>
      <Card class="memo-recording-card">
        <CardContent class="memo-recording-card__content">
          <div class="memo-recording-visualizer">
            {#each [0.3, 0.5, 0.8, 0.6, 0.9] as base, i}
              <div
                class="memo-level-bar"
                style="animation-delay: {i * 0.1}s; transform: scaleY({base + audioLevel * (1 - base)})"
              ></div>
            {/each}
          </div>
          <div class="memo-recording-info">
            <span class="memo-recording-dot"></span>
            <span class="memo-recording-time">{formatDuration(recordingDuration)}</span>
          </div>
          <input
            type="text"
            class="memo-title-input"
            bind:value={currentTitle}
            placeholder={_t("moduleVoiceMemosPlaceholder", "Add a title (optional)")}
          />
        </CardContent>
      </Card>
      </div>
    {/if}

    <!-- Loading -->
    {#if loading}
      <div class="memo-shell__loading">
        {#each [1, 2, 3] as _}
          <div class="memo-skeleton"></div>
        {/each}
      </div>

    <!-- Error -->
    {:else if error}
      <Card class="memo-panel">
        <CardContent>
          <p>{error}</p>
          <Button variant="outline" onclick={() => { error = null; load(); }}>{_t("commonRetry", "Retry")}</Button>
        </CardContent>
      </Card>

    <!-- Empty -->
    {:else if memos.length === 0}
      <Card class="memo-panel memo-panel--state">
        <CardContent>
          <div class="memo-state">
            <span class="memo-state-icon">🎙️</span>
            <h2 class="memo-state-title">{_t("moduleVoiceMemosEmptyState", "No recordings yet")}</h2>
            <p class="memo-state-desc">{_t("moduleVoiceMemosEmptyDesc", "Press the button above to record your first voice memo.")}</p>
          </div>
        </CardContent>
      </Card>

    <!-- List -->
    {:else}
      <section class="memo-shell__body">
        <div class="memo-list" transition:fade>
          {#each memos as memo (memo.id)}
            <article class="memo-item" transition:slide={{ duration: 100 }}>
              <div class="memo-item__left">
                <span class="memo-item__icon">🎤</span>
                <div class="memo-item__info">
                  <span class="memo-item__title">{memo.title}</span>
                  <span class="memo-item__meta">{formatDuration(memo.duration)} · {formatDate(memo.created)}</span>
                </div>
              </div>
              <div class="memo-item__actions">
                <button type="button" class="memo-item__btn" onclick={() => playMemo(memo.id)} title={playingId === memo.id ? _t("commonStop", "Stop") : _t("commonPlay", "Play")}>
                  {#if playingId === memo.id}
                    <SquareIcon size={15} />
                  {:else}
                    <PlayIcon size={15} />
                  {/if}
                </button>
                <button type="button" class="memo-item__btn memo-item__btn--danger" onclick={() => deleteMemo(memo.id)} title={_t("commonDelete", "Delete")}>
                  <Trash2Icon size={15} />
                </button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/if}
  </section>
</main>

<style>
  :global(.memo-workspace) {
    --memo-bg: var(--background);
    --memo-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --memo-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --memo-border: color-mix(in srgb, var(--border) 86%, transparent);
    --memo-ink: var(--foreground);
    --memo-muted: var(--muted);
    --memo-accent: var(--primary);
    height: 100%;
    padding: 28px 30px;
    background: var(--memo-bg);
    color: var(--memo-ink);
    overflow: hidden;
    font-family: var(--font-body);
  }

  :global(.memo-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.memo-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.memo-shell__intro) { max-width: 56rem; }

  :global(.memo-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--memo-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.memo-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.memo-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--memo-muted);
  }

  :global(.memo-shell__actions) { display: flex; gap: 12px; }

  :global(.memo-recording-card) {
    border-color: var(--memo-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--memo-surface) 98%, var(--background)),
        color-mix(in srgb, var(--memo-surface) 86%, var(--background))
      );
  }

  :global(.memo-recording-card__content) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
  }

  :global(.memo-recording-visualizer) {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
  }

  :global(.memo-level-bar) {
    width: 6px;
    border-radius: 3px;
    background: var(--memo-accent);
    transition: transform 0.08s;
    transform-origin: bottom;
    animation: memo-level 0.6s ease-in-out infinite alternate;
  }

  @keyframes memo-level {
    0% { opacity: 0.6; }
    100% { opacity: 1; }
  }

  :global(.memo-recording-info) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.memo-recording-dot) {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    animation: memo-pulse 1s infinite;
  }

  @keyframes memo-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  :global(.memo-recording-time) {
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  :global(.memo-title-input) {
    width: 100%;
    max-width: 300px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--memo-border);
    background: color-mix(in srgb, var(--memo-surface-strong) 92%, transparent);
    color: var(--memo-ink);
    font-size: 14px;
    outline: none;
    text-align: center;
    box-sizing: border-box;
    font-family: inherit;
  }
  :global(.memo-title-input:focus) { border-color: var(--memo-accent); }
  :global(.memo-title-input::placeholder) { color: var(--memo-muted); }

  :global(.memo-shell__loading) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.memo-skeleton) {
    height: 52px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--memo-border) 72%, transparent);
    animation: memo-pulse 1.5s infinite;
  }

  :global(.memo-panel) {
    border-color: var(--memo-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--memo-surface) 98%, var(--background)),
        color-mix(in srgb, var(--memo-surface) 86%, var(--background))
      );
  }

  :global(.memo-panel--state) :global(.card-content) {
    display: flex;
    justify-content: center;
  }

  :global(.memo-state) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 40px 20px;
  }

  :global(.memo-state-icon) { font-size: 48px; }
  :global(.memo-state-title) { font-size: 18px; font-weight: 600; margin: 0; }
  :global(.memo-state-desc) { font-size: 14px; color: var(--memo-muted); margin: 0; }

  :global(.memo-shell__body),
  :global(.memo-panel),
  :global(.memo-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.memo-shell__body) {
    overflow: auto;
  }

  :global(.memo-list) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.memo-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid color-mix(in srgb, var(--memo-border) 92%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--memo-surface-strong) 92%, transparent);
    transition: border-color 0.15s;
  }
  :global(.memo-item:hover) { border-color: var(--memo-accent); }

  :global(.memo-item__left) { display: flex; align-items: center; gap: 10px; }
  :global(.memo-item__icon) { font-size: 18px; }
  :global(.memo-item__info) { display: flex; flex-direction: column; gap: 1px; }
  :global(.memo-item__title) { font-size: 14px; font-weight: 600; }
  :global(.memo-item__meta) { font-size: 12px; color: var(--memo-muted); }

  :global(.memo-item__actions) { display: flex; gap: 2px; }

  :global(.memo-item__btn) {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    background: transparent;
    color: var(--memo-muted);
    transition: all 0.15s;
  }
  :global(.memo-item__btn:hover) { background: color-mix(in srgb, var(--memo-ink) 8%, transparent); color: var(--memo-ink); }
  :global(.memo-item__btn--danger) { color: var(--destructive, #ef4444); }
  :global(.memo-item__btn--danger:hover) { background: rgba(239, 68, 68, 0.1); }
</style>
