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
  import PenIcon from "@lucide/svelte/icons/pen";
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
  import * as ChainOfThought from "$lib/components/agent/chain-of-thought/index.js";
  import * as Tool from "$lib/components/agent/tool/index.js";
  import { tooltip } from "$lib/components/Tooltip.svelte";
  import {
    currentConversationId,
    setConversationId,
    clearConversationId,
  } from "$lib/stores/agent-conversation.store";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import { goto } from "@mateothegreat/svelte5-router";
  import { chatgptSession, loadChatGptSession } from "$lib/stores/chatgpt-auth.store";

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

  // Load ChatGPT session on mount
  let chatgptLoaded = $state(false);
  $effect(() => {
    if (!chatgptLoaded) {
      chatgptLoaded = true;
      loadChatGptSession();
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

  // Load the persisted conversation when a valid ID exists.
  // Uses initialLoadDone guard to avoid re-loading from DB after every save
  // (save sets the conversation ID, which would otherwise trigger a reload).
  $effect(() => {
    const id = $currentConversationId;
    if (!id) {
      loadingConversation = false;
      return;
    }
    if (initialLoadDone) return;
    initialLoadDone = true;
    loadingConversation = true;
    conversations.get(id).then((conv) => {
      if (conv) {
        messages = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
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
      })));
      setConversationId(id);
    } catch (e) {
      console.warn("[agent-panel] Failed to save conversation:", e);
    }
  }

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
    toolCalls = [];
    uiUpdates = [];
    convTitle = "";
    loadingConversation = false;
    initialLoadDone = false;
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
  };

  let messages = $state.raw<PanelChatMessage[]>([]);
  let streamingText = $state("");
  let streamingError = $state<string | null>(null);
  let submitBusy = $state(false);
  let lastSentMessage = $state("");
  let activeStream: { cancel: () => void } | null = null;

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

  // ── Focus management ────────────────────────────────────────────
  let previousFocus = $state<HTMLElement | null>(null);

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

    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
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
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);
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
        saveConversation();
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
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeEnd);
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

    try {
      // Pass full conversation history so the AI has context from previous turns.
      // Provider and model are NOT passed — the Rust backend reads them
      // from DesktopSettings live on every request. This means switching
      // the active provider in Settings takes effect immediately on the
      // next message, without any stale frontend cache.
      const { stream, cancel } = chatStream({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
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

      if (streamingText.trim()) {
        messages = [...messages, { role: "assistant", content: streamingText }];
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
              : msg;
      streamingText = "";
    } finally {
      submitBusy = false;
      activeStream = null;
    }
  }

  // ── Retry last message ─────────────────────────────────────────
  async function retryLastMessage() {
    if (!lastSentMessage || submitBusy) return;
    const msg = lastSentMessage;
    const prevMessages = messages;
    messages = messages.slice(0, -1);
    lastSentMessage = "";
    await sendAndStream(msg);
    if (streamingError) {
      messages = prevMessages;
      lastSentMessage = msg;
    }
  }

  // ── Submit handler ─────────────────────────────────────────────
  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!message.trim() || submitBusy) return;

    const text = message.trim();
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
    messages = [...messages, { role: "user", content }];
    message = "";
    lastSentMessage = text;
    attachments = [];

    // Scroll to bottom after user message is appended
    requestAnimationFrame(() => scrollToBottom("instant"));

    await sendAndStream(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function autoResize() {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + "px";
    }
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

  function addAttachment(kind: "image" | "doc", name?: string) {
    const id = `attach-${attachCounter++}`;
    attachments = [
      ...attachments,
      { id, kind, name },
    ];
  }

  function removeAttachment(id: string) {
    attachments = attachments.filter((a) => a.id !== id);
  }

  async function onMorphItemClick(id: string) {
    agentMorph.close();
    try {
      if (id === "camera") {
        // Capture screen using Tauri
        const dataUri = await invoke<string>("capture_screen");
        attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "image", uri: dataUri, name: "Screen Capture" }];
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
            // Read file as base64 data URI
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const bytes = await readFile(file);
            const base64 = btoa(String.fromCharCode(...bytes));
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
              // Read text files as content
              const content = await readTextFile(file);
              attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "doc", uri: `data:text/plain;base64,${btoa(content)}`, name: file.split(/[/\\]/).pop() || "Document" }];
            } else {
              // Read binary files as base64
              const bytes = await readFile(file);
              const base64 = btoa(String.fromCharCode(...bytes));
              attachments = [...attachments, { id: `attach-${attachCounter++}`, kind: "doc", uri: `data:application/${ext};base64,${base64}`, name: file.split(/[/\\]/).pop() || "Document" }];
            }
          }
        }
      } else if (id === "plugins") {
        // Plugins not yet implemented
        return;
      }
    } catch (err) {
      console.warn("[agent-panel] attachment failed:", err);
    }
  }

  // ── Cleanup morph timers on unmount ──────────────────────────────
  $effect(() => {
    return () => agentMorph.destroy();
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
          aria-label="New conversation"
          title="New conversation"
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
        <svg class="agent-panel__auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        <span class="agent-panel__auth-label">ChatGPT</span>
        <span class="agent-panel__auth-dot"></span>
      {:else}
        <button
          type="button"
          class="agent-panel__auth-btn"
          onclick={() => goto("/settings")}
        >
          <svg class="agent-panel__auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
          Sign in with ChatGPT
        </button>
      {/if}
    </div>

    <div class="agent-panel__messages-wrap">
      <div class="agent-panel__fade-top"></div>
      <div class="agent-panel__messages" bind:this={scrollContainerRef} onscroll={handleScroll}>
        <div class="agent-panel__msg-list" role="log" aria-live="polite" aria-label="Conversation">
          {#if messages.length === 0 && !streamingText && !streamingError}
            <div class="agent-panel__empty">
              <SparklesIcon size={20} class="agent-panel__empty-icon" />
              <p class="agent-panel__empty-text">Start a conversation</p>
            </div>
          {:else}
            {#each messages as msg}
              <Message from={msg.role}>
                <MessageContent>
                  {#if msg.role === "user"}
                    {msg.content}
                  {:else}
                    <StreamingMarkdown content={msg.content} />
                  {/if}
                </MessageContent>
              </Message>
            {/each}
            {#if streamingText}
              <Message from="assistant">
                <MessageContent>
                  <StreamingMarkdown content={streamingText} />
                </MessageContent>
              </Message>
            {:else if submitBusy && !streamingText}
              <Message from="assistant">
                <MessageContent>
                  <ChainOfThought.Root defaultOpen>
                    <ChainOfThought.Header />
                    <ChainOfThought.Content>
                      <ChainOfThought.Step
                        label="Thinking..."
                        status="active"
                      />
                    </ChainOfThought.Content>
                  </ChainOfThought.Root>
                </MessageContent>
              </Message>
            {/if}
            {#if toolCalls.length > 0}
              {#each toolCalls as tc (tc.id)}
                <Tool.Root>
                  <Tool.Header type={tc.name} state={tc.state === "completed" ? "output-available" : tc.state === "error" ? "output-error" : tc.state === "running" ? "input-available" : "input-streaming"} />
                  <Tool.Content>
                    <Tool.Input input={tc.args} />
                    {#if tc.result !== undefined}
                      <Tool.Output output={tc.result} errorText={tc.isError ? String(tc.result) : undefined} />
                    {/if}
                  </Tool.Content>
                </Tool.Root>
              {/each}
            {/if}
            {#if uiUpdates.length > 0}
              <div class="flex flex-col gap-2 px-4 py-2">
                {#each uiUpdates as ui, i}
                  <GenerativeUiRenderer ui={ui} />
                {/each}
              </div>
            {/if}
            {#if streamingError}
              <div class="agent-panel__msg--error">
                <p class="agent-panel__msg-text">
                  {streamingError}
                  <button class="agent-panel__msg-retry" onclick={retryLastMessage}>Retry</button>
                </p>
              </div>
            {/if}
          {/if}
        </div>
      </div>
      <div class="agent-panel__fade-bottom"></div>
    </div>

    <AgentMorphSurface items={morphItems} onitemclick={onMorphItemClick} />

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
            <textarea
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
                onclick={agentMorph.toggleMenu}
                aria-label="Attach files"
                use:tooltip={{ text: "Attach files" }}
              >
                <PaperclipIcon size={16} />
              </button>
              <div class="agent-panel__mode-select">
                <button type="button" class="agent-panel__mode-btn" aria-label="Writing mode">
                  <PenIcon size={14} />
                  <span>Write</span>
                  <ChevronDownIcon size={12} />
                </button>
              </div>
              <div class="agent-panel__connectors">
                <button type="button" class="agent-panel__connectors-btn" aria-label="Connectors">
                  <span>Connectors</span>
                  <span class="agent-panel__connector-icons">
                    <svg class="agent-panel__connector-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                    <svg class="agent-panel__connector-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M4.098 1C3.048 1 2 2.048 2 3.098v9.804c0 1.05.948 1.998 2.098 1.998h7.804c1.05 0 1.998-.948 1.998-1.998V3.098C15.998 2.048 15.05 1 14.002 1H4.098zM3.5 3.5v9h9v-9h-9z"/></svg>
                  </span>
                </button>
              </div>
            </div>
            <button
              type="submit"
              class="agent-panel__send-btn"
              aria-label="Send message"
              disabled={!message.trim() || submitBusy}
            >
              <ArrowUpIcon size={16} />
            </button>
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
  aria-valuenow={$agentPanelWidth}
  aria-valuemin={PANEL_MIN}
  aria-valuemax={PANEL_MAX}
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
    gap: 2px;
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

  /* ── Chat messages ─────────────────────────────────────────────── */
  .agent-panel__msg {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    animation: panel-msg-in 0.15s ease both;
  }

  @keyframes panel-msg-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel__msg { animation: none; }
  }

  .agent-panel__msg--user {
    align-self: flex-end;
    background: var(--foreground);
    color: var(--background);
    border-bottom-right-radius: 4px;
  }

  .agent-panel__msg--assistant {
    align-self: flex-start;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
    border-bottom-left-radius: 4px;
  }

  .agent-panel__msg--streaming {
    border-left: 2px solid color-mix(in srgb, var(--foreground) 50%, transparent);
  }

  .agent-panel__msg--loading {
    align-self: flex-start;
    background: transparent;
    padding: 8px 12px;
  }

  .agent-panel__msg--error {
    align-self: center;
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 12%, transparent);
    border: 1px solid color-mix(in srgb, oklch(0.637 0.208 25.331) 25%, transparent);
    color: oklch(0.637 0.208 25.331);
    max-width: 100%;
  }

  .agent-panel__msg-text {
    margin: 0;
    white-space: pre-wrap;
  }

  .agent-panel__msg-dots {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .agent-panel__msg-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground) 40%, transparent);
    animation: panel-dot-bounce 1.2s ease-in-out infinite;
  }

  .agent-panel__msg-dots span:nth-child(2) { animation-delay: 0.2s; }
  .agent-panel__msg-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes panel-dot-bounce {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
    40% { transform: scale(1.1); opacity: 0.9; }
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel__msg-dots span { animation: none; opacity: 0.6; }
  }

  .agent-panel__msg-retry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, oklch(0.637 0.208 25.331) 35%, transparent);
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 12%, transparent);
    color: oklch(0.637 0.208 25.331);
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
    vertical-align: middle;
  }

  .agent-panel__msg-retry:hover {
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 25%, transparent);
  }

  .agent-panel__msg-retry:focus-visible {
    outline: 2px solid color-mix(in srgb, oklch(0.637 0.208 25.331) 50%, transparent);
    outline-offset: 2px;
  }

  .agent-panel__input-wrap {
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    padding: 0 12px 12px;
  }

  .agent-panel__input-shell {
    padding: 4px;
    background: color-mix(in srgb, var(--foreground) 10%, var(--background));
    border-radius: 24px;
  }

  .agent-panel__input-field {
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
    border: 0.5px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 20px;
    padding: 12px 16px 6px;
    transition: border-radius 0.3s ease;
  }

  .agent-panel__input-field:has(.attach-clip) {
    border-radius: 20px 20px 20px 20px;
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

  .agent-panel__tool-btn:active {
    transform: scale(0.96);
  }

  .agent-panel__mode-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
    color: var(--foreground);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }

  .agent-panel__mode-btn:hover {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .agent-panel__mode-btn:active {
    transform: scale(0.96);
  }

  .agent-panel__connectors-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  }

  .agent-panel__connectors-btn:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .agent-panel__connectors-btn:active {
    transform: scale(0.96);
  }

  .agent-panel__connector-icons {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .agent-panel__connector-icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    opacity: 0.6;
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
    outline-offset: 2px;
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
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    transition: background 0.12s ease;
  }
  .agent-panel__auth-btn:hover {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }
</style>
