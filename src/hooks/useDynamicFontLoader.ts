import { useState, useEffect } from 'react';
import { FontPairing } from '../types/fonts';
import { loadFont, preconnectGoogleFonts } from '../utils/fontLoader';

export const useDynamicFontLoader = (activeFontPairing: FontPairing) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        preconnectGoogleFonts();
    }, []);

    useEffect(() => {
        const loadFonts = async () => {
            setIsLoading(true);
            setError(null);

            // Add loading class to body for FOUT prevention
            document.body.classList.add('fonts-loading');

            try {
                await Promise.all([
                    loadFont(activeFontPairing.headingFont),
                    loadFont(activeFontPairing.bodyFont)
                ]);

                // Wait for fonts to be ready
                await document.fonts.ready;

            } catch (err) {
                console.error("Failed to load fonts:", err);
                setError("Failed to load selected fonts. Using system fallback.");
            } finally {
                document.body.classList.remove('fonts-loading');
                setIsLoading(false);
            }
        };

        loadFonts();
    }, [activeFontPairing.id]); // Only reload if ID changes

    return { isLoading, error };
};
