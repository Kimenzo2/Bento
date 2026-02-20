/**
 * Paystack Transaction Verification API Endpoint
 * Securely verifies transaction status with server-side secret key
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, type ApiContext } from './middleware';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log } = ctx;

    // Only allow GET
    if (req.method !== 'GET') {
      return res.status(405).json({ 
        status: false, 
        message: 'Method not allowed' 
      });
    }

    // Validate secret key is configured
    if (!PAYSTACK_SECRET_KEY) {
      log.error('PAYSTACK_SECRET_KEY not configured');
      return res.status(500).json({ 
        status: false, 
        message: 'Payment service not configured' 
      });
    }

    const { reference } = req.query;

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({
        status: false,
        message: 'Transaction reference is required',
      });
    }

    try {
      const response = await fetch(`${PAYSTACK_VERIFY_URL}/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (process.env.NODE_ENV !== 'production') {
        log.info('Paystack Verify Response', {
          status: data.status,
          dataStatus: data.data?.status,
          reference: data.data?.reference,
          amount: data.data?.amount,
          channel: data.data?.channel,
        });
      }

      return res.status(response.ok ? 200 : 400).json(data);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      log.error('Paystack Verify API Error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        status: false,
        message: errorMessage,
      });
    }
  },
  { protection: 'api', cors: true }
);
