<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { fade, slide } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";
  import MicIcon from "@lucide/svelte/icons/mic";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SquareIcon from "@lucide/svelte/icons/square";
  import StopCircleIcon from "@lucide/svelte/icons/stop-circle";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { toast } from "svelte-sonner";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent } from "$lib/components/ui/card/index.js";

  let _t = $derived.by(() => createTranslator($activeBundle));

  type Memo = {
    id: string;
    title: string;
    duration: number;
    created: number;
    blobUrl?: string;
    ext?: string;
  };

  type DBMemo = {
    id: string;
    title: string;
    duration: number;
    created: number;
    audio: Blob;
    ext?: string;
  };

  let memos = $state<Memo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let recording = $state(false);
  let recordingBusy = $state(false);
  let currentTitle = $state("");
  let playingId = $state<string | null>(null);
  let mediaRecorder: MediaRecorder | null = null;
  let recordingStart = 0;
  let recordingTimer: ReturnType<typeof setInterval> | undefined;
  let recordingDuration = $state(0);
  let audioContext: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let audioLevel = $state(0);
  let analyserInterval: ReturnType<typeof setInterval> | undefined;
  let currentAudio: HTMLAudioElement | null = null;
  let activeStream: MediaStream | null = null;
  let playProgress = $state(0);
  let playDuration = $state(0);
  let progressInterval: ReturnType<typeof setInterval> | undefined;

  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("BentoVoiceMemos", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("memos")) {
          const store = db.createObjectStore("memos", { keyPath: "id" });
          store.createIndex("created", "created", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadMemosFromDB(): Promise<Memo[]> {
    const db = await openDB();
    const tx = db.transaction("memos", "readonly");
    const store = tx.objectStore("memos");
    const index = store.index("created");
    const records: DBMemo[] = await new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result as DBMemo[]);
      request.onerror = () => reject(request.error);
    });
    records.sort((a, b) => b.created - a.created);
    return records.map((r) => ({
      id: r.id,
      title: r.title,
      duration: r.duration,
      created: r.created,
      blobUrl: URL.createObjectURL(r.audio),
      ext: r.ext,
    }));
  }

  async function saveMemoToDB(memo: DBMemo): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("memos", "readwrite");
    const store = tx.objectStore("memos");
    await new Promise<void>((resolve, reject) => {
      const request = store.put(memo);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteMemoFromDB(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction("memos", "readwrite");
    const store = tx.objectStore("memos");
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function load() {
    try {
      if (!browser || !indexedDB) {
        memos = [];
        return;
      }
      memos = await loadMemosFromDB();
    } catch {
      error = _t("moduleVoiceMemosErrorLoad", "Failed to load memos");
      memos = [];
    } finally {
      loading = false;
    }
  }

  async function startRecording() {
    if (recordingBusy) return;
    recordingBusy = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      activeStream = stream;

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

      const chunks: Blob[] = [];
      recordingStart = time.now();
      recordingDuration = 0;
      audioLevel = 0;

      recordingTimer = setInterval(() => {
        recordingDuration = Math.floor((time.now() - recordingStart) / 1000);
      }, 100);

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = () => {
        error = _t("moduleVoiceMemosMicFail", "Microphone recording failed");
        cleanupRecording(stream);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const title = currentTitle.trim() || `${_t("moduleVoiceMemosMemo", "Memo")} ${memos.length + 1}`;
        const memo: Memo = {
          id: crypto.randomUUID(),
          title,
          duration: recordingDuration,
          created: time.now(),
          blobUrl: url,
          ext,
        };
        const dbMemo: DBMemo = {
          ...memo,
          audio: blob,
        };
        memos = [memo, ...memos];
        saveMemoToDB(dbMemo).then(() => toast.success(_t("moduleVoiceMemosRecordingSaved", "Recording saved"))).catch(() => {});
        currentTitle = "";
        cleanupRecording(stream);
      };

      recorder.start(1000);
      recording = true;
      recordingBusy = false;
    } catch (err) {
      recordingBusy = false;
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? _t("moduleVoiceMemosMicDenied", "Microphone access denied. Please allow microphone permissions.")
        : `${_t("moduleVoiceMemosMicFail", "Microphone recording failed")}: ${err instanceof Error ? err.message : String(err)}`;
      error = msg;
    }
  }

  function cleanupRecording(stream: MediaStream) {
    stream.getTracks().forEach((t) => t.stop());
    activeStream = null;
    audioContext?.close();
    audioContext = null;
    analyserNode = null;
    clearInterval(analyserInterval);
    clearInterval(recordingTimer);
    mediaRecorder = null;
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    recording = false;
  }

  function playMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (!memo) {
      console.warn("[voice-memos] playMemo: memo not found", id);
      return;
    }
    if (!memo.blobUrl) {
      console.warn("[voice-memos] playMemo: memo has no blobUrl", id, memo);
      return;
    }
    if (playingId === id) {
      currentAudio?.pause();
      currentAudio = null;
      playingId = null;
      clearInterval(progressInterval);
      return;
    }
    currentAudio?.pause();
    clearInterval(progressInterval);
    playingId = id;
    console.log("[voice-memos] playMemo: starting playback", id, memo.blobUrl);
    const audio = new Audio(memo.blobUrl);
    currentAudio = audio;
    playProgress = 0;
    playDuration = memo.duration;
    audio.addEventListener("loadedmetadata", () => {
      if (currentAudio === audio && audio.duration && isFinite(audio.duration)) {
        playDuration = Math.floor(audio.duration);
        console.log("[voice-memos] loadedmetadata: duration", playDuration);
      }
    });
    audio.addEventListener("error", (e) => {
      const mediaError = audio.error;
      console.error("[voice-memos] audio error:", mediaError?.code, mediaError?.message, e);
    }, { once: true });
    progressInterval = setInterval(() => {
      if (currentAudio && !currentAudio.paused) {
        playProgress = currentAudio.currentTime;
      }
    }, 200);
    audio.onended = () => {
      if (currentAudio === audio) {
        console.log("[voice-memos] playback ended");
        currentAudio = null;
        playingId = null;
        playProgress = playDuration;
        clearInterval(progressInterval);
      }
    };
    audio.onerror = () => {
      if (currentAudio === audio) {
        console.error("[voice-memos] playback error (onerror)");
        currentAudio = null;
        playingId = null;
        clearInterval(progressInterval);
      }
    };
    audio.play().then(() => {
      console.log("[voice-memos] playback started successfully");
    }).catch((err) => {
      console.error("[voice-memos] audio.play() rejected:", err);
      if (currentAudio === audio) { currentAudio = null; playingId = null; clearInterval(progressInterval); }
    });
  }

  function exportMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (!memo?.blobUrl) return;
    const a = document.createElement("a");
    a.href = memo.blobUrl;
    a.download = `${memo.title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.${memo.ext ?? "webm"}`;
    a.click();
  }

  function deleteMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (memo?.blobUrl) URL.revokeObjectURL(memo.blobUrl);
    memos = memos.filter((m) => m.id !== id);
    if (playingId === id) {
      currentAudio?.pause();
      currentAudio = null;
      playingId = null;
      clearInterval(progressInterval);
    }
    deleteMemoFromDB(id).catch(() => {});
    toast.success(_t("moduleVoiceMemosRecordingDeleted", "Recording deleted"));
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

  function onKeydown(e: KeyboardEvent) {
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      if (recording) stopRecording();
      else startRecording();
    }
  }

  onMount(() => {
    load();
    if (browser) document.addEventListener("keydown", onKeydown);
  });
  onDestroy(() => {
    if (browser) document.removeEventListener("keydown", onKeydown);
    clearInterval(recordingTimer);
    clearInterval(analyserInterval);
    clearInterval(progressInterval);
    currentAudio?.pause();
    audioContext?.close();
    activeStream?.getTracks().forEach((t) => t.stop());
    memos.forEach((m) => { if (m.blobUrl) URL.revokeObjectURL(m.blobUrl); });
  });
</script>

<main class="memo-workspace module-root" data-module="voice-memos">
  <section class="memo-shell">
    <header class="memo-shell__header">
      <div class="memo-shell__intro">
        <div class="memo-shell__eyebrow">
          <MicIcon size={13}/><span>{_t("moduleVoiceMemosTitle", "Voice Memos")}</span>
          <Badge variant="outline">{totalMemos} {totalMemos !== 1 ? _t("moduleVoiceMemosRecordings", "recordings") : _t("moduleVoiceMemosRecording", "recording")}</Badge>
        </div>
        <h1>{_t("moduleVoiceMemosDesc", "Record, play back, and keep voice notes.")}</h1>
        <p>{_t("moduleVoiceMemosDescLong", "Capture ideas and reminders with your voice. All recordings stay local.")}</p>
      </div>
      <div class="memo-shell__actions">
        {#if !recording}
          <Button onclick={startRecording} disabled={recordingBusy}>
            <MicIcon data-icon="inline-start" />
            {recordingBusy ? _t("moduleVoiceMemosAccessing", "Accessing mic…") : _t("moduleVoiceMemosRecord", "Record")}
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
                style="transform: scaleY({base + audioLevel * (1 - base)})"
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
          <div class="memo-error-actions">
            <Button variant="outline" onclick={() => { error = null; startRecording(); }}>{_t("commonRetry", "Retry")}</Button>
            <Button variant="ghost" onclick={() => { error = null; }}>{_t("commonDismiss", "Dismiss")}</Button>
          </div>
        </CardContent>
      </Card>

    <!-- Empty -->
    {:else if memos.length === 0}
      <Card class="memo-panel memo-panel--state">
        <CardContent>
          <div class="memo-state">
            <span class="memo-state-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            </span>
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
            <article class="memo-item" class:memo-item--playing={playingId === memo.id} transition:slide={{ duration: 100 }}>
              <div class="memo-item__left">
                <span class="memo-item__icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                </span>
                <div class="memo-item__info">
                  <span class="memo-item__title">{memo.title}</span>
                  <span class="memo-item__meta">
                    {#if playingId === memo.id}
                      {formatDuration(Math.floor(playProgress))} / {formatDuration(memo.duration)}
                    {:else}
                      {formatDuration(memo.duration)}
                    {/if}
                     · {formatDate(memo.created)}
                  </span>
                  {#if playingId === memo.id}
                    <div class="memo-item__progress">
                      <div class="memo-item__progress-track">
                        <div class="memo-item__progress-fill" style="width: {memo.duration > 0 ? (playProgress / memo.duration) * 100 : 0}%"></div>
                      </div>
                    </div>
                  {/if}
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
                <button type="button" class="memo-item__btn" onclick={() => exportMemo(memo.id)} title={_t("commonDownload", "Download")}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
    color: var(--memo-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.memo-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    font-family: var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  :global(.memo-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--memo-muted);
    font-size: 0.97rem;
    line-height: 1.55;
    text-wrap: pretty;
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

  :global(.memo-state-icon) { display: flex; color: var(--memo-muted); }
  :global(.memo-state-title) { font-size: 18px; font-weight: 600; margin: 0; }
  :global(.memo-state-desc) { font-size: 14px; color: var(--memo-muted); margin: 0; }
  :global(.memo-error-actions) { display: flex; gap: 8px; margin-top: 12px; }

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

  :global(.memo-item--playing) { border-color: var(--memo-accent); }

  :global(.memo-item__progress) { margin-top: 3px; }
  :global(.memo-item__progress-track) {
    height: 3px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--memo-border) 72%, transparent);
    overflow: hidden;
  }
  :global(.memo-item__progress-fill) {
    height: 100%;
    border-radius: 2px;
    background: var(--memo-accent);
    transition: width 0.2s linear;
  }

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
