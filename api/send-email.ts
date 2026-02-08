import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY);

// Simple in-memory rate limiter for email endpoint
const emailRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_EMAILS_PER_HOUR = 10;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit by IP
  const clientIp = (typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : req.headers['x-real-ip'] || 'unknown') as string;
  if (!checkEmailRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many email requests. Please try again later.' });
  }

  try {
    const { to, subject, html, text, from, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, and html or text',
      });
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: from || 'Genesis <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
    });

    if (error) {
      console.error('Resend API error in send-email');
      return res.status(400).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (error: any) {
    console.error('Server error in send-email handler');
    return res.status(500).json({
      error: 'Failed to send email',
    });
  }
}
