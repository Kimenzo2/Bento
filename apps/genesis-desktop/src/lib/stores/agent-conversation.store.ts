/**
 * Agent conversation ID store.
 *
 * Persists the current conversation ID to localStorage so it survives
 * module switches and app restarts. On next load, the AgentPanel can
 * re-hydrate messages from SQLite via the `conversations.get()` API.
 */

import { writable } from "svelte/store";

const STORAGE_KEY = "bento-agent-conversation-id";

function loadId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveId(id: string | null) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable — non-Tauri environments
  }
}

/** The current conversation ID. Null means "no conversation loaded yet". */
export const currentConversationId = writable<string | null>(loadId());

// Persist to localStorage whenever the ID changes
currentConversationId.subscribe((id) => saveId(id));

/** Set a new conversation ID and persist it. */
export function setConversationId(id: string | null) {
  currentConversationId.set(id);
}

/** Clear the conversation ID (e.g. when user starts a new chat). */
export function clearConversationId() {
  currentConversationId.set(null);
}
