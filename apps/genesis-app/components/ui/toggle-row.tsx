import * as React from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from './switch';

/**
 * ToggleRow — Accessible, consistently-shaped switch row for both
 * desktop and mobile settings panels.
 *
 * Fixes replacing the three different ad-hoc implementations:
 *   • SettingsPanel inner Toggle (wrapped real Switch but defined inside component)
 *   • AccessibilitySettings inner Toggle (hand-rolled, no aria)
 *   • AdvancedSettings inner Toggle (hand-rolled, no aria)
 *
 * Benefits:
 *   ✔ Uses the canonical <Switch> (Radix) — no more bespoke HTML toggles
 *   ✔ Proper <label htmlFor> ↔ Switch id association (click-anywhere, screen-reader)
 *   ✔ role="switch" + aria-checked come free from @radix-ui/react-switch
 *   ✔ Module-level component — stable React identity, no broken state/refs
 *   ✔ 44 × 44 px minimum touch target on the row (touch-manipulation + min-h-[44px])
 *   ✔ Optional icon, description, and badge props (covers AdvancedSettings "BETA" badges)
 */

export interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ElementType;
  badge?: string;
  disabled?: boolean;
  className?: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  onCheckedChange,
  icon: Icon,
  badge,
  disabled = false,
  className,
}) => {
  // useId gives each row a stable, unique id for the label↔switch association.
  const switchId = useId();

  return (
    <div
      className={cn(
        'flex items-center justify-between',
        'min-h-[44px] py-3 md:py-4',
        'border-b border-peach-soft/30 last:border-0',
        '-mx-2 px-2 rounded-lg transition-colors',
        !disabled && 'cursor-pointer hover:bg-cream-base/50 active:bg-cream-base/70 group',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Label area — acts as the full-width click target for the switch */}
      <label
        htmlFor={switchId}
        className={cn(
          'flex items-center gap-2 md:gap-3 flex-1 min-w-0 touch-manipulation',
          !disabled ? 'cursor-pointer' : 'cursor-not-allowed'
        )}
      >
        {Icon && <Icon className="w-5 h-5 text-coral-burst shrink-0" aria-hidden="true" />}
        <div className="flex flex-col min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'text-charcoal-soft font-medium text-sm transition-colors truncate',
                !disabled && 'group-hover:text-coral-burst'
              )}
            >
              {label}
            </span>
            {badge && (
              <span className="shrink-0 px-1.5 md:px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <span className="text-xs text-cocoa-light mt-0.5 line-clamp-2">{description}</span>
          )}
        </div>
      </label>

      {/* The actual Radix Switch — linked to the label above via id */}
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="ml-3 md:ml-4 shrink-0"
      />
    </div>
  );
};

export { ToggleRow };
