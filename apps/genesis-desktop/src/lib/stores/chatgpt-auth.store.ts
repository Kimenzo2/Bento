import { browser } from "$app/environment";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { writable } from "svelte/store";

export interface DeviceFlowInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface ChatGptSession {
  serverUrl: string;
  sessionId: string;
  token: string;
  plan: string;
  createdAt: number;
  expiresAt: number;
}

export interface PlanInfo {
  plan: string;
  name: string;
  tier: string;
  description: string;
  models: string[];
  maxTokens: number;
  rateLimit: { requestsPerMinute: number };
  sessionExpiresAt: number;
  activeModel: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
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
  } catch { /* storage full or unavailable */ }
}

export function validateServerUrl(url: string): string | null {
  if (!url || !url.trim()) return "Server URL is required";
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return "URL must start with http:// or https://";
    if (!parsed.hostname) return "Invalid hostname";
    if (parsed.protocol === "http:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
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
  verificationUriComplete: string | null;
  expiresAt: number;
} | null>(null);
export const chatgptPlanInfo = writable<PlanInfo | null>(null);

// Persist server URL on writes
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
      loadPlanInfo();
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
    verificationUri: flow.verificationUri,
    verificationUriComplete: flow.verificationUriComplete ?? null,
    expiresAt: Date.now() + flow.expiresIn * 1000,
  });
  return flow;
}

export interface PollResult {
  status: string;
  interval?: number;
}

export async function pollDeviceFlow(
  deviceCode: string,
  serverUrl: string,
): Promise<{ approved: boolean; interval?: number }> {
  if (!isAvailable()) return { approved: false };
  const result = await invoke<PollResult>("chatgpt_check_device_flow", {
    deviceCode,
    serverUrl,
  });
  if (result.status === "approved") {
    chatgptDeviceFlow.set(null);
    await loadChatGptSession();
    return { approved: true };
  }
  if (result.status === "slow_down") {
    return { approved: false, interval: result.interval };
  }
  return { approved: false };
}

export async function signOut(): Promise<void> {
  if (!isAvailable()) return;
  await invoke("chatgpt_sign_out");
  chatgptSession.set(null);
  chatgptPlanInfo.set(null);
}

export async function loadPlanInfo(): Promise<PlanInfo | null> {
  if (!isAvailable()) return null;
  try {
    const info = await invoke<PlanInfo>("chatgpt_get_plan_info");
    chatgptPlanInfo.set(info);
    return info;
  } catch {
    return null;
  }
}

export async function testConnection(serverUrl: string): Promise<ConnectionTestResult> {
  if (!isAvailable()) {
    return { ok: false, error: "Not in Tauri environment", latencyMs: null };
  }
  return invoke<ConnectionTestResult>("chatgpt_test_connection", { serverUrl });
}

// ── Shared UI helpers ─────────────────────────────────────────────────

/** Open a URL via Tauri's openUrl, falling back to window.open. */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

/** Copy text to clipboard with a short-lived success state. */
export function copyToClipboard(
  text: string,
  onCopied: () => void,
): void {
  navigator.clipboard.writeText(text).then(onCopied).catch(() => {});
}

/** True when a timestamp is in the past. */
export function isExpired(ts: number): boolean {
  return Date.now() >= ts;
}

/**
 * Get the best URI to open for device code verification.
 * Prefers verification_uri_complete (which pre-fills the code) over the plain URI.
 */
export function getVerificationUri(flow: {
  verificationUri: string;
  verificationUriComplete: string | null;
}): string {
  return flow.verificationUriComplete ?? flow.verificationUri;
}

export function formatExpiry(expiresAt: number | undefined | null): string {
  if (expiresAt == null) return "N/A";
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  if (remaining < 60000) return "<1m";
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** True when the session is within 5 minutes of expiry. */
export function isNearExpiry(expiresAt: number): boolean {
  const remaining = expiresAt - Date.now();
  return remaining > 0 && remaining < 300000;
}

/**
 * Start polling a device code flow with RFC 8628 compliance.
 * Handles expiry, slow_down, and cleanup automatically.
 * Returns a cleanup function to stop polling.
 *
 * @param deviceCode - The device code to poll
 * @param serverUrl - The server URL
 * @param intervalSec - Polling interval from server (seconds)
 * @param expiresAt - Timestamp when the device code expires
 * @param onError - Callback for polling errors
 * @param onExpired - Callback when device code expires
 */
export function startDeviceFlowPolling(
  deviceCode: string,
  serverUrl: string,
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
      const result = await pollDeviceFlow(deviceCode, serverUrl);
      if (result.approved) {
        cleanup();
      } else if (result.interval) {
        currentIntervalMs = Math.min(result.interval * 1000, 30000);
        restartPolling();
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
