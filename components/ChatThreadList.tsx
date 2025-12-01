import React, { useState, useEffect } from 'react';
import { Search, Users } from 'lucide-react';
import { chatService, ChatRoom } from '../services/chatService';

interface ChatThreadListProps {
    userId?: string;
    onThreadSelect: (threadId: string) => void;
    selectedThreadId?: string | null;
    onUnreadCountChange: (count: number) => void;
}

interface ThreadItem extends ChatRoom {
    lastMessage?: string;
    lastMessageTime?: string;
    unreadCount?: number;
    isOnline?: boolean;
}

const ChatThreadList: React.FC<ChatThreadListProps> = ({
    userId,
    onThreadSelect,
    selectedThreadId,
    onUnreadCountChange
}) => {
    const [threads, setThreads] = useState<ThreadItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadThreads();
    }, [userId]);

    const loadThreads = async () => {
        setLoading(true);
        try {
            const rooms = await chatService.getUserRooms();

            // Transform rooms into thread items with mock data for now
            const threadItems: ThreadItem[] = rooms.map(room => ({
                ...room,
                lastMessage: 'Click to view conversation',
                lastMessageTime: new Date().toISOString(),
                unreadCount: 0,
                isOnline: Math.random() > 0.5
            }));

            setThreads(threadItems);

            // Calculate total unread count
            const totalUnread = threadItems.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
            onUnreadCountChange(totalUnread);
        } catch (error) {
            console.error('Error loading threads:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredThreads = threads.filter(thread =>
        thread.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString();
    };

    return (
        <div className="chat-thread-list">
            {/* Search Bar */}
            <div className="chat-thread-search">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Threads Section */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : (
                    filteredThreads.map(thread => (
                        <div
                            key={thread.id}
                            onClick={() => onThreadSelect(thread.id)}
                            className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center gap-3 ${selectedThreadId === thread.id ? 'bg-blue-50' : ''}`}
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                    <Users size={20} className="text-gray-500" />
                                </div>
                                {thread.isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <h4 className="font-medium text-gray-900 truncate">{thread.name}</h4>
                                    {thread.lastMessageTime && (
                                        <span className="text-xs text-gray-400">{formatTime(thread.lastMessageTime)}</span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-500 truncate">{thread.lastMessage}</p>
                                    {thread.unreadCount && thread.unreadCount > 0 ? (
                                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                            {thread.unreadCount}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ChatThreadList;
