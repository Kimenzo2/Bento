import { getThemeTokensFor, resolveThemeById } from "$lib/data/themes";

const storedTheme = localStorage.getItem("genesis_desktop_theme") || "default";
const storedMode = localStorage.getItem("genesis_desktop_mode");
const mode =
  storedMode === "light" || storedMode === "dark"
    ? storedMode
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

const root = document.documentElement;
root.dataset.theme = storedTheme;
root.classList.toggle("dark", mode === "dark");
root.style.colorScheme = mode;

const theme = resolveThemeById(storedTheme);
const tokens = getThemeTokensFor(theme.id, mode);

for (const [key, value] of Object.entries(tokens)) {
  root.style.setProperty(key, value);
}
