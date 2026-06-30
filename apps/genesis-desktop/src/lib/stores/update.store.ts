import { writable, get } from 'svelte/store';

const DISMISSED_KEY = 'bento:update:dismissed';

export type UpdateState = {
  available: null | {
    version: string;
    body?: string;
  };
  checking: boolean;
  installing: boolean;
  showPanel: boolean;
  downloadedBytes: number;
  totalBytes: number;
  downloadPercent: number;
  downloadSpeed: number;
};

export const updateStore = writable<UpdateState>({
  available: null,
  checking: false,
  installing: false,
  showPanel: false,
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

export function showUpdatePanel() {
  updateStore.update((s) => ({ ...s, showPanel: true }));
}

export function hideUpdatePanel() {
  updateStore.update((s) => ({ ...s, showPanel: false }));
}

export function setDownloadTotal(totalBytes: number) {
  updateStore.update((s) => ({
    ...s,
    totalBytes,
    downloadedBytes: 0,
    downloadPercent: 0,
    downloadSpeed: 0,
  }));
}

export function setDownloadProgress(chunkLength: number, elapsedMs: number) {
  updateStore.update((s) => {
    const downloaded = s.downloadedBytes + chunkLength;
    const percent =
      s.totalBytes > 0 ? Math.min(Math.round((downloaded / s.totalBytes) * 100), 100) : 0;
    const speed = elapsedMs > 0 ? Math.round((chunkLength / elapsedMs) * 1000) : 0;
    return {
      ...s,
      downloadedBytes: downloaded,
      downloadPercent: percent,
      downloadSpeed: speed,
    };
  });
}

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

export function getDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function setDismissedVersion(version: string | null) {
  try {
    if (version) {
      localStorage.setItem(DISMISSED_KEY, version);
    } else {
      localStorage.removeItem(DISMISSED_KEY);
    }
  } catch {
    // localStorage unavailable — non-critical
  }
}
