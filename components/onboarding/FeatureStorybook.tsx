import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useOnboarding } from './OnboardingState';

// Image paths for features
const featureImages = {
  storytelling: '/images/onboarding/feature-storytelling.png',
  illustrations: '/images/onboarding/feature-illustrations.png',
  multimode: '/images/onboarding/feature-multimode.png',
  editor: '/images/onboarding/feature-editor.png',
  genMascot: '/images/onboarding/gen-mascot.png',
};

interface Feature {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  gradient: string;
  bgPattern: string;
  mascotMessage: string;
}

const features: Feature[] = [
  {
    id: 1,
    title: 'AI-Powered Storytelling',
    subtitle: 'Your imagination, amplified',
    description: 'Transform a single sentence into richly detailed narratives with our advanced AI. Generate compelling stories, educational content, and brand narratives in seconds.',
    image: featureImages.storytelling,
    gradient: 'from-purple-600 via-violet-600 to-indigo-600',
    bgPattern: 'radial-gradient(circle at 20% 80%, rgba(168,85,247,0.15) 0%, transparent 50%)',
    mascotMessage: "I can help you craft stories that captivate and inspire!",
  },
  {
    id: 2,
    title: 'Dynamic Illustrations',
    subtitle: 'See your words come to life',
    description: 'Every scene you write automatically generates stunning, style-matched illustrations. Choose from dozens of art styles—from whimsical to photorealistic.',
    image: featureImages.illustrations,
    gradient: 'from-pink-600 via-rose-600 to-red-600',
    bgPattern: 'radial-gradient(circle at 80% 20%, rgba(244,63,94,0.15) 0%, transparent 50%)',
    mascotMessage: "Watch as your imagination takes visual form!",
  },
  {
    id: 3,
    title: 'Multi-Mode Creation',
    subtitle: 'One platform, endless possibilities',
    description: 'Switch seamlessly between Children\'s Books, Sci-Fi Epics, Educational Content, and Brand Stories. Each mode unlocks specialized tools and templates.',
    image: featureImages.multimode,
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    bgPattern: 'radial-gradient(circle at 50% 50%, rgba(251,146,60,0.15) 0%, transparent 50%)',
    mascotMessage: "From bedtime stories to business pitches—I've got you covered!",
  },
  {
    id: 4,
    title: 'Smart Editor',
    subtitle: 'Professional tools, simplified',
    description: 'Rich text editing with AI suggestions, auto-formatting, character consistency checks, and real-time collaboration. Your creative suite, reimagined.',
    image: featureImages.editor,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgPattern: 'radial-gradient(circle at 20% 20%, rgba(20,184,166,0.15) 0%, transparent 50%)',
    mascotMessage: "I'll handle the technical stuff—you focus on creativity!",
  },
];

// Gen Mascot component with image
const GenMascot = ({ message, isVisible }: { message: string; isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, x: -50, scale: 0.8 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -50, scale: 0.8 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="hidden lg:flex flex-col items-center"
      >
        {/* Gen Mascot Image */}
        <div className="relative">
          <img
            src={featureImages.genMascot}
            alt="Gen - Your Creative Guide"
            className="w-36 h-36 object-contain drop-shadow-2xl rounded-3xl"
          />
          
          {/* Glow behind */}
          <div className="absolute inset-0 bg-purple-500/30 blur-3xl -z-10" />
        </div>
        
        {/* Speech bubble */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 relative"
        >
          {/* Bubble arrow */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/10 backdrop-blur-xl rotate-45 border-t border-l border-white/20" />
          
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-5 py-4 border border-white/20 max-w-[200px]">
            <p className="text-white/90 text-sm font-medium leading-relaxed">"{message}"</p>
            <p className="text-white/40 text-xs mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Gen, your guide
            </p>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const FeatureStorybook: React.FC = () => {
  const { setStep, addSparkPoints } = useOnboarding();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const currentFeature = features[currentIndex];
  const isLast = currentIndex === features.length - 1;
  const isFirst = currentIndex === 0;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  const goNext = () => {
    if (isLast) {
      addSparkPoints(15);
      setStep('identity');
    } else {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center justify-center px-3 py-6 md:p-6 overflow-x-hidden overflow-y-auto">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0d0d1a] to-slate-900" />
      
      {/* Feature-specific background pattern */}
      <motion.div
        key={currentFeature.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: currentFeature.bgPattern }}
      />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }}
      />

      {/* Floating orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
        className={`absolute w-96 h-96 rounded-full bg-gradient-to-br ${currentFeature.gradient} blur-3xl opacity-20`}
        style={{ top: '10%', right: '-10%' }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-6 lg:gap-12">
          {/* Gen Mascot - Only on large screens */}
          <GenMascot message={currentFeature.mascotMessage} isVisible={true} />

          {/* Main content */}
          <div className="flex-1 w-full">
            {/* Progress indicators */}
            <div className="flex justify-center gap-1.5 md:gap-2 mb-4 md:mb-10">
              {features.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    idx === currentIndex 
                      ? 'w-10 bg-white' 
                      : idx < currentIndex 
                        ? 'w-6 bg-white/50' 
                        : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Feature card */}
            <div className="relative h-auto min-h-[320px] md:min-h-[420px] lg:h-[480px]">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentFeature.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <div className="h-full bg-white/5 backdrop-blur-2xl rounded-2xl md:rounded-3xl border border-white/10 p-4 md:p-8 lg:p-10 flex flex-col items-center text-center">
                    {/* Feature Image - Large and prominent */}
                    <motion.div
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: "spring", bounce: 0.4 }}
                      className="relative mb-3 md:mb-6"
                    >
                      <img
                        src={currentFeature.image}
                        alt={currentFeature.title}
                        className="w-24 h-24 md:w-36 md:h-36 lg:w-48 lg:h-48 object-contain drop-shadow-2xl rounded-2xl md:rounded-3xl"
                      />
                      
                      {/* Glow behind image */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${currentFeature.gradient} blur-3xl opacity-40 -z-10 scale-75`} />
                    </motion.div>

                    {/* Text content */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className={`text-xs md:text-sm font-medium mb-1 md:mb-2 bg-gradient-to-r ${currentFeature.gradient} bg-clip-text text-transparent`}>
                        {currentFeature.subtitle}
                      </p>
                      <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-white mb-2 md:mb-4 font-heading">
                        {currentFeature.title}
                      </h2>
                      <p className="text-white/60 text-sm md:text-base lg:text-lg leading-relaxed max-w-lg mx-auto">
                        {currentFeature.description}
                      </p>
                    </motion.div>

                    {/* Feature highlights - Hide on mobile */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-auto hidden md:flex flex-wrap justify-center gap-3"
                    >
                      {['Instant', 'Professional', 'Easy'].map((tag) => (
                        <span
                          key={tag}
                          className="px-4 py-1.5 bg-white/5 rounded-full text-white/50 text-sm border border-white/10"
                        >
                          {tag}
                        </span>
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4 md:mt-8 gap-2">
              {/* Previous */}
              <motion.button
                onClick={goPrev}
                disabled={isFirst}
                whileHover={{ scale: isFirst ? 1 : 1.05 }}
                whileTap={{ scale: isFirst ? 1 : 0.95 }}
                className={`flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-3 rounded-full font-medium transition-all text-sm md:text-base ${
                  isFirst 
                    ? 'text-white/20 cursor-not-allowed' 
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </motion.button>

              {/* Feature count */}
              <div className="text-white/40 text-sm">
                <span className="text-white font-bold">{currentIndex + 1}</span>
                <span className="mx-1">/</span>
                <span>{features.length}</span>
              </div>

              {/* Next / Complete */}
              <motion.button
                onClick={goNext}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-5 py-3 md:px-8 md:py-4 rounded-full font-bold text-sm md:text-lg overflow-hidden"
              >
                {/* Button gradient */}
                <div className={`absolute inset-0 bg-gradient-to-r ${currentFeature.gradient}`} />
                
                {/* Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                <span className="relative flex items-center gap-2 text-white">
                  {isLast ? 'Complete Tour' : 'Next'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
