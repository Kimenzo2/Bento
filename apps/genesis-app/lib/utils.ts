import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx — the standard Shadcn/ui utility.
 * Handles conditional classes, deduplication, and conflict resolution.
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-primary text-white", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
