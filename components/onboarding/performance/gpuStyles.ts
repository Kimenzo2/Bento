/**
 * GPU-ACCELERATED ANIMATION STYLES
 * 
 * Forces animations to run on the GPU compositor layer,
 * bypassing the main thread for butter-smooth 60fps animations.
 * 
 * Key principles:
 * 1. Use transform3d to create GPU layer
 * 2. Use will-change sparingly and strategically
 * 3. Avoid properties that trigger layout/paint (top, left, width, height)
 * 4. Prefer opacity and transform for all animations
 */

// CSS properties that are GPU-accelerated
export const GPU_ACCELERATED_STYLES = {
  // Force GPU layer creation
  transform: 'translate3d(0, 0, 0)',
  backfaceVisibility: 'hidden' as const,
  perspective: 1000,
  // Enable hardware acceleration
  WebkitFontSmoothing: 'antialiased' as const,
  MozOsxFontSmoothing: 'grayscale' as const,
} as const;

// Will-change hints for animation targets
export const WILL_CHANGE_TRANSFORM = { willChange: 'transform' } as const;
export const WILL_CHANGE_OPACITY = { willChange: 'opacity' } as const;
export const WILL_CHANGE_TRANSFORM_OPACITY = { willChange: 'transform, opacity' } as const;

// Optimized animation config for Framer Motion
export const GPU_MOTION_CONFIG = {
  // Use GPU-accelerated spring physics
  type: 'spring' as const,
  // Lower mass = faster response
  mass: 0.5,
  // Higher stiffness = snappier
  stiffness: 400,
  // Lower damping = more responsive
  damping: 30,
  // Prevent unnecessary renders for tiny movements
  restDelta: 0.001,
  restSpeed: 0.001,
};

// Apple-style easing as properly typed tuple for Framer Motion
export const APPLE_EASE = [0.22, 1, 0.36, 1] as const;
export const FAST_EASE = [0.32, 0.72, 0, 1] as const;

// Ultra-fast transition for immediate feedback
export const INSTANT_TRANSITION = {
  type: 'tween' as const,
  duration: 0.15,
  ease: FAST_EASE,
} as const;

// Fast but smooth transition
export const FAST_TRANSITION = {
  type: 'tween' as const,
  duration: 0.25,
  ease: APPLE_EASE,
} as const;

// Standard transition (still fast)
export const SMOOTH_TRANSITION = {
  type: 'spring' as const,
  mass: 0.4,
  stiffness: 300,
  damping: 25,
};

// Stagger children config (optimized for perceived performance)
export const STAGGER_FAST = {
  staggerChildren: 0.03,
  delayChildren: 0,
};

export const STAGGER_NORMAL = {
  staggerChildren: 0.05,
  delayChildren: 0.1,
};

// Optimized CSS class strings for Tailwind
export const GPU_CLASS = 'transform-gpu backface-hidden';
export const WILL_CHANGE_CLASS = 'will-change-transform';
export const SMOOTH_SCROLL_CLASS = 'scroll-smooth overscroll-none';

// Container query for reduced motion preference
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

/**
 * Get transition based on user preference
 */
export const getOptimizedTransition = (fast = false) => {
  if (prefersReducedMotion()) {
    return { duration: 0 };
  }
  return fast ? FAST_TRANSITION : SMOOTH_TRANSITION;
};
