<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "@mateothegreat/svelte5-router";
  import { isTauri } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import LaunchReadyReporter from "$lib/components/LaunchReadyReporter.svelte";
  import { hiddenModuleIds } from "$lib/data/module-catalog";
  import { canAccessModuleByPlan } from "$lib/desktop/billing-access";
  import { isStarterModuleId, loadStarterModule } from "$lib/modules/starter-module-registry";
  import { ensureBillingProfile } from "$lib/stores/billing.store";
  import { activeBundle, createTranslator } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));

  let {
    appId,
  }: {
    appId: string;
  } = $props();

  let modulePromise = $state<ReturnType<typeof loadStarterModule> | null>(null);
  let accessChecked = $state(false);
  let accessDenied = $state(false);

  async function checkAccess() {
    accessChecked = true;

    if (!isStarterModuleId(appId)) {
      accessDenied = true;
      return;
    }

    if (hiddenModuleIds.has(appId)) {
      if (browser) await goto("/");
      return;
    }

    if (!browser || !isTauri()) {
      modulePromise = loadStarterModule(appId);
      return;
    }

    const profile = await ensureBillingProfile();
    const allowed = canAccessModuleByPlan(
      profile?.activePlanCode,
      appId,
      profile?.hasActiveSubscription ?? false,
    );

    if (!allowed) {
      accessDenied = true;
      await goto("/pricing");
      return;
    }

    modulePromise = loadStarterModule(appId);
  }  onMount(() => {
    void checkAccess();
  });
</script>

{#if accessDenied}
  <section class="starter-app-not-found surface-card">
    <h2>{_t('shellPlanRequired')}</h2>
    <p>{_t('shellPlanRequiredDesc')}</p>
  </section>
{:else if modulePromise}
  {#await modulePromise}
    <section class="desktop-loading-shell surface-card">
      <p class="text-sm font-medium text-[var(--muted)]">{_t('shellLoadingApp')}</p>
    </section>
  {:then module}
    <module.default />
    <LaunchReadyReporter moduleId={appId} />
  {:catch error}
    {console.error(`[StarterModuleHost] Failed to mount app "${appId}":`, error)}
    <section class="starter-app-not-found surface-card">
      <h2>{_t('shellAppFailedToLoad')}</h2>
      <p>{_t('shellAppFailedToLoadDesc')}</p>
      {#if error instanceof Error}
        <p class="text-xs text-[var(--muted)] mt-2 font-mono">{error.message}</p>
      {/if}
    </section>
    <LaunchReadyReporter moduleId={appId} />
  {/await}
{:else if accessChecked}
  <section class="desktop-loading-shell surface-card">
    <p class="text-sm font-medium text-[var(--muted)]">{_t('shellLoadingApp')}</p>
  </section>
{:else}
  <section class="starter-app-not-found surface-card">
    <h2>{_t('shellAppNotFound')}</h2>
    <p>{_t('shellAppNotFoundDesc')}</p>
  </section>
  <LaunchReadyReporter moduleId={appId} />
{/if}
