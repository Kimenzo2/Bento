import React from 'react';
import { User, Camera, Palette, MessageCircle, Users, Wand2 } from 'lucide-react';

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
    onModeToggle
}) => {
    const tabs = [
        { id: 'character' as const, label: 'Character', icon: User },
        { id: 'scene' as const, label: 'Scene', icon: Camera },
        { id: 'style' as const, label: 'Style', icon: Palette },
        // { id: 'chat' as const, label: 'Chat', icon: MessageCircle } // HIDDEN FOR SIMPLICITY
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden mobile-bottom-nav" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            {/* Main Navigation Bar */}
            <div className="mx-2 mb-1 bg-charcoal-soft/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-1.5 flex items-center justify-between relative overflow-hidden">
                {/* Optional Mode Toggle Button */}
                {onModeToggle && (
                    <button
                        onClick={onModeToggle}
                        className={`
                            flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-all duration-300
                            ${isCollaborativeMode 
                                ? 'bg-purple-500/20 text-purple-400' 
                                : 'bg-coral-burst/20 text-coral-burst'
                            }
                        `}
                        aria-label={isCollaborativeMode ? 'Switch to Individual' : 'Switch to Collaborative'}
                    >
                        {isCollaborativeMode ? (
                            <Users size={18} strokeWidth={2} />
                        ) : (
                            <Wand2 size={18} strokeWidth={2} />
                        )}
                        <span className="text-[8px] font-medium">
                            {isCollaborativeMode ? 'Collab' : 'Solo'}
                        </span>
                    </button>
                )}

                {/* Tab Buttons */}
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                                relative flex flex-col items-center justify-center gap-0.5 flex-1 h-12 rounded-xl transition-all duration-300
                                ${isActive ? 'bg-white/10 text-gold-sunshine' : 'text-gray-400 active:text-white active:bg-white/5'}
                            `}
                            aria-label={tab.label}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            <div className="relative">
                                <Icon
                                    size={20}
                                    className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-glow' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                {/* HIDDEN FOR SIMPLICITY
                                {tab.id === 'chat' && unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1.5 bg-coral-burst text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-charcoal-soft shadow-sm">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                                */}
                            </div>
                            <span className={`text-[10px] font-medium transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                                {tab.label}
                            </span>

                            {/* Active Indicator */}
                            {isActive && (
                                <div className="absolute bottom-0.5 w-1 h-1 bg-gold-sunshine rounded-full shadow-[0_0_8px_2px_rgba(252,163,17,0.5)]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileBottomNav;
