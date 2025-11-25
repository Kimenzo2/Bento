import React, { useState } from 'react';
import { X, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailMode, setIsEmailMode] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Auto-close modal when user becomes authenticated (e.g., after Google OAuth redirect)
    React.useEffect(() => {
        if (isOpen && user) {
            onClose();
        }
    }, [user, isOpen, onClose]);

    if (!isOpen) return null;

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { error } = await signInWithGoogle();
            if (error) throw error;
        } catch (error: any) {
            console.error('Error logging in with Google:', error);
            setError(error.message || 'Failed to log in with Google.');
            setIsLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isSignUp) {
                const { error } = await signUpWithEmail(email, password);
                if (error) throw error;
                setSuccessMessage('Account created! Please check your email to confirm.');
                setIsLoading(false);
                // Close modal after 2 seconds to let user see success message
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                const { error } = await signInWithEmail(email, password);
                if (error) throw error;
                onClose(); // Close modal on successful login
            }
        } catch (error: any) {
            console.error('Authentication error:', error);
            setError(error.message || 'Authentication failed.');
            setIsLoading(false);
        }
    };

    const resetState = () => {
        setIsEmailMode(false);
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        setError(null);
        setSuccessMessage(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-soft/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-soft-xl max-w-md w-full overflow-hidden relative animate-slideUp">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/30 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 text-center">
                    {/* Header */}
                    <div className="w-16 h-16 bg-gradient-to-br from-gold-sunshine to-coral-burst rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3">
                        <span className="text-3xl">✨</span>
                    </div>

                    <h2 className="font-heading font-bold text-3xl text-charcoal-soft mb-2">
                        {isEmailMode ? (isSignUp ? 'Create Account' : 'Welcome Back') : 'Unlock the Magic'}
                    </h2>
                    <p className="text-cocoa-light mb-8 font-body">
                        {isEmailMode
                            ? (isSignUp ? 'Join the community of creators.' : 'Sign in to continue your journey.')
                            : 'Sign in to save your stories, access premium features, and keep your masterpieces safe.'}
                    </p>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-6 p-3 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100">
                            {successMessage}
                        </div>
                    )}

                    {/* Auth Forms */}
                    {!isEmailMode ? (
                        <div className="space-y-4">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-peach-soft hover:border-coral-burst text-charcoal-soft font-bold py-3 px-6 rounded-xl transition-all hover:shadow-md hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-coral-burst" />
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                        <span>Continue with Google</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => setIsEmailMode(true)}
                                className="w-full flex items-center justify-center gap-3 bg-cream-base text-cocoa-light font-bold py-3 px-6 rounded-xl hover:bg-peach-soft/20 transition-colors"
                            >
                                <Mail className="w-5 h-5" />
                                <span>Continue with Email</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-cocoa-light uppercase mb-1 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-cream-base border border-peach-soft focus:border-coral-burst focus:ring-2 focus:ring-coral-burst/20 outline-none transition-all"
                                    placeholder="you@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-cocoa-light uppercase mb-1 ml-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-3 rounded-xl bg-cream-base border border-peach-soft focus:border-coral-burst focus:ring-2 focus:ring-coral-burst/20 outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-sunshine to-coral-burst text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-between text-sm mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEmailMode(false)}
                                    className="text-cocoa-light hover:text-charcoal-soft transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(!isSignUp);
                                        setError(null);
                                        setSuccessMessage(null);
                                    }}
                                    className="text-coral-burst font-bold hover:text-gold-sunshine transition-colors"
                                >
                                    {isSignUp ? 'Already have an account?' : 'Need an account?'}
                                </button>
                            </div>
                        </form>
                    )}

                    {!isEmailMode && (
                        <p className="mt-8 text-xs text-cocoa-light/70">
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
