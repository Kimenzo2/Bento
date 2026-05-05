import { derived, get, writable } from "svelte/store";
import { defaultThemeId, desktopThemes, type ThemeId, type ThemeMode, type ThemeTokens } from "$lib/data/themes";

export type ThemeState = {
  themeId: ThemeId;
  mode: ThemeMode;
};

const THEME_KEY = "genesis_desktop_theme";
const MODE_KEY = "genesis_desktop_mode";

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedMode = window.localStorage.getItem(MODE_KEY);
  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): ThemeId {
  if (typeof window === "undefined") {
    return defaultThemeId;
  }

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  return (desktopThemes.find((theme) => theme.id === storedTheme)?.id ?? defaultThemeId) as ThemeId;
}

const themeState = writable<ThemeState>({
  themeId: getInitialTheme(),
  mode: getInitialMode(),
});

themeState.subscribe((value) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_KEY, value.themeId);
  window.localStorage.setItem(MODE_KEY, value.mode);
});

export const activeTheme = derived(themeState, ($themeState) => {
  return desktopThemes.find((theme) => theme.id === $themeState.themeId) ?? desktopThemes[0];
});

export const mode = derived(themeState, ($themeState) => $themeState.mode);

export const isDark = derived(mode, ($mode) => $mode === "dark");

export const activeThemeName = derived(activeTheme, ($activeTheme) => $activeTheme.name);

export const availableThemes = desktopThemes;

export function setTheme(themeId: ThemeId) {
  themeState.update((current) => ({ ...current, themeId }));
}

export function toggleMode() {
  themeState.update((current) => ({
    ...current,
    mode: current.mode === "dark" ? "light" : "dark",
  }));
}

export function setMode(nextMode: ThemeMode) {
  themeState.update((current) => ({ ...current, mode: nextMode }));
}

export function getThemeTokens(state = get(themeState)): ThemeTokens {
  const theme = desktopThemes.find((entry) => entry.id === state.themeId) ?? desktopThemes[0];
  return theme.modes[state.mode];
}

export { themeState };
