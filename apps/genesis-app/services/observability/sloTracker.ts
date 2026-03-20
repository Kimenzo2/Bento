/**
 * SLO Tracker Service
 *
 * Service Level Objectives (SLOs) tracking and error budget management.
 *
 * SLI (Service Level Indicator): Measurement of service quality
 * SLO (Service Level Objective): Target for SLI
 * Error Budget = 100% - SLO
 *
 * Genesis SLOs:
 * - API Availability: 99.9% (43 minutes downtime/month allowed)
 * - API Latency (p95): <2s
 * - Book Generation Success: 99%
 * - Database Queries (p95): <100ms
 * - AI Generation Cost: <$0.50/book average
 */

import { supabase } from '../supabaseClient';
import { getAIMetrics, getEndpointMetrics } from './metricsService';

// ============================================================================
// TYPES
// ============================================================================

export interface SLO {
  name: string;
  description: string;
  target: number; // 0.0 - 1.0 (e.g., 0.999 = 99.9%)
  windowSeconds: number;
  measurement: () => Promise<number>;
  category: 'availability' | 'latency' | 'quality' | 'cost';
}

export interface SLOReport {
  name: string;
  description: string;
  target: number;
  actual: number;
  errorBudget: number;
  errorBudgetUsed: number;
  errorBudgetRemaining: number;
  status: 'healthy' | 'warning' | 'breached';
  lastChecked: number;
}

export interface SLOAlert {
  sloName: string;
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  errorBudgetRemaining: number;
}

// ============================================================================
// SLO DEFINITIONS
// ============================================================================

const SLOS: SLO[] = [
  {
    name: 'api_availability',
    description: 'API responds successfully to requests',
    target: 0.999, // 99.9%
    windowSeconds: 30 * 24 * 3600, // 30 days
    category: 'availability',
    measurement: async () => {
      // Use in-memory metrics for recent data
      const metrics = getEndpointMetrics('/api/books/generate');
      const successRate = 1 - metrics.errorRate;
      return successRate;
    },
  },
  {
    name: 'api_latency_p95',
    description: 'API responds within 2 seconds (p95)',
    target: 0.95, // 95% of requests under threshold
    windowSeconds: 5 * 60, // 5 minutes
    category: 'latency',
    measurement: async () => {
      const metrics = getEndpointMetrics('/api/books/generate');
      // Target: p95 < 2000ms
      // Return 1 if meeting target, 0 if not
      return metrics.p95Latency <= 2000 ? 1 : 0;
    },
  },
  {
    name: 'book_generation_success',
    description: 'Books are generated successfully',
    target: 0.99, // 99%
    windowSeconds: 24 * 3600, // 24 hours
    category: 'quality',
    measurement: async () => {
      const aiMetrics = getAIMetrics(24 * 3600 * 1000); // 24 hours
      return aiMetrics.successRate;
    },
  },
  {
    name: 'ai_cost_budget',
    description: 'AI generation cost stays within budget',
    target: 0.9, // 90% of generations under $0.50
    windowSeconds: 24 * 3600, // 24 hours
    category: 'cost',
    measurement: async () => {
      const aiMetrics = getAIMetrics(24 * 3600 * 1000);
      // Check if average cost per generation is under $0.50
      const underBudget = aiMetrics.costPerGeneration <= 0.5;
      return underBudget ? 1 : 0;
    },
  },
];

// ============================================================================
// SLO TRACKING STATE
// ============================================================================

const sloReports = new Map<string, SLOReport>();
const alertsSent = new Map<string, number>(); // Track when alerts were sent
const ALERT_COOLDOWN_MS = 3600_000; // 1 hour between alerts

// ============================================================================
// SLO TRACKER CLASS
// ============================================================================

class SLOTracker {
  /**
   * Check all SLOs and generate reports
   */
  async checkSLOs(): Promise<SLOReport[]> {
    const reports: SLOReport[] = [];

    for (const slo of SLOS) {
      try {
        const actual = await slo.measurement();
        const errorBudget = 1 - slo.target;
        const errorBudgetUsed = Math.max(0, slo.target - actual);
        const errorBudgetRemaining = errorBudget - errorBudgetUsed;

        let status: 'healthy' | 'warning' | 'breached' = 'healthy';
        if (actual < slo.target) {
          status = 'breached';
        } else if (errorBudgetRemaining < errorBudget * 0.1) {
          status = 'warning'; // Less than 10% error budget remaining
        }

        const report: SLOReport = {
          name: slo.name,
          description: slo.description,
          target: slo.target,
          actual,
          errorBudget,
          errorBudgetUsed,
          errorBudgetRemaining,
          status,
          lastChecked: Date.now(),
        };

        reports.push(report);
        sloReports.set(slo.name, report);
      } catch (error) {
        console.error(`Failed to check SLO ${slo.name}:`, error);
      }
    }

    return reports;
  }

  /**
   * Get current SLO report by name
   */
  getReport(name: string): SLOReport | undefined {
    return sloReports.get(name);
  }

  /**
   * Get all current SLO reports
   */
  getAllReports(): SLOReport[] {
    return Array.from(sloReports.values());
  }

  /**
   * Check SLOs and send alerts if needed
   */
  async alertIfBreached(): Promise<SLOAlert[]> {
    const reports = await this.checkSLOs();
    const alerts: SLOAlert[] = [];
    const now = Date.now();

    for (const report of reports) {
      const lastAlertTime = alertsSent.get(report.name) || 0;

      // Check cooldown
      if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
        continue;
      }

      if (report.status === 'breached') {
        const alert: SLOAlert = {
          sloName: report.name,
          severity: 'critical',
          title: `SLO Breached: ${report.name}`,
          message: `Target: ${(report.target * 100).toFixed(2)}%, Actual: ${(report.actual * 100).toFixed(2)}%`,
          errorBudgetRemaining: report.errorBudgetRemaining,
        };

        alerts.push(alert);
        alertsSent.set(report.name, now);
        await this.sendAlert(alert);
      } else if (report.status === 'warning') {
        const alert: SLOAlert = {
          sloName: report.name,
          severity: 'warning',
          title: `SLO Warning: ${report.name}`,
          message: `Only ${(report.errorBudgetRemaining * 100).toFixed(2)}% error budget remaining`,
          errorBudgetRemaining: report.errorBudgetRemaining,
        };

        alerts.push(alert);
        alertsSent.set(report.name, now);
        await this.sendAlert(alert);
      }
    }

    return alerts;
  }

  /**
   * Send alert to configured channels
   */
  private async sendAlert(alert: SLOAlert): Promise<void> {
    console.warn(`[SLO ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`);
    console.warn(`  ${alert.message}`);

    // Log to database for audit
    try {
      await supabase.from('activities').insert({
        type: 'system_alert',
        message: `${alert.title}: ${alert.message}`,
        metadata: {
          sloName: alert.sloName,
          severity: alert.severity,
          errorBudgetRemaining: alert.errorBudgetRemaining,
        },
      });
    } catch (error) {
      // Fail silently - don't let logging failures affect alerting
      console.error('Failed to log SLO alert:', error);
    }

    // TODO: Send to Slack/Discord/Email when configured
    // await this.sendSlack(alert);
    // await this.sendEmail(alert);
  }

  /**
   * Get SLO summary for dashboard
   */
  async getSummary(): Promise<{
    healthy: number;
    warning: number;
    breached: number;
    overallHealth: number;
    reports: SLOReport[];
  }> {
    const reports = await this.checkSLOs();

    const healthy = reports.filter((r) => r.status === 'healthy').length;
    const warning = reports.filter((r) => r.status === 'warning').length;
    const breached = reports.filter((r) => r.status === 'breached').length;

    // Overall health: weighted average of SLO compliance
    const overallHealth = reports.reduce((sum, r) => sum + r.actual, 0) / reports.length;

    return {
      healthy,
      warning,
      breached,
      overallHealth,
      reports,
    };
  }

  /**
   * Calculate error budget burn rate
   * A burn rate of 1 means you're using error budget at exactly the rate you should
   * >1 means you're burning faster than sustainable
   */
  calculateBurnRate(report: SLOReport): number {
    if (report.errorBudget === 0) return 0;

    // Burn rate = (error budget used / error budget total) / (time elapsed / window)
    // Simplified: If you've used 50% of budget in 50% of window, burn rate = 1
    const budgetUsedPercent = report.errorBudgetUsed / report.errorBudget;

    // For real calculation, you'd track time elapsed in window
    // For now, return simple ratio
    return budgetUsedPercent * (1 / report.errorBudget);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const sloTracker = new SLOTracker();

// ============================================================================
// SCHEDULED CHECK (Every 5 minutes)
// ============================================================================

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startSLOMonitoring(intervalMs: number = 5 * 60 * 1000): void {
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Initial check
  sloTracker.alertIfBreached();

  // Schedule recurring checks
  checkInterval = setInterval(() => {
    sloTracker.alertIfBreached();
  }, intervalMs);

  // eslint-disable-next-line no-console
  console.log(`[SLO] Monitoring started (checking every ${intervalMs / 1000}s)`);
}

export function stopSLOMonitoring(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    // eslint-disable-next-line no-console
    console.log('[SLO] Monitoring stopped');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sloTracker,
  startSLOMonitoring,
  stopSLOMonitoring,
  SLOS,
};
