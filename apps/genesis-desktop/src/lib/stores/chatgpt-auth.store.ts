import { browser } from "$app/environment";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { writable } from "svelte/store";

export interface DeviceFlowInfo {
  userCode: string;
  verificationUrl: string;
  interval: number;
  expiresAt: number;
}

export interface ChatGptUserInfo {
  accountId: string;
  email?: string;
  name?: string;
  plan?: string;
}

export interface ChatGptSession {
  serverUrl: string;
  user: ChatGptUserInfo | null;
  status: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
}

export interface PollResult {
  status: string;
}

const DEFAULT_SERVER_URL = "http://localhost:3001";
const SERVER_URL_KEY = "bento:chatgpt-server-url";

function loadSavedServerUrl(): string {
  if (typeof localStorage === "undefined") return DEFAULT_SERVER_URL;
  try {
    return localStorage.getItem(SERVER_URL_KEY) || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

function saveServerUrl(url: string): void {
  try {
    localStorage.setItem(SERVER_URL_KEY, url);
  } catch {
    /* storage full or unavailable */
  }
}

export function validateServerUrl(url: string): string | null {
  if (!url || !url.trim()) return "Server URL is required";
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol))
      return "URL must start with http:// or https://";
    if (!parsed.hostname) return "Invalid hostname";
    if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      return "Warning: Using HTTP (not HTTPS) is insecure for remote servers";
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

export const chatgptSession = writable<ChatGptSession | null>(null);
export const chatgptReady = writable(false);
export const chatgptServerUrl = writable(loadSavedServerUrl());
export const chatgptDeviceFlow = writable<{
  userCode: string;
  verificationUri: string;
  expiresAt: number;
} | null>(null);

chatgptServerUrl.subscribe((url) => {
  if (url) saveServerUrl(url);
});

function isAvailable() {
  return browser && isTauri();
}

export async function loadChatGptSession(): Promise<ChatGptSession | null> {
  if (!isAvailable()) return null;
  try {
    const session = await invoke<ChatGptSession | null>("chatgpt_get_session");
    chatgptSession.set(session);
    chatgptReady.set(true);
    if (session) {
      // Sync auto-detected server URL to frontend store
      if (session.serverUrl) {
        chatgptServerUrl.set(session.serverUrl);
      }
    }
    return session;
  } catch {
    chatgptSession.set(null);
    chatgptReady.set(true);
    return null;
  }
}

export async function startDeviceFlow(serverUrl: string): Promise<DeviceFlowInfo> {
  if (!isAvailable()) throw new Error("Not in Tauri environment");

  const flow = await invoke<DeviceFlowInfo>("chatgpt_start_device_flow", { serverUrl });
  chatgptDeviceFlow.set({
    userCode: flow.userCode,
    verificationUri: flow.verificationUrl,
    expiresAt: flow.expiresAt,
  });
  return flow;
}

export async function pollDeviceFlow(): Promise<PollResult> {
  if (!isAvailable()) return { status: "error" };
  try {
    return await invoke<PollResult>("chatgpt_check_device_flow");
  } catch (e) {
    return { status: "error" };
  }
}

export async function signOut(): Promise<void> {
  if (!isAvailable()) return;
  await invoke("chatgpt_sign_out");
  chatgptSession.set(null);
}

export async function testConnection(serverUrl: string): Promise<ConnectionTestResult> {
  if (!isAvailable()) {
    return { ok: false, error: "Not in Tauri environment", latencyMs: null };
  }
  return invoke<ConnectionTestResult>("chatgpt_test_connection", { serverUrl });
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

export function copyToClipboard(text: string, onCopied: () => void): void {
  navigator.clipboard
    .writeText(text)
    .then(onCopied)
    .catch(() => {});
}

export function isExpired(ts: number): boolean {
  return Date.now() >= ts;
}

export function getVerificationUri(flow: { verificationUri: string }): string {
  return flow.verificationUri;
}

export function formatExpiry(expiresAt: number | undefined | null): string {
  if (expiresAt == null || expiresAt <= 0) return "N/A";
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  if (remaining < 60000) return "<1m";
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function startDeviceFlowPolling(
  intervalSec: number,
  expiresAt: number,
  onError: (msg: string) => void,
  onExpired: () => void,
): () => void {
  let currentIntervalMs = Math.max(intervalSec * 1000, 3000);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const poll = async () => {
    if (Date.now() >= expiresAt) {
      cleanup();
      onExpired();
      return;
    }

    try {
      const result = await pollDeviceFlow();
      if (result.status === "authenticated") {
        cleanup();
        await loadChatGptSession();
      } else if (result.status === "expired") {
        cleanup();
        onExpired();
      }
    } catch {
      cleanup();
      onError("Polling failed. Please sign in again.");
    }
  };

  const cleanup = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    chatgptDeviceFlow.set(null);
  };

  const restartPolling = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(poll, currentIntervalMs);
  };

  intervalId = setInterval(poll, currentIntervalMs);
  return cleanup;
}
