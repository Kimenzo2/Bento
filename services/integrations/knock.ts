/**
 * Knock Notifications Service Integration
 *
 * Multi-channel notification infrastructure for product messaging.
 * Features: In-app, Email, SMS, Push, Slack, with workflow orchestration.
 *
 * @see https://docs.knock.app
 */

// ============================================================================
// TYPES
// ============================================================================

export interface KnockUser {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  properties?: Record<string, unknown>;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface WorkflowTrigger {
  workflow: string;
  recipients: string | string[];
  data?: Record<string, unknown>;
  actor?: string;
  tenant?: string;
  cancellationKey?: string;
}

export interface NotificationFeed {
  items: FeedItem[];
  pageInfo: {
    before: string | null;
    after: string | null;
  };
  totalCount: number;
  unreadCount: number;
  unseenCount: number;
}

export interface FeedItem {
  id: string;
  __cursor: string;
  activities: Activity[];
  actors: KnockUser[];
  total_activities: number;
  total_actors: number;
  inserted_at: string;
  updated_at: string;
  read_at: string | null;
  seen_at: string | null;
  archived_at: string | null;
  source: {
    key: string;
    version_id: string;
  };
  tenant: string | null;
  data: Record<string, unknown>;
}

export interface Activity {
  id: string;
  data: Record<string, unknown>;
  inserted_at: string;
  recipient: string;
}

export interface KnockConfig {
  apiKey: string;
  publicApiKey: string;
  feedChannelId?: string;
}

// ============================================================================
// NOTIFICATION WORKFLOWS
// ============================================================================

export const WORKFLOWS = {
  // User lifecycle
  WELCOME: 'welcome',
  ONBOARDING_STEP: 'onboarding-step',
  PASSWORD_RESET: 'password-reset',

  // Book events
  BOOK_CREATED: 'book-created',
  BOOK_PUBLISHED: 'book-published',
  BOOK_SHARED: 'book-shared',
  EXPORT_COMPLETE: 'export-complete',

  // Collaboration
  COLLABORATION_INVITE: 'collaboration-invite',
  COLLABORATION_ACCEPTED: 'collaboration-accepted',
  COMMENT_ADDED: 'comment-added',
  MENTION: 'mention',

  // Gamification
  ACHIEVEMENT_UNLOCKED: 'achievement-unlocked',
  LEVEL_UP: 'level-up',
  STREAK_MILESTONE: 'streak-milestone',
  LEADERBOARD_CHANGE: 'leaderboard-change',

  // Engagement
  DAILY_REMINDER: 'daily-reminder',
  WEEKLY_DIGEST: 'weekly-digest',
  INACTIVITY_NUDGE: 'inactivity-nudge',

  // System
  SYSTEM_ANNOUNCEMENT: 'system-announcement',
  MAINTENANCE_NOTICE: 'maintenance-notice',
  FEATURE_UPDATE: 'feature-update',
} as const;

// ============================================================================
// KNOCK SERVICE CLASS
// ============================================================================

class KnockService {
  private initialized = false;
  private config: KnockConfig | null = null;
  private baseUrl = 'https://api.knock.app/v1';
  private feedClient: unknown = null;

  /**
   * Initialize Knock with API keys
   */
  async initialize(config?: Partial<KnockConfig>): Promise<boolean> {
    const apiKey = config?.apiKey || import.meta.env.VITE_KNOCK_API_KEY;
    const publicApiKey = config?.publicApiKey || import.meta.env.VITE_KNOCK_PUBLIC_API_KEY;

    if (!apiKey || !publicApiKey) {
      return false;
    }

    this.config = {
      apiKey,
      publicApiKey,
      feedChannelId: config?.feedChannelId || import.meta.env.VITE_KNOCK_FEED_CHANNEL_ID,
    };

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
   * Make API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Knock not initialized');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Knock API error: ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Identify/upsert a user in Knock
   */
  async identify(user: KnockUser): Promise<KnockUser> {
    return this.request(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        email: user.email,
        name: user.name,
        phone_number: user.phone,
        avatar: user.avatar,
        ...user.properties,
      }),
    });
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<KnockUser> {
    return this.request(`/users/${userId}`);
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}`, { method: 'DELETE' });
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.request(`/users/${userId}/preferences`);
  }

  /**
   * Update user preferences
   */
  async setPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    return this.request(`/users/${userId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // ============================================================================
  // WORKFLOW TRIGGERS
  // ============================================================================

  /**
   * Trigger a workflow
   */
  async trigger(options: WorkflowTrigger): Promise<{ workflow_run_id: string }> {
    const recipients = Array.isArray(options.recipients)
      ? options.recipients
      : [options.recipients];

    return this.request(`/workflows/${options.workflow}/trigger`, {
      method: 'POST',
      body: JSON.stringify({
        recipients,
        data: options.data || {},
        actor: options.actor,
        tenant: options.tenant,
        cancellation_key: options.cancellationKey,
      }),
    });
  }

  /**
   * Cancel a workflow run
   */
  async cancel(workflow: string, cancellationKey: string, recipients?: string[]): Promise<void> {
    await this.request(`/workflows/${workflow}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancellation_key: cancellationKey,
        recipients,
      }),
    });
  }

  // ============================================================================
  // NOTIFICATION FEED
  // ============================================================================

  /**
   * Get user's notification feed
   */
  async getFeed(
    userId: string,
    options?: {
      before?: string;
      after?: string;
      pageSize?: number;
      status?: 'unread' | 'read' | 'unseen' | 'seen' | 'all';
    }
  ): Promise<NotificationFeed> {
    const params = new URLSearchParams();
    if (options?.before) params.set('before', options.before);
    if (options?.after) params.set('after', options.after);
    if (options?.pageSize) params.set('page_size', String(options.pageSize));
    if (options?.status) params.set('status', options.status);

    const channelId = this.config?.feedChannelId || 'in-app-feed';
    return this.request(`/users/${userId}/feeds/${channelId}?${params}`);
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, itemIds: string[]): Promise<void> {
    const channelId = this.config?.feedChannelId || 'in-app-feed';
    await this.request(`/users/${userId}/feeds/${channelId}/mark_read`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  }

  /**
   * Mark notifications as seen
   */
  async markAsSeen(userId: string, itemIds: string[]): Promise<void> {
    const channelId = this.config?.feedChannelId || 'in-app-feed';
    await this.request(`/users/${userId}/feeds/${channelId}/mark_seen`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const channelId = this.config?.feedChannelId || 'in-app-feed';
    await this.request(`/users/${userId}/feeds/${channelId}/mark_all_as_read`, {
      method: 'POST',
    });
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR GENESIS
  // ============================================================================

  /**
   * Notify user of book creation
   */
  async notifyBookCreated(userId: string, bookId: string, bookTitle: string): Promise<void> {
    await this.trigger({
      workflow: WORKFLOWS.BOOK_CREATED,
      recipients: userId,
      data: { bookId, bookTitle },
    });
  }

  /**
   * Notify collaborators of new comment
   */
  async notifyComment(
    authorId: string,
    collaboratorIds: string[],
    bookTitle: string,
    comment: string
  ): Promise<void> {
    await this.trigger({
      workflow: WORKFLOWS.COMMENT_ADDED,
      recipients: collaboratorIds,
      actor: authorId,
      data: { bookTitle, comment: comment.slice(0, 200) },
    });
  }

  /**
   * Notify user of achievement
   */
  async notifyAchievement(
    userId: string,
    achievement: { name: string; description: string; xp: number }
  ): Promise<void> {
    await this.trigger({
      workflow: WORKFLOWS.ACHIEVEMENT_UNLOCKED,
      recipients: userId,
      data: achievement,
    });
  }

  /**
   * Notify user of level up
   */
  async notifyLevelUp(userId: string, newLevel: number, tierName: string): Promise<void> {
    await this.trigger({
      workflow: WORKFLOWS.LEVEL_UP,
      recipients: userId,
      data: { level: newLevel, tierName },
    });
  }

  /**
   * Send collaboration invite
   */
  async notifyCollaborationInvite(
    inviterId: string,
    inviteeId: string,
    bookId: string,
    bookTitle: string
  ): Promise<void> {
    await this.trigger({
      workflow: WORKFLOWS.COLLABORATION_INVITE,
      recipients: inviteeId,
      actor: inviterId,
      data: { bookId, bookTitle },
      cancellationKey: `collab-invite-${bookId}-${inviteeId}`,
    });
  }

  /**
   * Send system announcement to all users
   */
  async broadcastAnnouncement(
    userIds: string[],
    title: string,
    message: string,
    actionUrl?: string
  ): Promise<void> {
    // Batch in groups of 1000
    const batchSize = 1000;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await this.trigger({
        workflow: WORKFLOWS.SYSTEM_ANNOUNCEMENT,
        recipients: batch,
        data: { title, message, actionUrl },
      });
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const knock = new KnockService();

export function initializeKnock(config?: Partial<KnockConfig>): Promise<boolean> {
  return knock.initialize(config);
}

export default knock;
