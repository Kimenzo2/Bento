import type { Snippet } from "svelte";

export type ButtonSize = "default" | "sm" | "lg" | "icon";
export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

export type CopyButtonProps = {
  ref?: HTMLButtonElement | null;
  text: string;
  icon?: Snippet;
  animationDuration?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onCopy?: (status: "success" | "failure" | undefined) => void;
  class?: string;
  children?: Snippet;
  tabindex?: number | null | undefined;
};
