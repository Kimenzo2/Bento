/**
 * ADVANCED MEMOIZATION UTILITIES
 * 
 * Prevents unnecessary re-renders through:
 * 1. Stable callback references
 * 2. Deep equality checks for complex objects
 * 3. Selector patterns for context optimization
 * 4. Component-level memoization with custom comparators
 */

import React, { memo, useCallback, useMemo, useRef } from 'react';

/**
 * Deep comparison for memo (more thorough than shallow)
 * Only use for components with complex props
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
}

/**
 * Shallow comparison for memo (faster, default React behavior)
 */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => a[key] === b[key]);
}

/**
 * HOC for creating optimized memoized components
 * Includes display name for React DevTools
 */
export function createMemoComponent<P extends object>(
  Component: React.ComponentType<P>,
  displayName: string,
  areEqual?: (prevProps: P, nextProps: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  const MemoizedComponent = memo(Component, areEqual);
  MemoizedComponent.displayName = `Memo(${displayName})`;
  return MemoizedComponent;
}

/**
 * useStableCallback - Returns a stable callback reference
 * The callback always has access to latest closure values
 * but the reference never changes (prevents child re-renders)
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef<T>(callback);
  callbackRef.current = callback;
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

/**
 * useMemoCompare - useMemo with custom comparison
 * Only recomputes when compare function returns false
 */
export function useMemoCompare<T>(
  factory: () => T,
  deps: React.DependencyList,
  compare: (prev: T | undefined, next: T) => boolean
): T {
  const ref = useRef<T | undefined>(undefined);
  
  const value = useMemo(factory, deps);
  
  if (ref.current === undefined || !compare(ref.current, value)) {
    ref.current = value;
  }
  
  return ref.current as T;
}

/**
 * Memoized empty array - prevents re-renders from [] !== []
 */
export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

/**
 * Memoized empty object - prevents re-renders from {} !== {}
 */
export const EMPTY_OBJECT: Readonly<Record<string, never>> = Object.freeze({});

/**
 * Create stable style object
 */
export function useStableStyle<T extends React.CSSProperties>(style: T): T {
  const ref = useRef<T>(style);
  
  if (!shallowEqual(ref.current as Record<string, unknown>, style as Record<string, unknown>)) {
    ref.current = style;
  }
  
  return ref.current;
}

/**
 * Optimized children wrapper - prevents re-render when children haven't changed
 */
interface StableChildrenProps {
  children: React.ReactNode;
}

export const StableChildren = memo(function StableChildren({ children }: StableChildrenProps) {
  return <>{children}</>;
});
