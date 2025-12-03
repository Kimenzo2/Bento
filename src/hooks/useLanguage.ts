/**
 * useLanguage Hook
 * 
 * Provides easy access to language switching and translation utilities
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguageContext } from '../contexts/LanguageContext';
import type { Language, LanguageCode } from '../types/language.d';
import { getLanguageByCode, isValidLanguageCode } from '../config/languages';

interface UseLanguageReturn {
  /** Current active language */
  currentLanguage: Language;
  
  /** All available languages */
  languages: Language[];
  
  /** Current text direction */
  direction: 'ltr' | 'rtl';
  
  /** Whether language is currently loading */
  isLoading: boolean;
  
  /** Change to a specific language */
  changeLanguage: (code: LanguageCode) => Promise<void>;
  
  /** Translation function (from react-i18next) */
  t: (key: string, options?: Record<string, any>) => string;
  
  /** Check if current language is RTL */
  isRTL: boolean;
  
  /** Format date in current locale */
  formatDate: (date: Date | string | number) => string;
  
  /** Format number in current locale */
  formatNumber: (num: number) => string;
  
  /** Format currency in current locale */
  formatCurrency: (amount: number, currencyCode?: string) => string;
  
  /** Format relative time */
  formatRelativeTime: (date: Date | string | number) => string;
  
  /** Get language by code */
  getLanguage: (code: LanguageCode) => Language | undefined;
  
  /** Check if a language code is valid */
  isValidCode: (code: string) => boolean;
}

/**
 * Custom hook for language management
 */
export const useLanguage = (): UseLanguageReturn => {
  const { t } = useTranslation();
  const languageContext = useLanguageContext();

  const getLanguage = useCallback((code: LanguageCode): Language | undefined => {
    return getLanguageByCode(code);
  }, []);

  const isValidCode = useCallback((code: string): boolean => {
    return isValidLanguageCode(code);
  }, []);

  return {
    currentLanguage: languageContext.currentLanguage,
    languages: languageContext.languages,
    direction: languageContext.direction,
    isLoading: languageContext.isLoading,
    changeLanguage: languageContext.changeLanguage,
    t: t as (key: string, options?: Record<string, any>) => string,
    isRTL: languageContext.currentLanguage.isRTL,
    formatDate: languageContext.formatDate,
    formatNumber: languageContext.formatNumber,
    formatCurrency: languageContext.formatCurrency,
    formatRelativeTime: languageContext.formatRelativeTime,
    getLanguage,
    isValidCode
  };
};

export default useLanguage;
