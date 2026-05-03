/**
 * @fileoverview Gamification Agent — DB-Driven, Zero Hardcoded Data
 *
 * ALL level thresholds, badge definitions, XP values and challenge text
 * now live in Supabase tables:
 *   level_definitions · xp_action_values · achievement_definitions
 *   daily_challenge_pool · user_gamification · xp_events
 *
 * The in-memory userStore is gone. Every read/write hits the DB via
 * supabaseAdmin so data survives server restarts and scales horizontally.
 *
 * @module mastra/agents/gamificationAgent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { getMastraModel } from '../lib/mastraProvider';
import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── DB Client (server-side, service role) ────────────────────────────────────
function getDB(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function ensureGamificationRow(db: SupabaseClient, userId: string): Promise<void> {
  await db
    .from('user_gamification')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
}

// ─── Tools ────────────────────────────────────────────────────────────────────

/** awardXP — calls award_xp() DB function; XP values from xp_action_values table */
const awardXP = createTool({
  id: 'awardXP',
  description: 'Awards XP for a user action. XP values read from xp_action_values DB table.',
  inputSchema: z.object({
    userId: z.string(),
    action: z
      .string()
      .describe(
        'book_created | page_edited | illustration_generated | brand_content_created | qa_score_90 | daily_login | suggestion_accepted | daily_challenge_completed'
      ),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  outputSchema: z.object({
    xpAwarded: z.number(),
    totalXP: z.number(),
    currentXP: z.number(),
    leveledUp: z.boolean(),
    newLevel: z.number(),
    newTitle: z.string(),
    nextLevelXP: z.number(),
  }),
  execute: async (input) => {
    const db = getDB();
    const { data, error } = await db.rpc('award_xp', {
      p_user_id: input.userId,
      p_action_name: input.action,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw new Error(`award_xp failed: ${error.message}`);
    return {
      xpAwarded: data.xp_awarded,
      totalXP: data.total_xp,
      currentXP: data.current_xp,
      leveledUp: data.leveled_up,
      newLevel: data.new_level,
      newTitle: data.new_title,
      nextLevelXP: data.next_level_xp,
    };
  },
});

/** checkStreak — calls update_streak() DB function */
const checkStreak = createTool({
  id: 'checkStreak',
  description: 'Updates the user daily creation streak in the DB.',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({
    currentStreak: z.number(),
    streakIncreased: z.boolean(),
    streakBroken: z.boolean(),
  }),
  execute: async (input) => {
    const db = getDB();
    await ensureGamificationRow(db, input.userId);
    const { data, error } = await db.rpc('update_streak', { p_user_id: input.userId });
    if (error) throw new Error(`update_streak failed: ${error.message}`);
    return {
      currentStreak: data.current_streak,
      streakIncreased: data.increased,
      streakBroken: data.broken,
    };
  },
});

/** unlockBadge — writes to user_achievements; badge defs from achievement_definitions table */
const unlockBadge = createTool({
  id: 'unlockBadge',
  description: 'Unlocks a badge. Badge definitions read from achievement_definitions DB table.',
  inputSchema: z.object({ userId: z.string(), badgeId: z.string() }),
  outputSchema: z.object({ unlocked: z.boolean(), alreadyHad: z.boolean(), badgeName: z.string() }),
  execute: async (input) => {
    const db = getDB();
    const { data: badge } = await db
      .from('achievement_definitions')
      .select('id,name')
      .eq('id', input.badgeId)
      .single();
    if (!badge) return { unlocked: false, alreadyHad: false, badgeName: 'Unknown' };
    const { data: existing } = await db
      .from('user_achievements')
      .select('id')
      .eq('user_id', input.userId)
      .eq('achievement_type', input.badgeId)
      .single();
    if (existing) return { unlocked: false, alreadyHad: true, badgeName: badge.name };
    await db
      .from('user_achievements')
      .insert({
        user_id: input.userId,
        achievement_type: input.badgeId,
        achievement_name: badge.name,
        unlocked_at: new Date().toISOString(),
      });
    return { unlocked: true, alreadyHad: false, badgeName: badge.name };
  },
});

/** getDailyChallenges — calls assign_daily_challenges() DB function */
const getDailyChallenges = createTool({
  id: 'getDailyChallenges',
  description: "Gets or assigns today's personalized daily challenges from DB.",
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({
    challenges: z.array(
      z.object({ id: z.string(), title: z.string(), xpReward: z.number(), completed: z.boolean() })
    ),
  }),
  execute: async (input) => {
    const db = getDB();
    await ensureGamificationRow(db, input.userId);
    const { data, error } = await db.rpc('assign_daily_challenges', { p_user_id: input.userId });
    if (error) throw new Error(`assign_daily_challenges failed: ${error.message}`);
    return {
      challenges: (data ?? []).map((r: any) => ({
        id: r.challenge_id,
        title: r.title,
        xpReward: r.xp_reward,
        completed: r.completed,
      })),
    };
  },
});

/** getFullState — assembles entire GamificationState from DB. Zero hardcoded data. */
const getFullState = createTool({
  id: 'getFullState',
  description: 'Reads entire gamification state from DB for a user.',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({
    level: z.number(),
    levelTitle: z.string(),
    currentXP: z.number(),
    nextLevelXP: z.number(),
    currentStreak: z.number(),
    booksCreatedCount: z.number(),
    badges: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        icon: z.string(),
        unlocked: z.boolean(),
      })
    ),
    dailyChallenges: z.array(
      z.object({ id: z.string(), title: z.string(), xpReward: z.number(), completed: z.boolean() })
    ),
  }),
  execute: async (input) => {
    const db = getDB();
    await ensureGamificationRow(db, input.userId);
    const { data: ug } = await db
      .from('user_gamification')
      .select('level,level_title,current_xp,books_created_count,current_streak,total_xp')
      .eq('user_id', input.userId)
      .single();
    const currentLevel = ug?.level ?? 1;
    const { data: nextLevelRow } = await db
      .from('level_definitions')
      .select('xp_required')
      .eq('level', currentLevel + 1)
      .single();
    const nextLevelXP = nextLevelRow?.xp_required ?? (ug?.total_xp ?? 0) + 2000;
    const { data: allBadges } = await db
      .from('achievement_definitions')
      .select('id,name,description,icon')
      .eq('is_active', true)
      .not('trigger_action', 'is', null)
      .order('id');
    const { data: unlockedRows } = await db
      .from('user_achievements')
      .select('achievement_type')
      .eq('user_id', input.userId);
    const unlockedIds = new Set((unlockedRows ?? []).map((r: any) => r.achievement_type));
    const badges = (allBadges ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      unlocked: unlockedIds.has(b.id),
    }));
    const { data: challengeRows } = await db.rpc('assign_daily_challenges', {
      p_user_id: input.userId,
    });
    const dailyChallenges = (challengeRows ?? []).map((r: any) => ({
      id: r.challenge_id,
      title: r.title,
      xpReward: r.xp_reward,
      completed: r.completed,
    }));
    return {
      level: ug?.level ?? 1,
      levelTitle: ug?.level_title ?? 'Aspiring Author',
      currentXP: ug?.current_xp ?? 0,
      nextLevelXP,
      currentStreak: ug?.current_streak ?? 0,
      booksCreatedCount: ug?.books_created_count ?? 0,
      badges,
      dailyChallenges,
    };
  },
});

// ─── Agent ────────────────────────────────────────────────────────────────────

export const gamificationAgent = new Agent({
  id: 'gamification',
  name: 'Gamification',
  instructions: `You are the Gamification Engine for Genesis. All level thresholds, XP values, badge definitions, and challenge templates are stored in Supabase — never invent or hardcode them.

Available actions (from the "action" field in input):
- "getState": Call getFullState tool and return result as JSON
- "track": Call awardXP + checkStreak and return results as JSON
- "getDailyChallenges": Call getDailyChallenges tool

Always respond with valid JSON.`,
  model: getMastraModel(),
  tools: { awardXP, checkStreak, unlockBadge, getDailyChallenges, getFullState },
});

export { getFullState, awardXP, checkStreak, getDailyChallenges, unlockBadge };
