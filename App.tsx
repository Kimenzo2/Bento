/**
 * App.tsx - Root Entry Point
 * 
 * ARCHITECTURAL DECISION:
 * This file is now a thin wrapper that delegates to AppRouter.
 * The router decides whether to show OnboardingApp or MainApp
 * based on the user's onboarding completion status.
 * 
 * BENEFITS:
 * 1. Onboarding and MainApp are COMPLETELY SEPARATE React trees
 * 2. No shared layout - each has its own global styles
 * 3. Optimal bundle splitting - users only load what they need
 * 4. Zero possibility of style bleed between experiences
 * 
 * This is production-grade architecture used by Figma, Notion, Linear.
 */

import React from 'react';
import { AppRouter } from './AppRouter';

const App: React.FC = () => {
  return <AppRouter />;
};

export default App;
