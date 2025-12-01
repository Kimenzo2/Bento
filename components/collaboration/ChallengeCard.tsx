// ==============================================================================
// CHALLENGE CARD COMPONENT
// ==============================================================================
// Daily challenges display with timer, submissions, and leaderboard
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Challenge, ChallengeSubmission, ChallengeDifficulty } from '../../types/collaboration';
import { collaborationService } from '../../services/collaborationService';
import {
    Trophy,
    Clock,
    Users,
    Star,
    ChevronRight,
    Zap,
    Target,
    Award,
    Crown,
    Loader2,
    ImageIcon,
    ThumbsUp,
    Medal
} from 'lucide-react';

interface ChallengeCardProps {
    challenge: Challenge;
    variant?: 'card' | 'banner' | 'compact';
    showSubmissions?: boolean;
    onJoin?: (challenge: Challenge) => void;
    onViewDetails?: (challenge: Challenge) => void;
    onVote?: (submission: ChallengeSubmission) => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
    challenge,
    variant = 'card',
    showSubmissions = false,
    onJoin,
    onViewDetails,
    onVote,
}) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [submissions, setSubmissions] = useState<ChallengeSubmission[]>(challenge.top_submissions || []);
    const [isLoading, setIsLoading] = useState(false);

    // Calculate time remaining
    useEffect(() => {
        const updateTime = () => {
            const now = Date.now();
            const endTime = new Date(challenge.ends_at).getTime();
            setTimeRemaining(Math.max(0, endTime - now));
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [challenge.ends_at]);

    // Format time remaining
    const formatTime = useMemo(() => {
        if (timeRemaining <= 0) return 'Ended';

        const hours = Math.floor(timeRemaining / 3600000);
        const minutes = Math.floor((timeRemaining % 3600000) / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);

        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, [timeRemaining]);

    // Get difficulty color and label
    const getDifficultyConfig = (difficulty: ChallengeDifficulty) => {
        switch (difficulty) {
            case 'easy':
                return { color: 'bg-green-100 text-green-600', label: 'Easy', stars: 1 };
            case 'medium':
                return { color: 'bg-yellow-100 text-yellow-600', label: 'Medium', stars: 2 };
            case 'hard':
                return { color: 'bg-orange-100 text-orange-600', label: 'Hard', stars: 3 };
            case 'expert':
                return { color: 'bg-red-100 text-red-600', label: 'Expert', stars: 4 };
            default:
                return { color: 'bg-gray-100 text-gray-600', label: 'Unknown', stars: 0 };
        }
    };

    const difficultyConfig = getDifficultyConfig(challenge.difficulty);

    // Get status color
    const getStatusColor = () => {
        switch (challenge.status) {
            case 'active': return 'bg-green-500';
            case 'voting': return 'bg-purple-500';
            case 'upcoming': return 'bg-blue-500';
            case 'completed': return 'bg-gray-500';
            default: return 'bg-gray-500';
        }
    };

    // Handle vote
    const handleVote = async (submission: ChallengeSubmission) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            await collaborationService.voteForSubmission(submission.id);
            // Update local state
            setSubmissions(prev => prev.map(s => 
                s.id === submission.id 
                    ? { ...s, vote_count: s.vote_count + 1 }
                    : s
            ));
            onVote?.(submission);
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // BANNER VARIANT (Hero style for active challenges)
    // ─────────────────────────────────────────────────────────────────────────
    if (variant === 'banner') {
        return (
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 p-1">
                <div className="bg-white rounded-[22px] p-6 relative overflow-hidden">
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500" />
                    </div>

                    <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4">
                        {/* Left: Challenge info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">
                                    Daily Challenge
                                </span>
                                <span className={`${getStatusColor()} text-white text-xs px-2 py-0.5 rounded-full font-bold`}>
                                    {challenge.status === 'active' ? 'LIVE' : challenge.status.toUpperCase()}
                                </span>
                            </div>

                            <h2 className="text-2xl font-heading font-bold text-charcoal-soft mb-2">
                                {challenge.title}
                            </h2>

                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                                {challenge.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                {/* Difficulty */}
                                <span className={`${difficultyConfig.color} px-2 py-1 rounded-full font-bold text-xs flex items-center gap-1`}>
                                    <Target className="w-3 h-3" />
                                    {difficultyConfig.label}
                                </span>

                                {/* XP Reward */}
                                <span className="flex items-center gap-1 text-yellow-600 font-bold">
                                    <Zap className="w-4 h-4" />
                                    +{challenge.xp_reward} XP
                                </span>

                                {/* Participants */}
                                <span className="flex items-center gap-1 text-gray-500">
                                    <Users className="w-4 h-4" />
                                    {challenge.participant_count} joined
                                </span>
                            </div>
                        </div>

                        {/* Right: Timer and action */}
                        <div className="flex flex-col items-end gap-3">
                            {/* Timer */}
                            <div className="bg-gray-900 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                                <Clock className="w-4 h-4 text-coral-burst" />
                                <span className="font-mono font-bold text-lg">{formatTime}</span>
                            </div>

                            {/* Join button */}
                            {challenge.status === 'active' && !challenge.user_has_submitted && (
                                <button
                                    onClick={() => onJoin?.(challenge)}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
                                >
                                    <Trophy className="w-5 h-5" />
                                    Join Challenge
                                </button>
                            )}

                            {challenge.user_has_submitted && (
                                <span className="text-green-600 font-bold flex items-center gap-1">
                                    <Award className="w-5 h-5" />
                                    Submitted!
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Prompt hint */}
                    {challenge.prompt_hint && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-sm text-gray-500">
                                <span className="font-bold text-coral-burst">💡 Hint:</span>{' '}
                                {challenge.prompt_hint}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPACT VARIANT (for lists)
    // ─────────────────────────────────────────────────────────────────────────
    if (variant === 'compact') {
        return (
            <div
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onViewDetails?.(challenge)}
            >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${difficultyConfig.color} flex items-center justify-center`}>
                    <Trophy className="w-6 h-6" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-charcoal-soft truncate">{challenge.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            {challenge.xp_reward} XP
                        </span>
                    </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEFAULT CARD VARIANT
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="bg-white rounded-2xl shadow-soft-lg overflow-hidden border border-gray-100">
            {/* Cover image or gradient */}
            <div className="relative h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500">
                {challenge.cover_image_url && (
                    <img
                        src={challenge.cover_image_url}
                        alt={challenge.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                )}
                
                {/* Status badge */}
                <div className="absolute top-3 left-3">
                    <span className={`${getStatusColor()} text-white text-xs px-3 py-1 rounded-full font-bold`}>
                        {challenge.status === 'active' ? 'LIVE NOW' : challenge.status.toUpperCase()}
                    </span>
                </div>

                {/* Timer */}
                <div className="absolute top-3 right-3 bg-black/50 text-white px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                    <Clock className="w-3 h-3" />
                    <span className="font-mono text-sm font-bold">{formatTime}</span>
                </div>

                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                    <h3 className="text-white font-heading font-bold text-lg">{challenge.title}</h3>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Description */}
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {challenge.description}
                </p>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={`${difficultyConfig.color} px-2 py-1 rounded-full font-bold text-xs flex items-center gap-1`}>
                        {[...Array(difficultyConfig.stars)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                        {difficultyConfig.label}
                    </span>

                    <span className="flex items-center gap-1 text-xs text-yellow-600 font-bold">
                        <Zap className="w-3 h-3" />
                        +{challenge.xp_reward} XP
                    </span>

                    <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Users className="w-3 h-3" />
                        {challenge.submission_count} entries
                    </span>
                </div>

                {/* Top submissions preview */}
                {showSubmissions && submissions.length > 0 && (
                    <div className="mb-4">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Top Entries</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {submissions.slice(0, 5).map((sub, index) => (
                                <div key={sub.id} className="relative flex-shrink-0">
                                    <img
                                        src={sub.visual?.thumbnail_url || sub.visual?.image_url}
                                        alt=""
                                        className="w-16 h-16 rounded-lg object-cover"
                                    />
                                    {index < 3 && (
                                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                                        }`}>
                                            {index + 1}
                                        </div>
                                    )}
                                    <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1 rounded flex items-center gap-0.5">
                                        <ThumbsUp className="w-2 h-2" />
                                        {sub.vote_count}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                    {challenge.status === 'active' && (
                        <button
                            onClick={() => onJoin?.(challenge)}
                            disabled={challenge.user_has_submitted}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                challenge.user_has_submitted
                                    ? 'bg-green-100 text-green-600 cursor-default'
                                    : 'bg-gradient-to-r from-coral-burst to-gold-sunshine text-white hover:opacity-90'
                            }`}
                        >
                            {challenge.user_has_submitted ? (
                                <>
                                    <Award className="w-4 h-4" />
                                    Submitted
                                </>
                            ) : (
                                <>
                                    <Trophy className="w-4 h-4" />
                                    Join
                                </>
                            )}
                        </button>
                    )}

                    {challenge.status === 'voting' && (
                        <button
                            onClick={() => onViewDetails?.(challenge)}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors flex items-center justify-center gap-2"
                        >
                            <ThumbsUp className="w-4 h-4" />
                            Vote Now
                        </button>
                    )}

                    <button
                        onClick={() => onViewDetails?.(challenge)}
                        className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        Details
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

interface ChallengeLeaderboardProps {
    challenge: Challenge;
    submissions: ChallengeSubmission[];
    onVote?: (submission: ChallengeSubmission) => void;
    onViewVisual?: (submission: ChallengeSubmission) => void;
}

export const ChallengeLeaderboard: React.FC<ChallengeLeaderboardProps> = ({
    challenge,
    submissions,
    onVote,
    onViewVisual,
}) => {
    const sortedSubmissions = [...submissions].sort((a, b) => b.vote_count - a.vote_count);

    const getMedalColor = (rank: number) => {
        switch (rank) {
            case 0: return 'text-yellow-500';
            case 1: return 'text-gray-400';
            case 2: return 'text-amber-600';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-soft-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100">
                <h3 className="font-heading font-bold text-charcoal-soft flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    Leaderboard
                </h3>
            </div>

            <div className="divide-y divide-gray-50">
                {sortedSubmissions.map((submission, index) => (
                    <div
                        key={submission.id}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                    >
                        {/* Rank */}
                        <div className="w-8 text-center">
                            {index < 3 ? (
                                <Medal className={`w-6 h-6 mx-auto ${getMedalColor(index)}`} />
                            ) : (
                                <span className="text-gray-400 font-bold">{index + 1}</span>
                            )}
                        </div>

                        {/* Visual thumbnail */}
                        <img
                            src={submission.visual?.thumbnail_url || submission.visual?.image_url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => onViewVisual?.(submission)}
                        />

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <img
                                    src={submission.user?.avatar_url}
                                    alt=""
                                    className="w-6 h-6 rounded-full"
                                />
                                <span className="font-medium text-charcoal-soft truncate">
                                    {submission.user?.full_name || 'Anonymous'}
                                </span>
                            </div>
                        </div>

                        {/* Vote count and button */}
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-charcoal-soft">
                                {submission.vote_count}
                            </span>
                            <button
                                onClick={() => onVote?.(submission)}
                                className="p-2 rounded-full hover:bg-coral-burst/10 text-gray-400 hover:text-coral-burst transition-colors"
                                title="Vote"
                            >
                                <ThumbsUp className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {sortedSubmissions.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No submissions yet</p>
                        <p className="text-xs">Be the first to submit!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChallengeCard;
