/**
 * Checkly Integration - Synthetic Monitoring & API Testing
 *
 * Provides proactive monitoring to detect issues before users do.
 * Tests critical flows from 20+ global locations every minute.
 *
 * Features:
 * - API endpoint health checks
 * - Browser checks for critical user flows
 * - Global location testing
 * - Alerting via Slack, PagerDuty, email
 * - Performance degradation detection
 * - SSL certificate monitoring
 *
 * NOTE: Checkly runs externally - this module provides:
 * 1. Health endpoints for Checkly to monitor
 * 2. Client-side beacon for RUM data
 * 3. Utilities for creating check configurations
 *
 * @see https://www.checklyhq.com/docs/
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ChecklyConfig {
  accountId: string;
  apiKey?: string; // Only needed for programmatic check management
  enableRUM?: boolean;
  siteId?: string; // For Real User Monitoring
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  message?: string;
  lastCheck: number;
}

export interface CheckDefinition {
  name: string;
  type: 'api' | 'browser';
  frequency: number; // minutes
  locations: string[];
  request?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
  };
  assertions?: Array<{
    source: 'STATUS_CODE' | 'RESPONSE_TIME' | 'JSON_BODY' | 'TEXT_BODY' | 'HEADERS';
    comparison:
      | 'EQUALS'
      | 'NOT_EQUALS'
      | 'GREATER_THAN'
      | 'LESS_THAN'
      | 'CONTAINS'
      | 'NOT_CONTAINS';
    target: string | number;
    property?: string; // JSON path for JSON_BODY
  }>;
  alertChannels?: string[];
  tags?: string[];
  privateLocations?: string[];
  runtimeId?: string;
}

export interface SyntheticTestResult {
  checkId: string;
  name: string;
  passed: boolean;
  runLocation: string;
  responseTime: number;
  startedAt: string;
  stoppedAt: string;
  assertions: Array<{
    source: string;
    passed: boolean;
    actual: unknown;
    expected: unknown;
  }>;
}

// ============================================================================
// GENESIS HEALTH CHECKS
// ============================================================================

/**
 * Genesis service health check definitions
 */
export const GENESIS_HEALTH_CHECKS: CheckDefinition[] = [
  // API Health
  {
    name: 'Genesis API Health',
    type: 'api',
    frequency: 1,
    locations: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
    request: {
      url: '{{GENESIS_URL}}/api/health',
      method: 'GET',
    },
    assertions: [
      { source: 'STATUS_CODE', comparison: 'EQUALS', target: 200 },
      { source: 'RESPONSE_TIME', comparison: 'LESS_THAN', target: 2000 },
      { source: 'JSON_BODY', comparison: 'EQUALS', target: 'healthy', property: '$.status' },
    ],
    tags: ['critical', 'api'],
  },

  // Database Connectivity
  {
    name: 'Genesis Database',
    type: 'api',
    frequency: 1,
    locations: ['us-east-1', 'eu-west-1'],
    request: {
      url: '{{GENESIS_URL}}/api/health?check=database',
      method: 'GET',
    },
    assertions: [
      { source: 'STATUS_CODE', comparison: 'EQUALS', target: 200 },
      {
        source: 'JSON_BODY',
        comparison: 'EQUALS',
        target: 'true',
        property: '$.services.database.healthy',
      },
    ],
    tags: ['critical', 'database'],
  },

  // Redis/Upstash Health
  {
    name: 'Genesis Redis',
    type: 'api',
    frequency: 1,
    locations: ['us-east-1', 'eu-west-1'],
    request: {
      url: '{{GENESIS_URL}}/api/health?check=redis',
      method: 'GET',
    },
    assertions: [
      { source: 'STATUS_CODE', comparison: 'EQUALS', target: 200 },
      {
        source: 'JSON_BODY',
        comparison: 'EQUALS',
        target: 'true',
        property: '$.services.redis.healthy',
      },
    ],
    tags: ['critical', 'redis'],
  },

  // AI Service Health
  {
    name: 'Genesis AI Service',
    type: 'api',
    frequency: 5,
    locations: ['us-east-1'],
    request: {
      url: '{{GENESIS_URL}}/api/health?check=ai',
      method: 'GET',
    },
    assertions: [
      { source: 'STATUS_CODE', comparison: 'EQUALS', target: 200 },
      { source: 'RESPONSE_TIME', comparison: 'LESS_THAN', target: 5000 },
    ],
    tags: ['ai', 'external'],
  },

  // Homepage Load
  {
    name: 'Genesis Homepage',
    type: 'browser',
    frequency: 5,
    locations: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
    tags: ['critical', 'browser', 'ux'],
  },

  // Authentication Flow
  {
    name: 'Genesis Auth Flow',
    type: 'browser',
    frequency: 10,
    locations: ['us-east-1'],
    tags: ['critical', 'auth', 'browser'],
  },

  // Book Creation Flow (Smoke Test)
  {
    name: 'Genesis Book Creation Smoke',
    type: 'browser',
    frequency: 15,
    locations: ['us-east-1'],
    tags: ['smoke', 'creation', 'browser'],
  },
];

// ============================================================================
// CHECKLY SERVICE
// ============================================================================

class ChecklyService {
  private config: ChecklyConfig | null = null;
  private healthChecks = new Map<string, HealthCheck>();
  private rumInitialized = false;

  /**
   * Initialize Checkly
   */
  async initialize(config: ChecklyConfig): Promise<void> {
    this.config = config;

    // Initialize RUM if enabled
    if (config.enableRUM && config.siteId) {
      await this.initializeRUM(config.siteId);
    }
  }

  /**
   * Initialize Real User Monitoring
   */
  private async initializeRUM(_siteId: string): Promise<void> {
    try {
      // Checkly's RUM is done via their Web Vitals integration
      // We use Vercel's built-in analytics which Checkly can consume

      // Report web vitals to Checkly
      if (typeof window !== 'undefined') {
        const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');

        const reportToCheckly = (metric: { name: string; value: number; id: string }) => {
          // Checkly consumes these via their analytics endpoint
          // For now, we just store locally for the health endpoint
          this.recordMetric(metric.name, metric.value);
        };

        onCLS(reportToCheckly);
        onINP(reportToCheckly);
        onLCP(reportToCheckly);
        onFCP(reportToCheckly);
        onTTFB(reportToCheckly);

        this.rumInitialized = true;
      }
    } catch (error) {
      console.error('[Checkly] Failed to initialize RUM:', error);
    }
  }

  /**
   * Record a health check result
   */
  recordHealthCheck(name: string, check: Omit<HealthCheck, 'name' | 'lastCheck'>): void {
    this.healthChecks.set(name, {
      name,
      ...check,
      lastCheck: Date.now(),
    });
  }

  /**
   * Record a metric for RUM
   */
  private recordMetric(name: string, value: number): void {
    // Store locally for health endpoint
    this.healthChecks.set(`metric:${name}`, {
      name: `metric:${name}`,
      status: 'healthy',
      latency: value,
      lastCheck: Date.now(),
    });
  }

  /**
   * Get all health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get overall health status
   */
  getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = this.getHealthChecks();

    if (checks.length === 0) return 'healthy';

    const unhealthy = checks.filter((c) => c.status === 'unhealthy').length;
    const degraded = checks.filter((c) => c.status === 'degraded').length;

    if (unhealthy > 0) return 'unhealthy';
    if (degraded > 0) return 'degraded';
    return 'healthy';
  }

  /**
   * Generate health endpoint response
   */
  generateHealthResponse(): {
    status: string;
    timestamp: string;
    checks: HealthCheck[];
    version: string;
    environment: string;
  } {
    return {
      status: this.getOverallStatus(),
      timestamp: new Date().toISOString(),
      checks: this.getHealthChecks(),
      version: import.meta.env.VITE_APP_VERSION ?? '2.0.0',
      environment: import.meta.env.VITE_APP_ENVIRONMENT ?? 'development',
    };
  }

  /**
   * Run a local health check
   */
  async runCheck(
    name: string,
    checkFn: () => Promise<{ healthy: boolean; message?: string }>
  ): Promise<HealthCheck> {
    const startTime = performance.now();

    try {
      const result = await checkFn();
      const latency = performance.now() - startTime;

      const check: HealthCheck = {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        latency,
        message: result.message,
        lastCheck: Date.now(),
      };

      this.healthChecks.set(name, check);
      return check;
    } catch (error) {
      const check: HealthCheck = {
        name,
        status: 'unhealthy',
        latency: performance.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: Date.now(),
      };

      this.healthChecks.set(name, check);
      return check;
    }
  }

  /**
   * Run all Genesis health checks
   */
  async runAllChecks(): Promise<HealthCheck[]> {
    const checks = await Promise.all([
      this.runCheck('supabase', async () => {
        const { supabase } = await import('../supabaseClient');
        const { error } = await supabase.from('profiles').select('id').limit(1);
        return { healthy: !error, message: error?.message };
      }),

      this.runCheck('upstash', async () => {
        const { getUpstashOrNull } = await import('./upstash');
        const upstash = getUpstashOrNull();
        if (!upstash) return { healthy: false, message: 'Not configured' };
        const healthy = await upstash.ping();
        return { healthy };
      }),
    ]);

    return checks;
  }
}

// ============================================================================
// CHECKLY CONFIG GENERATOR
// ============================================================================

/**
 * Generate checkly.config.ts content for the project
 */
export function generateChecklyConfig(_baseUrl: string): string {
  return `
import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';

export default defineConfig({
  projectName: 'Genesis',
  logicalId: 'genesis-monitoring',
  repoUrl: 'https://github.com/your-org/genesis',
  
  checks: {
    frequency: Frequency.EVERY_1M,
    locations: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
    tags: ['genesis'],
    runtimeId: '2024.02',
    
    browserChecks: {
      testMatch: '**/*.check.ts',
    },
  },
  
  cli: {
    runLocation: 'us-east-1',
  },
});
`;
}

/**
 * Generate a browser check for critical flow
 */
export function generateBrowserCheck(name: string, description: string, steps: string[]): string {
  return `
import { test, expect } from '@playwright/test';

/**
 * ${description}
 */
test('${name}', async ({ page }) => {
  ${steps.map((step, i) => `// Step ${i + 1}: ${step}`).join('\n  ')}
  
  // Navigate to Genesis
  await page.goto(process.env.GENESIS_URL ?? 'https://genesis.vercel.app');
  
  // Wait for the app to load
  await expect(page).toHaveTitle(/Genesis/i);
  
  // Add your test steps here
});
`;
}

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for running health checks
 */
export function useHealthChecks(): {
  checks: HealthCheck[];
  status: 'healthy' | 'degraded' | 'unhealthy';
  isRunning: boolean;
  runChecks: () => Promise<void>;
} {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    try {
      const results = await checkly.runAllChecks();
      setChecks(results);
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    runChecks();

    // Re-run every 60 seconds
    const interval = setInterval(runChecks, 60000);
    return () => clearInterval(interval);
  }, [runChecks]);

  return {
    checks,
    status: checkly.getOverallStatus(),
    isRunning,
    runChecks,
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const checkly = new ChecklyService();

/**
 * Initialize Checkly with environment config
 */
export function initializeCheckly(config?: Partial<ChecklyConfig>): Promise<void> {
  const finalConfig: ChecklyConfig = {
    accountId: config?.accountId ?? import.meta.env.VITE_CHECKLY_ACCOUNT_ID ?? '',
    // Server secret — never exposed to client bundle (no VITE_ prefix)
    apiKey: config?.apiKey,
    enableRUM: config?.enableRUM ?? true,
    siteId: config?.siteId ?? import.meta.env.VITE_CHECKLY_SITE_ID,
  };

  return checkly.initialize(finalConfig);
}

export default checkly;
