<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { journalFontVariationId, applyJournalFont } from '$lib/stores/journal-font.store';
  import { journalFontVariations, getJournalFontVariationName } from '$lib/data/preferences';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let { onclose = () => {} }: { onclose: () => void } = $props();

  let currentId = $state('jv-plex-instrument');

  onMount(() => {
    currentId = $journalFontVariationId;
  });

  function selectVariation(id: string) {
    currentId = id;
    applyJournalFont(id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="jfont-overlay" role="dialog" aria-modal="true" aria-label="Journal font preference">
  <button class="jfont-scrim" onclick={onclose} aria-label="Close" tabindex="-1"></button>

  <div class="jfont-panel">
    <div class="jfont-header">
      <div>
        <div class="jfont-eyebrow">Journal Typography</div>
        <h2>Editor Font</h2>
      </div>
      <button class="jfont-close" onclick={onclose} aria-label="Close" use:tooltip={{ text: "Close" }}>
        <X size={18} />
      </button>
    </div>

    <div class="jfont-body">
      <p class="jfont-desc">
        Choose the typeface for your journal editor. Headings always use IBM Plex Sans.
      </p>

      <div class="jfont-list">
        {#each journalFontVariations as variation}
          <button
            class="jfont-card"
            class:jfont-card--active={currentId === variation.id}
            onclick={() => selectVariation(variation.id)}
            style="--jfont-preview-body: {variation.body}; --jfont-preview-heading: {variation.heading};"
          >
            <div class="jfont-card-preview">
              <span class="jfont-preview-heading">Aa</span>
              <span class="jfont-preview-body">The quick brown fox jumps over the lazy dog</span>
            </div>
            <div class="jfont-card-info">
              <span class="jfont-card-name">{variation.name}</span>
              <span class="jfont-card-desc">{variation.description}</span>
            </div>
            {#if currentId === variation.id}
              <div class="jfont-check" aria-label="Selected">✓</div>
            {/if}
          </button>
        {/each}
      </div>

      <p class="jfont-footnote">
        Currently using: <strong>{getJournalFontVariationName(currentId)}</strong>
      </p>
    </div>
  </div>
</div>

<style>
  .jfont-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  .jfont-scrim {
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

  .jfont-panel {
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

  .jfont-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--border);
    padding: 1.15rem 1.25rem;
  }

  .jfont-eyebrow {
    margin: 0 0 0.2rem;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 550;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .jfont-header h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--foreground);
  }

  .jfont-close {
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

  .jfont-close:hover {
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
  }

  .jfont-body {
    padding: 1.25rem;
    overflow-y: auto;
    display: grid;
    gap: 0.85rem;
  }

  .jfont-desc {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
    line-height: 1.5;
    max-width: 32rem;
  }

  .jfont-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .jfont-card {
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

  .jfont-card:hover {
    border-color: color-mix(in srgb, var(--primary) 36%, var(--border));
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  }

  .jfont-card--active {
    border-color: color-mix(in srgb, var(--primary) 58%, var(--border)) !important;
    background: color-mix(in srgb, var(--primary) 10%, var(--surface)) !important;
  }

  .jfont-card-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-width: 3.5rem;
    flex-shrink: 0;
  }

  .jfont-preview-heading {
    font-family: var(--jfont-preview-heading);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--foreground);
  }

  .jfont-preview-body {
    font-family: var(--jfont-preview-body);
    font-size: 0.55rem;
    color: var(--muted);
    line-height: 1.2;
    text-align: center;
    max-width: 5.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .jfont-card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .jfont-card-name {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .jfont-card-desc {
    font-size: 0.72rem;
    color: var(--muted);
    line-height: 1.3;
  }

  .jfont-check {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--foreground);
    color: var(--background);
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    font-weight: 550;
    flex-shrink: 0;
  }

  .jfont-footnote {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    text-align: center;
  }

  .jfont-footnote strong {
    color: var(--foreground);
  }
</style>
