import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Settings, Bell, Users, Hash, Volume2, Sparkles,
    ChevronDown, ChevronRight, Plus, Pin, MoreHorizontal,
    X, MessageSquare, Command, Moon, Sun, Wifi, WifiOff, Menu
} from 'lucide-react';
import { Channel, ChannelCategory, Message, User, chatAnimations } from './types';
import ChannelList from './ChannelList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ThreadPanel from './ThreadPanel';
import SearchModal from './SearchModal';
import MembersSidebar from './MembersSidebar';
import { useRealtimeChat } from '../../hooks/useRealtimeChat';
import './ChatInterface.css';

interface ChatContainerProps {
    projectName?: string;
    projectIcon?: string;
    projectId?: string;
    userProfile: {
        id: string;
        displayName: string;
        avatarUrl?: string;
    } | null;
    onClose?: () => void;
    className?: string;
    /** Enable real-time Supabase connection. If false, uses mock data. */
    useRealtime?: boolean;
}

// Mock data for demonstration
const mockCategories: ChannelCategory[] = [
    {
        id: 'cat-1',
        name: 'General',
        isCollapsed: false,
        channels: [
            {
                id: 'ch-1',
                name: 'welcome',
                type: 'text',
                unreadCount: 0,
                mentionCount: 0,
                isPinned: false,
                isMuted: false,
                isLocked: false,
                createdAt: new Date(),
                description: 'Say hello to the community!',
            },
            {
                id: 'ch-2',
                name: 'general',
                type: 'text',
                unreadCount: 5,
                mentionCount: 2,
                isPinned: true,
                isMuted: false,
                isLocked: false,
                createdAt: new Date(),
                description: 'General discussion about your project',
            },
        ],
    },
    {
        id: 'cat-2',
        name: 'Creative Studio',
        isCollapsed: false,
        color: '#FF9B71',
        channels: [
            {
                id: 'ch-3',
                name: 'ai-assistant',
                type: 'ai-assistant',
                unreadCount: 0,
                mentionCount: 0,
                isPinned: false,
                isMuted: false,
                isLocked: false,
                createdAt: new Date(),
                description: 'Get help from Genesis AI',
                icon: '✨',
            },
            {
                id: 'ch-4',
                name: 'visual-studio',
                type: 'text',
                unreadCount: 12,
                mentionCount: 0,
                isPinned: false,
                isMuted: false,
                isLocked: false,
                createdAt: new Date(),
                description: 'Share and discuss visual creations',
                icon: '🎨',
            },
        ],
    },
    {
        id: 'cat-3',
        name: 'Voice Channels',
        isCollapsed: false,
        channels: [
            {
                id: 'ch-5',
                name: 'Creative Lounge',
                type: 'voice',
                unreadCount: 0,
                mentionCount: 0,
                isPinned: false,
                isMuted: false,
                isLocked: false,
                createdAt: new Date(),
            },
            {
                id: 'ch-6',
                name: 'Brainstorm Room',
                type: 'voice',
                unreadCount: 0,
                mentionCount: 0,
                isPinned: false,
                isMuted: false,
                isLocked: false,
                createdAt: new Date(),
            },
        ],
    },
];

// Welcome channel messages
const welcomeMessages: Message[] = [
    {
        id: 'msg-welcome-1',
        channelId: 'ch-1',
        userId: 'ai-genesis',
        user: {
            id: 'ai-genesis',
            displayName: 'Genesis AI',
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis',
            status: 'online',
        },
        content: '👋 **Welcome to Genesis!**\n\nI\'m your AI creative assistant, here to help you bring your stories to life. Whether you\'re writing a children\'s book, crafting a curriculum, or designing an infographic, I\'m ready to assist!\n\n**Quick tips:**\n- Use the AI Assistant channel to get creative help\n- Share your visual creations in the Visual Studio channel\n- React to messages with emojis to show your support!',
        type: 'ai_response',
        timestamp: new Date(Date.now() - 7200000),
        status: 'read',
        reactions: [
            { emoji: '👋', count: 5, users: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'], hasReacted: false },
            { emoji: '✨', count: 3, users: ['user-1', 'user-2', 'user-3'], hasReacted: true },
        ],
        attachments: [],
        mentions: [],
        isPinned: true,
        isDeleted: false,
        aiMetadata: {
            model: 'Genesis Pro',
            tokens: 89,
        },
    },
    {
        id: 'msg-welcome-2',
        channelId: 'ch-1',
        userId: 'user-2',
        user: {
            id: 'user-2',
            displayName: 'Alex Rivera',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
            status: 'online',
        },
        content: 'Hello everyone! Excited to be here! 🎉',
        type: 'text',
        timestamp: new Date(Date.now() - 5400000),
        status: 'read',
        reactions: [
            { emoji: '👍', count: 2, users: ['user-1', 'user-3'], hasReacted: false },
        ],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
    },
];

const mockMessages: Message[] = [
    ...welcomeMessages,
    {
        id: 'msg-1',
        channelId: 'ch-2',
        userId: 'user-1',
        user: {
            id: 'user-1',
            displayName: 'Sarah Chen',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
            status: 'online',
        },
        content: 'Hey everyone! Just finished the first chapter of my new children\'s book. Would love some feedback! 📚',
        type: 'text',
        timestamp: new Date(Date.now() - 3600000),
        status: 'read',
        reactions: [
            { emoji: '❤️', count: 3, users: ['user-2', 'user-3', 'user-4'], hasReacted: false },
            { emoji: '🎉', count: 2, users: ['user-2', 'user-5'], hasReacted: true },
        ],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
    },
    {
        id: 'msg-2',
        channelId: 'ch-2',
        userId: 'user-2',
        user: {
            id: 'user-2',
            displayName: 'Alex Rivera',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
            status: 'online',
        },
        content: 'That\'s amazing Sarah! Can\'t wait to see it. I\'ve been working on some illustrations that might complement your story.',
        type: 'text',
        timestamp: new Date(Date.now() - 3500000),
        status: 'read',
        reactions: [],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
        replyTo: {
            id: 'msg-1',
            content: 'Hey everyone! Just finished the first chapter...',
            userName: 'Sarah Chen',
        },
    },
    {
        id: 'msg-3',
        channelId: 'ch-2',
        userId: 'ai-genesis',
        user: {
            id: 'ai-genesis',
            displayName: 'Genesis AI',
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis',
            status: 'online',
        },
        content: '✨ **Story Analysis Complete!**\n\nI\'ve analyzed your chapter and here are some suggestions:\n\n1. **Character Development**: Consider adding more backstory for the protagonist\n2. **Pacing**: The middle section could use a bit more tension\n3. **Imagery**: Great use of sensory details in the opening paragraph!\n\nWould you like me to generate some illustration concepts?',
        type: 'ai_response',
        timestamp: new Date(Date.now() - 3000000),
        status: 'read',
        reactions: [
            { emoji: '✨', count: 5, users: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'], hasReacted: true },
        ],
        attachments: [],
        mentions: [],
        isPinned: true,
        isDeleted: false,
        aiMetadata: {
            model: 'Genesis Pro',
            tokens: 156,
        },
    },
    {
        id: 'msg-4',
        channelId: 'ch-2',
        userId: 'user-3',
        user: {
            id: 'user-3',
            displayName: 'Jordan Kim',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan',
            status: 'away',
        },
        content: 'Just dropping in to say the AI suggestions are spot on! I used similar feedback for my last project.',
        type: 'text',
        timestamp: new Date(Date.now() - 1800000),
        status: 'read',
        reactions: [],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
        threadReplies: 4,
    },
    {
        id: 'msg-5',
        channelId: 'ch-2',
        userId: 'user-1',
        user: {
            id: 'user-1',
            displayName: 'Sarah Chen',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
            status: 'online',
        },
        content: 'Here\'s a sneak peek of the cover concept! 🎨',
        type: 'text',
        timestamp: new Date(Date.now() - 600000),
        status: 'delivered',
        reactions: [
            { emoji: '🔥', count: 8, users: ['user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9'], hasReacted: false },
            { emoji: '😍', count: 3, users: ['user-2', 'user-3', 'user-4'], hasReacted: true },
        ],
        attachments: [
            {
                id: 'att-1',
                type: 'image',
                url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400',
                name: 'cover_concept_v1.png',
                thumbnail: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200',
                metadata: {
                    width: 800,
                    height: 1200,
                },
            },
        ],
        mentions: [],
        isPinned: false,
        isDeleted: false,
    },
];

const mockOnlineUsers: User[] = [
    { id: 'user-1', displayName: 'Sarah Chen', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', status: 'online' },
    { id: 'user-2', displayName: 'Alex Rivera', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex', status: 'online' },
    { id: 'ai-genesis', displayName: 'Genesis AI', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis', status: 'online' },
];

const mockOfflineUsers: User[] = [
    { id: 'user-3', displayName: 'Jordan Kim', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan', status: 'away' },
    { id: 'user-4', displayName: 'Taylor Swift', avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=taylor', status: 'offline' },
];

// Default guest user for when no user is authenticated
const DEFAULT_GUEST_USER = {
    id: 'guest-user',
    displayName: 'Guest User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
};

const ChatContainer: React.FC<ChatContainerProps> = ({
    projectName = 'Genesis',
    projectIcon,
    userProfile: propUserProfile,
    onClose,
    className = '',
    useRealtime = false,
    projectId,
}) => {
    // Use provided user profile or default guest user
    const userProfile = propUserProfile || DEFAULT_GUEST_USER;
    
    // Realtime hook - only active when useRealtime is true and user is authenticated
    const realtimeChat = useRealtimeChat({
        projectId: projectId,
        userId: useRealtime && propUserProfile?.id ? propUserProfile.id : null,
    });

    // Local state (used when not in realtime mode, or as fallback)
    const [localCategories, setLocalCategories] = useState<ChannelCategory[]>(mockCategories);
    const [localActiveChannel, setLocalActiveChannel] = useState<Channel | null>(mockCategories[0].channels[1]);
    const [localMessages, setLocalMessages] = useState<Message[]>(mockMessages);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isThreadOpen, setIsThreadOpen] = useState(false);
    const [activeThread, setActiveThread] = useState<Message | null>(null);
    const [isMembersOpen, setIsMembersOpen] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [localTypingUsers, setLocalTypingUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Derived state - use realtime data when available, otherwise fallback to mock/local
    const categories = useRealtime && realtimeChat.isConnected ? realtimeChat.categories : localCategories;
    const setCategories = useRealtime && realtimeChat.isConnected 
        ? () => {} // Categories are managed by realtime 
        : setLocalCategories;
    
    const activeChannel = useRealtime && realtimeChat.isConnected 
        ? realtimeChat.currentChannel 
        : localActiveChannel;
    
    const messages = useRealtime && realtimeChat.isConnected 
        ? realtimeChat.messages 
        : localMessages;
    const setMessages = useRealtime && realtimeChat.isConnected 
        ? () => {} // Messages are managed by realtime 
        : setLocalMessages;
    
    const typingUsers = useRealtime && realtimeChat.isConnected 
        ? realtimeChat.typingUsers 
        : localTypingUsers;
    const setTypingUsers = useRealtime && realtimeChat.isConnected 
        ? () => {} 
        : setLocalTypingUsers;

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            // Escape to close modals
            if (e.key === 'Escape') {
                if (isSearchOpen) setIsSearchOpen(false);
                if (isThreadOpen) setIsThreadOpen(false);
                if (replyingTo) setReplyingTo(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen, isThreadOpen, replyingTo]);

    // Toggle dark mode
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Handlers
    const handleChannelSelect = useCallback((channel: Channel) => {
        if (useRealtime && realtimeChat.isConnected) {
            realtimeChat.selectChannel(channel);
        } else {
            setLocalActiveChannel(channel);
        }
        setIsThreadOpen(false);
        setActiveThread(null);
    }, [useRealtime, realtimeChat]);

    const handleCategoryToggle = useCallback((categoryId: string) => {
        if (useRealtime && realtimeChat.isConnected) {
            realtimeChat.toggleCategory(categoryId);
        } else {
            setLocalCategories(prev =>
                prev.map(cat =>
                    cat.id === categoryId ? { ...cat, isCollapsed: !cat.isCollapsed } : cat
                )
            );
        }
    }, [useRealtime, realtimeChat]);

    const handleSendMessage = useCallback(async (content: string, attachments?: File[]) => {
        if (!activeChannel) return;

        if (useRealtime && realtimeChat.isConnected) {
            // Use realtime service
            await realtimeChat.sendMessage(content, replyingTo?.id);
            setReplyingTo(null);
        } else {
            // Use local/mock mode
            const newMessage: Message = {
                id: `msg-${Date.now()}`,
                channelId: activeChannel.id,
                userId: userProfile.id,
                user: {
                    id: userProfile.id,
                    displayName: userProfile.displayName,
                    avatarUrl: userProfile.avatarUrl,
                    status: 'online',
                },
                content,
                type: 'text',
                timestamp: new Date(),
                status: 'sending',
                reactions: [],
                attachments: [],
                mentions: [],
                isPinned: false,
                isDeleted: false,
                replyTo: replyingTo ? {
                    id: replyingTo.id,
                    content: replyingTo.content.substring(0, 100),
                    userName: replyingTo.user.displayName,
                } : undefined,
            };

            setLocalMessages(prev => [...prev, newMessage]);
            setReplyingTo(null);

            // Simulate message sent after a short delay
            setTimeout(() => {
                setLocalMessages(prev =>
                    prev.map(msg =>
                        msg.id === newMessage.id ? { ...msg, status: 'sent' } : msg
                    )
                );
            }, 500);

            // Simulate AI response for AI channel
            if (activeChannel.type === 'ai-assistant') {
                setLocalTypingUsers([{
                    id: 'ai-genesis',
                    displayName: 'Genesis AI',
                    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis',
                    status: 'online',
                }]);

                setTimeout(() => {
                    setLocalTypingUsers([]);
                    const aiResponse: Message = {
                        id: `msg-${Date.now() + 1}`,
                        channelId: activeChannel.id,
                        userId: 'ai-genesis',
                        user: {
                            id: 'ai-genesis',
                            displayName: 'Genesis AI',
                            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis',
                            status: 'online',
                        },
                        content: `I understand you're asking about "${content}". Let me help you with that!\n\nHere are some suggestions:\n1. Consider the context and audience\n2. Focus on clarity and engagement\n3. Use vivid imagery and descriptions\n\nWould you like me to elaborate on any of these points?`,
                        type: 'ai_response',
                        timestamp: new Date(),
                        status: 'read',
                        reactions: [],
                        attachments: [],
                        mentions: [],
                        isPinned: false,
                        isDeleted: false,
                        aiMetadata: {
                            model: 'Genesis Pro',
                            tokens: 89,
                        },
                };
                setLocalMessages(prev => [...prev, aiResponse]);
            }, 2000);
        }
        }
    }, [activeChannel, userProfile, replyingTo, useRealtime, realtimeChat]);

    const handleReaction = useCallback(async (messageId: string, emoji: string) => {
        if (useRealtime && realtimeChat.isConnected) {
            await realtimeChat.addReaction(messageId, emoji);
        } else {
            setLocalMessages(prev =>
                prev.map(msg => {
                    if (msg.id !== messageId) return msg;

                    const existingReaction = msg.reactions.find(r => r.emoji === emoji);
                    if (existingReaction) {
                        if (existingReaction.hasReacted) {
                            // Remove reaction
                            return {
                                ...msg,
                                reactions: msg.reactions
                                    .map(r =>
                                        r.emoji === emoji
                                            ? { ...r, count: r.count - 1, hasReacted: false, users: r.users.filter(u => u !== userProfile?.id) }
                                            : r
                                    )
                                    .filter(r => r.count > 0),
                            };
                        } else {
                            // Add to existing reaction
                            return {
                                ...msg,
                                reactions: msg.reactions.map(r =>
                                    r.emoji === emoji
                                        ? { ...r, count: r.count + 1, hasReacted: true, users: [...r.users, userProfile?.id || ''] }
                                        : r
                                ),
                            };
                        }
                    } else {
                        // New reaction
                        return {
                            ...msg,
                            reactions: [...msg.reactions, { emoji, count: 1, users: [userProfile?.id || ''], hasReacted: true }],
                        };
                    }
                })
            );
        }
    }, [userProfile, useRealtime, realtimeChat]);

    const handleOpenThread = useCallback((message: Message) => {
        setActiveThread(message);
        setIsThreadOpen(true);
    }, []);

    const handleReply = useCallback((message: Message) => {
        setReplyingTo(message);
    }, []);

    // Handle typing indicator
    const handleTypingStart = useCallback(() => {
        if (useRealtime && realtimeChat.isConnected) {
            realtimeChat.startTyping();
        }
    }, [useRealtime, realtimeChat]);

    const handleTypingStop = useCallback(() => {
        if (useRealtime && realtimeChat.isConnected) {
            realtimeChat.stopTyping();
        }
    }, [useRealtime, realtimeChat]);

    // Filter messages for active channel
    const channelMessages = messages.filter(
        msg => activeChannel && msg.channelId === activeChannel.id
    );

    // Compute online members from presence
    const onlineMembers = useRealtime && realtimeChat.isConnected
        ? realtimeChat.onlineMembers
        : mockOnlineUsers;
    
    const offlineMembers = useRealtime && realtimeChat.isConnected
        ? realtimeChat.offlineMembers
        : mockOfflineUsers;

    return (
        <div
            ref={containerRef}
            className={`chat-interface ${isDarkMode ? 'dark' : ''} ${className}`}
        >
            {/* Premium ambient particles background - Hidden on mobile */}
            <div className="chat-ambient-particles hidden md:block">
                {[...Array(8)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`chat-particle chat-particle--${['coral', 'gold', 'mint'][i % 3]}`}
                        style={{
                            top: `${10 + (i * 12)}%`,
                            left: `${5 + (i * 11)}%`,
                            animationDelay: `${i * 0.5}s`,
                        }}
                    />
                ))}
            </div>

            {/* Legacy sparkle effects - Hidden on mobile */}
            <div className="sparkle-container hidden md:block">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="sparkle" />
                ))}
            </div>

            {/* Mobile Sidebar Backdrop */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        className="chat-sidebar-backdrop md:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <AnimatePresence mode="wait">
                {isSidebarOpen && (
                    <motion.div
                        className={`chat-sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}
                        initial={{ x: -280, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -280, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        {/* Sidebar Header */}
                        <div className="chat-sidebar-header">
                            <div className="chat-project-title">
                                <div className="chat-project-icon">
                                    {projectIcon || projectName.charAt(0)}
                                </div>
                                <div className="chat-project-info">
                                    <h2>{projectName}</h2>
                                    <span>Project Chat</span>
                                </div>
                                <ChevronDown size={16} className="text-gray-400" />
                            </div>

                            {/* Search */}
                            <div className="chat-search">
                                <Search size={16} className="chat-search-icon" />
                                <input
                                    type="text"
                                    className="chat-search-input"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClick={() => setIsSearchOpen(true)}
                                    readOnly
                                />
                                <div className="chat-search-kbd">
                                    <kbd>⌘</kbd>
                                    <kbd>K</kbd>
                                </div>
                            </div>
                        </div>

                        {/* Channel List */}
                        <ChannelList
                            categories={categories}
                            activeChannel={activeChannel}
                            onChannelSelect={handleChannelSelect}
                            onCategoryToggle={handleCategoryToggle}
                            searchQuery={searchQuery}
                        />

                        {/* Members Section Toggle in Sidebar */}
                        <div className="px-2 py-2 border-t border-[var(--chat-border-primary)]">
                            <button
                                onClick={() => setIsMembersOpen(!isMembersOpen)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                                    isMembersOpen 
                                        ? 'bg-[var(--chat-coral-burst)] text-white' 
                                        : 'hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)]'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Users size={18} />
                                    <span className="font-medium text-sm">Members</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        isMembersOpen 
                                            ? 'bg-white/20 text-white' 
                                            : 'bg-green-500/20 text-green-600'
                                    }`}>
                                        {onlineMembers.length} online
                                    </span>
                                    <ChevronRight 
                                        size={16} 
                                        className={`transition-transform ${isMembersOpen ? 'rotate-90' : ''}`}
                                    />
                                </div>
                            </button>

                            {/* Inline Members List */}
                            <AnimatePresence>
                                {isMembersOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-2 space-y-1 max-h-[200px] overflow-y-auto scroll-container">
                                            {/* Online Users */}
                                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--chat-text-muted)]">
                                                Online — {onlineMembers.length}
                                            </div>
                                            {onlineMembers.map((user: User) => (
                                                <div 
                                                    key={user.id}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--chat-bg-hover)] cursor-pointer transition-colors"
                                                >
                                                    <div className="relative">
                                                        <img 
                                                            src={user.avatarUrl} 
                                                            alt={user.displayName}
                                                            className="w-7 h-7 rounded-full"
                                                        />
                                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--chat-bg-primary)] ${
                                                            user.status === 'online' ? 'bg-green-500' :
                                                            user.status === 'away' ? 'bg-yellow-500' :
                                                            user.status === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                                                        }`} />
                                                    </div>
                                                    <span className="text-sm text-[var(--chat-text-primary)] truncate flex-1">
                                                        {user.displayName}
                                                    </span>
                                                    {user.id === 'ai-genesis' && (
                                                        <Sparkles size={12} className="text-[var(--chat-coral-burst)]" />
                                                    )}
                                                </div>
                                            ))}

                                            {/* Offline Users */}
                                            {offlineMembers.length > 0 && (
                                                <>
                                                    <div className="px-2 py-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--chat-text-muted)]">
                                                        Offline — {offlineMembers.length}
                                                    </div>
                                                    {offlineMembers.map((user: User) => (
                                                        <div 
                                                            key={user.id}
                                                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--chat-bg-hover)] cursor-pointer transition-colors opacity-60"
                                                        >
                                                            <div className="relative">
                                                                <img 
                                                                    src={user.avatarUrl} 
                                                                    alt={user.displayName}
                                                                    className="w-7 h-7 rounded-full grayscale"
                                                                />
                                                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--chat-bg-primary)] bg-gray-400" />
                                                            </div>
                                                            <span className="text-sm text-[var(--chat-text-secondary)] truncate flex-1">
                                                                {user.displayName}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Sidebar Footer - User */}
                        <div className="p-3 border-t border-[var(--chat-border-primary)]">
                            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--chat-bg-hover)] cursor-pointer transition-colors">
                                <div className="relative">
                                    <img
                                        src={userProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.id}`}
                                        alt={userProfile?.displayName}
                                        className="w-9 h-9 rounded-full"
                                    />
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[var(--chat-bg-primary)] rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[var(--chat-text-primary)] truncate">
                                        {userProfile?.displayName || 'Guest'}
                                    </div>
                                    <div className="text-xs text-[var(--chat-text-muted)]">Online</div>
                                </div>
                                <button
                                    onClick={() => setIsDarkMode(!isDarkMode)}
                                    className="p-2 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-secondary)] transition-colors"
                                >
                                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Chat Canvas */}
            <div className="chat-canvas glass-panel">
                {/* Canvas Header */}
                <div className="chat-canvas-header">
                    <div className="chat-canvas-title">
                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden chat-action-btn mr-1"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            title="Open menu"
                            aria-label="Open sidebar menu"
                        >
                            <Menu size={20} />
                        </button>
                        {activeChannel?.type === 'text' && <Hash size={20} className="text-[var(--chat-text-muted)]" />}
                        {activeChannel?.type === 'voice' && <Volume2 size={20} className="text-[var(--chat-mint-breeze)]" />}
                        {activeChannel?.type === 'ai-assistant' && <Sparkles size={20} className="text-[var(--chat-coral-burst)]" />}
                        <h3>{activeChannel?.name || 'Select a channel'}</h3>
                        {activeChannel?.description && (
                            <span className="chat-canvas-description hidden lg:inline">
                                {activeChannel.description}
                            </span>
                        )}
                        
                        {/* Connection Status Indicator */}
                        {useRealtime && (
                            <div 
                                className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                    realtimeChat.isConnected 
                                        ? 'bg-green-500/20 text-green-500' 
                                        : realtimeChat.error
                                        ? 'bg-red-500/20 text-red-500'
                                        : 'bg-yellow-500/20 text-yellow-500'
                                }`}
                                title={realtimeChat.error || (realtimeChat.isConnected ? 'Connected to realtime' : 'Connecting...')}
                            >
                                <div className={`w-2 h-2 rounded-full ${
                                    realtimeChat.isConnected 
                                        ? 'bg-green-500' 
                                        : realtimeChat.error
                                        ? 'bg-red-500'
                                        : 'bg-yellow-500 animate-pulse'
                                }`} />
                                <span className="hidden sm:inline">
                                    {realtimeChat.isConnected ? 'Live' : realtimeChat.error ? 'Error' : 'Connecting'}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="chat-canvas-actions">
                        <button
                            className={`chat-action-btn hidden sm:flex ${isThreadOpen ? 'active' : ''}`}
                            onClick={() => setIsThreadOpen(!isThreadOpen)}
                            title="Threads"
                        >
                            <MessageSquare size={20} />
                        </button>
                        <button
                            className="chat-action-btn"
                            onClick={() => setIsSearchOpen(true)}
                            title="Search"
                        >
                            <Search size={20} />
                        </button>
                        <button
                            className="chat-action-btn"
                            title="Notifications"
                        >
                            <Bell size={20} />
                        </button>
                        {onClose && (
                            <button className="chat-action-btn" onClick={onClose} title="Close chat" aria-label="Close chat panel">
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                {activeChannel ? (
                    <>
                        <MessageList
                            messages={channelMessages}
                            currentUserId={userProfile?.id || ''}
                            onReaction={handleReaction}
                            onReply={handleReply}
                            onOpenThread={handleOpenThread}
                            typingUsers={typingUsers}
                        />

                        {/* Input */}
                        <MessageInput
                            channelName={activeChannel.name}
                            replyingTo={replyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                            onSend={handleSendMessage}
                            disabled={activeChannel.isLocked}
                        />
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div className="chat-empty-state-icon">
                            <MessageSquare size={40} />
                        </div>
                        <h4 className="chat-empty-state-title">Welcome to Project Chat</h4>
                        <p className="chat-empty-state-description">
                            Select a channel from the sidebar to start chatting with your team and the AI assistant.
                        </p>
                    </div>
                )}
            </div>

            {/* Thread Panel */}
            <AnimatePresence mode="wait">
                {isThreadOpen && activeThread && (
                    <ThreadPanel
                        parentMessage={activeThread}
                        currentUserId={userProfile?.id || ''}
                        onClose={() => {
                            setIsThreadOpen(false);
                            setActiveThread(null);
                        }}
                        onSendReply={(content: string) => {
                            // Create a new reply message for the thread
                            const newReply: Message = {
                                id: `msg-${Date.now()}`,
                                channelId: activeThread.channelId,
                                userId: userProfile.id,
                                user: {
                                    id: userProfile.id,
                                    displayName: userProfile.displayName,
                                    avatarUrl: userProfile.avatarUrl,
                                    status: 'online',
                                },
                                content,
                                type: 'text',
                                timestamp: new Date(),
                                status: 'sent',
                                reactions: [],
                                attachments: [],
                                mentions: [],
                                isPinned: false,
                                isDeleted: false,
                                threadId: activeThread.id,
                                replyTo: {
                                    id: activeThread.id,
                                    content: activeThread.content.substring(0, 100),
                                    userName: activeThread.user.displayName,
                                },
                            };
                            
                            // Update the parent message's thread reply count
                            setLocalMessages(prev => prev.map(msg => 
                                msg.id === activeThread.id 
                                    ? { ...msg, threadReplies: (msg.threadReplies || 0) + 1 }
                                    : msg
                            ));
                            
                            // Add the reply to messages
                            setLocalMessages(prev => [...prev, newReply]);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Search Modal */}
            <AnimatePresence>
                {isSearchOpen && (
                    <SearchModal
                        onClose={() => setIsSearchOpen(false)}
                        onSelectResult={(message: Message) => {
                            // Navigate to the message's channel
                            const channel = categories.flatMap((cat: ChannelCategory) => cat.channels)
                                .find((ch: Channel) => ch.id === message.channelId);
                            if (channel) {
                                setLocalActiveChannel(channel);
                            }
                            setIsSearchOpen(false);
                            // TODO: Scroll to the specific message
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatContainer;
