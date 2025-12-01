// ==============================================================================
// REACTION BAR COMPONENT
// ==============================================================================
// Quick emoji reactions with animations and real-time updates
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { ReactionType, ReactionCount, REACTION_EMOJIS, REACTION_LABELS } from '../../types/collaboration';
import { collaborationService } from '../../services/collaborationService';

interface ReactionBarProps {
    visualId: string;
    initialReactions?: ReactionCount[];
    userReactions?: ReactionType[];
    size?: 'sm' | 'md' | 'lg';
    showLabels?: boolean;
    maxVisible?: number;
    onReactionChange?: (reactions: ReactionCount[]) => void;
}

const ReactionBar: React.FC<ReactionBarProps> = ({
    visualId,
    initialReactions = [],
    userReactions = [],
    size = 'md',
    showLabels = false,
    maxVisible = 5,
    onReactionChange,
}) => {
    const [reactions, setReactions] = useState<ReactionCount[]>(initialReactions);
    const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set(userReactions));
    const [isExpanded, setIsExpanded] = useState(false);
    const [animatingReaction, setAnimatingReaction] = useState<ReactionType | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Size configurations
    const sizeConfig = {
        sm: { button: 'w-6 h-6', emoji: 'text-sm', count: 'text-xs', gap: 'gap-1' },
        md: { button: 'w-8 h-8', emoji: 'text-base', count: 'text-xs', gap: 'gap-1.5' },
        lg: { button: 'w-10 h-10', emoji: 'text-xl', count: 'text-sm', gap: 'gap-2' },
    };

    const config = sizeConfig[size];

    // All available reactions
    const allReactions: ReactionType[] = [
        'fire', 'heart', 'star', 'mindblown', 'clap',
        'rocket', 'sparkles', 'crown', 'lightbulb', 'gem'
    ];

    // Sort reactions by count and get visible ones
    const sortedReactions = [...reactions].sort((a, b) => b.count - a.count);
    const visibleReactions = isExpanded ? allReactions : sortedReactions.slice(0, maxVisible).map(r => r.type);

    const handleReaction = useCallback(async (type: ReactionType) => {
        if (isLoading) return;

        setIsLoading(true);
        setAnimatingReaction(type);

        try {
            const result = await collaborationService.toggleReaction(visualId, type);
            
            if (result.success && result.data) {
                const added = result.data.added;

                // Update local state
                setMyReactions(prev => {
                    const next = new Set(prev);
                    if (added) {
                        next.add(type);
                    } else {
                        next.delete(type);
                    }
                    return next;
                });

                setReactions(prev => {
                    const existing = prev.find(r => r.type === type);
                    if (existing) {
                        const updated = prev.map(r => 
                            r.type === type 
                                ? { ...r, count: Math.max(0, r.count + (added ? 1 : -1)) }
                                : r
                        ).filter(r => r.count > 0);
                        
                        if (onReactionChange) onReactionChange(updated);
                        return updated;
                    } else if (added) {
                        const updated = [...prev, { type, count: 1 }];
                        if (onReactionChange) onReactionChange(updated);
                        return updated;
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error('Error toggling reaction:', error);
        } finally {
            setIsLoading(false);
            setTimeout(() => setAnimatingReaction(null), 300);
        }
    }, [visualId, isLoading, onReactionChange]);

    const getReactionCount = (type: ReactionType): number => {
        return reactions.find(r => r.type === type)?.count || 0;
    };

    return (
        <div className="relative">
            {/* Reaction buttons row */}
            <div className={`flex items-center ${config.gap} flex-wrap`}>
                {/* Existing reactions with counts */}
                {!isExpanded && sortedReactions.slice(0, maxVisible).map(({ type, count }) => (
                    <button
                        key={type}
                        onClick={() => handleReaction(type)}
                        disabled={isLoading}
                        className={`
                            ${config.button} rounded-full flex items-center justify-center
                            transition-all duration-200 relative
                            ${myReactions.has(type)
                                ? 'bg-coral-burst/20 ring-2 ring-coral-burst'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }
                            ${animatingReaction === type ? 'scale-125' : 'hover:scale-110'}
                            ${isLoading ? 'cursor-wait opacity-75' : 'cursor-pointer'}
                        `}
                        title={`${REACTION_LABELS[type]} (${count})`}
                    >
                        <span className={`${config.emoji} ${animatingReaction === type ? 'animate-bounce' : ''}`}>
                            {REACTION_EMOJIS[type]}
                        </span>
                        {count > 0 && (
                            <span className={`
                                absolute -bottom-1 -right-1 
                                bg-charcoal-soft text-white rounded-full 
                                px-1 min-w-[16px] text-center
                                ${config.count}
                            `}>
                                {count > 99 ? '99+' : count}
                            </span>
                        )}
                    </button>
                ))}

                {/* Add reaction button (plus) */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`
                        ${config.button} rounded-full flex items-center justify-center
                        bg-gray-100 hover:bg-gray-200 transition-all
                        hover:scale-110 text-gray-500 font-bold
                    `}
                    title={isExpanded ? 'Show less' : 'Add reaction'}
                >
                    <span className={config.emoji}>{isExpanded ? '−' : '+'}</span>
                </button>
            </div>

            {/* Expanded reaction picker */}
            {isExpanded && (
                <div className="absolute top-full left-0 mt-2 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-3">
                        <div className="grid grid-cols-5 gap-2">
                            {allReactions.map(type => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        handleReaction(type);
                                        setIsExpanded(false);
                                    }}
                                    disabled={isLoading}
                                    className={`
                                        w-10 h-10 rounded-xl flex flex-col items-center justify-center
                                        transition-all duration-200
                                        ${myReactions.has(type)
                                            ? 'bg-coral-burst/20 ring-2 ring-coral-burst'
                                            : 'hover:bg-gray-100'
                                        }
                                        hover:scale-110
                                    `}
                                    title={REACTION_LABELS[type]}
                                >
                                    <span className="text-xl">{REACTION_EMOJIS[type]}</span>
                                    {showLabels && (
                                        <span className="text-[8px] text-gray-500 mt-0.5 truncate w-full text-center">
                                            {REACTION_LABELS[type]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        
                        {/* Quick reaction row */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-400">Pick a reaction</span>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="text-xs text-coral-burst hover:underline"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExpanded(false)}
                />
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MINI REACTION DISPLAY (for compact views)
// ─────────────────────────────────────────────────────────────────────────────

interface MiniReactionDisplayProps {
    reactions: ReactionCount[];
    maxShow?: number;
}

export const MiniReactionDisplay: React.FC<MiniReactionDisplayProps> = ({
    reactions,
    maxShow = 3,
}) => {
    const sorted = [...reactions].sort((a, b) => b.count - a.count);
    const visible = sorted.slice(0, maxShow);
    const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);

    if (totalCount === 0) return null;

    return (
        <div className="flex items-center gap-0.5">
            <div className="flex -space-x-1">
                {visible.map(({ type }) => (
                    <span 
                        key={type} 
                        className="text-sm bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                    >
                        {REACTION_EMOJIS[type]}
                    </span>
                ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">{totalCount}</span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING REACTION ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

interface FloatingReactionProps {
    type: ReactionType;
    x: number;
    y: number;
    onComplete: () => void;
}

export const FloatingReaction: React.FC<FloatingReactionProps> = ({
    type,
    x,
    y,
    onComplete,
}) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 1500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div
            className="fixed pointer-events-none z-[100] text-3xl animate-float-up"
            style={{ left: x, top: y }}
        >
            {REACTION_EMOJIS[type]}
        </div>
    );
};

export default ReactionBar;
