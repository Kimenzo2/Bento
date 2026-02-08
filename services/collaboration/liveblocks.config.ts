/**
 * Liveblocks Configuration
 * Real-time collaboration infrastructure for Genesis
 *
 * Features:
 * - Multiplayer cursors and presence
 * - Real-time document editing
 * - Room-based collaboration
 * - User awareness
 */

import { createClient } from '@liveblocks/client';
import { createLiveblocksContext, createRoomContext } from '@liveblocks/react';

import type { Json } from '@liveblocks/client';

// =============================================================================
// TYPES
// =============================================================================

/**
 * User presence data shared across all users in a room
 */
export type Presence = {
  /** Cursor position - null when not hovering over canvas */
  cursor: { x: number; y: number } | null;
  /** Currently selected element IDs */
  selectedIds: string[];
  /** User's display name */
  displayName: string;
  /** User's avatar URL */
  avatarUrl?: string;
  /** User's assigned color */
  color: string;
  /** Current editing state */
  isEditing: boolean;
  /** Currently editing element */
  editingElementId?: string;
  /** Scroll position for syncing view */
  scrollPosition?: { x: number; y: number };
  [key: string]: Json | undefined;
};

/**
 * Storage types for persistent room data
 */
export type Storage = {
  /** Book content stored as JSON */
  bookContent: Json;
  /** Chapter structure */
  chapters: Json[];
  /** Comments and annotations */
  comments: Json[];
  /** Canvas elements for visual editing */
  canvasElements: Json[];
  [key: string]: Json | undefined;
};

/**
 * User metadata stored in Liveblocks
 */
export interface UserMeta {
  id: string;
  info: {
    name: string;
    email?: string;
    avatar?: string;
    color: string;
  };
}

/**
 * Room event types for broadcasting
 */
export type RoomEvent = {
  type:
    | 'CHAPTER_SAVED'
    | 'CONTENT_REGENERATED'
    | 'USER_JOINED'
    | 'USER_LEFT'
    | 'CURSOR_MESSAGE'
    | 'SELECTION_CHANGE'
    | 'UNDO'
    | 'REDO';
  data?: Json;
  userId?: string;
  timestamp?: number;
  [key: string]: Json | undefined;
};

/**
 * Thread metadata for comments
 */
export type ThreadMetadata = {
  /** Element the comment is attached to */
  elementId?: string;
  /** Chapter the comment belongs to */
  chapterId?: string;
  /** Position X in the document */
  positionX?: number;
  /** Position Y in the document */
  positionY?: number;
  /** Comment resolved status */
  resolved: boolean;
  /** Comment creation time */
  createdAt: number;
  [key: string]: string | boolean | number | undefined;
};

// =============================================================================
// CLIENT CONFIGURATION
// =============================================================================

const LIVEBLOCKS_PUBLIC_KEY =
  import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ||
  'pk_dev_zw9Fro10VkAiUk2uz_Q63xFyvwjIDrsMddlr4Po-RyWZ3yAQIstVIr46JUagQ1kv';

/**
 * Liveblocks client instance
 * Handles WebSocket connections and real-time sync
 */
export const liveblocksClient = createClient({
  publicApiKey: LIVEBLOCKS_PUBLIC_KEY,

  // Throttle presence updates to reduce bandwidth
  throttle: 100,

  // Lost connection behavior
  lostConnectionTimeout: 5000,

  // Background tab handling
  backgroundKeepAliveTimeout: 15000,
});

// =============================================================================
// ROOM CONTEXT
// =============================================================================

/**
 * Room context with typed presence, storage, and events
 * Use these hooks inside RoomProvider components
 */
export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useOthersMapped,
  useOthersConnectionIds,
  useSelf,
  useStorage,
  useMutation,
  useHistory,
  useUndo,
  useRedo,
  useCanUndo,
  useCanRedo,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  useLostConnectionListener,
  useErrorListener,
  useThreads,
  useCreateThread,
  useEditThreadMetadata,
  useCreateComment,
  useEditComment,
  useDeleteComment,
  useAddReaction,
  useRemoveReaction,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent, ThreadMetadata>(liveblocksClient);

/**
 * Global Liveblocks context for app-wide features
 */
export const {
  LiveblocksProvider,
  useInboxNotifications,
  useMarkAllInboxNotificationsAsRead,
  useUnreadInboxNotificationsCount,
  useRoomInfo,
} = createLiveblocksContext(liveblocksClient);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique room ID for a book
 */
export function getBookRoomId(bookId: string): string {
  return `genesis-book-${bookId}`;
}

/**
 * Generate a unique room ID for a chapter
 */
export function getChapterRoomId(bookId: string, chapterId: string): string {
  return `genesis-chapter-${bookId}-${chapterId}`;
}

/**
 * Generate a color for a user based on their ID
 */
export function getUserColor(userId: string): string {
  const colors = [
    '#E57373', // Red
    '#81C784', // Green
    '#64B5F6', // Blue
    '#FFD54F', // Yellow
    '#BA68C8', // Purple
    '#4DD0E1', // Cyan
    '#FF8A65', // Orange
    '#A1887F', // Brown
    '#90A4AE', // Blue Grey
    '#F06292', // Pink
  ];

  // Simple hash function to pick a consistent color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Default presence state for new users
 */
export function getDefaultPresence(displayName: string, userId: string): Presence {
  return {
    cursor: null,
    selectedIds: [],
    displayName,
    color: getUserColor(userId),
    isEditing: false,
  };
}

// =============================================================================
// ROOM CONFIGURATION PRESETS
// =============================================================================

/**
 * Room configuration for book editing
 */
export const bookEditingRoomConfig = {
  initialPresence: {
    cursor: null,
    selectedIds: [],
    displayName: 'Anonymous',
    color: '#64B5F6',
    isEditing: false,
  } as Presence,
  initialStorage: {
    bookContent: null,
    chapters: [],
    comments: [],
    canvasElements: [],
  } as Storage,
};

/**
 * Room configuration for canvas collaboration
 */
export const canvasCollaborationConfig = {
  initialPresence: {
    cursor: null,
    selectedIds: [],
    displayName: 'Anonymous',
    color: '#64B5F6',
    isEditing: false,
    scrollPosition: { x: 0, y: 0 },
  } as Presence,
  initialStorage: {
    bookContent: null,
    chapters: [],
    comments: [],
    canvasElements: [],
  } as Storage,
};

export default {
  liveblocksClient,
  RoomProvider,
  LiveblocksProvider,
  getBookRoomId,
  getChapterRoomId,
  getUserColor,
  getDefaultPresence,
};
