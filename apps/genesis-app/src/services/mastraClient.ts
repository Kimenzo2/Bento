/**
 * @fileoverview Mastra Client — Typed HTTP Client for Frontend ↔ Mastra Communication
 *
 * ## What This File Does
 * Provides a fully typed, thin HTTP client that the React frontend uses to
 * communicate with the Mastra backend (Hono server on port 4111). All AI
 * operations now flow through this client instead of calling the legacy gateway
 * or grokService directly from the browser.
 *
 * ## Key Design Decisions
 * - Uses the Supabase session JWT for authentication (same auth, no new tokens)
 * - SSE streaming for book generation progress events
 * - Automatic retry with exponential backoff for transient failures
 * - All API keys stay on the server — ZERO client-side exposure
 * - Graceful fallback: if Mastra server is unreachable, surfaces clear errors
 *
 * ## What It Replaces
 * - Direct `aiGatewayService.generateBookStructure()` calls from components
 * - Direct `grokService.improveText()` calls from SmartEditor
 * - Direct `generateIllustration()` calls from SmartEditor
 * - localStorage-based tier usage tracking (now server-enforced)
 *
 * ## Usage
 * ```ts
 * import { mastra } from '../services/mastraClient';
 *
 * // Start book generation (returns SSE stream)
 * const stream = await mastra.workflows.startBookGeneration(settings, onProgress);
 *
 * // Call an agent directly
 * const improved = await mastra.agents.storyEditor.improveText(text, tone, audience);
 * ```
 *
 * @module src/services/mastraClient
 */

import { supabase } from '../../services/supabaseClient';
import type {
  BookProject,
  GenerationSettings,
  GamificationState,
  LifeInColourGenerationRecord,
  LifeInColourGenerationListResponse,
  LifeInColourGenerationResponse,
  LifeInColourStartRequest,
  LifeInColourStartResponse,
} from '../../types';
import type { ContentStructure } from '../../types/generator';
import type { CharacterSheet, StyleGuide } from '../../types/generator';

// Re-export types that match legacy service return shapes
export interface ConsistencyReport {
  overallScore: number;
  characters: Array<{
    name: string;
    inconsistencies: string[];
    suggestions: string[];
  }>;
}

export interface WritingSuggestion {
  type: 'grammar' | 'style' | 'word-choice';
  original: string;
  suggestion: string;
  reason: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const MASTRA_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTRA_URL) ||
  'http://localhost:4111';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Returns false when the Mastra server is on localhost but the browser is
 * running on a remote origin (e.g. the deployed Vercel site).  In that case
 * every fetch would be blocked by the browser's CSP and there is no point
 * retrying — it will never work until VITE_MASTRA_URL is set.
 */
function isMastraAvailable(): boolean {
  const isLocalhost =
    MASTRA_BASE_URL.startsWith('http://localhost') ||
    MASTRA_BASE_URL.startsWith('http://127.0.0.1');

  if (!isLocalhost) return true; // Deployed Mastra server — always try.

  // In a non-browser context (e.g. SSR / tests) always try.
  if (typeof window === 'undefined') return true;

  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowProgressEvent {
  phase: string;
  percent: number;
  message: string;
  data?: unknown;
}

export interface BookGenerationResult {
  bookId: string;
  success: boolean;
  saved?: boolean;
  error?: string;
  videoReady: boolean;
  message?: string;
  project?: BookProject;
}

export interface QualityAnalysis {
  overallScore: number;
  pageScores: { pageNumber: number; score: number; issues: string[] }[];
  suggestions: string[];
}

export interface GamificationData {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  currentStreak: number;
  booksCreatedCount: number;
  badges: { id: string; name: string; icon: string; description: string; unlocked: boolean }[];
  dailyChallenges: { id: string; title: string; xpReward: number; completed: boolean }[];
  levelTitle: string;
}

export interface BrandVoiceIngestionResult {
  chunksStored: number;
  brandName: string;
  userId: string;
  success: boolean;
  error?: string;
}

interface RawLifeInColourGenerationRecord {
  id: string;
  user_id: string;
  status: LifeInColourGenerationRecord['status'];
  title: string;
  brief: string;
  outline_mode: LifeInColourGenerationRecord['outlineMode'];
  source_bucket: string;
  source_path: string;
  source_mime_type: string | null;
  source_file_name: string | null;
  generated_bucket: string | null;
  generated_path: string | null;
  generated_public_url: string | null;
  provider: string | null;
  model: string | null;
  analysis_model: string | null;
  render_model: string | null;
  prompt_version: string | null;
  retry_count: number;
  normalized_prompt: string | null;
  source_analysis_summary: LifeInColourGenerationRecord['sourceAnalysisSummary'];
  critique_summary: LifeInColourGenerationRecord['critiqueSummary'];
  quality_flags: LifeInColourGenerationRecord['qualityFlags'];
  fallback_eligible: boolean;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawLifeInColourGenerationResponse {
  generation: RawLifeInColourGenerationRecord;
  active: boolean;
  fallbackEligible: boolean;
}

interface RawLifeInColourGenerationListResponse {
  generations: RawLifeInColourGenerationRecord[];
}

// ─── Auth Helper ─────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function mastraFetch<T>(
  path: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<T> {
  if (!isMastraAvailable()) {
    throw new MastraError(
      'Mastra server is not available. Set VITE_MASTRA_URL to your deployed Mastra backend.',
      0,
      { hint: 'See MIGRATION_GUIDE.md for deployment instructions.' }
    );
  }

  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${MASTRA_BASE_URL}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        let parsed: any;
        try {
          parsed = JSON.parse(errorBody);
        } catch {
          parsed = { error: errorBody };
        }

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new MastraError(
            parsed.error || `Request failed: ${response.status}`,
            response.status,
            parsed
          );
        }

        // Retry on 5xx and 429
        if (attempt < retries) {
          await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
          continue;
        }

        throw new MastraError(
          parsed.error || `Server error: ${response.status}`,
          response.status,
          parsed
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MastraError) throw error;

      // Network error — retry
      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      throw new MastraError(
        'Unable to reach Mastra server. Is it running on ' + MASTRA_BASE_URL + '?',
        0,
        { originalError: String(error) }
      );
    }
  }

  // Should never reach here
  throw new MastraError('Max retries exceeded', 0);
}

// ─── SSE Helper ──────────────────────────────────────────────────────────────

async function mastraSSE(
  path: string,
  body: unknown,
  onEvent: (event: WorkflowProgressEvent) => void,
  onComplete?: (result: BookGenerationResult) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  if (!isMastraAvailable()) {
    const err = new MastraError(
      'Mastra server is not available. Set VITE_MASTRA_URL to your deployed Mastra backend.',
      0
    );
    onError?.(err);
    return () => {};
  }

  const token = await getAuthToken();
  let aborted = false;
  const controller = new AbortController();

  const cancel = () => {
    aborted = true;
    controller.abort();
  };

  (async () => {
    try {
      const response = await fetch(`${MASTRA_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let message = `SSE request failed: ${response.status}`;
        let details: unknown = errorText;

        try {
          const parsed = JSON.parse(errorText);
          details = parsed;

          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            message = parsed.error.trim();
          }

          if (Array.isArray(parsed?.details) && parsed.details.length > 0) {
            message = `${message} (${parsed.details.join('; ')})`;
          } else if (typeof parsed?.details === 'string' && parsed.details.trim()) {
            message = `${message} (${parsed.details.trim()})`;
          }
        } catch {
          // non-JSON error body; keep default message
        }

        if (!message.includes(String(response.status))) {
          message = `${message} (status ${response.status})`;
        }

        throw new MastraError(message, response.status, details);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                onEvent(data.data as WorkflowProgressEvent);
              } else if (data.type === 'complete') {
                onComplete?.(data.data as BookGenerationResult);
              } else if (data.type === 'error') {
                onError?.(new MastraError(data.error, 500));
              } else if (data.type === 'suspended') {
                // Blueprint approval needed — emit as a progress event with phase 'approval'
                onEvent({
                  phase: 'approval',
                  percent: 20,
                  message: 'Blueprint ready for review',
                  data: data.data,
                });
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }
    } catch (error) {
      if (!aborted) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  })();

  return cancel;
}

// ─── Error Class ─────────────────────────────────────────────────────────────

export class MastraError extends Error {
  public statusCode: number;
  public details: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'MastraError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapLifeInColourGenerationRecord(
  record: RawLifeInColourGenerationRecord
): LifeInColourGenerationRecord {
  return {
    id: record.id,
    userId: record.user_id,
    status: record.status,
    title: record.title,
    brief: record.brief,
    outlineMode: record.outline_mode,
    sourceBucket: record.source_bucket,
    sourcePath: record.source_path,
    sourceMimeType: record.source_mime_type,
    sourceFileName: record.source_file_name,
    generatedBucket: record.generated_bucket,
    generatedPath: record.generated_path,
    generatedPublicUrl: record.generated_public_url,
    provider: record.provider,
    model: record.model,
    analysisModel: record.analysis_model,
    renderModel: record.render_model,
    promptVersion: record.prompt_version,
    retryCount: record.retry_count,
    normalizedPrompt: record.normalized_prompt,
    sourceAnalysisSummary: record.source_analysis_summary,
    critiqueSummary: record.critique_summary,
    qualityFlags: record.quality_flags,
    fallbackEligible: record.fallback_eligible,
    errorMessage: record.error_message,
    startedAt: record.started_at,
    completedAt: record.completed_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// ─── Mastra Client ───────────────────────────────────────────────────────────

export const mastra = {
  // ───── Health Check ─────
  async healthCheck(): Promise<{ status: string; agents: number; workflows: number }> {
    return mastraFetch('/api/health');
  },

  // ───── Agent: Story Architect ─────
  agents: {
    storyArchitect: {
      async generateBlueprint(settings: GenerationSettings): Promise<ContentStructure> {
        return mastraFetch('/api/agents/story-architect/generate', {
          method: 'POST',
          body: JSON.stringify({ settings }),
        });
      },
    },

    characterArtist: {
      async generateCharacterSheet(
        characterNeeds: unknown,
        artStyle: string,
        bookId: string
      ): Promise<CharacterSheet> {
        return mastraFetch('/api/agents/character-artist/generate', {
          method: 'POST',
          body: JSON.stringify({ characterNeeds, artStyle, bookId }),
        });
      },
    },

    styleArchitect: {
      async generateStyleGuide(
        tone: string,
        artStyle: string,
        targetAudience: string
      ): Promise<StyleGuide> {
        return mastraFetch('/api/agents/style-architect/generate', {
          method: 'POST',
          body: JSON.stringify({ tone, artStyle, targetAudience }),
        });
      },
    },

    storyEditor: {
      /**
       * Improve text using AI — replaces grokService.improveText()
       */
      async improveText(
        text: string,
        tone: string,
        targetAudience: string,
        bookId?: string
      ): Promise<string> {
        const result = await mastraFetch<{ improved: string }>('/api/agents/story-editor/improve', {
          method: 'POST',
          body: JSON.stringify({ text, tone, targetAudience, bookId }),
        });
        return result.improved;
      },

      /**
       * Check character consistency — replaces grokService.checkCharacterConsistency()
       * Returns the same shape as the legacy service.
       */
      async checkConsistency(project: BookProject): Promise<ConsistencyReport> {
        const result = await mastraFetch<{ report: ConsistencyReport }>(
          '/api/agents/story-editor/consistency',
          {
            method: 'POST',
            body: JSON.stringify({ project }),
          }
        );
        return result.report;
      },

      /**
       * Get writing suggestions — replaces grokService.getWritingSuggestions()
       * Returns the same shape as the legacy service.
       */
      async getSuggestions(text: string, context: string): Promise<WritingSuggestion[]> {
        const result = await mastraFetch<{ suggestions: WritingSuggestion[] }>(
          '/api/agents/story-editor/suggestions',
          {
            method: 'POST',
            body: JSON.stringify({ text, context }),
          }
        );
        return result.suggestions;
      },
    },

    gamification: {
      /**
       * Get full gamification state — replaces hardcoded GamificationHub data
       */
      async getState(): Promise<GamificationData> {
        return mastraFetch('/api/agents/gamification/state');
      },

      /**
       * Track a gamification action (book_created, daily_login, etc.)
       */
      async trackAction(
        action: string,
        metadata?: Record<string, unknown>
      ): Promise<{ xpAwarded: number; newLevel?: number; badgeUnlocked?: string }> {
        return mastraFetch('/api/agents/gamification/track', {
          method: 'POST',
          body: JSON.stringify({ action, metadata }),
        });
      },
    },

    qualityAssurance: {
      /**
       * Analyze book quality — replaces qaService.analyzeQuality()
       */
      async analyze(
        bookId: string,
        pages: { pageNumber: number; text: string }[],
        targetAudience?: string,
        tone?: string
      ): Promise<QualityAnalysis> {
        return mastraFetch('/api/agents/qa/analyze', {
          method: 'POST',
          body: JSON.stringify({ bookId, pages, targetAudience, tone }),
        });
      },
    },
  },

  // ───── Workflows ─────
  workflows: {
    /**
     * Start the full book generation pipeline via SSE.
     *
     * Returns a cancel function that can be called to abort the workflow.
     *
     * @example
     * ```ts
     * const cancel = await mastra.workflows.startBookGeneration(
     *   settings,
     *   (event) => setProgress(event),
     *   (result) => navigateToEditor(result.bookId),
     *   (error) => showError(error.message)
     * );
     *
     * // Later, to cancel:
     * cancel();
     * ```
     */
    async startBookGeneration(
      settings: GenerationSettings,
      onProgress: (event: WorkflowProgressEvent) => void,
      onComplete?: (result: BookGenerationResult) => void,
      onError?: (error: Error) => void
    ): Promise<() => void> {
      return mastraSSE(
        '/api/workflows/book-generation/start',
        { settings },
        onProgress,
        onComplete,
        onError
      );
    },

    /**
     * Resume a suspended workflow (e.g., after blueprint approval).
     * Returns an SSE stream for continued progress.
     */
    async resumeBookGeneration(
      workflowId: string,
      approvedBlueprint: ContentStructure,
      onProgress: (event: WorkflowProgressEvent) => void,
      onComplete?: (result: BookGenerationResult) => void,
      onError?: (error: Error) => void
    ): Promise<() => void> {
      return mastraSSE(
        '/api/workflows/book-generation/resume',
        { workflowId, approvedBlueprint },
        onProgress,
        onComplete,
        onError
      );
    },

    /**
     * Cancel a running book generation workflow.
     */
    async cancelBookGeneration(
      workflowId: string
    ): Promise<{ cancelled: boolean; workflowId?: string }> {
      return mastraFetch('/api/workflows/book-generation/cancel', {
        method: 'POST',
        body: JSON.stringify({ workflowId }),
      });
    },

    /**
     * Ingest brand voice samples into RAG pipeline.
     */
    async ingestBrandVoice(
      brandName: string,
      sampleText: string
    ): Promise<BrandVoiceIngestionResult> {
      return mastraFetch('/api/workflows/brand-voice/ingest', {
        method: 'POST',
        body: JSON.stringify({ brandName, sampleText }),
      });
    },
  },

  lifeInColour: {
    async startGeneration(request: LifeInColourStartRequest): Promise<LifeInColourStartResponse> {
      return mastraFetch('/api/life-in-colour/generate', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    async getGeneration(generationId: string): Promise<LifeInColourGenerationResponse> {
      const response = await mastraFetch<RawLifeInColourGenerationResponse>(
        `/api/life-in-colour/generations/${generationId}`
      );

      return {
        generation: mapLifeInColourGenerationRecord(response.generation),
        active: response.active,
        fallbackEligible: response.fallbackEligible,
      };
    },

    async listGenerations(limit = 8): Promise<LifeInColourGenerationListResponse> {
      const response = await mastraFetch<RawLifeInColourGenerationListResponse>(
        `/api/life-in-colour/generations?limit=${encodeURIComponent(String(limit))}`
      );

      return {
        generations: response.generations.map(mapLifeInColourGenerationRecord),
      };
    },
  },

  // ───── Admin / Observability ─────
  admin: {
    /**
     * Get evaluation score averages (for admin dashboard).
     */
    async getEvalAverages(): Promise<Record<string, number>> {
      return mastraFetch('/api/admin/eval-averages');
    },
  },
};

// ─── Default Export ──────────────────────────────────────────────────────────

export default mastra;
