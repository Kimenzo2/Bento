import {
  BookOpen,
  Image as ImageIcon,
  Layout,
  LayoutDashboard,
  PenTool,
  Settings,
  Share,
} from 'lucide-react';
import type React from 'react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode }) => {
  const menuItems = [
    { mode: AppMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
    { mode: AppMode.CREATION, icon: PenTool, label: 'Creation Canvas' },
    { mode: AppMode.EDITOR, icon: BookOpen, label: 'Smart Editor' },
    { mode: AppMode.VISUAL_STUDIO, icon: ImageIcon, label: 'Visual Studio' },
    { mode: AppMode.LAYOUT_LAB, icon: Layout, label: 'Layout Lab' },
    { mode: AppMode.EXPORT, icon: Share, label: 'Export Nexus' },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-20 md:w-64 bg-black/40 backdrop-blur-xl border-r border-glassBorder z-50 flex flex-col justify-between">
      <div>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple to-brand-cyan flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.5)]">
            <span className="text-white font-bold text-lg">G</span>
          </div>
          <span className="font-bold text-xl tracking-wide hidden md:block bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            GENESIS
          </span>
        </div>

        <nav className="mt-8 px-3 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => setMode(item.mode)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group
                ${
                  currentMode === item.mode
                    ? 'bg-white/10 text-brand-cyan shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-brand-cyan/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <item.icon
                className={`w-5 h-5 ${currentMode === item.mode ? 'text-brand-cyan' : 'group-hover:text-white'}`}
              />
              <span className="hidden md:block font-medium">{item.label}</span>
              {currentMode === item.mode && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-[0_0_10px_#22d3ee] hidden md:block"></div>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-glassBorder">
        <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <Settings className="w-5 h-5" />
          <span className="hidden md:block">System Config</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
