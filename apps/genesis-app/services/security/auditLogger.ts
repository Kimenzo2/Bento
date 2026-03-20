/**
 * @module SecurityAuditLogger
 * @description Centralized security audit logging for compliance and forensics
 *
 * This service logs ALL security-relevant events for:
 * - Authentication (login, logout, failed attempts)
 * - Authorization (access grants, denials)
 * - Data access (reads, writes to sensitive data)
 * - Security violations (blocked attacks, rate limits)
 * - Configuration changes (permissions, settings)
 *
 * Logs are immutable and timestamped for forensic analysis.
 */

import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export type AuditEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_LOGOUT'
  | 'AUTH_PASSWORD_RESET'
  | 'AUTH_MFA_ENABLED'
  | 'AUTH_MFA_DISABLED'
  | 'AUTH_SESSION_EXPIRED'
  | 'ACCESS_GRANTED'
  | 'ACCESS_DENIED'
  | 'ACCESS_ESCALATION_ATTEMPT'
  | 'DATA_READ'
  | 'DATA_WRITE'
  | 'DATA_DELETE'
  | 'DATA_EXPORT'
  | 'SECURITY_XSS_BLOCKED'
  | 'SECURITY_SQLI_BLOCKED'
  | 'SECURITY_PATH_TRAVERSAL_BLOCKED'
  | 'SECURITY_CSRF_INVALID'
  | 'SECURITY_RATE_LIMIT_EXCEEDED'
  | 'SECURITY_CIRCUIT_BREAKER_OPENED'
  | 'SECURITY_SUSPICIOUS_ACTIVITY'
  | 'CONFIG_PERMISSION_CHANGED'
  | 'CONFIG_SETTING_CHANGED'
  | 'CONFIG_API_KEY_ROTATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_CHANGED';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEvent {
  /** Unique event ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Event type */
  type: AuditEventType;
  /** Severity level */
  severity: AuditSeverity;
  /** User ID if authenticated */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** IP address (hashed for privacy) */
  ipHash?: string;
  /** User agent string */
  userAgent?: string;
  /** Resource being accessed */
  resource?: string;
  /** Action attempted */
  action?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

export interface AuditQueryOptions {
  userId?: string;
  type?: AuditEventType | AuditEventType[];
  severity?: AuditSeverity | AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

class SecurityAuditLogger {
  private events: AuditEvent[] = [];
  private readonly maxLocalEvents = 10000;
  private eventCounter = 0;

  /**
   * Log a security audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
    };

    // Store locally
    this.events.push(auditEvent);
    this.trimEventsIfNeeded();

    // Log to main logger for persistence
    const context = {
      component: 'SecurityAudit',
      auditId: auditEvent.id,
      eventType: auditEvent.type,
      userId: auditEvent.userId,
      resource: auditEvent.resource,
      action: auditEvent.action,
      success: auditEvent.success,
    };

    switch (event.severity) {
      case 'critical':
        logger.error(`[AUDIT:${event.type}]`, null, context);
        break;
      case 'warning':
        logger.warn(`[AUDIT:${event.type}]`, context);
        break;
      default:
        logger.info(`[AUDIT:${event.type}]`, context);
    }

    // Critical events get special handling
    if (event.severity === 'critical') {
      this.handleCriticalEvent(auditEvent);
    }
  }

  /**
   * Log authentication events
   */
  logAuth(
    type:
      | 'AUTH_LOGIN_SUCCESS'
      | 'AUTH_LOGIN_FAILED'
      | 'AUTH_LOGOUT'
      | 'AUTH_PASSWORD_RESET'
      | 'AUTH_SESSION_EXPIRED',
    userId: string | undefined,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      type,
      severity: type === 'AUTH_LOGIN_FAILED' ? 'warning' : 'info',
      userId,
      success,
      action: type,
      metadata,
    });
  }

  /**
   * Log access control events
   */
  logAccess(
    type: 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'ACCESS_ESCALATION_ATTEMPT',
    userId: string | undefined,
    resource: string,
    action: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      type,
      severity:
        type === 'ACCESS_ESCALATION_ATTEMPT'
          ? 'critical'
          : type === 'ACCESS_DENIED'
            ? 'warning'
            : 'info',
      userId,
      resource,
      action,
      success,
      metadata,
    });
  }

  /**
   * Log data access events
   */
  logDataAccess(
    type: 'DATA_READ' | 'DATA_WRITE' | 'DATA_DELETE' | 'DATA_EXPORT',
    userId: string | undefined,
    resource: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      type,
      severity: type === 'DATA_DELETE' || type === 'DATA_EXPORT' ? 'warning' : 'info',
      userId,
      resource,
      action: type,
      success,
      metadata,
    });
  }

  /**
   * Log security violation events
   */
  logSecurityViolation(
    type:
      | 'SECURITY_XSS_BLOCKED'
      | 'SECURITY_SQLI_BLOCKED'
      | 'SECURITY_PATH_TRAVERSAL_BLOCKED'
      | 'SECURITY_CSRF_INVALID'
      | 'SECURITY_RATE_LIMIT_EXCEEDED'
      | 'SECURITY_CIRCUIT_BREAKER_OPENED'
      | 'SECURITY_SUSPICIOUS_ACTIVITY',
    userId: string | undefined,
    metadata: Record<string, unknown>
  ): void {
    this.log({
      type,
      severity: 'critical',
      userId,
      success: false,
      action: 'BLOCKED',
      metadata,
    });
  }

  /**
   * Log payment events
   */
  logPayment(
    type: 'PAYMENT_INITIATED' | 'PAYMENT_COMPLETED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CHANGED',
    userId: string,
    success: boolean,
    metadata: Record<string, unknown>
  ): void {
    this.log({
      type,
      severity: type === 'PAYMENT_FAILED' ? 'warning' : 'info',
      userId,
      success,
      action: type,
      metadata,
    });
  }

  /**
   * Query audit logs - uses early termination to avoid loading all events
   */
  query(options: AuditQueryOptions = {}): AuditEvent[] {
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const target = offset + limit;

    // Build predicate chain for single-pass filtering with early termination
    const predicates: Array<(e: AuditEvent) => boolean> = [];

    if (options.userId) {
      predicates.push((e) => e.userId === options.userId);
    }
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      predicates.push((e) => types.includes(e.type));
    }
    if (options.severity) {
      const severities = Array.isArray(options.severity) ? options.severity : [options.severity];
      predicates.push((e) => severities.includes(e.severity));
    }
    if (options.startDate) {
      predicates.push((e) => new Date(e.timestamp) >= options.startDate!);
    }
    if (options.endDate) {
      predicates.push((e) => new Date(e.timestamp) <= options.endDate!);
    }

    // Single-pass with early termination: collect only what's needed
    const matched: AuditEvent[] = [];
    let matchCount = 0;

    for (const event of this.events) {
      if (predicates.every((p) => p(event))) {
        matchCount++;
        if (matchCount > offset) {
          matched.push(event);
        }
        if (matched.length >= limit) {
          break; // Early termination - no need to scan further
        }
      }
    }

    return matched;
  }

  /**
   * Get security violations in the last N hours
   */
  getRecentViolations(hours = 24): AuditEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.query({
      severity: 'critical',
      startDate: cutoff,
    });
  }

  /**
   * Get failed login attempts for a user
   */
  getFailedLogins(userId: string, hours = 1): AuditEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.query({
      userId,
      type: 'AUTH_LOGIN_FAILED',
      startDate: cutoff,
    });
  }

  /**
   * Check if user has suspicious activity
   */
  hasSuspiciousActivity(userId: string): boolean {
    const recentFailures = this.getFailedLogins(userId, 1);
    return recentFailures.length >= 5; // 5+ failed logins in an hour
  }

  /**
   * Get audit summary for dashboard
   */
  getSummary(hours = 24): {
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<AuditSeverity, number>;
    violations: number;
    failedLogins: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recent = this.events.filter((e) => new Date(e.timestamp) >= cutoff);

    const byType: Record<string, number> = {};
    const bySeverity: Record<AuditSeverity, number> = { info: 0, warning: 0, critical: 0 };
    let violations = 0;
    let failedLogins = 0;

    for (const event of recent) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySeverity[event.severity]++;

      if (event.type.startsWith('SECURITY_')) violations++;
      if (event.type === 'AUTH_LOGIN_FAILED') failedLogins++;
    }

    return {
      totalEvents: recent.length,
      byType,
      bySeverity,
      violations,
      failedLogins,
    };
  }

  /**
   * Export audit logs for compliance
   */
  export(options: AuditQueryOptions = {}): string {
    const events = this.query(options);
    return JSON.stringify(events, null, 2);
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private generateEventId(): string {
    this.eventCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.eventCounter.toString(36).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 6);
    return `audit_${timestamp}_${counter}_${random}`;
  }

  private getLogMethod(severity: AuditSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warn';
      default:
        return 'info';
    }
  }

  private trimEventsIfNeeded(): void {
    if (this.events.length > this.maxLocalEvents) {
      // Keep the most recent half
      this.events = this.events.slice(-this.maxLocalEvents / 2);
    }
  }

  private handleCriticalEvent(event: AuditEvent): void {
    // In production, this would:
    // 1. Send to SIEM system
    // 2. Trigger PagerDuty/OpsGenie alert
    // 3. Send to security team Slack
    // 4. Update threat dashboard

    console.error(`[CRITICAL SECURITY EVENT] ${event.type}`, event);

    // Could also block user, revoke session, etc.
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const securityAudit = new SecurityAuditLogger();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Log a successful login
 */
export function auditLoginSuccess(userId: string, metadata?: Record<string, unknown>): void {
  securityAudit.logAuth('AUTH_LOGIN_SUCCESS', userId, true, metadata);
}

/**
 * Log a failed login attempt
 */
export function auditLoginFailed(
  userId: string | undefined,
  metadata?: Record<string, unknown>
): void {
  securityAudit.logAuth('AUTH_LOGIN_FAILED', userId, false, metadata);
}

/**
 * Log an access denial
 */
export function auditAccessDenied(
  userId: string | undefined,
  resource: string,
  action: string
): void {
  securityAudit.logAccess('ACCESS_DENIED', userId, resource, action, false);
}

/**
 * Log a security attack that was blocked
 */
export function auditAttackBlocked(
  type: 'xss' | 'sqli' | 'path_traversal' | 'csrf',
  userId: string | undefined,
  payload: string
): void {
  const typeMap = {
    xss: 'SECURITY_XSS_BLOCKED' as const,
    sqli: 'SECURITY_SQLI_BLOCKED' as const,
    path_traversal: 'SECURITY_PATH_TRAVERSAL_BLOCKED' as const,
    csrf: 'SECURITY_CSRF_INVALID' as const,
  };

  securityAudit.logSecurityViolation(typeMap[type], userId, {
    payload: payload.substring(0, 200), // Truncate for safety
  });
}

/**
 * Log rate limit exceeded
 */
export function auditRateLimitExceeded(
  userId: string | undefined,
  endpoint: string,
  limit: number
): void {
  securityAudit.logSecurityViolation('SECURITY_RATE_LIMIT_EXCEEDED', userId, {
    endpoint,
    limit,
  });
}
