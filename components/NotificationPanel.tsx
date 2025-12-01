import React from 'react';
import { Bell, MessageCircle, Heart, UserPlus, X, Check } from 'lucide-react';
import { UserNotification } from '../types';

interface NotificationPanelProps {
    notifications: UserNotification[];
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onClose
}) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'new_message':
                return <MessageCircle className="w-5 h-5" />;
            case 'reaction':
                return <Heart className="w-5 h-5" />;
            case 'invitation':
                return <UserPlus className="w-5 h-5" />;
            default:
                return <Bell className="w-5 h-5" />;
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'new_message':
                return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
            case 'reaction':
                return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';
            case 'invitation':
                return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
            default:
                return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="absolute top-full right-0 mt-2 w-96 max-h-[500px] bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl border border-gray-200 dark:border-[#333333] overflow-hidden animate-fadeIn z-50">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-[#333333] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-coral-burst" />
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        Notifications
                    </h3>
                    {unreadCount > 0 && (
                        <span className="bg-coral-burst text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Actions */}
            {unreadCount > 0 && (
                <div className="p-3 border-b border-gray-200 dark:border-[#333333]">
                    <button
                        onClick={onMarkAllAsRead}
                        className="text-sm text-coral-burst hover:text-coral-hover font-medium flex items-center gap-1"
                    >
                        <Check className="w-4 h-4" />
                        Mark all as read
                    </button>
                </div>
            )}

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-96">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-100 dark:border-[#2D2D2D] hover:bg-gray-50 dark:hover:bg-[#2D2D2D] transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                }`}
                            onClick={() => !notification.read && onMarkAsRead(notification.id)}
                        >
                            <div className="flex gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(notification.type)}`}>
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                                            {notification.title}
                                        </h4>
                                        {!notification.read && (
                                            <div className="w-2 h-2 bg-coral-burst rounded-full flex-shrink-0 mt-1" />
                                        )}
                                    </div>
                                    {notification.body && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                            {notification.body}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                        {formatTime(notification.created_at)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
