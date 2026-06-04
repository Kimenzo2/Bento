/**
 * Journal Font Store — isolated, lightweight font preference for the Journal module.
 * Uses localStorage for persistence (no Rust backend serialization needed).
 * Swapping CSS custom properties on document root ensures zero-layout-thrash switching.
 */
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { defaultJournalFontVariationId, getJournalFontBody, getJournalFontHeading } from '$lib/data/preferences';

const STORAGE_KEY = 'bento_journal_font_variation';

function loadInitialValue(): string {
  if (!browser) return defaultJournalFontVariationId;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch { /* ignore */ }
  return defaultJournalFontVariationId;
}

export const journalFontVariationId = writable<string>(loadInitialValue());

/** Subscribe to changes and persist + apply CSS custom properties. */
export function applyJournalFont(variationId: string): void {
  if (!browser) return;
  try { localStorage.setItem(STORAGE_KEY, variationId); } catch { /* ignore */ }
  const body = getJournalFontBody(variationId);
  const heading = getJournalFontHeading(variationId);
  document.documentElement.style.setProperty('--je-body-font', body);
  document.documentElement.style.setProperty('--je-heading-font', heading);
  journalFontVariationId.set(variationId);
}

/** Initialize journal font on app boot. */
export function initJournalFont(): void {
  if (!browser) return;
  const current = loadInitialValue();
  applyJournalFont(current);
}
