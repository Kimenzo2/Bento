import { IcoWand } from './IconscoutIcons';
import { Camera, Palette, User, Users } from 'lucide-react';
import type React from 'react';
import { Button } from '@components/ui/button';

interface MobileBottomNavProps {
  activeTab: 'character' | 'scene' | 'style' | 'chat';
  onTabChange: (tab: 'character' | 'scene' | 'style' | 'chat') => void;
  unreadCount?: number;
  isCollaborativeMode?: boolean;
  onModeToggle?: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  isCollaborativeMode = false,
  onModeToggle,
}) => {
  const tabs = [
    { id: 'character' as const, label: 'Character', icon: User },
    { id: 'scene' as const, label: 'Scene', icon: Camera },
    { id: 'style' as const, label: 'Style', icon: Palette },
    // { id: 'chat' as const, label: 'Chat', icon: MessageCircle } // HIDDEN FOR SIMPLICITY
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden mobile-bottom-nav"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* Main Navigation Bar */}
      <div className="mx-2 mb-1 bg-charcoal-soft/95  rounded-2xl border border-white/10 p-2 flex items-center justify-between relative overflow-hidden">
        {/* Optional Mode Toggle Button */}
        {onModeToggle && (
          <Button
            variant="ghost"
            onClick={onModeToggle}
            className={`
                            flex flex-col gap-0.5 w-14 h-12
                            ${
                              isCollaborativeMode
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-coral-burst/20 text-coral-burst'
                            }
                        `}
            aria-label={isCollaborativeMode ? 'Switch to Individual' : 'Switch to Collaborative'}
          >
            {isCollaborativeMode ? (
              <Users size={18} strokeWidth={2} />
            ) : (
              <IcoWand width={18} height={18} />
            )}
            <span className="text-[8px] font-medium">
              {isCollaborativeMode ? 'Collab' : 'Solo'}
            </span>
          </Button>
        )}

        {/* Tab Buttons */}
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Button
              variant="ghost"
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                                relative flex flex-col gap-0.5 flex-1 h-12 min-h-[52px]
                                ${isActive ? 'bg-surface/10 text-gold-sunshine' : 'text-cocoa-light/60 active:text-white active:bg-surface/5'}
                            `}
              aria-label={tab.label}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Icon width={20} height={20}
                  className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-glow' : ''}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {/* HIDDEN FOR SIMPLICITY
                                {tab.id === 'chat' && unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1.5 bg-coral-burst text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-charcoal-soft">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                                */}
              </div>
              <span
                className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}
              >
                {tab.label}
              </span>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute bottom-0.5 w-1 h-1 bg-gold-sunshine rounded-full" />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;
