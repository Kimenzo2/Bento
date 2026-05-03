/**
 * PageNavigator.tsx — Vertical stack of page thumbnail cards for left sidebar.
 *
 * Features: clickable thumbnails with generated illustration or placeholder,
 * active page accent border + glow, drag-to-reorder via @dnd-kit (vertical),
 * add page button at bottom. Section header "PAGES" at top.
 */

import type React from 'react';
import { useRef, useEffect, useCallback } from 'react';
import { Plus, Image as ImageIcon, GripVertical } from 'lucide-react';
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
import type { Page } from '../../types';
import { resolveImageUrl } from '../../services/resolveImageUrl';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

// ── Sortable page thumbnail card ──
interface ThumbProps {
  page: Page;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const SortableThumb: React.FC<ThumbProps> = ({ page, index, isActive, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const thumbRef = useRef<HTMLDivElement>(null);

  const resolvedUrl = resolveImageUrl(page.imageUrl);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const cardStyle: React.CSSProperties = {
    borderLeft: isActive ? '3px solid var(--color-primary-start)' : '3px solid transparent',
    boxShadow: isActive
      ? '0 0 8px 1px color-mix(in srgb, var(--color-primary-start) 25%, transparent)'
      : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} data-page-index={index}>
      <div
        ref={thumbRef}
        className={`
          relative w-full rounded-lg overflow-hidden cursor-pointer
          transition-all duration-200 group
          ${
            isActive
              ? 'border border-coral-burst'
              : 'border border-peach-soft/40 hover:border-peach-soft hover:scale-[1.02]'
          }
        `}
        style={cardStyle}
        onClick={onClick}
        {...attributes}
      >
        {/* Image thumbnail or placeholder */}
        <div
          className="w-full overflow-hidden relative"
          style={{ height: '48px', backgroundColor: 'var(--color-background)' }}
        >
          {resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              <ImageIcon className="w-4 h-4 text-cocoa-light/40" />
            </div>
          )}

          {/* Page number pill (top-left) */}
          <div
            className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-white bg-charcoal-soft/70"
            style={geist}
          >
            {page.pageNumber}
          </div>

          {/* Drag handle (visible on hover, top-right) */}
          <div
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 transition-opacity cursor-grab active:cursor-grabbing"
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5 text-cocoa-light" />
          </div>
        </div>

        {/* Caption — first 15 chars of story text */}
        <div
          className="flex items-center px-2 overflow-hidden"
          style={{
            height: '20px',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <span className="text-[10px] text-cocoa-light truncate leading-tight" style={geist}>
            {page.text?.slice(0, 15) || 'Empty page'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PAGE NAVIGATOR — Vertical sidebar stack
// ═══════════════════════════════════════════════════════════════

interface PageNavigatorProps {
  pages: Page[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onAddPage: () => void;
}

const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
  onReorder,
  onAddPage,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Scroll active page into view when it changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeCard = container.querySelector(
      `[data-page-index="${activePageIndex}"]`
    ) as HTMLElement | null;
    if (activeCard) {
      activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activePageIndex]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = pages.findIndex((p) => p.id === active.id);
        const newIndex = pages.findIndex((p) => p.id === over.id);
        onReorder(oldIndex, newIndex);
      }
    },
    [pages, onReorder]
  );

  return (
    <div className="flex flex-col h-full px-3 pt-3 pb-2">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light"
          style={geist}
        >
          Pages
        </span>
      </div>

      {/* Vertical thumbnail stack */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={scrollRef}
            className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5"
            style={{ scrollbarWidth: 'thin' }}
          >
            {pages.map((page, idx) => (
              <SortableThumb
                key={page.id}
                page={page}
                index={idx}
                isActive={idx === activePageIndex}
                onClick={() => onSelectPage(idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Page button at the bottom */}
      <button
        type="button"
        onClick={onAddPage}
        className="
          mt-2 w-full flex items-center justify-center gap-1.5
          py-2 rounded-lg
          border border-dashed border-peach-soft/50
          text-[11px] font-medium text-coral-burst
          hover:text-coral-hover hover:border-coral-burst/40
          hover:bg-coral-burst/5
          transition-all duration-200
          cursor-pointer active:scale-[0.98]
        "
        style={geist}
        title="Add new page"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Page
      </button>
    </div>
  );
};

export default PageNavigator;
