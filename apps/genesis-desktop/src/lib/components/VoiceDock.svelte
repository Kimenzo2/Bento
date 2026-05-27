<script lang="ts">
  import { browser } from '$app/environment';
  import MicIcon from '@lucide/svelte/icons/mic';
  import SquareIcon from '@lucide/svelte/icons/square';
  import WandSparklesIcon from '@lucide/svelte/icons/wand-sparkles';
  import LanguagesIcon from '@lucide/svelte/icons/languages';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import { Button } from '$lib/components/ui/button/index.js';
  import { activeModule } from '$lib/desktop/modules';
  import {
    chooseLocalTranscriptionModel,
    dictationError,
    dictationStatus,
    dictationTranscript,
    insertTranscriptIntoFocusedElement,
    transcriptionLanguage,
    transcriptionModelPath,
    toggleDictation,
    voiceDockOpen,
  } from '$lib/services/voice-dictation';

  const statusLabel = $derived.by(() => {
    const state = $dictationStatus;
    if (state === 'recording') return 'Recording locally';
    if (state === 'transcribing') return 'Transcribing on device';
    if (state === 'ready') return 'Ready';
    if (state === 'error') return 'Error';
    return 'Idle';
  });

  const modelLabel = $derived.by(() => {
    const path = $transcriptionModelPath.trim();
    if (!path) return 'Choose local model';
    const segments = path.split(/[/\\]/);
    return segments[segments.length - 1] || 'Local model';
  });

  let languageDraft = $state('');

  $effect(() => {
    languageDraft = $transcriptionLanguage;
  });

  function syncLanguage(value: string) {
    languageDraft = value;
    transcriptionLanguage.set(value);
  }

  async function handleToggleDictation() {
    dictationError.set('');
    try {
      await toggleDictation();
    } catch (error) {
      dictationError.set(error instanceof Error ? error.message : 'Dictation failed.');
      dictationStatus.set('error');
    }
  }

  async function handleInsertTranscript() {
    const transcript = $dictationTranscript.trim();
    if (!transcript) return;
    const inserted = await insertTranscriptIntoFocusedElement(transcript);
    if (inserted) {
      dictationError.set('');
      return;
    }

    dictationError.set('Transcript copied to clipboard. Focus an editor to paste it.');
  }

  async function handleChooseModel() {
    dictationError.set('');
    try {
      await chooseLocalTranscriptionModel();
    } catch (error) {
      dictationError.set(error instanceof Error ? error.message : 'Could not choose model.');
      dictationStatus.set('error');
    }
  }
</script>

{#if browser}
  <div class="voice-dock { $voiceDockOpen ? 'voice-dock--open' : 'voice-dock--closed' }">
    <button
      class="voice-dock__launcher"
      type="button"
      aria-label="Toggle dictation dock"
      onclick={() => voiceDockOpen.update((value) => !value)}
    >
      <MicIcon size={17} />
    </button>

    {#if $voiceDockOpen}
      <section class="voice-dock__panel" aria-label="Local dictation controls">
        <header class="voice-dock__header">
          <div>
            <p class="voice-dock__eyebrow">Dictation</p>
            <h2>Local voice dock</h2>
          </div>
          <button class="voice-dock__collapse" type="button" aria-label="Collapse dictation dock" onclick={() => voiceDockOpen.set(false)}>
            <ChevronDownIcon size={15} />
          </button>
        </header>

        <p class="voice-dock__status">{statusLabel}</p>
        <p class="voice-dock__module">Current module: {$activeModule}</p>

        <div class="voice-dock__row">
          <Button variant="outline" onclick={handleChooseModel}>
            <WandSparklesIcon size={15} />
            <span>{modelLabel}</span>
          </Button>

          <label class="voice-dock__language">
            <LanguagesIcon size={15} />
            <input
              type="text"
              spellcheck="false"
              placeholder="en"
              value={languageDraft}
              oninput={(event) => syncLanguage((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
        </div>

        <div class="voice-dock__controls">
          <Button
            variant={$dictationStatus === 'recording' ? 'secondary' : 'default'}
            onclick={handleToggleDictation}
          >
            {#if $dictationStatus === 'recording'}
              <SquareIcon size={16} />
              Stop
            {:else}
              <MicIcon size={16} />
              Start dictation
            {/if}
          </Button>

          <Button
            variant="outline"
            disabled={!$dictationTranscript.trim()}
            onclick={handleInsertTranscript}
          >
            <ClipboardListIcon size={16} />
            Insert
          </Button>
        </div>

        {#if $dictationTranscript.trim()}
          <div class="voice-dock__transcript">
            <div class="voice-dock__transcript-head">
              <FileTextIcon size={15} />
              <span>Transcript</span>
            </div>
            <p>{ $dictationTranscript }</p>
          </div>
        {/if}

        {#if $dictationError}
          <p class="voice-dock__error">{ $dictationError }</p>
        {/if}
      </section>
    {/if}
  </div>
{/if}

<style>
  .voice-dock {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 80;
    display: flex;
    align-items: flex-end;
    gap: 12px;
    pointer-events: none;
  }

  .voice-dock--closed {
    pointer-events: none;
  }

  .voice-dock__launcher,
  .voice-dock__collapse {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--border, rgba(255,255,255,0.08)) 92%, transparent);
    background: color-mix(in srgb, var(--background, #0b0b0b) 92%, transparent);
    color: var(--foreground, #f5f5f5);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
  }

  .voice-dock__launcher {
    width: 52px;
    height: 52px;
    border-radius: 999px;
  }

  .voice-dock__panel {
    width: min(360px, calc(100vw - 92px));
    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--border, rgba(255,255,255,0.08)) 90%, transparent);
    background: color-mix(in srgb, var(--background, #0b0b0b) 88%, transparent);
    backdrop-filter: blur(22px);
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.4);
    padding: 16px;
    pointer-events: auto;
  }

  .voice-dock__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .voice-dock__eyebrow {
    margin: 0 0 4px;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--muted-foreground, rgba(255,255,255,0.55)) 88%, transparent);
  }

  .voice-dock__header h2 {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 650;
    color: var(--foreground, #f5f5f5);
  }

  .voice-dock__collapse {
    width: 32px;
    height: 32px;
    border-radius: 999px;
  }

  .voice-dock__status,
  .voice-dock__module,
  .voice-dock__error {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.35;
  }

  .voice-dock__status {
    color: var(--foreground, #f5f5f5);
    margin-bottom: 2px;
  }

  .voice-dock__module {
    color: color-mix(in srgb, var(--muted-foreground, rgba(255,255,255,0.6)) 92%, transparent);
    margin-bottom: 12px;
  }

  .voice-dock__row,
  .voice-dock__controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .voice-dock__row {
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .voice-dock__language {
    width: 84px;
    min-width: 84px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    height: 36px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--border, rgba(255,255,255,0.08)) 88%, transparent);
    background: color-mix(in srgb, var(--background, #0b0b0b) 86%, transparent);
    color: var(--foreground, #f5f5f5);
  }

  .voice-dock__language input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  .voice-dock__controls {
    margin-top: 2px;
  }

  .voice-dock__controls :global(button) {
    flex: 1 1 0;
    justify-content: center;
    gap: 8px;
  }

  .voice-dock__row :global(button) {
    flex: 1 1 auto;
    justify-content: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .voice-dock__row :global(button span) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .voice-dock__transcript {
    margin-top: 12px;
    padding: 12px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--background, #0b0b0b) 80%, transparent);
    border: 1px solid color-mix(in srgb, var(--border, rgba(255,255,255,0.08)) 88%, transparent);
  }

  .voice-dock__transcript-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--muted-foreground, rgba(255,255,255,0.55)) 88%, transparent);
  }

  .voice-dock__transcript p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--foreground, #f5f5f5);
    max-height: 120px;
    overflow: auto;
  }

  .voice-dock__error {
    margin-top: 10px;
    color: #ff8f8f;
  }
</style>
