<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { fade, slide } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import LinkIcon from "@lucide/svelte/icons/link";
  import PinIcon from "@lucide/svelte/icons/pin";
  import PinOffIcon from "@lucide/svelte/icons/pin-off";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { deleteFromIndex, indexContent, searchInModule } from "$lib/services/search";
  import { time } from "$lib/utils/time";

  type ClipItem = {
    id: string;
    text: string;
    type: "text" | "link" | "code";
    pinned: boolean;
    created: number;
  };

  let items = $state<ClipItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let search = $state("");
  let copiedId = $state<string | null>(null);
  let showClearConfirm = $state(false);
  let searchResults = $state<ClipItem[] | null>(null);
  let searchBusy = $state(false);
  let searchError = $state<string | null>(null);

  const STORAGE_KEY = "bento_clipboard";
  let lastClipboardText = "";

  function load() {
    try {
      const raw = browser ? localStorage.getItem(STORAGE_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : [];
      items = Array.isArray(parsed) ? parsed : [];
      items = items
        .filter((item): item is ClipItem => Boolean(item?.id && item?.text))
        .map((item) => ({
          id: String(item.id),
          text: String(item.text),
          pinned: Boolean(item.pinned),
          type:
            item.type === "link" || item.type === "code"
              ? item.type
              : detectType(String(item.text)),
          created: Number(item.created ?? time.now()),
        }))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created - a.created);
      lastClipboardText = items[0]?.text ?? "";
    } catch {
      error = "Failed to load clipboard history";
      items = [];
      lastClipboardText = "";
    } finally {
      loading = false;
    }
  }

  function detectType(text: string): ClipItem["type"] {
    if (text.startsWith("http://") || text.startsWith("https://")) return "link";
    if (text.includes("{") || text.includes("function") || text.includes("=>") || text.includes("class "))
      return "code";
    return "text";
  }

  function persist() {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function toSearchDocument(item: ClipItem) {
    return {
      moduleId: "clipboard",
      id: item.id,
      title: item.text.slice(0, 120),
      body: item.text,
      tags: [item.type, item.pinned ? "pinned" : "unpinned"],
      projects: [],
      kind: "clipboard",
      createdAt: item.created,
      updatedAt: item.created,
      sourceRef: item.id,
      extra: {
        pinned: item.pinned,
        type: item.type,
        created: item.created,
      },
    };
  }

  function fromSearchDocument(document: { id: string; title: string; body: string; extra?: Record<string, unknown> | null; createdAt?: number | null; }) {
    const pinned = Boolean(document.extra && typeof document.extra.pinned === "boolean" ? document.extra.pinned : false);
    const text = document.body?.trim() || document.title?.trim() || "";
    return {
      id: document.id,
      text,
      type: detectType(text),
      pinned,
      created: Number(document.createdAt ?? time.now()),
    } satisfies ClipItem;
  }

  async function syncItemIndex(item: ClipItem) {
    try {
      await indexContent(toSearchDocument(item));
    } catch {
      // ignore search indexing failures; clipboard history must remain usable
    }
  }

  async function removeItemIndex(id: string) {
    try {
      await deleteFromIndex("clipboard", id);
    } catch {
      // ignore
    }
  }

  async function syncAllItemsIndex() {
    await Promise.all(items.map((item) => syncItemIndex(item)));
  }

  function normalizeClipboardText(text: string) {
    return text.replace(/\u0000/g, "").trim();
  }

  function captureText(text: string) {
    const normalized = normalizeClipboardText(text);
    if (!normalized || normalized === lastClipboardText) return;

    const nextItem: ClipItem = {
      id: crypto.randomUUID(),
      text: normalized,
      type: detectType(normalized),
      pinned: false,
      created: time.now(),
    };

    items = [nextItem, ...items].slice(0, 250);
    lastClipboardText = normalized;
    persist();
    void syncItemIndex(nextItem);
  }

  async function copyItem(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      lastClipboardText = normalizeClipboardText(text);
      copiedId = id;
      setTimeout(() => (copiedId = null), 1200);
    } catch { /* silent */ }
  }

  function togglePin(id: string) {
    const next = items
      .map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created - a.created);
    items = next;
    persist();
    const updated = next.find((i) => i.id === id);
    if (updated) void syncItemIndex(updated);
  }

  function deleteItem(id: string) {
    items = items.filter((i) => i.id !== id);
    persist();
    void removeItemIndex(id);
  }

  function clearAll() {
    const toDelete = items;
    items = [];
    lastClipboardText = "";
    persist();
    void Promise.all(toDelete.map((item) => removeItemIndex(item.id)));
    showClearConfirm = false;
  }

  function formatTime(ts: number) {
    const diff = time.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  const filtered = $derived.by(() => {
    const result = search.trim() ? (searchResults ?? []) : items;
    const pinned = result.filter((i) => i.pinned);
    const rest = result.filter((i) => !i.pinned);
    return [...pinned, ...rest];
  });

  const totalItems = $derived(items.length);
  const pinnedCount = $derived(items.filter((i) => i.pinned).length);

  let _t = $derived.by(() => createTranslator($activeBundle));

  let pollInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    load();
    const syncClipboard = async () => {
      if (!browser || !navigator?.clipboard?.readText) return;
      try {
        const text = await navigator.clipboard.readText();
        if (text) captureText(text);
      } catch {
        // Clipboard reads can be denied by the host OS; ignore silently.
      }
    };

    syncClipboard();
    pollInterval = setInterval(syncClipboard, 1200);
  });

  $effect(() => {
    if (!browser) return;
    const query = search.trim();
    if (!query) {
      searchResults = null;
      searchError = null;
      searchBusy = false;
      return;
    }

    let cancelled = false;
    searchBusy = true;
    searchError = null;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchInModule("clipboard", {
          query,
          limit: 100,
          fuzzy: true,
        });
        if (cancelled) return;
        searchResults = hits.map(({ document }) => fromSearchDocument(document));
      } catch (error) {
        if (cancelled) return;
        searchError = error instanceof Error ? error.message : "Search failed";
        searchResults = [];
      } finally {
        if (!cancelled) searchBusy = false;
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  $effect(() => {
    if (!browser || items.length === 0) return;
    void syncAllItemsIndex();
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<main class="clip-workspace module-root" data-module="clipboard">
  <section class="clip-shell">
    <header class="clip-shell__header">
      <div class="clip-shell__intro">
        <div class="clip-shell__eyebrow">
          <span>{_t('moduleClipboardTitle')}</span>
          <Badge variant="outline">{totalItems} items{pinnedCount > 0 ? `, ${pinnedCount} pinned` : ""}</Badge>
        </div>
        <h1>{_t('moduleClipboardDesc')}</h1>
        <p>{_t('moduleClipboardDesc2')}</p>
      </div>
      <div class="clip-shell__actions">
        {#if items.length > 0}
          <Button variant="outline" onclick={() => (showClearConfirm = true)}>
            <Trash2Icon data-icon="inline-start" />
            {_t('moduleClipboardClearAll')}
          </Button>
        {/if}
      </div>
    </header>

    <!-- Search -->
    {#if items.length > 0 && !loading}
      <div class="clip-search" transition:fade>
        <div class="clip-search-wrapper">
          <SearchIcon size={16} class="clip-search-icon" />
          <input
            type="text"
            class="clip-input"
            bind:value={search}
            placeholder={_t('moduleClipboardSearchPlaceholder')}
          />
        </div>
      </div>
    {/if}

    <!-- Loading -->
    {#if loading}
      <div class="clip-shell__loading">
        {#each [1, 2, 3, 4] as _}
          <div class="clip-skeleton"></div>
        {/each}
      </div>

    <!-- Error -->
    {:else if error}
      <Card class="clip-panel">
        <CardContent>
          <p>{error}</p>
          <Button variant="outline" onclick={load}>{_t('commonRetry')}</Button>
        </CardContent>
      </Card>

    <!-- Empty -->
    {:else if items.length === 0}
      <Card class="clip-panel clip-panel--state">
        <CardContent>
          <div class="clip-state">
            <span class="clip-state-icon">📋</span>
            <h2 class="clip-state-title">{_t('moduleClipboardEmpty')}</h2>
            <p class="clip-state-desc">{_t('moduleClipboardEmptyDesc')}</p>
            <div class="clip-hint">{_t('moduleClipboardHint')}</div>
          </div>
        </CardContent>
      </Card>

    <!-- List -->
    {:else}
      <section class="clip-shell__body">
        {#if filtered.length === 0}
          <Card class="clip-panel">
            <CardContent>
              <p>{_t('moduleClipboardNoResults').replace('{q}', search)}</p>
            </CardContent>
          </Card>
        {:else}
          <div class="clip-list" transition:fade>
            {#each filtered as item (item.id)}
              <article class="clip-item" transition:slide={{ duration: 100 }}>
                <div class="clip-item__left" role="button" tabindex="0" onclick={() => copyItem(item.text, item.id)} onkeydown={(e) => e.key === "Enter" && copyItem(item.text, item.id)}>
                  <span class="clip-item__type">
                    {item.type === "link" ? "🔗" : item.type === "code" ? "💻" : "📝"}
                  </span>
                  <div class="clip-item__content">
                    <p class="clip-item__text">{item.text}</p>
                    <span class="clip-item__meta">{formatTime(item.created)}</span>
                  </div>
                </div>
                <div class="clip-item__actions">
                  {#if copiedId === item.id}
                    <Badge variant="outline">{_t('moduleClipboardCopied')}</Badge>
                  {:else}
                    <button type="button" class="clip-item__btn" onclick={() => copyItem(item.text, item.id)} title={_t('commonCopy')}>
                      <CopyIcon size={15} />
                    </button>
                  {/if}
                  <button type="button" class="clip-item__btn" class:pinned={item.pinned} onclick={() => togglePin(item.id)} title={item.pinned ? _t('commonUnpin') : _t('commonPin')}>
                    {#if item.pinned}
                      <PinIcon size={15} />
                    {:else}
                      <PinOffIcon size={15} />
                    {/if}
                  </button>
                  <button type="button" class="clip-item__btn clip-item__btn--danger" onclick={() => deleteItem(item.id)} title={_t('commonDelete')}>
                    <Trash2Icon size={15} />
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </section>
</main>

<!-- Clear confirmation overlay -->
{#if showClearConfirm}
  <div class="clip-overlay" transition:fade onclick={() => (showClearConfirm = false)} role="presentation"></div>
  <div class="clip-confirm" transition:fade={{ duration: 150 }}>
    <p>{_t('moduleClipboardClearConfirm').replace('{n}', String(totalItems))}</p>
    <div class="clip-confirm-actions">
      <Button variant="destructive" onclick={clearAll}>{_t('moduleClipboardYesClear')}</Button>
      <Button variant="ghost" onclick={() => (showClearConfirm = false)}>{_t('commonCancel')}</Button>
    </div>
  </div>
{/if}

<style>
  :global(.clip-workspace) {
    --clip-bg: var(--background);
    --clip-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --clip-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --clip-border: color-mix(in srgb, var(--border) 86%, transparent);
    --clip-ink: var(--foreground);
    --clip-muted: var(--muted);
    --clip-accent: var(--primary);
    height: 100%;
    padding: 28px 30px;
    background: var(--clip-bg);
    color: var(--clip-ink);
    overflow: hidden;
    font-family: var(--font-body);
  }

  :global(.clip-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.clip-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.clip-shell__intro) { max-width: 56rem; }

  :global(.clip-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
    color: var(--clip-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.clip-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    line-height: 1.04;
  }

  :global(.clip-shell__intro) p {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--clip-muted);
  }

  :global(.clip-shell__actions) { display: flex; gap: 12px; }

  :global(.clip-search) { margin-bottom: 0; }

  :global(.clip-search-wrapper) {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.clip-search-icon) {
    position: absolute;
    left: 14px;
    color: var(--clip-muted);
    pointer-events: none;
  }

  :global(.clip-input) {
    width: 100%;
    padding: 10px 14px 10px 40px;
    border-radius: 12px;
    border: 1px solid var(--clip-border);
    background: var(--clip-surface);
    color: var(--clip-ink);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
  }
  :global(.clip-input:focus) { border-color: var(--clip-accent); }
  :global(.clip-input::placeholder) { color: var(--clip-muted); }

  :global(.clip-shell__loading) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.clip-skeleton) {
    height: 52px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--clip-border) 72%, transparent);
    animation: clip-pulse 1.5s infinite;
  }

  @keyframes clip-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  :global(.clip-panel) {
    border-color: var(--clip-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--clip-surface) 98%, var(--background)),
        color-mix(in srgb, var(--clip-surface) 86%, var(--background))
      );
  }

  :global(.clip-panel--state) :global(.card-content) {
    display: flex;
    justify-content: center;
  }

  :global(.clip-state) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 40px 20px;
  }

  :global(.clip-state-icon) { font-size: 48px; }
  :global(.clip-state-title) { font-size: 18px; font-weight: 600; margin: 0; color: var(--clip-ink); }
  :global(.clip-state-desc) { font-size: 14px; color: var(--clip-muted); margin: 0; max-width: 320px; }

  :global(.clip-hint) {
    padding: 10px 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--clip-accent) 10%, var(--clip-surface));
    font-size: 13px;
    color: var(--clip-muted);
  }

  :global(.clip-shell__body),
  :global(.clip-panel),
  :global(.clip-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.clip-shell__body) {
    overflow: auto;
  }

  :global(.clip-list) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.clip-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid color-mix(in srgb, var(--clip-border) 92%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--clip-surface-strong) 92%, transparent);
    transition: border-color 0.15s;
  }
  :global(.clip-item:hover) { border-color: var(--clip-accent); }

  :global(.clip-item__left) {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  :global(.clip-item__type) { font-size: 16px; flex-shrink: 0; }

  :global(.clip-item__content) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  :global(.clip-item__text) {
    font-size: 13px;
    color: var(--clip-ink);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.clip-item__meta) { font-size: 11px; color: var(--clip-muted); }

  :global(.clip-item__actions) { display: flex; gap: 4px; align-items: center; }

  :global(.clip-item__btn) {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--clip-muted);
    transition: all 0.15s;
  }
  :global(.clip-item__btn:hover) { background: color-mix(in srgb, var(--clip-ink) 8%, transparent); color: var(--clip-ink); }
  :global(.clip-item__btn--danger) { color: var(--destructive, #ef4444); }
  :global(.clip-item__btn--danger:hover) { background: rgba(239, 68, 68, 0.1); }
  :global(.pinned) { color: var(--clip-accent); }

  :global(.clip-overlay) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  :global(.clip-confirm) {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: var(--clip-surface);
    border: 1px solid var(--clip-border);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: min(360px, 90vw);
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
  }
  :global(.clip-confirm) p { font-size: 16px; font-weight: 600; margin: 0; }
  :global(.clip-confirm-actions) { display: flex; gap: 8px; }
</style>
