import { supabase } from './supabaseClient';
import { UserTier, GamificationState } from '../types';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    user_tier: UserTier;
    gamification_data: GamificationState;
    created_at: string;
    updated_at: string;
}

/**
 * Default gamification state for new users
 */
const defaultGamificationData: GamificationState = {
    level: 1,
    levelTitle: "Novice Author",
    currentXP: 0,
    nextLevelXP: 100,
    booksCreatedCount: 0,
    badges: [
        { id: '1', name: "First Spark", description: "Create your first book", icon: "rocket", unlocked: false },
        { id: '2', name: "Style Explorer", description: "Try 3 different styles", icon: "palette", unlocked: false },
        { id: '3', name: "Wordsmith", description: "Write 5,000 words", icon: "feather", unlocked: false },
        { id: '4', name: "Bestseller", description: "Get 1,000 views", icon: "diamond", unlocked: false }
    ],
    dailyChallenges: [
        { id: 'c1', title: "Create a Children's Book", xpReward: 50, completed: false },
        { id: 'c2', title: "Try a new Art Style", xpReward: 75, completed: false },
        { id: 'c3', title: "Share a book", xpReward: 100, completed: false }
    ]
};

/**
 * Ensure user profile exists, create if not
 */
export const ensureUserProfile = async (): Promise<UserProfile | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
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
            return existingProfile as UserProfile;
        }

        // Profile doesn't exist, create it
        console.log('[ProfileService] Creating new profile for:', user.email);
        
        const newProfile = {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
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
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('[ProfileService] No authenticated user');
            return null;
        }

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
        return data as UserProfile;
    } catch (error) {
        console.error('[ProfileService] Error in getUserProfile:', error);
        return null;
    }
};

/**
 * Update the user's tier (e.g., after subscription)
 */
export const updateUserTier = async (tier: UserTier): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return false;

        const { error } = await supabase
            .from('profiles')
            .update({ user_tier: tier })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating user tier:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in updateUserTier:', error);
        return false;
    }
};

/**
 * Update the user's gamification data
 */
export const updateGamificationData = async (gamificationData: GamificationState): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return false;

        const { error } = await supabase
            .from('profiles')
            .update({ gamification_data: gamificationData })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating gamification data:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in updateGamificationData:', error);
        return false;
    }
};

/**
 * Increment user XP and update level if needed
 */
export const addXP = async (xpToAdd: number): Promise<GamificationState | null> => {
    try {
        const profile = await getUserProfile();
        if (!profile) return null;

        const currentGamification = profile.gamification_data;
        let newXP = currentGamification.currentXP + xpToAdd;
        let newLevel = currentGamification.level;
        let newLevelTitle = currentGamification.levelTitle;
        let newNextLevelXP = currentGamification.nextLevelXP;

        // Level up logic
        while (newXP >= newNextLevelXP) {
            newXP -= newNextLevelXP;
            newLevel++;
            newNextLevelXP = Math.floor(newNextLevelXP * 1.5); // Exponential growth

            // Update level titles
            if (newLevel === 2) newLevelTitle = 'Rising Author';
            else if (newLevel === 3) newLevelTitle = 'Skilled Storyteller';
            else if (newLevel === 5) newLevelTitle = 'Master Creator';
            else if (newLevel === 10) newLevelTitle = 'Publishing Legend';
            else newLevelTitle = `Level ${newLevel} Author`;
        }

        const updatedGamification: GamificationState = {
            ...currentGamification,
            level: newLevel,
            levelTitle: newLevelTitle,
            currentXP: newXP,
            nextLevelXP: newNextLevelXP
        };

        const success = await updateGamificationData(updatedGamification);
        return success ? updatedGamification : null;
    } catch (error) {
        console.error('Error in addXP:', error);
        return null;
    }
};

/**
 * Increment books created count
 */
export const incrementBooksCreated = async (): Promise<boolean> => {
    try {
        const profile = await getUserProfile();
        if (!profile) return false;

        const updatedGamification: GamificationState = {
            ...profile.gamification_data,
            booksCreatedCount: profile.gamification_data.booksCreatedCount + 1
        };

        return await updateGamificationData(updatedGamification);
    } catch (error) {
        console.error('Error in incrementBooksCreated:', error);
        return false;
    }
};

/**
 * Unlock a badge for the user
 */
export const unlockBadge = async (badgeId: string): Promise<boolean> => {
    try {
        const profile = await getUserProfile();
        if (!profile) return false;

        const badges = profile.gamification_data.badges.map(badge =>
            badge.id === badgeId ? { ...badge, unlocked: true } : badge
        );

        const updatedGamification: GamificationState = {
            ...profile.gamification_data,
            badges
        };

        return await updateGamificationData(updatedGamification);
    } catch (error) {
        console.error('Error in unlockBadge:', error);
        return false;
    }
};

/**
 * Complete a daily challenge
 */
export const completeChallenge = async (challengeId: string): Promise<boolean> => {
    try {
        const profile = await getUserProfile();
        if (!profile) return false;

        // Find the challenge first to get XP reward
        const challenge = profile.gamification_data.dailyChallenges.find(c => c.id === challengeId);
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

        // Fetch the updated profile after XP was added
        const updatedProfile = await getUserProfile();
        if (!updatedProfile) return false;

        // Now update the challenge completion status
        const challenges = updatedProfile.gamification_data.dailyChallenges.map(c =>
            c.id === challengeId ? { ...c, completed: true } : c
        );

        const updatedGamification: GamificationState = {
            ...updatedProfile.gamification_data,
            dailyChallenges: challenges
        };

        return await updateGamificationData(updatedGamification);
    } catch (error) {
        console.error('Error in completeChallenge:', error);
        return false;
    }
};
