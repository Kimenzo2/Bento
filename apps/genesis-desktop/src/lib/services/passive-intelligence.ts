// ═══════════════════════════════════════════════════════════════════════
// Passive Intelligence — Idle Detection, Focus/Rhythm Tracking, Inference
// ═══════════════════════════════════════════════════════════════════════
// Lightweight local-only behavioral inference. Tracks app activity windows,
// idle periods, focus sessions, and derives behavioral insights.
//
// PRIVACY: All inference happens locally. No data leaves the device.
// Signals are opt-in and can be toggled by the user.
// ═══════════════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import { eventBus, BentoEventType } from './event-bus';
import { time } from '$lib/utils/time';

// ─── Configuration ────────────────────────────────────────────────────

export interface PassiveIntelligenceConfig {
  enabled: boolean;
  idleThresholdSeconds: number; // Seconds before considering user idle (default 300 = 5min)
  minFocusMinutes: number; // Min duration to count as a focus session (default 5)
  maxIdleBreakMinutes: number; // Max idle gap within one session (default 15)
  historyRetentionDays: number; // How long to keep activity history (default 30)
}

const DEFAULT_CONFIG: PassiveIntelligenceConfig = {
  enabled: true,
  idleThresholdSeconds: 300,
  minFocusMinutes: 5,
  maxIdleBreakMinutes: 15,
  historyRetentionDays: 30,
};

// ─── Activity Records ─────────────────────────────────────────────────

export interface ActivityEvent {
  timestamp: number; // UTC ms
  type: 'input' | 'focus_start' | 'focus_end' | 'module_switch' | 'idle_start' | 'idle_end';
  moduleId?: string;
  duration?: number; // ms
}

export interface FocusSession {
  id: string;
  start: number; // UTC ms
  end: number | null; // UTC ms
  durationMinutes: number;
  quality: number | null; // 1-5 subjective, null = auto-inferred
  moduleId: string;
  interruptions: number;
}

export interface DailyRhythm {
  date: string; // "2026-05-09"
  sessionCount: number;
  totalActiveMinutes: number;
  totalIdleMinutes: number;
  firstActiveAt: number | null;
  lastActiveAt: number | null;
  focusSessions: number;
  peakProductivityHour: number | null;
}

export interface BurnoutSignal {
  detected: boolean;
  score: number; // 0-100
  signals: string[]; // e.g., ["late_night_work", "declining_focus", "missed_breaks"]
  insight: string;
  since: number; // UTC ms
}

// ─── Stores ───────────────────────────────────────────────────────────

class PassiveIntelligenceEngine {
  private config: PassiveIntelligenceConfig;
  private lastActivityTime = time.now();
  private idleStartedAt: number | null = null;
  private isIdle = false;
  private activityLog: ActivityEvent[] = [];
  private currentFocusSession: FocusSession | null = null;
  private focusSessions: FocusSession[] = [];
  private userIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private moduleEnterTime = time.now();
  private currentModule = 'dashboard';
  private dailyInputCount = 0;
  private dailyFocusMinutes = 0;
  private currentDateKey = time.dateKey(time.now());

  /** Current idle state (reactive). */
  readonly idleState = writable<boolean>(false);

  /** Current focus session (reactive). null when not in focus. */
  readonly activeFocusSession = writable<FocusSession | null>(null);

  /** Today's rhythm summary (reactive). */
  readonly todayRhythm = writable<DailyRhythm>(this.emptyRhythm());

  /** Last 50 focus sessions for charting. */
  readonly focusHistory = writable<FocusSession[]>([]);

  /** Burnout risk signal (reactive). Updated hourly. */
  readonly burnoutSignal = writable<BurnoutSignal>({
    detected: false,
    score: 0,
    signals: [],
    insight: 'Insufficient data to assess burnout risk.',
    since: time.now(),
  });

  constructor(config: Partial<PassiveIntelligenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventListeners();
    this.startBurnoutMonitor();
  }

  // ─── Public API ─────────────────────────────────────────────────────

  /** Record user input activity (call from keydown/mousedown handlers). */
  recordInput(moduleId?: string): void {
    if (!this.config.enabled) return;

    const now = time.now();
    this.checkDayRollover();
    this.dailyInputCount++;

    if (this.isIdle) {
      const idleDuration = this.idleStartedAt !== null ? now - this.idleStartedAt : 0;
      this.isIdle = false;
      this.idleStartedAt = null;
      this.idleState.set(false);
      this.logEvent('idle_end', moduleId, idleDuration);
      eventBus.emitSimple(BentoEventType.ActiveSessionStarted, 'passive', {
        moduleId: moduleId ?? this.currentModule,
        idleDurationMs: idleDuration,
      });
    }

    this.lastActivityTime = now;
    this.resetIdleTimer();
  }

  /** Notify engine of module switch. */
  onModuleSwitch(moduleId: string): void {
    const now = time.now();
    const duration = now - this.moduleEnterTime;

    // If user spent meaningful time in previous module, record it
    if (duration > this.config.minFocusMinutes * 60 * 1000) {
      this.recordFocusSegment(this.currentModule, this.moduleEnterTime, now);
    }

    this.currentModule = moduleId;
    this.moduleEnterTime = now;
    this.logEvent('module_switch', moduleId);
  }

  /** Get the config (read-only). */
  getConfig(): PassiveIntelligenceConfig {
    return { ...this.config };
  }

  /** Update config at runtime. */
  updateConfig(partial: Partial<PassiveIntelligenceConfig>): void {
    this.config = { ...this.config, ...partial };
    if (this.config.enabled) {
      this.resetIdleTimer();
    } else {
      this.stopIdleTimer();
    }
  }

  /** Get recent activity events for dashboard display. */
  getRecentActivity(minutes: number = 60): ActivityEvent[] {
    const since = time.now() - minutes * 60 * 1000;
    return this.activityLog.filter((e) => e.timestamp >= since);
  }

  /** Generate a behavioral insight summary. */
  generateInsights(): string[] {
    const insights: string[] = [];
    const rhythm = get(this.todayRhythm);
    const burnout = get(this.burnoutSignal);

    if (rhythm.totalActiveMinutes > 0) {
      if (rhythm.totalActiveMinutes < 60) {
        insights.push('Light activity day — consider a focus session.');
      } else if (rhythm.totalActiveMinutes > 480) {
        insights.push('Heavy app usage — remember to take breaks.');
      }
    }

    if (burnout.detected) {
      insights.push(burnout.insight);
    }

    const focusSessions = get(this.focusHistory);
    if (focusSessions.length >= 3) {
      const avgDuration =
        focusSessions.slice(-10).reduce((sum, s) => sum + (s.durationMinutes || 0), 0) /
        Math.min(focusSessions.length, 10);
      if (avgDuration < 15) {
        insights.push('Focus sessions are brief — try locking in for longer blocks.');
      } else if (avgDuration > 90) {
        insights.push('Long focus sessions — make sure to take short breaks between them.');
      }
    }

    if (this.dailyInputCount < 3) {
      insights.push('Low interaction today — anything you need help with?');
    }

    return insights;
  }

  // ─── Internal ───────────────────────────────────────────────────────

  private setupEventListeners(): void {
    eventBus.on(BentoEventType.FocusStarted, (e) => {
      this.currentFocusSession = {
        id: crypto.randomUUID(),
        start: time.now(),
        end: null,
        durationMinutes: 0,
        quality: null,
        moduleId: (e.payload.moduleId as string) ?? this.currentModule,
        interruptions: 0,
      };
      this.activeFocusSession.set(this.currentFocusSession);
    });

    eventBus.on(BentoEventType.FocusEnded, (_e) => {
      if (this.currentFocusSession) {
        const now = time.now();
        this.currentFocusSession.end = now;
        this.currentFocusSession.durationMinutes = (now - this.currentFocusSession.start) / 60_000;
        this.focusSessions.push(this.currentFocusSession);
        this.focusHistory.update((h) => {
          h.push(this.currentFocusSession!);
          if (h.length > 50) h.shift();
          return h;
        });
        this.currentFocusSession = null;
        this.activeFocusSession.set(null);
        this.updateTodayRhythm();
      }
    });

    eventBus.on(BentoEventType.FocusInterrupted, () => {
      if (this.currentFocusSession) {
        this.currentFocusSession.interruptions++;
        this.currentFocusSession.quality = Math.max(1, (this.currentFocusSession.quality ?? 3) - 1);
      }
    });
  }

  private resetIdleTimer(): void {
    this.stopIdleTimer();
    this.userIdleTimer = setTimeout(
      () => this.onUserIdle(),
      this.config.idleThresholdSeconds * 1000
    );
  }

  private stopIdleTimer(): void {
    if (this.userIdleTimer !== null) {
      clearTimeout(this.userIdleTimer);
      this.userIdleTimer = null;
    }
  }

  private onUserIdle(): void {
    if (!this.config.enabled) return;
    this.isIdle = true;
    this.idleStartedAt = time.now();
    this.idleState.set(true);
    this.logEvent('idle_start', this.currentModule);

    eventBus.emitSimple(BentoEventType.IdleDetected, 'passive', {
      idleDurationMs: this.config.idleThresholdSeconds * 1000,
      moduleId: this.currentModule,
    });

    // If there was an active focus session, end it
    if (this.currentFocusSession) {
      eventBus.emitSimple(BentoEventType.FocusEnded, 'passive', {
        moduleId: this.currentModule,
        reason: 'idle_timeout',
      });
    }

    this.updateTodayRhythm();
  }

  private checkDayRollover(): void {
    const todayKey = time.dateKey(time.now());
    if (todayKey !== this.currentDateKey) {
      // Reset daily counters on day boundary
      this.dailyInputCount = 0;
      this.dailyFocusMinutes = 0;
      this.currentDateKey = todayKey;
    }
  }

  private recordFocusSegment(moduleId: string, start: number, end: number): void {
    const minutes = (end - start) / 60_000;
    if (minutes < this.config.minFocusMinutes) return;

    const session: FocusSession = {
      id: crypto.randomUUID(),
      start,
      end,
      durationMinutes: minutes,
      quality: null,
      moduleId,
      interruptions: 0,
    };

    this.focusSessions.push(session);
    this.focusHistory.update((h) => {
      h.push(session);
      if (h.length > 50) h.shift();
      return h;
    });

    this.dailyFocusMinutes += minutes;
    this.updateTodayRhythm();

    eventBus.emitSimple(BentoEventType.ActiveSessionEnded, 'passive', {
      moduleId,
      durationMinutes: minutes,
    });
  }

  private logEvent(type: ActivityEvent['type'], moduleId?: string, duration?: number): void {
    this.activityLog.push({
      timestamp: time.now(),
      type,
      moduleId,
      duration,
    });

    // Trim old events (keep 7 days)
    const cutoff = time.now() - 7 * 24 * 60 * 60 * 1000;
    this.activityLog = this.activityLog.filter((e) => e.timestamp >= cutoff);
  }

  private updateTodayRhythm(): void {
    const today = time.dateKey(time.now());

    const focusSessions = this.focusSessions.filter((s) => {
      const d = time.dateKey(s.start);
      return d === today;
    });

    const activityTimes = this.activityLog
      .filter((e) => {
        const d = time.dateKey(e.timestamp);
        return d === today;
      })
      .map((e) => e.timestamp);

    const totalIdle = this.activityLog
      .filter((e) => e.type === 'idle_start' && time.dateKey(e.timestamp) === today)
      .reduce((sum, e) => sum + (e.duration ?? 0), 0);

    const firstActive = activityTimes.length > 0 ? Math.min(...activityTimes) : null;
    const lastActive = activityTimes.length > 0 ? Math.max(...activityTimes) : null;

    // Find peak productivity hour (hour with most activity events)
    const hourCounts = new Map<number, number>();
    activityTimes.forEach((t) => {
      const h = new Date(t).getHours();
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    });
    let peakHour: number | null = null;
    let maxCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    });

    const totalActive = focusSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    this.todayRhythm.set({
      date: today,
      sessionCount: focusSessions.length,
      totalActiveMinutes: Math.round(totalActive),
      totalIdleMinutes: Math.round(totalIdle / 60_000),
      firstActiveAt: firstActive,
      lastActiveAt: lastActive,
      focusSessions: focusSessions.length,
      peakProductivityHour: peakHour,
    });
  }

  private startBurnoutMonitor(): void {
    // Update burnout assessment every 30 minutes
    setInterval(() => this.assessBurnoutRisk(), 30 * 60 * 1000);
  }

  private assessBurnoutRisk(): void {
    const signals: string[] = [];
    let score = 0;

    // Signal: Late-night work (past 11 PM in the last 7 days)
    const lateNightActivity = this.activityLog.filter((e) => {
      const h = new Date(e.timestamp).getHours();
      return h >= 23 || h < 6;
    });
    if (lateNightActivity.length > 5) {
      signals.push('late_night_work');
      score += 25;
    }

    // Signal: Declining focus quality (last 10 sessions trending down)
    const recentFocus = this.focusSessions.slice(-10);
    if (recentFocus.length >= 4) {
      const firstHalf = recentFocus.slice(0, Math.floor(recentFocus.length / 2));
      const secondHalf = recentFocus.slice(Math.floor(recentFocus.length / 2));
      const avgFirst =
        firstHalf.reduce((s, f) => s + (f.durationMinutes || 0), 0) / firstHalf.length;
      const avgSecond =
        secondHalf.reduce((s, f) => s + (f.durationMinutes || 0), 0) / secondHalf.length;
      if (avgSecond < avgFirst * 0.7) {
        signals.push('declining_focus_duration');
        score += 20;
      }
    }

    // Signal: Missed breaks (sessions > 2 hours without idle)
    const longSessions = recentFocus.filter((s) => s.durationMinutes > 120);
    if (longSessions.length > 2) {
      signals.push('missed_breaks');
      score += 15;
    }

    // Signal: High session count with low quality
    if (recentFocus.length > 5) {
      const lowQuality = recentFocus.filter((s) => s.quality !== null && s.quality <= 2).length;
      if (lowQuality > recentFocus.length * 0.4) {
        signals.push('low_quality_focus');
        score += 20;
      }
    }

    // Signal: Consistent late-night pattern (>3 days)
    const uniqueLateDays = new Set(lateNightActivity.map((e) => time.dateKey(e.timestamp)));
    if (uniqueLateDays.size >= 3) {
      signals.push('consistent_late_nights');
      score += 20;
    }

    const detected = score >= 30;
    let insight = 'No burnout signals detected.';

    if (detected) {
      if (signals.includes('late_night_work') || signals.includes('consistent_late_nights')) {
        insight =
          'You have been active late at night on multiple recent days. Consider winding down earlier to protect your sleep.';
      } else if (signals.includes('declining_focus_duration')) {
        insight =
          'Your focus sessions have been getting shorter. This may indicate mental fatigue — try taking a full break day.';
      } else if (signals.includes('missed_breaks')) {
        insight =
          'Several long focus sessions without breaks detected. Regular short breaks improve long-term productivity.';
      } else {
        insight = 'Multiple burnout signals detected. Consider scaling back and prioritizing rest.';
      }
    }

    this.burnoutSignal.set({
      detected,
      score: Math.min(score, 100),
      signals,
      insight,
      since: time.now(),
    });

    if (detected) {
      eventBus.emitSimple(BentoEventType.BurnoutRisk, 'passive', {
        score: Math.min(score, 100),
        signals,
        insight,
      });
    }
  }

  private emptyRhythm(): DailyRhythm {
    return {
      date: time.dateKey(time.now()),
      sessionCount: 0,
      totalActiveMinutes: 0,
      totalIdleMinutes: 0,
      firstActiveAt: null,
      lastActiveAt: null,
      focusSessions: 0,
      peakProductivityHour: null,
    };
  }
}

/** Singleton passive intelligence engine. */
export const passiveIntelligence = new PassiveIntelligenceEngine();

// ─── Setup helpers ────────────────────────────────────────────────────

let inputHandlerAttached = false;

/**
 * Wire passive intelligence into user input events.
 * Call once from +layout.svelte after DOM is ready.
 */
export function attachInputTracking(): void {
  if (inputHandlerAttached) return;
  inputHandlerAttached = true;

  const handler = () => passiveIntelligence.recordInput();
  window.addEventListener('keydown', handler, { passive: true });
  window.addEventListener('mousedown', handler, { passive: true });
  window.addEventListener('touchstart', handler, { passive: true });
}

/**
 * Wire passive intelligence into module switching.
 * Call from shell components whenever module changes.
 */
export function trackModuleSwitch(moduleId: string): void {
  passiveIntelligence.onModuleSwitch(moduleId);
}
