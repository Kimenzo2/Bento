/**
 * usageService.ts — Server-side usage tracking
 *
 * Reads from the usage_tracking table (source of truth) with
 * localStorage fallback for unauthenticated / offline users.
 */

import { supabase } from './supabaseClient';

/**
 * Get the current month's book creation count for a user.
 * Calls the DB function get_current_month_usage() which is
 * SECURITY DEFINER so it bypasses RLS.
 */
export async function getCurrentMonthUsage(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_current_month_usage', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[UsageService] Error fetching usage:', error.message);
      return getLocalUsage();
    }

    return typeof data === 'number' ? data : 0;
  } catch {
    return getLocalUsage();
  }
}

/**
 * Increment the current month's book count for a user.
 * Calls the DB function increment_book_usage() which does an
 * atomic upsert (SECURITY DEFINER, bypasses RLS).
 * Returns the new count.
 */
export async function incrementBookCount(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('increment_book_usage', {
      p_user_id: userId,
    });

    if (error) {
      console.error('[UsageService] Error incrementing usage:', error.message);
      incrementLocalUsage();
      return getLocalUsage();
    }

    // Sync localStorage with server value
    setLocalUsage(typeof data === 'number' ? data : getLocalUsage() + 1);
    return typeof data === 'number' ? data : getLocalUsage();
  } catch {
    incrementLocalUsage();
    return getLocalUsage();
  }
}

// ── localStorage fallback ────────────────────────────────────

const LOCAL_USAGE_KEY = 'genesis_monthly_usage';

interface LocalMonthlyUsage {
  month: string;
  count: number;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function getLocalUsageObj(): LocalMonthlyUsage {
  try {
    const raw = localStorage.getItem(LOCAL_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalMonthlyUsage;
      if (parsed.month === currentMonth()) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { month: currentMonth(), count: 0 };
}

function getLocalUsage(): number {
  return getLocalUsageObj().count;
}

function setLocalUsage(count: number): void {
  localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify({ month: currentMonth(), count }));
}

function incrementLocalUsage(): void {
  const usage = getLocalUsageObj();
  usage.count += 1;
  localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify(usage));
}
