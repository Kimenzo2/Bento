/**
 * Language Configuration for Genesis
 *
 * Defines all supported languages with their properties
 */

import type { Language, LanguageCode } from '../types/language.d';

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    englishName: 'English',
    direction: 'ltr',
    flag: '🇺🇸',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'en-US',
    currency: 'USD',
    completionPercentage: 100,
    isRTL: false,
    isBeta: false,
    translators: ['Genesis Team'],
  },
  {
    code: 'es',
    name: 'Español',
    englishName: 'Spanish',
    direction: 'ltr',
    flag: '🇪🇸',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'es-ES',
    currency: 'EUR',
    completionPercentage: 85,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
  {
    code: 'fr',
    name: 'Français',
    englishName: 'French',
    direction: 'ltr',
    flag: '🇫🇷',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'fr-FR',
    currency: 'EUR',
    completionPercentage: 80,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
  {
    code: 'de',
    name: 'Deutsch',
    englishName: 'German',
    direction: 'ltr',
    flag: '🇩🇪',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: 'de-DE',
    currency: 'EUR',
    completionPercentage: 75,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
  {
    code: 'zh-CN',
    name: '简体中文',
    englishName: 'Chinese (Simplified)',
    direction: 'ltr',
    flag: '🇨🇳',
    dateFormat: 'YYYY年MM月DD日',
    numberFormat: 'zh-CN',
    currency: 'CNY',
    completionPercentage: 70,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
  {
    code: 'ar',
    name: 'العربية',
    englishName: 'Arabic',
    direction: 'rtl',
    flag: '🇸🇦',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'ar-SA',
    currency: 'SAR',
    completionPercentage: 65,
    isRTL: true,
    isBeta: true,
    translators: [],
  },
  {
    code: 'pt',
    name: 'Português',
    englishName: 'Portuguese',
    direction: 'ltr',
    flag: '🇧🇷',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'pt-BR',
    currency: 'BRL',
    completionPercentage: 75,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
  {
    code: 'hi',
    name: 'हिन्दी',
    englishName: 'Hindi',
    direction: 'ltr',
    flag: '🇮🇳',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'hi-IN',
    currency: 'INR',
    completionPercentage: 60,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
  {
    code: 'ja',
    name: '日本語',
    englishName: 'Japanese',
    direction: 'ltr',
    flag: '🇯🇵',
    dateFormat: 'YYYY年MM月DD日',
    numberFormat: 'ja-JP',
    currency: 'JPY',
    completionPercentage: 70,
    isRTL: false,
    isBeta: true,
    translators: [],
  },
];

/**
 * Get language by code
 */
export const getLanguageByCode = (code: LanguageCode): Language | undefined => {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
};

/**
 * Get default language (English)
 */
export const getDefaultLanguage = (): Language => {
  return SUPPORTED_LANGUAGES[0];
};

/**
 * Check if a language code is valid
 */
export const isValidLanguageCode = (code: string): code is LanguageCode => {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
};

/**
 * Get RTL languages
 */
export const getRTLLanguages = (): Language[] => {
  return SUPPORTED_LANGUAGES.filter((lang) => lang.isRTL);
};

/**
 * Check if a language is RTL
 */
export const isRTLLanguage = (code: LanguageCode): boolean => {
  const lang = getLanguageByCode(code);
  return lang?.isRTL ?? false;
};

/**
 * Get languages sorted by completion percentage
 */
export const getLanguagesByCompletion = (): Language[] => {
  return [...SUPPORTED_LANGUAGES].sort((a, b) => b.completionPercentage - a.completionPercentage);
};

/**
 * Get languages sorted alphabetically by English name
 */
export const getLanguagesAlphabetically = (): Language[] => {
  return [...SUPPORTED_LANGUAGES].sort((a, b) => a.englishName.localeCompare(b.englishName));
};

/**
 * Storage key for language preference
 */
export const LANGUAGE_STORAGE_KEY = 'genesis_language';

/**
 * Default fallback language
 */
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

/**
 * Translation namespaces
 */
export const TRANSLATION_NAMESPACES = [
  'common',
  'navigation',
  'settings',
  'editor',
  'creation',
  'auth',
  'errors',
  'notifications',
  'storybook',
  'curriculum',
  'pricing',
  'gamification',
] as const;

export type TranslationNamespace = (typeof TRANSLATION_NAMESPACES)[number];
