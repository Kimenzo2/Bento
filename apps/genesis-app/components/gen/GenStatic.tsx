// ============================================================================
// GEN — LAYER 0: STATIC IMAGE + CSS ANIMATION
// The foundation. Gen's real illustrated presence.
// Subtle CSS animations give her life without any external dependencies.
//
// Glow: box-shadow only — NEVER filter: blur or backdrop-filter.
// Float: transform: translateY — smooth and GPU-composited.
// States: Driven by data-state attribute — pure CSS, no JS animation loops.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { Realm } from '../../lib/gen/genPersonality';

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export type GenSize = 'sm' | 'md' | 'lg' | 'xl';
export type GenState = 'idle' | 'thinking' | 'celebrating' | 'sleeping';

export interface GenStaticProps {
  size?: GenSize;
  realm?: Realm | null;
  state?: GenState;
  className?: string;
}

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────

/** Gen's real image — the luminescent ghost with golden feather quill */
const GEN_IMAGE_PATH = '/images/onboarding/Style_directive_highend_202512150033.jpeg';

/** Pixel sizes for each named size */
const SIZE_MAP: Record<GenSize, number> = {
  sm: 64,
  md: 120,
  lg: 200,
  xl: 320,
};

/** Realm-specific glow colours — box-shadow, not blur */
const GLOW_COLORS: Record<string, string> = {
  default: '0 0 40px 8px rgba(180, 140, 255, 0.35), 0 0 80px 16px rgba(110, 140, 255, 0.15)',
  cosmos: '0 0 40px 8px rgba(79, 195, 247, 0.35), 0 0 80px 16px rgba(13, 71, 161, 0.15)',
  kingdom: '0 0 40px 8px rgba(255, 213, 79, 0.35), 0 0 80px 16px rgba(255, 143, 0, 0.15)',
  cell: '0 0 40px 8px rgba(105, 240, 174, 0.35), 0 0 80px 16px rgba(0, 191, 165, 0.15)',
};

/** Celebrating glow — brighter */
const GLOW_CELEBRATING =
  '0 0 50px 12px rgba(255, 213, 79, 0.5), 0 0 100px 24px rgba(180, 140, 255, 0.25)';

/** Sleeping glow — warm amber, dim */
const GLOW_SLEEPING =
  '0 0 30px 6px rgba(255, 200, 100, 0.2), 0 0 60px 12px rgba(255, 200, 100, 0.08)';

// ────────────────────────────────────────────────────────────
// SPARKLE COMPONENT — Four-pointed CSS stars for celebrating
// ────────────────────────────────────────────────────────────

function Sparkle({
  delay,
  top,
  left,
  size: sparkleSize,
}: {
  delay: number;
  top: string;
  left: string;
  size: number;
}) {
  return (
    <svg
      className="gen-sparkle-star"
      width={sparkleSize}
      height={sparkleSize}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        position: 'absolute',
        top,
        left,
        animation: `gen-sparkle 0.8s ease-out ${delay}s both`,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <path
        d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"
        fill="rgba(255, 213, 79, 0.9)"
      />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────
// THINKING DOTS — Three sequencing dots below Gen
// ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div
      className="gen-thinking-dots"
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 4,
        marginTop: 8,
      }}
      aria-hidden="true"
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-text-light, #8b8b8b)',
          opacity: 0,
        }}
      />
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-text-light, #8b8b8b)',
          opacity: 0,
        }}
      />
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-text-light, #8b8b8b)',
          opacity: 0,
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SLEEPING Zs — Float upward and fade
// ────────────────────────────────────────────────────────────

function SleepingZs() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', top: '10%', right: '-5%' }}>
      {[0, 0.8, 1.6].map((delay, i) => (
        <span
          key={i}
          className="gen-sleeping-z"
          style={{
            position: 'absolute',
            right: i * 8,
            top: i * -6,
            fontSize: 10 + i * 2,
            fontWeight: 700,
            color: 'var(--color-text-light, #8b8b8b)',
            opacity: 0,
            animation: `gen-z-float 2.4s ease-out ${delay}s infinite`,
          }}
        >
          z
        </span>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// GEN STATIC — The Layer 0 component
// ────────────────────────────────────────────────────────────

export function GenStatic({
  size = 'md',
  realm = null,
  state = 'idle',
  className = '',
}: GenStaticProps) {
  const px = SIZE_MAP[size];
  const [showSparkles, setShowSparkles] = useState(false);
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When state changes to 'celebrating', show sparkles for 2 seconds
  useEffect(() => {
    if (state === 'celebrating') {
      setShowSparkles(true);
      celebrateTimerRef.current = setTimeout(() => setShowSparkles(false), 2000);
    } else {
      setShowSparkles(false);
    }
    return () => {
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    };
  }, [state]);

  // Resolve glow style based on state and realm
  let glowStyle: string;
  if (state === 'celebrating') {
    glowStyle = GLOW_CELEBRATING;
  } else if (state === 'sleeping') {
    glowStyle = GLOW_SLEEPING;
  } else {
    glowStyle = GLOW_COLORS[realm ?? 'default'];
  }

  // Resolve glow opacity based on state
  let glowOpacity: number;
  if (state === 'thinking') {
    glowOpacity = 0.6;
  } else if (state === 'sleeping') {
    glowOpacity = 0.3;
  } else if (state === 'celebrating') {
    glowOpacity = 1.0;
  } else {
    glowOpacity = 0.85;
  }

  return (
    <div
      className={`gen-wrapper ${state === 'idle' ? 'gen-float' : ''} ${className}`}
      data-state={state}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Glow layer — box-shadow on a rounded wrapper */}
      <div
        className="gen-glow"
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          boxShadow: glowStyle,
          opacity: glowOpacity,
          pointerEvents: 'none',
          transition: 'box-shadow 0.6s ease, opacity 0.6s ease',
        }}
        aria-hidden="true"
      />

      {/* Gen's real image */}
      <img
        src={GEN_IMAGE_PATH}
        alt="Gen, your AI creative guide"
        width={px}
        height={px}
        draggable={false}
        style={{
          width: px,
          height: px,
          objectFit: 'contain',
          borderRadius: '1.5rem',
          position: 'relative',
          zIndex: 1,
        }}
      />

      {/* State-specific overlays */}
      {state === 'thinking' && <ThinkingDots />}
      {state === 'sleeping' && <SleepingZs />}
      {state === 'celebrating' && showSparkles && (
        <>
          <Sparkle delay={0} top="-10%" left="50%" size={16} />
          <Sparkle delay={0.1} top="20%" left="-10%" size={12} />
          <Sparkle delay={0.2} top="15%" left="95%" size={14} />
          <Sparkle delay={0.15} top="70%" left="90%" size={10} />
        </>
      )}
    </div>
  );
}

export default GenStatic;
