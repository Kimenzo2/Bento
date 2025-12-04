/**
 * i18n Configuration for Genesis
 * 
 * Uses react-i18next with lazy loading, browser detection,
 * and namespace support for organized translations.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

import { FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, TRANSLATION_NAMESPACES } from './languages';

// Initialize i18next with error handling
const initPromise = i18n
  // Load translations from /public/locales
  .use(HttpBackend)
  // Detect user language from localStorage or browser
  .use(LanguageDetector)
  // Connect to React
  .use(initReactI18next)
  .init({
    // Default/fallback language
    fallbackLng: FALLBACK_LANGUAGE,
    
    // Supported languages (for validation)
    supportedLngs: ['en', 'es', 'fr', 'de', 'zh-CN', 'ar', 'pt', 'hi', 'ja'],
    
    // Debug mode (disable in production)
    debug: import.meta.env.DEV,
    
    // Language detection configuration
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache the detected language
      caches: ['localStorage'],
      // Key for localStorage
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    
    // Backend configuration for loading translation files
    backend: {
      // Path to translation files
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      // Request options
      requestOptions: {
        cache: 'default',
      },
    },
    
    // Available namespaces
    ns: TRANSLATION_NAMESPACES,
    
    // Default namespace
    defaultNS: 'common',
    
    // Preload only the essential namespaces
    preload: ['en'],
    
    // Load namespaces on demand
    partialBundledLanguages: true,
    
    // Interpolation settings
    interpolation: {
      // React already escapes values
      escapeValue: false,
      // Format function for dates, numbers, etc.
      format: (value, format, lng) => {
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (format === 'capitalize') {
          return value.charAt(0).toUpperCase() + value.slice(1);
        }
        if (value instanceof Date) {
          return new Intl.DateTimeFormat(lng).format(value);
        }
        if (typeof value === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        return value;
      },
    },
    
    // React-specific options
    react: {
      // Don't use Suspense - handle loading states manually
      useSuspense: false,
      // Bind i18n to React
      bindI18n: 'languageChanged loaded',
      // Bind store
      bindI18nStore: 'added removed',
      // Translating of children default
      transEmptyNodeValue: '',
      // Key for trans component
      transSupportBasicHtmlNodes: true,
      // Allowed HTML nodes in Trans component
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'b', 'u', 'span'],
    },
    
    // Return objects/arrays (not just strings)
    returnObjects: true,
    
    // Return empty string for missing keys (in development)
    returnEmptyString: false,
    
    // Return key if translation is missing
    returnNull: false,
    
    // Key separator for nested translations
    keySeparator: '.',
    
    // Namespace separator
    nsSeparator: ':',
    
    // Pluralization
    pluralSeparator: '_',
    
    // Context separator
    contextSeparator: '_',
    
    // Load language on init
    load: 'currentOnly',
    
    // Clean code from language (e.g., 'en-US' -> 'en')
    cleanCode: true,
    
    // Non-explicit supported languages fallback to 'en'
    nonExplicitSupportedLngs: false,
    
    // Save missing translations (for development)
    saveMissing: import.meta.env.DEV,
    
    // Missing key handler (for development)
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation: ${ns}:${key} for languages: ${lngs.join(', ')}`);
      }
    },
  })
  .catch((err) => {
    console.error('[i18n] Initialization failed:', err);
  });

// Export the initialization promise for components that need to wait
export const i18nReady = initPromise;

// Export the i18n instance
export default i18n;

/**
 * Change the current language
 */
export const changeLanguage = async (languageCode: string): Promise<void> => {
  await i18n.changeLanguage(languageCode);
};

/**
 * Get the current language code
 */
export const getCurrentLanguage = (): string => {
  return i18n.language || FALLBACK_LANGUAGE;
};

/**
 * Check if a language is loaded
 */
export const isLanguageLoaded = (languageCode: string): boolean => {
  return i18n.hasResourceBundle(languageCode, 'common');
};

/**
 * Load a specific namespace for a language
 */
export const loadNamespace = async (namespace: string): Promise<void> => {
  await i18n.loadNamespaces(namespace);
};

/**
 * Add custom translations at runtime
 */
export const addTranslations = (
  languageCode: string,
  namespace: string,
  translations: Record<string, any>
): void => {
  i18n.addResourceBundle(languageCode, namespace, translations, true, true);
};
