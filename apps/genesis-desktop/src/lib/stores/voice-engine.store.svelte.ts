// ═══════════════════════════════════════════════════════════════════════
// Voice Engine Store — Single source of truth for all voice operations
// ═══════════════════════════════════════════════════════════════════════
// Both Agent Dock and Dynamic Island read from this store reactively.
// No direct IPC calls from UI components — only through the store.
// ═══════════════════════════════════════════════════════════════════════

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { islandStore } from "$lib/stores/island.store.svelte";

// ─── Island State Type (mirrors ActiveModuleState) ────────────────

interface VoiceIslandState {
  id: string;
  label: string;
  icon: string;
  status: string;
  activityType?: "recording" | "timer" | "active" | "playback";
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

  /**
   * Update the island's voice module state via the cross-window Rust bridge.
   * This updates both the local islandStore (for main window) AND sends the
   * state to the island window via Rust events.
   */
  #setIslandState(state: VoiceIslandState | null): void {
    // Update local islandStore for main window context
    if (state) {
      islandStore.activateModule(state);
    }

    // Send to island window via Rust cross-window bridge
    invoke("voice_set_island_state", { state }).catch((err) => {
      console.warn("[voice-engine] Failed to update island state:", err);
    });
  }

  // ── Constructor: register Tauri event listeners ────────────────
  constructor() {
    this.#registerListeners();
  }

  async #registerListeners() {
    // Listen for audio level events from Rust capture thread
    // Updates fine-grained `audioLevel` field directly — avoids full session spread
    const unsubLevel = await listen<{ level: number; rms: number; peak: number }>(
      "voice:audio-level",
      (event) => {
        this.audioLevel = event.payload.level;
      },
    );
    this.#unlisteners.push(unsubLevel);

    // Listen for sleep detection
    const unsubSleep = await listen<{ driftMs: number }>("voice:sleep-detected", (event) => {
      if (this.session) {
        console.warn(
          `[voice-engine] Sleep detected mid-recording: drift=${event.payload.driftMs}ms`,
        );
      }
    });
    this.#unlisteners.push(unsubSleep);

    // Listen for errors from Rust
    const unsubError = await listen<{ code: string; message: string }>("voice:error", (event) => {
      if (this.session) {
        this.session = {
          ...this.session,
          status: "error",
          error: event.payload.message,
        };
        this.status = "error";
      }
    });
    this.#unlisteners.push(unsubError);

    // Listen for recording session completion
    const unsubCompleted = await listen<{ sessionId: string; status: string }>(
      "voice:session-completed",
      () => {
        if (this.session) {
          this.session = {
            ...this.session,
            status: "completed",
          };
          this.status = "completed";
          this.#stopElapsedTimer();
        }
      },
    );
    this.#unlisteners.push(unsubCompleted);
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

    // Reset fine-grained fields
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

    // Activate the Island voice module
    this.#setIslandState({
      id: "voice",
      label: mode === "meeting" ? "Meeting" : "Voice",
      icon: "mic",
      status: mode === "dictation" || mode === "agent_conversation" ? "Listening" : "Recording",
      activityType: "recording",
    });

    if (mode === "dictation" || mode === "agent_conversation") {
      // Use Web Speech API for real-time streaming
      await this.#startWebSpeech(mode);
    } else {
      // Use Rust cpal for long-form recording
      await this.#startRustRecording(mode);
    }
  }

  async #requestMicPermission(): Promise<boolean> {
    if (typeof navigator === "undefined") {
      console.warn("[voice-engine] navigator undefined");
      return true;
    }
    if (!navigator.mediaDevices) {
      console.warn("[voice-engine] navigator.mediaDevices is undefined");
      return true;
    }
    if (!navigator.mediaDevices.getUserMedia) {
      console.warn("[voice-engine] getUserMedia is undefined");
      return true;
    }

    // ── Step 1: Clear WebView2 browsing data to reset cached permission state ──
    // WebView2 (Windows) caches "denied" permission decisions. If the user previously
    // denied the mic prompt, subsequent getUserMedia calls fail with NotAllowedError.
    // Clearing browsing data resets this cache so the next call shows the prompt again.
    // On macOS, WKWebView does not cache permissions the same way, so skip this.
    if (navigator.userAgent.includes("Windows")) {
      try {
        await invoke("clear_webview_browsing_data");
        console.info("[voice-engine] Cleared WebView2 browsing data (permission cache reset)");
      } catch (err) {
        // Best-effort — if this fails, proceed anyway
        console.warn("[voice-engine] Failed to clear browsing data:", err);
      }
    }

    // ── Step 2: Request mic access ──
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      console.info("[voice-engine] Mic permission granted via getUserMedia");
      return true;
    } catch (err) {
      console.error("[voice-engine] getUserMedia failed:", err);
      if (err instanceof DOMException) {
        console.error("[voice-engine] DOMException name:", err.name, "message:", err.message);
      }
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
          error: "Microphone not accessible. Try restarting the app to reset the permission cache.",
        };
        console.info(
          "[voice-engine] WebView2 caches denied mic permissions. If restarting doesn't help, delete the EBWebView folder in %LOCALAPPDATA%\\Bento to fully reset browser permissions.",
        );
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
            error:
              "Microphone not accessible. Try the voice button again — we already reset the browser permission cache.",
          };
        }
        console.info(
          "[voice-engine] WebView2 caches denied mic permissions. If restarting doesn't help, delete the EBWebView folder in %LOCALAPPDATA%\\Bento to fully reset browser permissions.",
        );
      }
    };

    recognition.onend = () => {
      // onend fires when recognition naturally stops (silence timeout) or is manually stopped.
      // If we manually stopped (disposed), skip auto-stop to avoid double-call.
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
      console.warn("[voice-engine] Web Speech start failed:", err);
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
      console.warn("[voice-engine] Rust recording start failed:", err);
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
   * After stopping, classifies the input and routes to the correct handler:
   * - dictation → auto-paste at cursor
   * - voice_note → save as note with AI title
   * - agent_query → submit to agent conversation
   */
  async stop(): Promise<void> {
    if (this.mode === "dictation" || this.mode === "agent_conversation") {
      this.#stopWebSpeech();
    } else {
      await this.#stopRustRecording();
    }

    this.status = "processing";
    if (this.session) {
      this.session = { ...this.session, status: "processing" };
    }

    // Update Island to processing state
    this.#setIslandState({
      id: "voice",
      label: "Voice",
      icon: "refresh",
      status: "Processing",
      activityType: "active",
    });

    // Classify intent and route
    await this.#classifyAndRouteSession();
  }

  /**
   * Classify the completed session and route to the appropriate handler.
   * Uses heuristic duration-based classification, then:
   * - Dictation: auto-paste at cursor
   * - Voice Note: save as note
   * - Agent Query: submit to AI (handled externally)
   */
  async #classifyAndRouteSession() {
    const transcript = this.session?.finalText?.trim() || this.session?.interimText?.trim() || "";
    if (!transcript) {
      this.complete("");
      return;
    }

    const durationSecs = (this.session?.elapsedMs ?? 0) / 1000;

    // Heuristic classification (mirrors Rust classifier)
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

    // Update mode with classification
    this.mode = classifiedMode;

    if (classifiedMode === "dictation") {
      await this.#handleDictation(transcript);
    } else if (classifiedMode === "voice_note") {
      await this.#handleVoiceNote(transcript);
    } else if (classifiedMode === "agent_conversation") {
      // Agent conversation is handled externally by the Dock — just complete
      this.complete(transcript);
    } else {
      // Meeting — just complete for now (Phase 3 will add full processing)
      this.complete(transcript);
    }
  }

  /**
   * Handle dictation mode: paste transcript at cursor position.
   */
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
      // Fall back to just showing the transcript
      this.complete(transcript);
    }
  }

  /**
   * Handle voice note mode: save transcript as a note with AI title.
   */
  async #handleVoiceNote(transcript: string) {
    try {
      const result = await invoke<{
        success: boolean;
        noteId: string;
        title: string;
        charCount: number;
      }>("voice_save_note", {
        transcript,
        title: null,
      });
      console.log(`[voice-engine] Saved voice note "${result.title}" (${result.noteId})`);

      if (this.session) {
        this.session = {
          ...this.session,
          summary: `Saved as note: ${result.title}`,
        };
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
      try {
        this.#recognition.stop();
      } catch {
        // Already stopped
      }
      this.#recognition = null;
    }
  }

  /**
   * Check if the speech recognition system is still usable after an error.
   * Creates a temporary instance to probe availability without starting.
   */
  #checkSpeechRecovery(): boolean {
    const recognition = this.#createSpeechRecognition();
    if (!recognition) return false;
    try {
      // Don't actually start — just verify the constructor worked
      return true;
    } finally {
      // No cleanup needed since we didn't start
    }
  }

  async #stopRustRecording() {
    try {
      const result = await invoke<{
        id: string;
        status: string;
        elapsedMs: number;
        filePath: string | null;
      }>("voice_stop");
      if (this.session) {
        this.session = {
          ...this.session,
          recordingId: result.id,
          filePath: result.filePath,
          elapsedMs: result.elapsedMs,
        };
      }
    } catch (err) {
      console.warn("[voice-engine] Rust recording stop failed:", err);
    }
  }

  /**
   * Pause the current recording.
   */
  async pause(): Promise<void> {
    if (this.mode === "voice_note" || this.mode === "meeting") {
      try {
        await invoke("voice_pause");
        this.status = "paused";
        if (this.session) {
          this.session = { ...this.session, status: "paused" };
        }
        this.#setIslandState({
          id: "voice",
          label: "Voice",
          icon: "mic",
          status: "Paused",
          activityType: "active",
        });
      } catch (err) {
        console.warn("[voice-engine] Pause failed:", err);
      }
    }
  }

  /**
   * Resume a paused recording.
   */
  async resume(): Promise<void> {
    if (this.mode === "voice_note" || this.mode === "meeting") {
      try {
        await invoke("voice_resume");
        this.status = "recording";
        if (this.session) {
          this.session = { ...this.session, status: "recording" };
        }
        this.#setIslandState({
          id: "voice",
          label: "Voice",
          icon: "mic",
          status: "Recording",
          activityType: "recording",
        });
      } catch (err) {
        console.warn("[voice-engine] Resume failed:", err);
      }
    }
  }

  /**
   * Cancel the current recording — discards without saving.
   */
  async cancel(): Promise<void> {
    if (this.mode === "dictation" || this.mode === "agent_conversation") {
      this.#stopWebSpeech();
    } else {
      try {
        await invoke("voice_cancel");
      } catch (err) {
        console.warn("[voice-engine] Cancel failed:", err);
      }
    }

    this.#reset();
  }

  /**
   * Set audio level from external source (e.g., Web Speech simulated levels).
   * Updates fine-grained field directly — avoids full session spread.
   */
  setAudioLevel(level: number): void {
    this.audioLevel = level;
  }

  /**
   * Update interim transcript text.
   * Updates fine-grained field directly — avoids full session spread.
   */
  updateInterimText(text: string): void {
    this.interimText = text;
  }

  /**
   * Mark the session as completed with the final result.
   */
  complete(finalText: string, summary?: string | null): void {
    this.status = "completed";
    this.#stopElapsedTimer();

    if (this.session) {
      this.session = {
        ...this.session,
        status: "completed",
        finalText,
        summary: summary ?? null,
      };
    }

    // Show "Done" in Island briefly
    this.#setIslandState({
      id: "voice",
      label: "Voice",
      icon: "check",
      status: "Done",
      activityType: "active",
    });

    // Auto-reset after 3 seconds (tagged timeout — cancellable via #reset)
    if (this.#autoResetTimeout) clearTimeout(this.#autoResetTimeout);
    this.#autoResetTimeout = setTimeout(() => {
      this.#autoResetTimeout = null;
      this.#reset();
      islandStore.collapse();
      this.#setIslandState(null);
    }, 3000);
  }

  /**
   * Set error state.
   */
  setError(error: string): void {
    this.status = "error";
    if (this.session) {
      this.session = { ...this.session, status: "error", error };
    }
  }

  /**
   * Cancel the auto-reset timeout (tagged for cleanup).
   */
  #autoResetTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Reset to idle state.
   */
  #reset(): void {
    this.#stopElapsedTimer();
    if (this.#autoResetTimeout) {
      clearTimeout(this.#autoResetTimeout);
      this.#autoResetTimeout = null;
    }
    // Reset disposed flag so future starts work
    this.#recognitionDisposed = false;
    this.#recognition = null;
    this.mode = "idle";
    this.status = "inactive";
    this.session = null;
    this.audioLevel = 0;
    this.interimText = "";
    this.finalText = "";
    this.elapsedMs = 0;
  }

  /**
   * Clean up event listeners (call on component destroy).
   */
  destroy(): void {
    this.#stopElapsedTimer();
    this.#stopWebSpeech();
    this.#unlisteners.forEach((u) => u());
    this.#unlisteners = [];
  }
}

// ─── Singleton Export ────────────────────────────────────────────────

export const voiceEngine = new VoiceEngineStore();
