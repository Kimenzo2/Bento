import { writable } from "svelte/store";

export type CrashPayload = {
  message: string;
  logPath: string;
  timestamp: string;
};

export const crashStore = writable<CrashPayload | null>(null);

export function showCrash(payload: CrashPayload) {
  crashStore.set(payload);
}

export function clearCrash() {
  crashStore.set(null);
}
