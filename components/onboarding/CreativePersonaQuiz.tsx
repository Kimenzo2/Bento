import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Users } from 'lucide-react';
import { useOnboarding, type UserRole } from './OnboardingState';

// Image paths for roles
const roleImages = {
  mentor: '/images/onboarding/role-mentor.png',
  explorer: '/images/onboarding/role-explorer.png',
  guardian: '/images/onboarding/role-guardian.png',
};

interface RoleOption {
  id: UserRole;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  gradient: string;
  glow: string;
}

const roles: RoleOption[] = [
  {
    id: 'mentor',
    title: 'The Mentor',
    subtitle: 'Educators & Teachers',
    description: 'You shape minds and inspire futures. We\'ll optimize for curriculum integration and classroom tools.',
    image: roleImages.mentor,
    gradient: 'from-indigo-500 via-purple-500 to-violet-600',
    glow: 'shadow-[0_0_60px_rgba(99,102,241,0.4)]',
  },
  {
    id: 'explorer',
    title: 'The Explorer',
    subtitle: 'Students & Learners',
    description: 'Curiosity is your compass. We\'ll unlock discovery modes and learning adventures.',
    image: roleImages.explorer,
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    glow: 'shadow-[0_0_60px_rgba(6,182,212,0.4)]',
  },
  {
    id: 'guardian',
    title: 'The Guardian',
    subtitle: 'Parents & Guides',
    description: 'You nurture creativity at home. We\'ll focus on family-friendly content and shared experiences.',
    image: roleImages.guardian,
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'shadow-[0_0_60px_rgba(245,158,11,0.4)]',
  },
];

export const CreativePersonaQuiz: React.FC = () => {
  const { setRole, setStep, addSparkPoints } = useOnboarding();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (selectedRole) {
      setIsTransitioning(true);
      setRole(selectedRole);
      addSparkPoints(10);
      setTimeout(() => setStep('cliffhanger'), 500);
    }
  };

  return (
    <div className="relative h-full min-h-full flex flex-col items-center justify-start px-3 py-6 md:p-6 overflow-x-hidden overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0d0d1a] to-slate-900" />
      
      {/* Ambient orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-3xl"
        style={{ top: '-10%', left: '-10%' }}
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute w-[400px] h-[400px] rounded-full bg-blue-600/20 blur-3xl"
        style={{ bottom: '-5%', right: '-10%' }}
      />

      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl flex-1 flex flex-col justify-center">
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
            <Users className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
            <span className="text-white/70 text-xs md:text-sm font-medium">Choose Your Path</span>
          </motion.div>
          
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4 font-heading">
            Who is the captain
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              of this voyage?
            </span>
          </h1>
          <p className="text-white/50 text-sm md:text-lg max-w-md mx-auto px-4">
            We'll tailor Genesis to match your role.
          </p>
        </motion.div>

        {/* Role cards with images */}
        <div className="grid grid-cols-3 gap-2 md:gap-5 mb-6 md:mb-10">
          {roles.map((role, index) => {
            const isSelected = selectedRole === role.id;
            
            return (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                onClick={() => handleRoleSelect(role.id)}
                disabled={isTransitioning}
                whileHover={{ y: -5 }}
                className={`group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-center transition-all duration-300 ${
                  isSelected 
                    ? `${role.glow} ring-2 ring-white/30` 
                    : 'hover:bg-white/5'
                } overflow-hidden`}
              >
                {/* Background */}
                <div className={`absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-br ${role.gradient} transition-opacity duration-300 ${isSelected ? 'opacity-20' : 'opacity-0'}`} />
                
                {/* Glass border */}
                <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10" />
                
                {/* Shimmer on hover */}
                <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                <div className="relative">
                  {/* Role Image - Compact on mobile */}
                  <motion.div
                    className="mb-2 md:mb-5 flex justify-center"
                    animate={isSelected ? { scale: 1.05 } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <img
                      src={role.image}
                      alt={role.title}
                      className="w-16 h-16 md:w-28 md:h-28 lg:w-36 lg:h-36 object-contain drop-shadow-2xl rounded-xl md:rounded-3xl"
                    />
                    
                    {/* Glow behind image */}
                    <div className={`absolute w-32 h-32 bg-gradient-to-br ${role.gradient} blur-3xl opacity-30 -z-10`} />
                  </motion.div>
                  
                  {/* Text */}
                  <h3 className="text-xs md:text-xl font-bold text-white mb-0 md:mb-1">{role.title}</h3>
                  <p className={`text-[10px] md:text-sm mb-1 md:mb-3 bg-gradient-to-r ${role.gradient} bg-clip-text text-transparent font-medium hidden md:block`}>
                    {role.subtitle}
                  </p>
                  <p className="text-white/50 text-xs md:text-sm leading-relaxed hidden md:block">
                    {role.description}
                  </p>
                  
                  {/* Selection indicator */}
                  <div className={`absolute top-2 right-2 md:top-4 md:right-4 w-4 h-4 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isSelected 
                      ? 'border-white bg-white' 
                      : 'border-white/20'
                  }`}>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                      >
                        <Check className="w-2.5 h-2.5 md:w-4 md:h-4 text-slate-900" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Continue button */}
        <AnimatePresence>
          {selectedRole && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex justify-center"
            >
              <motion.button
                onClick={handleContinue}
                disabled={isTransitioning}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative px-8 py-4 md:px-10 md:py-5 rounded-full font-bold text-base md:text-lg overflow-hidden"
              >
                {/* Button gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500" />
                
                {/* Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                
                {/* Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                
                <span className="relative flex items-center gap-3 text-white">
                  {isTransitioning ? (
                    <>
                      <Sparkles className="w-5 h-5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
