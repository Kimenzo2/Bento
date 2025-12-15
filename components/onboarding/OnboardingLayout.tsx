import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from './OnboardingState';
import { OnboardingHeader } from './OnboardingHeader';
import { WelcomeHero } from './WelcomeHero';
import { PersonalizationQuiz } from './PersonalizationQuiz';
import { InstantCreationDemo } from './InstantCreationDemo';
import { FeatureStorybook } from './FeatureStorybook';
import { CreativePersonaQuiz } from './CreativePersonaQuiz';
import { SaveMasterpieceModal } from './SaveMasterpieceModal';
import { WelcomeSuccess } from './WelcomeSuccess';

export const OnboardingLayout: React.FC = () => {
  const { step } = useOnboarding();

  // Most steps use dark theme and handle their own backgrounds
  const needsScroll = step === 'quiz';

  const stepMap: Record<typeof step, number> = {
    spark: 1,
    quiz: 2,
    magic: 3,
    tour: 4,
    identity: 5,
    cliffhanger: 6,
    welcome: 7,
  };

  const handleSkip = () => {
    localStorage.setItem('genesis_onboarding_completed', 'true');
    window.location.reload();
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

  return (
    <div 
      className={`relative w-full min-h-screen bg-[#0a0a0f] ${
        needsScroll ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden h-screen'
      }`}
    >
      {/* Header - shown on all steps except welcome */}
      {step !== 'welcome' && step !== 'spark' && (
        <OnboardingHeader
          currentStep={stepMap[step]}
          totalSteps={7}
          onSkip={handleSkip}
        />
      )}

      {/* Main content with transitions */}
      <AnimatePresence mode="wait">
        {step === 'spark' && (
          <motion.div 
            key="spark" 
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full min-h-screen"
          >
            <WelcomeHero />
          </motion.div>
        )}
        
        {step === 'quiz' && (
          <motion.div 
            key="quiz" 
            {...transition}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <PersonalizationQuiz />
          </motion.div>
        )}
        
        {step === 'magic' && (
          <motion.div 
            key="magic" 
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-screen"
          >
            <InstantCreationDemo />
          </motion.div>
        )}
        
        {step === 'tour' && (
          <motion.div 
            key="tour" 
            {...transition}
            transition={{ duration: 0.4 }}
            className="w-full h-screen"
          >
            <FeatureStorybook />
          </motion.div>
        )}
        
        {step === 'identity' && (
          <motion.div 
            key="identity" 
            {...transition}
            transition={{ duration: 0.4 }}
            className="w-full h-screen"
          >
            <CreativePersonaQuiz />
          </motion.div>
        )}
        
        {step === 'cliffhanger' && (
          <motion.div 
            key="cliffhanger" 
            {...transition}
            transition={{ duration: 0.5 }}
            className="w-full h-screen"
          >
            <SaveMasterpieceModal />
          </motion.div>
        )}
        
        {step === 'welcome' && (
          <motion.div 
            key="welcome" 
            {...transition}
            transition={{ duration: 0.6 }}
            className="w-full min-h-screen"
          >
            <WelcomeSuccess />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
