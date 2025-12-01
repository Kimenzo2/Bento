import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Smile, MoreVertical, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { chatService, ChatMessage as ChatMessageType, PresenceState } from '../services/chatService';
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
    const [isConnected, setIsConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);
    const pendingMessagesRef = useRef<Set<string>>(new Set()); // Track optimistically added messages
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingSentRef = useRef<number>(0);

    // Cleanup function
    const cleanupChannel = useCallback(() => {
        if (channelRef.current) {
            chatService.leaveRoom(channelRef.current);
            channelRef.current = null;
        }
        setIsConnected(false);
    }, []);

    useEffect(() => {
        loadMessages();
        subscribeToMessages();

        return () => {
            cleanupChannel();
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
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
            // On new message
            (newMessage) => {
                setMessages(prev => {
                    // Check if this message was optimistically added
                    const optimisticId = pendingMessagesRef.current.has(newMessage.id);
                    if (optimisticId) {
                        pendingMessagesRef.current.delete(newMessage.id);
                        return prev; // Skip, already in the list
                    }
                    
                    // Check for duplicate by content and user within short time window
                    const isDuplicate = prev.some(msg => 
                        msg.user_id === newMessage.user_id && 
                        msg.content === newMessage.content &&
                        msg.id.startsWith('temp-') // It's our optimistic message
                    );
                    
                    if (isDuplicate) {
                        // Replace the optimistic message with the real one
                        return prev.map(msg => {
                            if (msg.user_id === newMessage.user_id && 
                                msg.content === newMessage.content &&
                                msg.id.startsWith('temp-')) {
                                return newMessage;
                            }
                            return msg;
                        });
                    }
                    
                    // Check if message already exists (by real ID)
                    if (prev.some(msg => msg.id === newMessage.id)) {
                        return prev;
                    }
                    
                    return [...prev, newMessage];
                });
            },
            // On presence update
            (users) => {
                setOnlineUsers(users);
                setIsConnected(true);
            },
            // On typing
            (userId) => {
                if (userId !== userProfile?.id) {
                    setTypingUsers(prev => new Set(prev).add(userId));
                    
                    // Clear typing indicator after 3 seconds
                    setTimeout(() => {
                        setTypingUsers(prev => {
                            const next = new Set(prev);
                            next.delete(userId);
                            return next;
                        });
                    }, 3000);
                }
            }
        );
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Handle typing indicator - throttled to prevent spam
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        
        // Send typing indicator (throttled to once every 2 seconds)
        const now = Date.now();
        if (now - lastTypingSentRef.current > 2000 && e.target.value.length > 0) {
            chatService.sendTyping(threadId);
            lastTypingSentRef.current = now;
        }
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

        // Create optimistic message with temp ID
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMessage: ChatMessageType = {
            id: tempId,
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

        // Add to messages immediately for instant feedback
        setMessages(prev => [...prev, optimisticMessage]);
        setInputValue('');
        setSending(true);

        try {
            const sentMessage = await chatService.sendMessage(threadId, messageContent);
            
            if (sentMessage) {
                // Track that we sent this message (to avoid duplicates from real-time)
                pendingMessagesRef.current.add(sentMessage.id);
                
                // Replace optimistic message with real one
                setMessages(prev => prev.map(msg => 
                    msg.id === tempId ? { ...sentMessage, user: optimisticMessage.user } : msg
                ));
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
            // Restore input value
            setInputValue(messageContent);
        } finally {
            setSending(false);
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setInputValue(prev => prev + emoji);
    };

    // Get typing users' names
    const getTypingIndicatorText = () => {
        const typingNames = Array.from(typingUsers)
            .map(userId => {
                const user = onlineUsers.find(u => u.user_id === userId);
                return user?.display_name || 'Someone';
            })
            .slice(0, 3); // Max 3 names

        if (typingNames.length === 0) return null;
        if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
        if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing...`;
        return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
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

    // Format message time
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const typingText = getTypingIndicatorText();

    return (
        <div className="chat-conversation">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-4 py-1 text-xs ${isConnected ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                {isConnected ? (
                    <>
                        <Wifi size={12} />
                        <span>Connected • {onlineUsers.length} online</span>
                    </>
                ) : (
                    <>
                        <WifiOff size={12} />
                        <span>Connecting...</span>
                    </>
                )}
            </div>

            {/* Messages Area */}
            <div className="chat-messages-container">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user_id === userProfile?.id;
                        const isOptimistic = msg.id.startsWith('temp-');
                        return (
                            <div key={msg.id} className={`chat-message-row ${isOwn ? 'own' : 'other'}`}>
                                {!isOwn && renderAvatar(msg, false)}
                                <div className="flex flex-col">
                                    {!isOwn && msg.user?.display_name && (
                                        <span className="text-xs text-gray-500 ml-1 mb-1">{msg.user.display_name}</span>
                                    )}
                                    <div className={`chat-message-bubble ${isOptimistic ? 'opacity-70' : ''}`}>
                                        {msg.content}
                                        <span className="text-[10px] text-gray-400 ml-2">
                                            {isOptimistic ? 'Sending...' : formatTime(msg.created_at)}
                                        </span>
                                    </div>
                                </div>
                                {isOwn && renderAvatar(msg, true)}
                            </div>
                        );
                    })
                )}
                
                {/* Typing Indicator */}
                {typingText && (
                    <div className="chat-message-row other">
                        <div className="chat-typing-indicator">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="text-xs text-gray-500 ml-2">{typingText}</span>
                        </div>
                    </div>
                )}
                
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
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    className="chat-input-field"
                    disabled={sending || !isConnected}
                />
                <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!inputValue.trim() || sending}
                    title="Send message"
                    aria-label="Send message"
                >
                    <ChevronRight size={24} />
                </button>
            </form>
        </div>
    );
};

export default ChatConversation;
