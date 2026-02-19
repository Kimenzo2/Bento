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
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabaseClient';

// Lazy load both apps for optimal bundle splitting
// New users get OnboardingApp bundle first (smaller)
// Returning users get MainApp bundle directly
const OnboardingApp = lazy(() => import('./components/onboarding/OnboardingApp'));
const MainApp = lazy(() => import('./MainApp'));

// Tier detail pages - lazy loaded for on-demand access
const TierDetailCreator = lazy(() => import('./components/tiers/TierDetailCreator'));
const TierDetailStudio = lazy(() => import('./components/tiers/TierDetailStudio'));
const TierDetailEmpire = lazy(() => import('./components/tiers/TierDetailEmpire'));

// Payment callback - handles return from Paystack hosted checkout
const PaymentCallback = lazy(() => import('./components/PaymentCallback'));

// Auth page - login/signup for returning users
const AuthPage = lazy(() => import('./components/AuthPage'));

// Layout wrapper for tiers to provide strict styling context
const TierLayout = lazy(() => import('./components/tiers/TierLayout'));

// Minimal loading state - just prevents flash
const AppLoading: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        border: '3px solid rgba(255,217,61,0.2)',
        borderTopColor: '#FFD93D',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Route guard component
const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hasCompletedOnboarding = localStorage.getItem('genesis_onboarding_completed') === 'true';

  if (hasCompletedOnboarding) {
    // User completed onboarding, redirect to main app
    return <Navigate to="/" replace />;
  }

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
    if (loading) return; // wait for auth
    if (!user) { setChecking(false); return; }
    if (hasCompletedOnboarding) { setChecking(false); return; } // flag present, no need to check DB

    // User is authenticated but localStorage flag is missing (e.g. signed out & back in).
    // Check if their profile already exists in Supabase → returning user.
    const checkProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        if (data) {
          // Profile exists → returning user, restore flag and go to dashboard
          localStorage.setItem('genesis_onboarding_completed', 'true');
          setIsReturningUser(true);
        }
      } catch {
        // On error, fall through to onboarding (safe default)
      } finally {
        setChecking(false);
      }
    };
    checkProfile();
  }, [user, loading, hasCompletedOnboarding]);

  // Wait for auth + profile check to resolve before deciding
  if (loading || checking) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#FFF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, border: '3px solid rgba(255,155,113,0.2)', borderTopColor: '#FF9B71', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not signed in → send to auth page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasCompletedOnboarding && !isReturningUser) {
    // Genuinely new user with no profile, redirect to onboarding
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
        {/* Payment callback - accessible without auth guards, handles Paystack redirect */}
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

        {/* Onboarding route - completely isolated experience */}
        <Route
          path="/welcome/*"
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
