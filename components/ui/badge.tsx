import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * BADGE — Crisp bordered tag/label for categories & statuses.
 * ──────────────────────────────────────────────────────────── */

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-3 py-0.5 text-xs font-heading font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-coral-burst/40 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-peach-soft bg-cream-base text-charcoal-soft",
        primary:
          "border-coral-burst/20 bg-coral-burst/10 text-coral-burst",
        secondary:
          "border-peach-soft bg-white text-cocoa-light",
        success:
          "border-green-200 bg-green-50 text-green-700",
        warning:
          "border-yellow-200 bg-yellow-50 text-yellow-700",
        destructive:
          "border-red-200 bg-red-50 text-red-700",
        gold:
          "border-gold-sunshine/30 bg-linear-to-r from-gold-sunshine/10 to-coral-burst/10 text-coral-burst",
        outline:
          "border-peach-soft bg-transparent text-charcoal-soft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
