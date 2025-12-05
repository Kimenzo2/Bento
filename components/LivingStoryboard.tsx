import React from 'react';
import { motion } from 'framer-motion';
import { StoryBeat } from '../types';
import { Sparkles, Activity, Film } from 'lucide-react';

interface LivingStoryboardProps {
  beats: StoryBeat[];
  onBeatClick: (pageNumber: number) => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

const LivingStoryboard: React.FC<LivingStoryboardProps> = ({ beats, onBeatClick, onGenerate, isGenerating = false }) => {
  // Helper to determine color based on emotional tone
  const getToneColor = (tone: string) => {
    const t = tone.toLowerCase();
    if (t.includes('joy') || t.includes('happy')) return 'bg-yellow-400';
    if (t.includes('sad') || t.includes('melancholy')) return 'bg-blue-400';
    if (t.includes('tense') || t.includes('fear')) return 'bg-red-400';
    if (t.includes('calm') || t.includes('peace')) return 'bg-green-400';
    if (t.includes('myster')) return 'bg-purple-400';
    return 'bg-indigo-400'; // Default
  };

  if (!beats || beats.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
          <Film className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Storyboard Generated</h3>
        <p className="text-slate-400 mb-6 max-w-md">
          Generate a living storyboard to visualize your narrative arc, track emotional beats, and maintain pacing.
        </p>
        {onGenerate && (
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                Analyzing Story...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Storyboard
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-indigo-400" />
          Living Storyboard
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
            <span>Beat</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span>Tension</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto pb-6 hide-scrollbar">
        <div className="flex gap-4 px-2 min-w-max">
          {beats.map((beat, index) => (
            <motion.div
              key={`beat-${beat.pageNumber}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              onClick={() => onBeatClick(beat.pageNumber)}
              className="group relative w-64 flex-shrink-0 cursor-pointer"
            >
              {/* Connector Line */}
              {index < beats.length - 1 && (
                <div className="absolute top-1/2 left-full w-4 h-0.5 bg-slate-700/50 -translate-y-1/2 z-0" />
              )}

              <div className="relative z-10 h-full bg-slate-800/40 backdrop-blur-md border border-slate-700/50 hover:border-indigo-500/50 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                    Page {beat.pageNumber}
                  </span>
                  <div 
                    className={`w-2 h-2 rounded-full ${getToneColor(beat.emotionalTone)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} 
                    title={`Tone: ${beat.emotionalTone}`}
                  />
                </div>

                {/* Content */}
                <p className="text-sm text-slate-200 line-clamp-3 mb-4 min-h-[3.75rem]">
                  {beat.summary}
                </p>

                {/* Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Tension</span>
                    <span>{beat.tensionLevel}/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(beat.tensionLevel / 10) * 100}%` }}
                      transition={{ delay: 0.5 + (index * 0.05), duration: 0.8 }}
                      className={`h-full rounded-full ${
                        beat.tensionLevel > 7 ? 'bg-red-500' : 
                        beat.tensionLevel > 4 ? 'bg-orange-500' : 'bg-blue-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Hover Effect Overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LivingStoryboard;
