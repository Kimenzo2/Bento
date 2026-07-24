/**
 * IPC Diagnostics — Tauri invoke wrapper with timing and timeout detection.
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Wrapped invoke with timing + timeout detection.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const start = performance.now();

  try {
    const result = await tauriInvoke<T>(cmd, args);
    const elapsed = performance.now() - start;

    // Log slow calls (>2s) as potential hangs
    if (elapsed > 2_000) {
      console.warn(`[ipc] SLOW invoke: ${cmd} took ${Math.round(elapsed)}ms`);
    }

    return result;
  } catch (err) {
    const elapsed = performance.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    console.error(`[ipc] invoke error: ${cmd} after ${Math.round(elapsed)}ms — ${errorMsg}`);

    throw err;
  }
}

/**
 * Raced invoke — rejects after `ms` milliseconds.
 * Use this for calls that MUST NOT hang the UI.
 */
export function invokeWithTimeout<T>(
  cmd: string,
  args?: Record<string, unknown>,
  ms = 8_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    invoke<T>(cmd, args).then((result) => {
      if (!settled) { settled = true; resolve(result); }
    }).catch((err) => {
      if (!settled) { settled = true; reject(err); }
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`${cmd} timed out after ${ms}ms`));
      }
    }, ms);
  });
}

// ── Analytics helpers (no-op stubs — previously routed to LogRocket) ─

export function setLogRocketInstance(_lr: any): void {}

export function trackEvent(
  _category: string,
  _action: string,
  _data?: Record<string, unknown>,
): void {}

export function trackShortcut(_shortcut: string): void {}

export function trackSetting(_setting: string, _enabled: boolean): void {}

export function trackPageView(_page: string): void {}
