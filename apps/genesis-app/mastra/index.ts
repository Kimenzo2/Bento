/**
 * @fileoverview Central Mastra Instance for Genesis
 *
 * ## What This File Does
 * This is the root configuration and registration point for the Mastra AI
 * agent framework in Genesis. It initializes a single Mastra instance that
 * registers all agents (story architect, character artist, style architect,
 * story editor, gamification, quality assurance) and all workflows
 * (book generation pipeline, brand voice RAG).
 *
 * ## What It Replaces
 * Previously, Genesis called AI APIs (provider-specific text and image calls) directly from
 * the browser via proxy endpoints. This file moves all AI orchestration to
 * a server-side Mastra backend, eliminating client-side API key exposure
 * and enabling durable workflow state, agent memory, and structured
 * multi-step pipelines.
 *
 * ## Architecture
 * ```
 * React Frontend (Vite)
 *   └── mastraClient.ts (typed HTTP client)
 *       └── Hono HTTP Server (mastra/server.ts)
 *           └── Mastra Instance (this file)
 *               ├── Agents (mastra/agents/*.ts)
 *               ├── Workflows (mastra/workflows/*.ts)
 *               ├── Memory (Supabase PostgreSQL via @mastra/pg)
 *               └── Telemetry (OpenTelemetry traces → Supabase)
 * ```
 *
 * ## Future Extensions
 * - [STREAMING PHASE]: Video generation agents (Veo 3.1) will be registered here
 * - [COLLABORATION PHASE]: Real-time multi-user editing agents
 * - [ANALYTICS PHASE]: Usage analytics and recommendation agents
 *
 * @module mastra/index
 */

import { Mastra } from '@mastra/core';
import { PostgresStore } from '@mastra/pg';
import { Observability, DefaultExporter, SensitiveDataFilter, SamplingStrategyType } from '@mastra/observability';

// ─── Agent Imports ───────────────────────────────────────────────────────────
import { storyArchitectAgent } from './agents/storyArchitectAgent';
import { characterArtistAgent } from './agents/characterArtistAgent';
import { styleArchitectAgent } from './agents/styleArchitectAgent';
import { storyEditorAgent } from './agents/storyEditorAgent';
import { gamificationAgent } from './agents/gamificationAgent';
import { qualityAssuranceAgent } from './agents/qualityAssuranceAgent';

// ─── Workflow Imports ────────────────────────────────────────────────────────
import { bookGenerationWorkflow } from './workflows/bookGenerationWorkflow';
import { brandVoiceRAGWorkflow } from './workflows/brandVoiceRAGWorkflow';

// ─── Eval Imports ────────────────────────────────────────────────────────────
import { bookQualityScorer } from './evals/bookQualityEval';

// ─── Configuration ───────────────────────────────────────────────────────────

function getEnv(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? '';
}

const supabaseUrl = getEnv('SUPABASE_URL', process.env.VITE_SUPABASE_URL);
const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const isProduction = process.env.NODE_ENV === 'production';

// ─── PostgreSQL Storage (production-configured) ─────────────────────────────
// When MASTRA_PG_CONNECTION_STRING is set, PostgresStore enables:
//   - Durable workflow state (suspend/resume survives server restarts)
//   - Agent memory threads
//   - Evaluation result persistence
//
// Without it, agents and workflows still work but suspended workflows
// will be lost if the server restarts.
//
// To get your connection string from Supabase:
//   Dashboard → Settings → Database → Connection string (URI)
//   Use the "Session mode" pooler string for best compatibility.
//
const pgConnectionString = process.env.MASTRA_PG_CONNECTION_STRING ?? '';

let storage: PostgresStore | undefined = undefined;
if (pgConnectionString) {
  storage = new PostgresStore({
    id: 'genesis-storage',
    connectionString: pgConnectionString,
    // Production pool config: sized for 100k users with concurrent workflows
    max: isProduction ? 20 : 5,
    idleTimeoutMillis: isProduction ? 30000 : 10000,
    // Supabase requires SSL in production
    ssl: pgConnectionString.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : (isProduction ? true : false),
  });
  console.log('[Mastra] PostgresStore enabled — workflow state will persist.');
} else {
  console.warn(
    '[Mastra] MASTRA_PG_CONNECTION_STRING not set. ' +
      'Agents work fine, but workflow suspend/resume state will not persist across restarts. ' +
      'Get your connection string from Supabase Dashboard → Settings → Database.'
  );
}

// ─── Observability ───────────────────────────────────────────────────────────

/**
 * Mastra-native tracing configuration.
 *
 * Uses environment-based sampling:
 * - Development: 100% of traces (always) for full visibility
 * - Production: 10% of traces (ratio) to control costs
 *
 * DefaultExporter persists traces to storage for Mastra Studio inspection.
 * SensitiveDataFilter redacts passwords, tokens, and API keys before export.
 *
 * This replaces the need for a separate OpenTelemetry setup for Mastra
 * operations while the existing services/infrastructure/tracing.ts continues
 * to handle non-Mastra application tracing.
 */

const observability = new Observability({
  configs: {
    default: {
      serviceName: 'genesis-mastra',
      sampling: isProduction
        ? { type: SamplingStrategyType.RATIO, probability: 0.1 }
        : { type: SamplingStrategyType.ALWAYS },
      exporters: [new DefaultExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
      requestContextKeys: ['userId', 'tier', 'workflowId'],
    },
  },
});

// ─── Mastra Instance ─────────────────────────────────────────────────────────

/**
 * The central Mastra instance for Genesis.
 *
 * All agents and workflows are registered here. The React frontend
 * communicates with this instance via the Hono HTTP server in server.ts.
 *
 * Usage:
 * ```ts
 * import { mastra } from './index';
 * const agent = mastra.getAgent('storyArchitect');
 * const result = await agent.generate('Write a children's story about...');
 * ```
 */
export const mastra = new Mastra({
  agents: {
    storyArchitect: storyArchitectAgent,
    characterArtist: characterArtistAgent,
    styleArchitect: styleArchitectAgent,
    storyEditor: storyEditorAgent,
    gamification: gamificationAgent,
    qualityAssurance: qualityAssuranceAgent,
  },
  workflows: {
    bookGeneration: bookGenerationWorkflow,
    brandVoiceRAG: brandVoiceRAGWorkflow,
  },
  ...(storage ? { storage } : {}),
  observability,
  scorers: {
    bookQuality: bookQualityScorer,
  },
});

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  supabaseUrl,
  supabaseServiceRoleKey,
  pgConnectionString,
  getEnv,
};

export default mastra;
