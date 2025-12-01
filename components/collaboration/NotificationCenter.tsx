// ==============================================================================
// GENESIS NOTIFICATION CENTER COMPONENT
// ==============================================================================
// Beautiful notification dropdown with grouping, actions, and real-time updates
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    BellOff,
    Check,
    CheckCheck,
    Trash2,
    Settings,
    Radio,
    Trophy,
    Heart,
    MessageCircle,
    Users,
    Sparkles,
    TrendingUp,
    BookOpen,
    X,
    Clock
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { Notification, NotificationType, NOTIFICATION_ICONS } from '../../types/advanced';
import { useAuth } from '../../contexts/AuthContext';

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
    isOpen,
    onClose,
    anchorRef
}) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch notifications
    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            setLoading(true);
            const data = await notificationService.getNotifications({
                unreadOnly: filter === 'unread',
                limit: 50
            });
            setNotifications(data);
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
            setLoading(false);
        };

        fetchNotifications();

        // Subscribe to real-time updates
        const setupSubscription = async () => {
            await notificationService.subscribeToNotifications((newNotification) => {
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
            });
        };

        setupSubscription();

        return () => {
            notificationService.unsubscribe();
        };
    }, [user, filter]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (anchorRef?.current && anchorRef.current.contains(event.target as Node)) {
                    return;
                }
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, anchorRef]);

    const handleMarkAsRead = async (notificationId: string) => {
        await notificationService.markAsRead(notificationId);
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAllAsRead = async () => {
        await notificationService.markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const handleDelete = async (notificationId: string) => {
        await notificationService.deleteNotification(notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleClearAll = async () => {
        await notificationService.clearAll();
        setNotifications([]);
        setUnreadCount(0);
    };

    const getNotificationIcon = (type: NotificationType) => {
        const iconMap: Record<string, React.ReactNode> = {
            broadcast_live: <Radio className="w-4 h-4 text-red-500" />,
            challenge: <Trophy className="w-4 h-4 text-yellow-500" />,
            challenge_new: <Sparkles className="w-4 h-4 text-purple-500" />,
            challenge_won: <Trophy className="w-4 h-4 text-yellow-500" />,
            reaction: <Heart className="w-4 h-4 text-pink-500" />,
            comment: <MessageCircle className="w-4 h-4 text-blue-500" />,
            follow: <Users className="w-4 h-4 text-green-500" />,
            remix: <Sparkles className="w-4 h-4 text-purple-500" />,
            trend_alert: <TrendingUp className="w-4 h-4 text-orange-500" />,
            insight: <TrendingUp className="w-4 h-4 text-cyan-500" />,
            mentorship_request: <BookOpen className="w-4 h-4 text-indigo-500" />,
            mentorship_accepted: <BookOpen className="w-4 h-4 text-green-500" />,
        };

        return iconMap[type] || <Bell className="w-4 h-4 text-gray-400" />;
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'border-l-red-500';
            case 'high': return 'border-l-orange-500';
            case 'normal': return 'border-l-blue-500';
            default: return 'border-l-gray-500';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={containerRef}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="absolute right-0 top-12 w-96 max-h-[600px] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleMarkAllAsRead}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title="Mark all as read"
                            >
                                <CheckCheck className="w-4 h-4 text-gray-400" />
                            </button>
                            <button
                                onClick={() => {/* Open settings */}}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title="Notification settings"
                            >
                                <Settings className="w-4 h-4 text-gray-400" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="px-4 py-2 flex gap-2 border-b border-white/5">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                filter === 'all'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                filter === 'unread'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            Unread
                        </button>
                    </div>

                    {/* Notification list */}
                    <div className="overflow-y-auto max-h-[420px] custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full"
                                />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <BellOff className="w-12 h-12 mb-3 opacity-50" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <motion.div layout>
                                {notifications.map((notification, index) => (
                                    <motion.div
                                        key={notification.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`
                                            group px-4 py-3 border-l-2 hover:bg-white/5 transition-all cursor-pointer
                                            ${!notification.is_read ? 'bg-purple-500/5' : ''}
                                            ${getPriorityColor(notification.priority)}
                                        `}
                                        onClick={() => {
                                            handleMarkAsRead(notification.id);
                                            if (notification.action_url) {
                                                window.location.href = notification.action_url;
                                            }
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className="mt-0.5 p-2 bg-white/5 rounded-lg">
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-medium text-white text-sm truncate">
                                                        {notification.title}
                                                    </p>
                                                    {!notification.is_read && (
                                                        <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Clock className="w-3 h-3 text-gray-500" />
                                                    <span className="text-xs text-gray-500">
                                                        {formatTimeAgo(notification.created_at)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!notification.is_read && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkAsRead(notification.id);
                                                        }}
                                                        className="p-1.5 hover:bg-white/10 rounded-lg"
                                                        title="Mark as read"
                                                    >
                                                        <Check className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(notification.id);
                                                    }}
                                                    className="p-1.5 hover:bg-red-500/20 rounded-lg"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-white/10 flex justify-between items-center">
                            <button
                                onClick={handleClearAll}
                                className="text-sm text-red-400 hover:text-red-300 transition-colors"
                            >
                                Clear all
                            </button>
                            <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                                View all notifications
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Notification Bell Button Component
interface NotificationBellProps {
    onClick: () => void;
    unreadCount?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
    onClick,
    unreadCount = 0
}) => {
    return (
        <button
            onClick={onClick}
            className="relative p-2 hover:bg-white/10 rounded-xl transition-all group"
            title="Notifications"
        >
            <Bell className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            {unreadCount > 0 && (
                <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1"
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
            )}
        </button>
    );
};

export default NotificationCenter;
