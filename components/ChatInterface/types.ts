// Chat Interface Types - Genesis Premium Chat System

export type ChannelType = 'text' | 'voice' | 'ai-assistant' | 'thread' | 'announcement';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';
export type NotificationPriority = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';

export interface User {
    id: string;
    displayName: string;
    avatarUrl?: string;
    status: UserStatus;
    customStatus?: string;
    lastSeen?: Date;
}

export interface Channel {
    id: string;
    name: string;
    description?: string;
    type: ChannelType;
    category?: string;
    icon?: string;
    unreadCount: number;
    mentionCount: number;
    lastMessage?: Message;
    isPinned: boolean;
    isMuted: boolean;
    isLocked: boolean;
    createdAt: Date;
    members?: User[];
    color?: string;
}

export interface ChannelCategory {
    id: string;
    name: string;
    channels: Channel[];
    isCollapsed: boolean;
    color?: string;
}

export interface Attachment {
    id: string;
    type: 'image' | 'video' | 'file' | 'audio' | 'code' | 'link';
    url: string;
    name: string;
    size?: number;
    mimeType?: string;
    thumbnail?: string;
    metadata?: {
        width?: number;
        height?: number;
        duration?: number;
        language?: string; // For code blocks
        title?: string; // For link previews
        description?: string;
        siteName?: string;
    };
}

export interface Reaction {
    emoji: string;
    count: number;
    users: string[];
    hasReacted: boolean;
}

export interface Message {
    id: string;
    channelId: string;
    userId: string;
    user: User;
    content: string;
    type: 'text' | 'system' | 'action' | 'visual_share' | 'reply' | 'ai_response';
    timestamp: Date;
    editedAt?: Date;
    status: MessageStatus;
    reactions: Reaction[];
    threadId?: string;
    replyTo?: {
        id: string;
        content: string;
        userName: string;
    };
    attachments: Attachment[];
    mentions: string[];
    isPinned: boolean;
    isDeleted: boolean;
    threadReplies?: number;
    aiMetadata?: {
        model: string;
        tokens?: number;
        regenerationCount?: number;
    };
}

export interface Thread {
    id: string;
    parentMessage: Message;
    messages: Message[];
    participants: User[];
    lastActivity: Date;
    isMuted: boolean;
}

export interface VoiceParticipant extends User {
    isSpeaking: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    isScreenSharing: boolean;
    volume: number;
}

export interface VoiceChannel extends Channel {
    participants: VoiceParticipant[];
    isLive: boolean;
    bitrate: number;
}

export interface SearchFilters {
    query: string;
    from?: string;
    in?: string;
    before?: Date;
    after?: Date;
    has?: ('link' | 'file' | 'image' | 'embed')[];
    mentions?: string;
}

export interface SearchResult {
    message: Message;
    channel: Channel;
    matchedText: string;
    context: {
        before?: Message;
        after?: Message;
    };
}

export interface ChatNotification {
    id: string;
    type: 'message' | 'mention' | 'reply' | 'reaction' | 'channel_invite' | 'system';
    priority: NotificationPriority;
    title: string;
    body: string;
    channel?: Channel;
    message?: Message;
    user?: User;
    timestamp: Date;
    isRead: boolean;
}

export interface SlashCommand {
    command: string;
    description: string;
    icon: React.ReactNode;
    action: (args: string) => void | Promise<void>;
    category: 'ai' | 'formatting' | 'media' | 'utility';
}

export interface ChatState {
    channels: Channel[];
    categories: ChannelCategory[];
    activeChannel: Channel | null;
    activeThread: Thread | null;
    messages: Map<string, Message[]>;
    typingUsers: Map<string, User[]>;
    onlineUsers: User[];
    notifications: ChatNotification[];
    searchResults: SearchResult[];
    isSearchOpen: boolean;
    isDarkMode: boolean;
    isSidebarCollapsed: boolean;
}

// Animation variants for Framer Motion
export const chatAnimations = {
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    },
    slideUp: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
    },
    slideRight: {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 },
    },
    scale: {
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.9 },
    },
    slidePanel: {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
    },
    bubble: {
        initial: { opacity: 0, scale: 0.8, y: 10 },
        animate: { 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: { type: 'spring', stiffness: 300, damping: 24 }
        },
    },
    stagger: {
        animate: {
            transition: { staggerChildren: 0.05 }
        }
    }
};
