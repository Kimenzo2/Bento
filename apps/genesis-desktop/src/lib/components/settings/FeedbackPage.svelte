<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { createClient } from '@supabase/supabase-js';
  import { time } from '$lib/utils/time';

  // ── Types ────────────────────────────────────────────────────────────
  interface FeedbackReport {
    id: string;
    type: 'bug' | 'feature';
    title: string;
    description: string;
    severity: string | null;
    category: string | null;
    active_module: string | null;
    app_version: string;
    os_name: string;
    os_version: string;
    status: string;
    developer_note: string | null;
    github_issue_url: string | null;
    created_at: string;
    updated_at: string;
  }

  interface FeedbackRealtimeConfig {
    supabaseUrl: string;
    anonKey: string;
    accessToken: string;
    userId: string;
  }

  // ── State ────────────────────────────────────────────────────────────
  let reports = $state<FeedbackReport[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let updatedIds = $state<Set<string>>(new Set());
  let expandedIds = $state<Set<string>>(new Set());

  // ── Relative time helper ─────────────────────────────────────────────
  function relativeTime(dateStr: string): string {
    const now = time.now();
    const then = time.parseISO(dateStr);
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth}mo ago`;
    return `${Math.floor(diffMonth / 12)}y ago`;
  }

  // ── Status config ────────────────────────────────────────────────────
  const statusConfig: Record<string, { label: string; icon: string; color?: string }> = {
    submitted:   { label: 'Submitted',   icon: 'clock' },
    reviewing:   { label: 'Under Review',icon: 'eye' },
    in_progress: { label: 'In Progress', icon: 'wrench' },
    fixed:       { label: 'Fixed',       icon: 'check-circle', color: 'var(--primary)' },
    planned:     { label: 'Planned',     icon: 'calendar-check', color: 'var(--primary)' },
    rejected:    { label: 'Closed',      icon: 'x-circle' },
    wont_fix:    { label: 'Won\'t Fix',  icon: 'ban' },
  };

  // ── Icons as SVG strings (no Lucide import needed in this file) ──────
  const StatusIcon = {
    clock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    wrench: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    'check-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    'calendar-check': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>',
    'x-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    ban: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  } as const;

  // ── Fetch reports ────────────────────────────────────────────────────
  async function fetchReports() {
    loading = true;
    error = null;
    try {
      reports = await invoke<FeedbackReport[]>('get_my_feedback');
    } catch (e) {
      error = typeof e === 'string' ? e : 'Failed to load feedback. Please try again.';
      reports = [];
    } finally {
      loading = false;
    }
  }

  // ── Realtime subscription ────────────────────────────────────────────
  let supabaseClient: any = null;
  let realtimeChannel: any = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function markUpdated(ids: string[]) {
    if (ids.length === 0) return;
    updatedIds = new Set(ids);
    setTimeout(() => { updatedIds = new Set(); }, 2000);
  }

  function applyUpdatedReport(updated: FeedbackReport) {
    let changed = false;
    reports = reports.map((report) => {
      if (report.id !== updated.id) return report;
      changed = report.status !== updated.status ||
        report.developer_note !== updated.developer_note ||
        report.github_issue_url !== updated.github_issue_url;
      return updated;
    });

    if (changed) {
      markUpdated([updated.id]);
    }
  }

  function startPollingFallback() {
    if (intervalId) return;
    intervalId = setInterval(async () => {
      try {
        const fresh = await invoke<FeedbackReport[]>('get_my_feedback');
        const changed = fresh.filter(r => {
          const old = reports.find(o => o.id === r.id);
          return !old ||
            old.status !== r.status ||
            old.developer_note !== r.developer_note ||
            old.github_issue_url !== r.github_issue_url;
        });

        if (changed.length > 0 || fresh.length !== reports.length) {
          reports = fresh;
          markUpdated(changed.map(r => r.id));
        }
      } catch {
        // silently ignore poll errors
      }
    }, 15000);
  }

  async function initRealtime() {
    try {
      const config = await invoke<FeedbackRealtimeConfig>('get_feedback_realtime_config');
      supabaseClient = createClient(config.supabaseUrl, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
        },
      });

      realtimeChannel = supabaseClient
        .channel(`feedback_reports:${config.userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'feedback_reports',
            filter: `user_id=eq.${config.userId}`,
          },
          (payload: { new: FeedbackReport }) => {
            applyUpdatedReport(payload.new as FeedbackReport);
          },
        )
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            startPollingFallback();
          }
        });
    } catch {
      startPollingFallback();
    }
  }

  function cleanupRealtime() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (supabaseClient && realtimeChannel) {
      void supabaseClient.removeChannel(realtimeChannel);
    }
    realtimeChannel = null;
    supabaseClient = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────
  onMount(() => {
    fetchReports();
    initRealtime();
  });

  onDestroy(() => {
    cleanupRealtime();
  });

  // ── Toggle expanded description ──────────────────────────────────────
  function toggleExpanded(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  // ── Status badge class ───────────────────────────────────────────────
  function statusClass(status: string): string {
    if (status === 'fixed' || status === 'planned') return 'feedback-card__status--positive';
    if (status === 'rejected' || status === 'wont_fix') return 'feedback-card__status--muted';
    return '';
  }
</script>

<div class="feedback-page">
  <!-- ── Page header ────────────────────────────────────────────────── -->
  <div class="feedback-page__header">
    <h2>Your Feedback</h2>
    <p>Track your submitted feedback and status updates</p>
  </div>

  <!-- ── Loading state ──────────────────────────────────────────────── -->
  {#if loading}
    <div class="feedback-page__list">
      {#each [1, 2, 3] as _}
        <div class="feedback-card feedback-card--skeleton">
          <div class="feedback-card__top">
            <div class="skeleton skeleton--badge" style="width: 70px; height: 22px;"></div>
            <div class="skeleton skeleton--badge" style="width: 90px; height: 22px;"></div>
          </div>
          <div class="skeleton skeleton--title" style="width: 60%; height: 18px;"></div>
          <div class="skeleton skeleton--desc" style="width: 100%; height: 14px;"></div>
          <div class="skeleton skeleton--desc" style="width: 80%; height: 14px;"></div>
        </div>
      {/each}
    </div>

  <!-- ── Error state ────────────────────────────────────────────────── -->
  {:else if error}
    <div class="feedback-page__empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--destructive);">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{error}</p>
      <button class="feedback-page__retry" onclick={() => fetchReports()}>Retry</button>
    </div>

  <!-- ── Empty state ────────────────────────────────────────────────── -->
  {:else if reports.length === 0}
    <div class="feedback-page__empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--muted);">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <p>No feedback submitted yet</p>
      <p class="feedback-page__empty-sub">Use the button in the bottom-left to send feedback</p>
    </div>

  <!-- ── Cards list ─────────────────────────────────────────────────── -->
  {:else}
    <div class="feedback-page__list">
      {#each reports as report}
        <div
          class="feedback-card"
          class:feedback-card--updated={updatedIds.has(report.id)}
        >
          <div class="feedback-card__title-row">
            <div class="feedback-card__title">{report.title}</div>
            <span class="feedback-card__status {statusClass(report.status)}">
              {@html (StatusIcon as Record<string, string>)[statusConfig[report.status]?.icon ?? 'clock'] || ''}
              {statusConfig[report.status]?.label ?? report.status}
            </span>
          </div>

          <!-- Description -->
          <div class="feedback-card__desc" class:feedback-card__desc--expanded={expandedIds.has(report.id)}>
            {report.description}
          </div>

          <div class="feedback-card__footer">
            {#if report.description.length > 96}
              <button class="feedback-card__expand" onclick={() => toggleExpanded(report.id)}>
                {expandedIds.has(report.id) ? 'Show less' : 'Show more'}
              </button>
            {:else}
              <span class="feedback-card__expand feedback-card__expand--static"></span>
            {/if}
            <span class="feedback-card__meta">{relativeTime(report.created_at)}</span>
          </div>

          <!-- Developer note -->
          {#if report.developer_note}
            <div class="feedback-card__devnote">
              <span class="feedback-card__devnote-label">Developer note</span>
              <p>{report.developer_note}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* ── Page header ───────────────────────────────────────────────────── */
  .feedback-page__header h2 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .feedback-page__header p {
    margin: 0;
    color: var(--muted);
  }

  /* ── List ──────────────────────────────────────────────────────────── */
  .feedback-page__list {
    display: grid;
    gap: 10px;
  }

  /* ── Cards ─────────────────────────────────────────────────────────── */
  .feedback-card {
    display: grid;
    gap: 9px;
    border-radius: 1.15rem;
    border: none;
    background: var(--surface);
    padding: 0.95rem;
    position: relative;
    overflow: hidden;
    box-shadow: none;
  }


  .feedback-card__status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
  .feedback-card__status svg {
    width: 14px;
    height: 14px;
  }
  .feedback-card__status--positive { color: var(--primary); }
  .feedback-card__status--muted { opacity: 0.55; }

  .feedback-card__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .feedback-card__title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--foreground);
    line-height: 1.35;
    letter-spacing: -0.02em;
    min-width: 0;
  }

  .feedback-card__desc {
    color: var(--muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    line-clamp: 1;
    -webkit-line-clamp: 1;
    overflow: hidden;
    min-height: 1.5em;
  }
  .feedback-card__desc--expanded {
    line-clamp: unset;
    -webkit-line-clamp: unset;
    display: block;
    min-height: 0;
  }

  .feedback-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .feedback-card__expand {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-align: left;
    white-space: nowrap;
  }
  .feedback-card__expand:hover {
    color: var(--foreground);
  }
  .feedback-card__expand--static {
    display: inline-block;
    min-width: 72px;
    min-height: 1px;
  }

  .feedback-card__devnote {
    border-radius: 0.9rem;
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    padding: 0.85rem 0.9rem;
    margin-top: 2px;
  }
  .feedback-card__devnote-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    display: block;
    margin-bottom: 4px;
  }
  .feedback-card__devnote p {
    margin: 0;
    color: var(--foreground);
    line-height: 1.45;
  }

  .feedback-card__meta {
    color: var(--muted);
  }

  /* ── Empty & error states ──────────────────────────────────────────── */
  .feedback-page__empty {
    display: grid;
    place-items: center;
    gap: 12px;
    padding: 48px 24px;
    text-align: center;
  }
  .feedback-page__empty p {
    margin: 0;
    font-weight: 600;
    color: var(--muted);
  }
  .feedback-page__empty-sub {
    font-weight: 400 !important;
    max-width: 260px;
  }
  .feedback-page__retry {
    margin-top: 4px;
    padding: 6px 18px;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    background: transparent;
    color: var(--foreground);
    font-weight: 600;
    cursor: pointer;
  }
  .feedback-page__retry:hover {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  /* ── Skeleton loading ──────────────────────────────────────────────── */
  .feedback-card--skeleton { gap: 10px; pointer-events: none; }
  .skeleton {
    border-radius: 6px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .skeleton--badge { border-radius: 9999px; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
