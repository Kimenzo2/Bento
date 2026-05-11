import { derived } from "svelte/store";
import { languages, type DesktopLanguage } from "$lib/data/preferences";
import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

export { languages };
export type { DesktopLanguage };

export const languageStore = derived(desktopSettings, ($settings) => {
  return languages.find((entry) => entry.code === $settings.language.code) ?? languages[0];
});

export function setLanguage(code: DesktopLanguage["code"]) {
  void updateDesktopSettings((current) => ({
    ...current,
    language: {
      code: languages.find((entry) => entry.code === code)?.code ?? languages[0].code,
    },
  }));
}
