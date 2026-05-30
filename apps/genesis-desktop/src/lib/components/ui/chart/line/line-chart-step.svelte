<script lang="ts">
  import { LineChart } from "layerchart";
  import { scaleUtc } from "d3-scale";
  import { curveStep } from "d3-shape";
  import { Container } from "../index.js";
  import type { ChartConfig } from "../types.js";

  type Series = { key: string; label: string; color: string };

  let {
    data,
    x            = "date",
    series,
    config,
    dateFormat   = "short" as Intl.DateTimeFormatOptions["month"],
    strokeWidth  = 2,
    pointRadius  = 4,
    class: className = "",
  }: {
    data:         Record<string, unknown>[];
    x?:           string;
    series?:      Series[];
    config:       ChartConfig;
    dateFormat?:  Intl.DateTimeFormatOptions["month"];
    strokeWidth?: number;
    pointRadius?: number;
    class?:       string;
  } = $props();

  const resolvedSeries = $derived(
    series ??
    Object.entries(config)
      .filter(([, v]) => v.color)
      .map(([k, v]) => ({ key: k, label: v.label ?? k, color: v.color as string }))
  );
</script>

<Container {config} class={className}>
  <LineChart
    {data}
    {x}
    xScale={scaleUtc()}
    axis="x"
    series={resolvedSeries}
    tooltip={true}
    props={{
      spline: { curve: curveStep, strokeWidth },
      xAxis: {
        format: (v: Date) => v.toLocaleDateString("en-US", { month: dateFormat }),
      },
      highlight: { points: { r: pointRadius } },
    }}
  />
</Container>
