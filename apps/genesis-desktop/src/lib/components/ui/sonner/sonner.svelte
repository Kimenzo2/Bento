<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import { mode } from "mode-watcher";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
	import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
	import InfoIcon from "@lucide/svelte/icons/info";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

	let { ...restProps }: SonnerProps = $props();

	const toastOptions = {
		unstyled: true,
		classes: {
			toast:
				"group relative isolate flex w-full items-start gap-3 overflow-hidden rounded-[12px] border border-[color:color-mix(in_srgb,var(--border)_84%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_96%,var(--background))] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.08)]",
			icon: "mt-[1px] shrink-0",
			content: "min-w-0 flex-1",
			title: "text-[13px] font-semibold leading-5 tracking-[-0.01em] text-[var(--foreground)]",
			description: "text-[12px] leading-4 text-[var(--muted)]",
			actionButton:
				"inline-flex h-7 items-center justify-center rounded-[11px] border border-[color:color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_93%,var(--background))] px-3 text-[12px] font-medium text-[var(--foreground)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,var(--surface))]",
			cancelButton:
				"inline-flex h-7 items-center justify-center rounded-[11px] border border-[color:color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_93%,var(--background))] px-3 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,var(--surface))]",
			closeButton:
				"h-7 w-7 rounded-[11px] border border-[color:color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_93%,var(--background))] text-[var(--muted)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,var(--surface))] hover:text-[var(--foreground)]",
			success:
				"border-[rgba(16,185,129,0.20)] bg-[color:color-mix(in_srgb,rgba(16,185,129,0.06)_12%,var(--surface))]",
			error:
				"border-[rgba(244,63,94,0.20)] bg-[color:color-mix(in_srgb,rgba(244,63,94,0.06)_12%,var(--surface))]",
			info:
				"border-[rgba(56,189,248,0.20)] bg-[color:color-mix(in_srgb,rgba(56,189,248,0.06)_12%,var(--surface))]",
			warning:
				"border-[rgba(251,191,36,0.20)] bg-[color:color-mix(in_srgb,rgba(251,191,36,0.06)_12%,var(--surface))]",
		},
	};
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	toastOptions={toastOptions}
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4" />
	{/snippet}
</Sonner>
