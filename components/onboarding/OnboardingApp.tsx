/**
 * OnboardingApp - Completely Isolated Onboarding Experience
 * 
 * ARCHITECTURE:
 * This is a SEPARATE mini-application that runs independently from the main Genesis app.
 * It has its own:
 * - Root-level styles (dark theme, no cream)
 * - State management (OnboardingProvider)
 * - No shared layout with main app
 * 
 * This architectural separation ensures:
 * 1. Zero style leakage - onboarding never sees cream background
 * 2. Clean bundle splitting - main app code not loaded during onboarding
 * 3. Predictable behavior - no interference from main app state
 * 4. Better performance - smaller initial payload for new users
 */

import React, { useEffect } from 'react';
import { OnboardingProvider } from './OnboardingState';
import { OnboardingLayout } from './OnboardingLayout';

// Onboarding-specific global styles
const ONBOARDING_STYLES = `
  html, body, #root {
    background: #0a0a0f !important;
    margin: 0 !important;
    padding: 0 !important;
    height: 100% !important;
    width: 100% !important;
    overflow: hidden !important;
  }
`;

export const OnboardingApp: React.FC = () => {
  // Apply onboarding-specific styles at mount, restore on unmount
  useEffect(() => {
    // Create style element for onboarding
    const styleElement = document.createElement('style');
    styleElement.id = 'onboarding-global-styles';
    styleElement.textContent = ONBOARDING_STYLES;
    document.head.appendChild(styleElement);

    // Store original styles
    const originalBodyBg = document.body.style.background;
    const originalBodyOverflow = document.body.style.overflow;

    // Cleanup function
    return () => {
      // Remove our style override
      const existingStyle = document.getElementById('onboarding-global-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      // Restore original styles
      document.body.style.background = originalBodyBg;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  return (
    <OnboardingProvider>
      <OnboardingLayout />
    </OnboardingProvider>
  );
};

export default OnboardingApp;
