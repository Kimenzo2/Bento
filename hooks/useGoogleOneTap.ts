import { useEffect, useCallback, useRef, useState } from 'react';
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
 * 
 * IMPORTANT: Uses nonce for security as per Supabase documentation:
 * - Hashed nonce (SHA-256) is sent to Google
 * - Original nonce is sent to Supabase signInWithIdToken
 */

/**
 * Generate a cryptographically secure nonce and its SHA-256 hash
 * The hashed version goes to Google, the original goes to Supabase
 */
const generateNonce = async (): Promise<[string, string]> => {
    // Generate random bytes and convert to base64
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    
    // Hash the nonce using SHA-256
    const encoder = new TextEncoder();
    const encodedNonce = encoder.encode(nonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('[GoogleOneTap] Generated nonce (length):', nonce.length);
    console.log('[GoogleOneTap] Hashed nonce (for Google):', hashedNonce.substring(0, 20) + '...');
    
    return [nonce, hashedNonce];
};

export const useGoogleOneTap = () => {
    const { user, signInWithIdToken, loading } = useAuth();
    
    // Store the original nonce so the callback can access it
    const nonceRef = useRef<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Define callback with useCallback to maintain stable reference
    const handleCredentialResponse = useCallback(async (response: any) => {
        console.log('[GoogleOneTap] Credential received, processing...');
        console.log('[GoogleOneTap] Response object:', JSON.stringify(response, null, 2));
        
        if (!response?.credential) {
            console.error('[GoogleOneTap] No credential in response:', response);
            return;
        }

        // Decode JWT to see the payload (for debugging)
        try {
            const payloadBase64 = response.credential.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64));
            console.log('[GoogleOneTap] Token payload (decoded):', {
                email: payload.email,
                name: payload.name,
                iss: payload.iss,
                aud: payload.aud,
                nonce: payload.nonce ? 'present' : 'missing',
                exp: new Date(payload.exp * 1000).toISOString()
            });
        } catch (e) {
            console.warn('[GoogleOneTap] Could not decode token for debugging');
        }

        // Get the original nonce that we stored
        const originalNonce = nonceRef.current;
        console.log('[GoogleOneTap] Original nonce available:', !!originalNonce);

        try {
            console.log('[GoogleOneTap] Calling signInWithIdToken with nonce...');
            const { data, error } = await signInWithIdToken(response.credential, originalNonce);
            
            if (error) {
                console.error('[GoogleOneTap] Sign-in error:', error);
                console.error('[GoogleOneTap] Error details:', {
                    message: error.message,
                    status: error.status,
                    name: error.name,
                    code: error.code
                });
                
                // Log the error for debugging but don't show intrusive alerts
                // Users can still sign in using the regular button
                if (error.message?.includes('Invalid API key') || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
                    console.error(
                        '[GoogleOneTap] CONFIGURATION ERROR: The Google Client ID is not configured in Supabase.\n' +
                        'To fix this:\n' +
                        '1. Go to Supabase Dashboard → Authentication → Providers → Google\n' +
                        '2. Add your Google Web Client ID to the "Client IDs" field (NOT the OAuth Client ID/Secret fields)\n' +
                        '3. Make sure VITE_GOOGLE_CLIENT_ID in your .env matches this Client ID\n' +
                        '4. Ensure the Client ID format is: xxxxxxxx.apps.googleusercontent.com'
                    );
                }
                
                if (error.message?.includes('provider is not enabled')) {
                    console.error('[GoogleOneTap] Google provider is not enabled in Supabase Dashboard!');
                }
                
                if (error.message?.includes('nonce')) {
                    console.error('[GoogleOneTap] Nonce mismatch - this can happen if the page was refreshed between prompt display and sign-in');
                }
                
                // Silently fail - One Tap is optional, users can use regular sign-in
                return;
            }
            
            if (data?.user) {
                console.log('[GoogleOneTap] Sign-in successful! User:', data.user.email);
                console.log('[GoogleOneTap] Session created:', !!data.session);
                // Force a page reload to ensure all components pick up the new auth state
                window.location.reload();
            } else {
                console.warn('[GoogleOneTap] Sign-in completed but no user data returned');
            }
        } catch (error: any) {
            console.error('[GoogleOneTap] Exception during sign-in:', error);
            console.error('[GoogleOneTap] Exception stack:', error.stack);
            // Silently fail - don't interrupt user experience
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

        script.onload = async () => {
            // Initialize Google One Tap
            if (window.google) {
                const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                console.log('[GoogleOneTap] Initializing with Client ID:', clientId ? `${clientId.substring(0, 20)}...` : 'UNDEFINED');

                if (!clientId) {
                    console.error('[GoogleOneTap] MISSING VITE_GOOGLE_CLIENT_ID in .env file');
                    return;
                }

                try {
                    // Generate nonce for security
                    // Hashed nonce goes to Google, original nonce goes to Supabase
                    const [originalNonce, hashedNonce] = await generateNonce();
                    
                    // Store the original nonce for the callback
                    nonceRef.current = originalNonce;
                    console.log('[GoogleOneTap] Nonce stored for callback');

                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleCredentialResponse,
                        auto_select: true, // Auto-select if user previously signed in
                        cancel_on_tap_outside: true, // Allow clicking outside to close
                        // Enable FedCM for production, disable for localhost
                        use_fedcm_for_prompt: !isLocalhost,
                        // CRITICAL: Pass the HASHED nonce to Google
                        nonce: hashedNonce,
                        // Enable ITP support for Safari
                        itp_support: true,
                    });

                    setIsInitialized(true);
                    console.log('[GoogleOneTap] Initialized with nonce, showing prompt...');

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
