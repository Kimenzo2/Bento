import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Clipboard,
  Copy,
  Home,
  Italic,
  Keyboard,
  Plus,
  Redo,
  Save,
  Search,
  Settings,
  Trash2,
  Undo,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
  icon?: React.ReactNode;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  {
    keys: ['Ctrl/⌘', 'K'],
    description: 'Open search',
    category: 'Navigation',
    icon: <Search className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'H'],
    description: 'Go to home',
    category: 'Navigation',
    icon: <Home className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', ','],
    description: 'Open settings',
    category: 'Navigation',
    icon: <Settings className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', '?'],
    description: 'Show keyboard shortcuts',
    category: 'Navigation',
    icon: <Keyboard className="w-4 h-4" />,
  },
  { keys: ['Esc'], description: 'Close modal/panel', category: 'Navigation' },

  // Editor
  {
    keys: ['Ctrl/⌘', 'S'],
    description: 'Save current work',
    category: 'Editor',
    icon: <Save className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'Z'],
    description: 'Undo',
    category: 'Editor',
    icon: <Undo className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'Shift', 'Z'],
    description: 'Redo',
    category: 'Editor',
    icon: <Redo className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'Y'],
    description: 'Redo (alternative)',
    category: 'Editor',
    icon: <Redo className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'B'],
    description: 'Bold text',
    category: 'Editor',
    icon: <Bold className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'I'],
    description: 'Italic text',
    category: 'Editor',
    icon: <Italic className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'C'],
    description: 'Copy',
    category: 'Editor',
    icon: <Copy className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', 'V'],
    description: 'Paste',
    category: 'Editor',
    icon: <Clipboard className="w-4 h-4" />,
  },

  // Book Navigation
  {
    keys: ['←'],
    description: 'Previous page',
    category: 'Book Viewer',
    icon: <ArrowLeft className="w-4 h-4" />,
  },
  {
    keys: ['→'],
    description: 'Next page',
    category: 'Book Viewer',
    icon: <ArrowRight className="w-4 h-4" />,
  },
  { keys: ['Home'], description: 'First page', category: 'Book Viewer' },
  { keys: ['End'], description: 'Last page', category: 'Book Viewer' },
  {
    keys: ['Ctrl/⌘', '+'],
    description: 'Zoom in',
    category: 'Book Viewer',
    icon: <ZoomIn className="w-4 h-4" />,
  },
  {
    keys: ['Ctrl/⌘', '-'],
    description: 'Zoom out',
    category: 'Book Viewer',
    icon: <ZoomOut className="w-4 h-4" />,
  },

  // Actions
  {
    keys: ['Ctrl/⌘', 'N'],
    description: 'Create new book',
    category: 'Actions',
    icon: <Plus className="w-4 h-4" />,
  },
  {
    keys: ['Delete'],
    description: 'Delete selected item',
    category: 'Actions',
    icon: <Trash2 className="w-4 h-4" />,
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  // Filter shortcuts
  const filteredShortcuts = SHORTCUTS.filter((shortcut) => {
    const matchesSearch =
      searchQuery === '' ||
      shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortcut.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === null || shortcut.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedShortcuts = filteredShortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>
  );

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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b-2 border-peach-soft/30">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-coral-burst/10 rounded-xl">
                <Keyboard className="w-6 h-6 text-coral-burst" />
              </div>
              <div>
                <DialogTitle>Keyboard Shortcuts</DialogTitle>
                <DialogDescription>Speed up your workflow with these shortcuts</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cocoa-light" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                activeCategory === null
                  ? 'bg-coral-burst text-white border-coral-burst'
                  : 'border-peach-soft text-cocoa-light hover:border-coral-burst/50'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  activeCategory === category
                    ? 'bg-coral-burst text-white border-coral-burst'
                    : 'border-peach-soft text-cocoa-light hover:border-coral-burst/50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[50vh]">
          <div className="p-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-cocoa-light uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-cream-soft/50 border border-peach-soft/30 hover:border-peach-soft transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {shortcut.icon && <span className="text-cocoa-light">{shortcut.icon}</span>}
                        <span className="text-charcoal-soft">{shortcut.description}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <kbd className="px-2.5 py-1 bg-surface border border-peach-soft rounded-lg text-xs font-mono text-charcoal-soft">
                              {key}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-cocoa-light text-xs">+</span>
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
              <div className="text-center py-12 text-cocoa-light">
                <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No shortcuts found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between p-4 border-t-2 border-peach-soft/30 bg-cream-soft/50">
          <div className="flex items-center gap-2 text-sm text-cocoa-light">
            <kbd className="px-2 py-1 bg-surface border border-peach-soft rounded text-xs">
              Ctrl/⌘
            </kbd>
            <span>+</span>
            <kbd className="px-2 py-1 bg-surface border border-peach-soft rounded text-xs">?</kbd>
            <span>to open this panel anytime</span>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-coral-burst hover:text-coral-burst"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsModal;
