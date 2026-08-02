// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { Snippet } from "svelte";

export type ButtonSize = "default" | "sm" | "lg" | "icon";
export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export type CopyButtonProps = {
  ref?: HTMLButtonElement | null;
  text: string;
  icon?: Snippet;
  animationDuration?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onCopy?: (status: "success" | "failure" | undefined) => void;
  class?: string;
  children?: Snippet;
  tabindex?: number | null | undefined;
};
