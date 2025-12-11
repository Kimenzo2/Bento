import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface EmailAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

// Simplified modes - prioritizing Magic Link
type AuthMode = 'magic-link' | 'google-only'; // We focus on Magic Link primarily

const EmailAuthModal: React.FC<EmailAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { signInWithEmail } = useAuth();

    // Default to magic link as requested
    const [mode, setMode] = useState<AuthMode>('magic-link');
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
            // Send magic link email (Priority Option)
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    data: {
                        display_name: email.split('@')[0], // Fallback display name
                    },
                    // Ensure robust redirection
                    emailRedirectTo: window.location.origin,
                }
            });

            if (error) throw error;

            setSuccessMessage('Magic link sent! Check your email to sign in. ✨');

            // Should we save email for next time?
            try {
                const existingSettings = JSON.parse(localStorage.getItem('genesis_settings') || '{}');
                localStorage.setItem('genesis_settings', JSON.stringify({
                    ...existingSettings,
                    email
                }));
            } catch (e) {
                console.error('Failed to save settings:', e);
            }

        } catch (err: any) {
            console.error('[EmailAuth] Error:', err);
            // Handle edge case where error is an empty object or has no message
            let errorMessage = err.message || err.error_description || 'Something went wrong. Please try again.';

            // If the error message renders as "{}", provide a more helpful message
            if (errorMessage === '{}' || (typeof err === 'object' && Object.keys(err).length === 0)) {
                errorMessage = 'Unable to send link. Please check your network or try again later.';
            }

            // Supabase rate limit specific check
            if (errorMessage.includes('Rate limit') || (err.status === 429)) {
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
            console.log('[EmailAuth] Starting Google OAuth flow...');

            // Close the modal before redirect
            onClose();

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) throw error;

        } catch (err: any) {
            console.error('[EmailAuth] Google error:', err);
            setError(err.message || 'Failed to sign in with Google.');
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop - Warm Blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 bg-charcoal-soft/20 backdrop-blur-sm"
                />

                {/* Modal - Warm & Professional */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-sm bg-cream-base rounded-3xl shadow-soft-lg border-2 border-white/50 overflow-hidden"
                >
                    {/* Minimal Warm Header */}
                    <div className="pt-8 px-6 pb-2 text-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-sunshine to-coral-burst mx-auto mb-4 flex items-center justify-center shadow-lg transform rotate-3">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="font-heading font-bold text-2xl text-charcoal-soft mb-1">
                            Welcome to Genesis
                        </h2>
                        <p className="text-cocoa-light text-sm">
                            Your journey to magical storytelling begins here.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-6 pt-4 space-y-6">

                        {/* Error/Success Messages */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center border border-red-100"
                                >
                                    {error}
                                </motion.div>
                            )}
                            {successMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-xl text-center border border-green-100"
                                >
                                    {successMessage}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Usage Form - Magic Link Priority */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cocoa-light group-focus-within:text-coral-burst transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-peach-soft rounded-2xl text-charcoal-soft placeholder-cocoa-light/50 focus:border-coral-burst focus:ring-4 focus:ring-coral-burst/10 outline-none transition-all font-medium"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !email}
                                className="w-full py-3.5 bg-charcoal-soft text-white font-heading font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Send Magic Link <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-peach-soft/50"></div>
                            <span className="flex-shrink-0 mx-4 text-xs font-bold text-cocoa-light uppercase tracking-wider">Or</span>
                            <div className="flex-grow border-t border-peach-soft/50"></div>
                        </div>

                        {/* Google Sign In - Secondary Option */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full py-3.5 bg-white border border-peach-soft text-charcoal-soft font-bold rounded-2xl hover:bg-cream-soft transition-all flex items-center justify-center gap-3 shadow-soft-sm group"
                        >
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>


                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EmailAuthModal;
