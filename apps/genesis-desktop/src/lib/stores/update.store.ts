import { writable } from 'svelte/store';

export type UpdateState = {
  available: null | {
    version: string;
    body?: string;
  };
  checking: boolean;
  installing: boolean;
  // ── Download progress (mirrors Anytype's DownloadProgress shape) ──
  // Anytype: { bytesPerSecond, percent, transferred, total }
  // Tauri:   Started → contentLength, Progress → chunkLength (accumulated here)
  downloadedBytes: number; // accumulated chunk bytes (transferred)
  totalBytes: number; // from Tauri's Started event (total)
  downloadPercent: number; // 0–100, computed
  downloadSpeed: number; // bytes/sec, computed from timing
};

export const updateStore = writable<UpdateState>({
  available: null,
  checking: false,
  installing: false,
  downloadedBytes: 0,
  totalBytes: 0,
  downloadPercent: 0,
  downloadSpeed: 0,
});

export function setUpdateChecking(checking: boolean) {
  updateStore.update((s) => ({ ...s, checking }));
}

export function setAvailableUpdate(update: UpdateState['available']) {
  updateStore.update((s) => ({ ...s, available: update }));
}

export function setInstallingUpdate(installing: boolean) {
  updateStore.update((s) => ({ ...s, installing }));
}

// Called on Tauri's "Started" event — sets total content length
export function setDownloadTotal(totalBytes: number) {
  updateStore.update((s) => ({
    ...s,
    totalBytes,
    downloadedBytes: 0,
    downloadPercent: 0,
    downloadSpeed: 0,
  }));
}

// Called on Tauri's "Progress" event — accumulates chunk, computes % and speed
export function setDownloadProgress(chunkLength: number, elapsedMs: number) {
  updateStore.update((s) => {
    const downloaded = s.downloadedBytes + chunkLength;
    const percent =
      s.totalBytes > 0 ? Math.min(Math.round((downloaded / s.totalBytes) * 100), 100) : 0;
    // speed = bytes downloaded this chunk / elapsed seconds for this chunk
    const speed = elapsedMs > 0 ? Math.round((chunkLength / elapsedMs) * 1000) : 0;
    return {
      ...s,
      downloadedBytes: downloaded,
      downloadPercent: percent,
      downloadSpeed: speed,
    };
  });
}

// Legacy compat — still used in UpdateNotification for simple chunk tracking
export function setDownloadedBytes(downloadedBytes: number) {
  updateStore.update((s) => ({ ...s, downloadedBytes }));
}

export function resetDownloadProgress() {
  updateStore.update((s) => ({
    ...s,
    downloadedBytes: 0,
    totalBytes: 0,
    downloadPercent: 0,
    downloadSpeed: 0,
  }));
}
