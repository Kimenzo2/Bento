/**
 * Server-side text generation compatibility route.
 *
 * This endpoint now uses the Mastra-side AI gateway.
 * It keeps the legacy `/api/ai-generate` contract alive while the browser
 * traffic shifts to the Mastra server.
 */
import { createAuthenticatedHandler, type ApiContext } from './_middleware';
import { generateTextFromRequest } from '../apps/genesis-app/mastra/lib/aiGateway';

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res } = ctx;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const result = await generateTextFromRequest(req.body ?? {});
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(502).json({ error: 'AI request failed', details: err.message });
    }
  },
  { rateLimit: { requests: 30, window: '1m' } }
);
