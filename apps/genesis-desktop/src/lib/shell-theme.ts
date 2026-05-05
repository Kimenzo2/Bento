export type ShellTokens = {
  "--shell-bg": string;
  "--shell-text": string;
  "--shell-border": string;
  "--shell-control-idle": string;
};

export const LIGHT_SHELL_TOKENS = {
  "--shell-bg": "#EEEAE6",
  "--shell-text": "#2A2724",
  "--shell-border": "#D8D0C8",
  "--shell-control-idle": "#C8C0B8",
} as const satisfies ShellTokens;

export const DARK_SHELL_TOKENS = {
  "--shell-bg": "#080808",
  "--shell-text": "#CCCCCC",
  "--shell-border": "#1A1A1A",
  "--shell-control-idle": "#333333",
} as const satisfies ShellTokens;

export function getShellTokens(isDark: boolean): ShellTokens {
  return isDark ? DARK_SHELL_TOKENS : LIGHT_SHELL_TOKENS;
}
