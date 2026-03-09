/**
 * Dodo Payments — Product ID Configuration
 *
 * INSTRUCTIONS: Go to your Dodo Payments Dashboard → Products,
 * copy the product IDs for each Genesis plan, and fill them in below.
 *
 * These IDs map 1:1 to the tiers in services/tierLimits.ts and types.ts UserTier.
 */

import { UserTier } from '../types';

export const DODO_PRODUCT_IDS = {
  creator_monthly: 'pdt_0Na7vkipBcsIMSnwcXTw6', // Creator $19.99/month
  studio_monthly: 'pdt_0Na7vvIAejy2zXu31eC8p',  // Studio  $59.99/month
  empire_monthly: 'pdt_0Na7w84dSW8YMXAV3gcms',  // Empire  $199.99/month
} as const;

export type DodoPlan = keyof typeof DODO_PRODUCT_IDS;

/** Map a Dodo product ID back to a UserTier */
export function dodoProductIdToTier(productId: string): UserTier | null {
  const entry = Object.entries(DODO_PRODUCT_IDS).find(
    ([, id]) => id === productId
  );
  if (!entry) return null;

  const tierName = entry[0].split('_')[0].toUpperCase();
  if (tierName in UserTier) {
    return tierName as UserTier;
  }
  return null;
}

/** Map a DodoPlan key to a UserTier */
export function dodoPlanToTier(plan: DodoPlan): UserTier {
  const tierName = plan.split('_')[0].toUpperCase();
  return tierName as UserTier;
}
