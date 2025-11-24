import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Particle, generateParticles, updateParticle } from '../utils/particles';

interface GenerationTheaterProps {
    progress: number; // 0-100
    status: string;
}

const GenerationTheater: React.FC<GenerationTheaterProps> = ({ progress, status }) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [currentPhase, setCurrentPhase] = useState(1);

    // Determine current phase based on progress
    useEffect(() => {
        if (progress <= 25) setCurrentPhase(1);
        else if (progress <= 50) setCurrentPhase(2);
        else if (progress <= 75) setCurrentPhase(3);
        else setCurrentPhase(4);
    }, [progress]);

    // Generate particles periodically
    useEffect(() => {
        const interval = setInterval(() => {
            const newParticles = generateParticles(5, window.innerWidth / 2, window.innerHeight / 2, 200, 'sparkle');
            setParticles(prev => [...prev, ...newParticles].slice(-50)); // Keep max 50 particles
        }, 500);

        return () => clearInterval(interval);
    }, []);

    // Update particles animation
    useEffect(() => {
        const animationFrame = setInterval(() => {
            setParticles(prev =>
                prev
                    .map(p => updateParticle(p))
                    .filter(p => p.opacity > 0)
            );
        }, 50);

        return () => clearInterval(animationFrame);
    }, []);

    const getPhaseInfo = (phase: number) => {
        switch (phase) {
            case 1:
                return {
                    title: 'Sketching your characters...',
                    icon: '✏️',
                    gradient: 'from-[#FFE8D6] to-[#FFF8DC]',
                };
            case 2:
                return {
                    title: 'Painting the scenes...',
                    icon: '🎨',
                    gradient: 'from-[#D5F2E3] to-[#E8D5F2]',
                };
            case 3:
                return {
                    title: 'Writing your story...',
                    icon: '📝',
                    gradient: 'from-[#FFE17B] to-[#FF9B85]',
                };
            case 4:
                return {
                    title: 'Adding the magic...',
                    icon: '✨',
                    gradient: 'from-[#FF9B85] to-[#FFD93D]',
                };
            default:
                return {
                    title: 'Creating magic...',
                    icon: '✨',
                    gradient: 'from-[#FFE8D6] to-[#FFF8DC]',
                };
        }
    };

    const phaseInfo = getPhaseInfo(currentPhase);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-white/90 animate-fadeIn">
            {/* Animated gradient background */}
            <div
                className={`absolute inset-0 bg-gradient-to-br ${phaseInfo.gradient} opacity-30 transition-all duration-1000`}
            />

            {/* Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {particles.map(particle => (
                    <div
                        key={particle.id}
                        className="absolute"
                        style={{
                            left: `${particle.x}px`,
                            top: `${particle.y}px`,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                            opacity: particle.opacity,
                            transform: `rotate(${particle.rotation}deg)`,
                        }}
                    >
                        <div
                            className="w-full h-full rounded-full"
                            style={{
                                backgroundColor: particle.color,
                                boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center max-w-2xl px-8">
                {/* Phase icon with animation */}
                <motion.div
                    key={currentPhase}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="mb-8 w-32 h-32 bg-gradient-to-br from-coral-burst to-gold-sunshine rounded-full flex items-center justify-center shadow-soft-lg relative"
                >
                    <div className="absolute inset-0 bg-coral-burst/20 rounded-full animate-ping" />
                    <span className="text-6xl relative z-10 animate-bounce-slow">
                        {phaseInfo.icon}
                    </span>
                </motion.div>

                {/* Phase title */}
                <AnimatePresence mode="wait">
                    <motion.h2
                        key={currentPhase}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="font-heading font-bold text-4xl md:text-5xl text-charcoal-soft mb-4 text-center"
                    >
                        {phaseInfo.title}
                    </motion.h2>
                </AnimatePresence>

                {/* Status message */}
                <motion.p
                    className="text-cocoa-light text-center text-lg mb-12 font-body"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    {status || 'Crafting your masterpiece...'}
                </motion.p>

                {/* Rainbow progress bar */}
                <div className="w-full max-w-md">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative shadow-inner">
                        <motion.div
                            className="h-full bg-gradient-to-r from-coral-burst via-gold-sunshine to-mint-breeze relative"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </motion.div>
                    </div>

                    {/* Percentage */}
                    <div className="flex justify-between items-center mt-3">
                        <motion.span
                            className="font-heading font-bold text-2xl text-coral-burst"
                            key={Math.floor(progress)}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                        >
                            {Math.round(progress)}%
                        </motion.span>
                        <div className="flex gap-1">
                            <Sparkles className="w-5 h-5 text-gold-sunshine animate-pulse" />
                            <Sparkles className="w-4 h-4 text-coral-burst animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <Sparkles className="w-3 h-3 text-mint-breeze animate-pulse" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Add shimmer animation to Tailwind */}
            <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
        .animate-bounce-slow {
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
        </div>
    );
};

export default GenerationTheater;
