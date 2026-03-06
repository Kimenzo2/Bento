import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { sendWelcomeEmail } from '../services/emailService';
import { ensureUserProfile, getUserProfile, invalidateProfileCache } from '../services/profileService';
import { supabase } from '../services/supabaseClient';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

type SessionRestoreResult = {
  data: { session: Session | null };
  error: Error | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        resolve(fallback);
      });
  });
}

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
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbProfile, setDbProfile] = useState<{ full_name: string | null; display_name: string | null; avatar_url: string | null; email: string } | null>(null);
  const profileEnsuredRef = useRef<string | null>(null);

  // Refresh session helper
  const refreshSession = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      if (import.meta.env.DEV) console.error('[Auth] Error refreshing session:', error);
      return;
    }
    setSession(session);
    setUser(session?.user ?? null);
  };

  useEffect(() => {
    let isMounted = true;

    // CRITICAL: Process OAuth hash FIRST before checking session
    const processOAuthHash = async () => {
      const hash = window.location.hash;

      if (hash && hash.includes('access_token')) {
        if (import.meta.env.DEV) console.warn('[Auth] Processing OAuth callback from URL hash');
      }

      try {
        // Check active sessions and sets the user
        const sessionResult: SessionRestoreResult = await withTimeout<SessionRestoreResult>(
          supabase.auth.getSession() as Promise<SessionRestoreResult>,
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          {
            data: { session: null },
            error: new Error('Timed out while restoring auth session'),
          }
        );
        const session = sessionResult.data.session;
        const error = sessionResult.error;

        if (error) {
          if (import.meta.env.DEV) console.error('[Auth] Error getting session:', error);
        }

        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[Auth] Exception getting session:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }

        // Cleanup URL hash if it contains auth tokens or errors
        if (hash && (hash.includes('access_token') || hash.includes('error_description') || hash.includes('error='))) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    processOAuthHash();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Clear DB profile on sign-out
        if (!session?.user) {
          setDbProfile(null);
          profileEnsuredRef.current = null;
        }
      }
    );

    return () => {
      isMounted = false;
      if (data && data.subscription) {
        data.subscription.unsubscribe();
      }
    };
  }, []);

  // Ensure profile exists in DB whenever user signs in
  useEffect(() => {
    if (user && profileEnsuredRef.current !== user.id) {
      profileEnsuredRef.current = user.id;
      ensureUserProfile().then((profile) => {
        if (profile) {
          setDbProfile({
            full_name: profile.full_name,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            email: profile.email,
          });
        }
      }).catch((err) => {
        if (import.meta.env.DEV) console.error('[Auth] Failed to ensure profile:', err);
      });
    }
  }, [user]);

  const signInWithGoogle = async (returnTo = '/') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${returnTo}`,
      },
    });
    if (error) {
      if (import.meta.env.DEV) console.error('[Auth] Google OAuth error:', error);
    }
    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error && import.meta.env.DEV) {
      console.error('[Auth] Email sign-in error:', error.message);
    }
    return { data, error };
  };

  const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName, name: fullName } } : undefined,
    });
    if (error) {
      if (import.meta.env.DEV) console.error('[Auth] Email sign-up error:', error.message);
    } else {
      // Send welcome email to new user
      if (data.user?.email) {
        const userName = data.user.user_metadata?.full_name || data.user.email.split('@')[0];
        sendWelcomeEmail(data.user.email, userName).catch((err) => {
          console.error('[Auth] Failed to send welcome email:', err);
        });
      }
    }
    return { data, error };
  };

  const signInWithIdToken = async (token: string, nonce?: string | null) => {
    console.warn('[Auth] Starting Google One Tap sign-in with ID token');
    if (import.meta.env.DEV) {
      console.warn('[Auth] Token length:', token?.length);
      console.warn('[Auth] Nonce provided:', nonce ? 'yes' : 'no');
    }

    try {
      if (import.meta.env.DEV) console.warn('[Auth] Calling supabase.auth.signInWithIdToken...');

      // Build the request object - only include nonce if provided
      const requestOptions: { provider: 'google'; token: string; nonce?: string } = {
        provider: 'google',
        token: token,
      };

      // IMPORTANT: Only pass nonce if it was used during Google initialization
      // Supabase will verify that the nonce in the ID token matches this nonce
      if (nonce) {
        requestOptions.nonce = nonce;
        if (import.meta.env.DEV) console.warn('[Auth] Including nonce in request');
      }

      const { data, error } = await supabase.auth.signInWithIdToken(requestOptions);

      if (import.meta.env.DEV) {
        console.warn('[Auth] signInWithIdToken response received');
        console.warn('[Auth] Response data:', data ? 'Has data' : 'No data');
        console.warn('[Auth] Response error:', error ? error.message : 'No error');
      }

      if (error) {
        console.error('[Auth] ID token sign-in error:', error.message);
        return { data: null, error };
      }

      if (import.meta.env.DEV) {
        console.warn('[Auth] ID token sign-in successful:', data.user?.email);
        console.warn('[Auth] Session exists:', !!data.session);
      }

      // Manually update state immediately for faster UI response
      if (data.session) {
        console.warn('[Auth] Setting session and user state...');
        setSession(data.session);
        setUser(data.user);
        console.warn('[Auth] State updated successfully');
      } else {
        console.warn('[Auth] No session in response despite successful sign-in');
      }

      return { data, error: null };
    } catch (err: unknown) {
      console.error('[Auth] ID token sign-in exception:', err);
      console.error('[Auth] Exception message:', (err as Error)?.message);
      console.error('[Auth] Exception stack:', (err as Error)?.stack);
      return { data: null, error: err };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      if (import.meta.env.DEV) console.error('[Auth] Sign out error:', error);
    } else {
      setSession(null);
      setUser(null);
    }
    return { error };
  };

  // Re-fetch the DB profile (call after updating profile in settings)
  const refreshProfile = async () => {
    if (!user) return;
    invalidateProfileCache(user.id);
    const profile = await getUserProfile();
    if (profile) {
      setDbProfile({
        full_name: profile.full_name,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        email: profile.email,
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    userProfile: user
      ? {
          id: user.id,
          email: dbProfile?.email || user.email || '',
          display_name:
            dbProfile?.display_name ||
            dbProfile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0],
          avatar_url:
            dbProfile?.avatar_url ||
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture,
        }
      : null,
    signInWithGoogle,
    signInWithIdToken,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshSession,
    refreshProfile,
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
