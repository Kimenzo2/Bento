import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { writable } from "svelte/store";

type StateEventPayload =
  | { event: "active_module"; payload: { module_id: string } }
  | { event: "user_event"; payload: { event_type: string; payload: Record<string, unknown> } }
  | { event: "view_content"; payload: { module_id: string; content: Record<string, unknown> } };

export const activeModule = writable<string | null>(null);
export const lastUserEvent = writable<{
  event_type: string;
  payload: Record<string, unknown>;
} | null>(null);
export const viewContent = writable<{
  module_id: string;
  content: Record<string, unknown>;
} | null>(null);

let unlistenState: UnlistenFn | null = null;

export async function initAgentState(): Promise<void> {
  if (unlistenState) return;

  unlistenState = await listen<StateEventPayload>("bento:state", (event) => {
    const ev = event.payload;
    switch (ev.event) {
      case "active_module":
        activeModule.set(ev.payload.module_id);
        break;
      case "user_event":
        lastUserEvent.set({
          event_type: ev.payload.event_type,
          payload: ev.payload.payload,
        });
        break;
      case "view_content":
        viewContent.set({
          module_id: ev.payload.module_id,
          content: ev.payload.content as Record<string, unknown>,
        });
        break;
    }
  });
}

export function destroyAgentState(): void {
  if (unlistenState) {
    unlistenState();
    unlistenState = null;
  }
}
