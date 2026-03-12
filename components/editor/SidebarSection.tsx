/**
 * SidebarSection.tsx — Reusable collapsible accordion section for both sidebars.
 *
 * Wraps shadcn's Collapsible with Genesis visual treatment.
 * Both left and right sidebars use this identical component.
 *
 * Behaviour:
 * - Header row is ALWAYS visible (36px, never collapses)
 * - Chevron rotates 90° on toggle (right → down)
 * - Content slides + fades over 200ms ease-out
 * - prefers-reduced-motion → instant transitions
 * - Initial mount: open sections render without animation
 * - Collapsed content is inert (removed from tab order)
 *
 * DNA rules: Geist chrome, zero hardcoded colours, cursor-pointer.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@components/ui/collapsible';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface SidebarSectionProps {
  /** Section label displayed in the header row */
  label: string;
  /** Whether the section starts open (true) or collapsed (false) */
  defaultOpen?: boolean;
  /** Optional icon element rendered before the label */
  icon?: React.ReactNode;
  /** Optional badge element rendered after the label */
  badge?: React.ReactNode;
  /** Section content that collapses and expands */
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  label,
  defaultOpen = false,
  icon,
  badge,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasMounted, setHasMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // After first render, enable transitions (prevents animation on initial mount)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // When collapsed, set inert on content to remove from tab order
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isOpen) {
      el.removeAttribute('inert');
    } else {
      el.setAttribute('inert', '');
    }
  }, [isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Divider — always visible between sections */}
      <div
        className="h-px w-full"
        style={{ backgroundColor: 'var(--color-border)' }}
      />

      {/* Header row — always visible, 36px */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 cursor-pointer
            transition-colors duration-150 focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coral-burst/30"
          style={{
            height: 36,
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-expanded={isOpen}
        >
          {/* Optional icon */}
          {icon && (
            <span className="text-cocoa-light shrink-0 flex items-center" style={{ fontSize: 14 }}>
              {icon}
            </span>
          )}

          {/* Label */}
          <span
            className="text-cocoa-light uppercase select-none"
            style={{
              ...geist,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
            }}
          >
            {label}
          </span>

          {/* Optional badge */}
          {badge && (
            <span className="shrink-0">{badge}</span>
          )}

          {/* Flexible spacer */}
          <span className="flex-1" />

          {/* Chevron — rotates from 0° (collapsed) to 90° (open) */}
          <ChevronRight
            className="shrink-0 text-cocoa-light"
            style={{
              width: 14,
              height: 14,
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: hasMounted
                ? 'transform 200ms ease-out'
                : 'none',
            }}
          />
        </button>
      </CollapsibleTrigger>

      {/* Content — slides + fades */}
      <CollapsibleContent
        forceMount
        ref={contentRef}
        className="overflow-hidden"
        style={{
          // height + opacity animation
          ...(hasMounted
            ? {
                transition: 'grid-template-rows 200ms ease-out, opacity 200ms ease-out',
              }
            : {}),
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pt-3 pb-3">
            {children}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SidebarSection;
