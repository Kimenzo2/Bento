import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type WithElementRef<T> = T & {
  ref?: HTMLElement | SVGElement | null;
  class?: string;
};

export type WithoutChildren<T> = Omit<T, 'children'>;

export type WithoutChild<T> = Omit<T, 'child'>;

export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'>;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
