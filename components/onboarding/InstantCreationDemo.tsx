import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Star, Wand2 } from 'lucide-react';
import { useOnboarding } from './OnboardingState';

// Theme images
const themeImages = {
  cosmos: '/images/onboarding/theme-cosmos.png',
  kingdom: '/images/onboarding/theme-kingdom.png',
  cell: '/images/onboarding/theme-cell.png',
  genMascot: '/images/onboarding/gen-mascot.png',
};

// Theme videos
const themeVideos = {
  cell: '/images/onboarding/Cinematic_microscopic_journey_202512151050_ve.mp4',
};

// Particle explosion effect
const ParticleExplosion = ({ active }: { active: boolean }) => {
  if (!active) return null;
  
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1, 0.5],
            x: Math.cos((i * 30) * Math.PI / 180) * 150,
            y: Math.sin((i * 30) * Math.PI / 180) * 150,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500"
        />
      ))}
    </>
  );
};

// Typing effect for generated text
const TypewriterText = ({ text, onComplete }: { text: string; onComplete: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 30);
      return () => clearTimeout(timer);
    } else {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  return (
    <span>
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-6 bg-white ml-1 align-middle"
      />
    </span>
  );
};

export const InstantCreationDemo: React.FC = () => {
  const { theme, setStep, sparkPoints, addSparkPoints } = useOnboarding();
  const [phase, setPhase] = useState<'idle' | 'generating' | 'revealed' | 'complete'>('idle');
  const [showSparkReward, setShowSparkReward] = useState(false);

  const getThemeContent = () => {
    switch (theme) {
      case 'cosmos':
        return {
          prompt: "A starship ignites its quantum engines...",
          generated: "The Aurora-7 erupted from the nebula in a cascade of stellar fire, its crystalline hull catching the light of a thousand dying suns. Captain Zara gripped the helm as reality bent around them—they were about to jump across the galaxy.",
          visualImage: themeImages.cosmos,
          visualGradient: 'from-blue-400 via-purple-500 to-pink-500',
          bgGradient: 'from-slate-900 via-indigo-950 to-slate-900',
          accentColor: 'text-blue-400',
          glowColor: 'shadow-[0_0_80px_rgba(99,102,241,0.4)]',
        };
      case 'kingdom':
        return {
          prompt: "The dragon awakens in the mountain...",
          generated: "Flames licked the ancient stones as Valdris opened one golden eye. A thousand years of slumber ended. Below, the kingdom of Aethermoor slept unaware that their protector—and their doom—had finally stirred from the depths.",
          visualImage: themeImages.kingdom,
          visualGradient: 'from-amber-400 via-orange-500 to-red-600',
          bgGradient: 'from-slate-900 via-amber-950 to-slate-900',
          accentColor: 'text-amber-400',
          glowColor: 'shadow-[0_0_80px_rgba(245,158,11,0.4)]',
        };
      case 'cell':
        return {
          prompt: "Inside the cell, a journey begins...",
          generated: "The mitochondria hummed with ancient energy, powering the cell's impossible machinery. Ribosomes danced along messenger RNA, translating the code of life itself into proteins that would heal, grow, and transform.",
          visualImage: themeImages.cell,
          visualVideo: themeVideos.cell,
          visualGradient: 'from-emerald-400 via-teal-500 to-cyan-600',
          bgGradient: 'from-slate-900 via-emerald-950 to-slate-900',
          accentColor: 'text-emerald-400',
          glowColor: 'shadow-[0_0_80px_rgba(16,185,129,0.4)]',
        };
      default:
        return {
          prompt: "Once upon a time...",
          generated: "In a world where imagination shaped reality, a single spark of creativity was about to change everything. The canvas awaited its first stroke of genius.",
          visualImage: themeImages.genMascot,
          visualGradient: 'from-purple-400 via-pink-500 to-amber-500',
          bgGradient: 'from-slate-900 via-purple-950 to-slate-900',
          accentColor: 'text-purple-400',
          glowColor: 'shadow-[0_0_80px_rgba(168,85,247,0.4)]',
        };
    }
  };

  const content = getThemeContent();

  const handleActivate = () => {
    setPhase('generating');
  };

  const handleGenerationComplete = () => {
    setPhase('revealed');
    addSparkPoints(25);
    setTimeout(() => setShowSparkReward(true), 300);
    setTimeout(() => setPhase('complete'), 1500);
  };

  const handleContinue = () => {
    // Go to Pro reveal moment - psychological peak conversion opportunity
    setStep('proreveal');
  };

  return (
    <div className={`relative h-full min-h-full flex flex-col items-center justify-start px-3 py-6 md:p-6 overflow-x-hidden overflow-y-auto bg-linear-to-br ${content.bgGradient}`}>
      {/* Ambient effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Radial gradient spotlight */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
        
        {/* Floating stars */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: Math.random() * 2,
              repeat: Infinity,
            }}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      {/* Spark Points indicator */}
      <AnimatePresence>
        {sparkPoints > 0 && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-4 right-3 md:top-24 md:right-6 z-20"
          >
            <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-xl rounded-full border border-amber-400/30">
              <Star className="w-4 h-4 md:w-5 md:h-5 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold text-sm md:text-base">{sparkPoints}</span>
              <span className="text-white/60 text-xs md:text-sm hidden md:inline">Sparks</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spark reward animation */}
      <AnimatePresence>
        {showSparkReward && (
          <motion.div
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: -50, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="absolute top-1/4 md:top-1/3 z-30 flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-lg shadow-amber-500/30"
          >
            <Star className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
            <span className="text-white font-bold text-base md:text-lg">+25 Sparks!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-3xl flex-1 flex flex-col justify-center">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 md:mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-3 md:mb-6"
          >
            <Wand2 className="w-3 h-3 md:w-4 md:h-4 text-amber-400" />
            <span className="text-white/70 text-xs md:text-sm font-medium">Experience the Magic</span>
          </motion.div>
          
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4 font-heading">
            Watch your words
            <br />
            <span className={content.accentColor}>come alive.</span>
          </h1>
          <p className="text-white/50 text-sm md:text-lg max-w-md mx-auto">
            Tap below to plant your first seed.
          </p>
        </motion.div>

        {/* Interactive Demo Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`relative bg-white/5 backdrop-blur-xl rounded-2xl md:rounded-3xl border border-white/10 p-4 md:p-8 lg:p-10 ${phase === 'revealed' || phase === 'complete' ? content.glowColor : ''}`}
        >
          {/* Particle explosion container */}
          <div className="absolute inset-0 overflow-hidden rounded-3xl">
            <ParticleExplosion active={phase === 'generating'} />
          </div>

          {/* Idle state - prompt */}
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center"
              >
                <p className="text-lg md:text-2xl lg:text-3xl font-serif text-white/80 mb-6 md:mb-8 italic">
                  "{content.prompt}"
                </p>
                
                <motion.button
                  onClick={handleActivate}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative inline-flex items-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 overflow-hidden rounded-full"
                >
                  {/* Button gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${content.visualGradient}`} />
                  
                  {/* Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  
                  {/* Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${content.visualGradient} blur-xl opacity-50 group-hover:opacity-70 transition-opacity`} />
                  
                  <span className="relative flex items-center gap-2 text-white font-bold text-base md:text-lg">
                    <Wand2 className="w-4 h-4 md:w-5 md:h-5" />
                    Tap to Generate
                  </span>
                </motion.button>
                
                <p className="mt-4 md:mt-6 text-white/30 text-xs md:text-sm animate-pulse">
                  ✨ One tap. Infinite possibilities.
                </p>
              </motion.div>
            )}

            {/* Generating state */}
            {phase === 'generating' && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                  transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
                  className="inline-block mb-6"
                >
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${content.visualGradient} p-0.5`}>
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </motion.div>
                
                <p className="text-xl text-white/70 font-serif italic">
                  <TypewriterText text={content.generated} onComplete={handleGenerationComplete} />
                </p>
              </motion.div>
            )}

            {/* Revealed/Complete state */}
            {(phase === 'revealed' || phase === 'complete') && (
              <motion.div
                key="revealed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Generated visual - Video or Image */}
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", bounce: 0.4 }}
                  className="flex justify-center mb-4 md:mb-8"
                >
                  <div className={`overflow-hidden rounded-2xl md:rounded-3xl ${content.glowColor} shadow-2xl`}>
                    {content.visualVideo ? (
                      <video
                        src={content.visualVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 object-cover rounded-2xl md:rounded-3xl"
                      />
                    ) : (
                      <div className={`p-4 md:p-6 bg-gradient-to-br ${content.visualGradient}`}>
                        <img 
                          src={content.visualImage}
                          alt="Generated visual"
                          className="w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32 object-contain drop-shadow-2xl rounded-xl md:rounded-3xl"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
                
                {/* Generated text */}
                <p className="text-base md:text-xl lg:text-2xl text-white/90 font-serif leading-relaxed text-center mb-4 md:mb-8">
                  "{content.generated}"
                </p>
                
                {/* Success message */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center gap-2 text-emerald-400 mb-4 md:mb-8"
                >
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-medium text-sm md:text-base">Your first creation is born!</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Continue Button */}
        <AnimatePresence>
          {phase === 'complete' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex justify-center"
            >
              <motion.button
                onClick={handleContinue}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 md:gap-3 px-6 py-3 md:px-10 md:py-5 bg-white text-slate-900 rounded-full font-bold text-base md:text-lg shadow-2xl shadow-white/20 hover:shadow-white/30 transition-all"
              >
                See What Else is Possible
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
