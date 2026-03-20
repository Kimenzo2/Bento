/**
 * GenCompanion.tsx — Gen's companion section for the right sidebar.
 *
 * Gen occupies the top of the right sidebar. 80px avatar with her animation.
 * Contextual message below — reads the page and responds specifically.
 * This is NOT a chatbot — Gen speaks, the creator listens.
 * Messages from genPersonality.ts, never hardcoded.
 * Uses aria-live="polite" for screen reader announcements.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  GEN_CELEBRATIONS,
  GEN_THINKING_LINES,
  GEN_GREETINGS,
  pickRandom,
} from '../../lib/gen/genPersonality';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface GenCompanionProps {
  isGenerating: boolean;
  hasImage: boolean;
  textLength: number;
  pageNumber: number;
}

function getContextualMessage(
  isGenerating: boolean,
  hasImage: boolean,
  textLength: number,
): string {
  if (isGenerating) return pickRandom(GEN_THINKING_LINES);
  if (hasImage && textLength > 30) return pickRandom(GEN_CELEBRATIONS);
  if (hasImage && textLength < 30) return "The illustration is ready. What story does this picture tell?";
  if (textLength > 100) return "Your words are building something. Ready to see what they look like?";
  if (textLength > 30) return "There's a world forming here. Keep going — I can already see shapes.";
  if (textLength > 0) return GEN_GREETINGS.stuck;
  return "Every great story starts with a single sentence. What's yours?";
}

const GenCompanion: React.FC<GenCompanionProps> = ({
  isGenerating,
  hasImage,
  textLength,
  pageNumber,
}) => {
  const [message, setMessage] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevPageRef = useRef(pageNumber);

  useEffect(() => {
    const newMessage = getContextualMessage(isGenerating, hasImage, textLength);
    if (newMessage !== message) {
      // Fade out, then in
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setMessage(newMessage);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, hasImage, textLength, pageNumber]);

  // Initialize message
  useEffect(() => {
    setMessage(getContextualMessage(isGenerating, hasImage, textLength));
  }, []);

  const genState = isGenerating ? 'thinking' : 'idle';

  return (
    <div className="px-4 py-5">
      {/* Gen avatar */}
      <div className="flex flex-col items-center mb-3">
        <div className={`gen-wrapper ${genState === 'thinking' ? '' : 'gen-float'}`} data-state={genState}>
          <img
            src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
            alt="Gen, your AI creative assistant"
            className="w-20 h-20 rounded-full object-cover"
            style={{
              boxShadow: isGenerating
                ? '0 0 24px 4px color-mix(in srgb, var(--color-primary-start) 40%, transparent)'
                : '0 0 12px 2px color-mix(in srgb, var(--color-primary-start) 15%, transparent)',
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* Gen's message — aria-live for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="transition-all duration-200"
        style={{
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
        }}
      >
        <p
          className="text-cocoa-light text-center leading-relaxed"
          style={{ ...geist, fontSize: 14, lineHeight: 1.6 }}
        >
          {message}
        </p>
      </div>
    </div>
  );
};

export default GenCompanion;
