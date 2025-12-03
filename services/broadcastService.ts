// ==============================================================================
// GENESIS BROADCAST SERVICE
// ==============================================================================
// Real-time live broadcasting for mentor-apprentice system
// ==============================================================================

import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
    BroadcastSession,
    BroadcastViewer,
    BroadcastMessage,
    BroadcastAction,
    BroadcastStatus,
    BroadcastSettings,
    BroadcastServiceCallbacks,
    UserFollow,
    MentorRelationship,
    BROADCAST_TIER_LIMITS
} from '../types/advanced';
import { LRUCache, BatchProcessor, debounce, throttle } from './performanceOptimizations';

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE: Constants and caches
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BROADCAST_CONNECTIONS = 10; // Max broadcasts a user can subscribe to
const ACTION_BUFFER_SIZE = 50; // Max actions before forced flush
const ACTION_FLUSH_INTERVAL_MS = 100; // Flush actions every 100ms

// Cache for broadcast session data
const broadcastCache = new LRUCache<string, BroadcastSession>(100);
const viewerCountCache = new LRUCache<string, number>(200);

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class BroadcastService {
    private channels: Map<string, RealtimeChannel> = new Map();
    private currentSessionId: string | null = null;
    private actionBuffer: BroadcastAction[] = [];
    private flushTimeout: ReturnType<typeof setTimeout> | null = null;
    private subscriptionOrder: string[] = []; // Track for LRU eviction

    // PERFORMANCE: Throttled viewer count update
    private throttledViewerUpdate = throttle(async (sessionId: string, count: number) => {
        await supabase
            .from('broadcast_sessions')
            .update({ viewer_count: count })
            .eq('id', sessionId);
    }, 5000); // Update at most every 5 seconds

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Start a new live broadcast
     */
    async startBroadcast(
        title: string,
        description?: string,
        settings?: Partial<BroadcastSettings>
    ): Promise<{ success: boolean; data?: BroadcastSession; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Check if user already has a live broadcast
        const { data: existing } = await supabase
            .from('broadcast_sessions')
            .select('id')
            .eq('broadcaster_id', user.data.user.id)
            .eq('status', 'live')
            .single();

        if (existing) {
            return { success: false, error: 'You already have an active broadcast' };
        }

        const defaultSettings: BroadcastSettings = {
            chat_enabled: true,
            questions_enabled: true,
            copy_settings_enabled: true,
            max_viewers: 100,
            is_private: false,
            notification_sent: false,
            ...settings
        };

        const { data, error } = await supabase
            .from('broadcast_sessions')
            .insert({
                broadcaster_id: user.data.user.id,
                title,
                description,
                status: 'live',
                started_at: new Date().toISOString(),
                settings: defaultSettings
            })
            .select(`
                *,
                broadcaster:profiles(id, full_name, avatar_url)
            `)
            .single();

        if (error) {
            console.error('Error starting broadcast: - broadcastService.ts:88', error);
            return { success: false, error: error.message };
        }

        this.currentSessionId = data.id;

        // Notify followers
        await this.notifyFollowers(data);

        return { success: true, data };
    }

    /**
     * Schedule a future broadcast
     */
    async scheduleBroadcast(
        title: string,
        description: string,
        scheduledFor: Date,
        settings?: Partial<BroadcastSettings>
    ): Promise<{ success: boolean; data?: BroadcastSession; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('broadcast_sessions')
            .insert({
                broadcaster_id: user.data.user.id,
                title,
                description,
                status: 'scheduled',
                scheduled_for: scheduledFor.toISOString(),
                settings: {
                    chat_enabled: true,
                    questions_enabled: true,
                    copy_settings_enabled: true,
                    max_viewers: 100,
                    is_private: false,
                    notification_sent: false,
                    ...settings
                }
            })
            .select()
            .single();

        if (error) {
            console.error('Error scheduling broadcast: - broadcastService.ts:136', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * End the current broadcast
     */
    async endBroadcast(sessionId?: string): Promise<{ success: boolean; error?: string }> {
        const targetSession = sessionId || this.currentSessionId;
        if (!targetSession) {
            return { success: false, error: 'No active broadcast' };
        }

        const { error } = await supabase
            .from('broadcast_sessions')
            .update({
                status: 'ended',
                ended_at: new Date().toISOString()
            })
            .eq('id', targetSession);

        if (error) {
            console.error('Error ending broadcast: - broadcastService.ts:161', error);
            return { success: false, error: error.message };
        }

        // Cleanup channel
        await this.unsubscribeFromBroadcast(targetSession);
        this.currentSessionId = null;

        return { success: true };
    }

    /**
     * Get live broadcasts
     */
    async getLiveBroadcasts(): Promise<BroadcastSession[]> {
        const { data, error } = await supabase
            .from('broadcast_sessions')
            .select(`
                *,
                broadcaster:profiles(id, full_name, avatar_url)
            `)
            .eq('status', 'live')
            .order('viewer_count', { ascending: false });

        if (error) {
            console.error('Error fetching live broadcasts: - broadcastService.ts:186', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get scheduled broadcasts
     */
    async getScheduledBroadcasts(userId?: string): Promise<BroadcastSession[]> {
        let query = supabase
            .from('broadcast_sessions')
            .select(`
                *,
                broadcaster:profiles(id, full_name, avatar_url)
            `)
            .eq('status', 'scheduled')
            .gte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true });

        if (userId) {
            query = query.eq('broadcaster_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching scheduled broadcasts: - broadcastService.ts:214', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get broadcast recordings
     */
    async getRecordings(userId?: string): Promise<BroadcastSession[]> {
        let query = supabase
            .from('broadcast_sessions')
            .select(`
                *,
                broadcaster:profiles(id, full_name, avatar_url)
            `)
            .eq('status', 'recorded')
            .not('recording_url', 'is', null)
            .order('ended_at', { ascending: false });

        if (userId) {
            query = query.eq('broadcaster_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching recordings: - broadcastService.ts:242', error);
            return [];
        }

        return data || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEWER MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Join a broadcast as viewer
     */
    async joinBroadcast(sessionId: string): Promise<{ success: boolean; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('broadcast_viewers')
            .upsert({
                session_id: sessionId,
                viewer_id: user.data.user.id,
                is_active: true,
                joined_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error joining broadcast: - broadcastService.ts:272', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Leave a broadcast
     */
    async leaveBroadcast(sessionId: string): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        await supabase
            .from('broadcast_viewers')
            .update({
                is_active: false,
                left_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .eq('viewer_id', user.data.user.id);
    }

    /**
     * Get active viewers for a broadcast
     */
    async getActiveViewers(sessionId: string): Promise<BroadcastViewer[]> {
        const { data, error } = await supabase
            .from('broadcast_viewers')
            .select(`
                *,
                viewer:profiles(id, full_name, avatar_url)
            `)
            .eq('session_id', sessionId)
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching viewers: - broadcastService.ts:310', error);
            return [];
        }

        return data || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REAL-TIME BROADCASTING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Subscribe to broadcast updates
     */
    subscribeToBroadcast(
        sessionId: string,
        callbacks: BroadcastServiceCallbacks
    ): RealtimeChannel {
        const existingChannel = this.channels.get(sessionId);
        if (existingChannel) {
            return existingChannel;
        }

        const channel = supabase.channel(`broadcast:${sessionId}`)
            // Listen for broadcast actions from broadcaster
            .on('broadcast', { event: 'studio_action' }, (payload: { payload: BroadcastAction }) => {
                if (callbacks.onAction) {
                    callbacks.onAction(payload.payload as BroadcastAction);
                }
            })
            // Listen for new messages
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'broadcast_messages',
                    filter: `session_id=eq.${sessionId}`
                },
                async (payload: { new: { id: string } }) => {
                    if (callbacks.onMessage) {
                        // Fetch full message with user data
                        const { data } = await supabase
                            .from('broadcast_messages')
                            .select('*, user:profiles(id, full_name, avatar_url)')
                            .eq('id', payload.new.id)
                            .single();
                        if (data) callbacks.onMessage(data);
                    }
                }
            )
            // Listen for viewer changes
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'broadcast_viewers',
                    filter: `session_id=eq.${sessionId}`
                },
                async (payload: { eventType: string; new: any; old?: any }) => {
                    if (payload.eventType === 'INSERT' || 
                        (payload.eventType === 'UPDATE' && payload.new.is_active && !payload.old?.is_active)) {
                        if (callbacks.onViewerJoin) {
                            const { data } = await supabase
                                .from('broadcast_viewers')
                                .select('*, viewer:profiles(id, full_name, avatar_url)')
                                .eq('id', payload.new.id)
                                .single();
                            if (data) callbacks.onViewerJoin(data);
                        }
                    } else if (payload.eventType === 'UPDATE' && !payload.new.is_active && payload.old?.is_active) {
                        if (callbacks.onViewerLeave) {
                            callbacks.onViewerLeave(payload.new as BroadcastViewer);
                        }
                    }
                }
            )
            // Listen for session status changes
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'broadcast_sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload: { new: any; old?: any }) => {
                    if (callbacks.onStatusChange && payload.new.status !== payload.old?.status) {
                        callbacks.onStatusChange(payload.new.status as BroadcastStatus);
                    }
                    if (callbacks.onViewerCountChange && payload.new.viewer_count !== payload.old?.viewer_count) {
                        callbacks.onViewerCountChange(payload.new.viewer_count);
                    }
                }
            )
            .subscribe();

        this.channels.set(sessionId, channel);
        return channel;
    }

    /**
     * Unsubscribe from broadcast
     */
    async unsubscribeFromBroadcast(sessionId: string): Promise<void> {
        const channel = this.channels.get(sessionId);
        if (channel) {
            await supabase.removeChannel(channel);
            this.channels.delete(sessionId);
        }
    }

    /**
     * Broadcast a Visual Studio action to viewers
     */
    async broadcastAction(action: BroadcastAction): Promise<void> {
        if (!this.currentSessionId) return;

        const channel = this.channels.get(this.currentSessionId);
        if (!channel) return;

        // Buffer actions for cursor movements (throttle)
        if (action.type === 'cursor_move') {
            this.actionBuffer.push(action);
            if (!this.flushTimeout) {
                this.flushTimeout = setTimeout(() => this.flushActionBuffer(), 50);
            }
            return;
        }

        // Send immediately for other actions
        await channel.send({
            type: 'broadcast',
            event: 'studio_action',
            payload: action
        });
    }

    private async flushActionBuffer(): Promise<void> {
        if (!this.currentSessionId || this.actionBuffer.length === 0) {
            this.flushTimeout = null;
            return;
        }

        const channel = this.channels.get(this.currentSessionId);
        if (channel) {
            // Send only the latest cursor position
            const latestAction = this.actionBuffer[this.actionBuffer.length - 1];
            await channel.send({
                type: 'broadcast',
                event: 'studio_action',
                payload: latestAction
            });
        }

        this.actionBuffer = [];
        this.flushTimeout = null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHAT & QUESTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send a chat message
     */
    async sendMessage(
        sessionId: string,
        message: string,
        type: 'chat' | 'question' = 'chat'
    ): Promise<{ success: boolean; data?: BroadcastMessage; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('broadcast_messages')
            .insert({
                session_id: sessionId,
                user_id: user.data.user.id,
                message,
                type
            })
            .select(`
                *,
                user:profiles(id, full_name, avatar_url)
            `)
            .single();

        if (error) {
            console.error('Error sending message: - broadcastService.ts:502', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * Pin/unpin a message (broadcaster only)
     */
    async togglePinMessage(messageId: string, isPinned: boolean): Promise<void> {
        await supabase
            .from('broadcast_messages')
            .update({ is_pinned: isPinned })
            .eq('id', messageId);
    }

    /**
     * Mark question as answered
     */
    async markQuestionAnswered(messageId: string): Promise<void> {
        await supabase
            .from('broadcast_messages')
            .update({ is_answered: true })
            .eq('id', messageId);
    }

    /**
     * Get messages for a broadcast
     */
    async getMessages(
        sessionId: string,
        options: { type?: string; limit?: number } = {}
    ): Promise<BroadcastMessage[]> {
        let query = supabase
            .from('broadcast_messages')
            .select(`
                *,
                user:profiles(id, full_name, avatar_url)
            `)
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (options.type) {
            query = query.eq('type', options.type);
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching messages: - broadcastService.ts:556', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get unanswered questions
     */
    async getUnansweredQuestions(sessionId: string): Promise<BroadcastMessage[]> {
        const { data, error } = await supabase
            .from('broadcast_messages')
            .select(`
                *,
                user:profiles(id, full_name, avatar_url)
            `)
            .eq('session_id', sessionId)
            .eq('type', 'question')
            .eq('is_answered', false)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching questions: - broadcastService.ts:579', error);
            return [];
        }

        return data || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOLLOW SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Follow a user
     */
    async followUser(userId: string): Promise<{ success: boolean; error?: string }> {
        const currentUser = await supabase.auth.getUser();
        if (!currentUser.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        if (currentUser.data.user.id === userId) {
            return { success: false, error: 'Cannot follow yourself' };
        }

        const { error } = await supabase
            .from('user_follows')
            .insert({
                follower_id: currentUser.data.user.id,
                following_id: userId
            });

        if (error) {
            if (error.code === '23505') {
                return { success: false, error: 'Already following' };
            }
            console.error('Error following user: - broadcastService.ts:614', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Unfollow a user
     */
    async unfollowUser(userId: string): Promise<{ success: boolean; error?: string }> {
        const currentUser = await supabase.auth.getUser();
        if (!currentUser.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', currentUser.data.user.id)
            .eq('following_id', userId);

        if (error) {
            console.error('Error unfollowing user: - broadcastService.ts:637', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Check if following a user
     */
    async isFollowing(userId: string): Promise<boolean> {
        const currentUser = await supabase.auth.getUser();
        if (!currentUser.data.user) return false;

        const { data } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', currentUser.data.user.id)
            .eq('following_id', userId)
            .single();

        return !!data;
    }

    /**
     * Get followers count
     */
    async getFollowersCount(userId: string): Promise<number> {
        const { count } = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId);

        return count || 0;
    }

    /**
     * Get following count
     */
    async getFollowingCount(userId: string): Promise<number> {
        const { count } = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId);

        return count || 0;
    }

    /**
     * Notify followers about going live
     */
    private async notifyFollowers(session: BroadcastSession): Promise<void> {
        // Get all followers
        const { data: followers } = await supabase
            .from('user_follows')
            .select('follower_id')
            .eq('following_id', session.broadcaster_id)
            .eq('notifications_enabled', true);

        if (!followers || followers.length === 0) return;

        // Create notifications for all followers
        const notifications = followers.map((f: { follower_id: string }) => ({
            user_id: f.follower_id,
            type: 'broadcast_live',
            title: '🔴 Live Now!',
            message: `${(session.broadcaster as any)?.full_name || 'Someone you follow'} is live: ${session.title}`,
            action_url: `/broadcast/${session.id}`,
            priority: 'high',
            metadata: { session_id: session.id }
        }));

        await supabase.from('notifications').insert(notifications);

        // Mark notification as sent
        await supabase
            .from('broadcast_sessions')
            .update({ settings: { ...session.settings, notification_sent: true } })
            .eq('id', session.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MENTOR SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Request mentorship
     */
    async requestMentorship(
        mentorId: string,
        goals: string
    ): Promise<{ success: boolean; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('mentor_relationships')
            .insert({
                mentor_id: mentorId,
                apprentice_id: user.data.user.id,
                goals,
                status: 'pending'
            });

        if (error) {
            console.error('Error requesting mentorship: - broadcastService.ts:744', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Accept/reject mentorship request
     */
    async updateMentorshipStatus(
        relationshipId: string,
        status: 'active' | 'cancelled'
    ): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase
            .from('mentor_relationships')
            .update({ status })
            .eq('id', relationshipId);

        if (error) {
            console.error('Error updating mentorship: - broadcastService.ts:764', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Get mentorship relationships
     */
    async getMentorships(role: 'mentor' | 'apprentice'): Promise<MentorRelationship[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        const column = role === 'mentor' ? 'mentor_id' : 'apprentice_id';
        const { data, error } = await supabase
            .from('mentor_relationships')
            .select(`
                *,
                mentor:profiles!mentor_id(id, full_name, avatar_url),
                apprentice:profiles!apprentice_id(id, full_name, avatar_url)
            `)
            .eq(column, user.data.user.id)
            .order('started_at', { ascending: false });

        if (error) {
            console.error('Error fetching mentorships: - broadcastService.ts:790', error);
            return [];
        }

        return data || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BOOKMARKS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Add a bookmark to a broadcast recording
     */
    async addBookmark(
        sessionId: string,
        timestampSeconds: number,
        title?: string,
        notes?: string
    ): Promise<{ success: boolean; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('broadcast_bookmarks')
            .insert({
                session_id: sessionId,
                user_id: user.data.user.id,
                timestamp_seconds: timestampSeconds,
                title,
                notes
            });

        if (error) {
            console.error('Error adding bookmark: - broadcastService.ts:826', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Get bookmarks for a broadcast
     */
    async getBookmarks(sessionId: string): Promise<any[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        const { data, error } = await supabase
            .from('broadcast_bookmarks')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', user.data.user.id)
            .order('timestamp_seconds', { ascending: true });

        if (error) {
            console.error('Error fetching bookmarks: - broadcastService.ts:848', error);
            return [];
        }

        return data || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TIER CHECKS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if user can broadcast based on tier
     */
    canBroadcast(userTier: string): boolean {
        const limits = BROADCAST_TIER_LIMITS[userTier] || BROADCAST_TIER_LIMITS.spark;
        return limits.can_broadcast;
    }

    /**
     * Get broadcast limits for tier
     */
    getBroadcastLimits(userTier: string) {
        return BROADCAST_TIER_LIMITS[userTier] || BROADCAST_TIER_LIMITS.spark;
    }
}

export const broadcastService = new BroadcastService();
export default broadcastService;
