// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { writable } from "svelte/store";

type ModuleSectionsState = Record<string, string>;

export const moduleSectionStore = writable<ModuleSectionsState>({});

function isKnownSection(label: string, labels: readonly string[]) {
  return labels.includes(label);
}

export function ensureModuleSection(moduleId: string, labels: readonly string[]) {
  if (labels.length === 0) {
    return;
  }

  moduleSectionStore.update((state) => {
    const current = state[moduleId];
    if (current && isKnownSection(current, labels)) {
      return state;
    }

    return {
      ...state,
      [moduleId]: labels[0],
    };
  });
}

export function setModuleSection(moduleId: string, label: string, labels: readonly string[]) {
  if (!isKnownSection(label, labels)) {
    return;
  }

  moduleSectionStore.update((state) => {
    if (state[moduleId] === label) {
      return state;
    }

    return {
      ...state,
      [moduleId]: label,
    };
  });
}

export function getModuleSectionLabel(
  state: ModuleSectionsState,
  moduleId: string,
  labels: readonly string[],
) {
  if (labels.length === 0) {
    return "";
  }

  const current = state[moduleId];
  return current && isKnownSection(current, labels) ? current : labels[0];
}
