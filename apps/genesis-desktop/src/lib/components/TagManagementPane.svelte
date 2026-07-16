<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { Hash, X, Pencil, Trash2, Check, Plus } from 'lucide-svelte';

  let { onClose = () => {}, onSelectTag = (tag: string) => {} } = $props();

  let tags = $state<{ name: string; count: number }[]>([]);
  let loading = $state(true);

  let editingTag = $state<string | null>(null);
  let editValue = $state('');
  let editInputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (editingTag && editInputEl) {
      editInputEl.focus();
    }
  });
  let newTagName = $state('');

  async function loadTags() {
    loading = true;
    try {
      tags = await invoke<any[]>('notes_tags_list');
    } catch (err) {
      console.error('[tags] load failed:', err);
    } finally {
      loading = false;
    }
  }

  function startEdit(name: string) {
    editingTag = name;
    editValue = name;
  }

  async function saveEdit() {
    if (!editingTag || !editValue.trim() || editValue.trim() === editingTag) {
      editingTag = null;
      return;
    }
    try {
      await invoke('notes_tags_rename', { oldName: editingTag, newName: editValue.trim() });
      editingTag = null;
      await loadTags();
    } catch (err) {
      console.error('[tags] rename failed:', err);
    }
  }

  async function deleteTag(name: string) {
    try {
      await invoke('notes_tags_delete', { name });
      await loadTags();
    } catch (err) {
      console.error('[tags] delete failed:', err);
    }
  }

  async function addTag() {
    if (!newTagName.trim()) return;
    try {
      await invoke('notes_tags_rename', { oldName: '__new__', newName: newTagName.trim() });
      newTagName = '';
      await loadTags();
    } catch (err) {
      console.error('[tags] add failed:', err);
    }
  }

  $effect(() => { void loadTags(); });
</script>

<div class="tag-pane">
  <div class="tag-pane-header">
    <span class="tag-pane-title">Tags</span>
    <button class="tag-pane-close" onclick={() => onClose()} aria-label="Close" type="button"><X size={14} /></button>
  </div>

  {#if loading}
    <div class="tag-pane-loading"><div class="spinner"></div><span>Loading...</span></div>
  {:else if tags.length === 0}
    <div class="tag-pane-empty">No tags yet. Add tags to notes to see them here.</div>
  {:else}
    <div class="tag-list">
      {#each tags as tag (tag.name)}
        <div class="tag-row" class:editing={editingTag === tag.name}>
          {#if editingTag === tag.name}
            <input bind:this={editInputEl} class="tag-edit-input" bind:value={editValue} onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') editingTag = null; }} />
            <button class="tag-action-btn" onclick={saveEdit} title="Save"><Check size={12} /></button>
            <button class="tag-action-btn" onclick={() => editingTag = null} title="Cancel"><X size={12} /></button>
          {:else}
            <button class="tag-row-btn" onclick={() => onSelectTag(tag.name)} title="Filter by tag">
              <Hash size={12} />
              <span class="tag-name">{tag.name}</span>
              <span class="tag-count">{tag.count}</span>
            </button>
            <button class="tag-action-btn" onclick={() => startEdit(tag.name)} title="Rename"><Pencil size={12} /></button>
            <button class="tag-action-btn danger" onclick={() => deleteTag(tag.name)} title="Delete"><Trash2 size={12} /></button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="tag-add-row">
    <input class="tag-add-input" placeholder="New tag..." bind:value={newTagName} onkeydown={(e) => { if (e.key === 'Enter') addTag(); }} />
    <button class="tag-add-btn" onclick={addTag} disabled={!newTagName.trim()} title="Add tag"><Plus size={14} /></button>
  </div>
</div>

<style>
  .tag-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .tag-pane-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; flex-shrink: 0; }
  .tag-pane-title { font-size: 13px; font-weight: 600; color: var(--foreground); }
  .tag-pane-close { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .tag-pane-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .tag-pane-loading, .tag-pane-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px 16px; color: var(--muted); font-size: 12px; text-align: center; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--muted); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .tag-list { flex: 1; overflow-y: auto; padding: 4px 8px; display: flex; flex-direction: column; gap: 1px; }
  .tag-row { display: flex; align-items: center; gap: 2px; padding: 2px 4px; border-radius: 6px; transition: background 100ms ease; }
  .tag-row:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .tag-row.editing { background: color-mix(in srgb, var(--primary) 8%, transparent); }
  .tag-row-btn { display: flex; align-items: center; gap: 6px; flex: 1; padding: 4px 6px; border: none; border-radius: 4px; background: transparent; color: var(--foreground); font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
  .tag-row-btn:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .tag-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag-count { font-size: 11px; color: var(--muted); font-weight: 500; }
  .tag-action-btn { display: grid; place-items: center; width: 22px; height: 22px; border: none; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; flex-shrink: 0; transition: all 100ms ease; }
  .tag-action-btn:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .tag-action-btn.danger:hover { background: color-mix(in srgb, #ef4444 10%, transparent); color: #ef4444; }
  .tag-edit-input { flex: 1; height: 24px; padding: 0 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--background); color: var(--foreground); font: inherit; font-size: 12px; outline: none; }
  .tag-add-row { display: flex; align-items: center; gap: 4px; padding: 8px 10px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .tag-add-input { flex: 1; height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); color: var(--foreground); font: inherit; font-size: 12px; outline: none; }
  .tag-add-input:focus { border-color: var(--primary); }
  .tag-add-btn { display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: var(--primary); color: white; cursor: pointer; flex-shrink: 0; }
  .tag-add-btn:disabled { opacity: 0.4; cursor: default; }
</style>
