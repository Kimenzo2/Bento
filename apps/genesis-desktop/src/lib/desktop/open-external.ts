import { browser } from '$app/environment';
import { invoke } from '@tauri-apps/api/core';

export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Only http(s) URLs can be opened externally.');
  }

  if (browser && '__TAURI_INTERNALS__' in window) {
    await invoke('open_external_url', { url });
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.href = url;
  }
}
