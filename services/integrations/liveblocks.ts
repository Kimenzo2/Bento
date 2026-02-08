/**
 * Liveblocks Real-time Collaboration Integration
 *
 * Real-time collaborative editing, comments, and presence.
 * Features: Multiplayer cursors, conflict-free editing, notifications.
 *
 * @see https://liveblocks.io/docs
 */

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

export interface Presence {
  cursor: { x: number; y: number } | null;
  selection?: { start: number; end: number };
  focusedChapterId?: string;
  isTyping?: boolean;
  lastActiveAt?: number;
}

export interface RoomInfo {
  id: string;
  defaultAccesses: string[];
  metadata?: Record<string, string>;
  usersAccesses?: Record<string, string[]>;
  groupsAccesses?: Record<string, string[]>;
  createdAt: string;
  lastConnectionAt?: string;
}

export interface ThreadComment {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  reactions?: Array<{ emoji: string; users: string[] }>;
}

export interface Thread {
  id: string;
  roomId: string;
  metadata?: Record<string, string>;
  comments: ThreadComment[];
  createdAt: string;
  resolved?: boolean;
  resolvedAt?: string;
}

export interface LiveblocksConfig {
  publicKey: string;
  secretKey?: string;
}

export interface RoomConnection {
  roomId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  others: Array<{ connectionId: number; presence: Presence; info: User }>;
  self: { connectionId: number; presence: Presence };
}

// ============================================================================
// ROOM CONFIGURATION
// ============================================================================

export const ROOM_TYPES = {
  BOOK_EDITOR: 'book-editor',
  COVER_DESIGNER: 'cover-designer',
  CHAPTER_EDITOR: 'chapter-editor',
  REVIEW_SESSION: 'review-session',
} as const;

// User colors for collaboration
export const COLLABORATION_COLORS = [
  '#E57373',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DD0E1',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#DCE775',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#A1887F',
] as const;

// ============================================================================
// LIVEBLOCKS SERVICE CLASS
// ============================================================================

class LiveblocksService {
  private initialized = false;
  private config: LiveblocksConfig | null = null;
  private baseUrl = 'https://api.liveblocks.io/v2';
  private connections: Map<string, RoomConnection> = new Map();
  private userColor: string | null = null;

  /**
   * Initialize Liveblocks with API keys
   */
  initialize(config?: Partial<LiveblocksConfig>): boolean {
    const publicKey = config?.publicKey || import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY;

    if (!publicKey) {
      return false;
    }

    this.config = {
      publicKey,
      secretKey: config?.secretKey || import.meta.env.VITE_LIVEBLOCKS_SECRET_KEY,
    };

    // Assign random color for this user
    this.userColor = COLLABORATION_COLORS[Math.floor(Math.random() * COLLABORATION_COLORS.length)];

    this.initialized = true;
    return true;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Get user color
   */
  getUserColor(): string {
    return this.userColor || COLLABORATION_COLORS[0];
  }

  /**
   * Make API request (server-side)
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config?.secretKey) {
      throw new Error('Secret key required for this operation');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Liveblocks API error: ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // ROOM MANAGEMENT
  // ============================================================================

  /**
   * Get room ID for a book
   */
  getBookRoomId(bookId: string, type: keyof typeof ROOM_TYPES = 'BOOK_EDITOR'): string {
    return `${ROOM_TYPES[type]}-${bookId}`;
  }

  /**
   * Get room ID for a chapter
   */
  getChapterRoomId(bookId: string, chapterId: string): string {
    return `${ROOM_TYPES.CHAPTER_EDITOR}-${bookId}-${chapterId}`;
  }

  /**
   * Create a room
   */
  async createRoom(
    roomId: string,
    options?: {
      defaultAccesses?: string[];
      metadata?: Record<string, string>;
      usersAccesses?: Record<string, string[]>;
    }
  ): Promise<RoomInfo> {
    return this.request('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        id: roomId,
        defaultAccesses: options?.defaultAccesses || [],
        metadata: options?.metadata,
        usersAccesses: options?.usersAccesses,
      }),
    });
  }

  /**
   * Get room info
   */
  async getRoom(roomId: string): Promise<RoomInfo> {
    return this.request(`/rooms/${encodeURIComponent(roomId)}`);
  }

  /**
   * Delete room
   */
  async deleteRoom(roomId: string): Promise<void> {
    await this.request(`/rooms/${encodeURIComponent(roomId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Update room accesses
   */
  async updateRoomAccesses(
    roomId: string,
    usersAccesses: Record<string, string[]>
  ): Promise<RoomInfo> {
    return this.request(`/rooms/${encodeURIComponent(roomId)}`, {
      method: 'POST',
      body: JSON.stringify({ usersAccesses }),
    });
  }

  /**
   * Get active users in room
   */
  async getActiveUsers(roomId: string): Promise<
    Array<{
      type: 'user';
      id: string;
      connectionId: number;
      info?: Record<string, unknown>;
    }>
  > {
    const result = await this.request<{
      data: Array<{
        type: 'user';
        id: string;
        connectionId: number;
        info?: Record<string, unknown>;
      }>;
    }>(`/rooms/${encodeURIComponent(roomId)}/active-users`);
    return result.data;
  }

  // ============================================================================
  // COMMENTS & THREADS
  // ============================================================================

  /**
   * Get threads in room
   */
  async getThreads(roomId: string): Promise<Thread[]> {
    const result = await this.request<{ data: Thread[] }>(
      `/rooms/${encodeURIComponent(roomId)}/threads`
    );
    return result.data;
  }

  /**
   * Get thread by ID
   */
  async getThread(roomId: string, threadId: string): Promise<Thread> {
    return this.request(`/rooms/${encodeURIComponent(roomId)}/threads/${threadId}`);
  }

  /**
   * Create thread
   */
  async createThread(
    roomId: string,
    comment: { body: string; userId: string },
    metadata?: Record<string, string>
  ): Promise<Thread> {
    return this.request(`/rooms/${encodeURIComponent(roomId)}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        comment: {
          userId: comment.userId,
          body: { version: 1, content: comment.body },
        },
        metadata,
      }),
    });
  }

  /**
   * Add comment to thread
   */
  async addComment(
    roomId: string,
    threadId: string,
    comment: { body: string; userId: string }
  ): Promise<ThreadComment> {
    return this.request(`/rooms/${encodeURIComponent(roomId)}/threads/${threadId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        userId: comment.userId,
        body: { version: 1, content: comment.body },
      }),
    });
  }

  /**
   * Resolve thread
   */
  async resolveThread(roomId: string, threadId: string): Promise<Thread> {
    return this.request(`/rooms/${encodeURIComponent(roomId)}/threads/${threadId}`, {
      method: 'POST',
      body: JSON.stringify({ resolved: true }),
    });
  }

  /**
   * Delete thread
   */
  async deleteThread(roomId: string, threadId: string): Promise<void> {
    await this.request(`/rooms/${encodeURIComponent(roomId)}/threads/${threadId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Create access token for user
   */
  async createAccessToken(
    userId: string,
    roomId: string,
    userInfo?: { name?: string; avatar?: string; color?: string }
  ): Promise<{ token: string }> {
    // For client-side, this would typically be done through an API route
    return this.request('/authorize', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        room: roomId,
        userInfo: {
          name: userInfo?.name || 'Anonymous',
          avatar: userInfo?.avatar,
          color: userInfo?.color || this.getUserColor(),
        },
      }),
    });
  }

  /**
   * Create ID token for user
   */
  async createIdToken(
    userId: string,
    userInfo?: { name?: string; avatar?: string }
  ): Promise<{ token: string }> {
    return this.request('/identify-user', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        userInfo,
      }),
    });
  }

  // ============================================================================
  // GENESIS-SPECIFIC HELPERS
  // ============================================================================

  /**
   * Create collaboration room for a book
   */
  async createBookCollaborationRoom(
    bookId: string,
    bookTitle: string,
    ownerId: string,
    collaboratorIds: string[] = []
  ): Promise<RoomInfo> {
    const roomId = this.getBookRoomId(bookId);

    const usersAccesses: Record<string, string[]> = {
      [ownerId]: ['room:write', 'comments:write'],
    };

    collaboratorIds.forEach((id) => {
      usersAccesses[id] = ['room:write', 'comments:write'];
    });

    return this.createRoom(roomId, {
      metadata: {
        bookId,
        bookTitle,
        ownerId,
        type: 'book-editor',
      },
      usersAccesses,
    });
  }

  /**
   * Add collaborator to book room
   */
  async addBookCollaborator(
    bookId: string,
    collaboratorId: string,
    canWrite = true
  ): Promise<RoomInfo> {
    const roomId = this.getBookRoomId(bookId);
    const permissions = canWrite
      ? ['room:write', 'comments:write']
      : ['room:read', 'comments:write'];

    return this.updateRoomAccesses(roomId, {
      [collaboratorId]: permissions,
    });
  }

  /**
   * Remove collaborator from book room
   */
  async removeBookCollaborator(bookId: string, collaboratorId: string): Promise<RoomInfo> {
    const roomId = this.getBookRoomId(bookId);
    return this.updateRoomAccesses(roomId, {
      [collaboratorId]: [],
    });
  }

  /**
   * Get all comments on a book
   */
  async getBookComments(bookId: string): Promise<Thread[]> {
    const roomId = this.getBookRoomId(bookId);
    return this.getThreads(roomId);
  }

  /**
   * Add comment on a book
   */
  async commentOnBook(
    bookId: string,
    userId: string,
    comment: string,
    chapterId?: string,
    selectionStart?: number,
    selectionEnd?: number
  ): Promise<Thread> {
    const roomId = this.getBookRoomId(bookId);

    const metadata: Record<string, string> = {};
    if (chapterId) metadata.chapterId = chapterId;
    if (selectionStart !== undefined) metadata.selectionStart = String(selectionStart);
    if (selectionEnd !== undefined) metadata.selectionEnd = String(selectionEnd);

    return this.createThread(roomId, { body: comment, userId }, metadata);
  }

  /**
   * Get who's currently editing a book
   */
  async getBookActiveEditors(bookId: string): Promise<User[]> {
    const roomId = this.getBookRoomId(bookId);
    const activeUsers = await this.getActiveUsers(roomId);

    return activeUsers.map((u) => ({
      id: u.id,
      name: (u.info?.name as string) || 'Anonymous',
      avatar: u.info?.avatar as string | undefined,
      color: u.info?.color as string | undefined,
    }));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const liveblocks = new LiveblocksService();

export function initializeLiveblocks(config?: Partial<LiveblocksConfig>): boolean {
  return liveblocks.initialize(config);
}

export default liveblocks;
