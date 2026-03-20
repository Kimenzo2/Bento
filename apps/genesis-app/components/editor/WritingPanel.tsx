/**
 * WritingPanel.tsx — Story text editing area (left sidebar).
 *
 * Clean composition surface. No visible border. Focus: inset accent left bar.
 * Minimal label: "STORY". Character count at bottom.
 * The textarea auto-focuses on editor load.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

const RECOMMENDED_MAX_CHARS = 400;

interface WritingPanelProps {
  text: string;
  onChange: (text: string) => void;
  autoFocus?: boolean;
}

const WritingPanel: React.FC<WritingPanelProps> = ({ text, onChange, autoFocus = true }) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = text.length;
  const isNearLimit = charCount > RECOMMENDED_MAX_CHARS * 0.85;
  const isOverLimit = charCount > RECOMMENDED_MAX_CHARS;

  // Auto-focus on mount so creator can write immediately
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Section label */}
      <span
        className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light select-none"
        style={geist}
      >
        Story
      </span>

      {/* Text area — no visible border, accent left bar on focus */}
      <div
        className="flex-1 min-h-[140px] transition-shadow duration-200"
        style={{
          boxShadow: isFocused
            ? 'inset 2px 0 0 var(--color-primary-start)'
            : 'none',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What happens on this page? Write the story..."
          className="w-full h-full resize-none bg-transparent border-none outline-none px-4 py-2 text-charcoal-soft placeholder:text-cocoa-light/40"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.75,
            minHeight: 140,
          }}
          spellCheck
          aria-label="Story text for current page"
        />
      </div>

      {/* Character count — always visible */}
      <div className="flex justify-end px-4 py-1.5">
        <span
          className={`text-[11px] transition-colors ${
            isOverLimit
              ? 'text-coral-burst font-medium'
              : isNearLimit
              ? 'text-coral-burst'
              : 'text-cocoa-light/50'
          }`}
          style={geist}
        >
          {charCount} / {RECOMMENDED_MAX_CHARS}
        </span>
      </div>
    </div>
  );
};

export default WritingPanel;
