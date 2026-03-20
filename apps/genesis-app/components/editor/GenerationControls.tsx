/**
 * GenerationControls.tsx — Generation controls section for the right sidebar.
 *
 * Contains: large Generate button, read-only visual description with
 * edit override, art style selector as compact horizontal row.
 *
 * DNA rules: Geist chrome, zero hardcoded colours, active:scale-[0.98].
 */

import type React from 'react';
import { useState } from 'react';
import { Loader2, Pencil, Sparkles } from 'lucide-react';
import { ArtStyle } from '../../types';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

// ── Style metadata — label + short icon hint ──
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

interface GenerationControlsProps {
  isGenerating: boolean;
  hasText: boolean;
  imagePrompt: string;
  currentStyle: ArtStyle;
  onGenerate: () => void;
  onDescriptionChange?: (text: string) => void;
  onStyleChange?: (style: ArtStyle) => void;
}

const GenerationControls: React.FC<GenerationControlsProps> = ({
  isGenerating,
  hasText,
  imagePrompt,
  currentStyle,
  onGenerate,
  onDescriptionChange,
  onStyleChange,
}) => {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editText, setEditText] = useState(imagePrompt);

  const handleSaveDesc = () => {
    setIsEditingDesc(false);
    if (onDescriptionChange && editText !== imagePrompt) {
      onDescriptionChange(editText);
    }
  };

  return (
    <div className="px-4 py-4 border-t border-peach-soft/50">
      {/* Section label */}
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light"
        style={geist}
      >
        Generation
      </span>

      {/* Generate button — large, prominent */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating || !hasText}
        className="mt-3 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2
          bg-coral-burst text-white font-medium
          hover:opacity-90 active:scale-[0.98]
          transition-all cursor-pointer
          disabled:opacity-40 disabled:cursor-default
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
        style={{ ...geist, fontSize: 14, fontWeight: 600 }}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Illustration
          </>
        )}
      </button>

      {/* Visual description — compact read-only with Edit link */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light"
            style={geist}
          >
            Visual Description
          </span>
          {imagePrompt && !isEditingDesc && (
            <button
              type="button"
              onClick={() => { setEditText(imagePrompt); setIsEditingDesc(true); }}
              className="flex items-center gap-1 text-[11px] font-medium text-cocoa-light hover:text-coral-burst transition-colors cursor-pointer"
              style={geist}
            >
              <Pencil className="w-2.5 h-2.5" />
              Edit
            </button>
          )}
        </div>

        {isEditingDesc ? (
          <div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full resize-none bg-transparent border border-peach-soft rounded-lg p-2 text-sm text-charcoal-soft outline-none focus:border-coral-burst"
              style={{ fontFamily: 'var(--font-body)', lineHeight: 1.6, fontSize: 12 }}
              rows={3}
              autoFocus
              aria-label="Visual description"
            />
            <div className="flex gap-2 mt-1">
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
                onClick={() => { setIsEditingDesc(false); setEditText(imagePrompt); }}
                className="text-[11px] font-medium text-cocoa-light hover:underline cursor-pointer"
                style={geist}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-cocoa-light italic leading-relaxed"
            style={{ ...geist, fontSize: 12, lineHeight: 1.5 }}
          >
            {imagePrompt || 'Write story text to generate a visual description.'}
          </p>
        )}
      </div>

      {/* Art style selector — compact horizontal row */}
      <div className="mt-4">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light block mb-2"
          style={geist}
        >
          Style
        </span>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_OPTIONS.map((opt) => {
            const isActive = currentStyle === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => onStyleChange?.(opt.value)}
                title={opt.label}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer active:scale-[0.96]
                  ${isActive
                    ? 'bg-coral-burst/15 border border-coral-burst/40 text-coral-burst'
                    : 'border border-peach-soft/40 text-cocoa-light hover:border-peach-soft hover:text-charcoal-soft'
                  }`}
                style={geist}
              >
                {opt.short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GenerationControls;
