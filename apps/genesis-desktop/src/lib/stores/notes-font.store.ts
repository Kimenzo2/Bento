/**
 * Notes Font Store — isolated, lightweight font preference for the Notes module.
 * Uses localStorage for persistence (no Rust backend serialization needed).
 * Swapping CSS custom properties on document root ensures zero-layout-thrash switching.
 */
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
  defaultJournalFontVariationId,
  getJournalFontBody,
  getJournalFontHeading,
} from '$lib/data/preferences';

const STORAGE_KEY = 'bento_notes_font_variation';

function loadInitialValue(): string {
  if (!browser) return defaultJournalFontVariationId;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return defaultJournalFontVariationId;
}

export const notesFontVariationId = writable<string>(loadInitialValue());

/** Subscribe to changes and persist + apply CSS custom properties. */
export function applyNotesFont(variationId: string): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, variationId);
  } catch {
    /* ignore */
  }
  const body = getJournalFontBody(variationId);
  const heading = getJournalFontHeading(variationId);
  document.documentElement.style.setProperty('--notes-body-font', body);
  document.documentElement.style.setProperty('--notes-heading-font', heading);
  notesFontVariationId.set(variationId);
}

/** Initialize notes font on app boot. */
export function initNotesFont(): void {
  if (!browser) return;
  const current = loadInitialValue();
  applyNotesFont(current);
}
