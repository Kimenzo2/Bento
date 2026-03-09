/**
 * Dodo Payments Client Service
 *
 * Client-side counterpart to api/dodo.ts.
 * This service does NOT hold the Dodo API key — all sensitive operations
 * go through the server-side API route, matching the Paystack architecture:
 *   paystackService.ts → /api/paystack-charge, /api/paystack-verify
 *   dodoService.ts     → /api/dodo-checkout
 *
 * DO NOT import or modify paystackService.ts from here.
 */

import { authenticatedFetch } from './api/authenticatedFetch';
import type { DodoPlan } from '../config/dodoPricing';

// ── CHECKOUT ────────────────────────────────────────────────────────────────────

interface DodoCheckoutParams {
  plan: DodoPlan;
  email: string;
  name: string;
  userId: string;
}

interface DodoCheckoutResponse {
  checkout_url: string;
}

/**
 * Create a Dodo Payments checkout session via server-side API route.
 * The server creates the session with the Dodo SDK (bearer token stays server-side).
 * Returns the checkout URL for redirect.
 */
export async function createDodoCheckout(params: DodoCheckoutParams): Promise<string> {
  const response = await authenticatedFetch('/api/dodo-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Checkout request failed' }));
    throw new Error(errorData.message || `Dodo checkout failed (${response.status})`);
  }

  const data: DodoCheckoutResponse = await response.json();

  if (!data.checkout_url) {
    throw new Error('No checkout URL returned from Dodo');
  }

  return data.checkout_url;
}
