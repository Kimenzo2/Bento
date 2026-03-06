import { Contrast, Keyboard, Monitor, Moon, Volume } from 'lucide-react';
import type React from 'react';
import { Label } from '@components/ui/input';
import { ToggleRow } from '@components/ui/toggle-row';

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
          <ToggleRow
            label="Reduced Motion"
            description="Minimize animations and transitions"
            checked={settings.reducedMotion}
            onCheckedChange={(val) => {
              onUpdate({ ...settings, reducedMotion: val });
              if (val) {
                document.documentElement.classList.add('reduce-motion');
              } else {
                document.documentElement.classList.remove('reduce-motion');
              }
            }}
            icon={Moon}
          />

          <ToggleRow
            label="High Contrast"
            description="Increase contrast for better visibility"
            checked={settings.highContrast}
            onCheckedChange={(val) => {
              onUpdate({ ...settings, highContrast: val });
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
            <Label className="text-xs uppercase mb-2">
              Font Size
            </Label>
            <div className="flex gap-2">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onUpdate({ ...settings, fontSize: size });
                    document.documentElement.style.fontSize =
                      size === 'small' ? '14px' : size === 'large' ? '18px' : '16px';
                  }}
                  className={`flex-1 py-3 md:py-2 px-3 md:px-4 rounded-xl border transition-all font-medium capitalize text-sm md:text-base touch-manipulation ${
                    settings.fontSize === size
                      ? 'border-coral-burst bg-coral-burst text-white'
                      : 'border-peach-soft bg-surface text-charcoal-soft hover:border-coral-burst/50 active:bg-cream-base'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="Keyboard Navigation"
            description="Enhanced keyboard shortcuts and focus indicators"
            checked={settings.keyboardNavigation}
            onCheckedChange={(val) => {
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
        <p className="text-sm text-cocoa-light mb-4">Optimize for assistive technologies</p>

        <div className="space-y-0">
          <ToggleRow
            label="Screen Reader Mode"
            description="Optimize interface for screen readers"
            checked={settings.screenReaderMode}
            onCheckedChange={(val) => {
              onUpdate({ ...settings, screenReaderMode: val });
              document.documentElement.setAttribute('aria-live', val ? 'polite' : 'off');
            }}
            icon={Monitor}
          />

          <ToggleRow
            label="Sound Effects"
            description="Enable audio feedback for actions"
            checked={settings.soundEffects}
            onCheckedChange={(val) => onUpdate({ ...settings, soundEffects: val })}
            icon={Volume}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
        <p className="text-xs md:text-sm text-blue-900">
          <strong>Tip:</strong> These settings work best when combined with your device's
          accessibility features. Visit your device settings for additional options like VoiceOver,
          TalkBack, or Narrator.
        </p>
      </div>
    </div>
  );
};

export default AccessibilitySettings;
