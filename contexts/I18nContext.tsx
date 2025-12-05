import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Supported languages
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ar' | 'hi' | 'pt' | 'ru';

interface LanguageInfo {
    code: SupportedLanguage;
    name: string;
    nativeName: string;
    direction: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr' }
];

// Translation keys organized by section
type TranslationKeys = {
    common: {
        save: string;
        cancel: string;
        delete: string;
        edit: string;
        create: string;
        loading: string;
        error: string;
        success: string;
        close: string;
        next: string;
        previous: string;
        back: string;
        continue: string;
    };
    auth: {
        signIn: string;
        signUp: string;
        signOut: string;
        email: string;
        password: string;
        forgotPassword: string;
        createAccount: string;
        welcomeBack: string;
    };
    book: {
        createNew: string;
        myBooks: string;
        savedBooks: string;
        title: string;
        page: string;
        pageOf: string;
        generating: string;
        regenerate: string;
        download: string;
        share: string;
        publish: string;
    };
    editor: {
        editPage: string;
        addPage: string;
        deletePage: string;
        textContent: string;
        imagePrompt: string;
        regenerateImage: string;
        saveChanges: string;
        storyBible: string;
        consistency: string;
    };
    settings: {
        title: string;
        language: string;
        theme: string;
        notifications: string;
        account: string;
        accessibility: string;
        reducedMotion: string;
        highContrast: string;
        fontSize: string;
    };
    accessibility: {
        skipToContent: string;
        pageNavigation: string;
        openMenu: string;
        closeMenu: string;
        loading: string;
        imageDescription: string;
    };
};

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Default English translations
const defaultTranslations: TranslationKeys = {
    common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        create: 'Create',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        close: 'Close',
        next: 'Next',
        previous: 'Previous',
        back: 'Back',
        continue: 'Continue'
    },
    auth: {
        signIn: 'Sign In',
        signUp: 'Sign Up',
        signOut: 'Sign Out',
        email: 'Email',
        password: 'Password',
        forgotPassword: 'Forgot Password?',
        createAccount: 'Create Account',
        welcomeBack: 'Welcome Back!'
    },
    book: {
        createNew: 'Create New Book',
        myBooks: 'My Books',
        savedBooks: 'Saved Books',
        title: 'Title',
        page: 'Page',
        pageOf: 'Page {current} of {total}',
        generating: 'Generating your book...',
        regenerate: 'Regenerate',
        download: 'Download',
        share: 'Share',
        publish: 'Publish'
    },
    editor: {
        editPage: 'Edit Page',
        addPage: 'Add Page',
        deletePage: 'Delete Page',
        textContent: 'Text Content',
        imagePrompt: 'Image Prompt',
        regenerateImage: 'Regenerate Image',
        saveChanges: 'Save Changes',
        storyBible: 'Story Bible',
        consistency: 'Consistency Check'
    },
    settings: {
        title: 'Settings',
        language: 'Language',
        theme: 'Theme',
        notifications: 'Notifications',
        account: 'Account',
        accessibility: 'Accessibility',
        reducedMotion: 'Reduced Motion',
        highContrast: 'High Contrast',
        fontSize: 'Font Size'
    },
    accessibility: {
        skipToContent: 'Skip to main content',
        pageNavigation: 'Page navigation',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
        loading: 'Content is loading',
        imageDescription: 'Story illustration'
    }
};

// Translation cache
const translationCache = new Map<SupportedLanguage, TranslationKeys>();
translationCache.set('en', defaultTranslations);

interface I18nContextValue {
    language: SupportedLanguage;
    direction: 'ltr' | 'rtl';
    setLanguage: (lang: SupportedLanguage) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Helper to get nested value from object using dot notation
function getNestedValue(obj: any, path: string): string | undefined {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Dynamic translation loader (loads from public/locales)
async function loadTranslations(language: SupportedLanguage): Promise<TranslationKeys> {
    if (translationCache.has(language)) {
        return translationCache.get(language)!;
    }

    try {
        const response = await fetch(`/locales/${language}.json`);
        if (response.ok) {
            const translations = await response.json();
            // Merge with defaults to ensure all keys exist
            const merged = deepMerge(defaultTranslations, translations);
            translationCache.set(language, merged);
            return merged;
        }
    } catch (error) {
        console.warn(`Failed to load translations for ${language}, falling back to English`);
    }

    return defaultTranslations;
}

// Deep merge helper
function deepMerge<T extends Record<string, any>>(target: T, source: DeepPartial<T>): T {
    const result = { ...target } as T;
    
    for (const key in source) {
        if (source[key] !== undefined) {
            if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                (result as any)[key] = deepMerge((result as any)[key] || {}, source[key] as any);
            } else {
                (result as any)[key] = source[key];
            }
        }
    }
    
    return result;
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<SupportedLanguage>('en');
    const [translations, setTranslations] = useState<TranslationKeys>(defaultTranslations);
    const [isLoading, setIsLoading] = useState(false);

    const languageInfo = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    useEffect(() => {
        // Load saved language preference
        const saved = localStorage.getItem('genesis-language') as SupportedLanguage | null;
        if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
            setLanguageState(saved);
        } else {
            // Detect browser language
            const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
            if (SUPPORTED_LANGUAGES.some(l => l.code === browserLang)) {
                setLanguageState(browserLang);
            }
        }
    }, []);

    useEffect(() => {
        // Load translations when language changes
        setIsLoading(true);
        loadTranslations(language)
            .then(setTranslations)
            .finally(() => setIsLoading(false));

        // Update document direction
        document.documentElement.dir = languageInfo.direction;
        document.documentElement.lang = language;
    }, [language, languageInfo.direction]);

    const setLanguage = (lang: SupportedLanguage) => {
        setLanguageState(lang);
        localStorage.setItem('genesis-language', lang);
    };

    const t = (key: string, params?: Record<string, string | number>): string => {
        let value = getNestedValue(translations, key) || getNestedValue(defaultTranslations, key) || key;
        
        // Replace parameters {param}
        if (params) {
            Object.entries(params).forEach(([param, val]) => {
                value = value.replace(`{${param}}`, String(val));
            });
        }
        
        return value;
    };

    return (
        <I18nContext.Provider value={{
            language,
            direction: languageInfo.direction,
            setLanguage,
            t,
            isLoading
        }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}

// Utility hook for RTL support
export function useRTL() {
    const { direction } = useI18n();
    return {
        isRTL: direction === 'rtl',
        startAlign: direction === 'rtl' ? 'right' : 'left',
        endAlign: direction === 'rtl' ? 'left' : 'right',
        marginStart: direction === 'rtl' ? 'marginRight' : 'marginLeft',
        marginEnd: direction === 'rtl' ? 'marginLeft' : 'marginRight',
        paddingStart: direction === 'rtl' ? 'paddingRight' : 'paddingLeft',
        paddingEnd: direction === 'rtl' ? 'paddingLeft' : 'paddingRight'
    };
}
