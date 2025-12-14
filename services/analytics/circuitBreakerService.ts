/**
 * Circuit Breaker Service
 * 
 * Prevents runaway API costs by implementing spending limits and rate controls.
 * Uses in-memory tracking with periodic Supabase sync for persistence.
 * 
 * Key Features:
 * - Per-user spending limits (daily/monthly)
 * - Per-session rate limiting
 * - Graceful degradation (downgrade to cheaper models instead of blocking)
 * - Real-time budget tracking
 * - Supabase integration for persistent limits
 * 
 * Design: All checks are SYNCHRONOUS and use cached data to avoid latency.
 * Supabase sync happens in background to update limits and persist overrides.
 */

import { supabase } from '../supabaseClient';
import { UserTier } from '../../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface SpendingLimits {
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
}

// Tier-based spending limits
const TIER_LIMITS: Record<UserTier, SpendingLimits> = {
  [UserTier.SPARK]: {
    dailyLimitUsd: 0.50,
    monthlyLimitUsd: 5.00,
    maxRequestsPerMinute: 5,
    maxRequestsPerHour: 30
  },
  [UserTier.CREATOR]: {
    dailyLimitUsd: 5.00,
    monthlyLimitUsd: 50.00,
    maxRequestsPerMinute: 15,
    maxRequestsPerHour: 100
  },
  [UserTier.STUDIO]: {
    dailyLimitUsd: 25.00,
    monthlyLimitUsd: 250.00,
    maxRequestsPerMinute: 30,
    maxRequestsPerHour: 300
  },
  [UserTier.EMPIRE]: {
    dailyLimitUsd: 100.00,
    monthlyLimitUsd: 1000.00,
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 600
  }
};

// ============================================================================
// IN-MEMORY TRACKING (Fast, synchronous checks)
// ============================================================================

interface UserBudget {
  userId: string;
  dailySpend: number;
  monthlySpend: number;
  lastResetDay: number;
  lastResetMonth: number;
  requestTimestamps: number[]; // For rate limiting
}

const userBudgets = new Map<string, UserBudget>();

/**
 * Get or create budget tracker for a user - synchronous
 */
function getBudget(userId: string): UserBudget {
  const now = new Date();
  const today = now.getDate();
  const thisMonth = now.getMonth();
  
  let budget = userBudgets.get(userId);
  
  if (!budget) {
    budget = {
      userId,
      dailySpend: 0,
      monthlySpend: 0,
      lastResetDay: today,
      lastResetMonth: thisMonth,
      requestTimestamps: []
    };
    userBudgets.set(userId, budget);
  }
  
  // Reset daily spend if new day
  if (budget.lastResetDay !== today) {
    budget.dailySpend = 0;
    budget.lastResetDay = today;
  }
  
  // Reset monthly spend if new month
  if (budget.lastResetMonth !== thisMonth) {
    budget.monthlySpend = 0;
    budget.lastResetMonth = thisMonth;
  }
  
  // Clean old timestamps (keep only last hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  budget.requestTimestamps = budget.requestTimestamps.filter(t => t > oneHourAgo);
  
  return budget;
}

// ============================================================================
// CIRCUIT BREAKER CHECKS
// ============================================================================

export interface CircuitBreakerResult {
  allowed: boolean;
  reason?: 'daily_limit' | 'monthly_limit' | 'rate_limit_minute' | 'rate_limit_hour';
  suggestedAction?: 'block' | 'downgrade' | 'queue';
  suggestedModel?: string;
  remainingBudget?: number;
  resetTime?: number;
}

/**
 * Check if a request should be allowed - SYNCHRONOUS, no API calls
 * Returns immediately with cached data
 */
export function checkCircuitBreaker(
  userId: string,
  tier: UserTier,
  estimatedCostUsd: number
): CircuitBreakerResult {
  const budget = getBudget(userId);
  const limits = TIER_LIMITS[tier] || TIER_LIMITS[UserTier.SPARK];
  const now = Date.now();
  
  // Check monthly limit
  if (budget.monthlySpend + estimatedCostUsd > limits.monthlyLimitUsd) {
    return {
      allowed: false,
      reason: 'monthly_limit',
      suggestedAction: 'downgrade',
      suggestedModel: 'gemini-1.5-flash', // Cheaper model
      remainingBudget: limits.monthlyLimitUsd - budget.monthlySpend
    };
  }
  
  // Check daily limit
  if (budget.dailySpend + estimatedCostUsd > limits.dailyLimitUsd) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    return {
      allowed: false,
      reason: 'daily_limit',
      suggestedAction: 'downgrade',
      suggestedModel: 'gemini-1.5-flash',
      remainingBudget: limits.dailyLimitUsd - budget.dailySpend,
      resetTime: tomorrow.getTime()
    };
  }
  
  // Check per-minute rate limit
  const oneMinuteAgo = now - 60 * 1000;
  const requestsLastMinute = budget.requestTimestamps.filter(t => t > oneMinuteAgo).length;
  
  if (requestsLastMinute >= limits.maxRequestsPerMinute) {
    return {
      allowed: false,
      reason: 'rate_limit_minute',
      suggestedAction: 'queue',
      resetTime: budget.requestTimestamps[0] + 60 * 1000
    };
  }
  
  // Check per-hour rate limit
  const requestsLastHour = budget.requestTimestamps.length;
  
  if (requestsLastHour >= limits.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: 'rate_limit_hour',
      suggestedAction: 'queue',
      resetTime: budget.requestTimestamps[0] + 60 * 60 * 1000
    };
  }
  
  // All checks passed
  return {
    allowed: true,
    remainingBudget: limits.dailyLimitUsd - budget.dailySpend
  };
}

/**
 * Record a request and its cost - call AFTER successful generation
 */
export function recordSpend(userId: string, costUsd: number): void {
  const budget = getBudget(userId);
  budget.dailySpend += costUsd;
  budget.monthlySpend += costUsd;
  budget.requestTimestamps.push(Date.now());
}

/**
 * Get current spending status for UI display
 */
export function getSpendingStatus(userId: string, tier: UserTier): {
  dailySpend: number;
  dailyLimit: number;
  dailyPercentage: number;
  monthlySpend: number;
  monthlyLimit: number;
  monthlyPercentage: number;
  requestsThisHour: number;
  hourlyLimit: number;
} {
  const budget = getBudget(userId);
  const limits = TIER_LIMITS[tier] || TIER_LIMITS[UserTier.SPARK];
  
  return {
    dailySpend: budget.dailySpend,
    dailyLimit: limits.dailyLimitUsd,
    dailyPercentage: (budget.dailySpend / limits.dailyLimitUsd) * 100,
    monthlySpend: budget.monthlySpend,
    monthlyLimit: limits.monthlyLimitUsd,
    monthlyPercentage: (budget.monthlySpend / limits.monthlyLimitUsd) * 100,
    requestsThisHour: budget.requestTimestamps.length,
    hourlyLimit: limits.maxRequestsPerHour
  };
}

// ============================================================================
// MODEL DOWNGRADE LOGIC
// ============================================================================

const MODEL_DOWNGRADES: Record<string, string> = {
  'gemini-2.5-pro': 'gemini-1.5-flash',
  'gemini-1.5-pro': 'gemini-1.5-flash',
  'imagen-4.0-ultra-generate-exp-05-20': 'imagen-4.0-generate-preview-05-20',
  'grok-3': 'grok-3-mini'
};

/**
 * Get a cheaper alternative model when budget is low
 */
export function getDowngradedModel(originalModel: string): string {
  return MODEL_DOWNGRADES[originalModel] || originalModel;
}

/**
 * Smart model selection based on budget status
 */
export function selectModelWithBudget(
  preferredModel: string,
  userId: string,
  tier: UserTier,
  estimatedCost: number
): { model: string; wasDowngraded: boolean } {
  const check = checkCircuitBreaker(userId, tier, estimatedCost);
  
  if (check.allowed) {
    return { model: preferredModel, wasDowngraded: false };
  }
  
  if (check.suggestedAction === 'downgrade' && check.suggestedModel) {
    return { model: check.suggestedModel, wasDowngraded: true };
  }
  
  // Use the general downgrade map
  const downgraded = getDowngradedModel(preferredModel);
  return { 
    model: downgraded, 
    wasDowngraded: downgraded !== preferredModel 
  };
}

// ============================================================================
// ADMIN OVERRIDES
// ============================================================================

const adminOverrides = new Set<string>();

/**
 * Grant unlimited access to a user (admin function)
 */
export function grantUnlimitedAccess(userId: string): void {
  adminOverrides.add(userId);
}

/**
 * Revoke unlimited access
 */
export function revokeUnlimitedAccess(userId: string): void {
  adminOverrides.delete(userId);
}

/**
 * Check if user has admin override
 */
export function hasUnlimitedAccess(userId: string): boolean {
  return adminOverrides.has(userId);
}

// ============================================================================
// SUPABASE SYNC (Background, non-blocking)
// ============================================================================

/**
 * Sync spending limits from Supabase - call on user login
 * This hydrates the in-memory cache with persisted data
 */
export async function syncSpendingLimitsFromDB(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_spending_limits')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      // No custom limits, use tier defaults
      return;
    }
    
    // If user has unlimited access in DB, grant it locally
    if (data.has_unlimited_access) {
      adminOverrides.add(userId);
    }
    
    console.log(`📊 Synced spending limits for user ${userId}`);
  } catch (err) {
    // Fail silently - will use tier defaults
    console.warn('📊 Failed to sync spending limits (non-critical):', err);
  }
}

/**
 * Persist admin override to Supabase
 */
export async function persistUnlimitedAccess(userId: string, granted: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_spending_limits')
      .upsert({
        user_id: userId,
        has_unlimited_access: granted,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (error) {
      console.warn('📊 Failed to persist unlimited access (non-critical):', error.message);
    }
  } catch (err) {
    console.warn('📊 Error persisting unlimited access:', err);
  }
}

/**
 * Get spending check from Supabase RPC (for accurate server-side validation)
 * Use this for critical operations where accuracy matters more than speed
 */
export async function checkSpendingLimitFromDB(
  userId: string, 
  estimatedCost: number
): Promise<{ allowed: boolean; dailyRemaining: number; monthlyRemaining: number; reason: string } | null> {
  try {
    const { data, error } = await supabase
      .rpc('check_spending_limit', {
        p_user_id: userId,
        p_estimated_cost: estimatedCost
      })
      .single();
    
    if (error || !data) return null;
    
    return {
      allowed: data.allowed,
      dailyRemaining: data.daily_remaining,
      monthlyRemaining: data.monthly_remaining,
      reason: data.reason
    };
  } catch {
    return null;
  }
}

/**
 * Get user's current usage summary from Supabase
 */
export async function getUserUsageSummaryFromDB(userId: string): Promise<{
  dailyCost: number;
  monthlyCost: number;
  dailyOperations: number;
  monthlyOperations: number;
  avgLatencyMs: number;
} | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_usage_summary', { p_user_id: userId })
      .single();
    
    if (error || !data) return null;
    
    return {
      dailyCost: data.daily_cost,
      monthlyCost: data.monthly_cost,
      dailyOperations: data.daily_operations,
      monthlyOperations: data.monthly_operations,
      avgLatencyMs: data.avg_latency_ms
    };
  } catch {
    return null;
  }
}

export default {
  checkCircuitBreaker,
  recordSpend,
  getSpendingStatus,
  getDowngradedModel,
  selectModelWithBudget,
  grantUnlimitedAccess,
  revokeUnlimitedAccess,
  hasUnlimitedAccess,
  syncSpendingLimitsFromDB,
  persistUnlimitedAccess,
  checkSpendingLimitFromDB,
  getUserUsageSummaryFromDB,
  TIER_LIMITS
};
