// ==============================================================================
// ACTIVITY FEED COMPONENT
// ==============================================================================
// Real-time activity stream showing user actions
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Activity, 
    ActivityType, 
    REACTION_EMOJIS, 
    ReactionType 
} from '../../types/collaboration';
import { collaborationService } from '../../services/collaborationService';
import { 
    Image, 
    GitFork, 
    Star, 
    Heart, 
    MessageCircle, 
    Trophy, 
    UserPlus, 
    Zap, 
    Users,
    Clock,
    ChevronDown,
    Loader2
} from 'lucide-react';

interface ActivityFeedProps {
    sessionId?: string;
    scope?: 'global' | 'session';
    maxHeight?: string;
    showHeader?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
    onActivityClick?: (activity: Activity) => void;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
    sessionId,
    scope = 'session',
    maxHeight = '400px',
    showHeader = true,
    autoRefresh = true,
    refreshInterval = 30000,
    onActivityClick,
}) => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const feedRef = useRef<HTMLDivElement>(null);

    // Load activities
    const loadActivities = useCallback(async (append = false) => {
        if (!append) setIsLoading(true);
        else setIsLoadingMore(true);

        try {
            const lastActivity = append && activities.length > 0 
                ? activities[activities.length - 1] 
                : undefined;

            const data = await collaborationService.getActivities({
                scope,
                sessionId,
                limit: 20,
                before: lastActivity?.created_at,
            });

            if (append) {
                setActivities(prev => [...prev, ...data]);
            } else {
                setActivities(data);
            }

            setHasMore(data.length === 20);
        } catch (error) {
            console.error('Error loading activities:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [scope, sessionId, activities]);

    // Initial load
    useEffect(() => {
        loadActivities();
    }, [sessionId, scope]);

    // Auto refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            loadActivities();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, loadActivities]);

    // Get activity icon
    const getActivityIcon = (type: ActivityType) => {
        switch (type) {
            case 'visual_created': return <Image className="w-4 h-4" />;
            case 'visual_remixed': return <GitFork className="w-4 h-4" />;
            case 'visual_featured': return <Star className="w-4 h-4 text-yellow-500" />;
            case 'reaction_added': return <Heart className="w-4 h-4 text-red-400" />;
            case 'annotation_added': return <MessageCircle className="w-4 h-4" />;
            case 'comment_added': return <MessageCircle className="w-4 h-4" />;
            case 'challenge_submitted': return <Trophy className="w-4 h-4 text-purple-500" />;
            case 'challenge_won': return <Trophy className="w-4 h-4 text-yellow-500" />;
            case 'user_joined': return <UserPlus className="w-4 h-4 text-green-500" />;
            case 'user_leveled_up': return <Zap className="w-4 h-4 text-blue-500" />;
            case 'collab_started': return <Users className="w-4 h-4 text-purple-500" />;
            case 'collab_joined': return <Users className="w-4 h-4 text-green-500" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    // Get activity color
    const getActivityColor = (type: ActivityType): string => {
        switch (type) {
            case 'visual_created': return 'bg-coral-burst/10 text-coral-burst';
            case 'visual_remixed': return 'bg-purple-100 text-purple-600';
            case 'visual_featured': return 'bg-yellow-100 text-yellow-600';
            case 'reaction_added': return 'bg-red-100 text-red-500';
            case 'challenge_submitted': return 'bg-purple-100 text-purple-600';
            case 'challenge_won': return 'bg-yellow-100 text-yellow-600';
            case 'user_joined': return 'bg-green-100 text-green-600';
            case 'user_leveled_up': return 'bg-blue-100 text-blue-600';
            case 'collab_started': return 'bg-purple-100 text-purple-600';
            case 'collab_joined': return 'bg-green-100 text-green-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Get activity text
    const getActivityText = (activity: Activity): React.ReactNode => {
        const userName = activity.user?.full_name || 'Someone';

        switch (activity.type) {
            case 'visual_created':
                return (
                    <>
                        <strong>{userName}</strong> created a new visual
                    </>
                );
            case 'visual_remixed':
                return (
                    <>
                        <strong>{userName}</strong> remixed a visual
                    </>
                );
            case 'visual_featured':
                return (
                    <>
                        <strong>{userName}</strong>'s visual was featured! ⭐
                    </>
                );
            case 'reaction_added':
                const emoji = activity.metadata?.reactionType 
                    ? REACTION_EMOJIS[activity.metadata.reactionType as ReactionType] 
                    : '❤️';
                return (
                    <>
                        <strong>{userName}</strong> reacted with {emoji}
                    </>
                );
            case 'challenge_submitted':
                return (
                    <>
                        <strong>{userName}</strong> submitted to{' '}
                        <span className="text-purple-600">{activity.metadata?.challengeTitle || 'a challenge'}</span>
                    </>
                );
            case 'challenge_won':
                return (
                    <>
                        <strong>{userName}</strong> won{' '}
                        <span className="text-yellow-600">{activity.metadata?.challengeTitle || 'a challenge'}</span>! 🏆
                    </>
                );
            case 'user_joined':
                return (
                    <>
                        <strong>{userName}</strong> joined the session
                    </>
                );
            case 'user_leveled_up':
                return (
                    <>
                        <strong>{userName}</strong> leveled up to{' '}
                        <span className="text-blue-600">Level {activity.metadata?.newLevel}</span>! 🎉
                    </>
                );
            case 'collab_started':
                return (
                    <>
                        <strong>{userName}</strong> started a collaboration session
                    </>
                );
            case 'collab_joined':
                return (
                    <>
                        <strong>{userName}</strong> joined the collaboration
                    </>
                );
            default:
                return (
                    <>
                        <strong>{userName}</strong> did something
                    </>
                );
        }
    };

    // Format time ago
    const formatTimeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="bg-white rounded-2xl shadow-soft-lg border border-white overflow-hidden">
            {showHeader && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-heading font-bold text-charcoal-soft flex items-center gap-2">
                        <Clock className="w-4 h-4 text-coral-burst" />
                        Activity
                    </h3>
                    <span className="text-xs text-gray-400">
                        {scope === 'session' ? 'This session' : 'Global'}
                    </span>
                </div>
            )}

            <div
                ref={feedRef}
                className="overflow-y-auto"
                style={{ maxHeight }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-coral-burst animate-spin" />
                    </div>
                ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No activity yet</p>
                        <p className="text-xs">Be the first to create something!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {activities.map((activity, index) => (
                            <div
                                key={activity.id}
                                className={`
                                    flex items-start gap-3 px-4 py-3 
                                    hover:bg-gray-50 transition-colors cursor-pointer
                                    animate-fadeIn
                                `}
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => onActivityClick?.(activity)}
                            >
                                {/* User avatar */}
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={activity.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user_id}`}
                                        alt={activity.user?.full_name || 'User'}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                    {/* Activity type icon */}
                                    <span className={`
                                        absolute -bottom-1 -right-1 
                                        w-5 h-5 rounded-full 
                                        flex items-center justify-center
                                        ring-2 ring-white
                                        ${getActivityColor(activity.type)}
                                    `}>
                                        {getActivityIcon(activity.type)}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-charcoal-soft">
                                        {getActivityText(activity)}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {formatTimeAgo(activity.created_at)}
                                    </p>
                                </div>

                                {/* Visual thumbnail if available */}
                                {activity.visual && (
                                    <img
                                        src={activity.visual.thumbnail_url || activity.visual.image_url}
                                        alt="Visual"
                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                    />
                                )}
                            </div>
                        ))}

                        {/* Load more button */}
                        {hasMore && (
                            <button
                                onClick={() => loadActivities(true)}
                                disabled={isLoadingMore}
                                className="w-full py-3 text-center text-sm text-coral-burst hover:bg-coral-burst/5 transition-colors flex items-center justify-center gap-2"
                            >
                                {isLoadingMore ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <ChevronDown className="w-4 h-4" />
                                        Load more
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT ACTIVITY NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityNotificationProps {
    activity: Activity;
    onDismiss?: () => void;
}

export const ActivityNotification: React.FC<ActivityNotificationProps> = ({
    activity,
    onDismiss,
}) => {
    useEffect(() => {
        if (!onDismiss) return;
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed bottom-24 left-4 z-50 animate-slideUp">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 flex items-center gap-3 max-w-[300px]">
                <img
                    src={activity.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.user_id}`}
                    alt=""
                    className="w-8 h-8 rounded-full"
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal-soft truncate">
                        <strong>{activity.user?.full_name || 'Someone'}</strong>{' '}
                        {activity.type === 'visual_created' && 'created a new visual'}
                        {activity.type === 'reaction_added' && 'reacted to a visual'}
                        {activity.type === 'collab_joined' && 'joined the session'}
                    </p>
                </div>
                {activity.visual && (
                    <img
                        src={activity.visual.thumbnail_url || activity.visual.image_url}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover"
                    />
                )}
            </div>
        </div>
    );
};

export default ActivityFeed;
