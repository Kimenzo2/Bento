import { derived } from "svelte/store";
import { desktopThemes, defaultThemeId, type ThemeId, type ThemeMode, type ThemeTokens } from "$lib/data/themes";
import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

export type ThemeState = {
  themeId: ThemeId;
  mode: ThemeMode;
};

export const themeState = derived(desktopSettings, ($settings): ThemeState => {
  const themeId = desktopThemes.find((theme) => theme.id === $settings.appearance.themeId)?.id ?? defaultThemeId;
  return {
    themeId,
    mode: $settings.appearance.mode,
  };
});

export const activeTheme = derived(themeState, ($themeState) => {
  return desktopThemes.find((theme) => theme.id === $themeState.themeId) ?? desktopThemes[0];
});

export const mode = derived(themeState, ($themeState) => $themeState.mode);
export const isDark = derived(mode, ($mode) => $mode === "dark");
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
  return updateDesktopSettings((current) => ({
    ...current,
    appearance: {
      ...current.appearance,
      mode: current.appearance.mode === "dark" ? "light" : "dark",
    },
  }));
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

export function getThemeTokens(state = { themeId: defaultThemeId, mode: "light" as ThemeMode }): ThemeTokens {
  const theme = desktopThemes.find((entry) => entry.id === state.themeId) ?? desktopThemes[0];
  return theme.modes[state.mode];
}
