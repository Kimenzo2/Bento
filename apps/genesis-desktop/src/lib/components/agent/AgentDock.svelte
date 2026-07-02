<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { fly } from "svelte/transition";
  import ChatIcon from "@lucide/svelte/icons/message-square";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import SendIcon from "@lucide/svelte/icons/send";
  import XIcon from "@lucide/svelte/icons/x";
  import DockButton from "./DockButton.svelte";

  type AgentDockMode = "idle" | "composing" | "listening" | "working";

  type AgentContext = {
    screenCapture?: string;
    transcript?: string;
  };

  type AgentDockProps = {
    agentName?: string;
    avatarSrc?: string;
    class?: string;
    idleStatus?: string;
    listeningStatus?: string;
    workingStatus?: string;
    onMessageSubmit?: (message: string, context?: AgentContext) => void | Promise<void>;
    onVoiceStart?: () => void | Promise<void>;
    onVoiceStop?: () => void | Promise<void>;
    onComposerStateChange?: (open: boolean) => void;
    /** When true, this dock is inside the agent window (dedicated route). */
    isAgentWindow?: boolean;
    /** Callback when Escape is pressed while dock is idle — lets the page close the window. */
    onEscapeWhenIdle?: () => void;
  };

  let {
    agentName = "Bento",
    avatarSrc = "/assets/characters/demo-agent-avatar.jpeg",
    class: className = "",
    idleStatus = "Ready",
    listeningStatus = "Listening...",
    workingStatus = "Working...",
    onMessageSubmit,
    onVoiceStart,
    onVoiceStop,
    onComposerStateChange,
    isAgentWindow = false,
    onEscapeWhenIdle,
  }: AgentDockProps = $props();

  let mode = $state<AgentDockMode>("idle");
  let message = $state("");
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let shouldReduceMotion = $state(false);
  let mounted = $state(false);
  let transcript = $state("");
  let screenCapture = $state<string | null>(null);

  let recognitionRef = $state<any>(null);
  let isListening = $state(false);
  const hasSpeech = $derived(
    typeof window !== "undefined" &&
    (!!((window as any).SpeechRecognition) || !!((window as any).webkitSpeechRecognition))
  );

  // ── S11: Timeout utility for all async operations ─────────────────────────
  const ASYNC_TIMEOUT_MS = 30_000;

  function withTimeout<T>(promise: Promise<T>, ms: number = ASYNC_TIMEOUT_MS): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`[agent-dock] timed out after ${ms}ms`)), ms)
      ),
    ]);
  }

  const statusFly = $derived(
    mounted && !shouldReduceMotion
      ? { y: 6, duration: 160 }
      : { y: 0, duration: 0 }
  );

  const statusText = $derived(
    mode === "listening"
      ? transcript || listeningStatus
      : mode === "working"
        ? workingStatus
        : idleStatus
  );

  const isExpanded = $derived(mode !== "idle");

  $effect(() => {
    onComposerStateChange?.(isExpanded);
  });

  function openComposer() {
    mode = "composing";
    requestAnimationFrame(() => textareaRef?.focus());
  }

  // ── S3/S11: submitMessage with timeout and guaranteed recovery ─────────────
  async function submitMessage() {
    const nextMessage = message.trim();
    if (!nextMessage && !transcript.trim()) {
      openComposer();
      return;
    }

    const finalMessage = nextMessage || transcript.trim();
    if (!finalMessage) return;

    const context: AgentContext = {};
    if (transcript.trim()) context.transcript = transcript.trim();
    if (screenCapture) context.screenCapture = screenCapture;

    message = "";
    transcript = "";
    screenCapture = null;
    mode = "working";
    try {
      if (onMessageSubmit) {
        await withTimeout(Promise.resolve(onMessageSubmit(finalMessage, context)));
      }
      mode = "idle";
    } catch (err) {
      console.warn("[agent-dock] submitMessage failed:", err);
      mode = "idle";
      toast.error("Failed to send message. Please try again.", {
        description: err instanceof Error ? err.message : "Unknown error",
        duration: 5000,
      });
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (mode === "composing") {
      submitMessage();
      return;
    }
    openComposer();
  }

  // ── S5: Guard against double-start of speech recognition ──────────────────
  function toggleListening() {
    if (mode === "listening") {
      stopListening();
    } else if ((mode === "idle" || mode === "composing") && !isListening) {
      startListening();
    }
  }

  function startListening() {
    if (!hasSpeech) {
      console.warn("[agent-dock] SpeechRecognition not available");
      return;
    }

    // S5: Prevent double-start
    if (isListening || recognitionRef) {
      console.warn("[agent-dock] already listening, ignoring start");
      return;
    }

    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    let disposed = false;

    recognition.onresult = (event: any) => {
      if (disposed) return;
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
      transcript = finalText || interimText;
    };

    recognition.onerror = (event: any) => {
      if (disposed) return;
      console.warn("[agent-dock] speech error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        mode = "idle";
        isListening = false;
        recognitionRef = null;
      }
    };

    // S8: Error boundary around submitMessage in onend
    recognition.onend = () => {
      if (disposed) return;
      isListening = false;
      recognitionRef = null;
      if (transcript.trim().length >= 3) {
        submitMessage().catch((err) => {
          console.warn("[agent-dock] submitMessage from onend failed:", err);
          mode = "idle";
        });
      } else if (mode === "listening") {
        transcript = "";
        mode = "idle";
      }
    };

    recognitionRef = recognition;
    isListening = true;
    mode = "listening";
    transcript = "";
    try {
      recognition.start();
      onVoiceStart?.();
    } catch (err) {
      console.warn("[agent-dock] recognition.start() failed:", err);
      isListening = false;
      recognitionRef = null;
      mode = "idle";
    }
  }

  function stopListening() {
    if (!recognitionRef) {
      isListening = false;
      return;
    }
    try {
      recognitionRef.stop();
    } catch {
      // Ignore — may already be stopped
    }
    recognitionRef = null;
    isListening = false;
    onVoiceStop?.();
    if (transcript.trim().length >= 3) {
      submitMessage().catch((err) => {
        console.warn("[agent-dock] submitMessage from stopListening failed:", err);
        mode = "idle";
      });
    } else {
      transcript = "";
      mode = "idle";
    }
  }

  // ── S7: Screen capture with guaranteed stream cleanup ─────────────────────
  async function captureScreen() {
    let stream: MediaStream | null = null;
    let track: MediaStreamTrack | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as any,
      });
      const tracks = stream.getVideoTracks();
      if (tracks.length === 0) {
        console.warn("[agent-dock] screen capture: no video tracks");
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      track = tracks[0];

      if ((window as any).ImageCapture) {
        try {
          const ic = new (window as any).ImageCapture(track);
          const bitmap = await ic.grabFrame();
          track.stop();
          track = null;
          stream.getTracks().forEach(t => t.stop());
          stream = null;
          screenCapture = bitmapToDataUrl(bitmap);
          return;
        } catch { /* fall through to video fallback */ }
      }

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      screenCapture = canvas.toDataURL("image/jpeg", 0.7);
    } catch (err) {
      console.debug("[agent-dock] screen capture failed/cancelled:", err);
    } finally {
      if (track) track.stop();
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
  }

  function bitmapToDataUrl(bitmap: ImageBitmap): string {
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    c.getContext("2d")!.drawImage(bitmap, 0, 0);
    return c.toDataURL("image/jpeg", 0.7);
  }

  // ── S10: Guard against firing on inert textarea ───────────────────────────
  function handleTextareaKeydown(e: KeyboardEvent) {
    if (mode !== "composing") return;
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submitMessage();
  }

  // ── S6: Consolidated Escape handler ───────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (mode === "composing") {
        mode = "idle";
        e.stopPropagation();
      } else if (mode === "listening") {
        stopListening();
        e.stopPropagation();
      } else if (mode === "idle" && isAgentWindow) {
        onEscapeWhenIdle?.();
        e.stopPropagation();
      }
    }
  }

  onMount(() => {
    mounted = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    shouldReduceMotion = mq.matches;
    const updateMotion = (e: MediaQueryListEvent) => { shouldReduceMotion = e.matches; };
    mq.addEventListener("change", updateMotion);
    window.addEventListener("keydown", handleKeydown);

    return () => {
      mq.removeEventListener("change", updateMotion);
      window.removeEventListener("keydown", handleKeydown);
      if (recognitionRef) {
        try { recognitionRef.abort(); } catch { /* ignore */ }
        recognitionRef = null;
      }
      isListening = false;
    };
  });

</script>

<form class={className} onsubmit={handleSubmit} novalidate>
  <div class="dock-root" class:dock-root--expanded={isExpanded}>
    <div class="dock-bar">
      <img
        class="dock-avatar"
        src={avatarSrc}
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
      />

      <div class="dock-info">
        <p class="dock-name">{agentName}</p>
        {#key mode}
          <p
            class="dock-status"
            class:dock-status--listening={mode === "listening"}
            class:dock-status--working={mode === "working"}
            in:fly={statusFly}
            out:fly={{ y: -6, duration: 160 }}
          >
            {statusText}
          </p>
        {/key}
      </div>

      <div class="dock-actions">
        <DockButton
          icon={MonitorIcon}
          label="Capture screen"
          onclick={captureScreen}
          class={screenCapture ? "dock-btn--active" : ""}
        />
        <DockButton
          icon={mode === "listening" ? MicOffIcon : MicIcon}
          label={!hasSpeech ? "Voice unavailable" : mode === "listening" ? "Stop listening" : "Voice"}
          class={mode === "listening" ? "dock-btn--listening" : ""}
          onclick={hasSpeech ? toggleListening : undefined}
        />
        <DockButton
          icon={mode === "composing" ? SendIcon : ChatIcon}
          label={mode === "composing" ? "Send" : "Chat"}
          type="submit"
        />
      </div>
    </div>

    {#if screenCapture}
      <div class="dock-capture">
        <img class="dock-capture-img" src={screenCapture} alt="Screen capture" />
        <button
          type="button"
          class="dock-capture-remove"
          aria-label="Remove screen capture"
          onclick={() => { screenCapture = null; }}
        >
          <XIcon size={12} />
        </button>
      </div>
    {/if}

    {#if mode === "listening" && transcript}
      <div class="dock-transcript">
        <p class="dock-transcript-text">{transcript}</p>
      </div>
    {/if}

    <div
      class="dock-composer"
      class:dock-composer--open={mode === "composing"}
      aria-hidden={mode !== "composing"}
      inert={mode !== "composing"}
      style={shouldReduceMotion ? "transition-duration:0ms" : ""}
    >
      <div class="dock-composer-inner">
        <button
          type="button"
          class="dock-composer-close"
          aria-label="Close composer"
          onclick={() => { mode = "idle"; }}
        >
          <XIcon size={14} />
        </button>
        <textarea
          class="dock-textarea"
          bind:value={message}
          onkeydown={handleTextareaKeydown}
          placeholder="Type something here..."
          aria-label="Message agent"
          bind:this={textareaRef}
          maxlength={2000}
        ></textarea>
      </div>
    </div>
  </div>
</form>

<style>
  .dock-root {
    display: flex;
    width: 100%;
    max-width: 380px;
    flex-direction: column-reverse;
    overflow: hidden;
    border-radius: 16px;
    background: #0a0a0a;
    padding: 8px;
    color: #fff;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  }

  .dock-root--expanded {
    max-width: 420px;
  }

  .dock-bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dock-avatar {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    flex-shrink: 0;
    object-fit: cover;
  }

  .dock-info {
    min-width: 0;
    flex: 1;
  }

  .dock-name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dock-status {
    margin: 4px 0 0;
    font-size: 12px;
    color: #a3a3a3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .dock-status--listening {
    color: #ef4444;
  }

  .dock-status--working {
    color: #3b82f6;
  }

  .dock-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  :global(.dock-btn--listening) {
    color: #ef4444 !important;
    animation: dock-pulse 1.5s ease-in-out infinite;
  }

  :global(.dock-btn--active) {
    color: #3b82f6 !important;
  }

  @keyframes dock-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.dock-btn--listening) { animation: none; }
  }

  .dock-capture {
    position: relative;
    margin: 6px 0 2px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .dock-capture-img {
    display: block;
    width: 100%;
    height: 80px;
    object-fit: cover;
  }

  .dock-capture-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #a3a3a3;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .dock-capture-remove:hover {
    background: rgba(239, 68, 68, 0.8);
    color: #fff;
  }

  .dock-capture-remove:focus-visible {
    outline: 2px solid rgba(239, 68, 68, 0.6);
    outline-offset: 2px;
  }

  .dock-transcript {
    margin: 6px 0 2px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }

  .dock-transcript-text {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.4;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dock-composer {
    overflow: hidden;
    height: 0;
    opacity: 0;
    will-change: height, opacity;
    transition:
      height 0.3s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .dock-composer--open {
    height: 120px;
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-composer { transition: none; }
  }

  .dock-composer-inner {
    position: relative;
    margin-bottom: 8px;
  }

  .dock-composer-close {
    position: absolute;
    right: 6px;
    top: 6px;
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #a3a3a3;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .dock-composer-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .dock-composer-close:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.4);
    outline-offset: 2px;
  }

  .dock-textarea {
    display: block;
    width: 100%;
    height: 112px;
    padding: 8px 36px 8px 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    font-family: inherit;
    line-height: 24px;
    resize: none;
    outline: none;
    box-sizing: border-box;
  }

  .dock-textarea::placeholder {
    color: #737373;
  }
</style>
