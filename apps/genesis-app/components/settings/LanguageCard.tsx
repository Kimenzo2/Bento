/**
 * Language Card Component
 *
 * Displays a single language option with flag, name, and completion status
 */

import { AlertCircle, Check } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../src/types/language.d';

interface LanguageCardProps {
  language: Language;
  isActive: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export const LanguageCard: React.FC<LanguageCardProps> = ({
  language,
  isActive,
  isLoading,
  onClick,
}) => {
  const { t } = useTranslation('settings');

  const completionColor =
    language.completionPercentage >= 90
      ? 'bg-green-500'
      : language.completionPercentage >= 70
        ? 'bg-yellow-500'
        : 'bg-orange-500';

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative p-4 rounded-xl border transition-all duration-200
        hover:scale-[1.02]
        focus:outline-none focus:ring-2 focus:ring-coral-burst focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          isActive
            ? 'border-coral-burst bg-linear-to-br from-coral-burst/10 to-gold-sunshine/10'
            : 'border-peach-soft bg-surface hover:border-peach-soft'
        }
      `}
      aria-pressed={isActive ? 'true' : 'false'}
      aria-label={t('selectLanguageAria', 'Select {{language}} language', {
        language: language.englishName,
      })}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-coral-burst flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Beta badge */}
      {language.isBeta && (
        <div className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
          {t('beta', 'Beta')}
        </div>
      )}

      {/* Flag */}
      <div className="text-4xl mb-3" role="img" aria-label={`${language.englishName} flag`}>
        {language.flag}
      </div>

      {/* Language name (native) */}
      <h3 className="font-heading font-semibold text-lg text-charcoal-soft mb-1">
        {language.name}
      </h3>

      {/* Language name (English) */}
      <p className="text-sm text-cocoa-light mb-3">{language.englishName}</p>

      {/* RTL indicator */}
      {language.isRTL && (
        <div className="flex items-center gap-1 text-xs text-blue-600 mb-3">
          <AlertCircle className="w-3 h-3" />
          <span>{t('rtlLanguages', 'RTL')}</span>
        </div>
      )}

      {/* Completion progress */}
      <div className="w-full">
        <div className="flex items-center justify-between text-xs text-cocoa-light mb-1">
          <span>{t('translation', 'Translation')}</span>
          <span>{language.completionPercentage}%</span>
        </div>
        <div className="w-full h-1.5 bg-peach-soft/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${completionColor}`}
            style={{ width: `${language.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-surface/80 rounded-xl flex items-center justify-center">
          <div className="w-6 h-6 border border-coral-burst border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </button>
  );
};

export default LanguageCard;
