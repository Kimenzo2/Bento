// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type WithElementRef<T> = T & {
  ref?: HTMLElement | SVGElement | null;
  class?: string;
};

export type WithoutChildren<T> = Omit<T, "children">;

export type WithoutChild<T> = Omit<T, "child">;

export type WithoutChildrenOrChild<T> = Omit<T, "children" | "child">;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
