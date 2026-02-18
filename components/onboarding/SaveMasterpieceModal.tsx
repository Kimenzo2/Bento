import { ArrowLeft, Check, Loader2, Lock, Mail, Shield } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useOnboarding } from './OnboardingState';

export const SaveMasterpieceModal: React.FC = () => {
  const { theme, setStep } = useOnboarding();
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Redirect back to the welcome success step after authentication
      const { error } = await signInWithGoogle('/welcome?step=welcome');
      if (error) {
        setError(error.message || 'Failed to connect with Google');
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/welcome?step=welcome`,
        },
      });

      if (error) throw error;
      setSuccessMessage('Check your email for the magic link! ✨');
    } catch (err: any) {
      console.error('Magic link error:', err);
      setError(err?.message || 'Failed to send magic link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getThemeEmoji = () => {
    switch (theme) {
      case 'cosmos':
        return '🚀';
      case 'kingdom':
        return '🏰';
      case 'cell':
        return '🧬';
      default:
        return '✨';
    }
  };

  const getThemeGradient = () => {
    switch (theme) {
      case 'cosmos':
        return 'from-indigo-600 via-purple-600 to-blue-600';
      case 'kingdom':
        return 'from-amber-500 via-orange-500 to-red-500';
      case 'cell':
        return 'from-emerald-500 via-teal-500 to-cyan-500';
      default:
        return 'from-purple-600 via-pink-600 to-amber-500';
    }
  };

  const getThemeName = () => {
    switch (theme) {
      case 'cosmos':
        return 'A Cosmic Journey';
      case 'kingdom':
        return 'Tales of the Realm';
      case 'cell':
        return 'The Living World';
      default:
        return 'Your First Story';
    }
  };

  return (
    <div className="relative w-full h-full min-h-full max-w-lg mx-auto px-[var(--ob-container-padding)] py-8 flex flex-col items-center overflow-y-auto">
      {/* Background - matches onboarding gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-[#0d0d1a] to-slate-900 -z-10" />
      <div className="absolute inset-0 bg-linear-to-br from-purple-900/20 via-transparent to-blue-900/20 -z-10" />

      {/* Ambient orbs for visual consistency */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full bg-purple-600/15 blur-3xl pointer-events-none -z-10"
        style={{ top: '10%', left: '-15%' }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full bg-blue-600/15 blur-3xl pointer-events-none -z-10"
        style={{ bottom: '10%', right: '-10%' }}
      />

      {/* Back button when in email form */}
      {showEmailForm && !successMessage && (
        <button
          onClick={() => setShowEmailForm(false)}
          className="absolute top-8 left-4 p-2 text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      )}

      {/* Creation Icon/Emoji */}
      <div
        className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getThemeGradient()} flex items-center justify-center text-4xl shadow-xl mb-6`}
      >
        {getThemeEmoji()}
      </div>

      {/* Main Info */}
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-white mb-3 font-heading">
          {successMessage ? 'Check your inbox' : 'Save your masterpiece'}
        </h2>
        <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">
          {successMessage
            ? successMessage
            : <>Create a free account to keep <strong className="text-white/80">{getThemeName()}</strong> and unlock the full Genesis experience.</>}
        </p>
      </div>

      {error && (
        <div className="w-full max-w-xs mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-medium">
          {error}
        </div>
      )}

      {/* Auth UI */}
      <div className="w-full max-w-xs mb-10">
        {showEmailForm ? (
          successMessage ? (
            <button
              onClick={() => setSuccessMessage(null)}
              className="w-full h-14 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center gap-3 text-white font-bold transition-all"
            >
              Resend Email
            </button>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-white/30 focus:bg-white/10 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full h-14 bg-white text-slate-900 font-bold rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Magic Link'}
              </button>
            </form>
          )
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-14 bg-white hover:bg-slate-100 rounded-xl flex items-center justify-center gap-3 text-slate-900 font-bold transition-all active:scale-95"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                className="w-5 h-5"
                alt="Google"
              />
              Continue with Google
            </button>

            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-3 text-white font-bold transition-all active:scale-95"
            >
              <Mail className="w-5 h-5" />
              Use Email Instead
            </button>
          </div>
        )}
      </div>

      {/* Trust & Legal */}
      <div className="w-full max-w-xs text-center">
        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="flex flex-col items-center gap-1">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-white/40 text-[10px] uppercase font-bold">Secure</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="text-white/40 text-[10px] uppercase font-bold">Private</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-white/40 text-[10px] uppercase font-bold">Free</span>
          </div>
        </div>

        <p className="text-white/30 text-[11px] leading-relaxed">
          By continuing, you agree to our{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-white/50 underline hover:text-white/70 transition-colors">Terms of Service</a> and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-white/50 underline hover:text-white/70 transition-colors">Privacy Policy</a>.
        </p>

        {/* Skip option for users not ready to sign up */}
        <button
          onClick={() => setStep('welcome')}
          className="mt-6 text-white/25 hover:text-white/50 text-xs transition-colors"
        >
          Maybe later →
        </button>
      </div>
    </div>
  );
};
