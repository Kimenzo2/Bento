/**
 * useEntitlements — Single React interface to the user's tier and limits
 *
 * Every component that needs to check tier access uses this hook.
 * Reads from profiles.user_tier (updated by the Dodo webhook handler).
 * Subscribes to Supabase Realtime so tier changes reflect instantly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type TierEntitlements,
  type TierName,
  STYLE_SET_MAP,
  getEntitlements,
  isUnlimited,
  minimumTierForStyle,
  userTierToTierName,
} from '../config/entitlements';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, invalidateProfileCache } from '../services/profileService';
import { supabase } from '../services/supabaseClient';
import { getCurrentMonthUsage } from '../services/usageService';
import { ArtStyle, UserTier } from '../types';

export interface UseEntitlementsReturn {
  tier: TierName;
  entitlements: TierEntitlements;
  isLoading: boolean;
  monthlyUsage: number;
  canCreateBook: () => boolean;
  canAddPage: (currentPageCount: number) => boolean;
  canUseStyle: (style: ArtStyle) => boolean;
  hasFeature: (feature: keyof TierEntitlements) => boolean;
  booksRemaining: () => number | 'unlimited';
  usagePercent: () => number;
  refreshUsage: () => Promise<void>;
}

export function useEntitlements(): UseEntitlementsReturn {
  const { user } = useAuth();
  const [tier, setTier] = useState<TierName>('SPARK');
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const mountedRef = useRef(true);

  // Load tier from profile on mount and when user changes
  useEffect(() => {
    mountedRef.current = true;

    async function loadTier() {
      if (!user) {
        if (mountedRef.current) {
          setTier('SPARK');
          setMonthlyUsage(0);
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await getUserProfile();
        if (mountedRef.current && profile) {
          const resolvedTier = userTierToTierName(profile.user_tier || UserTier.SPARK);
          setTier(resolvedTier);
        }

        const usage = await getCurrentMonthUsage(user.id);
        if (mountedRef.current) {
          setMonthlyUsage(usage);
        }
      } catch (err) {
        console.error('[useEntitlements] Error loading tier:', err);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    }

    loadTier();

    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  // Subscribe to Realtime changes on the user's profile row
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-tier-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload: { new: { user_tier?: string } }) => {
          const newTier = payload.new?.user_tier as TierName | undefined;
          if (newTier && mountedRef.current) {
            setTier(newTier);
            // Invalidate profile cache so other consumers get fresh data
            invalidateProfileCache(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const entitlements = useMemo(() => getEntitlements(tier), [tier]);

  const canCreateBook = useCallback(() => {
    if (isUnlimited(entitlements.books_per_month)) return true;
    return monthlyUsage < entitlements.books_per_month;
  }, [entitlements, monthlyUsage]);

  const canAddPage = useCallback(
    (currentPageCount: number) => {
      if (isUnlimited(entitlements.pages_per_book)) return true;
      return currentPageCount < entitlements.pages_per_book;
    },
    [entitlements]
  );

  const canUseStyle = useCallback(
    (style: ArtStyle) => {
      const allowed = STYLE_SET_MAP[entitlements.style_set];
      return allowed.includes(style);
    },
    [entitlements]
  );

  const hasFeature = useCallback(
    (feature: keyof TierEntitlements) => {
      const value = entitlements[feature];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      return false;
    },
    [entitlements]
  );

  const booksRemaining = useCallback(() => {
    if (isUnlimited(entitlements.books_per_month)) return 'unlimited' as const;
    return Math.max(0, entitlements.books_per_month - monthlyUsage);
  }, [entitlements, monthlyUsage]);

  const usagePercent = useCallback(() => {
    if (isUnlimited(entitlements.books_per_month)) return 0;
    if (entitlements.books_per_month === 0) return 100;
    return Math.min(100, Math.round((monthlyUsage / entitlements.books_per_month) * 100));
  }, [entitlements, monthlyUsage]);

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    const usage = await getCurrentMonthUsage(user.id);
    if (mountedRef.current) setMonthlyUsage(usage);
  }, [user]);

  return {
    tier,
    entitlements,
    isLoading,
    monthlyUsage,
    canCreateBook,
    canAddPage,
    canUseStyle,
    hasFeature,
    booksRemaining,
    usagePercent,
    refreshUsage,
  };
}

/**
 * Typed error for tier limit violations.
 * Thrown by enforcement functions, caught by UI to show UpgradePrompt.
 */
export class TierLimitError extends Error {
  code: 'BOOK_LIMIT_REACHED' | 'PAGE_LIMIT_REACHED' | 'STYLE_NOT_AVAILABLE';
  tier: TierName;
  limit: number;
  requiredTier?: TierName;

  constructor(params: {
    code: TierLimitError['code'];
    tier: TierName;
    limit: number;
    requiredTier?: TierName;
  }) {
    const messages: Record<string, string> = {
      BOOK_LIMIT_REACHED: `You've reached your monthly book limit (${params.limit}) on the ${params.tier} plan.`,
      PAGE_LIMIT_REACHED: `You've reached the page limit (${params.limit}) for the ${params.tier} plan.`,
      STYLE_NOT_AVAILABLE: `This style requires the ${params.requiredTier} plan or higher.`,
    };
    super(messages[params.code] || 'Tier limit reached');
    this.name = 'TierLimitError';
    this.code = params.code;
    this.tier = params.tier;
    this.limit = params.limit;
    this.requiredTier = params.requiredTier;
  }
}
