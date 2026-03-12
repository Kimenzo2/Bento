/**
 * IllustrationArea.tsx — The illustration as HERO.
 *
 * Edge-to-edge, commanding center of the editor.
 * Three states:
 * 1. Generated: image fills area, 12px radius, minimal shadow, onError fallback
 * 2. Generating: shimmer + Gen at 120px + progress bar
 * 3. Empty: realm-tinted bg + Gen at 120px + contextual message
 *
 * Uses resolveImageUrl for robust URL handling.
 */

import type React from 'react';
import { useState } from 'react';
import { resolveImageUrl } from '../../services/resolveImageUrl';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface IllustrationAreaProps {
  imageUrl?: string;
  isGenerating: boolean;
  isOutdated?: boolean;
  hasText: boolean;
  onGenerate: () => void;
}

const IllustrationArea: React.FC<IllustrationAreaProps> = ({
  imageUrl,
  isGenerating,
  isOutdated,
  hasText,
  onGenerate,
}) => {
  const [imageError, setImageError] = useState(false);
  const resolvedUrl = resolveImageUrl(imageUrl);
  const hasValidImage = !!resolvedUrl && !imageError;

  // Respect prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reset error state when URL changes
  if (imageUrl && imageError) {
    const newResolved = resolveImageUrl(imageUrl);
    if (newResolved !== resolvedUrl) {
      setImageError(false);
    }
  }

  // ── STATE: Generating ──
  if (isGenerating) {
    return (
      <div
        className="relative w-full overflow-hidden flex flex-col items-center justify-center rounded-xl"
        style={{
          backgroundColor: 'var(--color-background)',
          aspectRatio: '4 / 3',
        }}
        role="status"
        aria-live="polite"
        aria-label="Generating illustration"
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-primary-start) 8%, transparent) 50%, transparent 100%)',
              width: '200%',
              animation: prefersReducedMotion ? 'none' : 'il-shimmer 1.5s ease-in-out infinite',
            }}
          />
        </div>

        {/* Gen avatar — large */}
        <img
          src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
          alt="Gen is illustrating"
          className="w-[120px] h-[120px] rounded-full object-cover relative z-10 gen-float"
          style={{
            boxShadow: '0 0 40px 8px color-mix(in srgb, var(--color-primary-start) 35%, transparent)',
          }}
          draggable={false}
        />
        <p className="text-cocoa-light mt-4 relative z-10" style={{ ...geist, fontSize: 14 }}>
          Bringing your story to life...
        </p>

        {/* Thin progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-xl">
          <div
            className="h-full bg-coral-burst"
            style={{ animation: prefersReducedMotion ? 'none' : 'il-progress 1.5s ease-in-out infinite', width: '40%' }}
          />
        </div>

        <style>{`
          @keyframes il-shimmer { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
          @keyframes il-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        `}</style>
      </div>
    );
  }

  // ── STATE: Image generated ──
  if (hasValidImage) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl">
        <img
          src={resolvedUrl}
          alt="Page illustration"
          className={`w-full object-cover transition-opacity duration-300 rounded-xl ${isOutdated ? 'opacity-60' : 'opacity-100'}`}
          style={{
            aspectRatio: '4 / 3',
            boxShadow: '0 2px 16px color-mix(in srgb, var(--color-text) 8%, transparent)',
          }}
          width={640}
          height={480}
          draggable={false}
          onError={() => setImageError(true)}
        />

        {/* Outdated overlay */}
        {isOutdated && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl">
            <div
              className="rounded-xl px-6 py-4 text-center border border-peach-soft"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)' }}
            >
              <p className="text-sm font-medium text-coral-burst mb-1" style={geist}>Text has changed</p>
              <p className="text-xs text-cocoa-light mb-3" style={geist}>Your illustration may not match the current story</p>
              <button
                type="button"
                onClick={onGenerate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-coral-burst text-white text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
                style={geist}
              >
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── STATE: Empty — invitation ──
  return (
    <div
      className="relative w-full overflow-hidden flex flex-col items-center justify-center rounded-xl"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-primary-start) 5%, var(--color-background))',
        aspectRatio: '4 / 3',
      }}
    >
      <img
        src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
        alt="Gen, your AI creative assistant"
        className="w-[120px] h-[120px] rounded-full object-cover gen-float"
        style={{
          boxShadow: '0 0 30px 6px color-mix(in srgb, var(--color-primary-start) 20%, transparent)',
        }}
        draggable={false}
      />
      <p className="text-cocoa-light mt-4 text-center max-w-xs px-4" style={{ ...geist, fontSize: 14, lineHeight: 1.5 }}>
        {hasText
          ? "Your words are ready. Let's bring them to life."
          : 'Write your story first, then watch it become art.'}
      </p>
      {hasText && (
        <button
          type="button"
          onClick={onGenerate}
          className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-coral-burst text-white text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
          style={geist}
        >
          Generate Illustration
        </button>
      )}
    </div>
  );
};

export default IllustrationArea;
