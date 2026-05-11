<script lang="ts">
  import LaunchReadyReporter from "$lib/components/LaunchReadyReporter.svelte";
  import { isStarterModuleId, loadStarterModule } from "$lib/modules/starter-module-registry";

  let {
    appId,
  }: {
    appId: string;
  } = $props();

  const modulePromise = $derived(isStarterModuleId(appId) ? loadStarterModule(appId) : null);
</script>

{#if modulePromise}
  {#await modulePromise}
    <section class="desktop-loading-shell surface-card">
      <p class="text-sm font-medium text-[var(--muted)]">Loading Genesis app…</p>
    </section>
  {:then module}
    <module.default />
    <LaunchReadyReporter moduleId={appId} />
  {:catch}
    <section class="starter-app-not-found surface-card">
      <h2>App failed to load</h2>
      <p>The selected Genesis app module could not be mounted.</p>
    </section>
    <LaunchReadyReporter moduleId={appId} />
  {/await}
{:else}
  <section class="starter-app-not-found surface-card">
    <h2>App not found</h2>
    <p>The requested Genesis mini-app is not registered in this shell.</p>
  </section>
  <LaunchReadyReporter moduleId={appId} />
{/if}
