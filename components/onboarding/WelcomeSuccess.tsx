import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Crown, Rocket, Sparkles, Star, Zap } from 'lucide-react';
import { useOnboarding } from './OnboardingState';

// Confetti particle
const Confetti = ({ delay, x }: { delay: number; x: number }) => {
  const colors = ['#a855f7', '#ec4899', '#f59e0b', '#3b82f6', '#10b981'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <motion.div
      initial={{ y: -20, x, opacity: 1, rotate: 0 }}
      animate={{ 
        y: '100vh', 
        opacity: [1, 1, 0],
        rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
      }}
      transition={{ 
        duration: 3 + Math.random() * 2,
        delay,
        ease: "linear"
      }}
      className="absolute w-3 h-3 rounded-sm"
      style={{ 
        backgroundColor: color,
        left: x,
        top: -20,
      }}
    />
  );
};

// Floating achievement badge
const AchievementBadge = ({ icon: Icon, label, value, delay, gradient }: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  delay: number;
  gradient: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.8 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, type: "spring", bounce: 0.4 }}
    className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10"
  >
    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-white/50 text-sm">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
    </div>
  </motion.div>
);

export const WelcomeSuccess: React.FC = () => {
  const { sparkPoints, role, quizAnswers } = useOnboarding();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleEnterStudio = () => {
    localStorage.setItem('genesis_onboarding_completed', 'true');
    // Navigate to main app - clean route transition
    window.location.href = '/';
  };

  // Personalized welcome based on quiz answers
  const getPersonalizedMessage = () => {
    if (quizAnswers.intent === 'kids') {
      return "Ready to create magical stories for young minds?";
    } else if (quizAnswers.intent === 'scifi') {
      return "Ready to explore galaxies and craft epic adventures?";
    } else if (quizAnswers.intent === 'brand') {
      return "Ready to create compelling visual narratives?";
    }
    return "Ready to bring your imagination to life?";
  };

  const getRoleTitle = () => {
    switch (role) {
      case 'mentor': return 'The Wise Mentor';
      case 'explorer': return 'The Bold Explorer';
      case 'guardian': return 'The Creative Guardian';
      default: return 'Creative Visionary';
    }
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900" />
      
      {/* Radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-purple-600/10 to-transparent rounded-full" />

      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <Confetti
              key={i}
              delay={i * 0.05}
              x={Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000)}
            />
          ))}
        </div>
      )}

      {/* Ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute w-[400px] h-[400px] rounded-full bg-purple-600/20 blur-3xl"
        style={{ top: '20%', left: '-10%' }}
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute w-[350px] h-[350px] rounded-full bg-pink-600/20 blur-3xl"
        style={{ bottom: '10%', right: '-5%' }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", duration: 1, bounce: 0.5 }}
          className="relative inline-block mb-8"
        >
          {/* Rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 p-1"
          >
            <div className="w-full h-full rounded-full bg-[#0a0a0f]" />
          </motion.div>
          
          {/* Inner circle */}
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 backdrop-blur-xl border border-white/10 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Crown className="w-14 h-14 text-amber-400" />
            </motion.div>
          </div>
          
          {/* Sparkles */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], rotate: [0, 15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -top-3 -right-3"
          >
            <Sparkles className="w-8 h-8 text-amber-400" />
          </motion.div>
        </motion.div>

        {/* Role title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <span className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-white/10 text-white/70 text-sm font-medium">
            {getRoleTitle()}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-5xl md:text-6xl font-bold mb-6 font-heading"
        >
          <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            Welcome to
          </span>
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
            Genesis.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xl text-white/50 mb-10 max-w-lg mx-auto"
        >
          {getPersonalizedMessage()}
        </motion.p>

        {/* Achievement badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
        >
          <AchievementBadge
            icon={Star}
            label="Spark Points"
            value={`${sparkPoints}`}
            delay={0.7}
            gradient="from-amber-500 to-orange-600"
          />
          <AchievementBadge
            icon={Zap}
            label="Status"
            value="Creator"
            delay={0.8}
            gradient="from-purple-500 to-indigo-600"
          />
          <AchievementBadge
            icon={Rocket}
            label="Level"
            value="1"
            delay={0.9}
            gradient="from-emerald-500 to-teal-600"
          />
        </motion.div>

        {/* Enter button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <motion.button
            onClick={handleEnterStudio}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group relative inline-flex items-center gap-3 px-12 py-6 rounded-full font-bold text-xl overflow-hidden"
          >
            {/* Button gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500" />
            
            {/* Shimmer */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2"
            />
            
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
            
            <span className="relative flex items-center gap-3 text-white">
              Enter the Studio
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-8 text-white/30 text-sm"
        >
          The page is blank. The tools are yours. Let's make something amazing.
        </motion.p>
      </div>
    </div>
  );
};
