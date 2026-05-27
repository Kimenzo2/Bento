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
  core_monthly: 'CREATOR',
  core_yearly: 'CREATOR',
  pro_monthly: 'STUDIO',
  pro_yearly: 'STUDIO',
  power_monthly: 'EMPIRE',
  power_yearly: 'EMPIRE',
  creator_monthly: 'CREATOR',
  creator_yearly: 'CREATOR',
  studio_monthly: 'STUDIO',
  studio_yearly: 'STUDIO',
  empire_monthly: 'EMPIRE',
  empire_yearly: 'EMPIRE',
} as const;

export type DodoPlan = keyof typeof DODO_PLANS;
export type DodoBillingInterval = 'monthly' | 'yearly';

export const supportsAnnualDodoBilling = import.meta.env.VITE_DODO_ANNUAL_ENABLED === 'true';

/** Map a DodoPlan key to a UserTier */
export function dodoPlanToTier(plan: DodoPlan): UserTier {
  const tierName = DODO_PLANS[plan];
  return tierName as UserTier;
}

export function tierToDodoPlan(
  tier: UserTier,
  interval: DodoBillingInterval = 'monthly'
): DodoPlan | null {
  const normalizedInterval =
    interval === 'yearly' && supportsAnnualDodoBilling ? 'yearly' : 'monthly';

  switch (tier) {
    case UserTier.CREATOR:
      return normalizedInterval === 'yearly' ? 'core_yearly' : 'core_monthly';
    case UserTier.STUDIO:
      return normalizedInterval === 'yearly' ? 'pro_yearly' : 'pro_monthly';
    case UserTier.EMPIRE:
      return normalizedInterval === 'yearly' ? 'power_yearly' : 'power_monthly';
    default:
      return null;
  }
}
