/**
 * Job Queue API Endpoint
 *
 * Handles job submission, status queries, and progress streaming.
 * Designed to work with Vercel Edge Functions.
 *
 * Endpoints:
 * - POST /api/jobs/submit - Submit a new job
 * - GET /api/jobs/:id/status - Get job status
 * - GET /api/jobs/:id/stream - SSE progress stream
 * - POST /api/jobs/:id/cancel - Cancel a job
 * - GET /api/jobs/stats - Queue statistics
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// TYPES
// ============================================================================

interface JobSubmission {
  type: string;
  data: Record<string, unknown>;
  priority?: number;
  delay?: number;
  deduplicate?: boolean;
}

interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  stage: string;
  message: string;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ============================================================================
// IN-MEMORY JOB STORE (Replace with Redis in production)
// ============================================================================

const jobs = new Map<
  string,
  {
    id: string;
    type: string;
    data: Record<string, unknown>;
    status: JobStatusResponse['status'];
    progress: number;
    stage: string;
    message: string;
    result?: unknown;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    priority: number;
  }
>();

const progressSubscribers = new Map<string, Set<(data: unknown) => void>>();

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleSubmit(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const body = req.body as JobSubmission;

    // Validate required fields
    if (!body.type) {
      res.status(400).json({ error: 'Job type is required' });
      return;
    }

    if (!body.data) {
      res.status(400).json({ error: 'Job data is required' });
      return;
    }

    const jobId = generateJobId();
    const now = new Date();

    // Create job
    const job = {
      id: jobId,
      type: body.type,
      data: body.data,
      status: 'pending' as const,
      progress: 0,
      stage: 'queued',
      message: 'Job queued',
      createdAt: now,
      updatedAt: now,
      priority: body.priority ?? 3,
    };

    jobs.set(jobId, job);

    // Calculate queue position
    const position = Array.from(jobs.values()).filter(
      (j) => j.status === 'pending' || j.status === 'waiting'
    ).length;

    // In production, this would push to BullMQ
    // For now, simulate job processing
    simulateJobProcessing(jobId);

    res.status(202).json({
      jobId,
      position,
      estimatedWaitMs: position * 5000,
    });
  } catch (error) {
    console.error('[Jobs API] Submit error:', error);
    res.status(500).json({ error: 'Failed to submit job' });
  }
}

async function handleStatus(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const jobId = req.query.id as string;

    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    const job = jobs.get(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const response: JobStatusResponse = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Jobs API] Status error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
}

async function handleStream(req: VercelRequest, res: VercelResponse): Promise<void> {
  const jobId = req.query.id as string;

  if (!jobId) {
    res.status(400).json({ error: 'Job ID is required' });
    return;
  }

  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial status
  const sendEvent = (type: string, payload: unknown) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  sendEvent('progress', {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    message: job.message,
    updatedAt: job.updatedAt.toISOString(),
  });

  // Subscribe to updates
  if (!progressSubscribers.has(jobId)) {
    progressSubscribers.set(jobId, new Set());
  }

  const subscriber = (data: unknown) => {
    sendEvent('progress', data);

    const jobData = data as JobStatusResponse;
    if (jobData.status === 'completed') {
      sendEvent('complete', { result: jobs.get(jobId)?.result });
    } else if (jobData.status === 'failed') {
      sendEvent('error', { message: jobs.get(jobId)?.error });
    }
  };

  progressSubscribers.get(jobId)!.add(subscriber);

  // Cleanup on close
  req.on('close', () => {
    progressSubscribers.get(jobId)?.delete(subscriber);
    if (progressSubscribers.get(jobId)?.size === 0) {
      progressSubscribers.delete(jobId);
    }
    res.end();
  });
}

async function handleCancel(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const jobId = req.query.id as string;

    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    const job = jobs.get(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      res.status(400).json({ error: 'Cannot cancel finished job' });
      return;
    }

    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.updatedAt = new Date();

    // Notify subscribers
    notifySubscribers(jobId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Jobs API] Cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
}

async function handleStats(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const stats: QueueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };

    for (const job of jobs.values()) {
      switch (job.status) {
        case 'pending':
        case 'waiting':
          stats.waiting++;
          break;
        case 'active':
          stats.active++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'delayed':
          stats.delayed++;
          break;
      }
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('[Jobs API] Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

// ============================================================================
// JOB SIMULATION (Replace with actual BullMQ worker in production)
// ============================================================================

function simulateJobProcessing(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;

  const stages = [
    { progress: 10, stage: 'initializing', message: 'Setting up generation...' },
    { progress: 25, stage: 'generating_text', message: 'Writing story content...' },
    { progress: 50, stage: 'generating_images', message: 'Creating illustrations...' },
    { progress: 75, stage: 'optimizing', message: 'Optimizing assets...' },
    { progress: 90, stage: 'saving', message: 'Saving to database...' },
    { progress: 100, stage: 'complete', message: 'Generation complete!' },
  ];

  let stageIndex = 0;

  const processStage = () => {
    if (job.status === 'failed') return; // Cancelled

    const stage = stages[stageIndex];
    job.status = 'active';
    job.progress = stage.progress;
    job.stage = stage.stage;
    job.message = stage.message;
    job.updatedAt = new Date();

    notifySubscribers(jobId);

    stageIndex++;

    if (stageIndex < stages.length) {
      // Simulate processing time (1-3 seconds per stage)
      setTimeout(processStage, 1000 + Math.random() * 2000);
    } else {
      // Job complete
      job.status = 'completed';
      job.result = {
        bookId: `book_${Date.now()}`,
        title: job.data.topic as string,
        pageCount: job.data.pageCount as number,
        coverUrl: 'https://placeholder.com/cover.jpg',
      };

      notifySubscribers(jobId);
    }
  };

  // Start processing after a short delay
  setTimeout(() => {
    job.status = 'waiting';
    job.message = 'Waiting for worker...';
    job.updatedAt = new Date();
    notifySubscribers(jobId);

    setTimeout(processStage, 500);
  }, 100);
}

function notifySubscribers(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;

  const subscribers = progressSubscribers.get(jobId);
  if (!subscribers) return;

  const data: JobStatusResponse = {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    message: job.message,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  for (const subscriber of subscribers) {
    subscriber(data);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS headers — restrict to app origin in production
  const allowedOrigin = process.env.ALLOWED_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.url?.replace('/api/jobs', '') || '';

  // Route requests
  if (req.method === 'POST' && path === '/submit') {
    return handleSubmit(req, res);
  }

  if (req.method === 'GET' && path.match(/^\/[^/]+\/status$/)) {
    req.query.id = path.split('/')[1];
    return handleStatus(req, res);
  }

  if (req.method === 'GET' && path.match(/^\/[^/]+\/stream$/)) {
    req.query.id = path.split('/')[1];
    return handleStream(req, res);
  }

  if (req.method === 'POST' && path.match(/^\/[^/]+\/cancel$/)) {
    req.query.id = path.split('/')[1];
    return handleCancel(req, res);
  }

  if (req.method === 'GET' && path === '/stats') {
    return handleStats(req, res);
  }

  res.status(404).json({ error: 'Not found' });
}
