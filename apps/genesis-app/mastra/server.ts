/**
 * @fileoverview Mastra HTTP Server for Genesis
 *
 * ## What This File Does
 * Sets up a Hono HTTP server that exposes all Mastra agent and workflow
 * endpoints. Handles CORS for the Vite dev server, validates Supabase
 * JWT tokens on every request, and provides SSE endpoints for real-time
 * workflow progress streaming.
 *
 * ## What It Replaces
 * Previously, Genesis called AI APIs directly from the browser through
 * Vercel serverless proxy functions (/api/ai-generate, /api/ai-bytez).
 * This server centralizes all AI orchestration behind authenticated
 * endpoints with durable workflow state.
 *
 * ## Future Extensions
 * - [STREAMING PHASE]: WebSocket endpoints for live video generation progress
 * - [COLLABORATION PHASE]: Real-time sync endpoints via Liveblocks integration
 *
 * @module mastra/server
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';
import { mastra, supabaseUrl, supabaseServiceRoleKey, getEnv } from './index';
import { generateBytezImage, generateTextFromRequest } from './lib/aiGateway';
import { evaluateBookQuality } from './evals/bookQualityEval';
import {
  ArtStyleSchema,
  BookToneSchema,
  ColoringOutlineModeSchema,
  GenerationSettingsSchema,
} from './schemas';
import {
  cancelBookGenerationWorkflow,
  releaseBookGenerationWorkflow,
} from './workflows/bookGenerationWorkflow';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthenticatedContext {
  userId: string;
  email: string;
  tier: string;
}

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = new Hono();
const activeWorkflowOwners = new Map<string, string>();

// ─── In-Memory Rate Limiter ─────────────────────────────────────────────────
// Production-grade: per-user sliding window. For horizontal scaling, replace
// with Upstash Redis (@upstash/ratelimit) using the existing UPSTASH_REDIS_REST_URL.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per user
const RATE_LIMIT_WORKFLOW_MAX = 5; // 5 workflow starts per minute per user

function checkRateLimit(userId: string, max: number = RATE_LIMIT_MAX_REQUESTS): boolean {
  const now = Date.now();
  const key = `${userId}:${max}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

// ─── Generation Settings Normalization (Defensive) ──────────────────────────
const DEFAULT_AUDIENCE = 'Children 4-6';
const DEFAULT_PAGE_COUNT = 10;

const ART_STYLE_ALIASES: Array<[RegExp, string]> = [
  [/watercolor/i, 'Watercolor'],
  [/pixar|3d|render/i, '3D Render (Pixar Style)'],
  [/manga|anime/i, 'Japanese Manga'],
  [/corporate|minimal(ist)?/i, 'Corporate Minimalist'],
  [/cyberpunk|neon/i, 'Cyberpunk Neon'],
  [/vintage|storybook|classic|traditional|oil|fantasy/i, 'Vintage Illustration'],
  [/paper|cutout|papercraft|collage/i, 'Paper Cutout Art'],
  [/flat|vector/i, 'Flat Design'],
  [/infographic/i, 'Modern Infographic'],
  [/blueprint|technical/i, 'Technical Blueprint'],
];

const BOOK_TONE_ALIASES: Array<[RegExp, string]> = [
  [/playful|fun|whimsical|cheerful|lighthearted/i, 'Playful'],
  [/serious|formal|grave/i, 'Serious'],
  [/inspir/i, 'Inspirational'],
  [/educat|instruction|inform/i, 'Educational'],
  [/dram/i, 'Dramatic'],
  [/calm|soothing|gentle|relax/i, 'Calm'],
  [/advent|excite|action|epic/i, 'Adventurous'],
];

const OUTLINE_MODE_ALIASES: Array<[RegExp, string]> = [
  [/simple|minimal|open|clean/i, 'simple'],
  [/detail|dense|rich|full/i, 'detailed'],
  [/mandala|radial|symmet|ornament|decorat/i, 'mandala'],
];

function normalizeEnumValue(
  input: unknown,
  options: readonly string[],
  aliases: Array<[RegExp, string]>,
  fallback: string
): string {
  if (typeof input === 'string' && options.includes(input)) {
    return input;
  }

  if (typeof input === 'string') {
    for (const [pattern, value] of aliases) {
      if (pattern.test(input)) return value;
    }
  }

  return fallback;
}

function normalizeBooleanValue(input: unknown, fallback: boolean): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeNumberValue(input: unknown, fallback: number): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(1, Math.floor(input));
  }
  if (typeof input === 'string') {
    const parsed = Number.parseInt(input, 10);
    if (!Number.isNaN(parsed)) return Math.max(1, parsed);
  }
  return fallback;
}

function normalizeAudienceValue(raw: Record<string, any>): string {
  const candidates = [raw.audience, raw.targetAudience, raw.ageRange];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return DEFAULT_AUDIENCE;
}

function normalizeGenerationSettings(raw: unknown): Record<string, any> {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, any>) : {};

  const normalizedPrompt =
    typeof input.prompt === 'string' && input.prompt.trim()
      ? input.prompt.trim()
      : typeof input.topic === 'string' && input.topic.trim()
        ? input.topic.trim()
        : input.prompt;

  const normalizedStyle = normalizeEnumValue(
    input.style ?? input.artStyle ?? input.visualStyle,
    ArtStyleSchema.options,
    ART_STYLE_ALIASES,
    ArtStyleSchema.options[0]
  );

  const normalizedTone = normalizeEnumValue(
    input.tone ?? input.narrativeTone ?? input.storyTone,
    BookToneSchema.options,
    BOOK_TONE_ALIASES,
    BookToneSchema.options[0]
  );

  return {
    ...input,
    prompt: normalizedPrompt,
    style: normalizedStyle,
    tone: normalizedTone,
    stylePrompt:
      typeof input.stylePrompt === 'string' && input.stylePrompt.trim()
        ? input.stylePrompt.trim()
        : input.stylePrompt,
    outlineMode: normalizeEnumValue(
      input.outlineMode ?? input.mode ?? input.lineMode,
      ColoringOutlineModeSchema.options,
      OUTLINE_MODE_ALIASES,
      'detailed'
    ),
    audience: normalizeAudienceValue(input),
    pageCount: normalizeNumberValue(
      input.pageCount ?? input.pages ?? input.page_count,
      DEFAULT_PAGE_COUNT
    ),
    isBranching: normalizeBooleanValue(
      input.isBranching ?? input.branching ?? input.interactive,
      false
    ),
    educational: normalizeBooleanValue(
      input.educational ?? input.learningMode ?? input.learning,
      false
    ),
  };
}

// ─── CORS Middleware ─────────────────────────────────────────────────────────
// Allow requests from the Vite dev server (localhost:5173) and
// production domain(s). Credentials must be included for JWT auth.
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      process.env.VITE_APP_URL ?? 'https://genesis-app.vercel.app',
    ].filter(Boolean) as string[],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
  })
);

// ─── Supabase Admin Client ──────────────────────────────────────────────────
// Uses the SERVICE_ROLE_KEY for server-side operations (JWT verification,
// database writes for workflow state, usage tracking, etc.)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Auth Middleware ─────────────────────────────────────────────────────────
// Validates the Supabase JWT from the Authorization header on every request.
// The frontend attaches the token via mastraClient.ts.
app.use('/api/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Attach user context to the request for downstream handlers
    c.set('auth' as never, {
      userId: user.id,
      email: user.email ?? '',
      tier: user.user_metadata?.tier ?? 'SPARK',
    } satisfies AuthenticatedContext);

    // Rate limit check — per-user
    if (!checkRateLimit(user.id)) {
      return c.json({ error: 'Rate limit exceeded. Try again shortly.' }, 429);
    }

    await next();
  } catch (err) {
    console.error('[Mastra Auth] JWT verification failed:', err);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

// ─── Health Check ────────────────────────────────────────────────────────────
// Exposed on both /health (direct) and /api/health (client-facing) so the
// frontend mastraClient healthCheck() and infra probes both work.
const healthHandler = (c: any) => {
  return c.json({
    status: 'ok',
    service: 'genesis-mastra',
    timestamp: new Date().toISOString(),
    agents: 6,
    workflows: 2,
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ─── AI Gateway Compatibility Routes ────────────────────────────────────────
// These routes replace the old browser-side AI proxy surface with Mastra-backed calls.
app.post('/api/ai-generate', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await generateTextFromRequest(body ?? {});
    return c.json(result);
  } catch (err: any) {
    console.error('[Mastra AI Generate]', err);
    return c.json({ error: err.message ?? 'AI generation failed' }, 500);
  }
});

app.post('/api/ai-bytez', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const model = typeof body?.model === 'string' ? body.model : 'google/imagen-4.0-generate-001';
    const prompt = typeof body?.input === 'string' ? body.input : '';

    if (!prompt) {
      return c.json({ error: 'Missing required fields: model, input' }, 400);
    }

    const imageUrl = await generateBytezImage({ model, prompt });
    return c.json({ imageUrl });
  } catch (err: any) {
    console.error('[Mastra AI Bytez]', err);
    return c.json({ error: err.message ?? 'Image generation failed' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Story Architect Agent ───────────────────────────────────────────────────
app.post('/api/agents/story-architect/generate', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('storyArchitect');
    const result = await agent.generate(
      JSON.stringify({
        ...body,
        userId: auth.userId,
        userTier: auth.tier,
      })
    );
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[StoryArchitect]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Character Artist Agent ──────────────────────────────────────────────────
app.post('/api/agents/character-artist/generate', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('characterArtist');
    const result = await agent.generate(
      JSON.stringify({
        ...body,
        userId: auth.userId,
      })
    );
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[CharacterArtist]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Style Architect Agent ───────────────────────────────────────────────────
app.post('/api/agents/style-architect/generate', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('styleArchitect');
    const result = await agent.generate(JSON.stringify(body));
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[StyleArchitect]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Story Editor Agent ──────────────────────────────────────────────────────
app.post('/api/agents/story-editor/improve', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('storyEditor');
    const result = await agent.generate(
      JSON.stringify({
        action: 'improve',
        ...body,
        userId: auth.userId,
      })
    );
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[StoryEditor]', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/agents/story-editor/consistency', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('storyEditor');
    const result = await agent.generate(
      JSON.stringify({
        action: 'consistency',
        ...body,
        userId: auth.userId,
      })
    );
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[StoryEditor]', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/agents/story-editor/suggestions', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('storyEditor');
    const result = await agent.generate(
      JSON.stringify({
        action: 'suggestions',
        ...body,
        userId: auth.userId,
      })
    );
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[StoryEditor]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Gamification — Direct DB routes (no LLM overhead) ───────────────────────
app.get('/api/agents/gamification/state', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  try {
    const userId = auth.userId;

    // Ensure row exists
    await supabaseAdmin
      .from('user_gamification')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

    // 1. User state
    const { data: ug } = await supabaseAdmin
      .from('user_gamification')
      .select('level,level_title,current_xp,books_created_count,current_streak,total_xp')
      .eq('user_id', userId)
      .single();

    // 2. Next level XP from DB
    const lvl = ug?.level ?? 1;
    const { data: nextLvl } = await supabaseAdmin
      .from('level_definitions')
      .select('xp_required')
      .eq('level', lvl + 1)
      .single();
    const nextLevelXP = nextLvl?.xp_required ?? (ug?.total_xp ?? 0) + 2000;

    // 3. All active badge definitions
    const { data: allBadges } = await supabaseAdmin
      .from('achievement_definitions')
      .select('id,name,description,icon')
      .eq('is_active', true)
      .not('trigger_action', 'is', null)
      .order('id');

    // 4. User's unlocked badges
    const { data: unlockedRows } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_type')
      .eq('user_id', userId);
    const unlockedIds = new Set((unlockedRows ?? []).map((r: any) => r.achievement_type));
    const badges = (allBadges ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      unlocked: unlockedIds.has(b.id),
    }));

    // 5. Daily challenges via DB function
    const { data: challengeRows } = await supabaseAdmin.rpc('assign_daily_challenges', {
      p_user_id: userId,
    });
    const dailyChallenges = (challengeRows ?? []).map((r: any) => ({
      id: r.challenge_id,
      title: r.title,
      xpReward: r.xp_reward,
      completed: r.completed,
    }));

    return c.json({
      level: ug?.level ?? 1,
      levelTitle: ug?.level_title ?? 'Aspiring Author',
      currentXP: ug?.current_xp ?? 0,
      nextLevelXP,
      currentStreak: ug?.current_streak ?? 0,
      booksCreatedCount: ug?.books_created_count ?? 0,
      badges,
      dailyChallenges,
    });
  } catch (err: any) {
    console.error('[Gamification/state]', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/agents/gamification/track', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const { action, metadata } = body;
    if (!action) return c.json({ error: 'action is required' }, 400);

    // Award XP via DB function
    const { data: xpResult, error: xpErr } = await supabaseAdmin.rpc('award_xp', {
      p_user_id: auth.userId,
      p_action_name: action,
      p_metadata: metadata ?? {},
    });
    if (xpErr) throw xpErr;

    // Update streak via DB function
    const { data: streakResult } = await supabaseAdmin.rpc('update_streak', {
      p_user_id: auth.userId,
    });

    // Auto-unlock badges whose trigger threshold was just crossed
    const { data: badgeDefs } = await supabaseAdmin
      .from('achievement_definitions')
      .select('id,name,trigger_action,trigger_count')
      .eq('is_active', true)
      .not('trigger_action', 'is', null);
    const { data: ug } = await supabaseAdmin
      .from('user_gamification')
      .select(
        'books_created_count,pages_edited_count,illustrations_generated_count,brand_content_created_count,current_streak'
      )
      .eq('user_id', auth.userId)
      .single();
    const { data: alreadyUnlocked } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_type')
      .eq('user_id', auth.userId);
    const unlockedIds = new Set((alreadyUnlocked ?? []).map((r: any) => r.achievement_type));

    const newBadges: string[] = [];
    for (const badge of badgeDefs ?? []) {
      if (unlockedIds.has(badge.id)) continue;
      let count = 0;
      if (badge.trigger_action === 'book_created') count = ug?.books_created_count ?? 0;
      else if (badge.trigger_action === 'page_edited') count = ug?.pages_edited_count ?? 0;
      else if (badge.trigger_action === 'illustration_generated')
        count = ug?.illustrations_generated_count ?? 0;
      else if (badge.trigger_action === 'brand_content_created')
        count = ug?.brand_content_created_count ?? 0;
      else if (badge.trigger_action === 'streak') count = ug?.current_streak ?? 0;
      else if (badge.trigger_action === 'qa_score_90' && action === 'qa_score_90') count = 1;
      if (count >= badge.trigger_count) {
        await supabaseAdmin.from('user_achievements').upsert(
          {
            user_id: auth.userId,
            achievement_type: badge.id,
            achievement_name: badge.name,
            unlocked_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,achievement_type,achievement_name', ignoreDuplicates: true }
        );
        newBadges.push(badge.name);
      }
    }

    return c.json({ success: true, xp: xpResult, streak: streakResult, newBadges });
  } catch (err: any) {
    console.error('[Gamification/track]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Quality Assurance Agent ─────────────────────────────────────────────────
app.post('/api/agents/qa/analyze', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();
  try {
    const agent = mastra.getAgent('qualityAssurance');
    const result = await agent.generate(
      JSON.stringify({
        action: 'analyze',
        ...body,
        userId: auth.userId,
      })
    );
    return c.json({ success: true, data: result.text });
  } catch (err: any) {
    console.error('[QA]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Book Generation Workflow (SSE Stream) ───────────────────────────────────
app.post('/api/workflows/book-generation/start', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;

  // Stricter rate limit for workflow starts (expensive AI operations)
  if (!checkRateLimit(auth.userId, RATE_LIMIT_WORKFLOW_MAX)) {
    return c.json(
      { error: 'Too many generation requests. Please wait before starting another.' },
      429
    );
  }

  const body = await c.req.json();

  // Validate settings before starting the expensive workflow
  const normalizedSettings = normalizeGenerationSettings(body?.settings ?? body);
  const settingsParse = GenerationSettingsSchema.safeParse(normalizedSettings);
  if (!settingsParse.success) {
    return c.json(
      {
        error: 'Invalid generation settings',
        details: settingsParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      400
    );
  }
  const settings = settingsParse.data;

  // Return SSE stream with per-step progress via Mastra run.stream()
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (type: string, payload: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type, data: payload })}\n\n`)
            );
          } catch {
            /* controller already closed */
          }
        };

        const sendError = (errorMessage: string) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
            );
          } catch {
            /* controller already closed */
          }
        };

        // Map step IDs to user-facing progress phases
        const STEP_PROGRESS: Record<string, { phase: string; percent: number; message: string }> = {
          validateRequest: { phase: 'validation', percent: 8, message: 'Validating request...' },
          generateProject: { phase: 'writing', percent: 35, message: 'Generating your book...' },
          generateIllustrations: {
            phase: 'illustrating',
            percent: 72,
            message: 'Generating illustrations...',
          },
          persistBook: { phase: 'saving', percent: 92, message: 'Saving book...' },
          finalizeGeneration: { phase: 'complete', percent: 98, message: 'Finalizing...' },
        };

        let workflowId = '';
        try {
          const workflow = mastra.getWorkflow('bookGeneration');
          workflowId = `wf_${Date.now()}_${auth.userId.slice(0, 8)}`;
          activeWorkflowOwners.set(workflowId, auth.userId);

          sendEvent('progress', {
            phase: 'starting',
            percent: 2,
            message: 'Starting book generation...',
            data: { workflowId },
          });

          const run = await workflow.createRun({ runId: workflowId });

          // Use run.stream() for per-step progress events
          const stream = run.stream({
            inputData: {
              settings,
              userId: auth.userId,
              userTier: auth.tier as 'SPARK' | 'CREATOR' | 'STUDIO' | 'EMPIRE',
              workflowId,
            },
          });

          // Consume per-step events from the stream
          for await (const chunk of stream.fullStream) {
            const stepId =
              (chunk as any)?.payload?.stepId ??
              (chunk as any)?.stepId ??
              (chunk as any)?.payload?.currentStep;
            if (stepId && STEP_PROGRESS[stepId]) {
              sendEvent('progress', STEP_PROGRESS[stepId]);
            }
          }

          const result = await stream.result;

          if (result.status === 'success') {
            sendEvent('progress', {
              phase: 'complete',
              percent: 100,
              message: 'Book generation complete!',
            });
            sendEvent('complete', {
              workflowId,
              ...(result as any).result,
            });
          } else {
            sendError(`Workflow ended with status: ${result.status}`);
          }
        } catch (err: any) {
          sendError(err.message);
        } finally {
          if (workflowId) {
            activeWorkflowOwners.delete(workflowId);
            releaseBookGenerationWorkflow(workflowId);
          }
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }
  );
});

app.post('/api/workflows/book-generation/resume', async (c) => {
  return c.json({ error: 'Blueprint approval is no longer required for book generation.' }, 410);
});

// ─── Cancel Workflow ─────────────────────────────────────────────────────────
app.post('/api/workflows/book-generation/cancel', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const { workflowId } = await c.req.json();

  if (!workflowId) {
    return c.json({ error: 'workflowId is required' }, 400);
  }

  const ownerId = activeWorkflowOwners.get(workflowId);
  if (!ownerId) {
    return c.json({ error: 'Workflow not found or already completed.' }, 404);
  }

  if (ownerId && ownerId !== auth.userId) {
    return c.json({ error: 'You are not allowed to cancel this workflow.' }, 403);
  }

  try {
    cancelBookGenerationWorkflow(workflowId);
    return c.json({ cancelled: true, workflowId });
  } catch (err: any) {
    console.error('[BookGeneration Cancel]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Brand Voice RAG Workflow ────────────────────────────────────────────────
app.post('/api/workflows/brand-voice/ingest', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json();

  try {
    const workflow = mastra.getWorkflow('brandVoiceRAG');
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        ...body,
        userId: auth.userId,
      },
    });
    return c.json({
      success: true,
      data: result.status === 'success' ? (result as any).result : null,
    });
  } catch (err: any) {
    console.error('[BrandVoiceRAG]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Admin: Run Book Eval ────────────────────────────────────────────────────
app.post('/api/admin/eval-run', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;

  if (auth.tier !== 'EMPIRE') {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  try {
    const { input, output } = await c.req.json();

    if (!output?.pages || !Array.isArray(output.pages)) {
      return c.json({ error: 'output.pages array is required' }, 400);
    }

    const evalResult = await evaluateBookQuality(input ?? {}, output);

    // Persist result to book_eval_results for trend tracking
    await supabaseAdmin.from('book_eval_results').insert({
      user_id: auth.userId,
      overall_score: Math.round(evalResult.score * 100),
      age_appropriateness: Math.round(evalResult.dimensions.ageAppropriateness * 100),
      narrative_coherence: Math.round(evalResult.dimensions.coherence * 100),
      character_consistency: Math.round(evalResult.dimensions.grammar * 100),
      image_text_alignment: Math.round(evalResult.dimensions.completeness * 100),
      reason: evalResult.reason,
      created_at: new Date().toISOString(),
    });

    return c.json({ success: true, data: evalResult });
  } catch (err: any) {
    console.error('[Admin EvalRun]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Admin: Eval Averages ────────────────────────────────────────────────────
app.get('/api/admin/eval-averages', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;

  // Only EMPIRE tier users can access admin endpoints
  if (auth.tier !== 'EMPIRE') {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('book_eval_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Calculate averages
    const totals = (data ?? []).reduce(
      (acc, row) => ({
        ageAppropriateness: acc.ageAppropriateness + (row.age_appropriateness ?? 0),
        narrativeCoherence: acc.narrativeCoherence + (row.narrative_coherence ?? 0),
        characterConsistency: acc.characterConsistency + (row.character_consistency ?? 0),
        imageTextAlignment: acc.imageTextAlignment + (row.image_text_alignment ?? 0),
        count: acc.count + 1,
      }),
      {
        ageAppropriateness: 0,
        narrativeCoherence: 0,
        characterConsistency: 0,
        imageTextAlignment: 0,
        count: 0,
      }
    );

    const count = totals.count || 1;
    return c.json({
      success: true,
      data: {
        ageAppropriateness: Math.round(totals.ageAppropriateness / count),
        narrativeCoherence: Math.round(totals.narrativeCoherence / count),
        characterConsistency: Math.round(totals.characterConsistency / count),
        imageTextAlignment: Math.round(totals.imageTextAlignment / count),
        sampleSize: totals.count,
      },
    });
  } catch (err: any) {
    console.error('[Admin EvalAverages]', err);
    return c.json({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = Number(process.env.MASTRA_SERVER_PORT ?? 4111);

/**
 * Start the Mastra HTTP server.
 * Called from the "mastra:dev" npm script or from the deployment entrypoint.
 */
export function start() {
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`\n🧠 Genesis Mastra Server running on http://localhost:${info.port}`);
    console.log(`   Health check: http://localhost:${info.port}/health`);
    console.log(`   Agents: 6 registered`);
    console.log(`   Workflows: 2 registered\n`);
  });
}

// Auto-start if this file is the entry point
const isDirectRun = process.argv[1]?.includes('server');
if (isDirectRun) {
  start();
}

export { app };
export default app;
