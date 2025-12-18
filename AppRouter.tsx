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

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy load both apps for optimal bundle splitting
// New users get OnboardingApp bundle first (smaller)
// Returning users get MainApp bundle directly
const OnboardingApp = lazy(() => import('./components/onboarding/OnboardingApp'));
const MainApp = lazy(() => import('./MainApp'));

// Tier detail pages - lazy loaded for on-demand access
const TierDetailCreator = lazy(() => import('./components/tiers/TierDetailCreator'));
const TierDetailStudio = lazy(() => import('./components/tiers/TierDetailStudio'));
const TierDetailEmpire = lazy(() => import('./components/tiers/TierDetailEmpire'));

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
  const hasCompletedOnboarding = localStorage.getItem('genesis_onboarding_completed') === 'true';

  if (!hasCompletedOnboarding) {
    // New user, redirect to onboarding
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
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
