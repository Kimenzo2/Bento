/**
 * GenActionsStrip.tsx — Fixed action bar at the bottom of the left zone.
 *
 * Contains Check Characters and AI Improve buttons. Always visible.
 */

import type React from 'react';
import { Loader2, Users, Wand2 } from 'lucide-react';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface GenActionsStripProps {
  isCheckingConsistency: boolean;
  isImproving: boolean;
  onCheckConsistency: () => void;
  onImprove: () => void;
}

const GenActionsStrip: React.FC<GenActionsStripProps> = ({
  isCheckingConsistency,
  isImproving,
  onCheckConsistency,
  onImprove,
}) => {
  return (
    <div
      className="h-14 flex items-center gap-2 px-4 border-t border-peach-soft shrink-0"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      {/* Check Characters */}
      <button
        type="button"
        onClick={onCheckConsistency}
        disabled={isCheckingConsistency}
        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg
          text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/40
          transition-all duration-150 active:scale-[0.98] cursor-pointer
          disabled:opacity-40 disabled:cursor-default
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
        style={{ ...geist, fontSize: 12, fontWeight: 500 }}
      >
        {isCheckingConsistency ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Users className="w-3.5 h-3.5" />
        )}
        {isCheckingConsistency ? 'Checking...' : 'Characters'}
      </button>

      {/* AI Improve */}
      <button
        type="button"
        onClick={onImprove}
        disabled={isImproving}
        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg
          text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/40
          transition-all duration-150 active:scale-[0.98] cursor-pointer
          disabled:opacity-40 disabled:cursor-default
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
        style={{ ...geist, fontSize: 12, fontWeight: 500 }}
      >
        {isImproving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Wand2 className="w-3.5 h-3.5" />
        )}
        {isImproving ? 'Improving...' : 'Improve'}
      </button>
    </div>
  );
};

export default GenActionsStrip;
