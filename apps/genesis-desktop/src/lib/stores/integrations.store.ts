// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { writable, derived, type Readable } from "svelte/store";

export type AuthType = "managed_oauth" | "api_key" | "custom_oauth" | "mixed" | "no_auth" | "native" | "unavailable";

export type NativeFlow = "oauth2" | "api_key" | "token" | "basic";

export interface AppDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  icon_key: string;
  auth_type: AuthType;
  native_flow?: NativeFlow | null;
}

export interface IntegrationAppEntry {
  app: AppDefinition;
  connected: boolean;
}

export interface IntegrationConnection {
  id: string;
  app_key: string;
  status: "Connected" | "Connecting" | "Disconnected" | { Error: string };
  created_at_ms: number;
}

export interface IntegrationApiKeyStatus {
  has_key: boolean;
  key_preview: string | null;
}

export interface CategoryEntry {
  id: string;
  label: string;
  count: number;
}

export interface IntegrationTool {
  slug: string;
  name?: string | null;
  description?: string | null;
  toolkit_slug?: string | null;
}

// ── Writable stores ───────────────────────────────────────

export const apiKeyStatus = writable<IntegrationApiKeyStatus>({
  has_key: false,
  key_preview: null,
});

export const categories = writable<CategoryEntry[]>([]);
export const apps = writable<IntegrationAppEntry[]>([]);
export const connections = writable<IntegrationConnection[]>([]);
export const selectedCategory = writable<string | null>(null);

export const loading = writable(false);
export const error = writable<string | null>(null);
export const success = writable<string | null>(null);

// ── Actions ───────────────────────────────────────────────

export async function loadCategories(): Promise<void> {
  if (!isTauri()) return;
  try {
    const result = await invoke<CategoryEntry[]>("get_integration_categories");
    categories.set(result ?? []);
  } catch (e) {
    console.error("[integrations] Failed to load categories:", e);
  }
}

export async function loadApps(category?: string | null): Promise<void> {
  if (!isTauri()) return;
  loading.set(true);
  try {
    const activeCat = category !== undefined ? category : get(selectedCategory);
    const result = await invoke<IntegrationAppEntry[]>("list_integration_apps", {
      category: activeCat ?? null,
    });
    apps.set(result ?? []);
  } catch (e) {
    console.error("[integrations] Failed to load apps:", e);
  } finally {
    loading.set(false);
  }
}

function get<T>(store: ReturnType<typeof writable<T>>): T {
  let val: T;
  store.subscribe((v) => (val = v))();
  return val!;
}

export async function loadConnections(): Promise<void> {
  if (!isTauri()) return;
  try {
    const result = await invoke<IntegrationConnection[]>("get_integration_connections");
    connections.set(result ?? []);
  } catch (e) {
    console.error("[integrations] Failed to load connections:", e);
  }
}

export async function loadApiKeyStatus(): Promise<void> {
  if (!isTauri()) return;
  try {
    const result = await invoke<IntegrationApiKeyStatus>("get_composio_api_key_status");
    apiKeyStatus.set(result);
  } catch (e) {
    console.error("[integrations] Failed to load API key status:", e);
  }
}

export async function saveComposioApiKey(key: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await invoke("save_composio_api_key", { apiKey: key });
    await loadApiKeyStatus();
    return true;
  } catch (e) {
    console.error("[integrations] Failed to save API key:", e);
    throw e;
  }
}

export async function deleteComposioApiKey(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("delete_composio_api_key");
    await loadApiKeyStatus();
  } catch (e) {
    console.error("[integrations] Failed to delete API key:", e);
    throw e;
  }
}

export async function testComposioConnection(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>("test_composio_connection");
  } catch (e) {
    console.error("[integrations] Connection test failed:", e);
    throw e;
  }
}

export async function connectApp(appKey: string, creds?: { apiKey?: string; clientId?: string; clientSecret?: string; token?: string; username?: string; password?: string }): Promise<void> {
  if (!isTauri()) return;
  error.set(null);
  try {
    await invoke("connect_integration", {
      appKey,
      apiKey: creds?.apiKey ?? null,
      clientId: creds?.clientId ?? null,
      clientSecret: creds?.clientSecret ?? null,
      token: creds?.token ?? null,
      username: creds?.username ?? null,
      password: creds?.password ?? null,
    });
    await loadConnections();
    await loadApps();
  } catch (e) {
    const msg = typeof e === "string" ? e : String(e);
    error.set(msg);
    throw e;
  }
}

export async function cancelIntegrationFlow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("cancel_integration_flow");
  } catch (e) {
    console.error("[integrations] Failed to cancel flow:", e);
  }
}

export async function disconnectApp(appKey: string): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("disconnect_integration", { appKey });
    await loadConnections();
    await loadApps();
  } catch (e) {
    const msg = typeof e === "string" ? e : String(e);
    error.set(msg);
    throw e;
  }
}

export async function listAppActions(appKey: string): Promise<IntegrationTool[]> {
  if (!isTauri()) return [];
  try {
    const result = await invoke<IntegrationTool[]>("list_integration_actions", { appKey });
    return result ?? [];
  } catch (e) {
    console.error(`[integrations] Failed to list actions for ${appKey}:`, e);
    throw e;
  }
}

export async function executeAppAction(
  appKey: string,
  actionName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (!isTauri()) return null;
  try {
    return await invoke("execute_integration_action", {
      params: { appKey, actionName, input },
    });
  } catch (e) {
    const msg = typeof e === "string" ? e : String(e);
    error.set(msg);
    throw e;
  }
}

export async function loadAll(): Promise<void> {
  if (!isTauri()) {
    loading.set(false);
    error.set("Integrations require the Bento Desktop app.");
    return;
  }
  await Promise.all([
    loadCategories(),
    loadApps(null),
    loadConnections(),
    loadApiKeyStatus(),
  ]);
}

export const connectedAppKeys: Readable<Set<string>> = derived(
  connections,
  ($conns) => new Set($conns.filter((c) => c.status === "Connected").map((c) => c.app_key)),
);
