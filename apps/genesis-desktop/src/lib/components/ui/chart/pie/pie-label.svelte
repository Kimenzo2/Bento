<script lang="ts">
  import { PieChart } from "layerchart";
  import { Container } from "../index.js";
  import type { ChartConfig } from "../types.js";

  let {
    data,
    key         = "browser",
    value       = "visitors",
    colorField  = "color",
    config,
    class: className = "mx-auto aspect-square max-h-[250px]",
  }: {
    data:        Record<string, unknown>[];
    key?:        string;
    value?:      string;
    colorField?: string;
    config:      ChartConfig;
    class?:      string;
  } = $props();
</script>

<!--
  pie-label: uses PieChart with Labels slot for outer value labels.
  The arc snippet is not available in layerchart v1 PieChart —
  use the marks slot to render custom SVG labels instead.
-->
<Container {config} class={className}>
  <PieChart
    {data}
    key={key}
    {value}
    cRange={data.map((d) => d[colorField] as string)}
    c={colorField}
  />
</Container>
