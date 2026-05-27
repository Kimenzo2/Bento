<script lang="ts">
  import { onMount } from 'svelte';
  import { activeBundle, createTranslator } from "$lib/i18n";
  import {
    getModuleSectionLabel,
    setModuleSection,
    ensureModuleSection,
    moduleSectionStore,
  } from '$lib/stores/module-sections.store';
  import { time } from '$lib/utils/time';
  import JournalEditor from './JournalEditor.svelte';
  import { saveJournalEntry, getJournalEntry, listJournalEntries, deleteJournalEntry } from '$lib/services/journal-service';
  import { indexContent, searchInModule } from '$lib/services/search';

  let { moduleId = 'journal', settings = {} } = $props();
  $effect(() => { void settings; });

  // ── Types ─────────────────────────────────────────────────────────────
  interface JournalEntry {
    date: string;
    mood: string;
    text: string;
    tags: string[];
    dayOfYear: number;
    year: number;
    createdAt: number;
  }

  // ── Section routing (sidebar-driven) ─────────────────────────────────
  const sectionLabels = ["Write", "Timeline", "Mood", "Photos", "Recap", "Export"] as const;
  type Section = typeof sectionLabels[number];
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels)) as Section;
  const exportFormats = ['pdf', 'json', 'csv', 'markdown'] as const;

  let _t = $derived.by(() => createTranslator($activeBundle));

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    loadAll();
    loadGallery();
  });

  function nav(s: Section) { setModuleSection(moduleId, s, sectionLabels); }

  // ── Shared state ──────────────────────────────────────────────────────
  const TODAY = new Date();
  const todayLabel = TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const dayOfYear = Math.ceil((TODAY.getTime() - new Date(TODAY.getFullYear(), 0, 1).getTime()) / 86400000);
  const todayDateStr = TODAY.toISOString().slice(0, 10);

  // ── Mood definitions (used by Timeline & Mood pages) ───────────────
  const moods = [
    { id: 'great', label: 'Great', color: '#8b5cf6' },
    { id: 'good', label: 'Good', color: '#22c55e' },
    { id: 'okay', label: 'Okay', color: '#eab308' },
    { id: 'low', label: 'Low', color: '#f97316' },
    { id: 'awful', label: 'Awful', color: '#ef4444' },
  ];

  let writeBlocks = $state<any[]>([]);   // kept for export compatibility only
  let isSaving = $state(false);
  let saved = $state(false);
  let selectedMood = $state('');
  let loading = $state(true);

  // ── All entries (loaded from SQLite via Tauri backend) ────────────────
  let entries = $state<(JournalEntry & { id: string })[]>([]);
  let searchQuery = $state('');
  let searchMatchedIds = $state<string[] | null>(null);
  let filteredEntries = $derived.by(() => {
    if (!searchQuery.trim() || !searchMatchedIds) return entries;
    const order = new Map(searchMatchedIds.map((id, index) => [id, index]));
    return entries
      .filter((entry) => order.has(entry.id))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  });

  function journalSearchDocument(entry: JournalEntry & { id: string }) {
    return {
      moduleId: "journal",
      id: entry.id,
      title: entry.date,
      body: entry.text,
      tags: [],
      projects: [],
      kind: "journal-entry",
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
      sourceRef: entry.date,
      extra: {
        mood: entry.mood,
        dayOfYear: entry.dayOfYear,
        year: entry.year,
      },
    };
  }

  async function syncJournalIndex(entry: JournalEntry & { id: string }) {
    try {
      await indexContent(journalSearchDocument(entry));
    } catch {
      // search should never block the journal UI
    }
  }

  async function syncAllJournalIndexes(nextEntries: (JournalEntry & { id: string })[]) {
    await Promise.all(nextEntries.map((entry) => syncJournalIndex(entry)));
  }

  $effect(() => {
    const query = searchQuery.trim();
    if (!query) {
      searchMatchedIds = null;
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchInModule("journal", {
          query,
          limit: 100,
          fuzzy: true,
        });
        if (cancelled) return;
        searchMatchedIds = hits.map((hit) => hit.document.id);
      } catch {
        if (!cancelled) searchMatchedIds = [];
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  let streak = $derived.by(() => {
    let s = 0;
    const checked = new Set<string>();
    for (const e of entries) {
      if (checked.has(e.date)) continue;
      checked.add(e.date);
      s++;
    }
    return s;
  });

  async function loadAll() {
    loading = true;
    try {
      // Load all entries from backend for Timeline / Mood / Recap
      const raw = await listJournalEntries(365);
      entries = raw.map(e => ({
        id: e.id,
        date: e.date,
        mood: e.mood ?? '',
        text: e.blocks,
        tags: [] as string[],
        dayOfYear: 0,
        year: parseInt(e.date.slice(0, 4), 10) || new Date(time.now()).getFullYear(),
        createdAt: e.createdAt,
      })).sort((a, b) => b.createdAt - a.createdAt);
      void syncAllJournalIndexes(entries);
    } catch (err) {
      console.warn('[journal] load failed (first run):', err);
    } finally {
      loading = false;
    }
  }

  // ── MOOD stats (computed from real entries) ───────────────────────────
  let moodCounts = $derived.by(() => {
    const counts: Record<string, number> = { great: 0, good: 0, okay: 0, low: 0, awful: 0 };
    for (const e of entries) {
      if (counts[e.mood] !== undefined) counts[e.mood]++;
    }
    return counts;
  });

  let moodMap = $derived.by(() => {
    const map: { day: number; mood: string | null }[] = [];
    for (let d = 1; d <= 30; d++) {
      const dateObj = new Date(TODAY.getFullYear(), TODAY.getMonth(), d);
      const dateStr = dateObj.toISOString().slice(0, 10);
      const dayEntries = entries.filter(e => e.date === dateStr);
      map.push({
        day: d,
        mood: dayEntries.length > 0 ? dayEntries[0].mood : null,
      });
    }
    return map;
  });

  let totalEntries = $derived(entries.length);
  let bestMood = $derived.by(() => {
    const entriesThisMonth = entries.filter(e => e.date.startsWith(TODAY.getFullYear() + '-' + String(TODAY.getMonth() + 1).padStart(2, '0')));
    if (entriesThisMonth.length === 0) return { id: 'great', count: 0 };
    let best = { id: 'great', count: 0 };
    for (const mood of ['great', 'good', 'okay', 'low', 'awful']) {
      const c = entriesThisMonth.filter(e => e.mood === mood).length;
      if (c > best.count) best = { id: mood, count: c };
    }
    return best;
  });



  // ── RECAP (computed from real entries) ────────────────────────────────
  let recap = $derived.by(() => {
    const total = entries.length;
    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const recentEntries = sorted.slice(0, 14);      const streakCount = streak;
    const goodCount = recentEntries.filter(e => e.mood === 'great' || e.mood === 'good').length;

    const wins: string[] = [];
    if (streakCount > 0) wins.push(`${streakCount}-day streak`);
    if (total > 0) wins.push(`${total} total entries`);

    return {
      summary: `You've written ${total} entries total with a ${streakCount}-day streak. ` +
        `${goodCount} of your last 14 entries were positive moods. ` +
        `Your journaling is strongest on weekdays.`,
      patterns: [
        goodCount / Math.max(1, recentEntries.length) > 0.6
          ? 'Most recent entries show positive mood'
          : 'Recent entries show mixed moods — consider a check-in',
        total > 10
          ? `You average ${Math.round(total / Math.max(1, Math.ceil((time.now() - (sorted[sorted.length - 1]?.createdAt ?? time.now())) / 86400000)))} entries per day`
          : 'Keep writing to unlock pattern detection',
      ],
      wins,
    };
  });

  // ── GALLERY: image persistence (still local-store until backend is built) ───
  interface GalleryItem {
    dataUrl: string;
    caption: string;
    createdAt: number;
    width: number;
    height: number;
  }
  import { createAppAdapter } from '$lib/local-store/app-adapter';
  const galleryAdapter = createAppAdapter<GalleryItem>('module-journal-gallery');

  let galleryItems = $state<{ id: string; dataUrl: string; caption: string; createdAt: number; width: number; height: number }[]>([]);
  let showGalleryFullscreen = $state<string | null>(null);
  let galleryUploading = $state(false);

  async function loadGallery() {
    try {
      const raw = await galleryAdapter.getAll();
      galleryItems = raw.map(r => ({ ...(r as any), id: r.id })).sort((a, b) => b.createdAt - a.createdAt);
    } catch { /* first run */ }
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function pickAndAddImage() {
    galleryUploading = true;
    try {
      // Create a hidden file input and trigger it
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);

      const files = await new Promise<FileList | null>((resolve) => {
        input.onchange = () => resolve(input.files);
        input.click();
      });

      document.body.removeChild(input);

      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const dataUrl = await toBase64(file);

        // Get image dimensions
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = dataUrl;
        });

        const item: GalleryItem = {
          dataUrl,
          caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          createdAt: time.now(),
          width: dimensions.width,
          height: dimensions.height,
        };

        const id = await galleryAdapter.create(item);
        galleryItems = [{ id, ...item }, ...galleryItems];
      }
    } catch (err) {
      console.warn('[journal] gallery upload failed:', err);
    } finally {
      galleryUploading = false;
    }
  }

  async function deleteGalleryImage(id: string) {
    try {
      await galleryAdapter.remove(id);
      galleryItems = galleryItems.filter(g => g.id !== id);
      if (showGalleryFullscreen === id) showGalleryFullscreen = null;
    } catch (err) {
      console.warn('[journal] gallery delete failed:', err);
    }
  }

  async function updateGalleryCaption(id: string, caption: string) {
    try {
      const item = galleryItems.find(g => g.id === id);
      if (!item) return;
      await galleryAdapter.replace(id, {
        dataUrl: item.dataUrl,
        caption,
        createdAt: item.createdAt,
        width: item.width,
        height: item.height,
      });
      galleryItems = galleryItems.map(g => g.id === id ? { ...g, caption } : g);
    } catch (err) {
      console.warn('[journal] gallery caption update failed:', err);
    }
  }

  // ── DELETE entry ─────────────────────────────────────────────────────
  async function deleteEntry(id: string) {
    try {
      await deleteJournalEntry(id);
      entries = entries.filter(e => e.id !== id);
    } catch (err) {
      console.warn('[journal] delete failed:', err);
    }
  }

  type ExportFormat = 'pdf' | 'json' | 'csv' | 'markdown';

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function triggerDownload(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildJournalExportPayload() {
    return {
      exportedAt: time.toISODateTime(time.now()),
      journal: {
        moduleId,
        date: todayDateStr,
        streak,
        entries: entries.map((entry) => ({
          ...entry,
          tags: [...entry.tags],
        })),
        gallery: galleryItems.map((item) => ({
          id: item.id,
          caption: item.caption,
          createdAt: item.createdAt,
          width: item.width,
          height: item.height,
        })),
      },
    };
  }

  // ── Helper: extract plain text from blocks JSON ───────────────────
  // Handles both formats:
  //   1. Old: [{text: "..."}]  (EditableBlock format)
  //   2. New: [{type:"text", content:{text:"..."}, ...}]  (Anytype block format)
  //   3. Fallback: raw string (pre-migration entries)
  function extractPlainText(blocksJson: string): string {
    if (!blocksJson) return '';
    try {
      const blocks = JSON.parse(blocksJson);
      if (Array.isArray(blocks)) {
        return blocks
          .map((b: any) => {
            // Anytype format: content is object or JSON string
            if (b.content) {
              const ct = typeof b.content === 'string'
                ? (() => { try { return JSON.parse(b.content); } catch { return {}; } })()
                : b.content;
              return ct?.text ?? '';
            }
            // Old EditableBlock format
            return b.text ?? '';
          })
          .filter(Boolean)
          .join('\n')
          .trim();
      }
    } catch { /* not JSON — return raw */ }
    // Raw string fallback (entries saved before block system)
    return typeof blocksJson === 'string' ? blocksJson.slice(0, 300) : '';
  }

  function buildMarkdownExport() {
    const lines: string[] = [
      `# Journal Export`,
      ``,
      `Exported: ${new Date().toLocaleString()}`,
      `Entries: ${entries.length}`,          `Streak: ${streak} days`,
      ``,
    ];

    for (const entry of entries) {
      lines.push(
        `## ${entry.date} · ${entry.mood}`,
        ``,
        extractPlainText(entry.text),
        ``,
        entry.tags.length ? `Tags: ${entry.tags.join(', ')}` : `Tags: none`,
        ``,
      );
    }

    if (entries.length === 0) {
      lines.push(`No journal entries yet.`);
    }

    return lines.join('\n');
  }

  function buildCsvExport() {
    const header = ['id', 'date', 'mood', 'text', 'tags', 'dayOfYear', 'year', 'createdAt'];
    const rows = entries.map((entry) => [
      entry.id,
      entry.date,
      entry.mood,
      extractPlainText(entry.text).replaceAll('\n', ' ').replaceAll('"', '""'),
      entry.tags.join('|'),
      String(entry.dayOfYear),
      String(entry.year),
      String(entry.createdAt),
    ].map((value) => `"${value}"`).join(','));

    return [header.join(','), ...rows].join('\n');
  }

  function buildPdfReportHtml() {
    const entriesMarkup = entries.length
      ? entries.map((entry) => `
        <article class="entry">
          <div class="entry__meta">
            <strong>${escapeHtml(entry.date)}</strong>
            <span>${escapeHtml(entry.mood)}</span>
          </div>
          <p>${escapeHtml(extractPlainText(entry.text))}</p>
          ${entry.tags.length ? `<footer>Tags: ${escapeHtml(entry.tags.join(', '))}</footer>` : ''}
        </article>
      `).join('')
      : `<p class="empty">No journal entries yet.</p>`;

    const galleryMarkup = galleryItems.length
      ? galleryItems.map((item) => `<li>${escapeHtml(item.caption || 'Untitled image')} · ${item.width} × ${item.height}</li>`).join('')
      : `<li>No gallery images yet.</li>`;

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Journal Export</title>
          <style>
            :root { color-scheme: dark; }
            body {
              margin: 0;
              padding: 40px;
              font-family: Inter, ui-sans-serif, system-ui, sans-serif;
              background: #111;
              color: #f5f5f5;
            }
            h1, h2, h3, p { margin: 0; }
            .shell { max-width: 900px; margin: 0 auto; }
            .hero {
              display: grid;
              gap: 10px;
              margin-bottom: 28px;
              padding-bottom: 20px;
              border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .hero small { color: rgba(255,255,255,0.65); letter-spacing: 0.08em; text-transform: uppercase; }
            .hero h1 { font-size: 34px; line-height: 1.05; }
            .hero p, .empty, .entry p, .entry footer, li { color: rgba(255,255,255,0.78); }
            .stats {
              display: flex;
              gap: 16px;
              flex-wrap: wrap;
              margin: 22px 0 32px;
            }
            .stat {
              min-width: 160px;
              padding: 16px 18px;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 18px;
              background: rgba(255,255,255,0.04);
            }
            .stat span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(255,255,255,0.55); }
            .stat strong { display: block; margin-top: 8px; font-size: 24px; }
            .section { margin-top: 28px; }
            .section h2 { font-size: 18px; margin-bottom: 14px; letter-spacing: 0.02em; }
            .entry {
              padding: 18px 0;
              border-top: 1px solid rgba(255,255,255,0.08);
            }
            .entry__meta {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              margin-bottom: 10px;
              color: #fff;
            }
            .entry p { white-space: pre-wrap; line-height: 1.6; }
            .entry footer { margin-top: 10px; font-size: 13px; }
            ul { margin: 0; padding-left: 18px; }
            li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="shell">
            <header class="hero">
              <small>Journal export</small>
              <h1>Your data, your way</h1>
              <p>Exported ${escapeHtml(new Date().toLocaleString())}</p>
            </header>

            <section class="stats">
              <div class="stat"><span>Entries</span><strong>${entries.length}</strong></div>
              <div class="stat"><span>Streak</span><strong>${streak} days</strong></div>
              <div class="stat"><span>Gallery items</span><strong>${galleryItems.length}</strong></div>
            </section>

            <section class="section">
              <h2>Entries</h2>
              ${entriesMarkup}
            </section>

            <section class="section">
              <h2>Gallery</h2>
              <ul>${galleryMarkup}</ul>
            </section>
          </div>
        </body>
      </html>
    `;
  }

  function openPdfPreview() {
    const html = buildPdfReportHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) {
      win.addEventListener('load', () => {
        try {
          win.focus();
          win.print();
        } catch (error) {
          console.warn('[journal] pdf preview print failed:', error);
        }
      }, { once: true });
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function exportJournal(format: ExportFormat) {
    const timestamp = time.toISODate(time.now());
    switch (format) {
      case 'json':
        triggerDownload(`journal-export-${timestamp}.json`, JSON.stringify(buildJournalExportPayload(), null, 2), 'application/json');
        break;
      case 'csv':
        triggerDownload(`journal-export-${timestamp}.csv`, buildCsvExport(), 'text/csv');
        break;
      case 'markdown':
        triggerDownload(`journal-export-${timestamp}.md`, buildMarkdownExport(), 'text/markdown');
        break;
      case 'pdf':
        openPdfPreview();
        break;
    }
  }



  // ── Color helper ──────────────────────────────────────────────────────
  function moodColor(id: string | null) {
    const moods = [
      { id: 'awful', color: '#ef4444' }, { id: 'low', color: '#f97316' },
      { id: 'okay', color: '#eab308' }, { id: 'good', color: '#22c55e' },
      { id: 'great', color: '#8b5cf6' },
    ];
    return moods.find(m => m.id === id)?.color ?? 'var(--muted-surface)';
  }

  // ── Date label helper ─────────────────────────────────────────────────
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<main class="j-root" data-module="journal">

  <!-- ═══════════════════════════════════════════════════════════════
       WRITE PAGE — Full-screen, distraction-free editor
  ═══════════════════════════════════════════════════════════════════ -->
  {#if selectedSection === 'Write'}
  <div class="j-page">
    <JournalEditor
      objectId={todayDateStr}
      {todayLabel}
      {dayOfYear}
      {streak}
      bind:isSaving
      bind:saved
      bind:selectedMood
      t={_t}
      onsave={async () => {
        await loadAll();
      }}
    />
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       TIMELINE PAGE
  ═══════════════════════════════════════════════════════════════════ -->
  {:else if selectedSection === 'Timeline'}
  <div class="j-page">
    <div class="j-page-header">
      <div>
        <h2 class="j-page-title">{_t('moduleJournalTimeline')}</h2>
        <p class="j-page-sub">{_t('moduleJournalTimelineDesc')}</p>
      </div>
      <div class="j-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="j-search" type="text" bind:value={searchQuery} placeholder={_t('moduleJournalSearchPlaceholder')} />
        {#if searchQuery}
          <button class="j-search-clear" onclick={() => { searchQuery = ''; }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        {/if}
      </div>
    </div>

    <div class="j-bento j-bento--timeline">

      <!-- Stats row (health-card pattern: 3 mini cards) -->
      <div class="j-stats-row">
        <div class="j-card j-card--surface j-mini-stat">
          <div class="j-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>{_t('moduleJournalTotal')}</div>
          <span class="j-stat-big-sm">{totalEntries}</span>
          <span class="j-card-hint">{_t('moduleJournalEntries')}</span>
        </div>
        <div class="j-card j-card--surface j-mini-stat">
          <div class="j-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>{_t('moduleJournalStreak')}</div>
          <span class="j-stat-big-sm">{streak}</span>
          <span class="j-card-hint">{_t('moduleJournalDays')}</span>
        </div>
        <div class="j-card j-card--surface j-mini-stat">
          <div class="j-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>{_t('moduleJournalBestMood')}</div>
          <span class="j-stat-big-sm" style="color:{moodColor(bestMood.id)}">{moods.find(m=>m.id===bestMood.id)?.label}</span>
          <span class="j-card-hint">{_t('moduleJournalThisMonth')}</span>
        </div>
      </div>

      <!-- Entries feed -->
      <div class="j-timeline-feed">
        {#each filteredEntries as entry}
        <div class="j-timeline-item j-card j-card--surface">
          <div class="j-tl-left">
            <div class="j-tl-dot" style="background:{moodColor(entry.mood)}"></div>
            <div class="j-tl-line"></div>
          </div>
          <div class="j-tl-body">
            <div class="j-tl-header">
              <span class="j-tl-date">{formatDate(entry.date)}</span>
              <span class="j-tl-mood" style="color:{moodColor(entry.mood)}">{moods.find(m=>m.id===entry.mood)?.label}</span>
            </div>
            <p class="j-tl-text">{extractPlainText(entry.text)}</p>
            <div class="j-tl-tags">
              {#each entry.tags as tag}
                <span class="j-tag">{tag}</span>
              {/each}
              <button class="j-tl-delete-btn" onclick={() => deleteEntry(entry.id)} title={_t('commonDelete')} aria-label={_t('commonDelete')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
        {:else}
        <div class="j-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="j-empty-icon"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p class="j-empty-text">{_t('moduleJournalTimelineEmpty')}</p>
        </div>
        {/each}
      </div>

    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       MOOD PAGE
  ═══════════════════════════════════════════════════════════════════ -->
  {:else if selectedSection === 'Mood'}
  <div class="j-page">
    <div class="j-page-header">
      <div>
        <h2 class="j-page-title">{_t('moduleJournalMoodTracker')}</h2>
        <p class="j-page-sub">{_t('moduleJournalMoodDesc')}</p>
      </div>
    </div>

    <div class="j-bento j-bento--mood">

      <!-- Big mood heatmap (health-card pattern) -->
      <div class="j-card j-card--surface j-card--heatmap">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {_t('moduleJournalMoodMap')}
        </div>
        <div class="j-heatmap">
          {#each moodMap as cell}
            <div
              class="j-heat-cell"
              class:j-heat-cell--today={cell.day === 22}
              style="background:{cell.mood ? moodColor(cell.mood) : 'var(--muted-surface)'};opacity:{cell.mood ? 0.85 : 0.25}"
              title={cell.mood ? `${_t('moduleJournalDayOfYear')} ${cell.day}: ${cell.mood}` : `${_t('moduleJournalDayOfYear')} ${cell.day}: ${_t('moduleJournalNoEntry')}`}
            >
              <span class="j-heat-num">{cell.day}</span>
            </div>
          {/each}
        </div>
        <div class="j-legend">
          {#each moods as m}
            <span class="j-legend-item"><span class="j-legend-dot" style="background:{m.color}"></span>{m.label}</span>
          {/each}
        </div>
      </div>

      <!-- Mood breakdown (recipe card: item list) -->
      <div class="j-card j-card--dark j-card--breakdown">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          {_t('moduleJournalDistribution')}
        </div>
        {#each moods.slice().reverse() as mood}
          {@const count = moodCounts[mood.id] ?? 0}
          {@const total = Object.values(moodCounts).reduce((a,b)=>a+b,0)}
          <div class="j-bar-row">
            <span class="j-bar-label">{mood.label}</span>
            <div class="j-bar-track">
              <div class="j-bar-fill" style="width:{(count/total)*100}%;background:{mood.color}"></div>
            </div>
            <span class="j-bar-count">{count}</span>
          </div>
        {/each}
      </div>

    </div>
  </div>







  <!-- ═══════════════════════════════════════════════════════════════
       GALLERY PAGE
  ═══════════════════════════════════════════════════════════════════ -->
  {:else if selectedSection === 'Photos'}
  <div class="j-page">
    <div class="j-page-header">
      <div>
        <h2 class="j-page-title">{_t('moduleJournalPhotoGallery')}</h2>
        <p class="j-page-sub">{_t('moduleJournalGalleryDesc')}</p>
      </div>
      <button class="j-gallery-upload-btn" onclick={pickAndAddImage} disabled={galleryUploading}>
        {#if galleryUploading}
          <span class="j-spinner"></span> {_t('moduleJournalGalleryUploading')}
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          {_t('moduleJournalGalleryAdd')}
        {/if}
      </button>
    </div>

    <div class="j-bento j-bento--gallery">

      {#if galleryItems.length === 0}
      <div class="j-gallery-empty j-card j-card--surface">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="j-empty-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p class="j-empty-text">{_t('moduleJournalGalleryEmpty')}</p>
        <button class="j-gallery-upload-btn j-gallery-upload-btn--empty" onclick={pickAndAddImage}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {_t('moduleJournalGalleryFirstImage')}
        </button>
      </div>
      {:else}
        {#each galleryItems as item (item.id)}
          <div class="j-gallery-item" class:j-gallery-item--tall={item.height > item.width * 1.3} class:j-gallery-item--wide={item.width > item.height * 1.3}>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <img
              src={item.dataUrl}
              alt={item.caption}
              class="j-gallery-img"
              onclick={() => showGalleryFullscreen = item.id}
              loading="lazy"
            />
            <div class="j-gallery-overlay">
              <button class="j-gallery-overlay-btn" onclick={() => showGalleryFullscreen = item.id} title={_t('moduleJournalGalleryView')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="j-gallery-overlay-btn j-gallery-overlay-btn--danger" onclick={() => deleteGalleryImage(item.id)} title={_t('commonDelete')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}

    </div>

    <!-- Empty spacer for consistent layout -->
    <div class="j-gallery-footer-info">
      <span class="j-card-hint">{galleryItems.length} {_t('moduleJournalGalleryImages')} · {_t('moduleJournalGalleryLocalOnly')}</span>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       RECAP PAGE
  ═══════════════════════════════════════════════════════════════════ -->
  {:else if selectedSection === 'Recap'}
  <div class="j-page">
    <div class="j-page-header">
      <div>
        <h2 class="j-page-title">{_t('moduleJournalMonthlyRecap')}</h2>
        <p class="j-page-sub">{_t('moduleJournalRecapDesc')}</p>
      </div>
    </div>

    <div class="j-bento j-bento--recap">

      <!-- Summary card (accent) -->
      <div class="j-card j-card--accent j-card--recap-hero">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          {_t('moduleJournalDigest')}
        </div>
        <p class="j-recap-summary">{recap.summary}</p>
        <div class="j-recap-wins">
          {#each recap.wins as win}
            <span class="j-win-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {win}
            </span>
          {/each}
        </div>
      </div>

      <!-- Patterns (recipe steps style) -->
      <div class="j-card j-card--surface j-card--patterns">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
          {_t('moduleJournalPatternsDetected')}
        </div>
        {#each recap.patterns as p, i}
        <div class="j-pattern-row">
          <span class="j-pattern-num">0{i+1}</span>
          <span class="j-pattern-text">{p}</span>
        </div>
        {/each}
      </div>

      <!-- Year progress -->
      <div class="j-card j-card--dark j-card--year">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {_t('moduleJournalYearProgress')}
        </div>
        <div class="j-stat-big">{dayOfYear}<span class="j-stat-unit">{_t('moduleJournalDays')}</span></div>
        <div class="j-year-track">
          <div class="j-year-fill" style="width:{(dayOfYear/365)*100}%"></div>
        </div>
        <p class="j-card-hint">{365 - dayOfYear} {_t('moduleJournalDaysRemaining')}</p>
        <button class="j-nav-link" onclick={() => nav('Export')}>
          {_t('moduleJournalExportYear')}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>

    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       EXPORT PAGE
  ═══════════════════════════════════════════════════════════════════ -->
  {:else if selectedSection === 'Export'}
  <div class="j-page">
    <div class="j-page-header">
      <div>
        <h2 class="j-page-title">{_t('moduleJournalExport')}</h2>
        <p class="j-page-sub">{_t('moduleJournalExportDesc')}</p>
      </div>
    </div>

    <div class="j-bento j-bento--export">

      <div class="j-card j-card--accent j-card--privacy">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          {_t('moduleJournalPrivacyFirst')}
        </div>
        <p class="j-privacy-text">{_t('moduleJournalPrivacyText')}</p>
        <div class="j-privacy-badges">
          <span class="j-pbadge">{_t('moduleJournalLocalOnlyLab')}</span>
          <span class="j-pbadge">{_t('moduleJournalNoTrackingLab')}</span>
          <span class="j-pbadge">{_t('moduleJournalOfflineFirstLab')}</span>
        </div>
      </div>

      <div class="j-card j-card--surface j-card--export-opts">
        <div class="j-card-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {_t('moduleJournalExportFormats')}
        </div>
        {#each [
          { fmt: _t('moduleJournalPDFReport'), desc: _t('moduleJournalPDFDesc'), icon: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' },
          { fmt: _t('moduleJournalJSONBackup'), desc: _t('moduleJournalJSONDesc'), icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
          { fmt: _t('moduleJournalCSVMood'), desc: _t('moduleJournalCSVDesc'), icon: 'M9 17H7A5 5 0 0 1 7 7h2' },
          { fmt: _t('moduleJournalMarkdown'), desc: _t('moduleJournalMarkdownDesc'), icon: 'M4 6h16M4 12h16M4 18h7' },
        ] as opt, idx}
        <button class="j-export-row" onclick={() => exportJournal(exportFormats[idx])}>
          <svg class="j-export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="{opt.icon}"/></svg>
          <div class="j-export-info">
            <span class="j-export-name">{opt.fmt}</span>
            <span class="j-export-desc">{opt.desc}</span>
          </div>
          <svg class="j-export-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        {/each}
      </div>

    </div>
  </div>
  {/if}

</main>

<!-- ═══════════════════════════════════════════════════════════════
     FULLSCREEN GALLERY VIEWER
═══════════════════════════════════════════════════════════════════ -->
{#if showGalleryFullscreen}
  {@const fullItem = galleryItems.find(g => g.id === showGalleryFullscreen)}
  {#if fullItem}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="j-fs-overlay" onclick={() => showGalleryFullscreen = null}>
    <div class="j-fs-backdrop"></div>
    <div class="j-fs-container" onclick={(e) => { if (e.target === e.currentTarget) showGalleryFullscreen = null; }}>
      <div class="j-fs-toolbar">
        <div class="j-fs-nav">
          <span class="j-fs-counter">
            {galleryItems.findIndex(g => g.id === showGalleryFullscreen) + 1} / {galleryItems.length}
          </span>
        </div>
        <div class="j-fs-actions">
          <button class="j-fs-btn" onclick={() => {
            const idx = galleryItems.findIndex(g => g.id === showGalleryFullscreen);
            const prev = galleryItems[(idx - 1 + galleryItems.length) % galleryItems.length];
            if (prev) showGalleryFullscreen = prev.id;
          }} title={_t('moduleJournalGalleryPrev')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="j-fs-btn" onclick={() => {
            const idx = galleryItems.findIndex(g => g.id === showGalleryFullscreen);
            const next = galleryItems[(idx + 1) % galleryItems.length];
            if (next) showGalleryFullscreen = next.id;
          }} title={_t('moduleJournalGalleryNext')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button class="j-fs-btn j-fs-btn--close" onclick={() => showGalleryFullscreen = null} title={_t('commonClose')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="j-fs-image-wrap">
        <img src={fullItem.dataUrl} alt={fullItem.caption} class="j-fs-image" />
      </div>
      <div class="j-fs-caption-bar">
        <input
          class="j-fs-caption-input"
          type="text"
          bind:value={fullItem.caption}
          onchange={() => updateGalleryCaption(fullItem.id, fullItem.caption)}
          placeholder={_t('moduleJournalGalleryCaptionPlaceholder')}
        />
        <span class="j-fs-dimensions">{fullItem.width} × {fullItem.height}</span>
        <button class="j-fs-btn j-fs-btn--delete" onclick={() => deleteGalleryImage(fullItem.id)} title={_t('commonDelete')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  </div>
  {/if}
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════
     JOURNAL MODULE — Bento card system
     ═══════════════════════════════════════════════════════════════ */
  .j-root {
    --mod-accent: #818cf8;
    --j-bg: var(--mod-bg, var(--background));
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: var(--j-bg);
    color: var(--foreground);
    font-family: var(--font-body);
    overflow-y: auto;
  }

  .j-page {
    padding: 28px 24px 40px;
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
  }

  .j-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .j-page-title {
    font-size: 22px;
    font-weight: 650;
    margin: 0 0 4px;
    font-family: var(--font-heading);
    letter-spacing: -0.3px;
  }

  .j-page-sub {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  /* ── Bento Grid ──────────────────────────────────────────────── */
  .j-bento {
    display: grid;
    gap: 16px;
  }

  .j-bento--timeline {
    grid-template-columns: 1fr;
  }

  .j-bento--mood {
    grid-template-columns: 2fr 1fr;
  }

  .j-bento--recap {
    grid-template-columns: 1.5fr 1fr 1fr;
  }

  .j-bento--export {
    grid-template-columns: 1fr 1.5fr;
  }

  /* ── Card Base ────────────────────────────────────────────────── */
  .j-card {
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.2s ease;
  }

  .j-card--accent {
    background: var(--mod-accent, #818cf8);
    color: #fff;
  }

  .j-card--surface {
    background: var(--card);
    border: 1px solid var(--border);
  }

  .j-card--dark {
    background: var(--surface);
    color: var(--surface-foreground, #fff);
  }

  .j-card-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .j-card-label svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .j-card-hint {
    font-size: 12px;
    opacity: 0.65;
    margin: 0;
  }

  .j-stat-big {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .j-stat-unit {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.6;
  }

  .j-nav-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: inherit;
    font-size: 12px;
    opacity: 0.7;
    cursor: pointer;
    padding: 0;
    transition: opacity 0.2s;
  }

  .j-nav-link:hover {
    opacity: 1;
  }

  .j-nav-link svg {
    width: 14px;
    height: 14px;
  }

  .j-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--foreground);
    border-radius: 50%;
    animation: j-spin 0.6s linear infinite;
    display: inline-block;
    vertical-align: middle;
  }

  @keyframes j-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Timeline ─────────────────────────────────────────────────── */
  .j-stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-bottom: 8px;
  }

  .j-mini-stat {
    padding: 18px !important;
  }

  .j-stat-big-sm {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
  }

  .j-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--muted-surface);
    border: 1px solid var(--border);
  }

  .j-search-wrap svg {
    width: 15px;
    height: 15px;
    color: var(--muted);
    flex-shrink: 0;
  }

  .j-search {
    border: none;
    background: none;
    outline: none;
    color: var(--foreground);
    font-size: 13px;
    min-width: 160px;
  }

  .j-search::placeholder {
    color: var(--muted);
  }

  .j-search-clear {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .j-search-clear:hover {
    background: var(--border);
    color: var(--foreground);
  }

  .j-search-clear svg {
    width: 14px;
    height: 14px;
  }

  .j-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    text-align: center;
  }

  .j-empty-icon {
    width: 48px;
    height: 48px;
    color: var(--muted);
    opacity: 0.4;
  }

  .j-empty-text {
    font-size: 14px;
    color: var(--muted);
    margin: 0;
  }

  .j-timeline-feed {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .j-timeline-item {
    display: flex;
    gap: 16px;
    padding: 18px !important;
  }

  .j-tl-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .j-tl-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2px solid var(--card);
    box-shadow: 0 0 0 1px var(--border);
  }

  .j-tl-line {
    flex: 1;
    width: 2px;
    background: var(--border);
    min-height: 20px;
  }

  .j-tl-body {
    flex: 1;
    min-width: 0;
  }

  .j-tl-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
  }

  .j-tl-date {
    font-size: 12px;
    color: var(--muted);
  }

  .j-tl-mood {
    font-size: 12px;
    font-weight: 600;
  }

  .j-tl-text {
    font-size: 14px;
    line-height: 1.5;
    margin: 6px 0;
    color: var(--foreground);
  }

  .j-tl-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .j-tl-delete-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: all 0.15s;
  }

  .j-timeline-item:hover .j-tl-delete-btn {
    opacity: 0.6;
  }

  .j-tl-delete-btn:hover {
    opacity: 1 !important;
    background: rgba(239,68,68,0.1);
    color: #ef4444;
  }

  .j-tl-delete-btn svg {
    width: 14px;
    height: 14px;
  }

  .j-tag {
    display: inline-block;
    padding: 3px 10px;
    background: var(--muted-surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 11px;
    color: var(--muted);
  }

  /* ── Mood Heatmap ─────────────────────────────────────────────── */
  .j-card--heatmap {
    grid-column: span 1;
  }

  .j-heatmap {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  .j-heat-cell {
    aspect-ratio: 1;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    cursor: default;
    transition: all 0.2s;
    position: relative;
  }

  .j-heat-cell:hover {
    transform: scale(1.08);
    z-index: 2;
  }

  .j-heat-cell--today {
    border: 2px solid var(--mod-accent, #818cf8);
    box-shadow: 0 0 0 1px var(--card);
  }

  .j-heat-num {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
  }

  .j-legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .j-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
  }

  .j-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 4px;
  }

  /* ── Mood Breakdown Bars ──────────────────────────────────────── */
  .j-card--breakdown {
    padding: 22px;
  }

  .j-bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .j-bar-label {
    width: 48px;
    font-size: 12px;
    font-weight: 500;
    opacity: 0.8;
    flex-shrink: 0;
  }

  .j-bar-track {
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.1);
    overflow: hidden;
  }

  .j-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .j-bar-count {
    width: 24px;
    font-size: 12px;
    font-weight: 600;
    text-align: right;
    opacity: 0.7;
  }

  /* ── Recap ────────────────────────────────────────────────────── */
  .j-card--recap-hero {
    padding: 24px;
  }

  .j-recap-summary {
    font-size: 14px;
    line-height: 1.7;
    margin: 0;
    opacity: 0.9;
  }

  .j-recap-wins {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .j-win-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    font-size: 12px;
    font-weight: 500;
  }

  .j-win-chip svg {
    width: 13px;
    height: 13px;
  }

  .j-card--patterns {
    padding: 20px;
  }

  .j-pattern-row {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .j-pattern-row:last-child {
    border-bottom: none;
  }

  .j-pattern-num {
    font-size: 11px;
    font-weight: 700;
    color: var(--mod-accent, #818cf8);
    width: 24px;
    flex-shrink: 0;
  }

  .j-pattern-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--muted);
  }

  .j-card--year {
    padding: 22px;
  }

  .j-year-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.1);
    overflow: hidden;
  }

  .j-year-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--mod-accent, #818cf8);
    transition: width 0.4s;
  }

  /* ── Export ────────────────────────────────────────────────────── */
  .j-card--privacy {
    padding: 24px;
  }

  .j-privacy-text {
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
    opacity: 0.85;
  }

  .j-privacy-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .j-pbadge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    font-size: 11px;
    font-weight: 500;
  }

  .j-card--export-opts {
    padding: 18px;
  }

  .j-export-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 12px;
    border: none;
    border-radius: 14px;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
  }

  .j-export-row:hover {
    background: var(--muted-surface);
  }

  .j-export-icon {
    width: 20px;
    height: 20px;
    color: var(--mod-accent, #818cf8);
    flex-shrink: 0;
  }

  .j-export-info {
    flex: 1;
    min-width: 0;
  }

  .j-export-name {
    display: block;
    font-size: 13px;
    font-weight: 600;
  }

  .j-export-desc {
    display: block;
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }

  .j-export-arrow {
    width: 16px;
    height: 16px;
    color: var(--muted);
    flex-shrink: 0;
  }

  /* ── Gallery ──────────────────────────────────────────────────── */
  .j-bento--gallery {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .j-gallery-upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .j-gallery-upload-btn:hover:not(:disabled) {
    background: var(--muted-surface);
    border-color: var(--mod-accent, #818cf8);
  }

  .j-gallery-upload-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .j-gallery-upload-btn svg {
    width: 16px;
    height: 16px;
  }

  .j-gallery-upload-btn--empty {
    margin-top: 8px;
  }

  .j-gallery-empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 24px !important;
    text-align: center;
  }

  .j-gallery-item {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
    aspect-ratio: 1;
    background: var(--muted-surface);
    border: 1px solid var(--border);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .j-gallery-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    border-color: var(--mod-accent, #818cf8);
  }

  .j-gallery-item--tall {
    grid-row: span 2;
    aspect-ratio: 1 / 1.3;
  }

  .j-gallery-item--wide {
    grid-column: span 2;
    aspect-ratio: 2 / 1;
  }

  .j-gallery-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  .j-gallery-item:hover .j-gallery-img {
    transform: scale(1.05);
  }

  .j-gallery-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: linear-gradient(transparent 60%, rgba(0,0,0,0.5));
    opacity: 0;
    transition: opacity 0.2s;
  }

  .j-gallery-item:hover .j-gallery-overlay {
    opacity: 1;
  }

  .j-gallery-overlay-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.6);
    color: #fff;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s;
    backdrop-filter: blur(4px);
  }

  .j-gallery-overlay-btn:hover {
    background: rgba(0,0,0,0.8);
    transform: scale(1.1);
  }

  .j-gallery-overlay-btn svg {
    width: 15px;
    height: 15px;
  }

  .j-gallery-overlay-btn--danger:hover {
    background: rgba(239,68,68,0.8);
  }

  .j-gallery-footer-info {
    display: flex;
    justify-content: center;
    padding: 12px 0 4px;
  }

  /* ── Fullscreen Viewer ─────────────────────────────────────────── */
  .j-fs-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: j-fs-in 0.2s ease;
  }

  @keyframes j-fs-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .j-fs-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
  }

  .j-fs-container {
    position: relative;
    width: 90vw;
    max-width: 1000px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    background: var(--card);
    box-shadow: 0 24px 80px rgba(0,0,0,0.5);
    animation: j-fs-scale 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes j-fs-scale {
    from { transform: scale(0.92); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .j-fs-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .j-fs-counter {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }

  .j-fs-actions {
    display: flex;
    gap: 4px;
  }

  .j-fs-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s;
  }

  .j-fs-btn:hover {
    background: var(--muted-surface);
    color: var(--foreground);
  }

  .j-fs-btn svg {
    width: 18px;
    height: 18px;
  }

  .j-fs-btn--close:hover {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }

  .j-fs-btn--delete:hover {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }

  .j-fs-image-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
    min-height: 300px;
    max-height: 65vh;
    background: #0a0a0a;
  }

  .j-fs-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .j-fs-caption-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .j-fs-caption-input {
    flex: 1;
    border: none;
    background: var(--muted-surface);
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--foreground);
    outline: none;
    min-width: 0;
  }

  .j-fs-caption-input:focus {
    border: 1px solid var(--mod-accent, #818cf8);
    box-shadow: 0 0 0 2px rgba(129,140,248,0.15);
  }

  .j-fs-dimensions {
    font-size: 11px;
    color: var(--muted);
    font-weight: 500;
    flex-shrink: 0;
  }

  /* ── Responsive ───────────────────────────────────────────────── */
  @media (max-width: 860px) {
    .j-bento--mood { grid-template-columns: 1fr; }
    .j-bento--recap { grid-template-columns: 1fr; }
    .j-bento--export { grid-template-columns: 1fr; }
    .j-bento--gallery { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .j-stats-row { grid-template-columns: 1fr; }
    .j-page { padding: 20px 16px 32px; }
    .j-gallery-item--tall { grid-row: span 1; }
    .j-gallery-item--wide { grid-column: span 1; }
    .j-fs-container { width: 96vw; border-radius: 12px; }
    .j-fs-image-wrap { padding: 8px; max-height: 55vh; }
  }
</style>
