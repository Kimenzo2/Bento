<script lang="ts">
  let { hideLabel = false }: { hideLabel?: boolean } = $props();
</script>

<div class="text-sm">
  {#if !hideLabel}
    <div class="font-medium"></div>
  {/if}
</div>
