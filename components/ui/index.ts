/* ─────────────────────────────────────────────────────────────
 * GENESIS UI COMPONENT LIBRARY
 * ─────────────────────────────────────────────────────────────
 * Shadcn/ui-compatible components with Radix UI primitives,
 * Genesis cream/coral/gold design system, and clean 2px borders.
 *
 * Inspired by FoundrList.com — Next.js + Shadcn/ui + Supabase.
 * ──────────────────────────────────────────────────────────── */

// Layout & Structure
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";
export { Separator } from "./separator";
export { ScrollArea, ScrollBar } from "./scroll-area";

// Forms & Inputs
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";
export { Input, Textarea, Label } from "./input";
export { Switch } from "./switch";
export { ToggleRow } from "./toggle-row";
export type { ToggleRowProps } from "./toggle-row";

// Feedback
export { Badge, badgeVariants } from "./badge";
export type { BadgeProps } from "./badge";
export { Toaster, toast } from "./sonner";
export { Skeleton, Spinner } from "./skeleton";

// Overlays & Navigation
export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "./dialog";
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup,
  DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuRadioGroup,
} from "./dropdown-menu";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

// Data Display
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";
