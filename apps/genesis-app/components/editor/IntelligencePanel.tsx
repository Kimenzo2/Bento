/**
 * IntelligencePanel.tsx — Right sidebar (300px) with 5 collapsible accordion sections.
 *
 * Searchable-inspired structure using SidebarSection:
 *   1. GEN              — open, Gen's avatar + contextual message + action
 *   2. STORY INTELLIGENCE — open, 3 metric rows + Improve button
 *   3. GENERATION        — open, Generate button + style chips
 *   4. VISUAL DESCRIPTION — collapsed, AI-generated description
 *   5. PAGE DETAILS       — collapsed, page metadata
 *
 * DNA rules: zero hardcoded colours, Geist chrome, active:scale-[0.98].
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { BarChart2, FileText, Info, Loader2, Pencil, Sparkles, Wand2 } from 'lucide-react';
import {
  GEN_CELEBRATIONS,
  GEN_THINKING_LINES,
  GEN_GREETINGS,
  pickRandom,
} from '../../lib/gen/genPersonality';
import { ArtStyle } from '../../types';
import type { EditorState } from '@hooks/useEditorState';
import SidebarSection from './SidebarSection';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

// ═══════════════════════════════════════════════════════════
// STYLE OPTIONS — for Generation section
// ═══════════════════════════════════════════════════════════

const STYLE_OPTIONS: { value: ArtStyle; label: string; short: string }[] = [
  { value: ArtStyle.WATERCOLOR, label: 'Watercolor', short: 'WC' },
  { value: ArtStyle.PIXAR_3D, label: '3D Render', short: '3D' },
  { value: ArtStyle.MANGA, label: 'Manga', short: 'MG' },
  { value: ArtStyle.CORPORATE, label: 'Corporate', short: 'CO' },
  { value: ArtStyle.CYBERPUNK, label: 'Cyberpunk', short: 'CP' },
  { value: ArtStyle.VINTAGE, label: 'Vintage', short: 'VT' },
  { value: ArtStyle.PAPER_CUTOUT, label: 'Paper Cut', short: 'PC' },
  { value: ArtStyle.FLAT_DESIGN, label: 'Flat', short: 'FL' },
  { value: ArtStyle.INFOGRAPHIC, label: 'Infographic', short: 'IG' },
  { value: ArtStyle.BLUEPRINT, label: 'Blueprint', short: 'BP' },
];

// ═══════════════════════════════════════════════════════════
// METRICS — client-side calculations
// ═══════════════════════════════════════════════════════════

const SENSORY_WORDS = new Set([
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

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  if (word.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

function calculateReadability(text: string): { label: string; level: 'good' | 'warn' | 'bad' } {
  if (!text || text.length < 10) return { label: 'Too short', level: 'warn' };
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0 || sentences.length === 0) return { label: 'Too short', level: 'warn' };
  const avgWordsPerSentence = words.length / sentences.length;
  if (avgWordsPerSentence < 12) return { label: 'Clear', level: 'good' };
  if (avgWordsPerSentence <= 18) return { label: 'Moderate', level: 'warn' };
  return { label: 'Complex', level: 'bad' };
}

function calculateVisualRichness(text: string): { label: string; level: 'good' | 'warn' | 'bad' } {
  if (!text || text.length < 10) return { label: 'Too short', level: 'warn' };
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const count = words.filter((w) => SENSORY_WORDS.has(w)).length;
  const ratio = count / words.length;
  if (ratio >= 0.15) return { label: 'Rich', level: 'good' };
  if (ratio >= 0.08) return { label: 'Adequate', level: 'warn' };
  return { label: 'Sparse', level: 'bad' };
}

function calculatePageLength(
  charCount: number,
  pageNumber: number,
  totalPages: number
): { label: string; level: 'good' | 'warn' | 'bad' } {
  const isFirstOrLast = pageNumber === 1 || pageNumber === totalPages;
  const min = isFirstOrLast ? 100 : 150;
  const max = isFirstOrLast ? 250 : 400;
  if (charCount < min) return { label: 'Short', level: 'warn' };
  if (charCount > max) return { label: 'Long', level: 'warn' };
  return { label: 'Good', level: 'good' };
}

// ── Metric status pill ──
const StatusPill: React.FC<{ label: string; level: 'good' | 'warn' | 'bad' }> = ({
  label,
  level,
}) => {
  const colorMap = {
    good: {
      bg: 'color-mix(in srgb, green 12%, var(--color-surface))',
      text: 'green',
    },
    warn: {
      bg: 'color-mix(in srgb, var(--color-primary-end) 15%, var(--color-surface))',
      text: 'var(--color-primary-end)',
    },
    bad: {
      bg: 'color-mix(in srgb, var(--color-primary-start) 12%, var(--color-surface))',
      text: 'var(--color-primary-start)',
    },
  };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-medium"
      style={{
        ...geist,
        fontSize: 11,
        backgroundColor: colorMap[level].bg,
        color: colorMap[level].text,
      }}
    >
      {label}
    </span>
  );
};

// ── Metric row ──
const MetricRow: React.FC<{ label: string; value: string; level: 'good' | 'warn' | 'bad' }> = ({
  label,
  value,
  level,
}) => (
  <div className="flex items-center justify-between" style={{ height: 32 }}>
    <span className="text-cocoa-light" style={{ ...geist, fontSize: 13 }}>
      {label}
    </span>
    <StatusPill label={value} level={level} />
  </div>
);

// ═══════════════════════════════════════════════════════════
// GEN'S CONTEXTUAL MESSAGE LOGIC
// ═══════════════════════════════════════════════════════════

function getGenMessage(isGenerating: boolean, hasImage: boolean, textLength: number): string {
  if (isGenerating) return pickRandom(GEN_THINKING_LINES);
  if (hasImage && textLength > 30) return pickRandom(GEN_CELEBRATIONS);
  if (hasImage && textLength < 30)
    return 'The illustration is ready. What story does this picture tell?';
  if (textLength > 100)
    return 'Your words are building something. Ready to see what they look like?';
  if (textLength > 30)
    return "There's a world forming here. Keep going — I can already see shapes.";
  if (textLength > 0) return GEN_GREETINGS.stuck;
  return "Every great story starts with a single sentence. What's yours?";
}

function getGenAction(
  isGenerating: boolean,
  hasImage: boolean,
  hasText: boolean,
  isOutdated?: boolean
): { label: string; action: 'generate' | 'improve' } | null {
  if (isGenerating) return null;
  if (isOutdated && hasImage) return { label: 'Regenerate Illustration', action: 'generate' };
  if (hasText && !hasImage) return { label: 'Generate Illustration', action: 'generate' };
  if (hasText && hasImage) return { label: 'Improve This Page', action: 'improve' };
  return null;
}

// ═══════════════════════════════════════════════════════════
// RELATIVE TIME HELPER
// ═══════════════════════════════════════════════════════════

function getRelativeTime(date: Date | null): string {
  if (!date) return 'Never';
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ═══════════════════════════════════════════════════════════
// INTELLIGENCE PANEL — Right sidebar
// ═══════════════════════════════════════════════════════════

interface IntelligencePanelProps {
  editor: EditorState;
  /** When true, panel stretches to fill parent (for mobile bottom sheet). */
  fluid?: boolean;
}

const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ editor, fluid = false }) => {
  const activePage = editor.activePage;
  if (!activePage) return null;

  const textLength = activePage.text?.length || 0;
  const hasText = textLength > 5;
  const hasImage = !!activePage.imageUrl;

  // ── Gen message state ──
  const [genMessage, setGenMessage] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevPageRef = useRef(activePage.pageNumber);

  useEffect(() => {
    const newMsg = getGenMessage(editor.isGeneratingImage, hasImage, textLength);
    if (newMsg !== genMessage) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setGenMessage(newMsg);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [editor.isGeneratingImage, hasImage, textLength, activePage.pageNumber]);

  useEffect(() => {
    setGenMessage(getGenMessage(editor.isGeneratingImage, hasImage, textLength));
  }, []);

  // ── Gen action suggestion ──
  const genAction = getGenAction(
    editor.isGeneratingImage,
    hasImage,
    hasText,
    activePage.isImageOutdated
  );

  // ── Style change ──
  const handleStyleChange = (style: ArtStyle) => {
    editor.setProjectHistory((prev) => ({ ...prev, style }));
  };

  // ── Visual description edit state ──
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescText, setEditDescText] = useState(activePage.imagePrompt || '');

  useEffect(() => {
    setEditDescText(activePage.imagePrompt || '');
    setIsEditingDesc(false);
  }, [activePage.pageNumber]);

  const handleSaveDesc = () => {
    setIsEditingDesc(false);
    editor.setProjectHistory((prev) => {
      const newProject = structuredClone(prev);
      newProject.chapters.forEach((ch) => {
        const page = ch.pages.find((p) => p.pageNumber === activePage.pageNumber);
        if (page) page.imagePrompt = editDescText;
      });
      return newProject;
    });
  };

  // ── Last saved timestamp (updates every 30s) ──
  const [lastSavedText, setLastSavedText] = useState('Never');
  useEffect(() => {
    const update = () => {
      const lastSaved = editor.autoSaveState.lastSaved
        ? new Date(editor.autoSaveState.lastSaved)
        : null;
      setLastSavedText(getRelativeTime(lastSaved));
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [editor.autoSaveState.lastSaved]);

  // ── Metrics ──
  const readability = calculateReadability(activePage.text);
  const richness = calculateVisualRichness(activePage.text);
  const pageLength = calculatePageLength(textLength, activePage.pageNumber, editor.totalPages);
  const wordCount = activePage.text
    ? activePage.text.split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        ...(fluid ? {} : { width: 300, minWidth: 300 }),
        backgroundColor: 'var(--color-background)',
        borderLeft: fluid ? 'none' : '1px solid var(--color-border)',
        scrollbarWidth: 'thin',
      }}
    >
      {/* ── SECTION 1: GEN ── */}
      <SidebarSection label="Gen" defaultOpen={true}>
        {/* Gen avatar — 72px, centered */}
        <div className="flex flex-col items-center mb-3">
          <div className={editor.isGeneratingImage ? '' : 'gen-float'}>
            <img
              src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
              alt="Gen, your AI creative assistant"
              className="w-[72px] h-[72px] rounded-full object-cover"
              style={{
                boxShadow: editor.isGeneratingImage
                  ? '0 0 24px 4px color-mix(in srgb, var(--color-primary-start) 40%, transparent)'
                  : '0 0 12px 2px color-mix(in srgb, var(--color-primary-start) 15%, transparent)',
              }}
              draggable={false}
            />
          </div>
        </div>

        {/* Gen's message — fade transition */}
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
            {genMessage}
          </p>
        </div>

        {/* Gen's single action suggestion — ghost button */}
        {genAction && (
          <div className="flex justify-center mt-3">
            <button
              type="button"
              onClick={() => {
                if (genAction.action === 'generate') editor.handleGenerateImage();
                else editor.handleImproveText('engaging');
              }}
              className="text-coral-burst text-sm font-medium
                hover:underline cursor-pointer active:scale-[0.98] transition-all"
              style={geist}
            >
              {genAction.label}
            </button>
          </div>
        )}
      </SidebarSection>

      {/* ── SECTION 2: STORY INTELLIGENCE ── */}
      <SidebarSection
        label="Story Intelligence"
        defaultOpen={true}
        icon={<BarChart2 className="w-3.5 h-3.5" />}
      >
        <div className="flex flex-col">
          <MetricRow label="Story Clarity" value={readability.label} level={readability.level} />
          <MetricRow label="Visual Richness" value={richness.label} level={richness.level} />
          <MetricRow label="Page Length" value={pageLength.label} level={pageLength.level} />
        </div>

        {/* Improve This Page — outlined, full width */}
        <button
          type="button"
          onClick={() => editor.handleImproveText('engaging')}
          disabled={editor.isImproving || textLength < 10}
          className="mt-3 w-full h-9 rounded-lg inline-flex items-center justify-center gap-1.5
            text-coral-burst border border-coral-burst/30
            hover:bg-coral-burst/10 active:scale-[0.98]
            transition-all cursor-pointer
            disabled:opacity-40 disabled:cursor-default
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
          style={{ ...geist, fontSize: 13, fontWeight: 500 }}
        >
          {editor.isImproving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Improving...
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" /> Improve This Page
            </>
          )}
        </button>
      </SidebarSection>

      {/* ── SECTION 3: GENERATION ── */}
      <SidebarSection
        label="Generation"
        defaultOpen={true}
        icon={<Sparkles className="w-3.5 h-3.5" />}
      >
        {/* Generate Illustration — filled, prominent, 44px */}
        <button
          type="button"
          onClick={editor.handleGenerateImage}
          disabled={editor.isGeneratingImage || !hasText}
          className="w-full rounded-xl inline-flex items-center justify-center gap-2
            bg-coral-burst text-white font-medium
            hover:opacity-90 active:scale-[0.98]
            transition-all cursor-pointer
            disabled:opacity-40 disabled:cursor-default
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
          style={{
            ...geist,
            fontSize: 14,
            fontWeight: 600,
            height: 44,
          }}
        >
          {editor.isGeneratingImage ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate Illustration
            </>
          )}
        </button>

        {/* Style selector */}
        <div className="mt-4">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light block mb-2"
            style={geist}
          >
            Style
          </span>
          <div
            className="flex flex-wrap gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {STYLE_OPTIONS.map((opt) => {
              const isActive = (editor.currentProject.style || ArtStyle.WATERCOLOR) === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleStyleChange(opt.value)}
                  title={opt.label}
                  className={`px-2 rounded-full font-medium transition-all cursor-pointer active:scale-[0.96]
                    ${
                      isActive
                        ? 'bg-coral-burst text-white'
                        : 'text-cocoa-light hover:text-charcoal-soft'
                    }`}
                  style={{
                    ...geist,
                    fontSize: 12,
                    height: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: isActive
                      ? undefined
                      : 'color-mix(in srgb, var(--color-background) 88%, var(--color-surface))',
                    border: isActive ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {opt.short}
                </button>
              );
            })}
          </div>
        </div>
      </SidebarSection>

      {/* ── SECTION 4: VISUAL DESCRIPTION ── */}
      <SidebarSection
        label="Visual Description"
        defaultOpen={false}
        icon={<FileText className="w-3.5 h-3.5" />}
      >
        {isEditingDesc ? (
          <div>
            <textarea
              value={editDescText}
              onChange={(e) => setEditDescText(e.target.value)}
              className="w-full resize-none bg-transparent border border-peach-soft rounded-lg p-2 text-sm text-charcoal-soft outline-none focus:border-coral-burst"
              style={{ fontFamily: 'var(--font-body)', lineHeight: 1.6, fontSize: 13 }}
              rows={3}
              autoFocus
              aria-label="Visual description"
            />
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={handleSaveDesc}
                className="text-[11px] font-medium text-coral-burst hover:underline cursor-pointer"
                style={geist}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingDesc(false);
                  setEditDescText(activePage.imagePrompt || '');
                }}
                className="text-[11px] font-medium text-cocoa-light hover:underline cursor-pointer"
                style={geist}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p
              className="text-cocoa-light italic leading-relaxed"
              style={{
                ...geist,
                fontSize: 13,
                lineHeight: 1.6,
                borderLeft:
                  '2px solid color-mix(in srgb, var(--color-primary-start) 40%, transparent)',
                paddingLeft: 8,
              }}
            >
              {activePage.imagePrompt || 'No visual description yet. Write story text first.'}
            </p>
            {activePage.imagePrompt && (
              <button
                type="button"
                onClick={() => {
                  setEditDescText(activePage.imagePrompt || '');
                  setIsEditingDesc(true);
                }}
                className="flex items-center gap-1 mt-2 text-[11px] font-medium text-coral-burst hover:underline cursor-pointer"
                style={geist}
              >
                <Pencil className="w-2.5 h-2.5" />
                Edit
              </button>
            )}
          </div>
        )}
      </SidebarSection>

      {/* ── SECTION 5: PAGE DETAILS ── */}
      <SidebarSection
        label="Page Details"
        defaultOpen={false}
        icon={<Info className="w-3.5 h-3.5" />}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between py-1">
            <span className="text-cocoa-light" style={{ ...geist, fontSize: 13 }}>
              Page
            </span>
            <span className="text-charcoal-soft" style={{ ...geist, fontSize: 13 }}>
              {activePage.pageNumber} of {editor.totalPages}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-cocoa-light" style={{ ...geist, fontSize: 13 }}>
              Words
            </span>
            <span className="text-charcoal-soft" style={{ ...geist, fontSize: 13 }}>
              {wordCount}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-cocoa-light" style={{ ...geist, fontSize: 13 }}>
              Last saved
            </span>
            <span className="text-charcoal-soft" style={{ ...geist, fontSize: 13 }}>
              {lastSavedText}
            </span>
          </div>
        </div>
      </SidebarSection>

      {/* Bottom divider */}
      <div className="h-px w-full" style={{ backgroundColor: 'var(--color-border)' }} />
    </div>
  );
};

export default IntelligencePanel;
