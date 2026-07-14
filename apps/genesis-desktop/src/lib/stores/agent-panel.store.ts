import { writable } from "svelte/store";

const PANEL_MIN = 280;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 420;
const STORAGE_KEY = "bento-agent-panel-width";

function loadWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const w = Number(stored);
      if (!isNaN(w)) return Math.max(PANEL_MIN, Math.min(PANEL_MAX, w));
    }
  } catch (e) {
    console.warn("[agent-panel] Failed to read stored width:", e);
  }
  return PANEL_DEFAULT;
}

export const agentPanelOpen = writable(false);
export const agentPanelWidth = writable(loadWidth());

export function toggleAgentPanel() {
  agentPanelOpen.update((v) => !v);
}

export function openAgentPanel() {
  agentPanelOpen.set(true);
}

export function closeAgentPanel() {
  agentPanelOpen.set(false);
}

export function setAgentPanelWidth(w: number) {
  const clamped = Math.max(PANEL_MIN, Math.min(PANEL_MAX, w));
  agentPanelWidth.set(clamped);
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch (e) {
    console.warn("[agent-panel] Failed to persist width:", e);
  }
}

export function resetAgentPanelWidth() {
  agentPanelWidth.set(PANEL_DEFAULT);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[agent-panel] Failed to clear stored width:", e);
  }
}
