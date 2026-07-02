<svelte:head>
  <style>
    html, body, #root { background: transparent !important; overflow: hidden; }
  </style>
</svelte:head>

<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import XIcon from "@lucide/svelte/icons/x";
  import AgentDock from "$lib/components/agent/AgentDock.svelte";

  function handleMessageSubmit(_message: string, _context?: { screenCapture?: string; transcript?: string }) {
    invoke("focus_main_from_agent");
  }

  async function hideWindow() {
    try { await invoke("hide_agent"); } catch {}
  }

  function handleComposerStateChange(open: boolean) {
    invoke("agent_set_composer_open", { open }).catch(() => {});
  }

  let dragActive = $state(false);

  async function handleDragStart(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("textarea") || target.closest("input")) return;
    dragActive = true;
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
    agentName="Bento"
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
    bottom: 72px;
    right: 12px;
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: #737373;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    z-index: 10;
  }

  .agent-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .agent-close:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.4);
    outline-offset: 2px;
  }
</style>
