import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getAppLaunchIdentity, type AppLaunchIconName } from '$lib/data/module-catalog';
import { time } from '$lib/utils/time';

export type AppLaunchState = {
  launchId: number;
  moduleId: string;
  appName: string;
  tagline: string;
  icon: AppLaunchIconName;
  accentColor: string;
  launchBg: string;
  startedAt: number;
  readyAt: number | null;
  errorMessage: string | null;
};

let launchIdCounter = 0;

export const appLaunch = writable<AppLaunchState | null>(null);

export function beginAppLaunch(moduleId: string) {
  if (!browser) {
    return;
  }

  const identity = getAppLaunchIdentity(moduleId);
  launchIdCounter += 1;
  appLaunch.set({
    launchId: launchIdCounter,
    moduleId,
    appName: identity.name,
    tagline: identity.tagline,
    icon: identity.icon,
    accentColor: identity.accentColor,
    launchBg: identity.launchBg,
    startedAt: time.now(),
    readyAt: null,
    errorMessage: null,
  });
}

export function signalAppLaunchReady(moduleId: string) {
  if (!browser) {
    return;
  }

  appLaunch.update((current) => {
    if (!current || current.moduleId !== moduleId || current.readyAt !== null) {
      return current;
    }

    return {
      ...current,
      readyAt: time.now(),
    };
  });
}

export function signalAppLaunchError(moduleId: string, error: unknown) {
  if (!browser) {
    return;
  }

  const message = error instanceof Error ? error.message : 'The selected app failed to launch.';
  appLaunch.update((current) => {
    if (!current || current.moduleId !== moduleId) {
      return current;
    }

    return {
      ...current,
      errorMessage: message,
      readyAt: time.now(),
    };
  });
}

export function clearAppLaunch(launchId: number) {
  appLaunch.update((current) => (current?.launchId === launchId ? null : current));
}
