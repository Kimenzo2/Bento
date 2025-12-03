import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';
import { User } from './types';

interface MembersSidebarProps {
    onlineUsers: User[];
    offlineUsers: User[];
}

const MembersSidebar: React.FC<MembersSidebarProps> = ({
    onlineUsers,
    offlineUsers,
}) => {
    const renderUser = (user: User, isOnline: boolean = true) => {
        const isAI = user.id === 'ai-genesis';
        
        return (
            <motion.div
                key={user.id}
                className="chat-member-item"
                whileHover={{ x: 4 }}
                transition={{ duration: 0.15 }}
            >
                <div className="chat-member-avatar">
                    <img
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                        alt={user.displayName}
                    />
                    <div className={`chat-member-status ${isOnline ? user.status : 'offline'}`} />
                </div>
                <div className="chat-member-info">
                    <div className="chat-member-name flex items-center gap-1">
                        {user.displayName}
                        {isAI && (
                            <Sparkles size={12} className="text-[var(--chat-coral-burst)]" />
                        )}
                    </div>
                    {user.customStatus && (
                        <div className="chat-member-custom-status">
                            {user.customStatus}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="chat-members-sidebar">
            {/* Online Users */}
            <div className="chat-members-section">
                <div className="chat-members-section-title">
                    Online — {onlineUsers.length}
                </div>
                {onlineUsers.map((user) => renderUser(user, true))}
            </div>

            {/* Offline Users */}
            {offlineUsers.length > 0 && (
                <div className="chat-members-section">
                    <div className="chat-members-section-title">
                        Offline — {offlineUsers.length}
                    </div>
                    {offlineUsers.map((user) => renderUser(user, false))}
                </div>
            )}
        </div>
    );
};

export default MembersSidebar;
