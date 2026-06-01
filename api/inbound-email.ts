/**
 * Resend Email API Handler
 *
 * Handles both:
 * - Resend inbound email webhooks at /api/inbound-email
 * - Authenticated outbound email sends at /api/send-email (via rewrite)
 *
 * Routing: all @iamazeyou.me addresses (hello@, support@, enterprise@,
 * sales@, legal@, and any others) are forwarded to a single inbox.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FORWARD_TO = 'otienolorenzo704@gmail.com';
const FORWARD_FROM = 'Genesis Mail <hello@iamazeyou.me>';
const DEFAULT_FROM = 'Genesis <hello@iamazeyou.me>';
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per attachment
const MAX_RECIPIENTS_PER_REQUEST = 10;
const MAX_EMAILS_PER_HOUR = 10;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const emailRateLimit = new Map<string, { count: number; resetAt: number }>();

const allowedOrigins = ['https://iamazeyou.me', 'http://localhost:3000', 'http://localhost:5173'];

type EmailSendPayload = {
  to?: unknown;
  subject?: unknown;
  html?: string;
  text?: string;
  from?: unknown;
  replyTo?: unknown;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read the raw request body as a string (needed for signature verification). */
function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

function sanitizeHeaderValue(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n]/g, ' ')
    .trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRecipients(to: unknown): string[] {
  const list = Array.isArray(to) ? to : [to];
  const normalized = list.map((entry) => sanitizeHeaderValue(entry)).filter(Boolean);

  if (normalized.length === 0) {
    throw new Error('At least one recipient is required');
  }

  if (normalized.length > MAX_RECIPIENTS_PER_REQUEST) {
    throw new Error(`A maximum of ${MAX_RECIPIENTS_PER_REQUEST} recipients is allowed`);
  }

  const invalid = normalized.find((email) => !isValidEmail(email));
  if (invalid) {
    throw new Error(`Invalid recipient email: ${invalid}`);
  }

  return normalized;
}

function checkEmailRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = emailRateLimit.get(identifier);

  if (!entry || entry.resetAt < now) {
    emailRateLimit.set(identifier, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (entry.count >= MAX_EMAILS_PER_HOUR) {
    return false;
  }

  entry.count++;
  return true;
}

async function parseJsonBody<T>(req: VercelRequest): Promise<T> {
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }

  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }

  const rawBody = await getRawBody(req);
  return rawBody ? (JSON.parse(rawBody) as T) : ({} as T);
}

async function handleSendEmail(req: VercelRequest, res: VercelResponse): Promise<void> {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase is not configured for email sending' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!checkEmailRateLimit(user.id)) {
    return res.status(429).json({ error: 'Too many email requests. Please try again later.' });
  }

  try {
    const { to, subject, html, text, from, replyTo } = await parseJsonBody<EmailSendPayload>(req);

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and html or text',
      });
    }

    const recipients = normalizeRecipients(to);
    const safeSubject = sanitizeHeaderValue(subject);
    const safeReplyTo = replyTo ? sanitizeHeaderValue(replyTo) : undefined;

    if (!safeSubject) {
      return res.status(400).json({ error: 'Subject cannot be empty' });
    }

    if (safeReplyTo && !isValidEmail(safeReplyTo)) {
      return res.status(400).json({ error: 'Invalid replyTo address' });
    }

    if (from) {
      console.warn('[inbound-email] Ignoring caller-supplied "from" field for send-email');
    }

    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to: recipients,
      subject: safeSubject,
      html,
      text,
      replyTo: safeReplyTo,
    });

    if (result.error) {
      console.error('[inbound-email] Resend API error in send-email');
      return res.status(400).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: result.data?.id });
  } catch (error) {
    console.error('[inbound-email] Server error in send-email handler', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  if (action === 'send-email') {
    return handleSendEmail(req, res);
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[inbound-email] RESEND_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // ── 1. Read raw body & verify signature ────────────────────────────────
  let payload: any;
  try {
    const rawBody = await getRawBody(req);

    // Verify webhook authenticity (single-object signature)
    payload = resend.webhooks.verify({
      webhookSecret,
      payload: rawBody,
      headers: {
        id: req.headers['svix-id'] as string,
        timestamp: req.headers['svix-timestamp'] as string,
        signature: req.headers['svix-signature'] as string,
      },
    });
  } catch (err) {
    console.error('[inbound-email] Webhook verification failed:', err);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // ── 2. Only handle email.received events ───────────────────────────────
  const eventType = payload?.type;
  if (eventType !== 'email.received') {
    // Acknowledge but ignore other event types
    return res.status(200).json({ received: true, ignored: eventType });
  }

  const emailId = payload?.data?.email_id;
  if (!emailId) {
    console.error('[inbound-email] No email_id in payload');
    return res.status(400).json({ error: 'Missing email_id' });
  }

  // ── 3. Retrieve the full email content ─────────────────────────────────
  let emailContent: any;
  try {
    emailContent = await resend.emails.receiving.get(emailId);
  } catch (err) {
    console.error('[inbound-email] Failed to retrieve email content:', err);
    return res.status(500).json({ error: 'Failed to retrieve email content' });
  }

  const data = emailContent?.data;
  if (!data) {
    console.error('[inbound-email] Empty email content for', emailId);
    return res.status(500).json({ error: 'Empty email content' });
  }

  // ── 4. Build forwarded subject & metadata ──────────────────────────────
  const originalFrom = data.from || payload?.data?.from || 'Unknown sender';
  const originalTo = data.to || payload?.data?.to || [];
  const originalSubject = data.subject || payload?.data?.subject || '(no subject)';
  const toAddresses = Array.isArray(originalTo) ? originalTo.join(', ') : originalTo;

  const forwardSubject = `[Fwd: ${toAddresses}] ${originalSubject}`;

  // Build a forwarding header block
  const forwardHeader = [
    '---------- Forwarded message ----------',
    `From: ${originalFrom}`,
    `To: ${toAddresses}`,
    `Subject: ${originalSubject}`,
    `Date: ${data.created_at || new Date().toISOString()}`,
    '----------------------------------------',
  ].join('\n');

  // ── 5. Retrieve attachments (if any) ───────────────────────────────────
  let attachments: Array<{ filename: string; content: Buffer }> = [];
  try {
    const attachmentList = await resend.emails.receiving.attachments.list(emailId);
    if (attachmentList?.data && Array.isArray(attachmentList.data)) {
      const safeAttachments = attachmentList.data.slice(0, MAX_ATTACHMENTS);

      // Download each attachment
      const downloads = await Promise.all(
        safeAttachments.map(async (att: any) => {
          try {
            const response = await fetch(att.download_url);
            const contentLength = Number(response.headers.get('content-length') || '0');
            if (contentLength > MAX_ATTACHMENT_BYTES) {
              console.warn('[inbound-email] Attachment too large, skipped:', att.filename);
              return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_ATTACHMENT_BYTES) {
              console.warn('[inbound-email] Attachment exceeded max size, skipped:', att.filename);
              return null;
            }

            const buffer = Buffer.from(arrayBuffer);
            return { filename: att.filename || 'attachment', content: buffer };
          } catch {
            console.warn('[inbound-email] Failed to download attachment:', att.filename);
            return null;
          }
        })
      );
      attachments = downloads.filter(Boolean) as typeof attachments;
    }
  } catch {
    // Non-fatal — forward the email without attachments
    console.warn('[inbound-email] Could not list attachments for', emailId);
  }

  // ── 6. Forward via Resend ──────────────────────────────────────────────
  try {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const htmlBody = data.html
      ? `<div style="padding:12px 16px;margin-bottom:16px;background:#f5f5f5;border-left:3px solid #ccc;font-family:monospace;font-size:13px;white-space:pre-line">${escapeHtml(forwardHeader)}</div>${data.html}`
      : undefined;

    const textBody = data.text
      ? `${forwardHeader}\n\n${data.text}`
      : `${forwardHeader}\n\n(no text body)`;

    const sendPayload: any = {
      from: FORWARD_FROM,
      to: [FORWARD_TO],
      subject: forwardSubject,
      replyTo: typeof originalFrom === 'string' ? originalFrom : undefined,
      text: textBody,
    };

    if (htmlBody) {
      sendPayload.html = htmlBody;
    }

    if (attachments.length > 0) {
      sendPayload.attachments = attachments;
    }

    const result = await resend.emails.send(sendPayload);

    if (result.error) {
      console.error('[inbound-email] Forward failed:', result.error);
      return res.status(500).json({ error: 'Failed to forward email' });
    }

    console.log(
      `[inbound-email] Forwarded email ${emailId} from ${originalFrom} → ${FORWARD_TO} (id: ${result.data?.id})`
    );

    return res.status(200).json({
      received: true,
      forwarded: true,
      id: result.data?.id,
    });
  } catch (err) {
    console.error('[inbound-email] Error forwarding email:', err);
    return res.status(500).json({ error: 'Failed to forward email' });
  }
}
