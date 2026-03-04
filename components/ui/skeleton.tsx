import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * SKELETON — Genesis-themed loading placeholder.
 * ──────────────────────────────────────────────────────────── */

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-peach-soft/40",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
 * SPINNER — Unified loading spinner.
 * ──────────────────────────────────────────────────────────── */

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  className?: string;
}

const spinnerSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

function Spinner({ size = "md", text, className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex flex-col items-center justify-center gap-3", className)}
    >
      <Loader2 className={cn(spinnerSizes[size], "text-coral-burst animate-spin")} />
      {text && (
        <p className="text-cocoa-light font-body text-sm animate-pulse">
          {text}
        </p>
      )}
      {!text && <span className="sr-only">Loading...</span>}
    </div>
  );
}

export { Skeleton, Spinner };
