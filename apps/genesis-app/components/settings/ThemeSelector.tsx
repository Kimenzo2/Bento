import { CheckCircle } from 'lucide-react';
import type React from 'react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme, ThemeId } from '../../types/theme';

type PreviewToken = {
  label: string;
  token: '--primary' | '--accent' | '--background';
  alias: '--color-primary-start' | '--color-accent-start' | '--color-background';
  fallback: 'primary' | 'accent' | 'background';
};

const PREVIEW_TOKENS: readonly PreviewToken[] = [
  { label: 'Primary', token: '--primary', alias: '--color-primary-start', fallback: 'primary' },
  { label: 'Accent', token: '--accent', alias: '--color-accent-start', fallback: 'accent' },
  {
    label: 'Background',
    token: '--background',
    alias: '--color-background',
    fallback: 'background',
  },
] as const;

function resolvePreviewColor(theme: Theme, isDarkMode: boolean, previewToken: PreviewToken) {
  const variables =
    isDarkMode && theme.darkCssVariables ? theme.darkCssVariables : theme.cssVariables;
  const direct = variables[previewToken.token];
  if (direct) return direct;

  const aliasValue = variables[previewToken.alias];
  if (aliasValue) return aliasValue;

  const source = isDarkMode && theme.darkColors ? theme.darkColors : theme.colors;
  switch (previewToken.fallback) {
    case 'accent':
      return source.accent[0];
    case 'background':
      return source.background;
    case 'primary':
    default:
      return source.primary[0];
  }
}

const ThemeSelector: React.FC = () => {
  const { currentTheme, setTheme, availableThemes, isDarkMode } = useTheme();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft mb-2">
          Theme Gallery
        </h3>
        <p className="text-cocoa-light text-sm">
          Choose a visual theme that inspires your creativity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableThemes.map((theme) => {
          const isActive = currentTheme.id === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id as ThemeId)}
              className={`relative group text-left rounded-2xl p-4 transition-all duration-300 border touch-manipulation
                ${
                  isActive
                    ? 'border-coral-burst bg-surface scale-[1.02]'
                    : 'border-transparent bg-surface/50 hover:bg-surface hover:scale-[1.01]'
                }
              `}
            >
              {/* Token preview */}
              <div className="mb-4 flex h-24 w-full items-center justify-center rounded-xl border border-peach-soft bg-surface/70 px-4">
                <div className="flex items-center gap-3">
                  {PREVIEW_TOKENS.map((preview) => {
                    const value = resolvePreviewColor(theme, isDarkMode, preview);
                    const isBackground = preview.token === '--background';

                    return (
                      <span
                        key={preview.label}
                        className={`h-5 w-5 rounded-full border ${isBackground ? 'scale-110' : ''}`}
                        style={{
                          backgroundColor: value,
                          borderColor: 'var(--color-border)',
                        }}
                        title={preview.label}
                        aria-label={preview.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="flex justify-between items-start">
                <div>
                  <h4
                    className={`font-heading font-bold text-lg ${isActive ? 'text-coral-burst' : 'text-charcoal-soft'}`}
                  >
                    {theme.name}
                  </h4>
                  <p className="text-xs text-cocoa-light mt-1 line-clamp-2">{theme.description}</p>
                </div>
                {isActive && <CheckCircle className="w-5 h-5 text-coral-burst shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
