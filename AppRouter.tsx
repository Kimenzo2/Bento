/**
 * AppRouter - Root-level routing for Genesis
 *
 * ARCHITECTURE DECISION:
 * This is the SINGLE POINT OF ENTRY for the entire application.
 * It decides at the router level whether to show:
 * 1. OnboardingApp - Completely isolated, dark-themed experience for new users
 * 2. MainApp - The full Genesis application with cream theme
 *
 * WHY THIS PATTERN:
 * - Onboarding and Main App are SIBLINGS, not parent-child
 * - They share NOTHING except React context (Auth)
 * - Each has its own layout, styles, and state
 * - Bundle splitting: new users only download onboarding code initially
 * - Zero possibility of style bleed or state interference
 *
 * This is how production apps like Figma, Notion, and Linear handle onboarding.
 */

import type React from 'react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppSkeleton from './components/AppSkeleton';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { supabase } from './services/supabaseClient';

const PROFILE_CHECK_TIMEOUT_MS = 5000;

async function hasExistingProfile(userId: string): Promise<boolean> {
  try {
    const result = await Promise.race([
      supabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
      new Promise<{ data: null; error: Error }>((resolve) => {
        window.setTimeout(
          () => resolve({ data: null, error: new Error('Profile check timed out') }),
          PROFILE_CHECK_TIMEOUT_MS
        );
      }),
    ]);

    if (result.error) {
      if (import.meta.env.DEV) {
        console.error('[AppRouter] Profile check failed:', result.error);
      }
      return false;
    }

    return Boolean(result.data);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[AppRouter] Profile check threw:', error);
    }
    return false;
  }
}

// Lazy load both apps for optimal bundle splitting
// New users get OnboardingApp bundle first (smaller)
// Returning users get MainApp bundle directly
const OnboardingApp = lazy(() => import('./components/onboarding/OnboardingApp'));
const MainApp = lazy(() => import('./MainApp'));

// Tier detail pages - lazy loaded for on-demand access
const TierDetailCreator = lazy(() => import('./components/tiers/TierDetailCreator'));
const TierDetailStudio = lazy(() => import('./components/tiers/TierDetailStudio'));
const TierDetailEmpire = lazy(() => import('./components/tiers/TierDetailEmpire'));

// Payment callback - handles return from Dodo checkout
const PaymentCallback = lazy(() => import('./components/PaymentCallback'));

// Auth page - login/signup for returning users
const AuthPage = lazy(() => import('./components/AuthPage'));

// Layout wrapper for tiers to provide strict styling context
const TierLayout = lazy(() => import('./components/tiers/TierLayout'));

// Public blog pages — no auth required, themed via standalone ThemeProvider
const BlogIndex = lazy(() => import('./components/blog/BlogIndex'));
const BlogPost = lazy(() => import('./components/blog/BlogPost'));
const LearnPage = lazy(() => import('./components/learn/LearnPage'));
const LearnArticlePage = lazy(() => import('./components/learn/LearnArticlePage'));
const TransparencyPage = lazy(() => import('./components/learn/TransparencyPage'));
const LegalViewer = lazy(() => import('./components/LegalViewer'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

const PublicLegalPage: React.FC<{ initialDoc: 'privacy' | 'terms' | 'cookies' | 'acceptable-use' }> = ({
  initialDoc,
}) => (
  <ThemeProvider>
    <LegalViewer initialDoc={initialDoc} />
  </ThemeProvider>
);

// Single unified loading state — AppSkeleton replaces all previous spinners
const AppLoading: React.FC = () => <AppSkeleton />;

// Route guard for /welcome/* — ONBOARDING IS ONLY FOR BRAND NEW USERS.
// Returning visitors are NEVER shown onboarding.
// VERIFICATION ORDER: 1) localStorage (fast) → 2) DB profile (authoritative)
// DB is the single source of truth. localStorage is just a cache.
const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const hasCompletedOnboarding = localStorage.getItem('genesis_onboarding_completed') === 'true';

  useEffect(() => {
    let isMounted = true;

    if (loading) return;

    // FAST PATH: localStorage flag exists → returning user, no DB call needed
    if (hasCompletedOnboarding) {
      setShouldRedirect(true);
      setChecking(false);
      return;
    }

    // No localStorage flag. If NOT authenticated, they're brand new → show onboarding
    if (!user) {
      setChecking(false);
      return;
    }

    // AUTHENTICATED but no localStorage (new device, cleared data, etc.)
    // DB is the authority: check if profile exists
    const checkProfile = async () => {
      try {
        const profileExists = await hasExistingProfile(user.id);
        if (profileExists && isMounted) {
          // Profile exists in DB → returning user. Restore localStorage cache and redirect.
          localStorage.setItem('genesis_onboarding_completed', 'true');
          setShouldRedirect(true);
        }
        // No profile in DB → genuinely new authenticated user, show onboarding
      } catch {
        // On error, show onboarding (safe default — better than locking them out)
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };
    checkProfile();

    return () => {
      isMounted = false;
    };
  }, [user, loading, hasCompletedOnboarding]);

  // Wait for auth + DB check to resolve
  if (loading || checking) return <AppSkeleton />;

  // Returning user → redirect away from onboarding
  if (shouldRedirect) {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/auth?returnTo=/" replace />;
  }

  // Brand new user → show the onboarding funnel
  return <>{children}</>;
};

const MainAppGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isReturningUser, setIsReturningUser] = useState(false);

  const hasCompletedOnboarding = localStorage.getItem('genesis_onboarding_completed') === 'true';

  // For authenticated users without the localStorage flag, check Supabase profile
  // to determine if they're a returning user (already onboarded previously).
  useEffect(() => {
    let isMounted = true;

    if (loading) return; // wait for auth
    if (!user) { setChecking(false); return; }
    if (hasCompletedOnboarding) { setChecking(false); return; } // flag present, no need to check DB

    // User is authenticated but localStorage flag is missing (e.g. signed out & back in).
    // Check if their profile already exists in Supabase → returning user.
    const checkProfile = async () => {
      try {
        const profileExists = await hasExistingProfile(user.id);
        if (profileExists && isMounted) {
          // Profile exists → returning user, restore flag and go to dashboard
          localStorage.setItem('genesis_onboarding_completed', 'true');
          setIsReturningUser(true);
        }
      } catch {
        // On error, fall through to onboarding (safe default)
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };
    checkProfile();

    return () => {
      isMounted = false;
    };
  }, [user, loading, hasCompletedOnboarding]);

  // Wait for auth + profile check to resolve before deciding
  if (loading || checking) return <AppSkeleton />;

  // Not signed in → check if returning visitor or brand new
  if (!user) {
    if (hasCompletedOnboarding) {
      // Returning visitor: session expired, send to auth then back to dashboard
      return <Navigate to="/auth?returnTo=/" replace />;
    }
    // Brand new visitor: send to the landing page
    return <Navigate to="/welcome" replace />;
  }

  if (!hasCompletedOnboarding && !isReturningUser) {
    // Genuinely new user with no profile, redirect to onboarding
    return <Navigate to="/welcome/onboarding" replace />;
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
        {/* Payment callback - accessible without auth guards, handles Dodo redirect */}
        <Route path="/payment-callback" element={<PaymentCallback />} />

        {/* Auth page - login/signup for returning users */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Tier detail pages - accessible during onboarding for "Why" buttons */}
        {/* Wrapped in TierLayout to ensure correct Font/Theme providers */}
        <Route element={<TierLayout />}>
          <Route path="/tier/creator" element={<TierDetailCreator />} />
          <Route path="/tier/studio" element={<TierDetailStudio />} />
          <Route path="/tier/empire" element={<TierDetailEmpire />} />
        </Route>

        {/* Public legal pages for SEO and direct access */}
        <Route path="/legal" element={<PublicLegalPage initialDoc="privacy" />} />
        <Route path="/legal/privacy" element={<PublicLegalPage initialDoc="privacy" />} />
        <Route path="/legal/terms" element={<PublicLegalPage initialDoc="terms" />} />
        <Route path="/legal/cookies" element={<PublicLegalPage initialDoc="cookies" />} />
        <Route path="/legal/acceptable-use" element={<PublicLegalPage initialDoc="acceptable-use" />} />
        <Route path="/privacy" element={<PublicLegalPage initialDoc="privacy" />} />
        <Route path="/terms" element={<PublicLegalPage initialDoc="terms" />} />
        <Route path="/cookies" element={<PublicLegalPage initialDoc="cookies" />} />
        <Route path="/acceptable-use" element={<PublicLegalPage initialDoc="acceptable-use" />} />

        {/* Blog — public, SEO-indexed, inherits user theme from localStorage */}
        <Route
          element={
            <ThemeProvider>
              <Outlet />
            </ThemeProvider>
          }
        >
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:slug" element={<LearnArticlePage />} />
          <Route path="/transparency" element={<TransparencyPage />} />
        </Route>

        {/* Landing page — public, themed via ThemeProvider so all 6 themes work */}
        <Route
          path="/welcome"
          element={
            <ThemeProvider>
              <LandingPage />
            </ThemeProvider>
          }
        />

        {/* Onboarding flow - completely isolated experience for new users in the funnel */}
        <Route
          path="/welcome/onboarding/*"
          element={
            <OnboardingGuard>
              <OnboardingApp />
            </OnboardingGuard>
          }
        />

        {/* Main app - all other routes */}
        <Route
          path="/*"
          element={
            <MainAppGuard>
              <MainApp />
            </MainAppGuard>
          }
        />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
