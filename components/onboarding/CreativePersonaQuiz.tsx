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
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden bg-[#0a0a0f]">
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
      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-6"
          >
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-white/70 text-sm font-medium">Choose Your Path</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-heading">
            Who is the captain
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              of this voyage?
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-md mx-auto">
            We'll tailor Genesis to match your role and unlock features that matter most to you.
          </p>
        </motion.div>

        {/* Role cards with images */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
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
                className={`group relative p-6 rounded-2xl text-center transition-all duration-300 ${
                  isSelected 
                    ? `${role.glow} ring-2 ring-white/30` 
                    : 'hover:bg-white/5'
                }`}
              >
                {/* Background */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${role.gradient} transition-opacity duration-300 ${isSelected ? 'opacity-20' : 'opacity-0'}`} />
                
                {/* Glass border */}
                <div className="absolute inset-0 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10" />
                
                {/* Shimmer on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 overflow-hidden" />

                <div className="relative">
                  {/* Role Image - Large and centered */}
                  <motion.div
                    className="mb-5 flex justify-center"
                    animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.img
                      src={role.image}
                      alt={role.title}
                      className="w-32 h-32 md:w-36 md:h-36 object-contain drop-shadow-2xl"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    />
                    
                    {/* Glow behind image */}
                    <div className={`absolute w-32 h-32 bg-gradient-to-br ${role.gradient} blur-3xl opacity-30 -z-10`} />
                  </motion.div>
                  
                  {/* Text */}
                  <h3 className="text-xl font-bold text-white mb-1">{role.title}</h3>
                  <p className={`text-sm mb-3 bg-gradient-to-r ${role.gradient} bg-clip-text text-transparent font-medium`}>
                    {role.subtitle}
                  </p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {role.description}
                  </p>
                  
                  {/* Selection indicator */}
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
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
                        <Check className="w-4 h-4 text-slate-900" />
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
                className="group relative px-10 py-5 rounded-full font-bold text-lg overflow-hidden"
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
