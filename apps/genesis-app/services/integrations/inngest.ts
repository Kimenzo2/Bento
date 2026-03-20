/**
 * Inngest Background Jobs Integration
 *
 * Workflow orchestration for long-running tasks and background jobs.
 * Features: Retries, throttling, scheduling, event-driven workflows.
 *
 * @see https://www.inngest.com/docs
 */

// ============================================================================
// TYPES
// ============================================================================

export interface InngestEvent<T = Record<string, unknown>> {
  name: string;
  data: T;
  user?: { id: string; email?: string };
  ts?: number;
  id?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  handler: () => Promise<unknown>;
  retries?: number;
}

export interface WorkflowOptions {
  id: string;
  name: string;
  throttle?: {
    limit: number;
    period: string; // e.g., "1h", "1d"
    key?: string;
  };
  rateLimit?: {
    limit: number;
    period: string;
    key?: string;
  };
  debounce?: {
    period: string;
    key?: string;
  };
  concurrency?: {
    limit: number;
    key?: string;
  };
  retries?: number;
  timeout?: string;
}

export interface InngestConfig {
  eventKey: string;
  signingKey?: string;
  baseUrl?: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export const EVENTS = {
  // Book events
  BOOK_CREATED: 'book/created',
  BOOK_PUBLISHED: 'book/published',
  BOOK_EXPORTED: 'book/exported',
  BOOK_SHARED: 'book/shared',
  BOOK_DELETED: 'book/deleted',

  // AI generation
  AI_GENERATE_CHAPTER: 'ai/generate.chapter',
  AI_GENERATE_COVER: 'ai/generate.cover',
  AI_GENERATE_AUDIOBOOK: 'ai/generate.audiobook',
  AI_TRANSLATE_BOOK: 'ai/translate.book',

  // User events
  USER_SIGNED_UP: 'user/signed-up',
  USER_UPGRADED: 'user/upgraded',
  USER_CHURNED: 'user/churned',

  // Scheduled
  DAILY_DIGEST: 'scheduled/daily-digest',
  WEEKLY_REPORT: 'scheduled/weekly-report',
  CLEANUP_OLD_DATA: 'scheduled/cleanup',

  // Notifications
  SEND_EMAIL: 'notification/email',
  SEND_PUSH: 'notification/push',
  SEND_SMS: 'notification/sms',
} as const;

// ============================================================================
// INNGEST SERVICE CLASS
// ============================================================================

class InngestService {
  private initialized = false;
  private config: InngestConfig | null = null;
  private baseUrl = 'https://inn.gs';

  /**
   * Initialize Inngest
   */
  initialize(config?: Partial<InngestConfig>): boolean {
    // Server secret — never exposed to client bundle (no VITE_ prefix)
    const eventKey = config?.eventKey;

    if (!eventKey) {
      return false;
    }

    this.config = {
      eventKey,
      // Signing key is server-only — never exposed to client bundle
      signingKey: config?.signingKey,
      baseUrl: config?.baseUrl || this.baseUrl,
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

  // ============================================================================
  // EVENT SENDING
  // ============================================================================

  /**
   * Send a single event
   */
  async send<T extends Record<string, unknown>>(
    event: InngestEvent<T>
  ): Promise<{ ids: string[] }> {
    if (!this.config) {
      throw new Error('Inngest not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/e/${this.config.eventKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: event.name,
        data: event.data,
        user: event.user,
        ts: event.ts || Date.now(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Inngest error: ${error}`);
    }

    return response.json();
  }

  /**
   * Send multiple events
   */
  async sendBatch<T extends Record<string, unknown>>(
    events: InngestEvent<T>[]
  ): Promise<{ ids: string[] }> {
    if (!this.config) {
      throw new Error('Inngest not initialized');
    }

    const payload = events.map((event) => ({
      name: event.name,
      data: event.data,
      user: event.user,
      ts: event.ts || Date.now(),
    }));

    const response = await fetch(`${this.config.baseUrl}/e/${this.config.eventKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Inngest error: ${error}`);
    }

    return response.json();
  }

  // ============================================================================
  // GENESIS-SPECIFIC EVENT HELPERS
  // ============================================================================

  /**
   * Trigger book creation workflow
   */
  async onBookCreated(data: {
    bookId: string;
    userId: string;
    title: string;
    genre: string;
  }): Promise<void> {
    await this.send({
      name: EVENTS.BOOK_CREATED,
      data,
      user: { id: data.userId },
    });
  }

  /**
   * Trigger AI chapter generation
   */
  async generateChapter(data: {
    bookId: string;
    chapterIndex: number;
    userId: string;
    prompt: string;
    outline?: string;
    previousChapter?: string;
  }): Promise<void> {
    await this.send({
      name: EVENTS.AI_GENERATE_CHAPTER,
      data,
      user: { id: data.userId },
    });
  }

  /**
   * Trigger AI cover generation
   */
  async generateCover(data: {
    bookId: string;
    userId: string;
    title: string;
    genre: string;
    style?: string;
    prompt?: string;
  }): Promise<void> {
    await this.send({
      name: EVENTS.AI_GENERATE_COVER,
      data,
      user: { id: data.userId },
    });
  }

  /**
   * Trigger audiobook generation
   */
  async generateAudiobook(data: {
    bookId: string;
    userId: string;
    voiceId: string;
    chapters: number[];
  }): Promise<void> {
    await this.send({
      name: EVENTS.AI_GENERATE_AUDIOBOOK,
      data,
      user: { id: data.userId },
    });
  }

  /**
   * Trigger book translation
   */
  async translateBook(data: {
    bookId: string;
    userId: string;
    sourceLanguage: string;
    targetLanguages: string[];
  }): Promise<void> {
    await this.send({
      name: EVENTS.AI_TRANSLATE_BOOK,
      data,
      user: { id: data.userId },
    });
  }

  /**
   * Trigger book export
   */
  async exportBook(data: {
    bookId: string;
    userId: string;
    format: 'pdf' | 'epub' | 'mobi' | 'docx';
    options?: Record<string, unknown>;
  }): Promise<void> {
    await this.send({
      name: EVENTS.BOOK_EXPORTED,
      data,
      user: { id: data.userId },
    });
  }

  /**
   * Trigger email notification
   */
  async sendEmail(data: {
    to: string;
    template: string;
    data: Record<string, unknown>;
    userId?: string;
  }): Promise<void> {
    await this.send({
      name: EVENTS.SEND_EMAIL,
      data,
      user: data.userId ? { id: data.userId } : undefined,
    });
  }

  /**
   * Track user signup for onboarding workflow
   */
  async onUserSignedUp(data: {
    userId: string;
    email: string;
    name?: string;
    source?: string;
    referralCode?: string;
  }): Promise<void> {
    await this.send({
      name: EVENTS.USER_SIGNED_UP,
      data,
      user: { id: data.userId, email: data.email },
    });
  }

  /**
   * Track user upgrade for success workflow
   */
  async onUserUpgraded(data: {
    userId: string;
    email: string;
    fromPlan: string;
    toPlan: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    await this.send({
      name: EVENTS.USER_UPGRADED,
      data,
      user: { id: data.userId, email: data.email },
    });
  }

  /**
   * Track book published for distribution workflow
   */
  async onBookPublished(data: {
    bookId: string;
    userId: string;
    title: string;
    genre: string;
    shareUrl: string;
    isPublic: boolean;
  }): Promise<void> {
    await this.send({
      name: EVENTS.BOOK_PUBLISHED,
      data,
      user: { id: data.userId },
    });
  }

  // ============================================================================
  // WORKFLOW HELPERS
  // ============================================================================

  /**
   * Create step function wrapper
   */
  createStep<T>(
    id: string,
    name: string,
    handler: () => Promise<T>,
    options?: { retries?: number }
  ): WorkflowStep {
    return {
      id,
      name,
      handler: async () => {
        try {
          return await handler();
        } catch (error) {
          // Let Inngest handle retries
          throw error;
        }
      },
      retries: options?.retries ?? 3,
    };
  }

  /**
   * Sleep helper for workflows (client-side logging only)
   */
  async sleep(duration: string): Promise<void> {
    // Parse duration string (e.g., "1h", "30m", "5s")
    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid duration: ${duration}`);
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    let ms: number;
    switch (unit) {
      case 's':
        ms = value * 1000;
        break;
      case 'm':
        ms = value * 60 * 1000;
        break;
      case 'h':
        ms = value * 60 * 60 * 1000;
        break;
      case 'd':
        ms = value * 24 * 60 * 60 * 1000;
        break;
      default:
        ms = 0;
    }

    // In actual Inngest functions, this pauses the workflow
    // Client-side this is just a regular delay
    return new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5000)));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const inngest = new InngestService();

export function initializeInngest(config?: Partial<InngestConfig>): boolean {
  return inngest.initialize(config);
}

export default inngest;
