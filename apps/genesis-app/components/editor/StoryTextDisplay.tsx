/**
 * StoryTextDisplay.tsx — Live text preview below the illustration in the center panel.
 *
 * Renders in the heading font (Fredoka) at 20px with generous line height.
 * Updates live as the creator types. Prev/Next page nav at bottom.
 */

import type React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface StoryTextDisplayProps {
  text: string;
  pageNumber: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  choices?: { text: string; targetPageNumber: number }[];
  onChoiceClick?: (targetPage: number) => void;
}

const StoryTextDisplay: React.FC<StoryTextDisplayProps> = ({
  text,
  pageNumber,
  totalPages,
  onPrevPage,
  onNextPage,
  choices,
  onChoiceClick,
}) => {
  const isFirst = pageNumber === 1;
  const isLast = pageNumber === totalPages;

  return (
    <div className="mt-6">
      {/* Story text — the heading font for storybook feel */}
      {text ? (
        <p
          className="text-charcoal-soft"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            lineHeight: 1.8,
          }}
        >
          {text}
        </p>
      ) : (
        <p
          className="text-cocoa-light/40 italic"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 20,
            lineHeight: 1.8,
          }}
        >
          Your story will appear here as you write...
        </p>
      )}

      {/* CYOA choices */}
      {choices && choices.length > 0 && (
        <div className="mt-6 space-y-2">
          {choices.map((choice, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => onChoiceClick?.(choice.targetPageNumber)}
              className="w-full text-left px-4 py-3 rounded-xl border border-peach-soft
                text-charcoal-soft text-sm font-medium
                hover:bg-coral-burst hover:text-white hover:border-coral-burst
                transition-all duration-200 cursor-pointer group
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span className="flex items-center justify-between">
                {choice.text}
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Page navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-peach-soft/30">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={isFirst}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40
            ${isFirst ? 'text-cocoa-light/30 cursor-default' : 'text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/30'}
          `}
          style={{ ...geist, fontSize: 13, fontWeight: 500 }}
          aria-label="Previous page"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>

        <span
          className="text-cocoa-light"
          style={{ ...geist, fontSize: 12 }}
        >
          Page {pageNumber} of {totalPages}
        </span>

        <button
          type="button"
          onClick={onNextPage}
          disabled={isLast}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40
            ${isLast ? 'text-cocoa-light/30 cursor-default' : 'text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/30'}
          `}
          style={{ ...geist, fontSize: 13, fontWeight: 500 }}
          aria-label="Next page"
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default StoryTextDisplay;
