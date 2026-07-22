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
