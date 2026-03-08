import { ArrowLeft, Check, Loader2, Lock, Mail, Shield } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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
    } catch (err: unknown) {
      setError((err as Error)?.message || 'An unexpected error occurred');
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
    } catch (err: unknown) {
      console.error('Magic link error:', err);
      setError((err as Error)?.message || 'Failed to send magic link. Please try again.');
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
    <div className="relative w-full h-full min-h-full max-w-lg mx-auto px-(--ob-container-padding) py-8 flex flex-col items-center overflow-y-auto">
      {/* Background - matches onboarding gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-[#0d0d1a] to-slate-900 -z-10" />
      <div className="absolute inset-0 bg-linear-to-br from-purple-900/20 via-transparent to-blue-900/20 -z-10" />

      {/* Ambient orbs for visual consistency */}
      <div
        className="absolute top-[10%] -left-[15%] w-100 h-100 rounded-full bg-purple-600/15 blur-3xl pointer-events-none -z-10"
      />
      <div
        className="absolute bottom-[10%] -right-[10%] w-[350px] h-[350px] rounded-full bg-blue-600/15 blur-3xl pointer-events-none -z-10"
      />

      {/* Back button when in email form */}
      {showEmailForm && !successMessage && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowEmailForm(false)}
          className="absolute top-8 left-4 text-white/40 hover:text-white hover:bg-white/10"
          title="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      )}

      {/* Creation Icon/Emoji */}
      <div
        className={`w-20 h-20 rounded-2xl bg-linear-to-br ${getThemeGradient()} flex items-center justify-center text-4xl mb-6`}
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
            <Button
              size="lg"
              className="w-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              onClick={() => setSuccessMessage(null)}
            >
              Resend Email
            </Button>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="h-14 pl-12 pr-4 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30 focus:bg-white/10"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isLoading || !email}
                className="w-full bg-white text-slate-900 hover:bg-white/90 border-0 font-bold"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Magic Link'}
              </Button>
            </form>
          )
        ) : (
          <div className="space-y-4">
            <Button
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full bg-white text-slate-900 hover:bg-white/90 border-0 font-bold"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </Button>

            <Button
              size="lg"
              onClick={() => setShowEmailForm(true)}
              className="w-full bg-transparent border border-white/20 text-white hover:bg-white/10 hover:border-white/30"
            >
              <Mail className="w-5 h-5" />
              Use Email Instead
            </Button>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('welcome')}
          className="mt-6 text-white/25 hover:text-white/50 hover:bg-transparent"
        >
          Maybe later →
        </Button>
      </div>
    </div>
  );
};
