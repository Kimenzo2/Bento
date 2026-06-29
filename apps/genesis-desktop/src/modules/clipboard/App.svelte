<script lang="ts">
  import "./clipboard.css";
  import ClipboardImage from "./ClipboardImage.svelte";
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { ensureModuleSection, getModuleSectionLabel, setModuleSection, moduleSectionStore } from "$lib/stores/module-sections.store";
import { time } from "$lib/utils/time";
  import SearchIcon        from "@lucide/svelte/icons/search";
  import PinIcon           from "@lucide/svelte/icons/pin";
  import PinOffIcon        from "@lucide/svelte/icons/pin-off";
  import CopyIcon          from "@lucide/svelte/icons/copy";
  import Trash2Icon        from "@lucide/svelte/icons/trash-2";
  import ShieldIcon        from "@lucide/svelte/icons/shield";
  import EyeIcon           from "@lucide/svelte/icons/eye";
  import ImageIcon         from "@lucide/svelte/icons/image";
  import LayoutGridIcon    from "@lucide/svelte/icons/layout-grid";
  import Link2Icon         from "@lucide/svelte/icons/link-2";
  import CodeIcon          from "@lucide/svelte/icons/code";
  import TypeIcon          from "@lucide/svelte/icons/type";
  import StarIcon          from "@lucide/svelte/icons/star";
  import XIcon             from "@lucide/svelte/icons/x";
  import ZoomInIcon        from "@lucide/svelte/icons/zoom-in";
  import CheckIcon         from "@lucide/svelte/icons/check";
  import ClockIcon         from "@lucide/svelte/icons/clock";
  import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";


  const moduleId = "clipboard";
  const sectionLabels = ["History", "Pinned", "Snippets", "Images", "Sensitive", "Settings"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  // ── Types ─────────────────────────────────────────────────────────
  type ClipKind = "text" | "code" | "link" | "image" | "sensitive";

  interface ClipEntry {
    id: string;
    kind: ClipKind;
    content: string;
    contentHash: string;
    preview?: string;
    timestamp: number;
    pinned: boolean;
    favorite: boolean;
    isSensitive: boolean;
    revealed: boolean;
    source?: string;
    byteSize?: number;
  }

  // ── State ─────────────────────────────────────────────────────────
  let clips       = $state<ClipEntry[]>([]);
  let searchQuery = $state("");
  let activeId    = $state<string | null>(null);
  let lightboxHash = $state<string | null>(null);
  let copyFeedback= $state<string | null>(null);
  let loading     = $state(true);
  let pasteMode   = $state<"plain" | "rich" | "image">("plain");
  let imageLayout = $state<"grid" | "masonry">("grid");
  let unlisten: (() => void) | null = null;


  // ── Derived ───────────────────────────────────────────────────────
  const activeClip = $derived(clips.find(c => c.id === activeId) ?? null);

  const filtered = $derived.by(() => {
    let pool = clips;
    if (selectedSection === "Pinned")   pool = pool.filter(c => c.pinned);
    else if (selectedSection === "Images")   pool = pool.filter(c => c.kind === "image");
    else if (selectedSection === "Snippets") pool = pool.filter(c => c.kind === "text" || c.kind === "code");
    else if (selectedSection === "Sensitive") pool = pool.filter(c => c.isSensitive);

    const q = searchQuery.trim().toLowerCase();
    if (q) pool = pool.filter(c =>
      c.content.toLowerCase().includes(q) || c.preview?.toLowerCase().includes(q)
    );

    return [...pool].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────
  function makePreview(entry: ClipEntry): string {
    if (entry.kind === "image") return "[Image]";
    const s = entry.content.replace(/\s+/g, " ").trim();
    return s.length > 120 ? s.slice(0, 117) + "…" : s;
  }



  function formatBytes(b?: number): string {
    if (!b) return "";
    if (b < 1024) return `${b} B`;
    if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(1)} MB`;
  }

  function kindColor(kind: ClipKind): string {
    const map: Record<ClipKind, string> = {
      text: "var(--cb-ink)", code: "var(--cb-code)", link: "var(--cb-link)",
      image: "var(--cb-image)", sensitive: "var(--cb-sensitive)",
    };
    return map[kind];
  }

  function kindIcon(kind: ClipKind) {
    const map: Record<ClipKind, any> = {
      text: TypeIcon, code: CodeIcon, link: Link2Icon,
      image: ImageIcon, sensitive: ShieldIcon,
    };
    return map[kind];
  }

  function kindLabel(kind: ClipKind): string {
    const map: Record<ClipKind, string> = {
      text: "Text", code: "Code", link: "Link", image: "Image", sensitive: "Sensitive",
    };
    return map[kind];
  }

  // ── Backend ───────────────────────────────────────────────────────
  async function loadHistory() {
    loading = true;
    try {
      const rows = await invoke<ClipEntry[]>("clipboard_list", { limit: 100 });
      clips = rows;
      if (clips.length > 0 && !activeId) activeId = clips[0].id;
    } catch {
      clips = [];
    } finally {
      loading = false;
    }
  }

  async function copyClip(id: string, mode: "plain" | "rich" | "image" = "plain") {
    const clip = clips.find(c => c.id === id);
    if (!clip) return;
    try {
      await invoke("clipboard_copy", { id, mode });
    } catch {
      if (clip.kind !== "image") {
        await navigator.clipboard.writeText(clip.content).catch(() => {});
      }
    }
    copyFeedback = id;
    setTimeout(() => { if (copyFeedback === id) copyFeedback = null; }, 1400);
  }

  async function togglePin(id: string) {
    const i = clips.findIndex(c => c.id === id);
    if (i === -1) return;
    const pinned = !clips[i].pinned;
    clips[i] = { ...clips[i], pinned };
    try { await invoke("clipboard_pin", { id, pinned }); } catch {}
  }

  async function toggleFavorite(id: string) {
    const i = clips.findIndex(c => c.id === id);
    if (i === -1) return;
    clips[i] = { ...clips[i], favorite: !clips[i].favorite };
    try { await invoke("clipboard_favorite", { id, favorite: clips[i].favorite }); } catch {}
  }

  async function deleteClip(id: string) {
    clips = clips.filter(c => c.id !== id);
    if (activeId === id) activeId = clips[0]?.id ?? null;
    try { await invoke("clipboard_delete", { id }); } catch {}
  }

  async function clearAll() {
    if (!confirm("Clear non-pinned history?")) return;
    const pinned = clips.filter(c => c.pinned);
    clips = pinned;
    if (activeId && !pinned.find(c => c.id === activeId)) {
      activeId = pinned[0]?.id ?? null;
    }
    try { await invoke("clipboard_clear_unpinned"); } catch {}
  }

  function revealSensitive(id: string) {
    const i = clips.findIndex(c => c.id === id);
    if (i === -1) return;
    clips[i] = { ...clips[i], revealed: true };
    setTimeout(() => {
      const j = clips.findIndex(c => c.id === id);
      if (j !== -1) clips[j] = { ...clips[j], revealed: false };
    }, 10_000);
  }

  let pendingEntries: ClipEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flushPending() {
    const batch = pendingEntries;
    pendingEntries = [];
    for (const entry of batch) {
      if (clips.find(c => c.contentHash === entry.contentHash)) continue;
      clips = [entry, ...clips];
    }
    if (!activeId && clips.length > 0) activeId = clips[0].id;
  }

  async function startListening() {
    try {
      unlisten = await listen<ClipEntry>("clipboard://new-entry", (event) => {
        const entry = event.payload;
        if (clips.find(c => c.contentHash === entry.contentHash)) return;
        pendingEntries.push(entry);
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flushPending, 200);
      });
    } catch { /* silent */ }
  }

  // ── Keyboard ──────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (lightboxHash) { lightboxHash = null; return; }
      activeId = null; return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if ((e.target as HTMLElement)?.closest("[data-cb-search]")) return;
      e.preventDefault();
      const idx = filtered.findIndex(c => c.id === activeId);
      const next = e.key === "ArrowDown"
        ? Math.min(idx + 1, filtered.length - 1)
        : Math.max(idx - 1, 0);
      activeId = filtered[next]?.id ?? null;
      return;
    }
    if (e.key === "Enter" && activeId && !e.metaKey && !e.ctrlKey) {
      if ((e.target as HTMLElement)?.closest("[data-cb-search]")) return;
      void copyClip(activeId, pasteMode);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      (document.querySelector("[data-cb-search] input") as HTMLInputElement)?.focus();
      return;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    void loadHistory();
    void startListening();
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    if (flushTimer) clearTimeout(flushTimer);
    unlisten?.();
    window.removeEventListener("keydown", handleKeydown);
  });

  // ── Section-specific descriptions ─────────────────────────────────
  let pageDesc = $derived.by(() => {
    const map: Record<string, string> = {
      History: "Browse everything you've copied. Use ↑↓ to navigate, ↵ to copy, and search to find anything.",
      Pinned: "Your most important clips — pinned items never get cleared and are always one click away.",
      Snippets: "Reusable text and code snippets. Perfect for templates, signatures, and common patterns.",
      Images: "Every image you've copied, displayed in a beautiful grid for quick visual browsing.",
      Sensitive: "Credentials, keys, and sensitive content — hidden by default, revealed on demand.",
      Settings: "Configure paste behavior, auto-clear rules, and clipboard preferences.",
    };
    return map[selectedSection] ?? "";
  });
</script>

<main class="cb-workspace module-root" data-module="clipboard">
  <section class="cb-shell">
    <!-- ═══ HEADER ═══ -->
    <header class="cb-shell__header">
      <div class="cb-shell__intro">
        <div class="cb-shell__eyebrow">
          <ClipboardListIcon size={14} />
          <span>Clipboard</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>Clipboard Manager</h1>
        <p>{pageDesc}</p>
      </div>
      <div class="cb-shell__actions">
        {#if selectedSection === "History" || selectedSection === "Pinned" || selectedSection === "Snippets"}
          <div class="cb-shell__search" data-cb-search>
            <SearchIcon size={14} class="cb-shell__search-icon" />
            <input
              type="search"
              placeholder="Search… ⌘F"
              bind:value={searchQuery}
              aria-label="Search clipboard"
              autocomplete="off"
              spellcheck="false"
            />
            {#if searchQuery}
              <button class="cb-shell__search-clear" onclick={() => searchQuery = ""}><XIcon size={13} /></button>
            {/if}
          </div>
        {/if}
        {#if selectedSection === "Images" && filtered.length > 0}
          <Button
            variant="outline"
            onclick={() => imageLayout = imageLayout === "grid" ? "masonry" : "grid"}
            aria-label="Toggle layout"
            title={imageLayout === "grid" ? "Switch to masonry" : "Switch to grid"}
          >
            <LayoutGridIcon data-icon="inline-start" size={14} />
            {imageLayout === "grid" ? "Masonry" : "Grid"}
          </Button>
        {/if}
        {#if selectedSection === "History" || selectedSection === "Pinned" || selectedSection === "Snippets"}
          <Button variant="outline" onclick={clearAll} disabled={loading}>
            <Trash2Icon data-icon="inline-start" size={14} />
            Clear
          </Button>
        {/if}
      </div>
    </header>

    {#if loading && selectedSection !== "Settings"}
      <div class="cb-loading-state">
        <p>Loading clipboard history…</p>
      </div>
    {/if}

    <!-- ═══ BODY ═══ -->
    <section class="cb-shell__body">
      {#if selectedSection === "History" || selectedSection === "Pinned"}
        <div class="cb-grid cb-grid--history">
          <!-- ─── LIST PANEL ─── -->
          <Card class="cb-panel">
            <CardHeader>
              <CardTitle>{selectedSection}</CardTitle>
              <CardDescription>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                <span class="cb-hint"> · ↑↓ to navigate · ↵ to copy</span>
              </CardDescription>
            </CardHeader>
            <CardContent class="cb-clip-list">
              {#if filtered.length === 0}
                <p class="cb-muted cb-muted--center">
                  {searchQuery ? "No results for \"" + searchQuery + "\"" : "Nothing here yet."}
                </p>
              {:else}
                {#each filtered as clip (clip.id)}
                  {@const Icon = kindIcon(clip.kind)}
                  {@const color = kindColor(clip.kind)}
                  {@const isCopied = copyFeedback === clip.id}
                  {@const isActive = activeId === clip.id}
                  <div
                    class="cb-clip-row"
                    class:cb-clip-row--active={isActive}
                    class:cb-clip-row--pinned={clip.pinned}
                    role="button"
                    tabindex="0"
                    onclick={() => activeId = clip.id}
                    onkeydown={(e) => { if (e.key === 'Enter') activeId = clip.id; }}
                    aria-label={makePreview(clip)}
                  >
                    <div class="cb-clip-row__badge" style="background:{color}18;color:{color}">
                      <Icon size={13} />
                    </div>
                    <div class="cb-clip-row__body">
                      <span class="cb-clip-row__preview">
                        {#if clip.isSensitive && !clip.revealed}
                          <ShieldIcon size={10} style="flex-shrink:0" /> ••••••••
                        {:else}
                          {clip.preview ?? makePreview(clip)}
                        {/if}
                      </span>
                      <span class="cb-clip-row__meta">
                        <ClockIcon size={10} /> {time.elapsed(Date.now() - clip.timestamp)}
                        {#if clip.byteSize} · {formatBytes(clip.byteSize)}{/if}
                        {#if clip.pinned}<span class="cb-clip-row__pin">Pinned</span>{/if}
                      </span>
                    </div>
                    {#if !isCopied}
                      <div class="cb-clip-row__actions">
                        <button onclick={(e) => { e.stopPropagation(); void copyClip(clip.id, pasteMode); }}
                          class="cb-clip-action" aria-label="Copy"><CopyIcon size={12}/></button>
                        <button onclick={(e) => { e.stopPropagation(); void togglePin(clip.id); }}
                          class="cb-clip-action" class:cb-clip-action--active={clip.pinned} aria-label={clip.pinned ? "Unpin" : "Pin"}>
                          {#if clip.pinned}<PinOffIcon size={12}/>{:else}<PinIcon size={12}/>{/if}
                        </button>
                        <button onclick={(e) => { e.stopPropagation(); void deleteClip(clip.id); }}
                          class="cb-clip-action cb-clip-action--danger" aria-label="Delete"><Trash2Icon size={12}/></button>
                      </div>
                    {:else}
                      <span class="cb-copied-tag"><CheckIcon size={10}/> Copied</span>
                    {/if}
                  </div>
                {/each}
              {/if}
            </CardContent>
          </Card>

          <!-- ─── DETAIL PANEL ─── -->
          <Card class="cb-panel">
            {#if !activeClip}
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Select a clip to preview its full content here.
                  <span class="cb-hint"> · Use ↑↓ and ↵</span>
                </CardDescription>
              </CardHeader>
            {:else}
              {@const clip = activeClip}
              {@const color = kindColor(clip.kind)}
              {@const Icon = kindIcon(clip.kind)}

              <CardHeader>
                <div class="cb-detail__kind" style="color:{color}">
                  <Icon size={14} /> <span>{kindLabel(clip.kind)}</span>
                  <span class="cb-detail__time">{time.elapsed(Date.now() - clip.timestamp)}</span>
                </div>
                <CardDescription>
                  {#if clip.byteSize}{formatBytes(clip.byteSize)} · {/if}
                  {time.format(clip.timestamp, { dateFormat: 'MMMM D, YYYY', timeFormat: '12h' })}
                </CardDescription>
              </CardHeader>
              <CardContent class="cb-detail__content">
                {#if clip.kind === "image"}
                  <div class="cb-detail__image-wrap">
                    <div class="cb-detail__image-wrap" onclick={() => lightboxHash = clip.contentHash}>
                      <ClipboardImage hash={clip.contentHash} alt="" class="cb-detail__image" immediate />
                      <button class="cb-detail__zoom" onclick={(e) => { e.stopPropagation(); lightboxHash = clip.contentHash; }}><ZoomInIcon size={14}/></button>
                    </div>
                  </div>
                {:else if clip.isSensitive && !clip.revealed}
                  <div class="cb-detail__sensitive">
                    <ShieldIcon size={24} />
                    <p>Sensitive content — <button class="cb-detail__reveal" onclick={() => revealSensitive(clip.id)}>click to reveal</button></p>
                  </div>
                {:else if clip.kind === "code"}
                  <pre class="cb-detail__code"><code>{clip.content}</code></pre>
                {:else}
                  <div class="cb-detail__text">{clip.content}</div>
                {/if}
              </CardContent>
              <div class="cb-detail__footer">
                <div class="cb-detail__paste-mode">
                  {#each (["plain", "rich", "image"] as const) as mode}
                    <button class="cb-mode-pill" class:cb-mode-pill--active={pasteMode === mode} onclick={() => pasteMode = mode}>
                      {mode === "plain" ? "Plain" : mode === "rich" ? "Rich" : "Image"}
                    </button>
                  {/each}
                </div>
                <div class="cb-detail__footer-actions">
                  <button class="cb-detail__icon-action" class:active={clip.favorite} onclick={() => toggleFavorite(clip.id)} title="Favorite">
                    <StarIcon size={14}/>
                  </button>
                  <button class="cb-detail__icon-action" class:active={clip.pinned} onclick={() => togglePin(clip.id)} title="Pin">
                    {#if clip.pinned}<PinOffIcon size={14}/>{:else}<PinIcon size={14}/>{/if}
                  </button>
                  <button class="cb-action-btn--primary" onclick={() => copyClip(clip.id, pasteMode)}>
                    {#if copyFeedback === clip.id}
                      <CheckIcon size={15}/> Copied!
                    {:else}
                      <CopyIcon size={15}/> Copy
                    {/if}
                  </button>
                </div>
              </div>
            {/if}
          </Card>
        </div>

      {:else if selectedSection === "Snippets"}
        <!-- ─── SNIPPETS ─── -->
        <div class="cb-grid cb-grid--snippets">
          {#each filtered as clip (clip.id)}
            {@const Icon = kindIcon(clip.kind)}
            <button class="cb-snippet-card" onclick={() => activeId = clip.id}>
              <div class="cb-snippet-card__head">
                <span class="cb-snippet-card__icon"><Icon size={12}/></span>
                <span class="cb-snippet-card__lang">{clip.kind === "code" ? "Code" : "Text"}</span>
                {#if clip.pinned}<span class="cb-clip-row__pin">Pinned</span>{/if}
              </div>
              <pre class="cb-snippet-card__body"><code>{clip.content.slice(0, 120)}{clip.content.length > 120 ? "…" : ""}</code></pre>
              <span class="cb-snippet-card__time">{time.elapsed(Date.now() - clip.timestamp)}</span>
            </button>
          {:else}
            <p class="cb-muted cb-muted--center" style="grid-column:1/-1;padding:40px;">
              No snippets yet. Copy some text or code to get started.
            </p>
          {/each}
        </div>

      {:else if selectedSection === "Images"}
        <!-- ─── IMAGES ─── -->
        {#if filtered.length > 0}
          <div
            class="cb-image-grid"
            class:cb-image-grid--masonry={imageLayout === "masonry"}
          >
            {#each filtered as clip (clip.id)}
              <button
                class="cb-image-card"
                onclick={() => { searchQuery = ""; activeId = clip.id; setModuleSection(moduleId, "History", sectionLabels); }}
                aria-label="View in detail panel"
              >
                <span class="cb-image-card__frame">
                  <ClipboardImage hash={clip.contentHash} alt="" class="cb-image-card__img" />
                  <span class="cb-image-card__cue">View details</span>
                </span>
                <span class="cb-image-card__meta">
                  <span class="cb-image-card__time">
                    <ClockIcon size={11} />
                    {time.elapsed(Date.now() - clip.timestamp)}
                  </span>
                  {#if clip.byteSize}
                    <span class="cb-image-card__size">{formatBytes(clip.byteSize)}</span>
                  {/if}
                  {#if clip.pinned}
                    <span class="cb-clip-row__pin">Pinned</span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="cb-image-empty">
            <ImageIcon size={32} />
            <p>No images in clipboard history</p>
            <span>Copy an image to your clipboard and it will appear here.</span>
          </div>
        {/if}

      {:else if selectedSection === "Sensitive"}
        <!-- ─── SENSITIVE ─── -->
        <Card class="cb-panel cb-panel--full">
          <CardHeader>
            <CardTitle>Sensitive content</CardTitle>
            <CardDescription>Credentials, keys, and secrets — hidden by default. Click to reveal.</CardDescription>
          </CardHeader>
          <CardContent class="cb-clip-list">
            {#each filtered as clip (clip.id)}
              <div class="cb-clip-row cb-clip-row--sensitive" class:cb-clip-row--revealed={clip.revealed} role="button" tabindex="0" onclick={() => activeId = clip.id} onkeydown={(e) => { if (e.key === 'Enter') activeId = clip.id; }}>
                <div class="cb-clip-row__body">
                  <span class="cb-clip-row__preview">
                    {#if clip.revealed}
                      {clip.content}
                    {:else}
                      <ShieldIcon size={10} style="flex-shrink:0" /> {clip.preview ?? "Sensitive content hidden"}
                    {/if}
                  </span>
                  <span class="cb-clip-row__meta">{time.elapsed(Date.now() - clip.timestamp)}</span>
                </div>
                <div class="cb-clip-row__actions">
                  {#if !clip.revealed}
                    <button class="cb-clip-action" onclick={(e) => { e.stopPropagation(); revealSensitive(clip.id); }} aria-label="Reveal">
                      <EyeIcon size={12}/>
                    </button>
                  {/if}
                  <button class="cb-clip-action cb-clip-action--danger" onclick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} aria-label="Delete">
                    <Trash2Icon size={12}/>
                  </button>
                </div>
              </div>
            {:else}
              <p class="cb-muted cb-muted--center">No sensitive items detected.</p>
            {/each}
          </CardContent>
        </Card>

      {:else if selectedSection === "Settings"}
        <!-- ─── SETTINGS ─── -->
        <Card class="cb-panel cb-panel--full">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Configure how your clipboard behaves.</CardDescription>
          </CardHeader>
          <CardContent class="cb-settings-form">
            <label class="cb-settings-row">
              <span class="cb-settings-label">Default paste format</span>
              <select bind:value={pasteMode} class="cb-select">
                <option value="plain">Plain text</option>
                <option value="rich">Rich text</option>
                <option value="image">As image</option>
              </select>
            </label>
            <label class="cb-settings-row">
              <span class="cb-settings-label">Auto-clear sensitive items</span>
              <span class="cb-settings-note">Sensitive items auto-hide after 10 seconds</span>
            </label>
            <label class="cb-settings-row">
              <span class="cb-settings-label">Item count</span>
              <span class="cb-settings-note"><strong>{clips.length}</strong> items in history</span>
            </label>
            <label class="cb-settings-row">
              <span class="cb-settings-label">Storage</span>
              <span class="cb-settings-note">All data stored locally on your device</span>
            </label>
          </CardContent>
        </Card>
      {/if}
    </section>
  </section>
</main>

<!-- ═══ LIGHTBOX ═══ -->    {#if lightboxHash}
  <div class="cb-lightbox" role="dialog" aria-modal="true" aria-label="Image preview"
    onclick={() => lightboxHash = null} onkeydown={(e) => { if (e.key === "Escape") lightboxHash = null; }} tabindex="-1">
    <button class="cb-lightbox__close" onclick={() => lightboxHash = null} aria-label="Close"><XIcon size={20}/></button>
    <ClipboardImage hash={lightboxHash} alt="" class="cb-lightbox__img" immediate />
  </div>
{/if}

<style>
  @import "./clipboard.css";
</style>
