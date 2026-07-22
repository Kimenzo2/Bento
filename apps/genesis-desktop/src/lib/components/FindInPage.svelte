<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, ChevronUp, ChevronDown, X } from 'lucide-svelte';

  let {
    show = false,
    query: initialQuery = '',
    onClose = () => {},
    onFind = (query: string) => {},
    onNext = () => {},
    onPrevious = () => {},
    onReplace = (replace: string) => {},
    onReplaceAll = (replace: string) => {},
    matchCount = 0,
    currentMatch = 0,
  } = $props();

  let query = $state('');

  onMount(() => { query = initialQuery; });
  let replaceQuery = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  let replaceInputEl = $state<HTMLInputElement | null>(null);
  let showReplace = $state(true);

  let findTimer: ReturnType<typeof setTimeout>;
  function handleInput(val: string) {
    query = val;
    clearTimeout(findTimer);
    findTimer = setTimeout(() => onFind(val), 120);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onPrevious();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (matchCount > 0 && showReplace) onReplace(replaceQuery);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function handleReplaceKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (matchCount > 0) onReplace(replaceQuery);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      if (matchCount > 0) onReplaceAll(replaceQuery);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchCount > 0) onReplace(replaceQuery);
    }
  }

  let countLabel = $derived(
    query ? (matchCount > 0 ? `${currentMatch + 1} of ${matchCount}` : 'No matches') : ''
  );

  $effect(() => {
    if (show) {
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  function toggleReplace() {
    showReplace = !showReplace;
    if (showReplace) {
      requestAnimationFrame(() => replaceInputEl?.focus());
    }
  }
</script>

{#if show}
  <div class="find-bar" role="search" aria-label="Find in note">
    <div class="find-row">
      <div class="find-input-wrap">
        <Search size={13} class="find-icon" />
        <input
          bind:this={inputEl}
          class="find-input"
          type="text"
          placeholder="Find in note…"
          value={query}
          oninput={(e) => handleInput(e.currentTarget.value)}
          onkeydown={handleKeyDown}
          autocomplete="off"
          spellcheck={false}
        />
        {#if countLabel}
          <span class="find-count">{countLabel}</span>
        {/if}
      </div>
      <div class="find-actions">
        <button class="find-btn" onclick={() => onPrevious()} disabled={!matchCount} aria-label="Previous match" title="Previous match" type="button">
          <ChevronUp size={14} />
        </button>
        <button class="find-btn" onclick={() => onNext()} disabled={!matchCount} aria-label="Next match" title="Next match" type="button">
          <ChevronDown size={14} />
        </button>
        <button class="find-btn replace-toggle" onclick={toggleReplace} class:active={showReplace} disabled={!query} aria-label="Replace" title="Replace" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/><path d="M20 10c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/><path d="M4 16c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/><path d="M4 21c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/><path d="m18 12-4-4M14 8l-4 4"/></svg>
        </button>
        <button class="find-btn find-close" onclick={() => onClose()} aria-label="Close find" title="Close" type="button">
          <X size={14} />
        </button>
      </div>
    </div>
    {#if showReplace}
      <div class="replace-row">
        <div class="replace-input-wrap">
          <input
            bind:this={replaceInputEl}
            class="replace-input"
            type="text"
            placeholder="Replace with…"
            bind:value={replaceQuery}
            onkeydown={handleReplaceKeyDown}
            autocomplete="off"
            spellcheck={false}
          />
        </div>
        <div class="replace-actions">
          <button class="replace-btn" onclick={() => onReplace(replaceQuery)} disabled={!matchCount} aria-label="Replace" title="Replace" type="button">
            Replace
          </button>
          <button class="replace-btn" onclick={() => onReplaceAll(replaceQuery)} disabled={!matchCount} aria-label="Replace All" title="Replace All" type="button">
            Replace All
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .find-bar {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    background: color-mix(in srgb, var(--foreground) 2%, var(--background));
    flex-shrink: 0;
    animation: find-in 0.12s ease;
  }
  @keyframes find-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .find-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
  }
  .find-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border-radius: 8px;
    padding: 0 8px;
    height: 30px;
  }
  .find-icon {
    flex-shrink: 0;
    color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }
  .find-input {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    color: var(--foreground);
    font: inherit;
    font-size: 12.5px;
    outline: none;
    min-width: 0;
  }
  .find-input::placeholder {
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }
  .find-count {
    font-size: 11px;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .find-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .find-btn {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--foreground) 55%, transparent);
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
    padding: 0;
  }
  .find-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }
  .find-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .find-btn.active {
    color: var(--accent, #6366f1);
    background: color-mix(in srgb, var(--accent, #6366f1) 10%, transparent);
  }
  .find-close:hover {
    color: var(--destructive, #ef4444);
    background: color-mix(in srgb, var(--destructive, #ef4444) 8%, transparent);
  }
  .replace-toggle svg {
    transition: transform 120ms ease;
  }
  .replace-toggle.active svg {
    transform: rotate(45deg);
  }
  .replace-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px 6px;
  }
  .replace-input-wrap {
    display: flex;
    align-items: center;
    flex: 1;
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
    border-radius: 8px;
    padding: 0 8px;
    height: 30px;
  }
  .replace-input {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    color: var(--foreground);
    font: inherit;
    font-size: 12.5px;
    outline: none;
    min-width: 0;
  }
  .replace-input::placeholder {
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }
  .replace-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .replace-btn {
    all: unset;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    color: color-mix(in srgb, var(--foreground) 65%, transparent);
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
    white-space: nowrap;
  }
  .replace-btn:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--foreground);
  }
  .replace-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
