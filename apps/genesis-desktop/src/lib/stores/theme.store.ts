import { browser } from "$app/environment";
import { derived, readable } from "svelte/store";
import {
  desktopThemes,
  defaultThemeId,
  resolveThemeMode,
  type ThemeId,
  type ThemeMode,
  type ThemeTokens,
} from "$lib/data/themes";
import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

export type ThemeState = {
  themeId: ThemeId;
  mode: ThemeMode;
};

export const themeState = derived(desktopSettings, ($settings): ThemeState => {
  const themeId =
    desktopThemes.find((theme) => theme.id === $settings.appearance.themeId)?.id ?? defaultThemeId;
  return {
    themeId,
    mode: $settings.appearance.mode,
  };
});

export const activeTheme = derived(themeState, ($themeState) => {
  return (
    desktopThemes.find((theme) => theme.id === $themeState.themeId) ??
    desktopThemes.find((theme) => theme.id === defaultThemeId) ??
    desktopThemes[0]
  );
});

export const mode = derived(themeState, ($themeState) => $themeState.mode);

export const systemPrefersDark = readable<boolean>(false, (set) => {
  if (!browser) return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  set(mq.matches);
  const handler = (e: MediaQueryListEvent) => set(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
});

export const effectiveMode = derived([mode, systemPrefersDark], ([$mode, $systemPrefersDark]) => {
  if ($mode !== "system") return $mode;
  return $systemPrefersDark ? "dark" : "light";
});

export const isDark = derived(effectiveMode, ($effectiveMode) => $effectiveMode === "dark");
export const activeThemeName = derived(activeTheme, ($activeTheme) => $activeTheme.name);
export const availableThemes = desktopThemes;

export function setTheme(themeId: ThemeId) {
  return updateDesktopSettings((current) => ({
    ...current,
    appearance: {
      ...current.appearance,
      themeId: desktopThemes.find((theme) => theme.id === themeId)?.id ?? defaultThemeId,
    },
  }));
}

export function toggleMode() {
  return updateDesktopSettings((current) => {
    const currentMode = current.appearance.mode;
    if (currentMode === "system") {
      const resolved = resolveThemeMode("system");
      return {
        ...current,
        appearance: {
          ...current.appearance,
          mode: resolved === "dark" ? "light" : "dark",
        },
      };
    }
    return {
      ...current,
      appearance: {
        ...current.appearance,
        mode: currentMode === "dark" ? "light" : "dark",
      },
    };
  });
}

export function setMode(nextMode: ThemeMode) {
  return updateDesktopSettings((current) => ({
    ...current,
    appearance: {
      ...current.appearance,
      mode: nextMode,
    },
  }));
}

export function getThemeTokens(
  state = { themeId: defaultThemeId, mode: "dark" as ThemeMode },
): ThemeTokens {
  const theme =
    desktopThemes.find((entry) => entry.id === state.themeId) ??
    desktopThemes.find((entry) => entry.id === defaultThemeId) ??
    desktopThemes[0];
  return theme.modes[resolveThemeMode(state.mode)];
}
