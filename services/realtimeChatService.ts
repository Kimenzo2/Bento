/**
 * Genesis Real-time Chat Service
 * 
 * Connects to Supabase for real-time chat functionality including:
 * - Channels and categories management
 * - Real-time messages with threads
 * - Typing indicators
 * - User presence
 * - Message reactions
 * - Read receipts
 */

import { supabase } from './supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

export type ChannelType = 'text' | 'voice' | 'ai-assistant' | 'thread' | 'dm';
export type MessageType = 'text' | 'system' | 'ai_response' | 'image' | 'file' | 'code';
export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';
export type MemberRole = 'owner' | 'admin' | 'member' | 'guest';

export interface ChatCategory {
    id: string;
    project_id: string | null;
    name: string;
    color: string | null;
    icon: string | null;
    sort_order: number;
    is_collapsed: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    channels?: ChatChannel[];
}

export interface ChatChannel {
    id: string;
    category_id: string | null;
    project_id: string | null;
    name: string;
    description: string | null;
    type: ChannelType;
    icon: string | null;
    is_pinned: boolean;
    is_muted: boolean;
    is_locked: boolean;
    is_private: boolean;
    sort_order: number;
    settings: Record<string, any>;
    last_message_at: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    unread_count?: number;
    mention_count?: number;
}

export interface ChatMessage {
    id: string;
    channel_id: string;
    user_id: string;
    content: string;
    type: MessageType;
    thread_id: string | null;
    reply_to_id: string | null;
    reply_count: number;
    ai_metadata: {
        model?: string;
        tokens?: number;
        processingTime?: number;
    } | null;
    attachments: Array<{
        id: string;
        type: 'image' | 'file' | 'link';
        url: string;
        name: string;
        size?: number;
        mimeType?: string;
        thumbnail?: string;
    }>;
    mentions: string[];
    is_pinned: boolean;
    is_deleted: boolean;
    is_edited: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Joined data
    user?: ChatUser;
    reactions?: ChatReaction[];
    reply_to?: {
        id: string;
        content: string;
        user_name: string;
    };
}

export interface ChatReaction {
    emoji: string;
    count: number;
    users: string[];
    has_reacted: boolean;
}

export interface ChatUser {
    id: string;
    display_name: string;
    avatar_url: string | null;
    status: PresenceStatus;
    status_message?: string;
}

export interface ChatMember {
    id: string;
    channel_id: string;
    user_id: string;
    role: MemberRole;
    notifications_enabled: boolean;
    last_read_at: string;
    unread_count: number;
    mention_count: number;
    joined_at: string;
    user?: ChatUser;
}

export interface ChatPresence {
    user_id: string;
    status: PresenceStatus;
    status_message: string | null;
    last_seen_at: string;
    current_channel_id: string | null;
    is_typing: boolean;
    typing_channel_id: string | null;
    metadata: Record<string, any>;
    updated_at: string;
}

export interface TypingIndicator {
    channel_id: string;
    user_id: string;
    user?: ChatUser;
    started_at: string;
    expires_at: string;
}

// =====================================================
// REALTIME CHAT SERVICE CLASS
// =====================================================

class RealtimeChatService {
    private messageChannel: RealtimeChannel | null = null;
    private typingChannel: RealtimeChannel | null = null;
    private presenceChannel: RealtimeChannel | null = null;
    private currentUserId: string | null = null;
    private subscriptions: Map<string, () => void> = new Map();

    // =====================================================
    // INITIALIZATION
    // =====================================================

    async initialize(userId: string): Promise<void> {
        this.currentUserId = userId;
        
        // Update user presence to online
        await this.updatePresence('online');
        
        // Set up beforeunload handler to mark offline
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.updatePresence('offline');
            });
        }
    }

    // =====================================================
    // CHANNEL MANAGEMENT
    // =====================================================

    async getCategories(projectId?: string): Promise<ChatCategory[]> {
        let query = supabase
            .from('chat_channel_categories')
            .select(`
                *,
                channels:chat_channels(*)
            `)
            .order('sort_order');

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching categories:', error);
            return [];
        }

        return data || [];
    }

    async createCategory(data: {
        project_id?: string;
        name: string;
        color?: string;
        icon?: string;
    }): Promise<ChatCategory | null> {
        const { data: category, error } = await supabase
            .from('chat_channel_categories')
            .insert({
                ...data,
                created_by: this.currentUserId,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating category:', error);
            return null;
        }

        return category;
    }

    async getChannels(categoryId?: string): Promise<ChatChannel[]> {
        let query = supabase
            .from('chat_channels')
            .select('*')
            .order('sort_order');

        if (categoryId) {
            query = query.eq('category_id', categoryId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching channels:', error);
            return [];
        }

        // Get unread counts for current user
        if (this.currentUserId && data) {
            const { data: memberData } = await supabase
                .from('chat_channel_members')
                .select('channel_id, unread_count, mention_count')
                .eq('user_id', this.currentUserId)
                .in('channel_id', data.map(c => c.id));

            if (memberData) {
                const countsMap = new Map(memberData.map(m => [m.channel_id, m]));
                data.forEach(channel => {
                    const counts = countsMap.get(channel.id);
                    if (counts) {
                        channel.unread_count = counts.unread_count;
                        channel.mention_count = counts.mention_count;
                    }
                });
            }
        }

        return data || [];
    }

    async createChannel(data: {
        category_id?: string;
        project_id?: string;
        name: string;
        description?: string;
        type?: ChannelType;
        icon?: string;
        is_private?: boolean;
    }): Promise<ChatChannel | null> {
        const { data: channel, error } = await supabase
            .from('chat_channels')
            .insert({
                ...data,
                created_by: this.currentUserId,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating channel:', error);
            return null;
        }

        // Auto-join the creator
        if (channel) {
            await this.joinChannel(channel.id, 'owner');
        }

        return channel;
    }

    async joinChannel(channelId: string, role: MemberRole = 'member'): Promise<boolean> {
        const { error } = await supabase
            .from('chat_channel_members')
            .upsert({
                channel_id: channelId,
                user_id: this.currentUserId,
                role,
            });

        return !error;
    }

    async leaveChannel(channelId: string): Promise<boolean> {
        const { error } = await supabase
            .from('chat_channel_members')
            .delete()
            .eq('channel_id', channelId)
            .eq('user_id', this.currentUserId);

        return !error;
    }

    // =====================================================
    // MESSAGES
    // =====================================================

    async getMessages(
        channelId: string,
        options: {
            limit?: number;
            before?: string;
            after?: string;
            threadId?: string;
        } = {}
    ): Promise<ChatMessage[]> {
        const { limit = 50, before, after, threadId } = options;

        let query = supabase
            .from('chat_messages')
            .select(`
                *,
                user:profiles!chat_messages_user_id_fkey(
                    id,
                    full_name,
                    display_name,
                    avatar_url,
                    status
                ),
                reactions:chat_message_reactions(
                    emoji,
                    user_id
                )
            `)
            .eq('channel_id', channelId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (threadId) {
            query = query.eq('thread_id', threadId);
        } else {
            query = query.is('thread_id', null);
        }

        if (before) {
            query = query.lt('created_at', before);
        }

        if (after) {
            query = query.gt('created_at', after);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }

        // Process reactions to group by emoji
        return (data || []).map(msg => ({
            ...msg,
            user: msg.user ? {
                id: msg.user.id,
                display_name: msg.user.display_name || msg.user.full_name || 'Anonymous',
                avatar_url: msg.user.avatar_url,
                status: msg.user.status || 'offline',
            } : undefined,
            reactions: this.groupReactions(msg.reactions || [], this.currentUserId),
        })).reverse();
    }

    private groupReactions(
        reactions: Array<{ emoji: string; user_id: string }>,
        currentUserId: string | null
    ): ChatReaction[] {
        const grouped = new Map<string, { users: string[]; count: number }>();

        reactions.forEach(r => {
            if (!grouped.has(r.emoji)) {
                grouped.set(r.emoji, { users: [], count: 0 });
            }
            const g = grouped.get(r.emoji)!;
            g.users.push(r.user_id);
            g.count++;
        });

        return Array.from(grouped.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            users: data.users,
            has_reacted: currentUserId ? data.users.includes(currentUserId) : false,
        }));
    }

    async sendMessage(data: {
        channel_id: string;
        content: string;
        type?: MessageType;
        thread_id?: string;
        reply_to_id?: string;
        attachments?: ChatMessage['attachments'];
        mentions?: string[];
        ai_metadata?: ChatMessage['ai_metadata'];
    }): Promise<ChatMessage | null> {
        const { data: message, error } = await supabase
            .from('chat_messages')
            .insert({
                ...data,
                user_id: this.currentUserId,
            })
            .select(`
                *,
                user:profiles!chat_messages_user_id_fkey(
                    id,
                    full_name,
                    display_name,
                    avatar_url,
                    status
                )
            `)
            .single();

        if (error) {
            console.error('Error sending message:', error);
            return null;
        }

        // Clear typing indicator
        await this.stopTyping(data.channel_id);

        return message ? {
            ...message,
            user: message.user ? {
                id: message.user.id,
                display_name: message.user.display_name || message.user.full_name || 'Anonymous',
                avatar_url: message.user.avatar_url,
                status: message.user.status || 'offline',
            } : undefined,
            reactions: [],
        } : null;
    }

    async editMessage(messageId: string, content: string): Promise<boolean> {
        const { error } = await supabase
            .from('chat_messages')
            .update({ content, is_edited: true })
            .eq('id', messageId)
            .eq('user_id', this.currentUserId);

        return !error;
    }

    async deleteMessage(messageId: string): Promise<boolean> {
        const { error } = await supabase
            .from('chat_messages')
            .update({ is_deleted: true, deleted_at: new Date().toISOString() })
            .eq('id', messageId)
            .eq('user_id', this.currentUserId);

        return !error;
    }

    async pinMessage(messageId: string, isPinned: boolean): Promise<boolean> {
        const { error } = await supabase
            .from('chat_messages')
            .update({ is_pinned: isPinned })
            .eq('id', messageId);

        return !error;
    }

    // =====================================================
    // REACTIONS
    // =====================================================

    async addReaction(messageId: string, emoji: string): Promise<boolean> {
        const { error } = await supabase
            .from('chat_message_reactions')
            .insert({
                message_id: messageId,
                user_id: this.currentUserId,
                emoji,
            });

        return !error;
    }

    async removeReaction(messageId: string, emoji: string): Promise<boolean> {
        const { error } = await supabase
            .from('chat_message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', this.currentUserId)
            .eq('emoji', emoji);

        return !error;
    }

    // =====================================================
    // TYPING INDICATORS
    // =====================================================

    async startTyping(channelId: string): Promise<void> {
        await supabase
            .from('chat_typing_indicators')
            .upsert({
                channel_id: channelId,
                user_id: this.currentUserId,
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 5000).toISOString(),
            });
    }

    async stopTyping(channelId: string): Promise<void> {
        await supabase
            .from('chat_typing_indicators')
            .delete()
            .eq('channel_id', channelId)
            .eq('user_id', this.currentUserId);
    }

    async getTypingUsers(channelId: string): Promise<TypingIndicator[]> {
        const { data } = await supabase
            .from('chat_typing_indicators')
            .select(`
                *,
                user:profiles!chat_typing_indicators_user_id_fkey(
                    id,
                    full_name,
                    display_name,
                    avatar_url
                )
            `)
            .eq('channel_id', channelId)
            .gt('expires_at', new Date().toISOString())
            .neq('user_id', this.currentUserId);

        return (data || []).map(t => ({
            ...t,
            user: t.user ? {
                id: t.user.id,
                display_name: t.user.display_name || t.user.full_name || 'Anonymous',
                avatar_url: t.user.avatar_url,
                status: 'online' as PresenceStatus,
            } : undefined,
        }));
    }

    // =====================================================
    // PRESENCE
    // =====================================================

    async updatePresence(
        status: PresenceStatus,
        options: {
            status_message?: string;
            current_channel_id?: string;
        } = {}
    ): Promise<void> {
        await supabase
            .from('chat_user_presence')
            .upsert({
                user_id: this.currentUserId,
                status,
                last_seen_at: new Date().toISOString(),
                ...options,
            });
    }

    async getOnlineUsers(channelId?: string): Promise<ChatUser[]> {
        let query = supabase
            .from('chat_user_presence')
            .select(`
                user_id,
                status,
                status_message,
                user:profiles!chat_user_presence_user_id_fkey(
                    id,
                    full_name,
                    display_name,
                    avatar_url
                )
            `)
            .in('status', ['online', 'away', 'dnd']);

        if (channelId) {
            query = query.eq('current_channel_id', channelId);
        }

        const { data } = await query;

        return (data || []).map(p => ({
            id: p.user?.id || p.user_id,
            display_name: p.user?.display_name || p.user?.full_name || 'Anonymous',
            avatar_url: p.user?.avatar_url || null,
            status: p.status,
            status_message: p.status_message,
        }));
    }

    // =====================================================
    // READ RECEIPTS
    // =====================================================

    async markAsRead(channelId: string, messageId: string): Promise<void> {
        await supabase
            .from('chat_read_receipts')
            .upsert({
                channel_id: channelId,
                user_id: this.currentUserId,
                last_read_message_id: messageId,
                last_read_at: new Date().toISOString(),
            });

        // Reset unread count
        await supabase
            .from('chat_channel_members')
            .update({ unread_count: 0, mention_count: 0 })
            .eq('channel_id', channelId)
            .eq('user_id', this.currentUserId);
    }

    // =====================================================
    // REALTIME SUBSCRIPTIONS
    // =====================================================

    subscribeToChannel(
        channelId: string,
        callbacks: {
            onMessage?: (message: ChatMessage) => void;
            onMessageUpdate?: (message: ChatMessage) => void;
            onMessageDelete?: (messageId: string) => void;
            onReaction?: (data: { messageId: string; reactions: ChatReaction[] }) => void;
            onTyping?: (users: TypingIndicator[]) => void;
        }
    ): () => void {
        const subscriptionKey = `channel:${channelId}`;

        // Unsubscribe from previous if exists
        if (this.subscriptions.has(subscriptionKey)) {
            this.subscriptions.get(subscriptionKey)!();
        }

        // Messages subscription
        const messageChannel = supabase
            .channel(`messages:${channelId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `channel_id=eq.${channelId}`,
                },
                async (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
                    if (callbacks.onMessage && payload.new) {
                        // Fetch full message with user data
                        const { data } = await supabase
                            .from('chat_messages')
                            .select(`
                                *,
                                user:profiles!chat_messages_user_id_fkey(
                                    id,
                                    full_name,
                                    display_name,
                                    avatar_url,
                                    status
                                )
                            `)
                            .eq('id', (payload.new as any).id)
                            .single();

                        if (data) {
                            callbacks.onMessage({
                                ...data,
                                user: data.user ? {
                                    id: data.user.id,
                                    display_name: data.user.display_name || data.user.full_name || 'Anonymous',
                                    avatar_url: data.user.avatar_url,
                                    status: data.user.status || 'offline',
                                } : undefined,
                                reactions: [],
                            });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `channel_id=eq.${channelId}`,
                },
                (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
                    if (payload.new) {
                        const msg = payload.new as ChatMessage;
                        if (msg.is_deleted && callbacks.onMessageDelete) {
                            callbacks.onMessageDelete(msg.id);
                        } else if (callbacks.onMessageUpdate) {
                            callbacks.onMessageUpdate(msg);
                        }
                    }
                }
            )
            .subscribe();

        // Reactions subscription
        const reactionChannel = supabase
            .channel(`reactions:${channelId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_message_reactions',
                },
                async (payload) => {
                    if (callbacks.onReaction) {
                        const messageId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
                        if (messageId) {
                            // Fetch updated reactions
                            const { data: reactions } = await supabase
                                .from('chat_message_reactions')
                                .select('emoji, user_id')
                                .eq('message_id', messageId);

                            callbacks.onReaction({
                                messageId,
                                reactions: this.groupReactions(reactions || [], this.currentUserId),
                            });
                        }
                    }
                }
            )
            .subscribe();

        // Typing subscription
        const typingChannel = supabase
            .channel(`typing:${channelId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_typing_indicators',
                    filter: `channel_id=eq.${channelId}`,
                },
                async () => {
                    if (callbacks.onTyping) {
                        const typingUsers = await this.getTypingUsers(channelId);
                        callbacks.onTyping(typingUsers);
                    }
                }
            )
            .subscribe();

        // Cleanup function
        const unsubscribe = () => {
            messageChannel.unsubscribe();
            reactionChannel.unsubscribe();
            typingChannel.unsubscribe();
            this.subscriptions.delete(subscriptionKey);
        };

        this.subscriptions.set(subscriptionKey, unsubscribe);

        return unsubscribe;
    }

    subscribeToPresence(
        callback: (users: ChatUser[]) => void
    ): () => void {
        const channel = supabase
            .channel('presence')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_user_presence',
                },
                async () => {
                    const users = await this.getOnlineUsers();
                    callback(users);
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }

    // =====================================================
    // SEARCH
    // =====================================================

    async searchMessages(
        query: string,
        options: {
            channelId?: string;
            limit?: number;
        } = {}
    ): Promise<ChatMessage[]> {
        const { channelId, limit = 20 } = options;

        let dbQuery = supabase
            .from('chat_messages')
            .select(`
                *,
                user:profiles!chat_messages_user_id_fkey(
                    id,
                    full_name,
                    display_name,
                    avatar_url
                )
            `)
            .textSearch('search_vector', query)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (channelId) {
            dbQuery = dbQuery.eq('channel_id', channelId);
        }

        const { data } = await dbQuery;

        return (data || []).map(msg => ({
            ...msg,
            user: msg.user ? {
                id: msg.user.id,
                display_name: msg.user.display_name || msg.user.full_name || 'Anonymous',
                avatar_url: msg.user.avatar_url,
                status: 'offline' as PresenceStatus,
            } : undefined,
            reactions: [],
        }));
    }

    // =====================================================
    // CLEANUP
    // =====================================================

    async cleanup(): Promise<void> {
        // Update presence to offline
        await this.updatePresence('offline');

        // Unsubscribe from all channels
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions.clear();
    }
}

// Export singleton instance
export const realtimeChatService = new RealtimeChatService();
export default realtimeChatService;
