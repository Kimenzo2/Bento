/**
 * PERFORMANCE MONITORING
 * 
 * Track and optimize:
 * 1. Component render times
 * 2. Animation frame rates
 * 3. Memory usage
 * 4. Long tasks
 * 5. Core Web Vitals
 */

// Performance metrics storage
interface PerformanceMetrics {
  renderTimes: Map<string, number[]>;
  fps: number[];
  longTasks: number[];
  memoryUsage: number[];
}

const metrics: PerformanceMetrics = {
  renderTimes: new Map(),
  fps: [],
  longTasks: [],
  memoryUsage: [],
};

// Track if we're in development mode
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/**
 * Measure component render time
 */
export function measureRender(componentName: string, startTime: number): void {
  if (!isDev) return;
  
  const duration = performance.now() - startTime;
  
  if (!metrics.renderTimes.has(componentName)) {
    metrics.renderTimes.set(componentName, []);
  }
  
  const times = metrics.renderTimes.get(componentName)!;
  times.push(duration);
  
  // Keep only last 100 measurements
  if (times.length > 100) {
    times.shift();
  }
  
  // Warn if render is slow (> 16ms = drops below 60fps)
  if (duration > 16) {
    console.warn(`[Perf] Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
  }
}

/**
 * Start measuring render
 */
export function startMeasure(): number {
  return performance.now();
}

/**
 * FPS Monitor - tracks animation smoothness
 */
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let fpsMonitorActive = false;

export function startFPSMonitor(): void {
  if (fpsMonitorActive) return;
  fpsMonitorActive = true;
  
  const measureFPS = () => {
    fpsFrameCount++;
    const now = performance.now();
    
    if (now - fpsLastTime >= 1000) {
      const fps = Math.round(fpsFrameCount * 1000 / (now - fpsLastTime));
      metrics.fps.push(fps);
      
      // Keep only last 60 measurements
      if (metrics.fps.length > 60) {
        metrics.fps.shift();
      }
      
      // Warn if FPS drops below 30
      if (fps < 30 && isDev) {
        console.warn(`[Perf] Low FPS detected: ${fps}`);
      }
      
      fpsFrameCount = 0;
      fpsLastTime = now;
    }
    
    if (fpsMonitorActive) {
      requestAnimationFrame(measureFPS);
    }
  };
  
  requestAnimationFrame(measureFPS);
}

export function stopFPSMonitor(): void {
  fpsMonitorActive = false;
}

/**
 * Long Task Observer - detects main thread blocking
 */
let longTaskObserver: PerformanceObserver | null = null;

export function startLongTaskMonitor(): void {
  if (longTaskObserver || !('PerformanceObserver' in window)) return;
  
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        metrics.longTasks.push(entry.duration);
        
        if (isDev && entry.duration > 50) {
          console.warn(`[Perf] Long task detected: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });
    
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch {
    // Long task API not supported
  }
}

export function stopLongTaskMonitor(): void {
  if (longTaskObserver) {
    longTaskObserver.disconnect();
    longTaskObserver = null;
  }
}

/**
 * Memory Monitor
 */
export function measureMemory(): void {
  if (!isDev) return;
  
  // @ts-expect-error - memory API is non-standard
  const memory = performance.memory;
  if (memory) {
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    metrics.memoryUsage.push(usedMB);
    
    // Keep only last 60 measurements
    if (metrics.memoryUsage.length > 60) {
      metrics.memoryUsage.shift();
    }
  }
}

/**
 * Get performance report
 */
export function getPerformanceReport(): {
  avgRenderTimes: Record<string, number>;
  avgFPS: number;
  avgLongTaskDuration: number;
  avgMemoryMB: number;
} {
  const avgRenderTimes: Record<string, number> = {};
  
  metrics.renderTimes.forEach((times, name) => {
    if (times.length > 0) {
      avgRenderTimes[name] = times.reduce((a, b) => a + b, 0) / times.length;
    }
  });
  
  const avgFPS = metrics.fps.length > 0
    ? metrics.fps.reduce((a, b) => a + b, 0) / metrics.fps.length
    : 60;
  
  const avgLongTaskDuration = metrics.longTasks.length > 0
    ? metrics.longTasks.reduce((a, b) => a + b, 0) / metrics.longTasks.length
    : 0;
  
  const avgMemoryMB = metrics.memoryUsage.length > 0
    ? metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length
    : 0;
  
  return {
    avgRenderTimes,
    avgFPS,
    avgLongTaskDuration,
    avgMemoryMB,
  };
}

/**
 * Initialize all monitors
 */
export function initPerformanceMonitoring(): void {
  if (isDev) {
    startFPSMonitor();
    startLongTaskMonitor();
    
    // Log report every 10 seconds in dev
    setInterval(() => {
      const report = getPerformanceReport();
      console.log('[Perf Report]', report);
    }, 10000);
  }
}

/**
 * Cleanup all monitors
 */
export function cleanupPerformanceMonitoring(): void {
  stopFPSMonitor();
  stopLongTaskMonitor();
}
