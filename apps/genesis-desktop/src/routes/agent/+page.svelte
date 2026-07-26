<svelte:head>
  <style>
    :root {
      interpolate-size: allow-keywords;
    }
    html, body {
      background: transparent !important;
      background-color: transparent !important;
      overflow: hidden;
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</svelte:head>

<script lang="ts">
  import { invoke, trackEvent } from "$lib/ipc";
  import XIcon from "@lucide/svelte/icons/x";
  import AgentDock from "$lib/components/agent/AgentDock.svelte";

  function handleMessageSubmit(_message: string, _context?: { screenCapture?: string; transcript?: string }) {
    trackEvent("agent", "focus_main");
    invoke("focus_main_from_agent");
  }

  async function hideWindow() {
    trackEvent("agent", "hide_window");
    try { await invoke("hide_agent"); } catch {}
  }

  function handleComposerStateChange(open: boolean) {
    trackEvent("agent", open ? "composer_open" : "composer_closed");
    // Resize is handled by the ResizeObserver in AgentDock → agent_set_size.
  }

  let dragActive = $state(false);

  async function handleDragStart(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("textarea") || target.closest("input")) return;
    dragActive = true;
    trackEvent("agent", "drag_start");
    try { await invoke("agent_start_drag"); } catch {}
    dragActive = false;
  }
</script>

  <div
    class="agent-root"
    class:agent-root--dragging={dragActive}
    role="presentation"
    onmousedown={handleDragStart}
  >
  <button
    class="agent-close"
    onclick={hideWindow}
    aria-label="Close agent window"
  >
    <XIcon size={14} />
  </button>

  <AgentDock
    avatarSrc="/assets/characters/demo-agent-avatar.jpeg"
    onMessageSubmit={handleMessageSubmit}
    onComposerStateChange={handleComposerStateChange}
    isAgentWindow={true}
    onEscapeWhenIdle={hideWindow}
  />
</div>

<style>
  .agent-root {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-end;
    background: transparent;
    user-select: none;
    -webkit-user-select: none;
    animation: agent-fade-in 0.2s ease both;
    padding: 4px;
    box-sizing: border-box;
    cursor: grab;
  }

  @keyframes agent-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-root { animation: none; }
  }

  .agent-root--dragging {
    cursor: grabbing;
  }

  .agent-close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: oklch(1 0 89.876 / 0.08);
    color: oklch(0.556 0 89.876);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    z-index: 10;
  }

  .agent-close:hover {
    background: oklch(1 0 89.876 / 0.15);
    color: oklch(1 0 89.876);
  }

  .agent-close:focus-visible {
    outline: 2px solid oklch(1 0 89.876 / 0.4);
    outline-offset: 2px;
  }
</style>
