import { ArrowRight, Loader2, Mail, Sparkles } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Separator } from './ui/separator';

interface EmailAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  _onSuccess?: () => void;
}

const EmailAuthModal: React.FC<EmailAuthModalProps> = ({ isOpen, onClose, _onSuccess }) => {
  const { signInWithEmail: _signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          data: { display_name: email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      setSuccessMessage('Magic link sent! Check your email to sign in. ✨');

      try {
        const existingSettings = JSON.parse(localStorage.getItem('genesis_settings') || '{}');
        localStorage.setItem(
          'genesis_settings',
          JSON.stringify({ ...existingSettings, email })
        );
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    } catch (err: unknown) {
      console.error('[EmailAuth] Error:', err);
      let errorMessage =
        (err as Error)?.message || err.error_description || 'Something went wrong. Please try again.';

      if (errorMessage === '{}' || (typeof err === 'object' && Object.keys(err).length === 0)) {
        errorMessage = 'Unable to send link. Please check your network or try again later.';
      }

      if (errorMessage.includes('Rate limit') || err.status === 429) {
        errorMessage = 'Too many attempts. Please wait a moment before trying again.';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      onClose();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      console.error('[EmailAuth] Google error:', err);
      setError((err as Error)?.message || 'Failed to sign in with Google.');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="pt-8 px-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-gold-sunshine to-coral-burst mx-auto mb-4 flex items-center justify-center transform rotate-3">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl text-center">Welcome to Genesis</DialogTitle>
          <DialogDescription className="text-center">
            Your journey to magical storytelling begins here.
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center border-2 border-red-100 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-xl text-center border-2 border-green-100 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {successMessage}
            </div>
          )}

          {/* Magic Link Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cocoa-light group-focus-within:text-coral-burst transition-colors" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="pl-12 h-12 rounded-2xl"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full h-12 rounded-2xl"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Send Magic Link <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center py-1">
            <Separator className="flex-1" />
            <span className="shrink-0 mx-4 text-xs font-heading font-bold text-cocoa-light uppercase tracking-wider">
              Or
            </span>
            <Separator className="flex-1" />
          </div>

          {/* Google Sign In */}
          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full h-12 rounded-2xl gap-3 group"
          >
            <svg
              className="w-5 h-5 group-hover:scale-110 transition-transform"
              viewBox="0 0 24 24"
            >
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailAuthModal;
