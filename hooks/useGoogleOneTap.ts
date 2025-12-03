import { useEffect, useCallback } from 'react';
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
    const { user, signInWithIdToken, loading } = useAuth();

    // Define callback with useCallback to maintain stable reference
    const handleCredentialResponse = useCallback(async (response: any) => {
        console.log('[GoogleOneTap] Credential received, processing...');
        
        if (!response?.credential) {
            console.error('[GoogleOneTap] No credential in response:', response);
            return;
        }

        try {
            console.log('[GoogleOneTap] Calling signInWithIdToken...');
            const { data, error } = await signInWithIdToken(response.credential);
            
            if (error) {
                console.error('[GoogleOneTap] Sign-in error:', error);
                
                // Provide helpful error messages based on error type
                let userMessage = 'Sign-in failed. ';
                
                if (error.message?.includes('Invalid API key') || error.message?.includes('401')) {
                    userMessage += 'Google authentication is not configured correctly. Please contact support.';
                    console.error(
                        '[GoogleOneTap] CONFIGURATION ERROR: The Google Client ID is not configured in Supabase.\n' +
                        'To fix this:\n' +
                        '1. Go to Supabase Dashboard → Authentication → Providers → Google\n' +
                        '2. Add your Google Web Client ID to the "Client IDs" field (NOT the OAuth Client ID/Secret fields)\n' +
                        '3. Make sure VITE_GOOGLE_CLIENT_ID in your .env matches this Client ID'
                    );
                } else if (error.message?.includes('nonce')) {
                    userMessage += 'Session verification failed. Please try again.';
                } else {
                    userMessage += error.message || 'Unknown error occurred.';
                }
                
                alert(userMessage);
                return;
            }
            
            if (data?.user) {
                console.log('[GoogleOneTap] Sign-in successful! User:', data.user.email);
            } else {
                console.warn('[GoogleOneTap] Sign-in completed but no user data returned');
            }
        } catch (error: any) {
            console.error('[GoogleOneTap] Exception during sign-in:', error);
            alert('An unexpected error occurred during sign-in. Please try again.');
        }
    }, [signInWithIdToken]);

    useEffect(() => {
        // Only show if user is not authenticated and auth is done loading
        if (loading) {
            console.log('[GoogleOneTap] Auth still loading, waiting...');
            return;
        }
        
        if (user) {
            console.log('[GoogleOneTap] User already authenticated, skipping prompt');
            // If user is authenticated, ensure any existing prompt is closed
            if (window.google?.accounts?.id) {
                window.google.accounts.id.cancel();
            }
            return;
        }

        console.log('[GoogleOneTap] No user, preparing to show prompt...');

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
                console.log('[GoogleOneTap] Initializing with Client ID:', clientId ? `${clientId.substring(0, 20)}...` : 'UNDEFINED');

                if (!clientId) {
                    console.error('[GoogleOneTap] MISSING VITE_GOOGLE_CLIENT_ID in .env file');
                    return;
                }

                try {
                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleCredentialResponse,
                        auto_select: true, // Auto-select if user previously signed in
                        cancel_on_tap_outside: true, // Allow clicking outside to close
                        // Enable FedCM for production, disable for localhost
                        use_fedcm_for_prompt: !isLocalhost,
                    });

                    console.log('[GoogleOneTap] Initialized, showing prompt...');

                    // Display the One Tap prompt
                    window.google.accounts.id.prompt((notification: any) => {
                        console.log('[GoogleOneTap] Prompt notification received');
                        
                        if (notification.isDisplayed && notification.isDisplayed()) {
                            console.log('[GoogleOneTap] Prompt is displayed');
                        }
                        if (notification.isNotDisplayed && notification.isNotDisplayed()) {
                            const reason = notification.getNotDisplayedReason?.() || 'unknown';
                            console.log('[GoogleOneTap] Prompt not displayed, reason:', reason);
                        }
                        if (notification.isSkippedMoment && notification.isSkippedMoment()) {
                            const reason = notification.getSkippedReason?.() || 'unknown';
                            console.log('[GoogleOneTap] Prompt skipped, reason:', reason);
                        }
                        if (notification.isDismissedMoment && notification.isDismissedMoment()) {
                            const reason = notification.getDismissedReason?.() || 'unknown';
                            console.log('[GoogleOneTap] Prompt dismissed, reason:', reason);
                        }
                    });
                } catch (initError) {
                    console.error('[GoogleOneTap] Initialization error:', initError);
                }
            } else {
                console.error('[GoogleOneTap] Google script loaded but window.google is undefined');
            }
        };

        script.onerror = (error) => {
            console.error('[GoogleOneTap] Failed to load Google script:', error);
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
    }, [user, loading, handleCredentialResponse]);
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
