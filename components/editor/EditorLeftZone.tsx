/**
 * EditorLeftZone.tsx — 260px left sidebar: the Writing Companion.
 *
 * Four collapsible accordion sections using SidebarSection:
 *   1. PAGES     — open by default, vertical thumbnails, drag-to-reorder, Add Page
 *   2. STORY     — open by default, text composition, accent bar on focus
 *   3. VISUAL DESCRIPTION — collapsed by default, AI-generated description
 *   4. CHARACTERS — collapsed by default, character consistency
 *
 * Fixed story title chrome at top. Save status strip at bottom.
 * Searchable-inspired structure — every section has a visible header.
 *
 * DNA rules: zero hardcoded colours, Geist chrome.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Layers,
  Loader2,
  PenLine,
  Pencil,
  Plus,
  Users,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import SidebarSection from './SidebarSection';
import type { EditorState, SaveStatus } from '@hooks/useEditorState';
import type { Page } from '../../types';
import { resolveImageUrl } from '../../services/resolveImageUrl';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

const RECOMMENDED_MAX_CHARS = 400;

// ═══════════════════════════════════════════════════════════
// SORTABLE PAGE CARD — for PAGES section
// ═══════════════════════════════════════════════════════════

interface PageCardProps {
  page: Page;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const SortablePageCard: React.FC<PageCardProps> = ({ page, index, isActive, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const resolvedUrl = resolveImageUrl(page.imageUrl);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} data-page-index={index}>
      <button
        type="button"
        className={`
          w-full h-[72px] rounded-lg overflow-hidden cursor-pointer
          transition-all duration-200 flex group text-left
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40
          ${isActive
            ? ''
            : 'hover:border-coral-burst/40'
          }
        `}
        style={{
          borderLeft: isActive
            ? '2px solid var(--color-primary-start)'
            : '1px solid var(--color-border)',
          borderTop: isActive ? 'none' : '1px solid var(--color-border)',
          borderRight: isActive ? 'none' : '1px solid var(--color-border)',
          borderBottom: isActive ? 'none' : '1px solid var(--color-border)',
          backgroundColor: isActive
            ? 'color-mix(in srgb, var(--color-primary-start) 8%, var(--color-surface))'
            : 'var(--color-surface)',
        }}
        onClick={onClick}
        aria-label={`Page ${page.pageNumber}${page.text ? `: ${page.text.slice(0, 30)}` : ''}`}
        aria-current={isActive ? 'page' : undefined}
        {...attributes}
      >
        {/* Left: 56px illustration thumbnail */}
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: 56,
            height: '100%',
            borderRadius: '6px 0 0 6px',
            backgroundColor: 'var(--color-background)',
          }}
        >
          {resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
              loading="lazy"
              width={56}
              height={72}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <ImageIcon className="w-4 h-4 text-cocoa-light/40" />
            </div>
          )}
        </div>

        {/* Right: page number pill + text preview + drag handle */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1.5 px-2 relative">
          {/* Page number pill */}
          <span
            className="self-start px-1.5 py-0.5 rounded text-[9px] font-semibold"
            style={{
              ...geist,
              backgroundColor: 'color-mix(in srgb, var(--color-primary-start) 12%, var(--color-surface))',
              color: 'var(--color-primary-start)',
            }}
          >
            {page.pageNumber}
          </span>

          {/* Text preview */}
          <span
            className="text-cocoa-light truncate"
            style={{ ...geist, fontSize: 11 }}
          >
            {page.text?.slice(0, 20) || 'Empty page'}
          </span>

          {/* Drag handle — top-right, visible on hover/focus */}
          <div
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 group-focus-within:opacity-70 transition-opacity cursor-grab active:cursor-grabbing"
            {...listeners}
            tabIndex={0}
            role="button"
            aria-label={`Reorder page ${page.pageNumber}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-cocoa-light" />
          </div>
        </div>
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SAVE STATUS STRIP
// ═══════════════════════════════════════════════════════════

const SaveStrip: React.FC<{ status: SaveStatus }> = ({ status }) => {
  let content: React.ReactNode = null;

  if (status === 'saving') {
    content = (
      <>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Saving...</span>
      </>
    );
  } else if (status === 'saved') {
    content = (
      <>
        <Check className="w-3 h-3" />
        <span>All changes saved</span>
      </>
    );
  } else if (status === 'unsaved') {
    content = (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-coral-burst" aria-hidden="true" />
        <span>Unsaved changes</span>
      </>
    );
  } else if (status === 'error') {
    content = (
      <>
        <span className="w-1.5 h-1.5 rounded-full bg-coral-burst" aria-hidden="true" />
        <span className="text-coral-burst">Save error</span>
      </>
    );
  }

  if (!content) return null;

  return (
    <div
      className="flex items-center justify-center gap-1.5 h-8 text-cocoa-light shrink-0 border-t"
      role="status"
      aria-live="polite"
      style={{
        ...geist,
        fontSize: 11,
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {content}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// PAGES BADGE — total page count pill
// ═══════════════════════════════════════════════════════════

const CountBadge: React.FC<{ count: number | string }> = ({ count }) => (
  <span
    className="inline-flex items-center justify-center rounded-full text-cocoa-light"
    style={{
      ...geist,
      fontSize: 10,
      fontWeight: 600,
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      backgroundColor: 'color-mix(in srgb, var(--color-border) 60%, var(--color-surface))',
    }}
  >
    {count}
  </span>
);

// ═══════════════════════════════════════════════════════════
// EDITOR LEFT ZONE — 260px Writing Companion
// ═══════════════════════════════════════════════════════════

interface EditorLeftZoneProps {
  editor: EditorState;
}

const EditorLeftZone: React.FC<EditorLeftZoneProps> = ({ editor }) => {
  const activePage = editor.activePage;
  if (!activePage) return null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isWritingFocused, setIsWritingFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = activePage.text?.length || 0;
  const isNearLimit = charCount > RECOMMENDED_MAX_CHARS * 0.85;
  const isOverLimit = charCount > RECOMMENDED_MAX_CHARS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Scroll active page into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeCard = container.querySelector(
      `[data-page-index="${editor.activePageIndex}"]`
    ) as HTMLElement | null;
    if (activeCard) {
      activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [editor.activePageIndex]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = editor.allPages.findIndex((p) => p.id === active.id);
        const newIndex = editor.allPages.findIndex((p) => p.id === over.id);
        editor.reorderPages(oldIndex, newIndex);
      }
    },
    [editor.allPages, editor.reorderPages]
  );

  // Handle visual description edit
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

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 260,
        minWidth: 260,
        backgroundColor: 'var(--color-background)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* ── Fixed title chrome ── */}
      <div
        className="shrink-0 px-3 flex items-center"
        style={{
          height: 40,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h2
          className="text-charcoal-soft font-medium truncate"
          style={{ ...geist, fontSize: 13 }}
          title={editor.currentProject.title}
        >
          {editor.currentProject.title || 'Untitled Story'}
        </h2>
      </div>

      {/* ── Scrollable accordion sections ── */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
        {/* ── SECTION 1: PAGES ── */}
        <SidebarSection
          label="Pages"
          defaultOpen={true}
          icon={<Layers className="w-3.5 h-3.5" />}
          badge={<CountBadge count={editor.totalPages} />}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={editor.allPages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                ref={scrollRef}
                className="flex flex-col gap-1.5 overflow-y-auto"
                style={{ maxHeight: 320, scrollbarWidth: 'thin' }}
              >
                {editor.allPages.map((page, idx) => (
                  <SortablePageCard
                    key={page.id}
                    page={page}
                    index={idx}
                    isActive={idx === editor.activePageIndex}
                    onClick={() => editor.setActivePageIndex(idx)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add Page — always visible at bottom of section */}
          <button
            type="button"
            onClick={editor.addPage}
            className="
              mt-2 w-full flex items-center justify-center gap-1.5
              py-2 rounded-lg
              border border-dashed
              text-coral-burst
              hover:bg-coral-burst/5
              transition-all duration-200
              cursor-pointer active:scale-[0.98]
            "
            style={{
              ...geist,
              fontSize: 13,
              borderColor: 'color-mix(in srgb, var(--color-primary-start) 30%, transparent)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Page
          </button>
        </SidebarSection>

        {/* ── SECTION 2: STORY ── */}
        <SidebarSection
          label="Story"
          defaultOpen={true}
          icon={<PenLine className="w-3.5 h-3.5" />}
          badge={
            <CountBadge
              count={`${charCount}/${RECOMMENDED_MAX_CHARS}`}
            />
          }
        >
          {/* Text area — no visible border, accent left bar on focus */}
          <div
            className="transition-shadow duration-200"
            style={{
              boxShadow: isWritingFocused
                ? 'inset 2px 0 0 var(--color-primary-start)'
                : 'none',
            }}
          >
            <textarea
              ref={textareaRef}
              value={activePage.text}
              onChange={(e) => editor.handleTextChange(e.target.value)}
              onFocus={() => setIsWritingFocused(true)}
              onBlur={() => setIsWritingFocused(false)}
              placeholder="What happens on this page?"
              className="w-full resize-none bg-transparent border-none outline-none px-1 py-1 text-charcoal-soft placeholder:text-cocoa-light/40"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                lineHeight: 1.75,
                minHeight: 140,
              }}
              spellCheck
              aria-label="Story text for current page"
            />
          </div>

          {/* Character count */}
          <div className="flex justify-end mt-1">
            <span
              className={`text-[11px] transition-colors ${
                isOverLimit
                  ? 'text-coral-burst'
                  : isNearLimit
                  ? 'text-gold-sunshine'
                  : 'text-cocoa-light/50'
              }`}
              style={geist}
            >
              {charCount} / {RECOMMENDED_MAX_CHARS}
            </span>
          </div>
        </SidebarSection>

        {/* ── SECTION 3: VISUAL DESCRIPTION ── */}
        <SidebarSection
          label="Visual Description"
          defaultOpen={false}
          icon={<ImageIcon className="w-3.5 h-3.5" />}
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
                  onClick={() => { setIsEditingDesc(false); setEditDescText(activePage.imagePrompt || ''); }}
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
                  borderLeft: '2px solid color-mix(in srgb, var(--color-primary-start) 40%, transparent)',
                  paddingLeft: 8,
                }}
              >
                {activePage.imagePrompt || 'No visual description yet. Write story text first.'}
              </p>
              {activePage.imagePrompt && (
                <button
                  type="button"
                  onClick={() => { setEditDescText(activePage.imagePrompt || ''); setIsEditingDesc(true); }}
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

        {/* ── SECTION 4: CHARACTERS ── */}
        <SidebarSection
          label="Characters"
          defaultOpen={false}
          icon={<Users className="w-3.5 h-3.5" />}
          badge={
            editor.consistencyReport?.characters?.length
              ? <CountBadge count={editor.consistencyReport.characters.length} />
              : undefined
          }
        >
          {editor.consistencyReport?.characters?.length ? (
            <div className="flex flex-col gap-2">
              {editor.consistencyReport.characters.map((char, idx) => {
                const hasIssues = char.inconsistencies.length > 0;
                const dotColor = hasIssues ? 'bg-gold-sunshine' : 'bg-emerald-500';
                return (
                  <div key={idx} className="flex items-center gap-2 py-1">
                    <span
                      className={`w-2 h-2 rounded-full ${dotColor} shrink-0`}
                      aria-hidden="true"
                    />
                    <span className="text-charcoal-soft truncate" style={{ ...geist, fontSize: 13 }}>
                      {char.name}
                    </span>
                    <span className="sr-only">
                      {hasIssues ? `${char.inconsistencies.length} inconsistencies` : 'consistent'}
                    </span>
                  </div>
                );
              })}

              {/* Re-run check */}
              <button
                type="button"
                onClick={editor.handleCheckConsistency}
                disabled={editor.isCheckingConsistency}
                className="mt-1 w-full py-1.5 rounded-lg text-coral-burst border border-coral-burst/30
                  hover:bg-coral-burst/5 transition-all cursor-pointer active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-default inline-flex items-center justify-center gap-1.5"
                style={{ ...geist, fontSize: 12, fontWeight: 500 }}
              >
                {editor.isCheckingConsistency ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Checking...</>
                ) : (
                  'Check Characters'
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-2">
              <img
                src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
                alt="Gen, your AI creative assistant"
                className="w-10 h-10 rounded-full object-cover mb-2"
                draggable={false}
              />
              <p className="text-cocoa-light mb-2" style={{ ...geist, fontSize: 12 }}>
                No characters identified yet
              </p>
              <button
                type="button"
                onClick={editor.handleCheckConsistency}
                disabled={editor.isCheckingConsistency}
                className="px-4 py-1.5 rounded-lg text-coral-burst border border-coral-burst/30
                  hover:bg-coral-burst/5 transition-all cursor-pointer active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-default inline-flex items-center justify-center gap-1.5"
                style={{ ...geist, fontSize: 12, fontWeight: 500 }}
              >
                {editor.isCheckingConsistency ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Checking...</>
                ) : (
                  'Check Characters'
                )}
              </button>
            </div>
          )}
        </SidebarSection>

        {/* Bottom divider (closes the last section visually) */}
        <div className="h-px w-full" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      {/* ── Save status strip — fixed at bottom ── */}
      <SaveStrip status={editor.saveStatus} />
    </div>
  );
};

export default EditorLeftZone;
