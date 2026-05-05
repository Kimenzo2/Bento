<script lang="ts">
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
</script>

<section class="desktop-gate">
  <div class="desktop-gate__status">
    <LoaderCircleIcon class="animate-spin" />
    <div>
      <h1 class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
        Syncing your purchase
      </h1>
      <p class="mt-2 text-sm text-[var(--muted)]">
        The desktop shell stays responsive while the payment callback finalizes account state.
      </p>
    </div>
  </div>
</section>
