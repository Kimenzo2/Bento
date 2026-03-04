import { Circle, Mail, User } from 'lucide-react';
import type React from 'react';
import { Button } from './ui/button';

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
    away: 'bg-yellow-500',
  };

  const statusText = {
    online: 'Online',
    offline: 'Offline',
    away: 'Away',
  };

  return (
    <div className="absolute z-50 bg-surface dark:bg-[#1A1A1A] rounded-2xl border border-peach-soft p-4 w-72 animate-fadeIn">
      {/* Close button */}
      <Button
        onClick={onClose}
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 text-cocoa-light/60 hover:text-cocoa-light dark:hover:text-cocoa-light/60"
      >
        ✕
      </Button>

      {/* Avatar and Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-peach-soft/30 dark:bg-[#2D2D2D]">
            <img
              src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
              alt={user.display_name || user.email}
              className="w-full h-full object-cover scale-110"
            />
          </div>
          {user.status && (
            <div
              className={`absolute bottom-0 right-0 w-4 h-4 ${statusColors[user.status]} rounded-full border border-white dark:border-[#1A1A1A]`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-charcoal-soft dark:text-white truncate">
            {user.display_name || 'Anonymous'}
          </h3>
          {user.status && (
            <div className="flex items-center gap-1 text-sm text-cocoa-light dark:text-cocoa-light/60">
              <Circle className={`w-2 h-2 ${statusColors[user.status]}`} />
              {statusText[user.status]}
            </div>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="flex items-center gap-2 text-sm text-cocoa-light dark:text-cocoa-light/60 mb-3">
        <Mail className="w-4 h-4" />
        <span className="truncate">{user.email}</span>
      </div>

      {/* Bio */}
      {user.bio && (
        <div className="mb-3 p-3 bg-surface/50 dark:bg-[#2D2D2D] rounded-lg">
          <p className="text-sm text-cocoa-light dark:text-cocoa-light/60">{user.bio}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="default" size="sm" className="flex-1 px-3 py-2 bg-coral-burst text-white font-medium hover:bg-coral-hover">
          Send Message
        </Button>
        <Button variant="secondary" size="icon" className="px-3 py-2 bg-peach-soft/30 dark:bg-[#2D2D2D] text-cocoa-light dark:text-cocoa-light/60 font-medium hover:bg-peach-light/50 dark:hover:bg-[#3D3D3D]">
          <User className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default UserProfileCard;
