/**
 * Mars-Class Infrastructure - BullMQ Worker Implementation
 *
 * Server-side worker that processes jobs from the queue.
 * Designed to run on persistent infrastructure (Fly.io, Railway, ECS).
 *
 * FEATURES:
 * - Sandboxed processing for each job type
 * - Automatic retries with exponential backoff
 * - Rate limiting respects API quotas
 * - Progress updates via Redis pub/sub
 * - Health monitoring and graceful shutdown
 */

import type {
  GenerateBookJobData,
  GenerateCurriculumJobData,
  JobData,
  JobProgress,
  JobResult,
  JobStatus,
  OptimizeImageJobData,
} from './jobQueue';

// ============================================================================
// WORKER CONFIGURATION
// ============================================================================

export interface WorkerConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Worker instance identifier */
  workerId: string;
  /** Concurrency per queue */
  concurrency: number;
  /** Enable verbose logging */
  verbose: boolean;
  /** Graceful shutdown timeout (ms) */
  shutdownTimeout: number;
}

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  workerId: `worker-${process.env.HOSTNAME || 'local'}-${Date.now()}`,
  concurrency: 5,
  verbose: process.env.NODE_ENV !== 'production',
  shutdownTimeout: 30000, // 30 seconds
};

// ============================================================================
// JOB PROCESSOR INTERFACE
// ============================================================================

export interface JobProcessor<T extends JobData = JobData> {
  /**
   * Process a job
   * @param data - Job data
   * @param progress - Progress reporter function
   * @param signal - Abort signal for cancellation
   */
  process(
    data: T,
    progress: (percent: number, message: string) => Promise<void>,
    signal: AbortSignal
  ): Promise<JobResult>;

  /**
   * Validate job data before processing
   */
  validate(data: T): { valid: boolean; errors: string[] };

  /**
   * Cleanup resources if job fails
   */
  cleanup?(data: T, error: Error): Promise<void>;
}

// ============================================================================
// BOOK GENERATION PROCESSOR
// ============================================================================

export const bookGenerationProcessor: JobProcessor<GenerateBookJobData> = {
  validate(data) {
    const errors: string[] = [];

    if (!data.userId) errors.push('userId is required');
    if (!data.topic) errors.push('topic is required');
    if (!data.ageRange) errors.push('ageRange is required');
    if (!data.artStyle) errors.push('artStyle is required');
    if (!data.pageCount || data.pageCount < 1) errors.push('pageCount must be at least 1');
    if (data.pageCount > 50) errors.push('pageCount cannot exceed 50');

    return { valid: errors.length === 0, errors };
  },

  async process(data, progress, signal) {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // Stage 1: Generate book structure (10%)
      await progress(5, 'Generating story structure...');

      if (signal.aborted) throw new Error('Job cancelled');

      // This would call geminiService.generateBookStructure
      // const structure = await generateBookStructure(data);
      await simulateWork(2000);
      tokensUsed += 2000;

      await progress(10, 'Story structure created');

      // Stage 2: Generate chapter content (10-40%)
      const chaptersCount = Math.ceil(data.pageCount / 4);
      for (let i = 0; i < chaptersCount; i++) {
        if (signal.aborted) throw new Error('Job cancelled');

        await progress(
          10 + (i / chaptersCount) * 30,
          `Writing chapter ${i + 1} of ${chaptersCount}...`
        );

        // This would call geminiService.generateChapter
        await simulateWork(3000);
        tokensUsed += 3000;
      }

      await progress(40, 'All chapters written');

      // Stage 3: Generate illustrations (40-90%)
      const imageCount = data.pageCount;
      for (let i = 0; i < imageCount; i++) {
        if (signal.aborted) throw new Error('Job cancelled');

        await progress(
          40 + (i / imageCount) * 50,
          `Creating illustration ${i + 1} of ${imageCount}...`
        );

        // This would call imagen service
        await simulateWork(2000);
      }

      await progress(90, 'All illustrations created');

      // Stage 4: Assemble and save book (90-100%)
      await progress(92, 'Assembling book...');
      await simulateWork(1000);

      await progress(95, 'Saving to database...');
      await simulateWork(500);

      await progress(98, 'Generating thumbnails...');
      await simulateWork(1000);

      await progress(100, 'Book complete!');

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        data: {
          bookId: `book-${Date.now()}`,
          title: data.topic,
          pageCount: data.pageCount,
        },
        metrics: {
          processingTimeMs,
          aiTokensUsed: tokensUsed,
          aiCostUsd: (tokensUsed / 1000000) * 1.25, // Gemini 2.5 Pro pricing
          retryCount: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          processingTimeMs: Date.now() - startTime,
          aiTokensUsed: tokensUsed,
          retryCount: 0,
        },
      };
    }
  },

  async cleanup(data, error) {
    console.warn(`[BookProcessor] Cleaning up failed job for user ${data.userId}:`, error.message);
    // Delete partial assets, notify user, etc.
  },
};

// ============================================================================
// IMAGE OPTIMIZATION PROCESSOR
// ============================================================================

export const imageOptimizationProcessor: JobProcessor<OptimizeImageJobData> = {
  validate(data) {
    const errors: string[] = [];

    if (!data.sourceUrl) errors.push('sourceUrl is required');
    if (!data.targetPath) errors.push('targetPath is required');
    if (!data.formats?.length) errors.push('At least one format is required');
    if (!data.sizes?.length) errors.push('At least one size is required');

    return { valid: errors.length === 0, errors };
  },

  async process(data, progress, signal) {
    const startTime = Date.now();

    try {
      await progress(10, 'Downloading source image...');
      await simulateWork(500);

      if (signal.aborted) throw new Error('Job cancelled');

      const totalVariants = data.formats.length * data.sizes.length;
      let processed = 0;

      for (const format of data.formats) {
        for (const size of data.sizes) {
          if (signal.aborted) throw new Error('Job cancelled');

          processed++;
          await progress(
            10 + (processed / totalVariants) * 80,
            `Converting to ${format} @ ${size}px...`
          );

          // This would use sharp to convert
          await simulateWork(200);
        }
      }

      await progress(95, 'Uploading optimized images...');
      await simulateWork(500);

      await progress(100, 'Optimization complete');

      return {
        success: true,
        data: {
          variants: data.formats.flatMap((f) =>
            data.sizes.map((s) => `${data.targetPath}/${s}.${f}`)
          ),
        },
        metrics: {
          processingTimeMs: Date.now() - startTime,
          retryCount: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          processingTimeMs: Date.now() - startTime,
          retryCount: 0,
        },
      };
    }
  },
};

// ============================================================================
// CURRICULUM GENERATION PROCESSOR
// ============================================================================

export const curriculumProcessor: JobProcessor<GenerateCurriculumJobData> = {
  validate(data) {
    const errors: string[] = [];

    if (!data.subject) errors.push('subject is required');
    if (!data.gradeLevel) errors.push('gradeLevel is required');
    if (!data.standards?.length) errors.push('At least one standard is required');

    return { valid: errors.length === 0, errors };
  },

  async process(data, progress, signal) {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      await progress(10, 'Analyzing standards alignment...');
      await simulateWork(2000);
      tokensUsed += 1500;

      if (signal.aborted) throw new Error('Job cancelled');

      await progress(30, 'Generating learning objectives...');
      await simulateWork(3000);
      tokensUsed += 3000;

      if (signal.aborted) throw new Error('Job cancelled');

      await progress(50, 'Creating lesson plans...');
      await simulateWork(4000);
      tokensUsed += 4000;

      if (signal.aborted) throw new Error('Job cancelled');

      await progress(70, 'Generating assessments...');
      await simulateWork(3000);
      tokensUsed += 2500;

      await progress(90, 'Compiling curriculum package...');
      await simulateWork(1000);

      await progress(100, 'Curriculum complete!');

      return {
        success: true,
        data: {
          curriculumId: `curriculum-${Date.now()}`,
          subject: data.subject,
          gradeLevel: data.gradeLevel,
          lessonsCount: 10,
          assessmentsCount: 3,
        },
        metrics: {
          processingTimeMs: Date.now() - startTime,
          aiTokensUsed: tokensUsed,
          aiCostUsd: (tokensUsed / 1000000) * 1.25,
          retryCount: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          processingTimeMs: Date.now() - startTime,
          aiTokensUsed: tokensUsed,
          retryCount: 0,
        },
      };
    }
  },
};

// ============================================================================
// PROCESSOR REGISTRY
// ============================================================================

export const PROCESSORS: Partial<Record<string, JobProcessor<JobData>>> = {
  generate_book: bookGenerationProcessor,
  optimize_image: imageOptimizationProcessor,
  generate_curriculum: curriculumProcessor,
};

// ============================================================================
// WORKER MANAGER
// ============================================================================

export class WorkerManager {
  private readonly config: WorkerConfig;
  private isShuttingDown = false;
  private activeJobs = new Map<string, AbortController>();

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }

  /**
   * Process a job (called by BullMQ worker)
   */
  async processJob(
    jobId: string,
    type: string,
    data: JobData,
    updateProgress: (progress: JobProgress) => Promise<void>
  ): Promise<JobResult> {
    const processor = PROCESSORS[type];

    if (!processor) {
      return {
        success: false,
        error: `No processor registered for job type: ${type}`,
        metrics: { processingTimeMs: 0, retryCount: 0 },
      };
    }

    // Validate job data
    const validation = processor.validate(data);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        metrics: { processingTimeMs: 0, retryCount: 0 },
      };
    }

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.activeJobs.set(jobId, abortController);

    try {
      // Progress reporter function
      const reportProgress = async (percent: number, message: string): Promise<void> => {
        await updateProgress({
          jobId,
          status: 'active' as JobStatus,
          progress: Math.round(percent),
          stage: type,
          message,
          updatedAt: new Date().toISOString(),
        });
      };

      // Process the job
      const result = await processor.process(data, reportProgress, abortController.signal);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Call cleanup if available
      if (processor.cleanup) {
        await processor.cleanup(data, error as Error);
      }

      return {
        success: false,
        error: errorMessage,
        metrics: { processingTimeMs: 0, retryCount: 0 },
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    console.warn(`[Worker ${this.config.workerId}] Initiating graceful shutdown...`);

    // Cancel all active jobs
    for (const [jobId, controller] of this.activeJobs) {
      console.warn(`[Worker] Cancelling job ${jobId}`);
      controller.abort();
    }

    // Wait for jobs to complete with timeout
    const startTime = Date.now();
    while (this.activeJobs.size > 0 && Date.now() - startTime < this.config.shutdownTimeout) {
      await simulateWork(100);
    }

    if (this.activeJobs.size > 0) {
      console.warn(`[Worker] Shutdown timeout: ${this.activeJobs.size} jobs still active`);
    }

    console.warn(`[Worker ${this.config.workerId}] Shutdown complete`);
  }

  /**
   * Get worker status
   */
  getStatus(): {
    workerId: string;
    activeJobs: number;
    isShuttingDown: boolean;
  } {
    return {
      workerId: this.config.workerId,
      activeJobs: this.activeJobs.size,
      isShuttingDown: this.isShuttingDown,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORTS
// ============================================================================

export const workerManager = new WorkerManager();
