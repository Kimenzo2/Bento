export type FontPairing = {
  id: string;
  name: string;
  heading: string;
  body: string;
};

export type DesktopLanguage = {
  code: "en" | "ar";
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
    id: "playful-classic",
    name: "Playful Classic",
    heading: "Fredoka",
    body: "Manrope",
  },
  {
    id: "editorial-focus",
    name: "Editorial Focus",
    heading: "Manrope",
    body: "Manrope",
  },
  {
    id: "bilingual-modern",
    name: "Bilingual Modern",
    heading: "Manrope",
    body: "Noto Sans Arabic Variable",
  },
];

export const languages: DesktopLanguage[] = [
  { code: "en", label: "English", direction: "ltr" },
  { code: "ar", label: "Arabic", direction: "rtl" },
];

export const reopenShortcutOptions: ReopenShortcutOption[] = [
  {
    id: "ctrl-shift-g",
    label: "Ctrl + Shift + G",
    description: "Fast reopen shortcut for the Genesis shell.",
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

export const defaultFontPairingId = fontPairings[0]?.id ?? "playful-classic";
export const defaultLanguageCode = languages[0]?.code ?? "en";
export const defaultReopenShortcutId = reopenShortcutOptions[0]?.id ?? "ctrl-shift-g";
