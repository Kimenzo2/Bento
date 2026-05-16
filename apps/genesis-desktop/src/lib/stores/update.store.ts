import { writable } from "svelte/store";

export type UpdateState = {
  available: null | {
    version: string;
    body?: string;
  };
  checking: boolean;
  installing: boolean;
  downloadedBytes: number;
};

export const updateStore = writable<UpdateState>({
  available: null,
  checking: false,
  installing: false,
  downloadedBytes: 0,
});

export function setUpdateChecking(checking: boolean) {
  updateStore.update((state) => ({ ...state, checking }));
}

export function setAvailableUpdate(update: UpdateState["available"]) {
  updateStore.update((state) => ({ ...state, available: update }));
}

export function setInstallingUpdate(installing: boolean) {
  updateStore.update((state) => ({ ...state, installing }));
}

export function setDownloadedBytes(downloadedBytes: number) {
  updateStore.update((state) => ({ ...state, downloadedBytes }));
}
