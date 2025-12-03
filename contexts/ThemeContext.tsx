import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, ThemeId } from '../types/theme';
import { themes, defaultTheme } from '../config/themes';

interface ThemeContextType {
    currentTheme: Theme;
    setTheme: (themeId: ThemeId) => void;
    availableThemes: Theme[];
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
        const savedThemeId = localStorage.getItem('genesis_theme_id');
        return themes.find(t => t.id === savedThemeId) || defaultTheme;
    });

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        // Add smooth transition
        root.style.setProperty('transition', 'background-color 0.3s ease, color 0.3s ease');

        // Apply CSS variables
        Object.entries(currentTheme.cssVariables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Add theme class to body for conditional styling
        body.className = body.className.replace(/theme-\w+/g, '');
        body.classList.add(`theme-${currentTheme.id}`);

        // Save to localStorage
        localStorage.setItem('genesis_theme_id', currentTheme.id);

        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: currentTheme } }));
    }, [currentTheme]);

    const setTheme = (themeId: ThemeId) => {
        const theme = themes.find(t => t.id === themeId);
        if (theme) {
            setCurrentTheme(theme);
        }
    };

    return (
        <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes: themes }}>
            {children}
        </ThemeContext.Provider>
    );
};
