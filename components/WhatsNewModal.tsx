import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, Gift, Bug, Wrench, Star, ChevronRight, ExternalLink } from 'lucide-react';

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
            { type: 'feature', title: 'Dark Mode Default', description: 'Chat system now defaults to dark mode for better reading experience' },
            { type: 'feature', title: 'Interactive Notifications', description: 'Click notifications to navigate directly to content' },
            { type: 'feature', title: 'User Profile Links', description: 'Click any username to view their profile' },
            { type: 'feature', title: 'Create Channel Modal', description: 'Interactive plus button to create new channels' },
            { type: 'feature', title: 'Project Dropdown Menu', description: 'Quick access to project settings and actions' },
            { type: 'improvement', title: 'Skeleton Loaders', description: 'Beautiful loading states throughout the app' },
            { type: 'improvement', title: 'Keyboard Shortcuts', description: 'New discoverable shortcuts panel' },
            { type: 'fix', title: 'PWA Installation', description: 'Fixed issues preventing app installation on mobile and desktop' },
        ]
    },
    {
        version: '2.4.0',
        date: 'December 3, 2025',
        highlights: [
            'Bytez AI Integration',
            'Google Gemini 2.5 Pro',
            'Enhanced Learning Mode',
        ],
        changes: [
            { type: 'feature', title: 'Bytez API Integration', description: 'Switched to Bytez for reliable AI text generation' },
            { type: 'feature', title: 'Gemini 2.5 Pro', description: 'Upgraded to Google\'s latest and most capable model' },
            { type: 'improvement', title: 'Learning Mode', description: 'Better educational content with multiple integration styles' },
            { type: 'improvement', title: 'Character Animations', description: 'Calmer, more subtle floating animations' },
            { type: 'fix', title: 'Search Modal Z-Index', description: 'Search now properly appears above all content' },
            { type: 'fix', title: 'Send Button Visibility', description: 'Send button now visible on all screen sizes' },
        ]
    },
    {
        version: '2.3.0',
        date: 'November 28, 2025',
        highlights: [
            'Real-time Collaboration',
            'Voice Channels',
            'AI Assistant in Chat',
        ],
        changes: [
            { type: 'feature', title: 'Real-time Chat', description: 'Supabase-powered real-time messaging' },
            { type: 'feature', title: 'Voice Channels', description: 'Voice communication for team collaboration' },
            { type: 'feature', title: 'Genesis AI in Chat', description: 'Get AI assistance directly in project channels' },
            { type: 'improvement', title: 'Mobile Sidebar', description: 'Slide-out drawer with hamburger menu' },
        ]
    }
];

const STORAGE_KEY = 'genesis_last_seen_version';

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'feature': return <Sparkles className="w-4 h-4 text-coral-burst" />;
        case 'improvement': return <Zap className="w-4 h-4 text-amber-500" />;
        case 'fix': return <Bug className="w-4 h-4 text-green-500" />;
        case 'breaking': return <Wrench className="w-4 h-4 text-red-500" />;
        default: return <Star className="w-4 h-4 text-gray-500" />;
    }
};

const getTypeBadge = (type: string) => {
    const colors = {
        feature: 'bg-coral-burst/10 text-coral-burst',
        improvement: 'bg-amber-500/10 text-amber-600',
        fix: 'bg-green-500/10 text-green-600',
        breaking: 'bg-red-500/10 text-red-600',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500/10 text-gray-600';
};

interface WhatsNewModalProps {
    isOpen: boolean;
    onClose: () => void;
    forceShow?: boolean;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose, forceShow = false }) => {
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
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Backdrop */}
                <motion.div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                />

                {/* Modal */}
                <motion.div
                    className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                    {/* Header */}
                    <div className="relative bg-gradient-to-r from-coral-burst to-orange-500 p-6 text-white">
                        <button
                            onClick={onClose}
                            title="Close"
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
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
                                            ? 'bg-white text-coral-burst'
                                            : 'bg-white/20 hover:bg-white/30'
                                    }`}
                                >
                                    v{entry.version}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[50vh]">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Version {currentEntry.version}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{currentEntry.date}</p>
                            </div>
                        </div>

                        {/* Highlights */}
                        {currentEntry.highlights.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    Highlights
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {currentEntry.highlights.map((highlight, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3 py-1.5 bg-gradient-to-r from-coral-burst/10 to-orange-500/10 text-coral-burst rounded-full text-sm font-medium"
                                        >
                                            ✨ {highlight}
                                        </span>
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
                                    className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <div className="mt-0.5">{getTypeIcon(change.type)}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {change.title}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(change.type)}`}>
                                                {change.type}
                                            </span>
                                        </div>
                                        {change.description && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {change.description}
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={onClose}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
                            >
                                Close
                            </button>
                            <button
                                onClick={onClose}
                                className="flex items-center gap-2 px-4 py-2 bg-coral-burst text-white rounded-xl font-medium hover:bg-coral-burst/90 transition-colors"
                            >
                                Got it, let's go!
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
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
