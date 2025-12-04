import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, X, Hash, User, Calendar, Paperclip, Link2,
    ArrowRight, Clock, MessageSquare, Sparkles
} from 'lucide-react';
import { Message, SearchResult } from './types';

interface SearchModalProps {
    onClose: () => void;
    onSelectResult: (message: Message) => void;
}

// Mock search results
const mockResults: SearchResult[] = [
    {
        message: {
            id: 'sr-1',
            channelId: 'ch-2',
            userId: 'user-1',
            user: {
                id: 'user-1',
                displayName: 'Sarah Chen',
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
                status: 'online',
            },
            content: 'Just finished the first chapter of my new children\'s book. Would love some feedback!',
            type: 'text',
            timestamp: new Date(Date.now() - 3600000),
            status: 'read',
            reactions: [],
            attachments: [],
            mentions: [],
            isPinned: false,
            isDeleted: false,
        },
        channel: {
            id: 'ch-2',
            name: 'general',
            type: 'text',
            unreadCount: 0,
            mentionCount: 0,
            isPinned: false,
            isMuted: false,
            isLocked: false,
            createdAt: new Date(),
        },
        matchedText: 'first chapter',
        context: {},
    },
    {
        message: {
            id: 'sr-2',
            channelId: 'ch-4',
            userId: 'ai-genesis',
            user: {
                id: 'ai-genesis',
                displayName: 'Genesis AI',
                avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=genesis',
                status: 'online',
            },
            content: 'Story Analysis Complete! I\'ve analyzed your chapter and here are some suggestions...',
            type: 'ai_response',
            timestamp: new Date(Date.now() - 7200000),
            status: 'read',
            reactions: [],
            attachments: [],
            mentions: [],
            isPinned: false,
            isDeleted: false,
        },
        channel: {
            id: 'ch-4',
            name: 'visual-studio',
            type: 'text',
            unreadCount: 0,
            mentionCount: 0,
            isPinned: false,
            isMuted: false,
            isLocked: false,
            createdAt: new Date(),
        },
        matchedText: 'chapter',
        context: {},
    },
];

interface SearchFilter {
    type: 'from' | 'in' | 'has' | 'before' | 'after';
    value: string;
    label: string;
}

const QUICK_FILTERS: SearchFilter[] = [
    { type: 'has', value: 'link', label: 'has:link' },
    { type: 'has', value: 'file', label: 'has:file' },
    { type: 'has', value: 'image', label: 'has:image' },
];

const RECENT_SEARCHES = [
    'project feedback',
    'illustration concept',
    'chapter review',
];

const SearchModal: React.FC<SearchModalProps> = ({ onClose, onSelectResult }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Simulate search
    useEffect(() => {
        if (query.trim()) {
            setIsLoading(true);
            const timeout = setTimeout(() => {
                setResults(mockResults.filter(r => 
                    r.message.content.toLowerCase().includes(query.toLowerCase())
                ));
                setIsLoading(false);
            }, 300);
            return () => clearTimeout(timeout);
        } else {
            setResults([]);
        }
    }, [query]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            onSelectResult(results[selectedIndex].message);
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    const addFilter = (filter: SearchFilter) => {
        if (!activeFilters.find(f => f.label === filter.label)) {
            setActiveFilters([...activeFilters, filter]);
        }
    };

    const removeFilter = (filter: SearchFilter) => {
        setActiveFilters(activeFilters.filter(f => f.label !== filter.label));
    };

    // Use portal to render outside any overflow:hidden containers
    return createPortal(
        <motion.div
            className="chat-search-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="chat-search-modal-content"
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="chat-search-modal-input">
                    <Search size={20} className="text-[var(--chat-text-muted)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search messages, files, people..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {query && (
                        <button
                            className="p-1 rounded-lg hover:bg-[var(--chat-bg-hover)] text-[var(--chat-text-muted)]"
                            onClick={() => setQuery('')}
                        >
                            <X size={16} />
                        </button>
                    )}
                    <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs bg-[var(--chat-bg-tertiary)] text-[var(--chat-text-muted)] rounded border border-[var(--chat-border-secondary)]">
                        ESC
                    </kbd>
                </div>

                {/* Active Filters */}
                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-[var(--chat-border-primary)]">
                        {activeFilters.map((filter) => (
                            <span
                                key={filter.label}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--chat-coral-burst)]/10 text-[var(--chat-coral-burst)] rounded-lg text-sm"
                            >
                                {filter.label}
                                <button onClick={() => removeFilter(filter)}>
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Quick Filters */}
                {!query && (
                    <div className="px-4 py-3 border-b border-[var(--chat-border-primary)]">
                        <div className="text-xs font-semibold text-[var(--chat-text-muted)] mb-2">
                            Quick Filters
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {QUICK_FILTERS.map((filter) => (
                                <button
                                    key={filter.label}
                                    className="px-3 py-1.5 bg-[var(--chat-bg-tertiary)] hover:bg-[var(--chat-bg-hover)] rounded-lg text-sm text-[var(--chat-text-secondary)] transition-colors"
                                    onClick={() => addFilter(filter)}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                <div className="chat-search-modal-results">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-[var(--chat-coral-burst)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : results.length > 0 ? (
                        results.map((result, index) => (
                            <motion.div
                                key={result.message.id}
                                className={`chat-search-result ${index === selectedIndex ? 'bg-[var(--chat-bg-hover)]' : ''}`}
                                onClick={() => onSelectResult(result.message)}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <img
                                    src={result.message.user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.message.userId}`}
                                    alt={result.message.user.displayName}
                                    className="w-10 h-10 rounded-full flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-[var(--chat-text-primary)]">
                                            {result.message.user.displayName}
                                        </span>
                                        <span className="text-xs text-[var(--chat-text-muted)]">
                                            in #{result.channel.name}
                                        </span>
                                        <span className="text-xs text-[var(--chat-text-muted)] ml-auto">
                                            {formatTime(result.message.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--chat-text-secondary)] line-clamp-2">
                                        {result.message.content.split(new RegExp(`(${query})`, 'gi')).map((part, i) => 
                                            part.toLowerCase() === query.toLowerCase() ? (
                                                <mark key={i} className="bg-[var(--chat-gold-sunshine)]/40 text-inherit px-0.5 rounded">
                                                    {part}
                                                </mark>
                                            ) : part
                                        )}
                                    </p>
                                </div>
                                <ArrowRight size={16} className="text-[var(--chat-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.div>
                        ))
                    ) : query ? (
                        <div className="text-center py-8">
                            <MessageSquare size={32} className="mx-auto mb-3 text-[var(--chat-text-muted)] opacity-50" />
                            <p className="text-sm text-[var(--chat-text-muted)]">
                                No results found for "{query}"
                            </p>
                            <p className="text-xs text-[var(--chat-text-muted)] mt-1">
                                Try different keywords or filters
                            </p>
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="text-xs font-semibold text-[var(--chat-text-muted)] mb-3">
                                Recent Searches
                            </div>
                            {RECENT_SEARCHES.map((search) => (
                                <button
                                    key={search}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--chat-bg-hover)] transition-colors text-left"
                                    onClick={() => setQuery(search)}
                                >
                                    <Clock size={14} className="text-[var(--chat-text-muted)]" />
                                    <span className="text-sm text-[var(--chat-text-secondary)]">
                                        {search}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[var(--chat-border-primary)] bg-[var(--chat-bg-tertiary)]/50 flex items-center justify-between text-xs text-[var(--chat-text-muted)]">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-[var(--chat-bg-secondary)] rounded border border-[var(--chat-border-secondary)]">↑↓</kbd>
                            to navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-[var(--chat-bg-secondary)] rounded border border-[var(--chat-border-secondary)]">↵</kbd>
                            to select
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Sparkles size={12} />
                        Powered by Genesis AI
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    );
};

export default SearchModal;
