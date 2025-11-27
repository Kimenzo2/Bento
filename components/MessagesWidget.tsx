import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Users, Send, Sun, Moon, Plus, Check, Sparkles } from 'lucide-react';

interface Message {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    text: string;
    timestamp: Date;
    type?: 'text' | 'system' | 'action';
    actionData?: {
        type: 'yay_button';
        clickCount: number;
        maxClicks: number;
        clickedBy: string[];
    };
}

interface ActiveUser {
    id: string;
    name: string;
    avatar: string;
    color: string;
}

interface MessagesWidgetProps {
    onCollaborationStart?: () => void;
    onUserTyping?: (isTyping: boolean) => void;
}

const MessagesWidget: React.FC<MessagesWidgetProps> = ({ onCollaborationStart, onUserTyping }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(4);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [isGroupChatEnabled, setIsGroupChatEnabled] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        const hasEnabled = localStorage.getItem('hasEnabledGroupChat');
        if (!hasEnabled) {
            setShowTooltip(true);
        }
    }, []);

    const toggleGroupChat = () => {
        const newState = !isGroupChatEnabled;
        setIsGroupChatEnabled(newState);
        if (newState && showTooltip) {
            setShowTooltip(false);
            localStorage.setItem('hasEnabledGroupChat', 'true');
        }
    };
    const [activeUsers] = useState<ActiveUser[]>([
        { id: 'u1', name: 'Sarah Art', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', color: '#FF6B9D' },
        { id: 'u2', name: 'Alex Dev', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', color: '#4ECDC4' },
        { id: 'u3', name: 'Maya Writer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya', color: '#95E1D3' },
        { id: 'u4', name: 'Jordan', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan', color: '#FFD93D' },
    ]);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            userId: 'u1',
            userName: 'Sarah Art',
            userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
            text: 'Hey everyone! Check out this new character design 🎨',
            timestamp: new Date(Date.now() - 1000 * 60 * 60),
            type: 'text'
        },
        {
            id: '2',
            userId: 'u2',
            userName: 'Alex Dev',
            userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
            text: 'The lighting is incredible!',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            type: 'text'
        },
        {
            id: '3',
            userId: 'u3',
            userName: 'Maya Writer',
            userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
            text: 'Love the color palette 💜',
            timestamp: new Date(Date.now() - 1000 * 60 * 15),
            type: 'text'
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentUser = {
        id: 'current',
        name: 'You',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        color: '#FF9D6E'
    };

    // Theme colors
    const colors = {
        light: {
            bg: 'bg-gradient-to-br from-[#FFF5E6] via-[#FFE8CC] to-[#FFD4A3]',
            cardBg: 'bg-white/80 backdrop-blur-sm',
            border: 'border-[#FFB88C]/30',
            text: 'text-[#8B4513]',
            textSecondary: 'text-[#A0522D]/70',
            messagesBg: 'bg-gradient-to-b from-[#FFF9F0] to-[#FFEFD5]',
            userMessageBg: 'bg-gradient-to-r from-[#FFB88C] to-[#FFA07A]',
            otherMessageBg: 'bg-white/90',
            inputBg: 'bg-white/60',
            headerBg: 'bg-white/70 backdrop-blur-md',
            buttonBg: 'bg-gradient-to-r from-[#FFB88C] to-[#FFA07A]',
            hoverBg: 'hover:bg-[#FFF0E0]',
        },
        dark: {
            bg: 'bg-[#1A1A1A]',
            cardBg: 'bg-[#1A1A1A]',
            border: 'border-[#333333]',
            text: 'text-white',
            textSecondary: 'text-gray-500',
            messagesBg: 'bg-[#0D0D0D]',
            userMessageBg: 'bg-gradient-to-r from-[#FF9D6E] to-[#FFD56E]',
            otherMessageBg: 'bg-[#2D2D2D]',
            inputBg: 'bg-[#2D2D2D]',
            headerBg: 'bg-[#1A1A1A]',
            buttonBg: 'bg-gradient-to-r from-[#FF9D6E] to-[#FFD56E]',
            hoverBg: 'hover:bg-[#2D2D2D]',
        }
    };

    const currentColors = colors[theme];

    // Scroll to bottom on new message
    useEffect(() => {
        if (isOpen && isGroupChatEnabled) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isGroupChatEnabled]);

    // Mock incoming messages from random users (WebSocket simulation)
    useEffect(() => {
        if (!isGroupChatEnabled) return;

        const interval = setInterval(() => {
            if (Math.random() > 0.6) {
                const randomUser = activeUsers[Math.floor(Math.random() * activeUsers.length)];
                setTypingUsers([randomUser.name]);

                setTimeout(() => {
                    setTypingUsers([]);

                    // Check if we should trigger the "Yay" button scenario
                    const shouldTriggerYay = Math.random() > 0.8 && !messages.some(m => m.actionData?.type === 'yay_button');

                    if (shouldTriggerYay) {
                        const newMsg: Message = {
                            id: Date.now().toString(),
                            userId: randomUser.id,
                            userName: randomUser.name,
                            userAvatar: randomUser.avatar,
                            text: "Lets make Cinderella and Sofia the first riding a bicycle! 🚲✨",
                            timestamp: new Date(),
                            type: 'text'
                        };
                        setMessages(prev => [...prev, newMsg]);

                        setTimeout(() => {
                            const actionMsg: Message = {
                                id: (Date.now() + 1).toString(),
                                userId: 'system',
                                userName: 'System',
                                userAvatar: '',
                                text: '',
                                timestamp: new Date(),
                                type: 'action',
                                actionData: {
                                    type: 'yay_button',
                                    clickCount: 0,
                                    maxClicks: 5,
                                    clickedBy: []
                                }
                            };
                            setMessages(prev => [...prev, actionMsg]);
                        }, 1000);

                    } else {
                        const messageTexts = [
                            'Love the colors!',
                            'Can you try a different angle?',
                            'Wow! 🤩',
                            'Is this the final render?',
                            'This is amazing work!',
                            'What style did you use?',
                            'The details are incredible 🔥',
                            'Can\'t wait to see more!'
                        ];
                        const newMsg: Message = {
                            id: Date.now().toString(),
                            userId: randomUser.id,
                            userName: randomUser.name,
                            userAvatar: randomUser.avatar,
                            text: messageTexts[Math.floor(Math.random() * messageTexts.length)],
                            timestamp: new Date(),
                            type: 'text'
                        };
                        setMessages(prev => [...prev, newMsg]);
                    }

                    if (!isOpen) {
                        setNotificationCount(prev => prev + 1);
                    }
                }, 2000);
            }
        }, 12000);

        return () => clearInterval(interval);
    }, [isOpen, activeUsers, isGroupChatEnabled, messages]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const newMsg: Message = {
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.name,
            userAvatar: currentUser.avatar,
            text: inputValue,
            timestamp: new Date(),
            type: 'text'
        };

        setMessages(prev => [...prev, newMsg]);
        setInputValue('');

        if (onUserTyping) {
            onUserTyping(true);
            setTimeout(() => onUserTyping(false), 2000);
        }
    };

    const handleYayClick = (messageId: string) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId && msg.actionData && msg.actionData.type === 'yay_button') {
                if (msg.actionData.clickedBy.includes(currentUser.id)) return msg;
                if (msg.actionData.clickCount >= msg.actionData.maxClicks) return msg;

                const newCount = msg.actionData.clickCount + 1;
                const newClickedBy = [...msg.actionData.clickedBy, currentUser.id];

                // Simulate other users clicking rapidly
                if (newCount === 1) {
                    setTimeout(() => {
                        setMessages(current => current.map(m => {
                            if (m.id === messageId && m.actionData) {
                                return {
                                    ...m,
                                    actionData: {
                                        ...m.actionData,
                                        clickCount: 5,
                                        clickedBy: [...m.actionData.clickedBy, 'u1', 'u2', 'u3', 'u4']
                                    }
                                };
                            }
                            return m;
                        }));
                        // Trigger collaboration start
                        if (onCollaborationStart) onCollaborationStart();
                    }, 1500);
                }

                return {
                    ...msg,
                    actionData: {
                        ...msg.actionData,
                        clickCount: newCount,
                        clickedBy: newClickedBy
                    }
                };
            }
            return msg;
        }));
    };

    // Standard floating widget
    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none max-h-[calc(100vh-120px)]">
            {/* Chat Window - Only visible when group chat is enabled */}
            {isGroupChatEnabled && (
                <div
                    className={`
                        pointer-events-auto
                        ${currentColors.cardBg}
                        rounded-2xl shadow-2xl 
                        border ${currentColors.border}
                        overflow-hidden 
                        transition-all duration-300 ease-in-out origin-bottom-right
                        mb-4 flex flex-col
                        ${isOpen ? 'w-[380px] h-[550px] max-h-[calc(100vh-140px)] opacity-100 scale-100' : 'w-[380px] h-0 opacity-0 scale-95'}
                    `}
                >
                    {/* Header */}
                    <div className={`p-4 border-b ${currentColors.border} ${currentColors.headerBg}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white mb-1 shadow-sm tracking-wide">
                                    BETA
                                </span>
                                <h3 className={`font-bold text-base ${currentColors.text} flex items-center gap-2`}>
                                    <MessageCircle className="w-5 h-5" />
                                    Visual Studio Chat
                                </h3>
                                <p className={`text-xs ${currentColors.textSecondary} flex items-center gap-1 mt-1`}>
                                    <span className={`w-2 h-2 ${theme === 'light' ? 'bg-[#90EE90]' : 'bg-green-500'} rounded-full`}></span>
                                    {activeUsers.length} active creators
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                    className={`p-2 rounded-full ${currentColors.hoverBg} transition-colors ${currentColors.text}`}
                                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                                >
                                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                </button>
                                <button
                                    className={`p-2 rounded-full ${currentColors.hoverBg} transition-all ${currentColors.textSecondary} hover:scale-110`}
                                    title="View active users"
                                >
                                    <Users className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Active Users Avatars */}
                        <div className="flex -space-x-2">
                            {activeUsers.slice(0, 5).map((user) => (
                                <img
                                    key={user.id}
                                    src={user.avatar}
                                    alt={user.name}
                                    className={`w-7 h-7 rounded-full border-2 ${theme === 'light' ? 'border-white/80' : 'border-[#1A1A1A]'} bg-gray-100`}
                                    title={user.name}
                                />
                            ))}
                            {activeUsers.length > 5 && (
                                <div className={`w-7 h-7 rounded-full border-2 ${theme === 'light' ? 'border-white/80' : 'border-[#1A1A1A]'} ${theme === 'light' ? 'bg-[#FFE4CC]' : 'bg-[#2D2D2D]'} flex items-center justify-center text-xs font-semibold ${currentColors.text}`}>
                                    +{activeUsers.length - 5}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${currentColors.messagesBg}`}>
                        {messages.map((msg) => {
                            if (msg.type === 'action' && msg.actionData?.type === 'yay_button') {
                                const isClicked = msg.actionData.clickedBy.includes(currentUser.id);
                                const isFull = msg.actionData.clickCount >= msg.actionData.maxClicks;

                                return (
                                    <div key={msg.id} className="flex justify-center my-4 animate-fadeIn">
                                        <button
                                            onClick={() => handleYayClick(msg.id)}
                                            disabled={isClicked || isFull}
                                            className={`
                                                group relative px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all
                                                ${isFull
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : isClicked
                                                        ? 'bg-gradient-to-r from-green-400 to-emerald-500 cursor-default'
                                                        : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-105 hover:shadow-xl animate-bounce'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sparkles className={`w-5 h-5 ${!isFull && !isClicked ? 'animate-spin' : ''}`} />
                                                <span>{isFull ? 'Collaboration Started!' : isClicked ? 'You\'re in!' : 'Yay, Let\'s do it!'}</span>
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white text-pink-500 rounded-full flex items-center justify-center text-xs font-bold shadow-md border-2 border-pink-100">
                                                {msg.actionData.clickCount}/{msg.actionData.maxClicks}
                                            </div>

                                            {/* Avatars of clickers */}
                                            {msg.actionData.clickCount > 0 && (
                                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex -space-x-2">
                                                    {msg.actionData.clickedBy.map((uid, i) => (
                                                        <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white overflow-hidden">
                                                            <img
                                                                src={uid === currentUser.id ? currentUser.avatar : activeUsers.find(u => u.id === uid)?.avatar}
                                                                alt="User"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                );
                            }

                            const isCurrentUser = msg.userId === currentUser.id;
                            return (
                                <div key={msg.id} className="flex gap-2">
                                    {!isCurrentUser && (
                                        <img
                                            src={msg.userAvatar}
                                            alt={msg.userName}
                                            className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0"
                                        />
                                    )}
                                    <div className={`flex-1 ${isCurrentUser ? 'ml-10' : ''}`}>
                                        {!isCurrentUser && (
                                            <div className={`text-xs font-semibold ${theme === 'light' ? 'text-[#A0522D]' : 'text-gray-300'} mb-1`}>
                                                {msg.userName}
                                            </div>
                                        )}
                                        <div
                                            className={`
                                                px-3 py-2 rounded-2xl text-sm w-fit max-w-[85%]
                                                ${isCurrentUser
                                                    ? `${currentColors.userMessageBg} text-white ml-auto rounded-br-md shadow-sm`
                                                    : `${currentColors.otherMessageBg} ${theme === 'light' ? 'text-[#8B4513]' : 'text-white'} rounded-bl-md shadow-sm`}
                                            `}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {typingUsers.length > 0 && (
                            <div className="flex gap-2 items-center">
                                <div className="w-8 h-8"></div>
                                <div className={`${currentColors.otherMessageBg} px-4 py-2 rounded-2xl rounded-bl-md flex gap-1 items-center shadow-sm`}>
                                    <span className={`text-xs ${currentColors.textSecondary} mr-2`}>{typingUsers[0]} is typing</span>
                                    <span className={`w-1.5 h-1.5 ${theme === 'light' ? 'bg-[#CD853F]' : 'bg-gray-400'} rounded-full animate-bounce`}></span>
                                    <span className={`w-1.5 h-1.5 ${theme === 'light' ? 'bg-[#CD853F]' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }}></span>
                                    <span className={`w-1.5 h-1.5 ${theme === 'light' ? 'bg-[#CD853F]' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className={`p-3 border-t ${currentColors.border} ${currentColors.headerBg}`}>
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Message the group..."
                                className={`flex-1 ${currentColors.inputBg} border-none outline-none rounded-full px-4 py-2.5 text-sm ${currentColors.text} placeholder-opacity-60 ${theme === 'light' ? 'placeholder-[#CD853F]' : 'placeholder-gray-500'} focus:ring-2 ${theme === 'light' ? 'focus:ring-[#FFB88C]/30' : 'focus:ring-[#FF9D6E]/30'}`}
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim()}
                                className={`
                                    p-2.5 rounded-full transition-all
                                    ${inputValue.trim()
                                        ? `${currentColors.buttonBg} text-white hover:scale-105 shadow-md`
                                        : `${theme === 'light' ? 'bg-[#FFE4CC]' : 'bg-[#2D2D2D]'} ${theme === 'light' ? 'text-[#CD853F]' : 'text-gray-400'} cursor-not-allowed`}
                                `}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Buttons Container - Horizontal layout */}
            <div className="flex flex-row items-center gap-3 pointer-events-none">
                {/* Onboarding Tooltip */}
                {showTooltip && !isGroupChatEnabled && (
                    <div className="absolute bottom-20 right-0 z-50 animate-bounce pointer-events-auto">
                        <div className="relative p-[3px] overflow-hidden rounded-2xl">
                            <div className="absolute inset-[-100%] animate-[spin_6s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#1E40AF_0%,#3B82F6_25%,#1E40AF_50%,#3B82F6_75%,#1E40AF_100%)]" />
                            <div className="relative bg-white px-5 py-3 rounded-2xl shadow-xl">
                                <span className="text-sm font-bold text-blue-600 whitespace-nowrap">Enable Group Chat</span>
                            </div>
                        </div>
                        {/* Message bubble tail pointing to button */}
                        <div className="absolute -bottom-3 right-4">
                            <div className="relative w-6 h-6">
                                <div className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#1E40AF_0%,#3B82F6_50%,#1E40AF_100%)] rotate-45 rounded-br-md"></div>
                                <div className="absolute inset-[3px] bg-white rotate-45 rounded-br-md"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Privacy Toggle Button */}
                <button
                    onClick={toggleGroupChat}
                    className={`
                        pointer-events-auto
                        flex items-center justify-center
                        w-14 h-14 rounded-full 
                        shadow-[0_4px_20px_rgba(0,0,0,0.15)] 
                        hover:shadow-[0_8px_25px_rgba(0,0,0,0.2)]
                        hover:scale-110
                        transition-all duration-300
                        ${isGroupChatEnabled
                            ? 'bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] text-white'
                            : `${theme === 'light' ? 'bg-white/90 backdrop-blur-sm border border-[#FFB88C]/30' : 'bg-[#1A1A1A] border border-[#333333]'} ${currentColors.text}`
                        }
                    `}
                    title={isGroupChatEnabled ? 'Group Chat Enabled - Your visuals are public' : 'Enable Group Chat - Share your visuals globally'}
                >
                    {isGroupChatEnabled ? (
                        <Check className="w-6 h-6" strokeWidth={3} />
                    ) : (
                        <Plus className="w-6 h-6" />
                    )}
                </button>

                {/* Floating Messages Button - Only visible when group chat is enabled */}
                {isGroupChatEnabled && (
                    <button
                        onClick={() => {
                            setIsOpen(!isOpen);
                            if (!isOpen) setNotificationCount(0);
                        }}
                        className={`
                            pointer-events-auto
                            group flex items-center gap-3 
                            ${theme === 'light' ? 'bg-white/90 backdrop-blur-sm' : 'bg-[#1A1A1A]'}
                            ${currentColors.text}
                            px-4 py-3 rounded-full 
                            shadow-[0_4px_20px_rgba(0,0,0,0.15)] 
                            hover:shadow-[0_8px_25px_rgba(0,0,0,0.2)]
                            hover:scale-105
                            transition-all duration-300
                            border ${theme === 'light' ? 'border-[#FFB88C]/30' : 'border-[#333333]'}
                        `}
                    >
                        <div className="relative">
                            {isOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <MessageCircle className="w-6 h-6" />
                            )}
                            {!isOpen && notificationCount > 0 && (
                                <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] bg-[#FF4444] text-white text-[10px] font-bold rounded-full px-1 border-2 ${theme === 'light' ? 'border-white' : 'border-[#1A1A1A]'} animate-bounce`}>
                                    {notificationCount}
                                </span>
                            )}
                        </div>
                        <span className="font-semibold text-sm pr-1">Messages</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default MessagesWidget;
