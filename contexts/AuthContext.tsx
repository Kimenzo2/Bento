import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // CRITICAL: Process OAuth hash FIRST before checking session
        const processOAuthHash = async () => {
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                // Supabase will automatically extract and store the session from the hash
                // We just need to trigger getSession() which will read it
            }

            // Check active sessions and sets the user
            const { data: { session }, error } = await supabase.auth.getSession();
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
        const { data } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
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
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}${returnTo}`
            }
        });
        return { error };
    };

    const signInWithEmail = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    };

    const signUpWithEmail = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        return { data, error };
    };

    const signInWithIdToken = async (token: string) => {
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: token,
        });
        return { data, error };
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
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
        signOut
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
