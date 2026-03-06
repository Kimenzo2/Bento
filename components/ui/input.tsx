import * as React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * INPUT
 * Clean bordered input with Genesis cream/coral theming.
 * Supports icons via wrapper pattern (see InputWithIcon).
 * ──────────────────────────────────────────────────────────── */

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-peach-soft bg-cream-base px-4 py-2.5 text-sm font-body text-charcoal-soft transition-all duration-200",
        "placeholder:text-cocoa-light/50",
        "focus:border-coral-burst focus:ring-4 focus:ring-coral-burst/10 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-cream-base",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-charcoal-soft",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

/* ─────────────────────────────────────────────────────────────
 * TEXTAREA
 * ──────────────────────────────────────────────────────────── */

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border border-peach-soft bg-cream-base px-4 py-3 text-sm font-body text-charcoal-soft transition-all duration-200 resize-none",
        "placeholder:text-cocoa-light/50",
        "focus:border-coral-burst focus:ring-4 focus:ring-coral-burst/10 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-cream-base",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

/* ─────────────────────────────────────────────────────────────
 * LABEL
 * ──────────────────────────────────────────────────────────── */

import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

const labelVariants = cva(
  "text-sm font-heading font-bold text-charcoal-soft leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Input, Textarea, Label };
