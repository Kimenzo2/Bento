// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import type { SupportedLanguage } from "./shiki";

export type CodeRootProps = {
  ref?: HTMLDivElement | null;
  variant?: "default" | "secondary";
  lang?: SupportedLanguage;
  code: string;
  class?: string;
  hideLines?: boolean;
  highlight?: (number | [number, number])[];
  children?: Snippet;
} & HTMLAttributes<HTMLDivElement>;

export type CodeCopyButtonProps = {
  ref?: HTMLButtonElement | null;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  class?: string;
} & HTMLAttributes<HTMLButtonElement>;

export type CodeOverflowProps = {
  collapsed?: boolean;
  class?: string;
  children?: Snippet;
} & HTMLAttributes<HTMLDivElement>;
