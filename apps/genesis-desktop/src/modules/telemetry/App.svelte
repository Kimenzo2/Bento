<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowUpRight, CircleAlert, Download, RefreshCcw } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from '$lib/stores/module-sections.store';
  import {
    getTelemetryBrainOverview,
    getTelemetryInsights,
    getTelemetryModuleDetail,
    subscribeBrainEvents,
    type BrainOverviewPayload,
    type InsightsPayload,
    type ModuleDetailPayload,
    type TelemetryRange,
  } from '$lib/desktop/telemetry';
  import TelemetryChartPanel from './TelemetryChartPanel.svelte';
  import TelemetryDataTable from './TelemetryDataTable.svelte';

  export let moduleId = 'telemetry';
  export let settings: Record<string, unknown> = {};
  void settings;

  const sectionLabels = ['Brain Overview', 'Module Detail', 'Insights'] as const;
  type SectionLabel = (typeof sectionLabels)[number];
  const rangeOptions: TelemetryRange[] = ['24h', '7d', '30d'];

  let currentRange: TelemetryRange = '24h';
  let loading = false;
  let errorMessage = '';
  let collectorWarmingUp = false;
  let selectedModuleId = 'tasks';
  let overview: BrainOverviewPayload | null = null;
  let detail: ModuleDetailPayload | null = null;
  let insights: InsightsPayload | null = null;
  let lastEventNote = '';
  let reloadTimer: number | null = null;

  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels) as SectionLabel;
  $: selectedModuleCard = overview?.miniApps.find((item) => item.miniAppId === selectedModuleId) ?? overview?.miniApps[0] ?? null;
  $: selectedModulePicker = detail?.availableModules.find((item) => item.miniAppId === selectedModuleId) ?? detail?.availableModules[0] ?? null;
  $: detailMemoryLabels = detail?.memoryPoints.map((point) => point.label) ?? [];
  $: detailMemoryValues = detail?.memoryPoints.map((point) => point.value) ?? [];
  $: detailBaselineValue = detail?.baselineHeapMb ?? 0;
  $: detailMemoryBaseline = detail?.memoryPoints.map(() => detailBaselineValue) ?? [];
  $: detailAnomalyRows =
    detail?.anomalyHistory.map((row) => ({
      id: `${row.at}-${row.kind}`,
      cells: {
        at: row.at,
        severity: row.severity,
        kind: row.kind,
        message: row.message,
        resolution: row.healAction ? `${row.healAction} · ${row.resolvedInMs ?? 0}ms` : 'Logged only',
      },
    })) ?? [];
  $: predictionRows =
    insights?.predictions.map((row) => ({
      id: `${row.miniAppId}-${row.metric}`,
      cells: {
        miniApp: row.miniAppId,
        metric: row.metric,
        current: row.currentValue.toFixed(1),
        projected: row.projectedValueIn5min.toFixed(1),
        threshold: `${Math.round(row.timeToThresholdSecs / 60)} min`,
        verdict:
          row.wasCorrect == null ? 'Pending' : row.wasCorrect ? 'Correct' : 'Missed',
      },
    })) ?? [];
  $: healingRows =
    insights?.healings.map((row) => ({
      id: `${row.at}-${row.miniAppId}-${row.action}`,
      cells: {
        at: row.at,
        miniApp: row.miniAppId,
        action: row.action,
        status: row.result.status,
        detail: row.result.message,
        resolved: `${row.resolvedInMs} ms`,
      },
    })) ?? [];

  async function loadTelemetry() {
    loading = true;
    errorMessage = '';
    collectorWarmingUp = false;

    try {
      const [nextOverview, nextDetail, nextInsights] = await Promise.all([
        getTelemetryBrainOverview(currentRange),
        getTelemetryModuleDetail(currentRange, selectedModuleId),
        getTelemetryInsights(currentRange),
      ]);

      overview = nextOverview;
      detail = nextDetail;
      insights = nextInsights;
      selectedModuleId = nextDetail.selectedModuleId;
      lastEventNote = nextOverview.lastEvent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load telemetry brain.';
      if (!overview && !detail && !insights) {
        collectorWarmingUp = true;
        lastEventNote = 'Telemetry brain is warming up and will populate as collector samples arrive.';
      } else {
        errorMessage = message;
      }
    } finally {
      loading = false;
    }
  }

  function setRange(range: TelemetryRange) {
    if (range === currentRange) return;
    currentRange = range;
    void loadTelemetry();
  }

  function selectModule(miniAppId: string) {
    if (selectedModuleId === miniAppId) return;
    selectedModuleId = miniAppId;
    setModuleSection(moduleId, 'Module Detail', sectionLabels);
    void loadTelemetry();
  }

  function scheduleReload() {
    if (reloadTimer) {
      window.clearTimeout(reloadTimer);
    }

    reloadTimer = window.setTimeout(() => {
      reloadTimer = null;
      void loadTelemetry();
    }, 400);
  }

  function exportJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function exportCurrentView() {
    if (selectedSection === 'Brain Overview' && overview) {
      exportJson(`telemetry-brain-overview-${currentRange}.json`, overview);
      return;
    }
    if (selectedSection === 'Module Detail' && detail) {
      exportJson(`telemetry-module-detail-${detail.selectedModuleId}-${currentRange}.json`, detail);
      return;
    }
    if (selectedSection === 'Insights' && insights) {
      exportJson(`telemetry-insights-${currentRange}.json`, insights);
    }
  }

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);

    let unsubscribe = () => {};
    void (async () => {
      await loadTelemetry();
      unsubscribe = await subscribeBrainEvents((event) => {
        if (event.kind === 'anomaly_detected') {
          lastEventNote = `${event.module} · ${event.message}`;
        } else if (event.kind === 'predictive_warning') {
          lastEventNote = `${event.module} · ${event.metric} projects to ${event.projectedValueIn5min.toFixed(1)} in 5 min`;
        } else if (event.kind === 'healing_applied') {
          lastEventNote = `${event.module} · ${event.result.message}`;
        }
        scheduleReload();
      });
    })();

    return () => {
      unsubscribe();
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
    };
  });
</script>

<main class="telemetry-shell module-root">
  <section class="telemetry-toolbar">
    <div class="telemetry-context">
      <Badge variant="outline" class={`brain-state brain-state--${overview?.overallState ?? 'healthy'}`}>
        {(overview?.overallState ?? 'healthy').toUpperCase()}
      </Badge>
      <span>{lastEventNote || 'System intelligence is monitoring all mini apps.'}</span>
      {#if overview}
        <small>{overview.generatedAt}</small>
      {/if}
    </div>

    <div class="telemetry-toolbar-right">
      <div class="telemetry-range-switch">
        {#each rangeOptions as range}
          <button
            type="button"
            class:selected={currentRange === range}
            onclick={() => setRange(range)}
            aria-pressed={currentRange === range}
          >
            {range}
          </button>
        {/each}
      </div>

      <div class="telemetry-actions">
        <Button type="button" variant="outline" class="telemetry-button" onclick={() => void loadTelemetry()}>
          <RefreshCcw size={18} />
          <span>Refresh</span>
        </Button>
        <Button type="button" variant="outline" class="telemetry-button" onclick={exportCurrentView}>
          <Download size={18} />
          <span>Export current view</span>
        </Button>
      </div>
    </div>
  </section>

  {#if errorMessage}
    <section class="telemetry-error">
      <CircleAlert size={18} />
      <span>{errorMessage}</span>
    </section>
  {:else if collectorWarmingUp || (loading && !overview)}
    <section class="telemetry-loading">
      <span>Telemetry brain is live and waiting for the first useful samples…</span>
    </section>
  {:else if overview && detail && insights}
    {#if selectedSection === 'Brain Overview'}
      <section class="telemetry-section">
        <div class="brain-grid">
          {#each overview.cards as card}
            <article class="brain-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
              <div class="sparkline-row">
                {#each card.sparkline as point}
                  <i style={`height:${Math.max(18, point)}px`}></i>
                {/each}
              </div>
            </article>
          {/each}
        </div>

        <section class="flat-panel">
          <header class="section-head">
            <div>
              <h2>Mini app health map</h2>
              <p>Scan all 20 mini apps once, then jump into the one that needs inspection.</p>
            </div>
          </header>

          <div class="mini-app-grid">
            {#each overview.miniApps as miniApp}
              <button
                type="button"
                class:selected={selectedModuleCard?.miniAppId === miniApp.miniAppId}
                class={`mini-app-tile mini-app-tile--${miniApp.state.toLowerCase()}`}
                onclick={() => selectModule(miniApp.miniAppId)}
              >
                <div class="mini-app-tile-top">
                  <span class="mini-app-name">{miniApp.label}</span>
                  <Badge variant="outline" class={`mini-app-state mini-app-state--${miniApp.state.toLowerCase()}`}>
                    {miniApp.state}
                  </Badge>
                </div>
                <strong>{miniApp.heapMb?.toFixed(1) ?? '—'} MB</strong>
                <p>{miniApp.lastAction}</p>
                <div class="mini-app-meta">
                  <span>{miniApp.lastSeenAt}</span>
                  <span>{miniApp.anomalyCount} anomalies</span>
                </div>
              </button>
            {/each}
          </div>
        </section>

        <section class="flat-panel">
          <header class="section-head">
            <div>
              <h2>Recent activity</h2>
              <p>Only changes that mattered enough for the brain to emit an event.</p>
            </div>
          </header>

          <div class="activity-feed">
            {#each overview.recentActivity as item}
              <article class={`activity-item activity-item--${item.tone}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span>{item.at}</span>
              </article>
            {/each}
          </div>
        </section>
      </section>
    {:else if selectedSection === 'Module Detail'}
      <section class="telemetry-section telemetry-split">
        <aside class="telemetry-rail">
          <header class="rail-head">
            <div>
              <h2>Mini apps</h2>
              <p>Pick one mini app and inspect its learned baseline, live trend, and anomaly history.</p>
            </div>
          </header>

          <div class="rail-list">
            {#each detail.availableModules as item}
              <button
                type="button"
                class:selected={selectedModulePicker?.miniAppId === item.miniAppId}
                onclick={() => selectModule(item.miniAppId)}
              >
                <span>{item.label}</span>
                <small>{item.state}</small>
              </button>
            {/each}
          </div>
        </aside>

        <div class="telemetry-main-panel">
          <TelemetryChartPanel
            featured={true}
            title={`${detail.selectedLabel} memory`}
            value={`${detail.memoryPoints.at(-1)?.value?.toFixed(1) ?? '0.0'} MB`}
            trend={`${detail.projectionStatus} · ${detail.activeSince}`}
            note="The brain learns this module’s baseline over time, tracks rate of change, and projects the next five minutes."
            periodLabel={detail.generatedAt}
            labels={detailMemoryLabels}
            current={detailMemoryValues}
            previous={detailMemoryBaseline}
            unit="MB"
            live={detail.selectedState === 'ACTIVE'}
          />

          <section class="flat-panel">
            <header class="section-head">
              <div>
                <h2>Runtime state</h2>
                <p>The operator view of this mini app right now.</p>
              </div>
              <Badge variant="outline" class={`mini-app-state mini-app-state--${detail.selectedState.toLowerCase()}`}>
                {detail.selectedState}
              </Badge>
            </header>

            <div class="detail-metrics">
              <article><span>Baseline heap</span><strong>{detail.baselineHeapMb.toFixed(1)} MB</strong></article>
              <article><span>Peak heap</span><strong>{detail.peakHeapMb.toFixed(1)} MB</strong></article>
              <article><span>Growth rate</span><strong>{detail.rateMbPerMin.toFixed(1)} MB/min</strong></article>
              <article><span>Projected 5 min</span><strong>{detail.projectedHeap5m.toFixed(1)} MB</strong></article>
              <article><span>IPC avg / p95</span><strong>{detail.ipcAvgMs.toFixed(1)} / {detail.ipcP95Ms.toFixed(1)} ms</strong></article>
              <article><span>DB avg / p95</span><strong>{detail.dbAvgMs.toFixed(1)} / {detail.dbP95Ms.toFixed(1)} ms</strong></article>
            </div>
          </section>

          <section class="flat-panel">
            <header class="section-head">
              <div>
                <h2>Insights about this mini app</h2>
                <p>Correlations only appear after enough observations. Until then, the panel stays sparse by design.</p>
              </div>
            </header>

            <div class="insight-list">
              {#if detail.insights.length}
                {#each detail.insights as insight}
                  <article class="insight-item">
                    <div class="insight-head">
                      <strong>{insight.title}</strong>
                      <Badge variant="outline">{Math.round(insight.confidence * 100)}%</Badge>
                    </div>
                    <p>{insight.description}</p>
                    <small>{insight.observations} observations</small>
                  </article>
                {/each}
              {:else}
                <p class="empty-copy">The correlation engine has not reached enough observations for this mini app yet.</p>
              {/if}
            </div>
          </section>

          <section class="flat-panel">
            <header class="section-head">
              <div>
                <h2>Anomaly history</h2>
                <p>All state transitions that crossed into a warn or critical condition.</p>
              </div>
            </header>
            <TelemetryDataTable
              columns={[
                { key: 'at', label: 'At' },
                { key: 'severity', label: 'Severity' },
                { key: 'kind', label: 'Kind' },
                { key: 'message', label: 'Message' },
                { key: 'resolution', label: 'Resolution' },
              ]}
              rows={detailAnomalyRows}
              emptyLabel="No anomalies recorded for this mini app in the selected range."
            />
          </section>
        </div>
      </section>
    {:else}
      <section class="telemetry-section">
        <section class="flat-panel">
          <header class="section-head">
            <div>
              <h2>Discovered insights</h2>
              <p>The brain becomes useful immediately for alerts and gets smarter over time for correlations and recommendations.</p>
            </div>
            <Badge variant="outline">{insights.newThisWeek} new this week</Badge>
          </header>

          <div class="insight-list">
            {#if insights.insights.length}
              {#each insights.insights as insight}
                <article class="insight-item">
                  <div class="insight-head">
                    <strong>{insight.title}</strong>
                    <Badge variant="outline">{Math.round(insight.confidence * 100)}%</Badge>
                  </div>
                  <p>{insight.description}</p>
                  <small>{insight.observations} observations</small>
                </article>
              {/each}
            {:else}
              <p class="empty-copy">There are no statistically significant insights yet. Keep using Genesis and the brain will learn.</p>
            {/if}
          </div>
        </section>

        <section class="flat-panel">
          <header class="section-head">
            <div>
              <h2>Predictions</h2>
              <p>Warnings generated before a threshold is crossed, then audited five minutes later.</p>
            </div>
          </header>
          <TelemetryDataTable
            columns={[
              { key: 'miniApp', label: 'Mini app' },
              { key: 'metric', label: 'Metric' },
              { key: 'current', label: 'Current', align: 'end' },
              { key: 'projected', label: 'Projected 5m', align: 'end' },
              { key: 'threshold', label: 'Threshold', align: 'end' },
              { key: 'verdict', label: 'Verdict', align: 'end' },
            ]}
            rows={predictionRows}
            emptyLabel="No predictive warnings have been stored for this range."
          />
        </section>

        <section class="flat-panel">
          <header class="section-head">
            <div>
              <h2>Healing feed</h2>
              <p>Deterministic rule-based actions taken by the brain when it decided intervention was safer than waiting.</p>
            </div>
          </header>
          <TelemetryDataTable
            columns={[
              { key: 'at', label: 'At' },
              { key: 'miniApp', label: 'Mini app' },
              { key: 'action', label: 'Action' },
              { key: 'status', label: 'Status' },
              { key: 'detail', label: 'Detail' },
              { key: 'resolved', label: 'Resolved', align: 'end' },
            ]}
            rows={healingRows}
            emptyLabel="No healing actions were recorded for this range."
          />
        </section>
      </section>
    {/if}
  {/if}
</main>

<style>
  :global(:root) {
    --telemetry-accent: #2563eb;
    --telemetry-accent-soft: rgba(37, 99, 235, 0.12);
  }

  .telemetry-shell {
    height: 100%;
    min-height: 0;
    width: 100%;
    max-width: min(100%, 112rem);
    margin: 0 auto;
    box-sizing: border-box;
    padding: 1.5rem clamp(1.25rem, 1.8vw, 2rem) 2.25rem;
    display: grid;
    align-content: start;
    gap: 1.2rem;
    color: var(--foreground);
    background: var(--background);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: var(--shell-scrollbar-thumb) var(--shell-scrollbar-track);
    cursor: default;
  }

  .telemetry-shell,
  .telemetry-shell * {
    box-sizing: border-box;
  }

  .telemetry-shell :global(button) {
    cursor: default;
  }

  .telemetry-shell::-webkit-scrollbar {
    width: var(--shell-scrollbar-size);
    height: var(--shell-scrollbar-size);
  }

  .telemetry-shell::-webkit-scrollbar-track {
    background: var(--shell-scrollbar-track);
  }

  .telemetry-shell::-webkit-scrollbar-thumb {
    border: 0.08rem solid transparent;
    border-radius: 999px;
    background: var(--shell-scrollbar-thumb);
    background-clip: content-box;
  }

  .telemetry-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: start;
    min-width: 0;
  }

  .telemetry-context {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    flex-wrap: wrap;
    color: var(--muted);
  }

  .telemetry-context span {
    color: var(--foreground);
  }

  .telemetry-context small {
    color: var(--muted);
  }

  .brain-state,
  .mini-app-state {
    min-height: 1.7rem;
    padding-inline: 0.6rem;
    border-radius: 999px;
    text-transform: uppercase;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .brain-state--healthy,
  .mini-app-state--idle,
  .mini-app-state--active {
    color: #34d399;
    border-color: color-mix(in srgb, #10b981 45%, var(--border));
    background: color-mix(in srgb, #10b981 10%, transparent);
  }

  .brain-state--watch,
  .mini-app-state--degraded,
  .mini-app-state--recovering {
    color: #fbbf24;
    border-color: color-mix(in srgb, #f59e0b 45%, var(--border));
    background: color-mix(in srgb, #f59e0b 10%, transparent);
  }

  .brain-state--critical,
  .mini-app-state--critical,
  .mini-app-state--frozen {
    color: #f87171;
    border-color: color-mix(in srgb, #ef4444 45%, var(--border));
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .telemetry-toolbar-right {
    display: grid;
    justify-items: end;
    gap: 0.75rem;
  }

  .telemetry-range-switch,
  .telemetry-actions {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .telemetry-range-switch button {
    min-width: 4rem;
    min-height: 2.8rem;
    padding: 0 0.9rem;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    background: color-mix(in srgb, var(--surface) 96%, var(--background));
    color: var(--muted);
    font-weight: 650;
  }

  .telemetry-range-switch button.selected {
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--telemetry-accent) 55%, var(--border));
    background: color-mix(in srgb, var(--telemetry-accent-soft) 68%, var(--surface));
  }

  .telemetry-button {
    min-height: 2.8rem;
    border-radius: 999px;
    display: inline-flex;
    gap: 0.6rem;
    align-items: center;
  }

  .telemetry-error,
  .telemetry-loading,
  .flat-panel,
  .telemetry-rail {
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--surface) 96%, var(--background));
    min-width: 0;
  }

  .flat-panel,
  .telemetry-rail {
    overflow: hidden;
  }

  .telemetry-error,
  .telemetry-loading {
    min-height: 4rem;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0 1rem;
    color: var(--muted);
  }

  .telemetry-section {
    display: grid;
    gap: 1rem;
    min-width: 0;
    max-width: 100%;
  }

  .brain-grid,
  .detail-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    min-width: 0;
  }

  .brain-card,
  .detail-metrics article {
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--surface) 98%, var(--background));
    padding: 1rem;
    display: grid;
    gap: 0.45rem;
  }

  .brain-card span,
  .detail-metrics span {
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .brain-card strong,
  .detail-metrics strong {
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: -0.04em;
  }

  .brain-card p {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }

  .sparkline-row {
    display: flex;
    align-items: end;
    gap: 0.2rem;
    min-height: 3.25rem;
  }

  .sparkline-row i {
    display: block;
    flex: 1;
    min-width: 0.25rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--telemetry-accent) 65%, var(--surface));
  }

  .section-head,
  .rail-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1rem 1.1rem 0.95rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
    min-width: 0;
  }

  .section-head h2,
  .rail-head h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .section-head p,
  .rail-head p {
    margin: 0.35rem 0 0;
    color: var(--muted);
    line-height: 1.5;
  }

  .mini-app-grid {
    padding: 1rem;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.85rem;
    min-width: 0;
  }

  .mini-app-tile {
    display: grid;
    gap: 0.45rem;
    padding: 0.95rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--surface) 98%, var(--background));
    text-align: left;
    color: inherit;
    min-width: 0;
  }

  .mini-app-tile.selected,
  .mini-app-tile:hover,
  .rail-list button.selected,
  .rail-list button:hover,
  .activity-item:hover,
  .insight-item:hover {
    background: color-mix(in srgb, var(--surface) 88%, var(--telemetry-accent-soft));
  }

  .mini-app-tile-top,
  .insight-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .mini-app-name {
    font-size: 0.96rem;
    font-weight: 650;
    letter-spacing: -0.03em;
  }

  .mini-app-tile strong {
    font-size: 1.35rem;
    font-weight: 500;
    letter-spacing: -0.04em;
  }

  .mini-app-tile p,
  .activity-item p,
  .insight-item p {
    margin: 0;
    color: var(--muted);
    line-height: 1.5;
  }

  .mini-app-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .activity-feed,
  .insight-list {
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
    min-width: 0;
    max-width: 100%;
  }

  .activity-item,
  .insight-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    border-radius: 0.8rem;
    padding: 0.95rem 1rem;
    background: color-mix(in srgb, var(--surface) 98%, var(--background));
    min-width: 0;
  }

  .activity-item > div,
  .insight-item > div {
    min-width: 0;
  }

  .activity-item strong,
  .insight-item strong,
  .activity-item p,
  .insight-item p {
    overflow-wrap: anywhere;
  }

  .activity-item span,
  .insight-item small {
    color: var(--muted);
    justify-self: end;
    text-align: right;
  }

  .telemetry-split {
    display: grid;
    grid-template-columns: minmax(16rem, 18rem) minmax(0, 1fr);
    gap: 1rem;
    min-width: 0;
  }

  .telemetry-rail {
    display: grid;
    align-content: start;
    overflow: hidden;
  }

  .rail-list {
    display: flex;
    flex-direction: column;
  }

  .rail-list button {
    display: grid;
    gap: 0.2rem;
    padding: 0.95rem 1rem;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
    background: transparent;
    text-align: left;
    color: inherit;
  }

  .rail-list span {
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .rail-list small,
  .empty-copy {
    color: var(--muted);
  }

  .telemetry-main-panel {
    display: grid;
    gap: 1rem;
    min-width: 0;
    max-width: 100%;
  }

  @media (max-width: 1220px) {
    .telemetry-toolbar,
    .telemetry-split,
    .brain-grid,
    .detail-metrics,
    .mini-app-grid {
      grid-template-columns: 1fr;
    }

    .telemetry-toolbar-right {
      justify-items: start;
    }
  }

  @media (max-width: 860px) {
    .telemetry-shell {
      padding-inline: 1rem;
    }
  }
</style>
