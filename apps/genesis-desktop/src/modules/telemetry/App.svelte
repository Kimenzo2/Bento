<script lang="ts">
  import { Activity, ServerCog, Database, BrainCircuit, Maximize2, AlertTriangle, CheckCircle2 } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};

  // Mock telemetry data
  let systemStatus = 'healthy'; // healthy, warning, critical
  
  let metrics = [
    { title: "Memory Base", value: "248.5", unit: "MB", status: "green", trend: "up", spark: [20, 22, 25, 23, 24, 25, 26], icon: Database },
    { title: "IPC Speed", value: "2.4", unit: "ms", status: "green", trend: "stable", spark: [2, 3, 2, 2, 2, 2, 2], icon: Activity },
    { title: "DB Connect", value: "18.2", unit: "ms", status: "amber", trend: "up", spark: [12, 14, 15, 12, 18, 18, 18], icon: ServerCog },
    { title: "AI Load", value: "0", unit: "jobs", status: "green", trend: "down", spark: [4, 1, 0, 0, 0, 0, 0], icon: BrainCircuit }
  ];

  let logs = [
    { time: "14:22:18", module: "Notes", event: "Memory cleanup triggered", severity: "info", resolved: true },
    { time: "14:15:02", module: "Core", event: "Renderer IPC timeout (2s)", severity: "amber", resolved: false },
    { time: "13:50:44", module: "Groceries", event: "Sync successful", severity: "info", resolved: true },
    { time: "11:20:10", module: "DB", event: "Vacuum routine complete", severity: "info", resolved: true }
  ];

  function getStatusColor(status: string) {
    if (status === 'green' || status === 'info') return '#10b981';
    if (status === 'amber') return '#f59e0b';
    if (status === 'critical' || status === 'red') return '#ef4444';
    return 'var(--muted)';
  }

  // Draw simple SVG sparkline
  function drawSparkline(data: number[]) {
    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 60;
    const height = 20;
    
    const pts = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    
    return `<polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />`;
  }
</script>

<main class="telemetry-app module-root">
  <div class="telemetry-container">
    
    <!-- TOP STATUS BANNER -->
    {#if systemStatus === 'healthy'}
      <div class="status-banner ok">
        <CheckCircle2 size={20} />
        <span>All systems healthy</span>
      </div>
    {:else if systemStatus === 'warning'}
      <div class="status-banner warn">
        <AlertTriangle size={20} />
        <span>1 issue detected — tap to view</span>
      </div>
    {:else}
      <div class="status-banner crit">
        <AlertTriangle size={20} />
        <span>Critical: Memory spike in Notes module</span>
      </div>
    {/if}

    <!-- METRICS GRID -->
    <div class="metrics-grid">
      {#each metrics as metric}
        <div class="metric-card">
          <div class="metric-header">
            <span class="status-dot" style="background: {getStatusColor(metric.status)}"></span>
            <span class="metric-title">{metric.title}</span>
          </div>
          <div class="metric-body">
            <div class="metric-value">
              <span class="num">{metric.value}</span>
              <span class="unit">{metric.unit}</span>
            </div>
            <div class="sparkline" style="color: {getStatusColor(metric.status)}">
              <svg width="60" height="20" viewBox="0 -2 60 24">
                {@html drawSparkline(metric.spark)}
              </svg>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- ACTIVE SESSIONS INFO -->
    <div class="session-card">
      <div class="session-info">
        <h3>Active Module</h3>
        <p><strong>Telemetry</strong> · Running for 2m 14s</p>
      </div>
      <button class="expand-btn"><Maximize2 size={16} /></button>
    </div>

    <!-- ANOMALY LOG -->
    <div class="log-section">
      <div class="log-header">
        <h3>System Log</h3>
        <span class="log-count">{logs.length} events</span>
      </div>
      
      <div class="log-list">
        {#each logs as log}
          <div class="log-row">
            <div class="log-time">{log.time}</div>
            <div class="log-content">
              <div class="log-top">
                <span class="log-module">{log.module}</span>
                {#if log.severity === 'amber'}
                  {#if log.resolved}
                    <span class="badge resolved">AI Fixed</span>
                  {:else}
                    <span class="badge unresolved">Unresolved</span>
                  {/if}
                {/if}
              </div>
              <div class="log-event">{log.event}</div>
            </div>
            <div class="log-indicator">
              <span class="dot" style="background: {getStatusColor(log.severity)}"></span>
            </div>
          </div>
        {/each}
      </div>
    </div>

  </div>
</main>

<style>
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



