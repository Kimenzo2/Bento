import React from 'react';
import { User, Camera, Palette, MessageCircle } from 'lucide-react';

interface MobileBottomNavProps {
    activeTab: 'character' | 'scene' | 'style' | 'chat';
    onTabChange: (tab: 'character' | 'scene' | 'style' | 'chat') => void;
    unreadCount?: number;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange, unreadCount = 0 }) => {
    const tabs = [
        { id: 'character' as const, label: 'Character', icon: User },
        { id: 'scene' as const, label: 'Scene', icon: Camera },
        { id: 'style' as const, label: 'Style', icon: Palette },
        { id: 'chat' as const, label: 'Chat', icon: MessageCircle }
    ];

    return (
        <div className="fixed bottom-6 left-4 right-4 z-50 md:hidden">
            <div className="bg-charcoal-soft/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-2 flex items-center justify-between relative overflow-hidden">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                                relative flex flex-col items-center justify-center gap-1 flex-1 h-14 rounded-xl transition-all duration-300
                                ${isActive ? 'bg-white/10 text-gold-sunshine' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                            `}
                            aria-label={tab.label}
                        >
                            <div className="relative">
                                <Icon
                                    size={22}
                                    className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-glow' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                {tab.id === 'chat' && unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-coral-burst text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-charcoal-soft shadow-sm animate-bounce">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-70'}`}>
                                {tab.label}
                            </span>

                            {/* Active Glow Dot */}
                            {isActive && (
                                <div className="absolute bottom-1 w-1 h-1 bg-gold-sunshine rounded-full shadow-[0_0_8px_2px_rgba(252,163,17,0.5)]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileBottomNav;
