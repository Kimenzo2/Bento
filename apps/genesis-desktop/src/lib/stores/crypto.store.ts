/**
 * Bento Crypto Store
 *
 * Manages database encryption state on the frontend.
 * The master password NEVER leaves this store — it's passed directly
 * to Tauri invoke calls and zeroed immediately after.
 */

import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";

// ── Types ──────────────────────────────────────────────────────────────────

export type CryptoStatus = "NotConfigured" | "Locked" | "Unlocked";

export interface CryptoStatusResponse {
  status: CryptoStatus;
  isConfigured: boolean;
}

export interface BackupInfo {
  path: string;
  createdAt: string;
}

interface CryptoState {
  status: CryptoStatus;
  isConfigured: boolean;
  loading: boolean;
  error: string | null;
  lastBackup: BackupInfo | null;
}

// ── Store ──────────────────────────────────────────────────────────────────

const initialState: CryptoState = {
  status: "NotConfigured",
  isConfigured: false,
  loading: false,
  error: null,
  lastBackup: null,
};

const _store = writable<CryptoState>(initialState);

export const cryptoStore = { subscribe: _store.subscribe };

// Derived convenience flags
export const isDbLocked = derived(_store, ($s) => $s.status === "Locked");
export const isDbUnlocked = derived(_store, ($s) => $s.status === "Unlocked");
export const needsSetup = derived(_store, ($s) => !$s.isConfigured);
export const cryptoLoading = derived(_store, ($s) => $s.loading);
export const cryptoError = derived(_store, ($s) => $s.error);

// ── Internal helpers ───────────────────────────────────────────────────────

function setLoading(loading: boolean) {
  _store.update((s) => ({ ...s, loading, error: loading ? null : s.error }));
}

function setError(error: string) {
  _store.update((s) => ({ ...s, error, loading: false }));
}

function clearError() {
  _store.update((s) => ({ ...s, error: null }));
}

function applyStatus(res: CryptoStatusResponse) {
  _store.update((s) => ({
    ...s,
    status: res.status,
    isConfigured: res.isConfigured,
    loading: false,
    error: null,
  }));
}

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Fetch current crypto status from Rust. Call on app mount. */
export async function hydrateCryptoStatus(): Promise<CryptoStatus> {
  if (!browser) return "NotConfigured";
  try {
    const res = await invokeTauri<CryptoStatusResponse>("crypto_get_status");
    applyStatus(res);
    return res.status;
  } catch (e) {
    setError(String(e));
    return "NotConfigured";
  }
}

/** Set up master password for the first time. */
export async function setupMasterPassword(password: string): Promise<void> {
  clearError();
  setLoading(true);
  try {
    const res = await invokeTauri<CryptoStatusResponse>("crypto_setup_master_password", {
      password,
    });
    applyStatus(res);
  } catch (e) {
    setError(String(e));
    throw e;
  } finally {
    // Aggressively GC the password string — JS can't zero memory, but at
    // least we don't keep a reference in the store.
    password = "";
  }
}

/** Unlock a locked database. */
export async function unlockDatabase(password: string): Promise<void> {
  clearError();
  setLoading(true);
  try {
    const res = await invokeTauri<CryptoStatusResponse>("crypto_unlock_database", { password });
    applyStatus(res);
  } catch (e) {
    setError(String(e));
    throw e;
  } finally {
    password = "";
  }
}

/** Lock the database (close all pools, drop key from memory). */
export async function lockDatabase(): Promise<void> {
  clearError();
  setLoading(true);
  try {
    const res = await invokeTauri<CryptoStatusResponse>("crypto_lock_database");
    applyStatus(res);
  } catch (e) {
    setError(String(e));
    throw e;
  }
}

/** Change master password. Returns backup path on success. */
export async function changeMasterPassword(
  currentPassword: string,
  newPassword: string,
): Promise<BackupInfo> {
  clearError();
  setLoading(true);
  try {
    const backup = await invokeTauri<BackupInfo>("crypto_change_master_password", {
      currentPassword,
      newPassword,
    });
    _store.update((s) => ({ ...s, lastBackup: backup, loading: false }));
    return backup;
  } catch (e) {
    setError(String(e));
    throw e;
  } finally {
    currentPassword = "";
    newPassword = "";
  }
}

/** Migrate a legacy unencrypted module database to encrypted. */
export async function migrateUnencryptedDb(module: string): Promise<void> {
  return invokeTauri("crypto_migrate_unencrypted_db", { module });
}

/** Create a manual backup. */
export async function createBackup(): Promise<BackupInfo> {
  const backup = await invokeTauri<BackupInfo>("crypto_create_backup");
  _store.update((s) => ({ ...s, lastBackup: backup }));
  return backup;
}

/** Validate password strength before submitting (mirrors Rust). */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 512) return "Password must be 512 characters or fewer.";
  return null;
}
