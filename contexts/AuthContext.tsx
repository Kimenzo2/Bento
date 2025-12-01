import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: (returnTo?: string) => Promise<{ error: any }>;
    signInWithIdToken: (token: string) => Promise<{ data: any; error: any }>;
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

    const signInWithIdToken = async (token: string) => {
        console.log('[Auth] Starting Google One Tap sign-in with ID token');
        try {
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: token,
            });
            
            if (error) {
                console.error('[Auth] ID token sign-in error:', error);
                return { data: null, error };
            }
            
            console.log('[Auth] ID token sign-in successful:', data.user?.email);
            
            // Manually update state immediately for faster UI response
            if (data.session) {
                setSession(data.session);
                setUser(data.user);
            }
            
            return { data, error: null };
        } catch (err) {
            console.error('[Auth] ID token sign-in exception:', err);
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
