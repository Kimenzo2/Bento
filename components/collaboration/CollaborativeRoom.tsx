/**
 * CollaborativeRoom Component
 * A ready-to-use collaborative editing room with all features
 */

import { ClientSideSuspense } from '@liveblocks/react/suspense';
import type React from 'react';
import { useCallback, useRef } from 'react';
import {
  type Presence,
  type RoomEvent,
  RoomProvider,
  type Storage,
  getUserColor,
  useBroadcastEvent,
  useEventListener,
  useMyPresence,
  useOthers,
  useSelf,
  useStatus,
  useUpdateMyPresence,
} from '../../services/collaboration/liveblocks.config';
import { ConnectionStatus, PresenceAvatars } from './CollaborationProvider';
import { LiveCursors } from './LiveCursors';

// =============================================================================
// TYPES
// =============================================================================

interface CollaborativeRoomProps {
  /** Unique room identifier */
  roomId: string;
  /** Current user's ID */
  userId: string;
  /** Current user's display name */
  displayName: string;
  /** Current user's avatar URL */
  avatarUrl?: string;
  /** Child content to render in the collaborative space */
  children: React.ReactNode;
  /** Show cursor tracking */
  showCursors?: boolean;
  /** Show presence avatars */
  showPresence?: boolean;
  /** Show connection status */
  showStatus?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Class name for the container */
  className?: string;
}

// =============================================================================
// ROOM CONTENT
// =============================================================================

interface RoomContentProps {
  children: React.ReactNode;
  showCursors: boolean;
  showPresence: boolean;
  showStatus: boolean;
  className?: string;
}

function RoomContent({
  children,
  showCursors,
  showPresence,
  showStatus,
  className,
}: RoomContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateMyPresence = useUpdateMyPresence();
  const _self = useSelf();
  const others = useOthers();
  const _status = useStatus();

  // Track cursor movement
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      updateMyPresence({
        cursor: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      });
    },
    [updateMyPresence]
  );

  const handlePointerLeave = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  return (
    <div className={`relative ${className || ''}`}>
      {/* Header with presence and status */}
      {(showPresence || showStatus) && (
        <div className="flex items-center justify-between p-3 bg-surface border-b border-peach-soft">
          <div className="flex items-center gap-4">
            {showPresence && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-cocoa-light font-medium">
                  {others.length + 1} online
                </span>
                <PresenceAvatars maxVisible={5} />
              </div>
            )}
          </div>

          {showStatus && <ConnectionStatus />}
        </div>
      )}

      {/* Collaborative canvas */}
      <div
        ref={containerRef}
        className="relative min-h-100"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Render live cursors */}
        {showCursors && <LiveCursors containerRef={containerRef} />}

        {/* Child content */}
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

function DefaultLoading() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-sm text-cocoa-light">Connecting to collaboration room...</span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * CollaborativeRoom - A complete collaborative editing environment
 *
 * @example
 * ```tsx
 * <CollaborativeRoom
 *   roomId={`book-${bookId}`}
 *   userId={user.id}
 *   displayName={user.name}
 *   showCursors
 *   showPresence
 * >
 *   <BookEditor bookId={bookId} />
 * </CollaborativeRoom>
 * ```
 */
export function CollaborativeRoom({
  roomId,
  userId,
  displayName,
  avatarUrl,
  children,
  showCursors = true,
  showPresence = true,
  showStatus = true,
  loadingComponent,
  className,
}: CollaborativeRoomProps) {
  const initialPresence: Presence = {
    cursor: null,
    selectedIds: [],
    displayName,
    avatarUrl,
    color: getUserColor(userId),
    isEditing: false,
  };

  const initialStorage: Storage = {
    bookContent: null,
    chapters: [],
    comments: [],
    canvasElements: [],
  };

  return (
    <RoomProvider id={roomId} initialPresence={initialPresence} initialStorage={initialStorage}>
      <ClientSideSuspense fallback={loadingComponent || <DefaultLoading />}>
        <RoomContent
          showCursors={showCursors}
          showPresence={showPresence}
          showStatus={showStatus}
          className={className}
        >
          {children}
        </RoomContent>
      </ClientSideSuspense>
    </RoomProvider>
  );
}

// =============================================================================
// HOOKS FOR ROOM FEATURES
// =============================================================================

/**
 * Hook to broadcast events to all users in the room
 */
export function useRoomBroadcast() {
  const broadcast = useBroadcastEvent();

  return {
    broadcastChapterSaved: (chapterId: string) =>
      broadcast({ type: 'CHAPTER_SAVED', data: { chapterId }, timestamp: Date.now() }),

    broadcastContentRegenerated: (elementId: string) =>
      broadcast({ type: 'CONTENT_REGENERATED', data: { elementId }, timestamp: Date.now() }),

    broadcastUndo: () => broadcast({ type: 'UNDO', timestamp: Date.now() }),

    broadcastRedo: () => broadcast({ type: 'REDO', timestamp: Date.now() }),

    broadcastCustom: (event: RoomEvent) => broadcast({ ...event, timestamp: Date.now() }),
  };
}

/**
 * Hook to listen for room events
 */
export function useRoomEvents(handlers: {
  onChapterSaved?: (chapterId: string) => void;
  onContentRegenerated?: (elementId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCustom?: (event: RoomEvent) => void;
}) {
  useEventListener(({ event }) => {
    const eventData = event.data as { chapterId?: string; elementId?: string } | undefined;
    switch (event.type) {
      case 'CHAPTER_SAVED':
        handlers.onChapterSaved?.(eventData?.chapterId || '');
        break;
      case 'CONTENT_REGENERATED':
        handlers.onContentRegenerated?.(eventData?.elementId || '');
        break;
      case 'UNDO':
        handlers.onUndo?.();
        break;
      case 'REDO':
        handlers.onRedo?.();
        break;
      default:
        handlers.onCustom?.(event);
    }
  });
}

/**
 * Hook to manage selection state
 */
export function useSelection() {
  const [presence] = useMyPresence();
  const updateMyPresence = useUpdateMyPresence();

  return {
    selectedIds: presence.selectedIds,

    select: (id: string) => {
      updateMyPresence({ selectedIds: [id] });
    },

    addToSelection: (id: string) => {
      updateMyPresence({
        selectedIds: [...(presence.selectedIds || []), id].filter((v, i, a) => a.indexOf(v) === i),
      });
    },

    removeFromSelection: (id: string) => {
      updateMyPresence({
        selectedIds: (presence.selectedIds || []).filter((selectedId) => selectedId !== id),
      });
    },

    clearSelection: () => {
      updateMyPresence({ selectedIds: [] });
    },

    isSelected: (id: string) => (presence.selectedIds || []).includes(id),
  };
}

/**
 * Hook to manage editing state
 */
export function useEditingState() {
  const [presence] = useMyPresence();
  const updateMyPresence = useUpdateMyPresence();

  return {
    isEditing: presence.isEditing,
    editingElementId: presence.editingElementId,

    startEditing: (elementId: string) => {
      updateMyPresence({ isEditing: true, editingElementId: elementId });
    },

    stopEditing: () => {
      updateMyPresence({ isEditing: false, editingElementId: undefined });
    },
  };
}

export default CollaborativeRoom;
