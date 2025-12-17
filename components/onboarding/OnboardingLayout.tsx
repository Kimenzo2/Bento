/**
 * OnboardingLayout - Clean Onboarding UI
 * 
 * ARCHITECTURE:
 * Now that onboarding is properly isolated at the router level (separate from MainApp),
 * this component can be a clean layout without DOM hacks.
 * 
 * The OnboardingApp wrapper handles global style injection.
 * This component just renders the onboarding flow.
 */

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from './OnboardingState';
import { OnboardingHeader } from './OnboardingHeader';
import { WelcomeHero } from './WelcomeHero';
import { PersonalizationQuiz } from './PersonalizationQuiz';
import { InstantCreationDemo } from './InstantCreationDemo';
import { ProRevealMoment } from './ProRevealMoment';
import { OnboardingPricing } from './OnboardingPricing';
import { FeatureStorybook } from './FeatureStorybook';
import { CreativePersonaQuiz } from './CreativePersonaQuiz';
import { SaveMasterpieceModal } from './SaveMasterpieceModal';
import { WelcomeSuccess } from './WelcomeSuccess';
import { OnboardingPreloader } from './OnboardingPreloader';

export const OnboardingLayout: React.FC = () => {
  const { step } = useOnboarding();

  // Each onboarding screen controls its own scrolling.

  const stepMap: Record<typeof step, number> = {
    spark: 1,
    quiz: 2,
    magic: 3,
    proreveal: 4,
    pricing: 5,
    tour: 6,
    identity: 7,
    cliffhanger: 8,
    welcome: 9,
  };

  const handleSkip = () => {
    localStorage.setItem('genesis_onboarding_completed', 'true');
    // Navigate to main app instead of reload
    window.location.href = '/';
  };

  // Step-specific transitions
  const getTransition = () => {
    switch (step) {
      case 'spark':
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
      case 'quiz':
        return { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } };
      case 'magic':
        return { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 } };
      case 'proreveal':
        return { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.05 } };
      case 'pricing':
        return { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 } };
      case 'tour':
        return { initial: { opacity: 0, x: 50 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -50 } };
      case 'identity':
        return { initial: { opacity: 0, scale: 1.05 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 } };
      case 'cliffhanger':
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
      case 'welcome':
        return { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 } };
      default:
        return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    }
  };

  const transition = getTransition();

  // Clean layout - no portal needed since we're now on a separate route
  return (
    <div
      className="w-full h-full min-h-screen bg-gradient-to-br from-slate-900 via-[#0a0a0f] to-slate-900 overflow-hidden"
    >
      {/* Header - shown on all steps except welcome, spark, proreveal and pricing */}
      {step !== 'welcome' && step !== 'spark' && step !== 'proreveal' && step !== 'pricing' && (
        <OnboardingHeader
          currentStep={stepMap[step]}
          totalSteps={9}
          onSkip={handleSkip}
        />
      )}

      {/* Main content with transitions - all screens fill the container */}
      <AnimatePresence mode="wait">
        {step === 'spark' && (
          <motion.div
            key="spark"
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <WelcomeHero />
          </motion.div>
        )}

        {step === 'quiz' && (
          <motion.div
            key="quiz"
            {...transition}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <PersonalizationQuiz />
          </motion.div>
        )}

        {step === 'magic' && (
          <motion.div
            key="magic"
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <InstantCreationDemo />
          </motion.div>
        )}

        {step === 'proreveal' && (
          <motion.div
            key="proreveal"
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <ProRevealMoment />
          </motion.div>
        )}

        {step === 'pricing' && (
          <motion.div
            key="pricing"
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <OnboardingPricing />
          </motion.div>
        )}

        {step === 'tour' && (
          <motion.div
            key="tour"
            {...transition}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <FeatureStorybook />
          </motion.div>
        )}

        {step === 'identity' && (
          <motion.div
            key="identity"
            {...transition}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <CreativePersonaQuiz />
          </motion.div>
        )}

        {step === 'cliffhanger' && (
          <motion.div
            key="cliffhanger"
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <SaveMasterpieceModal />
          </motion.div>
        )}

        {step === 'welcome' && (
          <motion.div
            key="welcome"
            {...transition}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <WelcomeSuccess />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
