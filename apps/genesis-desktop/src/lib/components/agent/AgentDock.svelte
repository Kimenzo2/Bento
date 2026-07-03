<script lang="ts">
  import { onMount, tick } from "svelte";
  import { toast } from "svelte-sonner";
  import { fly } from "svelte/transition";
  import { invoke, isTauri } from "@tauri-apps/api/core";

  import ChatIcon from "@lucide/svelte/icons/message-square";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MicOffIcon from "@lucide/svelte/icons/mic-off";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import SendIcon from "@lucide/svelte/icons/send";
  import XIcon from "@lucide/svelte/icons/x";
  import DockButton from "./DockButton.svelte";
  import StreamingMarkdown from "$lib/components/StreamingMarkdown.svelte";
  import { streamAiResponse } from "$lib/desktop/ai";

  interface SpeechRecognitionHandle {
    start: () => void;
    stop: () => void;
    abort: () => void;
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
  }

  type AgentDockMode = "idle" | "composing" | "listening" | "working";

  type AgentContext = {
    screenCapture?: string;
    transcript?: string;
  };

  type ChatMessage = {
    role: "user" | "assistant";
    content: string;
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
  let screenCapture = $state.raw<string | null>(null);
  let messages = $state.raw<ChatMessage[]>([]);
  let streamingText = $state("");
  let streamingError = $state<string | null>(null);
  let messagesContainer = $state<HTMLDivElement | null>(null);

  let submitBusy = $state(false);
  let userNearBottom = $state(true);
  let lastSentMessage = $state("");

  let speech = $state({
    isListening: false,
    recognitionRef: null as SpeechRecognitionHandle | null,
    transcript: "",
  });

  function checkScrollPosition() {
    if (!messagesContainer) return;
    const threshold = 80;
    const dist = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
    userNearBottom = dist < threshold;
  }

  function scrollToBottom() {
    if (!messagesContainer?.isConnected) return;
    userNearBottom = true;
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: "smooth" });
  }
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
      ? speech.transcript || listeningStatus
      : mode === "working"
        ? workingStatus
        : idleStatus
  );

  const isExpanded = $derived(mode !== "idle");

  $effect(() => {
    onComposerStateChange?.(isExpanded);
  });

  // ── Smart auto-scroll: only scroll when user is near bottom ───────────────
  $effect.pre(() => {
    if (!messagesContainer) return;
    // Create reactive deps on these values
    messages.length;
    streamingText.length;

    if (userNearBottom) {
      tick().then(() => {
        if (!messagesContainer?.isConnected) return;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }
  });

  // ── Shared streaming logic — called by both submitMessage and retryLastMessage ──
  async function sendAndStream(text: string) {
    submitBusy = true;
    mode = "working";
    streamingError = null;
    streamingText = "";
    try {
      await withTimeout(
        streamAiResponse(text, (token) => {
          streamingText += token;
        })
      );

      if (streamingText.trim()) {
        messages = [...messages, { role: "assistant", content: streamingText }];
      }
      streamingText = "";
      mode = "idle";
    } catch (err) {
      console.warn("[agent-dock] sendAndStream failed:", err);
      streamingError = categorizeError(err);
      streamingText = "";
      mode = "idle";
      toast.error("AI response failed", {
        description: err instanceof Error ? err.message : "Unknown error",
        duration: 5000,
      });
    } finally {
      submitBusy = false;
    }
  }

  function categorizeError(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes("timed out") || msg.includes("timeout")) {
        return "Request timed out after 30s. The server may be overloaded.";
      }
      if (msg.includes("network") || msg.includes("fetch") || msg.includes("connection")) {
        return "Network error. Check your connection and try again.";
      }
      if (msg.includes("rate limit") || msg.includes("429")) {
        return "Rate limit reached. Please wait a moment before asking another question.";
      }
      if (msg.includes("auth") || msg.includes("api key") || msg.includes("401") || msg.includes("403")) {
        return "Authentication error. Your API key may be invalid or expired.";
      }
      return err.message;
    }
    return "An unexpected error occurred.";
  }

  async function retryLastMessage() {
    if (!lastSentMessage || submitBusy) return;
    const msg = lastSentMessage;
    // Remove the last user message — will be restored if retry fails
    const prevMessages = messages;
    messages = messages.slice(0, -1);
    lastSentMessage = "";
    await sendAndStream(msg);
    // If the stream failed, restore the user message so they can retry again
    if (streamingError) {
      messages = prevMessages;
      lastSentMessage = msg;
    }
  }

  function openComposer() {
    streamingError = null;
    mode = "composing";
    requestAnimationFrame(() => textareaRef?.focus());
  }

  // ── submitMessage: pushes user message, streams AI response, updates conversation ──
  async function submitMessage() {
    if (submitBusy) return;

    const nextMessage = message.trim();
    const transcriptText = speech.transcript.trim();

    if (!nextMessage && !transcriptText) {
      openComposer();
      return;
    }

    const finalMessage = nextMessage || transcriptText;

    const context: AgentContext = {};
    if (transcriptText) context.transcript = transcriptText;
    if (screenCapture) context.screenCapture = screenCapture;

    // Push user message — reassign for reactivity
    messages = [...messages, { role: "user", content: finalMessage }];

    message = "";
    speech = { ...speech, transcript: "" };
    screenCapture = null;
    streamingError = null;
    streamingText = "";
    submitBusy = true;
    lastSentMessage = finalMessage;
    mode = "working";

    // Notify page (e.g. focus main window) — fire-and-forget, best effort
    if (onMessageSubmit) {
      withTimeout(Promise.resolve(onMessageSubmit(finalMessage, context))).catch(
        (e) => console.warn("[agent-dock] onMessageSubmit failed:", e)
      );
    }

    // Stream AI response via shared helper (handles errors internally)
    await sendAndStream(finalMessage);
    // On success, clear saved text. On failure, lastSentMessage stays for retry.
    if (!streamingError) {
      lastSentMessage = "";
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
    } else if ((mode === "idle" || mode === "composing") && !speech.isListening) {
      startListening();
    }
  }

  function startListening() {
    if (!hasSpeech) {
      console.warn("[agent-dock] SpeechRecognition not available");
      return;
    }

    if (speech.isListening || speech.recognitionRef) {
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
      speech = { ...speech, transcript: finalText || interimText };
    };

    recognition.onerror = (event: any) => {
      if (disposed) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        console.debug("[agent-dock] speech not allowed (expected if permission denied):", event.error);
      } else {
        console.warn("[agent-dock] speech error:", event.error);
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        mode = "idle";
        speech = { ...speech, isListening: false, recognitionRef: null };
      }
    };

    recognition.onend = () => {
      if (disposed) return;
      speech = { ...speech, isListening: false, recognitionRef: null };
      if (speech.transcript.trim().length >= 3) {
        submitMessage().catch((err) => {
          console.warn("[agent-dock] submitMessage from onend failed:", err);
          mode = "idle";
        });
      } else if (mode === "listening") {
        speech = { ...speech, transcript: "" };
        mode = "idle";
      }
    };

    speech = { ...speech, recognitionRef: recognition, isListening: true, transcript: "" };
    mode = "listening";
    try {
      recognition.start();
      onVoiceStart?.();
    } catch (err) {
      console.warn("[agent-dock] recognition.start() failed:", err);
      speech = { ...speech, isListening: false, recognitionRef: null };
      mode = "idle";
    }
  }

  function stopListening() {
    if (!speech.recognitionRef) {
      speech = { ...speech, isListening: false };
      return;
    }
    try {
      speech.recognitionRef.stop();
    } catch {
      // Ignore — may already be stopped
    }
    speech = { ...speech, recognitionRef: null, isListening: false };
    onVoiceStop?.();
    if (speech.transcript.trim().length >= 3) {
      submitMessage().catch((err) => {
        console.warn("[agent-dock] submitMessage from stopListening failed:", err);
        mode = "idle";
      });
    } else {
      speech = { ...speech, transcript: "" };
      mode = "idle";
    }
  }

  // ── S7: Screen capture — Rust xcap in Tauri, getDisplayMedia fallback in browser ──
  async function captureScreen() {
    if (isTauri()) {
      try {
        const dataUri = await invoke<string>("capture_screen");
        screenCapture = dataUri;
        return;
      } catch (err) {
        const msg = typeof err === "string" ? err : err instanceof Error ? err.message : "Unknown error";
        console.warn("[agent-dock] screen capture invoke failed:", msg);
        toast.error("Screen capture failed", { description: msg, duration: 8000 });
        return;
      }
    }

    // Browser dev mode: fall back to getDisplayMedia (standard Web API)
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
      // Scroll handler is wired via Svelte's onscroll attribute — cleanup not needed here
      if (speech.recognitionRef) {
        try { speech.recognitionRef.abort(); } catch { /* ignore */ }
      }
      speech = { ...speech, recognitionRef: null, isListening: false };
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
          label="Capture"
          onclick={captureScreen}
          class={screenCapture ? "dock-btn--active" : ""}
        />
        <DockButton
          icon={mode === "listening" ? MicOffIcon : MicIcon}
          label={!hasSpeech ? "Voice" : mode === "listening" ? "Stop" : "Voice"}
          class={mode === "listening" ? "dock-btn--listening" : ""}
          onclick={hasSpeech ? toggleListening : undefined}
        />
        <DockButton
          icon={mode === "composing" ? SendIcon : ChatIcon}
          label={mode === "composing" ? "Send" : "Chat"}
          class={mode === "composing" ? "dock-btn--send" : ""}
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

    {#if mode === "listening" && speech.transcript}
      <div class="dock-transcript">
        <p class="dock-transcript-text">{speech.transcript}</p>
      </div>
    {/if}

    {#if messages.length > 0 || streamingText}
      <div class="dock-messages" bind:this={messagesContainer} role="log" aria-live="polite" aria-atomic="false" aria-label="Conversation" onscroll={checkScrollPosition}>
        {#each messages as msg}
          <div class="dock-msg" class:dock-msg--user={msg.role === "user"} class:dock-msg--assistant={msg.role === "assistant"}>
            {#if msg.role === "user"}
              <p class="dock-msg-text">{msg.content}</p>
            {:else}
              <StreamingMarkdown content={msg.content} />
            {/if}
          </div>
        {/each}
        {#if streamingText}
          <div class="dock-msg dock-msg--assistant dock-msg--streaming">
            <StreamingMarkdown content={streamingText} />
          </div>
        {:else if mode === "working" && !streamingText}
          <div class="dock-msg dock-msg--assistant dock-msg--loading">
            <div class="dock-msg-dots"><span></span><span></span><span></span></div>
          </div>
        {/if}
        {#if streamingError}
          <div class="dock-msg dock-msg--error">
            <p class="dock-msg-text">
              {streamingError}
              <button class="dock-msg-retry" onclick={() => retryLastMessage()}>Retry</button>
            </p>
          </div>
        {/if}
      </div>
      {#if !userNearBottom && (messages.length > 0 || streamingText)}
        <button class="dock-jump-bottom" onclick={scrollToBottom}>
          Latest ↓
        </button>
      {/if}
    {/if}

    <div
      class="dock-composer"
      class:dock-composer--open={mode === "composing"}
      inert={mode !== "composing"}
      aria-expanded={mode === "composing"}
      style={shouldReduceMotion ? "transition-duration:0ms" : ""}
    >
      <div class="dock-composer-inner">
        <button
          type="button"
          class="dock-composer-close"
          aria-label="Close composer"
          onclick={(e) => { (e.currentTarget as HTMLElement).blur(); mode = "idle"; }}
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

        ></textarea>
      </div>
    </div>
  </div>
</form>

<style>
  .dock-root {
    display: flex;
    width: 300px;
    flex-direction: column-reverse;
    overflow: hidden;
    border-radius: 16px;
    background: #141414;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    padding: 8px;
    box-sizing: border-box;
    color: #fff;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    transition:
      width 0.55s cubic-bezier(0.34, 1.3, 0.64, 1);
  }

  @supports (animation-timing-function: linear(0, 1)) {
    .dock-root {
      transition:
        width 0.55s linear(0, 0.09 10%, 0.26 20%, 0.5 33%, 0.74 46%, 0.9 58%, 1.02 76%, 1 88%, 1);
    }
  }

  .dock-root--expanded {
    width: 460px;
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-root {
      transition: none;
    }
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

  .dock-status {
    margin: 0;
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

  :global(.dock-btn--send) {
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
    height: 120px;
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
      height 0.55s cubic-bezier(0.34, 1.3, 0.64, 1),
      opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @supports (animation-timing-function: linear(0, 1)) {
    .dock-composer {
      transition:
        height 0.55s linear(0, 0.09 10%, 0.26 20%, 0.5 33%, 0.74 46%, 0.9 58%, 1.02 76%, 1 88%, 1),
        opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  .dock-composer--open {
    height: 150px;
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
    height: 142px;
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
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .dock-textarea::placeholder {
    color: #737373;
  }

  /* ── Chat messages container ─────────────────────────────────────── */
  .dock-messages {
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin: 4px 0 2px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.15) transparent;
    transition: max-height 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .dock-root--expanded .dock-messages {
    max-height: 360px;
  }

  .dock-messages::-webkit-scrollbar {
    width: 4px;
  }

  .dock-messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .dock-messages::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
  }

  .dock-msg {
    max-width: 85%;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    animation: dock-msg-in 0.15s ease both;
  }

  @keyframes dock-msg-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-msg { animation: none; }
  }

  .dock-msg--user {
    align-self: flex-end;
    background: #3b82f6;
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .dock-msg--assistant {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
    border-bottom-left-radius: 4px;
  }

  .dock-msg--streaming {
    border-left: 2px solid #3b82f6;
  }

  .dock-msg--loading {
    align-self: flex-start;
    background: transparent;
    padding: 4px 8px;
  }

  .dock-msg--error {
    align-self: center;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .dock-msg-text {
    margin: 0;
    white-space: pre-wrap;
  }

  .dock-msg-dots {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .dock-msg-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    animation: dock-dot-bounce 1.2s ease-in-out infinite;
  }

  .dock-msg-dots span:nth-child(2) { animation-delay: 0.2s; }
  .dock-msg-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes dock-dot-bounce {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
    40% { transform: scale(1.1); opacity: 0.9; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-msg-dots span { animation: none; opacity: 0.6; }
  }

  /* ── Jump to latest button ───────────────────────────────────────── */
  .dock-jump-bottom {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: #a3a3a3;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    user-select: none;
  }

  .dock-jump-bottom:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
  }

  .dock-jump-bottom:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  /* ── Retry button in error bubble ────────────────────────────────── */
  .dock-msg-retry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    vertical-align: middle;
  }

  .dock-msg-retry:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .dock-msg-retry:focus-visible {
    outline: 2px solid rgba(239, 68, 68, 0.5);
    outline-offset: 2px;
  }
</style>
