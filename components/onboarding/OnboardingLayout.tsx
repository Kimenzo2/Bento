/**
 * OnboardingLayout - PERFORMANCE OPTIMIZED
 * 
 * OPTIMIZATIONS:
 * 1. ⚡ React.lazy() code splitting - each step is a separate chunk
 * 2. ⚡ Suspense with instant fallback - no loading flash
 * 3. ⚡ GPU-accelerated transitions via transform3d
 * 4. ⚡ Reduced transition durations for snappier feel
 * 5. ⚡ Memoized step components prevent re-renders
 * 6. ⚡ Asset preloading for next step (predictive)
 * 7. ⚡ Respects prefers-reduced-motion
 * 
 * Performance targets: 60fps animations, <100ms step transitions
 */

import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { useOnboarding } from './OnboardingState';
import { OnboardingHeader } from './OnboardingHeader';
import { GPU_ACCELERATED_STYLES, prefersReducedMotion } from './performance/gpuStyles';
import { initAssetPreloading, preloadNextScreen } from './performance/assetPreloader';

// Apple-style easing as a typed tuple
const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

// ⚡ LAZY LOAD all step components for code splitting
// Each becomes a separate chunk, loaded only when needed
const WelcomeHero = lazy(() => import('./WelcomeHero').then(m => ({ default: m.WelcomeHero })));
const PersonalizationQuiz = lazy(() => import('./PersonalizationQuiz').then(m => ({ default: m.PersonalizationQuiz })));
const InstantCreationDemo = lazy(() => import('./InstantCreationDemo').then(m => ({ default: m.InstantCreationDemo })));
const ProRevealMoment = lazy(() => import('./ProRevealMoment').then(m => ({ default: m.ProRevealMoment })));
const OnboardingPricing = lazy(() => import('./OnboardingPricing').then(m => ({ default: m.OnboardingPricing })));
const FeatureStorybook = lazy(() => import('./FeatureStorybook').then(m => ({ default: m.FeatureStorybook })));
const CreativePersonaQuiz = lazy(() => import('./CreativePersonaQuiz').then(m => ({ default: m.CreativePersonaQuiz })));
const SaveMasterpieceModal = lazy(() => import('./SaveMasterpieceModal').then(m => ({ default: m.SaveMasterpieceModal })));
const WelcomeSuccess = lazy(() => import('./WelcomeSuccess').then(m => ({ default: m.WelcomeSuccess })));

// ⚡ Instant fallback - invisible, doesn't cause layout shift
const InstantFallback = memo(() => (
  <div className="w-full h-full min-h-screen bg-linear-to-br from-slate-900 via-[#0a0a0f] to-slate-900 transform-gpu" />
));
InstantFallback.displayName = 'InstantFallback';

// ⚡ GPU-accelerated base style for all motion containers
const GPU_MOTION_STYLE: React.CSSProperties = {
  ...GPU_ACCELERATED_STYLES,
  willChange: 'transform, opacity',
};

export const OnboardingLayout: React.FC = memo(() => {
  const { step } = useOnboarding();
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  // ⚡ Initialize asset preloading on mount
  useEffect(() => {
    initAssetPreloading();
  }, []);

  // ⚡ Predictive preload next screen assets
  useEffect(() => {
    preloadNextScreen(step);
  }, [step]);

  // ⚡ Memoized step map - computed once
  const stepMap = useMemo<Record<typeof step, number>>(() => ({
    spark: 1,
    quiz: 2,
    magic: 3,
    proreveal: 4,
    pricing: 5,
    tour: 6,
    identity: 7,
    cliffhanger: 8,
    welcome: 9,
  }), []);

  // ⚡ OPTIMIZED transitions - faster durations, GPU-accelerated transforms only
  const getTransition = useCallback((): { 
    initial: Record<string, number>; 
    animate: Record<string, number>; 
    exit: Record<string, number>;
    transition: Transition;
  } => {
    if (reducedMotion) {
      return { 
        initial: { opacity: 1 }, 
        animate: { opacity: 1 }, 
        exit: { opacity: 1 },
        transition: { duration: 0 }
      };
    }
    
    // All animations use ONLY transform and opacity (GPU-composited)
    switch (step) {
      case 'spark':
        return { 
          initial: { opacity: 0 }, 
          animate: { opacity: 1 }, 
          exit: { opacity: 0 },
          transition: { duration: 0.25, ease: APPLE_EASE }
        };
      case 'quiz':
        return { 
          initial: { opacity: 0, scale: 0.97 }, 
          animate: { opacity: 1, scale: 1 }, 
          exit: { opacity: 0, scale: 0.97 },
          transition: { duration: 0.2, ease: APPLE_EASE }
        };
      case 'magic':
        return { 
          initial: { opacity: 0, y: 20 }, 
          animate: { opacity: 1, y: 0 }, 
          exit: { opacity: 0, y: -20 },
          transition: { duration: 0.25, ease: APPLE_EASE }
        };
      case 'proreveal':
        return { 
          initial: { opacity: 0, scale: 0.97 }, 
          animate: { opacity: 1, scale: 1 }, 
          exit: { opacity: 0, scale: 1.02 },
          transition: { duration: 0.25, ease: APPLE_EASE }
        };
      case 'pricing':
        return { 
          initial: { opacity: 0, y: 20 }, 
          animate: { opacity: 1, y: 0 }, 
          exit: { opacity: 0, y: -20 },
          transition: { duration: 0.25, ease: APPLE_EASE }
        };
      case 'tour':
        return { 
          initial: { opacity: 0, x: 30 }, 
          animate: { opacity: 1, x: 0 }, 
          exit: { opacity: 0, x: -30 },
          transition: { duration: 0.2, ease: APPLE_EASE }
        };
      case 'identity':
        return { 
          initial: { opacity: 0, scale: 1.02 }, 
          animate: { opacity: 1, scale: 1 }, 
          exit: { opacity: 0, scale: 0.97 },
          transition: { duration: 0.2, ease: APPLE_EASE }
        };
      case 'cliffhanger':
        return { 
          initial: { opacity: 0 }, 
          animate: { opacity: 1 }, 
          exit: { opacity: 0 },
          transition: { duration: 0.25, ease: APPLE_EASE }
        };
      case 'welcome':
        return { 
          initial: { opacity: 0, scale: 0.95 }, 
          animate: { opacity: 1, scale: 1 }, 
          exit: { opacity: 0 },
          transition: { duration: 0.3, ease: APPLE_EASE }
        };
      default:
        return { 
          initial: { opacity: 0 }, 
          animate: { opacity: 1 }, 
          exit: { opacity: 0 },
          transition: { duration: 0.2, ease: APPLE_EASE }
        };
    }
  }, [step, reducedMotion]);

  const transition = getTransition();
  
  // ⚡ Memoized header visibility check
  const showHeader = useMemo(() => 
    step !== 'welcome' && step !== 'spark' && step !== 'proreveal' && step !== 'pricing',
    [step]
  );

  // ⚡ GPU-accelerated container with Suspense for code splitting
  return (
    <div className="w-full h-full min-h-screen bg-linear-to-br from-slate-900 via-[#0a0a0f] to-slate-900 overflow-hidden transform-gpu backface-hidden">
      {/* Header - shown on select steps */}
      {showHeader && (
        <OnboardingHeader
          currentStep={stepMap[step]}
          totalSteps={9}
        />
      )}

      {/* ⚡ Suspense wrapper with instant fallback */}
      <Suspense fallback={<InstantFallback />}>
        {/* ⚡ AnimatePresence with optimized mode */}
        <AnimatePresence mode="wait" initial={false}>
          {step === 'spark' && (
            <motion.div
              key="spark"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <WelcomeHero />
            </motion.div>
          )}

          {step === 'quiz' && (
            <motion.div
              key="quiz"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <PersonalizationQuiz />
            </motion.div>
          )}

          {step === 'magic' && (
            <motion.div
              key="magic"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <InstantCreationDemo />
            </motion.div>
          )}

          {step === 'proreveal' && (
            <motion.div
              key="proreveal"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <ProRevealMoment />
            </motion.div>
          )}

          {step === 'pricing' && (
            <motion.div
              key="pricing"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <OnboardingPricing />
            </motion.div>
          )}

          {step === 'tour' && (
            <motion.div
              key="tour"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <FeatureStorybook />
            </motion.div>
          )}

          {step === 'identity' && (
            <motion.div
              key="identity"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <CreativePersonaQuiz />
            </motion.div>
          )}

          {step === 'cliffhanger' && (
            <motion.div
              key="cliffhanger"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <SaveMasterpieceModal />
            </motion.div>
          )}

          {step === 'welcome' && (
            <motion.div
              key="welcome"
              {...transition}
              className="w-full h-full transform-gpu"
              style={GPU_MOTION_STYLE}
            >
              <WelcomeSuccess />
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
});

OnboardingLayout.displayName = 'OnboardingLayout';
