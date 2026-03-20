/**
 * Mars-Class Infrastructure React Hooks
 *
 * Provides React integration for the Mars-Class scaling infrastructure.
 *
 * Hooks:
 * - useJobQueue: Submit and track async jobs
 * - useSemanticCache: AI response caching
 * - useOptimizedImage: Responsive image loading
 * - useTracing: Manual span creation
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type JobData,
  type JobPriority,
  JobQueueClient,
  JobType,
} from '../services/infrastructure/jobQueue';
import {
  AssetCategory,
  type OptimizedAsset,
  R2StorageClient,
} from '../services/infrastructure/r2Storage';
import type {
  CacheContext,
  CacheStats,
  SemanticCacheService,
} from '../services/infrastructure/semanticCache';
import { type SpanContext, SpanKind, type Tracer } from '../services/infrastructure/tracing';

// Job status type inline to avoid import issues
type JobStatusType = 'pending' | 'active' | 'completed' | 'failed' | 'delayed';

// ============================================================================
// JOB QUEUE HOOK
// ============================================================================

export interface UseJobQueueOptions {
  apiBase?: string;
  onError?: (error: Error) => void;
}

export interface JobState {
  jobId: string | null;
  status: JobStatusType | null;
  progress: number;
  message: string;
  result: unknown | null;
  error: string | null;
  isLoading: boolean;
}

export function useJobQueue(options: UseJobQueueOptions = {}) {
  const clientRef = useRef<JobQueueClient | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [state, setState] = useState<JobState>({
    jobId: null,
    status: null,
    progress: 0,
    message: '',
    result: null,
    error: null,
    isLoading: false,
  });

  // Initialize client
  useEffect(() => {
    clientRef.current = new JobQueueClient(options.apiBase);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      clientRef.current?.dispose();
    };
  }, [options.apiBase]);

  const submitJob = useCallback(
    async <T extends JobData>(type: JobType, data: T, priority?: JobPriority): Promise<string> => {
      if (!clientRef.current) {
        throw new Error('Job queue client not initialized');
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        progress: 0,
        message: 'Submitting job...',
      }));

      try {
        const { jobId } = await clientRef.current.submitJob(type, data, { priority });

        setState((prev) => ({
          ...prev,
          jobId,
          status: 'pending',
          message: 'Job queued',
        }));

        // Subscribe to progress
        unsubscribeRef.current = clientRef.current.subscribeToProgress(
          jobId,
          (progressData) => {
            setState((prev) => ({
              ...prev,
              status: progressData.status as JobStatusType,
              progress: progressData.progress,
              message: progressData.message,
            }));
          },
          (result) => {
            setState((prev) => ({
              ...prev,
              status: 'completed',
              progress: 100,
              message: 'Complete',
              result: result.data,
              isLoading: false,
            }));
          },
          (error) => {
            setState((prev) => ({
              ...prev,
              status: 'failed',
              error: error.message,
              isLoading: false,
            }));
            options.onError?.(error);
          }
        );

        return jobId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        throw error;
      }
    },
    [options]
  );

  const cancelJob = useCallback(async () => {
    if (!clientRef.current || !state.jobId) return false;

    const success = await clientRef.current.cancelJob(state.jobId);

    if (success) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'Cancelled',
        isLoading: false,
      }));
    }

    return success;
  }, [state.jobId]);

  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setState({
      jobId: null,
      status: null,
      progress: 0,
      message: '',
      result: null,
      error: null,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    submitJob,
    cancelJob,
    reset,
  };
}

// ============================================================================
// BOOK GENERATION HOOK (Specialized for book creation)
// ============================================================================

export interface BookGenerationState {
  isGenerating: boolean;
  progress: number;
  stage: string;
  book: unknown | null;
  error: string | null;
}

export function useBookGeneration() {
  const { submitJob, cancelJob, progress, message, result, error, isLoading } = useJobQueue();

  const generateBook = useCallback(
    async (params: {
      topic: string;
      ageRange: string;
      artStyle: string;
      pageCount: number;
      userId: string;
      userTier: string;
      characters?: Array<{ name: string; description: string }>;
      customInstructions?: string;
    }) => {
      return submitJob(JobType.GENERATE_BOOK, {
        ...params,
        requestId: `book-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
    },
    [submitJob]
  );

  return {
    generateBook,
    cancelGeneration: cancelJob,
    isGenerating: isLoading,
    progress,
    stage: message,
    book: result,
    error,
  };
}

// ============================================================================
// SEMANTIC CACHE HOOK
// ============================================================================

export interface UseSemanticCacheOptions {
  context?: CacheContext;
}

export function useSemanticCache(options: UseSemanticCacheOptions = {}) {
  const cacheRef = useRef<SemanticCacheService | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);

  useEffect(() => {
    // Import dynamically to avoid SSR issues
    import('../services/infrastructure/semanticCache').then(({ semanticCache }) => {
      cacheRef.current = semanticCache;
      setStats(semanticCache.getStats());
    });
  }, []);

  const query = useCallback(
    async (
      question: string,
      aiCall: (q: string) => Promise<string>
    ): Promise<{ response: string; fromCache: boolean }> => {
      if (!cacheRef.current) {
        const response = await aiCall(question);
        return { response, fromCache: false };
      }

      // Try cache first
      const cached = await cacheRef.current.get(question, options.context);

      if (cached?.cacheHit) {
        setStats(cacheRef.current.getStats());
        return { response: cached.response, fromCache: true };
      }

      // Cache miss - call AI
      const response = await aiCall(question);

      // Store in cache (fire and forget)
      cacheRef.current.set(question, response, options.context).catch(console.error);

      setStats(cacheRef.current.getStats());
      return { response, fromCache: false };
    },
    [options.context]
  );

  return {
    query,
    stats,
    hitRate: stats?.hitRate ?? 0,
    costSavings: stats?.estimatedCostSavings ?? 0,
  };
}

// ============================================================================
// OPTIMIZED IMAGE HOOK
// ============================================================================

export interface UseOptimizedImageOptions {
  lazyLoad?: boolean;
  placeholder?: boolean;
  priority?: boolean;
}

export function useOptimizedImage(
  src: string | OptimizedAsset | null,
  _options: UseOptimizedImageOptions = {}
) {
  const [asset, setAsset] = useState<OptimizedAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportedFormats, setSupportedFormats] = useState<Set<string>>(new Set(['jpeg', 'png']));

  // Detect supported formats
  useEffect(() => {
    import('../services/infrastructure/mediaOptimizer').then(({ detectSupportedFormats }) => {
      detectSupportedFormats().then(setSupportedFormats);
    });
  }, []);

  // Load asset
  useEffect(() => {
    if (!src) {
      setAsset(null);
      setIsLoading(false);
      return;
    }

    // If already an OptimizedAsset, use directly
    if (typeof src !== 'string') {
      setAsset(src);
      setIsLoading(false);
      return;
    }

    // Load from R2
    setIsLoading(true);
    setError(null);

    const storageClient = new R2StorageClient();

    storageClient
      .getWithVariants(src)
      .then((result) => {
        if (result) {
          setAsset(result);
        } else {
          // Fallback: create simple asset from URL
          setAsset({
            key: src,
            url: src,
            directUrl: src,
            contentType: 'image/jpeg',
            size: 0,
            etag: '',
            uploadedAt: new Date(),
            metadata: {},
            variants: [],
          });
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [src]);

  // Generate optimized src and srcSet
  const getOptimalSrc = useCallback(
    (viewportWidth: number) => {
      if (!asset) return '';

      if (asset.variants.length === 0) return asset.url;

      // Format priority based on support
      const formatPriority = supportedFormats.has('avif')
        ? ['avif', 'webp', 'jpeg']
        : supportedFormats.has('webp')
          ? ['webp', 'jpeg']
          : ['jpeg'];

      for (const format of formatPriority) {
        const candidates = asset.variants
          .filter((v) => v.format === format)
          .sort((a, b) => a.width - b.width);

        // Find smallest variant >= viewport width * 2 (for retina)
        const targetWidth = viewportWidth * 2;
        const match = candidates.find((v) => v.width >= targetWidth);
        if (match) return match.url;

        // Fall back to largest
        if (candidates.length > 0) {
          return candidates[candidates.length - 1].url;
        }
      }

      return asset.url;
    },
    [asset, supportedFormats]
  );

  const getSrcSet = useCallback(() => {
    if (!asset || asset.variants.length === 0) return '';

    // Prefer WebP for srcset
    const format = supportedFormats.has('webp') ? 'webp' : 'jpeg';

    return asset.variants
      .filter((v) => v.format === format)
      .map((v) => `${v.url} ${v.width}w`)
      .join(', ');
  }, [asset, supportedFormats]);

  return {
    asset,
    isLoading,
    error,
    src: asset?.url ?? '',
    srcSet: getSrcSet(),
    getOptimalSrc,
    supportsWebP: supportedFormats.has('webp'),
    supportsAvif: supportedFormats.has('avif'),
  };
}

// ============================================================================
// UPLOAD HOOK
// ============================================================================

export interface UseUploadOptions {
  category?: AssetCategory;
  onProgress?: (percent: number) => void;
  optimize?: boolean;
}

export function useUpload(userId: string, options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<OptimizedAsset | null> => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        const storageClient = new R2StorageClient();

        // Upload to R2
        setProgress(10);
        const asset = await storageClient.upload(file, {
          userId,
          category: options.category,
        });

        setProgress(50);

        // If optimization requested, trigger media optimizer
        if (options.optimize) {
          const { mediaOptimizer } = await import('../services/infrastructure/mediaOptimizer');

          const result = await mediaOptimizer.optimizeAndWait(
            asset.url,
            options.category === AssetCategory.BOOK_COVERS ? 'cover' : 'illustration',
            (p) => setProgress(50 + p * 0.5)
          );

          setProgress(100);
          setIsUploading(false);

          return {
            ...asset,
            variants: result.variants.map((v) => ({
              id: `${v.format}_${v.width}`,
              format: v.format,
              width: v.width,
              height: v.height,
              url: v.url,
              size: v.size,
              quality: 85,
            })),
          };
        }

        setProgress(100);
        setIsUploading(false);

        return {
          ...asset,
          variants: [],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setIsUploading(false);
        return null;
      }
    },
    [userId, options.category, options.optimize]
  );

  return {
    upload,
    isUploading,
    progress,
    error,
  };
}

// ============================================================================
// TRACING HOOK
// ============================================================================

export function useTracing(componentName: string) {
  const tracerRef = useRef<Tracer | null>(null);
  const mountSpanRef = useRef<SpanContext | null>(null);

  useEffect(() => {
    import('../services/infrastructure/tracing').then(({ tracer }) => {
      tracerRef.current = tracer;

      // Track component mount
      const span = tracer.startSpan(`${componentName}.mount`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          'component.name': componentName,
        },
      });

      mountSpanRef.current = span.getContext();
      tracer.endSpan(span);
    });

    return () => {
      // Track component unmount
      if (tracerRef.current) {
        const span = tracerRef.current.startSpan(`${componentName}.unmount`, {
          parent: mountSpanRef.current ?? undefined,
        });
        tracerRef.current.endSpan(span);
      }
    };
  }, [componentName]);

  const trace = useCallback(
    async <T>(
      operationName: string,
      fn: () => Promise<T>,
      attributes?: Record<string, string | number | boolean>
    ): Promise<T> => {
      if (!tracerRef.current) {
        return fn();
      }

      return tracerRef.current.trace(
        `${componentName}.${operationName}`,
        async (span) => {
          if (attributes) {
            span.setAttributes(attributes);
          }
          return fn();
        },
        { parent: mountSpanRef.current ?? undefined }
      );
    },
    [componentName]
  );

  return { trace };
}

// ============================================================================
// INFRASTRUCTURE HEALTH HOOK
// ============================================================================

export function useInfrastructureHealth(pollInterval = 30000) {
  const [health, setHealth] = useState<{
    status: 'healthy' | 'degraded' | 'unhealthy' | 'loading';
    services: Record<string, { healthy: boolean; details: Record<string, unknown> }>;
    lastChecked: Date | null;
  }>({
    status: 'loading',
    services: {},
    lastChecked: null,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { getInfrastructureHealth } = await import('../services/infrastructure');
        const result = await getInfrastructureHealth();
        setHealth({
          status: result.status,
          services: result.services as Record<
            string,
            { healthy: boolean; details: Record<string, unknown> }
          >,
          lastChecked: result.timestamp,
        });
      } catch {
        setHealth((prev) => ({
          ...prev,
          status: 'unhealthy',
          lastChecked: new Date(),
        }));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval]);

  return health;
}
