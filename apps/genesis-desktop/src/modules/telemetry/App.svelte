<script lang="ts">
  import { Activity, ServerCog, Database, AlertTriangle, CheckCircle2, Download, BarChart3 } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { invoke, Channel, isTauri } from "@tauri-apps/api/core";

  let _t = $derived.by(() => createTranslator($activeBundle));

  let t = (key: string, fallback?: string) => _t(key, fallback);
  import {
    getModuleSectionLabel,
    ensureModuleSection,
    moduleSectionStore,
  } from '$lib/stores/module-sections.store';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';

  let { moduleId = 'telemetry', settings = {} }: { moduleId?: string; settings?: any } = $props();

  // ── Types matching Rust backend (camelCase as serialized) ──────────────

  interface BrainOverviewPayload {
    generatedAt: string;
    overallState: string;
    lastEvent: string;
    cards: OverviewCard[];
    miniApps: MiniAppTile[];
    recentActivity: ActivityFeedItem[];
  }

  interface OverviewCard {
    key: string;
    label: string;
    value: string;
    status: string;
    sparkline: number[];
    note: string;
  }

  interface MiniAppTile {
    miniAppId: string;
    label: string;
    state: string;
    heapMb: number | null;
    jsHeapMb: number | null;
    anomalyCount: number;
    lastAction: string;
    lastSeenAt: string;
    sparkline: number[];
  }

  interface ActivityFeedItem {
    at: string;
    title: string;
    detail: string;
    tone: string;
  }

  interface ModuleDetailPayload {
    generatedAt: string;
    selectedModuleId: string;
    selectedLabel: string;
    selectedState: string;
    activeSince: string;
    memoryPoints: GraphPoint[];
    baselineHeapMb: number;
    peakHeapMb: number;
    rateMbPerMin: number;
    projectedHeap5m: number;
    projectionStatus: string;
    ipcAvgMs: number;
    ipcP95Ms: number;
    dbAvgMs: number;
    dbP95Ms: number;
    stateHistory: StateHistoryEntry[];
    insights: InsightCard[];
    anomalyHistory: AnomalyHistoryEntry[];
    availableModules: MiniAppPickerItem[];
  }

  interface GraphPoint {
    label: string;
    value: number;
  }

  interface StateHistoryEntry {
    at: string;
    state: string;
  }

  interface InsightCard {
    title: string;
    confidence: number;
    observations: number;
    description: string;
  }

  interface AnomalyHistoryEntry {
    at: string;
    severity: string;
    kind: string;
    message: string;
    healAction: string | null;
    resolvedInMs: number | null;
  }

  interface MiniAppPickerItem {
    miniAppId: string;
    label: string;
    state: string;
  }

  interface InsightsPayload {
    generatedAt: string;
    newThisWeek: number;
    insights: InsightCard[];
    predictions: PredictionInsightCard[];
    healings: HealingFeedItem[];
  }

  interface PredictionInsightCard {
    miniAppId: string;
    metric: string;
    currentValue: number;
    projectedValueIn5min: number;
    timeToThresholdSecs: number;
    wasCorrect: boolean | null;
  }

  interface HealingFeedItem {
    at: string;
    miniAppId: string;
    action: string;
    result: { status: string; message: string };
    resolvedInMs: number;
  }

  // Brain events for real-time streaming
  type BrainEvent =
    | { type: "MetricsDelta"; module: string; heapMb: number | null; state: string | null; ipcMs: number | null }
    | { type: "AnomalyDetected"; module: string; anomalyType: string; severity: string; message: string; projectedIfIgnored: string }
    | { type: "HealingApplied"; module: string; actionTaken: string; result: { status: string; message: string }; msToResolve: number }
    | { type: "InsightDiscovered"; correlation: string; confidence: number; observedNTimes: number }
    | { type: "PredictiveWarning"; module: string; metric: string; currentValue: number; projectedValueIn5min: number; timeToThresholdSecs: number };

  // ── Fallback mock data (non-Tauri) ─────────────────────────────────────

  const fallbackMetrics = [
    { title: "Memory Usage", value: "248.5", unit: "MB", change: "+12.3%", icon: Database },
    { title: "API Latency", value: "2.4", unit: "ms", change: "-4.2%", icon: Activity },
    { title: "DB Queries", value: "142", unit: "/min", change: "+8.1%", icon: ServerCog },
    { title: "Active Users", value: "1", unit: "", change: "stable", icon: Activity },
  ];

  const fallbackMemoryData = [
    { hour: '10:00', value: 186 },
    { hour: '11:00', value: 205 },
    { hour: '12:00', value: 198 },
    { hour: '13:00', value: 242 },
    { hour: '14:00', value: 256 },
    { hour: '15:00', value: 248 },
    { hour: '16:00', value: 251 },
  ];

  const fallbackProcesses = [
    { name: 'Tauri Runtime', memory: 142.3 },
    { name: 'WebView', memory: 85.6 },
    { name: 'Database', memory: 18.2 },
    { name: 'Renderer', memory: 12.4 },
  ];

  const fallbackLatencies = [
    { cmd: 'write_note', avg: 1.2, p95: 2.8, calls: 342 },
    { cmd: 'fetch_tasks', avg: 3.4, p95: 8.2, calls: 156 },
    { cmd: 'sync_calendar', avg: 5.1, p95: 14.3, calls: 48 },
    { cmd: 'get_health', avg: 0.3, p95: 0.6, calls: 4821 },
  ];

  const fallbackTables = [
    { name: 'profiles', rows: '1.2K', size: '3.2 MB' },
    { name: 'payment_history', rows: '18.4K', size: '24.5 MB' },
    { name: 'processed_webhooks', rows: '3.3K', size: '5.1 MB' },
    { name: 'gamification_events', rows: '45.1K', size: '12.3 MB' },
  ];

  const fallbackAlerts: { time: string; severity: string; msg: string; resolved: boolean }[] = [
    { time: '14:22', severity: 'warning', msg: 'Memory spike detected', resolved: true },
    { time: '14:15', severity: 'critical', msg: 'IPC timeout on fetch', resolved: true },
    { time: '13:50', severity: 'info', msg: 'Query optimization applied', resolved: true },
  ];

  // ── State ──────────────────────────────────────────────────────────────

  const canUseTauri = isTauri();

  let loading = $state(true);
  let error = $state<string | null>(null);

  // Backend data
  let overview = $state<BrainOverviewPayload | null>(null);
  let moduleDetail = $state<ModuleDetailPayload | null>(null);
  let insights = $state<InsightsPayload | null>(null);

  // Live events feed
  let liveEvents = $state<BrainEvent[]>([]);

  // Derived values for sections (live data → fallback when null)
  let metrics = $derived.by<{ title: string; value: string; unit: string; change: string; icon: any }[]>(() => {
    if (overview?.cards) {
      const cards = overview.cards;
      const m: any[] = [];
      const cardMap: Record<string, { title: string; unit: string }> = {
        memory: { title: "Memory Usage", unit: "" },
        ipc: { title: "API Latency", unit: "ms" },
        db: { title: "DB Health", unit: "" },
        network: { title: "Network", unit: "" },
      };
      for (const card of cards) {
        const def = cardMap[card.key] ?? { title: card.label, unit: "" };
        m.push({
          title: def.title,
          value: card.value.replace(/ MB$/, "").replace(/ ms$/, ""),
          unit: def.unit || (card.value.includes("MB") ? "MB" : card.value.includes("ms") ? "ms" : ""),
          change: card.status === "good" || card.status === "fast" ? "✓ healthy" : card.status === "watch" ? "⚠ watch" : card.status === "live" ? "live" : "idle",
          icon: card.key === "memory" ? Database : card.key === "ipc" ? Activity : card.key === "db" ? ServerCog : Activity,
        });
      }
      return m.slice(0, 4);
    }
    return fallbackMetrics;
  });

  let memoryData = $derived.by<{ hour: string; value: number }[]>(() => {
    if (moduleDetail?.memoryPoints && moduleDetail.memoryPoints.length > 0) {
      return moduleDetail.memoryPoints.map((p) => ({
        hour: p.label.length > 5 ? p.label.slice(-5) : p.label,
        value: p.value,
      }));
    }
    return fallbackMemoryData;
  });

  let processes = $derived.by<{ name: string; memory: number }[]>(() => {
    if (overview?.miniApps && overview.miniApps.length > 0) {
      return overview.miniApps
        .filter((a) => a.heapMb != null)
        .sort((a, b) => (b.heapMb ?? 0) - (a.heapMb ?? 0))
        .slice(0, 6)
        .map((a) => ({ name: a.label, memory: a.heapMb ?? 0 }));
    }
    return fallbackProcesses;
  });

  let latencies = $derived.by<{ cmd: string; avg: number; p95: number; calls: number }[]>(() => {
    if (moduleDetail) {
      const items: { cmd: string; avg: number; p95: number; calls: number }[] = [];
      items.push({ cmd: 'IPC (avg)', avg: moduleDetail.ipcAvgMs, p95: moduleDetail.ipcP95Ms, calls: 0 });
      items.push({ cmd: 'DB (avg)', avg: moduleDetail.dbAvgMs, p95: moduleDetail.dbP95Ms, calls: 0 });
      if (moduleDetail.availableModules.length > 0) {
        for (const mod of moduleDetail.availableModules.slice(0, 4)) {
          items.push({ cmd: mod.miniAppId, avg: 0, p95: 0, calls: 0 });
        }
      }
      return items;
    }
    return fallbackLatencies;
  });

  let tables = $derived.by<{ name: string; rows: string; size: string }[]>(() => {
    // Backend doesn't expose table-level info yet; keep fallback
    return fallbackTables;
  });

  let alerts = $derived.by<{ time: string; severity: string; msg: string; resolved: boolean }[]>(() => {
    const result: { time: string; severity: string; msg: string; resolved: boolean }[] = [];

    // Live events first (most recent)
    for (const event of liveEvents) {
      if (event.type === "AnomalyDetected") {
        result.push({
          time: new Date().toLocaleTimeString(),
          severity: event.severity,
          msg: event.message,
          resolved: false,
        });
      } else if (event.type === "HealingApplied") {
        result.push({
          time: new Date().toLocaleTimeString(),
          severity: "info",
          msg: `${event.actionTaken} on ${event.module}`,
          resolved: true,
        });
      }
    }

    // Anomaly history from backend
    if (moduleDetail?.anomalyHistory) {
      for (const a of moduleDetail.anomalyHistory) {
        result.push({
          time: a.at,
          severity: a.severity.toLowerCase(),
          msg: a.message,
          resolved: a.resolvedInMs != null,
        });
      }
    }

    // Predictions as alerts
    if (insights?.predictions) {
      for (const p of insights.predictions) {
        result.push({
          time: new Date().toLocaleTimeString(),
          severity: "warning",
          msg: `${p.miniAppId} ${p.metric}: ${p.currentValue.toFixed(1)} → ${p.projectedValueIn5min.toFixed(1)} in 5m`,
          resolved: false,
        });
      }
    }

    if (result.length > 0) return result;
    return fallbackAlerts as { time: string; severity: string; msg: string; resolved: boolean }[];
  });

  let maxMem = $derived(Math.max(...memoryData.map((d) => d.value)));
  let maxProc = $derived(Math.max(...processes.map((p) => p.memory)));

  // System status derived from overall state
  let systemStatus = $derived.by<{ label: string; ok: boolean; detail: string }[]>(() => {
    if (overview) {
      const isHealthy = overview.overallState === "healthy";
      return [
        { label: "Runtime", ok: isHealthy, detail: `Uptime: monitoring active` },
        { label: "Database", ok: !overview.cards.find((c) => c.key === "db")?.value.includes("Degraded"), detail: `Status: ${overview.cards.find((c) => c.key === "db")?.value ?? "Healthy"}` },
        { label: "Memory", ok: !overview.cards.find((c) => c.key === "memory")?.status.includes("watch"), detail: `${overview.cards.find((c) => c.key === "memory")?.value ?? "N/A"}` },
      ];
    }
    return [
      { label: "Runtime", ok: true, detail: "Uptime: 14h 22m" },
      { label: "Database", ok: true, detail: "4 connections active" },
      { label: "Memory", ok: true, detail: "248.5 MB / 512 MB" },
    ];
  });

  // ── Section tabs ───────────────────────────────────────────────────────

  const sectionLabels = ["Overview", "Memory", "Performance", "Database", "Alerts", "Reports"] as const;
  let selectedSection = $derived.by(() => getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    initTelemetry();
  });

  onDestroy(() => {
    cleanupTelemetry();
  });

  // ── Telemetry data loading ─────────────────────────────────────────────

  let unlistenEvents: (() => void) | null = null;

  async function initTelemetry() {
    if (!canUseTauri) {
      loading = false;
      return;
    }
    await loadAllData();
    subscribeToEvents();
  }

  function cleanupTelemetry() {
    unlistenEvents?.();
    unlistenEvents = null;
  }

  async function loadAllData() {
    try {
      const [ov, det, ins] = await Promise.all([
        invoke<BrainOverviewPayload>("get_telemetry_brain_overview", { range: "24h" }),
        invoke<ModuleDetailPayload>("get_telemetry_module_detail", { range: "24h", miniAppId: null }),
        invoke<InsightsPayload>("get_telemetry_insights", { range: "24h" }),
      ]);
      overview = ov;
      moduleDetail = det;
      insights = ins;
      error = null;
    } catch (err) {
      error = typeof err === "string" ? err : _t("moduleTelemetryErrorLoad", "Failed to load telemetry data");
    } finally {
      loading = false;
    }
  }

  async function subscribeToEvents() {
    try {
      const channel = new Channel<BrainEvent>();
      channel.onmessage = (event: BrainEvent) => {
        liveEvents = [event, ...liveEvents].slice(0, 50);
      };
      await invoke("subscribe_brain_events", { onEvent: channel });
    } catch {
      // Event subscription is non-critical; silent fail
    }
  }

  async function handleRetry() {
    loading = true;
    error = null;
    await loadAllData();
  }
</script>

<main class="telemetry-workspace module-root" data-module="telemetry">
  <div class="telemetry-header">
    <h1>{_t("moduleTelemetryTitle", "System Monitor")}</h1>
    <p class="telemetry-subtitle">{_t("moduleTelemetryDesc", "Real-time system performance and health")}</p>
  </div>

  {#if loading}
    <div class="telemetry-loading">
      <div class="telemetry-spinner"></div>
      <span>{_t("moduleTelemetryLoading", "Loading telemetry data...")}</span>
    </div>
  {:else if error && !overview}
    <div class="telemetry-error">
      <p>{error}</p>
      <Button variant="outline" onclick={handleRetry}>{_t("commonRetry", "Retry")}</Button>
    </div>
  {:else}

    <!-- OVERVIEW SECTION -->
    {#if selectedSection === 'Overview'}
      <div class="telemetry-content">
        <div class="metrics-grid">
          {#each metrics as m}
            <Card>
              <CardContent class="metric-item">
                <div class="metric-top">
                  <span class="metric-label">{m.title}</span>
                  <Badge variant="secondary">{m.change}</Badge>
                </div>
                <div class="metric-value">{m.value} <span class="metric-unit">{m.unit}</span></div>
              </CardContent>
            </Card>
          {/each}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetrySystemStatus", "System Status")}</CardTitle>
            <CardDescription>{_t("moduleTelemetrySystemStatusDesc", "Current health across all subsystems")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              {#each systemStatus as s}
                <div style="display: flex; align-items: center; gap: 12px;">
                  {#if s.ok}
                    <CheckCircle2 size={20} style="color: #10b981" />
                  {:else}
                    <AlertTriangle size={20} style="color: #f59e0b" />
                  {/if}
                  <div>
                    <div style="font-weight: 600; font-size: 14px;">{s.label}</div>
                    <div style="font-size: 12px; color: var(--muted);">{s.detail}</div>
                  </div>
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      </div>

    <!-- MEMORY SECTION -->
    {:else if selectedSection === 'Memory'}
      <div class="telemetry-content">
        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetryMemoryTimeline", "Memory Usage Timeline")}</CardTitle>
            <CardDescription>{_t("moduleTelemetryMemoryTimelineDesc", "Heap allocation over the last monitoring period")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="chart-bars">
              {#each memoryData as d}
                <div class="bar-item">
                  <div class="bar" style={`height: ${(d.value / maxMem) * 150}px`}></div>
                  <div class="bar-label">{d.hour}</div>
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetryModuleMemory", "Module Memory")}</CardTitle>
            <CardDescription>{_t("moduleTelemetryModuleMemoryDesc", "Top memory-consuming mini-apps")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              {#each processes as p}
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 14px; margin-bottom: 6px;">{p.name}</div>
                    <div class="progress-bar">
                      <div class="progress-fill" style={`width: ${(p.memory / maxProc) * 100}%`}></div>
                    </div>
                  </div>
                  <div style="min-width: 70px; text-align: right; font-weight: 600; font-size: 14px;">{p.memory.toFixed(1)}MB</div>
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      </div>

    <!-- PERFORMANCE SECTION -->
    {:else if selectedSection === 'Performance'}
      <div class="telemetry-content">
        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetryPerfMetrics", "Performance Metrics")}</CardTitle>
            <CardDescription>{_t("moduleTelemetryPerfMetricsDesc", "IPC and database execution times")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Metric</Table.Head>
                  <Table.Head>Avg (ms)</Table.Head>
                  <Table.Head>P95 (ms)</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each latencies as l}
                  <Table.Row>
                    <Table.Cell><code style="font-size: 12px;">{l.cmd}</code></Table.Cell>
                    <Table.Cell>{l.avg > 0 ? l.avg.toFixed(1) : '-'}</Table.Cell>
                    <Table.Cell>{l.p95 > 0 ? l.p95.toFixed(1) : '-'}</Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </CardContent>
        </Card>
      </div>

    <!-- DATABASE SECTION -->
    {:else if selectedSection === 'Database'}
      <div class="telemetry-content">
        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetryDbTables", "Database Tables")}</CardTitle>
            <CardDescription>{_t("moduleTelemetryDbTablesDesc", "Table sizes and row counts")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Table</Table.Head>
                  <Table.Head>Rows</Table.Head>
                  <Table.Head>Size</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each tables as t}
                  <Table.Row>
                    <Table.Cell><code style="font-size: 12px;">{t.name}</code></Table.Cell>
                    <Table.Cell>{t.rows}</Table.Cell>
                    <Table.Cell>{t.size}</Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </CardContent>
        </Card>
      </div>

    <!-- ALERTS SECTION -->
    {:else if selectedSection === 'Alerts'}
      <div class="telemetry-content">
        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetryRecentAlerts", "Recent Alerts")}</CardTitle>
            <CardDescription>{_t("moduleTelemetryRecentAlertsDesc", "System detected issues and resolutions")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              {#each alerts as a}
                <div style="display: flex; gap: 12px; padding: 12px; background: var(--muted-surface); border-radius: 8px; border-left: 3px solid {a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#3b82f6'};">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                      {a.severity === 'critical' ? '❌' : a.severity === 'warning' ? '⚠️' : 'ℹ️'} {a.msg}
                    </div>
                    <div style="font-size: 12px; color: var(--muted);">{a.time}</div>
                  </div>
                  {#if a.resolved}
                    <Badge style="background: #10b981; height: fit-content;">{_t("moduleTelemetryResolved", "Resolved")}</Badge>
                  {/if}
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      </div>

    <!-- REPORTS SECTION -->
    {:else if selectedSection === 'Reports'}
      <div class="telemetry-content">
        <Card>
          <CardHeader>
            <CardTitle>{_t("moduleTelemetryExportData", "Export Session Data")}</CardTitle>
            <CardDescription>{_t("moduleTelemetryExportDataDesc", "Download telemetry reports and logs")}</CardDescription>
          </CardHeader>
          <CardContent style="display: flex; gap: 12px; flex-wrap: wrap;">
            <Button variant="outline">
              <Download size={16} />
              {_t("moduleTelemetryExportJSON", "Export JSON")}
            </Button>
            <Button variant="outline">
              <BarChart3 size={16} />
              {_t("moduleTelemetryExportCSV", "Export CSV")}
            </Button>
            <Button variant="outline">
              <Download size={16} />
              {_t("moduleTelemetryExportPDF", "Export PDF")}
            </Button>
          </CardContent>
        </Card>
      </div>
    {/if}
  {/if}
</main>

<style>
  .telemetry-workspace {
    --mod-accent: #1565C0;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--mod-bg, var(--mod-bg-telemetry));
    color: var(--foreground);
    font-family: var(--font-body);
  }

  .telemetry-header {
    padding: 32px 24px;
    border-bottom: 1px solid var(--border);
    background: transparent;
  }

  .telemetry-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--foreground);
  }

  .telemetry-subtitle {
    font-size: 14px;
    color: var(--muted);
    margin: 0;
  }

  .telemetry-loading,
  .telemetry-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 64px 24px;
    color: var(--muted);
  }

  .telemetry-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--foreground);
    border-radius: 50%;
    animation: telemetry-spin 800ms linear infinite;
  }

  @keyframes telemetry-spin {
    to { transform: rotate(360deg); }
  }

  .telemetry-error p {
    color: var(--destructive);
    font-size: 14px;
  }

  .telemetry-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px 24px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .metric-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .metric-label {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .metric-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--primary);
    /* All metric values use JetBrains Mono — precision instrument feel */
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    letter-spacing: -0.02em;
    font-feature-settings: "tnum";
  }

  .metric-unit {
    font-size: 14px;
    color: var(--muted);
    font-weight: 500;
    margin-left: 4px;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
  }

  .chart-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    height: 180px;
    margin: 24px 0;
  }

  .bar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .bar {
    width: 100%;
    background: linear-gradient(180deg, var(--primary), var(--accent));
    border-radius: 4px 4px 0 0;
    min-height: 4px;
  }

  .bar-label {
    font-size: 11px;
    color: var(--muted);
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-feature-settings: "tnum";
  }

  .progress-bar {
    height: 6px;
    background: var(--muted-surface);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 3px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .data-table thead {
    background: var(--muted-surface);
    border-bottom: 1px solid var(--border);
  }

  .data-table th,
  .data-table td {
    padding: 12px;
    text-align: left;
  }

  .data-table th {
    font-weight: 600;
    color: var(--foreground);
  }

  .data-table td {
    color: var(--foreground);
    border-bottom: 1px solid var(--border);
    /* Table cell data is all mono — timestamps, values, file paths */
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-size: 13px;
    font-weight: 400;
    font-feature-settings: "tnum";
  }

  .data-table tr:hover {
    background: var(--muted-surface);
  }

  code {
    background: var(--muted-surface);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-size: 12px;
  }

  /* (Unused legacy selectors removed to eliminate ~35+ unused-CSS warnings) */
</style>
