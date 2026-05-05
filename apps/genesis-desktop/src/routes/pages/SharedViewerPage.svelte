<script lang="ts">
  import type { RouteResult } from "@mateothegreat/svelte5-router";
  import BookOpenTextIcon from "@lucide/svelte/icons/book-open-text";
  import { Button } from "$lib/components/ui/button/index.js";

  let {
    route,
  }: {
    route?: RouteResult;
  } = $props();

  const shortCode = $derived(
    ((route?.result.path.params as Record<string, string> | undefined)?.shortCode ?? "preview")
  );
</script>

<section class="desktop-gate">
  <div class="desktop-gate__status">
    <BookOpenTextIcon />
    <div>
      <h1 class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
        Shared viewer: {shortCode}
      </h1>
      <p class="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Shared book links route directly into the desktop viewer shell with the same page chrome and theme runtime.
      </p>
      <div class="mt-5 flex gap-3">
        <Button class="rounded-full px-5" href="/viewer">Open viewer</Button>
        <Button class="rounded-full px-5" href="/" variant="outline">Back to dashboard</Button>
      </div>
    </div>
  </div>
</section>
