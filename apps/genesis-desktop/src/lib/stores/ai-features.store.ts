// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { browser } from "$app/environment";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { writable, get } from "svelte/store";

// ── Types ───────────────────────────────────────────────────────────────────

export type AiFeatureId =
  | "smartSuggestions"
  | "journalPrompts"
  | "noteSummarization"
  | "taskBreakdown"
  | "moodInsights"
  | "habitRecommendations";

export interface AiFeature {
  id: AiFeatureId;
  label: string;
  description: string;
}

export interface AiFeaturesPrefs {
  enabled: boolean;
  features: Record<AiFeatureId, boolean>;
  systemPrompt: string;
}

export interface AiProviderStatus {
  provider: string;
  displayName: string;
  isConfigured: boolean;
  requiresKey: boolean;
  hasKey: boolean;
  isActive: boolean;
  defaultBaseUrl: string;
}

export interface McpConnectionInfo {
  url: string;
  token: string;
  name: string;
  version: string;
  port: number;
}

/**
 * Partial patch type sent to save_ai_features_prefs.
 * Every field is optional — only provided fields are updated.
 */
export interface AiFeaturesPrefsPatch {
  enabled?: boolean;
  features?: Record<string, boolean>;
  systemPrompt?: string;
}

// ── Defaults (mirrors Rust defaults) ────────────────────────────────────────

export const defaultPrefs: AiFeaturesPrefs = {
  enabled: true,
  features: {
    smartSuggestions: true,
    journalPrompts: true,
    noteSummarization: true,
    taskBreakdown: true,
    moodInsights: true,
    habitRecommendations: false,
  },
  systemPrompt:
    "You are Bento, a helpful AI assistant integrated into a personal productivity app. " +
    "Be concise, practical, and warm. Use the user's data context when available to provide personalized suggestions.",
};

export const allFeatures: AiFeature[] = [
  {
    id: "smartSuggestions",
    label: "Smart Suggestions",
    description: "AI-powered task and note suggestions as you work",
  },
  {
    id: "journalPrompts",
    label: "Journal Prompts",
    description: "Reflective writing prompts based on your mood and activity",
  },
  {
    id: "noteSummarization",
    label: "Note Summarization",
    description: "Summarize long notes into concise bullet points",
  },
  {
    id: "taskBreakdown",
    label: "Task Breakdown",
    description: "Break complex tasks into manageable subtasks automatically",
  },
  {
    id: "moodInsights",
    label: "Mood Insights",
    description: "Identify patterns and trends in your mood logs",
  },
  {
    id: "habitRecommendations",
    label: "Habit Recommendations",
    description: "Suggest new habits based on your routines",
  },
];

// ── Persistence via Rust settings.json ───────────────────────────────────────

/** Track the last-saved snapshot to compute diffs */
let lastSavedSnapshot: AiFeaturesPrefs | null = null;

async function loadPrefs(): Promise<AiFeaturesPrefs> {
  if (!browser || !isTauri()) {
    // SSR / browser-only fallback: use localStorage
    try {
      const raw = window.localStorage.getItem("bento_ai_features_prefs");
      if (!raw) return defaultPrefs;
      const parsed = JSON.parse(raw) as Partial<AiFeaturesPrefs>;
      return {
        ...defaultPrefs,
        ...parsed,
        features: { ...defaultPrefs.features, ...parsed.features },
      };
    } catch {
      return defaultPrefs;
    }
  }

  try {
    const prefs = await invoke<AiFeaturesPrefs>("load_ai_features_prefs");
    lastSavedSnapshot = prefs;
    return prefs;
  } catch (e) {
    console.warn("[AiFeatures] Failed to load prefs from Rust backend:", e);
    return defaultPrefs;
  }
}

/**
 * Compute a minimal patch — only send fields that actually changed
 * since the last save. This avoids sending the full 6-feature map
 * when only one toggle was flipped.
 */
function computePatch(prefs: AiFeaturesPrefs): AiFeaturesPrefsPatch {
  const patch: AiFeaturesPrefsPatch = {};

  if (!lastSavedSnapshot) {
    // First save — send everything
    patch.enabled = prefs.enabled;
    patch.features = prefs.features as Record<string, boolean>;
    patch.systemPrompt = prefs.systemPrompt;
    return patch;
  }

  if (prefs.enabled !== lastSavedSnapshot.enabled) {
    patch.enabled = prefs.enabled;
  }

  // Diff the features map — only send changed keys
  const changedFeatures: Record<string, boolean> = {};
  for (const key of Object.keys({ ...prefs.features, ...lastSavedSnapshot.features })) {
    const k = key as keyof typeof prefs.features;
    if (prefs.features[k] !== lastSavedSnapshot.features[k]) {
      changedFeatures[key] = prefs.features[k];
    }
  }
  if (Object.keys(changedFeatures).length > 0) {
    patch.features = changedFeatures;
  }

  if (prefs.systemPrompt !== lastSavedSnapshot.systemPrompt) {
    patch.systemPrompt = prefs.systemPrompt;
  }

  return patch;
}

async function savePrefs(prefs: AiFeaturesPrefs): Promise<void> {
  if (!browser || !isTauri()) {
    // SSR / browser-only fallback: use localStorage
    try {
      window.localStorage.setItem("bento_ai_features_prefs", JSON.stringify(prefs));
    } catch {
      // Storage full — silently ignore
    }
    return;
  }

  try {
    const patch = computePatch(prefs);
    // Skip save if nothing changed
    if (Object.keys(patch).length === 0) return;

    await invoke<AiFeaturesPrefs>("save_ai_features_prefs", { patch });
    lastSavedSnapshot = { ...prefs };
  } catch (e) {
    console.warn("[AiFeatures] Failed to save prefs to Rust backend:", e);
  }
}

// ── Svelte Stores ───────────────────────────────────────────────────────────

export const aiFeaturesPrefs = writable<AiFeaturesPrefs>(defaultPrefs);
export const aiProviderStatuses = writable<AiProviderStatus[]>([]);
export const aiStatusLoading = writable(false);
export const mcpConnectionInfo = writable<McpConnectionInfo | null>(null);
export const mcpLoading = writable(false);
export const aiPrefsLoading = writable(true);

// Initialize: load from Rust backend on mount
let initialized = false;
export async function initAiFeaturesPrefs(): Promise<AiFeaturesPrefs> {
  if (initialized) return get(aiFeaturesPrefs);
  const prefs = await loadPrefs();
  aiFeaturesPrefs.set(prefs);
  aiPrefsLoading.set(false);
  initialized = true;
  return prefs;
}

/** Persist timer tracking */
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Flush any pending save immediately.
 * Returns a promise that resolves once the save completes.
 * Call this before app close / component destroy.
 */
export async function flushPendingAiPrefsSave(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
    await savePrefs(get(aiFeaturesPrefs));
  }
}

/** Expose whether there are unsaved changes */
export const aiPrefsDirty = writable(false);

// Subscribe to persist changes (debounced via Rust backend save)
aiFeaturesPrefs.subscribe((prefs) => {
  if (!initialized) return;

  // Check if there are unsaved changes
  const patch = computePatch(prefs);
  aiPrefsDirty.set(Object.keys(patch).length > 0);

  // Debounce saves to avoid thrashing the Rust backend on rapid toggles
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void savePrefs(prefs);
  }, 400);
});

// ── Async helpers ───────────────────────────────────────────────────────────

function isAvailable() {
  return browser && isTauri();
}

export async function refreshAiProviderStatus(): Promise<AiProviderStatus[]> {
  if (!isAvailable()) return [];
  aiStatusLoading.set(true);
  try {
    const statuses = await invoke<AiProviderStatus[]>("get_ai_provider_status");
    aiProviderStatuses.set(statuses);
    return statuses;
  } catch (e) {
    console.warn("[AiFeatures] Failed to load provider status:", e);
    return [];
  } finally {
    aiStatusLoading.set(false);
  }
}

export async function refreshMcpConnection(): Promise<McpConnectionInfo | null> {
  if (!isAvailable()) return null;
  mcpLoading.set(true);
  try {
    const info = await invoke<McpConnectionInfo>("get_mcp_connection_info");
    mcpConnectionInfo.set(info);
    return info;
  } catch {
    mcpConnectionInfo.set(null);
    return null;
  } finally {
    mcpLoading.set(false);
  }
}

export async function fetchModelsForProvider(provider: string): Promise<string[]> {
  if (!isAvailable()) return [];
  try {
    return await invoke<string[]>("list_ai_models", { providerName: provider });
  } catch {
    return [];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getAiFeaturesSnapshot(): AiFeaturesPrefs {
  return get(aiFeaturesPrefs);
}

/** Update prefs (synchronous — store update triggers debounced persist) */
export function updateAiFeatures(patch: Partial<AiFeaturesPrefs>): void {
  aiFeaturesPrefs.update((current) => ({ ...current, ...patch }));
}

export function toggleAiFeature(featureId: AiFeatureId, enabled: boolean): void {
  aiFeaturesPrefs.update((current) => ({
    ...current,
    features: { ...current.features, [featureId]: enabled },
  }));
}

export function updateSystemPrompt(prompt: string): void {
  aiFeaturesPrefs.update((current) => ({ ...current, systemPrompt: prompt }));
}

export function resetSystemPrompt(): void {
  aiFeaturesPrefs.update((current) => ({ ...current, systemPrompt: defaultPrefs.systemPrompt }));
}
