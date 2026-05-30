<script lang="ts">
  // RadialChartText — single arc ring with centred value + label.
  //
  // FIX (2026-05-27):
  //   layerchart@1.x is a Svelte 4 library. It exposes `belowMarks` and
  //   `aboveMarks` as *named slots* (<slot name="belowMarks">), NOT as snippet
  //   props. Svelte 5 {#snippet} blocks are completely different from Svelte 4
  //   named slots — layerchart silently ignores them, resulting in a dark empty
  //   circle with no arc text and no background fill.
  //
  //   Fix: use <svelte:fragment slot="belowMarks"> and
  //        <svelte:fragment slot="aboveMarks"> — the Svelte 4 slot attribute
  //        syntax that Svelte 5 still supports when consuming Svelte 4
  //        components.
  //
  // FIX 2: `value` defaulted to "visitors" (the shadcn demo field name) but
  //   every callsite in this app passes data as { key, value, color }, so
  //   data[0]["visitors"] was always undefined → blank center number.
  //   Default changed to "value".

  import { PieChart, Text } from "layerchart";
  import { Container } from "../index.js";
  import type { ChartConfig } from "../types.js";

  let {
    data,
    key          = "key",
    value        = "value",   // ← was "visitors"; all callers use "value" field
    colorField   = "color",
    valueLabel   = "Visitors",
    maxValue     = 300,
    outerRadius  = -20,
    innerRadius  = -12,
    cornerRadius = 20,
    config,
    class: className = "mx-auto aspect-square max-h-[250px]",
  }: {
    data:          Record<string, unknown>[];
    key?:          string;
    value?:        string;
    colorField?:   string;
    valueLabel?:   string;
    maxValue?:     number;
    outerRadius?:  number;
    innerRadius?:  number;
    cornerRadius?: number;
    config:        ChartConfig;
    class?:        string;
  } = $props();

  const series = $derived(
    data.map((d) => ({
      key:      d[key]        as string,
      color:    d[colorField] as string,
      data:     [d],
      maxValue,
    }))
  );

  // Read the display value from the correct field name (now "value" by default).
  const rawValue  = $derived(data[0]?.[value]);
  const displayValue = $derived(
    rawValue != null ? String(rawValue) : ""
  );

  // Background circle radius — tight-fits the inner radius of the arc.
  // innerRadius=-12 means 12px less than half chart height; this circle
  // covers the inner hole so the background shows through.
  const bgRadius = 60;
</script>

<Container {config} class={className}>
  <!--
    PieChart is a Svelte 4 component.  Pass slot content using the
    Svelte 4 `slot="name"` attribute — NOT Svelte 5 {#snippet} blocks.
    Using {#snippet} here causes the content to be silently dropped.
  -->
  <PieChart
    {data}
    {value}
    {outerRadius}
    {innerRadius}
    {cornerRadius}
    {series}
    range={[90, -270]}
    {maxValue}
  >
    <!--
      slot="belowMarks": rendered inside the SVG, beneath the arc marks.
      Paints the solid background circle so the transparent arc hole
      shows the page background colour instead of the chart background.
    -->
    <svelte:fragment slot="belowMarks">
      <circle cx="0" cy="0" r={bgRadius} class="fill-background" />
    </svelte:fragment>

    <!--
      slot="aboveMarks": rendered inside the SVG, above the arc marks.
      Renders the centred numeric value and the label below it.
    -->
    <svelte:fragment slot="aboveMarks">
      <Text
        value={displayValue}
        textAnchor="middle"
        verticalAnchor="middle"
        class="fill-foreground text-4xl! font-bold"
        dy={displayValue ? 3 : 0}
      />
      <Text
        value={valueLabel}
        textAnchor="middle"
        verticalAnchor="middle"
        class="fill-muted-foreground!"
        dy={displayValue ? 22 : 4}
      />
    </svelte:fragment>
  </PieChart>
</Container>
