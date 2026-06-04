<script lang="ts">
  import { X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { notesFontVariationId, applyNotesFont } from '$lib/stores/notes-font.store';
  import { journalFontVariations, getJournalFontVariationName } from '$lib/data/preferences';

  let { onclose = () => {} }: { onclose: () => void } = $props();

  let currentId = $state('jv-plex-instrument');

  onMount(() => {
    currentId = $notesFontVariationId;
  });

  function selectVariation(id: string) {
    currentId = id;
    applyNotesFont(id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="nfont-overlay" role="dialog" aria-modal="true" aria-label="Notes font preference">
  <button class="nfont-scrim" onclick={onclose} aria-label="Close" tabindex="-1"></button>

  <div class="nfont-panel">
    <div class="nfont-header">
      <div>
        <div class="nfont-eyebrow">Notes Typography</div>
        <h2>Editor Font</h2>
      </div>
      <button class="nfont-close" onclick={onclose} aria-label="Close">
        <X size={18} />
      </button>
    </div>

    <div class="nfont-body">
      <p class="nfont-desc">
        Choose the typeface for your notes editor. Headings always use IBM Plex Sans.
      </p>

      <div class="nfont-list">
        {#each journalFontVariations as variation}
          <button
            class="nfont-card"
            class:nfont-card--active={currentId === variation.id}
            onclick={() => selectVariation(variation.id)}
            style="--nfont-preview-body: {variation.body}; --nfont-preview-heading: {variation.heading};"
          >
            <div class="nfont-card-preview">
              <span class="nfont-preview-heading">Aa</span>
              <span class="nfont-preview-body">The quick brown fox jumps over the lazy dog</span>
            </div>
            <div class="nfont-card-info">
              <span class="nfont-card-name">{variation.name}</span>
              <span class="nfont-card-desc">{variation.description}</span>
            </div>
            {#if currentId === variation.id}
              <div class="nfont-check" aria-label="Selected">✓</div>
            {/if}
          </button>
        {/each}
      </div>

      <p class="nfont-footnote">
        Currently using: <strong>{getJournalFontVariationName(currentId)}</strong>
      </p>
    </div>
  </div>
</div>

<style>
  .nfont-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  .nfont-scrim {
    position: absolute;
    inset: 0;
    border: 0;
    background:
      radial-gradient(
        circle at 50% 4rem,
        color-mix(in srgb, var(--primary) 14%, transparent),
        transparent 22rem
      ),
      color-mix(in srgb, var(--background) 68%, transparent);
    backdrop-filter: blur(12px);
    cursor: default;
  }

  .nfont-panel {
    position: relative;
    width: min(42rem, calc(100vw - 3rem));
    max-height: min(38rem, calc(100vh - 6rem));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
    border-radius: 1.7rem;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--surface) 98%, var(--background)),
      color-mix(in srgb, var(--surface) 86%, var(--background))
    );
  }

  .nfont-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--border);
    padding: 1.15rem 1.25rem;
  }

  .nfont-eyebrow {
    margin: 0 0 0.2rem;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .nfont-header h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--foreground);
  }

  .nfont-close {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 86%, transparent);
    color: var(--foreground);
    cursor: default;
    flex-shrink: 0;
  }

  .nfont-close:hover {
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
  }

  .nfont-body {
    padding: 1.25rem;
    overflow-y: auto;
    display: grid;
    gap: 0.85rem;
  }

  .nfont-desc {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
    line-height: 1.5;
    max-width: 32rem;
  }

  .nfont-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .nfont-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0.9rem 1.15rem;
    border: 1px solid var(--border);
    border-radius: 1.15rem;
    background: color-mix(in srgb, var(--surface) 90%, var(--background));
    color: var(--foreground);
    cursor: default;
    text-align: left;
    transition: border-color 150ms ease, background 150ms ease;
  }

  .nfont-card:hover {
    border-color: color-mix(in srgb, var(--primary) 36%, var(--border));
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  }

  .nfont-card--active {
    border-color: color-mix(in srgb, var(--primary) 58%, var(--border)) !important;
    background: color-mix(in srgb, var(--primary) 10%, var(--surface)) !important;
  }

  .nfont-card-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-width: 3.5rem;
    flex-shrink: 0;
  }

  .nfont-preview-heading {
    font-family: var(--nfont-preview-heading);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--foreground);
  }

  .nfont-preview-body {
    font-family: var(--nfont-preview-body);
    font-size: 0.55rem;
    color: var(--muted);
    line-height: 1.2;
    text-align: center;
    max-width: 5.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nfont-card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .nfont-card-name {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .nfont-card-desc {
    font-size: 0.72rem;
    color: var(--muted);
    line-height: 1.3;
  }

  .nfont-check {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--foreground);
    color: var(--background);
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    font-weight: 800;
    flex-shrink: 0;
  }

  .nfont-footnote {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    text-align: center;
  }

  .nfont-footnote strong {
    color: var(--foreground);
  }
</style>
