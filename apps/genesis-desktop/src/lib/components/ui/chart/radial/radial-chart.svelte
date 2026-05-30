<script lang="ts">
  // RadialChart — concentric arc rings via PieChart series+range API.
  import { PieChart } from "layerchart";
  import { Container } from "../index.js";
  import type { ChartConfig } from "../types.js";

  let {
    data,
    key         = "browser",
    value       = "value",
    colorField  = "color",
    outerRadius = -17,
    innerRadius = -12.5,
    config,
    class: className = "mx-auto aspect-square max-h-[250px]",
  }: {
    data:          Record<string, unknown>[];
    key?:          string;
    value?:        string;
    colorField?:   string;
    outerRadius?:  number;
    innerRadius?:  number;
    config:        ChartConfig;
    class?:        string;
  } = $props();

  const maxValue = $derived(Math.max(...data.map((d) => d[value] as number)));

  const series = $derived(
    data.map((d) => ({
      key:      d[key]        as string,
      color:    d[colorField] as string,
      data:     [d],
      maxValue,
    }))
  );
</script>

<Container {config} class={className}>
  <PieChart
    {data}
    {value}
    {outerRadius}
    {innerRadius}
    {series}
    range={[90, -270]}
    {maxValue}
    tooltip={true}
    
  />
</Container>
