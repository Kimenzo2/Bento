<script lang="ts">
  import * as d3Scale from 'd3-scale';
  import { line, curveCatmullRom, area } from 'd3-shape';

  // ── Types ────────────────────────────────────────────────────────────────
  interface ChartDataPoint {
    month: string;
    date: Date;
    incomeActual: number;
    expensesActual: number;
    incomeForecast: number;
    expensesForecast: number;
    isForecast: boolean;
  }

  let {
    data: rawData = [],
    months = 6,
    onMonthsChange,
  }: {
    data: Array<Omit<ChartDataPoint, 'date'>>;
    months?: number;
    onMonthsChange?: (n: number) => void;
  } = $props();

  // ── Parse data ──────────────────────────────────────────────────────────
  const parsed = $derived(
    rawData.map((d) => ({
      ...d,
      date: new Date(d.month + '-15T12:00:00Z'),
    }))
  );

  const transitionIndex = $derived(parsed.findIndex((d) => d.isForecast));
  const todayDate = $derived(
    transitionIndex > 0 ? parsed[transitionIndex]?.date ?? new Date() : new Date()
  );

  // ── Summary statistics ───────────────────────────────────────────────────
  const summary = $derived.by(() => {
    if (parsed.length === 0) {
      return { projectedBalance: 0, avgIncome: 0, avgExpenses: 0, dataMonths: 0, totalMonths: 0 };
    }
    const last = parsed[parsed.length - 1];
    // Last forecast point's projection
    const projectedBalance = last.incomeForecast - last.expensesForecast;
    // Average actuals (over historical months)
    const historical = parsed.filter((d) => !d.isForecast);
    const avgIncome =
      historical.length > 0
        ? historical.reduce((s, d) => s + d.incomeActual, 0) / historical.length
        : 0;
    const avgExpenses =
      historical.length > 0
        ? historical.reduce((s, d) => s + d.expensesActual, 0) / historical.length
        : 0;
    return {
      projectedBalance,
      avgIncome,
      avgExpenses,
      dataMonths: historical.length,
      totalMonths: parsed.length,
    };
  });

  // ── Scales ───────────────────────────────────────────────────────────────
  const MARGIN = { top: 16, right: 16, bottom: 36, left: 56 };
  const CHART_HEIGHT = 280;
  let containerWidth = $state(700);

  const chartWidth = $derived(Math.max(containerWidth, 300));
  const innerWidth = $derived(chartWidth - MARGIN.left - MARGIN.right);
  const innerHeight = $derived(CHART_HEIGHT - MARGIN.top - MARGIN.bottom);

  const allValues = $derived.by(() => {
    const vals: number[] = [];
    for (const d of parsed) {
      vals.push(d.incomeActual, d.expensesActual, d.incomeForecast, d.expensesForecast);
    }
    return vals;
  });
  const maxVal = $derived(Math.max(...allValues, 1));

  // Nice round max for Y-axis
  const yMax = $derived.by(() => {
    const step = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const nice = Math.ceil(maxVal / step) * step;
    return nice * 1.15; // 15% headroom
  });

  const xScale = $derived(
    d3Scale.scaleTime()
      .domain(parsed.length > 0 ? [parsed[0].date, parsed[parsed.length - 1].date] : [new Date(), new Date()])
      .range([0, innerWidth])
  );
  const yScale = $derived(
    d3Scale.scaleLinear()
      .domain([0, yMax])
      .range([innerHeight, 0])
  );

  // ── Path generators for each series ──────────────────────────────────────
  function lineGenerator(accessor: (d: ChartDataPoint) => number) {
    return line<ChartDataPoint>()
      .defined((d) => accessor(d) > 0)
      .x((d) => xScale(d.date))
      .y((d) => yScale(accessor(d)))
      .curve(curveCatmullRom);
  }

  const incomeActualPath = $derived(lineGenerator((d) => d.incomeActual)(parsed) ?? '');
  const expensesActualPath = $derived(lineGenerator((d) => d.expensesActual)(parsed) ?? '');
  const incomeForecastPath = $derived(lineGenerator((d) => d.incomeForecast)(parsed) ?? '');
  const expensesForecastPath = $derived(lineGenerator((d) => d.expensesForecast)(parsed) ?? '');

  // ── Area fill under actual income ────────────────────────────────────────
  const areaGenerator = $derived(
    area<ChartDataPoint>()
      .defined((d) => d.incomeActual > 0)
      .x((d) => xScale(d.date))
      .y0(() => yScale(0))
      .y1((d) => yScale(d.incomeActual))
      .curve(curveCatmullRom)
  );
  const incomeActualArea = $derived(areaGenerator(parsed) ?? '');

  // ── Tick generation ─────────────────────────────────────────────────────
  const yTicks = $derived.by(() => {
    const ticks: number[] = [];
    const count = 5;
    const step = yMax / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round(i * step));
    }
    return ticks;
  });

  function formatY(val: number): string {
    if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `€${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    return `€${Math.round(val)}`;
  }

  function formatMonth(date: Date, index: number): string {
    // Show month abbreviation
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getUTCMonth()];
  }

  // ── Tooltip state ────────────────────────────────────────────────────────
  let hoveredPoint = $state<ChartDataPoint | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let showTooltip = $state(false);

  function getClosestPoint(clientX: number, chartEl: SVGSVGElement) {
    const rect = chartEl.getBoundingClientRect();
    const relX = clientX - rect.left - MARGIN.left;
    if (relX < 0 || relX > innerWidth) {
      showTooltip = false;
      return;
    }
    const date = xScale.invert(relX);
    // Find the closest data point
    let closest = parsed[0];
    let minDist = Infinity;
    for (const d of parsed) {
      const dist = Math.abs(d.date.getTime() - date.getTime());
      if (dist < minDist) {
        minDist = dist;
        closest = d;
      }
    }
    if (closest) {
      hoveredPoint = closest;
      tooltipX = relX + MARGIN.left;
      // Determine tooltip Y position (middle of chart)
      tooltipY = Math.max(20, innerHeight / 2);
      showTooltip = true;
    }
  }

  // ── Color palette ────────────────────────────────────────────────────────
  // OKLCH values — fixed hue, work in both light & dark themes.
  // L adjusted per better-colors: "Fix contrast by adjusting L channel only".
  const COLORS = {
    incomeActual: 'oklch(0.723 0.219 149.579)',       // green
    expensesActual: 'oklch(0.637 0.237 25.331)',       // red
    incomeForecast: 'oklch(0.87 0.15 149.579)',        // light green
    expensesForecast: 'oklch(0.85 0.12 25.331)',       // light red
    grid: 'color-mix(in srgb, var(--border) 40%, transparent)',
    text: 'var(--muted)',
    today: 'color-mix(in srgb, var(--foreground) 30%, transparent)',
  };
</script>

<div class="forecasting-chart" style="--fc-income-actual: {COLORS.incomeActual}; --fc-expenses-actual: {COLORS.expensesActual}; --fc-income-forecast: {COLORS.incomeForecast}; --fc-expenses-forecast: {COLORS.expensesForecast};">
  <!-- ── Summary metrics ─────────────────────────────────────────────── -->
  <div class="summary-row">
    <div class="summary-metric accent">
      <span class="metric-label">Projected Balance</span>
      <span class="metric-value" class:negative={summary.projectedBalance < 0}>
        {summary.projectedBalance >= 0 ? '+' : ''}€{summary.projectedBalance.toFixed(0)}
      </span>
    </div>
    <div class="summary-metric">
      <span class="metric-label">Avg Monthly Income</span>
      <span class="metric-value income">€{summary.avgIncome.toFixed(0)}</span>
    </div>
    <div class="summary-metric">
      <span class="metric-label">Avg Monthly Expenses</span>
      <span class="metric-value expense">€{summary.avgExpenses.toFixed(0)}</span>
    </div>
    <div class="summary-metric">
      <span class="metric-label">Data Span</span>
      <span class="metric-value">{summary.totalMonths} months</span>
    </div>
  </div>

  <!-- ── Time range controls ────────────────────────────────────────── -->
  <div class="controls-row">
    <span class="control-label">Forecast:</span>
    <div class="range-pills">
      {#each [3, 6, 12] as n}
        <button
          class="pill-btn"
          class:active={months === n}
          onclick={() => onMonthsChange?.(n)}
        >{n} months</button>
      {/each}
    </div>
  </div>

  <!-- ── Chart ──────────────────────────────────────────────────────── -->
  <div class="chart-container" bind:clientWidth={containerWidth}>
    {#if parsed.length === 0}
      <div class="chart-empty">
        <div class="empty-line"></div>
        <span>Not enough data for forecasting</span>
      </div>
    {:else}
      <svg
        viewBox="0 0 {chartWidth} {CHART_HEIGHT}"
        class="chart-svg"
        role="img"
        aria-label="Income and expenses line chart with forecast projection"
        onmousemove={(e) => getClosestPoint(e.clientX, e.currentTarget)}
        onmouseleave={() => { showTooltip = false; hoveredPoint = null; }}
        onfocus={() => {}}
        onblur={() => { showTooltip = false; hoveredPoint = null; }}
      >
        <!-- ── Grid & Y-axis ───────────────────────────────────────── -->
        {#each yTicks as tick}
          <g>
            <line
              x1={MARGIN.left} y1={yScale(tick)}
              x2={MARGIN.left + innerWidth} y2={yScale(tick)}
              stroke={COLORS.grid}
              stroke-width="1"
            />
            <text
              x={MARGIN.left - 8} y={yScale(tick) + 4}
              text-anchor="end" fill={COLORS.text}
              font-size="11" font-family="inherit"
            >{formatY(tick)}</text>
          </g>
        {/each}

        <!-- ── X-axis (months) ─────────────────────────────────────── -->
        {#each parsed as d, i}
          {const x = xScale(d.date)}
          {const isTransition = i === transitionIndex}
          {#if isTransition}
            <!-- "Today" vertical marker -->
            <line
              x1={xScale(d.date)} y1={yScale(0)}
              x2={xScale(d.date)} y2={yScale(yMax)}
              stroke={COLORS.today}
              stroke-width="2"
              stroke-dasharray="6,4"
              stroke-linecap="round"
            />
            <!-- "Forecast" label -->
            <text
              x={xScale(d.date) + 6} y={yScale(yMax) - 6}
              fill={COLORS.text}
              font-size="10" font-weight="600"
              font-family="inherit"
            >Forecast →</text>
          {/if}
          <!-- Month label (show every other for dense charts) -->
          {#if parsed.length <= 12 || i % 2 === 0}
            <text
              x={x} y={CHART_HEIGHT - 8}
              text-anchor="middle" fill={COLORS.text}
              font-size="11" font-family="inherit"
            >{formatMonth(d.date, i)}</text>
          {/if}
        {/each}

        <!-- ── Area fill (income actual - subtle) ─────────────────--- -->
        {#if incomeActualArea}
          <path
            d={incomeActualArea}
            fill="url(#incomeGradient)"
            opacity="0.12"
          />
        {/if}

        <!-- ── Income Actual (solid green) ─────────────────────────── -->
        {#if incomeActualPath}
          <path
            d={incomeActualPath}
            fill="none"
            stroke={COLORS.incomeActual}
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="chart-line"
          />
        {/if}

        <!-- ── Expenses Actual (solid red) ─────────────────────────── -->
        {#if expensesActualPath}
          <path
            d={expensesActualPath}
            fill="none"
            stroke={COLORS.expensesActual}
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="chart-line"
          />
        {/if}

        <!-- ── Income Forecast (dashed lighter green) ──────────────── -->
        {#if incomeForecastPath}
          <path
            d={incomeForecastPath}
            fill="none"
            stroke={COLORS.incomeForecast}
            stroke-width="2.5"
            stroke-dasharray="8,5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="chart-line forecast"
          />
        {/if}

        <!-- ── Expenses Forecast (dashed lighter red) ──────────────── -->
        {#if expensesForecastPath}
          <path
            d={expensesForecastPath}
            fill="none"
            stroke={COLORS.expensesForecast}
            stroke-width="2.5"
            stroke-dasharray="8,5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="chart-line forecast"
          />
        {/if}

        <!-- ── Gradient definitions ─────────────────────────────────── -->
        <defs>
          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={COLORS.incomeActual} stop-opacity="0.3" />
            <stop offset="100%" stop-color={COLORS.incomeActual} stop-opacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Screen reader data table -->
      <table class="fc-sr-only">
        <caption>Monthly income and expenses</caption>
        <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Balance</th><th>Type</th></tr></thead>
        <tbody>
          {#each parsed as d}
            <tr>
              <td>{d.month}</td>
              <td>€{(d.isForecast ? d.incomeForecast : d.incomeActual).toFixed(0)}</td>
              <td>€{(d.isForecast ? d.expensesForecast : d.expensesActual).toFixed(0)}</td>
              <td>€{((d.isForecast ? d.incomeForecast : d.incomeActual) - (d.isForecast ? d.expensesForecast : d.expensesActual)).toFixed(0)}</td>
              <td>{d.isForecast ? 'Forecast' : 'Actual'}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <!-- ── Tooltip ───────────────────────────────────────────────── -->
      {#if showTooltip && hoveredPoint}
        <div
          class="chart-tooltip"
          style="left: {tooltipX}px; top: {tooltipY}px;"
        >
          <div class="tt-header">
            <span class="tt-month">{hoveredPoint.month}</span>
            <span class="tt-tag" class:forecast={hoveredPoint.isForecast}>
              {hoveredPoint.isForecast ? 'Forecast' : 'Actual'}
            </span>
          </div>
          <div class="tt-row income">
            <span class="tt-dot" style="background: {COLORS.incomeActual}"></span>
            <span>Income</span>
            <span class="tt-val">€{(hoveredPoint.isForecast ? hoveredPoint.incomeForecast : hoveredPoint.incomeActual).toFixed(0)}</span>
          </div>
          <div class="tt-row expense">
            <span class="tt-dot" style="background: {COLORS.expensesActual}"></span>
            <span>Expenses</span>
            <span class="tt-val">€{(hoveredPoint.isForecast ? hoveredPoint.expensesForecast : hoveredPoint.expensesActual).toFixed(0)}</span>
          </div>
          <div class="tt-divider"></div>
          <div class="tt-row total">
            <span>Balance</span>
            <span class="tt-val" class:negative={((hoveredPoint.isForecast ? hoveredPoint.incomeForecast : hoveredPoint.incomeActual) - (hoveredPoint.isForecast ? hoveredPoint.expensesForecast : hoveredPoint.expensesActual)) < 0}>
              €{((hoveredPoint.isForecast ? hoveredPoint.incomeForecast : hoveredPoint.incomeActual) - (hoveredPoint.isForecast ? hoveredPoint.expensesForecast : hoveredPoint.expensesActual)).toFixed(0)}
            </span>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- ── Legend ──────────────────────────────────────────────────────── -->
  <div class="chart-legend">
    <div class="legend-item">
      <span class="legend-line solid" style="background: {COLORS.incomeActual}"></span>
      <span class="legend-label">Income</span>
      <span class="legend-tag actual-tag">Actual</span>
    </div>
    <div class="legend-item">
      <span class="legend-line solid" style="background: {COLORS.expensesActual}"></span>
      <span class="legend-label">Expenses</span>
      <span class="legend-tag actual-tag">Actual</span>
    </div>
    <div class="legend-item">
      <span class="legend-line dashed" style="background: {COLORS.incomeForecast}"></span>
      <span class="legend-label">Income</span>
      <span class="legend-tag forecast-tag">Forecast</span>
    </div>
    <div class="legend-item">
      <span class="legend-line dashed" style="background: {COLORS.expensesForecast}"></span>
      <span class="legend-label">Expenses</span>
      <span class="legend-tag forecast-tag">Forecast</span>
    </div>
  </div>
</div>

<style>
  .forecasting-chart {
    --fc-income-actual: oklch(0.723 0.219 149.579);
    --fc-expenses-actual: oklch(0.637 0.237 25.331);
    --fc-income-forecast: oklch(0.87 0.15 149.579);
    --fc-expenses-forecast: oklch(0.85 0.12 25.331);
    background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 98%, var(--background)), color-mix(in srgb, var(--surface) 86%, var(--background)));
    border: none;
    border-radius: 20px;
    padding: 20px 20px 16px;
    margin-bottom: 16px;
  }

  /* ── Summary ──────────────────────────────────────────────────────── */
  .summary-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .summary-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--background) 50%, transparent);
  }
  .summary-metric.accent {
    background: color-mix(in srgb, var(--fc-income-actual) 10%, transparent);
  }
  .metric-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .metric-value {
    font-size: 18px;
    font-weight: 700;
  }
  .metric-value.income { color: var(--fc-income-actual); }
  .metric-value.expense { color: var(--fc-expenses-actual); }
  .metric-value.negative { color: var(--fc-expenses-actual); }

  /* ── Controls ─────────────────────────────────────────────────────── */
  .controls-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .control-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }
  .range-pills {
    display: flex;
    gap: 6px;
  }
  .pill-btn {
    padding: 5px 14px;
    min-height: 32px;
    border-radius: 100px;
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), border-color 160ms ease, color 160ms ease, background 160ms ease;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }
  .pill-btn:hover:not(.active) {
    border-color: var(--foreground);
    color: var(--foreground);
  }
  .pill-btn.active {
    background: var(--fc-income-actual);
    color: white;
    border-color: var(--fc-income-actual);
  }
  .pill-btn:active {
    transform: scale(0.96);
  }

  /* ── Chart container ──────────────────────────────────────────────── */
  .chart-container {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
  }
  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .chart-empty {
    height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--muted);
    font-size: 13px;
  }
  .empty-line {
    width: 80px;
    height: 2px;
    border-radius: 2px;
    background: var(--border);
    opacity: 0.5;
  }

  /* ── Chart lines ────────────────────────────────────────────────── */
  .chart-line {
    transition: d 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .chart-line.forecast {
    opacity: 0.85;
  }

  /* ── Tooltip ──────────────────────────────────────────────────────── */
  .chart-tooltip {
    position: absolute;
    transform: translate(-50%, calc(-100% - 12px));
    background: var(--card);
    border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
    border-radius: 14px;
    padding: 12px 16px;
    min-width: 160px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06);
    backdrop-filter: blur(12px);
    pointer-events: none;
    z-index: 10;
    animation: tooltipFadeIn 0.15s ease-out;
  }
  @keyframes tooltipFadeIn {
    from { opacity: 0; transform: translate(-50%, calc(-100% - 8px)) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, calc(-100% - 12px)) scale(1); }
  }
  .tt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .tt-month {
    font-size: 13px;
    font-weight: 600;
  }
  .tt-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 100px;
    background: color-mix(in srgb, var(--fc-income-actual) 12%, transparent);
    color: var(--fc-income-actual);
  }
  .tt-tag.forecast {
    background: color-mix(in srgb, var(--muted) 15%, transparent);
    color: var(--muted);
  }
  .tt-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 3px 0;
    color: var(--muted);
  }
  .tt-row.total {
    border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    margin-top: 3px;
    padding-top: 6px;
    font-weight: 600;
    color: var(--foreground);
  }
  .tt-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .tt-val {
    margin-left: auto;
    font-weight: 600;
    color: var(--foreground);
  }
  .tt-val.negative { color: var(--fc-expenses-actual); }
  .tt-divider { height: 1px; }

  /* ── Legend ──────────────────────────────────────────────────────── */
  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-line {
    width: 20px;
    height: 3px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .legend-line.dashed {
    background-image: repeating-linear-gradient(
      to right,
      currentColor 0,
      currentColor 8px,
      transparent 8px,
      transparent 13px
    );
    background-color: transparent;
    color: inherit;
  }
  .legend-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
  }
  .legend-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 100px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .legend-tag.actual-tag {
    background: color-mix(in srgb, var(--fc-income-actual) 12%, transparent);
    color: var(--fc-income-actual);
  }
  .legend-tag.forecast-tag {
    background: color-mix(in srgb, var(--muted) 15%, transparent);
    color: var(--muted);
  }

  /* ── Responsive ──────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .summary-row {
      grid-template-columns: repeat(2, 1fr);
    }
    .forecasting-chart {
      padding: 16px 14px;
    }
  }

  /* ── Screen reader only ─────────────────────────────────────────────── */
  .fc-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
