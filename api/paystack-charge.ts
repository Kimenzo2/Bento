/**
 * Paystack Charge API Endpoint
 * Securely handles Charge API calls with server-side secret key
 * 
 * Supported payment methods:
 * - M-PESA (Kenya)
 * - Mobile Money (Ghana, Côte d'Ivoire)
 * - Pesalink Bank Transfer (Kenya)
 * - USSD (Nigeria)
 * - QR Code (South Africa)
 * - EFT (South Africa)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAuthenticatedHandler, type ApiContext } from './middleware';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_CHARGE_URL = 'https://api.paystack.co/charge';

interface ChargeRequest {
  email: string;
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  // Payment method specific fields
  mobile_money?: {
    phone: string;
    provider: string;
    account?: string;
  };
  bank_transfer?: {
    account_expires_at?: string | null;
  };
  ussd?: {
    type: string;
  };
  qr?: {
    provider: string;
  };
  eft?: {
    provider: string;
  };
}

export default createAuthenticatedHandler(
  async (ctx: ApiContext) => {
    const { req, res, log } = ctx;

    // Only allow POST
    if (req.method !== 'POST') {
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

    try {
      const chargeData: ChargeRequest = req.body;

      // Validate required fields
      if (!chargeData.email || !chargeData.amount) {
        return res.status(400).json({
          status: false,
          message: 'Email and amount are required',
        });
      }

      // Validate at least one payment method is specified
      const hasPaymentMethod = 
        chargeData.mobile_money || 
        chargeData.bank_transfer || 
        chargeData.ussd || 
        chargeData.qr || 
        chargeData.eft;

      if (!hasPaymentMethod) {
        return res.status(400).json({
          status: false,
          message: 'A payment method must be specified',
        });
      }

      // Make request to Paystack Charge API
      const response = await fetch(PAYSTACK_CHARGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chargeData),
      });

      const data = await response.json();

      if (process.env.NODE_ENV !== 'production') {
        log.info('Paystack Charge Response', {
          status: data.status,
          message: data.message,
          dataStatus: data.data?.status,
          reference: data.data?.reference,
        });
      }

      return res.status(response.ok ? 200 : 400).json(data);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      log.error('Paystack Charge API Error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        status: false,
        message: errorMessage,
      });
    }
  },
  { protection: 'api', cors: true }
);
