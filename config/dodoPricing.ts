/**
 * Dodo Payments — Plan Configuration
 *
 * Plan keys used client-side. The actual product IDs are resolved
 * server-side from DODO_PRODUCT_ID_* env vars (see api/dodo.ts),
 * so this file does NOT need to change between test and live mode.
 *
 * These plan keys map 1:1 to the tiers in services/tierLimits.ts and types.ts UserTier.
 */

import { UserTier } from '../types';

/** Available Dodo subscription plans */
export const DODO_PLANS = {
  creator_monthly: 'CREATOR',
  studio_monthly: 'STUDIO',
  empire_monthly: 'EMPIRE',
} as const;

export type DodoPlan = keyof typeof DODO_PLANS;

/** Map a DodoPlan key to a UserTier */
export function dodoPlanToTier(plan: DodoPlan): UserTier {
  const tierName = DODO_PLANS[plan];
  return tierName as UserTier;
}
