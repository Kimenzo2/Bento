/**
 * StoryIntelligence.tsx — Quality metrics panel for the right sidebar.
 *
 * Three metrics:
 * 1. Story Clarity — Flesch-Kincaid readability (Clear / Moderate / Complex)
 * 2. Visual Richness — ratio of sensory/descriptive words (Rich / Adequate / Sparse)
 * 3. Page Length — appropriate for page position (Good / Short / Long)
 *
 * Below metrics: "Improve This Page" button.
 * Inspired by Searchable's AI Readiness Score approach.
 */

import type React from 'react';
import { Loader2, Wand2 } from 'lucide-react';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface StoryIntelligenceProps {
  text: string;
  pageNumber: number;
  totalPages: number;
  isImproving: boolean;
  onImprove: () => void;
}

// ── Flesch-Kincaid readability (client-side) ──
function calculateReadability(text: string): { label: string; level: 'good' | 'warn' | 'bad' } {
  if (!text || text.length < 10) return { label: 'Too short', level: 'warn' };

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const syllables = words.reduce((count, word) => {
    return count + countSyllables(word);
  }, 0);

  if (words.length === 0 || sentences.length === 0) return { label: 'Too short', level: 'warn' };

  const score =
    206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);

  if (score >= 80) return { label: 'Clear', level: 'good' };
  if (score >= 50) return { label: 'Moderate', level: 'warn' };
  return { label: 'Complex', level: 'bad' };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  if (word.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

// ── Visual richness — sensory/descriptive word ratio ──
function calculateVisualRichness(text: string): { label: string; level: 'good' | 'warn' | 'bad' } {
  if (!text || text.length < 10) return { label: 'Too short', level: 'warn' };

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const sensoryWords = new Set([
    'bright',
    'dark',
    'golden',
    'silver',
    'glowing',
    'shimmering',
    'sparkling',
    'red',
    'blue',
    'green',
    'yellow',
    'purple',
    'orange',
    'pink',
    'white',
    'black',
    'tiny',
    'huge',
    'massive',
    'small',
    'tall',
    'wide',
    'narrow',
    'thick',
    'thin',
    'soft',
    'hard',
    'smooth',
    'rough',
    'warm',
    'cold',
    'hot',
    'cool',
    'loud',
    'quiet',
    'silent',
    'whisper',
    'roar',
    'crash',
    'singing',
    'sweet',
    'bitter',
    'sour',
    'fragrant',
    'musty',
    'fresh',
    'beautiful',
    'ancient',
    'twisted',
    'curved',
    'straight',
    'round',
    'sharp',
    'forest',
    'ocean',
    'mountain',
    'castle',
    'garden',
    'sky',
    'river',
    'cave',
    'dancing',
    'floating',
    'flying',
    'running',
    'crawling',
    'swirling',
  ]);

  const sensoryCount = words.filter((w) => sensoryWords.has(w)).length;
  const ratio = sensoryCount / words.length;

  if (ratio >= 0.12) return { label: 'Rich', level: 'good' };
  if (ratio >= 0.05) return { label: 'Adequate', level: 'warn' };
  return { label: 'Sparse', level: 'bad' };
}

// ── Page length appropriateness ──
function calculatePageLength(
  charCount: number,
  pageNumber: number,
  totalPages: number
): { label: string; level: 'good' | 'warn' | 'bad' } {
  // Early pages: 80-250 chars, middle: 150-400, final: 80-300
  const position = pageNumber / totalPages;
  let min: number, max: number;

  if (position <= 0.25) {
    min = 80;
    max = 250;
  } else if (position >= 0.75) {
    min = 80;
    max = 300;
  } else {
    min = 150;
    max = 400;
  }

  if (charCount < min) return { label: 'Short', level: 'warn' };
  if (charCount > max) return { label: 'Long', level: 'warn' };
  return { label: 'Good', level: 'good' };
}

// ── Metric row component ──
const MetricRow: React.FC<{
  label: string;
  value: string;
  level: 'good' | 'warn' | 'bad';
}> = ({ label, value, level }) => {
  const dotColour =
    level === 'good' ? 'bg-emerald-500' : level === 'warn' ? 'bg-gold-sunshine' : 'bg-coral-burst';

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-cocoa-light" style={{ ...geist, fontSize: 13 }}>
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColour}`} />
        <span className="text-charcoal-soft font-medium" style={{ ...geist, fontSize: 13 }}>
          {value}
        </span>
      </span>
    </div>
  );
};

// ═════════════════════════════════════════════════
// STORY INTELLIGENCE
// ═════════════════════════════════════════════════

const StoryIntelligence: React.FC<StoryIntelligenceProps> = ({
  text,
  pageNumber,
  totalPages,
  isImproving,
  onImprove,
}) => {
  const readability = calculateReadability(text);
  const richness = calculateVisualRichness(text);
  const length = calculatePageLength(text.length, pageNumber, totalPages);

  return (
    <div className="px-4 py-4 border-t border-peach-soft/50">
      {/* Section label */}
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light"
        style={geist}
      >
        Story Intelligence
      </span>

      {/* Metrics */}
      <div className="mt-2">
        <MetricRow label="Clarity" value={readability.label} level={readability.level} />
        <MetricRow label="Visual Richness" value={richness.label} level={richness.level} />
        <MetricRow label="Page Length" value={length.label} level={length.level} />
      </div>

      {/* Improve button */}
      <button
        type="button"
        onClick={onImprove}
        disabled={isImproving || text.length < 10}
        className="mt-3 w-full h-9 rounded-lg inline-flex items-center justify-center gap-1.5
          text-coral-burst border border-coral-burst/30
          hover:bg-coral-burst/10 active:scale-[0.98]
          transition-all cursor-pointer
          disabled:opacity-40 disabled:cursor-default
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
        style={{ ...geist, fontSize: 13, fontWeight: 500 }}
      >
        {isImproving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Improving...
          </>
        ) : (
          <>
            <Wand2 className="w-3.5 h-3.5" />
            Improve This Page
          </>
        )}
      </button>
    </div>
  );
};

export default StoryIntelligence;
