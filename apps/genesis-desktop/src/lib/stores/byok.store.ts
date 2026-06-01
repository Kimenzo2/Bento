import { browser } from '$app/environment';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { get, writable } from 'svelte/store';

// ── Types ───────────────────────────────────────────────────────────────────

export type ByokProviderId = 'openai' | 'anthropic' | 'gemini' | 'grok' | 'ollama';

export interface ProviderKeyStatus {
  provider: string;
  displayName: string;
  isConfigured: boolean;
  keyPreview: string | null;
  requiresKey: boolean;
  defaultBaseUrl: string;
}

export interface ByokSettings {
  enabled: boolean;
  activeProvider: string | null;
  activeModel: string | null;
  configuredProviders: string[];
  baseUrlOverrides: Record<string, string>;
  onboardingDismissed: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
  availableModels: string[];
}

// ── Defaults ────────────────────────────────────────────────────────────────

const defaultSettings: ByokSettings = {
  enabled: false,
  activeProvider: null,
  activeModel: null,
  configuredProviders: [],
  baseUrlOverrides: {},
  onboardingDismissed: false,
};

// ── Svelte Stores ───────────────────────────────────────────────────────────

export const byokSettings = writable<ByokSettings>(defaultSettings);
export const byokProviders = writable<ProviderKeyStatus[]>([]);
export const byokReady = writable(false);
export const byokTesting = writable<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
export const byokTestResults = writable<Record<string, ConnectionTestResult>>({});

// ── Helpers ─────────────────────────────────────────────────────────────────

function isAvailable() {
  return browser && isTauri();
}

export function getByokSettingsSnapshot(): ByokSettings {
  return get(byokSettings);
}

// ── API Key Management ──────────────────────────────────────────────────────

export async function saveApiKey(provider: string, key: string): Promise<void> {
  if (!isAvailable()) return;
  await invoke('byok_save_key', { provider, key });
  await refreshProviders();
}

export async function getKeyPreview(provider: string): Promise<string | null> {
  if (!isAvailable()) return null;
  return invoke<string | null>('byok_get_key_preview', { provider });
}

export async function deleteApiKey(provider: string): Promise<void> {
  if (!isAvailable()) return;
  await invoke('byok_delete_key', { provider });
  await refreshProviders();
}

export async function testConnection(provider: string): Promise<ConnectionTestResult> {
  byokTesting.update((state) => ({ ...state, [provider]: 'testing' }));
  try {
    const result = await invoke<ConnectionTestResult>('byok_test_connection', { provider });
    byokTesting.update((state) => ({
      ...state,
      [provider]: result.ok ? 'success' : 'error',
    }));
    byokTestResults.update((state) => ({ ...state, [provider]: result }));
    return result;
  } catch (e) {
    const errorResult: ConnectionTestResult = {
      ok: false,
      error: String(e),
      latencyMs: null,
      availableModels: [],
    };
    byokTesting.update((state) => ({ ...state, [provider]: 'error' }));
    byokTestResults.update((state) => ({ ...state, [provider]: errorResult }));
    return errorResult;
  }
}

// ── Provider Listing ────────────────────────────────────────────────────────

export async function refreshProviders(): Promise<ProviderKeyStatus[]> {
  if (!isAvailable()) return [];
  const providers = await invoke<ProviderKeyStatus[]>('byok_list_providers');
  byokProviders.set(providers);
  return providers;
}

// ── Settings Management ─────────────────────────────────────────────────────

export async function loadByokSettings(): Promise<ByokSettings> {
  if (!isAvailable()) return defaultSettings;
  try {
    const settings = await invoke<ByokSettings>('byok_get_settings');
    byokSettings.set(settings);
    byokReady.set(true);
    return settings;
  } catch {
    byokSettings.set(defaultSettings);
    byokReady.set(true);
    return defaultSettings;
  }
}

export async function updateByokSettings(patch: Partial<ByokSettings>): Promise<ByokSettings> {
  if (!isAvailable()) return get(byokSettings);
  const updated = await invoke<ByokSettings>('byok_update_settings', { patch });
  byokSettings.set(updated);
  return updated;
}

export async function toggleByok(enabled: boolean): Promise<ByokSettings> {
  if (!isAvailable()) return get(byokSettings);
  const updated = await invoke<ByokSettings>('byok_toggle_enabled', { enabled });
  byokSettings.set(updated);
  return updated;
}

export async function dismissOnboarding(): Promise<void> {
  if (!isAvailable()) return;
  await invoke('byok_dismiss_onboarding');
  byokSettings.update((s) => ({ ...s, onboardingDismissed: true }));
}

export async function setActiveProvider(provider: string | null): Promise<void> {
  await updateByokSettings({ activeProvider: provider, activeModel: null });
}

export async function setActiveModel(model: string): Promise<void> {
  await updateByokSettings({ activeModel: model });
}

// ── Provider Info (static) ─────────────────────────────────────────────────

export function providerDisplayName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini (Google)',
    grok: 'Grok (xAI)',
    ollama: 'Ollama (Local)',
  };
  return names[provider] ?? provider;
}

export function providerIcon(provider: string): string {
  // Returns an icon identifier for each provider
  const icons: Record<string, string> = {
    openai: 'sparkles',
    anthropic: 'bot',
    gemini: 'star',
    grok: 'zap',
    ollama: 'server',
  };
  return icons[provider] ?? 'key';
}

export function providerColor(provider: string): string {
  const colors: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#d4a574',
    gemini: '#4285f4',
    grok: '#1da1f2',
    ollama: '#9b59b6',
  };
  return colors[provider] ?? '#666';
}

export function providerKnownModels(provider: string): string[] {
  const models: Record<string, string[]> = {
    openai: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o3',
      'o3-mini',
      'o4-mini',
    ],
    anthropic: [
      'claude-sonnet-4-20250514',
      'claude-sonnet-4',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-5',
    ],
    gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    grok: ['grok-3', 'grok-3-mini', 'grok-2'],
    ollama: [], // Dynamically fetched
  };
  return models[provider] ?? [];
}
