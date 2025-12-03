import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Smile, MoreHorizontal, Reply, Edit2, Trash2, Pin,
    Copy, Forward, MessageSquare, Check, CheckCheck, Clock,
    AlertCircle, Sparkles, ExternalLink, Play
} from 'lucide-react';
import { Message, Reaction, chatAnimations } from './types';

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    isCompact?: boolean;
    onReaction: (messageId: string, emoji: string) => void;
    onReply: (message: Message) => void;
    onOpenThread: (message: Message) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '✨', '🔥'];

const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isOwn,
    isCompact = false,
    onReaction,
    onReply,
    onOpenThread,
}) => {
    const [showActions, setShowActions] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const messageRef = useRef<HTMLDivElement>(null);

    const isAI = message.type === 'ai_response';

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getStatusIcon = () => {
        switch (message.status) {
            case 'sending':
                return <Clock size={12} className="text-[var(--chat-text-muted)]" />;
            case 'sent':
                return <Check size={12} className="text-[var(--chat-text-muted)]" />;
            case 'delivered':
                return <CheckCheck size={12} className="text-[var(--chat-text-muted)]" />;
            case 'read':
                return <CheckCheck size={12} className="text-[var(--chat-coral-burst)]" />;
            case 'failed':
                return <AlertCircle size={12} className="text-red-500" />;
            default:
                return null;
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    };

    const renderContent = () => {
        // Parse markdown-like content
        let content = message.content;
        
        // Bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        // Inline code
        content = content.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Line breaks
        content = content.replace(/\n/g, '<br />');

        return (
            <div
                className="chat-message-body"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    };

    const renderAttachments = () => {
        if (!message.attachments || message.attachments.length === 0) return null;

        return (
            <div className="mt-2 space-y-2">
                {message.attachments.map((attachment) => {
                    if (attachment.type === 'image') {
                        return (
                            <motion.div
                                key={attachment.id}
                                className="relative rounded-xl overflow-hidden cursor-pointer group"
                                whileHover={{ scale: 1.02 }}
                            >
                                <img
                                    src={attachment.url}
                                    alt={attachment.name}
                                    className="max-w-[400px] max-h-[300px] rounded-xl object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <ExternalLink 
                                        size={24} 
                                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                                    />
                                </div>
                            </motion.div>
                        );
                    }

                    if (attachment.type === 'video') {
                        return (
                            <div
                                key={attachment.id}
                                className="relative rounded-xl overflow-hidden bg-black/10"
                            >
                                <video
                                    src={attachment.url}
                                    className="max-w-[400px] max-h-[300px] rounded-xl"
                                    controls
                                />
                            </div>
                        );
                    }

                    if (attachment.type === 'audio') {
                        return (
                            <div
                                key={attachment.id}
                                className="flex items-center gap-3 p-3 bg-[var(--chat-bg-tertiary)] rounded-xl"
                            >
                                <button className="w-10 h-10 rounded-full bg-[var(--chat-coral-burst)] text-white flex items-center justify-center">
                                    <Play size={18} />
                                </button>
                                <div className="flex-1">
                                    <div className="h-8 bg-[var(--chat-border-secondary)] rounded-full" />
                                </div>
                                <span className="text-xs text-[var(--chat-text-muted)]">
                                    {attachment.metadata?.duration ? `${Math.floor(attachment.metadata.duration / 60)}:${String(attachment.metadata.duration % 60).padStart(2, '0')}` : '0:00'}
                                </span>
                            </div>
                        );
                    }

                    // Generic file
                    return (
                        <div
                            key={attachment.id}
                            className="flex items-center gap-3 p-3 bg-[var(--chat-bg-tertiary)] rounded-xl hover:bg-[var(--chat-bg-hover)] cursor-pointer transition-colors"
                        >
                            <div className="w-10 h-10 rounded-lg bg-[var(--chat-coral-burst)]/10 text-[var(--chat-coral-burst)] flex items-center justify-center text-xs font-bold">
                                {attachment.name.split('.').pop()?.toUpperCase() || 'FILE'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--chat-text-primary)] truncate">
                                    {attachment.name}
                                </p>
                                <p className="text-xs text-[var(--chat-text-muted)]">
                                    {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                                </p>
                            </div>
                            <ExternalLink size={16} className="text-[var(--chat-text-muted)]" />
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <motion.div
            ref={messageRef}
            className={`chat-message ${isOwn ? 'own' : ''} ${isAI ? 'ai' : ''} ${isCompact ? 'compact' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => {
                setShowActions(false);
                setShowReactionPicker(false);
            }}
            onContextMenu={handleContextMenu}
        >
            {/* Avatar */}
            {!isCompact && (
                <div className="chat-message-avatar">
                    <img
                        src={message.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.userId}`}
                        alt={message.user.displayName}
                    />
                    <div className={`chat-message-avatar-status ${message.user.status}`} />
                </div>
            )}

            {/* Content */}
            <div className="chat-message-content">
                {/* Header */}
                {!isCompact && (
                    <div className="chat-message-header">
                        <span className={`chat-message-author ${isAI ? 'ai' : ''}`}>
                            {message.user.displayName}
                            {isAI && (
                                <Sparkles size={12} className="inline ml-1 text-[var(--chat-coral-burst)]" />
                            )}
                        </span>
                        <span className="chat-message-timestamp">
                            {formatTime(message.timestamp)}
                        </span>
                        {message.editedAt && (
                            <span className="chat-message-edited">(edited)</span>
                        )}
                        {message.isPinned && (
                            <Pin size={12} className="text-[var(--chat-gold-sunshine)]" />
                        )}
                    </div>
                )}

                {/* Compact timestamp on hover */}
                {isCompact && (
                    <span className="chat-message-timestamp-hover">
                        {formatTime(message.timestamp)}
                    </span>
                )}

                {/* Reply preview */}
                {message.replyTo && (
                    <div className="chat-message-reply-preview">
                        <span className="chat-message-reply-preview-author">
                            {message.replyTo.userName}
                        </span>
                        <span className="chat-message-reply-preview-content">
                            {message.replyTo.content}
                        </span>
                    </div>
                )}

                {/* Message bubble for own messages */}
                {isOwn ? (
                    <div className="chat-message-bubble">
                        {renderContent()}
                        {renderAttachments()}
                        <div className="flex items-center justify-end gap-1 mt-1">
                            {getStatusIcon()}
                        </div>
                    </div>
                ) : isAI ? (
                    <div className="chat-message-bubble">
                        {renderContent()}
                        {renderAttachments()}
                        {message.aiMetadata && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--chat-border-secondary)] text-xs text-[var(--chat-text-muted)]">
                                <span className="flex items-center gap-1">
                                    <Sparkles size={10} />
                                    {message.aiMetadata.model}
                                </span>
                                {message.aiMetadata.tokens && (
                                    <span>• {message.aiMetadata.tokens} tokens</span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {renderContent()}
                        {renderAttachments()}
                    </>
                )}

                {/* Reactions */}
                {message.reactions.length > 0 && (
                    <div className="chat-message-reactions">
                        {message.reactions.map((reaction) => (
                            <motion.button
                                key={reaction.emoji}
                                className={`chat-reaction ${reaction.hasReacted ? 'active' : ''}`}
                                onClick={() => onReaction(message.id, reaction.emoji)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <span className="chat-reaction-emoji">{reaction.emoji}</span>
                                <span className="chat-reaction-count">{reaction.count}</span>
                            </motion.button>
                        ))}
                    </div>
                )}

                {/* Thread indicator */}
                {message.threadReplies && message.threadReplies > 0 && (
                    <motion.div
                        className="chat-message-thread"
                        onClick={() => onOpenThread(message)}
                        whileHover={{ scale: 1.01 }}
                    >
                        <MessageSquare size={14} className="text-[var(--chat-coral-burst)]" />
                        <span className="chat-message-thread-info">
                            {message.threadReplies} {message.threadReplies === 1 ? 'reply' : 'replies'}
                        </span>
                        <span className="chat-message-thread-time">Last reply 2h ago</span>
                    </motion.div>
                )}
            </div>

            {/* Action toolbar */}
            <AnimatePresence>
                {showActions && (
                    <motion.div
                        className="chat-message-actions"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                    >
                        {/* Quick reaction */}
                        <div className="relative">
                            <button
                                className="chat-message-action reaction"
                                onClick={() => setShowReactionPicker(!showReactionPicker)}
                            >
                                <Smile size={16} />
                            </button>

                            {/* Reaction picker */}
                            <AnimatePresence>
                                {showReactionPicker && (
                                    <motion.div
                                        className="absolute bottom-full right-0 mb-2 p-2 bg-[var(--chat-bg-primary)] border border-[var(--chat-border-primary)] rounded-xl shadow-lg flex gap-1 z-50"
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    >
                                        {QUICK_REACTIONS.map((emoji) => (
                                            <motion.button
                                                key={emoji}
                                                className="w-8 h-8 rounded-lg hover:bg-[var(--chat-bg-hover)] flex items-center justify-center text-lg"
                                                onClick={() => {
                                                    onReaction(message.id, emoji);
                                                    setShowReactionPicker(false);
                                                }}
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                {emoji}
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Reply */}
                        <button
                            className="chat-message-action reply"
                            onClick={() => onReply(message)}
                        >
                            <Reply size={16} />
                        </button>

                        {/* Thread */}
                        <button
                            className="chat-message-action"
                            onClick={() => onOpenThread(message)}
                        >
                            <MessageSquare size={16} />
                        </button>

                        {/* More */}
                        <button
                            className="chat-message-action"
                            onClick={() => setShowContextMenu(true)}
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Context Menu */}
            <AnimatePresence>
                {showContextMenu && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-40"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowContextMenu(false)}
                        />
                        <motion.div
                            className="fixed bg-[var(--chat-bg-primary)] border border-[var(--chat-border-primary)] rounded-xl shadow-lg py-2 min-w-[180px] z-50"
                            style={{
                                left: Math.min(contextMenuPos.x, window.innerWidth - 200),
                                top: Math.min(contextMenuPos.y, window.innerHeight - 250),
                            }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <button 
                                className="w-full px-4 py-2 text-left text-sm text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] flex items-center gap-3"
                                onClick={() => {
                                    onReply(message);
                                    setShowContextMenu(false);
                                }}
                            >
                                <Reply size={16} />
                                Reply
                            </button>
                            <button 
                                className="w-full px-4 py-2 text-left text-sm text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] flex items-center gap-3"
                                onClick={() => {
                                    onOpenThread(message);
                                    setShowContextMenu(false);
                                }}
                            >
                                <MessageSquare size={16} />
                                Create Thread
                            </button>
                            <button 
                                className="w-full px-4 py-2 text-left text-sm text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] flex items-center gap-3"
                                onClick={() => {
                                    navigator.clipboard.writeText(message.content);
                                    setShowContextMenu(false);
                                }}
                            >
                                <Copy size={16} />
                                Copy Text
                            </button>
                            <button 
                                className="w-full px-4 py-2 text-left text-sm text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] flex items-center gap-3"
                                onClick={() => {
                                    // TODO: Implement pin functionality
                                    setShowContextMenu(false);
                                }}
                            >
                                <Pin size={16} />
                                {message.isPinned ? 'Unpin' : 'Pin'} Message
                            </button>
                            <button 
                                className="w-full px-4 py-2 text-left text-sm text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] flex items-center gap-3"
                                onClick={() => {
                                    // TODO: Implement forward functionality
                                    setShowContextMenu(false);
                                }}
                            >
                                <Forward size={16} />
                                Forward
                            </button>
                            {isOwn && (
                                <>
                                    <div className="my-2 border-t border-[var(--chat-border-secondary)]" />
                                    <button 
                                        className="w-full px-4 py-2 text-left text-sm text-[var(--chat-text-primary)] hover:bg-[var(--chat-bg-hover)] flex items-center gap-3"
                                        onClick={() => {
                                            // TODO: Implement edit functionality
                                            setShowContextMenu(false);
                                        }}
                                    >
                                        <Edit2 size={16} />
                                        Edit
                                    </button>
                                    <button 
                                        className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3"
                                        onClick={() => {
                                            // TODO: Implement delete functionality
                                            setShowContextMenu(false);
                                        }}
                                    >
                                        <Trash2 size={16} />
                                        Delete
                                    </button>
                                </>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default MessageBubble;
