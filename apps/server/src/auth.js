import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[bento-proxy] FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const router = Router();

// In-memory store for device code flows (production: use Redis/DB)
const deviceFlows = new Map();
// In-memory session store (production: use Redis/DB)
const sessions = new Map();
// Simple rate-limiter: IP -> request count per minute
const rateLimitMap = new Map();
// Poll tracking: device_code -> { lastPoll, count }
const pollTracker = new Map();

const DEVICE_CODE_TTL = 10 * 60 * 1000; // 10 minutes
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** Rate limit helper: max N requests per minute per IP */
function checkRateLimit(ip, maxPerMinute) {
  const now = Date.now();
  const window = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > window.resetAt) {
    window.count = 0;
    window.resetAt = now + 60000;
  }
  window.count++;
  rateLimitMap.set(ip, window);
  return window.count <= maxPerMinute;
}

// ── Start device code flow ──────────────────────────────────────────────
router.post('/device-code', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 5)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  const deviceCode = uuidv4();
  // RFC 8628 base-20 consonant charset: BCDFGHJKLMNPQRSTVWXZ
  const CHARSET = 'BCDFGHJKLMNPQRSTVWXZ';
  let userCode = '';
  for (let i = 0; i < 8; i++) {
    userCode += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    if (i === 3) userCode += '-';
  }
  const verificationUri = `${req.protocol}://${req.get('host')}/api/auth/verify`;
  const verificationUriComplete = `${verificationUri}?code=${userCode}`;

  deviceFlows.set(deviceCode, {
    userCode,
    clientId,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + DEVICE_CODE_TTL,
    userId: null,
  });

  console.log(`[auth] device flow started: device=${deviceCode.slice(0, 8)}... code=${userCode}`);

  res.json({
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    expiresIn: DEVICE_CODE_TTL / 1000,
    interval: 5,
  });
});

// ── Verify device code (user enters code here) ─────────────────────────
router.post('/verify', (req, res) => {
  const { userCode } = req.body;
  if (!userCode) {
    return res.status(400).json({ error: 'userCode is required' });
  }

  // RFC 8628: strip punctuation, uppercase before comparison
  const code = userCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  // Find the device flow with matching user code
  let foundFlow = null;
  let foundKey = null;
  for (const [key, flow] of deviceFlows) {
    if (flow.userCode.replace('-', '') === code && flow.status === 'pending') {
      foundFlow = flow;
      foundKey = key;
      break;
    }
  }

  if (!foundFlow) {
    return res.status(404).json({ error: 'Invalid or expired code' });
  }

  if (Date.now() > foundFlow.expiresAt) {
    deviceFlows.delete(foundKey);
    return res.status(410).json({ error: 'Code expired' });
  }

  // Create user session
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    userId: foundFlow.clientId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
    plan: 'chatgpt_plus', // default plan; upgrade logic in plan.js
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  };

  sessions.set(sessionId, session);
  foundFlow.status = 'approved';
  foundFlow.userId = sessionId;

  const token = jwt.sign(
    { sub: sessionId, userId: foundFlow.clientId, plan: session.plan },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    sessionId,
    expiresIn: SESSION_TTL / 1000,
    plan: session.plan,
  });
});

// ── Poll device code status ────────────────────────────────────────────
router.post('/poll', (req, res) => {
  const { deviceCode } = req.body;
  if (!deviceCode) {
    return res.status(400).json({ error: 'deviceCode is required' });
  }

  // RFC 8628 slow_down: track polling frequency per device code
  const now = Date.now();
  const pollState = pollTracker.get(deviceCode) || { lastPoll: 0, excessCount: 0 };
  const elapsed = now - pollState.lastPoll;
  if (pollState.lastPoll > 0 && elapsed < 5000) {
    pollState.excessCount++;
    if (pollState.excessCount > 3) {
      return res.json({ status: 'slow_down', interval: Math.min(5 + pollState.excessCount, 30) });
    }
  }
  pollState.lastPoll = now;
  if (elapsed >= 5000) pollState.excessCount = 0;
  pollTracker.set(deviceCode, pollState);

  const flow = deviceFlows.get(deviceCode);
  if (!flow) {
    pollTracker.delete(deviceCode);
    return res.status(404).json({ error: 'Device code not found' });
  }

  if (now > flow.expiresAt) {
    deviceFlows.delete(deviceCode);
    pollTracker.delete(deviceCode);
    return res.json({ status: 'expired' });
  }

  if (flow.status === 'approved') {
    const session = sessions.get(flow.userId);
    if (!session) {
      return res.status(500).json({ error: 'Session not found' });
    }

    const token = jwt.sign(
      { sub: session.id, userId: session.userId, plan: session.plan },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: 'approved',
      token,
      sessionId: session.id,
      expiresIn: Math.floor((session.expiresAt - Date.now()) / 1000),
      plan: session.plan,
    });
  }

  res.json({ status: 'pending' });
});

// ── Verify session token ───────────────────────────────────────────────
router.post('/verify-session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const session = sessions.get(decoded.sub);
    if (!session || Date.now() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expired or not found' });
    }

    res.json({
      valid: true,
      sessionId: session.id,
      plan: session.plan,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', detail: err.message });
  }
});

// ── Refresh session ────────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.expiresAt = Date.now() + SESSION_TTL;

  const token = jwt.sign(
    { sub: session.id, userId: session.userId, plan: session.plan },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, expiresIn: SESSION_TTL / 1000 });
});

// ── Logout / revoke session ────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      sessions.delete(decoded.sub);
      console.log(`[auth] session revoked: ${decoded.sub}`);
    } catch { /* token may already be invalid */ }
  }

  res.json({ status: 'logged_out' });
});

export { router as authRouter };

// Middleware to protect chat routes
export function requireSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session required' });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const session = sessions.get(decoded.sub);
    if (!session || Date.now() > session.expiresAt) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.session = session;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', detail: err.message });
  }
}
