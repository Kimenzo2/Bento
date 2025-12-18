/**
 * INTELLIGENT ASSET PRELOADING
 * 
 * Strategies:
 * 1. Critical path preloading (above-the-fold assets)
 * 2. Predictive preloading based on user journey
 * 3. Intersection Observer for lazy loading
 * 4. Priority queuing for network efficiency
 * 5. Cache management
 */

// All onboarding assets categorized by priority
export const ONBOARDING_ASSETS = {
  // Critical - load immediately (first screen)
  critical: [
    '/images/onboarding/Style_directive_highend_202512150033.jpeg', // Gen mascot
    '/images/onboarding/Cosmos.png',
    '/images/onboarding/On 4.jpeg', // Kingdom
    '/images/onboarding/On 5.png', // Cell
  ],
  
  // High priority - load after critical (quiz screen)
  high: [
    '/images/onboarding/On 13.png', // Kids
    '/images/onboarding/On 14.png', // Sci-fi
    '/images/onboarding/On 15.png', // Brand
    '/images/onboarding/On 16.png', // Beginner
    '/images/onboarding/On 17.png', // Pro
  ],
  
  // Medium priority - load when idle (creation demo)
  medium: [
    '/images/onboarding/On 18.png', // Daily
    '/images/onboarding/On 19.png', // Occasional
  ],
  
  // Low priority - lazy load (tour)
  low: [
    '/images/onboarding/On 6.png',
    '/images/onboarding/On 7.png',
    '/images/onboarding/On 8.png',
    '/images/onboarding/On 9.png',
  ],
  
  // Video assets - load on demand
  videos: [
    '/images/onboarding/Cinematic_microscopic_journey_202512151050_ve.mp4',
  ],
} as const;

// Asset cache to prevent duplicate requests
const assetCache = new Map<string, Promise<void>>();
const loadedAssets = new Set<string>();

/**
 * Preload a single image with caching
 */
export function preloadImage(src: string): Promise<void> {
  if (loadedAssets.has(src)) {
    return Promise.resolve();
  }
  
  if (assetCache.has(src)) {
    return assetCache.get(src)!;
  }
  
  const promise = new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      loadedAssets.add(src);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
  
  assetCache.set(src, promise);
  return promise;
}

/**
 * Preload video with priority hints
 */
export function preloadVideo(src: string): Promise<void> {
  if (loadedAssets.has(src)) {
    return Promise.resolve();
  }
  
  if (assetCache.has(src)) {
    return assetCache.get(src)!;
  }
  
  const promise = new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = src;
    link.onload = () => {
      loadedAssets.add(src);
      resolve();
    };
    link.onerror = () => resolve(); // Don't block on video errors
    document.head.appendChild(link);
  });
  
  assetCache.set(src, promise);
  return promise;
}

/**
 * Batch preload with concurrency control
 */
export async function preloadBatch(
  urls: readonly string[],
  concurrency = 3
): Promise<void> {
  const queue = [...urls];
  const active: Promise<void>[] = [];
  
  while (queue.length > 0 || active.length > 0) {
    while (active.length < concurrency && queue.length > 0) {
      const url = queue.shift()!;
      const promise = preloadImage(url).finally(() => {
        const index = active.indexOf(promise);
        if (index > -1) active.splice(index, 1);
      });
      active.push(promise);
    }
    
    if (active.length > 0) {
      await Promise.race(active);
    }
  }
}

/**
 * Preload critical assets immediately
 */
export function preloadCriticalAssets(): Promise<void> {
  return preloadBatch(ONBOARDING_ASSETS.critical, 4);
}

/**
 * Preload assets for next screen (predictive)
 */
export function preloadNextScreen(currentStep: string): void {
  const stepAssets: Record<string, readonly string[]> = {
    spark: ONBOARDING_ASSETS.high,
    quiz: ONBOARDING_ASSETS.medium,
    magic: [...ONBOARDING_ASSETS.low],
    proreveal: [],
    pricing: [],
    tour: ONBOARDING_ASSETS.low,
    identity: [],
    cliffhanger: [],
    welcome: [],
  };
  
  const assets = stepAssets[currentStep];
  if (assets && assets.length > 0) {
    // Use requestIdleCallback for non-blocking preload
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => preloadBatch(assets, 2));
    } else {
      setTimeout(() => preloadBatch(assets, 2), 100);
    }
  }
}

/**
 * Initialize preloading strategy
 */
export function initAssetPreloading(): void {
  // Preload critical immediately
  preloadCriticalAssets();
  
  // Preload high priority during idle time
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadBatch(ONBOARDING_ASSETS.high, 2);
    });
  } else {
    setTimeout(() => preloadBatch(ONBOARDING_ASSETS.high, 2), 1000);
  }
}

/**
 * Create preload link elements for critical resources
 * Call this in document head for maximum performance
 */
export function getPreloadLinks(): string {
  return ONBOARDING_ASSETS.critical
    .map(src => `<link rel="preload" as="image" href="${src}" />`)
    .join('\n');
}
