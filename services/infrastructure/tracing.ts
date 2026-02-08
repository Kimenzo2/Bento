/**
 * Mars-Class Infrastructure - OpenTelemetry Distributed Tracing
 *
 * Provides visibility into distributed operations across the entire stack.
 *
 * THE PROBLEM:
 * - Genesis is distributed: Client → Edge → API → DB → Redis → AI
 * - Failures cascade: DB timeout appears as API error to user
 * - At 1M users, logs scroll too fast for human perception
 * - "Checking the logs" is impossible at scale
 *
 * THE SOLUTION (Distributed Tracing):
 * - Every request gets a unique Trace ID
 * - Trace ID propagated to all downstream services
 * - Spans capture timing for each operation
 * - High-cardinality queries: "Show traces where user_id=X and latency>500ms"
 *
 * INTEGRATION:
 * - Frontend: Browser timing + user interaction spans
 * - Edge Functions: Automatic instrumentation
 * - Database: Query tracing via pg_stat_statements
 * - AI Services: Token usage + latency spans
 */

// ============================================================================
// TYPES
// ============================================================================

export enum SpanKind {
  INTERNAL = 'INTERNAL',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

export enum SpanStatus {
  UNSET = 'UNSET',
  OK = 'OK',
  ERROR = 'ERROR',
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

// Web Vitals type (not in all TS libs)
interface LayoutShift extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export interface Span {
  name: string;
  context: SpanContext;
  parentSpanId?: string;
  kind: SpanKind;
  status: SpanStatus;
  statusMessage?: string;
  startTime: number;
  endTime?: number;
  attributes: SpanAttributes;
  events: SpanEvent[];
}

export interface Trace {
  traceId: string;
  spans: Span[];
  rootSpan?: Span;
  duration?: number;
  status: SpanStatus;
}

export interface TracerConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  endpoint?: string;
  sampleRate: number;
  maxSpansPerTrace: number;
  flushIntervalMs: number;
  enableConsoleExport: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const DEFAULT_TRACER_CONFIG: TracerConfig = {
  serviceName: 'genesis-frontend',
  serviceVersion: getEnv('VITE_APP_VERSION') || '2.0.0',
  environment: getEnv('VITE_ENVIRONMENT') || 'development',
  endpoint: getEnv('VITE_OTEL_ENDPOINT'),
  sampleRate: 1.0, // Sample everything in dev, reduce in prod
  maxSpansPerTrace: 100,
  flushIntervalMs: 5000,
  enableConsoleExport: getEnv('NODE_ENV') !== 'production',
};

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate a random trace ID (32 hex chars = 128 bits)
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random span ID (16 hex chars = 64 bits)
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// CONTEXT PROPAGATION
// ============================================================================

const TRACEPARENT_HEADER = 'traceparent';
const TRACESTATE_HEADER = 'tracestate';

/**
 * Parse W3C traceparent header
 * Format: {version}-{trace-id}-{parent-id}-{trace-flags}
 */
export function parseTraceParent(header: string): SpanContext | null {
  const parts = header.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flags] = parts;

  if (version !== '00') return null;
  if (traceId.length !== 32) return null;
  if (spanId.length !== 16) return null;

  return {
    traceId,
    spanId,
    traceFlags: Number.parseInt(flags, 16),
  };
}

/**
 * Create W3C traceparent header
 */
export function createTraceParent(context: SpanContext): string {
  const flags = context.traceFlags.toString(16).padStart(2, '0');
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Extract trace context from headers
 */
export function extractContext(headers: Headers | Record<string, string>): SpanContext | null {
  const traceparent =
    headers instanceof Headers ? headers.get(TRACEPARENT_HEADER) : headers[TRACEPARENT_HEADER];

  if (!traceparent) return null;
  return parseTraceParent(traceparent);
}

/**
 * Inject trace context into headers
 */
export function injectContext(
  context: SpanContext,
  headers: Headers | Record<string, string>
): void {
  const traceparent = createTraceParent(context);

  if (headers instanceof Headers) {
    headers.set(TRACEPARENT_HEADER, traceparent);
    if (context.traceState) {
      headers.set(TRACESTATE_HEADER, context.traceState);
    }
  } else {
    headers[TRACEPARENT_HEADER] = traceparent;
    if (context.traceState) {
      headers[TRACESTATE_HEADER] = context.traceState;
    }
  }
}

// ============================================================================
// SPAN BUILDER
// ============================================================================

class SpanBuilder {
  private span: Span;

  constructor(
    name: string,
    traceId: string,
    parentSpanId?: string,
    kind: SpanKind = SpanKind.INTERNAL
  ) {
    this.span = {
      name,
      context: {
        traceId,
        spanId: generateSpanId(),
        traceFlags: 1, // Sampled
      },
      parentSpanId,
      kind,
      status: SpanStatus.UNSET,
      startTime: performance.now(),
      attributes: {},
      events: [],
    };
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: SpanAttributes): this {
    Object.assign(this.span.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: SpanAttributes): this {
    this.span.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
    return this;
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.span.status = status;
    this.span.statusMessage = message;
    return this;
  }

  end(): Span {
    this.span.endTime = performance.now();
    if (this.span.status === SpanStatus.UNSET) {
      this.span.status = SpanStatus.OK;
    }
    return this.span;
  }

  getContext(): SpanContext {
    return this.span.context;
  }
}

// ============================================================================
// TRACER
// ============================================================================

export class Tracer {
  private readonly config: TracerConfig;
  private readonly traces = new Map<string, Span[]>();
  private readonly activeSpans = new Map<string, SpanBuilder>();
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<TracerConfig> = {}) {
    this.config = { ...DEFAULT_TRACER_CONFIG, ...config };

    // Start periodic flush
    if (typeof window !== 'undefined') {
      this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
    }
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options: {
      parent?: SpanContext;
      kind?: SpanKind;
      attributes?: SpanAttributes;
    } = {}
  ): SpanBuilder {
    // Sampling decision
    if (Math.random() > this.config.sampleRate) {
      // Return a no-op span for unsampled traces
      return new SpanBuilder(name, generateTraceId());
    }

    const traceId = options.parent?.traceId ?? generateTraceId();
    const parentSpanId = options.parent?.spanId;

    const builder = new SpanBuilder(name, traceId, parentSpanId, options.kind);

    if (options.attributes) {
      builder.setAttributes(options.attributes);
    }

    // Add standard attributes
    builder.setAttributes({
      'service.name': this.config.serviceName,
      'service.version': this.config.serviceVersion,
      'deployment.environment': this.config.environment,
    });

    // Store active span
    this.activeSpans.set(builder.getContext().spanId, builder);

    return builder;
  }

  /**
   * End a span and record it
   */
  endSpan(builder: SpanBuilder): void {
    const span = builder.end();
    this.activeSpans.delete(span.context.spanId);

    // Store in traces
    if (!this.traces.has(span.context.traceId)) {
      this.traces.set(span.context.traceId, []);
    }

    const traceSpans = this.traces.get(span.context.traceId)!;

    // Enforce max spans limit
    if (traceSpans.length < this.config.maxSpansPerTrace) {
      traceSpans.push(span);
    }

    // Console export for development
    if (this.config.enableConsoleExport) {
      this.logSpan(span);
    }
  }

  /**
   * Create a traced wrapper for async functions
   */
  trace<T>(
    name: string,
    fn: (span: SpanBuilder) => Promise<T>,
    options?: { parent?: SpanContext; attributes?: SpanAttributes }
  ): Promise<T> {
    const span = this.startSpan(name, options);

    return fn(span)
      .then((result) => {
        span.setStatus(SpanStatus.OK);
        this.endSpan(span);
        return result;
      })
      .catch((error) => {
        span.setStatus(SpanStatus.ERROR, error.message);
        span.setAttribute('error.type', error.name);
        span.setAttribute('error.message', error.message);
        this.endSpan(span);
        throw error;
      });
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | null {
    const spans = this.traces.get(traceId);
    if (!spans?.length) return null;

    const rootSpan = spans.find((s) => !s.parentSpanId);
    const duration =
      rootSpan?.endTime && rootSpan.startTime ? rootSpan.endTime - rootSpan.startTime : undefined;

    const hasError = spans.some((s) => s.status === SpanStatus.ERROR);

    return {
      traceId,
      spans,
      rootSpan,
      duration,
      status: hasError ? SpanStatus.ERROR : SpanStatus.OK,
    };
  }

  /**
   * Flush traces to backend
   */
  async flush(): Promise<void> {
    if (this.traces.size === 0) return;

    const tracesToFlush = Array.from(this.traces.entries());
    this.traces.clear();

    if (!this.config.endpoint) return;

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceSpans: [
            {
              resource: {
                attributes: [
                  { key: 'service.name', value: { stringValue: this.config.serviceName } },
                  { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
                ],
              },
              scopeSpans: [
                {
                  spans: tracesToFlush.flatMap(([_, spans]) =>
                    spans.map(this.convertToOTLPSpan.bind(this))
                  ),
                },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      console.error('[Tracer] Failed to flush traces:', error);
      // Re-add traces on failure
      for (const [traceId, spans] of tracesToFlush) {
        this.traces.set(traceId, spans);
      }
    }
  }

  /**
   * Shutdown tracer
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  private convertToOTLPSpan(span: Span): object {
    return {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: Object.values(SpanKind).indexOf(span.kind) + 1,
      startTimeUnixNano: Math.floor(span.startTime * 1000000),
      endTimeUnixNano: span.endTime ? Math.floor(span.endTime * 1000000) : undefined,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value:
          typeof value === 'string'
            ? { stringValue: value }
            : typeof value === 'number'
              ? { intValue: value }
              : { boolValue: value },
      })),
      events: span.events.map((e) => ({
        name: e.name,
        timeUnixNano: Math.floor(e.timestamp * 1000000),
        attributes: e.attributes
          ? Object.entries(e.attributes).map(([key, value]) => ({
              key,
              value: { stringValue: String(value) },
            }))
          : [],
      })),
      status: {
        code: span.status === SpanStatus.ERROR ? 2 : span.status === SpanStatus.OK ? 1 : 0,
        message: span.statusMessage,
      },
    };
  }

  private logSpan(span: Span): void {
    const duration =
      span.endTime && span.startTime ? (span.endTime - span.startTime).toFixed(2) : '?';

    const statusIcon = span.status === SpanStatus.ERROR ? '❌' : '✅';

    console.warn(
      `${statusIcon} [${span.context.traceId.slice(0, 8)}] ${span.name} (${duration}ms)`,
      span.attributes
    );
  }
}

// ============================================================================
// INSTRUMENTED FETCH
// ============================================================================

/**
 * Create an instrumented fetch that automatically traces requests.
 */
export function createInstrumentedFetch(tracer: Tracer): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';

    return tracer.trace(
      `HTTP ${method}`,
      async (span) => {
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', url);
        span.setAttribute('span.kind', 'client');

        // Inject trace context into headers
        const headers = new Headers(init?.headers);
        injectContext(span.getContext(), headers);

        const startTime = performance.now();

        const response = await fetch(input, { ...init, headers });

        const duration = performance.now() - startTime;

        span.setAttribute('http.status_code', response.status);
        span.setAttribute('http.response_time_ms', Math.round(duration));

        if (!response.ok) {
          span.setStatus(SpanStatus.ERROR, `HTTP ${response.status}`);
        }

        return response;
      },
      {
        attributes: {
          'http.scheme': url.startsWith('https') ? 'https' : 'http',
        },
      }
    );
  };
}

// ============================================================================
// REACT INTEGRATION
// ============================================================================

/**
 * Create a performance observer for Core Web Vitals
 */
export function observeWebVitals(tracer: Tracer): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  // Observe Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];

    const span = tracer.startSpan('web_vitals.lcp', {
      attributes: {
        'web_vital.name': 'LCP',
        'web_vital.value': lastEntry.startTime,
        'web_vital.rating':
          lastEntry.startTime <= 2500
            ? 'good'
            : lastEntry.startTime <= 4000
              ? 'needs-improvement'
              : 'poor',
      },
    });
    tracer.endSpan(span);
  });

  lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

  // Observe First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const fidEntry = entry as PerformanceEventTiming;
      const fid = fidEntry.processingStart - fidEntry.startTime;

      const span = tracer.startSpan('web_vitals.fid', {
        attributes: {
          'web_vital.name': 'FID',
          'web_vital.value': fid,
          'web_vital.rating': fid <= 100 ? 'good' : fid <= 300 ? 'needs-improvement' : 'poor',
        },
      });
      tracer.endSpan(span);
    }
  });

  fidObserver.observe({ type: 'first-input', buffered: true });

  // Observe Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as LayoutShift).hadRecentInput) {
        clsValue += (entry as LayoutShift).value;
      }
    }
  });

  clsObserver.observe({ type: 'layout-shift', buffered: true });

  // Report CLS on page hide
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const span = tracer.startSpan('web_vitals.cls', {
        attributes: {
          'web_vital.name': 'CLS',
          'web_vital.value': clsValue,
          'web_vital.rating':
            clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
        },
      });
      tracer.endSpan(span);
      tracer.flush();
    }
  });
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const tracer = new Tracer();

// Initialize web vitals observation
if (typeof window !== 'undefined') {
  observeWebVitals(tracer);

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    tracer.flush();
  });
}
