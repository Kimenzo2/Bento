<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  export let title: string;
  export let value: string;
  export let trend: string;
  export let note: string;
  export let periodLabel: string;
  export let labels: string[] = [];
  export let current: Array<number | null> = [];
  export let previous: Array<number | null> = [];
  export let unit: string = '';
  export let featured = false;
  export let live = false;

  let canvas: HTMLCanvasElement | null = null;
  let chart: Chart<'line'> | null = null;

  function chartTheme() {
    const styles = getComputedStyle(document.documentElement);
    return {
      foreground: styles.getPropertyValue('--foreground').trim() || '#ffffff',
      muted: styles.getPropertyValue('--muted').trim() || '#8a8a8d',
      border: styles.getPropertyValue('--border').trim() || '#25252a',
      surface: styles.getPropertyValue('--surface').trim() || '#17171a',
      background: styles.getPropertyValue('--background').trim() || '#0e0e10',
      accent: styles.getPropertyValue('--telemetry-accent').trim() || '#2563eb',
      accentSoft:
        styles.getPropertyValue('--telemetry-accent-soft').trim() || 'rgba(37, 99, 235, 0.15)',
      previous: styles.getPropertyValue('--telemetry-muted-series').trim() || 'rgba(148, 163, 184, 0.28)',
    };
  }

  function toRgba(color: string, alpha: number) {
    const trimmed = color.trim();
    if (trimmed.startsWith('rgba(')) {
      return trimmed.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
    }
    if (trimmed.startsWith('rgb(')) {
      return trimmed.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (!trimmed.startsWith('#')) {
      return trimmed;
    }

    const hex = trimmed.slice(1);
    const normalized = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
    const value = Number.parseInt(normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function formatPoint(value: number) {
    if (!unit) return `${Math.round(value)}`;
    if (unit === 'ms') return `${value.toFixed(1)} ms`;
    if (unit === 'MB') return `${value.toFixed(1)} MB`;
    if (unit === '%') return `${value.toFixed(1)}%`;
    return `${value.toFixed(1)} ${unit}`;
  }

  function createGradient(context: CanvasRenderingContext2D, area: { top: number; bottom: number }) {
    const { accent } = chartTheme();
    const gradient = context.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, toRgba(accent, 0.28));
    gradient.addColorStop(1, toRgba(accent, 0.02));
    return gradient;
  }

  function buildOrUpdateChart() {
    if (!canvas) return;

    const theme = chartTheme();
    const context = canvas.getContext('2d');
    if (!context) return;

    if (!chart) {
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Previous period',
              data: previous,
              borderColor: theme.previous,
              backgroundColor: 'transparent',
              borderWidth: 1.5,
              pointRadius: 0,
              pointHoverRadius: 0,
              tension: 0,
              fill: false,
            },
            {
              label: 'Current period',
              data: current,
              borderColor: theme.accent,
              backgroundColor(context) {
                const chartArea = context.chart.chartArea;
                if (!chartArea) {
                  return toRgba(theme.accent, 0.12);
                }
                return createGradient(context.chart.ctx, chartArea);
              },
              borderWidth: 2.2,
              pointRadius(context) {
                return context.dataIndex === current.length - 1 ? 4 : 0;
              },
              pointHoverRadius: 5,
              pointBackgroundColor: theme.accent,
              pointBorderColor: theme.background,
              pointBorderWidth(context) {
                return context.dataIndex === current.length - 1 ? 2 : 0;
              },
              tension: 0,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 180,
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: toRgba(theme.surface, 0.98),
              borderColor: toRgba(theme.border, 0.94),
              borderWidth: 1,
              titleColor: theme.foreground,
              bodyColor: theme.foreground,
              displayColors: true,
              padding: 12,
              callbacks: {
                title(items) {
                  return items[0]?.label ?? '';
                },
                label(context) {
                  return `${context.dataset.label}: ${formatPoint(Number(context.parsed.y ?? 0))}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: {
                color: toRgba(theme.border, 0.5),
                drawTicks: false,
              },
              border: {
                display: false,
              },
              ticks: {
                color: theme.muted,
                autoSkip: true,
                maxRotation: 0,
                maxTicksLimit: featured ? 7 : 6,
                font: {
                  size: 11,
                },
              },
            },
            y: {
              display: false,
              grid: {
                display: false,
              },
              border: {
                display: false,
              },
            },
          },
        },
      });
      return;
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = previous;
    chart.data.datasets[0].borderColor = theme.previous;
    chart.data.datasets[1].data = current;
    chart.data.datasets[1].borderColor = theme.accent;
    chart.data.datasets[1].pointBackgroundColor = theme.accent;
    chart.data.datasets[1].pointBorderColor = theme.background;
    chart.update();
  }

  onMount(() => {
    buildOrUpdateChart();
  });

  onDestroy(() => {
    chart?.destroy();
  });

  $: if (canvas) {
    buildOrUpdateChart();
  }
</script>

<article class={`polar-panel ${featured ? 'polar-panel--featured' : ''}`}>
  <div class="polar-panel-head">
    <div class="polar-panel-topline">
      <h3>{title}</h3>
      {#if live}
        <span class="live-badge">Live</span>
      {/if}
    </div>

    <div class="polar-panel-value-row">
      <strong class="polar-panel-value">{value}</strong>
      <span class="polar-panel-trend">{trend}</span>
    </div>

    <div class="polar-panel-period">
      <span class="period-dot"></span>
      <span>{periodLabel}</span>
    </div>

    <p class="polar-note">{note}</p>
  </div>

  <div class="chart-frame">
    <canvas bind:this={canvas}></canvas>
  </div>
</article>

<style>
  .polar-panel {
    display: grid;
    gap: 1.2rem;
    padding: 1.35rem;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: transparent;
  }

  .polar-panel--featured {
    grid-column: span 2;
  }

  .polar-panel-head {
    display: grid;
    gap: 0.7rem;
  }

  .polar-panel-topline,
  .polar-panel-value-row {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .polar-panel-topline h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  .live-badge {
    display: inline-flex;
    align-items: center;
    min-height: 1.7rem;
    padding-inline: 0.65rem;
    border: 1px solid color-mix(in srgb, var(--telemetry-accent) 45%, var(--border));
    border-radius: 999px;
    color: var(--telemetry-accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .polar-panel-value {
    font-size: clamp(3rem, 4vw, 4.35rem);
    font-weight: 300;
    letter-spacing: -0.07em;
    line-height: 0.95;
  }

  .polar-panel-trend {
    margin-top: 0.45rem;
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .polar-panel-period {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--foreground);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .period-dot {
    width: 0.95rem;
    height: 0.95rem;
    border: 0.18rem solid var(--telemetry-accent);
    border-radius: 999px;
    box-sizing: border-box;
  }

  .polar-note {
    margin: 0;
    color: var(--muted);
    font-size: 0.92rem;
    line-height: 1.5;
  }

  .chart-frame {
    position: relative;
    min-height: 19rem;
    border-top: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
    padding-top: 1rem;
  }

  .chart-frame :global(canvas) {
    width: 100% !important;
    height: 100% !important;
  }

  @media (max-width: 1100px) {
    .polar-panel,
    .polar-panel--featured {
      grid-column: span 1;
      border-right: 0;
    }
  }
</style>
