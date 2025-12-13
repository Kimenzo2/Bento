/**
 * @module Performance
 * @description Performance monitoring and Web Vitals tracking utilities
 * 
 * Features:
 * - Core Web Vitals measurement (LCP, FID, CLS, FCP, TTFB)
 * - Custom performance marks and measures
 * - Performance observer utilities
 * - Memory usage tracking
 * 
 * @example
 * ```typescript
 * import { reportWebVitals, measureAsync, getMemoryUsage } from '@utils/performance';
 * 
 * // Report web vitals on app init
 * reportWebVitals(console.log);
 * 
 * // Measure async operation
 * const result = await measureAsync('fetchBooks', fetchBooks);
 * ```
 */

import { logger } from '../services/logger';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

type WebVitalCallback = (metric: PerformanceMetric) => void;

/**
 * Create a unique ID for metrics
 */
function generateId(): string {
  return `v3-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get rating for Core Web Vitals
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    INP: [200, 500],
  };

  const [good, poor] = thresholds[name] || [0, 0];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report Core Web Vitals
 */
export function reportWebVitals(callback?: WebVitalCallback): void {
  const reportMetric = (metric: PerformanceMetric) => {
    if (callback) {
      callback(metric);
    }
    
    // Log in development
    if (import.meta.env.DEV) {
      logger.debug(`Web Vital: ${metric.name}`, {
        value: Math.round(metric.value),
        rating: metric.rating,
      });
    }
  };

  // Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (lastEntry) {
        reportMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          rating: getRating('LCP', lastEntry.startTime),
          delta: lastEntry.startTime,
          id: generateId(),
        });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Observer not supported
  }

  // First Input Delay
  try {
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const firstEntry = entries[0] as PerformanceEventTiming;
      if (firstEntry) {
        const value = firstEntry.processingStart - firstEntry.startTime;
        reportMetric({
          name: 'FID',
          value,
          rating: getRating('FID', value),
          delta: value,
          id: generateId(),
        });
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch {
    // Observer not supported
  }

  // Cumulative Layout Shift
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
    
    // Report CLS on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportMetric({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          delta: clsValue,
          id: generateId(),
        });
      }
    });
  } catch {
    // Observer not supported
  }

  // First Contentful Paint
  try {
    const fcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntriesByName('first-contentful-paint');
      if (entries.length > 0) {
        const value = entries[0].startTime;
        reportMetric({
          name: 'FCP',
          value,
          rating: getRating('FCP', value),
          delta: value,
          id: generateId(),
        });
      }
    });
    fcpObserver.observe({ type: 'paint', buffered: true });
  } catch {
    // Observer not supported
  }
}

/**
 * Mark a performance point
 */
export function mark(name: string): void {
  try {
    performance.mark(name);
  } catch {
    // Performance API not available
  }
}

/**
 * Measure between two marks
 */
export function measure(name: string, startMark: string, endMark?: string): number | null {
  try {
    const endName = endMark || `${name}-end`;
    if (!endMark) {
      performance.mark(endName);
    }
    const measure = performance.measure(name, startMark, endName);
    return measure.duration;
  } catch {
    return null;
  }
}

/**
 * Measure an async operation
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const startMark = `${name}-start`;
  mark(startMark);
  
  try {
    const result = await operation();
    const duration = measure(name, startMark);
    
    if (duration !== null) {
      logger.debug(`Performance: ${name}`, { durationMs: Math.round(duration) });
    }
    
    return result;
  } catch (error) {
    measure(`${name}-error`, startMark);
    throw error;
  }
}

/**
 * Get memory usage (if available)
 */
export function getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number } | null {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  if (memory) {
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
    };
  }
  return null;
}

/**
 * Log memory usage
 */
export function logMemoryUsage(): void {
  const usage = getMemoryUsage();
  if (usage) {
    const usedMB = Math.round(usage.usedJSHeapSize / 1024 / 1024);
    const totalMB = Math.round(usage.totalJSHeapSize / 1024 / 1024);
    logger.debug('Memory usage', { usedMB, totalMB, percentage: Math.round((usedMB / totalMB) * 100) });
  }
}

export type { PerformanceMetric, WebVitalCallback };
