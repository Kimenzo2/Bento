import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatPanel from './ChatPanel';
import { UserProfile } from '../services/profileService';
import './ChatWidget.css';

interface VisualStudioEvent {
    type: 'visual_shared' | 'user_joined' | 'collab_started' | 'creation_liked';
    userId: string;
    userName: string;
    data?: any;
    timestamp: string;
}

interface ChatWidgetProps {
    userProfile: UserProfile | null;
    onCollaborativeTrigger?: () => void;
    visualStudioEvents?: VisualStudioEvent[];
    activeCollaborators?: { id: string; name: string; avatar?: string }[];
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ 
    userProfile, 
    onCollaborativeTrigger,
    visualStudioEvents = [],
    activeCollaborators = []
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const toggleChat = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="relative">
            {/* Expanded Chat Panel (Popup) */}
            {isExpanded && (
                <div className="chat-widget-panel">
                    <ChatPanel
                        userProfile={userProfile}
                        onClose={toggleChat}
                        onUnreadCountChange={setUnreadCount}
                        onCollaborativeTrigger={onCollaborativeTrigger}
                        visualStudioEvents={visualStudioEvents}
                        activeCollaborators={activeCollaborators}
                    />
                </div>
            )}

            {/* Embedded Chat Button (Collapsed State) */}
            {!isExpanded && (
                <button
                    className="chat-widget-button"
                    onClick={toggleChat}
                    aria-label="Open chat"
                >
                    <div className="chat-widget-label">
                        <MessageCircle size={20} className="chat-widget-icon" />
                        <span>Chat</span>
                        {activeCollaborators.length > 0 && (
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <span className="chat-widget-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </button>
            )}
        </div>
    );
};

export default ChatWidget;
