import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, MessageSquare, ArrowLeft, Plus, Loader2 } from 'lucide-react';
import ChatConversation from './ChatConversation';
import { UserProfile } from '../services/profileService';
import { supabase } from '../services/supabaseClient';

interface ChatRoom {
    id: string;
    name: string;
    description?: string;
    is_public?: boolean;
    created_by?: string;
    created_at: string;
    updated_at?: string;
    last_message_at?: string | null;
    unread_count?: number;
}

interface ChatPanelProps {
    userProfile: UserProfile | null;
    onClose: () => void;
    onUnreadCountChange: (count: number) => void;
    onCollaborativeTrigger?: () => void;
    isMobile?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ userProfile, onClose, onUnreadCountChange, onCollaborativeTrigger, isMobile = false }) => {
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    // Fetch chat rooms from database
    const fetchRooms = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('chat_rooms')
                .select('*')
                .order('updated_at', { ascending: false, nullsFirst: false });

            if (error) {
                console.error('Error fetching rooms:', error);
                // If table doesn't exist or other error, use fallback rooms
                if (error.code === '42P01' || error.code === 'PGRST116') {
                    setRooms([
                        { id: '00000000-0000-0000-0000-000000000001', name: 'general', is_public: true, created_at: new Date().toISOString() },
                        { id: '00000000-0000-0000-0000-000000000002', name: 'random', is_public: true, created_at: new Date().toISOString() }
                    ]);
                }
                return;
            }

            if (data && data.length > 0) {
                setRooms(data);
            } else {
                // Create default rooms if none exist
                const defaultRooms = [
                    { name: 'general', description: 'General discussion', is_public: true },
                    { name: 'random', description: 'Random chat', is_public: true }
                ];

                for (const room of defaultRooms) {
                    await supabase.from('chat_rooms').insert(room);
                }

                // Refetch after creating
                const { data: newData } = await supabase
                    .from('chat_rooms')
                    .select('*')
                    .order('updated_at', { ascending: false, nullsFirst: false });

                if (newData) {
                    setRooms(newData);
                }
            }
        } catch (err) {
            console.error('Error in fetchRooms:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Subscribe to room changes
    useEffect(() => {
        fetchRooms();

        // Real-time subscription for new rooms
        const channel = supabase
            .channel('chat_rooms_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_rooms' },
                () => {
                    fetchRooms();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [fetchRooms]);

    // Create new room
    const handleCreateRoom = async () => {
        if (!newRoomName.trim()) return;

        const roomName = newRoomName.trim().toLowerCase().replace(/\s+/g, '-');

        try {
            const { data: user } = await supabase.auth.getUser();
            const { error } = await supabase.from('chat_rooms').insert({
                name: roomName,
                description: `${roomName} channel`,
                is_public: true,
                created_by: user?.user?.id
            });

            if (error) {
                console.error('Error creating room:', error);
                return;
            }

            setNewRoomName('');
            setIsCreatingRoom(false);
            fetchRooms();
        } catch (err) {
            console.error('Error creating room:', err);
        }
    };

    // Filter rooms by search
    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Helper function to get user avatar
    const getUserAvatar = () => {
        if (userProfile?.avatar_url) {
            return <img src={userProfile.avatar_url} alt="User" className="chat-avatar" />;
        }

        // Fallback to initials
        const initials = userProfile?.full_name
            ? userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            : userProfile?.email?.[0]?.toUpperCase() || '?';

        return <div className="chat-avatar">{initials}</div>;
    };

    // Mobile View Logic
    const showSidebar = !isMobile || (isMobile && !selectedThreadId);
    const showChat = !isMobile || (isMobile && selectedThreadId);

    return (
        <div className="flex w-full h-full bg-white overflow-hidden">
            {/* LEFT COLUMN: SIDEBAR */}
            {showSidebar && (
                <div className={`${isMobile ? 'w-full' : 'chat-sidebar'}`}>
                    <div className="chat-sidebar-header">
                        <div className="chat-sidebar-title">
                            <span>Project chat • Genesis</span>
                            {isMobile && (
                                <button onClick={onClose} className="p-2" title="Close chat" aria-label="Close chat">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            )}
                        </div>
                        <div className="chat-search-container">
                            <Search className="chat-search-icon" />
                            <input
                                type="text"
                                className="chat-search-input"
                                placeholder="Search channels"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="chat-channels-list">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : filteredRooms.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                {searchQuery ? 'No channels found' : 'No channels yet'}
                            </div>
                        ) : (
                            filteredRooms.map(room => (
                                <div
                                    key={room.id}
                                    className={`chat-channel-item ${selectedThreadId === room.id ? 'active' : ''}`}
                                    onClick={() => setSelectedThreadId(room.id)}
                                >
                                    <span className="chat-channel-hash">#</span>
                                    <span>{room.name}</span>
                                    {room.unread_count && room.unread_count > 0 && (
                                        <span className="ml-auto bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                                            {room.unread_count}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {isCreatingRoom ? (
                        <div className="p-3 border-t border-gray-200">
                            <input
                                type="text"
                                placeholder="Channel name..."
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={handleCreateRoom}
                                    className="flex-1 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setIsCreatingRoom(false); setNewRoomName(''); }}
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsCreatingRoom(true)}
                            className="chat-new-channel-btn flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            New channel
                        </button>
                    )}
                </div>
            )}

            {/* RIGHT COLUMN: MAIN CHAT AREA */}
            {showChat && (
                <div className={`${isMobile ? 'w-full flex flex-col h-full' : 'chat-main-area'}`}>
                    {/* Header */}
                    <div className="chat-main-header">
                        <div className="flex items-center gap-3">
                            {isMobile && (
                                <button
                                    onClick={() => setSelectedThreadId(null)}
                                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
                                    title="Back to channels"
                                    aria-label="Back to channels"
                                >
                                    <ArrowLeft size={20} className="text-gray-600" />
                                </button>
                            )}
                            <div className="chat-avatars-group">
                                {/* Display current user's avatar */}
                                {getUserAvatar()}
                                {/* Mock avatars for other users */}
                                <div className="chat-avatar"></div>
                                <div className="chat-avatar"></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="chat-new-msg-btn">
                                New message
                            </button>
                            {!isMobile && (
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 hover:border-gray-300"
                                    title="Collapse chat"
                                >
                                    <X size={20} className="text-gray-600" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-hidden relative">
                        {selectedThreadId ? (
                            <ChatConversation
                                threadId={selectedThreadId}
                                userProfile={userProfile}
                                isMobile={isMobile}
                                onCollaborativeTrigger={onCollaborativeTrigger}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <MessageSquare size={48} className="mb-4 opacity-20" />
                                <p>Select a channel to start chatting</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;
