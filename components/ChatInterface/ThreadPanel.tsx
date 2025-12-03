import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, MessageSquare, Send, Smile } from 'lucide-react';
import { Message, User, chatAnimations } from './types';

interface ThreadPanelProps {
    parentMessage: Message;
    currentUserId: string;
    onClose: () => void;
    onSendReply: (content: string) => void;
}

// Mock thread replies
const mockThreadReplies: Message[] = [
    {
        id: 'tr-1',
        channelId: 'ch-2',
        userId: 'user-2',
        user: {
            id: 'user-2',
            displayName: 'Alex Rivera',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
            status: 'online',
        },
        content: 'This is such a great point! I totally agree with the AI\'s suggestions.',
        type: 'text',
        timestamp: new Date(Date.now() - 1800000),
        status: 'read',
        reactions: [],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
    },
    {
        id: 'tr-2',
        channelId: 'ch-2',
        userId: 'user-1',
        user: {
            id: 'user-1',
            displayName: 'Sarah Chen',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
            status: 'online',
        },
        content: 'Thanks! I\'ve already started implementing some of them.',
        type: 'text',
        timestamp: new Date(Date.now() - 1200000),
        status: 'read',
        reactions: [
            { emoji: '👍', count: 1, users: ['user-2'], hasReacted: false },
        ],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
    },
    {
        id: 'tr-3',
        channelId: 'ch-2',
        userId: 'user-3',
        user: {
            id: 'user-3',
            displayName: 'Jordan Kim',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jordan',
            status: 'away',
        },
        content: 'Can\'t wait to see the final result! 🎉',
        type: 'text',
        timestamp: new Date(Date.now() - 600000),
        status: 'read',
        reactions: [],
        attachments: [],
        mentions: [],
        isPinned: false,
        isDeleted: false,
    },
];

const ThreadPanel: React.FC<ThreadPanelProps> = ({
    parentMessage,
    currentUserId,
    onClose,
    onSendReply,
}) => {
    const [replyContent, setReplyContent] = useState('');
    const [replies, setReplies] = useState<Message[]>(mockThreadReplies);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const handleSend = () => {
        if (!replyContent.trim()) return;
        
        // Create a new reply message
        const newReply: Message = {
            id: `tr-${Date.now()}`,
            channelId: parentMessage.channelId,
            userId: currentUserId || 'guest-user',
            user: {
                id: currentUserId || 'guest-user',
                displayName: 'You',
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId || 'guest'}`,
                status: 'online',
            },
            content: replyContent.trim(),
            type: 'text',
            timestamp: new Date(),
            status: 'sent',
            reactions: [],
            attachments: [],
            mentions: [],
            isPinned: false,
            isDeleted: false,
        };
        
        // Add to local replies
        setReplies(prev => [...prev, newReply]);
        
        // Notify parent
        onSendReply(replyContent.trim());
        setReplyContent('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <motion.div
            className="chat-thread-panel glass-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {/* Header */}
            <div className="chat-thread-header">
                <div>
                    <div className="chat-thread-title flex items-center gap-2">
                        <MessageSquare size={18} className="text-[var(--chat-coral-burst)]" />
                        Thread
                    </div>
                    <div className="chat-thread-subtitle">
                        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                    </div>
                </div>
                <button className="chat-thread-close" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            {/* Parent Message */}
            <div className="p-4 border-b border-[var(--chat-border-primary)] bg-[var(--chat-bg-tertiary)]/50">
                <div className="flex items-start gap-3">
                    <img
                        src={parentMessage.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${parentMessage.userId}`}
                        alt={parentMessage.user.displayName}
                        className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-[var(--chat-text-primary)]">
                                {parentMessage.user.displayName}
                            </span>
                            <span className="text-xs text-[var(--chat-text-muted)]">
                                {formatTime(parentMessage.timestamp)}
                            </span>
                        </div>
                        <p className="text-sm text-[var(--chat-text-primary)] whitespace-pre-wrap">
                            {parentMessage.content}
                        </p>
                    </div>
                </div>
            </div>

            {/* Replies */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {replies.map((reply) => {
                    const isOwn = reply.userId === currentUserId;

                    return (
                        <motion.div
                            key={reply.id}
                            className="flex items-start gap-3"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <img
                                src={reply.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.userId}`}
                                alt={reply.user.displayName}
                                className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-sm font-semibold text-[var(--chat-text-primary)]">
                                        {reply.user.displayName}
                                    </span>
                                    <span className="text-xs text-[var(--chat-text-muted)]">
                                        {formatTime(reply.timestamp)}
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--chat-text-primary)]">
                                    {reply.content}
                                </p>
                                
                                {/* Reactions */}
                                {reply.reactions.length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                        {reply.reactions.map((reaction) => (
                                            <button
                                                key={reaction.emoji}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                                    reaction.hasReacted
                                                        ? 'bg-[var(--chat-coral-burst)]/15 border border-[var(--chat-coral-burst)]'
                                                        : 'bg-[var(--chat-bg-tertiary)] border border-transparent'
                                                }`}
                                            >
                                                <span>{reaction.emoji}</span>
                                                <span className={reaction.hasReacted ? 'text-[var(--chat-coral-burst)]' : 'text-[var(--chat-text-muted)]'}>
                                                    {reaction.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-[var(--chat-border-primary)]">
                <div className="flex items-end gap-3">
                    <div className="flex-1 bg-[var(--chat-bg-tertiary)] rounded-xl px-4 py-3 flex items-end gap-2">
                        <textarea
                            className="flex-1 bg-transparent border-none resize-none text-sm text-[var(--chat-text-primary)] placeholder:text-[var(--chat-text-muted)] focus:outline-none"
                            placeholder="Reply to thread..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            style={{ maxHeight: '120px' }}
                        />
                        <button className="p-1 text-[var(--chat-text-muted)] hover:text-[var(--chat-text-primary)] transition-colors">
                            <Smile size={18} />
                        </button>
                    </div>
                    <motion.button
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--chat-coral-burst)] to-[var(--chat-gold-sunshine)] text-white flex items-center justify-center shadow-lg"
                        onClick={handleSend}
                        disabled={!replyContent.trim()}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Send size={18} />
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
};

export default ThreadPanel;
