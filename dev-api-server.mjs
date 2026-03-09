/**
 * Dev API Server — runs Vercel-style serverless functions locally.
 *
 * Usage:  node dev-api-server.mjs
 * Listens on port 3001. Vite proxies /api/* requests here.
 *
 * Supports the same ?action= routing and vercel.json rewrites
 * that production uses.
 */

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env.local (same as Vercel does)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Enable ts-node / tsx for .ts imports
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Rewrites from vercel.json (api routes only)
const REWRITES = [
  { source: '/api/dodo-checkout', destination: '/api/dodo?action=checkout' },
  { source: '/api/dodo-webhook', destination: '/api/dodo?action=webhook' },
];

function applyRewrites(url) {
  const [pathname] = url.split('?');
  for (const rule of REWRITES) {
    if (pathname === rule.source) {
      return rule.destination;
    }
  }
  return url;
}

// Dynamic handler loader — no caching so env var changes take effect immediately
async function loadHandler(apiFile) {
  const filePath = path.join(__dirname, apiFile + '.ts');
  // Bust Node's module cache by appending a unique query string
  const fileUrl = new URL(`file:///${filePath.replace(/\\/g, '/')}`).href + `?t=${Date.now()}`;
  try {
    const mod = await import(fileUrl);
    return mod.default;
  } catch (err) {
    console.error(`[dev-api] Failed to load ${filePath}:`, err);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  // Apply rewrites
  const rewrittenUrl = applyRewrites(req.url);
  const [pathname, queryString] = rewrittenUrl.split('?');

  // Only handle /api/* routes
  if (!pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not an API route' }));
    return;
  }

  // Extract the API file path (e.g., /api/dodo -> api/dodo)
  const apiFile = pathname.slice(1); // remove leading /

  // Parse query params and attach to req
  const url = new URL(rewrittenUrl, `http://${req.headers.host || 'localhost:3001'}`);
  req.query = Object.fromEntries(url.searchParams.entries());
  req.url = rewrittenUrl;

  // Wrap response to match VercelResponse interface
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // CORS for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[dev-api] ${req.method} ${req.url}`);

  try {
    const handler = await loadHandler(apiFile);
    if (!handler) {
      res.status(404).json({ error: `No handler found for ${apiFile}` });
      return;
    }
    await handler(req, res);
  } catch (err) {
    console.error(`[dev-api] Error handling ${req.url}:`, err);
    if (!res.writableEnded) {
      res.status(500).json({ error: err.message });
    }
  }
});

const PORT = process.env.DEV_API_PORT || 3002;
server.listen(PORT, () => {
  console.log(`[dev-api] API server running on http://localhost:${PORT}`);
  console.log(`[dev-api] Routes: /api/dodo-checkout, /api/dodo-webhook`);
});
