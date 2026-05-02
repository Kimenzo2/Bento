import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createAndrewRequestContext, ANDREW_PROMPT_VERSION } from './lib/andrewRuntime';
import { createClient } from '@supabase/supabase-js';
import { LifeInColourStartRequestSchema } from './schemas';
import {
  getLifeInColourGeneration,
  insertLifeInColourGeneration,
  listLifeInColourGenerations,
} from './lib/supabase';
import { failLifeInColourGeneration, runLifeInColourGeneration } from './services/lifeInColourGeneration';

interface AuthenticatedContext {
  userId: string;
  email: string;
}

const app = new Hono();
const activeGenerationIds = new Set<string>();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
);

app.use('/api/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('auth' as never, {
    userId: user.id,
    email: user.email || '',
  } satisfies AuthenticatedContext);

  await next();
});

app.get('/health', (c) => c.json({ status: 'ok', service: 'genesis-root-mastra', agents: 1 }));
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'genesis-root-mastra', agents: 1 }));

app.post('/api/life-in-colour/generate', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const body = await c.req.json().catch(() => ({}));
  const parsed = LifeInColourStartRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid Life in Colour request',
        details: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      },
      400
    );
  }

  if (!parsed.data.sourcePath.startsWith(`${auth.userId}/`)) {
    return c.json({ error: 'Source asset path does not belong to the authenticated user' }, 403);
  }

  const record = await insertLifeInColourGeneration({
    userId: auth.userId,
    title: parsed.data.title,
    brief: parsed.data.brief,
    outlineMode: parsed.data.outlineMode,
    sourcePath: parsed.data.sourcePath,
    sourceMimeType: parsed.data.sourceMimeType,
    sourceFileName: parsed.data.sourceFileName,
  });

  activeGenerationIds.add(record.id);
  const requestContext = createAndrewRequestContext({
    userId: auth.userId,
    generationId: record.id,
    outlineMode: record.outline_mode,
    promptVersion: ANDREW_PROMPT_VERSION,
  });

  void (async () => {
    try {
      await runLifeInColourGeneration(record, { requestContext });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Life in Colour generation failed.';
      await failLifeInColourGeneration(record.id, message);
    } finally {
      activeGenerationIds.delete(record.id);
    }
  })();

  return c.json({
    generationId: record.id,
    status: 'queued',
    fallbackEligible: true,
  }, 202);
});

app.get('/api/life-in-colour/generations/:generationId', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const generationId = c.req.param('generationId');
  const record = await getLifeInColourGeneration(generationId, auth.userId);

  if (!record) {
    return c.json({ error: 'Generation not found' }, 404);
  }

  return c.json({
    generation: record,
    active: activeGenerationIds.has(record.id),
    fallbackEligible: record.fallback_eligible,
  });
});

app.get('/api/life-in-colour/generations', async (c) => {
  const auth = c.get('auth' as never) as AuthenticatedContext;
  const limit = Number(c.req.query('limit') || 8);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(24, Math.floor(limit))) : 8;
  const generations = await listLifeInColourGenerations(auth.userId, safeLimit);

  return c.json({
    generations,
  });
});

const PORT = Number(process.env.MASTRA_SERVER_PORT ?? 4111);

export function start() {
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Andrew Mastra server listening on http://localhost:${info.port}`);
  });
}

const isDirectRun = process.argv[1]?.includes('server');
if (isDirectRun) {
  start();
}

export default app;
