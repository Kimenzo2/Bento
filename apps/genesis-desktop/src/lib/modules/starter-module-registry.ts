import type { Component } from "svelte";
import { starterModuleIds, type StarterModuleId } from "$lib/data/module-catalog";

type StarterModule = {
  default: Component<any>;
};

export const starterModuleLoaders = {
  journal: () => import("../../modules/journal/App.svelte") as Promise<StarterModule>,
  tasks: () => import("../../modules/tasks/App.svelte") as Promise<StarterModule>,
  habits: () => import("../../modules/habits/App.svelte") as Promise<StarterModule>,
  focus: () => import("../../modules/focus/App.svelte") as Promise<StarterModule>,
  passwords: () => import("../../modules/passwords/App.svelte") as Promise<StarterModule>,
  health: () => import("../../modules/health/App.svelte") as Promise<StarterModule>,
  sleep: () => import("../../modules/sleep/App.svelte") as Promise<StarterModule>,
  nutrition: () => import("../../modules/nutrition/App.svelte") as Promise<StarterModule>,
  mood: () => import("../../modules/mood/App.svelte") as Promise<StarterModule>,
  budget: () => import("../../modules/budget/App.svelte") as Promise<StarterModule>,
  flashcards: () => import("../../modules/flashcards/App.svelte") as Promise<StarterModule>,
  reading: () => import("../../modules/reading/App.svelte") as Promise<StarterModule>,
  grocery: () => import("../../modules/grocery/App.svelte") as Promise<StarterModule>,
  recipes: () => import("../../modules/recipes/App.svelte") as Promise<StarterModule>,
  time: () => import("../../modules/time/App.svelte") as Promise<StarterModule>,
  goals: () => import("../../modules/goals/App.svelte") as Promise<StarterModule>,
  clipboard: () => import("../../modules/clipboard/App.svelte") as Promise<StarterModule>,
  breathing: () => import("../../modules/breathing/App.svelte") as Promise<StarterModule>,
  "voice-memos": () => import("../../modules/voice-memos/App.svelte") as Promise<StarterModule>,
  countdown: () => import("../../modules/countdown/App.svelte") as Promise<StarterModule>,
  telemetry: () => import("../../modules/telemetry/App.svelte") as Promise<StarterModule>,
};

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
