/**
 * GenCompanionStrip.tsx — Collapsible Gen companion strip below the book preview.
 *
 * Gen's messages come from genPersonality.ts — never hardcoded.
 * Auto-expands when Gen has a new message. Creator can collapse.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  GEN_CELEBRATIONS,
  GEN_THINKING_LINES,
  GEN_GREETINGS,
  pickRandom,
} from '../../lib/gen/genPersonality';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface GenCompanionStripProps {
  isGenerating: boolean;
  hasImage: boolean;
  textLength: number;
  pageTimeMs: number; // How long the user has been on this page
}

/**
 * Returns a context-aware message from Gen's personality system.
 */
function getGenMessage(
  isGenerating: boolean,
  hasImage: boolean,
  textLength: number,
  pageTimeMs: number
): string {
  if (isGenerating) {
    return pickRandom(GEN_THINKING_LINES);
  }
  if (hasImage) {
    return pickRandom(GEN_CELEBRATIONS);
  }
  if (pageTimeMs > 180000 && textLength < 20) {
    // > 3 minutes on page with little text
    return GEN_GREETINGS.stuck;
  }
  if (textLength < 20) {
    return "This page is waiting for its story. What's the most interesting thing that could happen here?";
  }
  return pickRandom(GEN_CELEBRATIONS);
}

const GenCompanionStrip: React.FC<GenCompanionStripProps> = ({
  isGenerating,
  hasImage,
  textLength,
  pageTimeMs,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const lastMessageRef = useRef('');

  // Update message when context changes
  useEffect(() => {
    const msg = getGenMessage(isGenerating, hasImage, textLength, pageTimeMs);
    if (msg !== lastMessageRef.current) {
      setCurrentMessage(msg);
      lastMessageRef.current = msg;
      // Auto-expand on new message
      setIsExpanded(true);
    }
  }, [isGenerating, hasImage, textLength, pageTimeMs]);

  const genState = isGenerating ? 'thinking' : 'idle';

  return (
    <div
      className="border-t border-peach-soft transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-surface) 60%, transparent)',
        height: isExpanded ? 120 : 44,
      }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 cursor-pointer"
        style={{ height: 44 }}
      >
        {/* Gen avatar small */}
        <div
          className={`gen-wrapper shrink-0 ${isExpanded ? '' : 'gen-float'}`}
          data-state={genState}
        >
          <img
            src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
            alt="Gen, your AI creative assistant"
            className="w-8 h-8 rounded-full object-cover"
            style={{
              boxShadow: isGenerating
                ? '0 0 12px 2px color-mix(in srgb, var(--color-primary-start) 40%, transparent)'
                : '0 0 8px 1px color-mix(in srgb, var(--color-primary-start) 15%, transparent)',
            }}
            draggable={false}
          />
        </div>

        {/* Message preview (truncated when collapsed) */}
        <span
          className="flex-1 text-left text-cocoa-light truncate"
          style={{ ...geist, fontSize: 12 }}
        >
          {currentMessage}
        </span>

        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-cocoa-light/60 shrink-0" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-cocoa-light/60 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="flex items-start gap-3 px-4 pb-3">
          {/* Gen avatar medium */}
          <div
            className={`gen-wrapper shrink-0 ${genState === 'thinking' ? '' : 'gen-float'}`}
            data-state={genState}
          >
            <img
              src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
              alt="Gen, your AI creative assistant"
              className="w-[72px] h-[72px] rounded-full object-cover"
              style={{
                boxShadow:
                  '0 0 20px 4px color-mix(in srgb, var(--color-primary-start) 25%, transparent)',
              }}
              draggable={false}
            />
          </div>

          {/* Full message */}
          <p className="text-cocoa-light leading-relaxed pt-1" style={{ ...geist, fontSize: 13 }}>
            {currentMessage}
          </p>
        </div>
      )}
    </div>
  );
};

export default GenCompanionStrip;
