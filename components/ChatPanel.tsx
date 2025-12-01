import React, { useState } from 'react';
import { X, Search, MessageSquare } from 'lucide-react';
import ChatConversation from './ChatConversation';
import { UserProfile } from '../services/profileService';

interface ChatPanelProps {
    userProfile: UserProfile | null;
    onClose: () => void;
    onUnreadCountChange: (count: number) => void;
    onCollaborativeTrigger?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ userProfile, onClose, onUnreadCountChange, onCollaborativeTrigger }) => {
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

    return (
        <div className="flex w-full h-full bg-white">
            {/* LEFT COLUMN: SIDEBAR */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <div className="chat-sidebar-title">
                        <span>Project chat • Genesis</span>
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

            {/* RIGHT COLUMN: MAIN CHAT AREA */}
            <div className="chat-main-area">
                {/* Header */}
                <div className="chat-main-header">
                    <div className="chat-avatars-group">
                        {/* Display current user's avatar */}
                        {getUserAvatar()}
                        {/* Mock avatars for other users */}
                        <div className="chat-avatar"></div>
                        <div className="chat-avatar"></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="chat-new-msg-btn">
                            New message
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden relative">
                    {selectedThreadId ? (
                        <ChatConversation
                            threadId={selectedThreadId}
                            userProfile={userProfile}
                            isMobile={false}
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
        </div>
    );
};

export default ChatPanel;
