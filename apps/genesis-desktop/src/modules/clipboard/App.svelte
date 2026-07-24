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
  import { trackEvent } from "$lib/ipc";
  import { openExternal } from "$lib/desktop/open-external";
  import { tooltip } from "$lib/components/Tooltip.svelte";
  import SearchIcon        from "@lucide/svelte/icons/search";
  import PinIcon           from "@lucide/svelte/icons/pin";
  import PinOffIcon        from "@lucide/svelte/icons/pin-off";
  import CopyIcon          from "@lucide/svelte/icons/copy";
  import Trash2Icon        from "@lucide/svelte/icons/trash-2";
  import ShieldIcon        from "@lucide/svelte/icons/shield";
  import EyeIcon           from "@lucide/svelte/icons/eye";
  import ImageIcon         from "@lucide/svelte/icons/image";

  import Link2Icon         from "@lucide/svelte/icons/link-2";
  import CodeIcon          from "@lucide/svelte/icons/code";
  import TypeIcon          from "@lucide/svelte/icons/type";
  import BookmarkIcon       from "@lucide/svelte/icons/bookmark";
  import StarIcon          from "@lucide/svelte/icons/star";
  import XIcon             from "@lucide/svelte/icons/x";
  import ZoomInIcon        from "@lucide/svelte/icons/zoom-in";
  import CheckIcon         from "@lucide/svelte/icons/check";
  import ClockIcon         from "@lucide/svelte/icons/clock";
  import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";


  const moduleId = "clipboard";
  const sectionLabels = ["History", "Pinned", "Bookmarks", "Snippets", "Images", "Sensitive", "Settings"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  // ── Types ─────────────────────────────────────────────────────────
  type ClipKind = "text" | "code" | "link" | "bookmark" | "image" | "sensitive" | "html";

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
    // ── Bookmark enrichment fields ──
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogSiteName?: string;
    platform?: string;
    savedTimestampSeconds?: number;
    recopyCount?: number;
    enrichmentStatus?: string;
  }

  // ── State ─────────────────────────────────────────────────────────
  let clips       = $state<ClipEntry[]>([]);
  let searchQuery = $state("");
  let activeId    = $state<string | null>(null);
  let lightboxHash = $state<string | null>(null);
  let copyFeedback= $state<string | null>(null);
  let loading     = $state(true);
  let pasteMode   = $state<"plain" | "rich" | "image">("plain");
  let unlisten: (() => void) | null = null;

  // ── Derived ───────────────────────────────────────────────────────
  const activeClip = $derived(clips.find(c => c.id === activeId) ?? null);
  const imageEntries = $derived(clips.filter(c => c.kind === "image"));
  const lightboxIndex = $derived(
    lightboxHash ? imageEntries.findIndex(c => c.contentHash === lightboxHash) : -1
  );

  // Search state — populated by Rust backend search for full DB coverage.
  // When active, replaces the local paginated view with server-side results.
  let searchResults = $state<ClipEntry[] | null>(null);
  let searchLoading = $state(false);

  const filtered = $derived.by(() => {
    const pool = searchResults ?? clips;
    let filtered = pool;
    if (selectedSection === "Pinned")   filtered = filtered.filter(c => c.pinned);
    else if (selectedSection === "Bookmarks") filtered = filtered.filter(c => c.kind === "bookmark");
    else if (selectedSection === "Images")   filtered = filtered.filter(c => c.kind === "image");
    else if (selectedSection === "Snippets") filtered = filtered.filter(c => c.kind === "text" || c.kind === "code" || c.kind === "html");
    else if (selectedSection === "Sensitive") filtered = filtered.filter(c => c.isSensitive);

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  });

  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function onSearchInput(q: string) {
    searchQuery = q;
    if (searchTimer) clearTimeout(searchTimer);
    if (!q.trim()) {
      searchResults = null;
      return;
    }
    searchTimer = setTimeout(() => performSearch(q.trim()), 300);
  }

  async function performSearch(q: string) {
    searchLoading = true;
    try {
      const results = await invoke<ClipEntry[]>("clipboard_search", { query: q, limit: 500 });
      searchResults = results;
    } catch {
      searchResults = null;
    } finally {
      searchLoading = false;
    }
  }

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
      bookmark: "oklch(0.531 0.175 295.596)", image: "var(--cb-image)", sensitive: "var(--cb-sensitive)", html: "var(--cb-code)",
    };
    return map[kind];
  }

  function kindIcon(kind: ClipKind) {
    const map: Record<ClipKind, any> = {
      text: TypeIcon, code: CodeIcon, link: Link2Icon,
      bookmark: BookmarkIcon, image: ImageIcon, sensitive: ShieldIcon, html: CodeIcon,
    };
    return map[kind];
  }

  function kindLabel(kind: ClipKind): string {
    const map: Record<ClipKind, string> = {
      text: "Text", code: "Code", link: "Link", bookmark: "Bookmark", image: "Image", sensitive: "Sensitive", html: "HTML",
    };
    return map[kind];
  }

  // ── Platform badge helpers ────────────────────────────────────────
  const PLATFORM_LABELS: Record<string, string> = {
    x: "X", twitter: "X", youtube: "YouTube", reddit: "Reddit",
    threads: "Threads", instagram: "Instagram", tiktok: "TikTok",
    cosmos: "Cosmos", arena: "Are.na", "are.na": "Are.na",
    linkedin: "LinkedIn", github: "GitHub", other: "",
  };

  function platformLabel(p: string | undefined): string {
    return p ? (PLATFORM_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1)) : "";
  }

  function bookmarkTitle(entry: ClipEntry): string {
    if (entry.ogTitle) return entry.ogTitle;
    // Fallback: use preview or content as title
    const content = entry.preview ?? entry.content;
    return content.length > 120 ? content.slice(0, 117) + "…" : content;
  }

  async function openUrl(entry: ClipEntry) {
    try {
      const url = new URL(entry.content.trim());
      trackEvent("bookmark", "open", {
        id: entry.id.slice(0, 8),
        platform: entry.platform,
        hasOgImage: !!entry.ogImage,
        hostname: url.hostname,
      });
      await openExternal(url.href);
    } catch {}
  }

  function platformColor(p: string | undefined): string {
    const colors: Record<string, string> = {
      x: "#000", twitter: "#000", youtube: "#FF0000", reddit: "#FF4500",
      threads: "#000", instagram: "#FF0076", tiktok: "#000",
      cosmos: "#6C5CE7", arena: "#000", "are.na": "#000",
      linkedin: "#0A66C2", github: "oklch(0.206 0.002 17.285)",
    };
    return p ? (colors[p] ?? "oklch(0.571 0.008 106.636)") : "oklch(0.571 0.008 106.636)";
  }

  function bookmarkAlt(entry: ClipEntry): string {
    if (entry.ogTitle) return entry.ogTitle;
    const pf = entry.platform ? entry.platform : "the web";
    return "Bookmark from " + pf;
  }

  // ── Image path cache ────────────────────────────────────────────
  const PAGE_SIZE = 200;
  let totalCount = $state(0);
  let hasMore = $state(true);
  let loadingMore = $state(false);
  let imagePathCache = $state<Map<string, string>>(new Map());

  async function preloadImagePaths(entries: ClipEntry[]) {
    const imageHashes = entries.filter(e => e.kind === "image").map(e => e.contentHash);
    if (imageHashes.length === 0) return;
    try {
      const result = await invoke<Record<string, string | null>>("clipboard_get_image_paths", { hashes: imageHashes });
      for (const [hash, path] of Object.entries(result)) {
        if (path) imagePathCache.set(hash, path);
      }
    } catch {}
  }

  // ── Backend ───────────────────────────────────────────────────────
  async function loadInitial() {
    loading = true;
    try {
      const [rows, count] = await Promise.all([
        invoke<ClipEntry[]>("clipboard_list", { limit: PAGE_SIZE, offset: 0 }),
        invoke<number>("clipboard_count"),
      ]);
      clips = rows;
      totalCount = count;
      hasMore = clips.length < totalCount;
      if (clips.length > 0 && !activeId) activeId = clips[0].id;
      void preloadImagePaths(rows);
    } catch {
      clips = [];
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    try {
      const rows = await invoke<ClipEntry[]>("clipboard_list", { limit: PAGE_SIZE, offset: clips.length });
      if (rows.length === 0) {
        hasMore = false;
        return;
      }
      // Merge new items — skip any that already exist (dedup by contentHash)
      const existingHashes = new Set(clips.map(c => c.contentHash));
      const newItems = rows.filter(r => !existingHashes.has(r.contentHash));
      if (newItems.length === 0) {
        hasMore = false;
        return;
      }
      clips = [...clips, ...newItems];
      hasMore = clips.length < totalCount;
      void preloadImagePaths(newItems);
    } catch {
      // Silently fail — user can scroll again to retry
    } finally {
      loadingMore = false;
    }
  }

  function onListScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (!el) return;
    const threshold = 200;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      void loadMore();
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
    const deleted = clips.find(c => c.id === id);
    if (deleted?.kind === "bookmark") {
      trackEvent("bookmark", "delete", {
        id: deleted.id.slice(0, 8),
        platform: deleted.platform,
        hadOgImage: !!deleted.ogImage,
        ageMs: Date.now() - deleted.timestamp,
      });
    }
    clips = clips.filter(c => c.id !== id);
    if (activeId === id) activeId = clips[0]?.id ?? null;
    if (deleted?.kind === "image" && deleted.contentHash) {
      imagePathCache.delete(deleted.contentHash);
    }
    if (lightboxHash === deleted?.contentHash) lightboxHash = null;
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

  // ── Bookmark state ────────────────────────────────────────────────
  let bookmarkUrl = $state("");
  let bookmarkSaving = $state(false);
  let bookmarkSaved = $state(false);
  let bookmarkError = $state<string | null>(null);
  let bookmarkSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let bookmarkCopyId = $state<string | null>(null);
  let bookmarkCopyTimer: ReturnType<typeof setTimeout> | null = null;

  const detectedPlatform = $derived.by((): string | undefined => {
    const trimmed = bookmarkUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return;
    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const map: Record<string, string> = {
        "x.com": "x", "twitter.com": "x",
        "youtube.com": "youtube", "youtu.be": "youtube",
        "reddit.com": "reddit", "threads.net": "threads",
        "instagram.com": "instagram", "tiktok.com": "tiktok",
        "cosmos.so": "cosmos", "are.na": "arena",
        "linkedin.com": "linkedin", "github.com": "github",
      };
      return map[host];
    } catch {
      return;
    }
  });

  async function saveBookmark() {
    const url = bookmarkUrl.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      bookmarkError = "Please enter a valid URL starting with http:// or https://";
      return;
    }
    bookmarkSaving = true;
    bookmarkError = null;
    trackEvent("bookmark", "manual-save", {
      platform: detectedPlatform,
      urlLength: url.length,
    });
    try {
      await invoke("clipboard_save", { content: url, source: null });
      bookmarkSaved = true;
      bookmarkUrl = "";
      if (bookmarkSaveTimer) clearTimeout(bookmarkSaveTimer);
      bookmarkSaveTimer = setTimeout(() => { bookmarkSaved = false; }, 2000);
    } catch (err) {
      bookmarkError = String(err);
      trackEvent("bookmark", "manual-save-error", { error: String(err).slice(0, 100) });
    } finally {
      bookmarkSaving = false;
    }
  }

  function copyBookmarkUrl(clip: ClipEntry) {
    const url = clip.content.trim();
    navigator.clipboard.writeText(url).catch(() => {});
    bookmarkCopyId = clip.id;
    if (bookmarkCopyTimer) clearTimeout(bookmarkCopyTimer);
    bookmarkCopyTimer = setTimeout(() => {
      if (bookmarkCopyId === clip.id) bookmarkCopyId = null;
    }, 1400);
  }

  function onBookmarkInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveBookmark();
    }
    if (bookmarkError) bookmarkError = null;
  }

  let pendingEntries: ClipEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flushPending() {
    const batch = pendingEntries;
    pendingEntries = [];
    const newImages: ClipEntry[] = [];
    let bookmarkCount = 0;
    for (const entry of batch) {
      if (clips.find(c => c.contentHash === entry.contentHash)) continue;
      if (entry.kind === "bookmark") bookmarkCount++;
      clips = [entry, ...clips];
      if (entry.kind === "image") newImages.push(entry);
    }
    if (bookmarkCount > 0) {
      trackEvent("bookmark", "flush-pending", {
        bookmarkCount,
        totalBatch: batch.length,
        totalClips: clips.length,
      });
    }
    if (newImages.length > 0) void preloadImagePaths(newImages);
    if (!activeId && clips.length > 0) activeId = clips[0].id;
  }

  async function startListening() {
    try {
      unlisten = await listen<ClipEntry>("clipboard://new-entry", (event) => {
        const entry = event.payload;
        const isDedup = clips.find(c => c.contentHash === entry.contentHash);
        if (isDedup) return;
        if (entry.kind === "bookmark") {
          trackEvent("bookmark", "new-entry", {
            id: entry.id.slice(0, 8),
            platform: entry.platform,
            enrichmentStatus: entry.enrichmentStatus,
            hasOgImage: !!entry.ogImage,
            pendingCount: pendingEntries.length,
          });
        }
        pendingEntries.push(entry);
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flushPending, 200);
      });
      // Listen for enrichment completion to update bookmark cards in-place.
      // IMPORTANT: Only merge enrichment-specific fields, NOT the entire
      // payload — the event only carries { id, ogTitle, ogImage, ... } without
      // content, kind, timestamp etc. A naive { ...clips[idx], ...enriched }
      // spread would overwrite those required fields with undefined.
      const unlistenEnrich = await listen<any>("clipboard://enrichment-complete", (event) => {
        const enriched = event.payload;
        const idx = clips.findIndex(c => c.id === enriched.id);
        if (idx !== -1) {
          const prev = clips[idx];
          trackEvent("bookmark", "enrichment-complete", {
            id: enriched.id.slice(0, 8),
            platform: enriched.platform ?? prev.platform,
            hadOgImage: !!prev.ogImage,
            gotOgImage: !!enriched.ogImage,
            ogTitle: enriched.ogTitle?.slice(0, 60),
          });
          clips[idx] = {
            ...clips[idx],
            ogTitle: enriched.ogTitle ?? clips[idx].ogTitle,
            ogDescription: enriched.ogDescription ?? clips[idx].ogDescription,
            ogImage: enriched.ogImage ?? clips[idx].ogImage,
            ogSiteName: enriched.ogSiteName ?? clips[idx].ogSiteName,
            platform: enriched.platform ?? clips[idx].platform,
            savedTimestampSeconds: enriched.savedTimestampSeconds ?? clips[idx].savedTimestampSeconds,
            enrichmentStatus: "completed",
          };
        } else {
          trackEvent("bookmark", "enrichment-orphan", {
            id: enriched.id.slice(0, 8),
            notFoundIn: clips.length,
          });
        }
      });
      // Chain cleanup
      const origUnlisten = unlisten;
      unlisten = () => { origUnlisten?.(); unlistenEnrich(); };
    } catch { /* silent */ }
  }

  // ── Keyboard ──────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (lightboxHash) { lightboxHash = null; return; }
      activeId = null; return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      const searchInput = document.querySelector("[data-cb-search] input") as HTMLInputElement;
      if (searchInput) { searchInput.focus(); return; }
    }
    // Lightbox image navigation (works from any section)
    if (lightboxHash && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      if (imageEntries.length < 2) return;
      const currentIdx = imageEntries.findIndex(c => c.contentHash === lightboxHash);
      const next = e.key === "ArrowRight"
        ? Math.min(currentIdx + 1, imageEntries.length - 1)
        : Math.max(currentIdx - 1, 0);
      lightboxHash = imageEntries[next]?.contentHash ?? lightboxHash;
      return;
    }
    if (selectedSection === "Images") {
      if ((e.target as HTMLElement)?.closest("[data-cb-search]")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
      }
      if (e.key === "Enter" && lightboxHash) {
        e.preventDefault();
      }
      return;
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
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    void loadInitial();
    void startListening();
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    if (flushTimer) clearTimeout(flushTimer);
    if (bookmarkSaveTimer) clearTimeout(bookmarkSaveTimer);
    if (bookmarkCopyTimer) clearTimeout(bookmarkCopyTimer);
    unlisten?.();
    window.removeEventListener("keydown", handleKeydown);
    document.body.style.overflow = "";
  });

  // Lock body scroll when lightbox is open
  $effect(() => {
    if (lightboxHash) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  });

  // ── Section-specific descriptions ─────────────────────────────────
  let pageDesc = $derived.by(() => {
    const map: Record<string, string> = {
      History: "Browse everything you've copied. Use ↑↓ to navigate, ↵ to copy, and search to find anything.",
      Pinned: "Your most important clips — pinned items never get cleared and are always one click away.",
      Bookmarks: "Posts, articles, and links saved from across the web — with rich previews from X, YouTube, Reddit, and more.",
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
        {#if selectedSection === "History" || selectedSection === "Pinned" || selectedSection === "Bookmarks" || selectedSection === "Snippets"}
          <div class="cb-shell__search" data-cb-search>
            <SearchIcon size={14} class="cb-shell__search-icon" />
              <input
                  type="search"
                  placeholder="Search… ⌘F"
                  value={searchQuery}
                  oninput={(e) => onSearchInput((e.target as HTMLInputElement).value)}
                  aria-label="Search clipboard"
                  autocomplete="off"
                  spellcheck="false"
                />
            {#if searchQuery}
              <button class="cb-shell__search-clear" onclick={() => onSearchInput("")}><XIcon size={13} /></button>
            {/if}
          </div>
        {/if}
        {#if selectedSection === "History" || selectedSection === "Pinned" || selectedSection === "Bookmarks" || selectedSection === "Snippets"}
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
            <CardContent class="cb-clip-list" onscroll={onListScroll}>
              {#if filtered.length === 0}
                <p class="cb-muted cb-muted--center">
                  {searchQuery ? "No results for \"" + searchQuery + "\"" : "Nothing here yet."}
                </p>
              {:else}
                {#each filtered as clip (clip.id)}
                  {const Icon = kindIcon(clip.kind)}
                  {const color = kindColor(clip.kind)}
                  {const isCopied = copyFeedback === clip.id}
                  {const isActive = activeId === clip.id}
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
                        {#if clip.byteSize} · <span class="number number-tabular">{formatBytes(clip.byteSize)}</span>{/if}
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
                {#if loadingMore}
                  <p class="cb-muted cb-muted--center" style="padding:16px">Loading more…</p>
                {:else if !hasMore && filtered.length >= PAGE_SIZE}
                  <p class="cb-muted cb-muted--center" style="padding:16px;opacity:0.5">All {totalCount} items loaded</p>
                {/if}
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
              {const clip = activeClip}
              {const color = kindColor(clip.kind)}
              {const Icon = kindIcon(clip.kind)}

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
                  <div class="cb-detail__image-wrap" onclick={() => lightboxHash = clip.contentHash} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') lightboxHash = clip.contentHash; }} aria-label="Open in lightbox">
                    <ClipboardImage hash={clip.contentHash} alt="" class="cb-detail__image" immediate imagePath={imagePathCache.get(clip.contentHash)} />
                    <button class="cb-detail__zoom" onclick={(e) => { e.stopPropagation(); lightboxHash = clip.contentHash; }} aria-label="Zoom in"><ZoomInIcon size={14}/></button>
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
                  <button class="cb-detail__icon-action" class:active={clip.favorite} onclick={() => toggleFavorite(clip.id)} use:tooltip={{ text: "Favorite" }}>
                    <StarIcon size={14}/>
                  </button>
                  <button class="cb-detail__icon-action" class:active={clip.pinned} onclick={() => togglePin(clip.id)} use:tooltip={{ text: "Pin" }}>
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
            {const Icon = kindIcon(clip.kind)}
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
        <!-- ─── IMAGES (virtualized) ─── -->
        {#if filtered.length > 0}
          <div class="cb-image-grid" onscroll={onListScroll}>
            {#each filtered as clip (clip.id)}
              <div
                class="cb-image-card"
                role="button"
                tabindex="0"
                onclick={() => lightboxHash = clip.contentHash}
                onkeydown={(e) => { if (e.key === 'Enter') lightboxHash = clip.contentHash; }}
                aria-label="Preview image"
              >
                <span class="cb-image-card__frame">
                  <ClipboardImage hash={clip.contentHash} alt="" class="cb-image-card__img" imagePath={imagePathCache.get(clip.contentHash)} />
                  <span class="cb-image-card__actions">
                    <button class="cb-image-card__action" onclick={(e) => { e.stopPropagation(); activeId = clip.id; setModuleSection(moduleId, "History", sectionLabels); }} aria-label="View in detail panel" use:tooltip={{ text: "View details" }}>
                      <EyeIcon size={12} />
                    </button>
                    <button class="cb-image-card__action cb-image-card__action--danger" onclick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} aria-label="Delete image" use:tooltip={{ text: "Delete" }}>
                      <Trash2Icon size={12} />
                    </button>
                  </span>
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
              </div>
            {/each}
            {#if loadingMore}
              <p class="cb-muted" style="grid-column:1/-1;padding:20px;text-align:center">Loading more images…</p>
            {:else if !hasMore && filtered.length >= PAGE_SIZE}
              <p class="cb-muted" style="grid-column:1/-1;padding:20px;text-align:center;opacity:0.5">All {totalCount} items loaded</p>
            {/if}
          </div>
        {:else}
          <div class="cb-image-empty">
            <ImageIcon size={32} />
            <p>No images in clipboard history</p>
            <span>Copy an image to your clipboard and it will appear here.</span>
          </div>
        {/if}

      {:else if selectedSection === "Bookmarks"}
        <!-- ─── BOOKMARK INPUT BAR ─── -->
        <div class="cb-bookmark-input">
          <div class="cb-bookmark-input__field">
            <Link2Icon size={16} class="cb-bookmark-input__icon" />
            <input
              type="url"
              placeholder="Paste a URL to bookmark…"
              bind:value={bookmarkUrl}
              onkeydown={onBookmarkInputKeydown}
              aria-label="Bookmark URL"
              autocomplete="off"
              spellcheck="false"
            />
            {#if detectedPlatform}
              <div class="cb-bookmark-input__badge cb-bookmark-input__badge--visible" data-platform={detectedPlatform}>
                {platformLabel(detectedPlatform)}
              </div>
            {/if}
          </div>
          <button
            class="cb-bookmark-input__save"
            class:cb-bookmark-input__save--saved={bookmarkSaved}
            onclick={() => void saveBookmark()}
            disabled={bookmarkSaving || !bookmarkUrl.trim()}
          >
            {#if bookmarkSaved}
              <CheckIcon size={14} /> Saved
            {:else if bookmarkSaving}
              Saving…
            {:else}
              <BookmarkIcon size={14} /> Save
            {/if}
          </button>
        </div>
        {#if bookmarkError}
          <div class="cb-bookmark-input__error">{bookmarkError}</div>
        {/if}

        <!-- ─── BOOKMARKS (Pinterest masonry) ─── -->
        {#if filtered.length > 0}
          <div class="cb-bookmark-grid" onscroll={onListScroll}>
            {#each filtered as clip (clip.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="cb-pin-card"
                onclick={() => void openUrl(clip)}
                role="button"
                tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter') openUrl(clip); }}
              >
                <div class="cb-pin-card__image-wrapper" style="background:{platformColor(clip.platform)}">
                  {#if clip.ogImage}
                    <img
                      src={clip.ogImage}
                      alt={bookmarkAlt(clip)}
                      loading="lazy"
                      draggable="false"
                      onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  {:else}
                    <div class="cb-pin-card__img-placeholder">
                      <BookmarkIcon size={28} />
                    </div>
                  {/if}
                  <!-- Platform badge overlay (top-left, like Pinterest pin badge) -->
                  {#if clip.platform && clip.platform !== "other"}
                    <div class="cb-pin-card__badge" data-platform={clip.platform}>
                      {platformLabel(clip.platform)}
                    </div>
                  {/if}
                  <!-- Hover actions -->
                  <div class="cb-pin-card__actions">
                    {#if bookmarkCopyId === clip.id}
                      <button class="cb-pin-card__action cb-pin-card__action--confirm" disabled aria-label="Copied" use:tooltip={{ text: "Copied" }}>
                        <CheckIcon size={12} />
                      </button>
                    {:else}
                      <button
                        class="cb-pin-card__action"
                        onclick={(e) => { e.stopPropagation(); void copyBookmarkUrl(clip); }}
                        aria-label="Copy URL"
                        use:tooltip={{ text: "Copy URL" }}
                      >
                        <CopyIcon size={12} />
                      </button>
                    {/if}
                    <button
                      class="cb-pin-card__action cb-pin-card__action--danger"
                      onclick={(e) => { e.stopPropagation(); void deleteClip(clip.id); }}
                      aria-label="Delete bookmark"
                      use:tooltip={{ text: "Delete" }}
                    >
                      <Trash2Icon size={12} />
                    </button>
                  </div>
                </div>
                <div class="cb-pin-card__footer">
                  <h2 class="cb-pin-card__title" title={bookmarkTitle(clip)}>
                    {bookmarkTitle(clip)}
                  </h2>
                  <div class="cb-pin-card__meta">
                    <span>
                      {#if clip.platform && clip.platform !== "other"}
                        From {platformLabel(clip.platform)}
                      {/if}
                      · {time.elapsed(Date.now() - clip.timestamp)}
                    </span>
                    {#if clip.recopyCount && clip.recopyCount > 1}
                      <span class="cb-pin-card__recopy">Recopied {clip.recopyCount}×</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
            {#if loadingMore}
              <p class="cb-muted" style="grid-column:1/-1;padding:20px;text-align:center">Loading more…</p>
            {:else if !hasMore && filtered.length >= 200}
              <p class="cb-muted" style="grid-column:1/-1;padding:20px;text-align:center;opacity:0.5">All bookmarks loaded</p>
            {/if}
          </div>
        {:else}
          <div class="cb-bookmark-empty">
            <BookmarkIcon size={32} />
            <p>No bookmarks yet</p>
            <span>Paste a URL above or copy a link from X, YouTube, Reddit, or any supported platform and it will appear here automatically as a rich bookmark card with preview thumbnail.</span>
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
    <ClipboardImage hash={lightboxHash} alt="" class="cb-lightbox__img" immediate imagePath={imagePathCache.get(lightboxHash)} />
    {#if imageEntries.length > 1 && lightboxIndex >= 0}
      <span class="cb-lightbox__counter">{lightboxIndex + 1} / {imageEntries.length}</span>
    {/if}
    {#if lightboxIndex > 0}
      <button class="cb-lightbox__nav cb-lightbox__nav--prev" onclick={(e) => { e.stopPropagation(); lightboxHash = imageEntries[lightboxIndex - 1]?.contentHash ?? null; }} aria-label="Previous image">‹</button>
    {/if}
    {#if lightboxIndex < imageEntries.length - 1}
      <button class="cb-lightbox__nav cb-lightbox__nav--next" onclick={(e) => { e.stopPropagation(); lightboxHash = imageEntries[lightboxIndex + 1]?.contentHash ?? null; }} aria-label="Next image">›</button>
    {/if}
  </div>
{/if}

<style>
  @import "./clipboard.css";

  h1 {
    margin: 0;
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    font-family: var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
</style>


