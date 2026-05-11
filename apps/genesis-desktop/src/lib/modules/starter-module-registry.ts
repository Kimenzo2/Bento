import type { Component } from "svelte";
import { starterModuleIds, type StarterModuleId } from "$lib/data/module-catalog";

type StarterModule = {
  default: Component<any>;
};

export const starterModuleLoaders = {
  journal: () => import("../../modules/journal/App.svelte"),
  tasks: () => import("../../modules/tasks/App.svelte"),
  habits: () => import("../../modules/habits/App.svelte"),
  focus: () => import("../../modules/focus/App.svelte"),
  passwords: () => import("../../modules/passwords/App.svelte"),
  health: () => import("../../modules/health/App.svelte"),
  sleep: () => import("../../modules/sleep/App.svelte"),
  nutrition: () => import("../../modules/nutrition/App.svelte"),
  mood: () => import("../../modules/mood/App.svelte"),
  budget: () => import("../../modules/budget/App.svelte"),
  flashcards: () => import("../../modules/flashcards/App.svelte"),
  reading: () => import("../../modules/reading/App.svelte"),
  grocery: () => import("../../modules/grocery/App.svelte"),
  recipes: () => import("../../modules/recipes/App.svelte"),
  time: () => import("../../modules/time/App.svelte"),
  goals: () => import("../../modules/goals/App.svelte"),
  clipboard: () => import("../../modules/clipboard/App.svelte"),
  breathing: () => import("../../modules/breathing/App.svelte"),
  "voice-memos": () => import("../../modules/voice-memos/App.svelte"),
  countdown: () => import("../../modules/countdown/App.svelte"),
  telemetry: () => import("../../modules/telemetry/App.svelte"),
} satisfies Record<StarterModuleId, () => Promise<StarterModule>>;

const starterModuleIdSet = new Set<string>(starterModuleIds);
const starterModuleCache = new Map<StarterModuleId, Promise<StarterModule>>();

export function isStarterModuleId(value: string): value is StarterModuleId {
  return starterModuleIdSet.has(value);
}

export function loadStarterModule(appId: StarterModuleId): Promise<StarterModule> {
  const cached = starterModuleCache.get(appId);
  if (cached) {
    return cached;
  }

  const modulePromise = starterModuleLoaders[appId]();
  starterModuleCache.set(appId, modulePromise);
  return modulePromise;
}
