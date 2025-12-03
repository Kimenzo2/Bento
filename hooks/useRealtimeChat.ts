/**
 * useRealtimeChat Hook
 * 
 * React hook that bridges the RealtimeChatService with the ChatContainer component.
 * Provides real-time messaging, presence, typing indicators, and more.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    realtimeChatService, 
    ChatCategory, 
    ChatChannel, 
    ChatMessage as DBChatMessage, 
    ChatUser,
    ChatReaction as DBChatReaction,
    TypingIndicator,
} from '../services/realtimeChatService';
import { Channel, ChannelCategory, Message, User } from '../components/ChatInterface/types';

export interface UseRealtimeChatOptions {
    userId: string | null;
    projectId?: string;
    onError?: (error: Error) => void;
}

export interface UseRealtimeChatReturn {
    // Data
    categories: ChannelCategory[];
    messages: Message[];
    onlineMembers: User[];
    offlineMembers: User[];
    typingUsers: User[];
    
    // State
    isLoading: boolean;
    isConnected: boolean;
    error: string | null;
    
    // Channel operations
    selectChannel: (channel: Channel | null) => void;
    toggleCategory: (categoryId: string) => void;
    currentChannel: Channel | null;
    
    // Message operations
    sendMessage: (content: string, replyToId?: string) => Promise<void>;
    
    // Reactions
    addReaction: (messageId: string, emoji: string) => Promise<void>;
    
    // Typing
    startTyping: () => void;
    stopTyping: () => void;
    
    // Utilities
    refreshData: () => Promise<void>;
}

// Transform database types to UI types
function transformCategory(dbCategory: ChatCategory): ChannelCategory {
    const channels = (dbCategory.channels || []).map(transformChannel);
    
    return {
        id: dbCategory.id,
        name: dbCategory.name,
        isCollapsed: dbCategory.is_collapsed,
        color: dbCategory.color || undefined,
        channels,
    };
}

function transformChannel(dbChannel: ChatChannel): Channel {
    return {
        id: dbChannel.id,
        name: dbChannel.name,
        type: dbChannel.type as Channel['type'],
        description: dbChannel.description || undefined,
        icon: dbChannel.icon || undefined,
        unreadCount: dbChannel.unread_count || 0,
        mentionCount: dbChannel.mention_count || 0,
        isPinned: dbChannel.is_pinned,
        isMuted: dbChannel.is_muted,
        isLocked: dbChannel.is_locked,
        createdAt: new Date(dbChannel.created_at),
    };
}

function transformMessage(dbMessage: DBChatMessage, currentUserId: string | null): Message {
    // Group reactions
    const reactions: Message['reactions'] = (dbMessage.reactions || []).map((r: DBChatReaction) => ({
        emoji: r.emoji,
        count: r.count,
        users: r.users,
        hasReacted: currentUserId ? r.users.includes(currentUserId) : false,
    }));

    return {
        id: dbMessage.id,
        channelId: dbMessage.channel_id,
        userId: dbMessage.user_id,
        user: dbMessage.user ? {
            id: dbMessage.user.id,
            displayName: dbMessage.user.display_name,
            avatarUrl: dbMessage.user.avatar_url || undefined,
            status: dbMessage.user.status as User['status'],
        } : {
            id: dbMessage.user_id,
            displayName: 'Unknown User',
            status: 'offline' as const,
        },
        content: dbMessage.content,
        type: dbMessage.type as Message['type'],
        timestamp: new Date(dbMessage.created_at),
        status: 'read', // Simplified for now
        reactions,
        attachments: dbMessage.attachments || [],
        mentions: dbMessage.mentions || [],
        isPinned: dbMessage.is_pinned,
        isDeleted: dbMessage.is_deleted,
        replyTo: dbMessage.reply_to ? {
            id: dbMessage.reply_to.id,
            content: dbMessage.reply_to.content,
            userName: dbMessage.reply_to.user_name,
        } : undefined,
        threadId: dbMessage.thread_id || undefined,
        aiMetadata: dbMessage.ai_metadata ? {
            model: dbMessage.ai_metadata.model || 'Genesis AI',
            tokens: dbMessage.ai_metadata.tokens || 0,
        } : undefined,
    };
}

function transformChatUser(chatUser: ChatUser): User {
    return {
        id: chatUser.id,
        displayName: chatUser.display_name,
        avatarUrl: chatUser.avatar_url || undefined,
        status: chatUser.status as User['status'],
    };
}

export function useRealtimeChat(options: UseRealtimeChatOptions): UseRealtimeChatReturn {
    const { userId, projectId, onError } = options;
    
    // State
    const [categories, setCategories] = useState<ChannelCategory[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [onlineMembers, setOnlineMembers] = useState<User[]>([]);
    const [offlineMembers, setOfflineMembers] = useState<User[]>([]);
    const [typingUsers, setTypingUsers] = useState<User[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Refs
    const currentChannelRef = useRef<Channel | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    
    // Keep refs in sync
    useEffect(() => {
        currentChannelRef.current = currentChannel;
    }, [currentChannel]);
    
    // Initialize connection
    useEffect(() => {
        if (!userId) {
            setIsConnected(false);
            return;
        }
        
        const init = async () => {
            try {
                await realtimeChatService.initialize(userId);
                setIsConnected(true);
                setError(null);
                await loadInitialData();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to initialize chat';
                setError(errorMessage);
                onError?.(err instanceof Error ? err : new Error(errorMessage));
            }
        };
        
        init();
        
        return () => {
            realtimeChatService.cleanup();
            setIsConnected(false);
        };
    }, [userId]);
    
    // Subscribe to channel when active channel changes
    useEffect(() => {
        if (!currentChannel || !isConnected) return;
        
        // Unsubscribe from previous channel
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }
        
        const setupSubscription = async () => {
            try {
                // Load initial messages
                await loadChannelMessages(currentChannel.id);
                
                // Subscribe to realtime updates
                const unsubscribe = realtimeChatService.subscribeToChannel(currentChannel.id, {
                    onMessage: (dbMessage) => {
                        const message = transformMessage(dbMessage, userId);
                        setMessages(prev => [...prev, message]);
                        // Remove sender from typing users
                        setTypingUsers(prev => prev.filter(u => u.id !== dbMessage.user_id));
                    },
                    onMessageUpdate: (dbMessage) => {
                        const message = transformMessage(dbMessage, userId);
                        setMessages(prev => prev.map(m => m.id === message.id ? message : m));
                    },
                    onMessageDelete: (messageId) => {
                        setMessages(prev => prev.filter(m => m.id !== messageId));
                    },
                    onReaction: async ({ messageId }) => {
                        // Reload the specific message to get updated reactions
                        await loadChannelMessages(currentChannel.id);
                    },
                    onTyping: (indicators) => {
                        const users: User[] = indicators
                            .filter(t => t.user_id !== userId)
                            .map(t => ({
                                id: t.user_id,
                                displayName: t.user?.display_name || 'User',
                                avatarUrl: t.user?.avatar_url || undefined,
                                status: 'online' as const,
                            }));
                        setTypingUsers(users);
                    },
                });
                
                unsubscribeRef.current = unsubscribe;
                
                // Update presence to show current channel
                await realtimeChatService.updatePresence('online', { current_channel_id: currentChannel.id });
            } catch (err) {
                console.error('Failed to subscribe to channel:', err);
            }
        };
        
        setupSubscription();
        
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [currentChannel?.id, isConnected, userId]);
    
    // Load initial data
    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            // Get categories with channels
            const dbCategories = await realtimeChatService.getCategories(projectId);
            const transformedCategories = dbCategories.map(transformCategory);
            setCategories(transformedCategories);
            
            // Get online users
            const users = await realtimeChatService.getOnlineUsers();
            const online = users.filter(u => u.status !== 'offline').map(transformChatUser);
            // For now, offline members would need a separate query
            setOnlineMembers(online);
            setOfflineMembers([]);
            
            // Auto-select first channel if available
            const firstChannel = transformedCategories[0]?.channels?.[0];
            if (firstChannel) {
                setCurrentChannel(firstChannel);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load chat data';
            setError(errorMessage);
            onError?.(err instanceof Error ? err : new Error(errorMessage));
        } finally {
            setIsLoading(false);
        }
    };
    
    // Load messages for a channel
    const loadChannelMessages = async (channelId: string) => {
        try {
            const dbMessages = await realtimeChatService.getMessages(channelId, { limit: 50 });
            const transformedMessages = dbMessages.map(msg => transformMessage(msg, userId));
            setMessages(transformedMessages);
            
            // Load typing users
            const typing = await realtimeChatService.getTypingUsers(channelId);
            setTypingUsers(typing
                .filter(t => t.user_id !== userId)
                .map(t => ({
                    id: t.user_id,
                    displayName: t.user?.display_name || 'User',
                    avatarUrl: t.user?.avatar_url || undefined,
                    status: 'online' as const,
                }))
            );
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    };
    
    // Actions
    const selectChannel = useCallback((channel: Channel | null) => {
        // Stop typing in current channel
        if (currentChannelRef.current) {
            realtimeChatService.stopTyping(currentChannelRef.current.id);
        }
        
        setCurrentChannel(channel);
        setMessages([]);
        setTypingUsers([]);
    }, []);
    
    const toggleCategory = useCallback((categoryId: string) => {
        setCategories(prev =>
            prev.map(cat =>
                cat.id === categoryId ? { ...cat, isCollapsed: !cat.isCollapsed } : cat
            )
        );
    }, []);
    
    const sendMessage = useCallback(async (content: string, replyToId?: string) => {
        if (!currentChannel || !userId) return;
        
        try {
            await realtimeChatService.sendMessage({
                channel_id: currentChannel.id,
                content,
                reply_to_id: replyToId,
            });
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to send message');
            onError?.(error);
            throw error;
        }
    }, [currentChannel, userId, onError]);
    
    const addReaction = useCallback(async (messageId: string, emoji: string) => {
        try {
            await realtimeChatService.addReaction(messageId, emoji);
            // Reload messages to get updated reactions
            if (currentChannelRef.current) {
                await loadChannelMessages(currentChannelRef.current.id);
            }
        } catch (err) {
            console.error('Failed to add reaction:', err);
        }
    }, []);
    
    const startTyping = useCallback(() => {
        if (!currentChannel) return;
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        realtimeChatService.startTyping(currentChannel.id);
        
        // Auto-stop after 3 seconds of no input
        typingTimeoutRef.current = setTimeout(() => {
            if (currentChannelRef.current) {
                realtimeChatService.stopTyping(currentChannelRef.current.id);
            }
        }, 3000);
    }, [currentChannel]);
    
    const stopTyping = useCallback(() => {
        if (!currentChannel) return;
        
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        
        realtimeChatService.stopTyping(currentChannel.id);
    }, [currentChannel]);
    
    const refreshData = useCallback(async () => {
        await loadInitialData();
    }, [projectId]);
    
    return {
        categories,
        messages,
        onlineMembers,
        offlineMembers,
        typingUsers,
        isLoading,
        isConnected,
        error,
        selectChannel,
        toggleCategory,
        currentChannel,
        sendMessage,
        addReaction,
        startTyping,
        stopTyping,
        refreshData,
    };
}

export default useRealtimeChat;
