/**
 * Mars-Class Infrastructure - BullMQ Job Queue System
 *
 * Decouples long-running tasks from user requests for reliable processing.
 *
 * THE PROBLEM (Synchronous Trap):
 * - Serverless functions have 10-60s execution limits
 * - Book generation with AI takes 30-60+ seconds
 * - HTTP connections are fragile on mobile networks
 * - Function timeouts leave partial/corrupted data
 *
 * THE SOLUTION (Async Job Queue):
 * - Jobs are queued instantly (202 Accepted response)
 * - Worker fleet processes jobs at sustainable rate
 * - Automatic retries with exponential backoff
 * - Progress tracking via Redis pub/sub
 * - Rate limiting respects API quotas
 *
 * ARCHITECTURE:
 * 1. User clicks "Create Book" → API pushes job to Redis queue
 * 2. API returns jobId immediately
 * 3. Worker fleet processes jobs (Gemini → Imagen → Storage)
 * 4. Progress updates streamed to frontend
 * 5. Final result stored in Supabase
 */

import { authenticatedFetch } from '../api/authenticatedFetch';

// ============================================================================
// JOB TYPES
// ============================================================================

export enum JobType {
  // Book Generation Pipeline
  GENERATE_BOOK = 'generate_book',
  GENERATE_CHAPTER = 'generate_chapter',
  GENERATE_PAGE_IMAGE = 'generate_page_image',
  GENERATE_COVER = 'generate_cover',

  // Image Processing
  OPTIMIZE_IMAGE = 'optimize_image',
  GENERATE_THUMBNAILS = 'generate_thumbnails',
  CONVERT_TO_WEBP = 'convert_to_webp',

  // AI Tasks
  SEMANTIC_CACHE_UPDATE = 'semantic_cache_update',
  EXTRACT_EMBEDDINGS = 'extract_embeddings',
  CONTENT_MODERATION = 'content_moderation',

  // Export Tasks
  EXPORT_PDF = 'export_pdf',
  EXPORT_EPUB = 'export_epub',

  // Curriculum Tasks
  GENERATE_CURRICULUM = 'generate_curriculum',
  ALIGN_STANDARDS = 'align_standards',

  // Maintenance Tasks
  CLEANUP_ORPHANED_ASSETS = 'cleanup_orphaned_assets',
  REGENERATE_CACHE = 'regenerate_cache',
}

export enum JobStatus {
  PENDING = 'pending',
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

export enum JobPriority {
  CRITICAL = 1, // System maintenance, error recovery
  HIGH = 2, // Paid tier users
  NORMAL = 3, // Free tier users
  LOW = 4, // Background tasks
  BATCH = 5, // Bulk operations
}

// ============================================================================
// JOB DEFINITIONS
// ============================================================================

export interface BaseJobData {
  userId: string;
  userTier: string;
  requestId: string;
  createdAt: string;
}

export interface GenerateBookJobData extends BaseJobData {
  topic: string;
  ageRange: string;
  artStyle: string;
  pageCount: number;
  characters?: Array<{
    name: string;
    description: string;
  }>;
  customInstructions?: string;
}

export interface GeneratePageImageJobData extends BaseJobData {
  bookId: string;
  chapterIndex: number;
  pageIndex: number;
  prompt: string;
  artStyle: string;
  characterReferences?: string[];
}

export interface OptimizeImageJobData extends BaseJobData {
  sourceUrl: string;
  targetPath: string;
  formats: ('webp' | 'avif' | 'jpeg')[];
  sizes: number[]; // widths
  quality: number;
}

export interface ExportPDFJobData extends BaseJobData {
  bookId: string;
  includeMetadata: boolean;
  pageSize: 'A4' | 'Letter' | 'Custom';
  orientation: 'portrait' | 'landscape';
}

export interface GenerateCurriculumJobData extends BaseJobData {
  subject: string;
  gradeLevel: string;
  standards: string[];
  duration: string;
  learningObjectives: string[];
}

export type JobData =
  | GenerateBookJobData
  | GeneratePageImageJobData
  | OptimizeImageJobData
  | ExportPDFJobData
  | GenerateCurriculumJobData;

// ============================================================================
// JOB RESULT TYPES
// ============================================================================

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metrics?: {
    processingTimeMs: number;
    aiTokensUsed?: number;
    aiCostUsd?: number;
    retryCount: number;
  };
}

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  progress: number; // 0-100
  stage: string;
  message: string;
  result?: JobResult;
  error?: string;
  estimatedTimeRemainingMs?: number;
  startedAt?: string;
  updatedAt: string;
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  backoffType: 'exponential' | 'linear';
  rateLimit?: {
    max: number;
    duration: number; // ms
  };
  timeout?: number;
}

export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  [JobType.GENERATE_BOOK]: {
    name: 'book-generation',
    concurrency: 5,
    maxRetries: 3,
    retryDelay: 5000,
    backoffType: 'exponential',
    timeout: 300000, // 5 minutes
    rateLimit: {
      max: 100,
      duration: 60000, // 100 per minute
    },
  },

  [JobType.GENERATE_PAGE_IMAGE]: {
    name: 'image-generation',
    concurrency: 10,
    maxRetries: 5,
    retryDelay: 2000,
    backoffType: 'exponential',
    timeout: 120000, // 2 minutes
    rateLimit: {
      max: 500,
      duration: 60000, // 500 per minute (Imagen quota)
    },
  },

  [JobType.OPTIMIZE_IMAGE]: {
    name: 'image-optimization',
    concurrency: 20,
    maxRetries: 2,
    retryDelay: 1000,
    backoffType: 'linear',
    timeout: 30000, // 30 seconds
  },

  [JobType.EXPORT_PDF]: {
    name: 'export',
    concurrency: 10,
    maxRetries: 2,
    retryDelay: 3000,
    backoffType: 'exponential',
    timeout: 180000, // 3 minutes
  },

  [JobType.GENERATE_CURRICULUM]: {
    name: 'curriculum',
    concurrency: 5,
    maxRetries: 3,
    retryDelay: 5000,
    backoffType: 'exponential',
    timeout: 300000, // 5 minutes
  },

  [JobType.SEMANTIC_CACHE_UPDATE]: {
    name: 'cache-maintenance',
    concurrency: 50,
    maxRetries: 1,
    retryDelay: 1000,
    backoffType: 'linear',
    timeout: 10000, // 10 seconds
  },
};

// ============================================================================
// JOB QUEUE CLIENT (Browser-compatible)
// ============================================================================

/**
 * Job Queue Client for browser/frontend use.
 * Communicates with backend job queue via REST API.
 */
export class JobQueueClient {
  private readonly apiBase: string;
  private readonly progressPollers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private readonly streamTokens: Map<string, string> = new Map();

  constructor(apiBase = '/api/jobs') {
    this.apiBase = apiBase;
  }

  /**
   * Submit a job to the queue
   */
  async submitJob<T extends JobData>(
    type: JobType,
    data: T,
    options?: {
      priority?: JobPriority;
      delay?: number;
      deduplicate?: boolean;
    }
  ): Promise<{ jobId: string; position: number; streamToken: string }> {
    const response = await authenticatedFetch(`${this.apiBase}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        data,
        priority: options?.priority ?? JobPriority.NORMAL,
        delay: options?.delay,
        deduplicate: options?.deduplicate ?? true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit job');
    }

    const payload = await response.json();
    if (payload?.jobId && payload?.streamToken) {
      this.streamTokens.set(payload.jobId, payload.streamToken);
    }

    return payload;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobProgress> {
    const response = await authenticatedFetch(`${this.apiBase}/${jobId}/status`);

    if (!response.ok) {
      throw new Error('Failed to get job status');
    }

    return response.json();
  }

  /**
   * Subscribe to job progress updates via authenticated polling.
   * Native EventSource cannot send Authorization headers.
   */
  subscribeToProgress(
    jobId: string,
    onProgress: (progress: JobProgress) => void,
    onComplete: (result: JobResult) => void,
    onError: (error: Error) => void
  ): () => void {
    // Close existing subscription for this job
    this.unsubscribeFromProgress(jobId);

    let inFlight = false;
    const poll = async (): Promise<void> => {
      if (inFlight) return;
      inFlight = true;
      try {
        const progress = await this.getJobStatus(jobId);
        onProgress(progress);

        if (progress.status === 'completed' && progress.result) {
          onComplete(progress.result);
          this.unsubscribeFromProgress(jobId);
          return;
        }

        if (progress.status === JobStatus.FAILED) {
          const message = progress.error || `Job ${progress.status}`;
          onError(new Error(message));
          this.unsubscribeFromProgress(jobId);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to poll job progress');
        onError(err);
        this.unsubscribeFromProgress(jobId);
      } finally {
        inFlight = false;
      }
    };

    // Poll immediately, then at an interval.
    void poll();
    const poller = setInterval(() => {
      void poll();
    }, 1500);

    this.progressPollers.set(jobId, poller);

    // Return unsubscribe function
    return () => this.unsubscribeFromProgress(jobId);
  }

  /**
   * Unsubscribe from job progress
   */
  unsubscribeFromProgress(jobId: string): void {
    const poller = this.progressPollers.get(jobId);
    if (poller) {
      clearInterval(poller);
      this.progressPollers.delete(jobId);
    }
    this.streamTokens.delete(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const response = await authenticatedFetch(`${this.apiBase}/${jobId}/cancel`, {
      method: 'POST',
    });

    return response.ok;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const response = await authenticatedFetch(`${this.apiBase}/stats`);

    if (!response.ok) {
      throw new Error('Failed to get queue stats');
    }

    return response.json();
  }

  /**
   * Cleanup subscriptions
   */
  dispose(): void {
    for (const jobId of this.progressPollers.keys()) {
      this.unsubscribeFromProgress(jobId);
    }
  }
}

// ============================================================================
// REACT HOOK FOR JOB MANAGEMENT
// ============================================================================

export interface UseJobQueueOptions {
  apiBase?: string;
  autoCleanup?: boolean;
}

export interface JobQueueHookResult {
  submitJob: <T extends JobData>(type: JobType, data: T) => Promise<string>;
  getStatus: (jobId: string) => Promise<JobProgress>;
  cancelJob: (jobId: string) => Promise<boolean>;
  subscribeToProgress: (
    jobId: string,
    callbacks: {
      onProgress?: (progress: JobProgress) => void;
      onComplete?: (result: JobResult) => void;
      onError?: (error: Error) => void;
    }
  ) => () => void;
}

/**
 * Creates a job queue hook for React components.
 *
 * Usage:
 * ```tsx
 * const { submitJob, subscribeToProgress } = useJobQueue();
 *
 * const handleCreateBook = async () => {
 *   const jobId = await submitJob(JobType.GENERATE_BOOK, { ... });
 *
 *   subscribeToProgress(jobId, {
 *     onProgress: (p) => setProgress(p.progress),
 *     onComplete: (r) => setBook(r.data),
 *     onError: (e) => setError(e.message),
 *   });
 * };
 * ```
 */
export function createJobQueueHook(options: UseJobQueueOptions = {}): JobQueueHookResult {
  const client = new JobQueueClient(options.apiBase);

  return {
    submitJob: async <T extends JobData>(type: JobType, data: T) => {
      const result = await client.submitJob(type, data);
      return result.jobId;
    },

    getStatus: (jobId: string) => client.getJobStatus(jobId),

    cancelJob: (jobId: string) => client.cancelJob(jobId),

    subscribeToProgress: (jobId, callbacks) => {
      return client.subscribeToProgress(
        jobId,
        callbacks.onProgress ?? (() => {}),
        callbacks.onComplete ?? (() => {}),
        callbacks.onError ?? (() => {})
      );
    },
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const jobQueue = new JobQueueClient();
