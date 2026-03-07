import { IcoZap } from './IconscoutIcons';
import { BookOpen, Image, ImageIcon, LayoutDashboard, Menu, Moon, PenTool, Sun, Trophy, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUserSettings } from '../hooks/useUserSettings';
import { getUserProfile, type UserProfile } from '../services/profileService';
import { AppMode, UserTier, type GamificationState } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface NavigationProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  gameState?: GamificationState;
}

const Navigation: React.FC<NavigationProps> = ({ currentMode, setMode, gameState }) => {
  const { user, signOut: _signOut } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { displayName, avatarUrl } = useUserSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  // Fetch user profile to show real tier
  React.useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const profile = await getUserProfile();
        if (!cancelled) setUserProfile(profile);
      } catch (err) {
        console.error('[Navigation] Failed to fetch profile:', err);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user]);

  const currentUserTier = userProfile?.user_tier || UserTier.SPARK;

  // Get tier display info
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case UserTier.CREATOR:
        return { color: 'bg-blue-500', label: 'Creator' };
      case UserTier.STUDIO:
        return { color: 'bg-linear-to-r from-coral-burst to-gold-sunshine', label: 'Studio' };
      case UserTier.EMPIRE:
        return { color: 'bg-purple-600', label: 'Empire' };
      default:
        return { color: 'bg-gray-400', label: 'Spark' };
    }
  };

  const tierBadge = getTierBadge(currentUserTier);

  const menuItems = [
    { mode: AppMode.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
    { mode: AppMode.CREATION, icon: PenTool, label: 'Create' },
    { mode: AppMode.EDITOR, icon: BookOpen, label: 'Editor' },
    { mode: AppMode.VISUAL_STUDIO, icon: ImageIcon, label: 'Visual Studio' },
  ];

  const handleModeChange = (mode: AppMode) => {
    setMode(mode);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 w-full z-60 px-4 md:px-12 flex items-center justify-between transition-all duration-300
        bg-cream-base/85 backdrop-blur-md border-b-2 border-peach-soft"
        style={{ paddingTop: 'calc(0.5rem + var(--safe-area-inset-top))', paddingBottom: '0.5rem' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 group cursor-pointer"
          onClick={() => handleModeChange(AppMode.DASHBOARD)}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-peach-soft group-hover:scale-105 transition-transform">
            <img src="/genesis-icon.jpg" alt="Genesis" className="w-full h-full object-cover" />
          </div>
          <span className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft tracking-tight">
            Genesis
          </span>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden lg:flex items-center gap-1 bg-surface/50 p-1.5 rounded-full border border-peach-soft/50 backdrop-blur-sm">
          {menuItems.map((item) => (
            <Button
              key={item.mode}
              variant="ghost"
              onClick={() => handleModeChange(item.mode)}
              className={`group flex px-4 py-2 rounded-full font-heading font-medium
                ${
                  currentMode === item.mode
                    ? 'bg-linear-to-r from-gold-sunshine to-coral-burst text-white transform scale-105'
                    : 'text-cocoa-light hover:text-coral-burst hover:bg-cream-soft'
                }`}
            >
              <item.icon className={`w-4 h-4 group-hover:animate-nav-dance ${currentMode === item.mode ? 'text-white' : ''}`} />
              <span>{item.label}</span>
            </Button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Light/Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="rounded-full w-10 h-10 bg-surface/50 border-peach-soft hover:bg-surface"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-gold-sunshine" />
            ) : (
              <Moon className="w-5 h-5 text-charcoal-soft" />
            )}
          </Button>

          {/* Tier Badge */}
          <Button
            variant="outline"
            onClick={() => handleModeChange(AppMode.GAMIFICATION)}
            className="hidden md:flex px-3 py-1.5 bg-surface border border-peach-soft hover:border-gold-sunshine"
            title={`You are on the ${tierBadge.label} plan`}
          >
            <Badge
              variant={currentUserTier === UserTier.STUDIO ? 'gold' : currentUserTier === UserTier.EMPIRE ? 'primary' : currentUserTier === UserTier.CREATOR ? 'default' : 'secondary'}
              className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {tierBadge.label.charAt(0)}
            </Badge>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-cocoa-light uppercase leading-none">
                Plan
              </span>
              <span className="text-xs font-bold text-charcoal-soft leading-none">
                {tierBadge.label}
              </span>
            </div>
          </Button>

          {/* Upgrade Button - Always visible for Spark tier */}
          {currentUserTier === UserTier.SPARK && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleModeChange(AppMode.PRICING)}
              className="rounded-full ring-2 ring-gold-sunshine/40"
              aria-label="Upgrade"
            >
              <IcoZap className="w-4 h-4 fill-white" />
              Upgrade
            </Button>
          )}

          {/* Creator Button - Always visible */}
          <Button
            variant="outline"
            onClick={() => {
              console.warn('Creator button clicked');
              console.warn('User:', user);
              console.warn('Navigating to SETTINGS');
              handleModeChange(AppMode.SETTINGS);
            }}
            className="flex p-2 md:pl-2 md:pr-4 md:py-2 rounded-full bg-surface border border-peach-soft hover:border-coral-burst/30 group min-h-11"
            aria-label="Account"
          >
            <Avatar className="w-8 h-8 group-hover:scale-110 transition-transform">
              <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
              <AvatarFallback className="bg-cream-base text-coral-burst">
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <span className="font-heading font-medium text-charcoal-soft text-sm hidden lg:block">
              {displayName}
            </span>
          </Button>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden min-h-11 text-charcoal-soft hover:text-coral-burst"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-cream-base/95 backdrop-blur-xl transition-transform duration-300 pt-[100px] px-6 pb-[calc(1.5rem+var(--safe-area-inset-bottom))] lg:hidden flex flex-col gap-4 overflow-y-auto ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <Button
          variant="primary"
          size="xl"
          onClick={() => handleModeChange(AppMode.PRICING)}
          className="w-full rounded-2xl text-lg mb-4"
          aria-label="Upgrade to Premium"
        >
          <IcoZap className="w-6 h-6 fill-white" />
          Upgrade to Premium
        </Button>

        <Button
          variant="outline"
          onClick={() => handleModeChange(AppMode.GAMIFICATION)}
          className="w-full flex justify-between px-6 py-4 bg-surface border border-peach-soft rounded-2xl min-h-16"
          aria-label="Open gamification"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-sunshine text-white flex items-center justify-center font-bold text-lg">
              {gameState?.level ?? 1}
            </div>
            <div className="text-left">
              <div className="font-bold text-charcoal-soft">{gameState?.levelTitle ?? 'Aspiring Author'}</div>
              <div className="text-xs text-cocoa-light">{gameState?.currentXP ?? 0} / {gameState?.nextLevelXP ?? 100} XP</div>
            </div>
          </div>
          <Trophy className="w-6 h-6 text-gold-sunshine" />
        </Button>

        {menuItems.map((item) => (
          <Button
            key={item.mode}
            variant="ghost"
            onClick={() => handleModeChange(item.mode)}
            className={`group flex gap-4 px-6 py-4 rounded-2xl font-heading text-lg min-h-14
              ${
                currentMode === item.mode
                  ? 'bg-surface text-coral-burst border border-peach-soft'
                  : 'text-cocoa-light hover:bg-surface/50'
              }`}
          >
            <item.icon
              className={`w-6 h-6 group-hover:animate-nav-dance ${currentMode === item.mode ? 'text-coral-burst' : 'text-cocoa-light'}`}
            />
            <span>{item.label}</span>
            {currentMode === item.mode && (
              <div className="ml-auto w-2 h-2 rounded-full bg-gold-sunshine"></div>
            )}
          </Button>
        ))}
      </div>
    </>
  );
};

export default Navigation;
