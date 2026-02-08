/**
 * Mars-Class Infrastructure - Media Optimization Pipeline
 *
 * Reduces image sizes by 80-90% through modern format conversion.
 *
 * THE PROBLEM:
 * - Imagen 4 outputs are often 4MB+ PNG files
 * - Mobile users on 4G/5G burn data and wait for downloads
 * - Large files strain storage and increase costs
 *
 * THE SOLUTION:
 * - Convert to WebP/AVIF (80-90% smaller than PNG)
 * - Generate responsive variants (320, 640, 960, 1280, 2560px)
 * - Lazy loading with blur placeholders
 * - Client-side format detection
 *
 * ARCHITECTURE:
 * 1. Original uploaded to temp storage
 * 2. Worker processes: convert → resize → upload variants
 * 3. Variants stored in R2 with CDN caching
 * 4. Frontend uses srcset for optimal delivery
 */

// ============================================================================
// TYPES
// ============================================================================

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export interface OptimizationConfig {
  /** Output formats to generate */
  formats: ImageFormat[];
  /** Widths to generate (in pixels) */
  widths: number[];
  /** Quality setting (1-100) */
  quality: number;
  /** Generate blur placeholder */
  generatePlaceholder: boolean;
  /** Placeholder width */
  placeholderWidth: number;
  /** Strip metadata */
  stripMetadata: boolean;
  /** Maximum output dimension */
  maxDimension: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  colorSpace?: string;
  density?: number;
}

export interface OptimizedImageResult {
  original: {
    url: string;
    metadata: ImageMetadata;
  };
  variants: Array<{
    format: ImageFormat;
    width: number;
    height: number;
    url: string;
    size: number;
    savings: number; // percentage saved vs original
  }>;
  placeholder?: {
    dataUrl: string;
    width: number;
    height: number;
  };
  totalSavings: number; // bytes saved across all variants
  processingTimeMs: number;
}

export interface OptimizationJob {
  id: string;
  sourceUrl: string;
  config: OptimizationConfig;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: OptimizedImageResult;
  error?: string;
}

// ============================================================================
// CONFIGURATION PRESETS
// ============================================================================

export const OPTIMIZATION_PRESETS: Record<string, OptimizationConfig> = {
  /** For book illustrations - high quality, multiple sizes */
  illustration: {
    formats: ['avif', 'webp', 'jpeg'],
    widths: [320, 640, 960, 1280, 1920],
    quality: 85,
    generatePlaceholder: true,
    placeholderWidth: 32,
    stripMetadata: true,
    maxDimension: 4096,
  },

  /** For book covers - highest quality, fewer sizes */
  cover: {
    formats: ['avif', 'webp', 'jpeg'],
    widths: [400, 800, 1200],
    quality: 90,
    generatePlaceholder: true,
    placeholderWidth: 40,
    stripMetadata: true,
    maxDimension: 2400,
  },

  /** For thumbnails - small, fast loading */
  thumbnail: {
    formats: ['webp', 'jpeg'],
    widths: [150, 300],
    quality: 75,
    generatePlaceholder: false,
    placeholderWidth: 16,
    stripMetadata: true,
    maxDimension: 600,
  },

  /** For avatars - small, consistent */
  avatar: {
    formats: ['webp', 'jpeg'],
    widths: [64, 128, 256],
    quality: 80,
    generatePlaceholder: false,
    placeholderWidth: 16,
    stripMetadata: true,
    maxDimension: 512,
  },

  /** For exports - highest quality, single size */
  export: {
    formats: ['jpeg', 'png'],
    widths: [2048],
    quality: 95,
    generatePlaceholder: false,
    placeholderWidth: 32,
    stripMetadata: false, // Keep metadata for exports
    maxDimension: 4096,
  },
};

// ============================================================================
// MEDIA OPTIMIZER CLIENT (Browser-compatible)
// ============================================================================

/**
 * Client for media optimization operations.
 * Heavy lifting done server-side, this handles job submission and tracking.
 */
export class MediaOptimizer {
  private readonly apiBase: string;
  private readonly jobs = new Map<string, OptimizationJob>();

  constructor(apiBase = '/api/media') {
    this.apiBase = apiBase;
  }

  /**
   * Submit an image for optimization.
   */
  async optimize(
    source: File | string, // File or URL
    preset: keyof typeof OPTIMIZATION_PRESETS = 'illustration',
    customConfig?: Partial<OptimizationConfig>
  ): Promise<OptimizationJob> {
    const config = {
      ...OPTIMIZATION_PRESETS[preset],
      ...customConfig,
    };

    let sourceUrl: string;

    // Handle file upload
    if (source instanceof File) {
      const formData = new FormData();
      formData.append('file', source);

      const uploadResponse = await fetch(`${this.apiBase}/upload-temp`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const { url } = await uploadResponse.json();
      sourceUrl = url;
    } else {
      sourceUrl = source;
    }

    // Submit optimization job
    const response = await fetch(`${this.apiBase}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceUrl,
        config,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit optimization job');
    }

    const job: OptimizationJob = await response.json();
    this.jobs.set(job.id, job);

    return job;
  }

  /**
   * Check job status.
   */
  async getJobStatus(jobId: string): Promise<OptimizationJob> {
    const response = await fetch(`${this.apiBase}/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error('Failed to get job status');
    }

    const job: OptimizationJob = await response.json();
    this.jobs.set(jobId, job);

    return job;
  }

  /**
   * Wait for job completion with polling.
   */
  async waitForCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (job: OptimizationJob) => void;
    } = {}
  ): Promise<OptimizedImageResult> {
    const { pollInterval = 1000, timeout = 60000, onProgress } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await this.getJobStatus(jobId);

      if (onProgress) {
        onProgress(job);
      }

      if (job.status === 'completed' && job.result) {
        return job.result;
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Optimization failed');
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Optimization timed out');
  }

  /**
   * Optimize and wait for result (convenience method).
   */
  async optimizeAndWait(
    source: File | string,
    preset: keyof typeof OPTIMIZATION_PRESETS = 'illustration',
    onProgress?: (progress: number) => void
  ): Promise<OptimizedImageResult> {
    const job = await this.optimize(source, preset);

    return this.waitForCompletion(job.id, {
      onProgress: onProgress ? (j) => onProgress(j.progress) : undefined,
    });
  }
}

// ============================================================================
// CLIENT-SIDE UTILITIES
// ============================================================================

/**
 * Detect supported image formats in the browser.
 */
export async function detectSupportedFormats(): Promise<Set<ImageFormat>> {
  const supported = new Set<ImageFormat>(['jpeg', 'png']); // Always supported

  // Test WebP support
  const webpTest = await testImageFormat(
    'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
  );
  if (webpTest) supported.add('webp');

  // Test AVIF support
  const avifTest = await testImageFormat(
    'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgADlAgIDUgBAAGKQMAqA=='
  );
  if (avifTest) supported.add('avif');

  return supported;
}

function testImageFormat(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

/**
 * Select best format from available variants.
 */
export function selectBestFormat(
  variants: Array<{ format: ImageFormat; width: number; url: string }>,
  supportedFormats: Set<ImageFormat>,
  targetWidth: number
): string | null {
  // Format priority (best to worst)
  const formatPriority: ImageFormat[] = ['avif', 'webp', 'jpeg', 'png'];

  for (const format of formatPriority) {
    if (!supportedFormats.has(format)) continue;

    // Find variants of this format, sorted by width
    const formatVariants = variants
      .filter((v) => v.format === format)
      .sort((a, b) => a.width - b.width);

    if (formatVariants.length === 0) continue;

    // Find smallest variant >= target width
    const match = formatVariants.find((v) => v.width >= targetWidth);
    if (match) return match.url;

    // Fall back to largest available
    return formatVariants[formatVariants.length - 1].url;
  }

  return null;
}

/**
 * Generate picture element sources for responsive images.
 */
export function generatePictureSources(
  variants: Array<{ format: ImageFormat; width: number; url: string }>
): Array<{ type: string; srcSet: string }> {
  const formatMimeTypes: Record<ImageFormat, string> = {
    avif: 'image/avif',
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };

  const sources: Array<{ type: string; srcSet: string }> = [];

  // Group by format
  const byFormat = new Map<ImageFormat, Array<{ width: number; url: string }>>();
  for (const variant of variants) {
    if (!byFormat.has(variant.format)) {
      byFormat.set(variant.format, []);
    }
    byFormat.get(variant.format)!.push({ width: variant.width, url: variant.url });
  }

  // Generate sources in priority order
  const formatPriority: ImageFormat[] = ['avif', 'webp', 'jpeg'];

  for (const format of formatPriority) {
    const formatVariants = byFormat.get(format);
    if (!formatVariants?.length) continue;

    const srcSet = formatVariants
      .sort((a, b) => a.width - b.width)
      .map((v) => `${v.url} ${v.width}w`)
      .join(', ');

    sources.push({
      type: formatMimeTypes[format],
      srcSet,
    });
  }

  return sources;
}

// ============================================================================
// LAZY LOADING WITH BLUR PLACEHOLDER
// ============================================================================

export interface LazyImageOptions {
  /** Placeholder data URL (blur) */
  placeholder?: string;
  /** Threshold for intersection observer */
  threshold?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
}

/**
 * Create a lazy-loading image controller.
 */
export function createLazyLoader(options: LazyImageOptions = {}): {
  observe: (element: HTMLImageElement) => void;
  disconnect: () => void;
} {
  const { threshold = 0.1, rootMargin = '200px' } = options;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const dataSrc = img.dataset.src;
          const dataSrcset = img.dataset.srcset;

          if (dataSrc) {
            img.src = dataSrc;
            delete img.dataset.src;
          }

          if (dataSrcset) {
            img.srcset = dataSrcset;
            delete img.dataset.srcset;
          }

          // Add loaded class for CSS transitions
          img.classList.add('loaded');

          observer.unobserve(img);
        }
      }
    },
    { threshold, rootMargin }
  );

  return {
    observe: (element: HTMLImageElement) => observer.observe(element),
    disconnect: () => observer.disconnect(),
  };
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface MediaPerformanceMetrics {
  imagesLoaded: number;
  totalBytesTransferred: number;
  avgLoadTimeMs: number;
  formatDistribution: Record<ImageFormat, number>;
  cacheHitRate: number;
}

class MediaPerformanceTracker {
  private metrics: MediaPerformanceMetrics = {
    imagesLoaded: 0,
    totalBytesTransferred: 0,
    avgLoadTimeMs: 0,
    formatDistribution: { jpeg: 0, png: 0, webp: 0, avif: 0 },
    cacheHitRate: 0,
  };

  private loadTimes: number[] = [];
  private cacheHits = 0;

  recordImageLoad(
    loadTimeMs: number,
    bytesTransferred: number,
    format: ImageFormat,
    fromCache: boolean
  ): void {
    this.metrics.imagesLoaded++;
    this.metrics.totalBytesTransferred += bytesTransferred;
    this.metrics.formatDistribution[format]++;

    this.loadTimes.push(loadTimeMs);
    if (this.loadTimes.length > 100) this.loadTimes.shift();

    this.metrics.avgLoadTimeMs = this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length;

    if (fromCache) this.cacheHits++;
    this.metrics.cacheHitRate = this.cacheHits / this.metrics.imagesLoaded;
  }

  getMetrics(): MediaPerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      imagesLoaded: 0,
      totalBytesTransferred: 0,
      avgLoadTimeMs: 0,
      formatDistribution: { jpeg: 0, png: 0, webp: 0, avif: 0 },
      cacheHitRate: 0,
    };
    this.loadTimes = [];
    this.cacheHits = 0;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const mediaOptimizer = new MediaOptimizer();
export const mediaPerformanceTracker = new MediaPerformanceTracker();
