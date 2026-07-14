<script lang="ts">
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
  import { desktopSettings } from "$lib/desktop/settings";

  let message = $state("");
  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  let tabsEnabled = $derived($desktopSettings.workspace.tabsEnabled);
  let panelTop = $derived(tabsEnabled ? 75 : 39);

  const PANEL_MIN = 280;
  const PANEL_MAX = 560;
  const PANEL_STEP = 20;

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
        closeAgentPanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Resize drag logic ───────────────────────────────────────────
  let startX = 0;
  let startW = 0;
  let rafId = 0;
  let resizeActive = false;

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

  // ── Cleanup on unmount ──────────────────────────────────────────
  $effect(() => {
    return () => {
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeEnd);
      document.body.classList.remove("col-resize");
      if (rafId) cancelAnimationFrame(rafId);
    };
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!message.trim()) return;
    message = "";
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
      <button
        type="button"
        class="agent-panel__header-btn"
        onclick={closeAgentPanel}
        aria-label="Collapse chat panel"
      >
        <PanelLeftCloseIcon size={16} />
      </button>
    </div>

    <div class="agent-panel__messages-wrap">
      <div class="agent-panel__fade-top"></div>
      <div class="agent-panel__messages">
        <div class="agent-panel__msg-list">
          <div class="agent-panel__empty">
            <SparklesIcon size={20} class="agent-panel__empty-icon" />
            <p class="agent-panel__empty-text">Start a conversation</p>
          </div>
        </div>
      </div>
      <div class="agent-panel__fade-bottom"></div>
    </div>

    <div class="agent-panel__input-wrap">
      <form onsubmit={handleSubmit}>
        <div class="agent-panel__input-shell">
          <div class="agent-panel__input-field">
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
                aria-label="Attach files"
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
            </div>
            <button
              type="submit"
              class="agent-panel__send-btn"
              aria-label="Send message"
              disabled={!message.trim()}
            >
              <ArrowUpIcon size={16} />
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</div>

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
    will-change: transform;
    contain: layout style;
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
  }

  .agent-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    flex-shrink: 0;
  }

  .agent-panel__header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 6px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .agent-panel__header-btn:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
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

  .agent-panel__input-wrap {
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    padding: 12px;
  }

  .agent-panel__input-shell {
    padding: 4px;
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    border-radius: 24px;
  }

  .agent-panel__input-field {
    background: color-mix(in srgb, var(--foreground) 2%, var(--background));
    border: 0.5px solid var(--border);
    border-radius: 20px;
    padding: 12px 16px 6px;
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
    padding: 0 8px 10px;
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
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .agent-panel__tool-btn:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .agent-panel__mode-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 2%, var(--background));
    color: var(--foreground);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .agent-panel__mode-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .agent-panel__send-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 14%, var(--background));
    color: color-mix(in srgb, var(--foreground) 40%, var(--background));
    cursor: default;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .agent-panel__send-btn:not(:disabled) {
    background: var(--foreground);
    color: var(--background);
    cursor: pointer;
  }

  .agent-panel__send-btn:not(:disabled):hover {
    background: color-mix(in srgb, var(--foreground) 85%, var(--background));
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
</style>
