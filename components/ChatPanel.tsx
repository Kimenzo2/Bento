import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, Search, MessageSquare, ArrowLeft, Plus, Loader2, 
    Sparkles, Users, Pin, Image as ImageIcon, Activity, Bell
} from 'lucide-react';
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
    is_pinned?: boolean;
    room_type?: 'general' | 'visual-studio' | 'direct' | 'project';
    icon?: string;
}

interface VisualStudioEvent {
    type: 'visual_shared' | 'user_joined' | 'collab_started' | 'creation_liked';
    userId: string;
    userName: string;
    data?: any;
    timestamp: string;
}

interface ChatPanelProps {
    userProfile: UserProfile | null;
    onClose: () => void;
    onUnreadCountChange: (count: number) => void;
    onCollaborativeTrigger?: () => void;
    isMobile?: boolean;
    // Visual Studio integration
    visualStudioEvents?: VisualStudioEvent[];
    activeCollaborators?: { id: string; name: string; avatar?: string }[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
    userProfile, 
    onClose, 
    onUnreadCountChange, 
    onCollaborativeTrigger, 
    isMobile = false,
    visualStudioEvents = [],
    activeCollaborators = []
}) => {
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [activeTab, setActiveTab] = useState<'channels' | 'activity' | 'direct'>('channels');
    const [pinnedRooms, setPinnedRooms] = useState<Set<string>>(new Set());
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
                // Add Visual Studio activity channel if not exists
                const hasVsChannel = data.some((r: ChatRoom) => r.name === 'visual-studio-activity');
                if (!hasVsChannel) {
                    setRooms([
                        { 
                            id: 'vs-activity', 
                            name: 'visual-studio-activity', 
                            description: 'Live feed of Visual Studio activity',
                            is_public: true, 
                            created_at: new Date().toISOString(),
                            room_type: 'visual-studio',
                            icon: '🎨'
                        },
                        ...data
                    ]);
                } else {
                    setRooms(data);
                }
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

    // Separate pinned and unpinned rooms
    const pinnedRoomsList = filteredRooms.filter(r => pinnedRooms.has(r.id));
    const unpinnedRoomsList = filteredRooms.filter(r => !pinnedRooms.has(r.id));

    // Toggle pin status
    const togglePin = (roomId: string) => {
        setPinnedRooms(prev => {
            const next = new Set(prev);
            if (next.has(roomId)) {
                next.delete(roomId);
            } else {
                next.add(roomId);
            }
            return next;
        });
    };

    // Get room icon based on type
    const getRoomIcon = (room: ChatRoom) => {
        if (room.icon) return <span className="text-base">{room.icon}</span>;
        if (room.room_type === 'visual-studio') return <Sparkles size={14} className="text-purple-500" />;
        if (room.room_type === 'direct') return <Users size={14} className="text-blue-500" />;
        return <span className="chat-channel-hash">#</span>;
    };

    // Format event time
    const formatEventTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

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
                                <button type="button" onClick={onClose} className="p-2 min-w-[44px] min-h-[44px] touch-manipulation" title="Close chat" aria-label="Close chat">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            )}
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setActiveTab('channels')}
                                className={`flex-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-md transition-colors touch-manipulation active:scale-[0.98] ${
                                    activeTab === 'channels' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Channels
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('activity')}
                                className={`flex-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-md transition-colors touch-manipulation active:scale-[0.98] flex items-center justify-center gap-1 ${
                                    activeTab === 'activity' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Activity size={12} />
                                Activity
                                {visualStudioEvents.length > 0 && (
                                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('direct')}
                                className={`flex-1 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-md transition-colors touch-manipulation active:scale-[0.98] ${
                                    activeTab === 'direct' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                DMs
                            </button>
                        </div>
                        
                        <div className="chat-search-container">
                            <Search className="chat-search-icon" />
                            <input
                                type="text"
                                className="chat-search-input"
                                placeholder={activeTab === 'activity' ? 'Search activity...' : 'Search channels'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Activity Tab Content */}
                    {activeTab === 'activity' && (
                        <div className="flex-1 overflow-y-auto px-2">
                            {visualStudioEvents.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No recent activity</p>
                                    <p className="text-xs mt-1">Visual Studio events will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {visualStudioEvents.map((event, i) => (
                                        <div key={i} className="p-3 bg-white rounded-lg border border-gray-100 hover:border-purple-200 transition-colors">
                                            <div className="flex items-start gap-2">
                                                {event.type === 'visual_shared' && <ImageIcon size={14} className="text-purple-500 mt-0.5" />}
                                                {event.type === 'user_joined' && <Users size={14} className="text-green-500 mt-0.5" />}
                                                {event.type === 'collab_started' && <Sparkles size={14} className="text-amber-500 mt-0.5" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-gray-700">
                                                        <strong>{event.userName}</strong>
                                                        {event.type === 'visual_shared' && ' shared a creation'}
                                                        {event.type === 'user_joined' && ' joined collaborative mode'}
                                                        {event.type === 'collab_started' && ' started a new session'}
                                                    </p>
                                                    <span className="text-xs text-gray-400">{formatEventTime(event.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Active Collaborators */}
                            {activeCollaborators.length > 0 && (
                                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users size={14} className="text-purple-600" />
                                        <span className="text-xs font-semibold text-purple-700">Active Now</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeCollaborators.map(user => (
                                            <div key={user.id} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full text-xs">
                                                <div className="w-4 h-4 rounded-full bg-green-400" />
                                                <span className="font-medium">{user.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Channels Tab Content */}
                    {activeTab === 'channels' && (
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
                                <>
                                    {/* Pinned Channels */}
                                    {pinnedRoomsList.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center gap-1 px-2 mb-2 text-xs font-semibold text-gray-400 uppercase">
                                                <Pin size={10} />
                                                Pinned
                                            </div>
                                            {pinnedRoomsList.map(room => (
                                                <button
                                                    type="button"
                                                    key={room.id}
                                                    className={`chat-channel-item group w-full text-left ${selectedThreadId === room.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedThreadId(room.id)}
                                                >
                                                    {getRoomIcon(room)}
                                                    <span className="flex-1 truncate">{room.name}</span>
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={(e) => { e.stopPropagation(); togglePin(room.id); }}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(room.id); } }}
                                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-200 rounded transition-opacity min-w-[36px] min-h-[36px] flex items-center justify-center"
                                                    >
                                                        <Pin size={12} className="text-amber-500" />
                                                    </span>
                                                    {room.unread_count && room.unread_count > 0 && (
                                                        <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                                                            {room.unread_count}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* All Channels */}
                                    <div className="mb-2 px-2 text-xs font-semibold text-gray-400 uppercase">
                                        Channels
                                    </div>
                                    {unpinnedRoomsList.map(room => (
                                        <button
                                            type="button"
                                            key={room.id}
                                            className={`chat-channel-item group w-full text-left ${selectedThreadId === room.id ? 'active' : ''}`}
                                            onClick={() => setSelectedThreadId(room.id)}
                                        >
                                            {getRoomIcon(room)}
                                            <span className="flex-1 truncate">{room.name}</span>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); togglePin(room.id); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(room.id); } }}
                                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-200 rounded transition-opacity min-w-[36px] min-h-[36px] flex items-center justify-center"
                                            >
                                                <Pin size={12} className="text-gray-400" />
                                            </span>
                                            {room.unread_count && room.unread_count > 0 && (
                                                <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                                                    {room.unread_count}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {/* Direct Messages Tab */}
                    {activeTab === 'direct' && (
                        <div className="flex-1 overflow-y-auto px-2">
                            <div className="text-center py-8 text-gray-400">
                                <Users size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No direct messages yet</p>
                                <p className="text-xs mt-1">Start a conversation with a collaborator</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'channels' && (isCreatingRoom ? (
                        <div className="p-3 border-t border-gray-200 bg-white">
                            <input
                                type="text"
                                placeholder="Channel name..."
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateRoom();
                                    }
                                }}
                                className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                autoFocus
                                style={{ fontSize: '16px' }} /* Prevent iOS zoom */
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleCreateRoom();
                                    }}
                                    disabled={!newRoomName.trim()}
                                    className="flex-1 px-3 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 active:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold min-h-[44px]"
                                >
                                    Create
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsCreatingRoom(false);
                                        setNewRoomName('');
                                    }}
                                    className="flex-1 px-3 py-2 text-sm border-2 border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-semibold min-h-[44px]"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsCreatingRoom(true);
                            }}
                            className="chat-new-channel-btn flex items-center justify-center gap-2 min-h-[48px] active:scale-95 transition-transform"
                        >
                            <Plus size={16} />
                            New channel
                        </button>
                    ))}
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
                                <p className="text-sm">Select a channel to start chatting</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;
