import { ArtStyle, UserTier } from '../types';

// Tier Limits Configuration
export const TIER_LIMITS = {
  [UserTier.SPARK]: {
    ebooksPerMonth: 3,
    maxPagesPerBook: 4,
    maxIllustrationsPerBook: 5,
    hasWatermark: true,
    hasCommercialLicense: false,
    teamSeats: 1,
    allowedStyles: [
      ArtStyle.WATERCOLOR,
      ArtStyle.PIXAR_3D,
      ArtStyle.MANGA,
      ArtStyle.VINTAGE,
      ArtStyle.PAPER_CUTOUT,
    ],
  },
  [UserTier.CREATOR]: {
    ebooksPerMonth: 30,
    maxPagesPerBook: 12,
    maxIllustrationsPerBook: Number.POSITIVE_INFINITY,
    hasWatermark: false,
    hasCommercialLicense: true,
    teamSeats: 1,
    allowedStyles: Object.values(ArtStyle).slice(0, 20), // First 20 styles
  },
  [UserTier.STUDIO]: {
    ebooksPerMonth: Number.POSITIVE_INFINITY,
    maxPagesPerBook: 500,
    maxIllustrationsPerBook: Number.POSITIVE_INFINITY,
    hasWatermark: false,
    hasCommercialLicense: true,
    teamSeats: 5,
    allowedStyles: Object.values(ArtStyle), // All styles
  },
  [UserTier.EMPIRE]: {
    ebooksPerMonth: Number.POSITIVE_INFINITY,
    maxPagesPerBook: 999,
    maxIllustrationsPerBook: Number.POSITIVE_INFINITY,
    hasWatermark: false,
    hasCommercialLicense: true,
    teamSeats: Number.POSITIVE_INFINITY,
    allowedStyles: Object.values(ArtStyle), // All styles
  },
};

// Helper Functions
export const getTierLimits = (tier: UserTier) => {
  // Defensive check - return SPARK limits if tier is invalid
  const limits = TIER_LIMITS[tier];
  if (!limits) {
    console.warn(`[TierLimits] Invalid tier "${tier}", defaulting to SPARK`);
    return TIER_LIMITS[UserTier.SPARK];
  }
  return limits;
};

export const canCreateEbook = (tier: UserTier, ebooksThisMonth: number): boolean => {
  const limits = getTierLimits(tier);
  return ebooksThisMonth < limits.ebooksPerMonth;
};

export const canUseStyle = (tier: UserTier, style: ArtStyle): boolean => {
  const limits = getTierLimits(tier);
  return limits.allowedStyles.includes(style);
};

export const getMaxPages = (tier: UserTier): number => {
  return getTierLimits(tier).maxPagesPerBook;
};

export const hasWatermark = (tier: UserTier): boolean => {
  return getTierLimits(tier).hasWatermark;
};

export const hasCommercialLicense = (tier: UserTier): boolean => {
  return getTierLimits(tier).hasCommercialLicense;
};

export const getAvailableStyles = (tier: UserTier): ArtStyle[] => {
  return getTierLimits(tier).allowedStyles;
};

export const getRemainingEbooks = (tier: UserTier, ebooksThisMonth: number): number => {
  const limits = getTierLimits(tier);
  if (limits.ebooksPerMonth === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return Math.max(0, limits.ebooksPerMonth - ebooksThisMonth);
};

// Monthly usage tracking
// MASTRA MIGRATION: Server-side tracking via Supabase is now the source of truth.
// localStorage is kept as a fallback for offline/unauthenticated users.
// The Mastra bookGenerationWorkflow increments usage server-side in the persistBook step.
const USAGE_KEY = 'genesis_monthly_usage';

interface MonthlyUsage {
  month: string; // Format: YYYY-MM
  ebooksCreated: number;
  userId?: string;
}

export const getMonthlyUsage = (): MonthlyUsage => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const stored = localStorage.getItem(USAGE_KEY);

  if (stored) {
    const usage: MonthlyUsage = JSON.parse(stored);
    // Reset if new month
    if (usage.month !== currentMonth) {
      const newUsage = { month: currentMonth, ebooksCreated: 0 };
      localStorage.setItem(USAGE_KEY, JSON.stringify(newUsage));
      return newUsage;
    }
    return usage;
  }

  const newUsage = { month: currentMonth, ebooksCreated: 0 };
  localStorage.setItem(USAGE_KEY, JSON.stringify(newUsage));
  return newUsage;
};

export const incrementEbookCount = (): void => {
  // NOTE: When Mastra is active, the server increments usage in Supabase.
  // This localStorage increment is only for the fallback path.
  const usage = getMonthlyUsage();
  usage.ebooksCreated += 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
};

export const getEbooksCreatedThisMonth = (): number => {
  return getMonthlyUsage().ebooksCreated;
};

/**
 * Fetch server-side ebook count from Mastra (source of truth when authenticated).
 * Falls back to localStorage count if Mastra is unreachable.
 */
export const getServerEbookCount = async (): Promise<number> => {
  try {
    // Dynamic import to avoid circular dependencies
    const { mastra } = await import('../src/services/mastraClient');
    const state = await mastra.agents.gamification.getState();
    return state.booksCreatedCount;
  } catch {
    // Fallback to localStorage
    return getEbooksCreatedThisMonth();
  }
};
