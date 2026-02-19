/**
 * PaymentCallback - Handles return from Paystack checkout
 * 
 * After paying on Paystack's hosted page, users are redirected here
 * with ?trxref=xxx&reference=xxx query parameters.
 * This component verifies the transaction server-side and shows the result.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { verifyTransaction } from '../services/paystackService';

type CallbackStatus = 'verifying' | 'success' | 'failed' | 'no-reference';

export const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [message, setMessage] = useState('');

  const reference = searchParams.get('trxref') || searchParams.get('reference');

  useEffect(() => {
    if (!reference) {
      setStatus('no-reference');
      setMessage('No payment reference found. If you completed a payment, your subscription will be activated via webhook shortly.');
      return;
    }

    const verify = async () => {
      try {
        const verified = await verifyTransaction(reference);
        if (verified) {
          setStatus('success');
          setMessage('Your subscription has been activated! Redirecting to your dashboard...');
          // Auto-redirect after 4 seconds
          setTimeout(() => {
            // Navigate to main app
            window.location.href = '/#pricing';
            setTimeout(() => window.location.reload(), 100);
          }, 4000);
        } else {
          setStatus('failed');
          setMessage('Payment verification is still pending. Your subscription will activate shortly once confirmed by our payment provider.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('failed');
        setMessage('We could not verify your payment right now. Don\'t worry — if you completed the payment, your subscription will be activated automatically via webhook.');
      }
    };

    verify();
  }, [reference]);

  return (
    <div className="min-h-screen bg-cream-base flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-10 text-center">
        {/* Icon */}
        <div className="mb-6">
          {status === 'verifying' && (
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          )}
          {(status === 'failed' || status === 'no-reference') && (
            <XCircle className="w-16 h-16 text-amber-500 mx-auto" />
          )}
        </div>

        {/* Title */}
        <h1 className="font-heading font-bold text-2xl text-charcoal-soft mb-3">
          {status === 'verifying' && 'Verifying Your Payment...'}
          {status === 'success' && 'Payment Successful! 🎉'}
          {status === 'failed' && 'Verification Pending'}
          {status === 'no-reference' && 'Payment Status Unknown'}
        </h1>

        {/* Message */}
        <p className="text-cocoa-light font-medium mb-8">
          {message || 'Please wait while we confirm your payment with Paystack...'}
        </p>

        {/* Reference */}
        {reference && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs text-cocoa-light">Transaction Reference</p>
            <p className="font-mono text-sm text-charcoal-soft font-medium break-all">{reference}</p>
          </div>
        )}

        {/* Action Button */}
        {status !== 'verifying' && (
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full py-3 px-6 bg-coral-burst text-white rounded-xl font-heading font-bold hover:bg-coral-burst/90 transition-all flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
