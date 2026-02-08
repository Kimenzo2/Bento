/**
 * Alert Manager Service
 *
 * Handles alerting for Genesis with:
 * - Multiple alert channels (console, Slack, Discord, Email)
 * - Alert fatigue prevention (cooldowns)
 * - Severity-based routing
 * - Runbook links for common issues
 *
 * Solo Founder Strategy:
 * - Critical-only alerts via SMS/phone
 * - Everything else can wait until morning
 */

import { supabase } from '../supabaseClient';
import { checkThresholds } from './metricsService';
import { sloTracker } from './sloTracker';

// ============================================================================
// TYPES
// ============================================================================

export interface Alert {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  condition: () => Promise<boolean>;
  message: () => Promise<string>;
  cooldownSeconds: number;
  channels: Array<'console' | 'slack' | 'discord' | 'email' | 'sms'>;
  runbookUrl?: string;
}

interface AlertState {
  lastAlertTime: number;
  consecutiveAlerts: number;
  acknowledged: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Alert definitions for Genesis
const ALERTS: Alert[] = [
  {
    name: 'high_error_rate',
    severity: 'critical',
    condition: async () => {
      const alerts = checkThresholds();
      return alerts.some((a) => a.metric.includes('errorRate') && a.severity === 'critical');
    },
    message: async () => {
      const alerts = checkThresholds();
      const errorAlerts = alerts.filter((a) => a.metric.includes('errorRate'));
      return errorAlerts.map((a) => a.message).join('; ');
    },
    cooldownSeconds: 300, // 5 minutes
    channels: ['console', 'slack'],
    runbookUrl: 'https://docs.genesis.com/runbooks/high-error-rate',
  },
  {
    name: 'high_latency',
    severity: 'warning',
    condition: async () => {
      const alerts = checkThresholds();
      return alerts.some((a) => a.metric.includes('Latency'));
    },
    message: async () => {
      const alerts = checkThresholds();
      const latencyAlerts = alerts.filter((a) => a.metric.includes('Latency'));
      return latencyAlerts.map((a) => a.message).join('; ');
    },
    cooldownSeconds: 600, // 10 minutes
    channels: ['console', 'slack'],
  },
  {
    name: 'ai_cost_spike',
    severity: 'warning',
    condition: async () => {
      const alerts = checkThresholds();
      return alerts.some((a) => a.metric.includes('ai.cost'));
    },
    message: async () => {
      const alerts = checkThresholds();
      const costAlerts = alerts.filter((a) => a.metric.includes('ai.cost'));
      return costAlerts.map((a) => a.message).join('; ');
    },
    cooldownSeconds: 1800, // 30 minutes
    channels: ['console', 'slack'],
  },
  {
    name: 'slo_breach',
    severity: 'critical',
    condition: async () => {
      const summary = await sloTracker.getSummary();
      return summary.breached > 0;
    },
    message: async () => {
      const summary = await sloTracker.getSummary();
      const breached = summary.reports.filter((r) => r.status === 'breached');
      return `SLOs breached: ${breached.map((r) => r.name).join(', ')}`;
    },
    cooldownSeconds: 3600, // 1 hour
    channels: ['console', 'slack', 'email'],
  },
  {
    name: 'error_budget_low',
    severity: 'warning',
    condition: async () => {
      const summary = await sloTracker.getSummary();
      return summary.warning > 0;
    },
    message: async () => {
      const summary = await sloTracker.getSummary();
      const warnings = summary.reports.filter((r) => r.status === 'warning');
      return `Low error budget: ${warnings.map((r) => `${r.name} (${(r.errorBudgetRemaining * 100).toFixed(1)}% remaining)`).join(', ')}`;
    },
    cooldownSeconds: 3600, // 1 hour
    channels: ['console'],
  },
];

// ============================================================================
// ALERT STATE TRACKING
// ============================================================================

const alertStates = new Map<string, AlertState>();

function getAlertState(name: string): AlertState {
  let state = alertStates.get(name);
  if (!state) {
    state = {
      lastAlertTime: 0,
      consecutiveAlerts: 0,
      acknowledged: false,
    };
    alertStates.set(name, state);
  }
  return state;
}

// ============================================================================
// ALERT MANAGER CLASS
// ============================================================================

class AlertManager {
  /**
   * Check all alerts and send if triggered
   */
  async checkAlerts(): Promise<void> {
    const now = Date.now();

    for (const alert of ALERTS) {
      const state = getAlertState(alert.name);

      // Check cooldown
      const cooldownMs = alert.cooldownSeconds * 1000;
      if (now - state.lastAlertTime < cooldownMs) {
        continue;
      }

      try {
        // Check condition
        const triggered = await alert.condition();

        if (triggered) {
          const message = await alert.message();
          await this.sendAlert(alert, message);

          state.lastAlertTime = now;
          state.consecutiveAlerts++;
        } else {
          // Reset consecutive count if condition cleared
          if (state.consecutiveAlerts > 0) {
            state.consecutiveAlerts = 0;
            console.warn(`[ALERT] ${alert.name} cleared`);
          }
        }
      } catch (error) {
        console.error(`[ALERT] Failed to check ${alert.name}:`, error);
      }
    }
  }

  /**
   * Send alert to all configured channels
   */
  private async sendAlert(alert: Alert, message: string): Promise<void> {
    const timestamp = new Date().toISOString();

    for (const channel of alert.channels) {
      try {
        switch (channel) {
          case 'console':
            this.sendConsole(alert, message, timestamp);
            break;
          case 'slack':
            await this.sendSlack(alert, message, timestamp);
            break;
          case 'discord':
            await this.sendDiscord(alert, message, timestamp);
            break;
          case 'email':
            await this.sendEmail(alert, message, timestamp);
            break;
          case 'sms':
            await this.sendSMS(alert, message, timestamp);
            break;
        }
      } catch (error) {
        console.error(`[ALERT] Failed to send to ${channel}:`, error);
      }
    }

    // Log to database
    await this.logAlert(alert, message, timestamp);
  }

  /**
   * Console output
   */
  private sendConsole(alert: Alert, message: string, timestamp: string): void {
    const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    console.warn(`${emoji} [${timestamp}] [${alert.severity.toUpperCase()}] ${alert.name}`);
    console.warn(`   ${message}`);
    if (alert.runbookUrl) {
      console.warn(`   Runbook: ${alert.runbookUrl}`);
    }
  }

  /**
   * Slack webhook
   */
  private async sendSlack(alert: Alert, message: string, timestamp: string): Promise<void> {
    const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('[ALERT] Slack webhook not configured');
      return;
    }

    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const payload = {
      text: `${severityEmoji[alert.severity]} *${alert.severity.toUpperCase()}*: ${alert.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${alert.name}*\n${message}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Severity: ${alert.severity} | Time: ${timestamp}`,
            },
          ],
        },
      ],
    };

    if (alert.runbookUrl) {
      payload.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📖 <${alert.runbookUrl}|View Runbook>`,
        },
      });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Discord webhook
   */
  private async sendDiscord(alert: Alert, message: string, timestamp: string): Promise<void> {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('[ALERT] Discord webhook not configured');
      return;
    }

    const color = {
      critical: 0xff0000, // Red
      warning: 0xffff00, // Yellow
      info: 0x0000ff, // Blue
    };

    const payload = {
      embeds: [
        {
          title: `${alert.severity.toUpperCase()}: ${alert.name}`,
          description: message,
          color: color[alert.severity],
          timestamp,
          footer: {
            text: alert.runbookUrl ? `Runbook: ${alert.runbookUrl}` : 'Genesis Alerts',
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Email notification (placeholder - integrate with Resend/SendGrid)
   */
  private async sendEmail(alert: Alert, message: string, _timestamp: string): Promise<void> {
    // TODO: Integrate with email service
    console.warn(`[ALERT] Email would be sent: ${alert.name} - ${message}`);
  }

  /**
   * SMS notification (placeholder - integrate with Twilio)
   */
  private async sendSMS(alert: Alert, message: string, _timestamp: string): Promise<void> {
    // TODO: Integrate with Twilio
    // Only for CRITICAL alerts!
    console.warn(`[ALERT] SMS would be sent: ${alert.name} - ${message}`);
  }

  /**
   * Log alert to database for audit
   */
  private async logAlert(alert: Alert, message: string, _timestamp: string): Promise<void> {
    try {
      await supabase.from('activities').insert({
        type: 'system_alert',
        message: `[${alert.severity}] ${alert.name}: ${message}`,
        metadata: {
          alertName: alert.name,
          severity: alert.severity,
          channels: alert.channels,
          runbookUrl: alert.runbookUrl,
        },
      });
    } catch (error) {
      // Fail silently
      console.error('[ALERT] Failed to log alert:', error);
    }
  }

  /**
   * Acknowledge an alert (prevents further notifications until cleared)
   */
  acknowledge(alertName: string): void {
    const state = getAlertState(alertName);
    state.acknowledged = true;
    console.warn(`[ALERT] ${alertName} acknowledged`);
  }

  /**
   * Get current alert states
   */
  getAlertStates(): Record<string, AlertState & { alert: Alert }> {
    const result: Record<string, AlertState & { alert: Alert }> = {};

    for (const alert of ALERTS) {
      const state = getAlertState(alert.name);
      result[alert.name] = {
        ...state,
        alert,
      };
    }

    return result;
  }

  /**
   * Trigger a test alert
   */
  async testAlert(severity: 'critical' | 'warning' | 'info' = 'info'): Promise<void> {
    const testAlert: Alert = {
      name: 'test_alert',
      severity,
      condition: async () => true,
      message: async () => 'This is a test alert. If you received this, alerting is working!',
      cooldownSeconds: 0,
      channels: ['console', 'slack', 'discord'],
    };

    await this.sendAlert(testAlert, await testAlert.message());
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const alertManager = new AlertManager();

// ============================================================================
// SCHEDULED CHECKS
// ============================================================================

let alertInterval: ReturnType<typeof setInterval> | null = null;

export function startAlertMonitoring(intervalMs = 60_000): void {
  if (alertInterval) {
    clearInterval(alertInterval);
  }

  // Initial check
  alertManager.checkAlerts();

  // Schedule recurring checks
  alertInterval = setInterval(() => {
    alertManager.checkAlerts();
  }, intervalMs);

  // eslint-disable-next-line no-console
  console.log(`[ALERT] Monitoring started (checking every ${intervalMs / 1000}s)`);
}

export function stopAlertMonitoring(): void {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
    // eslint-disable-next-line no-console
    console.log('[ALERT] Monitoring stopped');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  alertManager,
  startAlertMonitoring,
  stopAlertMonitoring,
  ALERTS,
};
