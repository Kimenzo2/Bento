/**
 * OPTIMIZED MOTION COMPONENTS
 * 
 * Pre-configured Framer Motion components with:
 * 1. GPU acceleration baked in
 * 2. Optimized transition defaults
 * 3. Reduced motion support
 * 4. Memoization for stable references
 */

import { motion, type MotionProps, type Variants } from 'framer-motion';
import React, { memo, forwardRef, useMemo } from 'react';
import {
  GPU_ACCELERATED_STYLES,
  FAST_TRANSITION,
  SMOOTH_TRANSITION,
  STAGGER_FAST,
  prefersReducedMotion,
} from './gpuStyles';

// Base GPU-accelerated style
const gpuStyle: React.CSSProperties = {
  ...GPU_ACCELERATED_STYLES,
  willChange: 'transform, opacity',
};

// Remove will-change after animation completes (best practice)
const cleanupStyle: React.CSSProperties = {
  willChange: 'auto',
};

/**
 * Optimized motion.div with GPU acceleration
 */
export const OptimizedMotionDiv = memo(forwardRef<
  HTMLDivElement,
  MotionProps & React.HTMLAttributes<HTMLDivElement>
>(function OptimizedMotionDiv({ style, children, transition, ...props }, ref) {
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  
  const mergedStyle = useMemo(() => ({
    ...gpuStyle,
    ...style,
  }), [style]);
  
  const optimizedTransition = useMemo(() => {
    if (reducedMotion) return { duration: 0 };
    return transition || SMOOTH_TRANSITION;
  }, [reducedMotion, transition]);
  
  return (
    <motion.div
      ref={ref}
      style={mergedStyle}
      transition={optimizedTransition}
      onAnimationComplete={() => {
        // Cleanup will-change after animation
        if (ref && typeof ref === 'object' && ref.current) {
          Object.assign(ref.current.style, cleanupStyle);
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}));

/**
 * Fast fade in/out component
 */
interface FadeProps extends Omit<MotionProps, 'initial' | 'animate' | 'exit'> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const FastFade = memo(function FastFade({ 
  children, 
  className, 
  delay = 0,
  ...props 
}: FadeProps) {
  const reducedMotion = prefersReducedMotion();
  
  return (
    <motion.div
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { ...FAST_TRANSITION, delay }}
      className={className}
      style={gpuStyle}
      {...props}
    >
      {children}
    </motion.div>
  );
});

/**
 * Fast slide + fade component
 */
interface SlideProps extends FadeProps {
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

export const FastSlide = memo(function FastSlide({
  children,
  className,
  delay = 0,
  direction = 'up',
  distance = 20,
  ...props
}: SlideProps) {
  const reducedMotion = prefersReducedMotion();
  
  const getInitial = () => {
    if (reducedMotion) return { opacity: 1, x: 0, y: 0 };
    switch (direction) {
      case 'up': return { opacity: 0, y: distance };
      case 'down': return { opacity: 0, y: -distance };
      case 'left': return { opacity: 0, x: distance };
      case 'right': return { opacity: 0, x: -distance };
    }
  };
  
  return (
    <motion.div
      initial={getInitial()}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { ...FAST_TRANSITION, delay }}
      className={className}
      style={gpuStyle}
      {...props}
    >
      {children}
    </motion.div>
  );
});

/**
 * Staggered children container
 */
interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  fast?: boolean;
}

export const StaggerContainer = memo(function StaggerContainer({
  children,
  className,
  fast = true,
}: StaggerProps) {
  const stagger = fast ? STAGGER_FAST : { staggerChildren: 0.1, delayChildren: 0.2 };
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: stagger,
        },
      }}
      className={className}
      style={gpuStyle}
    >
      {children}
    </motion.div>
  );
});

/**
 * Stagger child item
 */
interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerItem = memo(function StaggerItem({
  children,
  className,
}: StaggerItemProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: FAST_TRANSITION,
    },
  };
  
  return (
    <motion.div
      variants={variants}
      className={className}
      style={gpuStyle}
    >
      {children}
    </motion.div>
  );
});

/**
 * Optimized hover scale effect
 */
interface ScaleOnHoverProps {
  children: React.ReactNode;
  className?: string;
  scale?: number;
}

export const ScaleOnHover = memo(function ScaleOnHover({
  children,
  className,
  scale = 1.02,
}: ScaleOnHoverProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: scale - 0.02 }}
      transition={FAST_TRANSITION}
      className={className}
      style={gpuStyle}
    >
      {children}
    </motion.div>
  );
});

/**
 * Optimized pulse animation (for loading states)
 */
interface PulseProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export const Pulse = memo(function Pulse({
  children,
  className,
  active = true,
}: PulseProps) {
  return (
    <motion.div
      animate={active ? {
        scale: [1, 1.02, 1],
        opacity: [1, 0.8, 1],
      } : {}}
      transition={{
        duration: 1.5,
        repeat: active ? Infinity : 0,
        ease: 'easeInOut',
      }}
      className={className}
      style={gpuStyle}
    >
      {children}
    </motion.div>
  );
});

/**
 * Optimized ambient float animation (for background elements)
 */
interface FloatProps {
  children: React.ReactNode;
  className?: string;
  yRange?: number;
  duration?: number;
}

export const Float = memo(function Float({
  children,
  className,
  yRange = 10,
  duration = 4,
}: FloatProps) {
  const reducedMotion = prefersReducedMotion();
  
  return (
    <motion.div
      animate={reducedMotion ? {} : {
        y: [-yRange, yRange, -yRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
      style={gpuStyle}
    >
      {children}
    </motion.div>
  );
});
