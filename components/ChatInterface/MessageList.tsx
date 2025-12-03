import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Message, User, chatAnimations } from './types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
    onReaction: (messageId: string, emoji: string) => void;
    onReply: (message: Message) => void;
    onOpenThread: (message: Message) => void;
    typingUsers?: User[];
}

const MessageList: React.FC<MessageListProps> = ({
    messages,
    currentUserId,
    onReaction,
    onReply,
    onOpenThread,
    typingUsers = [],
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const isScrolledToBottom = useRef(true);
    const lastMessageCount = useRef(messages.length);

    // Check if user is at bottom
    const checkScrollPosition = useCallback(() => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        isScrolledToBottom.current = isAtBottom;
        setShowScrollButton(!isAtBottom);
    }, []);

    // Scroll to bottom
    const scrollToBottom = useCallback((smooth = true) => {
        if (!containerRef.current) return;
        containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto',
        });
        setNewMessageCount(0);
    }, []);

    // Auto-scroll on new messages if at bottom
    useEffect(() => {
        if (messages.length > lastMessageCount.current) {
            if (isScrolledToBottom.current) {
                scrollToBottom();
            } else {
                setNewMessageCount(prev => prev + (messages.length - lastMessageCount.current));
            }
        }
        lastMessageCount.current = messages.length;
    }, [messages.length, scrollToBottom]);

    // Initial scroll to bottom
    useEffect(() => {
        scrollToBottom(false);
    }, []);

    // Group messages by date and proximity
    const groupedMessages = React.useMemo(() => {
        const groups: { date: string; messages: (Message & { isCompact: boolean })[] }[] = [];
        let currentDate = '';
        let lastUserId = '';
        let lastTimestamp = 0;

        messages.forEach((msg) => {
            const messageDate = new Date(msg.timestamp).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            });

            // Check if new date group needed
            if (messageDate !== currentDate) {
                currentDate = messageDate;
                groups.push({ date: messageDate, messages: [] });
                lastUserId = '';
                lastTimestamp = 0;
            }

            // Check if message should be compact (same user within 2 minutes)
            const timeDiff = msg.timestamp.getTime() - lastTimestamp;
            const isCompact = lastUserId === msg.userId && timeDiff < 120000 && !msg.replyTo;

            groups[groups.length - 1].messages.push({
                ...msg,
                isCompact,
            });

            lastUserId = msg.userId;
            lastTimestamp = msg.timestamp.getTime();
        });

        return groups;
    }, [messages]);

    return (
        <div
            ref={containerRef}
            className="chat-messages"
            onScroll={checkScrollPosition}
        >
            {/* Welcome message for empty state */}
            {messages.length === 0 && (
                <motion.div
                    className="chat-empty-state"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="chat-empty-state-icon">
                        <span className="text-4xl">✨</span>
                    </div>
                    <h4 className="chat-empty-state-title">Start the conversation!</h4>
                    <p className="chat-empty-state-description">
                        Be the first to send a message in this channel.
                    </p>
                </motion.div>
            )}

            {/* Message groups */}
            <AnimatePresence mode="popLayout">
                {groupedMessages.map((group) => (
                    <div key={group.date}>
                        {/* Date Divider */}
                        <div className="chat-date-divider">
                            <span>{group.date}</span>
                        </div>

                        {/* Messages */}
                        {group.messages.map((message, index) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.userId === currentUserId}
                                isCompact={message.isCompact}
                                onReaction={onReaction}
                                onReply={onReply}
                                onOpenThread={onOpenThread}
                            />
                        ))}
                    </div>
                ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
                {typingUsers.length > 0 && (
                    <motion.div
                        className="chat-typing-indicator"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <div className="flex -space-x-2">
                            {typingUsers.slice(0, 3).map(user => (
                                <img
                                    key={user.id}
                                    src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                    alt={user.displayName}
                                    className="w-5 h-5 rounded-full border-2 border-[var(--chat-bg-primary)]"
                                />
                            ))}
                        </div>
                        <div className="chat-typing-dots">
                            <span className="chat-typing-dot" />
                            <span className="chat-typing-dot" />
                            <span className="chat-typing-dot" />
                        </div>
                        <span>
                            {typingUsers.length === 1
                                ? `${typingUsers[0].displayName} is typing...`
                                : typingUsers.length === 2
                                ? `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`
                                : `${typingUsers[0].displayName} and ${typingUsers.length - 1} others are typing...`
                            }
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Scroll to bottom button */}
            <AnimatePresence>
                {showScrollButton && (
                    <motion.button
                        className="chat-scroll-bottom"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        onClick={() => scrollToBottom()}
                    >
                        <ChevronDown size={16} />
                        <span>Jump to present</span>
                        {newMessageCount > 0 && (
                            <span className="chat-scroll-bottom-badge">
                                {newMessageCount}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MessageList;
