import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createAuthenticatedHandler, type ApiContext } from './_middleware';

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_FROM = 'Genesis <hello@iamazeyou.me>';
const MAX_RECIPIENTS_PER_REQUEST = 10;

// Simple in-memory rate limiter for email endpoint
const emailRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_EMAILS_PER_HOUR = 10;

function sanitizeHeaderValue(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]/g, ' ').trim();
}

function isValidEmail(value: string): boolean {
  // Practical validation for API boundary checks.
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
  if (entry.count >= MAX_EMAILS_PER_HOUR) return false;
  entry.count++;
  return true;
}

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log, requestId, userId } = ctx;

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limit by authenticated user
    if (!checkEmailRateLimit(userId || requestId)) {
      return res.status(429).json({ error: 'Too many email requests. Please try again later.' });
    }

    try {
      const { to, subject, html, text, from, replyTo } = req.body;

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

      // Ignore caller-supplied from values to prevent authenticated users from spoofing sender identity.
      if (from) {
        log.warn('Ignoring caller-supplied "from" field', { requestId, userId });
      }

      const { data, error } = await resend.emails.send({
        from: DEFAULT_FROM,
        to: recipients,
        subject: safeSubject,
        html,
        text,
        replyTo: safeReplyTo,
      });

      if (error) {
        log.error('Resend API error in send-email');
        return res.status(400).json({ error: 'Failed to send email' });
      }

      return res.status(200).json({ success: true, id: data?.id });
    } catch (error: any) {
      log.error('Server error in send-email handler', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }
  },
  { protection: 'api', rateLimit: { requests: 10, window: '1m' } }
);
