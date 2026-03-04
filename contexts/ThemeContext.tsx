import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { defaultTheme, themes } from '../config/themes';
import type { Theme, ThemeId } from '../types/theme';

export interface ThemeContextType {
  currentTheme: Theme;
  isDarkMode: boolean;
  setTheme: (themeId: ThemeId) => void;
  toggleDarkMode: () => void;
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
    return themes.find((t) => t.id === savedThemeId) || defaultTheme;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('genesis_dark_mode') === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Add smooth transition
    root.style.setProperty('transition', 'background-color 0.3s ease, color 0.3s ease');

    // Resolve color variables
    const cssVars = { ...currentTheme.cssVariables };
    
    // Fallbacks for light mode if missing
    if (!cssVars['--color-surface']) {
      cssVars['--color-surface'] = '#ffffff';
    }

    // Apply Dark Palette overrides if dark mode is active
    if (isDarkMode) {
      cssVars['--color-background'] = '#0a0a0a';
      cssVars['--color-surface'] = '#1a1a1a';
      cssVars['--color-text'] = '#e5e5e5';
      cssVars['--color-text-light'] = '#a3a3a3';
      cssVars['--color-border'] = '#2a2a2a';
    }

    // Apply CSS variables
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Add theme and mode classes to body
    body.className = body.className.replace(/theme-\w+/g, '');
    body.classList.add(`theme-${currentTheme.id}`);
    
    if (isDarkMode) {
      body.classList.add('dark');
      root.classList.add('dark');
      root.style.setProperty('color-scheme', 'dark');
    } else {
      body.classList.remove('dark');
      root.classList.remove('dark');
      root.style.setProperty('color-scheme', 'light');
    }

    // Save to localStorage
    localStorage.setItem('genesis_theme_id', currentTheme.id);
    localStorage.setItem('genesis_dark_mode', isDarkMode.toString());

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: currentTheme, isDarkMode } 
    }));
  }, [currentTheme, isDarkMode]);

  const setTheme = (themeId: ThemeId) => {
    const theme = themes.find((t) => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
    }
  };

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ currentTheme, isDarkMode, setTheme, toggleDarkMode, availableThemes: themes }}>
      {children}
    </ThemeContext.Provider>
  );
};
