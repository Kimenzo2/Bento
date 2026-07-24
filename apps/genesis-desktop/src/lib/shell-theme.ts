export type ShellTokens = {
  "--shell-bg": string;
  "--shell-text": string;
  "--shell-border": string;
  "--shell-control-idle": string;
};

export const LIGHT_SHELL_TOKENS = {
  "--shell-bg": "oklch(0.939 0.007 67.741)",
  "--shell-text": "oklch(0.275 0.007 67.529)",
  "--shell-border": "oklch(0.862 0.014 67.639)",
  "--shell-control-idle": "oklch(0.812 0.014 67.624)",
} as const satisfies ShellTokens;

export const DARK_SHELL_TOKENS = {
  "--shell-bg": "oklch(0.134 0 89.876)",
  "--shell-text": "oklch(0.845 0 89.876)",
  "--shell-border": "oklch(0.218 0 89.876)",
  "--shell-control-idle": "oklch(0.321 0 89.876)",
} as const satisfies ShellTokens;

export function getShellTokens(isDark: boolean): ShellTokens {
  return isDark ? DARK_SHELL_TOKENS : LIGHT_SHELL_TOKENS;
}
