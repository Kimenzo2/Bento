// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { invoke } from "@tauri-apps/api/core";

export type SearchDocument = {
  moduleId: string;
  id: string;
  title: string;
  body: string;
  tags?: string[];
  projects?: string[];
  kind?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  sourceRef?: string | null;
  extra?: Record<string, unknown> | null;
};

export type SearchQuery = {
  query: string;
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  tags?: string[];
  projects?: string[];
  kind?: string | null;
  createdAfter?: number | null;
  createdBefore?: number | null;
  updatedAfter?: number | null;
  updatedBefore?: number | null;
};

export type SearchHit = {
  score: number;
  document: SearchDocument;
};

export async function indexContent(document: SearchDocument) {
  return invoke<void>("index_content", { document });
}

export async function searchInModule(moduleId: string, query: SearchQuery) {
  return invoke<SearchHit[]>("search_in_module", { moduleId, query });
}

export async function rebuildIndex(moduleId: string) {
  return invoke<void>("rebuild_index", { moduleId });
}

export async function deleteFromIndex(moduleId: string, id: string) {
  return invoke<void>("delete_from_index", { moduleId, id });
}
