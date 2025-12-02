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
        root.style.setProperty('transition', 'background-color 0.3s ease, color 0.3s ease');

        Object.entries(currentTheme.cssVariables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        localStorage.setItem('genesis_theme_id', currentTheme.id);
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
