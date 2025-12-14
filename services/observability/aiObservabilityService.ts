/**
 * AI Observability Service
 * 
 * Lightweight tracing and debugging for AI operations.
 * Designed for minimal overhead - all logging is async and non-blocking.
 * 
 * Features:
 * - Request/response tracing
 * - Latency tracking
 * - Error categorization
 * - Performance insights
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AITrace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  model: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  input?: {
    promptLength: number;
    hasImages: boolean;
    tier: string;
  };
  output?: {
    tokensUsed?: number;
    responseLength: number;
    hasImages: boolean;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metadata?: Record<string, any>;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
}

// ============================================================================
// TRACE STORAGE (In-memory circular buffer)
// ============================================================================

const MAX_TRACES = 1000;
const traces: AITrace[] = [];
let traceIndex = 0;

/**
 * Store a trace in the circular buffer
 */
function storeTrace(trace: AITrace): void {
  if (traces.length < MAX_TRACES) {
    traces.push(trace);
  } else {
    traces[traceIndex] = trace;
    traceIndex = (traceIndex + 1) % MAX_TRACES;
  }
}

// ============================================================================
// ID GENERATION
// ============================================================================

let traceCounter = 0;
let spanCounter = 0;

function generateTraceId(): string {
  return `trace_${Date.now()}_${++traceCounter}`;
}

function generateSpanId(): string {
  return `span_${Date.now()}_${++spanCounter}`;
}

// ============================================================================
// TRACING API
// ============================================================================

/**
 * Start a new trace for an AI operation
 */
export function startTrace(
  operation: string,
  model: string,
  input?: {
    promptLength: number;
    hasImages?: boolean;
    tier?: string;
  }
): SpanContext {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  
  const trace: AITrace = {
    traceId,
    spanId,
    operation,
    model,
    startTime: Date.now(),
    status: 'pending',
    input: input ? {
      promptLength: input.promptLength,
      hasImages: input.hasImages || false,
      tier: input.tier || 'unknown'
    } : undefined
  };
  
  storeTrace(trace);
  
  return { traceId, spanId };
}

/**
 * Start a child span within an existing trace
 */
export function startSpan(
  parentContext: SpanContext,
  operation: string,
  model: string
): SpanContext {
  const spanId = generateSpanId();
  
  const trace: AITrace = {
    traceId: parentContext.traceId,
    spanId,
    parentSpanId: parentContext.spanId,
    operation,
    model,
    startTime: Date.now(),
    status: 'pending'
  };
  
  storeTrace(trace);
  
  return { traceId: parentContext.traceId, spanId };
}

/**
 * Complete a trace/span successfully
 */
export function endTrace(
  context: SpanContext,
  output?: {
    tokensUsed?: number;
    responseLength: number;
    hasImages?: boolean;
  }
): void {
  const trace = traces.find(t => t.spanId === context.spanId);
  if (trace) {
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = 'success';
    trace.output = output ? {
      tokensUsed: output.tokensUsed,
      responseLength: output.responseLength,
      hasImages: output.hasImages || false
    } : undefined;
    
    // Log if slow (>5s for text, >15s for images)
    const slowThreshold = trace.output?.hasImages ? 15000 : 5000;
    if (trace.duration > slowThreshold) {
      console.warn(`🐌 Slow AI operation: ${trace.operation} took ${trace.duration}ms`);
    }
  }
}

/**
 * Mark a trace/span as failed
 */
export function failTrace(
  context: SpanContext,
  error: {
    code: string;
    message: string;
    retryable?: boolean;
  }
): void {
  const trace = traces.find(t => t.spanId === context.spanId);
  if (trace) {
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = 'error';
    trace.error = {
      code: error.code,
      message: error.message,
      retryable: error.retryable ?? false
    };
    
    console.error(`❌ AI operation failed: ${trace.operation} - ${error.code}: ${error.message}`);
  }
}

// ============================================================================
// QUERY API
// ============================================================================

/**
 * Get recent traces (for debugging UI)
 */
export function getRecentTraces(count: number = 50): AITrace[] {
  return [...traces]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, count);
}

/**
 * Get traces by operation type
 */
export function getTracesByOperation(operation: string): AITrace[] {
  return traces.filter(t => t.operation === operation);
}

/**
 * Get failed traces
 */
export function getFailedTraces(): AITrace[] {
  return traces.filter(t => t.status === 'error');
}

/**
 * Get trace by ID
 */
export function getTrace(traceId: string): AITrace | undefined {
  return traces.find(t => t.traceId === traceId);
}

// ============================================================================
// METRICS
// ============================================================================

export interface AIMetrics {
  totalOperations: number;
  successRate: number;
  averageLatency: number;
  p95Latency: number;
  errorsByType: Record<string, number>;
  operationBreakdown: Record<string, {
    count: number;
    avgLatency: number;
    successRate: number;
  }>;
}

/**
 * Calculate metrics from stored traces
 */
export function getMetrics(): AIMetrics {
  const completed = traces.filter(t => t.status !== 'pending');
  const successful = completed.filter(t => t.status === 'success');
  const failed = completed.filter(t => t.status === 'error');
  
  // Calculate latencies
  const latencies = successful
    .map(t => t.duration || 0)
    .filter(d => d > 0)
    .sort((a, b) => a - b);
  
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;
  
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Index] || 0;
  
  // Error breakdown
  const errorsByType: Record<string, number> = {};
  for (const trace of failed) {
    const code = trace.error?.code || 'unknown';
    errorsByType[code] = (errorsByType[code] || 0) + 1;
  }
  
  // Operation breakdown
  const operationBreakdown: Record<string, { count: number; avgLatency: number; successRate: number }> = {};
  const operationGroups = new Map<string, AITrace[]>();
  
  for (const trace of completed) {
    const op = trace.operation;
    if (!operationGroups.has(op)) {
      operationGroups.set(op, []);
    }
    operationGroups.get(op)!.push(trace);
  }
  
  for (const [op, opTraces] of operationGroups) {
    const opSuccessful = opTraces.filter(t => t.status === 'success');
    const opLatencies = opSuccessful.map(t => t.duration || 0).filter(d => d > 0);
    
    operationBreakdown[op] = {
      count: opTraces.length,
      avgLatency: opLatencies.length > 0
        ? opLatencies.reduce((a, b) => a + b, 0) / opLatencies.length
        : 0,
      successRate: opTraces.length > 0
        ? (opSuccessful.length / opTraces.length) * 100
        : 0
    };
  }
  
  return {
    totalOperations: completed.length,
    successRate: completed.length > 0 ? (successful.length / completed.length) * 100 : 0,
    averageLatency: avgLatency,
    p95Latency,
    errorsByType,
    operationBreakdown
  };
}

// ============================================================================
// HELPER: TRACED EXECUTION
// ============================================================================

/**
 * Execute an async function with automatic tracing
 */
export async function traced<T>(
  operation: string,
  model: string,
  fn: () => Promise<T>,
  options?: {
    promptLength?: number;
    tier?: string;
    hasImages?: boolean;
  }
): Promise<T> {
  const context = startTrace(operation, model, {
    promptLength: options?.promptLength || 0,
    hasImages: options?.hasImages,
    tier: options?.tier
  });
  
  try {
    const result = await fn();
    
    // Try to determine output size
    let responseLength = 0;
    if (typeof result === 'string') {
      responseLength = result.length;
    } else if (result && typeof result === 'object') {
      responseLength = JSON.stringify(result).length;
    }
    
    endTrace(context, {
      responseLength,
      hasImages: typeof result === 'string' && result.includes('http')
    });
    
    return result;
  } catch (error: any) {
    failTrace(context, {
      code: error.code || 'UNKNOWN',
      message: error.message || String(error),
      retryable: error.retryable ?? false
    });
    throw error;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  startTrace,
  startSpan,
  endTrace,
  failTrace,
  getRecentTraces,
  getTracesByOperation,
  getFailedTraces,
  getTrace,
  getMetrics,
  traced
};
