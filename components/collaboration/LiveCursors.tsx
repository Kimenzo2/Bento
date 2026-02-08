/**
 * LiveCursors Component
 * Shows real-time cursor positions of all collaborators
 */

import React from 'react';
import { useOthers, useSelf } from '../../services/collaboration/liveblocks.config';

interface CursorProps {
  x: number;
  y: number;
  color: string;
  name: string;
}

function Cursor({ x, y, color, name }: CursorProps) {
  return (
    <div
      className="pointer-events-none absolute z-[9999] transition-transform duration-[20ms]"
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'rotate(-10deg)' }}
      >
        <path
          d="M3.5 3.5L3.5 16.5L7.5 12.5L12 17L14 15L9.5 10.5L14.5 10.5L3.5 3.5Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name badge */}
      <div
        className="absolute left-4 top-4 px-2 py-1 rounded-full text-[11px] font-medium text-white whitespace-nowrap shadow-md"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}

interface LiveCursorsProps {
  /** Container element for relative positioning */
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function LiveCursors({ containerRef }: LiveCursorsProps) {
  const others = useOthers();

  return (
    <>
      {others
        .filter((other) => other.presence?.cursor != null)
        .map((other) => (
          <Cursor
            key={other.connectionId}
            x={other.presence!.cursor!.x}
            y={other.presence!.cursor!.y}
            color={other.presence?.color || other.info?.color || '#6366F1'}
            name={other.info?.name || other.presence?.displayName || 'Anonymous'}
          />
        ))}
    </>
  );
}

/**
 * Hook to track cursor position and update presence
 */
export function useCursorTracking(containerRef: React.RefObject<HTMLElement | null>) {
  const self = useSelf();

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Track cursor position
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update presence via the updateMyPresence from the parent
      const event = new CustomEvent('cursor-move', { detail: { x, y } });
      container.dispatchEvent(event);
    };

    const handlePointerLeave = () => {
      const event = new CustomEvent('cursor-leave');
      container.dispatchEvent(event);
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [containerRef]);
}

export default LiveCursors;
