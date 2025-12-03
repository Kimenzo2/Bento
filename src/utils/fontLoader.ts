import { FontDefinition } from '../types/fonts';

/**
 * Generates a Google Fonts URL for a given font definition.
 */
export const generateGoogleFontsUrl = (font: FontDefinition): string => {
    if (font.googleFontsUrl) return font.googleFontsUrl;

    const family = font.family.replace(/\s+/g, '+');
    const weights = font.weights.join(';');
    return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap&subset=latin`;
};

/**
 * Checks if a font is already loaded in the document.
 */
export const isFontLoaded = (fontFamily: string): boolean => {
    // Check if the font is available in the document fonts
    // This is a basic check; document.fonts.check() is more robust but requires specific syntax
    return document.fonts.check(`12px "${fontFamily}"`);
};

/**
 * Inject a Google Fonts link tag into the document head.
 */
export const loadFont = (font: FontDefinition): Promise<void> => {
    return new Promise((resolve, reject) => {
        const url = generateGoogleFontsUrl(font);

        // Check if this stylesheet already exists
        if (document.querySelector(`link[href="${url}"]`)) {
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;

        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load font: ${font.family}`));

        document.head.appendChild(link);
    });
};

/**
 * Preconnect to Google Fonts domains.
 */
export const preconnectGoogleFonts = () => {
    const domains = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

    domains.forEach(domain => {
        if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = domain;
            if (domain === 'https://fonts.gstatic.com') {
                link.crossOrigin = 'anonymous';
            }
            document.head.appendChild(link);
        }
    });
};
