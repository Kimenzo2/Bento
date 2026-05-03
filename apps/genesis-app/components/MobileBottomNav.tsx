import { Camera, Palette, User } from 'lucide-react';
import type React from 'react';
import { Button } from '@components/ui/button';

interface MobileBottomNavProps {
  activeTab: 'character' | 'scene' | 'style';
  onTabChange: (tab: 'character' | 'scene' | 'style') => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'character' as const, label: 'Character', icon: User },
    { id: 'scene' as const, label: 'Scene', icon: Camera },
    { id: 'style' as const, label: 'Style', icon: Palette },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden mobile-bottom-nav"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-2 mb-1 bg-charcoal-soft/95 rounded-2xl border border-white/10 p-2 flex items-center justify-between relative overflow-hidden">
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
                <Icon
                  width={20}
                  height={20}
                  className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-glow' : ''}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}
              >
                {tab.label}
              </span>

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
