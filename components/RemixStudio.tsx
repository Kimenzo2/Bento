/**
 * Remix Studio
 * 
 * A modal for discovering, browsing, and forking remixable worlds.
 * Features:
 * - Gallery view of public worlds
 * - Search and filters
 * - World preview with lore and locations
 * - One-click forking
 * - Attribution chain display
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Search, GitFork, Heart, Eye, Star, Sparkles,
    MapPin, BookOpen, Wand2, Clock, User, Filter,
    ChevronRight, Globe, Lock, ArrowRight, Check,
    Layers, Hash, Crown, TrendingUp, Zap
} from 'lucide-react';
import { remixService, WorldSearchFilters } from '../services/remixService';
import type { RemixableWorld, WorldFork, BookProject } from '../types';

interface RemixStudioProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
    userName?: string;
    onForkWorld?: (world: RemixableWorld) => void;
    currentProject?: BookProject;
}

// Era options for filtering
const ERA_OPTIONS = [
    { value: '', label: 'All Eras' },
    { value: 'Medieval', label: '🏰 Medieval' },
    { value: 'Fantasy', label: '🧙 Fantasy' },
    { value: 'Sci-Fi', label: '🚀 Sci-Fi' },
    { value: 'Modern', label: '🏙️ Modern' },
    { value: 'Historical', label: '📜 Historical' },
    { value: 'Post-Apocalyptic', label: '☢️ Post-Apocalyptic' },
    { value: 'Steampunk', label: '⚙️ Steampunk' },
];

// License icons
const LICENSE_ICONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    open: { icon: <Globe className="w-4 h-4" />, label: 'Open', color: 'text-green-400' },
    attribution: { icon: <User className="w-4 h-4" />, label: 'Attribution', color: 'text-blue-400' },
    'non-commercial': { icon: <Heart className="w-4 h-4" />, label: 'Non-Commercial', color: 'text-purple-400' },
    restricted: { icon: <Lock className="w-4 h-4" />, label: 'Restricted', color: 'text-orange-400' },
};

export const RemixStudio: React.FC<RemixStudioProps> = ({
    isOpen,
    onClose,
    userId,
    userName,
    onForkWorld,
    currentProject
}) => {
    // State
    const [worlds, setWorlds] = useState<RemixableWorld[]>([]);
    const [featuredWorlds, setFeaturedWorlds] = useState<RemixableWorld[]>([]);
    const [selectedWorld, setSelectedWorld] = useState<RemixableWorld | null>(null);
    const [loading, setLoading] = useState(true);
    const [forking, setForking] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<WorldSearchFilters>({
        sortBy: 'trending',
        limit: 20
    });
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState<'discover' | 'publish'>('discover');
    const [publishSettings, setPublishSettings] = useState({
        name: '',
        description: '',
        era: 'Fantasy',
        tags: [] as string[],
        magicSystem: '',
        rules: [] as string[],
        isPublic: true,
        allowRemix: true,
        requireCredit: true,
        license: 'attribution' as const
    });
    const [newTag, setNewTag] = useState('');
    const [newRule, setNewRule] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publishSuccess, setPublishSuccess] = useState(false);

    // Load worlds
    useEffect(() => {
        if (isOpen) {
            loadWorlds();
        }
    }, [isOpen, filters]);

    const loadWorlds = async () => {
        setLoading(true);
        try {
            const [allWorlds, featured] = await Promise.all([
                remixService.searchWorlds(filters),
                remixService.getFeaturedWorlds()
            ]);
            setWorlds(allWorlds);
            setFeaturedWorlds(featured);
        } catch (error) {
            console.error('Error loading worlds:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle fork
    const handleFork = async (world: RemixableWorld) => {
        if (!userId || !userName) {
            alert('Please log in to fork worlds');
            return;
        }

        setForking(true);
        try {
            const result = await remixService.forkWorld(world, userId, userName);
            if (result) {
                onForkWorld?.(result.world);
                setSelectedWorld(null);
                onClose();
            }
        } catch (error) {
            console.error('Error forking world:', error);
        } finally {
            setForking(false);
        }
    };

    // Handle publish
    const handlePublish = async () => {
        if (!currentProject || !userId || !userName) return;

        setPublishing(true);
        try {
            const world = remixService.createWorldFromProject(
                currentProject,
                userId,
                userName,
                publishSettings
            );
            
            const result = await remixService.publishWorld(world);
            if (result.success) {
                setPublishSuccess(true);
                setTimeout(() => {
                    setPublishSuccess(false);
                    setActiveTab('discover');
                    loadWorlds();
                }, 2000);
            }
        } catch (error) {
            console.error('Error publishing world:', error);
        } finally {
            setPublishing(false);
        }
    };

    // Add tag
    const addTag = () => {
        if (newTag.trim() && !publishSettings.tags.includes(newTag.trim())) {
            setPublishSettings(prev => ({
                ...prev,
                tags: [...prev.tags, newTag.trim()]
            }));
            setNewTag('');
        }
    };

    // Add rule
    const addRule = () => {
        if (newRule.trim() && !publishSettings.rules.includes(newRule.trim())) {
            setPublishSettings(prev => ({
                ...prev,
                rules: [...prev.rules, newRule.trim()]
            }));
            setNewRule('');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center"
            >
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950"
                    onClick={onClose}
                />

                {/* Main Container */}
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="relative w-full max-w-7xl h-[90vh] mx-4 bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-purple-500/20 shadow-2xl shadow-purple-500/10 overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-purple-900/30 via-transparent to-indigo-900/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                    <GitFork className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Remix Studio</h2>
                                    <p className="text-sm text-purple-300/60">
                                        Discover worlds to remix or share your own
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Tabs */}
                                <div className="flex bg-white/5 rounded-xl p-1">
                                    <button
                                        onClick={() => setActiveTab('discover')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            activeTab === 'discover'
                                                ? 'bg-purple-500 text-white'
                                                : 'text-white/60 hover:text-white'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Globe className="w-4 h-4" />
                                            Discover
                                        </span>
                                    </button>
                                    {currentProject && (
                                        <button
                                            onClick={() => setActiveTab('publish')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                activeTab === 'publish'
                                                    ? 'bg-purple-500 text-white'
                                                    : 'text-white/60 hover:text-white'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" />
                                                Publish
                                            </span>
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'discover' ? (
                            <div className="h-full flex">
                                {/* Left Panel - World List */}
                                <div className="flex-1 flex flex-col min-w-0 border-r border-white/10">
                                    {/* Search & Filters */}
                                    <div className="p-4 border-b border-white/10">
                                        <div className="flex gap-3">
                                            <div className="flex-1 relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search worlds..."
                                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setShowFilters(!showFilters)}
                                                className={`px-4 py-2 rounded-xl border transition-colors ${
                                                    showFilters
                                                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                                        : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <Filter className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Filters Panel */}
                                        <AnimatePresence>
                                            {showFilters && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pt-4 flex flex-wrap gap-3">
                                                        {/* Era Filter */}
                                                        <select
                                                            value={filters.era || ''}
                                                            onChange={(e) => setFilters(f => ({ ...f, era: e.target.value || undefined }))}
                                                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                                                        >
                                                            {ERA_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value} className="bg-slate-800">
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {/* Sort By */}
                                                        <select
                                                            value={filters.sortBy || 'trending'}
                                                            onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
                                                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50"
                                                        >
                                                            <option value="trending" className="bg-slate-800">🔥 Trending</option>
                                                            <option value="popular" className="bg-slate-800">⭐ Most Remixed</option>
                                                            <option value="recent" className="bg-slate-800">🕐 Recent</option>
                                                        </select>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Featured Section */}
                                    {!searchQuery && featuredWorlds.length > 0 && (
                                        <div className="p-4 border-b border-white/10">
                                            <h3 className="text-sm font-medium text-purple-300 mb-3 flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4" />
                                                Trending Worlds
                                            </h3>
                                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
                                                {featuredWorlds.slice(0, 4).map(world => (
                                                    <button
                                                        key={world.id}
                                                        onClick={() => setSelectedWorld(world)}
                                                        className="flex-shrink-0 w-48 p-3 bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all text-left"
                                                    >
                                                        <div className="w-full h-20 rounded-lg bg-purple-800/30 mb-2 overflow-hidden">
                                                            {world.coverImage ? (
                                                                <img src={world.coverImage} alt={world.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Globe className="w-8 h-8 text-purple-400/30" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h4 className="font-medium text-white text-sm truncate">{world.name}</h4>
                                                        <p className="text-xs text-white/40 truncate">{world.creatorName}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* World Grid */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {loading ? (
                                            <div className="flex items-center justify-center h-64">
                                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                                            </div>
                                        ) : worlds.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {worlds.map(world => (
                                                    <motion.button
                                                        key={world.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        onClick={() => {
                                                            setSelectedWorld(world);
                                                            remixService.viewWorld(world.id);
                                                        }}
                                                        className={`p-4 bg-white/5 hover:bg-white/10 rounded-xl border transition-all text-left ${
                                                            selectedWorld?.id === world.id
                                                                ? 'border-purple-500/50 bg-purple-500/10'
                                                                : 'border-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="w-16 h-16 rounded-lg bg-purple-800/30 flex-shrink-0 overflow-hidden">
                                                                {world.coverImage ? (
                                                                    <img src={world.coverImage} alt={world.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <Globe className="w-6 h-6 text-purple-400/30" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-medium text-white truncate">{world.name}</h4>
                                                                <p className="text-xs text-white/40 truncate mb-2">by {world.creatorName}</p>
                                                                <div className="flex items-center gap-3 text-xs text-white/30">
                                                                    <span className="flex items-center gap-1">
                                                                        <GitFork className="w-3 h-3" />
                                                                        {world.totalRemixes}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Heart className="w-3 h-3" />
                                                                        {world.totalLikes}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Eye className="w-3 h-3" />
                                                                        {world.totalViews}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className={`${LICENSE_ICONS[world.license]?.color || 'text-gray-400'}`}>
                                                                {LICENSE_ICONS[world.license]?.icon}
                                                            </div>
                                                        </div>
                                                        {world.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-3">
                                                                {world.tags.slice(0, 3).map(tag => (
                                                                    <span key={tag} className="px-2 py-0.5 bg-purple-500/20 rounded-full text-xs text-purple-300">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <Globe className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                                <p className="text-white/40">No worlds found</p>
                                                <p className="text-sm text-white/30">Try adjusting your filters</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Panel - World Detail */}
                                <div className="hidden lg:flex w-96 flex-col bg-slate-900/50">
                                    {selectedWorld ? (
                                        <>
                                            {/* World Header */}
                                            <div className="p-6 border-b border-white/10">
                                                <div className="w-full h-32 rounded-xl bg-purple-800/30 mb-4 overflow-hidden">
                                                    {selectedWorld.coverImage ? (
                                                        <img src={selectedWorld.coverImage} alt={selectedWorld.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600/30 to-indigo-600/30">
                                                            <Globe className="w-12 h-12 text-purple-400/50" />
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className="text-xl font-bold text-white mb-1">{selectedWorld.name}</h3>
                                                <p className="text-sm text-white/60 mb-3">{selectedWorld.description}</p>
                                                
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center">
                                                        <User className="w-3 h-3 text-purple-300" />
                                                    </div>
                                                    <span className="text-sm text-white/60">by {selectedWorld.creatorName}</span>
                                                </div>

                                                {/* Stats */}
                                                <div className="flex gap-4 text-sm">
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-purple-400">{selectedWorld.totalRemixes}</p>
                                                        <p className="text-xs text-white/40">Remixes</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-pink-400">{selectedWorld.totalLikes}</p>
                                                        <p className="text-xs text-white/40">Likes</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold text-indigo-400">{selectedWorld.totalViews}</p>
                                                        <p className="text-xs text-white/40">Views</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* World Details */}
                                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                                {/* Era & License */}
                                                <div className="flex gap-2">
                                                    <span className="px-3 py-1 bg-indigo-500/20 rounded-full text-xs text-indigo-300">
                                                        {selectedWorld.era}
                                                    </span>
                                                    <span className={`px-3 py-1 bg-white/5 rounded-full text-xs flex items-center gap-1 ${LICENSE_ICONS[selectedWorld.license]?.color}`}>
                                                        {LICENSE_ICONS[selectedWorld.license]?.icon}
                                                        {LICENSE_ICONS[selectedWorld.license]?.label}
                                                    </span>
                                                </div>

                                                {/* Magic System */}
                                                {selectedWorld.magicSystem && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                                                            <Wand2 className="w-4 h-4 text-purple-400" />
                                                            Magic System
                                                        </h4>
                                                        <p className="text-sm text-white/60">{selectedWorld.magicSystem}</p>
                                                    </div>
                                                )}

                                                {/* Locations */}
                                                {selectedWorld.locations.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                                                            <MapPin className="w-4 h-4 text-green-400" />
                                                            Locations ({selectedWorld.locations.length})
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {selectedWorld.locations.slice(0, 3).map(loc => (
                                                                <div key={loc.id} className="p-2 bg-white/5 rounded-lg">
                                                                    <p className="text-sm text-white/80 font-medium">{loc.name}</p>
                                                                    <p className="text-xs text-white/40 line-clamp-2">{loc.description}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* World Rules */}
                                                {selectedWorld.rules.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                                                            <BookOpen className="w-4 h-4 text-amber-400" />
                                                            World Rules
                                                        </h4>
                                                        <ul className="space-y-1">
                                                            {selectedWorld.rules.map((rule, i) => (
                                                                <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                                                                    <span className="text-amber-400">•</span>
                                                                    {rule}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Tags */}
                                                {selectedWorld.tags.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                                                            <Hash className="w-4 h-4 text-blue-400" />
                                                            Tags
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedWorld.tags.map(tag => (
                                                                <span key={tag} className="px-2 py-1 bg-blue-500/20 rounded-full text-xs text-blue-300">
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fork Button */}
                                            <div className="p-6 border-t border-white/10">
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => handleFork(selectedWorld)}
                                                    disabled={forking || !userId}
                                                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {forking ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                                            Forking...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <GitFork className="w-5 h-5" />
                                                            Remix This World
                                                        </>
                                                    )}
                                                </motion.button>
                                                {selectedWorld.requireCredit && (
                                                    <p className="text-xs text-white/40 text-center mt-2">
                                                        Attribution to {selectedWorld.creatorName} will be added
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <Globe className="w-16 h-16 text-white/10 mx-auto mb-4" />
                                                <p className="text-white/40">Select a world to preview</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Publish Tab */
                            <div className="h-full overflow-y-auto p-6">
                                <div className="max-w-2xl mx-auto space-y-6">
                                    {publishSuccess ? (
                                        <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-center py-12"
                                        >
                                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Check className="w-10 h-10 text-green-400" />
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-2">World Published!</h3>
                                            <p className="text-white/60">Your world is now available for others to remix</p>
                                        </motion.div>
                                    ) : (
                                        <>
                                            <div className="text-center mb-8">
                                                <h3 className="text-2xl font-bold text-white mb-2">Share Your World</h3>
                                                <p className="text-white/60">
                                                    Turn "{currentProject?.title}" into a remixable world
                                                </p>
                                            </div>

                                            {/* World Name */}
                                            <div>
                                                <label className="block text-sm font-medium text-white/80 mb-2">
                                                    World Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={publishSettings.name}
                                                    onChange={(e) => setPublishSettings(s => ({ ...s, name: e.target.value }))}
                                                    placeholder={`${currentProject?.title} World`}
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <label className="block text-sm font-medium text-white/80 mb-2">
                                                    Description
                                                </label>
                                                <textarea
                                                    value={publishSettings.description}
                                                    onChange={(e) => setPublishSettings(s => ({ ...s, description: e.target.value }))}
                                                    placeholder="Describe what makes this world unique..."
                                                    rows={3}
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
                                                />
                                            </div>

                                            {/* Era & Magic */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                                        Era
                                                    </label>
                                                    <select
                                                        value={publishSettings.era}
                                                        onChange={(e) => setPublishSettings(s => ({ ...s, era: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                                                    >
                                                        {ERA_OPTIONS.slice(1).map(opt => (
                                                            <option key={opt.value} value={opt.value} className="bg-slate-800">
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                                        Magic System (optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={publishSettings.magicSystem}
                                                        onChange={(e) => setPublishSettings(s => ({ ...s, magicSystem: e.target.value }))}
                                                        placeholder="e.g., Elemental magic"
                                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                                    />
                                                </div>
                                            </div>

                                            {/* Tags */}
                                            <div>
                                                <label className="block text-sm font-medium text-white/80 mb-2">
                                                    Tags
                                                </label>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={newTag}
                                                        onChange={(e) => setNewTag(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                                        placeholder="Add a tag..."
                                                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                                    />
                                                    <button
                                                        onClick={addTag}
                                                        className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-300"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {publishSettings.tags.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="px-2 py-1 bg-purple-500/20 rounded-full text-xs text-purple-300 flex items-center gap-1"
                                                        >
                                                            #{tag}
                                                            <button
                                                                onClick={() => setPublishSettings(s => ({ ...s, tags: s.tags.filter(t => t !== tag) }))}
                                                                className="hover:text-white"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* License */}
                                            <div>
                                                <label className="block text-sm font-medium text-white/80 mb-2">
                                                    License
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Object.entries(LICENSE_ICONS).map(([key, { icon, label, color }]) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => setPublishSettings(s => ({ ...s, license: key as any }))}
                                                            className={`p-3 rounded-xl border text-left transition-all ${
                                                                publishSettings.license === key
                                                                    ? 'bg-purple-500/20 border-purple-500/50'
                                                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                                            }`}
                                                        >
                                                            <div className={`flex items-center gap-2 ${color}`}>
                                                                {icon}
                                                                <span className="text-sm font-medium">{label}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Settings Toggles */}
                                            <div className="space-y-3">
                                                <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer">
                                                    <span className="text-white/80">Allow remixing</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={publishSettings.allowRemix}
                                                        onChange={(e) => setPublishSettings(s => ({ ...s, allowRemix: e.target.checked }))}
                                                        className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                                                    />
                                                </label>
                                                <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer">
                                                    <span className="text-white/80">Require attribution</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={publishSettings.requireCredit}
                                                        onChange={(e) => setPublishSettings(s => ({ ...s, requireCredit: e.target.checked }))}
                                                        className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                                                    />
                                                </label>
                                            </div>

                                            {/* Publish Button */}
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handlePublish}
                                                disabled={publishing || !publishSettings.name.trim()}
                                                className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {publishing ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                                        Publishing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5" />
                                                        Publish World
                                                    </>
                                                )}
                                            </motion.button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default RemixStudio;
