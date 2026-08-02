// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

/**
 * Bento Desktop Preferences
 *
 * Language list is sourced from the i18n engine (ported from Anytype-ts src/json/lang.ts).
 * The DesktopLanguage type is kept for settings.ts / Rust backend compatibility.
 * New code should import INTERFACE_LANGUAGES from $lib/i18n instead.
 */

import { INTERFACE_LANGUAGES, type LanguageCode } from "$lib/i18n";

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
  direction: "ltr" | "rtl";
};

export type ReopenShortcutId = "ctrl-alt-g" | "ctrl-shift-g" | "ctrl-shift-space";

export type ReopenShortcutOption = {
  id: ReopenShortcutId;
  label: string;
  description: string;
};

export const fontPairings: FontPairing[] = [
  {
    id: "bento-classic",
    name: "Bento Classic",
    heading: "Bricolage Grotesque Variable",
    body: "General Sans",
  },
  {
    id: "anytype",
    name: "Anytype",
    heading: "IBM Plex Sans",
    body: "IBM Plex Sans",
  },
  {
    id: "instrument-serif",
    name: "Instrument Serif",
    heading: "Bricolage Grotesque Variable",
    body: "Instrument Serif",
  },
];

/**
 * Full language list — all 27 interface languages ported from Anytype-ts.
 * RTL languages (Arabic, Farsi) are correctly marked.
 */
export const languages: DesktopLanguage[] = INTERFACE_LANGUAGES.map((l) => ({
  code: l.code,
  label: l.label,
  direction: l.direction as "ltr" | "rtl",
}));

export const reopenShortcutOptions: ReopenShortcutOption[] = [
  {
    id: "ctrl-shift-g",
    label: "Ctrl + Shift + G",
    description: "Fast reopen shortcut for the Bento shell.",
  },
  {
    id: "ctrl-alt-g",
    label: "Ctrl + Alt + G",
    description: "Lower collision risk on Windows-heavy desktops.",
  },
  {
    id: "ctrl-shift-space",
    label: "Ctrl + Shift + Space",
    description: "Easy to remember if you want a global palette-style shortcut.",
  },
];

/**
 * Get the body font-family string for a given font pairing ID.
 * Used by the Notes and Journal editors to dynamically switch fonts.
 */
export function getEditorFontFamily(fontPairingId: string): string {
  const pairing = fontPairings.find((p) => p.id === fontPairingId);
  if (!pairing) return "Instrument Serif, serif";

  switch (pairing.id) {
    case "anytype":
      return "'IBM Plex Sans', sans-serif";
    case "instrument-serif":
      return "'Instrument Serif', serif";
    case "bento-classic":
    default:
      return "'Instrument Serif', serif";
  }
}

/**
 * Get the font pairing name for display purposes.
 */
export function getFontPairingName(fontPairingId: string): string {
  return fontPairings.find((p) => p.id === fontPairingId)?.name ?? "Instrument Serif";
}

// ═══════════════════════════════════════════════════════════════════
// JOURNAL FONT VARIATIONS — 6 options, all with IBM Plex Sans heading
// ═══════════════════════════════════════════════════════════════════

export type JournalFontVariation = {
  id: string;
  name: string;
  heading: string;
  body: string;
  description: string;
};

export const journalFontVariations: JournalFontVariation[] = [
  {
    id: "jv-plex-plex",
    name: "Plex Sans + Plex Sans",
    heading: "'IBM Plex Sans', sans-serif",
    body: "'IBM Plex Sans', sans-serif",
    description: "IBM Plex Sans for both headings and body — clean and consistent",
  },
  {
    id: "jv-plex-inter",
    name: "Plex Sans + Inter",
    heading: "'IBM Plex Sans', sans-serif",
    body: "'Inter', sans-serif",
    description: "IBM Plex Sans headings with Inter body — modern and readable",
  },
  {
    id: "jv-plex-source",
    name: "Plex Sans + Source Sans Pro",
    heading: "'IBM Plex Sans', sans-serif",
    body: "'Source Sans Pro', sans-serif",
    description: "IBM Plex Sans headings with Source Sans Pro body — clean journal",
  },
  {
    id: "jv-plex-poppins",
    name: "Plex Sans + Poppins",
    heading: "'IBM Plex Sans', sans-serif",
    body: "'Poppins', sans-serif",
    description: "IBM Plex Sans headings with Poppins body — geometric and warm",
  },
  {
    id: "jv-plex-merriweather",
    name: "Plex Sans + Merriweather",
    heading: "'IBM Plex Sans', sans-serif",
    body: "'Merriweather', serif",
    description: "IBM Plex Sans headings with Merriweather body — editorial serif",
  },
  {
    id: "jv-plex-instrument",
    name: "Plex Sans + Instrument Serif",
    heading: "'IBM Plex Sans', sans-serif",
    body: "'Instrument Serif', serif",
    description: "IBM Plex Sans headings with Instrument Serif body — best of both",
  },
];

export const defaultJournalFontVariationId = "jv-plex-instrument";

export function getJournalFontBody(variationId: string): string {
  return (
    journalFontVariations.find((v) => v.id === variationId)?.body ?? "'Instrument Serif', serif"
  );
}

export function getJournalFontHeading(variationId: string): string {
  return (
    journalFontVariations.find((v) => v.id === variationId)?.heading ??
    "'IBM Plex Sans', sans-serif"
  );
}

export function getJournalFontVariationName(variationId: string): string {
  return journalFontVariations.find((v) => v.id === variationId)?.name ?? "Instrument Serif";
}

export const defaultFontPairingId = fontPairings[0]?.id ?? "bento-classic";
export const defaultLanguageCode: LanguageCode = "en";
export const defaultReopenShortcutId = reopenShortcutOptions[0]?.id ?? "ctrl-shift-g";
