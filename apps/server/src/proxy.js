import { Router } from 'express';
import { requireSession } from './auth.js';

const router = Router();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('[bento-proxy] FATAL: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const API_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '16384', 10);
const STREAM_TIMEOUT = parseInt(process.env.STREAM_TIMEOUT_MS || '300000', 10); // 5min

// ── OpenAI-compatible `/v1/chat/completions` proxy ───────────────────
// Uses raw fetch to OpenAI API instead of the SDK, giving us full control
// over streaming passthrough without SDK-internal buffering.
// The response format matches OpenAI's wire format so the desktop app's
// `send_openai_stream` parser (chat.rs) works without changes.
router.post('/v1/chat/completions', requireSession, async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT);

  // Clean up on client disconnect
  req.on('close', () => { controller.abort(); clearTimeout(timeout); });

  try {
    const { stream, ...rest } = req.body;

    const body = {
      ...rest,
      model: rest.model || req.session.model || DEFAULT_MODEL,
      max_tokens: rest.max_tokens ?? MAX_TOKENS,
      stream: !!stream,
    };

    const openaiResp = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!openaiResp.ok) {
      const errBody = await openaiResp.text().catch(() => '');
      const status = openaiResp.status;
      console.error(`[proxy] OpenAI returned ${status}: ${errBody.slice(0, 200)}`);
      return res.status(status).json({
        error: { message: `OpenAI API error (${status})`, type: 'upstream_error', code: 'UPSTREAM_ERROR' },
      });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = openaiResp.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Forward raw SSE — preserves OpenAI wire format including [DONE]
          res.write(chunk);
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
    } else {
      const data = await openaiResp.json();
      res.json(data);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      if (!res.headersSent) {
        return res.status(504).json({ error: { message: 'Upstream timeout', type: 'timeout' } });
      }
      return;
    }

    console.error('[proxy] error:', err.message);

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({
        error: { message: err.message, type: 'proxy_error' },
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json({
        error: {
          message: err.message,
          type: 'proxy_error',
          code: 'PROXY_ERROR',
        },
      });
    }
  } finally {
    clearTimeout(timeout);
  }
});

// ── List models ──────────────────────────────────────────────────────
const KNOWN_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'o3', 'o3-mini', 'o4-mini',
];

router.get('/v1/models', requireSession, async (req, res) => {
  try {
    const resp = await fetch(`${API_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      return res.json(data);
    }
  } catch { /* fall through */ }

  // Return known models as fallback
  res.json({
    object: 'list',
    data: KNOWN_MODELS.map(id => ({ id, object: 'model' })),
  });
});

export { router as chatRouter };
