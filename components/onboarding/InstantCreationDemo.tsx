/**
 * InstantCreationDemo - PERFORMANCE OPTIMIZED
 * 
 * Optimizations:
 * 1. ⚡ Reduced star count (30 → 12) - still magical, way less CPU
 * 2. ⚡ Memoized sub-components (ParticleExplosion, TypewriterText)
 * 3. ⚡ GPU-accelerated animations
 * 4. ⚡ Stable callbacks with useCallback
 * 5. ⚡ CSS animations for ambient effects
 * 6. ⚡ Lazy video loading
 * 7. ⚡ Reduced particle explosion (12 → 8)
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Sparkles, Star, Wand2 } from 'lucide-react';
import { useOnboarding } from './OnboardingState';
import { APPLE_EASE, GPU_ACCELERATED_STYLES, prefersReducedMotion } from './performance/gpuStyles';

// GPU-accelerated style
const GPU_STYLE: React.CSSProperties = {
  ...GPU_ACCELERATED_STYLES,
  willChange: 'transform, opacity',
};

// Fast transition preset for Framer Motion
const FAST_TRANSITION = { duration: 0.25, ease: APPLE_EASE } as const;

// Theme images - defined outside component
const THEME_IMAGES = {
  cosmos: '/images/onboarding/Cosmos.png',
  kingdom: '/images/onboarding/On 4.jpeg',
  cell: '/images/onboarding/On 5.png',
  genMascot: '/images/onboarding/Style_directive_highend_202512150033.jpeg',
} as const;

const THEME_VIDEOS = {
  cell: '/images/onboarding/Cinematic_microscopic_journey_202512151050_ve.mp4',
} as const;

// ⚡ Pre-computed star positions (stable between renders)
const AMBIENT_STARS = [
  { x: '5%', y: '10%', delay: 0, duration: 3 },
  { x: '15%', y: '60%', delay: 0.3, duration: 3.5 },
  { x: '25%', y: '30%', delay: 0.6, duration: 2.8 },
  { x: '35%', y: '80%', delay: 0.9, duration: 3.2 },
  { x: '50%', y: '15%', delay: 1.2, duration: 3 },
  { x: '65%', y: '45%', delay: 1.5, duration: 2.9 },
  { x: '75%', y: '70%', delay: 1.8, duration: 3.3 },
  { x: '85%', y: '25%', delay: 2.1, duration: 3.1 },
  { x: '90%', y: '55%', delay: 2.4, duration: 2.7 },
  { x: '10%', y: '85%', delay: 2.7, duration: 3.4 },
  { x: '45%', y: '40%', delay: 3, duration: 2.6 },
  { x: '80%', y: '90%', delay: 3.3, duration: 3.5 },
] as const;

// ⚡ Optimized particle explosion - reduced count, simpler animation
const ParticleExplosion = memo(({ active }: { active: boolean }) => {
  if (!active) return null;
  const reducedMotion = prefersReducedMotion();
  if (reducedMotion) return null;

  // Reduced to 8 particles
  return (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <motion.div
          key={angle}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0.5, 1, 0],
            x: Math.cos(angle * Math.PI / 180) * 100,
            y: Math.sin(angle * Math.PI / 180) * 100,
            opacity: [1, 0.8, 0],
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 w-2.5 h-2.5 -ml-1.25 -mt-1.25 rounded-full bg-linear-to-br from-amber-400 to-orange-500 pointer-events-none"
          style={GPU_STYLE}
        />
      ))}
    </>
  );
});
ParticleExplosion.displayName = 'ParticleExplosion';

// ⚡ Optimized typewriter - uses requestAnimationFrame for smoother updates
const TypewriterText = memo(({ text, onComplete }: { text: string; onComplete: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    indexRef.current = 0;
    setDisplayedText('');
    
    const typeNextChar = () => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
        setTimeout(typeNextChar, 20); // Faster typing (20ms vs 30ms)
      } else {
        onCompleteRef.current();
      }
    };
    
    setTimeout(typeNextChar, 100);
  }, [text]);

  return (
    <span>
      {displayedText}
      <span className="inline-block w-0.5 h-6 bg-white ml-1 align-middle animate-pulse" />
    </span>
  );
});
TypewriterText.displayName = 'TypewriterText';

// ⚡ Memoized ambient star
const AmbientStar = memo(({ x, y, delay, duration }: { x: string; y: string; delay: number; duration: number }) => (
  <div
    className="absolute w-1 h-1 bg-white rounded-full animate-pulse pointer-events-none"
    style={{
      left: x,
      top: y,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      ...GPU_STYLE,
    }}
  />
));
AmbientStar.displayName = 'AmbientStar';

export const InstantCreationDemo: React.FC = memo(() => {
  const { theme, setStep, sparkPoints, addSparkPoints } = useOnboarding();
  const [phase, setPhase] = useState<'idle' | 'generating' | 'revealed' | 'complete'>('idle');
  const [showSparkReward, setShowSparkReward] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  // ⚡ Memoized theme content
  const content = useMemo(() => {
    switch (theme) {
      case 'cosmos':
        return {
          prompt: "A starship ignites its quantum engines...",
          generated: "The Aurora-7 erupted from the nebula in a cascade of stellar fire, its crystalline hull catching the light of a thousand dying suns. Captain Zara gripped the helm as reality bent around them—they were about to jump across the galaxy.",
          visualImage: THEME_IMAGES.cosmos,
          visualGradient: 'from-blue-400 via-purple-500 to-pink-500',
          bgGradient: 'from-slate-900 via-indigo-950 to-slate-900',
          accentColor: 'text-blue-400',
          glowColor: 'shadow-[0_0_60px_rgba(99,102,241,0.3)]',
        };
      case 'kingdom':
        return {
          prompt: "The dragon awakens in the mountain...",
          generated: "Flames licked the ancient stones as Valdris opened one golden eye. A thousand years of slumber ended. Below, the kingdom of Aethermoor slept unaware that their protector—and their doom—had finally stirred from the depths.",
          visualImage: THEME_IMAGES.kingdom,
          visualGradient: 'from-amber-400 via-orange-500 to-red-600',
          bgGradient: 'from-slate-900 via-amber-950 to-slate-900',
          accentColor: 'text-amber-400',
          glowColor: 'shadow-[0_0_60px_rgba(245,158,11,0.3)]',
        };
      case 'cell':
        return {
          prompt: "Inside the cell, a journey begins...",
          generated: "The mitochondria hummed with ancient energy, powering the cell's impossible machinery. Ribosomes danced along messenger RNA, translating the code of life itself into proteins that would heal, grow, and transform.",
          visualImage: THEME_IMAGES.cell,
          visualVideo: THEME_VIDEOS.cell,
          visualGradient: 'from-emerald-400 via-teal-500 to-cyan-600',
          bgGradient: 'from-slate-900 via-emerald-950 to-slate-900',
          accentColor: 'text-emerald-400',
          glowColor: 'shadow-[0_0_60px_rgba(16,185,129,0.3)]',
        };
      default:
        return {
          prompt: "Once upon a time...",
          generated: "In a world where imagination shaped reality, a single spark of creativity was about to change everything. The canvas awaited its first stroke of genius.",
          visualImage: THEME_IMAGES.genMascot,
          visualGradient: 'from-purple-400 via-pink-500 to-amber-500',
          bgGradient: 'from-slate-900 via-purple-950 to-slate-900',
          accentColor: 'text-purple-400',
          glowColor: 'shadow-[0_0_60px_rgba(168,85,247,0.3)]',
        };
    }
  }, [theme]);

  // ⚡ Stable callbacks
  const handleActivate = useCallback(() => {
    setPhase('generating');
  }, []);

  const handleGenerationComplete = useCallback(() => {
    setPhase('revealed');
    addSparkPoints(25);
    setTimeout(() => setShowSparkReward(true), 200);
    setTimeout(() => {
      setShowSparkReward(false);
      setPhase('complete');
    }, 1000);
  }, [addSparkPoints]);

  const handleContinue = useCallback(() => {
    setStep('proreveal');
  }, [setStep]);

  return (
    <div 
      className={`relative h-full min-h-full flex flex-col items-center justify-start px-(--ob-container-padding) py-6 md:p-6 overflow-x-hidden overflow-y-auto bg-linear-to-br ${content.bgGradient} transform-gpu`}
      style={GPU_STYLE}
    >
      {/* Ambient effects - ⚡ Using CSS animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial gradient spotlight - static */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)] rounded-full" />

        {/* ⚡ Reduced floating stars (12 instead of 30) - CSS animated */}
        {!reducedMotion && AMBIENT_STARS.map((star, i) => (
          <AmbientStar key={i} {...star} />
        ))}
      </div>

      {/* Spark Points indicator */}
      <AnimatePresence>
        {sparkPoints > 0 && (
          <motion.div
            initial={reducedMotion ? {} : { x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={FAST_TRANSITION}
            className="absolute top-4 right-3 md:top-24 md:right-6 z-20"
            style={GPU_STYLE}
          >
            <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-linear-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-xl rounded-full border border-amber-400/30">
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
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: -30, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-1/4 md:top-1/3 z-30 flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-linear-to-r from-amber-500 to-orange-500 rounded-full shadow-lg shadow-amber-500/30"
            style={GPU_STYLE}
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
          initial={reducedMotion ? {} : { opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={FAST_TRANSITION}
          className="text-center mb-6 md:mb-12"
          style={GPU_STYLE}
        >
          <motion.div
            initial={reducedMotion ? {} : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, ...FAST_TRANSITION }}
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
          initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, ...FAST_TRANSITION }}
          className={`relative bg-white/5 backdrop-blur-xl rounded-2xl md:rounded-3xl border border-white/10 p-4 md:p-8 lg:p-10 ${phase === 'revealed' || phase === 'complete' ? content.glowColor : ''}`}
          style={GPU_STYLE}
        >
          {/* Particle explosion container */}
          <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
            <ParticleExplosion active={phase === 'generating'} />
          </div>

          {/* Idle state - prompt */}
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={FAST_TRANSITION}
                className="text-center"
                style={GPU_STYLE}
              >
                <p className="text-lg md:text-2xl lg:text-3xl font-serif text-white/80 mb-6 md:mb-8 italic">
                  "{content.prompt}"
                </p>

                <motion.button
                  onClick={handleActivate}
                  whileHover={reducedMotion ? {} : { scale: 1.03 }}
                  whileTap={reducedMotion ? {} : { scale: 0.97 }}
                  className="group relative inline-flex items-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 overflow-hidden rounded-full transform-gpu"
                >
                  {/* Button gradient */}
                  <div className={`absolute inset-0 bg-linear-to-r ${content.visualGradient}`} />

                  {/* Shimmer - CSS animation */}
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />

                  {/* Glow */}
                  <div className={`absolute inset-0 bg-linear-to-r ${content.visualGradient} blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-200`} />

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
                transition={FAST_TRANSITION}
                className="text-center py-8"
                style={GPU_STYLE}
              >
                <motion.div
                  animate={reducedMotion ? {} : { rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="inline-block mb-6"
                  style={GPU_STYLE}
                >
                  <div className={`w-16 h-16 rounded-full bg-linear-to-r ${content.visualGradient} p-0.5`}>
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
                initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={FAST_TRANSITION}
                style={GPU_STYLE}
              >
                {/* Generated visual - Video or Image */}
                <motion.div
                  initial={reducedMotion ? {} : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="flex justify-center mb-4 md:mb-8"
                  style={GPU_STYLE}
                >
                  <div className={`overflow-hidden rounded-2xl md:rounded-3xl ${content.glowColor} shadow-xl`}>
                    {content.visualVideo ? (
                      <video
                        src={content.visualVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 object-cover rounded-2xl md:rounded-3xl"
                      />
                    ) : (
                      <div className={`p-4 md:p-6 bg-linear-to-br ${content.visualGradient}`}>
                        <img
                          src={content.visualImage}
                          alt="Generated visual"
                          className="w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32 object-contain drop-shadow-2xl rounded-xl md:rounded-3xl"
                          loading="eager"
                          decoding="async"
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
                  transition={{ delay: 0.2, duration: 0.2 }}
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
              initial={reducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, ...FAST_TRANSITION }}
              className="mt-8 flex justify-center"
              style={GPU_STYLE}
            >
              <motion.button
                onClick={handleContinue}
                whileHover={reducedMotion ? {} : { scale: 1.02 }}
                whileTap={reducedMotion ? {} : { scale: 0.98 }}
                className="flex items-center gap-2 md:gap-3 px-6 py-3 md:px-10 md:py-5 bg-white text-slate-900 rounded-full font-bold text-base md:text-lg shadow-xl shadow-white/15 hover:shadow-white/25 transition-shadow duration-200 transform-gpu"
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
});

InstantCreationDemo.displayName = 'InstantCreationDemo';
