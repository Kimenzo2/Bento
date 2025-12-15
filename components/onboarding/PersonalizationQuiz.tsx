import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useOnboarding } from './OnboardingState';

// Animated background blob
const FloatingBlob = ({ color, size, x, y, delay }: { color: string; size: string; x: string; y: string; delay: number }) => (
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ 
      scale: [0.8, 1.1, 0.9, 1],
      opacity: [0.3, 0.5, 0.3],
      x: [0, 20, -10, 0],
      y: [0, -20, 10, 0],
    }}
    transition={{ 
      duration: 15,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
    className={`absolute rounded-full ${color} blur-3xl pointer-events-none`}
    style={{ width: size, height: size, left: x, top: y }}
  />
);

// Image paths for quiz options
const quizImages = {
  kids: '/images/onboarding/intent-kids.png',
  scifi: '/images/onboarding/intent-scifi.png',
  brand: '/images/onboarding/intent-brand.png',
  beginner: '/images/onboarding/skill-beginner.png',
  pro: '/images/onboarding/skill-pro.png',
  daily: '/images/onboarding/cadence-daily.png',
  occasional: '/images/onboarding/cadence-occasional.png',
};

interface QuizQuestion {
  id: 'intent' | 'skill' | 'cadence';
  title: string;
  subtitle: string;
  options: Array<{
    value: string;
    label: string;
    description: string;
    image: string;
    gradient: string;
  }>;
}

const questions: QuizQuestion[] = [
  {
    id: 'intent',
    title: 'What sparks your imagination?',
    subtitle: 'We\'ll tailor your creative palette based on your interests.',
    options: [
      { value: 'kids', label: 'Children\'s Stories', description: 'Whimsical tales for young minds', image: quizImages.kids, gradient: 'from-pink-500 to-rose-600' },
      { value: 'scifi', label: 'Sci-Fi Adventures', description: 'Explore galaxies far, far away', image: quizImages.scifi, gradient: 'from-indigo-500 to-purple-600' },
      { value: 'brand', label: 'Brand & Marketing', description: 'Visual content that converts', image: quizImages.brand, gradient: 'from-amber-500 to-orange-600' },
    ],
  },
  {
    id: 'skill',
    title: 'How would you describe yourself?',
    subtitle: 'We\'ll adjust the interface complexity for you.',
    options: [
      { value: 'beginner', label: 'Just Starting Out', description: 'Show me the ropes', image: quizImages.beginner, gradient: 'from-emerald-500 to-teal-600' },
      { value: 'pro', label: 'Seasoned Creator', description: 'I know my way around', image: quizImages.pro, gradient: 'from-violet-500 to-purple-600' },
    ],
  },
  {
    id: 'cadence',
    title: 'How often will you create?',
    subtitle: 'We\'ll optimize your workflow accordingly.',
    options: [
      { value: 'daily', label: 'Daily Creator', description: 'Content is my craft', image: quizImages.daily, gradient: 'from-orange-500 to-red-600' },
      { value: 'occasional', label: 'When Inspiration Strikes', description: 'Quality over quantity', image: quizImages.occasional, gradient: 'from-blue-500 to-indigo-600' },
    ],
  },
];

export const PersonalizationQuiz: React.FC = () => {
  const { quizAnswers, setQuizAnswers, setStep } = useOnboarding();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const question = questions[currentQuestion];
  const currentAnswer = quizAnswers[question.id];
  const allAnswered = quizAnswers.intent && quizAnswers.skill && quizAnswers.cadence;
  const progress = ((currentQuestion + (currentAnswer ? 1 : 0)) / questions.length) * 100;

  const handleSelect = (value: string) => {
    setQuizAnswers({ ...quizAnswers, [question.id]: value });
    
    if (currentQuestion < questions.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestion(prev => prev + 1);
        setIsTransitioning(false);
      }, 400);
    }
  };

  const handleContinue = () => {
    setStep('magic');
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center px-3 md:px-4 py-6 md:pt-16 md:pb-10 overflow-x-hidden overflow-y-auto">
      {/* Premium Background - inherits from parent */}
      <div className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
      
      {/* Floating blobs */}
      <FloatingBlob color="bg-purple-600/20" size="500px" x="-15%" y="10%" delay={0} />
      <FloatingBlob color="bg-blue-600/20" size="400px" x="70%" y="5%" delay={2} />
      <FloatingBlob color="bg-pink-600/15" size="350px" x="50%" y="60%" delay={4} />

      {/* Subtle grid */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl">
        {/* Progress Ring */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-center mb-4 md:mb-8"
        >
          <div className="relative w-14 h-14 md:w-20 md:h-20">
            {/* Background ring */}
            <svg className="w-14 h-14 md:w-20 md:h-20 -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="24"
                className="fill-none stroke-white/10 md:hidden"
                strokeWidth="3"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                className="fill-none stroke-white/10 hidden md:block"
                strokeWidth="4"
              />
              <motion.circle
                cx="40"
                cy="40"
                r="36"
                className="fill-none stroke-purple-500"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ strokeDasharray: '226', strokeDashoffset: '226' }}
                animate={{ strokeDashoffset: 226 - (226 * progress / 100) }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </svg>
            {/* Center number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-lg">{currentQuestion + 1}</span>
            </div>
          </div>
        </motion.div>

        {/* Question indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center gap-2 mb-8"
        >
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                idx < currentQuestion 
                  ? 'w-8 bg-purple-500' 
                  : idx === currentQuestion 
                    ? 'w-8 bg-white' 
                    : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </motion.div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`${isTransitioning ? 'pointer-events-none' : ''}`}
          >
            {/* Header */}
            <div className="text-center mb-4 md:mb-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-3 md:mb-6"
              >
                <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-amber-400" />
                <span className="text-white/70 text-xs md:text-sm font-medium">Question {currentQuestion + 1} of {questions.length}</span>
              </motion.div>
              
              <h2 className="text-xl md:text-3xl lg:text-4xl font-bold text-white mb-1.5 md:mb-3 font-heading px-2">
                {question.title}
              </h2>
              <p className="text-white/50 text-sm md:text-lg">{question.subtitle}</p>
            </div>

            {/* Options with Images */}
            <div className={`grid gap-2.5 md:gap-4 ${question.options.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {question.options.map((option, idx) => {
                const isSelected = currentAnswer === option.value;
                
                return (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    onClick={() => handleSelect(option.value)}
                    className={`group relative w-full p-3 md:p-5 rounded-xl md:rounded-2xl text-left transition-all duration-300 overflow-hidden ${
                      isSelected 
                        ? 'ring-2 ring-white/40' 
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Background gradient on selection */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${option.gradient} transition-opacity duration-300 ${isSelected ? 'opacity-20' : 'opacity-0'}`} />
                    
                    {/* Glass effect */}
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl" />
                    
                    {/* Shimmer on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                    <div className="relative flex items-center gap-3 md:gap-5">
                      {/* Image */}
                      <motion.div
                        className="flex-shrink-0"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.3 }}
                      >
                        <img
                          src={option.image}
                          alt={option.label}
                          className={`w-14 h-14 md:w-20 md:h-24 object-contain drop-shadow-xl rounded-xl md:rounded-2xl ${isSelected ? 'scale-110' : ''} transition-transform duration-300`}
                        />
                      </motion.div>
                      
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm md:text-lg font-bold text-white mb-0 md:mb-0.5">{option.label}</h3>
                        <p className="text-white/50 text-xs md:text-sm hidden md:block">{option.description}</p>
                      </div>
                      
                      {/* Selection indicator */}
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        isSelected 
                          ? 'border-white bg-white' 
                          : 'border-white/30'
                      }`}>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                          >
                            <Check className="w-4 h-4 text-slate-900" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Continue Button */}
        <AnimatePresence>
          {allAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-6 md:mt-10 flex justify-center pb-4"
            >
              <motion.button
                onClick={handleContinue}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative px-8 py-4 md:px-10 md:py-5 rounded-full font-bold text-base md:text-lg overflow-hidden"
              >
                {/* Button gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500" />
                
                {/* Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                
                <span className="relative flex items-center gap-3 text-white">
                  Begin the Magic
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
