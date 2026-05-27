<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { goto } from "@mateothegreat/svelte5-router";

  const canUseTauri = browser && "__TAURI_INTERNALS__" in window;

  type CallbackState =
    | { status: "verifying" }
    | { status: "success"; tier: string }
    | { status: "error"; message: string };

  let state = $state<CallbackState>({ status: "verifying" });

  onMount(() => {
    if (!canUseTauri) {
      state = { status: "error", message: "Payment callback only works in the desktop app." };
      return;
    }

    // Dodo returns payment_id or subscription_id plus status and plan.
    // Older flows may still pass session_id, so we keep it as a fallback.
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id") || "";
    const subscriptionId = params.get("subscription_id") || "";
    const sessionId = params.get("session_id") || "";
    const status = params.get("status") || "";
    const plan = params.get("plan") || "";
    const reference = paymentId || subscriptionId || sessionId;

    if (!reference) {
      // No payment reference means this wasn't a payment callback — likely a direct nav.
      // Check for local receipt as a fallback.
      void checkLocalReceipt();
      return;
    }

    void handlePaymentCallback(paymentId || sessionId, subscriptionId, status, plan);
  });

  async function handlePaymentCallback(
    paymentId: string,
    subscriptionId: string,
    status: string,
    plan: string
  ) {
    try {
      const receipt = await invoke<any>("handle_payment_callback", {
        paymentId: paymentId || null,
        subscriptionId: subscriptionId || null,
        status: status || null,
        plan: plan || null,
      });
      state = { status: "success", tier: receipt.tier || "pro" };
    } catch (error) {
      const msg = typeof error === "string" ? error
        : error instanceof Error ? error.message
        : "Payment verification failed.";
      state = { status: "error", message: msg };
    }
  }

  async function checkLocalReceipt() {
    try {
      const receipt = await invoke<any | null>("get_payment_receipt");
      if (receipt) {
        state = { status: "success", tier: receipt.tier || "pro" };
      } else {
        state = { status: "error", message: "No payment reference found." };
      }
    } catch {
      state = { status: "error", message: "Could not verify payment status." };
    }
  }

  function goToPricing() {
    void goto("/pricing");
  }
</script>

<section class="payment-callback-shell">
  {#if state.status === "verifying"}
    <div class="payment-callback-shell__card">
      <svg class="payment-callback-shell__spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <h1 class="payment-callback-shell__title">Verifying your payment</h1>
      <p class="payment-callback-shell__desc">
        Confirming your purchase with Dodo Payments…
      </p>
    </div>

  {:else if state.status === "success"}
    <div class="payment-callback-shell__card payment-callback-shell__card--success">
      <svg class="payment-callback-shell__check-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="28" stroke="#22c55e" stroke-width="2.5" class="payment-callback-shell__icon-ring" />
        <path d="M20 33l8 8 16-16" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="payment-callback-shell__icon-check" />
      </svg>
      <h1 class="payment-callback-shell__title">Payment successful!</h1>
      <p class="payment-callback-shell__desc">
        Your <strong class="payment-callback-shell__tier">{state.tier}</strong> plan is now active.
        You can manage your subscription in the pricing page.
      </p>
      <button class="payment-callback-shell__btn" onclick={goToPricing}>
        Go to Pricing
      </button>
    </div>

  {:else if state.status === "error"}
    <div class="payment-callback-shell__card payment-callback-shell__card--error">
      <svg class="payment-callback-shell__error-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" />
        <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        <circle cx="8" cy="10.5" r="0.65" fill="currentColor" />
      </svg>
      <h1 class="payment-callback-shell__title">Payment verification issue</h1>
      <p class="payment-callback-shell__desc">{state.message}</p>
      <p class="payment-callback-shell__hint">
        Your payment may still have gone through. Check your subscription status in the pricing page.
      </p>
      <button class="payment-callback-shell__btn" onclick={goToPricing}>
        Check Subscription
      </button>
    </div>
  {/if}
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
    to   { transform: rotate(360deg); }
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

  .payment-callback-shell__tier {
    text-transform: capitalize;
    color: var(--foreground);
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

  /* ── Success animations ── */
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
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes callback-check-in {
    from { opacity: 0; stroke-dasharray: 40; stroke-dashoffset: 40; }
    to   { opacity: 1; stroke-dasharray: 40; stroke-dashoffset: 0; }
  }

  .payment-callback-shell__error-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: #ef4444;
    display: block;
  }

  .payment-callback-shell__card--error .payment-callback-shell__btn {
    background: var(--foreground);
    color: var(--background);
  }
</style>
