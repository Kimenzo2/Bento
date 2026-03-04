/**
 * Server-side Bytez AI proxy.
 * Keeps all BYTEZ_API_KEY_* secrets server-only.
 *
 * Accepts: { model, input }
 * Returns: Bytez response (contains `output` field)
 */
import { createAuthenticatedHandler, type ApiContext } from './middleware';

const keys: string[] = [];
for (let i = 1; i <= 20; i++) {
  const k = process.env[`BYTEZ_API_KEY_${i}`];
  if (k) keys.push(k);
}
let keyIndex = 0;
function nextKey(): string {
  if (keys.length === 0) throw new Error('No Bytez API keys configured on server');
  const k = keys[keyIndex % keys.length];
  keyIndex++;
  return k;
}

const ALLOWED_MODELS = new Set([
  // Image generation models
  'google/imagen-4.0-generate-001',
  'google/imagen-4.0-ultra-generate-001',
  'stabilityai/stable-diffusion-xl-base-1.0',
  'black-forest-labs/FLUX.1-schnell',
  'black-forest-labs/FLUX.1-dev',
  'ByteDance/SDXL-Lightning',
  // Vision / multimodal models
  'Qwen/Qwen2.5-VL-7B-Instruct',
  'meta-llama/Llama-3.2-11B-Vision-Instruct',
  // Text generation models
  'meta-llama/Llama-3.3-70B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'mistralai/Mistral-Small-24B-Instruct-2501',
]);

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log } = ctx;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { model, input } = req.body ?? {};

    if (!model || !input) {
      return res.status(400).json({ error: 'Missing required fields: model, input' });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: `Model "${model}" is not allowed` });
    }

    const maxRetries = Math.min(3, keys.length);
    let lastError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = nextKey();

      try {
        const resp = await fetch('https://api.bytez.com/models/v2/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${apiKey}`,
          },
          body: JSON.stringify({ model, input }),
        });

        if (resp.status === 429 || resp.status === 403 || resp.status >= 500) {
          lastError = `Bytez returned ${resp.status}`;
          log.warn('Bytez key failed, rotating', { status: resp.status, attempt });
          continue;
        }

        if (!resp.ok) {
          const errBody = await resp.text();
          return res.status(resp.status).json({ error: 'Bytez API error', details: errBody });
        }

        const data = await resp.json();
        return res.status(200).json(data);
      } catch (err: any) {
        lastError = err.message;
        log.warn('Bytez request failed', { error: err.message, attempt });
      }
    }

    return res.status(502).json({ error: 'All Bytez keys failed', details: lastError });
  },
  { rateLimit: { requests: 20, window: '1m' } }
);
