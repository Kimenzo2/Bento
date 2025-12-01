// ==============================================================================
// PRESENCE INDICATOR COMPONENT
// ==============================================================================
// Shows online users with status indicators and floating avatars
// ==============================================================================

import React, { useState } from 'react';
import { PresenceUser, CollaboratorStatus } from '../../types/collaboration';
import { Users, Circle, Loader2, Pencil, Check, Coffee } from 'lucide-react';

interface PresenceIndicatorProps {
    users: PresenceUser[];
    currentUserId?: string;
    maxVisible?: number;
    size?: 'sm' | 'md' | 'lg';
    showStatus?: boolean;
    showTooltip?: boolean;
    onClick?: () => void;
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
    users,
    currentUserId,
    maxVisible = 5,
    size = 'md',
    showStatus = true,
    showTooltip = true,
    onClick,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Size configurations
    const sizeConfig = {
        sm: { avatar: 'w-6 h-6', status: 'w-2 h-2', text: 'text-xs', ring: 'ring-1' },
        md: { avatar: 'w-8 h-8', status: 'w-3 h-3', text: 'text-sm', ring: 'ring-2' },
        lg: { avatar: 'w-10 h-10', status: 'w-4 h-4', text: 'text-base', ring: 'ring-2' },
    };

    const config = sizeConfig[size];

    // Filter out current user and sort by status
    const otherUsers = users.filter(u => u.user_id !== currentUserId);
    const sortedUsers = [...otherUsers].sort((a, b) => {
        const statusOrder: Record<CollaboratorStatus, number> = {
            'generating': 0,
            'typing': 1,
            'idle': 2,
            'done': 3,
            'away': 4,
        };
        return statusOrder[a.status] - statusOrder[b.status];
    });

    const visibleUsers = sortedUsers.slice(0, maxVisible);
    const remainingCount = sortedUsers.length - maxVisible;

    const getStatusColor = (status: CollaboratorStatus): string => {
        switch (status) {
            case 'generating': return 'bg-purple-500';
            case 'typing': return 'bg-blue-500';
            case 'done': return 'bg-green-500';
            case 'idle': return 'bg-gray-400';
            case 'away': return 'bg-yellow-500';
            default: return 'bg-gray-400';
        }
    };

    const getStatusIcon = (status: CollaboratorStatus) => {
        switch (status) {
            case 'generating': return <Loader2 className="w-3 h-3 animate-spin" />;
            case 'typing': return <Pencil className="w-3 h-3" />;
            case 'done': return <Check className="w-3 h-3" />;
            case 'away': return <Coffee className="w-3 h-3" />;
            default: return null;
        }
    };

    const getStatusLabel = (status: CollaboratorStatus): string => {
        switch (status) {
            case 'generating': return 'Generating...';
            case 'typing': return 'Typing...';
            case 'done': return 'Just finished';
            case 'idle': return 'Online';
            case 'away': return 'Away';
            default: return 'Online';
        }
    };

    if (sortedUsers.length === 0) {
        return (
            <div className="flex items-center gap-2 text-gray-400">
                <Users className="w-4 h-4" />
                <span className={config.text}>Just you</span>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Stacked avatars */}
            <div 
                className="flex items-center cursor-pointer"
                onClick={() => onClick ? onClick() : setIsExpanded(!isExpanded)}
            >
                <div className="flex -space-x-2">
                    {visibleUsers.map((user, index) => (
                        <div
                            key={user.user_id}
                            className={`
                                relative ${config.avatar} rounded-full 
                                ${config.ring} ring-white
                                transition-transform hover:scale-110 hover:z-10
                            `}
                            style={{ zIndex: visibleUsers.length - index }}
                            title={showTooltip ? `${user.display_name} - ${getStatusLabel(user.status)}` : undefined}
                        >
                            <img
                                src={user.avatar_url}
                                alt={user.display_name}
                                className={`${config.avatar} rounded-full object-cover`}
                            />
                            
                            {/* Status indicator */}
                            {showStatus && (
                                <span className={`
                                    absolute -bottom-0.5 -right-0.5 
                                    ${config.status} rounded-full 
                                    ${getStatusColor(user.status)}
                                    ring-2 ring-white
                                    ${user.status === 'generating' ? 'animate-pulse' : ''}
                                `} />
                            )}
                        </div>
                    ))}
                    
                    {/* Overflow count */}
                    {remainingCount > 0 && (
                        <div className={`
                            ${config.avatar} rounded-full 
                            bg-gray-200 ${config.ring} ring-white
                            flex items-center justify-center
                            font-bold ${config.text} text-gray-600
                        `}>
                            +{remainingCount}
                        </div>
                    )}
                </div>

                {/* Online count label */}
                <span className={`ml-2 ${config.text} text-gray-500`}>
                    {sortedUsers.length} online
                </span>
            </div>

            {/* Expanded user list */}
            {isExpanded && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsExpanded(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 z-50 animate-fadeIn">
                        <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                            <div className="px-3 py-1 border-b border-gray-100 mb-1">
                                <span className="text-xs font-bold text-gray-400 uppercase">
                                    {sortedUsers.length} Collaborators Online
                                </span>
                            </div>
                            
                            {sortedUsers.map(user => (
                                <div
                                    key={user.user_id}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
                                >
                                    <div className="relative">
                                        <img
                                            src={user.avatar_url}
                                            alt={user.display_name}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                        <span className={`
                                            absolute -bottom-0.5 -right-0.5 
                                            w-3 h-3 rounded-full 
                                            ${getStatusColor(user.status)}
                                            ring-2 ring-white
                                        `} />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-charcoal-soft truncate">
                                            {user.display_name}
                                        </p>
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            {getStatusIcon(user.status)}
                                            <span>{getStatusLabel(user.status)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING CURSORS (for collaborative editing)
// ─────────────────────────────────────────────────────────────────────────────

interface CursorPosition {
    user_id: string;
    display_name: string;
    avatar_url: string;
    x: number;
    y: number;
    color: string;
}

interface FloatingCursorsProps {
    cursors: CursorPosition[];
    containerRef: React.RefObject<HTMLElement>;
}

export const FloatingCursors: React.FC<FloatingCursorsProps> = ({
    cursors,
    containerRef,
}) => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];

    return (
        <>
            {cursors.map((cursor, index) => (
                <div
                    key={cursor.user_id}
                    className="absolute pointer-events-none z-50 transition-all duration-75"
                    style={{
                        left: cursor.x,
                        top: cursor.y,
                        transform: 'translate(-2px, -2px)',
                    }}
                >
                    {/* Cursor arrow */}
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        style={{ color: cursor.color || colors[index % colors.length] }}
                    >
                        <path
                            d="M5 2L15 10L9 11L7 17L5 2Z"
                            fill="currentColor"
                            stroke="white"
                            strokeWidth="1.5"
                        />
                    </svg>
                    
                    {/* Name tag */}
                    <div
                        className="absolute top-4 left-3 px-1.5 py-0.5 rounded text-[10px] text-white font-medium whitespace-nowrap shadow-sm"
                        style={{ backgroundColor: cursor.color || colors[index % colors.length] }}
                    >
                        {cursor.display_name}
                    </div>
                </div>
            ))}
        </>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

interface TypingIndicatorProps {
    typingUsers: PresenceUser[];
    maxShow?: number;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
    typingUsers,
    maxShow = 3,
}) => {
    if (typingUsers.length === 0) return null;

    const visible = typingUsers.slice(0, maxShow);
    const remainingCount = typingUsers.length - maxShow;

    const getText = () => {
        if (typingUsers.length === 1) {
            return `${visible[0].display_name} is typing`;
        } else if (typingUsers.length <= maxShow) {
            const names = visible.map(u => u.display_name);
            return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing`;
        } else {
            const names = visible.map(u => u.display_name);
            return `${names.join(', ')} and ${remainingCount} more are typing`;
        }
    };

    return (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="flex -space-x-1">
                {visible.map(user => (
                    <img
                        key={user.user_id}
                        src={user.avatar_url}
                        alt={user.display_name}
                        className="w-5 h-5 rounded-full ring-2 ring-white"
                    />
                ))}
            </div>
            <span>{getText()}</span>
            <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
        </div>
    );
};

export default PresenceIndicator;
