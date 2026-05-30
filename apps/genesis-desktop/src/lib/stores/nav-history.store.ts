/**
 * nav-history.store.ts
 *
 * Tracks the module navigation history so "Back" can return the user
 * to where they were before.
 *
 * Every call to switchModule() in modules.ts pushes to this stack.
 * back() pops the current entry and switches to the previous module.
 */

import { writable, derived, get } from 'svelte/store';
import type { BentoModuleId } from '$lib/data/module-catalog';

// ── Internal stack of module IDs ─────────────────────────────────────────────
const _stack = writable<BentoModuleId[]>([]);

// Guard: when back() is navigating, suppress the pushNav that switchModule fires
let _isGoingBack = false;

// ── Public: can we go back? ───────────────────────────────────────────────────
export const canGoBack = derived(_stack, ($s) => $s.length > 1);

// ── Called by switchModule() every time a module is activated ────────────────
export function pushNav(moduleId: BentoModuleId): void {
  if (_isGoingBack) return;           // back() manages the stack itself
  _stack.update((s) => {
    if (s[s.length - 1] === moduleId) return s;
    return [...s, moduleId];
  });
}

// ── Called by the Back menu item ─────────────────────────────────────────────
export async function back(): Promise<void> {
  const stack = get(_stack);
  if (stack.length <= 1) return;

  const previous = stack[stack.length - 2];

  // Pop the current entry
  _stack.update((s) => s.slice(0, -1));

  // Suppress pushNav during the back-navigation
  _isGoingBack = true;
  try {
    const { switchModule } = await import('$lib/desktop/modules');
    await switchModule(previous);
  } finally {
    _isGoingBack = false;
  }
}

export function getStack(): BentoModuleId[] {
  return get(_stack);
}
