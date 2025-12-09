import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.VITE_RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text, from, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and html or text' 
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
      console.error('❌ Resend API error: - send-email.ts:33', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('✅ Email sent: - send-email.ts:37', data?.id);
    return res.status(200).json({ success: true, id: data?.id });
  } catch (error: any) {
    console.error('❌ Server error: - send-email.ts:40', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
}
