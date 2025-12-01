// ==============================================================================
// SHARED VISUAL CARD COMPONENT
// ==============================================================================
// Card component for displaying shared visuals with reactions, remix, and more
// ==============================================================================

import React, { useState, useCallback } from 'react';
import { 
    SharedVisual, 
    ReactionCount, 
    REACTION_EMOJIS 
} from '../../types/collaboration';
import ReactionBar, { MiniReactionDisplay } from './ReactionBar';
import { 
    GitFork, 
    Download, 
    Share2, 
    MoreHorizontal, 
    Eye, 
    Clock,
    Maximize2,
    User,
    MessageCircle,
    Sparkles,
    Crown,
    Bookmark,
    Flag,
    Copy,
    ExternalLink
} from 'lucide-react';

interface SharedVisualCardProps {
    visual: SharedVisual;
    variant?: 'grid' | 'compact' | 'featured' | 'detail';
    showReactions?: boolean;
    showActions?: boolean;
    showUser?: boolean;
    onRemix?: (visual: SharedVisual) => void;
    onExpand?: (visual: SharedVisual) => void;
    onViewLineage?: (visual: SharedVisual) => void;
    onUserClick?: (userId: string) => void;
}

const SharedVisualCard: React.FC<SharedVisualCardProps> = ({
    visual,
    variant = 'grid',
    showReactions = true,
    showActions = true,
    showUser = true,
    onRemix,
    onExpand,
    onViewLineage,
    onUserClick,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [reactions, setReactions] = useState<ReactionCount[]>([]);

    // Format numbers
    const formatCount = (count: number): string => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    // Format time ago
    const formatTimeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleDownload = useCallback(() => {
        const link = document.createElement('a');
        link.href = visual.image_url;
        link.download = `genesis-${visual.id.slice(0, 8)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [visual]);

    const handleShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: visual.title || 'Genesis Visual',
                    text: visual.prompt,
                    url: window.location.href,
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            // Copy link to clipboard
            navigator.clipboard.writeText(window.location.href);
        }
    }, [visual]);

    const handleCopyPrompt = useCallback(() => {
        navigator.clipboard.writeText(visual.prompt);
        // Show toast notification
    }, [visual]);

    // ─────────────────────────────────────────────────────────────────────────
    // GRID VARIANT
    // ─────────────────────────────────────────────────────────────────────────
    if (variant === 'grid') {
        return (
            <div
                className="group relative bg-white rounded-2xl shadow-soft overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden">
                    <img
                        src={visual.thumbnail_url || visual.image_url}
                        alt={visual.title || visual.prompt}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />

                    {/* Featured badge */}
                    {visual.visibility === 'featured' && (
                        <div className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            Featured
                        </div>
                    )}

                    {/* Remix badge */}
                    {visual.parent_id && (
                        <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <GitFork className="w-3 h-3" />
                            Remix
                        </div>
                    )}

                    {/* Hover overlay */}
                    <div className={`
                        absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent
                        transition-opacity duration-300
                        ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}>
                        {/* Actions */}
                        <div className="absolute top-2 right-2 flex gap-2">
                            <button
                                onClick={() => onExpand?.(visual)}
                                className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
                                title="Expand"
                            >
                                <Maximize2 className="w-4 h-4 text-charcoal-soft" />
                            </button>
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
                                title="More options"
                            >
                                <MoreHorizontal className="w-4 h-4 text-charcoal-soft" />
                            </button>
                        </div>

                        {/* Bottom info */}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-sm font-medium line-clamp-2 mb-2">
                                {visual.title || visual.prompt}
                            </p>
                            
                            {showActions && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onRemix?.(visual)}
                                        className="flex-1 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white text-sm font-bold py-2 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                                    >
                                        <GitFork className="w-4 h-4" />
                                        Remix
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                        title="Download"
                                    >
                                        <Download className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dropdown menu */}
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                            <div className="absolute top-12 right-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[160px] animate-fadeIn">
                                <button
                                    onClick={() => { handleCopyPrompt(); setShowMenu(false); }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" /> Copy prompt
                                </button>
                                <button
                                    onClick={() => { handleShare(); setShowMenu(false); }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Share2 className="w-4 h-4" /> Share
                                </button>
                                {visual.parent_id && (
                                    <button
                                        onClick={() => { onViewLineage?.(visual); setShowMenu(false); }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4" /> View lineage
                                    </button>
                                )}
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-400"
                                >
                                    <Bookmark className="w-4 h-4" /> Save
                                </button>
                                <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-400"
                                >
                                    <Flag className="w-4 h-4" /> Report
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Card footer */}
                <div className="p-3">
                    {/* User row */}
                    {showUser && visual.user && (
                        <div 
                            className="flex items-center gap-2 mb-2 cursor-pointer"
                            onClick={() => onUserClick?.(visual.user_id)}
                        >
                            <img
                                src={visual.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${visual.user_id}`}
                                alt={visual.user.display_name}
                                className="w-6 h-6 rounded-full"
                            />
                            <span className="text-sm font-medium text-charcoal-soft truncate">
                                {visual.user.display_name}
                            </span>
                            <span className="text-xs text-gray-400 ml-auto">
                                {formatTimeAgo(visual.created_at)}
                            </span>
                        </div>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {formatCount(visual.view_count)}
                            </span>
                            {visual.remix_count > 0 && (
                                <span className="flex items-center gap-1">
                                    <GitFork className="w-3.5 h-3.5" />
                                    {formatCount(visual.remix_count)}
                                </span>
                            )}
                        </div>

                        {/* Mini reactions */}
                        {showReactions && visual.reaction_count > 0 && (
                            <MiniReactionDisplay 
                                reactions={reactions.length > 0 ? reactions : [{ type: 'heart', count: visual.reaction_count }]}
                            />
                        )}
                    </div>

                    {/* Full reaction bar */}
                    {showReactions && isHovered && (
                        <div className="mt-3 pt-3 border-t border-gray-100 animate-fadeIn">
                            <ReactionBar
                                visualId={visual.id}
                                initialReactions={reactions}
                                userReactions={visual.user_reactions}
                                size="sm"
                                maxVisible={6}
                                onReactionChange={setReactions}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPACT VARIANT
    // ─────────────────────────────────────────────────────────────────────────
    if (variant === 'compact') {
        return (
            <div
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onExpand?.(visual)}
            >
                <img
                    src={visual.thumbnail_url || visual.image_url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-soft truncate">
                        {visual.title || visual.prompt.slice(0, 40)}...
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{formatTimeAgo(visual.created_at)}</span>
                        {visual.reaction_count > 0 && (
                            <>
                                <span>•</span>
                                <span>{REACTION_EMOJIS.heart} {visual.reaction_count}</span>
                            </>
                        )}
                    </div>
                </div>
                {visual.parent_id && (
                    <GitFork className="w-4 h-4 text-purple-400 flex-shrink-0" />
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FEATURED VARIANT (larger, hero-style)
    // ─────────────────────────────────────────────────────────────────────────
    if (variant === 'featured') {
        return (
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                    src={visual.image_url}
                    alt={visual.title || visual.prompt}
                    className="w-full aspect-video object-cover"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Crown className="w-5 h-5 text-yellow-400" />
                        <span className="text-yellow-400 font-bold text-sm">Featured Creation</span>
                    </div>
                    
                    <h3 className="text-white text-2xl font-heading font-bold mb-2">
                        {visual.title || 'Untitled'}
                    </h3>
                    
                    <p className="text-white/80 text-sm mb-4 line-clamp-2">
                        {visual.prompt}
                    </p>

                    <div className="flex items-center justify-between">
                        {visual.user && (
                            <div className="flex items-center gap-2">
                                <img
                                    src={visual.user.avatar_url}
                                    alt={visual.user.display_name}
                                    className="w-8 h-8 rounded-full ring-2 ring-white"
                                />
                                <span className="text-white font-medium">
                                    {visual.user.display_name}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onRemix?.(visual)}
                                className="bg-gradient-to-r from-coral-burst to-gold-sunshine text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:opacity-90"
                            >
                                <GitFork className="w-4 h-4" />
                                Remix This
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default/Detail variant
    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <img
                src={visual.image_url}
                alt={visual.title || visual.prompt}
                className="w-full"
            />
            <div className="p-4">
                {showReactions && (
                    <ReactionBar
                        visualId={visual.id}
                        initialReactions={reactions}
                        userReactions={visual.user_reactions}
                        size="md"
                        onReactionChange={setReactions}
                    />
                )}
            </div>
        </div>
    );
};

export default SharedVisualCard;
