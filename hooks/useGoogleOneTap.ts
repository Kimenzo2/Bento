import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Google One Tap Hook
 * 
 * Automatically shows Google One Tap prompt when:
 * - User is not authenticated
 * - User has previously signed in with Google
 * 
 * This provides seamless "Continue as..." authentication
 * 
 * FedCM is enabled for production and disabled for localhost
 */
export const useGoogleOneTap = () => {
    const { user, signInWithGoogle, signInWithIdToken, loading } = useAuth();

    useEffect(() => {
        // Only show if user is not authenticated and auth is done loading
        if (loading || user) {
            // If user is authenticated or loading, ensure any existing prompt is closed
            if (window.google?.accounts?.id) {
                window.google.accounts.id.cancel();
            }
            return;
        }

        // Determine if we're on localhost
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        // Load Google One Tap script
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;

        script.onload = () => {
            // Initialize Google One Tap
            if (window.google) {
                const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                console.log('[GoogleOneTap] Initializing with Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'UNDEFINED');

                if (!clientId) {
                    console.error('[GoogleOneTap] MISSING VITE_GOOGLE_CLIENT_ID in .env file');
                    return;
                }

                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleCredentialResponse,
                    auto_select: true, // Auto-select if user previously signed in
                    cancel_on_tap_outside: true, // Allow clicking outside to close
                    // Enable FedCM for production, disable for localhost
                    use_fedcm_for_prompt: !isLocalhost,
                });

                // Display the One Tap prompt
                // Note: With FedCM, we can't use isDisplayed(), isNotDisplayed(), or getNotDisplayedReason()
                window.google.accounts.id.prompt((notification: any) => {
                    // Only log skip moments, not display moments (FedCM doesn't provide display info)
                    if (notification.isSkippedMoment && notification.isSkippedMoment()) {
                        console.log('Google One Tap skipped');
                    }
                    if (notification.isDismissedMoment && notification.isDismissedMoment()) {
                        console.log('Google One Tap dismissed by user');
                    }
                });
            }
        };

        document.body.appendChild(script);

        return () => {
            // Cleanup
            if (window.google?.accounts?.id) {
                window.google.accounts.id.cancel();
            }
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, [user, loading]);

    const handleCredentialResponse = async (response: any) => {
        try {
            console.log('Google One Tap credential received');
            const { error } = await signInWithIdToken(response.credential);
            if (error) throw error;
        } catch (error) {
            console.error('Google One Tap sign-in error:', error);
        }
    };
};

// Type declaration for Google One Tap
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    prompt: (callback?: (notification: any) => void) => void;
                    cancel: () => void;
                };
            };
        };
    }
}
