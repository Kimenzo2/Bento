import { IcoAward, IcoBook, IcoCrown, IcoLibrary, IcoPalette, IcoStar, IcoZap } from './IconscoutIcons';
import { Briefcase, Building2, Flame, Lock, Pencil, Target, TrendingUp, Trophy } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { AppMode, type GamificationState } from '../types';
import { mastra, type GamificationData } from '../src/services/mastraClient';
import { Button } from './ui/button';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  level_title: string;
  current_xp: number;
  total_xp: number;
  books_created_count: number;
  rank: number;
}

interface GamificationHubProps {
  gameState: GamificationState;
  setMode: (mode: AppMode) => void;
}

// ── Lucide badge icon map (covers all icons in achievement_definitions) ────────
const BADGE_ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen:  <IcoBook  className="w-8 h-8 text-coral-burst" />,
  Library:   <IcoLibrary  className="w-8 h-8 text-blue-500" />,
  Building2: <Building2 className="w-8 h-8 text-purple-500" />,
  Pencil:    <Pencil   className="w-8 h-8 text-teal-500" />,
  Palette:   <IcoPalette  className="w-8 h-8 text-pink-500" />,
  Flame:     <Flame    className="w-8 h-8 text-orange-500" />,
  Zap:       <IcoZap      className="w-8 h-8 text-yellow-500" />,
  Crown:     <IcoCrown    className="w-8 h-8 text-gold-sunshine" />,
  Briefcase: <Briefcase className="w-8 h-8 text-slate-500" />,
  Award:     <IcoAward    className="w-8 h-8 text-emerald-500" />,
};

const BadgeIcon: React.FC<{ icon: string }> = ({ icon }) =>
  (BADGE_ICON_MAP[icon] as React.ReactElement) ?? <IcoStar className="w-8 h-8 text-cocoa-light" />;

// ── Time-to-midnight helper (updates every minute) ────────────────────────────
function timeUntilMidnight(): string {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h    = Math.floor(diff / 3_600_000);
  const m    = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────
const GamificationHub: React.FC<GamificationHubProps> = ({
  gameState: initialGameState,
  setMode,
}) => {
  const [gameState, setGameState]               = useState<GamificationState>(initialGameState);
  const [mastraLoaded, setMastraLoaded]         = useState(false);
  const [leaderboard, setLeaderboard]           = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [resetTimer, setResetTimer]             = useState(timeUntilMidnight());

  // ── Tick the reset timer every minute ──────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setResetTimer(timeUntilMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch live gamification state from Mastra backend ──────────────────────
  useEffect(() => {
    let cancelled = false;
    mastra.agents.gamification
      .getState()
      .then((data: GamificationData) => {
        if (!cancelled) {
          setGameState({
            level:             data.level,
            currentXP:         data.currentXP,
            nextLevelXP:       data.nextLevelXP,
            levelTitle:        data.levelTitle,
            currentStreak:     data.currentStreak,
            booksCreatedCount: data.booksCreatedCount,
            badges:            data.badges,
            dailyChallenges:   data.dailyChallenges,
          });
          setMastraLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('[GamificationHub] Mastra unavailable, using prop data:', err);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Stay synced with prop while Mastra hasn't responded ────────────────────
  useEffect(() => {
    if (!mastraLoaded) setGameState(initialGameState);
  }, [initialGameState, mastraLoaded]);

  // ── Fetch real leaderboard from DB ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('leaderboard_top100')
          .select('user_id, display_name, avatar_url, level, level_title, current_xp, total_xp, books_created_count, rank')
          .order('rank', { ascending: true })
          .limit(5);

        if (!cancelled && !error && data) {
          setLeaderboard(data as LeaderboardEntry[]);
        }
      } catch (err) {
        console.warn('[GamificationHub] Leaderboard fetch failed:', err);
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const progressPercent = useMemo(
    () =>
      gameState.nextLevelXP > 0
        ? Math.min((gameState.currentXP / gameState.nextLevelXP) * 100, 100)
        : 0,
    [gameState.currentXP, gameState.nextLevelXP],
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-28 animate-fadeIn">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <h1 className="font-heading font-bold text-4xl text-charcoal-soft mb-2 flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-gold-sunshine" />
          Author Journey
        </h1>
        <p className="text-cocoa-light font-body">
          Level up your creativity, unlock rewards, and become a legend.
        </p>
      </div>

      {/* ── Level Progress Card ──────────────────────────────────────────────── */}
      <div className="bg-surface rounded-3xl p-8 mb-10 border border-peach-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-sunshine/10 rounded-full -mr-16 -mt-16 blur-3xl" />

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          {/* Level badge */}
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-linear-to-br from-gold-sunshine to-coral-burst flex items-center justify-center border-4 border-white">
              <span className="font-heading font-bold text-5xl text-white">{gameState.level}</span>
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-charcoal-soft text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              {gameState.levelTitle}
            </div>
          </div>

          {/* XP bar */}
          <div className="flex-1 w-full">
            <div className="flex justify-between text-sm font-bold mb-2 text-charcoal-soft">
              <span>Current XP: {gameState.currentXP.toLocaleString()}</span>
              <span>Next Level: {gameState.nextLevelXP.toLocaleString()} XP</span>
            </div>
            <div className="w-full h-6 bg-cream-base rounded-full border border-peach-soft overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-gold-sunshine to-coral-burst transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-surface/20 animate-[pulse_2s_infinite]" />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <div className="text-center bg-cream-base p-4 rounded-2xl border border-peach-soft min-w-[6rem]">
              <div className="font-heading font-bold text-2xl text-coral-burst flex items-center justify-center gap-1">
                <Flame className="w-5 h-5" /> {gameState.currentStreak ?? 0}
              </div>
              <div className="text-xs font-bold text-cocoa-light uppercase">Day Streak</div>
            </div>
            <div className="text-center bg-cream-base p-4 rounded-2xl border border-peach-soft min-w-[6rem]">
              <div className="font-heading font-bold text-2xl text-charcoal-soft">
                {gameState.booksCreatedCount}
              </div>
              <div className="text-xs font-bold text-cocoa-light uppercase">Books Created</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* ── Daily Challenges ────────────────────────────────────────────────── */}
        <div className="md:col-span-2 bg-surface rounded-3xl border border-peach-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-xl text-charcoal-soft flex items-center gap-2">
              <Target className="w-6 h-6 text-coral-burst" /> Daily Challenges
            </h2>
            <span className="text-xs font-bold bg-mint-breeze text-green-700 px-3 py-1 rounded-full">
              Resets in {resetTimer}
            </span>
          </div>

          {gameState.dailyChallenges.length === 0 ? (
            <div className="text-center py-10">
              <Target className="w-10 h-10 text-cocoa-light/40 mx-auto mb-3" />
              <p className="text-sm text-cocoa-light">No challenges today yet — check back soon!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gameState.dailyChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    challenge.completed
                      ? 'bg-mint-breeze/20 border-mint-breeze'
                      : 'bg-cream-soft border-peach-soft hover:border-coral-burst/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                        challenge.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-cocoa-light'
                      }`}
                    >
                      {challenge.completed && <CheckIcon />}
                    </div>
                    <div>
                      <h3
                        className={`font-bold text-sm ${
                          challenge.completed
                            ? 'text-charcoal-soft line-through opacity-50'
                            : 'text-charcoal-soft'
                        }`}
                      >
                        {challenge.title}
                      </h3>
                      <p className="text-xs text-cocoa-light flex items-center gap-1">
                        Reward:{' '}
                        <span className="text-gold-sunshine font-bold">+{challenge.xpReward} XP</span>
                      </p>
                    </div>
                  </div>
                  {!challenge.completed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode(AppMode.CREATION)}
                      className="px-4 py-2 bg-surface text-coral-burst border border-peach-soft/50 hover:bg-coral-burst hover:text-white"
                    >
                      Go
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Real Leaderboard (DB-driven) ─────────────────────────────────────── */}
        <div className="bg-surface rounded-3xl border border-peach-soft p-6">
          <h2 className="font-heading font-bold text-xl text-charcoal-soft flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-400" /> Top Creators
          </h2>

          {leaderboardLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-peach-soft/40" />
                  <div className="w-8 h-8 rounded-full bg-peach-soft/40" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 bg-peach-soft/40 rounded" />
                    <div className="h-2 w-16 bg-peach-soft/30 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-10">
              <TrendingUp className="w-10 h-10 text-cocoa-light/40 mx-auto mb-3" />
              <p className="text-sm text-cocoa-light">Be the first on the leaderboard!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboard.map((entry) => (
                <div key={entry.user_id} className="flex items-center gap-3 p-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      entry.rank === 1 ? 'bg-gold-sunshine text-white' : 'bg-cream-base text-cocoa-light'
                    }`}
                  >
                    {entry.rank}
                  </div>
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-coral-burst/20 flex items-center justify-center text-coral-burst text-xs font-bold">
                        {entry.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-charcoal-soft truncate">{entry.display_name}</div>
                    <div className="text-xs text-cocoa-light">{entry.total_xp.toLocaleString()} XP</div>
                  </div>
                  {entry.rank === 1 && <CrownIcon />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Achievements (Badges) ────────────────────────────────────────────── */}
      <div className="mt-8 bg-surface rounded-3xl border border-peach-soft p-4 sm:p-8">
        <h2 className="font-heading font-bold text-xl text-charcoal-soft flex items-center gap-2 mb-8">
          <IcoStar className="w-6 h-6 text-purple-400" /> Achievements
        </h2>

        {gameState.badges.length === 0 ? (
          <div className="text-center py-10">
            <IcoAward className="w-10 h-10 text-cocoa-light/40 mx-auto mb-3" />
            <p className="text-sm text-cocoa-light">Start creating to unlock your first achievement!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {gameState.badges.map((badge) => (
              <div key={badge.id} className="flex flex-col items-center text-center group">
                <div
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300
                    ${
                      badge.unlocked
                        ? 'bg-linear-to-br from-cream-base to-white border border-gold-sunshine'
                        : 'bg-peach-soft/30 border border-transparent grayscale opacity-50'
                    } group-hover:scale-110`}
                >
                  <BadgeIcon icon={badge.icon} />
                </div>
                <h3 className="text-sm font-bold text-charcoal-soft">{badge.name}</h3>
                <p className="text-xs text-cocoa-light mt-1 line-clamp-2">{badge.description}</p>
                {!badge.unlocked && <Lock className="w-3 h-3 text-cocoa-light/60 mt-2" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Micro-components ──────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="#FFD93D"
    stroke="#E6C229"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

export default GamificationHub;
