import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import type { SupportedLanguage } from "./shiki";

export type CodeRootProps = {
  ref?: HTMLDivElement | null;
  variant?: "default" | "secondary";
  lang?: SupportedLanguage;
  code: string;
  class?: string;
  hideLines?: boolean;
  highlight?: (number | [number, number])[];
  children?: Snippet;
} & HTMLAttributes<HTMLDivElement>;

export type CodeCopyButtonProps = {
  ref?: HTMLButtonElement | null;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  class?: string;
} & HTMLAttributes<HTMLButtonElement>;

export type CodeOverflowProps = {
  collapsed?: boolean;
  class?: string;
  children?: Snippet;
} & HTMLAttributes<HTMLDivElement>;
