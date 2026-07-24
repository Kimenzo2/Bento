<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    value,
    type = "metric",
    weight,
    prefix = "",
    suffix = "",
    class: className,
  }: {
    value: string | number;
    type?: "hero" | "metric" | "stat" | "tabular";
    weight?: 300 | 400 | 500 | 600 | 700 | 800;
    prefix?: string;
    suffix?: string;
    class?: string;
  } = $props();

  const weightClass = $derived(
    weight === 500 ? "number-medium"
    : weight === 600 || weight === 700 || weight === 800 ? "number-semibold"
    : ""
  );
</script>

<span
  class={cn("number", `number-${type}`, weightClass, className)}
>
  {prefix}{value}{suffix}
</span>
