<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { goto } from "@mateothegreat/svelte5-router";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { authStore } from "$lib/stores/auth.store";
  import { openExternal } from "$lib/desktop/open-external";
  import { time } from "$lib/utils/time";
  import { trackPageView, trackEvent } from "$lib/ipc";

  let _t = $derived.by(() => createTranslator($activeBundle));

  const canUseTauri = browser && isTauri();

  type BillingPeriod = "monthly" | "yearly";
  type TierName = "free" | "core" | "pro" | "power";

  type BillingProfile = {
    billingTier: string;
    userTier: string;
    hasActiveSubscription: boolean;
    subscriptionEndDate: string | null;
    cancelAtPeriodEnd: boolean | null;
  } | null;

  let billingPeriod = $state<BillingPeriod>("monthly");
  let processingPlan = $state<string | null>(null);
  let openingBillingPortal = $state(false);
  let refreshingBilling = $state(false);
  let refreshFeedback = $state<{ ok: boolean; msg: string } | null>(null);
  let showActivationDialog = $state(false);
  let finalizing = $state(false);
  let finalizeError = $state<string | null>(null);
  let finalizeDisplayName = $state("");
  let finalizationPending = $state(false);
  let downgradeTarget = $state<(typeof tiers)[number] | null>(null);
  let billingProfile = $state<BillingProfile>(null);
  let errorMsg = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let pollingTargetTier: string | null = null;

  function showError(msg: string) {
    if (errorTimer) clearTimeout(errorTimer);
    errorMsg = msg;
    errorTimer = setTimeout(() => { errorMsg = null; }, 8000);
  }

  const tierOrder: Record<TierName, number> = {
    free: 0,
    core: 1,
    pro: 2,
    power: 3,
  };

  const tiers = [
    {
      key: "core" as const,
      name: "Core",
      description: "The essentials for a calm, focused workflow.",
      price: { monthly: "$9", yearly: "$90" },
      period: { monthly: "/mo", yearly: "/yr" },
      accent: "var(--foreground)",
      summary: "Five anchor apps",
      features: [
        "Tasks, Notes, Journal, Password Vault, Budget",
        "Local-first desktop experience",
        "No AI features",
        "Best for focused personal use",
      ],
      planCodes: { monthly: "core_monthly", yearly: "core_yearly" },
    },
    {
      key: "pro" as const,
      name: "Pro",
      description: "For people using Bento across work, study, and daily routines.",
      price: { monthly: "$19", yearly: "$180" },
      period: { monthly: "/mo", yearly: "/yr" },
      accent: "var(--foreground)",
      summary: "All 17 apps",
      features: [
        "All 17 apps",
        "Sync across devices (Coming soon)",
        "Basic AI features",
        "Desktop-first continuity",
      ],
      planCodes: { monthly: "pro_monthly", yearly: "pro_yearly" },
      badge: "Most popular",
    },
    {
      key: "power" as const,
      name: "Power",
      description: "For heavy users who want the full Bento experience.",
      price: { monthly: "$29", yearly: "$270" },
      period: { monthly: "/mo", yearly: "/yr" },
      accent: "var(--foreground)",
      summary: "Everything unlocked",
      features: [
        "All 17 apps",
        "Unlimited devices",
        "Advanced AI intelligence layer",
        "Priority support and early access",
      ],
      planCodes: { monthly: "power_monthly", yearly: "power_yearly" },
    },
  ];

  function normalizeTier(value: string | null | undefined): TierName {
    const lower = (value ?? "free").trim().toLowerCase();
    if (lower === "core" || lower === "pro" || lower === "power") return lower;
    return "free";
  }

  const currentTier = $derived(normalizeTier(billingProfile?.billingTier));
  const currentTierRank = $derived(tierOrder[currentTier]);
  const desktopAccountEmail = $derived(($authStore.user?.email ?? "").trim());
  const currentPlanLabel = $derived(
    currentTier === "free" ? _t('pricingFree') : currentTier.charAt(0).toUpperCase() + currentTier.slice(1)
  );
  const currentPlanStatus = $derived.by(() => {
    if (!billingProfile) return _t('pricingNotActive');
    if (finalizationPending) return _t('pricingPendingActivation') || "Pending activation";
    if (!billingProfile.hasActiveSubscription) return _t('pricingNotActive');
    if (billingProfile.cancelAtPeriodEnd && billingProfile.subscriptionEndDate) {
      return _t('pricingCancelsOn').replace('{date}', time.formatDate(time.parseISO(billingProfile.subscriptionEndDate), 'MMMM D, YYYY'));
    }
    return "active";
  });
  const downgradeEffectiveDate = $derived.by(() => {
    if (billingProfile?.cancelAtPeriodEnd && billingProfile.subscriptionEndDate) {
      return time.formatDate(time.parseISO(billingProfile.subscriptionEndDate), 'MMMM D, YYYY');
    }

    return null;
  });

  function applyBillingProfile(profile: any) {
    billingProfile = {
      billingTier: profile.billingTier,
      userTier: profile.userTier,
      hasActiveSubscription: profile.hasActiveSubscription,
      subscriptionEndDate: profile.subscriptionEndDate,
      cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
    };
    // Anytype finalization pattern: if payment succeeded but setup is incomplete,
    // show the activation dialog automatically (like Anytype's membershipActivation popup).
    finalizationPending = profile.requiresFinalization ?? profile.requires_finalization ?? false;
    if (finalizationPending) {
      finalizeDisplayName = profile.displayName || profile.display_name || "";
      showActivationDialog = true;
    }
  }

  async function loadBillingProfile() {
    if (!canUseTauri) return;
    try {
      const profile = await invoke<any>("get_billing_profile_cached");
      applyBillingProfile(profile);
    } catch {
      billingProfile = null;
    }
  }

  async function forceRefreshBilling() {
    if (!canUseTauri || refreshingBilling) return;
    refreshingBilling = true;
    if (refreshFeedbackTimer) clearTimeout(refreshFeedbackTimer);
    refreshFeedback = null;
    try {
      await invoke("force_refresh_billing");
      // Profile updated via 'billing:status-changed' event
      refreshFeedback = { ok: true, msg: "Synced" };
    } catch (error) {
      const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "Refresh failed";
      refreshFeedback = { ok: false, msg };
    } finally {
      refreshingBilling = false;
      refreshFeedbackTimer = setTimeout(() => {
        refreshFeedback = null;
      }, 4000);
    }
  }

  let unlistenBilling: (() => void) | null = null;

  onMount(() => {
    trackPageView("pricing");
    void loadBillingProfile();

    // Listen for real-time billing updates from Rust backend (Anytype event pattern).
    // Anytype: frontend subscribes to eventSender.Broadcast() events via middleware.
    // Here we listen for Tauri 'billing:status-changed' emitted by the Rust backend.
    if (canUseTauri) {
      listen<any>('billing:status-changed', (event) => {
        applyBillingProfile(event.payload);
      }).then((unlisten) => {
        unlistenBilling = unlisten;
      });
    }
  });

  $effect(() => {
    const tier = billingProfile?.billingTier;
    if (tier && pollingTargetTier && normalizeTier(tier) === pollingTargetTier && tierOrder[normalizeTier(tier)] >= tierOrder[pollingTargetTier]) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (pollTimeoutTimer) {
        clearTimeout(pollTimeoutTimer);
        pollTimeoutTimer = null;
      }
      pollingTargetTier = null;
    }
  });

  onDestroy(() => {
    unlistenBilling?.();
    if (refreshFeedbackTimer) clearTimeout(refreshFeedbackTimer);
    if (errorTimer) clearTimeout(errorTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (pollTimeoutTimer) clearTimeout(pollTimeoutTimer);
  });

  async function handleFinalize() {
    if (!canUseTauri || finalizing) return;
    finalizing = true;
    finalizeError = null;
    try {
      // Update display name first (Anytype: complete setup before activation).
      // This mirrors Anytype's activation.tsx onSubmit → MembershipCodeRedeem pattern
      // where the user completes their profile before the subscription is activated.
      if (finalizeDisplayName.trim().length > 0) {
        try {
          await invoke("update_display_name", { displayName: finalizeDisplayName.trim() });
        } catch (e) {
          // Non-blocking: continue with activation even if name update fails
          console.warn("Display name update failed:", e);
        }
      }

      await invoke("finalize_subscription");
      // Profile updates via 'billing:status-changed' event
      showActivationDialog = false;
    } catch (error) {
      const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "Activation failed";
      finalizeError = msg;
    } finally {
      finalizing = false;
    }
  }

  async function handleChoose(tier: (typeof tiers)[number]) {
    const targetRank = tierOrder[tier.key];

    if (targetRank <= currentTierRank) {    await handleManageBilling();
    return;
  }

    // ── LogRocket: track upgrade attempt (forced error on failure) ──
    trackEvent("pricing", "upgrade_clicked", {
      tier: tier.key,
      planName: tier.name,
      billingPeriod,
      currentTier,
      currentTierRank,
      targetRank,
    });

    const planCode = billingPeriod === "yearly" ? tier.planCodes.yearly : tier.planCodes.monthly;
    const pricingBase = import.meta.env.DEV ? "http://localhost:3000/pricing" : "https://iamazeyou.me/pricing";
    const emailParam = desktopAccountEmail ? `&email=${encodeURIComponent(desktopAccountEmail)}` : "";
    let countryParam = "";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz.indexOf('/') > 0) {
        const city = tz.split('/')[1];
        const africaMap: Record<string, string> = { Nairobi: 'KE', Lagos: 'NG', Accra: 'GH', Abidjan: 'CI', Johannesburg: 'ZA', Cairo: 'EG', Casablanca: 'MA', Tunis: 'TN', Algiers: 'DZ', Khartoum: 'SD', Addis_Ababa: 'ET', Dar_es_Salaam: 'TZ', Kampala: 'UG', Kigali: 'RW', Maputo: 'MZ', Luanda: 'AO', Douala: 'CM', Dakar: 'SN', Harare: 'ZW' };
        const detected = africaMap[city];
        if (detected) countryParam = `&country=${detected}`;
      }
    } catch {}
    const upgradeUrl = `${pricingBase}?plan=${encodeURIComponent(planCode)}&source=desktop${emailParam}${countryParam}`;
    processingPlan = tier.name;

    try {
      await openExternal(upgradeUrl);
      if (canUseTauri) {
        pollingTargetTier = tier.key;
        const poll = () => {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = setInterval(async () => {
            try {
              await invoke("force_refresh_billing");
            } catch { /* polling silently */ }
          }, 5000);
        };
        poll();
        pollTimeoutTimer = setTimeout(() => {
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          pollingTargetTier = null;
        }, 600_000);
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      // ── Forced LogRocket error: Upgrade failure generates a real error event ──
      const lrError = new Error(`UPGRADE_FAILED: ${tier.key} ${billingPeriod} — ${error instanceof Error ? error.message : String(error)}`);
      trackEvent("pricing", "upgrade_error", {
        tier: tier.key,
        billingPeriod,
        error: error instanceof Error ? error.message : String(error),
      });
      // Force LogRocket to capture as a real exception for instrumentation purposes
      const LR = (window as any).__LR;
      LR?.captureException?.(lrError, { extra: { tier: tier.key, billingPeriod, currentTier } });
      const msg =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Checkout failed. Check console for details.";
      showError(msg);
    } finally {
      processingPlan = null;
    }
  }

  // Billing is web-owned so no payment provider secrets or checkout initialization
  // live in the desktop app.
  async function handleManageBilling() {
    if (openingBillingPortal) return;
    trackEvent("pricing", "manage_billing");
    openingBillingPortal = true;
    try {
      await openExternal(import.meta.env.DEV ? "http://localhost:3000/pricing" : "https://iamazeyou.me/pricing");
      trackEvent("pricing", "manage_billing_opened");
    } catch (error) {
      console.error("Billing portal failed:", error);
      trackEvent("pricing", "manage_billing_error", { error: String(error) });
      const msg =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Billing portal failed.";
      showError(msg);
    } finally {
      openingBillingPortal = false;
    }
  }

  function ctaLabel(tier: (typeof tiers)[number]) {
    const targetRank = tierOrder[tier.key];
    if (targetRank === currentTierRank) return _t('pricingCurrentPlanBtn');
    if (targetRank < currentTierRank) return _t('pricingDowngradingTo').replace('{name}', tier.name);
    return _t('pricingUpgradingTo').replace('{name}', tier.name);
  }

  function openDowngradeModal(tier: (typeof tiers)[number]) {
    downgradeTarget = tier;
  }

  async function confirmDowngrade() {
    if (!downgradeTarget) {
      return;
    }

    downgradeTarget = null;
    await handleManageBilling();
  }
</script>

<section class="pricing-shell">
  <header class="pricing-shell__hero">
    <div class="pricing-shell__eyebrow">{_t('pricingDesktopBilling')}</div>
    <div class="pricing-shell__hero-grid">
      <div class="pricing-shell__hero-copy">
        <h1 class="pricing-shell__title">{_t('pricingTitle')}</h1>
        <p class="pricing-shell__subtitle">
          {_t('pricingSubtitle')}
        </p>
      </div>

      <Card class="pricing-shell__current">
        <CardHeader class="pricing-shell__current-header">
          <CardDescription class="pricing-shell__current-kicker">{_t('pricingCurrentPlan')}</CardDescription>
          <CardTitle class="pricing-shell__current-title">{currentPlanLabel}</CardTitle>
          <p class="pricing-shell__current-status">
            {currentPlanStatus}
            {#if finalizationPending}
              <span class="pricing-shell__pending-badge">{_t('pricingActivateNow') || "Activate now"}</span>
            {/if}
          </p>
        </CardHeader>
        <CardContent class="pricing-shell__current-content">
          <div class="pricing-shell__current-actions">
            <button
              class="pricing-shell__refresh-btn"
              onclick={() => void forceRefreshBilling()}
              disabled={refreshingBilling}
              title="Force refresh billing status"
              aria-label="Refresh billing status"
            >
              {#if refreshingBilling}
                <svg class="pricing-shell__refresh-icon pricing-shell__refresh-icon--spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              {:else}
                <svg class="pricing-shell__refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              {/if}
            </button>
            {#if refreshFeedback}
              <span
                class="pricing-shell__refresh-feedback"
                class:pricing-shell__refresh-feedback--ok={refreshFeedback.ok}
                class:pricing-shell__refresh-feedback--err={!refreshFeedback.ok}
                role="status"
              >
                {refreshFeedback.msg}
              </span>
            {/if}
            <Button class="pricing-shell__account-btn" variant="outline" onclick={() => void goto("/settings")}>
              {_t('pricingAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </header>

  {#if errorMsg}
    <div class="pricing-shell__error" role="alert">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="pricing-shell__error-icon">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
        <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        <circle cx="8" cy="10.5" r="0.65" fill="currentColor" />
      </svg>
      <span>{errorMsg}</span>
      <button class="pricing-shell__error-dismiss" onclick={() => (errorMsg = null)} aria-label="Dismiss">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  {/if}

  <div class="pricing-shell__toggle-wrap">
    <div class="pricing-shell__toggle">
      <button
        class="pricing-shell__toggle-btn"
        class:pricing-shell__toggle-btn--active={billingPeriod === "monthly"}
        onclick={() => (billingPeriod = "monthly")}
      >
        {_t('pricingMonthly')}
      </button>
      <button
        class="pricing-shell__toggle-btn"
        class:pricing-shell__toggle-btn--active={billingPeriod === "yearly"}
        onclick={() => (billingPeriod = "yearly")}
      >
        {_t('pricingYearly')}
      </button>
    </div>
  </div>

  <div class="pricing-shell__grid">
    {#each tiers as tier, index}
      <Card class={`pricing-shell__card${index === 1 ? " pricing-shell__card--featured" : ""}`}>

        <CardHeader class="pricing-shell__card-header">
          <div class="pricing-shell__icon" style={`--card-accent:${tier.accent};`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l2.7 6.2L21 11l-6.3 2.8L12 20l-2.7-6.2L3 11l6.3-2.8L12 2z" />
            </svg>
          </div>
          <CardTitle class="pricing-shell__card-title">{tier.name}</CardTitle>
          {#if tier.badge}
            <span class="pricing-shell__badge">{tier.badge}</span>
          {/if}
          <CardDescription class="pricing-shell__card-desc">{tier.description}</CardDescription>
        </CardHeader>
        <CardContent class="pricing-shell__card-content">
          <div class="pricing-shell__price">
            <span class="pricing-shell__price-value">{tier.price[billingPeriod]}</span>
            <span class="pricing-shell__price-period">{tier.period[billingPeriod]}</span>
          </div>
          <div class="pricing-shell__summary">{tier.summary}</div>
          <ul class="pricing-shell__features">
            {#each tier.features as feature}
              <li class="pricing-shell__feature">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>{feature}</span>
              </li>
            {/each}
          </ul>

          <Button
            class="pricing-shell__cta"
            style="width: 100%; min-height: 3.35rem; border-radius: 1.15rem; border-color: transparent; background: var(--foreground); color: var(--background); box-shadow: none; opacity: 1;"
            variant="outline"
            disabled={processingPlan === tier.name || ctaLabel(tier) === "Current plan"}
            onclick={() =>
              ctaLabel(tier).startsWith("Downgrade")
                ? openDowngradeModal(tier)
                : void handleChoose(tier)}
          >
            {#if processingPlan === tier.name}
              {_t('pricingOpeningBrowser')}
            {:else}
              {ctaLabel(tier)}
            {/if}
          </Button>
        </CardContent>
      </Card>
    {/each}
  </div>
</section>

<Dialog.Root
  open={Boolean(downgradeTarget)}
  onOpenChange={(nextOpen) => {
    if (!nextOpen) {
      downgradeTarget = null;
    }
  }}
>
  <Dialog.Content class="max-w-xl rounded-[28px] border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[var(--surface)]">
    <Dialog.Header>
      <Dialog.Title class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        {_t('pricingDowngradeTitle').replace('{name}', downgradeTarget?.name ?? '')}
      </Dialog.Title>
      <Dialog.Description class="text-[var(--muted)]">
        {#if downgradeEffectiveDate}
          {_t('pricingDowngradeActiveUntil').replace('{date}', downgradeEffectiveDate).replace('{plan}', downgradeTarget?.name ?? '')}
        {:else}
          {_t('pricingDowngradeOpenPortal')}
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-3 rounded-3xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4 text-sm text-[var(--muted)]">
      <p>
        <span class="font-semibold text-[var(--foreground)]">{_t('pricingDowngradeCurrentPlan')}</span>
        {currentPlanLabel}
      </p>
      <p>
        <span class="font-semibold text-[var(--foreground)]">{_t('pricingDowngradeTargetPlan')}</span>
        {downgradeTarget?.name}
      </p>
      <p>
        <span class="font-semibold text-[var(--foreground)]">{_t('pricingDowngradeBillingState')}</span>
        {billingProfile?.cancelAtPeriodEnd ? _t('pricingCancelScheduled') : _t('pricingWillSchedule')}
      </p>
    </div>

    <Dialog.Footer class="gap-3">
      <Button class="rounded-full px-4" variant="outline" onclick={() => (downgradeTarget = null)}>
        {_t('pricingKeepCurrentPlan')}
      </Button>
      <Button class="rounded-full px-4" onclick={() => void confirmDowngrade()}>
        {openingBillingPortal ? _t('pricingOpeningBilling') : _t('pricingContinueBilling')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Anytype activation/finalization dialog pattern: after payment success,
     user must complete setup before full activation. This mirrors Anytype's
     PopupMembershipActivation component. -->
<Dialog.Root
  open={showActivationDialog}
  onOpenChange={(nextOpen) => {
    if (!nextOpen && !finalizing) {
      showActivationDialog = false;
    }
  }}
>
  <Dialog.Content class="max-w-xl rounded-[28px] border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[var(--surface)]">
    <Dialog.Header>
      <div class="activation-shell__icon-wrap">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" class="activation-shell__icon">
          <circle cx="32" cy="32" r="28" stroke="#22c55e" stroke-width="2.5" class="activation-shell__icon-ring" />
          <path d="M20 33l8 8 16-16" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="activation-shell__icon-check" />
        </svg>
      </div>
      <Dialog.Title class="font-[var(--font-heading)] text-2xl text-[var(--foreground)] text-center">
        {_t('pricingActivationTitle') || "Activate Your Subscription"}
      </Dialog.Title>
      <Dialog.Description class="text-[var(--muted)] text-center max-w-md mx-auto">
        {_t('pricingActivationText') || "Payment successful! Complete your setup to activate your subscription."}
      </Dialog.Description>
    </Dialog.Header>

    <div class="activation-shell__body">
      <label class="activation-shell__label" for="activation-name">
        {_t('pricingActivationNameLabel') || "Display name (optional)"}
      </label>
      <input
        id="activation-name"
        type="text"
        class="activation-shell__input"
        bind:value={finalizeDisplayName}
        placeholder={_t('pricingActivationNamePlaceholder') || "Your display name"}
        disabled={finalizing}
        onkeydown={(e) => { if (e.key === 'Enter' && !finalizing) void handleFinalize(); }}
      />

      {#if finalizeError}
        <div class="activation-shell__error" role="alert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="activation-shell__error-icon">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <circle cx="8" cy="10.5" r="0.65" fill="currentColor" />
          </svg>
          <span>{finalizeError}</span>
        </div>
      {/if}
    </div>

    <Dialog.Footer class="gap-3">
      <Button
        class="rounded-full px-6 flex-1"
        onclick={() => void handleFinalize()}
        disabled={finalizing}
      >
        {#if finalizing}
          <svg class="activation-shell__btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {_t('pricingActivationActivating') || "Activating..."}
        {:else}
          {_t('pricingActivationActivate') || "Activate"}
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.desktop-workspace--no-sidebar .desktop-workspace__main) {
    overflow-y: scroll !important;
    scrollbar-gutter: stable;
  }

  :global(.desktop-workspace--no-sidebar .desktop-workspace__main > section) {
    min-height: max-content;
  }

  :global(.desktop-workspace--no-sidebar .desktop-workspace__main::-webkit-scrollbar) {
    width: var(--shell-scrollbar-size);
    height: var(--shell-scrollbar-size);
  }

  :global(.desktop-workspace--no-sidebar .desktop-workspace__main::-webkit-scrollbar-track) {
    background: var(--shell-scrollbar-track);
  }

  :global(.desktop-workspace--no-sidebar .desktop-workspace__main::-webkit-scrollbar-thumb) {
    border: 0.08rem solid transparent;
    border-radius: 999px;
    background: var(--shell-scrollbar-thumb);
    background-clip: content-box;
    min-height: 3rem;
  }

  :global(.desktop-workspace--no-sidebar .desktop-workspace__main:hover::-webkit-scrollbar-thumb) {
    background: var(--shell-scrollbar-thumb-hover);
    background-clip: content-box;
  }

  .pricing-shell {
    display: grid;
    gap: 2rem;
    width: min(100%, 112rem);
    margin: 0 auto;
    padding: 1rem clamp(2rem, 3.8vw, 4rem) 8rem;
    min-height: max-content;
    box-sizing: border-box;
  }

  .pricing-shell__eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .pricing-shell__hero {
    display: grid;
    gap: 1.25rem;
  }

  .pricing-shell__hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.8fr);
    gap: clamp(1.75rem, 2.8vw, 3rem);
    align-items: start;
  }

  .pricing-shell__hero-copy {
    display: grid;
    gap: 0.8rem;
  }

  .pricing-shell__title {
    margin: 0;
    max-width: 18ch;
    font-family: var(--font-heading);
    font-size: clamp(2rem, 3.2vw, 3.8rem);
    font-weight: 650;
    line-height: 1.02;
    letter-spacing: -0.04em;
    color: var(--foreground);
  }

  .pricing-shell__subtitle {
    max-width: 56ch;
    margin: 0;
    font-size: 1rem;
    line-height: 1.55;
    color: var(--muted);
  }

  .pricing-shell__current {
    min-height: 12rem;
    border-radius: 2rem;
    border: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
  }

  .pricing-shell__current-header {
    display: grid;
    gap: 0.45rem;
    padding: 1.25rem 1.35rem 0;
  }

  .pricing-shell__current-kicker {
    font-size: 0.72rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .pricing-shell__current-title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: clamp(2rem, 3vw, 2.6rem);
    font-weight: 500;
    letter-spacing: -0.05em;
  }

  .pricing-shell__current-status {
    margin: 0.25rem 0 0;
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .pricing-shell__current-content {
    padding: 1.5rem 1.35rem 1.3rem;
  }

  .pricing-shell__current-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    justify-content: flex-end;
  }

  .pricing-shell__refresh-btn {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex: 0 0 auto;
    padding: 0;
  }

  .pricing-shell__refresh-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--border) 18%, transparent);
    color: var(--foreground);
  }

  .pricing-shell__refresh-btn:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .pricing-shell__refresh-icon {
    width: 1rem;
    height: 1rem;
    display: block;
    transition: transform 0.2s ease;
  }

  .pricing-shell__refresh-icon--spin {
    animation: refresh-spin 0.8s linear infinite;
  }

  @keyframes refresh-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .pricing-shell__refresh-feedback {
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
    animation: feedback-in 0.2s ease-out;
  }

  .pricing-shell__refresh-feedback--ok {
    color: #22c55e;
  }

  .pricing-shell__refresh-feedback--err {
    color: #ef4444;
  }

  @keyframes feedback-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .pricing-shell__account-btn {
    min-width: 9rem;
  }

  .pricing-shell__error {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1.1rem;
    border-radius: 1rem;
    background: color-mix(in srgb, #ef4444 12%, transparent);
    border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
    color: #ef4444;
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.45;
    animation: error-in 0.2s ease-out;
  }

  @keyframes error-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .pricing-shell__error-icon {
    width: 1.1rem;
    height: 1.1rem;
    flex: 0 0 auto;
  }

  .pricing-shell__error-dismiss {
    margin-left: auto;
    flex: 0 0 auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;
    padding: 0.15rem;
  }

  .pricing-shell__error-dismiss:hover {
    opacity: 1;
  }

  .pricing-shell__error-dismiss svg {
    width: 1rem;
    height: 1rem;
    display: block;
  }

  .pricing-shell__toggle-wrap {
    display: flex;
    justify-content: flex-start;
  }

  .pricing-shell__toggle {
    display: inline-flex;
    border-radius: 9999px;
    padding: 0.25rem;
    background: color-mix(in srgb, var(--surface) 95%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 58%, transparent);
  }

  .pricing-shell__toggle-btn {
    border: 0;
    border-radius: 9999px;
    padding: 0.8rem 1.25rem;
    background: transparent;
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
  }

  .pricing-shell__toggle-btn--active {
    background: color-mix(in srgb, var(--foreground) 92%, var(--accent) 8%);
    color: var(--background);
  }

  .pricing-shell__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(1.5rem, 2vw, 2.2rem);
    align-items: stretch;
  }

  .pricing-shell__card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 36rem;
    height: 100%;
    border-radius: 2rem;
    border: none;
    background: color-mix(in srgb, var(--surface) 94%, transparent);
  }

.pricing-shell__card-header {
    display: grid;
    gap: 0.6rem;
    padding: 1.4rem 1.35rem 0;
  }

  .pricing-shell__icon {
    width: 3rem;
    height: 3rem;
    border-radius: 1rem;
    display: grid;
    place-items: center;
    color: color-mix(in srgb, var(--card-accent) 100%, white 0%);
    background: color-mix(in srgb, var(--card-accent) 18%, transparent);
  }

  .pricing-shell__icon svg {
    width: 1.2rem;
    height: 1.2rem;
  }

  .pricing-shell__card-title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: clamp(2rem, 2.4vw, 3rem);
    font-weight: 500;
    letter-spacing: -0.05em;
  }

  .pricing-shell__badge {
    display: inline-block;
    width: fit-content;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--primary);
    color: var(--primary-foreground);
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  .pricing-shell__card-desc {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }

  .pricing-shell__card-content {
    display: grid;
    flex: 1;
    grid-template-rows: auto auto auto 1fr auto;
    gap: 0.95rem;
    padding: 1rem 1.35rem 1.4rem;
  }

  .pricing-shell__price {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
  }

  .pricing-shell__price-value {
    font-family: var(--font-heading);
    font-size: clamp(2.4rem, 3vw, 3.2rem);
    font-weight: 500;
    letter-spacing: -0.05em;
  }

  .pricing-shell__price-period {
    color: var(--muted);
    font-size: 1rem;
  }

  .pricing-shell__summary {
    color: var(--foreground);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .pricing-shell__features {
    display: grid;
    gap: 0.85rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .pricing-shell__feature {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    color: var(--muted);
    line-height: 1.45;
  }

  .pricing-shell__feature svg {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
    margin-top: 0.2rem;
    color: var(--foreground);
  }

  .pricing-shell__cta {
    margin-top: 0.25rem;
    font-weight: 700;
  }

  @media (max-width: 1200px) {
    .pricing-shell__hero-grid {
      grid-template-columns: 1fr;
    }

    .pricing-shell__grid {
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    }
  }

  @media (max-width: 900px) {
    .pricing-shell {
      width: min(100%, 100rem);
      padding-inline: 1.1rem;
    }

    .pricing-shell__title {
      max-width: 14ch;
      font-size: clamp(2.35rem, 9vw, 4.25rem);
    }

    .pricing-shell__subtitle {
      max-width: 100%;
    }
  }

  /* ── Activation / Finalization Dialog (Anytype pattern) ── */
  .activation-shell__icon-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .activation-shell__icon {
    width: 4rem;
    height: 4rem;
  }

  .activation-shell__icon-ring {
    animation: activation-ring-in 0.5s ease-out;
  }

  .activation-shell__icon-check {
    animation: activation-check-in 0.6s 0.15s ease-out both;
  }

  @keyframes activation-ring-in {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes activation-check-in {
    from { opacity: 0; stroke-dasharray: 40; stroke-dashoffset: 40; }
    to   { opacity: 1; stroke-dasharray: 40; stroke-dashoffset: 0; }
  }

  .activation-shell__body {
    display: grid;
    gap: 0.6rem;
    padding: 0 0.5rem;
  }

  .activation-shell__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .activation-shell__input {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    border: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    color: var(--foreground);
    font-size: 0.95rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    box-sizing: border-box;
  }

  .activation-shell__input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .activation-shell__input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .activation-shell__error {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.7rem 0.9rem;
    border-radius: 0.85rem;
    background: color-mix(in srgb, #ef4444 12%, transparent);
    border: 1px solid color-mix(in srgb, #ef4444 28%, transparent);
    color: #ef4444;
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.4;
    animation: error-in 0.2s ease-out;
  }

  .activation-shell__error-icon {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
  }

  .activation-shell__btn-spinner {
    width: 1rem;
    height: 1rem;
    animation: refresh-spin 0.8s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 0.35rem;
  }

  .pricing-shell__pending-badge {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.15rem 0.55rem;
    border-radius: 9999px;
    background: color-mix(in srgb, #f59e0b 20%, transparent);
    color: #f59e0b;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    vertical-align: middle;
    animation: badge-pulse 2s ease-in-out infinite;
  }

  @keyframes badge-pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.6; }
  }
</style>
