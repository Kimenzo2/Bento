/**
 * Server-side Bytez AI proxy.
 * Keeps all BYTEZ_API_KEY_* secrets server-only.
 *
 * Accepts: { model, input }
 * Returns: Bytez response (contains `output` field)
 */
import { createAuthenticatedHandler, type ApiContext } from './_middleware';

// Single Bytez API key — no rotation to protect free-tier quota.
const BYTEZ_SINGLE_KEY = process.env.BYTEZ_API_KEY_1;
function nextKey(): string {
  if (!BYTEZ_SINGLE_KEY) throw new Error('No Bytez API key configured. Set BYTEZ_API_KEY_1 in your environment.');
  return BYTEZ_SINGLE_KEY;
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

      if (!resp.ok) {
        const errBody = await resp.text();
        return res.status(resp.status).json({ error: 'Bytez API error', details: errBody });
      }

      const data = await resp.json();
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(502).json({ error: 'Bytez request failed', details: err.message });
    }
  },
  { rateLimit: { requests: 20, window: '1m' } }
);
