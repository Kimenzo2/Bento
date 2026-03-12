/**
 * EditorHeader.tsx — 52px sticky header for the Genesis Page Editor.
 *
 * Left-to-right: Back | Title | Autosave | Undo/Redo | Pages/Canvas toggle | Help
 *
 * DNA rules: Geist font for UI chrome, zero hardcoded colours,
 * active:scale-[0.98] press, ghost buttons, coral-burst accents.
 *
 * IMPORTANT: NO Generate, AI Improve, or Check Characters buttons here.
 * Those live exclusively in the right sidebar on desktop.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  HelpCircle,
  Layout,
  Loader2,
  Redo2,
  Undo2,
} from 'lucide-react';
import type { EditorState } from '@hooks/useEditorState';

// ── Geist font inline style (used throughout the header) ──
const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

// ── Toolbar separator — 1px vertical line, 18px tall, border colour ──
const Separator: React.FC = () => (
  <div
    className="w-px mx-1.5 self-center"
    style={{ height: 18, backgroundColor: 'var(--color-border)' }}
    role="separator"
    aria-hidden="true"
  />
);

// ── Ghost button — 32px height, Geist 12px, active:scale-[0.98], focus ring ──
interface GhostBtnProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}

const GhostBtn: React.FC<GhostBtnProps> = ({
  onClick,
  disabled,
  title,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      inline-flex items-center justify-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium
      transition-all duration-150 active:scale-[0.98] cursor-pointer
      disabled:opacity-30 disabled:cursor-default
      text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/40
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40
      ${className}
    `}
    style={{ ...geist, fontSize: 12 }}
    {...rest}
  >
    {children}
  </button>
);

// ── Autosave indicator — three states: saving | saved | unsaved ──
const SaveIndicator: React.FC<{ status: EditorState['saveStatus'] }> = ({ status }) => {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-cocoa-light" style={{ ...geist, fontSize: 12 }} role="status" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Saving...</span>
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1 text-cocoa-light" style={{ ...geist, fontSize: 12 }} role="status" aria-live="polite">
        <Check className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Saved</span>
      </span>
    );
  }
  if (status === 'unsaved') {
    return (
      <span className="flex items-center" title="Unsaved changes" role="status" aria-live="polite" aria-label="Unsaved changes">
        <span className="w-2 h-2 rounded-full bg-coral-burst" />
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-coral-burst" style={{ ...geist, fontSize: 12 }} role="alert" aria-live="assertive">
        <span className="w-2 h-2 rounded-full bg-coral-burst" />
        <span className="hidden sm:inline">Error</span>
      </span>
    );
  }
  return null;
};

// ── Keyboard shortcuts modal — shows all 9 shortcuts in a clean modal ──
const ShortcutsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;

  const shortcuts = [
    ['Cmd/Ctrl + S', 'Manual save'],
    ['Cmd/Ctrl + Z', 'Undo'],
    ['Cmd/Ctrl + Shift + Z', 'Redo'],
    ['Cmd/Ctrl + Shift + F', 'Toggle Focus Mode'],
    ['Cmd/Ctrl + G', 'Generate illustration'],
    ['Cmd/Ctrl + \u2192', 'Next page'],
    ['Cmd/Ctrl + \u2190', 'Previous page'],
    ['Cmd/Ctrl + Enter', 'Add new page'],
    ['Escape', 'Exit Focus Mode'],
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="absolute inset-0 bg-charcoal-soft/40" />
      <div
        className="relative rounded-2xl p-6 w-full max-w-md border border-peach-soft"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="shortcuts-title"
          className="font-bold text-lg text-charcoal-soft mb-4"
          style={geist}
        >
          Keyboard Shortcuts
        </h2>
        <div className="space-y-2">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="flex justify-between items-center py-1.5">
              <span className="text-cocoa-light text-sm" style={geist}>{desc}</span>
              <kbd
                className="px-2 py-0.5 rounded-md border border-peach-soft text-xs text-charcoal-soft"
                style={{ ...geist, backgroundColor: 'var(--color-background)' }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full h-9 rounded-lg bg-coral-burst text-white text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          style={geist}
        >
          Got it
        </button>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// EDITOR HEADER
// ═════════════════════════════════════════════════════════════

interface EditorHeaderProps {
  editor: EditorState;
  onBack?: () => void;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ editor, onBack }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Commit title on blur or Enter
  const commitTitle = useCallback(() => {
    setIsEditingTitle(false);
    const val = titleRef.current?.value.trim();
    if (val && val !== editor.currentProject.title) {
      editor.handleTitleChange(val);
    }
  }, [editor]);

  useEffect(() => {
    if (isEditingTitle) titleRef.current?.focus();
  }, [isEditingTitle]);

  // ── Focus mode: compact 40px header ──
  // Shows only: [Exit Focus] | Story title | Autosave indicator
  if (editor.isFocusMode) {
    return (
      <>
        <header
          className="sticky top-0 z-50 flex items-center px-4 shrink-0"
          style={{
            height: 40,
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {/* Exit Focus button */}
          <GhostBtn onClick={editor.toggleFocusMode} title="Exit Focus Mode (Escape)">
            <span>Exit Focus</span>
          </GhostBtn>

          <Separator />

          {/* Title — read-only in focus mode */}
          <span
            className="font-semibold text-charcoal-soft truncate max-w-[200px]"
            style={{ ...geist, fontSize: 14, fontWeight: 600 }}
          >
            {editor.currentProject.title || 'Untitled Story'}
          </span>

          {/* Autosave indicator */}
          <div className="ml-3">
            <SaveIndicator status={editor.saveStatus} />
          </div>
        </header>

        <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </>
    );
  }

  // ── Normal mode: 52px header ──
  return (
    <>
      <header
        className="sticky top-0 z-50 flex items-center px-4 shrink-0"
        style={{
          height: 52,
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* 1. "Pages" back button — ghost, ArrowLeft icon + label */}
        {onBack && (
          <GhostBtn onClick={onBack} aria-label="Back to pages" title="Back to pages">
            <ArrowLeft className="w-4 h-4" />
            <span style={{ fontSize: 13 }}>Pages</span>
          </GhostBtn>
        )}

        {/* 2. Story title — 14px Geist, weight 600, truncated 200px, click to edit */}
        <h1 className="contents">
        {isEditingTitle ? (
          <input
            ref={titleRef}
            type="text"
            defaultValue={editor.currentProject.title}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setIsEditingTitle(false);
            }}
            className="font-semibold text-charcoal-soft bg-transparent border-b border-coral-burst outline-none max-w-[200px] ml-2"
            style={{ ...geist, fontSize: 14, fontWeight: 600 }}
            placeholder="Untitled Story"
            aria-label="Story title"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="font-semibold text-charcoal-soft truncate max-w-[200px] hover:text-coral-burst transition-colors cursor-pointer ml-2"
            style={{ ...geist, fontSize: 14, fontWeight: 600 }}
            title="Click to rename"
          >
            {editor.currentProject.title || 'Untitled Story'}
          </button>
        )}
        </h1>

        {/* 3. Autosave indicator */}
        <div className="ml-3">
          <SaveIndicator status={editor.saveStatus} />
        </div>

        {/* 4. Separator */}
        <Separator />

        {/* 5. Undo button — icon only */}
        <GhostBtn onClick={editor.undo} disabled={!editor.canUndo} title="Undo (Cmd+Z)" aria-label="Undo">
          <Undo2 className="w-3.5 h-3.5" />
        </GhostBtn>

        {/* 6. Redo button — icon only */}
        <GhostBtn onClick={editor.redo} disabled={!editor.canRedo} title="Redo (Cmd+Shift+Z)" aria-label="Redo">
          <Redo2 className="w-3.5 h-3.5" />
        </GhostBtn>

        {/* 7. Separator */}
        <Separator />

        {/* 8. Canvas / Pages toggle pill */}
        <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-peach-soft p-0.5" role="group" aria-label="Editor view">
          <button
            type="button"
            onClick={() => editor.setEditorView('canvas')}
            aria-pressed={editor.editorView === 'canvas'}
            className={`px-3 py-1 rounded-md text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              editor.editorView === 'canvas'
                ? 'bg-coral-burst/15 border border-coral-burst/40 text-coral-burst'
                : 'bg-transparent text-cocoa-light hover:text-charcoal-soft'
            }`}
            style={{ ...geist, fontSize: 13, fontWeight: 500 }}
          >
            <Layout className="w-3.5 h-3.5" />
            Canvas
          </button>
          <button
            type="button"
            onClick={() => editor.setEditorView('pages')}
            aria-pressed={editor.editorView === 'pages'}
            className={`px-3 py-1 rounded-md text-xs transition-colors cursor-pointer ${
              editor.editorView === 'pages'
                ? 'bg-coral-burst/15 border border-coral-burst/40 text-coral-burst'
                : 'bg-transparent text-cocoa-light hover:text-charcoal-soft'
            }`}
            style={{ ...geist, fontSize: 13, fontWeight: 500 }}
          >
            Pages
          </button>
        </div>

        {/* 9. Separator */}
        <Separator />

        {/* 10. Keyboard shortcuts help button */}
        <GhostBtn
          onClick={() => setShowShortcuts(true)}
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </GhostBtn>
      </header>

      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </>
  );
};

export default EditorHeader;
