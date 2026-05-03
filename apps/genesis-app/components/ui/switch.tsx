import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
 * SWITCH — Properly-proportioned pill toggle.
 *
 * Sizing rationale (desktop & mobile):
 *   Track  : h-6 (24px) × w-11 (44px), px-[2px] padding on both sides
 *   Thumb  : h-5 (20px) × w-5 (20px)
 *   Travel : track-inner-width(40) − thumb-width(20) = 20px → translate-x-5
 *   Gap    : 2px on each side when at either extreme → symmetric pill shape
 *
 * The px-[2px] padding means the thumb is always visually inset from both
 * edges of the rail — no more "thumb touching the wall" on mobile.
 * ──────────────────────────────────────────────────────────── */

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Track: fixed pill size with internal padding so thumb never touches the rail
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
      'px-[2px]',
      'transition-colors duration-200',
      // Focus ring
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-base',
      // Disabled
      'disabled:cursor-not-allowed disabled:opacity-50',
      // State colours  — border is part of visual style, not sizing
      'border',
      'data-[state=checked]:bg-coral-burst data-[state=checked]:border-coral-burst',
      'data-[state=unchecked]:bg-cream-base data-[state=unchecked]:border-peach-soft',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Thumb: solid white disc with shadow for depth — no border needed
        'pointer-events-none block h-5 w-5 rounded-full',
        'bg-white shadow-md ring-0',
        'transition-transform duration-200',
        // translate-x-5 = 20px = track-inner-width(40) − thumb-width(20)
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
