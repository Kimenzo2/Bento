/**
 * Language Type Definitions for Genesis i18n System
 */

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'zh-CN' | 'ar' | 'pt' | 'hi' | 'ja';

export type TextDirection = 'ltr' | 'rtl';

export interface Language {
  /** ISO 639-1 language code (e.g., 'en', 'es', 'fr') */
  code: LanguageCode;
  
  /** Native language name (e.g., 'English', 'Español', 'Français') */
  name: string;
  
  /** English name for reference */
  englishName: string;
  
  /** Text direction: 'ltr' (left-to-right) or 'rtl' (right-to-left) */
  direction: TextDirection;
  
  /** Unicode emoji flag */
  flag: string;
  
  /** Date formatting pattern */
  dateFormat: string;
  
  /** Locale for number formatting (BCP 47) */
  numberFormat: string;
  
  /** Default currency code (ISO 4217) */
  currency: string;
  
  /** Translation coverage percentage (0-100) */
  completionPercentage: number;
  
  /** Array of contributor/translator names */
  translators?: string[];
  
  /** Whether this language is RTL */
  isRTL: boolean;
  
  /** Whether this language is in beta (machine translated) */
  isBeta?: boolean;
}

export interface LanguageContextType {
  /** Current active language */
  currentLanguage: Language;
  
  /** All available languages */
  languages: Language[];
  
  /** Function to change language */
  changeLanguage: (code: LanguageCode) => Promise<void>;
  
  /** Current text direction */
  direction: TextDirection;
  
  /** Whether language is currently loading */
  isLoading: boolean;
  
  /** Format date according to current locale */
  formatDate: (date: Date | string | number) => string;
  
  /** Format number according to current locale */
  formatNumber: (num: number) => string;
  
  /** Format currency according to current locale */
  formatCurrency: (amount: number, currencyCode?: string) => string;
  
  /** Get relative time (e.g., "2 hours ago") */
  formatRelativeTime: (date: Date | string | number) => string;
}

export interface TranslationNamespace {
  common: string;
  navigation: string;
  settings: string;
  editor: string;
  creation: string;
  auth: string;
  errors: string;
  notifications: string;
  storybook: string;
  curriculum: string;
  pricing: string;
  gamification: string;
}

// Declaration merging for react-i18next
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof import('../../public/locales/en/common.json');
      navigation: typeof import('../../public/locales/en/navigation.json');
      settings: typeof import('../../public/locales/en/settings.json');
      auth: typeof import('../../public/locales/en/auth.json');
      errors: typeof import('../../public/locales/en/errors.json');
    };
  }
}
