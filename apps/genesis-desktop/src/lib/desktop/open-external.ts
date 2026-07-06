import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";

/** Timeout for the open_external_url invoke — avoids hanging if the Rust backend stalls. */
const INVOKE_TIMEOUT_MS = 10_000;

async function invokeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`"${label}" timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([fn(), timeout]);
}

export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Only http(s) URLs can be opened externally.");
  }

  if (browser && "__TAURI_INTERNALS__" in window) {
    await invokeWithTimeout(
      () => invoke("open_external_url", { url }),
      INVOKE_TIMEOUT_MS,
      "open_external_url",
    );
    return;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.href = url;
  }
}
