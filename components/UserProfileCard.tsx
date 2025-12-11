import React from 'react';
import { User, Mail, Circle } from 'lucide-react';

interface UserProfileCardProps {
    user: {
        id: string;
        display_name?: string;
        email: string;
        avatar_url?: string;
        status?: 'online' | 'offline' | 'away';
        bio?: string;
    };
    onClose: () => void;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, onClose }) => {
    const statusColors = {
        online: 'bg-green-500',
        offline: 'bg-gray-400',
        away: 'bg-yellow-500'
    };

    const statusText = {
        online: 'Online',
        offline: 'Offline',
        away: 'Away'
    };

    return (
        <div className="absolute z-50 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl border border-gray-200 dark:border-[#333333] p-4 w-72 animate-fadeIn">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
                ✕
            </button>

            {/* Avatar and Name */}
            <div className="flex items-start gap-3 mb-3">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-[#2D2D2D]">
                        <img
                            src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                            alt={user.display_name || user.email}
                            className="w-full h-full object-cover scale-110"
                        />
                    </div>
                    {user.status && (
                        <div className={`absolute bottom-0 right-0 w-4 h-4 ${statusColors[user.status]} rounded-full border-2 border-white dark:border-[#1A1A1A]`} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                        {user.display_name || 'Anonymous'}
                    </h3>
                    {user.status && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Circle className={`w-2 h-2 ${statusColors[user.status]}`} />
                            {statusText[user.status]}
                        </div>
                    )}
                </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <Mail className="w-4 h-4" />
                <span className="truncate">{user.email}</span>
            </div>

            {/* Bio */}
            {user.bio && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-[#2D2D2D] rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{user.bio}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-coral-burst text-white rounded-lg text-sm font-medium hover:bg-coral-hover transition-colors">
                    Send Message
                </button>
                <button className="px-3 py-2 bg-gray-100 dark:bg-[#2D2D2D] text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#3D3D3D] transition-colors">
                    <User className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default UserProfileCard;
