/**
 * Language Selector Component
 * 
 * Full language selection panel with search, filter, and grid display
 */

import React, { useState, useMemo } from 'react';
import { Search, Globe, Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageCard } from './LanguageCard';
import { useLanguage } from '../../src/hooks/useLanguage';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../../src/config/languages';
import type { LanguageCode } from '../../src/types/language.d';

interface LanguageSelectorProps {
  onLanguageChange?: (code: LanguageCode) => void;
  showCompact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onLanguageChange,
  showCompact = false
}) => {
  const { t } = useTranslation('settings');
  const { currentLanguage, changeLanguage, isLoading } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'complete' | 'rtl'>('all');
  const [changingTo, setChangingTo] = useState<LanguageCode | null>(null);

  // Filter and search languages
  const filteredLanguages = useMemo(() => {
    return SUPPORTED_LANGUAGES.filter(lang => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesFilter = filter === 'all' ||
        (filter === 'complete' && lang.completionPercentage >= 90) ||
        (filter === 'rtl' && lang.isRTL);

      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filter]);

  // Handle language selection
  const handleLanguageSelect = async (code: LanguageCode) => {
    if (code === currentLanguage.code || isLoading) return;

    setChangingTo(code);
    try {
      await changeLanguage(code);
      onLanguageChange?.(code);
    } finally {
      setChangingTo(null);
    }
  };

  // Reset to browser default
  const handleReset = async () => {
    const browserLang = navigator.language.split('-')[0] as LanguageCode;
    const supportedLang = getLanguageByCode(browserLang);
    if (supportedLang && supportedLang.code !== currentLanguage.code) {
      await handleLanguageSelect(supportedLang.code);
    }
  };

  // Compact mode - just a dropdown
  if (showCompact) {
    return (
      <div className="relative">
        <select
          value={currentLanguage.code}
          onChange={(e) => handleLanguageSelect(e.target.value as LanguageCode)}
          disabled={isLoading}
          className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 
            text-sm font-medium text-charcoal-soft cursor-pointer
            hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-coral-burst focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t('selectLanguage', 'Select language')}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  // Full mode - grid with search and filters
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-burst to-gold-sunshine flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl text-charcoal-soft">
              {t('language', 'Language')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('languageDescription', 'Choose your preferred language')}
            </p>
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={handleReset}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 
            hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title={t('resetLanguage', 'Reset to browser default')}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">{t('reset', 'Reset')}</span>
        </button>
      </div>

      {/* Current selection indicator */}
      <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-coral-burst/10 to-gold-sunshine/10 rounded-lg border border-coral-burst/20">
        <Check className="w-5 h-5 text-coral-burst" />
        <span className="text-sm text-charcoal-soft">
          {t('currentLanguage', 'Current language:')}
        </span>
        <span className="font-medium text-charcoal-soft">
          {currentLanguage.flag} {currentLanguage.name}
        </span>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchLanguages', 'Search languages...')}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg
              text-sm text-charcoal-soft placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-coral-burst focus:border-transparent"
            aria-label={t('searchLanguages', 'Search languages')}
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {(['all', 'complete', 'rtl'] as const).map(filterOption => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
                ${filter === filterOption
                  ? 'bg-coral-burst text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              aria-pressed={filter === filterOption ? 'true' : 'false'}
            >
              {filterOption === 'all' && t('all', 'All')}
              {filterOption === 'complete' && t('complete', 'Complete')}
              {filterOption === 'rtl' && t('rtlLanguages', 'RTL')}
            </button>
          ))}
        </div>
      </div>

      {/* Language grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredLanguages.map(lang => (
          <LanguageCard
            key={lang.code}
            language={lang}
            isActive={lang.code === currentLanguage.code}
            isLoading={changingTo === lang.code}
            onClick={() => handleLanguageSelect(lang.code)}
          />
        ))}
      </div>

      {/* No results */}
      {filteredLanguages.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {t('noLanguagesFound', 'No languages found')}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilter('all');
            }}
            className="mt-2 text-sm text-coral-burst hover:underline"
          >
            {t('clearFilters', 'Clear filters')}
          </button>
        </div>
      )}

      {/* Language stats */}
      <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
        <span>
          {t('totalLanguages', '{{count}} languages available', { count: SUPPORTED_LANGUAGES.length })}
        </span>
        <span>•</span>
        <span>
          {t('completeLanguages', '{{count}} fully translated', {
            count: SUPPORTED_LANGUAGES.filter(l => l.completionPercentage >= 90).length
          })}
        </span>
        <span>•</span>
        <span>
          {t('rtlSupport', '{{count}} RTL supported', {
            count: SUPPORTED_LANGUAGES.filter(l => l.isRTL).length
          })}
        </span>
      </div>
    </div>
  );
};

export default LanguageSelector;
