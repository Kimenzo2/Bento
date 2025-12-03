import { supabase } from './supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { LRUCache, debounce, globalConnectionManager } from './performanceOptimizations';

export interface ChatMessage {
    id: string;
    room_id: string;
    user_id: string;
    content: string;
    type: 'text' | 'system' | 'action' | 'visual_share' | 'reply';
    action_data?: any;
    reply_to?: string;
    reply_preview?: string;
    edited?: boolean;
    edited_at?: string;
    created_at: string;
    user?: {
        display_name: string;
        avatar_url: string;
    };
}

export interface ChatRoom {
    id: string;
    name: string;
    description: string;
    created_by: string;
    created_at: string;
}

export interface PresenceState {
    user_id: string;
    display_name: string;
    avatar_url: string;
    online_at: string;
    typing?: boolean;
}

// PERFORMANCE: Global user profile cache to prevent N+1 queries
const userProfileCache = new LRUCache<string, { display_name: string; avatar_url: string }>(500);

// PERFORMANCE: Message cache per room
const messageCache = new LRUCache<string, ChatMessage[]>(20);

// PERFORMANCE: Limit max connections per user
const MAX_ROOM_SUBSCRIPTIONS = 5;

class ChatService {
    private channels: Map<string, RealtimeChannel> = new Map();
    private subscriptionOrder: string[] = []; // Track subscription order for LRU eviction

    /**
     * Get the default global chat room or create it if it doesn't exist
     */
    async getGlobalRoom(): Promise<ChatRoom | null> {
        const { data, error } = await supabase
            .from('chat_rooms')
            .select('*')
            .eq('name', 'Global Visual Studio')
            .single();

        if (error) {
            console.error('Error fetching global room:', error);
            return null;
        }

        return data;
    }

    /**
     * Fetch recent messages for a room
     */
    async getRoomMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                user:user_id (
                    display_name:raw_user_meta_data->display_name,
                    avatar_url:raw_user_meta_data->avatar_url
                )
            `)
            .eq('room_id', roomId)
            .order('created_at', { ascending: true }) // Get oldest first for chat history
            .limit(limit);

        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }

        // Map the user data correctly
        return data.map((msg: any) => ({
            ...msg,
            user: {
                display_name: msg.user?.display_name || 'Anonymous',
                avatar_url: msg.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user_id}`
            }
        }));
    }

    /**
     * Send a message to a room
     */
    async sendMessage(roomId: string, content: string, type: 'text' | 'action' = 'text', actionData?: any): Promise<ChatMessage | null> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;

        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: user.data.user.id,
                content,
                type,
                action_data: actionData
            })
            .select()
            .single();

        if (error) {
            console.error('Error sending message:', error);
            return null;
        }

        return data;
    }

    /**
     * Send a reply message
     */
    async sendReply(roomId: string, content: string, replyToId: string, replyPreview: string): Promise<ChatMessage | null> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;

        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: user.data.user.id,
                content,
                type: 'reply',
                reply_to: replyToId,
                reply_preview: replyPreview
            })
            .select()
            .single();

        if (error) {
            console.error('Error sending reply:', error);
            return null;
        }

        return data;
    }

    /**
     * Edit a message
     */
    async editMessage(messageId: string, newContent: string): Promise<boolean> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return false;

        const { error } = await supabase
            .from('messages')
            .update({ 
                content: newContent, 
                edited: true,
                edited_at: new Date().toISOString()
            })
            .eq('id', messageId)
            .eq('user_id', user.data.user.id); // Only allow editing own messages

        if (error) {
            console.error('Error editing message:', error);
            return false;
        }

        return true;
    }

    /**
     * Delete a message
     */
    async deleteMessage(messageId: string): Promise<boolean> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return false;

        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId)
            .eq('user_id', user.data.user.id); // Only allow deleting own messages

        if (error) {
            console.error('Error deleting message:', error);
            return false;
        }

        return true;
    }

    /**
     * Send a Visual Studio event as a system message
     */
    async sendVisualStudioEvent(
        roomId: string, 
        eventType: 'visual_shared' | 'user_joined' | 'collab_started' | 'creation_liked',
        eventData?: { imageUrl?: string; caption?: string; userName?: string }
    ): Promise<ChatMessage | null> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;

        const eventMessages = {
            visual_shared: `🎨 ${eventData?.userName || 'Someone'} shared a new creation${eventData?.caption ? `: "${eventData.caption}"` : ''}`,
            user_joined: `👋 ${eventData?.userName || 'Someone'} joined the collaborative session`,
            collab_started: `✨ ${eventData?.userName || 'Someone'} started a new collaborative session`,
            creation_liked: `❤️ ${eventData?.userName || 'Someone'} liked a creation`
        };

        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: user.data.user.id,
                content: eventMessages[eventType],
                type: 'system',
                action_data: { type: eventType, ...eventData }
            })
            .select()
            .single();

        if (error) {
            console.error('Error sending VS event:', error);
            return null;
        }

        return data;
    }

    /**
     * Share a visual creation to chat
     */
    async shareVisualToChat(roomId: string, imageUrl: string, caption?: string): Promise<ChatMessage | null> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;

        const displayName = user.data.user.user_metadata?.display_name || 'Someone';
        
        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: user.data.user.id,
                content: caption || 'Shared a creation',
                type: 'visual_share',
                action_data: { 
                    imageUrl, 
                    caption,
                    sharedBy: displayName
                }
            })
            .select()
            .single();

        if (error) {
            console.error('Error sharing visual:', error);
            return null;
        }

        return data;
    }

    /**
     * Subscribe to real-time updates for a room (messages and presence)
     */
    subscribeToRoom(
        roomId: string,
        onMessage: (msg: ChatMessage) => void,
        onPresenceUpdate: (users: PresenceState[]) => void,
        onTyping: (userId: string) => void
    ): RealtimeChannel {
        // Clean up existing subscription if any
        if (this.channels.has(roomId)) {
            this.channels.get(roomId)?.unsubscribe();
        }

        const channel = supabase.channel(`room:${roomId}`, {
            config: {
                presence: {
                    key: roomId,
                },
                broadcast: {
                    self: false, // Don't receive our own broadcasts
                },
            },
        });

        // Cache for user profiles to avoid repeated fetches
        const userCache = new Map<string, { display_name: string; avatar_url: string }>();

        channel
            // Listen for new messages
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`,
                },
                async (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
                    const newRecord = payload.new as ChatMessage;

                    // Try to get user details from cache or fetch
                    let userDetails = userCache.get(newRecord.user_id);
                    
                    if (!userDetails) {
                        // Try to get from presence state first
                        const presenceState = channel.presenceState();
                        Object.values(presenceState).forEach((presences: any) => {
                            presences.forEach((p: any) => {
                                if (p.user_id === newRecord.user_id) {
                                    userDetails = {
                                        display_name: p.display_name,
                                        avatar_url: p.avatar_url
                                    };
                                    userCache.set(newRecord.user_id, userDetails!);
                                }
                            });
                        });
                    }
                    
                    // If still not found, use default
                    if (!userDetails) {
                        userDetails = {
                            display_name: 'User',
                            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newRecord.user_id}`
                        };
                    }

                    const msg: ChatMessage = {
                        id: newRecord.id,
                        room_id: newRecord.room_id,
                        user_id: newRecord.user_id,
                        content: newRecord.content,
                        type: newRecord.type,
                        action_data: newRecord.action_data,
                        created_at: newRecord.created_at,
                    };

                    onMessage(msg);
                }
            )
            // Listen for broadcast events (typing)
            .on('broadcast', { event: 'typing' }, (payload: { payload: { userId: string } }) => {
                onTyping(payload.payload.userId);
            })
            // Listen for presence updates
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const users: PresenceState[] = [];

                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        users.push({
                            user_id: p.user_id,
                            display_name: p.display_name,
                            avatar_url: p.avatar_url,
                            online_at: p.online_at
                        });
                    });
                });

                onPresenceUpdate(users);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    // Track user presence
                    const user = await supabase.auth.getUser();
                    if (user.data.user) {
                        await channel.track({
                            user_id: user.data.user.id,
                            display_name: user.data.user.user_metadata.display_name || 'Anonymous',
                            avatar_url: user.data.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.data.user.id}`,
                            online_at: new Date().toISOString(),
                        });
                    }
                }
            });

        this.channels.set(roomId, channel);
        return channel;
    }

    /**
     * Broadcast typing status
     */
    async sendTyping(roomId: string) {
        const channel = this.channels.get(roomId);
        if (channel) {
            const user = await supabase.auth.getUser();
            if (user.data.user) {
                await channel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { userId: user.data.user.id },
                });
            }
        }
    }

    /**
     * Leave a room and unsubscribe
     */
    leaveRoom(channel: RealtimeChannel) {
        if (channel) {
            channel.unsubscribe();
        }
    }

    // ============================================
    // REACTIONS
    // ============================================

    /**
     * Add emoji reaction to a message
     */
    async addReaction(messageId: string, emoji: string): Promise<boolean> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            console.warn('Cannot add reaction: User not authenticated');
            return false;
        }

        const { error } = await supabase
            .from('message_reactions')
            .insert({
                message_id: messageId,
                user_id: user.data.user.id,
                emoji
            });

        if (error) {
            console.error('Error adding reaction:', error);
            return false;
        }
        return true;
    }

    /**
     * Remove emoji reaction from a message
     */
    async removeReaction(messageId: string, emoji: string): Promise<boolean> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            console.warn('Cannot remove reaction: User not authenticated');
            return false;
        }

        const { error } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', user.data.user.id)
            .eq('emoji', emoji);

        if (error) {
            console.error('Error removing reaction:', error);
            return false;
        }
        return true;
    }

    /**
     * Get all reactions for a message
     */
    async getMessageReactions(messageId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('message_reactions')
            .select(`
                *,
                user:user_id (
                    id,
                    email,
                    profiles (display_name, avatar_url)
                )
            `)
            .eq('message_id', messageId);

        if (error) {
            console.error('Error fetching reactions:', error);
            return [];
        }

        return data || [];
    }

    // ============================================
    // SEARCH
    // ============================================

    /**
     * Search messages using full-text search
     */
    async searchMessages(query: string, roomId?: string): Promise<ChatMessage[]> {
        let queryBuilder = supabase
            .from('messages')
            .select(`
                *,
                user:user_id (
                    id,
                    email,
                    profiles (display_name, avatar_url)
                )
            `)
            .textSearch('search_vector', query)
            .order('created_at', { ascending: false })
            .limit(50);

        if (roomId) {
            queryBuilder = queryBuilder.eq('room_id', roomId);
        }

        const { data, error } = await queryBuilder;

        if (error) {
            console.error('Error searching messages:', error);
            return [];
        }

        return (data || []).map((msg: any) => ({
            ...msg,
            user: {
                display_name: msg.user?.profiles?.display_name || msg.user?.email || 'Anonymous',
                avatar_url: msg.user?.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user_id}`
            }
        }));
    }

    // ============================================
    // PRIVATE ROOMS
    // ============================================

    /**
     * Create a private room
     */
    async createPrivateRoom(name: string, description?: string): Promise<ChatRoom | null> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;

        const { data, error } = await supabase
            .from('chat_rooms')
            .insert({
                name,
                description,
                is_private: true,
                is_public: false,
                created_by: user.data.user.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating private room:', error);
            return null;
        }

        // Auto-add creator as member
        await supabase
            .from('room_members')
            .insert({
                room_id: data.id,
                user_id: user.data.user.id
            });

        return data;
    }

    /**
     * Invite user to a private room
     */
    async inviteToRoom(roomId: string, invitedUserId: string): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        const { error } = await supabase
            .from('room_invitations')
            .insert({
                room_id: roomId,
                invited_by: user.data.user.id,
                invited_user_id: invitedUserId
            });

        if (error) {
            console.error('Error inviting user:', error);
        }
    }

    /**
     * Respond to room invitation
     */
    async respondToInvitation(invitationId: string, accept: boolean): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        // Update invitation status
        const { data: invitation, error: updateError } = await supabase
            .from('room_invitations')
            .update({
                status: accept ? 'accepted' : 'declined',
                responded_at: new Date().toISOString()
            })
            .eq('id', invitationId)
            .eq('invited_user_id', user.data.user.id)
            .select()
            .single();

        if (updateError) {
            console.error('Error responding to invitation:', updateError);
            return;
        }

        // If accepted, add user to room members
        if (accept && invitation) {
            await supabase
                .from('room_members')
                .insert({
                    room_id: invitation.room_id,
                    user_id: user.data.user.id
                });
        }
    }

    /**
     * Get user's pending invitations
     */
    async getUserInvitations(): Promise<any[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        const { data, error } = await supabase
            .from('room_invitations')
            .select(`
                *,
                room:room_id (name, description),
                inviter:invited_by (
                    id,
                    email,
                    profiles (display_name, avatar_url)
                )
            `)
            .eq('invited_user_id', user.data.user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching invitations:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get all rooms user has access to (public + private they're in)
     */
    async getUserRooms(): Promise<ChatRoom[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        const { data, error } = await supabase
            .from('chat_rooms')
            .select('*')
            .or(`is_public.eq.true,created_by.eq.${user.data.user.id}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching rooms:', error);
            return [];
        }

        return data || [];
    }

    // ============================================
    // NOTIFICATIONS
    // ============================================

    /**
     * Get user notifications
     */
    async getNotifications(unreadOnly: boolean = false): Promise<any[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        let query = supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', user.data.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (unreadOnly) {
            query = query.eq('read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(notificationId: string): Promise<void> {
        const { error } = await supabase
            .from('user_notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead(): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        const { error } = await supabase
            .from('user_notifications')
            .update({ read: true })
            .eq('user_id', user.data.user.id)
            .eq('read', false);

        if (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    /**
     * Create a notification
     */
    async createNotification(
        userId: string,
        type: string,
        title: string,
        body?: string,
        data?: any
    ): Promise<void> {
        const { error } = await supabase
            .from('user_notifications')
            .insert({
                user_id: userId,
                type,
                title,
                body,
                data
            });

        if (error) {
            console.error('Error creating notification:', error);
        }
    }

    // ============================================
    // USER PROFILES
    // ============================================

    /**
     * Get user profile
     */
    async getUserProfile(userId: string): Promise<any | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }

        return data;
    }

    /**
     * Update user profile
     */
    async updateUserProfile(updates: {
        display_name?: string;
        avatar_url?: string;
        bio?: string;
        status?: string;
    }): Promise<void> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.data.user.id);

        if (error) {
            console.error('Error updating profile:', error);
        }
    }
}

export const chatService = new ChatService();
