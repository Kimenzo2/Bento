<script lang="ts">
  import { X } from 'lucide-svelte';
  import { desktopSettings, saveDesktopSettings } from '$lib/desktop/settings';
  import { fontPairings, getFontPairingName, getEditorFontFamily } from '$lib/data/preferences';
  import { onMount } from 'svelte';

  let { onclose = () => {} }: { onclose: () => void } = $props();

  let currentId = $state('instrument-serif');

  onMount(() => {
    const settings = $desktopSettings;
    currentId = settings.appearance.fontPairingId;
  });

  async function selectFont(id: string) {
    currentId = id;
    await saveDesktopSettings({
      ...$desktopSettings,
      appearance: {
        ...$desktopSettings.appearance,
        fontPairingId: id,
      },
    });
    // Immediately apply the font to the document so editors reflect the change
    const fontFamily = getEditorFontFamily(id);
    document.documentElement.style.setProperty('--editor-font-family', fontFamily);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- ═══════════════════════════════════════════════════════════════════
     FONT PREFERENCE PANEL — Full-page overlay
     Lets users select between Anytype (Plex) and Instrument Serif fonts.
══════════════════════════════════════════════════════════════════════ -->
<div class="font-pref-overlay" role="dialog" aria-modal="true" aria-label="Font preference">
  <button class="font-pref-scrim" onclick={onclose} aria-label="Close" tabindex="-1"></button>

  <div class="font-pref-panel">
    <div class="font-pref-header">
      <div>
        <div class="font-pref-eyebrow">Typography</div>
        <h2>Editor Font</h2>
      </div>
      <button class="font-pref-close" onclick={onclose} aria-label="Close">
        <X size={18} />
      </button>
    </div>

    <div class="font-pref-body">
      <p class="font-pref-desc">
        Choose the typeface used in your journal and notes editors.
      </p>

      <div class="font-pref-list">
        {#each fontPairings.filter(f => f.id === 'anytype' || f.id === 'instrument-serif') as pairing}
          <button
            class="font-pref-card"
            class:font-pref-card--active={currentId === pairing.id}
            onclick={() => selectFont(pairing.id)}
          >
            <div class="font-pref-card-preview" style="font-family: {pairing.body};">
              <span class="font-pref-preview-text">Aa</span>
              <span class="font-pref-preview-sub">The quick brown fox jumps over the lazy dog</span>
            </div>
            <div class="font-pref-card-info">
              <span class="font-pref-card-name">{pairing.name}</span>
              {#if pairing.id === 'anytype'}
                <span class="font-pref-card-desc">IBM Plex Sans — clean, legible, modern</span>
              {:else if pairing.id === 'instrument-serif'}
                <span class="font-pref-card-desc">Instrument Serif — warm, personal, diary-like</span>
              {/if}
            </div>
            {#if currentId === pairing.id}
              <div class="font-pref-check" aria-label="Selected">✓</div>
            {/if}
          </button>
        {/each}
      </div>

      <p class="font-pref-footnote">
        Currently using: <strong>{getFontPairingName(currentId)}</strong>
      </p>
    </div>
  </div>
</div>

<style>
  .font-pref-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  .font-pref-scrim {
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

  .font-pref-panel {
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

  .font-pref-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--border);
    padding: 1.15rem 1.25rem;
  }

  .font-pref-eyebrow {
    margin: 0 0 0.2rem;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .font-pref-header h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--foreground);
  }

  .font-pref-close {
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

  .font-pref-close:hover {
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
  }

  .font-pref-body {
    padding: 1.25rem;
    overflow-y: auto;
    display: grid;
    gap: 1rem;
  }

  .font-pref-desc {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
    line-height: 1.5;
    max-width: 32rem;
  }

  .font-pref-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .font-pref-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1rem 1.15rem;
    border: 1px solid var(--border);
    border-radius: 1.15rem;
    background: color-mix(in srgb, var(--surface) 90%, var(--background));
    color: var(--foreground);
    cursor: default;
    text-align: left;
    transition: border-color 150ms ease, background 150ms ease;
  }

  .font-pref-card:hover {
    border-color: color-mix(in srgb, var(--primary) 36%, var(--border));
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  }

  .font-pref-card--active {
    border-color: color-mix(in srgb, var(--primary) 58%, var(--border)) !important;
    background: color-mix(in srgb, var(--primary) 10%, var(--surface)) !important;
  }

  .font-pref-card-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 4rem;
    flex-shrink: 0;
  }

  .font-pref-preview-text {
    font-size: 1.8rem;
    font-weight: 600;
    line-height: 1;
    color: var(--foreground);
  }

  .font-pref-preview-sub {
    font-size: 0.6rem;
    color: var(--muted);
    line-height: 1.2;
    text-align: center;
    max-width: 6rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .font-pref-card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .font-pref-card-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .font-pref-card-desc {
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.3;
  }

  .font-pref-check {
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

  .font-pref-footnote {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    text-align: center;
  }

  .font-pref-footnote strong {
    color: var(--foreground);
  }
</style>
