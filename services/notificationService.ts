// ==============================================================================
// GENESIS NOTIFICATION SERVICE
// ==============================================================================
// Smart notification system with batching, preferences, and real-time updates
// ==============================================================================

import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
    Notification,
    NotificationType,
    NotificationPreferences,
    NotificationPriority,
    NotificationBatch,
    NOTIFICATION_BATCH_CONFIG
} from '../types/advanced';

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class NotificationService {
    private channel: RealtimeChannel | null = null;
    private callbacks: Map<string, (notification: Notification) => void> = new Map();
    private batchQueue: Map<NotificationType, Notification[]> = new Map();
    private batchTimeouts: Map<NotificationType, ReturnType<typeof setTimeout>> = new Map();

    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a notification
     */
    async createNotification(
        userId: string,
        type: NotificationType,
        title: string,
        message: string,
        options: {
            actionUrl?: string;
            actionLabel?: string;
            metadata?: Record<string, any>;
            priority?: NotificationPriority;
            expiresAt?: Date;
            groupKey?: string;
        } = {}
    ): Promise<{ success: boolean; data?: Notification; error?: string }> {
        // Check user preferences first
        const preferences = await this.getPreferences(userId);
        
        // Check if this notification type is enabled
        const typeEnabled = this.isNotificationTypeEnabled(type, preferences);
        if (!typeEnabled) {
            return { success: true }; // Silent success - user has disabled this type
        }

        // Handle batching for low-priority notifications
        if (this.shouldBatch(type)) {
            return this.addToBatch(userId, type, title, message, options);
        }

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type,
                title,
                message,
                action_url: options.actionUrl,
                action_label: options.actionLabel,
                metadata: options.metadata,
                priority: options.priority || 'normal',
                expires_at: options.expiresAt?.toISOString(),
                group_key: options.groupKey
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating notification:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * Create multiple notifications at once (for broadcasting to followers, etc.)
     */
    async createBulkNotifications(
        notifications: Array<{
            userId: string;
            type: NotificationType;
            title: string;
            message: string;
            actionUrl?: string;
            metadata?: Record<string, any>;
            priority?: NotificationPriority;
        }>
    ): Promise<{ success: boolean; count: number; error?: string }> {
        const insertData = notifications.map(n => ({
            user_id: n.userId,
            type: n.type,
            title: n.title,
            message: n.message,
            action_url: n.actionUrl,
            metadata: n.metadata,
            priority: n.priority || 'normal'
        }));

        const { error, count } = await supabase
            .from('notifications')
            .insert(insertData);

        if (error) {
            console.error('Error creating bulk notifications:', error);
            return { success: false, count: 0, error: error.message };
        }

        return { success: true, count: count || notifications.length };
    }

    /**
     * Get user notifications
     */
    async getNotifications(options: {
        unreadOnly?: boolean;
        type?: NotificationType;
        limit?: number;
        offset?: number;
    } = {}): Promise<Notification[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.data.user.id)
            .order('created_at', { ascending: false });

        if (options.unreadOnly) {
            query = query.eq('is_read', false);
        }

        if (options.type) {
            query = query.eq('type', options.type);
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get unread count
     */
    async getUnreadCount(): Promise<number> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return 0;

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.data.user.id)
            .eq('is_read', false);

        if (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<void> {
        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', user.data.user.id)
            .eq('is_read', false);
    }

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId: string): Promise<void> {
        await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);
    }

    /**
     * Clear all notifications
     */
    async clearAll(): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.data.user.id);
    }

    /**
     * Delete old/expired notifications
     */
    async cleanupExpired(): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        // Delete expired notifications
        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.data.user.id)
            .lt('expires_at', new Date().toISOString());

        // Delete read notifications older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.data.user.id)
            .eq('is_read', true)
            .lt('created_at', thirtyDaysAgo.toISOString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PREFERENCES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get notification preferences
     */
    async getPreferences(userId?: string): Promise<NotificationPreferences | null> {
        const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
        if (!targetUserId) return null;

        const { data, error } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', targetUserId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No preferences set, return defaults
                return this.getDefaultPreferences(targetUserId);
            }
            console.error('Error fetching preferences:', error);
            return null;
        }

        return data;
    }

    /**
     * Update notification preferences
     */
    async updatePreferences(
        preferences: Partial<NotificationPreferences>
    ): Promise<{ success: boolean; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('notification_preferences')
            .upsert({
                user_id: user.data.user.id,
                ...preferences,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error updating preferences:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Get default preferences
     */
    private getDefaultPreferences(userId: string): NotificationPreferences {
        return {
            id: '',
            user_id: userId,
            email_enabled: true,
            push_enabled: true,
            in_app_enabled: true,
            broadcast_live: true,
            challenge_reminders: true,
            social_interactions: true,
            mentorship_updates: true,
            weekly_digest: true,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00',
            quiet_hours_enabled: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Check if notification type is enabled
     */
    private isNotificationTypeEnabled(
        type: NotificationType,
        preferences: NotificationPreferences | null
    ): boolean {
        if (!preferences) return true;
        if (!preferences.in_app_enabled) return false;

        switch (type) {
            case 'broadcast_live':
            case 'broadcast_scheduled':
                return preferences.broadcast_live;
            case 'challenge_new':
            case 'challenge_ending':
            case 'challenge_won':
                return preferences.challenge_reminders;
            case 'reaction':
            case 'comment':
            case 'remix':
            case 'mention':
            case 'follow':
                return preferences.social_interactions;
            case 'mentorship_request':
            case 'mentorship_accepted':
            case 'lesson_available':
                return preferences.mentorship_updates;
            default:
                return true;
        }
    }

    /**
     * Check if currently in quiet hours
     */
    async isQuietHours(): Promise<boolean> {
        const preferences = await this.getPreferences();
        if (!preferences || !preferences.quiet_hours_enabled) return false;

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const start = preferences.quiet_hours_start;
        const end = preferences.quiet_hours_end;

        if (start <= end) {
            // Simple case: quiet hours don't span midnight
            return currentTime >= start && currentTime < end;
        } else {
            // Quiet hours span midnight
            return currentTime >= start || currentTime < end;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SMART BATCHING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if notification type should be batched
     */
    private shouldBatch(type: NotificationType): boolean {
        const config = NOTIFICATION_BATCH_CONFIG[type];
        return config?.shouldBatch || false;
    }

    /**
     * Add notification to batch queue
     */
    private addToBatch(
        userId: string,
        type: NotificationType,
        title: string,
        message: string,
        options: any
    ): { success: boolean } {
        const notification: Notification = {
            id: crypto.randomUUID(),
            user_id: userId,
            type,
            title,
            message,
            action_url: options.actionUrl,
            metadata: options.metadata || {},
            priority: options.priority || 'low',
            is_read: false,
            is_archived: false,
            created_at: new Date().toISOString()
        };

        const queue = this.batchQueue.get(type) || [];
        queue.push(notification);
        this.batchQueue.set(type, queue);

        // Set up flush timeout if not already set
        if (!this.batchTimeouts.has(type)) {
            const config = NOTIFICATION_BATCH_CONFIG[type];
            const timeout = setTimeout(
                () => this.flushBatch(type, userId),
                config?.batchWindow || 60000
            );
            this.batchTimeouts.set(type, timeout);
        }

        // Check if we've hit the max batch size
        const config = NOTIFICATION_BATCH_CONFIG[type];
        if (queue.length >= (config?.maxBatchSize || 10)) {
            this.flushBatch(type, userId);
        }

        return { success: true };
    }

    /**
     * Flush batched notifications
     */
    private async flushBatch(type: NotificationType, userId: string): Promise<void> {
        const timeout = this.batchTimeouts.get(type);
        if (timeout) {
            clearTimeout(timeout);
            this.batchTimeouts.delete(type);
        }

        const queue = this.batchQueue.get(type);
        if (!queue || queue.length === 0) return;

        this.batchQueue.delete(type);

        const config = NOTIFICATION_BATCH_CONFIG[type];
        const batchedNotification = {
            user_id: userId,
            type,
            title: config?.batchTitle(queue.length) || `${queue.length} new notifications`,
            message: config?.batchMessage(queue) || `You have ${queue.length} new ${type} notifications`,
            metadata: { 
                batched: true, 
                count: queue.length,
                items: queue.map(n => n.metadata)
            },
            priority: 'normal'
        };

        await supabase.from('notifications').insert(batchedNotification);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REAL-TIME SUBSCRIPTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Subscribe to notification updates
     */
    async subscribeToNotifications(
        callback: (notification: Notification) => void
    ): Promise<RealtimeChannel> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            throw new Error('Not authenticated');
        }

        if (this.channel) {
            return this.channel;
        }

        const callbackId = crypto.randomUUID();
        this.callbacks.set(callbackId, callback);

        this.channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.data.user.id}`
                },
                (payload: { new: Notification }) => {
                    this.callbacks.forEach(cb => cb(payload.new as Notification));
                }
            )
            .subscribe();

        return this.channel!;
    }

    /**
     * Unsubscribe from notifications
     */
    async unsubscribe(): Promise<void> {
        if (this.channel) {
            await supabase.removeChannel(this.channel);
            this.channel = null;
            this.callbacks.clear();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NOTIFICATION TEMPLATES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send broadcast live notification
     */
    async notifyBroadcastLive(
        followerIds: string[],
        broadcasterName: string,
        sessionId: string,
        title: string
    ): Promise<void> {
        const notifications = followerIds.map(userId => ({
            userId,
            type: 'broadcast_live' as NotificationType,
            title: '🔴 Live Now!',
            message: `${broadcasterName} is live: ${title}`,
            actionUrl: `/broadcast/${sessionId}`,
            metadata: { session_id: sessionId },
            priority: 'high' as NotificationPriority
        }));

        await this.createBulkNotifications(notifications);
    }

    /**
     * Send reaction notification
     */
    async notifyReaction(
        userId: string,
        reactorName: string,
        visualId: string,
        reactionType: string
    ): Promise<void> {
        await this.createNotification(
            userId,
            'reaction',
            'New Reaction',
            `${reactorName} reacted ${reactionType} to your visual`,
            {
                actionUrl: `/gallery/${visualId}`,
                metadata: { visual_id: visualId, reactor_name: reactorName }
            }
        );
    }

    /**
     * Send follow notification
     */
    async notifyFollow(userId: string, followerName: string, followerId: string): Promise<void> {
        await this.createNotification(
            userId,
            'follow',
            'New Follower',
            `${followerName} started following you`,
            {
                actionUrl: `/profile/${followerId}`,
                metadata: { follower_id: followerId, follower_name: followerName },
                priority: 'normal'
            }
        );
    }

    /**
     * Send remix notification
     */
    async notifyRemix(
        userId: string,
        remixerName: string,
        originalVisualId: string,
        newVisualId: string
    ): Promise<void> {
        await this.createNotification(
            userId,
            'remix',
            'Your Visual Was Remixed!',
            `${remixerName} created a remix of your visual`,
            {
                actionUrl: `/gallery/${newVisualId}`,
                metadata: { 
                    original_id: originalVisualId, 
                    remix_id: newVisualId,
                    remixer_name: remixerName 
                },
                priority: 'normal'
            }
        );
    }

    /**
     * Send challenge notification
     */
    async notifyChallenge(
        userId: string,
        type: 'challenge_new' | 'challenge_ending' | 'challenge_won',
        challengeTitle: string,
        challengeId: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        const titles = {
            challenge_new: '🎨 New Challenge!',
            challenge_ending: '⏰ Challenge Ending Soon!',
            challenge_won: '🏆 You Won!'
        };

        const messages = {
            challenge_new: `A new challenge is available: ${challengeTitle}`,
            challenge_ending: `"${challengeTitle}" ends in 1 hour!`,
            challenge_won: `Congratulations! You won "${challengeTitle}"!`
        };

        await this.createNotification(
            userId,
            type,
            titles[type],
            messages[type],
            {
                actionUrl: `/challenges/${challengeId}`,
                metadata: { challenge_id: challengeId, ...metadata },
                priority: type === 'challenge_won' ? 'high' : 'normal'
            }
        );
    }

    /**
     * Send mentorship notification
     */
    async notifyMentorship(
        userId: string,
        type: 'mentorship_request' | 'mentorship_accepted' | 'lesson_available',
        fromUserName: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        const titles = {
            mentorship_request: '🎓 Mentorship Request',
            mentorship_accepted: '🎉 Mentorship Accepted!',
            lesson_available: '📚 New Lesson Available'
        };

        const messages = {
            mentorship_request: `${fromUserName} wants you to be their mentor`,
            mentorship_accepted: `${fromUserName} accepted your mentorship request`,
            lesson_available: `${fromUserName} shared a new lesson with you`
        };

        await this.createNotification(
            userId,
            type,
            titles[type],
            messages[type],
            {
                actionUrl: '/mentorship',
                metadata: { from_user: fromUserName, ...metadata },
                priority: 'normal'
            }
        );
    }

    /**
     * Send weekly digest
     */
    async sendWeeklyDigest(
        userId: string,
        stats: {
            visuals_created: number;
            reactions_received: number;
            new_followers: number;
            challenges_completed: number;
        }
    ): Promise<void> {
        const message = [
            `This week you created ${stats.visuals_created} visuals`,
            `received ${stats.reactions_received} reactions`,
            `gained ${stats.new_followers} followers`,
            `and completed ${stats.challenges_completed} challenges!`
        ].join(', ');

        await this.createNotification(
            userId,
            'weekly_digest',
            '📊 Your Weekly Creative Summary',
            message,
            {
                actionUrl: '/insights',
                metadata: stats,
                priority: 'low'
            }
        );
    }
}

export const notificationService = new NotificationService();
export default notificationService;
