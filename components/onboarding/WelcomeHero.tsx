import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { type ThemeOption, useOnboarding } from './OnboardingState';

// Floating particle component
const FloatingParticle = ({ delay, size, x, y, duration }: { delay: number; size: number; x: string; y: string; duration: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0, 0.8, 0],
      scale: [0, 1, 0.5],
      y: [0, -100, -200],
    }}
    transition={{ 
      delay,
      duration,
      repeat: Infinity,
      repeatDelay: Math.random() * 2
    }}
    className="absolute rounded-full bg-linear-to-br from-white/60 to-white/20"
    style={{ left: x, top: y, width: size, height: size }}
  />
);

// Ambient orb with glow
const AmbientOrb = ({ color, size, x, y, blur }: { color: string; size: string; x: string; y: string; blur: string }) => (
  <motion.div
    animate={{ 
      scale: [1, 1.2, 1],
      opacity: [0.3, 0.5, 0.3],
    }}
    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    className={`absolute rounded-full ${color} pointer-events-none`}
    style={{ left: x, top: y, width: size, height: size, filter: `blur(${blur})` }}
  />
);

// Image paths for themes
const themeImages = {
  cosmos: '/images/onboarding/Cosmos.png',
  kingdom: '/images/onboarding/On 4.jpeg',
  cell: '/images/onboarding/On 5.png',
};

export const WelcomeHero: React.FC = () => {
  const { setTheme, setStep } = useOnboarding();
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleThemeSelect = (theme: ThemeOption) => {
    setSelectedTheme(theme);
    setTheme(theme);
    setTimeout(() => setStep('quiz'), 800);
  };

  const cards = [
    {
      id: 'cosmos' as ThemeOption,
      title: 'The Cosmos',
      desc: 'Explore galaxies, supernovas & celestial wonders',
      image: themeImages.cosmos,
      gradient: 'from-indigo-600 via-purple-600 to-blue-700',
      glow: 'shadow-[0_0_80px_rgba(99,102,241,0.5)]',
      particle: '✨'
    },
    {
      id: 'kingdom' as ThemeOption,
      title: 'The Kingdom',
      desc: 'Knights, dragons & enchanted realms await',
      image: themeImages.kingdom,
      gradient: 'from-amber-500 via-orange-500 to-red-600',
      glow: 'shadow-[0_0_80px_rgba(245,158,11,0.5)]',
      particle: '👑'
    },
    {
      id: 'cell' as ThemeOption,
      title: 'The Cell',
      desc: 'Dive into the microscopic universe of life',
      image: themeImages.cell,
      gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
      glow: 'shadow-[0_0_80px_rgba(16,185,129,0.5)]',
      particle: '🧬'
    }
  ];

  return (
    <div className="relative flex flex-col items-center h-full min-h-full px-4 py-4 md:py-6 overflow-x-hidden overflow-y-auto">
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-[#0d0d1a] to-slate-900" />
      
      {/* Animated grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-size-[60px_60px]"
      />

      {/* Ambient orbs */}
      <AmbientOrb color="bg-purple-600/30" size="400px" x="-10%" y="20%" blur="100px" />
      <AmbientOrb color="bg-blue-600/20" size="350px" x="70%" y="10%" blur="120px" />
      <AmbientOrb color="bg-amber-500/15" size="300px" x="60%" y="70%" blur="100px" />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <FloatingParticle
          key={i}
          delay={i * 0.3}
          size={Math.random() * 4 + 2}
          x={`${Math.random() * 100}%`}
          y={`${Math.random() * 100}%`}
          duration={4 + Math.random() * 4}
        />
      ))}

      {/* Radial spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-white/3 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center">
        <div className="w-full grid gap-4 md:gap-6 lg:gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left: Hero copy */}
          <div className="text-center lg:text-left">
            {/* Gen Mascot */}
            <motion.div
              initial={{ scale: 0, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", duration: 1, bounce: 0.4 }}
              className="relative mb-3 md:mb-5 inline-block mx-auto lg:mx-0"
            >
              <img
                src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
                alt="Gen - Your Creative Guide"
                className="w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 object-contain drop-shadow-2xl rounded-3xl"
              />

              {/* Sparkle accents */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="w-6 h-6 text-amber-400" />
              </motion.div>
            </motion.div>

            {/* Headline */}
            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h1 className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 md:mb-5 lg:mb-6 font-heading tracking-tight">
                    <span className="bg-linear-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                      Every journey begins
                    </span>
                    <br />
                    <span className="bg-linear-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                      with a spark.
                    </span>
                  </h1>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-base md:text-lg lg:text-xl text-white/50 mb-4 md:mb-6 lg:mb-0 max-w-xl mx-auto lg:mx-0 font-body leading-relaxed px-2 lg:px-0"
                  >
                    Genesis transforms your imagination into living, breathing worlds.
                    <br className="hidden md:block" />
                    <span className="text-white/70">What universe calls to you?</span>
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Theme cards */}
          <div className="w-full">
            <div className="grid grid-cols-3 gap-2 md:gap-5 lg:gap-4 w-full px-1 lg:px-0">
              {cards.map((card, index) => (
                <motion.button
                  key={card.id}
                  initial={{ opacity: 0, y: 40, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 0.5 + (index * 0.15),
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  whileHover={{
                    scale: 1.03,
                    y: -8,
                    transition: { duration: 0.3 }
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleThemeSelect(card.id)}
                  disabled={selectedTheme !== null}
                  className={`group relative overflow-hidden rounded-xl md:rounded-2xl lg:rounded-3xl p-2.5 md:p-6 lg:p-5 text-center transition-all duration-500 ${
                    selectedTheme === card.id
                      ? `${card.glow} ring-2 ring-white/30`
                      : selectedTheme !== null
                        ? 'opacity-30 scale-95'
                        : ''
                  }`}
                >
                  {/* Card Background with gradient */}
                  <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />

                  {/* Gradient border glow on hover */}
                  <div className={`absolute inset-0 bg-linear-to-br ${card.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                  {/* Card border */}
                  <div className="absolute inset-0 rounded-2xl md:rounded-3xl border border-white/10 group-hover:border-white/20 transition-colors" />

                  {/* Theme Image */}
                  <div className="relative z-10 mb-2 md:mb-4">
                    <motion.img
                      src={card.image}
                      alt={card.title}
                      className="w-14 h-14 md:w-28 md:h-28 lg:w-24 lg:h-24 xl:w-32 xl:h-32 mx-auto object-contain drop-shadow-2xl rounded-xl md:rounded-3xl"
                      whileHover={{ scale: 1.1, rotate: 3 }}
                      transition={{ duration: 0.3 }}
                    />

                    {/* Glow behind image */}
                    <div className={`absolute inset-0 bg-linear-to-br ${card.gradient} blur-3xl opacity-30 -z-10`} />
                  </div>

                  {/* Text content */}
                  <div className="relative z-10">
                    <h3 className="text-xs md:text-lg lg:text-lg xl:text-2xl font-bold text-white mb-0.5 md:mb-2 font-heading">{card.title}</h3>
                    <p className="text-[10px] md:text-sm lg:text-sm xl:text-base text-white/60 leading-tight md:leading-relaxed hidden md:block">{card.desc}</p>
                  </div>

                  {/* Floating particle on selection */}
                  {selectedTheme === card.id && (
                    <motion.div
                      initial={{ scale: 0, y: 0 }}
                      animate={{ scale: [1, 1.5], y: -100, opacity: [1, 0] }}
                      transition={{ duration: 0.8 }}
                      className="absolute top-1/2 left-1/2 text-4xl"
                    >
                      {card.particle}
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Subtle hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-4 md:mt-10 lg:mt-4 text-white/30 text-xs md:text-sm pb-4 text-center"
            >
              ✦ Choose your realm to begin ✦
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
};
