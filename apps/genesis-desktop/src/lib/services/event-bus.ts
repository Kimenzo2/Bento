// ═══════════════════════════════════════════════════════════════════════
// Cross-App Event Bus — Typed Signal System for Module-to-Module Comm.
// ═══════════════════════════════════════════════════════════════════════
// Provides a typed pub/sub event bus that enables modules to communicate
// without direct coupling. Events flow through the bus; modules subscribe
// only to the signals they care about.
//
// Architecture:
//   Module A emits → Event Bus → Module B (subscribed listener)
//   Rust backend emits → Tauri event → Event Bus → Module B
//
// All events are typed, serializable, and carry a source + timestamp.
// ═══════════════════════════════════════════════════════════════════════

import { get, writable } from 'svelte/store';
import { time } from '$lib/utils/time';

// ─── Event Types ──────────────────────────────────────────────────────

/** Canonical list of all cross-app events Bento modules can emit/receive. */
export enum BentoEventType {
  // Health → Life
  SleepLogged = 'health:sleep-logged',
  HydrationLogged = 'health:hydration-logged',
  MealLogged = 'health:meal-logged',
  MoodLogged = 'health:mood-logged',
  FocusSessionComplete = 'health:focus-complete',
  WeightLogged = 'health:weight-logged',
  EnergyLogged = 'health:energy-logged',

  // Habits → Activity
  HabitCompleted = 'habits:habit-completed',
  StreakAchieved = 'habits:streak-achieved',
  StreakBroken = 'habits:streak-broken',

  // Tasks → Productivity
  TaskCreated = 'tasks:task-created',
  TaskCompleted = 'tasks:task-completed',
  TaskOverdue = 'tasks:task-overdue',

  // Focus → Context
  FocusStarted = 'focus:started',
  FocusEnded = 'focus:ended',
  FocusInterrupted = 'focus:interrupted',

  // Goals → Progress
  GoalProgress = 'goals:progress-update',
  GoalAchieved = 'goals:goal-achieved',

  // Time → Awareness
  ReminderFired = 'time:reminder-fired',
  ScheduleDue = 'time:schedule-due',

  // Mood → Recommendations
  MoodPattern = 'mood:pattern-detected',

  // Sleep → Context
  SleepPattern = 'sleep:pattern-detected',

  // Passive Intelligence
  IdleDetected = 'passive:idle-detected',
  ActiveSessionStarted = 'passive:active-session-started',
  ActiveSessionEnded = 'passive:active-session-ended',
  FocusQualityChange = 'passive:focus-quality-change',
  BurnoutRisk = 'passive:burnout-risk',

  // System
  ModuleSwitched = 'system:module-switched',
  AppReady = 'system:app-ready',
  SettingsChanged = 'system:settings-changed',
}

// ─── Event Payloads ───────────────────────────────────────────────────

export interface BentoEvent {
  type: BentoEventType;
  source: string;        // module id, e.g. "sleep", "focus", "system"
  timestamp: number;     // UTC ms
  payload: Record<string, unknown>;
}

/** Helper to build a typed event. */
export function createEvent(
  type: BentoEventType,
  source: string,
  payload: Record<string, unknown> = {},
): BentoEvent {
  return { type, source, timestamp: time.now(), payload };
}

// ─── Event Bus ────────────────────────────────────────────────────────

type Listener = (event: BentoEvent) => void;

class EventBus {
  private listeners = new Map<BentoEventType, Set<Listener>>();
  private allListeners = new Set<Listener>();

  /** History store for dashboard widgets (last 200 events). */
  readonly history = writable<BentoEvent[]>([]);

  /** Subscribe to a specific event type. */
  on(eventType: BentoEventType, listener: Listener): () => void {
    return this.add(eventType, listener);
  }

  /** Subscribe to all events (for dashboard/telemetry). */
  onAny(listener: Listener): () => void {
    this.allListeners.add(listener);
    return () => this.allListeners.delete(listener);
  }

  /** Emit an event to all subscribers. */
  emit(event: BentoEvent): void {
    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((l) => {
        try { l(event); } catch (e) {
          console.warn(`[event-bus] Listener error for ${event.type}:`, e);
        }
      });
    }

    // Notify catch-all listeners
    this.allListeners.forEach((l) => {
      try { l(event); } catch (e) {
        console.warn(`[event-bus] onAny listener error:`, e);
      }
    });

    // Append to history
    this.history.update((h) => {
      h.push(event);
      if (h.length > 200) h.shift();
      return h;
    });
  }

  /** Emit without building a BentoEvent manually. */
  emitSimple(
    type: BentoEventType,
    source: string,
    payload: Record<string, unknown> = {},
  ): void {
    this.emit(createEvent(type, source, payload));
  }

  /** Remove all listeners. */
  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
    this.history.set([]);
  }

  /** Count active listeners. */
  get listenerCount(): number {
    let count = this.allListeners.size;
    this.listeners.forEach((s) => (count += s.size));
    return count;
  }

  private add(eventType: BentoEventType, listener: Listener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return () => this.listeners.get(eventType)?.delete(listener);
  }
}

/** Singleton event bus instance. */
export const eventBus = new EventBus();

// ─── Tauri Event Bridge ───────────────────────────────────────────────
// Bridges Tauri backend events into the typed event bus.

/**
 * Initialize the Tauri → EventBus bridge.
 * Call once at app startup (e.g., in +layout.svelte).
 */
export async function initEventBridge(): Promise<() => void> {
  const unlisteners: (() => void)[] = [];

  try {
    const { listen } = await import('@tauri-apps/api/event');

    // Listen for schedule-fire events from Rust scheduler worker
    const unlistenSchedule = await listen<{
      scheduleId: string;
      moduleId: string;
      label: string;
    }>('bento://schedule-fire', (e) => {
      eventBus.emitSimple(
        BentoEventType.ScheduleDue,
        'system',
        {
          scheduleId: e.payload.scheduleId,
          moduleId: e.payload.moduleId,
          label: e.payload.label,
        },
      );
    });
    unlisteners.push(unlistenSchedule);

    // Listen for front-end module switch events
    const unlistenModuleSwitch = await listen<{
      from: string;
      to: string;
    }>('bento://module-switch', (e) => {
      eventBus.emitSimple(
        BentoEventType.ModuleSwitched,
        'system',
        {
          from: e.payload.from,
          to: e.payload.to,
        },
      );
    });
    unlisteners.push(unlistenModuleSwitch);

    console.log('[event-bus] Tauri bridge initialized');
  } catch (err) {
    console.warn('[event-bus] Tauri not available, running in browser-only mode:', err);
  }

  return () => unlisteners.forEach((u) => u());
}
