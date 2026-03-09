/**
 * PaymentCallback - Handles return from Dodo checkout
 *
 * Dodo finalizes payment server-side via webhook.
 * This page only polls the authenticated user's profile for the tier change
 * and then redirects to the dashboard.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { getUserProfile, invalidateProfileCache } from '../services/profileService';
import { supabase } from '../services/supabaseClient';
import { UserTier } from '../types';

type CallbackStatus =
  | 'verifying'
  | 'success'
  | 'activating'
  | 'failed'
  | 'no-reference'
  | 'pending';

export const PaymentCallback: React.FC = () => {
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const pollForTierChange = async () => {
    setStatus('activating');
    setMessage('Payment confirmed. Activating your subscription...');

    let pollCount = 0;
    const maxPolls = 15;

    const checkTier = async (): Promise<boolean> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return false;

        invalidateProfileCache(user.id);
        const profile = await getUserProfile();
        return Boolean(profile && profile.user_tier !== UserTier.SPARK);
      } catch {
        return false;
      }
    };

    const alreadyDone = await checkTier();
    if (alreadyDone) {
      setStatus('success');
      setMessage('Your subscription is active. Redirecting to your dashboard...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      return;
    }

    pollRef.current = setInterval(async () => {
      pollCount += 1;
      const done = await checkTier();

      if (done || pollCount >= maxPolls) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

        if (done) {
          setStatus('success');
          setMessage('Your subscription is active. Redirecting to your dashboard...');
        } else {
          setStatus('pending');
          setMessage(
            'Payment is still being processed. Your subscription will activate shortly. You can safely go to your dashboard.'
          );
        }

        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
        return;
      }

      setMessage(`Payment confirmed. Activating your subscription... (${pollCount}/${maxPolls})`);
    }, 2000);
  };

  useEffect(() => {
    const start = async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('status')?.toLowerCase();

      if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        setStatus('failed');
        setMessage('Your payment did not complete. Please try checkout again.');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus('no-reference');
        setMessage('Sign in to finish activating your subscription.');
        return;
      }

      await pollForTierChange();
    };

    void start();
  }, []);

  return (
    <div className="min-h-screen bg-cream-base flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-surface rounded-3xl border border-peach-soft p-10 text-center">
        <div className="mb-6">
          {(status === 'verifying' || status === 'activating') && (
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
          )}
          {status === 'success' && <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />}
          {status === 'pending' && <CheckCircle className="w-16 h-16 text-amber-500 mx-auto" />}
          {(status === 'failed' || status === 'no-reference') && (
            <XCircle className="w-16 h-16 text-amber-500 mx-auto" />
          )}
        </div>

        <h1 className="font-heading font-bold text-2xl text-charcoal-soft mb-3">
          {status === 'verifying' && 'Verifying Your Payment...'}
          {status === 'activating' && 'Activating Subscription...'}
          {status === 'success' && 'Subscription Active!'}
          {status === 'pending' && 'Activation Pending'}
          {status === 'failed' && 'Activation Failed'}
          {status === 'no-reference' && 'Sign In Required'}
        </h1>

        <p className="text-cocoa-light font-medium mb-8">
          {message || 'Please wait while we finalize your subscription...'}
        </p>

        {(status === 'failed' || status === 'no-reference' || status === 'pending') && (
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
