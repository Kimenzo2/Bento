/**
 * IPC Diagnostics — Tauri invoke wrapper with LogRocket instrumentation.
 *
 * Every `invoke` call is wrapped with timing, success/failure tracking,
 * and timeout detection so we can pinpoint which commands hang.
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

let LogRocket: any = null;

/**
 * Lazy-load LogRocket so this module works even before LogRocket is initialized.
 */
function getLR(): any {
  if (LogRocket) return LogRocket;
  try {
    // Dynamic import — safe if logrocket isn't installed or is unavailable
    const lr = (window as any).__LR;
    if (lr) LogRocket = lr;
  } catch {
    // not available
  }
  return LogRocket;
}

/**
 * Mark LogRocket as available. Called by +layout.svelte after init().
 */
export function setLogRocketInstance(lr: any): void {
  LogRocket = lr;
  (window as any).__LR = lr;
}

/**
 * Wrapped invoke with LogRocket breadcrumbs + timing.
 *
 * Logs to LogRocket:
 *  - "invoke:command" breadcrumb with args on success
 *  - "invoke:hang" breadcrumb if duration exceeds threshold
 *  - "invoke:error" breadcrumb + captureException on failure
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const lr = getLR();
  const start = performance.now();

  try {
    const result = await tauriInvoke<T>(cmd, args);
    const elapsed = performance.now() - start;

    // Log slow calls (>2s) as potential hangs
    if (elapsed > 2_000) {
      lr?.captureBreadcrumb?.({
        category: "invoke",
        message: `invoke:hang`,
        data: { cmd, elapsedMs: Math.round(elapsed), args: sanitizeArgs(args) },
      });
      console.warn(`[ipc] SLOW invoke: ${cmd} took ${Math.round(elapsed)}ms`);
    }

    // Always log a breadcrumb for traceability (but not too verbose for fast calls)
    if (elapsed > 200) {
      lr?.captureBreadcrumb?.({
        category: "invoke",
        message: `invoke:${cmd}`,
        data: { elapsedMs: Math.round(elapsed) },
      });
    }

    return result;
  } catch (err) {
    const elapsed = performance.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    console.error(`[ipc] invoke error: ${cmd} after ${Math.round(elapsed)}ms — ${errorMsg}`);

    lr?.captureBreadcrumb?.({
      category: "invoke",
      message: `invoke:error`,
      data: {
        cmd,
        elapsedMs: Math.round(elapsed),
        error: errorMsg,
        args: sanitizeArgs(args),
      },
    });

    lr?.captureException?.(err instanceof Error ? err : new Error(errorMsg), {
      extra: { cmd, args: sanitizeArgs(args), elapsedMs: Math.round(elapsed) },
    });

    throw err;
  }
}

/**
 * Strip sensitive fields (passwords, tokens, keys) from args before logging.
 */
function sanitizeArgs(args?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!args) return undefined;
  const sensitiveKeys = ["password", "token", "key", "secret", "authorization", "code"];
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    sanitized[k] = sensitiveKeys.some((s) => k.toLowerCase().includes(s))
      ? "***"
      : typeof v === "string"
        ? v.slice(0, 100)
        : v;
  }
  return sanitized;
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
  return Promise.race([
    invoke<T>(cmd, args),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        const lr = getLR();
        lr?.captureBreadcrumb?.({
          category: "invoke",
          message: "invoke:timeout",
          data: { cmd, timeoutMs: ms, args: sanitizeArgs(args) },
        });
        reject(new Error(`${cmd} timed out after ${ms}ms`));
      }, ms),
    ),
  ]);
}

// ── Analytics helpers ────────────────────────────────────────────────

/**
 * Track a user interaction event to LogRocket.
 * Safe to call even before LogRocket is initialized — will no-op silently.
 */
export function trackEvent(category: string, action: string, data?: Record<string, unknown>): void {
  const lr = getLR();
  lr?.captureBreadcrumb?.({
    category,
    message: `${category}:${action}`,
    data: data ? sanitizeArgs(data) : undefined,
  });
}

/**
 * Track a keyboard shortcut being pressed.
 */
export function trackShortcut(shortcut: string): void {
  trackEvent("shortcut", shortcut);
}

/**
 * Track a settings toggle being changed.
 */
export function trackSetting(setting: string, enabled: boolean): void {
  trackEvent("setting", `${setting}:${enabled ? "enabled" : "disabled"}`, { setting, enabled });
}

/**
 * Track a page view for page-level components.
 */
export function trackPageView(page: string): void {
  const lr = getLR();
  lr?.captureBreadcrumb?.({
    category: "page",
    message: `page:${page}`,
  });
}
