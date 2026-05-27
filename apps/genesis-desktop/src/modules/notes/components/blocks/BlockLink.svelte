<script lang="ts">
  // ════════════════════════════════════════════════════════════════════
  // BlockLink.svelte — Port of anytype-ts/block/link.tsx
  // Renders object link cards in Text / Card / Inline styles
  // ════════════════════════════════════════════════════════════════════
  import type { Block } from '$lib/local-store/block';
  import { LinkCardStyle, LinkDescription, LinkIconSize } from '$lib/local-store/block';

  let { block, readonly = false }: { block: Block; readonly?: boolean } = $props();

  let content = block.content as any;
  let targetBlockId: string = content?.targetBlockId ?? '';
  let cardStyle: LinkCardStyle = content?.cardStyle ?? LinkCardStyle.Card;
  let description: LinkDescription = content?.description ?? LinkDescription.None;
  let iconSize: LinkIconSize = content?.iconSize ?? LinkIconSize.Small;
  let relations: string[] = content?.relations ?? [];

  // In Bento, we don't have a full object store, so we display a simple
  // link card with the data from block.content (which stores resolved details)
  let objectName: string = content?.objectName ?? content?.name ?? '';
  let objectIcon: string = content?.objectIcon ?? content?.icon ?? '';
  let objectDescription: string = content?.objectDescription ?? content?.description ?? '';
  let objectLayout: string = content?.objectLayout ?? 'page';
  let objectType: string = content?.objectTypeName ?? '';
  let coverId: string = content?.coverId ?? '';
  let coverType: number = content?.coverType ?? 0;
  let isDeleted: boolean = content?.isDeleted ?? false;
  let isArchived: boolean = content?.isArchived ?? false;

  const isText = cardStyle === LinkCardStyle.Text;
  const isCard = cardStyle === LinkCardStyle.Card;
  const isInline = cardStyle === LinkCardStyle.Inline;
  const withIcon = iconSize !== LinkIconSize.None;

  function handleClick(e: MouseEvent) {
    if (targetBlockId) {
      const el = document.querySelector(`[data-block-id="${targetBlockId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
</script>

<div
  class="block-link"
  class:is-text={isText}
  class:is-card={isCard}
  class:is-inline={isInline}
  class:is-deleted={isDeleted}
  class:is-archived={isArchived}
>
  {#if isDeleted}
    <div class="link-deleted">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
      </svg>
      <span>Deleted object</span>
    </div>

  {:else if !targetBlockId && !objectName}
    <div class="link-empty">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      <span>Select an object to link</span>
    </div>

  {:else}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="link-card" role="button" tabindex="0" onclick={handleClick} onkeydown={(e) => e.key === 'Enter' && handleClick(e as any)}>

      {#if coverId && isCard}
        <div class="link-cover">
          {#if coverType === 1}
            <img src={coverId} alt="" loading="lazy" />
          {:else}
            <div class="link-cover-color" style="background:{coverId}"></div>
          {/if}
        </div>
      {/if}

      <div class="link-sides">
        <div class="link-left">
          {#if withIcon}
            <div class="link-icon" class:large={iconSize === LinkIconSize.Medium && isCard}>
              {#if objectIcon}
                <span>{objectIcon}</span>
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              {/if}
            </div>
          {/if}

          <div class="link-name-wrap">
            <div class="link-name">{objectName || 'Untitled'}</div>

            {#if description !== LinkDescription.None && objectDescription}
              <div class="link-description">{objectDescription}</div>
            {/if}

            {#if relations.includes('type') && objectType}
              <div class="link-type">{objectType}</div>
            {/if}
          </div>

          {#if isArchived}
            <span class="link-archive-tag">Archived</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .block-link { width: 100%; }

  /* ── Empty / deleted states ───────────────────────────────────────── */
  .link-empty, .link-deleted {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: 1px dashed var(--border);
    border-radius: 10px;
    color: var(--muted);
    font-size: 0.9rem;
    background: var(--surface);
  }

  /* ── Link card ────────────────────────────────────────────────────── */
  .link-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    overflow: hidden;
    cursor: pointer;
    transition: box-shadow 0.15s;
  }

  .is-text .link-card {
    border: none;
    border-radius: 0;
    background: transparent;
    border-bottom: 1px solid var(--border);
  }

  .is-inline .link-card {
    display: inline-flex;
    border-radius: 6px;
    padding: 2px 8px;
  }

  .link-card:hover {
    background: color-mix(in srgb, var(--surface) 90%, var(--primary));
  }

  /* ── Cover image ──────────────────────────────────────────────────── */
  .link-cover {
    width: 100%;
    height: 100px;
    overflow: hidden;
  }

  .link-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .link-cover-color {
    width: 100%;
    height: 100%;
  }

  /* ── Content ─────────────────────────────────────────────────────── */
  .link-sides {
    display: flex;
    align-items: center;
    padding: 12px 14px;
    gap: 10px;
  }

  .is-text .link-sides { padding: 6px 0; }
  .is-inline .link-sides { padding: 0; }

  .link-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .link-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 1.1rem;
    color: var(--muted);
  }

  .link-icon.large {
    width: 40px;
    height: 40px;
    font-size: 1.8rem;
  }

  .link-name-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .link-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-description {
    font-size: 0.85rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-type {
    font-size: 0.78rem;
    color: var(--muted);
    opacity: 0.7;
  }

  .link-archive-tag {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--muted) 15%, transparent);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
</style>
