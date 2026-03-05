import { IcoStar, IcoZap } from './IconscoutIcons';
import { motion } from 'framer-motion';
import { Bug, ChevronRight, Gift, Wrench } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
  changes: {
    type: 'feature' | 'improvement' | 'fix' | 'breaking';
    title: string;
    description?: string;
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.5.0',
    date: 'December 4, 2025',
    highlights: [
      'Dark mode as default in chat',
      'Interactive notifications system',
      'Improved mobile experience',
    ],
    changes: [
      {
        type: 'feature',
        title: 'Dark Mode Default',
        description: 'Chat system now defaults to dark mode for better reading experience',
      },
      {
        type: 'feature',
        title: 'Interactive Notifications',
        description: 'Click notifications to navigate directly to content',
      },
      {
        type: 'feature',
        title: 'User Profile Links',
        description: 'Click any username to view their profile',
      },
      {
        type: 'feature',
        title: 'Create Channel Modal',
        description: 'Interactive plus button to create new channels',
      },
      {
        type: 'feature',
        title: 'Project Dropdown Menu',
        description: 'Quick access to project settings and actions',
      },
      {
        type: 'improvement',
        title: 'Skeleton Loaders',
        description: 'Beautiful loading states throughout the app',
      },
      {
        type: 'improvement',
        title: 'Keyboard Shortcuts',
        description: 'New discoverable shortcuts panel',
      },
      {
        type: 'fix',
        title: 'PWA Installation',
        description: 'Fixed issues preventing app installation on mobile and desktop',
      },
    ],
  },
  {
    version: '2.4.0',
    date: 'December 3, 2025',
    highlights: ['Bytez AI Integration', 'Google Gemini 2.5 Pro', 'Enhanced Learning Mode'],
    changes: [
      {
        type: 'feature',
        title: 'Bytez API Integration',
        description: 'Switched to Bytez for reliable AI text generation',
      },
      {
        type: 'feature',
        title: 'Gemini 2.5 Pro',
        description: "Upgraded to Google's latest and most capable model",
      },
      {
        type: 'improvement',
        title: 'Learning Mode',
        description: 'Better educational content with multiple integration styles',
      },
      {
        type: 'improvement',
        title: 'Character Animations',
        description: 'Calmer, more subtle floating animations',
      },
      {
        type: 'fix',
        title: 'Search Modal Z-Index',
        description: 'Search now properly appears above all content',
      },
      {
        type: 'fix',
        title: 'Send Button Visibility',
        description: 'Send button now visible on all screen sizes',
      },
    ],
  },
  {
    version: '2.3.0',
    date: 'November 28, 2025',
    highlights: ['Real-time Collaboration', 'Voice Channels', 'AI Assistant in Chat'],
    changes: [
      {
        type: 'feature',
        title: 'Real-time Chat',
        description: 'Supabase-powered real-time messaging',
      },
      {
        type: 'feature',
        title: 'Voice Channels',
        description: 'Voice communication for team collaboration',
      },
      {
        type: 'feature',
        title: 'Genesis AI in Chat',
        description: 'Get AI assistance directly in project channels',
      },
      {
        type: 'improvement',
        title: 'Mobile Sidebar',
        description: 'Slide-out drawer with hamburger menu',
      },
    ],
  },
];

const STORAGE_KEY = 'genesis_last_seen_version';

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <IcoZap className="w-4 h-4 text-coral-burst" />;
    case 'improvement':
      return <IcoZap className="w-4 h-4 text-amber-500" />;
    case 'fix':
      return <Bug className="w-4 h-4 text-green-500" />;
    case 'breaking':
      return <Wrench className="w-4 h-4 text-red-500" />;
    default:
      return <IcoStar className="w-4 h-4 text-cocoa-light" />;
  }
};

const _getTypeBadge = (type: string) => {
  const colors = {
    feature: 'bg-coral-burst/10 text-coral-burst',
    improvement: 'bg-amber-500/10 text-amber-600',
    fix: 'bg-green-500/10 text-green-600',
    breaking: 'bg-red-500/10 text-red-600',
  };
  return colors[type as keyof typeof colors] || 'bg-gray-500/10 text-cocoa-light';
};

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  forceShow?: boolean;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose, forceShow: _forceShow = false }) => {
  const [activeVersion, setActiveVersion] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Mark current version as seen
      localStorage.setItem(STORAGE_KEY, CHANGELOG[0].version);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentEntry = CHANGELOG[activeVersion];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="relative bg-linear-to-r from-coral-burst to-orange-500 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-8 h-8" />
            <h2 className="text-2xl font-bold">What's New in Genesis</h2>
          </div>
          <p className="text-white/80">Check out the latest features and improvements</p>

          {/* Version Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {CHANGELOG.map((entry, idx) => (
              <button
                key={entry.version}
                onClick={() => setActiveVersion(idx)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeVersion === idx
                    ? 'bg-surface text-coral-burst'
                    : 'bg-surface/20 hover:bg-surface/30'
                }`}
              >
                v{entry.version}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[50vh]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-charcoal-soft">
                  Version {currentEntry.version}
                </h3>
                <p className="text-sm text-cocoa-light">{currentEntry.date}</p>
              </div>
            </div>

            {/* Highlights */}
            {currentEntry.highlights.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-cocoa-light uppercase tracking-wider mb-3">
                  Highlights
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentEntry.highlights.map((highlight, idx) => (
                    <Badge key={idx} variant="primary" className="text-sm">
                      ✨ {highlight}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Changes */}
            <div className="space-y-3">
              {currentEntry.changes.map((change, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-cream-soft/50 border border-peach-soft/30 hover:border-peach-soft transition-colors"
                >
                  <div className="mt-0.5">{getTypeIcon(change.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-charcoal-soft">
                        {change.title}
                      </span>
                      <Badge variant={
                        change.type === 'feature' ? 'primary' :
                        change.type === 'improvement' ? 'warning' :
                        change.type === 'fix' ? 'success' :
                        'destructive'
                      }>
                        {change.type}
                      </Badge>
                    </div>
                    {change.description && (
                      <p className="text-sm text-cocoa-light mt-1">
                        {change.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between p-4 border-t-2 border-peach-soft/30 bg-cream-soft/50">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose}>
            Got it, let's go!
            <ChevronRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Hook to check if we should show "What's New"
export const useWhatsNew = () => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
    const currentVersion = CHANGELOG[0].version;

    if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
      // Delay showing to not interrupt initial load
      const timer = setTimeout(() => setShouldShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const markAsSeen = () => {
    localStorage.setItem(STORAGE_KEY, CHANGELOG[0].version);
    setShouldShow(false);
  };

  return { shouldShow, markAsSeen };
};

export default WhatsNewModal;
