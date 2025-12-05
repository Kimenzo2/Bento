import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Sparkles, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface EmailAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'magic-link';

const EmailAuthModal: React.FC<EmailAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { signInWithEmail, signUpWithEmail } = useAuth();
    
    const [mode, setMode] = useState<AuthMode>('signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        try {
            if (mode === 'magic-link') {
                // Send magic link email
                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        data: {
                            display_name: displayName || email.split('@')[0],
                        },
                        emailRedirectTo: window.location.origin
                    }
                });

                if (error) throw error;
                
                setSuccessMessage('Check your email for the magic link! 🎉');
                
                // Save display name to localStorage for later sync
                if (displayName) {
                    try {
                        const existingSettings = JSON.parse(localStorage.getItem('genesis_settings') || '{}');
                        localStorage.setItem('genesis_settings', JSON.stringify({
                            ...existingSettings,
                            displayName,
                            email
                        }));
                    } catch (e) {
                        console.error('Failed to save settings:', e);
                    }
                }
                
            } else if (mode === 'signup') {
                // Sign up with email and password
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: displayName || email.split('@')[0],
                            display_name: displayName || email.split('@')[0],
                        }
                    }
                });

                if (error) throw error;

                // Save display name to localStorage
                if (displayName) {
                    try {
                        const existingSettings = JSON.parse(localStorage.getItem('genesis_settings') || '{}');
                        localStorage.setItem('genesis_settings', JSON.stringify({
                            ...existingSettings,
                            displayName,
                            email
                        }));
                    } catch (e) {
                        console.error('Failed to save settings:', e);
                    }
                }

                if (data.session) {
                    // User is signed in immediately (email confirmation disabled)
                    setSuccessMessage('Account created! Welcome to Genesis! 🎉');
                    setTimeout(() => {
                        onSuccess?.();
                        onClose();
                    }, 1500);
                } else {
                    // Email confirmation required
                    setSuccessMessage('Check your email to confirm your account! 📧');
                }

            } else {
                // Sign in with email and password
                const { data, error } = await signInWithEmail(email, password);

                if (error) throw error;

                setSuccessMessage('Welcome back! 🎉');
                setTimeout(() => {
                    onSuccess?.();
                    onClose();
                }, 1000);
            }
        } catch (err: any) {
            console.error('[EmailAuth] Error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setIsLoading(true);
        
        try {
            console.log('[EmailAuth] Starting Google OAuth flow...');
            console.log('[EmailAuth] Redirect URL:', window.location.origin);
            
            // Close the modal before redirect to avoid UI issues
            onClose();
            
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    skipBrowserRedirect: false,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) {
                console.error('[EmailAuth] Google OAuth error:', error);
                throw error;
            }
            
            console.log('[EmailAuth] OAuth initiated, redirecting to Google...');
            // The redirect will happen automatically
        } catch (err: any) {
            console.error('[EmailAuth] Google error:', err);
            setError(err.message || 'Failed to sign in with Google. Please check your Supabase Google provider configuration.');
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header with gradient */}
                    <div className="relative bg-gradient-to-br from-coral-burst via-pink-500 to-purple-600 p-6 text-white">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold">
                                {mode === 'signin' ? 'Welcome Back!' : 'Join Genesis'}
                            </h2>
                        </div>
                        <p className="text-white/80 text-sm">
                            {mode === 'signin' 
                                ? 'Sign in to continue creating magical stories'
                                : 'Create your account and start crafting beautiful children\'s books'
                            }
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Error/Success Messages */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm"
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        {successMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm"
                            >
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                {successMessage}
                            </motion.div>
                        )}

                        {/* Display Name (only for signup) */}
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Display Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Your creative name"
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-coral-burst focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    This will appear in your creator profile
                                </p>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-coral-burst focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
                                />
                            </div>
                        </div>

                        {/* Password (not for magic link) */}
                        {mode !== 'magic-link' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={mode === 'signup' ? 'Create a password (min 6 chars)' : 'Your password'}
                                        required
                                        minLength={6}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-coral-burst focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !email || (mode !== 'magic-link' && !password)}
                            className="w-full py-3 bg-gradient-to-r from-coral-burst to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-coral-burst/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {mode === 'signin' && 'Sign In'}
                                    {mode === 'signup' && 'Create Account'}
                                    {mode === 'magic-link' && 'Send Magic Link'}
                                </>
                            )}
                        </button>

                        {/* Divider */}
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">or</span>
                            </div>
                        </div>

                        {/* Google Sign In */}
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continue with Google
                        </button>

                        {/* Mode Toggle */}
                        <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
                            {mode === 'signin' ? (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                                        className="text-coral-burst hover:underline font-medium"
                                    >
                                        Sign up
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setMode('signin'); setError(null); setSuccessMessage(null); }}
                                        className="text-coral-burst hover:underline font-medium"
                                    >
                                        Sign in
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Magic Link Option */}
                        {mode !== 'magic-link' && (
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => { setMode('magic-link'); setError(null); setSuccessMessage(null); }}
                                    className="text-sm text-gray-500 hover:text-coral-burst transition-colors"
                                >
                                    ✨ Prefer a magic link? Click here
                                </button>
                            </div>
                        )}
                        
                        {mode === 'magic-link' && (
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                                    className="text-sm text-gray-500 hover:text-coral-burst transition-colors"
                                >
                                    ← Back to password sign up
                                </button>
                            </div>
                        )}
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EmailAuthModal;
