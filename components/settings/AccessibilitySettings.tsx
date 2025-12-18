import React from 'react';
import { Monitor, Moon, Contrast, MousePointer, Type, Keyboard, Volume } from 'lucide-react';

interface AccessibilitySettingsProps {
  settings: {
    reducedMotion: boolean;
    highContrast: boolean;
    screenReaderMode: boolean;
    keyboardNavigation: boolean;
    fontSize: 'small' | 'medium' | 'large';
    soundEffects: boolean;
  };
  onUpdate: (settings: any) => void;
}

const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ settings, onUpdate }) => {
  const Toggle = ({
    label,
    description,
    checked,
    onChange,
    icon: Icon
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (val: boolean) => void;
    icon: any;
  }) => (
    <div
      className="flex items-center justify-between py-4 md:py-4 border-b border-peach-soft/30 last:border-0 cursor-pointer group touch-manipulation active:bg-cream-base/50 -mx-2 px-2 rounded-lg transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        <Icon className="w-5 h-5 text-coral-burst flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-charcoal-soft font-medium text-sm md:text-sm group-hover:text-coral-burst transition-colors truncate">
            {label}
          </span>
          {description && (
            <span className="text-xs text-gray-500 mt-0.5 md:mt-1 line-clamp-2">{description}</span>
          )}
        </div>
      </div>
      <button
        className={`relative w-[44px] h-[22px] rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-coral-burst/50 flex-shrink-0 ml-3 md:ml-4 ${checked ? 'bg-coral-burst' : 'bg-gray-200'
          }`}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-[22px]' : 'translate-x-0'
            }`}
        />
      </button>
    </div>
  );

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Visual Accessibility
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Adjust visual settings for better readability and comfort
        </p>

        <div className="space-y-0">
          <Toggle
            label="Reduced Motion"
            description="Minimize animations and transitions"
            checked={settings.reducedMotion}
            onChange={(val) => {
              onUpdate({ ...settings, reducedMotion: val });
              // Apply to document
              if (val) {
                document.documentElement.classList.add('reduce-motion');
              } else {
                document.documentElement.classList.remove('reduce-motion');
              }
            }}
            icon={Moon}
          />

          <Toggle
            label="High Contrast"
            description="Increase contrast for better visibility"
            checked={settings.highContrast}
            onChange={(val) => {
              onUpdate({ ...settings, highContrast: val });
              // Apply to document
              if (val) {
                document.documentElement.classList.add('high-contrast');
              } else {
                document.documentElement.classList.remove('high-contrast');
              }
            }}
            icon={Contrast}
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Text & Navigation
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Customize text size and navigation preferences
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-cocoa-light uppercase mb-2 block">
              Font Size
            </label>
            <div className="flex gap-2">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onUpdate({ ...settings, fontSize: size });
                    document.documentElement.style.fontSize =
                      size === 'small' ? '14px' :
                        size === 'large' ? '18px' : '16px';
                  }}
                  className={`flex-1 py-3 md:py-2 px-3 md:px-4 rounded-xl border-2 transition-all font-medium capitalize text-sm md:text-base touch-manipulation ${settings.fontSize === size
                    ? 'border-coral-burst bg-coral-burst text-white'
                    : 'border-peach-soft bg-white text-charcoal-soft hover:border-coral-burst/50 active:bg-cream-base'
                    }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <Toggle
            label="Keyboard Navigation"
            description="Enhanced keyboard shortcuts and focus indicators"
            checked={settings.keyboardNavigation}
            onChange={(val) => {
              onUpdate({ ...settings, keyboardNavigation: val });
              if (val) {
                document.documentElement.classList.add('keyboard-nav');
              } else {
                document.documentElement.classList.remove('keyboard-nav');
              }
            }}
            icon={Keyboard}
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Screen Reader & Audio
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Optimize for assistive technologies
        </p>

        <div className="space-y-0">
          <Toggle
            label="Screen Reader Mode"
            description="Optimize interface for screen readers"
            checked={settings.screenReaderMode}
            onChange={(val) => {
              onUpdate({ ...settings, screenReaderMode: val });
              document.documentElement.setAttribute('aria-live', val ? 'polite' : 'off');
            }}
            icon={Monitor}
          />

          <Toggle
            label="Sound Effects"
            description="Enable audio feedback for actions"
            checked={settings.soundEffects}
            onChange={(val) => onUpdate({ ...settings, soundEffects: val })}
            icon={Volume}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
        <p className="text-xs md:text-sm text-blue-900">
          <strong>Tip:</strong> These settings work best when combined with your device's accessibility features.
          Visit your device settings for additional options like VoiceOver, TalkBack, or Narrator.
        </p>
      </div>
    </div>
  );
};

export default AccessibilitySettings;
