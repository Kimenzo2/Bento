import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { FontPairing } from '../types/fonts';
import { fontPairings } from '../config/fontPairings';
import { useDynamicFontLoader } from '../hooks/useDynamicFontLoader';

interface FontContextType {
    activeFontPairing: FontPairing;
    setFontPairing: (pairingId: string) => void;
    availablePairings: FontPairing[];
    isLoading: boolean;
}

export const FontContext = createContext<FontContextType | undefined>(undefined);

export const FontProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize from localStorage or default
    const [activeFontPairing, setActiveFontPairingState] = useState<FontPairing>(() => {
        const savedId = localStorage.getItem('genesis_font_pairing');
        return fontPairings.find(p => p.id === savedId) || fontPairings[0];
    });

    // Use the dynamic loader hook
    const { isLoading } = useDynamicFontLoader(activeFontPairing);

    const setFontPairing = (pairingId: string) => {
        const pairing = fontPairings.find(p => p.id === pairingId);
        if (pairing) {
            setActiveFontPairingState(pairing);
            localStorage.setItem('genesis_font_pairing', pairingId);
        }
    };

    // Apply CSS variables whenever the active font changes
    useEffect(() => {
        const root = document.documentElement;

        // Set font families
        root.style.setProperty('--font-heading', `'${activeFontPairing.headingFont.family}', ${activeFontPairing.headingFont.fallback}`);
        root.style.setProperty('--font-body', `'${activeFontPairing.bodyFont.family}', ${activeFontPairing.bodyFont.fallback}`);

        // Optional: Set font weights if needed for specific overrides, 
        // but usually handled by utility classes
    }, [activeFontPairing]);

    return (
        <FontContext.Provider value={{
            activeFontPairing,
            setFontPairing,
            availablePairings: fontPairings,
            isLoading
        }}>
            {children}
        </FontContext.Provider>
    );
};
