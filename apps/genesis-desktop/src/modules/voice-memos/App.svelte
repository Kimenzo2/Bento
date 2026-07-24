<script lang="ts">

  import { fade, slide } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { tooltip } from "$lib/components/Tooltip.svelte";
  import { isTauri, convertFileSrc } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import * as AudioService from "$lib/services/audio-recording";
  import { listVoiceMemoEntries, saveVoiceMemoEntry, deleteVoiceMemoEntry, isIndexedDBAvailable, createBlobUrl, revokeBlobUrl } from "$lib/services/voice-memos-storage";
  import type { VoiceMemoEntry } from "$lib/services/voice-memos-storage";
  import MicIcon from "@lucide/svelte/icons/mic";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SquareIcon from "@lucide/svelte/icons/square";
  import StopCircleIcon from "@lucide/svelte/icons/stop-circle";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import CheckIcon from "@lucide/svelte/icons/check";
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
    filePath?: string;
    ext?: string;
    transcript?: string;
    source?: VoiceMemoEntry["source"];
  };

  type DBMemo = {
    id: string;
    title: string;
    transcript?: string;
    duration: number;
    created: number;
    audio: Blob;
    ext?: string;
    source?: VoiceMemoEntry["source"];
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

  const useRust = typeof isTauri === "function" ? isTauri() : false;

  async function load() {
    try {
      createdBlobUrls.forEach((url) => revokeBlobUrl(url));
      createdBlobUrls.clear();
      if (useRust) {
        const recordings = await AudioService.listRecordings("voice-memos");
        memos = recordings.map((r) => {
          const blobUrl = r.filePath ? convertFileSrc(r.filePath) : undefined;
          if (blobUrl) createdBlobUrls.add(blobUrl);
          return {
            id: r.id,
            title: r.title,
            transcript: r.transcript ?? undefined,
            duration: r.durationSecs,
            created: r.createdAt,
            blobUrl,
            filePath: r.filePath,
          };
        });
      }
      if (isIndexedDBAvailable()) {
        const indexDbResults = await listVoiceMemoEntries();
        const existingIds = new Set(memos.map((m) => m.id));
        for (const { entry, blob } of indexDbResults) {
          if (!existingIds.has(entry.id)) {
            let blobUrl: string | undefined;
            if (blob) {
              blobUrl = createBlobUrl(blob);
              createdBlobUrls.add(blobUrl);
            }
            memos = [...memos, {
              id: entry.id,
              title: entry.title,
              transcript: entry.transcript,
              duration: entry.duration,
              created: entry.created,
              blobUrl,
              filePath: entry.filePath,
              ext: entry.ext,
              source: entry.source,
            }];
          }
        }
      }
      memos.sort((a, b) => b.created - a.created);
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
    if (useRust) {
      try {
        recordingStart = Date.now();
        recordingDuration = 0;
        audioLevel = 0;
        await AudioService.startRecording("voice-memos");
        recordingTimer = setInterval(() => {
          recordingDuration = Math.floor((Date.now() - recordingStart) / 1000);
          if (recordingDuration >= MAX_RECORDING_SECS) {
            toast.info(_t("moduleVoiceMemosMaxDuration", "Maximum recording duration reached"));
            stopRecording();
          }
        }, 1000);
        recording = true;
        recordingBusy = false;
      } catch (err) {
        recordingBusy = false;
        error = `${_t("moduleVoiceMemosMicFail", "Microphone recording failed")}: ${err instanceof Error ? err.message : String(err)}`;
      }
      return;
    }
    let stream: MediaStream | null = null;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage && estimate.quota && (estimate.usage / estimate.quota) > 0.95) {
          error = _t("moduleVoiceMemosStorageFull", "Storage nearly full. Free up space before recording.");
          recordingBusy = false;
          return;
        }
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);

      activeStream = stream;

      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      analyserInterval = setInterval(() => {
        if (document.hidden) return;
        analyserNode?.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        audioLevel = avg / 255;
      }, 50);

      const chunks: Blob[] = [];
      recordingStart = Date.now();
      recordingDuration = 0;
      audioLevel = 0;

      recordingTimer = setInterval(() => {
        recordingDuration = Math.floor((Date.now() - recordingStart) / 1000);
        if (recordingDuration >= MAX_RECORDING_SECS) {
          toast.info(_t("moduleVoiceMemosMaxDuration", "Maximum recording duration reached"));
          stopRecording();
        }
      }, 1000);

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const ext = mimeType ? mimeType.split("/")[1]?.split(";")[0] || "webm" : "webm";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = () => {
        error = _t("moduleVoiceMemosMicFail", "Microphone recording failed");
        cleanupRecording(stream!);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        createdBlobUrls.add(url);
        const title = currentTitle.trim() || `${_t("moduleVoiceMemosMemo", "Memo")} ${memos.length + 1}`;
        const memo: Memo = {
          id: crypto.randomUUID(),
          title,
          duration: recordingDuration,
          created: Date.now(),
          blobUrl: url,
          ext,
          source: "voice_note",
        };
        const dbMemo: DBMemo = {
          id: memo.id,
          title: memo.title,
          duration: memo.duration,
          created: memo.created,
          audio: blob,
          ext,
          source: "voice_note",
        };
        memos = [memo, ...memos];
        saveVoiceMemoEntry(
          { id: memo.id, title: memo.title, duration: memo.duration, created: memo.created, ext, source: "voice_note" },
          blob,
        ).then(() => toast.success(_t("moduleVoiceMemosRecordingSaved", "Recording saved"))).catch(() => {
          toast.error(_t("moduleVoiceMemosSaveFail", "Failed to save recording to storage"));
          memos = memos.filter((m) => m.id !== memo.id);
        });
        currentTitle = "";
        cleanupRecording(stream!);
      };

      recorder.start();
      recording = true;
      recordingBusy = false;
    } catch (err) {
      recordingBusy = false;
      cleanupStream(stream);
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? _t("moduleVoiceMemosMicDenied", "Microphone access denied. Please allow microphone permissions.")
        : `${_t("moduleVoiceMemosMicFail", "Microphone recording failed")}: ${err instanceof Error ? err.message : String(err)}`;
      error = msg;
    }
  }

  function cleanupStream(stream: MediaStream | null) {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(analyserInterval);
    clearInterval(recordingTimer);
    audioContext?.close();
    audioContext = null;
    analyserNode = null;
    activeStream = null;
  }

  function cleanupRecording(stream: MediaStream) {
    cleanupStream(stream);
    mediaRecorder = null;
  }

  let savingRecording = $state(false);

  async function stopRecording() {
    if (useRust) {
      savingRecording = true;
      try {
        const session = await AudioService.stopRecording();
        const ext = "wav";
        const memo: Memo = {
          id: session.id,
          title: currentTitle.trim() || `${_t("moduleVoiceMemosMemo", "Memo")} ${memos.length + 1}`,
          duration: Math.floor(session.elapsedMs / 1000),
          created: session.startTime,
          blobUrl: session.filePath ? convertFileSrc(session.filePath) : undefined,
          filePath: session.filePath ?? undefined,
          ext,
        };
        if (memo.blobUrl) createdBlobUrls.add(memo.blobUrl);
        memos = [memo, ...memos];
        currentTitle = "";
        recording = false;
        clearInterval(recordingTimer);
        toast.success(_t("moduleVoiceMemosRecordingSaved", "Recording saved"));
      } catch (err) {
        toast.error(_t("moduleVoiceMemosSaveFail", "Failed to save recording"));
        recording = false;
      } finally {
        savingRecording = false;
      }
      return;
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    recording = false;
  }

  async function cancelRecording() {
    if (useRust) {
      try {
        await AudioService.cancelRecording();
      } catch { /* best-effort */ }
    } else {
      cleanupStream(activeStream);
      mediaRecorder = null;
    }
    recording = false;
    recordingBusy = false;
    clearInterval(recordingTimer);
    currentTitle = "";
  }

  function playMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (!memo) {
      toast.error(_t("moduleVoiceMemosPlaybackFail", "Could not find memo to play"));
      return;
    }
    if (!memo.blobUrl) {
      toast.error(_t("moduleVoiceMemosPlaybackFail", "Recording data unavailable"));
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
    const audio = new Audio(memo.blobUrl);
    currentAudio = audio;
    playProgress = 0;
    playDuration = memo.duration;
    audio.addEventListener("loadedmetadata", () => {
      if (currentAudio === audio && audio.duration && isFinite(audio.duration)) {
        playDuration = Math.floor(audio.duration);
      }
    });
    audio.addEventListener("error", () => {
      toast.error(_t("moduleVoiceMemosPlaybackFail", "Playback failed — recording may be corrupted"));
      if (currentAudio === audio) {
        currentAudio = null;
        playingId = null;
        clearInterval(progressInterval);
      }
    }, { once: true });
    progressInterval = setInterval(() => {
      if (document.hidden) return;
      if (currentAudio && !currentAudio.paused) {
        playProgress = currentAudio.currentTime;
      }
    }, 200);
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        playingId = null;
        playProgress = playDuration;
        clearInterval(progressInterval);
      }
    };
    audio.onerror = () => {
      toast.error(_t("moduleVoiceMemosPlaybackFail", "Playback error occurred"));
      if (currentAudio === audio) {
        currentAudio = null;
        playingId = null;
        clearInterval(progressInterval);
      }
    };
    audio.play().catch(() => {
      toast.error(_t("moduleVoiceMemosPlaybackFail", "Could not start playback"));
      if (currentAudio === audio) { currentAudio = null; playingId = null; clearInterval(progressInterval); }
    });
  }

  async function exportMemo(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (!memo?.blobUrl) return;
    const safeTitle = memo.title.replace(/[<>:"/\\|?*]/g, "").trim() || "recording";
    const ext = memo.ext ?? "webm";
    if (useRust && memo.filePath) {
      try {
        const response = await fetch(memo.blobUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeTitle}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      } catch { /* fall through to browser fallback */ }
    }
    const a = document.createElement("a");
    a.href = memo.blobUrl;
    a.download = `${safeTitle}.${ext}`;
    a.click();
  }

  const MAX_RECORDING_SECS = 3600;
  const MAX_TITLE_LENGTH = 100;
  const createdBlobUrls = new Set<string>();
  let deletingId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let editingTitle = $state("");
  let reducedMotion = $state(false);

  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  function startEditTitle(id: string) {
    const memo = memos.find((m) => m.id === id);
    if (!memo) return;
    editingId = id;
    editingTitle = memo.title;
  }

  function saveEditTitle() {
    if (!editingId) return;
    const trimmed = editingTitle.trim().slice(0, MAX_TITLE_LENGTH);
    if (!trimmed) { editingId = null; editingTitle = ""; return; }
    memos = memos.map((m) => m.id === editingId ? { ...m, title: trimmed } : m);
    if (useRust) {
      AudioService.updateRecordingTitle(editingId, trimmed).catch(() => {
        toast.error(_t("moduleVoiceMemosRenameFail", "Failed to update title"));
      });
    }
    editingId = null;
    editingTitle = "";
  }

  function deleteMemo(id: string) {
    if (deletingId) return;
    if (!confirm(_t("moduleVoiceMemosDeleteConfirm", "Delete this recording? This cannot be undone."))) return;
    const memo = memos.find((m) => m.id === id);
    deletingId = id;
    const removeFromList = () => {
      if (memo?.blobUrl) { URL.revokeObjectURL(memo.blobUrl); createdBlobUrls.delete(memo.blobUrl); }
      memos = memos.filter((m) => m.id !== id);
      if (playingId === id) {
        currentAudio?.pause();
        currentAudio = null;
        playingId = null;
        clearInterval(progressInterval);
      }
    };
    const del = useRust
      ? AudioService.deleteRecording(id).then(() => deleteVoiceMemoEntry(id).catch(() => {}))
      : deleteVoiceMemoEntry(id);
    del.then(() => {
      removeFromList();
      toast.success(_t("moduleVoiceMemosRecordingDeleted", "Recording deleted"));
    }).catch(() => {
      toast.error(_t("moduleVoiceMemosDeleteFail", "Failed to delete recording"));
    }).finally(() => {
      deletingId = null;
    });
  }

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const totalMemos = $derived(memos.length);
  type MemoView = "all" | "recent";
  let memoView = $state<MemoView>("all");
  let searchQuery = $state("");

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
  }
  const recentMemos = $derived(memos.filter((m) => m.created > Date.now() - 7 * 86400000));
  const viewFiltered = $derived(memoView === "recent" ? recentMemos : memos);
  const visibleMemos = $derived(
    searchQuery
      ? viewFiltered.filter((m) => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : viewFiltered,
  );
  let memoListEl = $state<HTMLElement | null>(null);

  function getDateGroup(ts: number): string {
    const now = Date.now();
    const day = 86400000;
    const diff = now - ts;
    if (diff < day) return _t("moduleVoiceMemosGroupToday", "Today");
    if (diff < 2 * day) return _t("moduleVoiceMemosGroupYesterday", "Yesterday");
    if (diff < 7 * day) return _t("moduleVoiceMemosGroupThisWeek", "This Week");
    if (diff < 30 * day) return _t("moduleVoiceMemosGroupThisMonth", "This Month");
    return _t("moduleVoiceMemosGroupOlder", "Older");
  }

  type MemoGroup = { label: string; memos: Memo[] };
  const memoGroups = $derived.by(() => {
    const groups = new Map<string, Memo[]>();
    for (const memo of visibleMemos) {
      const label = getDateGroup(memo.created);
      let group = groups.get(label);
      if (!group) { group = []; groups.set(label, group); }
      group.push(memo);
    }
    const order = [_t("moduleVoiceMemosGroupToday", "Today"), _t("moduleVoiceMemosGroupYesterday", "Yesterday"), _t("moduleVoiceMemosGroupThisWeek", "This Week"), _t("moduleVoiceMemosGroupThisMonth", "This Month"), _t("moduleVoiceMemosGroupOlder", "Older")];
    const result: MemoGroup[] = [];
    for (const label of order) {
      const group = groups.get(label);
      if (group) result.push({ label, memos: group });
    }
    return result;
  });

  // Scroll to top when a new memo is added
  let prevLen = 0;
  $effect(() => {
    if (memos.length > prevLen && memoListEl) {
      memoListEl.scrollTop = 0;
    }
    prevLen = memos.length;
  });

  function onKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      if (recording) stopRecording();
      else startRecording();
    }
  }

  let unlistenAudioLevel: (() => void) | null = null;
  let unlistenRustError: (() => void) | null = null;

  $effect(() => {
    load();
    document.addEventListener("keydown", onKeydown);
    if (useRust) {
      listen<{ level: number; rms: number; peak: number }>("voice:audio-level", (event) => {
        audioLevel = event.payload.level;
      }).then((u) => { unlistenAudioLevel = u; });
      listen<{ code: string; message: string }>("voice:error", (event) => {
        if (recording) {
          toast.error(event.payload.message || _t("moduleVoiceMemosMicFail", "Recording error"));
          cancelRecording();
        }
      }).then((u) => { unlistenRustError = u; });
    }
    return () => {
      document.removeEventListener("keydown", onKeydown);
      unlistenAudioLevel?.();
      unlistenAudioLevel = null;
      unlistenRustError?.();
      unlistenRustError = null;
      clearInterval(recordingTimer);
      clearInterval(analyserInterval);
      clearInterval(progressInterval);
      currentAudio?.pause();
      audioContext?.close();
      activeStream?.getTracks().forEach((t) => t.stop());
      createdBlobUrls.forEach((url) => URL.revokeObjectURL(url));
      createdBlobUrls.clear();
    };
  });
</script>

<main class="memo-workspace module-root" data-module="voice-memos">
  <section class="memo-shell">
    <header class="memo-shell__header">
      <div class="memo-shell__intro">
        <div class="memo-shell__eyebrow">
          <MicIcon size={13}/><span>{_t("moduleVoiceMemosTitle", "Voice Memos")}</span>
          <Badge variant="outline"><span class="number number-tabular">{totalMemos}</span> {totalMemos !== 1 ? _t("moduleVoiceMemosRecordings", "recordings") : _t("moduleVoiceMemosRecording", "recording")}</Badge>
        </div>
        <h1>{_t("moduleVoiceMemosDesc", "Record, play back, and keep voice notes.")}</h1>
        <p>{_t("moduleVoiceMemosDescLong", "Capture ideas and reminders with your voice. All recordings stay local.")}</p>
      </div>
      <div class="memo-shell__actions">
        {#if !recording && !savingRecording}
          <Button onclick={startRecording} disabled={recordingBusy}>
            <MicIcon data-icon="inline-start" />
            {recordingBusy ? _t("moduleVoiceMemosAccessing", "Accessing mic…") : _t("moduleVoiceMemosRecord", "Record")}
          </Button>
        {/if}
      </div>
    </header>

    <!-- Saving -->
    {#if savingRecording}
      <div transition:fade>
      <Card class="memo-recording-card">
        <CardContent class="memo-recording-card__content">
          <div class="memo-saving-spinner"></div>
          <span class="memo-recording-time">{_t("moduleVoiceMemosSaving", "Saving…")}</span>
        </CardContent>
      </Card>
      </div>
    {/if}

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
            <span class="memo-recording-time number number-tabular">{formatDuration(recordingDuration)}</span>
          </div>
          <input
            type="text"
            class="memo-title-input"
            bind:value={currentTitle}
            maxlength={MAX_TITLE_LENGTH}
            placeholder={_t("moduleVoiceMemosPlaceholder", "Add a title (optional)")}
          />
          <div class="memo-recording-actions">
            <Button variant="outline" onclick={stopRecording} disabled={recordingBusy}>
              <StopCircleIcon data-icon="inline-start" size={14} />
              {_t("moduleVoiceMemosDone", "Done")}
            </Button>
            <Button variant="ghost" onclick={cancelRecording} disabled={recordingBusy}>
              {_t("commonCancel", "Cancel")}
            </Button>
          </div>
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
    {:else if visibleMemos.length === 0 && memos.length > 0}
      <Card class="memo-panel memo-panel--state">
        <CardContent>
          <div class="memo-state">
            <h2 class="memo-state-title">{_t("moduleVoiceMemosNoRecent", "No recent recordings")}</h2>
            <p class="memo-state-desc">{_t("moduleVoiceMemosNoRecentDesc", "Switch to All view to see older recordings.")}</p>
            <Button variant="outline" onclick={() => memoView = "all"}>{_t("moduleVoiceMemosViewAll", "View All")}</Button>
          </div>
        </CardContent>
      </Card>

    {:else if visibleMemos.length === 0 && searchQuery}
      <Card class="memo-panel memo-panel--state">
        <CardContent>
          <div class="memo-state">
            <h2 class="memo-state-title">{_t("moduleVoiceMemosNoSearchResults", "No matching recordings")}</h2>
            <p class="memo-state-desc">{_t("moduleVoiceMemosNoSearchResultsDesc", "Try a different search term.")}</p>
          </div>
        </CardContent>
      </Card>

    {:else if memos.length === 0}
      <Card class="memo-panel memo-panel--state">
        <CardContent>
          <div class="memo-state">
            <span class="memo-state-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            </span>
            <h2 class="memo-state-title">{_t("moduleVoiceMemosEmptyState", "No recordings yet")}</h2>
            <p class="memo-state-desc">{_t("moduleVoiceMemosEmptyDesc", "Press the button above or hit Space to record your first voice memo.")}</p>
          </div>
        </CardContent>
      </Card>

    <!-- List -->
    {:else}
      <section class="memo-shell__body" bind:this={memoListEl}>
        <nav class="memo-shell__nav">
          <button
            class="memo-nav-btn"
            class:memo-nav-btn--active={memoView === "all"}
            onclick={() => memoView = "all"}
          >{_t("moduleVoiceMemosViewAll", "All")} <span class="number number-tabular">({totalMemos})</span></button>
          <button
            class="memo-nav-btn"
            class:memo-nav-btn--active={memoView === "recent"}
            onclick={() => memoView = "recent"}
          >{_t("moduleVoiceMemosViewRecent", "Recent")} <span class="number number-tabular">({recentMemos.length})</span></button>
        </nav>
        <div class="memo-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            class="memo-search-input"
            placeholder={_t("moduleVoiceMemosSearch", "Search recordings…")}
            aria-label={_t("moduleVoiceMemosSearch", "Search recordings…")}
            bind:value={searchQuery}
          />
        </div>
        <div class="memo-list" transition:fade>
          {#each memoGroups as group}
            <div class="memo-group">
              <span class="memo-group__label">{group.label}</span>
              {#each group.memos as memo (memo.id)}
            <article
              class="memo-item"
              class:memo-item--playing={playingId === memo.id}
              transition:slide={{ duration: reducedMotion ? 0 : 100 }}
              tabindex="0"
              role="button"
              aria-label={`${memo.title} — ${formatDuration(memo.duration)}`}
              onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); playMemo(memo.id); } if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteMemo(memo.id); } }}
            >
              <div class="memo-item__left">
                <span class="memo-item__icon" aria-hidden="true">
                  {#if memo.blobUrl}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                  {:else}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  {/if}
                </span>
                <div class="memo-item__info">
                  {#if editingId === memo.id}
                    <input
                      type="text"
                      class="memo-edit-input"
                      bind:value={editingTitle}
                      maxlength={MAX_TITLE_LENGTH}
                      onblur={saveEditTitle}
                      onkeydown={(e) => { if (e.key === "Enter") saveEditTitle(); if (e.key === "Escape") { editingId = null; editingTitle = ""; } }}
                      use:focusOnMount
                    />
                  {:else}
                    <span class="memo-item__title">{memo.title}</span>
                  {/if}
                  <span class="memo-item__meta">
                    {#if memo.transcript}
                      <span class="memo-item__transcript" title={memo.transcript}>{memo.transcript.slice(0, 80)}{memo.transcript.length > 80 ? "…" : ""}</span>
                    {:else}
                      {#if playingId === memo.id}
                        <span class="number number-tabular">{formatDuration(Math.floor(playProgress))}</span> / <span class="number number-tabular">{formatDuration(memo.duration)}</span>
                      {:else}
                        <span class="number number-tabular">{formatDuration(memo.duration)}</span>
                      {/if}
                       ·
                    {/if}
                    {formatDate(memo.created)}
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
                {#if memo.blobUrl}
                  <button type="button" class="memo-item__btn" onclick={() => playMemo(memo.id)} use:tooltip={{ text: playingId === memo.id ? _t("commonStop", "Stop") : _t("commonPlay", "Play") }}>
                    {#if playingId === memo.id}
                      <SquareIcon size={15} />
                    {:else}
                      <PlayIcon size={15} />
                    {/if}
                  </button>
                {/if}
                <button type="button" class="memo-item__btn" onclick={() => editingId === memo.id ? saveEditTitle() : startEditTitle(memo.id)} use:tooltip={{ text: editingId === memo.id ? _t("commonSave", "Save") : _t("commonEdit", "Edit") }}>
                  {#if editingId === memo.id}
                    <CheckIcon size={15} />
                  {:else}
                    <PencilIcon size={15} />
                  {/if}
                </button>
                {#if memo.blobUrl}
                  <button type="button" class="memo-item__btn" onclick={() => exportMemo(memo.id)} use:tooltip={{ text: _t("commonDownload", "Download") }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                {/if}
                <button type="button" class="memo-item__btn memo-item__btn--danger" onclick={() => deleteMemo(memo.id)} disabled={deletingId === memo.id} use:tooltip={{ text: _t("commonDelete", "Delete") }}>
                  <Trash2Icon size={15} />
                </button>
              </div>
            </article>
          {/each}
            </div>
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
    background: oklch(0.627 0.258 29.234);
    animation: memo-pulse 1s infinite;
  }

  @keyframes memo-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  :global(.memo-recording-time) {
    font-size: 18px;
  }

  :global(.memo-title-input) {
    width: 100%;
    max-width: 300px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--memo-border);
    background: var(--memo-bg);
    color: var(--memo-ink);
    font-size: 14px;
    outline: none;
    text-align: center;
    box-sizing: border-box;
    font-family: inherit;
  }
  :global(.memo-title-input:focus) { border-color: var(--memo-accent); }
  :global(.memo-title-input::placeholder) { color: var(--memo-muted); }

  :global(.memo-recording-actions) {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  :global(.memo-saving-spinner) {
    width: 24px;
    height: 24px;
    border: 2px solid var(--memo-border);
    border-top-color: var(--memo-accent);
    border-radius: 50%;
    animation: memo-spin 0.6s linear infinite;
  }

  @keyframes memo-spin {
    to { transform: rotate(360deg); }
  }

  :global(.memo-shell__loading) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.memo-skeleton) {
    height: 52px;
    border-radius: 12px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--memo-border) 72%, transparent) 25%,
      color-mix(in srgb, var(--memo-border) 52%, transparent) 50%,
      color-mix(in srgb, var(--memo-border) 72%, transparent) 75%
    );
    background-size: 200% 100%;
    animation: memo-shimmer 1.5s infinite;
  }
  @keyframes memo-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
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

  :global(.memo-search) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--memo-border);
    background: var(--memo-bg);
    margin-bottom: 10px;
    color: var(--memo-muted);
  }
  :global(.memo-search:focus-within) { border-color: var(--memo-accent); }
  :global(.memo-search-input) {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--memo-ink);
    font-size: 13px;
    outline: none;
    font-family: inherit;
  }
  :global(.memo-search-input::placeholder) { color: var(--memo-muted); }

  :global(.memo-group) { margin-bottom: 4px; }
  :global(.memo-group__label) {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--memo-muted);
    padding: 8px 4px 4px;
  }
  :global(.memo-group:first-child .memo-group__label) { padding-top: 0; }

  :global(.memo-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid color-mix(in srgb, var(--memo-border) 92%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--memo-surface-strong) 92%, transparent);
    transition: border-color 0.15s cubic-bezier(0.23, 1, 0.32, 1);
  }
  :global(.memo-item:hover) { border-color: var(--memo-accent); }

  :global(.memo-item__left) { display: flex; align-items: center; gap: 10px; }
  :global(.memo-item__icon) { font-size: 18px; }
  :global(.memo-item__info) { display: flex; flex-direction: column; gap: 1px; }
  :global(.memo-item__title) { font-size: 14px; font-weight: 600; }
  :global(.memo-item__transcript) {
    font-size: 12px;
    color: var(--memo-muted);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
    transition-property: width;
    transition-duration: 0.2s;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  }

  :global(.memo-item__actions) { display: flex; gap: 2px; }

  :global(.memo-item__btn) {
    position: relative;
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
    transition-property: background-color, color, transform;
    transition-duration: 0.15s;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  }
  :global(.memo-item__btn::after) {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 14px;
  }
  :global(.memo-item__btn:hover) { background: color-mix(in srgb, var(--memo-ink) 8%, transparent); color: var(--memo-ink); }
  :global(.memo-item__btn:active) { transform: scale(0.96); }
  :global(.memo-shell__nav) {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }
  :global(.memo-nav-btn) {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 13px;
    background: transparent;
    color: var(--memo-muted);
    transition-property: background-color, color, transform;
    transition-duration: 0.15s;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
    font-family: inherit;
  }
  :global(.memo-nav-btn:hover) { background: color-mix(in srgb, var(--memo-ink) 6%, transparent); color: var(--memo-ink); }
  :global(.memo-nav-btn:active) { transform: scale(0.96); }
  :global(.memo-nav-btn--active) {
    background: color-mix(in srgb, var(--memo-accent) 12%, transparent);
    color: var(--memo-accent);
    border-color: color-mix(in srgb, var(--memo-accent) 24%, transparent);
  }
  :global(.memo-item__btn--danger) { color: var(--destructive, oklch(0.627 0.258 29.234)); }
  :global(.memo-item__btn--danger:hover) { background: oklch(0.627 0.258 29.234 / 0.1); }
  :global(.memo-item__btn:disabled) { opacity: 0.4; cursor: not-allowed; }

  :global(.memo-edit-input) {
    width: 100%;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--memo-accent);
    background: var(--memo-bg);
    color: var(--memo-ink);
    font-size: 14px;
    font-weight: 600;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.memo-recording-dot) { animation: none; }
    :global(.memo-level-bar) { transition: none; }
    :global(.memo-skeleton) { animation: none; }
    :global(.memo-item) { transition: none; }
    :global(.memo-item__btn) { transition: none; }
    :global(.memo-item__btn:active) { transform: none; }
    :global(.memo-item__progress-fill) { transition: none; }
    :global(.memo-nav-btn) { transition: none; }
    :global(.memo-nav-btn:active) { transform: none; }
  }
</style>
