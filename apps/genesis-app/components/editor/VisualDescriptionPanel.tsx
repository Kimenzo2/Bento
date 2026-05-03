/**
 * VisualDescriptionPanel.tsx — Collapsible display of the image prompt.
 *
 * Read-only by default, expandable to edit. Shows the auto-generated
 * visual description that gets sent to generate illustrations.
 */

import type React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

interface VisualDescriptionPanelProps {
  description: string;
  hasImage: boolean;
  onDescriptionChange?: (text: string) => void;
}

const VisualDescriptionPanel: React.FC<VisualDescriptionPanelProps> = ({
  description,
  hasImage,
  onDescriptionChange,
}) => {
  // Collapsed by default if description exists AND image is generated
  const [isCollapsed, setIsCollapsed] = useState(!!description && hasImage);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(description);

  const handleSaveEdit = () => {
    setIsEditing(false);
    if (onDescriptionChange && editText !== description) {
      onDescriptionChange(editText);
    }
  };

  return (
    <div className="px-4 pb-3">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex items-center justify-between w-full py-2 group cursor-pointer"
        title="This is sent to the AI to generate your illustration"
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cocoa-light"
          style={geist}
        >
          Visual Description
        </span>
        {isCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-cocoa-light/60 group-hover:text-cocoa-light transition-colors" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-cocoa-light/60 group-hover:text-cocoa-light transition-colors" />
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="ml-4 relative">
          {/* Accent left border */}
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-primary-start) 40%, transparent)',
            }}
          />

          {isEditing ? (
            <div className="pl-4 pb-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full resize-none bg-transparent border border-peach-soft rounded-lg p-2 text-sm text-charcoal-soft outline-none focus:border-coral-burst"
                style={{ fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
                rows={4}
                autoFocus
                aria-label="Visual description"
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="text-[11px] font-medium text-coral-burst hover:underline cursor-pointer"
                  style={geist}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(description);
                  }}
                  className="text-[11px] font-medium text-cocoa-light hover:underline cursor-pointer"
                  style={geist}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="pl-4 pb-2">
              <p
                className="text-sm italic text-cocoa-light leading-relaxed"
                style={{
                  fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
                  fontSize: 13,
                }}
              >
                {description ||
                  'No visual description yet. Write story text and one will be generated.'}
              </p>

              {/* Edit button */}
              {description && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 mt-2 text-[11px] font-medium text-cocoa-light hover:text-coral-burst transition-colors cursor-pointer"
                  style={geist}
                >
                  <Pencil className="w-3 h-3" />
                  Edit description
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisualDescriptionPanel;
