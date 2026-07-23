<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { BookmarkState } from '$lib/local-store/block';
  import { editorStore } from '$lib/local-store/store';

  let { block }: { block: Block } = $props();

  let content = $derived(block.content as any);
  let bookmarkState: BookmarkState = $derived(content?.state ?? BookmarkState.Empty);
  let url: string = $derived(content?.url ?? '');
  let title: string = $derived(content?.title ?? '');
  let description: string = $derived(content?.description ?? '');
  let faviconUrl: string = $derived(content?.faviconUrl ?? '');
  let imageUrl: string = $derived(content?.imageUrl ?? '');

  let isEditing = $state(false);
  let editUrl = $state('');

  function startEdit() {
    editUrl = url;
    isEditing = true;
  }

  async function saveEdit() {
    const trimmed = editUrl.trim();
    if (!trimmed) {
      isEditing = false;
      return;
    }
    const validUrl = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    await editorStore.setBlockContent(block.id as string, {
      ...(block.content as any || {}),
      state: BookmarkState.Done,
      url: validUrl,
      targetObjectId: validUrl,
    } as any);
    isEditing = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      isEditing = false;
    }
  }

  function getDomain(u: string): string {
    try {
      const parsed = new URL(u);
      return parsed.hostname.replace('www.', '');
    } catch {
      return u;
    }
  }
</script>

<div class="block-bookmark" class:is-empty={bookmarkState === BookmarkState.Empty}>
  {#if isEditing}
    <div class="bookmark-editor">
      <div class="bookmark-editor-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <input
          class="bookmark-editor-input"
          bind:value={editUrl}
          placeholder="https://example.com"
          onkeydown={handleKeyDown}
        />
        <button class="bookmark-editor-save" onclick={saveEdit}>Save</button>
      </div>
    </div>

  {:else if bookmarkState === BookmarkState.Empty || (!title && !url)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="bookmark-empty" onclick={startEdit}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      <span>Add a bookmark link</span>
    </div>

  {:else}
    <div class="bookmark-card">
      <div class="bookmark-body">
        {#if title}
          <h4 class="bookmark-title">{title}</h4>
        {/if}
        {#if description}
          <p class="bookmark-description">{description}</p>
        {/if}
        <div class="bookmark-url">
          {#if faviconUrl}
            <img src={faviconUrl} alt="" class="bookmark-favicon" width="16" height="16" />
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          {/if}
          <span>{getDomain(url)}</span>
        </div>
      </div>

      {#if imageUrl}
        <div class="bookmark-image">
          <img src={imageUrl} alt={title || ''} loading="lazy" />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .block-bookmark {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
  }

  .bookmark-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border: 1px dashed var(--border);
    border-radius: 12px;
    color: var(--muted);
    font-size: 0.9rem;
    background: var(--surface);
    cursor: pointer;
    transition: background 0.15s;
  }

  .bookmark-empty:hover { background: color-mix(in srgb, var(--foreground) 3%, transparent); }

  .bookmark-editor {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    padding: 10px 14px;
  }

  .bookmark-editor-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .bookmark-editor-input {
    flex: 1;
    min-width: 0;
    padding: 6px 0;
    border: none;
    background: transparent;
    color: var(--foreground);
    font: inherit;
    font-size: 0.9rem;
    outline: none;
  }

  .bookmark-editor-save {
    flex-shrink: 0;
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: var(--primary-foreground, #fff);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }

  .bookmark-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface);
    transition: box-shadow 0.2s;
    min-width: 0;
  }

  .bookmark-card:hover {
    box-shadow: none;
  }

  .bookmark-body {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    min-width: 0;
  }

  .bookmark-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--foreground);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bookmark-description {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bookmark-url {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--muted);
  }

  .bookmark-favicon {
    border-radius: 2px;
  }

  .bookmark-image {
    width: 140px;
    min-height: 100%;
    overflow: hidden;
  }

  .bookmark-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 600px) {
    .bookmark-card {
      grid-template-columns: 1fr;
    }

    .bookmark-image {
      width: 100%;
      height: 180px;
    }
  }
</style>
