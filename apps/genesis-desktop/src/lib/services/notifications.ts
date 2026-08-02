// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";

let _permissionCache: boolean | null = null;
let _lastPermissionCheck = 0;
const PERMISSION_CACHE_TTL_MS = 60_000;

export async function isNotificationPermissionGranted(forceRefresh = false): Promise<boolean> {
  if (!isTauri()) return false;
  if (!forceRefresh && _permissionCache !== null && (Date.now() - _lastPermissionCheck) < PERMISSION_CACHE_TTL_MS) {
    return _permissionCache;
  }
  try {
    const granted = await invoke<boolean>("check_notification_permission");
    _permissionCache = granted;
    _lastPermissionCheck = Date.now();
    return granted;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const granted = await invoke<boolean>("request_notification_permission_cmd");
    _permissionCache = granted;
    _lastPermissionCheck = Date.now();
    return granted;
  } catch (e) {
    console.warn("[notifications] Permission request failed:", e);
    return false;
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isNotificationPermissionGranted()) return true;
  return requestNotificationPermission();
}

export async function sendNativeNotification(title: string, body: string): Promise<void> {
  if (!isTauri() || !(await ensureNotificationPermission())) return;
  const { sendNotification } = await import("@tauri-apps/plugin-notification");
  sendNotification({ title, body });
}

export async function sendTestNotification(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await invoke("send_test_notification");
    return true;
  } catch (e) {
    console.warn("[notifications] Test notification failed:", e);
    return false;
  }
}
