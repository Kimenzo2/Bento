import { browser } from "$app/environment";

/** Detect whether the app is running inside a Tauri webview. */
async function detectTauri(): Promise<boolean> {
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    return isTauri();
  } catch {
    return false;
  }
}

/** Open a URL using the Tauri opener plugin. Returns true on success. */
async function openViaPlugin(url: string): Promise<boolean> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return true;
  } catch {
    return false;
  }
}

/** Open a URL via the Rust open_external_url command. Returns true on success. */
async function openViaRustBridge(url: string): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url });
    return true;
  } catch {
    return false;
  }
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
