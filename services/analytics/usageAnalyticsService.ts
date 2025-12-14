/**
 * Usage Analytics Service
 * 
 * Non-blocking, async-first analytics for tracking AI usage, costs, and performance.
 * All operations are fire-and-forget to ensure ZERO impact on user experience.
 * 
 * Key Design Principles:
 * - Never block the main generation flow
 * - Graceful degradation if logging fails
 * - Batch operations to minimize DB calls
 * - Client-side queuing with periodic flush
 */

import { supabase } from '../supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface UsageEvent {
  id?: string;
  userId: string;
  sessionId: string;
  eventType: 'image_generation' | 'text_generation' | 'character_interview' | 'book_creation' | 'infographic';
  modelUsed: string;
  tokensInput?: number;
  tokensOutput?: number;
  estimatedCostUsd: number;
  latencyMs: number;
  tier: string;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface CostSummary {
  dailyCost: number;
  monthlyCost: number;
  totalGenerations: number;
  averageLatency: number;
}

// ============================================================================
// COST ESTIMATION (No API calls - pure calculation)
// ============================================================================

// Approximate costs per 1K tokens (USD) - updated Dec 2024
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Gemini models
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  // Imagen models
  'imagen-4.0-generate-preview-05-20': { input: 0.02, output: 0 },
  'imagen-4.0-ultra-generate-exp-05-20': { input: 0.04, output: 0 },
  // Grok models
  'grok-3': { input: 0.003, output: 0.015 },
  'grok-3-mini': { input: 0.0003, output: 0.0005 },
  // Default fallback
  'default': { input: 0.001, output: 0.002 }
};

/**
 * Estimate cost for a generation - pure function, no side effects
 */
export function estimateCost(
  modelId: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  isImageGeneration: boolean = false
): number {
  const costs = MODEL_COSTS[modelId] || MODEL_COSTS['default'];
  
  if (isImageGeneration) {
    // Image generation is per-image, not per-token
    return costs.input;
  }
  
  return (inputTokens / 1000 * costs.input) + (outputTokens / 1000 * costs.output);
}

// ============================================================================
// EVENT QUEUE (Non-blocking batching)
// ============================================================================

const eventQueue: UsageEvent[] = [];
let flushScheduled = false;
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_QUEUE_SIZE = 50; // Flush if queue gets too large

/**
 * Queue an event for async logging - NEVER blocks
 */
export function trackUsage(event: Omit<UsageEvent, 'createdAt'>): void {
  const fullEvent: UsageEvent = {
    ...event,
    createdAt: Date.now()
  };
  
  eventQueue.push(fullEvent);
  
  // Flush immediately if queue is getting large
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  } else if (!flushScheduled) {
    // Schedule a flush for later
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      flushQueue();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush queued events to Supabase - async, non-blocking
 */
async function flushQueue(): Promise<void> {
  if (eventQueue.length === 0) return;
  
  // Take a snapshot and clear the queue immediately
  const eventsToFlush = [...eventQueue];
  eventQueue.length = 0;
  
  try {
    // Fire and forget - don't await in the calling context
    const { error } = await supabase
      .from('usage_analytics')
      .insert(eventsToFlush.map(e => ({
        user_id: e.userId,
        session_id: e.sessionId,
        event_type: e.eventType,
        model_used: e.modelUsed,
        tokens_input: e.tokensInput || 0,
        tokens_output: e.tokensOutput || 0,
        estimated_cost_usd: e.estimatedCostUsd,
        latency_ms: e.latencyMs,
        tier: e.tier,
        success: e.success,
        error_code: e.errorCode,
        metadata: e.metadata,
        created_at: new Date(e.createdAt).toISOString()
      })));
    
    if (error) {
      // Log but don't throw - graceful degradation
      console.warn('📊 Analytics flush failed (non-critical):', error.message);
      // Could add to a retry queue here if needed
    } else {
      console.log(`📊 Flushed ${eventsToFlush.length} analytics events`);
    }
  } catch (err) {
    // Silently fail - analytics should never break the app
    console.warn('📊 Analytics error (non-critical):', err);
  }
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Track an image generation event
 */
export function trackImageGeneration(params: {
  userId: string;
  sessionId: string;
  modelUsed: string;
  tier: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  style?: string;
}): void {
  trackUsage({
    userId: params.userId,
    sessionId: params.sessionId,
    eventType: 'image_generation',
    modelUsed: params.modelUsed,
    estimatedCostUsd: estimateCost(params.modelUsed, 0, 0, true),
    latencyMs: params.latencyMs,
    tier: params.tier,
    success: params.success,
    errorCode: params.errorCode,
    metadata: { style: params.style }
  });
}

/**
 * Track a text generation event
 */
export function trackTextGeneration(params: {
  userId: string;
  sessionId: string;
  modelUsed: string;
  tier: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  purpose?: string;
}): void {
  trackUsage({
    userId: params.userId,
    sessionId: params.sessionId,
    eventType: 'text_generation',
    modelUsed: params.modelUsed,
    tokensInput: params.tokensInput,
    tokensOutput: params.tokensOutput,
    estimatedCostUsd: estimateCost(params.modelUsed, params.tokensInput, params.tokensOutput),
    latencyMs: params.latencyMs,
    tier: params.tier,
    success: params.success,
    errorCode: params.errorCode,
    metadata: { purpose: params.purpose }
  });
}

/**
 * Track a book creation event
 */
export function trackBookCreation(params: {
  userId: string;
  sessionId: string;
  tier: string;
  totalLatencyMs: number;
  pageCount: number;
  imageCount: number;
  success: boolean;
  errorCode?: string;
}): void {
  // Estimate total cost for a book (multiple images + text)
  const imageCost = params.imageCount * estimateCost('imagen-4.0-generate-preview-05-20', 0, 0, true);
  const textCost = estimateCost('gemini-2.5-pro', 2000, 5000); // Approximate tokens for book
  
  trackUsage({
    userId: params.userId,
    sessionId: params.sessionId,
    eventType: 'book_creation',
    modelUsed: 'multi-model',
    estimatedCostUsd: imageCost + textCost,
    latencyMs: params.totalLatencyMs,
    tier: params.tier,
    success: params.success,
    errorCode: params.errorCode,
    metadata: { pageCount: params.pageCount, imageCount: params.imageCount }
  });
}

// ============================================================================
// COST SUMMARY (Read operations - can be called async)
// ============================================================================

/**
 * Get cost summary for a user - async, safe to call
 */
export async function getUserCostSummary(userId: string): Promise<CostSummary | null> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const { data, error } = await supabase
      .from('usage_analytics')
      .select('estimated_cost_usd, latency_ms')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth);
    
    if (error || !data) return null;
    
    const todayData = data.filter((d: any) => new Date(d.created_at) >= new Date(startOfDay));
    
    return {
      dailyCost: todayData.reduce((sum: number, d: any) => sum + (d.estimated_cost_usd || 0), 0),
      monthlyCost: data.reduce((sum: number, d: any) => sum + (d.estimated_cost_usd || 0), 0),
      totalGenerations: data.length,
      averageLatency: data.length > 0 
        ? data.reduce((sum: number, d: any) => sum + (d.latency_ms || 0), 0) / data.length 
        : 0
    };
  } catch {
    return null;
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

let currentSessionId: string | null = null;

/**
 * Get or create session ID - synchronous, no API calls
 */
export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return currentSessionId;
}

/**
 * Reset session (e.g., on logout)
 */
export function resetSession(): void {
  // Flush any pending events before resetting
  flushQueue();
  currentSessionId = null;
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliable delivery on page close
    if (eventQueue.length > 0 && typeof navigator.sendBeacon === 'function') {
      // Convert to minimal format for beacon
      const payload = JSON.stringify(eventQueue);
      // Note: Would need a dedicated beacon endpoint in production
      console.log('📊 Flushing', eventQueue.length, 'events on page unload');
    }
  });
}

export default {
  trackUsage,
  trackImageGeneration,
  trackTextGeneration,
  trackBookCreation,
  estimateCost,
  getUserCostSummary,
  getSessionId,
  resetSession
};
