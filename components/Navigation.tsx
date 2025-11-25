import React, { useState } from 'react';
import {
  LayoutDashboard,
  PenTool,
  BookOpen,
  Image as ImageIcon,
  Layout,
  Share,
  Settings,
  User,
  Menu,
  X,
  Trophy,
  Zap
} from 'lucide-react';
import { AppMode } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface NavigationProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  onSignIn: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentMode, setMode, onSignIn }) => {
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <nav className="fixed top-0 left-0 w-full h-[80px] z-50 px-4 md:px-12 flex items-center justify-between transition-all duration-300
        bg-cream-base/80 backdrop-blur-md border-b border-peach-soft shadow-soft-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => handleModeChange(AppMode.DASHBOARD)}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
            <span className="text-white font-heading font-bold text-xl">G</span>
          </div>
          <span className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft tracking-tight">
            Genesis
          </span>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden lg:flex items-center gap-1 bg-white/50 p-1.5 rounded-full border border-peach-soft/50 backdrop-blur-sm">
          {menuItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => handleModeChange(item.mode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-heading font-medium transition-all duration-300 text-sm
                ${currentMode === item.mode
                  ? 'bg-gradient-to-r from-gold-sunshine to-coral-burst text-white shadow-md transform scale-105'
                  : 'text-cocoa-light hover:text-coral-burst hover:bg-cream-soft'
                }`}
            >
              <item.icon className={`w-4 h-4 ${currentMode === item.mode ? 'text-white' : ''}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4">

          {/* Level Indicator */}
          <button
            onClick={() => handleModeChange(AppMode.GAMIFICATION)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-peach-soft hover:border-gold-sunshine transition-colors cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-gold-sunshine text-white flex items-center justify-center font-bold text-xs">3</div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold text-cocoa-light uppercase leading-none">Lvl</span>
              <span className="text-xs font-bold text-charcoal-soft leading-none">Rising</span>
            </div>
          </button>

          {/* Upgrade Button */}
          <button
            onClick={() => handleModeChange(AppMode.PRICING)}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-heading font-bold text-sm shadow-md hover:scale-105 transition-transform animate-pulse"
          >
            <Zap className="w-4 h-4 fill-white" />
            Upgrade
          </button>

          {/* Auth/Profile Button */}
          {user ? (
            <button
              onClick={() => handleModeChange(AppMode.SETTINGS)}
              className="flex items-center gap-2 p-1 pr-1 md:pl-2 md:pr-4 md:py-2 rounded-full bg-white border border-peach-soft hover:border-coral-burst/30 transition-colors shadow-soft-sm group"
            >
              <div className="w-8 h-8 rounded-full bg-cream-base flex items-center justify-center text-coral-burst group-hover:scale-110 transition-transform overflow-hidden">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <span className="font-heading font-medium text-charcoal-soft text-sm hidden lg:block">
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Profile'}
              </span>
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 p-1 pr-1 md:pl-2 md:pr-4 md:py-2 rounded-full bg-white border border-peach-soft hover:border-coral-burst/30 transition-colors shadow-soft-sm group"
            >
              <div className="w-8 h-8 rounded-full bg-cream-base flex items-center justify-center text-coral-burst group-hover:scale-110 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <span className="font-heading font-medium text-charcoal-soft text-sm hidden lg:block">Sign In</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-charcoal-soft hover:text-coral-burst transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      <div className={`fixed inset-0 z-40 bg-cream-base/95 backdrop-blur-xl transition-transform duration-300 pt-[100px] px-6 lg:hidden flex flex-col gap-4 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        <button
          onClick={() => handleModeChange(AppMode.PRICING)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-gold-sunshine to-coral-burst text-white rounded-2xl font-heading font-bold text-lg shadow-soft-md mb-4"
        >
          <Zap className="w-6 h-6 fill-white" />
          Upgrade to Premium
        </button>

        <button
          onClick={() => handleModeChange(AppMode.GAMIFICATION)}
          className="w-full flex items-center justify-between px-6 py-4 bg-white border border-peach-soft rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-sunshine text-white flex items-center justify-center font-bold text-lg shadow-sm">3</div>
            <div className="text-left">
              <div className="font-bold text-charcoal-soft">Rising Author</div>
              <div className="text-xs text-cocoa-light">1,250 / 2,000 XP</div>
            </div>
          </div>
          <Trophy className="w-6 h-6 text-gold-sunshine" />
        </button>

        {menuItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => handleModeChange(item.mode)}
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-heading font-bold text-lg transition-all
              ${currentMode === item.mode
                ? 'bg-white text-coral-burst shadow-soft-md border border-peach-soft'
                : 'text-cocoa-light hover:bg-white/50'
              }`}
          >
            <item.icon className={`w-6 h-6 ${currentMode === item.mode ? 'text-coral-burst' : 'text-cocoa-light'}`} />
            <span>{item.label}</span>
            {currentMode === item.mode && <div className="ml-auto w-2 h-2 rounded-full bg-gold-sunshine"></div>}
          </button>
        ))}
      </div>
    </>
  );
};

export default Navigation;
