import React, { useState } from 'react';
import { X, Search, MessageSquare, ArrowLeft } from 'lucide-react';
import ChatConversation from './ChatConversation';
import { UserProfile } from '../services/profileService';

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

    // Mock channels for the wireframe look
    const channels = [
        { id: 'general', name: 'general' },
        { id: 'launch', name: 'launch' },
        { id: 'design-feedback', name: 'design-feedback' },
        { id: 'random', name: 'random' }
    ];

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
                                <button onClick={onClose} className="p-2">
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
                        {channels.map(channel => (
                            <div
                                key={channel.id}
                                className={`chat-channel-item ${selectedThreadId === channel.id ? 'active' : ''}`}
                                onClick={() => setSelectedThreadId(channel.id)}
                            >
                                <span className="chat-channel-hash">#</span>
                                <span>{channel.name}</span>
                            </div>
                        ))}
                    </div>

                    <button className="chat-new-channel-btn">
                        New channel
                    </button>
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
