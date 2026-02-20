/**
 * Server-side integration proxy.
 * Routes requests to Mux, Algolia, Upstash, Liveblocks, Resend
 * keeping all secret keys server-only.
 *
 * Accepts: { service, endpoint, method?, body? }
 * Returns: upstream response
 */
import { createAuthenticatedHandler, type ApiContext } from './middleware';

interface ServiceConfig {
  baseUrl: string;
  allowedPaths: RegExp[];
  allowedMethods: string[];
  getHeaders: () => Record<string, string>;
}

function getServiceConfigs(): Record<string, ServiceConfig> {
  return {
    mux: {
      baseUrl: 'https://api.mux.com',
      allowedPaths: [/^\/video\/v1\//, /^\/data\/v1\//],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      getHeaders: () => {
        const tokenId = process.env.MUX_TOKEN_ID;
        const tokenSecret = process.env.MUX_TOKEN_SECRET;
        return {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
        };
      },
    },
    algolia: {
      baseUrl: `https://${process.env.VITE_ALGOLIA_APP_ID || process.env.ALGOLIA_APP_ID}-dsn.algolia.net`,
      allowedPaths: [/^\/1\/indexes\//],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      getHeaders: () => ({
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': process.env.VITE_ALGOLIA_APP_ID || process.env.ALGOLIA_APP_ID || '',
        'X-Algolia-API-Key': process.env.ALGOLIA_WRITE_KEY || '',
      }),
    },
    upstash: {
      baseUrl: process.env.UPSTASH_REDIS_REST_URL || '',
      allowedPaths: [/^\/?$/, /^\/pipeline\/?$/],
      allowedMethods: ['GET', 'POST'],
      getHeaders: () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || ''}`,
      }),
    },
    liveblocks: {
      baseUrl: 'https://api.liveblocks.io',
      allowedPaths: [/^\/v2\//, /^\/api\//],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      getHeaders: () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LIVEBLOCKS_SECRET_KEY || ''}`,
      }),
    },
    resend: {
      baseUrl: 'https://api.resend.com',
      allowedPaths: [/^\/emails/, /^\/domains/, /^\/api-keys/],
      allowedMethods: ['GET', 'POST', 'DELETE'],
      getHeaders: () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY || ''}`,
      }),
    },
  };
}

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log } = ctx;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { service, endpoint, method = 'POST', body } = req.body ?? {};

    if (!service || !endpoint) {
      return res.status(400).json({ error: 'Missing required fields: service, endpoint' });
    }

    const configs = getServiceConfigs();
    const svcConfig = configs[service as string];
    if (!svcConfig) {
      return res.status(400).json({ error: `Unknown service: ${service}` });
    }

    // Validate method
    if (!svcConfig.allowedMethods.includes(method.toUpperCase())) {
      return res.status(403).json({ error: `Method ${method} not allowed for ${service}` });
    }

    // Validate path
    const pathAllowed = svcConfig.allowedPaths.some((re) => re.test(endpoint));
    if (!pathAllowed) {
      return res.status(403).json({ error: `Path "${endpoint}" not allowed for ${service}` });
    }

    const url = `${svcConfig.baseUrl}${endpoint}`;
    const headers = svcConfig.getHeaders();

    log.info('Proxying request', { service, endpoint, method });

    try {
      const fetchOpts: RequestInit = {
        method: method.toUpperCase(),
        headers,
      };
      if (body && method.toUpperCase() !== 'GET') {
        fetchOpts.body = JSON.stringify(body);
      }

      const resp = await fetch(url, fetchOpts);
      const contentType = resp.headers.get('content-type') || '';
      const data = contentType.includes('json') ? await resp.json() : await resp.text();

      return res.status(resp.status).json(typeof data === 'string' ? { text: data } : data);
    } catch (err: any) {
      log.error('Proxy request failed', err);
      return res.status(502).json({ error: 'Proxy request failed', details: err.message });
    }
  },
  { rateLimit: { requests: 60, window: '1m' } }
);
