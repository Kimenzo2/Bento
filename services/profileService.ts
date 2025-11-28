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
 * Fetch the current user's profile from Supabase
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('No authenticated user');
            return null;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }

        return data as UserProfile;
    } catch (error) {
        console.error('Error in getUserProfile:', error);
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

        const challenges = profile.gamification_data.dailyChallenges.map(challenge =>
            challenge.id === challengeId ? { ...challenge, completed: true } : challenge
        );

        const updatedGamification: GamificationState = {
            ...profile.gamification_data,
            dailyChallenges: challenges
        };

        // Award XP for completing the challenge
        const challenge = profile.gamification_data.dailyChallenges.find(c => c.id === challengeId);
        if (challenge) {
            await addXP(challenge.xpReward);
        }

        return await updateGamificationData(updatedGamification);
    } catch (error) {
        console.error('Error in completeChallenge:', error);
        return false;
    }
};
