import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { user, signInWithGoogle } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-close modal when user becomes authenticated
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
            // Modal will auto-close via useEffect when user state updates
        } catch (error: any) {
            console.error('Error logging in with Google:', error);
            setError(error.message || 'Failed to sign in with Google. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-soft/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-soft-xl max-w-md w-full overflow-hidden relative animate-slideUp">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/30 rounded-full transition-colors z-10"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 text-center">
                    {/* Header */}
                    <div className="w-16 h-16 bg-gradient-to-br from-gold-sunshine to-coral-burst rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3">
                        <span className="text-3xl">✨</span>
                    </div>

                    <h2 className="font-heading font-bold text-3xl text-charcoal-soft mb-2">
                        Welcome to Genesis
                    </h2>
                    <p className="text-cocoa-light mb-8 font-body">
                        Sign in with Google to save your stories, access premium features, and keep your masterpieces safe.
                    </p>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Google Sign In Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-peach-soft hover:border-coral-burst text-charcoal-soft font-bold py-4 px-6 rounded-xl transition-all hover:shadow-md hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed group"
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

                    <p className="mt-8 text-xs text-cocoa-light/70">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
