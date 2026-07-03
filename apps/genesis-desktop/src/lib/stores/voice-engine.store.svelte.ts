// ═══════════════════════════════════════════════════════════════════════
// Voice Engine Store — Single source of truth for all voice operations
// ═══════════════════════════════════════════════════════════════════════
// Both Agent Dock and Dynamic Island read from this store reactively.
// No direct IPC calls from UI components — only through the store.
// ═══════════════════════════════════════════════════════════════════════

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { islandStore } from "$lib/stores/island.store.svelte";

// ─── Constants ───────────────────────────────────────────────────────

/** Push-to-talk minimum hold duration (ms). Shorter presses are ignored. */
export const PTT_GRACE_MS = 160;

/** Dictation writing style options. */
export type DictationStyle = "standard" | "casual" | "formal";

// ─── Island State Type (mirrors ActiveModuleState) ────────────────

interface VoiceIslandState {
  id: string;
  label: string;
  icon: string;
  status: string;
  activityType?: "recording" | "timer" | "active" | "playback";
}

interface LiveTranscriptEvent {
  noteId: string;
  sessionId: string;
  source: string;
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
}

interface DictationProcessResult {
  text: string;
  agentTrigger: {
    detected: boolean;
    agentPrompt: string | null;
    triggerPhrase: string | null;
  };
  charCount: number;
}

// ─── Types ───────────────────────────────────────────────────────────

export type VoiceMode = "idle" | "dictation" | "voice_note" | "meeting" | "agent_conversation";

export type VoiceStatus =
  | "inactive"
  | "initializing"
  | "listening" // mic open, capturing (Web Speech)
  | "recording" // actively recording (Rust cpal)
  | "paused" // recording paused
  | "processing" // transcribing / classifying
  | "summarizing" // AI generating summary
  | "completed" // done, showing result
  | "error";

export interface VoiceSession {
  id: string;
  mode: VoiceMode;
  status: VoiceStatus;
  startTime: number; // epoch ms
  elapsedMs: number; // updated every 200ms
  audioLevel: number; // 0.0–1.0 for waveform
  interimText: string; // streaming transcript (Web Speech)
  finalText: string; // completed transcript (Moonshine)
  recordingId: string | null; // references Rust recording session
  filePath: string | null;
  summary: string | null;
  actions: { text: string; done: boolean }[];
  error: string | null;
}

export type VoiceIntent = "dictation" | "voice_note" | "meeting" | "agent_query";

// ─── Helpers ─────────────────────────────────────────────────────────

function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function generateId(): string {
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Store ───────────────────────────────────────────────────────────

class VoiceEngineStore {
  // ── Reactive state ─────────────────────────────────────────────
  mode = $state<VoiceMode>("idle");
  status = $state<VoiceStatus>("inactive");
  session = $state<VoiceSession | null>(null);

  // ── Dictation style (persisted choice) ─────────────────────────
  /** Current dictation writing style. */
  dictationStyle = $state<DictationStyle>("standard");

  // ── Push-to-talk grace period tracking ─────────────────────────
  /** Timestamp (performance.now()) when PTT was pressed, null if not pressed. */
  pttPressStart = $state<number | null>(null);
  /** Whether the current PTT press has exceeded the grace period threshold. */
  pttHeldLongEnough = $derived(
    this.pttPressStart !== null ? (performance.now() - this.pttPressStart) >= PTT_GRACE_MS : false
  );

  // ── Derived ────────────────────────────────────────────────────
  isActive = $derived(this.status !== "inactive");
  isRecording = $derived(this.status === "recording" || this.status === "listening");
  elapsedFormatted = $derived(formatClock(this.session?.elapsedMs ?? 0));

  // ── Internal ───────────────────────────────────────────────────
  #unlisteners: UnlistenFn[] = [];
  #elapsedInterval: ReturnType<typeof setInterval> | null = null;
  #recognition: any | null = null;
  #recognitionDisposed = false;

  // ── Fine-grained reactive fields (avoid full-session spread on hot paths) ──
  /** Audio level 0.0–1.0 — updated 30+ fps via event. Avoids spreading session. */
  audioLevel = $state(0);
  /** Interim transcript — updated via Web Speech results. */
  interimText = $state("");
  /** Final transcript from completed recording. */
  finalText = $state("");
  /** Elapsed ms — updated every 200ms via timer. */
  elapsedMs = $state(0);

  /** Set the dictation writing style. */
  setDictationStyle(style: DictationStyle): void {
    this.dictationStyle = style;
  }

  /**
   * Record PTT press start time for grace period detection.
   * Call this when the user presses the mic button.
   */
  recordPttPress(): void {
    this.pttPressStart = performance.now();
  }

  /**
   * Check if a PTT release should be discarded (too short a press).
   * Returns true if the press was too short (graze) and should be ignored.
   */
  checkPttRelease(): boolean {
    if (this.pttPressStart === null) return false;
    const held = performance.now() - this.pttPressStart;
    this.pttPressStart = null;
    return held < PTT_GRACE_MS;
  }

  /**
   * Update the island's voice module state via the cross-window Rust bridge.
   */
  #setIslandState(state: VoiceIslandState | null): void {
    if (state) {
      islandStore.activateModule(state);
    }
    invoke("voice_set_island_state", { state }).catch((err) => {
      console.warn("[voice-engine] Failed to update island state:", err);
    });
  }

  // ── Constructor: register Tauri event listeners ────────────────
  constructor() {
    this.#registerListeners();
  }

  async #registerListeners() {
    const unsubLevel = await listen<{ level: number; rms: number; peak: number }>(
      "voice:audio-level",
      (event) => {
        this.audioLevel = event.payload.level;
      },
    );
    this.#unlisteners.push(unsubLevel);

    const unsubSleep = await listen<{ driftMs: number }>("voice:sleep-detected", (event) => {
      if (this.session) {
        console.warn(`[voice-engine] Sleep detected mid-recording: drift=${event.payload.driftMs}ms`);
      }
    });
    this.#unlisteners.push(unsubSleep);

    const unsubError = await listen<{ code: string; message: string }>("voice:error", (event) => {
      if (this.session) {
        this.session = { ...this.session, status: "error", error: event.payload.message };
        this.status = "error";
      }
    });
    this.#unlisteners.push(unsubError);

    const unsubCompleted = await listen<{ sessionId: string; status: string }>(
      "voice:session-completed",
      () => {
        if (this.session) {
          this.session = { ...this.session, status: "completed" };
          this.status = "completed";
          this.#stopElapsedTimer();
        }
      },
    );
    this.#unlisteners.push(unsubCompleted);

    const unsubLiveTranscript = await listen<LiveTranscriptEvent>(
      "voice:live-transcript",
      (event) => {
        if (this.isRecording && this.session) {
          this.interimText = event.payload.text;
          this.session = { ...this.session, interimText: event.payload.text };
        }
      },
    );
    this.#unlisteners.push(unsubLiveTranscript);
  }

  // ── Elapsed timer ──────────────────────────────────────────────
  #startElapsedTimer() {
    this.#stopElapsedTimer();
    const start = performance.now();
    this.#elapsedInterval = setInterval(() => {
      this.elapsedMs = performance.now() - start;
    }, 200);
  }

  #stopElapsedTimer() {
    if (this.#elapsedInterval) {
      clearInterval(this.#elapsedInterval);
      this.#elapsedInterval = null;
    }
  }

  // ── Web Speech API helpers ─────────────────────────────────────
  get #hasSpeech(): boolean {
    return (
      typeof window !== "undefined" &&
      (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition)
    );
  }

  #createSpeechRecognition(): any | null {
    if (!this.#hasSpeech) return null;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    return recognition;
  }

  // ── Dictation Post-Processing ──────────────────────────────────

  /**
   * Post-process raw dictation text through the Rust pipeline:
   * 1. Strip filler words
   * 2. Apply writing style formatting
   * 3. Detect agent triggers
   */
  async #postProcessDictation(rawText: string): Promise<DictationProcessResult> {
    try {
      const result = await invoke<DictationProcessResult>("dictation_process", {
        text: rawText,
        style: this.dictationStyle,
      });
      return result;
    } catch (err) {
      console.warn("[voice-engine] Dictation post-process failed, falling back:", err);
      // Fallback: do basic client-side cleanup
      return {
        text: rawText.trim(),
        agentTrigger: { detected: false, agentPrompt: null, triggerPhrase: null },
        charCount: rawText.trim().length,
      };
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Start a voice session in the given mode.
   * - dictation / agent_conversation → Web Speech API (streaming)
   * - voice_note / meeting → Rust cpal recording (accuracy)
   */
  async start(mode: VoiceMode): Promise<void> {
    if (this.isActive) {
      console.warn(`[voice-engine] Already active (${this.mode}), ignoring start(${mode})`);
      return;
    }

    this.audioLevel = 0;
    this.interimText = "";
    this.finalText = "";
    this.elapsedMs = 0;

    this.mode = mode;
    this.status = "initializing";

    const session: VoiceSession = {
      id: generateId(),
      mode,
      status: "initializing",
      startTime: performance.now(),
      elapsedMs: 0,
      audioLevel: 0,
      interimText: "",
      finalText: "",
      recordingId: null,
      filePath: null,
      summary: null,
      actions: [],
      error: null,
    };

    this.session = session;
    this.#startElapsedTimer();

    this.#setIslandState({
      id: "voice",
      label: mode === "meeting" ? "Meeting" : "Voice",
      icon: "mic",
      status: mode === "dictation" || mode === "agent_conversation" ? "Listening" : "Recording",
      activityType: "recording",
    });

    if (mode === "dictation" || mode === "agent_conversation") {
      await this.#startWebSpeech(mode);
    } else {
      await this.#startRustRecording(mode);
    }
  }

  async #requestMicPermission(): Promise<boolean> {
    if (typeof navigator === "undefined") return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;

    if (navigator.userAgent.includes("Windows")) {
      try {
        await invoke("clear_webview_browsing_data");
      } catch {
        // best-effort
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  async #startWebSpeech(mode: VoiceMode) {
    const granted = await this.#requestMicPermission();
    if (!granted) {
      this.status = "error";
      if (this.session) {
        this.session = {
          ...this.session,
          status: "error",
          error: "Microphone not accessible. Try restarting the app.",
        };
      }
      return;
    }

    const recognition = this.#createSpeechRecognition();
    if (!recognition) {
      this.status = "error";
      if (this.session) {
        this.session = {
          ...this.session,
          status: "error",
          error: "Speech recognition not available in this browser",
        };
      }
      return;
    }

    this.#recognitionDisposed = false;
    this.#recognition = recognition;

    recognition.onresult = (event: any) => {
      if (this.#recognitionDisposed) return;
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      this.interimText = interimText || finalText;
      this.finalText = finalText || this.finalText;
      if (this.session) {
        this.session = {
          ...this.session,
          interimText: this.interimText,
          finalText: this.finalText,
          status: "listening",
        };
        this.status = "listening";
      }
    };

    recognition.onerror = (event: any) => {
      if (this.#recognitionDisposed) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.status = "error";
        if (this.session) {
          this.session = {
            ...this.session,
            status: "error",
            error: "Microphone not accessible. Try the voice button again.",
          };
        }
      }
    };

    recognition.onend = () => {
      if (this.#recognitionDisposed) return;
      if (this.status === "listening" && this.interimText) {
        this.stop();
      }
    };

    try {
      recognition.start();
      this.status = "listening";
      if (this.session) {
        this.session = { ...this.session, status: "listening" };
      }
    } catch (err) {
      this.status = "error";
      if (this.session) {
        this.session = {
          ...this.session,
          status: "error",
          error: "Failed to start speech recognition",
        };
      }
    }
  }

  async #startRustRecording(mode: VoiceMode) {
    try {
      const result = await invoke<{
        id: string;
        status: string;
        startTime: number;
        elapsedMs: number;
        filePath: string | null;
        moduleId: string;
      }>("voice_start", { mode });

      if (this.session) {
        this.session = {
          ...this.session,
          status: "recording",
          recordingId: result.id,
          filePath: result.filePath,
        };
        this.status = "recording";
      }
    } catch (err) {
      this.status = "error";
      if (this.session) {
        this.session = {
          ...this.session,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to start recording",
        };
      }
    }
  }

  /**
   * Stop recording and process the result.
   * Applies dictation post-processing (filler stripping + style) for dictation/agent modes.
   */
  async stop(): Promise<void> {
    // ── PTT grace period: discard if held too short ──────────────
    // If the session was shorter than the grace period, treat as
    // an accidental tap ("graze") and discard without processing.
    const elapsed = this.elapsedMs;
    if (this.#hasShortRecording(elapsed)) {
      console.log("[voice-engine] PTT graze detected — discarding");
      this.#stopWebSpeech();
      this.#reset();
      return;
    }

    if (this.mode === "dictation" || this.mode === "agent_conversation") {
      this.#stopWebSpeech();
    } else {
      await this.#stopRustRecording();
    }

    this.status = "processing";
    if (this.session) {
      this.session = { ...this.session, status: "processing" };
    }

    this.#setIslandState({
      id: "voice",
      label: "Voice",
      icon: "refresh",
      status: "Processing",
      activityType: "active",
    });

    await this.#classifyAndRouteSession();
  }

  /** True when elapsed time is below the PTT grace threshold (accidental tap). */
  #hasShortRecording(elapsedMs: number): boolean {
    return elapsedMs > 0 && elapsedMs < PTT_GRACE_MS;
  }

  /**
   * Classify the completed session and route to the appropriate handler.
   * For dictation modes, runs post-processing (fillers + style + agent detection) first.
   */
  async #classifyAndRouteSession() {
    const rawTranscript = this.session?.finalText?.trim() || this.session?.interimText?.trim() || "";
    if (!rawTranscript) {
      this.complete("");
      return;
    }

    // Run dictation post-processing (filler stripping + style + agent detection)
    const processed = await this.#postProcessDictation(rawTranscript);
    const transcript = processed.text;

    // Update final text with processed version
    this.finalText = transcript;
    if (this.session) {
      this.session = { ...this.session, finalText: transcript };
    }

    // Check if agent trigger was detected in post-processing
    if (processed.agentTrigger.detected) {
      this.mode = "agent_conversation";
      const prompt = processed.agentTrigger.agentPrompt || transcript;
      this.complete(transcript);
      // The Dock will pick up the mode change and submit to AI
      return;
    }

    const durationSecs = (this.session?.elapsedMs ?? 0) / 1000;
    const trimmed = transcript.toLowerCase();
    let classifiedMode: VoiceMode;

    if (
      trimmed.endsWith("?") ||
      trimmed.startsWith("hey bento") ||
      trimmed.startsWith("ask bento") ||
      trimmed.startsWith("bento ")
    ) {
      classifiedMode = "agent_conversation";
    } else if (durationSecs > 180) {
      classifiedMode = "meeting";
    } else if (durationSecs > 30) {
      classifiedMode = "voice_note";
    } else {
      classifiedMode = "dictation";
    }

    this.mode = classifiedMode;

    if (classifiedMode === "dictation") {
      await this.#handleDictation(transcript);
    } else if (classifiedMode === "voice_note") {
      await this.#handleVoiceNote(transcript);
    } else {
      this.complete(transcript);
    }
  }

  async #handleDictation(transcript: string) {
    try {
      const result = await invoke<{ success: boolean; text: string; charCount: number }>(
        "voice_paste_dictation",
        { text: transcript },
      );
      console.log(`[voice-engine] Pasted ${result.charCount} chars at cursor`);
      this.complete(transcript);
    } catch (err) {
      console.warn("[voice-engine] Dictation paste failed:", err);
      this.complete(transcript);
    }
  }

  async #handleVoiceNote(transcript: string) {
    try {
      const result = await invoke<{ success: boolean; noteId: string; title: string; charCount: number }>(
        "voice_save_note",
        { transcript, title: null },
      );
      if (this.session) {
        this.session = { ...this.session, summary: `Saved as note: ${result.title}` };
      }
      this.complete(transcript, `Saved as note: ${result.title}`);
    } catch (err) {
      console.warn("[voice-engine] Voice note save failed:", err);
      this.complete(transcript);
    }
  }

  #stopWebSpeech() {
    this.#recognitionDisposed = true;
    if (this.#recognition) {
      try { this.#recognition.stop(); } catch { /* already stopped */ }
      this.#recognition = null;
    }
  }

  #checkSpeechRecovery(): boolean {
    const recognition = this.#createSpeechRecognition();
    return recognition !== null;
  }

  async #stopRustRecording() {
    try {
      const result = await invoke<{ id: string; status: string; elapsedMs: number; filePath: string | null }>(
        "voice_stop",
      );
      if (this.session) {
        this.session = { ...this.session, recordingId: result.id, filePath: result.filePath, elapsedMs: result.elapsedMs };
      }
    } catch (err) {
      console.warn("[voice-engine] Rust recording stop failed:", err);
    }
  }

  async pause(): Promise<void> {
    if (this.mode === "voice_note" || this.mode === "meeting") {
      try {
        await invoke("voice_pause");
        this.status = "paused";
        if (this.session) { this.session = { ...this.session, status: "paused" }; }
        this.#setIslandState({ id: "voice", label: "Voice", icon: "mic", status: "Paused", activityType: "active" });
      } catch (err) {
        console.warn("[voice-engine] Pause failed:", err);
      }
    }
  }

  async resume(): Promise<void> {
    if (this.mode === "voice_note" || this.mode === "meeting") {
      try {
        await invoke("voice_resume");
        this.status = "recording";
        if (this.session) { this.session = { ...this.session, status: "recording" }; }
        this.#setIslandState({ id: "voice", label: "Voice", icon: "mic", status: "Recording", activityType: "recording" });
      } catch (err) {
        console.warn("[voice-engine] Resume failed:", err);
      }
    }
  }

  async cancel(): Promise<void> {
    if (this.mode === "dictation" || this.mode === "agent_conversation") {
      this.#stopWebSpeech();
    } else {
      try { await invoke("voice_cancel"); } catch { /* best-effort */ }
    }
    this.#reset();
  }

  setAudioLevel(level: number): void {
    this.audioLevel = level;
  }

  updateInterimText(text: string): void {
    this.interimText = text;
  }

  complete(finalText: string, summary?: string | null): void {
    this.status = "completed";
    this.#stopElapsedTimer();
    if (this.session) {
      this.session = { ...this.session, status: "completed", finalText, summary: summary ?? null };
    }
    this.#setIslandState({ id: "voice", label: "Voice", icon: "check", status: "Done", activityType: "active" });
    if (this.#autoResetTimeout) clearTimeout(this.#autoResetTimeout);
    this.#autoResetTimeout = setTimeout(() => {
      this.#autoResetTimeout = null;
      this.#reset();
      islandStore.collapse();
      this.#setIslandState(null);
    }, 3000);
  }

  setError(error: string): void {
    this.status = "error";
    if (this.session) { this.session = { ...this.session, status: "error", error }; }
  }

  #autoResetTimeout: ReturnType<typeof setTimeout> | null = null;

  #reset(): void {
    this.#stopElapsedTimer();
    if (this.#autoResetTimeout) {
      clearTimeout(this.#autoResetTimeout);
      this.#autoResetTimeout = null;
    }
    this.#recognitionDisposed = false;
    this.#recognition = null;
    this.mode = "idle";
    this.status = "inactive";
    this.session = null;
    this.audioLevel = 0;
    this.interimText = "";
    this.finalText = "";
    this.elapsedMs = 0;
    this.pttPressStart = null;
  }

  destroy(): void {
    this.#stopElapsedTimer();
    this.#stopWebSpeech();
    this.#unlisteners.forEach((u) => u());
    this.#unlisteners = [];
  }
}

// ─── Singleton Export ────────────────────────────────────────────────

export const voiceEngine = new VoiceEngineStore();
