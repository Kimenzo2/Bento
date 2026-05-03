/**
 * Server-side image generation compatibility route.
 *
 * This endpoint now uses the shared Mastra AI gateway and Bytez directly,
 * keeping the legacy `/api/ai-bytez` contract available for any callers
 * that still use it during the migration.
 */
import { createAuthenticatedHandler, type ApiContext } from './_middleware';
import { generateBytezImage } from '../apps/genesis-app/mastra/lib/aiGateway';

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res } = ctx;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { model, input } = req.body ?? {};

    if (!model || !input) {
      return res.status(400).json({ error: 'Missing required fields: model, input' });
    }

    try {
      const imageUrl = await generateBytezImage({
        model: String(model),
        prompt: String(input),
      });

      return res.status(200).json({ imageUrl });
    } catch (err: any) {
      return res.status(502).json({ error: 'Bytez request failed', details: err.message });
    }
  },
  { rateLimit: { requests: 20, window: '1m' } }
);
