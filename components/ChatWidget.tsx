import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatPanel from './ChatPanel';
import { UserProfile } from '../services/profileService';
import './ChatWidget.css';

interface ChatWidgetProps {
    userProfile: UserProfile | null;
    onCollaborativeTrigger?: () => void;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ userProfile, onCollaborativeTrigger }) => {
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
