
import React from 'react';
import { GamificationState, AppMode } from '../types';
import { Trophy, Flame, Target, Lock, Gift, TrendingUp, Star } from 'lucide-react';

interface GamificationHubProps {
  gameState: GamificationState;
  setMode: (mode: AppMode) => void;
}

const GamificationHub: React.FC<GamificationHubProps> = ({ gameState, setMode }) => {
  const progressPercent = (gameState.currentXP / gameState.nextLevelXP) * 100;

  return (
    <div className="w-full max-w-6xl mx-auto p-6 pb-24 animate-fadeIn">
      
      <div className="text-center mb-10">
        <h1 className="font-heading font-bold text-4xl text-charcoal-soft mb-2 flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-gold-sunshine" />
          Author Journey
        </h1>
        <p className="text-cocoa-light font-body">Level up your creativity, unlock rewards, and become a legend.</p>
      </div>

      {/* Level Progress Header */}
      <div className="bg-white rounded-3xl shadow-soft-lg p-8 mb-10 border border-peach-soft relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-gold-sunshine/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
         
         <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center shadow-glow border-4 border-white">
                    <span className="font-heading font-bold text-5xl text-white">{gameState.level}</span>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-charcoal-soft text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {gameState.levelTitle}
                </div>
            </div>

            <div className="flex-1 w-full">
                <div className="flex justify-between text-sm font-bold mb-2 text-charcoal-soft">
                    <span>Current XP: {gameState.currentXP}</span>
                    <span>Next Level: {gameState.nextLevelXP} XP</span>
                </div>
                <div className="w-full h-6 bg-cream-base rounded-full border border-peach-soft overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-gold-sunshine to-coral-burst transition-all duration-1000 ease-out relative"
                        style={{ width: `${progressPercent}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                </div>
                <p className="text-xs text-cocoa-light mt-3 italic">
                    💡 Tip: Create a new book today to earn +50 XP!
                </p>
            </div>

            <div className="flex gap-4">
                 <div className="text-center bg-cream-base p-4 rounded-2xl border border-peach-soft min-w-[100px]">
                    <div className="font-heading font-bold text-2xl text-coral-burst flex items-center justify-center gap-1">
                        <Flame className="w-5 h-5" /> {gameState.currentStreak || 0}
                    </div>
                    <div className="text-xs font-bold text-cocoa-light uppercase">Day Streak</div>
                 </div>
                 <div className="text-center bg-cream-base p-4 rounded-2xl border border-peach-soft min-w-[100px]">
                    <div className="font-heading font-bold text-2xl text-charcoal-soft">
                        {gameState.booksCreatedCount}
                    </div>
                    <div className="text-xs font-bold text-cocoa-light uppercase">Books Created</div>
                 </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         
         {/* Daily Challenges */}
         <div className="md:col-span-2 bg-white rounded-3xl shadow-soft-md border border-white p-6">
             <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-bold text-xl text-charcoal-soft flex items-center gap-2">
                    <Target className="w-6 h-6 text-coral-burst" /> Daily Challenges
                </h2>
                <span className="text-xs font-bold bg-mint-breeze text-green-700 px-3 py-1 rounded-full">Resets in 4h 12m</span>
             </div>
             
             <div className="space-y-4">
                {gameState.dailyChallenges.map(challenge => (
                    <div key={challenge.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${challenge.completed ? 'bg-mint-breeze/20 border-mint-breeze' : 'bg-cream-soft border-peach-soft hover:border-coral-burst/50'}`}>
                        <div className="flex items-center gap-4">
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${challenge.completed ? 'bg-green-500 border-green-500 text-white' : 'border-cocoa-light'}`}>
                                {challenge.completed && <CheckIcon />}
                             </div>
                             <div>
                                <h3 className={`font-bold text-sm ${challenge.completed ? 'text-charcoal-soft line-through opacity-50' : 'text-charcoal-soft'}`}>{challenge.title}</h3>
                                <p className="text-xs text-cocoa-light flex items-center gap-1">
                                    Reward: <span className="text-gold-sunshine font-bold">+{challenge.xpReward} XP</span>
                                </p>
                             </div>
                        </div>
                        {!challenge.completed && (
                            <button 
                                onClick={() => setMode(AppMode.CREATION)}
                                className="px-4 py-2 bg-white text-coral-burst text-xs font-bold rounded-lg shadow-sm hover:bg-coral-burst hover:text-white transition-colors"
                            >
                                Go
                            </button>
                        )}
                    </div>
                ))}
             </div>
         </div>

         {/* Leaderboard Teaser */}
         <div className="bg-white rounded-3xl shadow-soft-md border border-white p-6">
            <h2 className="font-heading font-bold text-xl text-charcoal-soft flex items-center gap-2 mb-6">
                <TrendingUp className="w-6 h-6 text-blue-400" /> Top Creators
            </h2>
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((rank) => (
                    <div key={rank} className="flex items-center gap-3 p-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rank === 1 ? 'bg-gold-sunshine text-white shadow-glow' : 'bg-cream-base text-cocoa-light'}`}>
                            {rank}
                        </div>
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-charcoal-soft">Author {rank}</div>
                            <div className="text-xs text-cocoa-light">{10000 - (rank * 450)} XP</div>
                        </div>
                        {rank === 1 && <CrownIcon />}
                    </div>
                ))}
                <button className="w-full mt-4 py-2 text-sm text-coral-burst font-bold hover:bg-cream-soft rounded-lg transition-colors">
                    View Full Leaderboard
                </button>
            </div>
         </div>
      </div>

      {/* Badges Grid */}
      <div className="mt-8 bg-white rounded-3xl shadow-soft-md border border-white p-8">
        <h2 className="font-heading font-bold text-xl text-charcoal-soft flex items-center gap-2 mb-8">
            <Star className="w-6 h-6 text-purple-400" /> Achievements
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {gameState.badges.map(badge => (
                <div key={badge.id} className="flex flex-col items-center text-center group">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 
                        ${badge.unlocked 
                            ? 'bg-gradient-to-br from-cream-base to-white shadow-soft-md border-2 border-gold-sunshine' 
                            : 'bg-gray-100 border-2 border-transparent grayscale opacity-50'
                        } group-hover:scale-110`}>
                        <span className="text-3xl">{badge.icon === 'feather' ? '🪶' : badge.icon === 'rocket' ? '🚀' : badge.icon === 'book' ? '📖' : '💎'}</span>
                    </div>
                    <h3 className="text-sm font-bold text-charcoal-soft">{badge.name}</h3>
                    <p className="text-xs text-cocoa-light mt-1 line-clamp-2">{badge.description}</p>
                    {!badge.unlocked && <Lock className="w-3 h-3 text-gray-400 mt-2" />}
                </div>
            ))}
            
            {/* Locked Mystery Badges */}
            {[1, 2, 3].map(i => (
                 <div key={`locked-${i}`} className="flex flex-col items-center text-center opacity-30">
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                        <Lock className="w-6 h-6" />
                    </div>
                    <div className="h-4 w-16 bg-gray-200 rounded mt-1"></div>
                 </div>
            ))}
        </div>
      </div>

    </div>
  );
};

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const CrownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFD93D" stroke="#E6C229" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>
  </svg>
);

export default GamificationHub;
