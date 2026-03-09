/**
 * Dodo Payments Client Service
 *
 * Client-side counterpart to api/dodo.ts.
 * This service does NOT hold the Dodo API key — all sensitive operations
 * go through the server-side API route:
 *   dodoService.ts → /api/dodo-checkout
 */

import { authenticatedFetch } from './api/authenticatedFetch';
import type { DodoPlan } from '../config/dodoPricing';

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
    const rawError = await response.text();
    let message = `Dodo checkout failed (${response.status})`;

    if (rawError) {
      try {
        const errorData = JSON.parse(rawError) as { message?: string };
        if (errorData.message) {
          message = errorData.message;
        }
      } catch {
        if (!rawError.trim().startsWith('<')) {
          message = rawError.trim().slice(0, 300);
        }
      }
    }

    throw new Error(message);
  }

  const data: DodoCheckoutResponse = await response.json();

  if (!data.checkout_url) {
    throw new Error('No checkout URL returned from Dodo');
  }

  return data.checkout_url;
}
