// ==============================================================================
// GENESIS COLLABORATION SERVICE
// ==============================================================================
// Real-time collaboration service for Visual Studio using Supabase Realtime
// Features: Shared visuals, reactions, presence, activity feed, challenges
// ==============================================================================

import { supabase } from './supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
    SharedVisual,
    SharedVisualInsert,
    Reaction,
    ReactionType,
    ReactionCount,
    Annotation,
    Activity,
    Challenge,
    ChallengeSubmission,
    CollaborationSession,
    SessionParticipant,
    PresenceUser,
    CollaboratorStatus,
    VisualLineage,
    VisualNode,
    PaginatedResponse,
    ServiceResult,
    REACTION_EMOJIS,
} from '../types/collaboration';
import { LRUCache, throttle, deduplicateRequest } from './performanceOptimizations';

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE: Caches and limits for scalability
// ─────────────────────────────────────────────────────────────────────────────
const visualCache = new LRUCache<string, SharedVisual[]>(100); // Cache visual queries
const sessionCache = new LRUCache<string, CollaborationSession[]>(50); // Cache sessions
const MAX_CHANNELS_PER_USER = 3; // Limit concurrent channel subscriptions
const PRESENCE_THROTTLE_MS = 2000; // Throttle presence updates

// ─────────────────────────────────────────────────────────────────────────────
// COLLABORATION SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class CollaborationService {
    private channels: Map<string, RealtimeChannel> = new Map();
    private presenceState: Map<string, PresenceUser> = new Map();
    private currentSessionId: string | null = null;
    private channelOrder: string[] = []; // PERFORMANCE: Track channel access order for LRU eviction

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a new collaboration session
     */
    async createSession(name: string = 'Creative Session'): Promise<ServiceResult<CollaborationSession>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('collaboration_sessions')
            .insert({ name, created_by: user.data.user.id })
            .select()
            .single();

        if (error) {
            console.error('Error creating session:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * Join an existing session
     */
    async joinSession(sessionId: string): Promise<ServiceResult<SessionParticipant>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('session_participants')
            .upsert({
                session_id: sessionId,
                user_id: user.data.user.id,
                status: 'idle',
                last_seen_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error joining session:', error);
            return { success: false, error: error.message };
        }

        this.currentSessionId = sessionId;
        return { success: true, data };
    }

    /**
     * Update participant status
     */
    async updateStatus(status: CollaboratorStatus): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user || !this.currentSessionId) return;

        await supabase
            .from('session_participants')
            .update({ status, last_seen_at: new Date().toISOString() })
            .eq('session_id', this.currentSessionId)
            .eq('user_id', user.data.user.id);
    }

    /**
     * Leave current session
     */
    async leaveSession(): Promise<void> {
        if (!this.currentSessionId) return;

        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        await supabase
            .from('session_participants')
            .delete()
            .eq('session_id', this.currentSessionId)
            .eq('user_id', user.data.user.id);

        this.currentSessionId = null;
    }

    /**
     * Get active sessions
     * PERFORMANCE: Cached and deduplicated
     */
    async getActiveSessions(): Promise<CollaborationSession[]> {
        const cacheKey = 'active_sessions';
        
        return deduplicateRequest(cacheKey, async () => {
            // Check cache first
            const cached = sessionCache.get(cacheKey);
            if (cached) {
                return cached;
            }
            
            const { data, error } = await supabase
                .from('collaboration_sessions')
                .select(`
                    *,
                    participants:session_participants(
                        user_id,
                        status,
                        profile:profiles(id, full_name, avatar_url)
                    )
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching sessions:', error);
                return [];
            }

            const sessions = data || [];
            // Cache for 30 seconds
            sessionCache.set(cacheKey, sessions);
            return sessions;
        }, 3000); // 3 second deduplication window
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHARED VISUALS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create and share a new visual
     */
    async shareVisual(visual: SharedVisualInsert): Promise<ServiceResult<SharedVisual>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('shared_visuals')
            .insert({
                ...visual,
                user_id: user.data.user.id,
                session_id: visual.session_id || this.currentSessionId,
            })
            .select(`
                *,
                user:profiles(id, full_name, avatar_url)
            `)
            .single();

        if (error) {
            console.error('Error sharing visual:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * Get shared visuals with pagination
     */
    async getSharedVisuals(
        options: {
            sessionId?: string;
            userId?: string;
            visibility?: string[];
            sortBy?: 'newest' | 'popular' | 'most_remixed';
            page?: number;
            pageSize?: number;
        } = {}
    ): Promise<PaginatedResponse<SharedVisual>> {
        const {
            sessionId = this.currentSessionId,
            userId,
            visibility = ['public', 'featured'],
            sortBy = 'newest',
            page = 1,
            pageSize = 20,
        } = options;

        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        let query = supabase
            .from('shared_visuals')
            .select(`
                *,
                user:profiles(id, full_name, avatar_url),
                parent:shared_visuals!parent_id(id, image_url, thumbnail_url, prompt)
            `, { count: 'exact' })
            .in('visibility', visibility);

        if (sessionId) {
            query = query.eq('session_id', sessionId);
        }

        if (userId) {
            query = query.eq('user_id', userId);
        }

        // Sort
        switch (sortBy) {
            case 'popular':
                query = query.order('reaction_count', { ascending: false });
                break;
            case 'most_remixed':
                query = query.order('remix_count', { ascending: false });
                break;
            default:
                query = query.order('created_at', { ascending: false });
        }

        query = query.range(start, end);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching visuals:', error);
            return { data: [], count: 0, page, pageSize, hasMore: false };
        }

        return {
            data: data || [],
            count: count || 0,
            page,
            pageSize,
            hasMore: (count || 0) > end + 1,
        };
    }

    /**
     * Get a single visual with full details
     */
    async getVisual(visualId: string): Promise<SharedVisual | null> {
        const user = await supabase.auth.getUser();
        const userId = user.data.user?.id;

        const { data, error } = await supabase
            .from('shared_visuals')
            .select(`
                *,
                user:profiles(id, full_name, avatar_url),
                parent:shared_visuals!parent_id(id, image_url, thumbnail_url, prompt, user:profiles(id, full_name, avatar_url)),
                reactions(id, reaction_type, user_id)
            `)
            .eq('id', visualId)
            .single();

        if (error) {
            console.error('Error fetching visual:', error);
            return null;
        }

        // Add user's reactions
        if (data && userId) {
            data.user_reactions = data.reactions
                ?.filter((r: Reaction) => r.user_id === userId)
                .map((r: Reaction) => r.reaction_type);
        }

        return data;
    }

    /**
     * Remix a visual (create a new one based on parent)
     */
    async remixVisual(
        parentId: string,
        newImageUrl: string,
        newPrompt: string,
        settings?: SharedVisualInsert['settings']
    ): Promise<ServiceResult<SharedVisual>> {
        return this.shareVisual({
            image_url: newImageUrl,
            prompt: newPrompt,
            parent_id: parentId,
            settings,
        });
    }

    /**
     * Get visual lineage (family tree)
     */
    async getVisualLineage(visualId: string): Promise<VisualLineage | null> {
        // First, find the root visual
        let currentId = visualId;
        let rootVisual: SharedVisual | null = null;

        while (true) {
            const { data } = await supabase
                .from('shared_visuals')
                .select('*, user:profiles(id, full_name, avatar_url)')
                .eq('id', currentId)
                .single();

            if (!data) break;

            if (!data.parent_id) {
                rootVisual = data;
                break;
            }

            currentId = data.parent_id;
        }

        if (!rootVisual) return null;

        // Now build the tree
        const allVisuals = new Map<string, SharedVisual>();
        const buildTree = async (parentId: string, depth: number): Promise<VisualNode[]> => {
            const { data } = await supabase
                .from('shared_visuals')
                .select('*, user:profiles(id, full_name, avatar_url)')
                .eq('parent_id', parentId);

            if (!data) return [];

            const nodes: VisualNode[] = [];
            for (const visual of data) {
                allVisuals.set(visual.id, visual);
                const children = await buildTree(visual.id, depth + 1);
                nodes.push({ id: visual.id, visual, children, depth: depth + 1 });
            }

            return nodes;
        };

        allVisuals.set(rootVisual.id, rootVisual);
        const children = await buildTree(rootVisual.id, 0);

        const root: VisualNode = {
            id: rootVisual.id,
            visual: rootVisual,
            children,
            depth: 0,
        };

        let maxDepth = 0;
        const countNodes = (node: VisualNode): number => {
            maxDepth = Math.max(maxDepth, node.depth);
            return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
        };

        const totalNodes = countNodes(root);

        return { root, totalNodes, maxDepth, allVisuals };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Add a reaction to a visual
     */
    async addReaction(visualId: string, reactionType: ReactionType): Promise<ServiceResult<Reaction>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('reactions')
            .insert({
                visual_id: visualId,
                user_id: user.data.user.id,
                reaction_type: reactionType,
            })
            .select()
            .single();

        if (error) {
            // Might be a duplicate - try to remove instead (toggle)
            if (error.code === '23505') {
                return this.removeReaction(visualId, reactionType);
            }
            console.error('Error adding reaction:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * Remove a reaction from a visual
     */
    async removeReaction(visualId: string, reactionType: ReactionType): Promise<ServiceResult<Reaction>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('reactions')
            .delete()
            .eq('visual_id', visualId)
            .eq('user_id', user.data.user.id)
            .eq('reaction_type', reactionType);

        if (error) {
            console.error('Error removing reaction:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Toggle a reaction (add if not exists, remove if exists)
     */
    async toggleReaction(visualId: string, reactionType: ReactionType): Promise<ServiceResult<{ added: boolean }>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Check if reaction exists
        const { data: existing } = await supabase
            .from('reactions')
            .select('id')
            .eq('visual_id', visualId)
            .eq('user_id', user.data.user.id)
            .eq('reaction_type', reactionType)
            .single();

        if (existing) {
            await this.removeReaction(visualId, reactionType);
            return { success: true, data: { added: false } };
        } else {
            await this.addReaction(visualId, reactionType);
            return { success: true, data: { added: true } };
        }
    }

    /**
     * Get reaction counts for a visual
     */
    async getReactionCounts(visualId: string): Promise<ReactionCount[]> {
        const { data, error } = await supabase
            .from('reactions')
            .select('reaction_type')
            .eq('visual_id', visualId);

        if (error || !data) return [];

        const counts = new Map<ReactionType, number>();
        for (const reaction of data) {
            const current = counts.get(reaction.reaction_type) || 0;
            counts.set(reaction.reaction_type, current + 1);
        }

        return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVITIES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get activity feed
     */
    async getActivities(
        options: {
            scope?: 'global' | 'session';
            sessionId?: string;
            limit?: number;
            before?: string;
        } = {}
    ): Promise<Activity[]> {
        const { scope = 'global', sessionId = this.currentSessionId, limit = 50, before } = options;

        let query = supabase
            .from('activities')
            .select(`
                *,
                user:profiles!user_id(id, full_name, avatar_url),
                visual:shared_visuals(id, image_url, thumbnail_url, prompt),
                target_user:profiles!target_user_id(id, full_name, avatar_url)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (scope === 'session' && sessionId) {
            query = query.eq('session_id', sessionId);
        } else {
            query = query.eq('scope', 'global');
        }

        if (before) {
            query = query.lt('created_at', before);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching activities:', error);
            return [];
        }

        return data || [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHALLENGES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get active challenges
     */
    async getActiveChallenges(): Promise<Challenge[]> {
        const { data, error } = await supabase
            .from('challenges')
            .select('*')
            .eq('status', 'active')
            .order('ends_at', { ascending: true });

        if (error) {
            console.error('Error fetching challenges:', error);
            return [];
        }

        // Calculate time remaining
        return (data || []).map((challenge: Challenge) => ({
            ...challenge,
            time_remaining: new Date(challenge.ends_at).getTime() - Date.now(),
        }));
    }

    /**
     * Get challenge with submissions
     */
    async getChallenge(challengeId: string): Promise<Challenge | null> {
        const user = await supabase.auth.getUser();
        const userId = user.data.user?.id;

        const { data, error } = await supabase
            .from('challenges')
            .select(`
                *,
                top_submissions:challenge_submissions(
                    *,
                    visual:shared_visuals(*,user:profiles(id, full_name, avatar_url)),
                    user:profiles(id, full_name, avatar_url)
                )
            `)
            .eq('id', challengeId)
            .single();

        if (error) {
            console.error('Error fetching challenge:', error);
            return null;
        }

        // Sort submissions by votes
        if (data?.top_submissions) {
            data.top_submissions.sort((a: ChallengeSubmission, b: ChallengeSubmission) => 
                (b.vote_count || 0) - (a.vote_count || 0)
            );
        }

        // Check if user has submitted
        if (data && userId) {
            data.user_has_submitted = data.top_submissions?.some(
                (s: ChallengeSubmission) => s.user_id === userId
            );
        }

        return data;
    }

    /**
     * Submit to a challenge
     */
    async submitToChallenge(
        challengeId: string,
        visualId: string
    ): Promise<ServiceResult<ChallengeSubmission>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('challenge_submissions')
            .insert({
                challenge_id: challengeId,
                visual_id: visualId,
                user_id: user.data.user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error submitting to challenge:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    }

    /**
     * Vote for a challenge submission
     */
    async voteForSubmission(submissionId: string): Promise<ServiceResult<{ added: boolean }>> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Check if already voted
        const { data: existing } = await supabase
            .from('challenge_votes')
            .select('id')
            .eq('submission_id', submissionId)
            .eq('user_id', user.data.user.id)
            .single();

        if (existing) {
            // Remove vote
            await supabase
                .from('challenge_votes')
                .delete()
                .eq('submission_id', submissionId)
                .eq('user_id', user.data.user.id);
            return { success: true, data: { added: false } };
        } else {
            // Add vote
            const { error } = await supabase
                .from('challenge_votes')
                .insert({
                    submission_id: submissionId,
                    user_id: user.data.user.id,
                });

            if (error) {
                return { success: false, error: error.message };
            }
            return { success: true, data: { added: true } };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REALTIME SUBSCRIPTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * PERFORMANCE: Evict oldest channel if limit reached
     */
    private evictOldestChannel(): void {
        if (this.channels.size >= MAX_CHANNELS_PER_USER && this.channelOrder.length > 0) {
            const oldestSessionId = this.channelOrder.shift();
            if (oldestSessionId && this.channels.has(oldestSessionId)) {
                console.log(`⚡ Evicting oldest channel: ${oldestSessionId}`);
                this.channels.get(oldestSessionId)?.unsubscribe();
                this.channels.delete(oldestSessionId);
            }
        }
    }

    /**
     * Subscribe to session updates (visuals, reactions, activities, presence)
     */
    subscribeToSession(
        sessionId: string,
        callbacks: {
            onVisualAdded?: (visual: SharedVisual) => void;
            onVisualUpdated?: (visual: SharedVisual) => void;
            onReactionAdded?: (reaction: Reaction) => void;
            onReactionRemoved?: (reaction: Reaction) => void;
            onActivityAdded?: (activity: Activity) => void;
            onPresenceChange?: (users: PresenceUser[]) => void;
            onTyping?: (userId: string, isTyping: boolean) => void;
        }
    ): RealtimeChannel {
        // Clean up existing channel
        if (this.channels.has(sessionId)) {
            this.channels.get(sessionId)?.unsubscribe();
            // Update order (move to end as most recently used)
            this.channelOrder = this.channelOrder.filter(id => id !== sessionId);
        } else {
            // PERFORMANCE: Evict oldest if at limit
            this.evictOldestChannel();
        }

        const channel = supabase.channel(`session:${sessionId}`, {
            config: {
                presence: { key: sessionId },
                broadcast: { self: false },
            },
        });

        // Subscribe to shared visuals
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'shared_visuals', filter: `session_id=eq.${sessionId}` },
            async (payload: RealtimePostgresChangesPayload<SharedVisual>) => {
                if (payload.new && callbacks.onVisualAdded) {
                    // Fetch full visual with user data
                    const visual = await this.getVisual((payload.new as SharedVisual).id);
                    if (visual) callbacks.onVisualAdded(visual);
                }
            }
        );

        // Subscribe to reactions
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'reactions' },
            (payload: RealtimePostgresChangesPayload<Reaction>) => {
                if (payload.new && callbacks.onReactionAdded) {
                    callbacks.onReactionAdded(payload.new as Reaction);
                }
            }
        );

        channel.on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'reactions' },
            (payload: RealtimePostgresChangesPayload<Reaction>) => {
                if (payload.old && callbacks.onReactionRemoved) {
                    callbacks.onReactionRemoved(payload.old as Reaction);
                }
            }
        );

        // Subscribe to activities
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'activities', filter: `session_id=eq.${sessionId}` },
            async (payload: RealtimePostgresChangesPayload<Activity>) => {
                if (payload.new && callbacks.onActivityAdded) {
                    callbacks.onActivityAdded(payload.new as Activity);
                }
            }
        );

        // Presence tracking
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const users: PresenceUser[] = [];

            for (const presences of Object.values(state)) {
                for (const presence of presences as PresenceUser[]) {
                    users.push(presence);
                    this.presenceState.set(presence.user_id, presence);
                }
            }

            if (callbacks.onPresenceChange) {
                callbacks.onPresenceChange(users);
            }
        });

        channel.on('presence', { event: 'join' }, ({ newPresences }: { newPresences: PresenceUser[] }) => {
            for (const presence of newPresences as PresenceUser[]) {
                this.presenceState.set(presence.user_id, presence);
            }
        });

        channel.on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: PresenceUser[] }) => {
            for (const presence of leftPresences as PresenceUser[]) {
                this.presenceState.delete(presence.user_id);
            }
        });

        // Broadcast typing status
        channel.on('broadcast', { event: 'typing' }, ({ payload }: { payload: { user_id: string; is_typing: boolean } }) => {
            if (callbacks.onTyping) {
                callbacks.onTyping(payload.user_id, payload.is_typing);
            }
        });

        // Subscribe to the channel
        channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                // Track presence
                const user = await supabase.auth.getUser();
                if (user.data.user) {
                    const profile = await this.getProfile(user.data.user.id);
                    channel.track({
                        user_id: user.data.user.id,
                        display_name: profile?.full_name || 'Anonymous',
                        avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.data.user.id}`,
                        online_at: new Date().toISOString(),
                        status: 'idle',
                    });
                }
            }
        });

        this.channels.set(sessionId, channel);
        // PERFORMANCE: Track access order for LRU eviction
        this.channelOrder.push(sessionId);
        return channel;
    }

    /**
     * Broadcast typing status
     */
    broadcastTyping(sessionId: string, isTyping: boolean): void {
        const channel = this.channels.get(sessionId);
        if (!channel) return;

        supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
            if (data.user) {
                channel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { user_id: data.user.id, is_typing: isTyping },
                });
            }
        });
    }

    /**
     * Broadcast cursor position
     * PERFORMANCE: Throttled to prevent flooding
     */
    private _doBroadcastCursor = (sessionId: string, x: number, y: number): void => {
        const channel = this.channels.get(sessionId);
        if (!channel) return;

        supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
            if (data.user) {
                channel.send({
                    type: 'broadcast',
                    event: 'cursor',
                    payload: { user_id: data.user.id, x, y },
                });
            }
        });
    };

    // PERFORMANCE: Throttle cursor broadcasts to max 20/second
    private _throttledCursor = throttle(this._doBroadcastCursor.bind(this), 50);

    broadcastCursor(sessionId: string, x: number, y: number): void {
        this._throttledCursor(sessionId, x, y);
    }

    /**
     * Unsubscribe from a session
     */
    unsubscribeFromSession(sessionId: string): void {
        const channel = this.channels.get(sessionId);
        if (channel) {
            channel.unsubscribe();
            this.channels.delete(sessionId);
        }
    }

    /**
     * Unsubscribe from all channels
     */
    unsubscribeAll(): void {
        for (const channel of this.channels.values()) {
            channel.unsubscribe();
        }
        this.channels.clear();
        this.presenceState.clear();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private async getProfile(userId: string) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return data;
    }

    /**
     * Get current user's profile
     */
    async getCurrentUserProfile() {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;
        return this.getProfile(user.data.user.id);
    }

    /**
     * Get online users in current session
     */
    getOnlineUsers(): PresenceUser[] {
        return Array.from(this.presenceState.values());
    }

    /**
     * Check if a user is online
     */
    isUserOnline(userId: string): boolean {
        return this.presenceState.has(userId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

export const collaborationService = new CollaborationService();
export default collaborationService;
