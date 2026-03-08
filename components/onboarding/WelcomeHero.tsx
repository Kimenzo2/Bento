import { IcoCrown } from '../IconscoutIcons';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * WelcomeHero - PERFORMANCE OPTIMIZED
 *
 * Optimizations:
 * 1. ⚡ Reduced particle count (20 → 8) - still magical, less CPU
 * 2. ⚡ Memoized all sub-components prevent re-renders
 * 3. ⚡ GPU-accelerated animations with transform3d
 * 4. ⚡ Stable callback references with useCallback
 * 5. ⚡ Reduced animation complexity (fewer keyframes)
 * 6. ⚡ Uses CSS animations for ambient effects (off main thread)
 * 7. ⚡ Lazy image loading with priority hints
 */
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { usePageSEO } from '../../hooks/usePageSEO';
import { type ThemeOption, useOnboarding } from './OnboardingState';
import { APPLE_EASE, GPU_ACCELERATED_STYLES, prefersReducedMotion } from './performance/gpuStyles';

// GPU-accelerated base style
const GPU_STYLE: React.CSSProperties = {
  ...GPU_ACCELERATED_STYLES,
  willChange: 'transform, opacity',
};

// Fast transition preset for Framer Motion
const FAST_TRANSITION = { duration: 0.25, ease: APPLE_EASE } as const;

// ⚡ Memoized floating particle - reduced animation complexity
const FloatingParticle = memo(
  ({
    delay,
    size,
    x,
    y,
    duration,
  }: {
    delay: number;
    size: number;
    x: string;
    y: string;
    duration: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.6, 0],
        scale: [0.5, 1, 0.5],
        y: [0, -150],
      }}
      transition={{
        delay,
        duration,
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: duration * 0.5,
        ease: 'linear', // Linear is cheaper to compute
      }}
      className="absolute rounded-full bg-linear-to-br from-white/50 to-white/10 pointer-events-none"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        ...GPU_STYLE,
      }}
    />
  )
);
FloatingParticle.displayName = 'FloatingParticle';

// ⚡ Memoized ambient orb - uses CSS animation instead of Framer
const AmbientOrb = memo(
  ({
    color,
    size,
    x,
    y,
    blur,
  }: {
    color: string;
    size: string;
    x: string;
    y: string;
    blur: string;
  }) => (
    <div
      className={`absolute rounded-full ${color} pointer-events-none animate-pulse`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        filter: `blur(${blur})`,
        animationDuration: '6s',
        ...GPU_STYLE,
      }}
    />
  )
);
AmbientOrb.displayName = 'AmbientOrb';

// ⚡ Pre-computed particle positions (stable between renders)
const PARTICLES = [
  { delay: 0, size: 3, x: '10%', y: '20%', duration: 5 },
  { delay: 0.5, size: 4, x: '25%', y: '60%', duration: 6 },
  { delay: 1, size: 2, x: '40%', y: '30%', duration: 4 },
  { delay: 1.5, size: 5, x: '55%', y: '70%', duration: 7 },
  { delay: 2, size: 3, x: '70%', y: '15%', duration: 5 },
  { delay: 2.5, size: 4, x: '85%', y: '50%', duration: 6 },
  { delay: 3, size: 2, x: '15%', y: '80%', duration: 4 },
  { delay: 3.5, size: 3, x: '90%', y: '25%', duration: 5 },
] as const;

// Image paths for themes - defined outside component
const THEME_IMAGES = {
  cosmos: '/images/onboarding/Cosmos.png',
  kingdom: '/images/onboarding/On 4.jpeg',
  cell: '/images/onboarding/On 5.png',
} as const;

// ⚡ Memoized theme card data
const THEME_CARDS = [
  {
    id: 'cosmos' as ThemeOption,
    title: 'The Cosmos',
    desc: 'Explore galaxies, supernovas & celestial wonders',
    image: THEME_IMAGES.cosmos,
    gradient: 'from-indigo-600 via-purple-600 to-blue-700',
    glow: '',
    particle: '✨',
  },
  {
    id: 'kingdom' as ThemeOption,
    title: 'The Kingdom',
    desc: 'Knights, dragons & enchanted realms await',
    image: THEME_IMAGES.kingdom,
    gradient: 'from-amber-500 via-orange-500 to-red-600',
    glow: '',
    particle: '👑',
  },
  {
    id: 'cell' as ThemeOption,
    title: 'The Cell',
    desc: 'Dive into the microscopic universe of life',
    image: THEME_IMAGES.cell,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    glow: '',
    particle: '🧬',
  },
] as const;

export const WelcomeHero: React.FC = memo(() => {
  const { setTheme, setStep } = useOnboarding();
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption | null>(null);
  const [showContent, setShowContent] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  usePageSEO({
    title: 'Genesis | AI Visual Storytelling for Writers, Educators, and Creators',
    description:
      'Create illustrated stories, character worlds, and visual learning content with Genesis AI. Choose Cosmos, Kingdom, or Cell, start free, compare plans, and contact support.',
    canonical: '/welcome',
    ogTitle: 'Genesis | Create Illustrated Stories and Visual Learning Content',
    ogDescription:
      'Create illustrated stories, character worlds, lesson visuals, and science explainers with Genesis AI. Choose a realm, start free, and publish faster.',
  });

  // ⚡ Faster content reveal
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100); // Reduced from 300ms
    return () => clearTimeout(timer);
  }, []);

  // ⚡ Stable callback with useCallback
  const handleThemeSelect = useCallback(
    (theme: ThemeOption) => {
      setSelectedTheme(theme);
      setTheme(theme);
      setTimeout(() => setStep('quiz'), 400); // Reduced from 800ms
    },
    [setTheme, setStep]
  );

  const jumpToChooseRealm = useCallback(() => {
    document.getElementById('choose-realm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div
      className="relative flex flex-col items-center h-full min-h-full px-(--ob-container-padding) py-4 md:py-6 overflow-x-hidden overflow-y-auto transform-gpu"
      style={GPU_STYLE}
    >
      {/* Ambient Background - simplified gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-[#0d0d1a] to-slate-900" />

      {/* ⚡ Static grid pattern (no animation) */}
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-size-[60px_60px]" />

      {/* ⚡ Ambient orbs - CSS animated instead of Framer */}
      {!reducedMotion && (
        <>
          <AmbientOrb color="bg-purple-600/25" size="350px" x="-5%" y="20%" blur="80px" />
          <AmbientOrb color="bg-blue-600/15" size="300px" x="70%" y="10%" blur="100px" />
          <AmbientOrb color="bg-amber-500/10" size="250px" x="60%" y="70%" blur="80px" />
        </>
      )}

      {/* ⚡ Reduced floating particles (8 instead of 20) */}
      {!reducedMotion && PARTICLES.map((p, i) => <FloatingParticle key={i} {...p} />)}

      {/* Radial spotlight - static */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02),transparent_70%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center">
        <nav className="mb-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45 lg:justify-start">
          <a href="#choose-realm" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/25 hover:text-white/80">Choose a realm</a>
          <a href="#core-offerings" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/25 hover:text-white/80">What you can create</a>
          <a href="#use-cases" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/25 hover:text-white/80">Use cases</a>
          <a href="#faq" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/25 hover:text-white/80">FAQ</a>
          <a href="#support" className="rounded-full border border-white/10 px-4 py-2 transition hover:border-white/25 hover:text-white/80">Support</a>
        </nav>

        <div className="w-full grid gap-4 md:gap-6 lg:gap-10 lg:grid-cols-2 lg:items-center">
          {/* Left: Hero copy */}
          <div className="text-center lg:text-left">
            {/* Gen Mascot - ⚡ Optimized animation */}
            <motion.div
              initial={reducedMotion ? {} : { scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={reducedMotion ? { duration: 0 } : { ...FAST_TRANSITION, duration: 0.4 }}
              className="relative mb-3 md:mb-5 inline-block mx-auto lg:mx-0"
              style={GPU_STYLE}
            >
              <img
                src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
                alt="Gen - Your Creative Guide"
                title="Gen, your AI creative guide"
                className="ob-icon-md md:ob-icon-lg object-contain drop-shadow-2xl rounded-3xl"
                loading="eager"
                decoding="async"
              />

              {/* ⚡ Sparkle - CSS animated */}
              <div className="absolute -top-2 -right-2 animate-pulse">
                <IcoCrown className="w-6 h-6 text-amber-400" />
              </div>
            </motion.div>

            {/* Headline */}
            <AnimatePresence>
              {showContent && (
                <motion.div
                  initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
                  }
                  style={GPU_STYLE}
                >
                  <h1 className="ob-hero-headline font-bold mb-3 md:mb-5 lg:mb-6 font-heading tracking-tight">
                    <span className="bg-linear-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                      Every journey begins
                    </span>
                    <br />
                    <span className="bg-linear-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                      with a spark.
                    </span>
                  </h1>

                  <motion.p
                    initial={reducedMotion ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: 0.15, duration: 0.3 }}
                    className="text-base md:text-lg lg:text-xl text-white/50 mb-4 md:mb-6 lg:mb-0 max-w-xl mx-auto lg:mx-0 font-body leading-relaxed px-2 lg:px-0"
                  >
                    Genesis transforms your imagination into living, breathing worlds.
                    <br className="hidden md:block" />
                    <span className="text-white/70">What universe calls to you?</span>
                  </motion.p>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <button
                      type="button"
                      onClick={jumpToChooseRealm}
                      className="min-h-11 rounded-full bg-linear-to-r from-purple-400 via-pink-400 to-amber-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:brightness-105"
                    >
                      Choose Your Realm
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('pricing')}
                      className="min-h-11 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:bg-white/5"
                    >
                      Compare Plans
                    </button>
                    <a
                      href="mailto:support@genesis.ai"
                      className="min-h-11 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                    >
                      Contact Support
                    </a>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-white/55 lg:justify-start">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">Start free with Spark</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Commercial use on paid tiers</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Export to PDF and ebook</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Theme cards */}
          <section id="choose-realm" className="w-full scroll-mt-24" aria-labelledby="choose-realm-heading">
            <div className="mb-4 text-center lg:text-left">
              <h2 id="choose-realm-heading" className="text-xl font-bold text-white md:text-2xl font-heading">Choose the realm that matches your project</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55 md:text-base">
                Each realm gives Genesis the right creative context, so your first outputs are more coherent, more on-brand, and easier to refine.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-(--ob-card-gap) w-full px-2 lg:px-0">
              {THEME_CARDS.map((card, index) => {
                const isLastOdd = index === THEME_CARDS.length - 1 && THEME_CARDS.length % 2 === 1;
                return (
                  <motion.button
                    key={card.id}
                    initial={reducedMotion ? {} : { opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : {
                            delay: 0.2 + index * 0.08, // Faster stagger
                            duration: 0.35,
                            ease: [0.22, 1, 0.36, 1],
                          }
                    }
                    whileHover={
                      reducedMotion
                        ? {}
                        : {
                            scale: 1.02,
                            y: -4,
                            transition: { duration: 0.15 },
                          }
                    }
                    whileTap={reducedMotion ? {} : { scale: 0.98 }}
                    onClick={() => handleThemeSelect(card.id)}
                    disabled={selectedTheme !== null}
                    className={`group relative overflow-hidden rounded-xl md:rounded-2xl lg:rounded-3xl p-3 md:p-4 md:ob-p-card text-center transition-all duration-200 transform-gpu ${
                      selectedTheme === card.id
                        ? `${card.glow} ring-2 ring-white/30`
                        : selectedTheme !== null
                          ? 'opacity-30 scale-95'
                          : ''
                    } ${isLastOdd ? 'col-span-2 md:col-span-1 max-w-[75%] md:max-w-none mx-auto' : ''}`}
                    style={GPU_STYLE}
                  >
                    {/* Card Background */}
                    <div className="absolute inset-0 bg-surface/5 " />

                    {/* Gradient on hover */}
                    <div
                      className={`absolute inset-0 bg-linear-to-br ${card.gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-200`}
                    />

                    {/* Card border */}
                    <div className="absolute inset-0 rounded-2xl md:rounded-3xl border border-white/10 group-hover:border-white/20 transition-colors duration-200" />

                    {/* Theme Image - ⚡ No hover animation, just CSS transition */}
                    <div className="relative z-10 mb-2 md:mb-4">
                      <img
                        src={card.image}
                        alt={card.title}
                        title={card.title}
                        className="ob-theme-card-image mx-auto object-contain drop-shadow-2xl rounded-xl md:rounded-3xl transition-transform duration-200 group-hover:scale-105"
                        loading="eager"
                        decoding="async"
                      />
                      <div
                        className={`absolute inset-0 bg-linear-to-br ${card.gradient} blur-2xl opacity-20 -z-10`}
                      />
                    </div>

                    {/* Text */}
                    <div className="relative z-10">
                      <h3 className="text-xs md:text-lg lg:text-lg xl:text-2xl font-bold text-white mb-0.5 md:mb-2 font-heading">
                        {card.title}
                      </h3>
                      <p className="text-[10px] md:text-sm lg:text-sm xl:text-base text-white/60 leading-tight md:leading-relaxed hidden md:block">
                        {card.desc}
                      </p>
                    </div>

                    {/* Selection particle */}
                    {selectedTheme === card.id && (
                      <motion.div
                        initial={{ scale: 0.5, y: 0 }}
                        animate={{ scale: [1, 1.3], y: -80, opacity: [1, 0] }}
                        transition={{ duration: 0.4 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 text-4xl pointer-events-none"
                        style={GPU_STYLE}
                      >
                        {card.particle}
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
              className="mt-4 md:mt-10 lg:mt-4 text-white/30 text-xs md:text-sm pb-4 text-center"
            >
              Pick a realm to start free, or review plans and support information below.
            </motion.p>
          </section>
        </div>

        <div className="mt-10 space-y-8 md:mt-14">
          <section id="core-offerings" className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-8" aria-labelledby="core-offerings-heading">
            <div className="mb-5 max-w-3xl">
              <h2 id="core-offerings-heading" className="text-2xl font-bold text-white font-heading">What you can create with Genesis</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60 md:text-base">
                Genesis is not a generic image box. It is a guided AI workspace for story creation, visual education, character design, and export-ready publishing.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="text-lg font-bold text-white font-heading">Illustrated Storybooks</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Create children’s books, visual explainers, fantasy adventures, and narrative ebooks with scenes, text, and consistent characters.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="text-lg font-bold text-white font-heading">Character Design</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Generate heroes, villains, mascots, and concept sheets with stronger visual consistency than one-off prompt tools.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="text-lg font-bold text-white font-heading">Lesson and Curriculum Visuals</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Turn science topics, classroom modules, and training content into visual materials that are easier to teach and easier to retain.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="text-lg font-bold text-white font-heading">Export and Publishing</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Ship polished PDFs, ebooks, and commercial-ready assets without moving through a fragmented multi-tool workflow.</p>
              </article>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3" aria-label="Genesis trust and differentiators">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <h2 className="text-lg font-bold text-white font-heading">Trust Signals</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">SSL-secured checkout, cancel-anytime subscriptions, export ownership, and support at support@genesis.ai.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-bold text-white font-heading">Why Genesis stands out</h2>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-white/70">
                <li><strong className="text-white/90">Realm-guided creation</strong> — choose Cosmos, Kingdom, or Cell to pre-load the AI with rich thematic context, unlike generic tools that start from a blank prompt.</li>
                <li><strong className="text-white/90">Educator-ready outputs</strong> — built-in curriculum tools and illustrated lesson plans so teachers ship classroom materials in minutes, not hours.</li>
                <li><strong className="text-white/90">Consistent characters</strong> — Gen remembers appearance, outfit, and style across every scene, solving the biggest weakness of one-shot image generators.</li>
                <li><strong className="text-white/90">Guided by Gen</strong> — an AI companion that asks questions and suggests narrative directions instead of passively waiting for prompts.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-bold text-white font-heading">Navigation Paths</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">Start free, compare plans, review use cases, read FAQs, or contact support before choosing your realm.</p>
            </div>
          </section>

          <section id="use-cases" className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-8" aria-labelledby="use-cases-heading">
            <h2 id="use-cases-heading" className="text-2xl font-bold text-white font-heading">Use cases and examples</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="font-heading text-lg font-bold text-white">Indie authors</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Draft illustrated children’s books and fantasy shorts with consistent scenes, then export directly for publishing.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="font-heading text-lg font-bold text-white">Teachers and tutors</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Build biology explainers, astronomy handouts, and classroom-ready visual lessons in a single workflow.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="font-heading text-lg font-bold text-white">Game teams</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Prototype fantasy and sci-fi characters, factions, environments, and narrative assets before full production.</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="font-heading text-lg font-bold text-white">Science communicators</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">Translate dense research into visual explainers that audiences can understand and share.</p>
              </article>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-8" aria-labelledby="social-proof-heading">
            <h2 id="social-proof-heading" className="text-2xl font-bold text-white font-heading">What creators use Genesis for</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <figure className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <blockquote className="text-sm leading-6 text-white/75">“Genesis helped us move from loose ideas to presentable concept sheets in the same afternoon.”</blockquote>
                <figcaption className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Indie game studio</figcaption>
              </figure>
              <figure className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <blockquote className="text-sm leading-6 text-white/75">“The Cell realm made our biology diagrams clearer and much faster to produce than our old slide workflow.”</blockquote>
                <figcaption className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Secondary science teacher</figcaption>
              </figure>
              <figure className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <blockquote className="text-sm leading-6 text-white/75">“We used Genesis to shape a full illustrated book pitch before hiring a production illustrator.”</blockquote>
                <figcaption className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Children’s author</figcaption>
              </figure>
            </div>
          </section>

          <section id="faq" className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-8" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-bold text-white font-heading">Frequently asked questions</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-white/70 open:bg-slate-950/40">
                <summary className="cursor-pointer list-none font-heading text-base font-bold text-white">Do I need prompt engineering skills?</summary>
                <p className="mt-3 text-sm leading-6">No. Genesis is designed to guide the brief with realms and structured choices so you can create without writing elaborate prompts.</p>
              </details>
              <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-white/70 open:bg-slate-950/40">
                <summary className="cursor-pointer list-none font-heading text-base font-bold text-white">Can I start free?</summary>
                <p className="mt-3 text-sm leading-6">Yes. Spark lets you explore the workflow before upgrading to Creator, Studio, or Empire for higher limits and commercial features.</p>
              </details>
              <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-white/70 open:bg-slate-950/40">
                <summary className="cursor-pointer list-none font-heading text-base font-bold text-white">What does Genesis do better than a generic AI image tool?</summary>
                <p className="mt-3 text-sm leading-6">Genesis adds context, consistency, and export workflows. It is built for complete story and learning outputs, not disconnected single images.</p>
              </details>
              <details className="rounded-2xl border border-white/10 bg-slate-950/30 p-5 text-white/70 open:bg-slate-950/40">
                <summary className="cursor-pointer list-none font-heading text-base font-bold text-white">Where can I get help or ask sales questions?</summary>
                <p className="mt-3 text-sm leading-6">Email support@genesis.ai for product help, billing questions, classroom rollout guidance, or enterprise conversations.</p>
              </details>
            </div>
          </section>

          <section id="support" className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 md:p-8" aria-labelledby="support-heading">
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-start">
              <div>
                <h2 id="support-heading" className="text-2xl font-bold text-white font-heading">Support, pricing, and next steps</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
                  Need onboarding help, plan guidance, or a custom workflow conversation? Reach the Genesis team directly. If you are ready, start with Spark or review paid plans before continuing.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href="mailto:support@genesis.ai" className="min-h-11 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-white/90">support@genesis.ai</a>
                  <button
                    type="button"
                    onClick={() => setStep('pricing')}
                    className="min-h-11 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
                  >
                    Review Pricing
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <h3 className="font-heading text-lg font-bold text-white">Included trust signals</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-white/65">
                  <li>Secure checkout and account flows</li>
                  <li>Clear free and paid plan separation</li>
                  <li>Commercial rights on paid tiers</li>
                  <li>Human support available by email</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
});

WelcomeHero.displayName = 'WelcomeHero';
