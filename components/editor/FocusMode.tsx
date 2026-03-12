/**
 * FocusMode.tsx — Floating writing panel for Focus Mode.
 *
 * When focus mode is active, the left zone is hidden and this floating
 * panel appears at the bottom center of the viewport. The book preview
 * fills the remaining space.
 */

import type React from 'react';
import { useRef, useState, useEffect } from 'react';

interface FocusModeWritingPanelProps {
  text: string;
  onChange: (text: string) => void;
  isVisible: boolean;
}

const FocusModeWritingPanel: React.FC<FocusModeWritingPanelProps> = ({
  text,
  onChange,
  isVisible,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-focus when entering focus mode
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      // Delay to wait for transition
      const timer = setTimeout(() => textareaRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Respect prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-[60] left-1/2"
      style={{
        bottom: 24,
        transform: 'translateX(-50%)',
        width: 'min(600px, 90vw)',
        maxHeight: 200,
        transition: prefersReducedMotion ? 'none' : 'opacity 300ms ease, transform 300ms ease',
      }}
    >
      <div
        className="rounded-xl border border-peach-soft p-4 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 8px 32px color-mix(in srgb, var(--color-text) 15%, transparent)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What happens on this page?"
          className="w-full resize-none bg-transparent border-none outline-none text-charcoal-soft placeholder:text-cocoa-light/50"
          aria-label="Story text for current page"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.75,
            maxHeight: 160,
            minHeight: 80,
            boxShadow: isFocused
              ? 'inset 2px 0 0 var(--color-primary-start)'
              : 'none',
          }}
          spellCheck
        />
      </div>
    </div>
  );
};

export default FocusModeWritingPanel;
