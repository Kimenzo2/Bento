/**
 * Resend Inbound Email Webhook Handler
 *
 * Receives `email.received` webhook events from Resend, retrieves the full
 * email content via the Receiving API, and forwards the message to the
 * owner's personal inbox (otienolorenzo704@gmail.com).
 *
 * Routing: all @iamazeyou.me addresses (hello@, support@, enterprise@,
 * sales@, legal@, and any others) are forwarded to a single inbox.
 *
 * Webhook URL (configure in Resend dashboard):
 *   https://iamazeyou.me/api/inbound-email
 *
 * Required env vars:
 *   RESEND_API_KEY          – for sending forwarded emails & retrieving content
 *   RESEND_WEBHOOK_SECRET   – svix signing secret for verifying webhook payload
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FORWARD_TO = 'otienolorenzo704@gmail.com';
const FORWARD_FROM = 'Genesis Mail <hello@iamazeyou.me>';
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per attachment

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

// ── Main handler ─────────────────────────────────────────────────────────────

export const config = {
  api: { bodyParser: false },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
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
        }),
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
      `[inbound-email] Forwarded email ${emailId} from ${originalFrom} → ${FORWARD_TO} (id: ${result.data?.id})`,
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
