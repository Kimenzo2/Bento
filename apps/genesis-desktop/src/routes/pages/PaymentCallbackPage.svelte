<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { goto } from "@mateothegreat/svelte5-router";
  import { sanitizeError } from "$lib/utils/logger";

  const canUseTauri = browser && isTauri();

  type CallbackState =
    | { status: "syncing" }
    | { status: "ready" }
    | { status: "error"; message: string };

  let state = $state<CallbackState>({ status: "syncing" });

  onMount(() => {
    if (!canUseTauri) {
      state = { status: "ready" };
      return;
    }

    void refreshBilling();
  });

  async function refreshBilling() {
    try {
      await invoke("force_refresh_billing");
      state = { status: "ready" };
    } catch (error) {
      const raw =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not refresh subscription status.";
      state = { status: "error", message: sanitizeError(raw) };
    }
  }

  function goToPricing() {
    void goto("/pricing");
  }
</script>

<section class="payment-callback-shell">
  <div class="payment-callback-shell__card">
    {#if state.status === "syncing"}
      <svg class="payment-callback-shell__spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <h1 class="payment-callback-shell__title">Syncing subscription</h1>
      <p class="payment-callback-shell__desc">
        Bento is checking your account for the latest plan. Payment confirmation is handled securely on the web.
      </p>
    {:else if state.status === "ready"}
      <svg class="payment-callback-shell__check-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="28" stroke="oklch(0.723 0.192 149.579)" stroke-width="2.5" class="payment-callback-shell__icon-ring" />
        <path d="M20 33l8 8 16-16" stroke="oklch(0.723 0.192 149.579)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="payment-callback-shell__icon-check" />
      </svg>
      <h1 class="payment-callback-shell__title">Subscription sync requested</h1>
      <p class="payment-callback-shell__desc">
        If payment is complete, your plan will update automatically once the payment is confirmed.
      </p>
      <button class="payment-callback-shell__btn" onclick={goToPricing}>
        Back to Pricing
      </button>
    {:else}
      <svg class="payment-callback-shell__error-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
        <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        <circle cx="8" cy="10.5" r="0.65" fill="currentColor" />
      </svg>
      <h1 class="payment-callback-shell__title">Sync delayed</h1>
      <p class="payment-callback-shell__desc">{state.message}</p>
      <p class="payment-callback-shell__hint">
        Your payment can still complete. Reopen Pricing after a moment to refresh your plan.
      </p>
      <button class="payment-callback-shell__btn" onclick={goToPricing}>
        Check Subscription
      </button>
    {/if}
  </div>
</section>

<style>
  .payment-callback-shell {
    display: grid;
    place-items: center;
    min-height: 80vh;
    padding: 2rem;
    box-sizing: border-box;
  }

  .payment-callback-shell__card {
    display: grid;
    gap: 1rem;
    place-items: center;
    text-align: center;
    max-width: 28rem;
    padding: 3rem 2.5rem;
    border-radius: 2rem;
    border: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
  }

  .payment-callback-shell__spinner {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--accent);
    animation: callback-spin 0.8s linear infinite;
    display: block;
  }

  @keyframes callback-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .payment-callback-shell__title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 1.6rem;
    font-weight: 650;
    letter-spacing: -0.03em;
    color: var(--foreground);
  }

  .payment-callback-shell__desc {
    margin: 0;
    color: var(--muted);
    line-height: 1.55;
    font-size: 0.95rem;
  }

  .payment-callback-shell__hint {
    margin: 0;
    color: color-mix(in srgb, var(--muted) 80%, transparent);
    font-size: 0.85rem;
    line-height: 1.45;
  }

  .payment-callback-shell__btn {
    margin-top: 0.5rem;
    padding: 0.75rem 2rem;
    border-radius: 9999px;
    border: none;
    background: var(--foreground);
    color: var(--background);
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .payment-callback-shell__btn:hover {
    opacity: 0.85;
  }

  .payment-callback-shell__check-icon {
    width: 4rem;
    height: 4rem;
  }

  .payment-callback-shell__icon-ring {
    animation: callback-ring-in 0.5s ease-out;
  }

  .payment-callback-shell__icon-check {
    animation: callback-check-in 0.6s 0.15s ease-out both;
  }

  @keyframes callback-ring-in {
    from { opacity: 0; transform: scale(0.5); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes callback-check-in {
    from { opacity: 0; stroke-dasharray: 40; stroke-dashoffset: 40; }
    to { opacity: 1; stroke-dasharray: 40; stroke-dashoffset: 0; }
  }

  .payment-callback-shell__error-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: oklch(0.637 0.208 25.331);
    display: block;
  }
</style>
