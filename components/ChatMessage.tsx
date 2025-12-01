import React from 'react';
import { ChatMessage as ChatMessageType } from '../services/chatService';

interface ChatMessageProps {
    message: ChatMessageType;
    isOwn: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isOwn }) => {
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getAvatarUrl = () => {
        if (message.user?.avatar_url) {
            return message.user.avatar_url;
        }
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.user_id}`;
    };

    return (
        <div className={`chat-message ${isOwn ? 'own' : 'other'}`}>
            {!isOwn && (
                <div className="chat-message-avatar">
                    <img src={getAvatarUrl()} alt={message.user?.display_name || 'User'} />
                </div>
            )}
            <div className="chat-message-content">
                {!isOwn && (
                    <div className="chat-message-author">
                        {message.user?.display_name || 'Anonymous'}
                    </div>
                )}
                <div className="chat-message-bubble">
                    <p>{message.content}</p>
                </div>
                <div className="chat-message-time">
                    {formatTime(message.created_at)}
                </div>
            </div>
        </div>
    );
};

export default ChatMessage;
