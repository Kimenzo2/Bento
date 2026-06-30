/** Theme-safe accent steps — no hardcoded hex; derived from global CSS variables. */
export const miniAppAccentSteps = [
  "var(--primary)",
  "color-mix(in srgb, var(--primary) 72%, var(--accent))",
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 68%, var(--foreground))",
  "color-mix(in srgb, var(--primary) 48%, var(--foreground))",
] as const;

export function miniAppAccent(index: number): string {
  return miniAppAccentSteps[index % miniAppAccentSteps.length];
}
