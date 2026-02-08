/**
 * CollaborationProvider
 * Wraps the app with real-time collaboration capabilities
 *
 * Features:
 * - Automatic room management
 * - User presence tracking
 * - Real-time sync
 * - Error boundary for collaboration failures
 */

import type React from 'react';
import { Suspense, useCallback, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  LiveblocksProvider,
  type Presence,
  RoomProvider,
  type Storage,
  getUserColor,
  useErrorListener,
  useLostConnectionListener,
  useOthers,
  useStatus,
  useUpdateMyPresence,
} from '../../services/collaboration/liveblocks.config';

// =============================================================================
// TYPES
// =============================================================================

interface CollaborationProviderProps {
  children: React.ReactNode;
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

interface RoomCollaborationProps {
  children: React.ReactNode;
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  fallback?: React.ReactNode;
}

// =============================================================================
// LOADING STATES
// =============================================================================

function CollaborationLoading() {
  return (
    <div className="flex items-center justify-center p-4 text-sm text-gray-500">
      <div className="animate-pulse flex items-center gap-2">
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
        <span className="ml-2">Connecting to collaboration...</span>
      </div>
    </div>
  );
}

// =============================================================================
// ERROR FALLBACK
// =============================================================================

interface CollaborationErrorProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function CollaborationError({ error, resetErrorBoundary }: CollaborationErrorProps) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-red-800 font-medium">Collaboration Connection Error</h3>
      <p className="text-red-600 text-sm mt-1">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-3 px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
      >
        Retry Connection
      </button>
    </div>
  );
}

// =============================================================================
// CONNECTION STATUS INDICATOR
// =============================================================================

export function ConnectionStatus() {
  const status = useStatus();

  const statusConfig = {
    initial: { color: 'bg-gray-400', label: 'Initializing...' },
    connecting: { color: 'bg-yellow-400 animate-pulse', label: 'Connecting...' },
    connected: { color: 'bg-green-400', label: 'Connected' },
    reconnecting: { color: 'bg-yellow-400 animate-pulse', label: 'Reconnecting...' },
    disconnected: { color: 'bg-red-400', label: 'Disconnected' },
  };

  const config = statusConfig[status] || statusConfig.initial;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span>{config.label}</span>
    </div>
  );
}

// =============================================================================
// PRESENCE AVATARS
// =============================================================================

export function PresenceAvatars({ maxVisible = 5 }: { maxVisible?: number }) {
  const others = useOthers();

  if (others.length === 0) {
    return <div className="text-xs text-gray-400 italic">No other collaborators</div>;
  }

  const visibleUsers = others.slice(0, maxVisible);
  const remainingCount = others.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2">
      {visibleUsers.map((user) => (
        <div
          key={user.connectionId}
          className="relative group"
          style={{ zIndex: others.length - visibleUsers.indexOf(user) }}
        >
          {user.info?.avatar ? (
            <img
              src={user.info.avatar}
              alt={user.info?.name || 'Collaborator'}
              className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
              style={{ borderColor: user.presence?.color || user.info?.color }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-medium"
              style={{
                backgroundColor: user.presence?.color || user.info?.color || '#64B5F6',
                borderColor: user.presence?.color || user.info?.color,
              }}
            >
              {(user.info?.name || user.presence?.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {user.info?.name || user.presence?.displayName || 'Anonymous'}
            {user.presence?.isEditing && ' (editing)'}
          </div>
        </div>
      ))}

      {remainingCount > 0 && (
        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white shadow-sm flex items-center justify-center text-gray-600 text-xs font-medium">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CURSOR PRESENCE
// =============================================================================

export function CursorPresence() {
  const others = useOthers();

  return (
    <>
      {others.map((user) => {
        if (!user.presence?.cursor) return null;

        return (
          <div
            key={user.connectionId}
            className="pointer-events-none absolute z-50 transition-all duration-75"
            style={{
              left: user.presence.cursor.x,
              top: user.presence.cursor.y,
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: user.presence.color || user.info?.color || '#64B5F6' }}
            >
              <path
                d="M5.65376 12.4563L5.30407 12.1714L5.65376 12.4563L12.0003 3.5L18.3469 12.4563C18.7485 12.9856 18.3682 13.75 17.7072 13.75H14.0003V19.5C14.0003 20.0523 13.5526 20.5 13.0003 20.5H11.0003C10.448 20.5 10.0003 20.0523 10.0003 19.5V13.75H6.29334C5.63236 13.75 5.25213 12.9856 5.65376 12.4563Z"
                fill="currentColor"
              />
            </svg>

            {/* User name label */}
            <div
              className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap"
              style={{ backgroundColor: user.presence.color || user.info?.color || '#64B5F6' }}
            >
              {user.info?.name || user.presence.displayName || 'Anonymous'}
            </div>
          </div>
        );
      })}
    </>
  );
}

// =============================================================================
// PRESENCE SYNC HOOK
// =============================================================================

export function usePresenceSync(containerRef: React.RefObject<HTMLElement>) {
  const updateMyPresence = useUpdateMyPresence();

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      updateMyPresence({
        cursor: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      });
    },
    [containerRef, updateMyPresence]
  );

  const handlePointerLeave = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [containerRef, handlePointerMove, handlePointerLeave]);
}

// =============================================================================
// CONNECTION LISTENER HOOK
// =============================================================================

function ConnectionListeners() {
  useLostConnectionListener((event) => {
    switch (event) {
      case 'lost':
        console.warn('[Liveblocks] Connection lost, attempting to reconnect...');
        break;
      case 'restored':
        console.log('[Liveblocks] Connection restored');
        break;
      case 'failed':
        console.error('[Liveblocks] Failed to reconnect');
        break;
    }
  });

  useErrorListener((error) => {
    console.error('[Liveblocks] Error:', error);
  });

  return null;
}

// =============================================================================
// ROOM COLLABORATION WRAPPER
// =============================================================================

/**
 * Wraps a component with room-specific collaboration
 * Use this for pages that need real-time collaboration
 */
export function RoomCollaboration({
  children,
  roomId,
  userId,
  displayName,
  avatarUrl,
  fallback,
}: RoomCollaborationProps) {
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
    <ErrorBoundary FallbackComponent={CollaborationError}>
      <RoomProvider id={roomId} initialPresence={initialPresence} initialStorage={initialStorage}>
        <Suspense fallback={fallback || <CollaborationLoading />}>
          <ConnectionListeners />
          {children}
        </Suspense>
      </RoomProvider>
    </ErrorBoundary>
  );
}

// =============================================================================
// MAIN PROVIDER
// =============================================================================

/**
 * Main collaboration provider
 * Wrap your app with this to enable Liveblocks
 */
export function CollaborationProvider({
  children,
  userId,
  displayName,
  avatarUrl,
}: CollaborationProviderProps) {
  return <LiveblocksProvider>{children}</LiveblocksProvider>;
}

export default CollaborationProvider;
