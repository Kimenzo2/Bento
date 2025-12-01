import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Smile, MoreVertical, ChevronRight } from 'lucide-react';
import { chatService, ChatMessage as ChatMessageType } from '../services/chatService';
import { UserProfile } from '../services/profileService';
import EmojiPicker from './EmojiPicker';

interface ChatConversationProps {
    threadId: string;
    userProfile: UserProfile | null;
    onBack?: () => void;
    isMobile: boolean;
    onCollaborativeTrigger?: () => void;
}

const ChatConversation: React.FC<ChatConversationProps> = ({
    threadId,
    userProfile,
    onBack,
    isMobile,
    onCollaborativeTrigger
}) => {
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [threadName, setThreadName] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        loadMessages();
        subscribeToMessages();

        return () => {
            if (channelRef.current) {
                chatService.leaveRoom(channelRef.current);
            }
        };
    }, [threadId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const msgs = await chatService.getRoomMessages(threadId, 50);
            setMessages(msgs);

            // Get room info
            const room = await chatService.getGlobalRoom();
            if (room) {
                setThreadName(room.name);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        channelRef.current = chatService.subscribeToRoom(
            threadId,
            (newMessage) => {
                setMessages(prev => [...prev, newMessage]);
            },
            (users) => {
                // Handle presence updates if needed
            },
            (userId) => {
                // Handle typing indicators if needed
            }
        );
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputValue.trim() || sending) return;

        const messageContent = inputValue.trim();

        // Check for collaborative mode trigger
        const lowerMessage = messageContent.toLowerCase();
        if ((lowerMessage.includes("let's") || lowerMessage.includes("lets")) && onCollaborativeTrigger) {
            onCollaborativeTrigger();
        }

        // Optimistically add message to UI
        const optimisticMessage: ChatMessageType = {
            id: `temp-${Date.now()}`,
            content: messageContent,
            user_id: userProfile?.id || '',
            room_id: threadId,
            type: 'text',
            created_at: new Date().toISOString(),
            user: {
                display_name: userProfile?.full_name || userProfile?.email || 'You',
                avatar_url: userProfile?.avatar_url || ''
            }
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setInputValue('');
        setSending(true);

        try {
            await chatService.sendMessage(threadId, messageContent);
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
            // Restore input value
            setInputValue(messageContent);
        } finally {
            setSending(false);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setInputValue(prev => prev + emoji);
    };

    // Helper function to render avatar
    const renderAvatar = (msg: ChatMessageType, isOwn: boolean) => {
        if (isOwn && userProfile?.avatar_url) {
            return <img src={userProfile.avatar_url} alt="You" className="chat-avatar w-8 h-8 rounded-full" />;
        }

        if (isOwn) {
            const initials = userProfile?.full_name
                ? userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : userProfile?.email?.[0]?.toUpperCase() || '?';
            return <div className="chat-avatar w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-xs font-semibold">{initials}</div>;
        }

        // For other users
        if (msg.user?.avatar_url) {
            return <img src={msg.user.avatar_url} alt={msg.user.display_name} className="chat-avatar w-8 h-8 rounded-full" />;
        }

        const initial = msg.user?.display_name?.[0]?.toUpperCase() || '?';
        return <div className="chat-avatar w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-xs font-semibold">{initial}</div>;
    };

    return (
        <div className="chat-conversation">
            {/* Messages Area */}
            <div className="chat-messages-container">
                {messages.map((msg) => {
                    const isOwn = msg.user_id === userProfile?.id;
                    return (
                        <div key={msg.id} className={`chat-message-row ${isOwn ? 'own' : 'other'}`}>
                            {!isOwn && renderAvatar(msg, false)}
                            <div className="chat-message-bubble">
                                {msg.content}
                            </div>
                            {isOwn && renderAvatar(msg, true)}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="chat-input-area">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Add emoji"
                    >
                        <Smile size={20} className="text-gray-500" />
                    </button>
                    {showEmojiPicker && (
                        <EmojiPicker
                            onEmojiSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                        />
                    )}
                </div>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    className="chat-input-field"
                    disabled={sending}
                />
                <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!inputValue.trim() || sending}
                >
                    <ChevronRight size={24} />
                </button>
            </form>
        </div>
    );
};

export default ChatConversation;
