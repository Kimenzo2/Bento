/**
 * Language Context for Genesis
 * 
 * Provides language management, RTL support, and formatting utilities
 * throughout the application.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language, LanguageCode, TextDirection, LanguageContextType } from '../types/language.d';
import {
  SUPPORTED_LANGUAGES,
  getLanguageByCode,
  getDefaultLanguage,
  isValidLanguageCode,
  LANGUAGE_STORAGE_KEY,
  FALLBACK_LANGUAGE
} from '../config/languages';

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getDefaultLanguage());

  // Initialize language from i18n
  useEffect(() => {
    const currentCode = i18n.language as LanguageCode;
    if (isValidLanguageCode(currentCode)) {
      const lang = getLanguageByCode(currentCode);
      if (lang) {
        setCurrentLanguage(lang);
        applyLanguageToDocument(lang);
      }
    }
  }, [i18n.language]);

  // Listen for language changes from i18n
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      if (isValidLanguageCode(lng)) {
        const lang = getLanguageByCode(lng as LanguageCode);
        if (lang) {
          setCurrentLanguage(lang);
          applyLanguageToDocument(lang);
        }
      }
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  /**
   * Apply language settings to the document (RTL, lang attribute)
   */
  const applyLanguageToDocument = useCallback((language: Language) => {
    const html = document.documentElement;
    const body = document.body;

    // Set lang attribute
    html.setAttribute('lang', language.code);

    // Set direction attribute
    html.setAttribute('dir', language.direction);

    // Add RTL class for Tailwind utilities
    if (language.isRTL) {
      html.classList.add('rtl');
      html.classList.remove('ltr');
    } else {
      html.classList.add('ltr');
      html.classList.remove('rtl');
    }

    // Add language class to body for conditional styling
    body.className = body.className.replace(/lang-\w+/g, '');
    body.classList.add(`lang-${language.code}`);

    // Store preference
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language } }));
  }, []);

  /**
   * Change the current language
   */
  const changeLanguage = useCallback(async (code: LanguageCode): Promise<void> => {
    if (!isValidLanguageCode(code)) {
      console.error(`[LanguageContext] Invalid language code: ${code}`);
      return;
    }

    const targetLanguage = getLanguageByCode(code);
    if (!targetLanguage) {
      console.error(`[LanguageContext] Language not found: ${code}`);
      return;
    }

    setIsLoading(true);

    try {
      // Change i18n language (this loads the translation files)
      await i18n.changeLanguage(code);

      // Update state
      setCurrentLanguage(targetLanguage);

      // Apply to document
      applyLanguageToDocument(targetLanguage);

      console.log(`[LanguageContext] Language changed to: ${targetLanguage.name}`);
    } catch (error) {
      console.error(`[LanguageContext] Failed to change language:`, error);
      // Fallback to English
      await i18n.changeLanguage(FALLBACK_LANGUAGE);
    } finally {
      setIsLoading(false);
    }
  }, [i18n, applyLanguageToDocument]);

  /**
   * Format a date according to current locale
   */
  const formatDate = useCallback((date: Date | string | number): string => {
    const dateObj = date instanceof Date ? date : new Date(date);
    try {
      return new Intl.DateTimeFormat(currentLanguage.numberFormat, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(dateObj);
    } catch {
      return dateObj.toLocaleDateString();
    }
  }, [currentLanguage.numberFormat]);

  /**
   * Format a number according to current locale
   */
  const formatNumber = useCallback((num: number): string => {
    try {
      return new Intl.NumberFormat(currentLanguage.numberFormat).format(num);
    } catch {
      return num.toLocaleString();
    }
  }, [currentLanguage.numberFormat]);

  /**
   * Format currency according to current locale
   */
  const formatCurrency = useCallback((amount: number, currencyCode?: string): string => {
    const currency = currencyCode || currentLanguage.currency;
    try {
      return new Intl.NumberFormat(currentLanguage.numberFormat, {
        style: 'currency',
        currency
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [currentLanguage.numberFormat, currentLanguage.currency]);

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  const formatRelativeTime = useCallback((date: Date | string | number): string => {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    try {
      const rtf = new Intl.RelativeTimeFormat(currentLanguage.numberFormat, { numeric: 'auto' });

      if (diffInSeconds < 60) {
        return rtf.format(-diffInSeconds, 'second');
      } else if (diffInSeconds < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
      } else if (diffInSeconds < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
      } else if (diffInSeconds < 2592000) {
        return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
      } else if (diffInSeconds < 31536000) {
        return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
      } else {
        return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
      }
    } catch {
      return dateObj.toLocaleDateString();
    }
  }, [currentLanguage.numberFormat]);

  // Memoize context value
  const contextValue = useMemo<LanguageContextType>(() => ({
    currentLanguage,
    languages: SUPPORTED_LANGUAGES,
    changeLanguage,
    direction: currentLanguage.direction,
    isLoading,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime
  }), [
    currentLanguage,
    changeLanguage,
    isLoading,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime
  ]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to access language context
 */
export const useLanguageContext = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
