import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, Sparkles, Cloud, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AuthPage: React.FC = () => {
    const { user, loading: authLoading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const returnTo = searchParams.get('returnTo') || '/';
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Redirect if already logged in
    React.useEffect(() => {
        if (!authLoading && user) {
            // Use replace: true to prevent going back to login page
            navigate(returnTo, { replace: true });
        }
    }, [user, authLoading, returnTo, navigate]);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { error } = await signInWithGoogle(returnTo);
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
            } else {
                const { error } = await signInWithEmail(email, password);
                if (error) throw error;
                // User state will update automatically, component will re-render
            }
        } catch (error: any) {
            console.error('Authentication error:', error);
            setError(error.message || 'Authentication failed.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-cream-base via-peach-soft/20 to-gold-sunshine/10 flex items-center justify-center p-4">
            <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">

                {/* Left Side - Branding */}
                <div className="hidden lg:block space-y-8 px-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center shadow-glow">
                                <span className="text-white font-heading font-bold text-2xl">G</span>
                            </div>
                            <span className="font-heading font-bold text-4xl text-charcoal-soft tracking-tight">
                                Genesis
                            </span>
                        </div>
                        <h1 className="font-heading font-bold text-5xl text-charcoal-soft leading-tight">
                            Create Stories That Captivate
                        </h1>
                        <p className="text-xl text-cocoa-light font-body">
                            Join thousands of creators bringing their stories to life with AI-powered illustrations and interactive narratives.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-white/50 rounded-2xl backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-heading font-bold text-charcoal-soft mb-1">AI-Powered Creation</h3>
                                <p className="text-sm text-cocoa-light">Generate stunning illustrations and compelling narratives in minutes</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-white/50 rounded-2xl backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center flex-shrink-0">
                                <Cloud className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-heading font-bold text-charcoal-soft mb-1">Cloud Sync</h3>
                                <p className="text-sm text-cocoa-light">Access your stories from anywhere, on any device</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-white/50 rounded-2xl backdrop-blur-sm">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center flex-shrink-0">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-heading font-bold text-charcoal-soft mb-1">Premium Features</h3>
                                <p className="text-sm text-cocoa-light">Unlock advanced tools and unlimited creation potential</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Auth Form */}
                <div className="bg-white rounded-3xl shadow-soft-xl p-8 lg:p-12">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-gold-sunshine to-coral-burst rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3">
                            <span className="text-3xl">✨</span>
                        </div>

                        <h2 className="font-heading font-bold text-3xl text-charcoal-soft mb-2">
                            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
                        </h2>
                        <p className="text-cocoa-light font-body">
                            {isSignUp ? 'Start your creative journey today' : 'Sign in to continue creating'}
                        </p>
                    </div>

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

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-peach-soft hover:border-coral-burst text-charcoal-soft font-bold py-3 px-6 rounded-xl transition-all hover:shadow-md hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed mb-6"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-coral-burst" />
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-peach-soft"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-cocoa-light font-medium">Or continue with email</span>
                        </div>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-4">
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
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                                setSuccessMessage(null);
                            }}
                            className="text-coral-burst font-bold hover:text-gold-sunshine transition-colors"
                        >
                            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                        </button>
                    </div>

                    <p className="mt-8 text-xs text-center text-cocoa-light/70">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>


        </div>
    );
};

export default AuthPage;
