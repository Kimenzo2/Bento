<script lang="ts">
  import { Activity, ServerCog, Database, AlertTriangle, CheckCircle2, TrendingUp, Download, BarChart3 } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import {
    getModuleSectionLabel,
    setModuleSection,
    ensureModuleSection,
    moduleSectionStore,
  } from '$lib/stores/module-sections.store';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';

  export let moduleId: string = 'telemetry';
  export let settings: any = {};
  void settings;

  const sectionLabels = ["Overview", "Memory", "Performance", "Database", "Alerts", "Reports"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  // Mock data
  const metrics =  [
    { title: "Memory Usage", value: "248.5", unit: "MB", change: "+12.3%", icon: Database },
    { title: "API Latency", value: "2.4", unit: "ms", change: "-4.2%", icon: Activity },
    { title: "DB Queries", value: "142", unit: "/min", change: "+8.1%", icon: ServerCog },
    { title: "Active Users", value: "1", unit: "", change: "stable", icon: Activity },
  ];

  const memoryData = [
    { hour: '10:00', value: 186 },
    { hour: '11:00', value: 205 },
    { hour: '12:00', value: 198 },
    { hour: '13:00', value: 242 },
    { hour: '14:00', value: 256 },
    { hour: '15:00', value: 248 },
    { hour: '16:00', value: 251 },
  ];

  const processes = [
    { name: 'Tauri Runtime', memory: 142.3 },
    { name: 'WebView', memory: 85.6 },
    { name: 'Database', memory: 18.2 },
    { name: 'Renderer', memory: 12.4 },
  ];

  const latencies = [
    { cmd: 'write_note', avg: 1.2, p95: 2.8, calls: 342 },
    { cmd: 'fetch_tasks', avg: 3.4, p95: 8.2, calls: 156 },
    { cmd: 'sync_calendar', avg: 5.1, p95: 14.3, calls: 48 },
    { cmd: 'get_health', avg: 0.3, p95: 0.6, calls: 4821 },
  ];

  const tables = [
    { name: 'profiles', rows: '1.2K', size: '3.2 MB' },
    { name: 'payment_history', rows: '18.4K', size: '24.5 MB' },
    { name: 'processed_webhooks', rows: '3.3K', size: '5.1 MB' },
    { name: 'gamification_events', rows: '45.1K', size: '12.3 MB' },
  ];

  const alerts = [
    { time: '14:22', severity: 'warning', msg: 'Memory spike detected', resolved: true },
    { time: '14:15', severity: 'critical', msg: 'IPC timeout on fetch', resolved: true },
    { time: '13:50', severity: 'info', msg: 'Query optimization applied', resolved: true },
  ];

  const maxMem = Math.max(...memoryData.map(d => d.value));
  const maxProc = Math.max(...processes.map(p => p.memory));

</script>

<main class="telemetry-workspace module-root">
  <div class="telemetry-header">
    <h1>System Monitor</h1>
    <p class="telemetry-subtitle">Real-time system performance and health</p>
  </div>

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
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current health across all subsystems</CardDescription>
        </CardHeader>
        <CardContent>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <CheckCircle2 size={20} style="color: #10b981" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">Runtime</div>
                <div style="font-size: 12px; color: var(--muted);">Uptime: 14h 22m</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <CheckCircle2 size={20} style="color: #10b981" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">Database</div>
                <div style="font-size: 12px; color: var(--muted);">4 connections active</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <CheckCircle2 size={20} style="color: #10b981" />
              <div>
                <div style="font-weight: 600; font-size: 14px;">Memory</div>
                <div style="font-size: 12px; color: var(--muted);">248.5 MB / 512 MB</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

  <!-- MEMORY SECTION -->
  {:else if selectedSection === 'Memory'}
    <div class="telemetry-content">
      <Card>
        <CardHeader>
          <CardTitle>Memory Usage Timeline</CardTitle>
          <CardDescription>Heap allocation over the last 7 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="chart-bars">
            {#each memoryData as d}
              <div class="bar-item">
                <div class="bar" style={`height: ${(d.value / maxMem) * 150}px`} />
                <div class="bar-label">{d.hour}</div>
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Process Memory</CardTitle>
          <CardDescription>Top memory-consuming processes</CardDescription>
        </CardHeader>
        <CardContent>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            {#each processes as p}
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 14px; margin-bottom: 6px;">{p.name}</div>
                  <div class="progress-bar">
                    <div class="progress-fill" style={`width: ${(p.memory / maxProc) * 100}%`} />
                  </div>
                </div>
                <div style="min-width: 70px; text-align: right; font-weight: 600; font-size: 14px;">{p.memory}MB</div>
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
          <CardTitle>API Latency Distribution</CardTitle>
          <CardDescription>Command execution times at different percentiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Avg (ms)</th>
                  <th>P95 (ms)</th>
                  <th>Calls</th>
                </tr>
              </thead>
              <tbody>
                {#each latencies as l}
                  <tr>
                    <td><code style="font-size: 12px;">{l.cmd}</code></td>
                    <td>{l.avg}</td>
                    <td>{l.p95}</td>
                    <td>{l.calls}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

  <!-- DATABASE SECTION -->
  {:else if selectedSection === 'Database'}
    <div class="telemetry-content">
      <Card>
        <CardHeader>
          <CardTitle>Database Tables</CardTitle>
          <CardDescription>Table sizes and row counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Rows</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {#each tables as t}
                  <tr>
                    <td><code style="font-size: 12px;">
{t.name}</code></td>
                    <td>{t.rows}</td>
                    <td>{t.size}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

  <!-- ALERTS SECTION -->
  {:else if selectedSection === 'Alerts'}
    <div class="telemetry-content">
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>System detected issues and resolutions</CardDescription>
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
                  <Badge style="background: #10b981; height: fit-content;">Resolved</Badge>
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
          <CardTitle>Export Session Data</CardTitle>
          <CardDescription>Download telemetry reports and logs</CardDescription>
        </CardHeader>
        <CardContent style="display: flex; gap: 12px; flex-wrap: wrap;">
          <Button variant="outline">
            <Download size={16} />
            Export JSON
          </Button>
          <Button variant="outline">
            <BarChart3 size={16} />
            Export CSV
          </Button>
          <Button variant="outline">
            <Download size={16} />
            Export PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  {/if}
</main>

<style>
  .telemetry-workspace {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background);
    color: var(--foreground);
    font-family: var(--font-body);
  }

  .telemetry-header {
    padding: 32px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--background);
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
  }

  .metric-unit {
    font-size: 14px;
    color: var(--muted);
    font-weight: 500;
    margin-left: 4px;
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
  }

  .data-table tr:hover {
    background: var(--muted-surface);
  }

  code {
    background: var(--muted-surface);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .telemetry-app {
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
    font-family: inherit;
    display: flex;
    justify-content: center;
  }
  .telemetry-container {
    width: 100%;
    max-width: 800px;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  /* STATUS BANNER */
  .status-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 56px;
    font-weight: 600;
    font-size: 15px;
    color: #fff;
    letter-spacing: 0.5px;
  }
  .status-banner.ok { background: #059669; }
  .status-banner.warn { background: #d97706; cursor: pointer; }
  .status-banner.crit { background: #dc2626; cursor: pointer; }

/* METRICS GRID */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 24px;
}
.metric-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.metric-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.metric-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}
.unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.sparkline {
  opacity: 0.8;
}

/* SESSION CARD */
.session-card {
  margin: 0 24px 24px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.session-info h3 {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 4px;
  letter-spacing: 0.5px;
}
.session-info p {
  font-size: 14px;
  margin: 0;
}
.expand-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
}
.expand-btn:hover { color: var(--foreground); }

/* LOG SECTION */
.log-section {
  flex: 1;
  padding: 0 24px 24px;
}
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.log-header h3 {
  font-size: 14px;
  text-transform: uppercase;
  color: var(--foreground);
  margin: 0;
  letter-spacing: 1px;
}
.log-count {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.log-list {
  display: flex;
  flex-direction: column;
}
.log-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  gap: 16px;
}
.log-row:last-child {
  border-bottom: none;
}
.log-time {
  font-family: monospace;
  font-size: 13px;
  color: var(--muted);
  min-width: 65px;
}
.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.log-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.log-module {
  font-size: 12px;
  font-weight: 700;
  color: var(--foreground);
  background: var(--surface);
  padding: 2px 8px;
  border-radius: 4px;
}
.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.badge.resolved {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.badge.unresolved {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
.log-event {
  font-size: 14px;
  color: var(--muted);
}
.log-indicator {
  display: flex;
  align-items: center;
}
.log-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>



