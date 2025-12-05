import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabaseClient';
import { chatService, ChatMessage as ServiceChatMessage, PresenceState } from '../../services/chatService';
import { UserProfile } from '../../services/profileService';
import ChatContainer from './ChatContainer';
import { AppMode } from '../../types';
import { Channel, ChannelCategory, Message, User } from './types';
import './ChatInterface.css';

interface ConnectedChatProps {
    userProfile: UserProfile | null;
    projectName?: string;
    onClose?: () => void;
    className?: string;
    onNavigate?: (mode: AppMode) => void;
}

/**
 * ConnectedChat bridges the new premium chat UI with the existing Supabase backend.
 * It handles real-time subscriptions, message fetching, and state synchronization.
 */
const ConnectedChat: React.FC<ConnectedChatProps> = ({
    userProfile,
    projectName = 'Genesis',
    onClose,
    className = '',
    onNavigate,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<ChannelCategory[]>([]);
    const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
    const [typingUsers, setTypingUsers] = useState<User[]>([]);

    const channelRef = useRef<any>(null);

    // Convert service message to our Message type
    const convertMessage = useCallback((msg: ServiceChatMessage): Message => {
        return {
            id: msg.id,
            channelId: msg.room_id,
            userId: msg.user_id,
            user: {
                id: msg.user_id,
                displayName: msg.user?.display_name || 'Anonymous',
                avatarUrl: msg.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user_id}`,
                status: 'online',
            },
            content: msg.content,
            type: msg.type === 'visual_share' ? 'visual_share' : msg.type === 'system' ? 'system' : 'text',
            timestamp: new Date(msg.created_at),
            editedAt: msg.edited ? new Date(msg.edited_at || msg.created_at) : undefined,
            status: 'read',
            reactions: [],
            replyTo: msg.reply_to ? {
                id: msg.reply_to,
                content: msg.reply_preview || '',
                userName: 'User',
            } : undefined,
            attachments: [],
            mentions: [],
            isPinned: false,
            isDeleted: false,
        };
    }, []);

    // Fetch rooms from database
    const fetchRooms = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('chat_rooms')
                .select('*')
                .order('updated_at', { ascending: false, nullsFirst: false });

            if (error) {
                console.error('Error fetching rooms:', error);
                // Use fallback rooms
                const fallbackChannels: Channel[] = [
                    {
                        id: 'general',
                        name: 'general',
                        type: 'text',
                        description: 'General discussion',
                        unreadCount: 0,
                        mentionCount: 0,
                        isPinned: true,
                        isMuted: false,
                        isLocked: false,
                        createdAt: new Date(),
                    },
                    {
                        id: 'ai-assistant',
                        name: 'ai-assistant',
                        type: 'ai-assistant',
                        description: 'Get help from Genesis AI',
                        icon: '✨',
                        unreadCount: 0,
                        mentionCount: 0,
                        isPinned: false,
                        isMuted: false,
                        isLocked: false,
                        createdAt: new Date(),
                    },
                ];

                setCategories([
                    {
                        id: 'default',
                        name: 'Channels',
                        channels: fallbackChannels,
                        isCollapsed: false,
                    },
                ]);
                setActiveChannel(fallbackChannels[0]);
                return;
            }

            if (data) {
                const channels: Channel[] = data.map((room: any) => ({
                    id: room.id,
                    name: room.name,
                    type: room.room_type === 'visual-studio' ? 'ai-assistant' : 'text',
                    description: room.description,
                    icon: room.icon,
                    unreadCount: room.unread_count || 0,
                    mentionCount: 0,
                    isPinned: room.is_pinned || false,
                    isMuted: false,
                    isLocked: false,
                    createdAt: new Date(room.created_at),
                }));

                // Group channels by category
                const categorized: ChannelCategory[] = [
                    {
                        id: 'main',
                        name: 'Channels',
                        channels: channels.filter(c => c.type === 'text'),
                        isCollapsed: false,
                    },
                    {
                        id: 'ai',
                        name: 'AI & Creative',
                        channels: channels.filter(c => c.type === 'ai-assistant'),
                        isCollapsed: false,
                        color: '#FF9B71',
                    },
                ];

                // Add default AI channel if none exists
                if (!channels.some(c => c.type === 'ai-assistant')) {
                    categorized[1].channels.push({
                        id: 'ai-assistant-default',
                        name: 'ai-assistant',
                        type: 'ai-assistant',
                        description: 'Get help from Genesis AI',
                        icon: '✨',
                        unreadCount: 0,
                        mentionCount: 0,
                        isPinned: false,
                        isMuted: false,
                        isLocked: false,
                        createdAt: new Date(),
                    });
                }

                setCategories(categorized.filter(cat => cat.channels.length > 0));
                if (channels.length > 0 && !activeChannel) {
                    setActiveChannel(channels[0]);
                }
            }
        } catch (err) {
            console.error('Error in fetchRooms:', err);
            setError('Failed to load channels');
        }
    }, [activeChannel]);

    // Fetch messages for a channel
    const fetchMessages = useCallback(async (channelId: string) => {
        try {
            const msgs = await chatService.getRoomMessages(channelId, 100);
            const converted = msgs.map(convertMessage);
            setMessages(prev => new Map(prev).set(channelId, converted));
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    }, [convertMessage]);

    // Subscribe to real-time updates
    const subscribeToChannel = useCallback((channelId: string) => {
        // Cleanup previous subscription
        if (channelRef.current) {
            chatService.leaveRoom(channelRef.current);
        }

        channelRef.current = chatService.subscribeToRoom(
            channelId,
            // On new message
            (newMessage) => {
                const converted = convertMessage(newMessage);
                setMessages(prev => {
                    const channelMessages = prev.get(channelId) || [];
                    // Avoid duplicates
                    if (channelMessages.some(m => m.id === converted.id)) {
                        return prev;
                    }
                    return new Map(prev).set(channelId, [...channelMessages, converted]);
                });
            },
            // On presence update
            (users: PresenceState[]) => {
                setOnlineUsers(users.map(u => ({
                    id: u.user_id,
                    displayName: u.display_name,
                    avatarUrl: u.avatar_url,
                    status: 'online',
                })));
            },
            // On typing
            (userId: string) => {
                if (userId !== userProfile?.id) {
                    // Add typing user temporarily
                    const typingUser: User = {
                        id: userId,
                        displayName: 'Someone',
                        status: 'online',
                    };
                    setTypingUsers(prev => {
                        if (prev.some(u => u.id === userId)) return prev;
                        return [...prev, typingUser];
                    });

                    // Remove after 3 seconds
                    setTimeout(() => {
                        setTypingUsers(prev => prev.filter(u => u.id !== userId));
                    }, 3000);
                }
            }
        );
    }, [convertMessage, userProfile?.id]);

    // Initialize
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await fetchRooms();
            setIsLoading(false);
        };
        init();

        return () => {
            if (channelRef.current) {
                chatService.leaveRoom(channelRef.current);
            }
        };
    }, [fetchRooms]);

    // Subscribe to active channel
    useEffect(() => {
        if (activeChannel) {
            fetchMessages(activeChannel.id);
            subscribeToChannel(activeChannel.id);
        }
    }, [activeChannel, fetchMessages, subscribeToChannel]);

    // Send message handler
    const handleSendMessage = useCallback(async (content: string) => {
        if (!activeChannel || !userProfile) return;

        try {
            await chatService.sendMessage(
                activeChannel.id,
                content,
                'text'
            );
        } catch (err) {
            console.error('Error sending message:', err);
        }
    }, [activeChannel, userProfile]);

    if (isLoading) {
        return (
            <div className={`chat-interface glass-panel ${className}`}>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r from-coral-burst to-gold-sunshine animate-pulse" />
                        <p className="text-sm text-[var(--chat-text-muted)]">Loading chat...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`chat-interface glass-panel ${className}`}>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <p className="text-sm text-red-500 mb-2">{error}</p>
                        <button
                            className="px-4 py-2 bg-coral-burst text-white rounded-lg"
                            onClick={() => {
                                setError(null);
                                fetchRooms();
                            }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ChatContainer
            projectName={projectName}
            userProfile={userProfile ? {
                id: userProfile.id,
                displayName: userProfile.full_name || userProfile.email || 'User',
                avatarUrl: userProfile.avatar_url || undefined,
            } : null}
            onClose={onClose}
            className={className}
            onNavigate={onNavigate}
        />
    );
};

export default ConnectedChat;
