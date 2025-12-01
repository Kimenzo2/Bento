import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Send, Smile, MoreVertical, ChevronRight, Wifi, WifiOff,
    Reply, Edit2, Trash2, Heart, ThumbsUp, Image as ImageIcon,
    Share2, Sparkles, UserPlus, Star, AtSign, X, Check, Copy
} from 'lucide-react';
import { chatService, ChatMessage as ChatMessageType, PresenceState } from '../services/chatService';
import { UserProfile } from '../services/profileService';
import EmojiPicker from './EmojiPicker';

// Reaction emoji options
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎨', '✨', '🔥'];

// System message icons mapping
const SYSTEM_ICONS: Record<string, React.ReactNode> = {
    visual_shared: <Share2 size={14} className="text-purple-500" />,
    user_joined: <UserPlus size={14} className="text-green-500" />,
    collab_started: <Sparkles size={14} className="text-amber-500" />,
    creation_liked: <Heart size={14} className="text-red-500" />,
    mention: <AtSign size={14} className="text-blue-500" />,
};

interface MessageReaction {
    emoji: string;
    count: number;
    users: string[];
    hasReacted: boolean;
}

interface ReplyInfo {
    id: string;
    content: string;
    userName: string;
}

interface ChatConversationProps {
    threadId: string;
    userProfile: UserProfile | null;
    onBack?: () => void;
    isMobile: boolean;
    onCollaborativeTrigger?: () => void;
    // Visual Studio integration
    onShareVisual?: (imageUrl: string, caption: string) => void;
    sharedVisual?: { imageUrl: string; caption: string; sharedBy: string } | null;
}

const ChatConversation: React.FC<ChatConversationProps> = ({
    threadId,
    userProfile,
    onBack,
    isMobile,
    onCollaborativeTrigger,
    sharedVisual
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
    
    // New feature states
    const [replyingTo, setReplyingTo] = useState<ReplyInfo | null>(null);
    const [editingMessage, setEditingMessage] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [contextMenuMessage, setContextMenuMessage] = useState<string | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const [messageReactions, setMessageReactions] = useState<Record<string, MessageReaction[]>>({});
    const [mentionSuggestions, setMentionSuggestions] = useState<PresenceState[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionIndex, setMentionIndex] = useState(0);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);
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
        const value = e.target.value;
        setInputValue(value);
        
        // Check for @mentions
        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const afterAt = value.slice(lastAtIndex + 1);
            const spaceAfterAt = afterAt.indexOf(' ');
            if (spaceAfterAt === -1) {
                // Still typing the mention
                const searchTerm = afterAt.toLowerCase();
                const suggestions = onlineUsers.filter(u => 
                    u.display_name.toLowerCase().includes(searchTerm) && u.user_id !== userProfile?.id
                );
                setMentionSuggestions(suggestions);
                setShowMentions(suggestions.length > 0);
                setMentionIndex(0);
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
        }
        
        // Send typing indicator (throttled to once every 2 seconds)
        const now = Date.now();
        if (now - lastTypingSentRef.current > 2000 && value.length > 0) {
            chatService.sendTyping(threadId);
            lastTypingSentRef.current = now;
        }
    };

    // Handle mention selection
    const handleMentionSelect = (user: PresenceState) => {
        const lastAtIndex = inputValue.lastIndexOf('@');
        const newValue = inputValue.slice(0, lastAtIndex) + `@${user.display_name} `;
        setInputValue(newValue);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    // Handle keyboard navigation in mentions
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (mentionSuggestions[mentionIndex]) {
                    handleMentionSelect(mentionSuggestions[mentionIndex]);
                }
            } else if (e.key === 'Escape') {
                setShowMentions(false);
            }
        }
    };

    // Handle reaction toggle
    const handleReaction = async (messageId: string, emoji: string) => {
        const reactions = messageReactions[messageId] || [];
        const existingReaction = reactions.find(r => r.emoji === emoji);
        
        if (existingReaction?.hasReacted) {
            await chatService.removeReaction(messageId, emoji);
            setMessageReactions(prev => ({
                ...prev,
                [messageId]: prev[messageId]?.map(r => 
                    r.emoji === emoji 
                        ? { ...r, count: r.count - 1, hasReacted: false, users: r.users.filter(u => u !== userProfile?.id) }
                        : r
                ).filter(r => r.count > 0) || []
            }));
        } else {
            await chatService.addReaction(messageId, emoji);
            setMessageReactions(prev => ({
                ...prev,
                [messageId]: existingReaction 
                    ? prev[messageId]?.map(r => 
                        r.emoji === emoji 
                            ? { ...r, count: r.count + 1, hasReacted: true, users: [...r.users, userProfile?.id || ''] }
                            : r
                    ) || []
                    : [...(prev[messageId] || []), { emoji, count: 1, hasReacted: true, users: [userProfile?.id || ''] }]
            }));
        }
        setShowReactionPicker(null);
    };

    // Handle context menu
    const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
        e.preventDefault();
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setContextMenuMessage(messageId);
    };

    // Handle reply
    const handleReply = (msg: ChatMessageType) => {
        setReplyingTo({
            id: msg.id,
            content: msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : ''),
            userName: msg.user?.display_name || 'Unknown'
        });
        setContextMenuMessage(null);
        inputRef.current?.focus();
    };

    // Handle edit
    const handleStartEdit = (msg: ChatMessageType) => {
        setEditingMessage(msg.id);
        setEditContent(msg.content);
        setContextMenuMessage(null);
    };

    const handleSaveEdit = async (messageId: string) => {
        if (!editContent.trim()) return;
        
        // Update locally first (optimistic)
        setMessages(prev => prev.map(m => 
            m.id === messageId ? { ...m, content: editContent, edited: true } : m
        ));
        setEditingMessage(null);
        setEditContent('');
        
        // TODO: Add chatService.editMessage when backend supports it
    };

    // Handle delete
    const handleDelete = async (messageId: string) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setContextMenuMessage(null);
        // TODO: Add chatService.deleteMessage when backend supports it
    };

    // Copy message text
    const handleCopyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
        setContextMenuMessage(null);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inputValue.trim() || sending) return;

        let messageContent = inputValue.trim();
        
        // Add reply reference if replying
        if (replyingTo) {
            messageContent = `↩️ @${replyingTo.userName}: "${replyingTo.content}"\n\n${messageContent}`;
        }

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
        setReplyingTo(null);
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

    // Render system message (for Visual Studio events)
    const renderSystemMessage = (msg: ChatMessageType) => {
        const icon = SYSTEM_ICONS[msg.action_data?.type as string] || <Sparkles size={14} className="text-gray-400" />;
        return (
            <div className="chat-system-message">
                {icon}
                <span>{msg.content}</span>
            </div>
        );
    };

    // Render message content with mentions highlighted
    const renderMessageContent = (content: string) => {
        // Parse mentions and links
        const parts = content.split(/(@\w+|\bhttps?:\/\/\S+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} className="text-blue-500 font-medium">{part}</span>;
            }
            if (part.match(/^https?:\/\//)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" 
                       className="text-blue-500 underline hover:text-blue-600 inline-flex items-center gap-1">
                        {part.length > 30 ? part.slice(0, 30) + '...' : part}
                    </a>
                );
            }
            return part;
        });
    };

    // Render reactions for a message
    const renderReactions = (msgId: string) => {
        const reactions = messageReactions[msgId] || [];
        if (reactions.length === 0) return null;
        
        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {reactions.map(r => (
                    <button
                        key={r.emoji}
                        onClick={() => handleReaction(msgId, r.emoji)}
                        className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors
                            ${r.hasReacted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <span>{r.emoji}</span>
                        <span>{r.count}</span>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="chat-conversation" onClick={() => { setContextMenuMessage(null); setShowReactionPicker(null); }}>
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-4 py-1.5 text-xs ${isConnected ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                {isConnected ? (
                    <>
                        <Wifi size={12} />
                        <span>Connected • {onlineUsers.length} online</span>
                        <div className="ml-auto flex -space-x-2">
                            {onlineUsers.slice(0, 5).map(u => (
                                <div key={u.user_id} className="w-5 h-5 rounded-full bg-green-200 border-2 border-white flex items-center justify-center text-[8px] font-bold text-green-700" title={u.display_name}>
                                    {u.display_name[0]?.toUpperCase()}
                                </div>
                            ))}
                            {onlineUsers.length > 5 && (
                                <div className="w-5 h-5 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[8px] font-medium text-gray-600">
                                    +{onlineUsers.length - 5}
                                </div>
                            )}
                        </div>
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
                        <Sparkles size={32} className="mb-2 opacity-50" />
                        <p>No messages yet. Start the conversation!</p>
                        <p className="text-xs mt-1">Tip: Use @ to mention users</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.user_id === userProfile?.id;
                        const isOptimistic = msg.id.startsWith('temp-');
                        const isSystem = msg.type === 'system' || msg.type === 'action';
                        const isEditing = editingMessage === msg.id;
                        
                        // System messages (Visual Studio events)
                        if (isSystem) {
                            return <div key={msg.id}>{renderSystemMessage(msg)}</div>;
                        }
                        
                        return (
                            <div 
                                key={msg.id} 
                                className={`chat-message-row ${isOwn ? 'own' : 'other'} group`}
                                onContextMenu={(e) => handleContextMenu(e, msg.id)}
                            >
                                {!isOwn && renderAvatar(msg, false)}
                                <div className="flex flex-col max-w-[80%]">
                                    {!isOwn && msg.user?.display_name && (
                                        <span className="text-xs text-gray-500 ml-1 mb-1">{msg.user.display_name}</span>
                                    )}
                                    <div className="relative">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSaveEdit(msg.id)} className="p-1 text-green-500 hover:bg-green-50 rounded">
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={() => setEditingMessage(null)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={`chat-message-bubble ${isOptimistic ? 'opacity-70' : ''}`}>
                                                    {renderMessageContent(msg.content)}
                                                    <span className="text-[10px] text-gray-400 ml-2">
                                                        {isOptimistic ? 'Sending...' : formatTime(msg.created_at)}
                                                        {(msg as any).edited && ' (edited)'}
                                                    </span>
                                                </div>
                                                
                                                {/* Quick actions on hover */}
                                                <div className="absolute -top-2 right-0 hidden group-hover:flex items-center gap-0.5 bg-white shadow-md rounded-full px-1 py-0.5 border border-gray-100">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setShowReactionPicker(msg.id); }}
                                                        className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                                                        title="Add reaction"
                                                    >
                                                        <Smile size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                                                        className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                                                        title="Reply"
                                                    >
                                                        <Reply size={14} />
                                                    </button>
                                                    {isOwn && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleStartEdit(msg); }}
                                                                className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }}
                                                                className="p-1 hover:bg-gray-100 rounded-full text-red-400"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                {/* Reaction picker */}
                                                {showReactionPicker === msg.id && (
                                                    <div 
                                                        className="absolute -top-10 left-0 bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 border border-gray-100 z-10"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {REACTION_EMOJIS.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => handleReaction(msg.id, emoji)}
                                                                className="hover:scale-125 transition-transform p-1"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        
                                        {/* Reactions display */}
                                        {renderReactions(msg.id)}
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

            {/* Context Menu */}
            {contextMenuMessage && (
                <div 
                    className="fixed bg-white shadow-xl rounded-lg py-2 z-50 min-w-[160px] border border-gray-100"
                    style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {(() => {
                        const msg = messages.find(m => m.id === contextMenuMessage);
                        if (!msg) return null;
                        const isOwn = msg.user_id === userProfile?.id;
                        return (
                            <>
                                <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => handleReply(msg)}>
                                    <Reply size={14} /> Reply
                                </button>
                                <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => handleCopyMessage(msg.content)}>
                                    <Copy size={14} /> Copy text
                                </button>
                                {isOwn && (
                                    <>
                                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => handleStartEdit(msg)}>
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-500" onClick={() => handleDelete(msg.id)}>
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Reply indicator */}
            {replyingTo && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Reply size={14} className="text-blue-500" />
                        <span>Replying to <strong>{replyingTo.userName}</strong>: {replyingTo.content}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 rounded">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Mentions dropdown */}
            {showMentions && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-20 left-4 bg-white shadow-xl rounded-lg py-2 z-50 min-w-[200px] border border-gray-100 max-h-40 overflow-y-auto">
                    {mentionSuggestions.map((user, i) => (
                        <button
                            key={user.user_id}
                            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${i === mentionIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            onClick={() => handleMentionSelect(user)}
                        >
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                {user.display_name[0]?.toUpperCase()}
                            </div>
                            <span>{user.display_name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="chat-input-area">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors touch-manipulation active:scale-95"
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
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : "Type a message... Use @ to mention"}
                    className="chat-input-field"
                    disabled={sending || !isConnected}
                />
                <button
                    type="submit"
                    className="chat-send-btn min-w-[44px] min-h-[44px] touch-manipulation active:scale-95"
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
