import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

// UserProfile type for convenience
interface UserProfile {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    userProfile: UserProfile | null;
    signInWithGoogle: (returnTo?: string) => Promise<{ error: any }>;
    signInWithIdToken: (token: string, nonce?: string | null) => Promise<{ data: any; error: any }>;
    signInWithEmail: (email: string, password: string) => Promise<{ data: any; error: any }>;
    signUpWithEmail: (email: string, password: string) => Promise<{ data: any; error: any }>;
    signOut: () => Promise<{ error: any }>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Refresh session helper
    const refreshSession = async () => {
        console.log('[Auth] Refreshing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('[Auth] Error refreshing session:', error);
            return;
        }
        console.log('[Auth] Session refreshed:', session ? 'Active' : 'None');
        setSession(session);
        setUser(session?.user ?? null);
    };

    useEffect(() => {
        // CRITICAL: Process OAuth hash FIRST before checking session
        const processOAuthHash = async () => {
            const hash = window.location.hash;
            console.log('[Auth] Initializing auth, hash present:', !!hash);
            
            if (hash && hash.includes('access_token')) {
                console.log('[Auth] Processing OAuth callback from URL hash');
                // Supabase will automatically extract and store the session from the hash
            }

            // Check active sessions and sets the user
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('[Auth] Error getting session:', error);
            } else {
                console.log('[Auth] Initial session check:', session ? `User: ${session.user?.email}` : 'No session');
            }
            
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Cleanup URL hash if it contains auth tokens
            if (hash && hash.includes('access_token')) {
                window.history.replaceState(null, '', window.location.pathname);
            }
        };

        processOAuthHash();

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            console.log('[Auth] Auth state changed:', event, session ? `User: ${session.user?.email}` : 'No session');
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            if (data && data.subscription) {
                data.subscription.unsubscribe();
            }
        };
    }, []);

    const signInWithGoogle = async (returnTo: string = '/') => {
        console.log('[Auth] Starting Google OAuth sign-in');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}${returnTo}`
            }
        });
        if (error) {
            console.error('[Auth] Google OAuth error:', error);
        }
        return { error };
    };

    const signInWithEmail = async (email: string, password: string) => {
        console.log('[Auth] Signing in with email:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            console.error('[Auth] Email sign-in error:', error);
        } else {
            console.log('[Auth] Email sign-in successful');
        }
        return { data, error };
    };

    const signUpWithEmail = async (email: string, password: string) => {
        console.log('[Auth] Signing up with email:', email);
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        if (error) {
            console.error('[Auth] Email sign-up error:', error);
        } else {
            console.log('[Auth] Email sign-up successful');
        }
        return { data, error };
    };

    const signInWithIdToken = async (token: string, nonce?: string | null) => {
        console.log('[Auth] Starting Google One Tap sign-in with ID token');
        console.log('[Auth] Token length:', token?.length);
        console.log('[Auth] Token preview:', token ? `${token.substring(0, 50)}...` : 'NO TOKEN');
        console.log('[Auth] Nonce provided:', nonce ? 'yes' : 'no');
        
        try {
            console.log('[Auth] Calling supabase.auth.signInWithIdToken...');
            
            // Build the request object - only include nonce if provided
            const requestOptions: { provider: 'google'; token: string; nonce?: string } = {
                provider: 'google',
                token: token,
            };
            
            // IMPORTANT: Only pass nonce if it was used during Google initialization
            // Supabase will verify that the nonce in the ID token matches this nonce
            if (nonce) {
                requestOptions.nonce = nonce;
                console.log('[Auth] Including nonce in request');
            }
            
            const { data, error } = await supabase.auth.signInWithIdToken(requestOptions);
            
            console.log('[Auth] signInWithIdToken response received');
            console.log('[Auth] Response data:', data ? 'Has data' : 'No data');
            console.log('[Auth] Response error:', error ? error.message : 'No error');
            
            if (error) {
                console.error('[Auth] ID token sign-in error:', error);
                console.error('[Auth] Full error object:', JSON.stringify(error, null, 2));
                return { data: null, error };
            }
            
            console.log('[Auth] ID token sign-in successful:', data.user?.email);
            console.log('[Auth] User ID:', data.user?.id);
            console.log('[Auth] Session exists:', !!data.session);
            
            // Manually update state immediately for faster UI response
            if (data.session) {
                console.log('[Auth] Setting session and user state...');
                setSession(data.session);
                setUser(data.user);
                console.log('[Auth] State updated successfully');
            } else {
                console.warn('[Auth] No session in response despite successful sign-in');
            }
            
            return { data, error: null };
        } catch (err: any) {
            console.error('[Auth] ID token sign-in exception:', err);
            console.error('[Auth] Exception message:', err?.message);
            console.error('[Auth] Exception stack:', err?.stack);
            return { data: null, error: err };
        }
    };

    const signOut = async () => {
        console.log('[Auth] Signing out');
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('[Auth] Sign out error:', error);
        } else {
            console.log('[Auth] Sign out successful');
            setSession(null);
            setUser(null);
        }
        return { error };
    };

    const value = {
        user,
        session,
        loading,
        userProfile: user ? {
            id: user.id,
            email: user.email || '',
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
        } : null,
        signInWithGoogle,
        signInWithIdToken,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshSession
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
