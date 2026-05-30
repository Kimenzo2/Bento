<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		colspan,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableCellElement>> & { colspan?: number | string } = $props();
</script>

<td
	bind:this={ref}
	data-slot="table-cell"
	class={cn(
		"p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
		className
	)}
	colspan={typeof colspan === "string" ? Number.parseInt(colspan, 10) : colspan}
	{...restProps}
>
	{@render children?.()}
</td>
