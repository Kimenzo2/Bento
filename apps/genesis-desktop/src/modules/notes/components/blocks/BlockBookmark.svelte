<script lang="ts">
  import type { Block } from '$lib/local-store/block';
  import { BookmarkState } from '$lib/local-store/block';

  export let block: Block;
  // rootId and readonly accepted via $$restProps

  let content = block.content as any;
  let state: BookmarkState = content?.state ?? BookmarkState.Empty;
  let url: string = content?.url ?? '';
  let title: string = content?.title ?? '';
  let description: string = content?.description ?? '';
  let faviconUrl: string = content?.faviconUrl ?? '';
  let imageUrl: string = content?.imageUrl ?? '';

  // Extract domain from URL for display
  function getDomain(u: string): string {
    try {
      const parsed = new URL(u);
      return parsed.hostname.replace('www.', '');
    } catch {
      return u;
    }
  }
</script>

<div class="block-bookmark" class:is-empty={state === BookmarkState.Empty}>
  {#if state === BookmarkState.Empty || (!title && !url)}
    <div class="bookmark-empty">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      <span>Paste a link to create a bookmark</span>
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
  }

  .bookmark-card {
    display: grid;
    grid-template-columns: 1fr auto;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface);
    transition: box-shadow 0.2s;
  }

  .bookmark-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .bookmark-body {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
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
