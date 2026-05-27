/**
 * Bento Desktop Preferences
 *
 * Language list is sourced from the i18n engine (ported from Anytype-ts src/json/lang.ts).
 * The DesktopLanguage type is kept for settings.ts / Rust backend compatibility.
 * New code should import INTERFACE_LANGUAGES from $lib/i18n instead.
 */

import { INTERFACE_LANGUAGES, type LanguageCode } from '$lib/i18n';

export type FontPairing = {
  id: string;
  name: string;
  heading: string;
  body: string;
};

/**
 * DesktopLanguage — persisted shape in settings.json.
 * `code` is validated against INTERFACE_LANGUAGES.
 * `direction` is derived at runtime; not stored.
 */
export type DesktopLanguage = {
  code: LanguageCode;
  label: string;
  direction: 'ltr' | 'rtl';
};

export type ReopenShortcutId = 'ctrl-alt-g' | 'ctrl-shift-g' | 'ctrl-shift-space';

export type ReopenShortcutOption = {
  id: ReopenShortcutId;
  label: string;
  description: string;
};

export const fontPairings: FontPairing[] = [
  {
    id: 'bento-classic',
    name: 'Bento Classic',
    heading: 'Bricolage Grotesque Variable',
    body: 'General Sans',
  },
];

/**
 * Full language list — all 27 interface languages ported from Anytype-ts.
 * RTL languages (Arabic, Farsi) are correctly marked.
 */
export const languages: DesktopLanguage[] = INTERFACE_LANGUAGES.map((l) => ({
  code: l.code,
  label: l.label,
  direction: l.direction as 'ltr' | 'rtl',
}));

export const reopenShortcutOptions: ReopenShortcutOption[] = [
  {
    id: 'ctrl-shift-g',
    label: 'Ctrl + Shift + G',
    description: 'Fast reopen shortcut for the Bento shell.',
  },
  {
    id: 'ctrl-alt-g',
    label: 'Ctrl + Alt + G',
    description: 'Lower collision risk on Windows-heavy desktops.',
  },
  {
    id: 'ctrl-shift-space',
    label: 'Ctrl + Shift + Space',
    description: 'Easy to remember if you want a global palette-style shortcut.',
  },
];

export const defaultFontPairingId = fontPairings[0]?.id ?? 'bento-classic';
export const defaultLanguageCode: LanguageCode = 'en';
export const defaultReopenShortcutId = reopenShortcutOptions[0]?.id ?? 'ctrl-shift-g';
