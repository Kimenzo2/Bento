import React, { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import '../../src/config/i18n'; // Initialize i18n
import { ThemeProvider } from '../../contexts/ThemeContext';
import { FontProvider } from '../../src/contexts/FontContext';
import { LanguageProvider } from '../../src/contexts/LanguageContext';
import ErrorBoundary from '../ErrorBoundary';

/**
 * TierLayout
 * 
 * Provides the necessary application context (Theme, Font, Language) for the 
 * standalone Tier Detail pages. Uses Nunito font to match onboarding experience.
 */

// Nunito font CSS variables for tier pages
const TIER_FONT_STYLES: React.CSSProperties = {
    '--font-heading': "'Nunito', system-ui, sans-serif",
    '--font-body': "'Nunito', system-ui, sans-serif",
} as React.CSSProperties;

export const TierLayout: React.FC = () => {
    // Load Nunito font from Google Fonts for tier pages
    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.id = 'tier-nunito-font';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap';
        document.head.appendChild(fontLink);
        return () => {
            const el = document.getElementById('tier-nunito-font');
            if (el) el.remove();
        };
    }, []);

    return (
        <ErrorBoundary>
            <ThemeProvider>
                <FontProvider>
                    <LanguageProvider>
                        <div style={TIER_FONT_STYLES} className="min-h-screen">
                            <Suspense fallback={
                                <div className="min-h-screen bg-cream-base flex items-center justify-center">
                                    <div className="animate-spin w-8 h-8 border-4 border-coral-burst border-t-transparent rounded-full" />
                                </div>
                            }>
                                <Outlet />
                            </Suspense>
                        </div>
                    </LanguageProvider>
                </FontProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
};

export default TierLayout;
