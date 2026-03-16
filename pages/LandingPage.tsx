/**
 * LandingPage.tsx — Genesis Public Landing Page
 *
 * THEME-AWARE: This page uses CSS variables from the Genesis theme system.
 * It responds to all 6 themes (Genesis Classic, Aurora Scholar, Ocean Academy,
 * Forest Wisdom, Nebula Mind, Sunset Scholar) in both light and dark modes.
 *
 * The ThemeProvider (wrapped in AppRouter.tsx) injects CSS variables onto
 * document.documentElement. This page reads them via var() and Tailwind
 * theme classes (bg-cream-base, text-charcoal-soft, etc.).
 *
 * Zero blur anywhere. All copy extracted from the original WelcomeHero.tsx.
 */

import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Menu,
  Microscope,
  Palette,
  PenTool,
  Shield,
  Sparkles,
  Star,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { IcoCrown, IcoRocket, IcoWand } from '../components/IconscoutIcons';
import SparkleCursor from '../components/SparkleCursor';
import { usePageSEO } from '../hooks/usePageSEO';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router';

// ---------------------------------------------------------------------------
// DESIGN TOKENS — CSS VARIABLE REFERENCES
// These read from the active theme. ThemeProvider injects the values.
// Tailwind classes are used wherever possible; var() for inline styles only.
//
// Mapping (from tailwind.config.js + index.css):
//   bg-cream-base        → var(--color-background)
//   bg-surface            → var(--color-surface)
//   text-charcoal-soft    → var(--color-text)
//   text-cocoa-light      → var(--color-text-light)
//   border-peach-soft     → var(--color-border)
//   text-coral-burst      → var(--color-primary-start)
//   bg-coral-burst        → var(--color-primary-start)
//   bg-gold-sunshine      → var(--color-primary-end)
// ---------------------------------------------------------------------------

// Only motion/spacing constants are static — colours come from CSS vars
const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// DNA Section 5: active:scale-[0.98] press, focus ring (ring-4 coral-burst/40)
const BTN_PRESS = 'active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral-burst/40';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: APPLE_EASE },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// ---------------------------------------------------------------------------
// SECTION WRAPPER — consistent max-width and padding (DNA Section 8)
// ---------------------------------------------------------------------------

const Section: React.FC<{
  id?: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  accent?: boolean;
  'aria-labelledby'?: string;
}> = ({ id, children, className = '', dark, accent, ...rest }) => {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  // Accent sections use the theme's primary gradient
  // Dark sections pull the dark-mode background via a custom classname approach
  let bgClass = '';
  let bgStyle: React.CSSProperties = {};
  if (accent) {
    bgStyle = {
      background: 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
    };
  } else if (dark) {
    bgClass = 'landing-dark-section';
  }

  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={reducedMotion ? {} : { opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: APPLE_EASE }}
      className={`px-5 md:px-12 ${bgClass} ${className}`}
      style={Object.keys(bgStyle).length > 0 ? bgStyle : undefined}
      {...rest}
    >
      <div className="mx-auto max-w-6xl w-full">{children}</div>
    </motion.section>
  );
};

// ---------------------------------------------------------------------------
// GLOW CARD — Vercel-style glow from DNA Section 3
// Uses radial-gradient with the theme's primary colour, NOT blur
// ---------------------------------------------------------------------------

const GlowCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  defaultGlowPosition?: string;
  as?: 'div' | 'figure' | 'article';
}> = ({ children, className = '', defaultGlowPosition = '50% 100%', as: Tag = 'div' }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Glow uses --color-shadow (RGB triplet) from the active theme
  // DNA Section 3: rgba(R,G,B, 0.35), 600px circle
  const glowGradient = (position: string) =>
    `radial-gradient(600px circle at ${position}, rgba(var(--color-shadow), 0.35), transparent 40%)`;

  return (
    <Tag
      ref={cardRef as React.Ref<HTMLDivElement>}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden bg-surface border border-peach-soft rounded-2xl transition-transform duration-300 ${className}`}
    >
      {/* Static default glow — opacity 0.8, fades to 0 on hover */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          opacity: hovered ? 0 : 0.8,
          background: glowGradient(defaultGlowPosition),
        }}
      />
      {/* Interactive hover glow — follows mouse, opacity 0 → 1 */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: glowGradient(`${mousePos.x}px ${mousePos.y}px`),
        }}
      />
      <div className="relative z-10">{children}</div>
    </Tag>
  );
};

// ---------------------------------------------------------------------------
// BLOB — organic shapes, 10-20% opacity, NO blur (DNA Section 3)
// Uses theme's primary-start / primary-end for colour
// ---------------------------------------------------------------------------

const Blob: React.FC<{
  variant: 'primary' | 'secondary' | 'white';
  size: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  opacity?: number;
  animate?: boolean;
  delay?: string;
}> = ({ variant, size, top, left, right, bottom, opacity = 0.12, animate = false, delay = '0s' }) => (
  <div
    className={`absolute rounded-full pointer-events-none ${animate ? 'animate-float motion-reduce:animate-none' : ''}`}
    style={{
      backgroundColor:
        variant === 'primary'
          ? 'var(--color-primary-start)'
          : variant === 'secondary'
            ? 'var(--color-primary-end)'
            : '#FFFFFF',
      width: size,
      height: size,
      top,
      left,
      right,
      bottom,
      opacity,
      animationDelay: animate ? delay : undefined,
    }}
  />
);

// ---------------------------------------------------------------------------
// FAQ ITEM — expand/collapse with DNA motion
// ---------------------------------------------------------------------------

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const faqId = useMemo(() => `faq-${question.replace(/\s+/g, '-').toLowerCase().slice(0, 30)}`, [question]);
  return (
    <div className="border border-peach-soft rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={faqId}
        className="w-full flex items-center justify-between p-5 text-left font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded-2xl"
      >
        <span className="font-bold text-base text-charcoal-soft">{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: APPLE_EASE }}
          aria-hidden="true"
        >
          <ChevronDown className="w-5 h-5 text-cocoa-light" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={faqId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: APPLE_EASE }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-cocoa-light font-body">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ===========================================================================
// LANDING PAGE COMPONENT
// ===========================================================================

const LandingPage: React.FC = memo(() => {
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { currentTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  // Extract the dark-mode CSS variables from the ACTIVE theme.
  // This allows dark sections (Education, Footer) to use the correct
  // dark palette for whichever of the 6 themes is selected — not just Genesis Classic.
  // When global dark mode is active, use the surface color as the section bg
  // so these sections are distinguishable from the main background.
  const darkVars = useMemo(() => {
    const dark = currentTheme.darkCssVariables || {};
    return {
      bg: isDarkMode
        ? (dark['--color-surface'] || '#2A201D')
        : (dark['--color-background'] || '#1A1412'),
      surface: dark['--color-surface'] || '#2A201D',
      text: dark['--color-text'] || '#EAE0D5',
      textMuted: dark['--color-text-light'] || '#A89F91',
      border: dark['--color-border'] || '#3D302B',
    };
  }, [currentTheme, isDarkMode]);

  usePageSEO({
    title: 'Genesis | AI Visual Storytelling for Writers, Educators, and Creators',
    description:
      'Create illustrated stories, character worlds, and visual learning content with Genesis AI. Choose Cosmos, Kingdom, or Cell, start free, compare plans, and contact support.',
    canonical: '/welcome',
    ogTitle: 'Genesis | Create Illustrated Stories and Visual Learning Content',
    ogDescription:
      'Create illustrated stories, character worlds, lesson visuals, and science explainers with Genesis AI. Choose a realm, start free, and publish faster.',
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenuOpen(false);
  }, []);

  const navLinks = [
    { label: t('landing.navRealms', 'Choose a realm'), id: 'realms' },
    { label: t('landing.navFeatures', 'What you can create'), id: 'features' },
    { label: t('landing.navUseCases', 'Use cases'), id: 'use-cases' },
    { label: t('landing.navFaq', 'FAQ'), id: 'faq' },
    { label: t('landing.navSupport', 'Support'), id: 'support' },
  ];

  // =========================================================================
  // NAVIGATION — solid bg-cream-base, border on scroll, no blur
  // =========================================================================

  const Nav = (
    <nav
      aria-label="Primary navigation"
      className="fixed top-0 left-0 right-0 z-50 bg-cream-base transition-[border-color] duration-300"
      style={{
        borderBottom: scrolled
          ? '2px solid var(--color-border)'
          : '2px solid transparent',
      }}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-5 md:px-12 h-16">
        {/* Logo */}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded-xl" aria-label="Scroll to top">
          <div className="w-10 h-10 overflow-hidden rounded-xl border border-peach-soft">
            <img
              src="/genesis-icon.jpg"
              alt="Genesis"
              width={378}
              height={369}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
          <span className="font-heading font-normal text-xl tracking-normal text-charcoal-soft">
            Genesis
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => scrollTo(link.id)}
              className="px-3 py-2 text-sm font-body text-cocoa-light rounded-full transition-colors duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right: Sign In + CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="px-4 py-2 text-sm font-semibold font-body text-charcoal-soft rounded-full transition-colors duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50"
          >
            {t('navigation:login', 'Sign In')}
          </button>
          <button
            type="button"
            className={`px-5 py-2.5 text-sm font-medium font-body text-white rounded-full transition-opacity duration-200 hover:opacity-90 ${BTN_PRESS}`}
            style={{
              background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))',
            }}
            onClick={() => navigate('/auth?returnTo=/welcome/onboarding')}
          >
            {t('landing.getStarted', 'Get Started')}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded-lg"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? t('navigation:closeMenu', 'Close menu') : t('navigation:openMenu', 'Open menu')}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6 text-charcoal-soft" aria-hidden="true" />
          ) : (
            <Menu className="w-6 h-6 text-charcoal-soft" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile drawer — solid bg-cream-base */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? {} : { opacity: 0, height: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: APPLE_EASE }}
            className="md:hidden overflow-hidden bg-cream-base"
          >
            <div className="px-5 pb-6 pt-2 flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => scrollTo(link.id)}
                  className="text-left px-4 py-3 text-sm font-medium font-body text-charcoal-soft rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50"
                >
                  {link.label}
                </button>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); navigate('/auth'); }}
                  className="text-center px-4 py-3 text-sm font-semibold text-charcoal-soft border border-peach-soft rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50"
                >
                  {t('navigation:login', 'Sign In')}
                </button>
                <button
                  type="button"
                  className={`text-center px-4 py-3 text-sm font-medium font-body text-white rounded-full ${BTN_PRESS}`}
                  style={{
                    background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))',
                  }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/auth?returnTo=/welcome/onboarding');
                  }}
                >
                  {t('landing.getStarted', 'Get Started')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );

  // =========================================================================
  // HERO — 100vh, two columns, blobs + dot grid, mascot in glow card
  // =========================================================================

  const Hero = (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16 bg-cream-base">
      {/* Background blobs — theme-coloured, NO blur, animated float */}
      <Blob variant="primary" size="400px" top="-100px" right="-100px" opacity={0.08} animate delay="0s" />
      <Blob variant="secondary" size="350px" bottom="-80px" left="-80px" opacity={0.1} animate delay="2s" />

      {/* Dot grid — DNA Section 3: 0.03 opacity */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-text-light) 0.5px, transparent 0.5px)',
          backgroundSize: '32px 32px',
          opacity: 0.03,
        }}
      />

      {/* Radial spotlight vignette — DNA Section 3: 500-800px, 0.03 opacity */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(700px ellipse at 30% 50%, rgba(var(--color-shadow), 0.04), transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-6xl w-full px-5 md:px-12 py-12 md:py-20 lg:py-0">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left — text */}
          <motion.div
            className="text-center lg:text-left"
            variants={stagger}
            initial="initial"
            animate="animate"
          >
            {/* Badge */}
            <motion.div variants={fadeUp}>
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold font-body text-coral-burst mb-6 rounded-full"
                style={{
                  border: '1px solid rgba(var(--color-shadow), 0.2)',
                  backgroundColor: 'rgba(var(--color-shadow), 0.05)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {t('landing.badge', 'Start free with Spark')}
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-[-0.01em] leading-[1.15] mb-5 font-heading text-charcoal-soft"
            >
              {t('landing.heroLine1', 'Write the story.')}
              <br />
              <span
                style={{
                  background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('landing.heroLine2', 'Genesis illustrates every page.')}
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              className="text-base md:text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0 font-body text-cocoa-light"
            >
              {t('landing.subheadline', 'Every scene painted. Every character remembered.')}
              <br className="hidden md:block" />
              <span className="text-charcoal-soft">{t('landing.subheadline2', 'Your story, finished.')}</span>
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <button
                type="button"
                onClick={() => navigate('/auth?returnTo=/welcome/onboarding')}
                className={`px-6 py-3 text-sm font-medium font-body text-white rounded-full transition-opacity hover:opacity-90 ${BTN_PRESS}`}
                style={{
                  background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))',
                }}
              >
                {t('landing.chooseRealm', 'Choose Your Realm')}
              </button>
              <button
                type="button"
                onClick={() => scrollTo('pricing')}
                className={`px-6 py-3 text-sm font-semibold font-body text-charcoal-soft border border-peach-soft rounded-full transition-colors hover:opacity-80 ${BTN_PRESS}`}
              >
                {t('landing.comparePlans', 'Compare Plans')}
              </button>
              <a
                href="mailto:support@iamazeyou.me"
                className="px-6 py-3 text-sm font-semibold font-body text-cocoa-light rounded-full transition-colors hover:opacity-80"
              >
                {t('landing.contactSupport', 'Contact Support')}
              </a>
            </motion.div>

            {/* Social proof pills */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-6">
              {[t('landing.pillFree', 'Start free with Spark'), t('landing.pillCommercial', 'Commercial use on paid tiers'), t('landing.pillExport', 'Export to PDF and ebook')].map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1.5 text-xs font-body text-cocoa-light border border-peach-soft rounded-full"
                >
                  {pill}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right — Mascot in GlowCard */}
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', bounce: 0.25, duration: 0.8 }}
            className="flex justify-center lg:justify-end"
          >
            <GlowCard className="max-w-sm w-full hover:-translate-y-1">
              <div className="p-6 md:p-8">
                <img
                  src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
                  alt="Gen - Your Creative Guide"
                  title="Gen, your AI creative guide"
                  width={332}
                  height={302}
                  className="w-full object-contain rounded-3xl"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
                <p className="text-center mt-4 text-sm font-medium font-body text-cocoa-light">
                  Gen, your AI creative guide
                </p>
              </div>
            </GlowCard>
          </motion.div>
        </div>
      </div>
    </section>
  );

  // =========================================================================
  // SOCIAL PROOF BAR
  // =========================================================================

  const SocialProofBar = (
    <div className="py-5 overflow-hidden bg-surface border-y border-peach-soft">
      <div className="mx-auto max-w-6xl px-5 md:px-12">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          {[
            { text: 'Join 100,000+ creators', icon: Users },
            { text: 'SSL-secured checkout', icon: Shield },
            { text: 'Cancel anytime', icon: Check },
            { text: 'Export ownership', icon: Upload },
          ].map(({ text, icon: IconComp }) => (
            <div
              key={text}
              className="flex items-center gap-2 text-xs font-semibold font-body text-cocoa-light uppercase tracking-widest"
            >
              <IconComp className="w-4 h-4 text-coral-burst" aria-hidden="true" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // THE THREE REALMS — glow cards, hover lift
  // =========================================================================

  const realms = [
    { title: 'The Cosmos', desc: 'Explore galaxies, supernovas & celestial wonders', image: '/images/onboarding/Cosmos.png', icon: IcoRocket, w: 369, h: 316, realm: 'cosmos' },
    { title: 'The Kingdom', desc: 'Knights, dragons & enchanted realms await', image: '/images/onboarding/On 4.jpeg', icon: IcoCrown, w: 264, h: 310, realm: 'kingdom' },
    { title: 'The Cell', desc: 'Dive into the microscopic universe of life', image: '/images/onboarding/On 5.png', icon: Microscope, w: 309, h: 309, realm: 'cell' },
  ];

  const RealmsSection = (
    <Section id="realms" className="py-20 md:py-28 relative" aria-labelledby="realms-heading">
      {/* Dot grid — DNA Section 3 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-text-light) 0.5px, transparent 0.5px)',
          backgroundSize: '32px 32px',
          opacity: 0.03,
        }}
      />
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="realms-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-4 font-heading text-charcoal-soft">
          Choose the realm that matches your project
        </motion.h2>
        <motion.p {...fadeUp} className="text-base md:text-lg leading-relaxed max-w-2xl mx-auto font-body text-cocoa-light">
          Each realm gives Genesis the right creative context, so your first outputs are more coherent, more on-brand, and easier to refine.
        </motion.p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {realms.map((realm, i) => (
          <motion.button
            key={realm.title}
            type="button"
            initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, ease: APPLE_EASE, delay: i * 0.08 }}
            whileHover={reducedMotion ? {} : { y: -4, scale: 1.02, transition: { duration: 0.15 } }}
            onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(`/welcome/onboarding?realm=${realm.realm}`)}`)}
            aria-label={`Choose ${realm.title} realm`}
            className="text-left"
          >
            <GlowCard className="h-full cursor-pointer" defaultGlowPosition={['0% 100%', '50% 100%', '100% 100%'][i]}>
              <div className="p-6 md:p-8 text-center">
                <img
                  src={realm.image}
                  alt={realm.title}
                  width={realm.w}
                  height={realm.h}
                  className="w-full max-h-48 object-contain mx-auto mb-6 rounded-xl"
                  loading="lazy"
                  decoding="async"
                />
                <h3 className="text-xl md:text-2xl font-normal mb-2 font-heading text-charcoal-soft">{realm.title}</h3>
                <p className="text-sm leading-relaxed font-body text-cocoa-light">{realm.desc}</p>
              </div>
            </GlowCard>
          </motion.button>
        ))}
      </div>

      <p className="text-center mt-8 text-sm font-body text-cocoa-light">
        Pick a realm to start free, or review plans and support information below.
      </p>
    </Section>
  );

  // =========================================================================
  // HOW IT WORKS — step numbers in gradient text
  // =========================================================================

  const howItWorks = [
    { step: '01', title: 'Choose a Realm', desc: 'Pick Cosmos, Kingdom, or Cell to pre-load the AI with rich thematic context.' },
    { step: '02', title: 'Describe Your Vision', desc: 'Gen guides you with questions and narrative suggestions instead of passive prompts.' },
    { step: '03', title: 'Create and Refine', desc: 'Generate illustrated scenes with consistent characters across every page.' },
    { step: '04', title: 'Export and Publish', desc: 'Ship polished PDFs, ebooks, and commercial-ready assets in one workflow.' },
  ];

  const HowItWorksSection = (
    <Section id="how-it-works" className="py-20 md:py-28" aria-labelledby="how-heading">
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="how-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-4 font-heading text-charcoal-soft">
          {t('landing.howItWorks', 'How Genesis works')}
        </motion.h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {howItWorks.map((item, i) => (
          <motion.div
            key={item.step}
            initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: APPLE_EASE, delay: i * 0.06 }}
          >
            <div className="p-6 rounded-2xl">
              <span
                className="text-4xl font-normal mb-4 block font-heading"
                style={{
                  background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {item.step}
              </span>
              <div className="w-10 h-0.5 mb-4 bg-peach-soft" />
              <h3 className="text-lg font-normal mb-2 font-heading text-charcoal-soft">{item.title}</h3>
              <p className="text-sm leading-relaxed font-body text-cocoa-light">{item.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // VISUAL INTERLUDES — Four portrait promo images at natural breakpoints
  // Alternating slants + vertical offsets for a floating, editorial feel.
  // object-cover with aspect-[4/5] keeps images square-ish without distortion.
  // =========================================================================

  const visualShowcaseItems = [
    { src: '/images/promo/design-your-hero-once.webp', alt: 'Design your hero once — consistent character across every scene', caption: 'Design your hero once', rotate: '-2.5deg', yOffset: '0px' },
    { src: '/images/promo/true-character-persistence.webp', alt: 'True character persistence — same hero across worlds', caption: 'True character persistence', rotate: '1.8deg', yOffset: '28px' },
    { src: '/images/promo/illustrate-every-adventure.webp', alt: 'Illustrate every adventure with AI-powered visuals', caption: 'Illustrate every adventure', rotate: '2deg', yOffset: '-12px' },
    { src: '/images/promo/build-your-visual-legacy.webp', alt: 'Build your visual legacy — publish and share your stories', caption: 'Build your visual legacy', rotate: '-1.5deg', yOffset: '16px' },
  ];

  const VisualShowcase = (
    <Section className="py-16 md:py-24 overflow-hidden">
      <div className="grid grid-cols-2 gap-6 md:gap-10 max-w-3xl mx-auto px-4">
        {visualShowcaseItems.map((item, i) => (
          <motion.div
            key={item.caption}
            initial={reducedMotion ? {} : { opacity: 0, y: 40, rotate: 0 }}
            whileInView={{ opacity: 1, y: 0, rotate: parseFloat(item.rotate) }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: APPLE_EASE, delay: i * 0.1 }}
            className="text-center"
            style={{ marginTop: item.yOffset }}
          >
            <div
              className="rounded-2xl overflow-hidden border border-peach-soft"
              style={{
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <img
                src={item.src}
                alt={item.alt}
                width={540}
                height={675}
                className="w-full h-auto block aspect-[4/5] object-cover object-top"
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="mt-3 md:mt-4 text-[10px] md:text-xs font-medium font-body text-cocoa-light tracking-wide uppercase">
              {item.caption}
            </p>
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // KEY FEATURES GRID — bento, large card spans 2
  // =========================================================================

  const features = [
    { icon: BookOpen, title: 'Illustrated Storybooks', desc: 'Create children\'s books, visual explainers, fantasy adventures, and narrative ebooks with scenes, text, and consistent characters.', large: true },
    { icon: Palette, title: 'Character Design', desc: 'Generate heroes, villains, mascots, and concept sheets with stronger visual consistency than one-off prompt tools.' },
    { icon: GraduationCap, title: 'Lesson and Curriculum Visuals', desc: 'Turn science topics, classroom modules, and training content into visual materials that are easier to teach and easier to retain.' },
    { icon: Upload, title: 'Export and Publishing', desc: 'Ship polished PDFs, ebooks, and commercial-ready assets without moving through a fragmented multi-tool workflow.' },
  ];

  const FeaturesSection = (
    <Section id="features" className="py-20 md:py-28 relative" aria-labelledby="features-heading">
      {/* Radial spotlight — DNA Section 3 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(600px ellipse at 70% 30%, rgba(var(--color-shadow), 0.03), transparent 70%)',
        }}
      />
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="features-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-4 font-heading text-charcoal-soft">
          {t('landing.whatYouCanCreate', 'What you can create with Genesis')}
        </motion.h2>
        <motion.p {...fadeUp} className="text-base md:text-lg leading-relaxed max-w-3xl mx-auto font-body text-cocoa-light">
          Genesis is not a generic image box. It is a guided AI workspace for story creation, visual education, character design, and export-ready publishing.
        </motion.p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {features.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: APPLE_EASE, delay: i * 0.06 }}
            className={feat.large ? 'md:col-span-2' : ''}
            whileHover={reducedMotion ? {} : { y: -4, scale: 1.02, transition: { duration: 0.15 } }}
          >
            <GlowCard className="h-full" defaultGlowPosition={feat.large ? '30% 100%' : '50% 100%'}>
              <div className={`p-6 md:p-8 ${feat.large ? 'md:flex md:items-center md:gap-8' : ''}`}>
                <div
                  className="w-14 h-14 flex items-center justify-center text-white mb-5 md:mb-0 shrink-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
                  }}
                >
                  <feat.icon className="w-7 h-7" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xl font-normal mb-2 font-heading text-charcoal-soft">{feat.title}</h3>
                  <p className="text-sm leading-relaxed font-body text-cocoa-light">{feat.desc}</p>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // MASCOT / AI COMPANION — Gen with blobs behind
  // =========================================================================

  const MascotSection = (
    <Section className="py-20 md:py-28 relative overflow-hidden" aria-labelledby="mascot-heading">
      <Blob variant="primary" size="300px" top="10%" right="-60px" opacity={0.08} animate delay="1s" />
      <Blob variant="secondary" size="250px" bottom="5%" left="-40px" opacity={0.06} animate delay="4s" />

      <div className="grid gap-10 md:grid-cols-2 items-center">
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: APPLE_EASE }}
        >
          <GlowCard className="max-w-md mx-auto" defaultGlowPosition="50% 60%">
            <div className="p-6 md:p-8">
              <img
                src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
                alt="Gen - Your AI Creative Guide"
                width={332}
                height={302}
                className="w-full object-contain rounded-3xl"
                loading="lazy"
                decoding="async"
              />
            </div>
          </GlowCard>
        </motion.div>

        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: APPLE_EASE, delay: 0.1 }}
        >
          <h2 id="mascot-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-5 font-heading text-charcoal-soft">
            Meet Gen, your AI creative guide
          </h2>
          <div className="space-y-4">
            {[
              { icon: Sparkles, text: 'An AI companion that asks questions and suggests narrative directions instead of passively waiting for prompts.' },
              { icon: Users, text: 'Gen remembers appearance, outfit, and style across every scene, solving the biggest weakness of one-shot image generators.' },
              { icon: BookOpen, text: 'From concept to export, Gen guides the entire creative journey — not just single images.' },
            ].map(({ icon: IC, text }) => (
              <div key={text} className="flex gap-4 items-start">
                <div
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'rgba(var(--color-shadow), 0.08)' }}
                >
                  <IC className="w-5 h-5 text-coral-burst" aria-hidden="true" />
                </div>
                <p className="text-sm leading-relaxed pt-2 font-body text-cocoa-light">{text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Section>
  );

  // =========================================================================
  // WHY GENESIS STANDS OUT — differentiators
  // =========================================================================

  const DifferentiatorsSection = (
    <Section className="py-20 md:py-28" aria-labelledby="diff-heading">
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="diff-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-4 font-heading text-charcoal-soft">
          {t('landing.whyStandsOut', 'Why Genesis stands out')}
        </motion.h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { title: 'Realm-guided creation', desc: 'Choose Cosmos, Kingdom, or Cell to pre-load the AI with rich thematic context, unlike generic tools that start from a blank prompt.', icon: IcoRocket },
          { title: 'Educator-ready outputs', desc: 'Built-in curriculum tools and illustrated lesson plans so teachers ship classroom materials in minutes, not hours.', icon: GraduationCap },
          { title: 'Consistent characters', desc: 'Gen remembers appearance, outfit, and style across every scene, solving the biggest weakness of one-shot image generators.', icon: Palette },
          { title: 'Guided by Gen', desc: 'An AI companion that asks questions and suggests narrative directions instead of passively waiting for prompts.', icon: IcoWand },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: APPLE_EASE, delay: i * 0.06 }}
          >
            <GlowCard className="h-full">
              <div className="p-6 md:p-8 flex gap-5">
                <div
                  className="w-12 h-12 shrink-0 flex items-center justify-center text-white rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
                  }}
                >
                  <item.icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-normal mb-1 font-heading text-charcoal-soft">{item.title}</h3>
                  <p className="text-sm leading-relaxed font-body text-cocoa-light">{item.desc}</p>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // TESTIMONIALS — quote marks in accent colour
  // =========================================================================

  const testimonials = [
    { quote: 'Genesis helped us move from loose ideas to presentable concept sheets in the same afternoon.', author: 'Indie game studio' },
    { quote: 'The Cell realm made our biology diagrams clearer and much faster to produce than our old slide workflow.', author: 'Secondary science teacher' },
    { quote: 'We used Genesis to shape a full illustrated book pitch before hiring a production illustrator.', author: 'Children\'s author' },
  ];

  const TestimonialsSection = (
    <Section className="py-20 md:py-28" aria-labelledby="testimonials-heading">
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="testimonials-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] font-heading text-charcoal-soft">
          What creators use Genesis for
        </motion.h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <motion.div
            key={i}
            initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: APPLE_EASE, delay: i * 0.08 }}
          >
            <GlowCard as="figure" className="h-full">
              <div className="p-6 md:p-8">
                <span className="text-5xl font-normal leading-none block mb-3 font-heading text-coral-burst">
                  &ldquo;
                </span>
                <blockquote className="text-sm leading-relaxed mb-5 font-body text-charcoal-soft">
                  {t.quote}
                </blockquote>
                <figcaption className="text-xs font-semibold font-body text-cocoa-light uppercase tracking-widest">
                  {t.author}
                </figcaption>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // ABOUT US — Mission, Vision, stats + imagery
  // =========================================================================

  const aboutCards = [
    {
      type: 'stat' as const,
      value: '100K+',
      label: 'Creators',
    },
    {
      type: 'content' as const,
      title: 'Our Mission',
      text: 'To make visual storytelling accessible to every writer, educator, and creator — regardless of artistic skill or budget.',
    },
    {
      type: 'content' as const,
      title: 'Our Vision',
      text: 'A world where every story finds its visual form, and every creator has an AI companion that truly understands narrative.',
    },
    {
      type: 'stat' as const,
      value: '3',
      label: 'Realms',
    },
  ];

  const AboutUsSection = (
    <Section className="py-20 md:py-28 relative overflow-hidden" aria-labelledby="about-heading">
      <Blob variant="primary" size="280px" top="5%" left="-60px" opacity={0.06} animate delay="2s" />
      <Blob variant="secondary" size="220px" bottom="10%" right="-50px" opacity={0.05} animate delay="5s" />

      <div className="text-center mb-10">
        <motion.h2
          {...fadeUp}
          id="about-heading"
          className="max-w-3xl mx-auto text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-6 font-heading text-charcoal-soft"
        >
          Stories deserve to be seen — not just read. That is why Genesis exists.
        </motion.h2>

        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.15 }}
        >
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('pricing-heading');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`inline-flex items-center gap-2 pl-5 pr-2 py-2 rounded-full font-body text-sm font-medium text-white transition-colors ${BTN_PRESS}`}
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))',
            }}
          >
            More about us
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Left image */}
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: APPLE_EASE, delay: 0.1 }}
          className="rounded-2xl overflow-hidden h-[320px]"
        >
          <img
            src="/images/promo/professional-storytelling.webp"
            alt="Three distinct Genesis art styles side by side"
            width={400}
            height={400}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </motion.div>

        {/* Stats + Mission column */}
        <div className="flex flex-col gap-5">
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.2 }}
          >
            <GlowCard className="h-full">
              <div className="p-6 flex justify-between items-center">
                <span className="text-3xl font-bold font-heading text-charcoal-soft">{aboutCards[0].value}</span>
                <span className="text-xs font-body text-cocoa-light uppercase tracking-widest">{aboutCards[0].label}</span>
              </div>
            </GlowCard>
          </motion.div>
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.3 }}
            className="flex-grow"
          >
            <GlowCard className="h-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold font-heading text-charcoal-soft mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary-start)' }} />
                  {aboutCards[1].title}
                </h3>
                <p className="text-sm leading-relaxed font-body text-cocoa-light">{aboutCards[1].text}</p>
              </div>
            </GlowCard>
          </motion.div>
        </div>

        {/* Vision + Stats column */}
        <div className="flex flex-col gap-5">
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.35 }}
            className="flex-grow"
          >
            <GlowCard className="h-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold font-heading text-charcoal-soft mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary-end)' }} />
                  {aboutCards[2].title}
                </h3>
                <p className="text-sm leading-relaxed font-body text-cocoa-light">{aboutCards[2].text}</p>
              </div>
            </GlowCard>
          </motion.div>
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.45 }}
          >
            <GlowCard className="h-full">
              <div className="p-6 flex justify-between items-center">
                <span className="text-3xl font-bold font-heading text-charcoal-soft">{aboutCards[3].value}</span>
                <span className="text-xs font-body text-cocoa-light uppercase tracking-widest">{aboutCards[3].label}</span>
              </div>
            </GlowCard>
          </motion.div>
        </div>

        {/* Right image */}
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: APPLE_EASE, delay: 0.5 }}
          className="rounded-2xl overflow-hidden h-[320px]"
        >
          <img
            src="/images/promo/environments-that-stay-put.webp"
            alt="Consistent environment library across day and night scenes"
            width={400}
            height={400}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </motion.div>
      </div>
    </Section>
  );

  // =========================================================================
  // PRICING TIERS — accent border on popular, themed
  // =========================================================================

  const tiers = [
    { name: 'Spark', price: '$0', period: 'Free forever', desc: 'The Hook That Gets You Addicted', icon: Zap, popular: false, cta: 'Start Creating Free', features: ['3 ebooks per month', 'Max 4 pages per book', '5 illustration styles', 'Standard templates', 'Community support'], limitations: ['Watermarked exports', 'Basic AI writing', 'No commercial license'] },
    { name: 'Creator', price: '$19.99', period: '/month', desc: 'The Sweet Spot', icon: Star, popular: false, cta: 'Upgrade Now', features: ['30 ebooks per month', 'Up to 12 pages/book', 'NO watermarks', '20+ illustration styles', 'Commercial license', 'Priority rendering'], limitations: [] },
    { name: 'Studio', price: '$59.99', period: '/month', desc: 'The Professional Choice', icon: Briefcase, popular: true, cta: 'Upgrade Now', features: ['Everything in Creator', '5 team seats', '500 pages/book', 'ALL 50+ styles', 'White-label exports', 'Brand Hub & Style Guides', 'Video book exports'], limitations: [] },
    { name: 'Empire', price: '$199.99', period: '/month', desc: 'Best Value for Scale', icon: IcoCrown, popular: false, cta: 'Upgrade Now', features: ['Everything in Studio', 'Unlimited team members', 'Unlimited pages', 'Custom AI Model Training', 'Dedicated Account Manager', 'API Access', 'VIP 24/7 Support'], limitations: [] },
  ];

  const PricingSection = (
    <Section id="pricing" className="py-20 md:py-28" aria-labelledby="pricing-heading">
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="pricing-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-4 font-heading text-charcoal-soft">
          {t('landing.chooseJourney', 'Choose your creative journey')}
        </motion.h2>
        <motion.p {...fadeUp} className="text-base md:text-lg font-body text-cocoa-light">
          Join 100,000+ creators making beautiful books today.
        </motion.p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: APPLE_EASE, delay: i * 0.06 }}
          >
            <div
              className={`relative h-full flex flex-col p-6 md:p-7 bg-surface rounded-2xl ${
                tier.popular ? 'border-2' : 'border border-peach-soft'
              }`}
              style={tier.popular ? { borderColor: 'var(--color-primary-start)' } : undefined}
            >
              {tier.popular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-medium font-body text-white rounded-full"
                  style={{
                    background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))',
                  }}
                >
                  Most Popular
                </span>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <tier.icon className="w-5 h-5 text-coral-burst" aria-hidden="true" />
                  <span className="text-sm font-medium font-body text-charcoal-soft uppercase tracking-wider">{tier.name}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-normal font-heading text-charcoal-soft">{tier.price}</span>
                  <span className="text-sm font-body text-cocoa-light">{tier.period}</span>
                </div>
                <p className="text-xs mt-1 font-body text-cocoa-light">{tier.desc}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-coral-burst" aria-hidden="true" />
                    <span className="sr-only">Included: </span>
                    <span className="text-sm font-body text-charcoal-soft">{f}</span>
                  </li>
                ))}
                {tier.limitations.map((l) => (
                  <li key={l} className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-0.5 shrink-0 text-cocoa-light" aria-hidden="true" />
                    <span className="sr-only">Not included: </span>
                    <span className="text-sm font-body text-cocoa-light">{l}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => navigate('/auth?returnTo=/welcome/onboarding')}
                className={`w-full py-3 text-sm font-medium font-body rounded-full transition-opacity hover:opacity-90 ${BTN_PRESS} ${
                  tier.popular ? 'text-white' : 'text-charcoal-soft border border-peach-soft'
                }`}
                style={
                  tier.popular
                    ? { background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))' }
                    : undefined
                }
              >
                {tier.cta}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Community illustration — DNA mascot group */}
      <motion.div
        initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: APPLE_EASE }}
        className="mt-12 text-center"
      >
        <img
          src="/assets/mascots/8k_3d_pixar_202512022053.jpeg"
          alt="Genesis community of creators"
          width={1365}
          height={768}
          className="mx-auto max-w-sm w-full rounded-3xl border border-peach-soft"
          loading="lazy"
          decoding="async"
        />
        <p className="mt-4 text-sm font-body text-cocoa-light">
          Join creators, educators, and storytellers already using Genesis.
        </p>
      </motion.div>
    </Section>
  );

  // =========================================================================
  // USE CASES
  // =========================================================================

  const useCases = [
    { icon: PenTool, title: 'Indie authors', desc: 'Draft illustrated children\'s books and fantasy shorts with consistent scenes, then export directly for publishing.' },
    { icon: GraduationCap, title: 'Teachers and tutors', desc: 'Build biology explainers, astronomy handouts, and classroom-ready visual lessons in a single workflow.' },
    { icon: Gamepad2, title: 'Game teams', desc: 'Prototype fantasy and sci-fi characters, factions, environments, and narrative assets before full production.' },
    { icon: FlaskConical, title: 'Science communicators', desc: 'Translate dense research into visual explainers that audiences can understand and share.' },
  ];

  const UseCasesSection = (
    <Section id="use-cases" className="py-20 md:py-28" aria-labelledby="usecases-heading">
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="usecases-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] font-heading text-charcoal-soft">
          Use cases and examples
        </motion.h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {useCases.map((uc, i) => (
          <motion.div
            key={uc.title}
            initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: APPLE_EASE, delay: i * 0.06 }}
            whileHover={reducedMotion ? {} : { y: -4, scale: 1.02, transition: { duration: 0.15 } }}
          >
            <GlowCard className="h-full">
              <div className="p-6 md:p-8">
                <div
                  className="w-12 h-12 flex items-center justify-center text-white mb-5 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))' }}
                >
                  <uc.icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-normal mb-2 font-heading text-charcoal-soft">{uc.title}</h3>
                <p className="text-sm leading-relaxed font-body text-cocoa-light">{uc.desc}</p>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // FOR EDUCATION — dark section using theme's dark mode colours
  // =========================================================================

  const EducationSection = (
    <section
      className="relative py-20 md:py-28 px-5 md:px-12 overflow-hidden landing-dark-section"
      aria-labelledby="education-heading"
    >
      <Blob variant="primary" size="350px" top="-80px" left="-80px" opacity={0.06} />
      <Blob variant="secondary" size="280px" bottom="-60px" right="-60px" opacity={0.05} />

      <div className="mx-auto max-w-6xl w-full relative z-10">
        <div className="grid gap-10 md:grid-cols-2 items-center">
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold font-body text-coral-burst mb-6 rounded-full"
              style={{
                border: '1px solid rgba(var(--color-shadow), 0.25)',
                backgroundColor: 'rgba(var(--color-shadow), 0.1)',
              }}
            >
              <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
              For Educators
            </span>
            <h2 id="education-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-5 font-heading landing-dark-text">
              Built for the classroom
            </h2>
            <p className="text-base leading-relaxed mb-6 font-body landing-dark-muted">
              Turn science topics, classroom modules, and training content into visual materials that are easier to teach and easier to retain. Genesis gives educators curriculum-ready tools, not a blank canvas.
            </p>
            <div className="space-y-3">
              {[
                'Curriculum tools and illustrated lesson plans',
                'Classroom-ready visual lessons in a single workflow',
                'Export to PDF for immediate distribution',
                'Realm-guided context for subject-specific content',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-4 h-4 shrink-0 text-coral-burst" aria-hidden="true" />
                  <span className="text-sm font-body landing-dark-text">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: APPLE_EASE, delay: 0.1 }}
            className="flex justify-center"
          >
            <div className="p-6 max-w-sm w-full rounded-3xl landing-dark-card">
              <img
                src="/images/onboarding/On 5.png"
                alt="The Cell - Biology learning realm"
                width={309}
                height={309}
                className="w-full object-contain rounded-xl"
                loading="lazy"
                decoding="async"
              />
              <p className="text-center mt-4 text-sm font-body landing-dark-muted">
                The Cell — Microscopic universe of life
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );

  // =========================================================================
  // FAQ
  // =========================================================================

  const faqs = [
    { q: 'Do I need prompt engineering skills?', a: 'No. Genesis is designed to guide the brief with realms and structured choices so you can create without writing elaborate prompts.' },
    { q: 'Can I start free?', a: 'Yes. Spark lets you explore the workflow before upgrading to Creator, Studio, or Empire for higher limits and commercial features.' },
    { q: 'What does Genesis do better than a generic AI image tool?', a: 'Genesis adds context, consistency, and export workflows. It is built for complete story and learning outputs, not disconnected single images.' },
    { q: 'Where can I get help or ask sales questions?', a: 'Email support@iamazeyou.me for product help, billing questions, classroom rollout guidance, or enterprise conversations.' },
  ];

  const FAQSection = (
    <Section id="faq" className="py-20 md:py-28" aria-labelledby="faq-heading">
      <div className="text-center mb-12">
        <motion.h2 {...fadeUp} id="faq-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] font-heading text-charcoal-soft">
          Frequently asked questions
        </motion.h2>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {faqs.map((faq, i) => (
          <motion.div
            key={i}
            initial={reducedMotion ? {} : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.3, ease: APPLE_EASE, delay: i * 0.04 }}
          >
            <FAQItem question={faq.q} answer={faq.a} />
          </motion.div>
        ))}
      </div>
    </Section>
  );

  // =========================================================================
  // SUPPORT
  // =========================================================================

  const SupportSection = (
    <Section id="support" className="py-20 md:py-28" aria-labelledby="support-heading">
      <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] items-start">
        <div>
          <motion.h2 {...fadeUp} id="support-heading" className="text-3xl md:text-4xl font-normal tracking-[-0.01em] mb-4 font-heading text-charcoal-soft">
            Support, pricing, and next steps
          </motion.h2>
          <p className="text-base leading-relaxed mb-6 font-body text-cocoa-light">
            Need onboarding help, plan guidance, or a custom workflow conversation? Reach the Genesis team directly. If you are ready, start with Spark or review paid plans before continuing.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:support@iamazeyou.me"
              className={`px-6 py-3 text-sm font-medium font-body text-white rounded-full transition-opacity hover:opacity-90 ${BTN_PRESS}`}
              style={{ background: 'linear-gradient(to right, var(--color-primary-start), var(--color-primary-end))' }}
            >
              support@iamazeyou.me
            </a>
            <button
              type="button"
              onClick={() => scrollTo('pricing')}
              className={`px-6 py-3 text-sm font-semibold font-body text-charcoal-soft border border-peach-soft rounded-full transition-colors hover:opacity-80 ${BTN_PRESS}`}
            >
              Review Pricing
            </button>
          </div>
        </div>

        <GlowCard>
          <div className="p-6">
            <h3 className="text-lg font-normal mb-4 font-heading text-charcoal-soft">Included trust signals</h3>
            <ul className="space-y-3">
              {['Secure checkout and account flows', 'Clear free and paid plan separation', 'Commercial rights on paid tiers', 'Human support available by email'].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="w-4 h-4 shrink-0 text-coral-burst" aria-hidden="true" />
                  <span className="text-sm font-body text-cocoa-light">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlowCard>
      </div>
    </Section>
  );

  // =========================================================================
  // FINAL CTA — full-width accent bg using theme gradient
  // =========================================================================

  const FinalCTA = (
    <section
      className="relative py-20 md:py-28 px-5 md:px-12 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))' }}
      aria-labelledby="final-cta-heading"
    >
      <Blob variant="white" size="400px" top="-100px" right="-100px" opacity={0.08} />

      <div className="mx-auto max-w-3xl w-full relative z-10 text-center">
        <motion.h2
          id="final-cta-heading"
          initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: APPLE_EASE }}
          className="text-3xl md:text-5xl font-normal tracking-[-0.01em] mb-5 font-heading text-white"
        >
          The page is blank. The tools are yours.
        </motion.h2>
        <motion.p
          initial={reducedMotion ? {} : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.08 }}
          className="text-base md:text-lg mb-8 font-body text-white"
        >
          Let&rsquo;s make something amazing.
        </motion.p>
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: APPLE_EASE, delay: 0.16 }}
        >
          <button
            type="button"
            onClick={() => navigate('/auth?returnTo=/welcome/onboarding')}
            className={`px-8 py-4 text-base font-medium font-body text-charcoal-soft bg-surface rounded-full transition-opacity hover:opacity-90 ${BTN_PRESS}`}
          >
            Choose Your Realm
          </button>
        </motion.div>
      </div>
    </section>
  );

  // =========================================================================
  // FOOTER — dark section using theme's dark mode
  // =========================================================================

  const Footer = (
    <footer className="py-16 px-5 md:px-12 landing-dark-section">
      <div className="mx-auto max-w-6xl w-full">
        <div className="grid gap-10 md:grid-cols-4 mb-12">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 overflow-hidden rounded-xl landing-dark-card-border">
                <img src="/genesis-icon.jpg" alt="Genesis" width={378} height={369} className="w-full h-full object-cover" />
              </div>
              <span className="font-heading font-normal text-xl tracking-normal landing-dark-text">Genesis</span>
            </div>
            <p className="text-sm leading-relaxed font-body landing-dark-muted">
              AI visual storytelling for writers, educators, and creators.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-medium font-heading uppercase tracking-wider mb-4 landing-dark-text">Product</h4>
            <ul className="space-y-2">
              {['Choose a realm', 'What you can create', 'Pricing', 'Use cases'].map((link) => (
                <li key={link}>
                  <button
                    type="button"
                    onClick={() => scrollTo(link === 'Pricing' ? 'pricing' : link === 'Choose a realm' ? 'realms' : link === 'What you can create' ? 'features' : 'use-cases')}
                    className="text-sm font-body landing-dark-muted transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded py-1.5"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-medium font-heading uppercase tracking-wider mb-4 landing-dark-text">Resources</h4>
            <ul className="space-y-2">
              {[
                { label: 'Blog', href: '/blog' },
                { label: 'Learn', href: '/learn' },
                { label: 'Transparency', href: '/transparency' },
                { label: 'FAQ', href: '#faq' },
              ].map(({ label, href }) => (
                <li key={label}>
                  {href.startsWith('#') ? (
                    <button
                      type="button"
                      className="text-sm font-body landing-dark-muted transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded py-1.5"
                      onClick={() => scrollTo(href.slice(1))}
                    >
                      {label}
                    </button>
                  ) : (
                    <a
                      href={href}
                      className="text-sm font-body landing-dark-muted transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded py-1.5"
                    >
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-medium font-heading uppercase tracking-wider mb-4 landing-dark-text">Support</h4>
            <ul className="space-y-2">
              {[
                { label: 'support@iamazeyou.me', href: 'mailto:support@iamazeyou.me', external: true },
                { label: 'Privacy Policy', href: '/legal/privacy', external: false },
                { label: 'Terms of Service', href: '/legal/terms', external: false },
                { label: 'Cookie Policy', href: '/legal/cookies', external: false },
              ].map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a href={href} className="text-sm font-body landing-dark-muted transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded py-1.5">{label}</a>
                  ) : (
                    <a
                      href={href}
                      className="text-sm font-body landing-dark-muted transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/50 rounded py-1.5"
                    >
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 landing-dark-card-border" style={{ borderTop: `1px solid ${darkVars.border}` }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs font-body landing-dark-muted">
              &copy; {new Date().getFullYear()} Genesis. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              {['Secure Payment', 'Cancel anytime', '7-day money back'].map((signal) => (
                <span key={signal} className="flex items-center gap-1.5 text-xs font-body landing-dark-muted">
                  <Shield className="w-3 h-3 text-coral-burst" aria-hidden="true" />
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );

  // =========================================================================
  // ASSEMBLED PAGE
  // =========================================================================

  return (
    <div className="bg-cream-base font-body" style={{ ['--font-heading' as string]: '"Instrument Serif", Georgia, serif' }}>
      {/* Skip to main content — WCAG 2.4.1 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-surface focus:text-charcoal-soft focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-coral-burst/50"
      >
        Skip to main content
      </a>
      <SparkleCursor />
      {/* Dark section styles — dynamically sourced from the ACTIVE theme's darkCssVariables.
          When the user switches theme (e.g. Aurora Scholar, Ocean Academy), these values update. */}
      <style>{`
        .landing-dark-section {
          background-color: ${darkVars.bg};
        }
        .landing-dark-text {
          color: ${darkVars.text};
        }
        .landing-dark-muted {
          color: ${darkVars.textMuted};
        }
        .landing-dark-card {
          background-color: ${darkVars.surface};
          border: 1px solid ${darkVars.border};
        }
        .landing-dark-card-border {
          border-color: ${darkVars.border};
        }
      `}</style>
      {Nav}
      <main id="main-content">
        {Hero}
        {SocialProofBar}
        {RealmsSection}
        {HowItWorksSection}
        {VisualShowcase}
        {FeaturesSection}
        {MascotSection}
        {DifferentiatorsSection}
        {TestimonialsSection}
        {AboutUsSection}
        {PricingSection}
        {UseCasesSection}
        {EducationSection}
        {FAQSection}
        {SupportSection}
        {FinalCTA}
      </main>
      {Footer}
    </div>
  );
});

LandingPage.displayName = 'LandingPage';

export default LandingPage;
