import { type GamificationState, UserTier } from '../types';
import { LRUCache, deduplicateRequest } from './performanceOptimizations';
import { supabase } from './supabaseClient';

// PERFORMANCE: Profile cache to prevent repeated DB calls
const profileCache = new LRUCache<string, UserProfile>(500);
const PROFILE_CACHE_TTL = 30000; // 30 seconds
const profileCacheTimestamps = new Map<string, number>();

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  user_tier: UserTier;
  bio: string | null;
  default_style: string | null;
  creativity_temperature: number | null;
  email_notifications: boolean | null;
  marketing_emails: boolean | null;
  is_public: boolean | null;
  data_sharing_enabled: boolean | null;
  gamification_data: GamificationState;
  payment_provider?: string | null;
  subscription_status?: string | null;
  dodo_subscription_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Minimal default gamification state for new profiles.
 * Badges and challenges are intentionally empty — they are populated
 * at runtime from user_gamification + achievement_definitions DB tables.
 */
const defaultGamificationData: GamificationState = {
  level: 1,
  levelTitle: 'Aspiring Author',
  currentXP: 0,
  nextLevelXP: 100,
  booksCreatedCount: 0,
  currentStreak: 0,
  badges: [],          // Populated from achievement_definitions table
  dailyChallenges: [], // Populated from daily_challenge_pool via assign_daily_challenges()
};

/**
 * Ensure user profile exists, create if not
 */
export const ensureUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('[ProfileService] No authenticated user');
      return null;
    }

    console.log('[ProfileService] Ensuring profile exists for:', user.email);

    // First, try to get existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile) {
      console.log('[ProfileService] Profile exists:', existingProfile.email);

      // Patch missing fields from auth metadata (trigger may have missed avatar_url/full_name)
      const updates: Record<string, any> = {};
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
      const metaAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;

      if (!existingProfile.full_name && metaName) updates.full_name = metaName;
      if (!existingProfile.display_name && (metaName || existingProfile.full_name))
        updates.display_name = metaName || existingProfile.full_name;
      if (!existingProfile.avatar_url && metaAvatar) updates.avatar_url = metaAvatar;

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        console.log('[ProfileService] Patching missing profile fields:', Object.keys(updates));
        await supabase.from('profiles').update(updates).eq('id', user.id);
        // Re-fetch after patch
        const { data: patchedProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (patchedProfile) {
          invalidateProfileCache(user.id);
          return patchedProfile as UserProfile;
        }
      }

      return existingProfile as UserProfile;
    }

    // Profile doesn't exist, create it
    console.log('[ProfileService] Creating new profile for:', user.email);

    const derivedName =
        user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];

    const newProfile = {
      id: user.id,
      email: user.email,
      full_name: derivedName,
      display_name: derivedName,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      user_tier: UserTier.SPARK,
      gamification_data: defaultGamificationData,
    };

    const { data: createdProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    if (insertError) {
      console.error('[ProfileService] Error creating profile:', insertError);

      // If it's a duplicate key error, the trigger already created it
      if (insertError.code === '23505') {
        console.log('[ProfileService] Profile was created by trigger, fetching...');
        const { data: triggerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        return triggerProfile as UserProfile;
      }
      return null;
    }

    console.log('[ProfileService] Profile created successfully');
    return createdProfile as UserProfile;
  } catch (error) {
    console.error('[ProfileService] Error in ensureUserProfile:', error);
    return null;
  }
};

/**
 * Fetch the current user's profile from Supabase
 * PERFORMANCE: Cached and deduplicated for scalability
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('[ProfileService] No authenticated user');
      return null;
    }

    // PERFORMANCE: Check cache first
    const cachedProfile = profileCache.get(user.id);
    const cacheTimestamp = profileCacheTimestamps.get(user.id);
    if (cachedProfile && cacheTimestamp && Date.now() - cacheTimestamp < PROFILE_CACHE_TTL) {
      return cachedProfile;
    }

    // PERFORMANCE: Deduplicate concurrent requests for same user
    return deduplicateRequest(
      `profile:${user.id}`,
      async () => {
        console.log('[ProfileService] Fetching profile for:', user.email);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[ProfileService] Error fetching profile:', error);
          return null;
        }

        if (!data) {
          console.log('[ProfileService] Profile not found, creating...');
          return await ensureUserProfile();
        }

        console.log('[ProfileService] Profile found:', data.email);
        const profile = data as UserProfile;

        // PERFORMANCE: Cache the result
        profileCache.set(user.id, profile);
        profileCacheTimestamps.set(user.id, Date.now());

        return profile;
      },
      5000
    ); // 5 second deduplication window
  } catch (error) {
    console.error('[ProfileService] Error in getUserProfile:', error);
    return null;
  }
};

/**
 * PERFORMANCE: Clear profile cache after updates
 */
export const invalidateProfileCache = (userId: string): void => {
  profileCache.delete(userId);
  profileCacheTimestamps.delete(userId);
};

/**
 * Update user profile fields (display name, bio, avatar, etc.)
 * This is the ONLY function that should be used to persist user-edited profile data.
 */
export const updateUserProfile = async (
  updates: {
    full_name?: string;
    display_name?: string;
    avatar_url?: string | null;
    bio?: string;
    email?: string;
    default_style?: string;
    creativity_temperature?: number;
    email_notifications?: boolean;
    marketing_emails?: boolean;
    is_public?: boolean;
    data_sharing_enabled?: boolean;
  }
): Promise<UserProfile | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[ProfileService] No authenticated user for profile update');
      return null;
    }

    // If display_name is updated, sync full_name too (keep them consistent)
    const syncedUpdates = { ...updates, updated_at: new Date().toISOString() };
    if (updates.display_name && !updates.full_name) {
      syncedUpdates.full_name = updates.display_name;
    }
    if (updates.full_name && !updates.display_name) {
      syncedUpdates.display_name = updates.full_name;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(syncedUpdates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[ProfileService] Error updating profile:', error);
      return null;
    }

    // Invalidate cache so next read gets fresh data
    invalidateProfileCache(user.id);

    console.log('[ProfileService] Profile updated successfully');
    return data as UserProfile;
  } catch (error) {
    console.error('[ProfileService] Error in updateUserProfile:', error);
    return null;
  }
};

/**
 * Update the user's tier (e.g., after subscription)
 */
export const updateUserTier = async (tier: UserTier): Promise<boolean> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { error } = await supabase.from('profiles').update({ user_tier: tier }).eq('id', user.id);

    if (error) {
      console.error('Error updating user tier:', error);
      return false;
    }

    // PERFORMANCE: Invalidate cache after update
    invalidateProfileCache(user.id);
    return true;
  } catch (error) {
    console.error('Error in updateUserTier:', error);
    return false;
  }
};

/**
 * Update the user's gamification data
 */
export const updateGamificationData = async (
  gamificationData: GamificationState
): Promise<boolean> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ gamification_data: gamificationData })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating gamification data:', error);
      return false;
    }

    // PERFORMANCE: Invalidate cache after update
    invalidateProfileCache(user.id);
    return true;
  } catch (error) {
    console.error('Error in updateGamificationData:', error);
    return false;
  }
};

/**
 * Award XP for an action — delegates to /api/agents/gamification/track.
 * Level titles and XP thresholds come from the DB (level_definitions table).
 * @deprecated Use mastra.agents.gamification.trackAction() for new code.
 */
export const addXP = async (_xpToAdd: number, action = 'suggestion_accepted'): Promise<GamificationState | null> => {
  try {
    const { mastra } = await import('../src/services/mastraClient');
    await mastra.agents.gamification.trackAction(action);
    // Re-fetch profile so caller gets updated numbers
    invalidateProfileCache((await supabase.auth.getUser()).data.user?.id ?? '');
    const profile = await getUserProfile();
    return profile?.gamification_data ?? null;
  } catch (error) {
    console.error('Error in addXP:', error);
    return null;
  }
};

/**
 * Track a book_created action — delegates to /api/agents/gamification/track.
 */
export const incrementBooksCreated = async (): Promise<boolean> => {
  try {
    const { mastra } = await import('../src/services/mastraClient');
    await mastra.agents.gamification.trackAction('book_created');
    invalidateProfileCache((await supabase.auth.getUser()).data.user?.id ?? '');
    return true;
  } catch (error) {
    console.error('Error in incrementBooksCreated:', error);
    return false;
  }
};

/**
 * Unlock a badge — now handled server-side by /api/agents/gamification/track.
 * This stub exists for backward compatibility.
 */
export const unlockBadge = async (_badgeId: string): Promise<boolean> => {
  // Badge unlocking is now automatic in the track endpoint via auto-unlock logic.
  // No client-side badge array mutation needed.
  return true;
};

/**
 * Complete a daily challenge
 */
export const completeChallenge = async (challengeId: string): Promise<boolean> => {
  try {
    const profile = await getUserProfile();
    if (!profile) return false;

    // Find the challenge first to get XP reward
    const challenge = profile.gamification_data.dailyChallenges.find((c) => c.id === challengeId);
    if (!challenge) {
      console.warn(`Challenge with id ${challengeId} not found`);
      return false;
    }

    // Skip if already completed
    if (challenge.completed) {
      console.warn(`Challenge ${challengeId} is already completed`);
      return true;
    }

    // Award XP first (this updates the profile)
    if (challenge.xpReward > 0) {
      await addXP(challenge.xpReward);
    }

    // Mark challenge complete in DB and award XP via backend
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    await supabase
      .from('user_daily_challenges')
      .update({ completed: true, completed_at: new Date().toISOString(), xp_awarded: challenge.xpReward })
      .eq('user_id', user.id)
      .eq('challenge_id', challengeId)
      .eq('challenge_date', new Date().toISOString().slice(0, 10));

    if (challenge.xpReward > 0) {
      const { mastra } = await import('../src/services/mastraClient');
      await mastra.agents.gamification.trackAction('daily_challenge_completed');
    }

    invalidateProfileCache(user.id);
    return true;
  } catch (error) {
    console.error('Error in completeChallenge:', error);
    return false;
  }
};
