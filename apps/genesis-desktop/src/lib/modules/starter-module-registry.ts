import type { Component } from 'svelte';
import { starterModuleIds, type StarterModuleId } from '$lib/data/module-catalog';

type StarterModule = {
  default: Component<any>;
};

export const starterModuleLoaders = {
  journal: () => import('../../modules/journal/App.svelte') as unknown as Promise<StarterModule>,
  tasks: () => import('../../modules/tasks/App.svelte') as unknown as Promise<StarterModule>,
  habits: () => import('../../modules/habits/App.svelte') as unknown as Promise<StarterModule>,
  focus: () => import('../../modules/focus/App.svelte') as unknown as Promise<StarterModule>,
  passwords: () =>
    import('../../modules/passwords/App.svelte') as unknown as Promise<StarterModule>,
  health: () => import('../../modules/health/App.svelte') as unknown as Promise<StarterModule>,
  sleep: () => import('../../modules/sleep/App.svelte') as unknown as Promise<StarterModule>,
  nutrition: () =>
    import('../../modules/nutrition/App.svelte') as unknown as Promise<StarterModule>,
  mood: () => import('../../modules/mood/App.svelte') as unknown as Promise<StarterModule>,
  budget: () => import('../../modules/budget/App.svelte') as unknown as Promise<StarterModule>,
  flashcards: () =>
    import('../../modules/flashcards/App.svelte') as unknown as Promise<StarterModule>,
  grocery: () => import('../../modules/grocery/App.svelte') as unknown as Promise<StarterModule>,
  recipes: () => import('../../modules/recipes/App.svelte') as unknown as Promise<StarterModule>,
  time: () => import('../../modules/time/App.svelte') as unknown as Promise<StarterModule>,
  goals: () => import('../../modules/goals/App.svelte') as unknown as Promise<StarterModule>,
  clipboard: () =>
    import('../../modules/clipboard/App.svelte') as unknown as Promise<StarterModule>,
  breathing: () =>
    import('../../modules/breathing/App.svelte') as unknown as Promise<StarterModule>,
  'voice-memos': () =>
    import('../../modules/voice-memos/App.svelte') as unknown as Promise<StarterModule>,
  countdown: () =>
    import('../../modules/countdown/App.svelte') as unknown as Promise<StarterModule>,
  telemetry: () =>
    import('../../modules/telemetry/App.svelte') as unknown as Promise<StarterModule>,
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
