/**
 * PaymentCallback - Handles return from Dodo Payments checkout
 *
 * Users are redirected here with ?payment=success after completing checkout.
 * No client-side verification is needed — the webhook handles tier update.
 * This component polls for the tier change and shows progress.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { getUserProfile, invalidateProfileCache } from '../services/profileService';
import { supabase } from '../services/supabaseClient';
import { UserTier } from '../types';

type CallbackStatus = 'verifying' | 'success' | 'activating' | 'failed' | 'no-reference' | 'pending';

export const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dodo sends ?payment=success
  const dodoPaymentStatus = searchParams.get('payment');

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Shared: poll the user's profile to detect when webhook has updated the tier
  const pollForTierChange = async () => {
    setStatus('activating');
    setMessage('Payment confirmed! Activating your subscription...');

    let pollCount = 0;
    const maxPolls = 15;

    const checkTier = async (): Promise<boolean> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Bypass cache — read directly from DB
        invalidateProfileCache(user.id);
        const profile = await getUserProfile();
        if (profile && profile.user_tier !== UserTier.SPARK) {
          return true; // Tier has been updated by webhook!
        }
      } catch { /* ignore polling errors */ }
      return false;
    };

    // Check immediately (webhook may have already processed)
    const alreadyDone = await checkTier();
    if (alreadyDone) {
      setStatus('success');
      setMessage('Your subscription is active! Redirecting to your dashboard...');
      setTimeout(() => { window.location.href = '/'; }, 1500);
      return;
    }

    // Start polling every 2 seconds, max 30 seconds
    pollRef.current = setInterval(async () => {
      pollCount++;
      const done = await checkTier();
      if (done || pollCount >= maxPolls) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;

        if (done) {
          setStatus('success');
          setMessage('Your subscription is active! Redirecting to your dashboard...');
        } else {
          setStatus('pending');
          setMessage('Payment is still being processed. Your subscription will activate shortly. You can safely go to your dashboard.');
        }
        setTimeout(() => { window.location.href = '/'; }, 1500);
      } else {
        setMessage(`Payment confirmed! Activating your subscription... (${pollCount}/${maxPolls})`);
      }
    }, 2000);
  };

  // ── Dodo Payments return flow ──────────────────────────────────────────────
  useEffect(() => {
    if (dodoPaymentStatus === 'success') {
      // Dodo webhook handles tier update server-side.
      // We just poll for the change.
      pollForTierChange();
    } else {
      setStatus('no-reference');
      setMessage('No payment confirmation found. If you completed a payment, your subscription will be activated via webhook shortly.');
    }
  }, [dodoPaymentStatus]);

  return (
    <div className="min-h-screen bg-cream-base flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-surface rounded-3xl border border-peach-soft p-10 text-center">
        {/* Icon */}
        <div className="mb-6">
          {(status === 'verifying' || status === 'activating') && (
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
          {status === 'activating' && 'Activating Subscription...'}
          {status === 'success' && 'Subscription Active! 🎉'}
          {status === 'failed' && 'Verification Pending'}
          {status === 'no-reference' && 'Payment Status Unknown'}
        </h1>

        {/* Message */}
        <p className="text-cocoa-light font-medium mb-8">
          {message || 'Please wait while we confirm your payment...'}
        </p>

        {/* Action Button — only show when not auto-processing */}
        {(status === 'failed' || status === 'no-reference') && (
          <button
            onClick={() => { window.location.href = '/'; }}
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
