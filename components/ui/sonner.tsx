import { Toaster as SonnerToaster, toast } from "sonner";
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
 * SONNER TOASTER — Drop-in replacement for the hand-rolled Toast.
 * Uses Genesis theming with clean borders. Place <Toaster /> once
 * in the app root (App.tsx or MainApp.tsx).
 *
 * Usage:
 *   import { toast } from "@/components/ui/sonner";
 *   toast.success("Book saved!");
 *   toast.error("Something went wrong");
 *   toast("Neutral notification");
 * ──────────────────────────────────────────────────────────── */

function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      offset={16}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 px-4 py-3 rounded-xl border max-w-md font-body text-sm pointer-events-auto bg-surface border-peach-soft text-charcoal-soft",
          title: "font-heading font-bold text-sm",
          description: "text-cocoa-light text-xs",
          actionButton:
            "bg-coral-burst text-white rounded-lg px-3 py-1.5 text-xs font-heading font-bold hover:bg-coral-hover transition-colors",
          cancelButton:
            "bg-cream-base text-charcoal-soft rounded-lg px-3 py-1.5 text-xs font-heading font-bold border border-peach-soft hover:bg-peach-soft/30 transition-colors",
          closeButton:
            "text-cocoa-light hover:text-charcoal-soft transition-colors",
          success: "!border-green-200 !bg-green-50 !text-green-800",
          error: "!border-red-200 !bg-red-50 !text-red-800",
          warning: "!border-yellow-200 !bg-yellow-50 !text-yellow-800",
          info: "!border-blue-200 !bg-blue-50 !text-blue-800",
        },
      }}
      icons={{
        success: <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />,
        error: <XCircle className="w-5 h-5 text-red-600 shrink-0" />,
        info: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />,
      }}
    />
  );
}

export { Toaster, toast };
