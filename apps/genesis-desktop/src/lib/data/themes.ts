export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";
type ThemeModeMap = Record<ResolvedThemeMode, ThemeTokens>;

export type ThemeTokens = {
  "--background": string;
  "--surface": string;
  "--card": string;
  "--popover": string;
  "--foreground": string;
  "--muted": string;
  "--border": string;
  "--primary": string;
  "--primary-hover": string;
  "--accent": string;
  "--color-primary-start": string;
  "--color-primary-end": string;
  "--color-accent-start": string;
  "--color-accent-end": string;
  "--color-text": string;
  "--color-text-light": string;
  "--color-surface": string;
  "--color-background": string;
  "--color-border": string;
  "--color-shadow": string;
};

export type DesktopTheme = {
  id: ThemeId;
  name: string;
  description: string;
  preview: [string, string, string];
  modes: ThemeModeMap;
};

export type ThemeId = "bento" | "aurora" | "ocean" | "forest" | "nebula" | "sunset" | "midnight";

const createThemeTokens = (tokens: {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  primaryStart: string;
  primaryEnd: string;
  accentStart: string;
  accentEnd: string;
  shadow: string;
  card?: string;
  popover?: string;
  primary?: string;
  primaryHover?: string;
  accent?: string;
}): ThemeTokens => ({
  "--background": tokens.background,
  "--surface": tokens.surface,
  "--card": tokens.card ?? tokens.surface,
  "--popover": tokens.popover ?? tokens.surface,
  "--foreground": tokens.foreground,
  "--muted": tokens.muted,
  "--border": tokens.border,
  "--primary": tokens.primary ?? tokens.primaryStart,
  "--primary-hover": tokens.primaryHover ?? tokens.primaryEnd,
  "--accent": tokens.accent ?? tokens.accentStart,
  "--color-primary-start": tokens.primaryStart,
  "--color-primary-end": tokens.primaryEnd,
  "--color-accent-start": tokens.accentStart,
  "--color-accent-end": tokens.accentEnd,
  "--color-text": tokens.foreground,
  "--color-text-light": tokens.muted,
  "--color-surface": tokens.surface,
  "--color-background": tokens.background,
  "--color-border": tokens.border,
  "--color-shadow": tokens.shadow,
});

export const desktopThemes: DesktopTheme[] = [
  {
    id: "bento",
    name: "Bento Classic",
    description: "Original warm and cozy theme.",
    preview: ["oklch(0.784 0.133 43.246)", "oklch(0.893 0.167 94.547)", "oklch(0.98 0.024 88.232)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.784 0.133 43.246)",
        primaryEnd: "oklch(0.893 0.167 94.547)",
        accentStart: "oklch(0.893 0.167 94.547)",
        accentEnd: "oklch(0.784 0.133 43.246)",
        background: "oklch(0.98 0.024 88.232)",
        surface: "oklch(1 0 89.876)",
        foreground: "oklch(0.468 0 89.876)",
        muted: "oklch(0.602 0.022 59.947)",
        border: "oklch(0.935 0.044 63.909)",
        primary: "oklch(0.784 0.133 43.246)",
        primaryHover: "oklch(0.714 0.135 43)",
        accent: "oklch(0.935 0.044 63.909)",
        shadow: "oklch(0.35 0.04 50)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.702 0.143 40.423)",
        primaryEnd: "oklch(0.817 0.157 93.741)",
        accentStart: "oklch(0.817 0.157 93.741)",
        accentEnd: "oklch(0.702 0.143 40.423)",
        background: "oklch(0.198 0.011 39.276)",
        surface: "oklch(0.254 0.017 37.339)",
        foreground: "oklch(0.912 0.018 70.228)",
        muted: "oklch(0.706 0.023 79.046)",
        border: "oklch(0.322 0.021 42.099)",
        primary: "oklch(0.702 0.143 40.423)",
        primaryHover: "oklch(0.637 0.14 40.995)",
        accent: "oklch(0.322 0.021 42.099)",
        shadow: "oklch(0.55 0.03 50)",
      }),
    },
  },
  {
    id: "aurora",
    name: "Aurora Scholar",
    description: "Northern lights energy with academic clarity.",
    preview: ["oklch(0.36 0.176 296.259)", "oklch(0.606 0.23 9.628)", "oklch(0.975 0.014 299.804)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.36 0.176 296.259)",
        primaryEnd: "oklch(0.606 0.23 9.628)",
        accentStart: "oklch(0.829 0.145 73.542)",
        accentEnd: "oklch(0.517 0.215 321.239)",
        background: "oklch(0.975 0.014 299.804)",
        surface: "oklch(1 0 89.876)",
        foreground: "oklch(0.276 0.09 296.264)",
        muted: "oklch(0.482 0.098 303.685)",
        border: "oklch(0.844 0.068 321.359)",
        primary: "oklch(0.435 0.2 303.438)",
        primaryHover: "oklch(0.382 0.179 301.291)",
        accent: "oklch(0.844 0.068 321.359)",
        shadow: "oklch(0.15 0.03 300)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.579 0.247 288.244)",
        primaryEnd: "oklch(0.766 0.128 358.964)",
        accentStart: "oklch(0.874 0.11 76.475)",
        accentEnd: "oklch(0.744 0.116 321.55)",
        background: "oklch(0.173 0.034 303.202)",
        surface: "oklch(0.22 0.047 299.855)",
        foreground: "oklch(0.897 0.034 304.52)",
        muted: "oklch(0.696 0.062 303.717)",
        border: "oklch(0.31 0.083 298.117)",
        primary: "oklch(0.579 0.247 288.244)",
        primaryHover: "oklch(0.524 0.239 287.345)",
        accent: "oklch(0.31 0.083 298.117)",
        shadow: "oklch(0.35 0.03 300)",
      }),
    },
  },
  {
    id: "ocean",
    name: "Ocean Academy",
    description: "Calm, focused, and deeply legible.",
    preview: ["oklch(0.444 0.076 199.769)", "oklch(0.682 0.118 210.053)", "oklch(0.96 0.024 206.195)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.444 0.076 199.769)",
        primaryEnd: "oklch(0.682 0.118 210.053)",
        accentStart: "oklch(0.793 0.114 207.308)",
        accentEnd: "oklch(0.847 0.091 206.2)",
        background: "oklch(0.96 0.024 206.195)",
        surface: "oklch(1 0 89.876)",
        foreground: "oklch(0.303 0.052 202.842)",
        muted: "oklch(0.557 0.095 206.077)",
        border: "oklch(0.903 0.059 205.569)",
        primary: "oklch(0.444 0.076 199.769)",
        primaryHover: "oklch(0.388 0.066 199.205)",
        accent: "oklch(0.903 0.059 205.569)",
        shadow: "oklch(0.15 0.02 200)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.759 0.124 208.28)",
        primaryEnd: "oklch(0.847 0.091 206.2)",
        accentStart: "oklch(0.903 0.059 205.569)",
        accentEnd: "oklch(0.96 0.024 206.195)",
        background: "oklch(0.202 0.021 211.891)",
        surface: "oklch(0.257 0.028 211.214)",
        foreground: "oklch(0.933 0.027 196.694)",
        muted: "oklch(0.722 0.046 183.665)",
        border: "oklch(0.354 0.047 212.694)",
        primary: "oklch(0.759 0.124 208.28)",
        primaryHover: "oklch(0.692 0.115 208.231)",
        accent: "oklch(0.354 0.047 212.694)",
        shadow: "oklch(0.35 0.02 200)",
      }),
    },
  },
  {
    id: "forest",
    name: "Forest Wisdom",
    description: "Gentle, grounded, and organic.",
    preview: ["oklch(0.523 0.135 144.167)", "oklch(0.718 0.142 144.889)", "oklch(0.97 0.021 127.381)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.523 0.135 144.167)",
        primaryEnd: "oklch(0.718 0.142 144.889)",
        accentStart: "oklch(0.825 0.118 129.001)",
        accentEnd: "oklch(0.923 0.126 95.412)",
        background: "oklch(0.97 0.021 127.381)",
        surface: "oklch(1 0 89.876)",
        foreground: "oklch(0.425 0.116 144.308)",
        muted: "oklch(0.579 0.137 134.665)",
        border: "oklch(0.874 0.085 128.378)",
        primary: "oklch(0.523 0.135 144.167)",
        primaryHover: "oklch(0.441 0.111 144.754)",
        accent: "oklch(0.874 0.085 128.378)",
        shadow: "oklch(0.15 0.03 140)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.718 0.142 144.889)",
        primaryEnd: "oklch(0.829 0.083 145.817)",
        accentStart: "oklch(0.874 0.085 128.378)",
        accentEnd: "oklch(0.959 0.109 102.632)",
        background: "oklch(0.204 0.022 152.585)",
        surface: "oklch(0.261 0.035 149.089)",
        foreground: "oklch(0.933 0.029 153.337)",
        muted: "oklch(0.713 0.046 151.224)",
        border: "oklch(0.363 0.057 147.471)",
        primary: "oklch(0.718 0.142 144.889)",
        primaryHover: "oklch(0.645 0.137 144.749)",
        accent: "oklch(0.363 0.057 147.471)",
        shadow: "oklch(0.35 0.02 140)",
      }),
    },
  },
  {
    id: "nebula",
    name: "Nebula Mind",
    description: "Cosmic contrast for immersive work.",
    preview: ["oklch(0.321 0.151 270.289)", "oklch(0.453 0.199 312.956)", "oklch(0.937 0.021 304.024)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.321 0.151 270.289)",
        primaryEnd: "oklch(0.453 0.199 312.956)",
        accentStart: "oklch(0.606 0.23 9.628)",
        accentEnd: "oklch(0.886 0.154 91.23)",
        background: "oklch(0.937 0.021 304.024)",
        surface: "oklch(1 0 89.876)",
        foreground: "oklch(0.229 0.145 274.318)",
        muted: "oklch(0.453 0.185 292.63)",
        border: "oklch(0.843 0.053 301.289)",
        primary: "oklch(0.395 0.181 286.039)",
        primaryHover: "oklch(0.342 0.157 284.953)",
        accent: "oklch(0.843 0.053 301.289)",
        shadow: "oklch(0.1 0.02 270)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.556 0.132 273.795)",
        primaryEnd: "oklch(0.576 0.194 321.59)",
        accentStart: "oklch(0.639 0.21 5.275)",
        accentEnd: "oklch(0.913 0.119 91.668)",
        background: "oklch(0.167 0.029 296.245)",
        surface: "oklch(0.213 0.041 293.575)",
        foreground: "oklch(0.893 0.027 300.239)",
        muted: "oklch(0.652 0.036 300.593)",
        border: "oklch(0.279 0.062 292.797)",
        primary: "oklch(0.556 0.132 273.795)",
        primaryHover: "oklch(0.49 0.128 273.305)",
        accent: "oklch(0.279 0.062 292.797)",
        shadow: "oklch(0.3 0.02 270)",
      }),
    },
  },
  {
    id: "sunset",
    name: "Sunset Scholar",
    description: "Golden-hour warmth with editorial contrast.",
    preview: ["oklch(0.536 0.18 35.371)", "oklch(0.708 0.197 46.456)", "oklch(0.969 0.028 79.48)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.536 0.18 35.371)",
        primaryEnd: "oklch(0.708 0.197 46.456)",
        accentStart: "oklch(0.829 0.145 73.542)",
        accentEnd: "oklch(0.886 0.154 91.23)",
        background: "oklch(0.969 0.028 79.48)",
        surface: "oklch(1 0 89.876)",
        foreground: "oklch(0.3 0.036 30.204)",
        muted: "oklch(0.566 0.043 40.432)",
        border: "oklch(0.886 0.062 38.131)",
        primary: "oklch(0.536 0.18 35.371)",
        primaryHover: "oklch(0.477 0.16 35.393)",
        accent: "oklch(0.886 0.062 38.131)",
        shadow: "oklch(0.2 0.04 35)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.712 0.185 37.768)",
        primaryEnd: "oklch(0.862 0.168 88.307)",
        accentStart: "oklch(0.913 0.119 91.668)",
        accentEnd: "oklch(0.959 0.109 102.632)",
        background: "oklch(0.193 0.02 52.116)",
        surface: "oklch(0.245 0.032 51.162)",
        foreground: "oklch(0.928 0.014 57.579)",
        muted: "oklch(0.701 0.026 57.504)",
        border: "oklch(0.331 0.048 48.693)",
        primary: "oklch(0.712 0.185 37.768)",
        primaryHover: "oklch(0.65 0.183 37.382)",
        accent: "oklch(0.331 0.048 48.693)",
        shadow: "oklch(0.4 0.03 35)",
      }),
    },
  },
  {
    id: "midnight",
    name: "Midnight Classic",
    description: "Minimal monochrome for deep focus.",
    preview: ["oklch(0.218 0 89.876)", "oklch(0.931 0 89.876)", "oklch(0.978 0.005 67.764)"],
    modes: {
      light: createThemeTokens({
        primaryStart: "oklch(0.218 0 89.876)",
        primaryEnd: "oklch(0.297 0 89.876)",
        accentStart: "oklch(0.931 0 89.876)",
        accentEnd: "oklch(0.923 0.018 73.069)",
        background: "oklch(0.978 0.005 67.764)",
        surface: "oklch(0.987 0.005 67.765)",
        card: "oklch(0.99 0.009 78.283)",
        popover: "oklch(0.982 0.013 71.334)",
        foreground: "oklch(0.229 0.006 56.071)",
        muted: "oklch(0.443 0.019 73.431)",
        border: "oklch(0.923 0.018 73.069)",
        primary: "oklch(0.218 0 89.876)",
        primaryHover: "oklch(0.297 0 89.876)",
        accent: "oklch(0.931 0 89.876)",
        shadow: "oklch(0.12 0 0)",
      }),
      dark: createThemeTokens({
        primaryStart: "oklch(0.955 0 89.876)",
        primaryEnd: "oklch(0.894 0 89.876)",
        accentStart: "oklch(0.264 0 89.876)",
        accentEnd: "oklch(0.2 0 89.876)",
        background: "oklch(0.159 0 89.876)",
        surface: "oklch(0.2 0 89.876)",
        card: "oklch(0.226 0 89.876)",
        popover: "oklch(0.2 0 89.876)",
        foreground: "oklch(0.955 0 89.876)",
        muted: "oklch(0.683 0 89.876)",
        border: "oklch(0.264 0 89.876)",
        primary: "oklch(0.955 0 89.876)",
        primaryHover: "oklch(0.894 0 89.876)",
        accent: "oklch(0.264 0 89.876)",
        shadow: "oklch(0.66 0 0)",
      }),
    },
  },
];

export const defaultThemeId: ThemeId = "midnight";

export function resolveThemeById(themeId: string) {
  return (
    desktopThemes.find((theme) => theme.id === themeId) ??
    desktopThemes.find((theme) => theme.id === defaultThemeId) ??
    desktopThemes[0]
  );
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemeTokensFor(themeId: string, mode: ThemeMode) {
  return resolveThemeById(themeId).modes[resolveThemeMode(mode)];
}
