import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Lock, Mail, Shield, Sparkles, Star } from 'lucide-react';
import { useOnboarding } from './OnboardingState';
import { useAuth } from '../../contexts/AuthContext';

export const SaveMasterpieceModal: React.FC = () => {
  const { theme, setStep, sparkPoints } = useOnboarding();
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      setStep('welcome');
    } catch (error) {
      setIsLoading(false);
    }
  };

  const handleSkipForNow = () => {
    setStep('welcome');
  };

  const getThemeEmoji = () => {
    switch (theme) {
      case 'cosmos': return '🚀';
      case 'kingdom': return '🏰';
      case 'cell': return '🧬';
      default: return '✨';
    }
  };

  const getThemeGradient = () => {
    switch (theme) {
      case 'cosmos': return 'from-indigo-600 via-purple-600 to-blue-600';
      case 'kingdom': return 'from-amber-500 via-orange-500 to-red-500';
      case 'cell': return 'from-emerald-500 via-teal-500 to-cyan-500';
      default: return 'from-purple-600 via-pink-600 to-amber-500';
    }
  };

  const getThemeName = () => {
    switch (theme) {
      case 'cosmos': return 'A Cosmic Journey';
      case 'kingdom': return 'Tales of the Realm';
      case 'cell': return 'The Living World';
      default: return 'Your First Story';
    }
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0d0d1a] to-slate-900" />
      
      {/* Ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        className={`absolute w-[500px] h-[500px] rounded-full bg-gradient-to-br ${getThemeGradient()} blur-3xl opacity-20`}
        style={{ top: '-20%', right: '-10%' }}
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          {/* Preview header */}
          <div className={`relative h-44 bg-gradient-to-br ${getThemeGradient()} overflow-hidden`}>
            {/* Pattern overlay */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />
            
            {/* Floating emoji */}
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl"
            >
              {getThemeEmoji()}
            </motion.div>
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
            
            {/* Story info */}
            <div className="absolute bottom-4 left-6 right-6">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-1">Your Creation</p>
              <h3 className="text-xl font-bold text-white font-heading">{getThemeName()}</h3>
            </div>
            
            {/* Spark points badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-sm rounded-full border border-white/10">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold text-sm">{sparkPoints}</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-4"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-white/70 text-sm font-medium">One step away</span>
              </motion.div>
              
              <h2 className="text-2xl font-bold text-white mb-2 font-heading">
                Save your masterpiece.
              </h2>
              <p className="text-white/50">
                Create a free account to keep your story and unlock the full Genesis experience.
              </p>
            </div>

            {/* Auth buttons */}
            <div className="space-y-3 mb-6">
              <motion.button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full relative group py-4 px-6 rounded-xl font-medium overflow-hidden"
              >
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-white to-slate-100" />
                
                {/* Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                <span className="relative flex items-center justify-center gap-3 text-slate-900">
                  {isLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-5 h-5" />
                      </motion.div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                      Continue with Google
                    </>
                  )}
                </span>
              </motion.button>
              
              <button className="w-full py-4 px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-white/80 hover:text-white transition-all flex items-center justify-center gap-2">
                <Mail className="w-5 h-5" />
                Use Email Instead
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="flex items-center gap-1.5 text-white/40 text-xs">
                <Shield className="w-3.5 h-3.5" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/40 text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Private</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/40 text-xs">
                <Check className="w-3.5 h-3.5" />
                <span>Free</span>
              </div>
            </div>

            {/* Skip option */}
            <div className="text-center">
              <button
                onClick={handleSkipForNow}
                className="text-white/40 hover:text-white/70 text-sm font-medium transition-colors"
              >
                Skip for now →
              </button>
            </div>
          </div>
        </div>

        {/* Legal note */}
        <p className="text-center text-white/30 text-xs mt-6 max-w-xs mx-auto">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};
