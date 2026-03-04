import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — clean border design with crisp transitions
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-heading font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-base disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-charcoal-soft text-white hover:bg-charcoal-soft/90 border border-charcoal-soft/10",
        primary:
          "bg-linear-to-r from-coral-burst to-gold-sunshine text-white hover:scale-[1.02] border border-white/20",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 border border-red-600/20",
        outline:
          "border border-peach-soft bg-white text-charcoal-soft hover:bg-cream-base hover:border-coral-burst/30",
        secondary:
          "bg-cream-base text-charcoal-soft border border-peach-soft hover:bg-peach-soft/30",
        ghost:
          "text-charcoal-soft hover:bg-cream-base hover:text-coral-burst border border-transparent",
        link:
          "text-coral-burst underline-offset-4 hover:underline border-none p-0 h-auto",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
