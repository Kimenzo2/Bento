// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { writable } from "svelte/store";

export type CrashPayload = {
  message: string;
  logPath: string;
  timestamp: string;
};

export const crashStore = writable<CrashPayload | null>(null);

export function showCrash(payload: CrashPayload) {
  crashStore.set(payload);
}

export function clearCrash() {
  crashStore.set(null);
}
