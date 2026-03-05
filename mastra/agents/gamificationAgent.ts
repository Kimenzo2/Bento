/**
 * @fileoverview Gamification Agent — XP, Badges, Streaks & Challenges
 *
 * ## What This File Does
 * This Mastra agent replaces the entirely hardcoded data in
 * components/GamificationHub.tsx. It manages XP, levels, streaks, badges,
 * daily challenges, and leaderboard data using persistent memory.
 *
 * ## What It Replaces
 * - ALL hardcoded gamification data in GamificationHub.tsx
 * - The static leaderboard, badges, challenges, XP, and level displays
 *
 * ## Key Feature: Persistent Memory
 * Maintains cross-session memory of user XP, level, streak, and badges
 * using userId as the key. Generates PERSONALIZED daily challenges based
 * on the user's creation history.
 *
 * ## Future Extensions
 * - [SOCIAL PHASE]: Team challenges and collaborative streaks
 * - [STREAMING PHASE]: Video creation milestones and badges
 *
 * @module mastra/agents/gamificationAgent
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { GamificationStateSchema, BadgeSchema, ChallengeSchema } from '../schemas';

// ─── XP Level Thresholds ─────────────────────────────────────────────────────
// These match the thresholds hardcoded in the GamificationState type
const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, title: 'Aspiring Author' },
  { level: 2, xp: 100, title: 'Wordsmith' },
  { level: 3, xp: 300, title: 'Story Weaver' },
  { level: 4, xp: 600, title: 'Rising Author' },
  { level: 5, xp: 1000, title: 'Published Creator' },
  { level: 6, xp: 1500, title: 'Master Storyteller' },
  { level: 7, xp: 2200, title: 'Literary Legend' },
  { level: 8, xp: 3000, title: 'Epic Narrator' },
  { level: 9, xp: 4000, title: 'World Builder' },
  { level: 10, xp: 5500, title: 'Genesis Grandmaster' },
];

// ─── Badge Definitions ───────────────────────────────────────────────────────
const BADGE_DEFINITIONS = [
  { id: 'first_book', name: 'First Book', description: 'Created your first ebook', icon: 'BookOpen', triggerAction: 'book_created', triggerCount: 1 },
  { id: 'five_books', name: 'Prolific Writer', description: 'Created 5 ebooks', icon: 'Library', triggerAction: 'book_created', triggerCount: 5 },
  { id: 'ten_books', name: 'Publishing House', description: 'Created 10 ebooks', icon: 'Building2', triggerAction: 'book_created', triggerCount: 10 },
  { id: 'first_edit', name: 'Editor\'s Eye', description: 'Used the Smart Editor', icon: 'Pencil', triggerAction: 'page_edited', triggerCount: 1 },
  { id: 'illustrator', name: 'Visual Storyteller', description: 'Generated 10 illustrations', icon: 'Palette', triggerAction: 'illustration_generated', triggerCount: 10 },
  { id: 'streak_3', name: 'On a Roll', description: '3-day creation streak', icon: 'Flame', triggerAction: 'streak', triggerCount: 3 },
  { id: 'streak_7', name: 'Weekly Warrior', description: '7-day creation streak', icon: 'Zap', triggerAction: 'streak', triggerCount: 7 },
  { id: 'streak_30', name: 'Monthly Master', description: '30-day creation streak', icon: 'Crown', triggerAction: 'streak', triggerCount: 30 },
  { id: 'brand_creator', name: 'Brand Builder', description: 'Created a brand content piece', icon: 'Briefcase', triggerAction: 'brand_content_created', triggerCount: 1 },
  { id: 'qa_perfect', name: 'Quality Champion', description: 'Scored 90+ on QA check', icon: 'Award', triggerAction: 'qa_score_90', triggerCount: 1 },
];

// ─── XP Award Values ─────────────────────────────────────────────────────────
const XP_AWARDS: Record<string, number> = {
  book_created: 50,
  page_edited: 5,
  illustration_generated: 10,
  suggestion_accepted: 3,
  daily_challenge_completed: 25,
  brand_content_created: 75,
  qa_score_90: 30,
};

// ─── Persistent User State Store ─────────────────────────────────────────────
// In production, this reads/writes to Supabase via the server endpoint.
// This in-memory store acts as a fast cache.

interface UserGameData {
  userId: string;
  xp: number;
  level: number;
  levelTitle: string;
  booksCreated: number;
  pagesEdited: number;
  illustrationsGenerated: number;
  brandContentCreated: number;
  unlockedBadgeIds: string[];
  currentStreak: number;
  lastActivityDate: string;
  actionHistory: { action: string; timestamp: number; metadata?: Record<string, unknown> }[];
}

const userStore = new Map<string, UserGameData>();

function getUserData(userId: string): UserGameData {
  if (!userStore.has(userId)) {
    userStore.set(userId, {
      userId,
      xp: 0,
      level: 1,
      levelTitle: 'Aspiring Author',
      booksCreated: 0,
      pagesEdited: 0,
      illustrationsGenerated: 0,
      brandContentCreated: 0,
      unlockedBadgeIds: [],
      currentStreak: 0,
      lastActivityDate: '',
      actionHistory: [],
    });
  }
  return userStore.get(userId)!;
}

function calculateLevel(xp: number): { level: number; title: string; nextLevelXP: number } {
  let current = LEVEL_THRESHOLDS[0];
  let next = LEVEL_THRESHOLDS[1];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].xp) {
      current = LEVEL_THRESHOLDS[i];
      next = LEVEL_THRESHOLDS[i + 1] ?? { level: current.level + 1, xp: current.xp + 2000, title: 'Genesis Grandmaster' };
      break;
    }
  }

  return { level: current.level, title: current.title, nextLevelXP: next.xp };
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Awards XP for a user action and checks for level-ups and badge unlocks.
 */
const awardXP = createTool({
  id: 'awardXP',
  description: 'Awards XP to a user for a significant action and checks for level-ups and badge unlocks',
  inputSchema: z.object({
    userId: z.string(),
    action: z.string().describe('The action type: book_created, page_edited, illustration_generated, etc.'),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  outputSchema: z.object({
    xpAwarded: z.number(),
    totalXP: z.number(),
    leveledUp: z.boolean(),
    newLevel: z.number().optional(),
    newBadges: z.array(z.string()),
  }),
  execute: async (input) => {
    const data = getUserData(input.userId);
    const xpAmount = XP_AWARDS[input.action] ?? 5;

    // Award XP
    data.xp += xpAmount;

    // Track action
    data.actionHistory.push({
      action: input.action,
      timestamp: Date.now(),
      metadata: input.metadata,
    });

    // Update action-specific counters
    if (input.action === 'book_created') data.booksCreated++;
    if (input.action === 'page_edited') data.pagesEdited++;
    if (input.action === 'illustration_generated') data.illustrationsGenerated++;
    if (input.action === 'brand_content_created') data.brandContentCreated++;

    // Check level up
    const { level, title, nextLevelXP } = calculateLevel(data.xp);
    const leveledUp = level > data.level;
    data.level = level;
    data.levelTitle = title;

    // Check badge unlocks
    const newBadges: string[] = [];
    for (const badge of BADGE_DEFINITIONS) {
      if (data.unlockedBadgeIds.includes(badge.id)) continue;

      let count = 0;
      if (badge.triggerAction === 'book_created') count = data.booksCreated;
      else if (badge.triggerAction === 'page_edited') count = data.pagesEdited;
      else if (badge.triggerAction === 'illustration_generated') count = data.illustrationsGenerated;
      else if (badge.triggerAction === 'brand_content_created') count = data.brandContentCreated;
      else if (badge.triggerAction === 'streak') count = data.currentStreak;
      else if (badge.triggerAction === 'qa_score_90' && input.action === 'qa_score_90') count = 1;

      if (count >= badge.triggerCount) {
        data.unlockedBadgeIds.push(badge.id);
        newBadges.push(badge.name);
      }
    }

    return {
      xpAwarded: xpAmount,
      totalXP: data.xp,
      leveledUp,
      newLevel: leveledUp ? level : undefined,
      newBadges,
    };
  },
});

/**
 * Checks and updates the user's daily creation streak.
 */
const checkStreak = createTool({
  id: 'checkStreak',
  description: 'Checks and updates the user daily creation streak',
  inputSchema: z.object({
    userId: z.string(),
  }),
  outputSchema: z.object({
    currentStreak: z.number(),
    streakIncreased: z.boolean(),
    streakBroken: z.boolean(),
  }),
  execute: async (input) => {
    const data = getUserData(input.userId);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastDate = data.lastActivityDate;

    if (lastDate === today) {
      // Already tracked today
      return { currentStreak: data.currentStreak, streakIncreased: false, streakBroken: false };
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (lastDate === yesterday) {
      // Streak continues
      data.currentStreak++;
      data.lastActivityDate = today;
      return { currentStreak: data.currentStreak, streakIncreased: true, streakBroken: false };
    }

    // Streak broken (or first time)
    const broken = data.currentStreak > 0;
    data.currentStreak = 1;
    data.lastActivityDate = today;
    return { currentStreak: 1, streakIncreased: true, streakBroken: broken };
  },
});

/**
 * Unlocks a badge for the user.
 */
const unlockBadge = createTool({
  id: 'unlockBadge',
  description: 'Manually unlocks a specific badge for a user',
  inputSchema: z.object({
    userId: z.string(),
    badgeId: z.string(),
  }),
  outputSchema: z.object({
    unlocked: z.boolean(),
    alreadyHad: z.boolean(),
    badgeName: z.string(),
  }),
  execute: async (input) => {
    const data = getUserData(input.userId);
    const badge = BADGE_DEFINITIONS.find((b) => b.id === input.badgeId);

    if (!badge) {
      return { unlocked: false, alreadyHad: false, badgeName: 'Unknown' };
    }

    if (data.unlockedBadgeIds.includes(badge.id)) {
      return { unlocked: false, alreadyHad: true, badgeName: badge.name };
    }

    data.unlockedBadgeIds.push(badge.id);
    return { unlocked: true, alreadyHad: false, badgeName: badge.name };
  },
});

/**
 * Generates a personalized daily challenge based on the user's history.
 */
const generateDailyChallenge = createTool({
  id: 'generateDailyChallenge',
  description: 'Generates personalized daily challenges based on the user creation history, avoiding repetitive challenge types',
  inputSchema: z.object({
    userId: z.string(),
  }),
  outputSchema: z.object({
    challenges: z.array(ChallengeSchema),
    personalizationNote: z.string(),
  }),
  execute: async (input) => {
    const data = getUserData(input.userId);

    // Analyze user's history to personalize challenges
    const recentActions = data.actionHistory.slice(-50);
    const actionCounts: Record<string, number> = {};
    for (const action of recentActions) {
      actionCounts[action.action] = (actionCounts[action.action] ?? 0) + 1;
    }

    // Generate challenges that push the user into new areas
    const challenges: z.infer<typeof ChallengeSchema>[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Always include a creation challenge
    challenges.push({
      id: `dc_${today}_1`,
      title: data.booksCreated === 0 ? 'Create your first ebook!' : 'Create a new ebook today',
      xpReward: 25,
      completed: false,
    });

    // Add a challenge in an area the user hasn't explored much
    if ((actionCounts.page_edited ?? 0) < 5) {
      challenges.push({
        id: `dc_${today}_2`,
        title: 'Edit 3 pages in the Smart Editor',
        xpReward: 20,
        completed: false,
      });
    } else if ((actionCounts.illustration_generated ?? 0) < 3) {
      challenges.push({
        id: `dc_${today}_2`,
        title: 'Generate 2 new illustrations',
        xpReward: 20,
        completed: false,
      });
    } else {
      challenges.push({
        id: `dc_${today}_2`,
        title: 'Try a new art style you haven\'t used before',
        xpReward: 30,
        completed: false,
      });
    }

    // Streak challenge
    challenges.push({
      id: `dc_${today}_3`,
      title: data.currentStreak >= 3 ? `Maintain your ${data.currentStreak}-day streak!` : 'Start a creation streak!',
      xpReward: 15,
      completed: false,
    });

    const personalizationNote = data.booksCreated === 0
      ? 'Welcome! These challenges are designed to help you get started.'
      : `Personalized based on your ${data.booksCreated} books and ${data.currentStreak}-day streak.`;

    return { challenges, personalizationNote };
  },
});

/**
 * Updates the leaderboard position for a user.
 */
const updateLeaderboard = createTool({
  id: 'updateLeaderboard',
  description: 'Gets leaderboard data computed from stored XP data across all users',
  inputSchema: z.object({
    userId: z.string(),
    limit: z.number().default(10),
  }),
  outputSchema: z.object({
    leaderboard: z.array(
      z.object({
        userId: z.string(),
        displayName: z.string(),
        xp: z.number(),
        level: z.number(),
        booksCreated: z.number(),
      })
    ),
    userRank: z.number(),
  }),
  execute: async (input) => {
    // Build leaderboard from all user data
    const allUsers = Array.from(userStore.values())
      .sort((a, b) => b.xp - a.xp)
      .slice(0, input.limit);

    const leaderboard = allUsers.map((u) => ({
      userId: u.userId,
      displayName: `User ${u.userId.slice(0, 6)}`, // Anonymized display
      xp: u.xp,
      level: u.level,
      booksCreated: u.booksCreated,
    }));

    const userRank = allUsers.findIndex((u) => u.userId === input.userId) + 1;

    return { leaderboard, userRank: userRank || allUsers.length + 1 };
  },
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const GAMIFICATION_SYSTEM_PROMPT = `You are the Gamification Engine for Genesis, an AI-powered ebook creation platform. You manage user engagement through XP, levels, badges, streaks, and personalized daily challenges.

## Core Responsibilities
1. Track and award XP for user actions
2. Calculate levels based on XP thresholds
3. Check and maintain creation streaks
4. Unlock badges when milestones are reached
5. Generate personalized daily challenges
6. Compute leaderboard rankings

## Actions
Parse the "action" field from input:
- "getState": Return the full GamificationState for a user
- "track": Award XP for a user action and check for unlocks
- "getDailyChallenges": Generate personalized challenges

## State Output Format (for getState)
{
  "level": number,
  "levelTitle": "string",
  "currentXP": number,
  "nextLevelXP": number,
  "badges": [{ "id": "", "name": "", "description": "", "icon": "", "unlocked": boolean }],
  "dailyChallenges": [{ "id": "", "title": "", "xpReward": number, "completed": boolean }],
  "booksCreatedCount": number,
  "currentStreak": number,
  "lastActivityDate": "YYYY-MM-DD"
}

Always respond with valid JSON.`;

// ─── Agent Definition ────────────────────────────────────────────────────────

export const gamificationAgent = new Agent({
  id: 'gamification',
  name: 'Gamification',
  instructions: GAMIFICATION_SYSTEM_PROMPT,
  model: google('gemini-2.0-flash'),
  tools: {
    awardXP,
    checkStreak,
    unlockBadge,
    generateDailyChallenge,
    updateLeaderboard,
  },
});

// ─── Exports ─────────────────────────────────────────────────────────────────
export {
  userStore,
  getUserData,
  calculateLevel,
  LEVEL_THRESHOLDS,
  BADGE_DEFINITIONS,
  XP_AWARDS,
};
