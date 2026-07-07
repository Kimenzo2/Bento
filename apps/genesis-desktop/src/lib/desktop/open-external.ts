import { browser } from "$app/environment";

/** Timeout for each open-via-plugin / open-via-bridge attempt. */
const IPC_TIMEOUT_MS = 5_000;

/** Detect whether the app is running inside a Tauri webview. */
async function detectTauri(): Promise<boolean> {
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    return isTauri();
  } catch {
    return false;
  }
}

/**
 * Open a URL using the Tauri opener plugin (JS bridge).
 * Retries up to 2 times on failure for transient errors.
 * Each attempt is raced with a 5s timeout to prevent the IPC call
 * from hanging indefinitely (e.g. ShellExecuteW on Windows can
 * block when the default browser is slow or misconfigured).
 */
async function openViaPlugin(url: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await Promise.race([
        openUrl(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`openUrl timed out after ${IPC_TIMEOUT_MS}ms`)), IPC_TIMEOUT_MS),
        ),
      ]);
      if (attempt > 1) {
        console.log(`[open-external] plugin succeeded on attempt ${attempt}`);
      }
      return true;
    } catch (err) {
      console.error(`[open-external] plugin attempt ${attempt}/2 failed:`, err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  return false;
}

/**
 * Open a URL via the Rust open_external_url command (backend fallback).
 * Retries up to 2 times on failure.
 * Each attempt is raced with a 5s timeout, same as the plugin path.
 */
async function openViaRustBridge(url: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await Promise.race([
        invoke("open_external_url", { url }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`invoke timed out after ${IPC_TIMEOUT_MS}ms`)), IPC_TIMEOUT_MS),
        ),
      ]);
      if (attempt > 1) {
        console.log(`[open-external] bridge succeeded on attempt ${attempt}`);
      }
      return true;
    } catch (err) {
      console.error(`[open-external] bridge attempt ${attempt}/2 failed:`, err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  return false;
}

export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Only http(s) URLs can be opened externally.");
  }

  if (browser) {
    const tauriRuntime = await detectTauri();

    if (tauriRuntime) {
      const pluginOk = await openViaPlugin(url);
      if (pluginOk) return;

      const bridgeOk = await openViaRustBridge(url);
      if (bridgeOk) return;

      throw new Error("Could not open the URL in the desktop runtime.");
    }
  }

  // Fallback: open in browser tab
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.href = url;
  }
}
