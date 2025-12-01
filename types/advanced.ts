// ==============================================================================
// GENESIS ADVANCED FEATURES - TYPE DEFINITIONS
// ==============================================================================
// Types for Live Broadcasting, Notifications, Insights, Version Control
// ==============================================================================

import { CollaboratorProfile } from './collaboration';

// ─────────────────────────────────────────────────────────────────────────────
// LIVE BROADCASTING TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type BroadcastStatus = 'scheduled' | 'live' | 'ended' | 'recorded';
export type BroadcastMessageType = 'chat' | 'question' | 'tip' | 'system' | 'highlight';
export type MentorshipStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface BroadcastSettings {
    chat_enabled: boolean;
    questions_enabled: boolean;
    copy_settings_enabled: boolean;
    max_viewers: number;
    is_private: boolean;
    notification_sent: boolean;
    recording_enabled?: boolean;
    tips_enabled?: boolean;
}

export interface BroadcastSession {
    id: string;
    broadcaster_id: string;
    title: string;
    description?: string;
    status: BroadcastStatus;
    viewer_count: number;
    max_viewers: number;
    started_at?: string;
    ended_at?: string;
    scheduled_for?: string;
    recording_url?: string;
    thumbnail_url?: string;
    settings: BroadcastSettings;
    tags: string[];
    created_at: string;
    updated_at: string;
    
    // Joined data
    broadcaster?: CollaboratorProfile;
    is_following?: boolean;
}

export interface BroadcastViewer {
    id: string;
    session_id: string;
    viewer_id: string;
    joined_at: string;
    left_at?: string;
    is_active: boolean;
    watch_duration: number;
    interactions: number;
    
    // Joined data
    viewer?: CollaboratorProfile;
}

export interface BroadcastMessage {
    id: string;
    session_id: string;
    user_id: string;
    message: string;
    type: BroadcastMessageType;
    is_pinned: boolean;
    is_answered: boolean;
    parent_id?: string;
    metadata: Record<string, unknown>;
    created_at: string;
    
    // Joined data
    user?: CollaboratorProfile;
    replies?: BroadcastMessage[];
}

export interface MentorRelationship {
    id: string;
    mentor_id: string;
    apprentice_id: string;
    status: MentorshipStatus;
    goals?: string;
    notes?: string;
    started_at: string;
    completed_at?: string;
    
    // Joined data
    mentor?: CollaboratorProfile;
    apprentice?: CollaboratorProfile;
}

export interface UserFollow {
    id: string;
    follower_id: string;
    following_id: string;
    created_at: string;
    notifications_enabled: boolean;
}

export interface BroadcastBookmark {
    id: string;
    session_id: string;
    user_id: string;
    timestamp_seconds: number;
    title?: string;
    notes?: string;
    created_at: string;
}

// Broadcast actions streamed to viewers
export type BroadcastActionType = 
    | 'prompt_change'
    | 'style_change'
    | 'setting_change'
    | 'generation_start'
    | 'generation_complete'
    | 'tab_switch'
    | 'cursor_move'
    | 'highlight_area'
    | 'voice_note';

export interface BroadcastAction {
    type: BroadcastActionType;
    data: Record<string, unknown>;
    timestamp: number;
}

export interface ViewerState {
    current_prompt: string;
    current_settings: Record<string, unknown>;
    current_tab: string;
    synced_at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType = 
    | 'remix'
    | 'reaction'
    | 'comment'
    | 'mention'
    | 'follow'
    | 'follower'
    | 'broadcast'
    | 'broadcast_live'
    | 'broadcast_scheduled'
    | 'challenge'
    | 'challenge_new'
    | 'challenge_ending'
    | 'challenge_won'
    | 'milestone'
    | 'trend_alert'
    | 'insight'
    | 'collaboration'
    | 'mentorship_request'
    | 'mentorship_accepted'
    | 'lesson_available'
    | 'weekly_digest'
    | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type DigestFrequency = 'realtime' | 'daily' | 'weekly' | 'never';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    action_url?: string;
    metadata: Record<string, unknown>;
    is_read: boolean;
    is_archived: boolean;
    priority: NotificationPriority;
    grouped_with?: string;
    created_at: string;
    expires_at?: string;
    read_at?: string;
}

export interface QuietHours {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;
    timezone: string;
}

export interface NotificationPreferences {
    id?: string;
    user_id: string;
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
    broadcast_live: boolean;
    challenge_reminders: boolean;
    social_interactions: boolean;
    mentorship_updates: boolean;
    weekly_digest: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    quiet_hours_enabled: boolean;
    digest_frequency?: DigestFrequency;
    enabled_types?: NotificationType[];
    quiet_hours?: QuietHours;
    sound_enabled?: boolean;
    created_at?: string;
    updated_at: string;
}

export interface NotificationGroup {
    type: NotificationType;
    count: number;
    latest: Notification;
    notifications: Notification[];
    summary_title: string;
    summary_message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVE INSIGHTS TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type InsightPeriodType = 'week' | 'month' | 'year';

export interface UserInsightsMetrics {
    visuals_created: number;
    visuals_created_change: number; // % change from previous period
    total_reactions: number;
    reactions_change: number;
    remix_count: number;
    remix_count_change: number;
    most_used_style: string;
    most_popular_visual_id?: string;
    average_reactions_per_visual: number;
    uniqueness_score: number; // 0-100
    community_rank_percentile: number; // 0-100
    active_days: number;
    streak_days: number;
}

export interface UserInsights {
    id?: string;
    user_id: string;
    period_type?: InsightPeriodType;
    period_start?: string;
    period_end?: string;
    total_visuals: number;
    total_reactions_received: number;
    total_remixes: number;
    streak_days: number;
    best_streak: number;
    challenges_won: number;
    challenges_participated: number;
    favorite_styles: string[];
    favorite_subjects: string[];
    peak_creative_hours: number[];
    avg_generation_time: number;
    style_diversity_score: number;
    engagement_rate: number;
    weekly_summary: Record<string, any>;
    metrics?: UserInsightsMetrics;
    recommendations: Recommendation[];
    achievements?: AchievementProgress[];
    calculated_at: string;
    created_at?: string;
    // Additional properties for dashboard
    streaks?: CreativeStreak;
    style_diversity?: Array<{ style: string; percentage: number }>;
    level?: number;
    xp_progress?: number;
}

export interface Recommendation {
    type: 'try_trending_style' | 'double_down' | 'explore_new' | 'join_challenge' | 'collaborate' | 'try_style' | 'maintain_streak' | 'share';
    title: string;
    description?: string;
    reason?: string;
    action: string | Record<string, unknown>;
    data?: Record<string, unknown>;
    priority: number | 'low' | 'medium' | 'high';
}

export interface TrendingStyle {
    id?: string;
    style: string;
    style_name?: string;
    style_combination?: string;
    usage_count: number;
    growth_rate?: number;
    growth_percentage: number;
    trend_direction: 'rising' | 'falling' | 'stable';
    period_start?: string;
    period_end?: string;
    sample_visual_ids?: string[];
    sample_visuals?: string[];
    sample_images?: string[];
    rank?: number;
    metadata?: Record<string, unknown>;
    calculated_at?: string;
    created_at?: string;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    tiers: Array<{
        tier: AchievementTier;
        target: number;
    }>;
}

export interface AchievementProgress {
    id: string;
    user_id: string;
    achievement_type: string;
    achievement_name: string;
    description?: string;
    icon?: string;
    tier: AchievementTier;
    progress: number;
    target: number;
    unlocked_at?: string;
    metadata: Record<string, unknown>;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSION CONTROL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TextDiff {
    type: 'added' | 'removed' | 'unchanged';
    operation?: 'insert' | 'delete' | 'equal';
    text: string;
}

export interface SettingChange {
    key: string;
    from: unknown;
    to: unknown;
}

export interface VersionDiff {
    prompt_changes: TextDiff[];
    settings_changes: SettingChange[];
    summary?: string;
}

export interface VisualVersion {
    id: string;
    visual_id: string;
    version_number: number;
    version_name?: string;
    description?: string;
    branch_name?: string;
    parent_version_id?: string;
    branch_id?: string;
    image_url: string;
    thumbnail_url?: string;
    prompt: string;
    negative_prompt?: string;
    settings: Record<string, unknown>;
    data?: Record<string, unknown>;
    diff?: VersionDiff;
    change_description?: string;
    commit_message?: string;
    is_auto_save?: boolean;
    is_starred?: boolean;
    changes_summary?: {
        prompt_changed?: boolean;
        style_changed?: boolean;
        settings_changed?: boolean;
    };
    created_by: string;
    created_at: string;
    
    // Joined data
    creator?: CollaboratorProfile;
    parent?: VisualVersion;
    children?: VisualVersion[];
}

export interface VisualBranch {
    id: string;
    visual_id: string;
    name: string;
    branch_name?: string;
    description?: string;
    created_from_version_id: string;
    base_version_id?: string;
    head_version_id?: string;
    is_default?: boolean;
    is_merged: boolean;
    merged_at?: string;
    merged_version_id?: string;
    merged_into_id?: string;
    created_by: string;
    created_at: string;
    
    // Joined data
    creator?: CollaboratorProfile;
    base_version?: VisualVersion;
    head_version?: VisualVersion;
    from_version?: VisualVersion;
    version_count?: number;
}

export interface VersionComparison {
    id?: string;
    version_a_id?: string;
    version_b_id?: string;
    version_a: VisualVersion;
    version_b: VisualVersion;
    prompt_diff: TextDiff[];
    settings_diff: Array<{ key: string; old: any; new: any }>;
    diff_analysis?: {
        visual_changes: string[];
        prompt_impact: string;
        recommendation: string;
        improvements: string[];
    };
    visual_changes?: string[];
    similarity_score: number;
    ai_recommendations?: string[];
    comparison_date: string;
    created_at?: string;
}

export interface VersionRestore {
    id: string;
    visual_id: string;
    from_version_id: string;
    to_version_id: string;
    restored_by: string;
    reason?: string;
    created_at: string;
}

// Family tree types
export interface TreeNode {
    id: string;
    type?: string;
    version_number?: number;
    data: Record<string, unknown> | VisualVersion;
    position: { x: number; y: number };
    parent?: string;
    children?: TreeNode[];
    depth?: number;
    x?: number;
    y?: number;
}

export interface FamilyTree {
    nodes: TreeNode[];
    edges: Array<{
        id: string;
        source: string;
        target: string;
        type?: string;
        animated?: boolean;
    }>;
    visual_id: string;
    total_versions: number;
    total_branches: number;
    root?: TreeNode | null;
    max_depth?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface BroadcastServiceCallbacks {
    onViewerJoin?: (viewer: BroadcastViewer) => void;
    onViewerLeave?: (viewer: BroadcastViewer) => void;
    onMessage?: (message: BroadcastMessage) => void;
    onAction?: (action: BroadcastAction) => void;
    onViewerCountChange?: (count: number) => void;
    onStatusChange?: (status: BroadcastStatus) => void;
}

export interface NotificationServiceCallbacks {
    onNotification?: (notification: Notification) => void;
    onUnreadCountChange?: (count: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER LIMITATIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface BroadcastTierLimits {
    can_broadcast: boolean;
    max_monthly_hours: number;
    max_viewers: number;
    recording_enabled: boolean;
    advanced_analytics: boolean;
}

export const BROADCAST_TIER_LIMITS: Record<string, BroadcastTierLimits> = {
    spark: {
        can_broadcast: false,
        max_monthly_hours: 0,
        max_viewers: 0,
        recording_enabled: false,
        advanced_analytics: false
    },
    creator: {
        can_broadcast: true,
        max_monthly_hours: 2,
        max_viewers: 20,
        recording_enabled: false,
        advanced_analytics: false
    },
    studio: {
        can_broadcast: true,
        max_monthly_hours: 10,
        max_viewers: 100,
        recording_enabled: true,
        advanced_analytics: false
    },
    empire: {
        can_broadcast: true,
        max_monthly_hours: Infinity,
        max_viewers: Infinity,
        recording_enabled: true,
        advanced_analytics: true
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMOJI CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
    remix: '🔄',
    reaction: '❤️',
    comment: '💬',
    mention: '@',
    follow: '👤',
    follower: '👤',
    broadcast: '📺',
    broadcast_live: '🔴',
    broadcast_scheduled: '📅',
    challenge: '🏆',
    challenge_new: '🎨',
    challenge_ending: '⏰',
    challenge_won: '🥇',
    milestone: '🎖️',
    trend_alert: '🔥',
    insight: '📊',
    collaboration: '🤝',
    mentorship_request: '🎓',
    mentorship_accepted: '🎉',
    lesson_available: '📚',
    weekly_digest: '📈',
    system: '⚙️'
};

export const ACHIEVEMENT_TIER_COLORS: Record<AchievementTier, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF'
};

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL SERVICE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface StyleAnalysis {
    favorite_styles: string[];
    favorite_subjects: string[];
    diversity_score: number;
}

export interface TimeOfDayAnalysis {
    peak_hours: number[];
    most_active_day: number | null;
}

export interface EngagementPattern {
    engagement_rate: number;
    best_performing_type: string | null;
}

export interface CreativeMetrics {
    total_visuals: number;
    total_reactions: number;
    total_remixes: number;
    streak_days: number;
    best_streak: number;
    challenges_won: number;
    challenges_participated: number;
    avg_generation_time: number;
}

// Weekly insights summary for dashboard
export interface WeeklyInsightsSummary {
    generation_count: number;
    total_reactions: number;
    unique_styles: number;
    most_active_hour: number;
    week_over_week_change: number;
    top_style: string;
    best_performing?: {
        image_url: string;
        reactions: number;
        style: string;
    };
    improvement_tips?: string[];
}

// Creative streak tracking
export interface CreativeStreak {
    current_streak: number;
    longest_streak: number;
    streak_start_date?: string;
    last_activity_date?: string;
}

// Personal recommendation type
export interface PersonalRecommendation {
    id: string;
    type: 'style' | 'prompt' | 'technique' | 'challenge' | 'user_to_follow';
    title: string;
    description: string;
    reason: string;
    confidence_score: number;
    data?: Record<string, unknown>;
    is_applied?: boolean;
    is_dismissed?: boolean;
}

// Version node for family tree visualization
export interface VersionNode {
    id: string;
    version_number: number;
    branch_name: string;
    thumbnail_url?: string;
    children?: VersionNode[];
}

export interface VersionMetadata {
    prompt: string;
    settings: Record<string, unknown>;
    image_url: string;
}

export interface NotificationBatch {
    type: NotificationType;
    notifications: Notification[];
    summary: string;
}

export interface NotificationBatchConfig {
    shouldBatch: boolean;
    batchWindow: number; // ms
    maxBatchSize: number;
    batchTitle: (count: number) => string;
    batchMessage: (items: Notification[]) => string;
}

export const NOTIFICATION_BATCH_CONFIG: Partial<Record<NotificationType, NotificationBatchConfig>> = {
    reaction: {
        shouldBatch: true,
        batchWindow: 60000, // 1 minute
        maxBatchSize: 10,
        batchTitle: (count) => `${count} new reactions`,
        batchMessage: (items) => `You received ${items.length} reactions on your visuals`
    },
    follow: {
        shouldBatch: true,
        batchWindow: 300000, // 5 minutes
        maxBatchSize: 20,
        batchTitle: (count) => `${count} new followers`,
        batchMessage: (items) => `${items.length} people started following you`
    }
};
