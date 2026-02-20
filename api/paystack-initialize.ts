/**
 * Paystack Transaction Initialize Endpoint
 * 
 * Server-side transaction initialization with plan support.
 * Returns an authorization_url for full-page Paystack checkout.
 * This gives the same trusted Payment Page experience while
 * allowing us to control email, plan, metadata, and callback_url.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, type ApiContext } from './middleware';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_INIT_URL = 'https://api.paystack.co/transaction/initialize';

// Valid plan codes — reject anything not in this set
const VALID_PLAN_CODES = new Set([
  'PLN_zbnzvdqjsdxfcqc', // Creator $19.99/mo
  'PLN_09zg1ly5kg57niz', // Studio $49.92/mo
  'PLN_tv2y349z88b1bd8', // Empire $166.58/mo
  'PLN_sx952147c601pnd', // Onboarding Exclusive $11.99/mo
]);

interface InitializeRequest {
  email: string;
  plan: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
}

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log, userId } = ctx;

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!PAYSTACK_SECRET_KEY) {
      log.error('PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Payment service unavailable' });
    }

    const { email, plan, callback_url, metadata } = req.body as InitializeRequest;

    if (!email || !plan || !callback_url) {
      return res.status(400).json({ error: 'Missing required fields: email, plan, callback_url' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!VALID_PLAN_CODES.has(plan)) {
      return res.status(400).json({ error: 'Invalid plan code' });
    }

    // Validate callback URL (must be our domain or localhost for dev)
    try {
      const callbackUrl = new URL(callback_url);
      const allowedHosts = ['iamazeyou.me', 'www.iamazeyou.me', 'localhost'];
      const isVercelPreview = callbackUrl.hostname.endsWith('.vercel.app');
      if (!allowedHosts.includes(callbackUrl.hostname) && !isVercelPreview) {
        return res.status(400).json({ error: 'Invalid callback URL domain' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid callback URL' });
    }

    try {
      const response = await fetch(PAYSTACK_INIT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          plan,
          callback_url,
          metadata: {
            ...metadata,
            // Ensure user_id is always present for the webhook handler
            user_id: userId,
            plan_code: plan,
            custom_fields: [
              {
                display_name: 'Plan Code',
                variable_name: 'plan_code',
                value: plan,
              },
            ],
          },
          channels: ['card', 'bank', 'ussd', 'mobile_money', 'bank_transfer', 'apple_pay'],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        log.error('Paystack API error', undefined, { response: data });
        return res.status(502).json({
          error: 'Payment initialization failed',
          message: data.message || 'Unknown error from payment provider',
        });
      }

      return res.status(200).json({
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference,
      });
    } catch (error: any) {
      log.error('Server error', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  { protection: 'api', cors: true }
);
