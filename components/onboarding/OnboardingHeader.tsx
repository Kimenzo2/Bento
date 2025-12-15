import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  onSkip?: () => void;
}

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  currentStep,
  totalSteps,
  onSkip,
}) => {
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 left-0 right-0 p-4 md:p-6 z-50"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          {/* Logo/Brand */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:block text-white/70 font-semibold">Genesis</span>
          </motion.div>

          {/* Progress bar container */}
          <div className="flex-1 relative">
            {/* Background track */}
            <div className="h-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
              {/* Progress fill */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="h-full relative"
              >
                {/* Gradient fill */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />
                
                {/* Shimmer effect */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-1/2"
                />
                
                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 blur-sm opacity-50" />
              </motion.div>
            </div>

            {/* Step indicators */}
            <div className="absolute top-full mt-2 left-0 right-0 flex justify-between px-1">
              {Array.from({ length: totalSteps }).map((_, idx) => {
                const stepProgress = ((idx + 1) / totalSteps) * 100;
                const isCompleted = progressPercent >= stepProgress;
                const isCurrent = currentStep === idx + 1;
                
                return (
                  <div
                    key={idx}
                    className={`flex flex-col items-center transition-all duration-300 ${
                      idx === 0 ? 'items-start' : idx === totalSteps - 1 ? 'items-end' : ''
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-gradient-to-br from-purple-400 to-pink-400 shadow-sm shadow-purple-500/50' 
                          : isCurrent 
                            ? 'bg-white' 
                            : 'bg-white/20'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step counter */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
            <span className="text-white font-bold text-sm">{currentStep}</span>
            <span className="text-white/40 text-sm">/</span>
            <span className="text-white/40 text-sm">{totalSteps}</span>
          </div>

          {/* Skip button */}
          {onSkip && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={onSkip}
              className="group flex items-center gap-2 px-4 py-2 rounded-full text-white/50 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-300"
            >
              <span className="text-sm font-medium">Skip</span>
              <X className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
