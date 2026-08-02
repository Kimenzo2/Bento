// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

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
