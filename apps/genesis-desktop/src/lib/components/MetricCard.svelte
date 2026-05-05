<script lang="ts">
  let {
    label,
    value,
    caption,
  }: {
    label: string;
    value: string;
    caption: string;
  } = $props();
</script>

<div class="surface-card rounded-3xl p-5">
  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
  <p class="mt-3 font-[var(--font-heading)] text-4xl font-semibold text-[var(--foreground)]">{value}</p>
  <p class="mt-2 text-sm text-[var(--muted)]">{caption}</p>
</div>
