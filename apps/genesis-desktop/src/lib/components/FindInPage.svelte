<script lang="ts">
  import { Search, ChevronUp, ChevronDown, X } from 'lucide-svelte';

  interface Match {
    blockId: string;
    text: string;
    start: number;
    end: number;
  }

  let {
    show = false,
    query: _initialQuery = '',
    onClose = () => {},
    onFind = (query: string) => {},
    onNext = () => {},
    onPrevious = () => {},
    matchCount = 0,
    currentMatch = 0,
  } = $props();

  // svelte-ignore state_referenced_locally
  let query = $state(_initialQuery);
  let inputEl = $state<HTMLInputElement | null>(null);

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
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'Escape') {
      onClose();
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
</script>

{#if show}
  <div class="find-in-page" role="search" aria-label="Find in note">
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
      <button class="find-btn find-close" onclick={() => onClose()} aria-label="Close find" title="Close" type="button">
        <X size={14} />
      </button>
    </div>
  </div>
{/if}

<style>
  .find-in-page {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
    background: color-mix(in srgb, var(--foreground) 2%, var(--background));
    flex-shrink: 0;
    animation: find-in 0.12s ease;
  }

  @keyframes find-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
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

  .find-close:hover {
    color: var(--destructive, #ef4444);
    background: color-mix(in srgb, var(--destructive, #ef4444) 8%, transparent);
  }
</style>
