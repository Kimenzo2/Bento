/**
 * Tier Entitlements — Single Source of Truth
 *
 * Every tier check in the app reads from this file.
 * Never hardcode tier limits in components — always use
 * getEntitlements() or the useEntitlements() hook.
 */

import { ArtStyle, UserTier } from '../types';

// ── Types ────────────────────────────────────────────────────

export type TierName = 'SPARK' | 'CREATOR' | 'STUDIO' | 'EMPIRE';

export type StyleSet = 'standard' | 'creator' | 'all';

export interface TierEntitlements {
  books_per_month: number; // -1 = unlimited
  pages_per_book: number; // -1 = unlimited
  illustration_styles: number;
  watermark: boolean;
  commercial_license: boolean;
  team_seats: number; // -1 = unlimited
  white_label: boolean;
  brand_hub: boolean;
  video_export: boolean;
  api_access: boolean;
  custom_ai_training: boolean;
  priority_rendering: boolean;
  style_set: StyleSet;
}

// ── Style Sets ───────────────────────────────────────────────

const ALL_STYLES = Object.values(ArtStyle);

const STANDARD_STYLES: ArtStyle[] = [
  ArtStyle.WATERCOLOR,
  ArtStyle.PIXAR_3D,
  ArtStyle.MANGA,
  ArtStyle.VINTAGE,
  ArtStyle.PAPER_CUTOUT,
];

const CREATOR_STYLES: ArtStyle[] = ALL_STYLES.slice(0, 20);

/** Maps style_set names to their concrete ArtStyle arrays */
export const STYLE_SET_MAP: Record<StyleSet, ArtStyle[]> = {
  standard: STANDARD_STYLES,
  creator: CREATOR_STYLES,
  all: ALL_STYLES,
};

// ── Entitlements Table ───────────────────────────────────────

export const TIER_ENTITLEMENTS: Record<TierName, TierEntitlements> = {
  SPARK: {
    books_per_month: 3,
    pages_per_book: 4,
    illustration_styles: 5,
    watermark: true,
    commercial_license: false,
    team_seats: 1,
    white_label: false,
    brand_hub: false,
    video_export: false,
    api_access: false,
    custom_ai_training: false,
    priority_rendering: false,
    style_set: 'standard',
  },
  CREATOR: {
    books_per_month: 30,
    pages_per_book: 12,
    illustration_styles: 20,
    watermark: false,
    commercial_license: true,
    team_seats: 1,
    white_label: false,
    brand_hub: false,
    video_export: false,
    api_access: false,
    custom_ai_training: false,
    priority_rendering: true,
    style_set: 'creator',
  },
  STUDIO: {
    books_per_month: -1,
    pages_per_book: 500,
    illustration_styles: 50,
    watermark: false,
    commercial_license: true,
    team_seats: 5,
    white_label: true,
    brand_hub: true,
    video_export: true,
    api_access: false,
    custom_ai_training: false,
    priority_rendering: true,
    style_set: 'all',
  },
  EMPIRE: {
    books_per_month: -1,
    pages_per_book: -1,
    illustration_styles: 50,
    watermark: false,
    commercial_license: true,
    team_seats: -1,
    white_label: true,
    brand_hub: true,
    video_export: true,
    api_access: true,
    custom_ai_training: true,
    priority_rendering: true,
    style_set: 'all',
  },
};

// ── Tier Ordering (for "minimum tier required" logic) ────────

const TIER_ORDER: TierName[] = ['SPARK', 'CREATOR', 'STUDIO', 'EMPIRE'];

/** Returns the minimum tier that has a given boolean feature enabled. */
export function minimumTierFor(feature: keyof TierEntitlements): TierName {
  for (const tier of TIER_ORDER) {
    const value = TIER_ENTITLEMENTS[tier][feature];
    if (value === true || (typeof value === 'number' && value === -1)) {
      return tier;
    }
  }
  return 'EMPIRE';
}

/** Returns the minimum tier that grants access to a specific style. */
export function minimumTierForStyle(style: ArtStyle): TierName {
  for (const tier of TIER_ORDER) {
    const ent = TIER_ENTITLEMENTS[tier];
    const allowedStyles = STYLE_SET_MAP[ent.style_set];
    if (allowedStyles.includes(style)) {
      return tier;
    }
  }
  return 'EMPIRE';
}

/** Returns true if tierA >= tierB in the tier hierarchy. */
export function isTierAtLeast(tierA: TierName, tierB: TierName): boolean {
  return TIER_ORDER.indexOf(tierA) >= TIER_ORDER.indexOf(tierB);
}

// ── Dodo Product ID Mapping ──────────────────────────────────

/**
 * Product IDs come from VITE_ env vars so they are available
 * client-side for display purposes (e.g. linking to checkout).
 * Server-side resolution uses DODO_PRODUCT_ID_* in api/dodo.ts.
 */
export const DODO_PRODUCT_IDS: Record<string, TierName> = (() => {
  const map: Record<string, TierName> = {};
  const creatorId = import.meta.env.VITE_DODO_PRODUCT_CREATOR;
  const studioId = import.meta.env.VITE_DODO_PRODUCT_STUDIO;
  const empireId = import.meta.env.VITE_DODO_PRODUCT_EMPIRE;
  if (creatorId) map[creatorId] = 'CREATOR';
  if (studioId) map[studioId] = 'STUDIO';
  if (empireId) map[empireId] = 'EMPIRE';
  return map;
})();

// ── Helper Functions ─────────────────────────────────────────

/** Resolve a Dodo product ID to a TierName. Returns 'SPARK' if unknown. */
export function getTierFromProductId(productId: string): TierName {
  return DODO_PRODUCT_IDS[productId] ?? 'SPARK';
}

/** Get the full entitlements object for a tier. */
export function getEntitlements(tier: TierName | UserTier): TierEntitlements {
  const normalized = (typeof tier === 'string' ? tier.toUpperCase() : tier) as TierName;
  return TIER_ENTITLEMENTS[normalized] ?? TIER_ENTITLEMENTS.SPARK;
}

/** Returns true if a numeric entitlement value represents unlimited. */
export function isUnlimited(value: number): boolean {
  return value === -1;
}

/** Get the allowed ArtStyle[] for a given tier. */
export function getStylesForTier(tier: TierName | UserTier): ArtStyle[] {
  const ent = getEntitlements(tier);
  return STYLE_SET_MAP[ent.style_set];
}

/** Check if a specific style is available on a tier. */
export function canUseStyle(tier: TierName | UserTier, style: ArtStyle): boolean {
  return getStylesForTier(tier).includes(style);
}

/** Tier display names and prices for UI. */
export const TIER_DISPLAY: Record<
  TierName,
  { label: string; price: string; monthlyPrice: number }
> = {
  SPARK: { label: 'Spark', price: 'Free', monthlyPrice: 0 },
  CREATOR: { label: 'Creator', price: '$19.99/mo', monthlyPrice: 19.99 },
  STUDIO: { label: 'Studio', price: '$59.99/mo', monthlyPrice: 59.99 },
  EMPIRE: { label: 'Empire', price: '$199.99/mo', monthlyPrice: 199.99 },
};

/** Convert UserTier enum to TierName string. */
export function userTierToTierName(tier: UserTier): TierName {
  return tier as TierName;
}
