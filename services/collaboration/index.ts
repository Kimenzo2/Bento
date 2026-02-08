/**
 * Collaboration Module
 * Real-time collaboration infrastructure using Liveblocks
 */

// Core config and client
export {
  liveblocksClient,
  RoomProvider,
  LiveblocksProvider,
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
  useInboxNotifications,
  useMarkAllInboxNotificationsAsRead,
  useUnreadInboxNotificationsCount,
  useRoomInfo,
  getBookRoomId,
  getChapterRoomId,
  getUserColor,
  getDefaultPresence,
  bookEditingRoomConfig,
  canvasCollaborationConfig,
  type Presence,
  type Storage,
  type UserMeta,
  type RoomEvent,
  type ThreadMetadata,
} from './liveblocks.config';

// Re-export types
export type { Presence as CollaborationPresence } from './liveblocks.config';
