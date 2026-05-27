/**
 * Bento Language Store
 *
 * Bridges desktopSettings → i18n engine.
 * On language change: updates settings persistence + loads locale bundle + flips HTML dir.
 */

import { derived } from 'svelte/store';
import { languages, type DesktopLanguage } from '$lib/data/preferences';
import { desktopSettings, updateDesktopSettings } from '$lib/desktop/settings';
import { applyLanguage, INTERFACE_LANGUAGES } from '$lib/i18n';

export { languages };
export type { DesktopLanguage };

/** Reactive: current language metadata derived from persisted settings */
export const languageStore = derived(desktopSettings, ($settings) => {
  return (
    INTERFACE_LANGUAGES.find((l) => l.code === $settings.language.code) ?? INTERFACE_LANGUAGES[0]
  );
});

/**
 * Set a new interface language.
 * 1. Persists to settings (Tauri store / Rust backend)
 * 2. Loads locale bundle
 * 3. Applies HTML dir attribute for RTL support
 */
export async function setLanguage(code: DesktopLanguage['code']): Promise<void> {
  const lang = INTERFACE_LANGUAGES.find((l) => l.code === code) ?? INTERFACE_LANGUAGES[0];

  // Persist to settings first
  await updateDesktopSettings((current) => ({
    ...current,
    language: { ...current.language, code: lang.code },
  }));

  // Then apply locale bundle + DOM direction
  await applyLanguage(lang.code);
}

/**
 * Bootstrap: apply the persisted language on app startup.
 * Call this from +layout.svelte or the settings hydration path.
 */
export async function hydrateLanguage(code: string): Promise<void> {
  await applyLanguage(code);
}
