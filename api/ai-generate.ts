/**
 * Server-side Gemini text generation proxy.
 * Keeps all GEMINI_API_KEY_* secrets server-only.
 *
 * Accepts:
 *   { model, contents, config }           — raw Gemini REST format
 *   { model, prompt, maxTokens? }         — simple text prompt
 *   { model, messages, systemInstruction? } — chat messages array
 * Returns: { text: string }
 */
import { createAuthenticatedHandler, type ApiContext } from './_middleware';

// Single API key — no rotation to protect free-tier quota from being banned.
const GEMINI_SINGLE_KEY = process.env.GEMINI_API_KEY_1;
function nextKey(): string {
  if (!GEMINI_SINGLE_KEY) throw new Error('No Gemini API key configured. Set GEMINI_API_KEY_1 in your environment.');
  return GEMINI_SINGLE_KEY;
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

    const { model, contents: rawContents, config, prompt, maxTokens, messages, systemInstruction } = req.body ?? {};

    if (!model) {
      return res.status(400).json({ error: 'Missing required field: model' });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: `Model "${model}" is not allowed` });
    }

    // Build Gemini REST `contents` from whichever format was provided
    let contents: unknown;
    let resolvedSystemInstruction: string | undefined;

    if (rawContents) {
      // Already in Gemini REST format
      contents = rawContents;
      resolvedSystemInstruction = systemInstruction;
    } else if (prompt) {
      // Simple text prompt — wrap in Gemini format
      contents = [{ role: 'user', parts: [{ text: String(prompt) }] }];
    } else if (Array.isArray(messages) && messages.length > 0) {
      // Chat messages array — convert to Gemini format, extract system messages
      const sysMsgs = messages.filter((m: { role: string }) => m.role === 'system');
      const chatMsgs = messages.filter((m: { role: string }) => m.role !== 'system');
      if (sysMsgs.length > 0) {
        resolvedSystemInstruction = sysMsgs.map((m: { content: string }) => m.content).join('\n');
      }
      contents = chatMsgs.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    } else {
      return res.status(400).json({ error: 'Missing required fields: provide prompt, messages, or contents' });
    }

    const apiKey = nextKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Abort the upstream Gemini request 5 s before Vercel kills the function
    // (maxDuration = 60 s → internal deadline = 55 s).  This ensures we always
    // return a well-formed JSON error instead of dropping the connection, which
    // causes the browser to receive `TypeError: Failed to fetch`.
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 55_000);

    try {
      const body: Record<string, unknown> = { contents };
      if (config) body.generationConfig = config;
      if (maxTokens) body.generationConfig = { ...(body.generationConfig as object ?? {}), maxOutputTokens: maxTokens };
      if (resolvedSystemInstruction) body.systemInstruction = { parts: [{ text: resolvedSystemInstruction }] };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(deadline);

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
      clearTimeout(deadline);
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Gemini API timeout — request exceeded 55 s' });
      }
      return res.status(502).json({ error: 'Gemini request failed', details: err.message });
    }
  },
  { rateLimit: { requests: 30, window: '1m' } }
);
