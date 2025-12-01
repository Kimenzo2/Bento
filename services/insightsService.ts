// ==============================================================================
// GENESIS INSIGHTS SERVICE
// ==============================================================================
// Creative analytics, trend detection, and personalized recommendations
// ==============================================================================

import { supabase } from './supabaseClient';
import {
    UserInsights,
    CreativeMetrics,
    TrendingStyle,
    Recommendation,
    StyleAnalysis,
    TimeOfDayAnalysis,
    EngagementPattern
} from '../types/advanced';

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class InsightsService {
    private insightsCache: Map<string, { data: UserInsights; expiry: number }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // ─────────────────────────────────────────────────────────────────────────
    // USER INSIGHTS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get comprehensive user insights
     */
    async getUserInsights(userId?: string): Promise<UserInsights | null> {
        const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
        if (!targetUserId) return null;

        // Check cache
        const cached = this.insightsCache.get(targetUserId);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }

        // Fetch from database
        const { data, error } = await supabase
            .from('user_insights')
            .select('*')
            .eq('user_id', targetUserId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No insights yet, generate fresh
                return this.generateInsights(targetUserId);
            }
            console.error('Error fetching insights:', error);
            return null;
        }

        // Cache the result
        this.insightsCache.set(targetUserId, {
            data,
            expiry: Date.now() + this.CACHE_DURATION
        });

        return data;
    }

    /**
     * Generate fresh insights for a user
     */
    async generateInsights(userId: string): Promise<UserInsights | null> {
        const [
            creativeMetrics,
            styleAnalysis,
            timeAnalysis,
            engagementPatterns,
            recommendations
        ] = await Promise.all([
            this.calculateCreativeMetrics(userId),
            this.analyzeStyles(userId),
            this.analyzeTimePatterns(userId),
            this.analyzeEngagement(userId),
            this.generateRecommendations(userId)
        ]);

        const insights: Partial<UserInsights> = {
            user_id: userId,
            total_visuals: creativeMetrics.total_visuals,
            total_reactions_received: creativeMetrics.total_reactions,
            total_remixes: creativeMetrics.total_remixes,
            streak_days: creativeMetrics.streak_days,
            best_streak: creativeMetrics.best_streak,
            challenges_won: creativeMetrics.challenges_won,
            challenges_participated: creativeMetrics.challenges_participated,
            favorite_styles: styleAnalysis.favorite_styles,
            favorite_subjects: styleAnalysis.favorite_subjects,
            peak_creative_hours: timeAnalysis.peak_hours,
            avg_generation_time: creativeMetrics.avg_generation_time,
            style_diversity_score: styleAnalysis.diversity_score,
            engagement_rate: engagementPatterns.engagement_rate,
            weekly_summary: await this.generateWeeklySummary(userId),
            recommendations: recommendations,
            calculated_at: new Date().toISOString()
        };

        // Upsert insights
        const { data, error } = await supabase
            .from('user_insights')
            .upsert(insights)
            .select()
            .single();

        if (error) {
            console.error('Error saving insights:', error);
            return null;
        }

        // Update cache
        this.insightsCache.set(userId, {
            data,
            expiry: Date.now() + this.CACHE_DURATION
        });

        return data;
    }

    /**
     * Calculate creative metrics
     */
    private async calculateCreativeMetrics(userId: string): Promise<CreativeMetrics> {
        // Get total visuals count
        const { count: totalVisuals } = await supabase
            .from('visual_generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Get shared visuals and reactions
        const { data: sharedVisuals } = await supabase
            .from('shared_visuals')
            .select('id, reaction_count, remix_count')
            .eq('creator_id', userId);

        const totalReactions = sharedVisuals?.reduce((sum: number, v: { reaction_count?: number }) => sum + (v.reaction_count || 0), 0) || 0;
        const totalRemixes = sharedVisuals?.reduce((sum: number, v: { remix_count?: number }) => sum + (v.remix_count || 0), 0) || 0;

        // Calculate streak
        const { data: dailyActivity } = await supabase
            .from('visual_generations')
            .select('created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        const { currentStreak, bestStreak } = this.calculateStreak(
            dailyActivity?.map((d: { created_at: string }) => d.created_at) || []
        );

        // Get challenge stats
        const { count: challengesParticipated } = await supabase
            .from('challenge_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: challengesWon } = await supabase
            .from('challenge_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_winner', true);

        // Calculate average generation time (from generations that have timing data)
        const { data: timingData } = await supabase
            .from('visual_generations')
            .select('generation_time_ms')
            .eq('user_id', userId)
            .not('generation_time_ms', 'is', null);

        const avgTime = timingData?.length
            ? timingData.reduce((sum: number, d: { generation_time_ms: number }) => sum + d.generation_time_ms, 0) / timingData.length
            : 0;

        return {
            total_visuals: totalVisuals || 0,
            total_reactions: totalReactions,
            total_remixes: totalRemixes,
            streak_days: currentStreak,
            best_streak: bestStreak,
            challenges_won: challengesWon || 0,
            challenges_participated: challengesParticipated || 0,
            avg_generation_time: Math.round(avgTime)
        };
    }

    /**
     * Calculate creation streak
     */
    private calculateStreak(dates: string[]): { currentStreak: number; bestStreak: number } {
        if (dates.length === 0) return { currentStreak: 0, bestStreak: 0 };

        // Group by day
        const days = new Set(dates.map(d => new Date(d).toISOString().split('T')[0]));
        const sortedDays = Array.from(days).sort().reverse();

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        let prevDay: Date | null = null;

        for (const dayStr of sortedDays) {
            const day = new Date(dayStr);
            
            if (prevDay === null) {
                // First day - check if it's today or yesterday
                if (dayStr === today || dayStr === yesterday) {
                    tempStreak = 1;
                } else {
                    // Streak broken
                    tempStreak = 0;
                }
            } else {
                const diff = (prevDay.getTime() - day.getTime()) / 86400000;
                if (diff === 1) {
                    tempStreak++;
                } else {
                    // Streak broken
                    if (currentStreak === 0 && (sortedDays[0] === today || sortedDays[0] === yesterday)) {
                        currentStreak = tempStreak;
                    }
                    bestStreak = Math.max(bestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
            prevDay = day;
        }

        // Final check
        if (currentStreak === 0 && (sortedDays[0] === today || sortedDays[0] === yesterday)) {
            currentStreak = tempStreak;
        }
        bestStreak = Math.max(bestStreak, tempStreak);

        return { currentStreak, bestStreak };
    }

    /**
     * Analyze style preferences
     */
    private async analyzeStyles(userId: string): Promise<StyleAnalysis> {
        const { data } = await supabase
            .from('visual_generations')
            .select('settings')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!data || data.length === 0) {
            return {
                favorite_styles: [],
                favorite_subjects: [],
                diversity_score: 0
            };
        }

        // Extract and count styles
        const styleCounts: Record<string, number> = {};
        const subjectCounts: Record<string, number> = {};

        for (const item of data) {
            const settings = item.settings as any;
            if (settings?.style) {
                styleCounts[settings.style] = (styleCounts[settings.style] || 0) + 1;
            }
            if (settings?.subject_tags) {
                for (const tag of settings.subject_tags) {
                    subjectCounts[tag] = (subjectCounts[tag] || 0) + 1;
                }
            }
        }

        // Sort and get top items
        const favoriteStyles = Object.entries(styleCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([style]) => style);

        const favoriteSubjects = Object.entries(subjectCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([subject]) => subject);

        // Calculate diversity score (0-100)
        const uniqueStyles = Object.keys(styleCounts).length;
        const diversityScore = Math.min(100, (uniqueStyles / Math.max(1, data.length)) * 500);

        return {
            favorite_styles: favoriteStyles,
            favorite_subjects: favoriteSubjects,
            diversity_score: Math.round(diversityScore)
        };
    }

    /**
     * Analyze time patterns
     */
    private async analyzeTimePatterns(userId: string): Promise<TimeOfDayAnalysis> {
        const { data } = await supabase
            .from('visual_generations')
            .select('created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (!data || data.length === 0) {
            return { peak_hours: [], most_active_day: null };
        }

        // Count by hour
        const hourCounts: Record<number, number> = {};
        const dayCounts: Record<number, number> = {};

        for (const item of data) {
            const date = new Date(item.created_at);
            const hour = date.getHours();
            const day = date.getDay();

            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        }

        // Find peak hours (top 3)
        const peakHours = Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => parseInt(hour));

        // Find most active day
        const mostActiveDay = Object.entries(dayCounts)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            peak_hours: peakHours,
            most_active_day: mostActiveDay ? parseInt(mostActiveDay[0]) : null
        };
    }

    /**
     * Analyze engagement patterns
     */
    private async analyzeEngagement(userId: string): Promise<EngagementPattern> {
        const { data: visuals } = await supabase
            .from('shared_visuals')
            .select('view_count, reaction_count, comment_count, created_at')
            .eq('creator_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (!visuals || visuals.length === 0) {
            return { engagement_rate: 0, best_performing_type: null };
        }

        // Calculate engagement rate
        type VisualData = { view_count?: number; reaction_count?: number; comment_count?: number };
        const totalViews = visuals.reduce((sum: number, v: VisualData) => sum + (v.view_count || 0), 0);
        const totalEngagements = visuals.reduce((sum: number, v: VisualData) => 
            sum + (v.reaction_count || 0) + (v.comment_count || 0), 0);

        const engagementRate = totalViews > 0 
            ? Math.round((totalEngagements / totalViews) * 100) 
            : 0;

        return {
            engagement_rate: engagementRate,
            best_performing_type: null // Would need more data to determine
        };
    }

    /**
     * Generate weekly summary
     */
    private async generateWeeklySummary(userId: string): Promise<Record<string, any>> {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get this week's stats
        const [visuals, reactions, follows] = await Promise.all([
            supabase
                .from('visual_generations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', weekAgo),
            supabase
                .from('reactions')
                .select('visual:shared_visuals!inner(creator_id)', { count: 'exact', head: true })
                .eq('shared_visuals.creator_id', userId)
                .gte('created_at', weekAgo),
            supabase
                .from('user_follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', userId)
                .gte('created_at', weekAgo)
        ]);

        return {
            visuals_created: visuals.count || 0,
            reactions_received: reactions.count || 0,
            new_followers: follows.count || 0,
            week_start: weekAgo
        };
    }

    /**
     * Generate personalized recommendations
     */
    async generateRecommendations(userId: string): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];

        // Get user's recent activity
        const [insights, trendingStyles] = await Promise.all([
            this.getUserInsights(userId),
            this.getTrendingStyles()
        ]);

        // Recommend trying trending styles
        const userStyles = new Set(insights?.favorite_styles || []);
        for (const trend of trendingStyles.slice(0, 3)) {
            const styleName = trend.style_name || trend.style || 'Unknown';
            if (!userStyles.has(styleName)) {
                recommendations.push({
                    type: 'try_style',
                    title: `Try "${styleName}" style`,
                    description: `This style is trending with ${trend.usage_count} creations this week!`,
                    action: { type: 'apply_style', style: styleName },
                    priority: 'medium'
                });
            }
        }

        // Recommend based on streak
        if (insights && insights.streak_days > 0 && insights.streak_days < 7) {
            recommendations.push({
                type: 'maintain_streak',
                title: `Keep your ${insights.streak_days}-day streak going!`,
                description: `You're building momentum. Create something today to continue your streak!`,
                action: { type: 'create' },
                priority: 'high'
            });
        }

        // Recommend challenges
        const { data: activeChallenges } = await supabase
            .from('challenges')
            .select('id, title')
            .eq('status', 'active')
            .limit(1);

        if (activeChallenges?.length) {
            const challenge = activeChallenges[0];
            recommendations.push({
                type: 'join_challenge',
                title: `Join the "${challenge.title}" challenge`,
                description: 'Compete with other creators and earn rewards!',
                action: { type: 'open_challenge', challenge_id: challenge.id },
                priority: 'medium'
            });
        }

        // Recommend sharing if user has unsahred work
        const { count: unsharedCount } = await supabase
            .from('visual_generations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_shared', false);

        if (unsharedCount && unsharedCount > 5) {
            recommendations.push({
                type: 'share',
                title: `Share your creations`,
                description: `You have ${unsharedCount} unshard visuals. Share them to get feedback!`,
                action: { type: 'open_gallery' },
                priority: 'low'
            });
        }

        return recommendations;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRENDING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get trending styles
     */
    async getTrendingStyles(limit: number = 10): Promise<TrendingStyle[]> {
        const { data, error } = await supabase
            .from('trending_styles')
            .select('*')
            .order('usage_count', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching trending styles:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get trending prompts/subjects
     */
    async getTrendingSubjects(limit: number = 10): Promise<Array<{ subject: string; count: number }>> {
        // This would ideally be a materialized view or cached query
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data } = await supabase
            .from('visual_tags')
            .select('tag')
            .gte('created_at', weekAgo);

        if (!data) return [];

        // Count tags
        const counts: Record<string, number> = {};
        for (const item of data) {
            counts[item.tag] = (counts[item.tag] || 0) + 1;
        }

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([subject, count]) => ({ subject, count }));
    }

    /**
     * Update trending styles (called periodically)
     */
    async updateTrendingStyles(): Promise<void> {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data } = await supabase
            .from('visual_generations')
            .select('settings')
            .gte('created_at', weekAgo);

        if (!data) return;

        // Count styles
        const styleCounts: Record<string, number> = {};
        for (const item of data) {
            const style = (item.settings as any)?.style;
            if (style) {
                styleCounts[style] = (styleCounts[style] || 0) + 1;
            }
        }

        // Calculate growth rate (would need historical data)
        const trendingData = Object.entries(styleCounts).map(([style, count]) => ({
            style_name: style,
            usage_count: count,
            growth_rate: 0, // Would calculate from historical data
            sample_visuals: [],
            calculated_at: new Date().toISOString()
        }));

        // Upsert trending styles
        if (trendingData.length > 0) {
            await supabase
                .from('trending_styles')
                .upsert(trendingData, { onConflict: 'style_name' });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPARISONS & BENCHMARKS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get user ranking among all users
     */
    async getUserRanking(
        userId: string,
        metric: 'visuals' | 'reactions' | 'streak' | 'challenges'
    ): Promise<{ rank: number; total: number; percentile: number }> {
        const metricColumn = {
            visuals: 'total_visuals',
            reactions: 'total_reactions_received',
            streak: 'streak_days',
            challenges: 'challenges_won'
        }[metric];

        const userInsights = await this.getUserInsights(userId);
        if (!userInsights) {
            return { rank: 0, total: 0, percentile: 0 };
        }

        const userValue = userInsights[metricColumn as keyof UserInsights] as number;

        // Count users with higher values
        const { count: higherCount } = await supabase
            .from('user_insights')
            .select('*', { count: 'exact', head: true })
            .gt(metricColumn, userValue);

        // Count total users
        const { count: totalUsers } = await supabase
            .from('user_insights')
            .select('*', { count: 'exact', head: true });

        const rank = (higherCount || 0) + 1;
        const total = totalUsers || 1;
        const percentile = Math.round(((total - rank) / total) * 100);

        return { rank, total, percentile };
    }

    /**
     * Compare user to community averages
     */
    async getComparisonToAverage(userId: string): Promise<Record<string, { user: number; average: number; difference: number }>> {
        const userInsights = await this.getUserInsights(userId);
        if (!userInsights) return {};

        // Get community averages
        const { data: allInsights } = await supabase
            .from('user_insights')
            .select('total_visuals, total_reactions_received, streak_days, style_diversity_score');

        if (!allInsights || allInsights.length === 0) return {};

        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

        type InsightData = { total_visuals?: number; total_reactions_received?: number; streak_days?: number; style_diversity_score?: number };

        const metrics = {
            total_visuals: {
                user: userInsights.total_visuals,
                average: avg(allInsights.map((i: InsightData) => i.total_visuals || 0))
            },
            reactions_received: {
                user: userInsights.total_reactions_received,
                average: avg(allInsights.map((i: InsightData) => i.total_reactions_received || 0))
            },
            streak_days: {
                user: userInsights.streak_days,
                average: avg(allInsights.map((i: InsightData) => i.streak_days || 0))
            },
            style_diversity: {
                user: userInsights.style_diversity_score,
                average: avg(allInsights.map((i: InsightData) => i.style_diversity_score || 0))
            }
        };

        // Add difference percentage
        return Object.fromEntries(
            Object.entries(metrics).map(([key, val]) => [
                key,
                {
                    ...val,
                    difference: val.average > 0 
                        ? Math.round(((val.user - val.average) / val.average) * 100)
                        : 0
                }
            ])
        );
    }

    /**
     * Clear insights cache
     */
    clearCache(userId?: string): void {
        if (userId) {
            this.insightsCache.delete(userId);
        } else {
            this.insightsCache.clear();
        }
    }
}

export const insightsService = new InsightsService();
export default insightsService;
