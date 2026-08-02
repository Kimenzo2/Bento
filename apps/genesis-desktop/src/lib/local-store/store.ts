// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// COMPAT RE-EXPORT — imports are forwarded to editor-state.svelte.ts
// which uses Svelte 5 $state/$derived runes (Anytype MobX → runes port).
// ═══════════════════════════════════════════════════════════════════════

export {
  editorStore,
  getRootBlocks,
  getTitleBlock,
  getFocusedBlock,
  getIsEditorLoading,
  getIsEditorLoaded,
  getToggleStateVersion,
  getObjectId,
  getBlock,
  blockById,
} from "./editor-state.svelte";
