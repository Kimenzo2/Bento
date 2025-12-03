/**
 * Performance Optimizations for Genesis
 * 
 * Critical utilities for handling 1M+ concurrent users:
 * - Request deduplication
 * - Memory-efficient caching with LRU eviction
 * - Request queue with concurrency limits
 * - Debouncing and throttling
 * - Connection pooling helpers
 */

// ============================================================================
// LRU CACHE - Memory-efficient caching with automatic eviction
// ============================================================================

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict oldest if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// REQUEST DEDUPLICATION - Prevent duplicate API calls
// ============================================================================

type PendingRequest<T> = Promise<T>;
const pendingRequests = new Map<string, PendingRequest<any>>();

export async function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  ttlMs: number = 5000
): Promise<T> {
  // Return existing request if in flight
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Create new request
  const request = requestFn().finally(() => {
    // Remove after TTL
    setTimeout(() => {
      pendingRequests.delete(key);
    }, ttlMs);
  });

  pendingRequests.set(key, request);
  return request;
}

// ============================================================================
// REQUEST QUEUE - Limit concurrent requests to prevent API overload
// ============================================================================

export class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private readonly delayBetweenMs: number;

  constructor(maxConcurrent: number = 3, delayBetweenMs: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.delayBetweenMs = delayBetweenMs;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          // Add delay between requests
          if (this.delayBetweenMs > 0) {
            await new Promise(r => setTimeout(r, this.delayBetweenMs));
          }
          this.processNext();
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processNext(): void {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.activeCount;
  }
}

// ============================================================================
// DEBOUNCE & THROTTLE - Prevent excessive function calls
// ============================================================================

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= limitMs) {
      lastCallTime = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        fn(...args);
        timeoutId = null;
      }, limitMs - timeSinceLastCall);
    }
  };
}

// ============================================================================
// MEMORY MANAGEMENT - Prevent memory leaks
// ============================================================================

export class WeakCache<K extends object, V> {
  private cache = new WeakMap<K, V>();

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}

// ============================================================================
// BATCH PROCESSOR - Batch multiple operations together
// ============================================================================

export class BatchProcessor<T, R> {
  private batch: T[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly maxBatchSize: number;
  private readonly maxWaitMs: number;
  private readonly processFn: (items: T[]) => Promise<R[]>;
  private resolvers: Array<{ resolve: (value: R) => void; reject: (error: any) => void }> = [];

  constructor(
    processFn: (items: T[]) => Promise<R[]>,
    maxBatchSize: number = 10,
    maxWaitMs: number = 50
  ) {
    this.processFn = processFn;
    this.maxBatchSize = maxBatchSize;
    this.maxWaitMs = maxWaitMs;
  }

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push(item);
      this.resolvers.push({ resolve, reject });

      if (this.batch.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), this.maxWaitMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.batch.length === 0) return;

    const items = [...this.batch];
    const resolvers = [...this.resolvers];
    this.batch = [];
    this.resolvers = [];

    try {
      const results = await this.processFn(items);
      resolvers.forEach((r, i) => r.resolve(results[i]));
    } catch (error) {
      resolvers.forEach(r => r.reject(error));
    }
  }
}

// ============================================================================
// CONNECTION MANAGER - Manage WebSocket/Realtime connections
// ============================================================================

export class ConnectionManager {
  private connections = new Map<string, { channel: any; refCount: number; lastUsed: number }>();
  private readonly maxConnections: number;
  private readonly idleTimeoutMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxConnections: number = 50, idleTimeoutMs: number = 60000) {
    this.maxConnections = maxConnections;
    this.idleTimeoutMs = idleTimeoutMs;
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.idleTimeoutMs / 2);
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.connections.forEach((conn, key) => {
      if (conn.refCount === 0 && now - conn.lastUsed > this.idleTimeoutMs) {
        toRemove.push(key);
      }
    });

    toRemove.forEach(key => {
      const conn = this.connections.get(key);
      if (conn?.channel?.unsubscribe) {
        conn.channel.unsubscribe();
      }
      this.connections.delete(key);
    });

    if (toRemove.length > 0) {
      console.log(`[ConnectionManager] Cleaned up ${toRemove.length} idle connections`);
    }
  }

  acquire(key: string, createFn: () => any): any {
    if (this.connections.has(key)) {
      const conn = this.connections.get(key)!;
      conn.refCount++;
      conn.lastUsed = Date.now();
      return conn.channel;
    }

    // Evict oldest if at capacity
    if (this.connections.size >= this.maxConnections) {
      this.evictOldest();
    }

    const channel = createFn();
    this.connections.set(key, { channel, refCount: 1, lastUsed: Date.now() });
    return channel;
  }

  release(key: string): void {
    const conn = this.connections.get(key);
    if (conn) {
      conn.refCount = Math.max(0, conn.refCount - 1);
      conn.lastUsed = Date.now();
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.connections.forEach((conn, key) => {
      if (conn.refCount === 0 && conn.lastUsed < oldestTime) {
        oldestTime = conn.lastUsed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      const conn = this.connections.get(oldestKey);
      if (conn?.channel?.unsubscribe) {
        conn.channel.unsubscribe();
      }
      this.connections.delete(oldestKey);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.connections.forEach(conn => {
      if (conn.channel?.unsubscribe) {
        conn.channel.unsubscribe();
      }
    });
    this.connections.clear();
  }

  get activeConnections(): number {
    return this.connections.size;
  }
}

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================================

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryCondition = () => true
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !retryCondition(error)) {
        throw error;
      }

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * delay * 0.1;
      await new Promise(r => setTimeout(r, delay + jitter));

      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

// ============================================================================
// IMAGE CACHE - Efficient image URL caching
// ============================================================================

const imageCache = new LRUCache<string, string>(200);
const imageBlobCache = new LRUCache<string, Blob>(50);

export function getCachedImageUrl(key: string): string | undefined {
  return imageCache.get(key);
}

export function setCachedImageUrl(key: string, url: string): void {
  imageCache.set(key, url);
}

export function getCachedImageBlob(key: string): Blob | undefined {
  return imageBlobCache.get(key);
}

export function setCachedImageBlob(key: string, blob: Blob): void {
  imageBlobCache.set(key, blob);
}

export function clearImageCache(): void {
  imageCache.clear();
  imageBlobCache.clear();
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

// Global request queue for API calls (max 5 concurrent, 200ms delay)
export const globalRequestQueue = new RequestQueue(5, 200);

// Global connection manager for WebSocket/Realtime
export const globalConnectionManager = new ConnectionManager(100, 120000);

// Session cache for user data (max 500 entries)
export const sessionCache = new LRUCache<string, any>(500);

// API response cache (max 200 entries)
export const apiCache = new LRUCache<string, { data: any; timestamp: number }>(200);

const API_CACHE_TTL = 30000; // 30 seconds

export function getCachedApiResponse<T>(key: string): T | undefined {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
    return cached.data as T;
  }
  return undefined;
}

export function setCachedApiResponse<T>(key: string, data: T): void {
  apiCache.set(key, { data, timestamp: Date.now() });
}
