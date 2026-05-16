import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { z } from 'zod';

const moduleStateSchema = z.enum([
  'OFFLINE',
  'IDLE',
  'ACTIVE',
  'DEGRADED',
  'CRITICAL',
  'RECOVERING',
  'FROZEN',
]);

const severitySchema = z.enum(['INFO', 'WARN', 'CRITICAL']);
const anomalyTypeSchema = z.enum(['memory_spike', 'slow_ipc', 'slow_db', 'rapid_growth', 'frozen']);
const healActionSchema = z.enum([
  'suggest_gc',
  'reload_module',
  'vacuum_db',
  'clear_module_cache',
  'throttle_ipc_rate',
  'log_only',
]);

const overviewCardSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  status: z.string(),
  sparkline: z.array(z.number()),
  note: z.string(),
});

const miniAppTileSchema = z.object({
  miniAppId: z.string(),
  label: z.string(),
  state: moduleStateSchema,
  heapMb: z.number().nullable().optional(),
  jsHeapMb: z.number().nullable().optional(),
  anomalyCount: z.number(),
  lastAction: z.string(),
  lastSeenAt: z.string(),
  sparkline: z.array(z.number()),
});

const activityFeedItemSchema = z.object({
  at: z.string(),
  title: z.string(),
  detail: z.string(),
  tone: z.string(),
});

const brainOverviewSchema = z.object({
  generatedAt: z.string(),
  overallState: z.string(),
  lastEvent: z.string(),
  cards: z.array(overviewCardSchema),
  miniApps: z.array(miniAppTileSchema),
  recentActivity: z.array(activityFeedItemSchema),
});

const graphPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const stateHistoryEntrySchema = z.object({
  at: z.string(),
  state: moduleStateSchema,
});

const insightCardSchema = z.object({
  title: z.string(),
  confidence: z.number(),
  observations: z.number(),
  description: z.string(),
});

const anomalyHistoryEntrySchema = z.object({
  at: z.string(),
  severity: severitySchema,
  kind: anomalyTypeSchema,
  message: z.string(),
  healAction: healActionSchema.nullable().optional(),
  resolvedInMs: z.number().nullable().optional(),
});

const miniAppPickerItemSchema = z.object({
  miniAppId: z.string(),
  label: z.string(),
  state: moduleStateSchema,
});

const moduleDetailSchema = z.object({
  generatedAt: z.string(),
  selectedModuleId: z.string(),
  selectedLabel: z.string(),
  selectedState: moduleStateSchema,
  activeSince: z.string(),
  memoryPoints: z.array(graphPointSchema),
  baselineHeapMb: z.number(),
  peakHeapMb: z.number(),
  rateMbPerMin: z.number(),
  projectedHeap5m: z.number(),
  projectionStatus: z.string(),
  ipcAvgMs: z.number(),
  ipcP95Ms: z.number(),
  dbAvgMs: z.number(),
  dbP95Ms: z.number(),
  stateHistory: z.array(stateHistoryEntrySchema),
  insights: z.array(insightCardSchema),
  anomalyHistory: z.array(anomalyHistoryEntrySchema),
  availableModules: z.array(miniAppPickerItemSchema),
});

const predictionInsightCardSchema = z.object({
  miniAppId: z.string(),
  metric: z.string(),
  currentValue: z.number(),
  projectedValueIn5min: z.number(),
  timeToThresholdSecs: z.number().nullable().optional(),
  wasCorrect: z.boolean().nullable().optional(),
});

const healingResultSchema = z.object({
  status: z.string(),
  message: z.string(),
});

const healingFeedItemSchema = z.object({
  at: z.string(),
  miniAppId: z.string(),
  action: healActionSchema,
  result: healingResultSchema,
  resolvedInMs: z.number(),
});

const insightsSchema = z.object({
  generatedAt: z.string(),
  newThisWeek: z.number(),
  insights: z.array(insightCardSchema),
  predictions: z.array(predictionInsightCardSchema),
  healings: z.array(healingFeedItemSchema),
});

const brainEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('metrics_delta'),
    module: z.string(),
    heapMb: z.number().nullable().optional(),
    state: moduleStateSchema.nullable().optional(),
    ipcMs: z.number().nullable().optional(),
  }),
  z.object({
    kind: z.literal('anomaly_detected'),
    module: z.string(),
    anomalyType: anomalyTypeSchema,
    severity: severitySchema,
    message: z.string(),
    projectedIfIgnored: z.string(),
  }),
  z.object({
    kind: z.literal('healing_applied'),
    module: z.string(),
    actionTaken: healActionSchema,
    result: healingResultSchema,
    msToResolve: z.number(),
  }),
  z.object({
    kind: z.literal('insight_discovered'),
    correlation: z.string(),
    confidence: z.number(),
    observedNTimes: z.number(),
  }),
  z.object({
    kind: z.literal('predictive_warning'),
    module: z.string(),
    metric: z.string(),
    currentValue: z.number(),
    projectedValueIn5min: z.number(),
    timeToThresholdSecs: z.number(),
  }),
  z.object({
    kind: z.literal('clock_tick'),
    timestampMs: z.number(),
    generatedAt: z.string(),
  }),
]);

export type TelemetryRange = '24h' | '7d' | '30d';
export type BrainOverviewPayload = z.infer<typeof brainOverviewSchema>;
export type ModuleDetailPayload = z.infer<typeof moduleDetailSchema>;
export type InsightsPayload = z.infer<typeof insightsSchema>;
export type BrainEvent = z.infer<typeof brainEventSchema>;

function requireDesktopTelemetry() {
  if (!isTauri()) {
    throw new Error('Telemetry brain is only live inside the Genesis desktop runtime.');
  }
}

export async function getTelemetryBrainOverview(range: TelemetryRange): Promise<BrainOverviewPayload> {
  requireDesktopTelemetry();
  const result = await invoke<unknown>('get_telemetry_brain_overview', { range });
  return brainOverviewSchema.parse(result);
}

export async function getTelemetryModuleDetail(
  range: TelemetryRange,
  miniAppId?: string,
): Promise<ModuleDetailPayload> {
  requireDesktopTelemetry();
  const result = await invoke<unknown>('get_telemetry_module_detail', { range, miniAppId });
  return moduleDetailSchema.parse(result);
}

export async function getTelemetryInsights(range: TelemetryRange): Promise<InsightsPayload> {
  requireDesktopTelemetry();
  const result = await invoke<unknown>('get_telemetry_insights', { range });
  return insightsSchema.parse(result);
}

export async function subscribeBrainEvents(onEvent: (event: BrainEvent) => void) {
  requireDesktopTelemetry();

  const onEventChannel = new Channel<unknown>();
  onEventChannel.onmessage = (payload) => {
    onEvent(normalizeBrainEvent(payload));
  };

  await invoke('subscribe_brain_events', { onEvent: onEventChannel });
  return () => {
    onEventChannel.onmessage = () => {};
  };
}

function normalizeBrainEvent(payload: unknown): BrainEvent {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid brain event payload');
  }

  const keyed = payload as Record<string, unknown>;
  if ('MetricsDelta' in keyed) {
    const value = keyed.MetricsDelta as Record<string, unknown>;
    return brainEventSchema.parse({
      kind: 'metrics_delta',
      module: value.module,
      heapMb: value.heap_mb,
      state: value.state,
      ipcMs: value.ipc_ms,
    });
  }
  if ('AnomalyDetected' in keyed) {
    const value = keyed.AnomalyDetected as Record<string, unknown>;
    return brainEventSchema.parse({
      kind: 'anomaly_detected',
      module: value.module,
      anomalyType: value.anomaly_type,
      severity: value.severity,
      message: value.message,
      projectedIfIgnored: value.projected_if_ignored,
    });
  }
  if ('HealingApplied' in keyed) {
    const value = keyed.HealingApplied as Record<string, unknown>;
    return brainEventSchema.parse({
      kind: 'healing_applied',
      module: value.module,
      actionTaken: value.action_taken,
      result: value.result,
      msToResolve: value.ms_to_resolve,
    });
  }
  if ('InsightDiscovered' in keyed) {
    const value = keyed.InsightDiscovered as Record<string, unknown>;
    return brainEventSchema.parse({
      kind: 'insight_discovered',
      correlation: value.correlation,
      confidence: value.confidence,
      observedNTimes: value.observed_n_times,
    });
  }
  if ('ClockTick' in keyed) {
    const value = keyed.ClockTick as Record<string, unknown>;
    return brainEventSchema.parse({
      kind: 'clock_tick',
      timestampMs: value.timestamp_ms,
      generatedAt: value.generated_at,
    });
  }

  const value = (keyed.PredictiveWarning ?? {}) as Record<string, unknown>;
  return brainEventSchema.parse({
    kind: 'predictive_warning',
    module: value.module,
    metric: value.metric,
    currentValue: value.current_value,
    projectedValueIn5min: value.projected_value_in_5min,
    timeToThresholdSecs: value.time_to_threshold_secs,
  });
}
