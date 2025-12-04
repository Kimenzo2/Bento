import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Command, Keyboard, Search, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    Save, Undo, Redo, Bold, Italic, Copy, Clipboard, Trash2, Plus, Minus,
    ZoomIn, ZoomOut, Home, MessageSquare, Settings, HelpCircle
} from 'lucide-react';

interface Shortcut {
    keys: string[];
    description: string;
    category: string;
    icon?: React.ReactNode;
}

const SHORTCUTS: Shortcut[] = [
    // Navigation
    { keys: ['Ctrl/⌘', 'K'], description: 'Open search', category: 'Navigation', icon: <Search className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'H'], description: 'Go to home', category: 'Navigation', icon: <Home className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', ','], description: 'Open settings', category: 'Navigation', icon: <Settings className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', '?'], description: 'Show keyboard shortcuts', category: 'Navigation', icon: <Keyboard className="w-4 h-4" /> },
    { keys: ['Esc'], description: 'Close modal/panel', category: 'Navigation' },
    
    // Editor
    { keys: ['Ctrl/⌘', 'S'], description: 'Save current work', category: 'Editor', icon: <Save className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'Z'], description: 'Undo', category: 'Editor', icon: <Undo className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'Shift', 'Z'], description: 'Redo', category: 'Editor', icon: <Redo className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'Y'], description: 'Redo (alternative)', category: 'Editor', icon: <Redo className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'B'], description: 'Bold text', category: 'Editor', icon: <Bold className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'I'], description: 'Italic text', category: 'Editor', icon: <Italic className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'C'], description: 'Copy', category: 'Editor', icon: <Copy className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', 'V'], description: 'Paste', category: 'Editor', icon: <Clipboard className="w-4 h-4" /> },
    
    // Book Navigation
    { keys: ['←'], description: 'Previous page', category: 'Book Viewer', icon: <ArrowLeft className="w-4 h-4" /> },
    { keys: ['→'], description: 'Next page', category: 'Book Viewer', icon: <ArrowRight className="w-4 h-4" /> },
    { keys: ['Home'], description: 'First page', category: 'Book Viewer' },
    { keys: ['End'], description: 'Last page', category: 'Book Viewer' },
    { keys: ['Ctrl/⌘', '+'], description: 'Zoom in', category: 'Book Viewer', icon: <ZoomIn className="w-4 h-4" /> },
    { keys: ['Ctrl/⌘', '-'], description: 'Zoom out', category: 'Book Viewer', icon: <ZoomOut className="w-4 h-4" /> },
    
    // Chat
    { keys: ['Ctrl/⌘', 'Enter'], description: 'Send message', category: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { keys: ['↑'], description: 'Edit last message (in empty input)', category: 'Chat', icon: <ArrowUp className="w-4 h-4" /> },
    { keys: ['Esc'], description: 'Cancel reply', category: 'Chat' },
    
    // Actions
    { keys: ['Ctrl/⌘', 'N'], description: 'Create new book', category: 'Actions', icon: <Plus className="w-4 h-4" /> },
    { keys: ['Delete'], description: 'Delete selected item', category: 'Actions', icon: <Trash2 className="w-4 h-4" /> },
];

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // Get unique categories
    const categories = [...new Set(SHORTCUTS.map(s => s.category))];

    // Filter shortcuts
    const filteredShortcuts = SHORTCUTS.filter(shortcut => {
        const matchesSearch = searchQuery === '' || 
            shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            shortcut.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === null || shortcut.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    // Group by category
    const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) {
            acc[shortcut.category] = [];
        }
        acc[shortcut.category].push(shortcut);
        return acc;
    }, {} as Record<string, Shortcut[]>);

    // Global keyboard shortcut to open this modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                // Toggle modal
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!isOpen) return null;

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
                />

                {/* Modal */}
                <motion.div
                    className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-coral-burst/10 rounded-xl">
                                    <Keyboard className="w-6 h-6 text-coral-burst" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        Keyboard Shortcuts
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Speed up your workflow with these shortcuts
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                title="Close"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search shortcuts..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                                autoFocus
                            />
                        </div>

                        {/* Category Filter */}
                        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                            <button
                                onClick={() => setActiveCategory(null)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                    activeCategory === null
                                        ? 'bg-coral-burst text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                                All
                            </button>
                            {categories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                        activeCategory === category
                                            ? 'bg-coral-burst text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[50vh]">
                        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                            <div key={category} className="mb-6 last:mb-0">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    {category}
                                </h3>
                                <div className="space-y-2">
                                    {shortcuts.map((shortcut, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {shortcut.icon && (
                                                    <span className="text-gray-400">{shortcut.icon}</span>
                                                )}
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    {shortcut.description}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, keyIdx) => (
                                                    <React.Fragment key={keyIdx}>
                                                        <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 shadow-sm">
                                                            {key}
                                                        </kbd>
                                                        {keyIdx < shortcut.keys.length - 1 && (
                                                            <span className="text-gray-400 text-xs">+</span>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {filteredShortcuts.length === 0 && (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No shortcuts found for "{searchQuery}"</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs">
                                    Ctrl/⌘
                                </kbd>
                                <span>+</span>
                                <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs">
                                    ?
                                </kbd>
                                <span>to open this panel anytime</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-coral-burst hover:underline"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default KeyboardShortcutsModal;
