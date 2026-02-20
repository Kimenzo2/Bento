/**
 * Server-side Gemini text generation proxy.
 * Keeps all GEMINI_API_KEY_* secrets server-only.
 *
 * Accepts: { model, contents, config }
 * Returns: { text: string }
 */
import { createAuthenticatedHandler, type ApiContext } from './middleware';

// Collect all configured keys (without VITE_ prefix — server-only)
const keys: string[] = [];
for (let i = 1; i <= 20; i++) {
  const k = process.env[`GEMINI_API_KEY_${i}`];
  if (k) keys.push(k);
}
let keyIndex = 0;
function nextKey(): string {
  if (keys.length === 0) throw new Error('No Gemini API keys configured on server');
  const k = keys[keyIndex % keys.length];
  keyIndex++;
  return k;
}

const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
]);

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log } = ctx;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { model, contents, config } = req.body ?? {};

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: `Model "${model}" is not allowed` });
    }

    // Try up to 3 different keys on failure
    const maxRetries = Math.min(3, keys.length);
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = nextKey();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const body: Record<string, unknown> = { contents };
        if (config) body.generationConfig = config;

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (resp.status === 429 || resp.status === 403 || resp.status >= 500) {
          lastError = `Gemini returned ${resp.status}`;
          log.warn('Gemini key failed, rotating', { status: resp.status, attempt });
          continue;
        }

        if (!resp.ok) {
          const errBody = await resp.text();
          return res.status(resp.status).json({ error: 'Gemini API error', details: errBody });
        }

        const data = await resp.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
          '';

        return res.status(200).json({ text, raw: data });
      } catch (err: any) {
        lastError = err.message;
        log.warn('Gemini request failed', { error: err.message, attempt });
      }
    }

    return res.status(502).json({ error: 'All Gemini keys failed', details: lastError });
  },
  { rateLimit: { requests: 30, window: '1m' } }
);
