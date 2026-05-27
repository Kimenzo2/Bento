<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "@mateothegreat/svelte5-router";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import LaunchReadyReporter from "$lib/components/LaunchReadyReporter.svelte";
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
  }

  onMount(() => {
    void checkAccess();

    if (!isTauri()) {
      return;
    }

    const timer = window.setInterval(() => {
      const metrics = performance as Performance & {
        memory?: {
          usedJSHeapSize?: number;
        };
      };

      const usedHeapBytes = metrics.memory?.usedJSHeapSize;
      const jsHeapMb = typeof usedHeapBytes === "number" ? usedHeapBytes / 1_048_576 : null;

      void invoke("record_active_js_heap", {
        report: {
          miniAppId: appId,
          jsHeapMb,
        },
      });
    }, 5_000);

    return () => {
      window.clearInterval(timer);
    };
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
  {:catch}
    <section class="starter-app-not-found surface-card">
      <h2>{_t('shellAppFailedToLoad')}</h2>
      <p>{_t('shellAppFailedToLoadDesc')}</p>
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
