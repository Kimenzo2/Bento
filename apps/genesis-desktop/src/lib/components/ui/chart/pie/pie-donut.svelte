<script lang="ts">
  import { PieChart } from "layerchart";
  import { Container } from "../index.js";
  import type { ChartConfig } from "../types.js";

  let {
    data,
    key          = "browser",
    value        = "visitors",
    colorField   = "color",
    innerRadius  = 60,
    config,
    class: className = "mx-auto aspect-square max-h-[250px]",
  }: {
    data:         Record<string, unknown>[];
    key?:         string;
    value?:       string;
    colorField?:  string;
    innerRadius?: number;
    config:       ChartConfig;
    class?:       string;
  } = $props();
</script>

<Container {config} class={className}>
  <PieChart
    {data}
    {key}
    {value}
    c={colorField}
    {innerRadius}
  />
</Container>
