<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import {
    agentPanelOpen,
    agentPanelWidth,
    closeAgentPanel,
    setAgentPanelWidth,
    resetAgentPanelWidth,
  } from "$lib/stores/agent-panel.store";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
  import PaperclipIcon from "@lucide/svelte/icons/paperclip";
  import SquareIcon from "@lucide/svelte/icons/square";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import CameraIcon from "@lucide/svelte/icons/camera";
  import ImageIcon from "@lucide/svelte/icons/image";
  import FileIcon from "@lucide/svelte/icons/file";
  import PuzzleIcon from "@lucide/svelte/icons/puzzle";
  import { desktopSettings } from "$lib/desktop/settings";
  import { agentMorph } from "$lib/stores/agent-morph.svelte";
  import type { Attachment } from "$lib/stores/agent-morph.svelte";
  import AgentMorphSurface from "$lib/components/agent/AgentMorphSurface.svelte";
  import AgentMorphAttachments from "$lib/components/agent/AgentMorphAttachments.svelte";
  import AgentAttachmentThumb from "$lib/components/agent/AgentAttachmentThumb.svelte";
  import { chatStream, conversations, type UiVocabulary } from "$lib/ai/client";
  import { getDefaultSystemPrompt } from "$lib/ai/prompts";
  import StreamingMarkdown from "$lib/components/StreamingMarkdown.svelte";
  import GenerativeUiRenderer from "$lib/ai/ui/GenerativeUiRenderer.svelte";
  import {
    Message,
    MessageContent,
  } from "$lib/components/agent/message/index.js";
  import * as Tool from "$lib/components/agent/tool/index.js";
  import ThinkingOrb from "$lib/components/agent/ThinkingOrb.svelte";
  import { tooltip } from "$lib/components/Tooltip.svelte";
  import {
    currentConversationId,
    setConversationId,
    clearConversationId,
  } from "$lib/stores/agent-conversation.store";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import MoreHorizontalIcon from "@lucide/svelte/icons/more-horizontal";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { goto } from "@mateothegreat/svelte5-router";
  import { chatgptSession, loadChatGptSession } from "$lib/stores/chatgpt-auth.store";
  import { byokSettings, byokReady } from "$lib/stores/byok.store";

  let message = $state("");
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let scrollContainerRef = $state<HTMLDivElement | null>(null);
  let userNearBottom = $state(true);

  const SCROLL_THRESHOLD = 1;

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      if (!scrollContainerRef) return;
      scrollContainerRef.scrollTo({
        top: scrollContainerRef.scrollHeight,
        behavior,
      });
    });
  }

  let chatgptLoaded = $state(false);
  $effect(() => {
    if (!chatgptLoaded && !$chatgptSession) {
      loadChatGptSession()
        .then(() => { chatgptLoaded = true; })
        .catch((e) => {
          console.warn("[agent-panel] chatgpt session load failed:", e);
          chatgptLoaded = true;
        });
    }
  });

  // Observe content resize to auto-scroll when user is near bottom
  let resizeObserver: ResizeObserver | undefined;
  $effect(() => {
    const el = scrollContainerRef;
    if (!el) return;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => {
      if (userNearBottom) scrollToBottom("smooth");
    });
    resizeObserver.observe(el);
    return () => resizeObserver?.disconnect();
  });

  function handleScroll() {
    if (!scrollContainerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef;
    userNearBottom = Math.abs(scrollHeight - scrollTop - clientHeight) <= SCROLL_THRESHOLD
      || scrollHeight <= clientHeight;
  }

  // ── Conversation persistence ───────────────────────────────────
  // Conversation ID is stored in localStorage via agent-conversation.store
  // so it survives module switches and app restarts. Messages are saved
  // to SQLite after every assistant response via conversations.save().
  // On mount, we load the last conversation from the database.
  let convTitle = $state("");
  let loadingConversation = $state(false);
  let initialLoadDone = $state(false);
  let loadedConversationId = $state<string | null>(null);

  // Load the persisted conversation when a valid ID exists.
  // Uses initialLoadDone guard to avoid re-loading from DB after every save
  // (save sets the conversation ID, which would otherwise trigger a reload).
  // When the ID changes to a different conversation, allow re-loading.
  $effect(() => {
    const id = $currentConversationId;
    if (!id) {
      loadingConversation = false;
      return;
    }
    if (initialLoadDone && id === loadedConversationId) return;
    initialLoadDone = true;
    loadedConversationId = id;
    loadingConversation = true;
    conversations.get(id).then((conv) => {
      if (conv) {
        messages = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          toolCalls: m.toolCalls?.map(tc => ({
            ...tc,
            autoExecute: true,
            state: "completed" as const,
          })),
          createdAt: m.createdAt ?? Date.now(),
        }));
        convTitle = conv.title || "";
      }
      loadingConversation = false;
    }).catch(() => {
      loadingConversation = false;
    });
  });

  // Scroll to bottom after initial conversation is loaded
  $effect(() => {
    if (initialLoadDone && !loadingConversation && messages.length > 0) {
      scrollToBottom("instant");
    }
  });

  // Build the provider-valid message history for a new chatStream request.
  // Assistant turns that invoked tools contribute their tool_calls block plus
  // one `tool` role message per result (matched by id). Re-loading a saved
  // conversation sets toolCalls without results, so only attach tool messages
  // when a result is actually present.
  function buildHistory(msgs: PanelChatMessage[]) {
    const history: Array<{
      role: string;
      content: string;
      toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
      toolCallId?: string;
    }> = [];
    for (const m of msgs) {
      history.push({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        })),
      });
      if (m.role === "assistant" && m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          if (tc.result !== undefined) {
            const content = tc.isError
              ? formatToolError(tc.result)
              : typeof tc.result === "string"
                ? tc.result
                : JSON.stringify(tc.result);
            history.push({
              role: "tool",
              content,
              toolCallId: tc.id,
            });
          }
        }
      }
    }
    return history;
  }

  async function saveConversation() {
    if (messages.length === 0) return;
    try {
      // Generate a client-side UUID for new conversations.
      // The Rust save_messages function creates the conversation row
      // on-the-fly if the ID doesn't exist yet.
      const id = $currentConversationId || crypto.randomUUID();
      await conversations.save(id, messages.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        })),
        createdAt: m.createdAt,
      })));
      setConversationId(id);
    } catch (e) {
      console.warn("[agent-panel] Failed to save conversation:", e);
    }
  }

  // ── Timestamp formatting ──────────────────────────────────────────
  function formatMessageTime(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatMessageDate(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // ── Message actions ───────────────────────────────────────────────
  function startEdit(index: number) {
    editingIndex = index;
    editingText = messages[index].content;
  }

  function cancelEdit() {
    editingIndex = null;
    editingText = "";
  }

  function saveEdit() {
    if (editingIndex === null) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const idx = editingIndex;
    messages[idx] = { ...messages[idx], content: trimmed, createdAt: Date.now() };
    messages = messages.slice(0, idx + 1);
    editingIndex = null;
    editingText = "";
    if (activeStream) {
      activeStream.cancel();
      activeStream = null;
    }
    sendAndStream(trimmed);
  }

  function reloadMessage(index: number) {
    if (submitBusy || messages.length < 2) return;
    streamingError = null;
    const userMsg = messages[index - 1];
    if (!userMsg || userMsg.role !== "user") return;
    messages = messages.slice(0, index);
    if (activeStream) {
      activeStream.cancel();
      activeStream = null;
    }
    sendAndStream(userMsg.content);
  }

  function toggleMenu(index: number) {
    openMenuIndex = openMenuIndex === index ? null : index;
  }

  function closeMenu() {
    openMenuIndex = null;
  }

  async function exportMarkdown(msg: PanelChatMessage) {
    if (!msg.content.trim()) return;
    const label = msg.role === "user" ? "You" : "Bento";
    const md = `## ${label}\n\n${msg.content}`;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: `bento-message-${Date.now()}.md`,
      });
      if (filePath) {
        await writeTextFile(filePath, md);
      }
    } catch (e) {
      console.warn("[agent-panel] Failed to export markdown:", e);
    }
  }

  // ── Click-outside + Escape handler for More menu ──────────────────
  $effect(() => {
    if (openMenuIndex === null) return;
    const timer = setTimeout(() => {
      function clickHandler(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-more-menu]")) {
          openMenuIndex = null;
        }
      }
      function keyHandler(e: KeyboardEvent) {
        if (e.key === "Escape") openMenuIndex = null;
      }
      document.addEventListener("click", clickHandler);
      document.addEventListener("keydown", keyHandler);
      return () => {
        document.removeEventListener("click", clickHandler);
        document.removeEventListener("keydown", keyHandler);
      };
    }, 0);
    return () => clearTimeout(timer);
  });

  async function handleNewConversation() {
    // Cancel any in-flight stream
    if (activeStream) {
      activeStream.cancel();
      activeStream = null;
    }
    if (messages.length > 0) {
      await saveConversation();
    }
    messages = [];
    streamingText = "";
    streamingError = null;
    attachError = null;
    if (attachErrorTimer) { clearTimeout(attachErrorTimer); attachErrorTimer = null; }
    toolCalls = [];
    uiUpdates = [];
    convTitle = "";
    loadingConversation = false;
    initialLoadDone = false;
    attachCounter = 0;
    editingIndex = null;
    editingText = "";
    openMenuIndex = null;
    copiedIndex = null;
    clearConversationId();
  }

  let tabsEnabled = $derived($desktopSettings.workspace.tabsEnabled);
  let panelTop = $derived(tabsEnabled ? 75 : 39);

  const PANEL_MIN = 280;
  const PANEL_MAX = 560;
  const PANEL_STEP = 20;

  // ── Chat state ──────────────────────────────────────────────────
  type PanelChatMessage = {
    role: "user" | "assistant";
    content: string;
    toolCalls?: ToolCallInfo[];
    uiUpdates?: UiVocabulary[];
    createdAt: number;
  };

  let messages = $state.raw<PanelChatMessage[]>([]);
  let streamingText = $state("");
  let streamingError = $state<string | null>(null);
  let submitBusy = $state(false);
  let lastSentMessage = $state("");
  let activeStream: { cancel: () => void } | null = null;

  // ── Edit state ───────────────────────────────────────────────────
  let editingIndex = $state<number | null>(null);
  let editingText = $state("");
  let openMenuIndex = $state<number | null>(null);
  let copiedIndex = $state<number | null>(null);

  // ── Tool call tracking ─────────────────────────────────────────
  type ToolCallInfo = {
    id: string;
    name: string;
    args: Record<string, unknown>;
    autoExecute: boolean;
    result?: unknown;
    isError?: boolean;
    state: "pending" | "running" | "completed" | "error";
  };
  let toolCalls = $state<ToolCallInfo[]>([]);
  let uiUpdates = $state<UiVocabulary[]>([]);

  let thinkingOrbState = $derived.by((): "working" | "searching" | "solving" | "listening" | "composing" | "shaping" => {
    const running = toolCalls.filter(tc => tc.state === "running");
    if (running.length > 0) {
      const names = running.map(tc => tc.name.toLowerCase());
      if (names.some(n => /search|find|lookup|query|retrieve|fetch|web|browse|scrape/.test(n))) return "searching";
      if (names.some(n => /solve|calculate|compute|analyze|reason|math|summarize|evaluate/.test(n))) return "solving";
      if (names.some(n => /write|create|compose|draft|edit|format|shap/.test(n))) return "shaping";
      if (names.some(n => /listen|transcribe|record|audio|voice/.test(n))) return "listening";
      return "working";
    }
    return "composing";
  });

  // ── Focus management ────────────────────────────────────────────
  let previousFocus = $state<HTMLElement | null>(null);

  function formatToolError(result: unknown): string {
    if (result && typeof result === "object" && "error" in result) {
      return String((result as Record<string, unknown>).error);
    }
    return String(result);
  }

  $effect(() => {
    if ($agentPanelOpen) {
      previousFocus = document.activeElement as HTMLElement;
      requestAnimationFrame(() => textareaRef?.focus());
    } else if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  });

  // ── Global Escape to close panel ────────────────────────────────
  $effect(() => {
    if (!$agentPanelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !resizeActive) {
        if (agentMorph.state !== "closed") {
          agentMorph.close();
        } else {
          closeAgentPanel();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Resize drag logic ───────────────────────────────────────────
  let startX = 0;
  let startW = 0;
  let rafId = 0;
  let resizeActive = $state(false);

  function onResizeStart(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startW = $agentPanelWidth;
    resizeActive = true;

    document.body.classList.add("col-resize");

    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeEnd);
    document.addEventListener("pointercancel", onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!resizeActive) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const dx = e.clientX - startX;
      setAgentPanelWidth(startW + dx);
    });
  }

  function onResizeEnd() {
    resizeActive = false;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    document.removeEventListener("pointercancel", onResizeEnd);
    document.body.classList.remove("col-resize");
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function onResizeKeydown(e: KeyboardEvent) {
    const w = $agentPanelWidth;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setAgentPanelWidth(w + PANEL_STEP);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setAgentPanelWidth(w - PANEL_STEP);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (resizeActive) {
        onResizeEnd();
        setAgentPanelWidth(startW);
      } else {
        closeAgentPanel();
      }
    }
  }

  function onResizeDblClick() {
    resetAgentPanelWidth();
  }

  // ── Save + close morph when panel closes ───────────────────────
  // Messages are already saved after every assistant response via
  // sendAndStream, so the save here is a safety net for edge cases
  // (e.g. the user closed the panel mid-stream).
  $effect(() => {
    if (!$agentPanelOpen) {
      if (messages.length > 0) {
        saveConversation().catch((e) =>
          console.warn("[agent-panel] save on close failed:", e)
        );
      }
      if (agentMorph.state !== "closed") {
        agentMorph.close();
      }
    }
  });

  // ── Track input-wrap height for morph surface positioning ────────
  let inputWrapEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!inputWrapEl) return;
    const ro = new ResizeObserver(([entry]) => {
      agentMorph.inputBottom = entry.contentRect.height + 12;
    });
    ro.observe(inputWrapEl);
    return () => ro.disconnect();
  });

  // ── Cleanup on unmount ──────────────────────────────────────────
  $effect(() => {
    return () => {
      document.removeEventListener("mousemove", onResizeMove);
      document.removeEventListener("mouseup", onResizeEnd);
      document.removeEventListener("pointercancel", onResizeEnd);
      document.body.classList.remove("col-resize");
      if (rafId) cancelAnimationFrame(rafId);
    };
  });

  // ── Streaming helper ───────────────────────────────────────────
  async function sendAndStream(text: string) {
    submitBusy = true;
    streamingError = null;
    streamingText = "";
    toolCalls = [];
    uiUpdates = [];
    openMenuIndex = null;
    copiedIndex = null;

    try {
      // Pass full conversation history so the AI has context from previous turns.
      // Provider and model are NOT passed — the Rust backend reads them
      // from DesktopSettings live on every request. This means switching
      // the active provider in Settings takes effect immediately on the
      // next message, without any stale frontend cache.
      const { stream, cancel } = chatStream({
        // Pass full conversation history so the AI has context from previous
        // turns. Assistant turns that called tools must also carry their tool
        // call blocks AND matching tool-result messages, or OpenAI/Anthropic/
        // Gemini reject the request (tool_calls without a following tool
        // message is a 400). Tool results are re-materialized from the results
        // we captured during streaming.
        messages: buildHistory(messages),
        system: getDefaultSystemPrompt(),
        enableTools: true,
      });
      activeStream = { cancel };

      for await (const event of stream) {
        if (event.type === "token") {
          streamingText += event.content;
        } else if (event.type === "tool_call") {
          // Add tool call to tracking list
          toolCalls = [...toolCalls, {
            id: event.id,
            name: event.name,
            args: event.args,
            autoExecute: event.autoExecute,
            state: "running",
          }];
        } else if (event.type === "tool_result") {
          // Update tool call with result
          toolCalls = toolCalls.map(tc =>
            tc.id === event.id
              ? { ...tc, result: event.result, isError: event.isError, state: event.isError ? "error" : "completed" }
              : tc
          );
        } else if (event.type === "error") {
          throw new Error(event.message);
        } else if (event.type === "ui_update") {
          uiUpdates = [...uiUpdates, event.ui];
        } else if (event.type === "done") {
          break;
        }
      }

      // Persist the assistant turn even when the model produced no text but
      // did invoke tools — dropping it would lose the tool call + result from
      // history and break provider-valid message pairing on the next request.
      if (streamingText.trim() || toolCalls.length > 0) {
        messages = [...messages, { role: "assistant", content: streamingText, toolCalls, uiUpdates, createdAt: Date.now() }];
      }
      streamingText = "";
      toolCalls = [];
      uiUpdates = [];

      // Auto-save to SQLite after every assistant response
      await saveConversation();
    } catch (err) {
      console.warn("[agent-panel] stream failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      streamingError = msg.includes("timeout") || msg.includes("timed out")
        ? "Request timed out after 30s. The server may be overloaded."
        : msg.includes("network") || msg.includes("fetch") || msg.includes("connection")
          ? "Network error. Check your connection and try again."
          : msg.includes("rate limit") || msg.includes("429")
            ? "Rate limit reached. Please wait a moment."
            : msg.includes("auth") || msg.includes("api key") || msg.includes("401") || msg.includes("403")
              ? "Authentication error. Your API key may be invalid or expired."
              : msg.includes("402") || msg.includes("payment") || msg.includes("credits") || msg.includes("billing")
                ? "Billing error. The provider rejected the request due to payment/credit limits."
              : msg.includes("404")
                ? "Model or endpoint not found. Check that the model name is correct and the provider supports it."
              : msg.includes("500") || msg.includes("503") || msg.includes("service unavailable")
                ? "Provider server error. Try again later."
              : msg.includes("ollama") && msg.includes("connection")
                ? "Ollama is not running. Start Ollama and try again."
              : msg.length > 300
                ? msg.slice(0, 300) + "..."
                : msg;
      streamingText = "";
      toolCalls = [];
      uiUpdates = [];
      scrollToBottom("smooth");
    } finally {
      submitBusy = false;
      activeStream = null;
    }
  }

  // ── Retry last message ─────────────────────────────────────────
  async function retryLastMessage() {
    if (!lastSentMessage || submitBusy) return;
    editingIndex = null;
    editingText = "";
    streamingError = null;
    const msg = lastSentMessage;
    const prevMessages = messages;
    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      messages = messages.slice(0, -1);
    }
    lastSentMessage = "";
    await sendAndStream(msg);
    if (streamingError) {
      messages = prevMessages;
      lastSentMessage = msg;
    } else {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    }
  }

  // ── Submit handler ─────────────────────────────────────────────
  async function handleSubmit(e: Event) {
    e.preventDefault();
    if ((!message.trim() && attachments.length === 0) || submitBusy) return;

    const text = message.trim();
    editingIndex = null;
    editingText = "";
    openMenuIndex = null;
    copiedIndex = null;
    // Build rich content with attachments
    let content = text;
    if (attachments.length > 0) {
      const attachmentParts = attachments.map(att => {
        if (att.kind === "image" && att.uri) {
          return `[Image: ${att.name || "attachment"}]`;
        } else if (att.kind === "doc" && att.uri) {
          return `[File: ${att.name || "document"}]`;
        }
        return "";
      }).filter(Boolean);
      if (attachmentParts.length > 0) {
        content = `${text}\n\nAttachments: ${attachmentParts.join(", ")}`;
      }
    }
    messages = [...messages, { role: "user", content, createdAt: Date.now() }];
    message = "";
    lastSentMessage = text;
    attachments = [];

    // Scroll to bottom after user message is appended
    requestAnimationFrame(() => scrollToBottom("instant"));

    await sendAndStream(content);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

  function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  let resizeRaf = 0;
  function autoResize() {
    if (!textareaRef) return;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      if (!textareaRef) return;
      textareaRef.style.height = "0px";
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + "px";
    });
  }

  // ── Cancel active stream on unmount ────────────────────────────
  $effect(() => {
    return () => {
      if (activeStream) {
        activeStream.cancel();
        activeStream = null;
      }
    };
  });

  // ── Morph menu items ────────────────────────────────────────────
  const morphItems = [
    { id: "camera", label: "Camera", icon: CameraIcon },
    { id: "photos", label: "Photos", icon: ImageIcon },
    { id: "files", label: "Files", icon: FileIcon },
    { id: "plugins", label: "Plugins", icon: PuzzleIcon },
  ];

  // ── Attachments ──────────────────────────────────────────────────
  let attachments: Attachment[] = $state([]);
  let attachCounter = $state(0);
  let captureBusy = $state(false);
  let attachError = $state<string | null>(null);
  let attachErrorTimer: ReturnType<typeof setTimeout> | null = null;

  function showAttachError(msg: string) {
    attachError = msg;
    if (attachErrorTimer) clearTimeout(attachErrorTimer);
    attachErrorTimer = setTimeout(() => {
      attachError = null;
      attachErrorTimer = null;
    }, 4000);
  }

  function removeAttachment(id: string) {
    attachments = attachments.filter((a) => a.id !== id);
  }

  async function onMorphItemClick(id: string) {
    agentMorph.close();
    try {
      if (id === "camera") {
        captureBusy = true;
        try {
          const dataUri = await invoke<string>("capture_screen");
          attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "image", uri: dataUri, name: "Screen Capture" }];
        } finally {
          captureBusy = false;
        }
      } else if (id === "photos") {
        // Open file picker for images
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: true,
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        });
        if (selected) {
          const files = Array.isArray(selected) ? selected : [selected];
          for (const file of files) {
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const bytes = await readFile(file);
            if (bytes.length > MAX_ATTACHMENT_SIZE) {
              showAttachError(`Image too large (max 20MB): ${file.split(/[/\\]/).pop()}`);
              continue;
            }
            const base64 = bytesToBase64(bytes);
            const ext = file.split(".").pop()?.toLowerCase() || "png";
            const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
            attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "image", uri: `data:${mime};base64,${base64}`, name: file.split(/[/\\]/).pop() || "Image" }];
          }
        }
      } else if (id === "files") {
        // Open file picker for documents
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: true,
          filters: [{ name: "Documents", extensions: ["pdf", "txt", "md", "doc", "docx"] }],
        });
        if (selected) {
          const files = Array.isArray(selected) ? selected : [selected];
          for (const file of files) {
            const { readTextFile, readFile } = await import("@tauri-apps/plugin-fs");
            const ext = file.split(".").pop()?.toLowerCase() || "txt";
            if (["txt", "md"].includes(ext)) {
              const content = await readTextFile(file);
              const encoded = new TextEncoder().encode(content);
              const base64 = bytesToBase64(encoded);
              attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "doc", uri: `data:text/plain;base64,${base64}`, name: file.split(/[/\\]/).pop() || "Document" }];
            } else {
              const bytes = await readFile(file);
              if (bytes.length > MAX_ATTACHMENT_SIZE) {
                showAttachError(`File too large (max 20MB): ${file.split(/[/\\]/).pop()}`);
                continue;
              }
              const base64 = bytesToBase64(bytes);
              attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "doc", uri: `data:application/${ext};base64,${base64}`, name: file.split(/[/\\]/).pop() || "Document" }];
            }
          }
        }
      } else if (id === "plugins") {
        console.warn("[agent-panel] plugins not yet implemented");
        return;
      }
    } catch (err) {
      console.warn("[agent-panel] attachment failed:", err);
    }
  }

  // ── Cleanup morph timers on unmount ──────────────────────────────
  $effect(() => {
    return () => agentMorph.reset();
  });
</script>

<div
  class="agent-panel"
  class:agent-panel--open={$agentPanelOpen}
  style:top="{panelTop}px"
  style:width="{$agentPanelWidth}px"
  role="complementary"
  aria-label="Agent chat"
>
  <div class="agent-panel__inner">
    <div class="agent-panel__header">
      <button
        type="button"
        class="agent-panel__header-btn"
        onclick={closeAgentPanel}
        aria-label="Close agent panel"
      >
        <ArrowLeftIcon size={16} />
      </button>

      <div class="agent-panel__header-title">
        {#if loadingConversation}
          <span class="agent-panel__conv-loading">Loading...</span>
        {:else if convTitle}
          <span class="agent-panel__conv-title">{convTitle}</span>
        {:else if messages.length > 0}
          <span class="agent-panel__conv-title">Chat</span>
        {:else}
          <span class="agent-panel__conv-title agent-panel__conv-title--dim">New conversation</span>
        {/if}
      </div>

      <div class="agent-panel__header-actions">
        <button
          type="button"
          class="agent-panel__header-btn"
          onclick={handleNewConversation}
          aria-label="Start new conversation"
          title="Start new conversation"
        >
          <PlusIcon size={16} />
        </button>
        <button
          type="button"
          class="agent-panel__header-btn"
          onclick={closeAgentPanel}
          aria-label="Collapse chat panel"
          use:tooltip={{ text: "Collapse chat panel" }}
        >
          <PanelLeftCloseIcon size={16} />
        </button>
      </div>
    </div>

    <div class="agent-panel__auth-bar">
      {#if $chatgptSession}
        <svg class="agent-panel__auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        <span class="agent-panel__auth-label">ChatGPT</span>
        <span class="agent-panel__auth-dot" role="status" aria-label="Connected"></span>
      {:else}
        <button
          type="button"
          class="agent-panel__auth-btn"
          onclick={() => goto("/settings")}
        >
          <svg class="agent-panel__auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
          Sign in with ChatGPT
        </button>
      {/if}
    </div>

    <div class="agent-panel__messages-wrap">
      <div class="agent-panel__fade-top"></div>
      {#if $byokReady && $byokSettings.configuredProviders.length === 0 && !$chatgptSession}
        <div class="agent-panel__setup-card">
          <svg class="agent-panel__setup-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <div class="agent-panel__setup-body">
            <p class="agent-panel__setup-text">No AI provider configured — add an API key in Settings to start using the assistant.</p>
            <button class="agent-panel__setup-btn" onclick={() => goto("/settings")} type="button">
              Go to Settings
            </button>
          </div>
        </div>
      {/if}
      <div class="agent-panel__messages" bind:this={scrollContainerRef} onscroll={handleScroll}>
        <div class="agent-panel__msg-list" role="log" aria-live="polite" aria-label="Conversation">
          {#if loadingConversation}
            <div class="agent-panel__loading-skeleton">
              <div class="agent-panel__skeleton-row agent-panel__skeleton-row--user">
                <div class="agent-panel__skeleton-bubble agent-panel__skeleton-bubble--user"></div>
              </div>
              <div class="agent-panel__skeleton-row agent-panel__skeleton-row--assistant">
                <div class="agent-panel__skeleton-bubble agent-panel__skeleton-bubble--assistant"></div>
              </div>
              <div class="agent-panel__skeleton-row agent-panel__skeleton-row--assistant">
                <div class="agent-panel__skeleton-bubble agent-panel__skeleton-bubble--assistant"></div>
              </div>
            </div>
          {:else if messages.length === 0 && !streamingText && !streamingError}
            <div class="agent-panel__empty">
              <SparklesIcon size={20} class="agent-panel__empty-icon" />
              <p class="agent-panel__empty-text">Start a conversation — ask Bento about your tasks, habits, and notes</p>
            </div>
          {:else}
            {#each messages as msg, i}
              {@const isLast = i === messages.length - 1}
              <Message from={msg.role}>
                {#if editingIndex === i}
                  <div class="agent-panel__edit-wrap">
                    <!-- svelte-ignore a11y_autofocus -->
                    <textarea
                      bind:value={editingText}
                      class="agent-panel__edit-input"
                      autofocus
                      onkeydown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                        if (e.key === "Escape") { cancelEdit(); }
                      }}
                      aria-label="Edit message"
                    ></textarea>
                    <div class="agent-panel__edit-actions">
                      <button type="button" class="agent-panel__edit-cancel" onclick={cancelEdit}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="agent-panel__edit-save"
                        onclick={saveEdit}
                        disabled={!editingText.trim()}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                {:else}
                  <MessageContent>
                    {#if msg.role === "user"}
                      {msg.content}
                    {:else}
                      <StreamingMarkdown content={msg.content} />
                      {#if (msg.toolCalls?.length ?? 0) > 0}
                        {#each msg.toolCalls as tc (tc.id)}
                          <Tool.Root>
                            <Tool.Header type={tc.name} state={tc.state === "completed" ? "output-available" : tc.state === "error" ? "output-error" : tc.state === "running" ? "input-available" : "input-streaming"} />
                            <Tool.Content>
                              <Tool.Input input={tc.args} />
                              {#if tc.result !== undefined}
                                <Tool.Output output={tc.result} errorText={tc.isError ? formatToolError(tc.result) : undefined} />
                              {/if}
                            </Tool.Content>
                          </Tool.Root>
                        {/each}
                      {/if}
                      {#if (msg.uiUpdates?.length ?? 0) > 0}
                        <div class="flex flex-col gap-2 px-4 py-2">
                          {#each msg.uiUpdates as ui, i}
                            <GenerativeUiRenderer ui={ui} />
                          {/each}
                        </div>
                      {/if}
                    {/if}
                  </MessageContent>
                  <div
                    class="agent-panel__msg-footer"
                    class:agent-panel__msg-footer--always={isLast}
                    class:agent-panel__msg-footer--hidden={submitBusy}
                  >
                    <span
                      class="agent-panel__msg-time"
                      title={formatMessageDate(msg.createdAt)}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </span>
                    <div class="agent-panel__msg-action-group">
                      {#if msg.role === "assistant"}
                        <button
                          type="button"
                          class="agent-panel__action-btn"
                          onclick={async () => {
                            try {
                              await navigator.clipboard.writeText(msg.content);
                              copiedIndex = i;
                              setTimeout(() => { if (copiedIndex === i) copiedIndex = null; }, 1200);
                            } catch {}
                          }}
                          aria-label="Copy"
                          use:tooltip={{ text: copiedIndex === i ? "Copied!" : "Copy" }}
                        >
                          {#if copiedIndex === i}
                            <CheckIcon size={14} />
                          {:else}
                            <CopyIcon size={14} />
                          {/if}
                        </button>
                        <button
                          type="button"
                          class="agent-panel__action-btn"
                          onclick={() => reloadMessage(i)}
                          aria-label="Regenerate"
                          use:tooltip={{ text: "Regenerate" }}
                        >
                          <RefreshCwIcon size={14} />
                        </button>
                      {:else}
                        <button
                          type="button"
                          class="agent-panel__action-btn"
                          onclick={() => startEdit(i)}
                          aria-label="Edit"
                          use:tooltip={{ text: "Edit" }}
                        >
                          <PencilIcon size={14} />
                        </button>
                      {/if}
                      <div class="agent-panel__more-wrap" data-more-menu>
                        <button
                          type="button"
                          class="agent-panel__action-btn"
                          onclick={() => toggleMenu(i)}
                          aria-label="More"
                          use:tooltip={{ text: "More" }}
                        >
                          <MoreHorizontalIcon size={14} />
                        </button>
                        {#if openMenuIndex === i}
                          <div class="agent-panel__more-dropdown" role="menu">
                            <button
                              type="button"
                              class="agent-panel__more-item"
                              role="menuitem"
                              onclick={() => { exportMarkdown(msg).catch(() => {}); closeMenu(); }}
                            >
                              <DownloadIcon size={14} />
                              Export Markdown
                            </button>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}
              </Message>
            {/each}
            {#if streamingText}
              <Message from="assistant" class="agent-panel__msg--streaming">
                <MessageContent>
                  <StreamingMarkdown content={streamingText} />
                </MessageContent>
              </Message>
            {:else if submitBusy && !streamingText}
              <Message from="assistant">
                <MessageContent>
                  <div class="flex items-center gap-3 px-1 py-2">
                    <ThinkingOrb orbState={thinkingOrbState} size={20} />
                    <span class="text-sm [color:oklch(0.5_0_0)] dark:[color:oklch(0.7_0_0)]">{thinkingOrbState === "composing" ? "Thinking..." : "Working..."}</span>
                  </div>
                </MessageContent>
              </Message>
            {/if}
            {#if streamingText && toolCalls.length > 0}
              {#each toolCalls as tc (tc.id)}
                <Tool.Root>
                  <Tool.Header type={tc.name} state={tc.state === "completed" ? "output-available" : tc.state === "error" ? "output-error" : tc.state === "running" ? "input-available" : "input-streaming"} />
                  <Tool.Content>
                    <Tool.Input input={tc.args} />
                    {#if tc.result !== undefined}
                      <Tool.Output output={tc.result} errorText={tc.isError ? formatToolError(tc.result) : undefined} />
                    {/if}
                  </Tool.Content>
                </Tool.Root>
              {/each}
            {/if}
            {#if streamingText && uiUpdates.length > 0}
              <div class="flex flex-col gap-2 px-4 py-2">
                {#each uiUpdates as ui, i}
                  <GenerativeUiRenderer ui={ui} />
                {/each}
              </div>
            {/if}
            {#if streamingError}
              <div role="alert" aria-live="assertive">
                <div class="agent-panel__msg--error">
                  <p class="agent-panel__msg-text">
                    {streamingError}
                    <button class="agent-panel__msg-retry" onclick={retryLastMessage}>Retry</button>
                  </p>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
      <div class="agent-panel__fade-bottom"></div>
    </div>

    <AgentMorphSurface items={morphItems} onitemclick={onMorphItemClick} />

    {#if attachError}
      <div class="agent-panel__attach-error" role="alert" aria-live="assertive">{attachError}</div>
    {/if}

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="agent-panel__input-wrap" bind:this={inputWrapEl}>
      <form onsubmit={handleSubmit}>
        <div class="agent-panel__input-shell">
          <div class="agent-panel__input-field">
            {#if attachments.length > 0}
              <AgentMorphAttachments>
                {#each attachments as att (att.id)}
                  <AgentAttachmentThumb
                    attachment={att}
                    onremove={removeAttachment}
                  />
                {/each}
              </AgentMorphAttachments>
            {/if}
            <label for="agent-textarea" class="sr-only">Message</label>
            <textarea
              id="agent-textarea"
              bind:this={textareaRef}
              bind:value={message}
              onkeydown={handleKeydown}
              oninput={autoResize}
              placeholder="Reply to the assistant..."
              rows="1"
              class="agent-panel__textarea"
            ></textarea>
          </div>
          <div class="agent-panel__input-footer">
            <div class="agent-panel__input-left">
              <button
                type="button"
                class="agent-panel__tool-btn"
                class:agent-panel__tool-btn--busy={captureBusy}
                onclick={agentMorph.toggleMenu}
                aria-label="Attach"
                aria-expanded={agentMorph.state !== "closed"}
                disabled={captureBusy}
                use:tooltip={{ text: captureBusy ? "Capturing..." : "Attach" }}
              >
                <PaperclipIcon size={16} />
              </button>

            </div>
            {#if submitBusy}
              <button
                type="button"
                class="agent-panel__stop-btn"
                aria-label="Stop generating"
                onclick={() => {
                  activeStream?.cancel();
                  // Don't set submitBusy here — the finally block in
                  // sendAndStream handles it after the for-await loop
                  // settles. Setting it synchronously would let the user
                  // submit a new message mid-cleanup.
                }}
              >
                <SquareIcon size={14} />
              </button>
            {:else}
              <button
                type="submit"
                class="agent-panel__send-btn"
                aria-label="Send message"
                disabled={(!message.trim() && attachments.length === 0) || submitBusy}
              >
                <ArrowUpIcon size={16} />
              </button>
            {/if}
          </div>
        </div>
      </form>
    </div>
  </div>
</div>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="agent-panel__resize"
  class:agent-panel--open={$agentPanelOpen}
  class:agent-panel__resize--active={resizeActive}
  style:top="{panelTop}px"
  style:left="{$agentPanelWidth}px"
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize agent panel"
  tabindex="0"
  onmousedown={onResizeStart}
  onkeydown={onResizeKeydown}
  ondblclick={onResizeDblClick}
>
  <div class="agent-panel__resize-bar"></div>
</div>

<style>
  .agent-panel {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 70;
    width: 420px;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel {
      transition: none;
    }
  }

  .agent-panel--open {
    transform: translateX(0);
  }

  .agent-panel__inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--background);
    color: var(--foreground);
    position: relative;
  }

  .agent-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    flex-shrink: 0;
  }

  .agent-panel__header-title {
    flex: 1;
    min-width: 0;
    padding: 0 8px;
    text-align: center;
  }

  .agent-panel__header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .agent-panel__conv-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .agent-panel__conv-title--dim {
    color: var(--muted);
    font-weight: 400;
  }

  .agent-panel__conv-loading {
    font-size: 12px;
    color: var(--muted);
  }

  .agent-panel__header-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 4px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .agent-panel__header-btn:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .agent-panel__header-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .agent-panel__header-btn::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 10px;
  }

  .agent-panel__messages-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .agent-panel__fade-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 24px;
    background: linear-gradient(to bottom, var(--background), transparent);
    pointer-events: none;
    z-index: 3;
  }

  .agent-panel__fade-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(to top, var(--background), transparent);
    pointer-events: none;
    z-index: 3;
  }

  .agent-panel__messages {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--foreground) 22%, transparent) transparent;
  }

  .agent-panel__messages::-webkit-scrollbar {
    width: 4px;
  }

  .agent-panel__messages::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--foreground) 22%, transparent);
    border-radius: 2px;
  }

  .agent-panel__msg-list {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 100%;
    min-width: 0;
  }

  .agent-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    gap: 8px;
  }

  .agent-panel__empty-icon {
    color: color-mix(in srgb, var(--foreground) 22%, transparent);
  }

  .agent-panel__empty-text {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  /* ── Loading skeleton ──────────────────────────────────────────── */
  .agent-panel__loading-skeleton {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    animation: panel-skeleton-fade 0.8s ease-in-out infinite alternate;
  }

  @keyframes panel-skeleton-fade {
    from { opacity: 0.4; }
    to { opacity: 0.8; }
  }

  .agent-panel__skeleton-row {
    display: flex;
  }

  .agent-panel__skeleton-row--user {
    justify-content: flex-end;
  }

  .agent-panel__skeleton-row--assistant {
    justify-content: flex-start;
  }

  .agent-panel__skeleton-bubble {
    height: 32px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
  }

  .agent-panel__skeleton-bubble--user {
    width: 60%;
    border-bottom-right-radius: 4px;
  }

  .agent-panel__skeleton-bubble--assistant {
    width: 45%;
    border-bottom-left-radius: 4px;
  }

  /* ── Chat messages ─────────────────────────────────────────────── */
  .agent-panel__msg--streaming {
    border-left: 2px solid color-mix(in srgb, var(--foreground) 50%, transparent);
  }

  .agent-panel :global([data-role="assistant"] .streaming-markdown) {
    color: color-mix(in srgb, CanvasText 75%, Canvas);
    font-size: 0.97rem;
    line-height: 1.55;
    text-wrap: pretty;
  }

  .agent-panel__msg--error {
    --agent-error: var(--destructive, oklch(0.637 0.208 25.331));
    align-self: center;
    background: color-mix(in srgb, var(--agent-error) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--agent-error) 25%, transparent);
    color: var(--agent-error);
    max-width: 100%;
  }

  .agent-panel__msg-text {
    margin: 0;
    white-space: pre-wrap;
  }

  .agent-panel__msg-retry {
    --agent-error: var(--destructive, oklch(0.637 0.208 25.331));
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--agent-error) 35%, transparent);
    background: color-mix(in srgb, var(--agent-error) 12%, transparent);
    color: var(--agent-error);
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    vertical-align: middle;
  }

  .agent-panel__msg-retry:hover {
    background: color-mix(in srgb, var(--agent-error) 25%, transparent);
  }

  .agent-panel__msg-retry:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--agent-error) 50%, transparent);
    outline-offset: 2px;
  }

  /* ── Message footer (timestamp + actions) ────────────────────────── */
  :global(.agent-panel .group) {
    overflow: visible;
  }

  .agent-panel__msg-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 0;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

:global(.group):hover .agent-panel__msg-footer,
.agent-panel__msg-footer--always {
  opacity: 1;
}

  .agent-panel__msg-footer--hidden {
    opacity: 0 !important;
    pointer-events: none;
  }

  .agent-panel__msg-time {
    font-size: 11px;
    color: color-mix(in srgb, var(--muted) 65%, transparent);
    user-select: none;
    white-space: nowrap;
  }

  .agent-panel__msg-action-group {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-left: auto;
  }

  .agent-panel__action-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--muted) 75%, transparent);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .agent-panel__action-btn:hover {
    color: var(--muted);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .agent-panel__action-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  .agent-panel__action-btn::after {
    content: "";
    position: absolute;
    inset: -3px;
    border-radius: 8px;
  }

  /* ── More menu ──────────────────────────────────────────────────── */
  .agent-panel__more-wrap {
    position: relative;
  }

  .agent-panel__more-dropdown {
    position: absolute;
    right: 0;
    bottom: 100%;
    margin-bottom: 4px;
    min-width: 170px;
    padding: 4px;
    border-radius: 8px;
    border: 0.5px solid color-mix(in srgb, var(--foreground) 12%, transparent);
    background: var(--background);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
    z-index: 10;
    animation: menu-in 0.12s ease both;
    transform-origin: bottom right;
  }

  @keyframes menu-in {
    from { opacity: 0; transform: scale(0.95) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .agent-panel__more-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
    white-space: nowrap;
  }

  .agent-panel__more-item:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }

  .agent-panel__more-item:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }

  .agent-panel__more-item svg {
    flex-shrink: 0;
  }

  /* ── Edit composer ──────────────────────────────────────────────── */
  .agent-panel__edit-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .agent-panel__edit-input {
    width: 100%;
    min-height: 80px;
    max-height: 200px;
    padding: 10px 12px;
    border: 0.5px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 12px;
    background: color-mix(in oklch, var(--background) 94%, oklch(0 0 0));
    color: var(--foreground);
    font-size: 13px;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    outline: none;
  }

  .agent-panel__edit-input:focus {
    border-color: color-mix(in srgb, var(--ring) 50%, transparent);
  }

  .agent-panel__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .agent-panel__edit-cancel {
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s ease;
  }

  .agent-panel__edit-cancel:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .agent-panel__edit-cancel:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  .agent-panel__edit-save {
    padding: 4px 14px;
    border: none;
    border-radius: 6px;
    background: var(--foreground);
    color: var(--background);
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .agent-panel__edit-save:hover {
    opacity: 0.85;
  }

  .agent-panel__edit-save:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .agent-panel__edit-save:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 1px;
  }

  .agent-panel__attach-error {
    padding: 6px 16px;
    font-size: 12px;
    color: var(--destructive, oklch(0.637 0.208 25.331));
    background: color-mix(in srgb, var(--destructive, oklch(0.637 0.208 25.331)) 10%, transparent);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-panel__input-wrap {
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    padding: 0 12px 12px;
  }

  .agent-panel__input-shell {
    padding: 4px;
    background: color-mix(in oklch, var(--background) 88%, oklch(0 0 0));
    border-radius: 24px;
  }

  .agent-panel__input-field {
    background: color-mix(in oklch, var(--background) 94%, oklch(0 0 0));
    border: 0.5px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 20px;
    padding: 12px 16px 6px;
    transition: border-radius 0.3s ease;
  }

  .agent-panel__input-field:has(.attach-clip) {
    border-radius: 20px 20px 12px 12px;
  }

  .agent-panel__textarea {
    width: 100%;
    resize: none;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--foreground);
    caret-color: var(--foreground);
    min-height: 36px;
    max-height: 200px;
    font-family: inherit;
    line-height: 1.5;
    overflow-y: auto;
    scrollbar-width: thin;
  }



  .agent-panel__textarea::placeholder {
    color: var(--muted);
  }

  .agent-panel__input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 10px;
  }

  .agent-panel__input-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .agent-panel__tool-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  }

  .agent-panel__tool-btn:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .agent-panel__tool-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .agent-panel__tool-btn:active {
    transform: scale(0.96);
  }

  .agent-panel__tool-btn::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 10px;
  }

  .agent-panel__tool-btn:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .agent-panel__tool-btn--busy {
    animation: panel-tool-pulse 1s ease-in-out infinite;
  }

  @keyframes panel-tool-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.3; }
  }



  .agent-panel__send-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 12%, var(--background));
    color: color-mix(in srgb, var(--foreground) 35%, var(--background));
    cursor: default;
    transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }

  .agent-panel__send-btn::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 10px;
  }

  .agent-panel__send-btn:not(:disabled) {
    background: var(--foreground);
    color: var(--background);
    cursor: pointer;
  }

  .agent-panel__send-btn:not(:disabled):hover {
    background: color-mix(in srgb, var(--foreground) 85%, var(--background));
  }

  .agent-panel__send-btn:not(:disabled):active {
    transform: scale(0.96);
  }

  .agent-panel__stop-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: oklch(0.637 0.208 25.331);
    color: white;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .agent-panel__stop-btn::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 10px;
  }

  .agent-panel__stop-btn:hover {
    background: oklch(0.711 0.166 22.216);
  }

  .agent-panel__stop-btn:active {
    transform: scale(0.96);
  }

  /* ── Resize handle (Anytype-style) ──────────────────────── */
  .agent-panel__resize {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 12px;
    z-index: 71;
    cursor: col-resize;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
    touch-action: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel__resize {
      transition: none;
    }
  }

  .agent-panel__resize.agent-panel--open {
    opacity: 1;
    pointer-events: auto;
  }

  .agent-panel__resize:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
    opacity: 1;
    pointer-events: auto;
  }

  .agent-panel__resize-bar {
    position: absolute;
    left: 0;
    top: 50%;
    margin-top: -16px;
    width: 100%;
    height: 32px;
    transition: height 0.15s ease, margin-top 0.15s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel__resize-bar {
      transition: none;
    }
  }

  .agent-panel__resize-bar::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    width: 6px;
    height: 100%;
    border-radius: 3px;
    background: color-mix(in srgb, var(--foreground) 18%, transparent);
    margin-left: -3px;
    transition: background 0.15s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel__resize-bar::after {
      transition: none;
    }
  }

  .agent-panel__resize:hover .agent-panel__resize-bar::after {
    background: color-mix(in srgb, var(--foreground) 30%, transparent);
  }

  .agent-panel__resize--active .agent-panel__resize-bar {
    height: 64px;
    margin-top: -32px;
  }

  .agent-panel__resize--active .agent-panel__resize-bar::after {
    background: color-mix(in srgb, var(--foreground) 40%, transparent);
  }

  /* ── Auth Bar ───────────────────────────────────────── */
  .agent-panel__auth-bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    font-size: 0.75rem;
  }
  .agent-panel__auth-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    color: var(--muted);
  }
  .agent-panel__auth-label {
    color: var(--muted);
    font-weight: 600;
  }
  .agent-panel__auth-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    background: oklch(0.696 0.149 162.48);
    flex-shrink: 0;
  }
  .agent-panel__auth-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: none;
    background: none;
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.4rem 0.6rem;
    min-height: 28px;
    border-radius: 6px;
    transition: background 0.12s ease;
  }
  .agent-panel__auth-btn:hover {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }
  .agent-panel__auth-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .agent-panel__setup-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    margin: 0 14px 6px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary) 15%, transparent);
    animation: agent-panel__setup-in 0.3s ease both;
  }
  @keyframes agent-panel__setup-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .agent-panel__setup-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    color: var(--primary);
    opacity: 0.7;
  }
  .agent-panel__setup-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .agent-panel__setup-text {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--foreground);
    opacity: 0.75;
  }
  .agent-panel__setup-btn {
    align-self: flex-start;
    font-size: 12px;
    padding: 5px 12px;
    border-radius: 6px;
    border: none;
    background: var(--primary);
    color: var(--primary-foreground);
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.15s ease;
  }
  .agent-panel__setup-btn:hover {
    opacity: 0.85;
  }
  .agent-panel__setup-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
</style>
