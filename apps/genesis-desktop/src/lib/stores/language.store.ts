import { writable } from "svelte/store";

export type DesktopLanguage = {
  code: "en" | "ar";
  label: string;
  direction: "ltr" | "rtl";
};

const LANGUAGE_KEY = "genesis_desktop_language";

export const languages: DesktopLanguage[] = [
  { code: "en", label: "English", direction: "ltr" },
  { code: "ar", label: "Arabic", direction: "rtl" },
];

const initialLanguage =
  typeof window !== "undefined"
    ? languages.find((entry) => entry.code === window.localStorage.getItem(LANGUAGE_KEY)) ?? languages[0]
    : languages[0];

export const languageStore = writable(initialLanguage);

languageStore.subscribe((value) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LANGUAGE_KEY, value.code);
});

export function setLanguage(code: DesktopLanguage["code"]) {
  const nextLanguage = languages.find((entry) => entry.code === code);
  if (nextLanguage) {
    languageStore.set(nextLanguage);
  }
}
