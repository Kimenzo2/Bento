<script lang="ts">
  import { onMount } from 'svelte';
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
  import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import Loader2Icon from '@lucide/svelte/icons/loader-2';
  import MessageSquareIcon from '@lucide/svelte/icons/message-square';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ServerIcon from '@lucide/svelte/icons/server';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import BotIcon from '@lucide/svelte/icons/bot';

  import {
    aiFeaturesPrefs,
    aiProviderStatuses,
    aiStatusLoading,
    mcpConnectionInfo,
    mcpLoading,
    aiPrefsLoading,
    aiPrefsDirty,
    defaultPrefs,
    initAiFeaturesPrefs,
    flushPendingAiPrefsSave,
    refreshAiProviderStatus,
    refreshMcpConnection,
    updateSystemPrompt,
    resetSystemPrompt,
    fetchModelsForProvider,
    type AiProviderStatus,
    type McpConnectionInfo,
  } from '$lib/stores/ai-features.store';

  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  import { byokSettings } from '$lib/stores/byok.store';
  import { providerDisplayName, providerKnownModels } from '$lib/stores/byok.store';
  import { activeBundle, createTranslator } from '$lib/i18n';
  import ChatGptAuth from '$lib/components/settings/ChatGptAuth.svelte';

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Props ──────────────────────────────────────────────────────────────────
  let { surface = 'panel' }: { surface?: 'panel' | 'page' } = $props();

  // ── State ──────────────────────────────────────────────────────────────────
  let showModelDropdown = $state(false);
  let models = $state<string[]>([]);
  let modelsLoading = $state(false);
  let copiedUrl = $state(false);
  let copiedToken = $state(false);
  let promptSavingStatus = $state<'saved' | 'saving' | 'unsaved' | ''>('');

  // ── Derivation ─────────────────────────────────────────────────────────────

  const activeProviderName = $derived($byokSettings.activeProvider);
  const activeModel = $derived($byokSettings.activeModel);

  const activeProviderStatus = $derived<AiProviderStatus | null>(
    activeProviderName
      ? ($aiProviderStatuses ?? []).find((p) => p.provider === activeProviderName) ?? null
      : null
  );

  const configuredProviderStatuses = $derived(
    ($aiProviderStatuses ?? []).filter((p) => p.isConfigured)
  );

  const hasActiveProvider = $derived(!!activeProviderName);

  const mcpUp = $derived(!!$mcpConnectionInfo);

  // Provider color dot helper
  function providerDotColor(provider: string): string {
    const colors: Record<string, string> = {
      openai: '#10a37f',
      anthropic: '#d4a574',
      gemini: '#4285f4',
      grok: '#1da1f2',
      ollama: '#9b59b6',
    };
    return colors[provider] ?? '#666';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    void initAiFeaturesPrefs();
    void refreshAiProviderStatus();
    void refreshMcpConnection();
    void loadModels();

    // Flush pending saves on window close (standard web event)
    const handleBeforeUnload = () => { void flushPendingAiPrefsSave(); };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Tauri-specific: intercept close button, flush async, then resolve
    let unlistenClose: (() => void) | undefined;
    if (isTauri()) {
      getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        await flushPendingAiPrefsSave();
      }).then((fn) => { unlistenClose = fn; });
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unlistenClose?.();
      void flushPendingAiPrefsSave();
    };
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function loadModels() {
    if (!activeProviderName) return;
    modelsLoading = true;
    try {
      const fetched = await fetchModelsForProvider(activeProviderName);
      models = fetched.length > 0 ? fetched : providerKnownModels(activeProviderName);
    } catch {
      models = providerKnownModels(activeProviderName);
    } finally {
      modelsLoading = false;
    }
  }

  // Refresh all data
  async function handleRefresh() {
    await Promise.all([
      refreshAiProviderStatus(),
      refreshMcpConnection(),
    ]);
    await loadModels();
  }

  // System prompt handlers
  function handleSystemPromptInput(value: string) {
    if (value.length > 2000) return; // enforce max length
    updateSystemPrompt(value);
    promptSavingStatus = 'unsaved';
  }

  function handleSavePrompt() {
    promptSavingStatus = 'saving';
    void flushPendingAiPrefsSave().then(() => {
      promptSavingStatus = 'saved';
      setTimeout(() => (promptSavingStatus = ''), 2500);
    });
  }

  function handleResetPrompt() {
    resetSystemPrompt();
    promptSavingStatus = '';
  }

  // Keyboard shortcut: Cmd+S / Ctrl+S to save prompt
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSavePrompt();
    }
  }

  // Copy handlers
  async function handleCopyUrl() {
    if (!$mcpConnectionInfo?.url) return;
    try {
      await navigator.clipboard.writeText($mcpConnectionInfo.url);
      copiedUrl = true;
      setTimeout(() => (copiedUrl = false), 2000);
    } catch {
      // Fallback for non-secure contexts
    }
  }

  async function handleCopyToken() {
    if (!$mcpConnectionInfo?.token) return;
    try {
      await navigator.clipboard.writeText($mcpConnectionInfo.token);
      copiedToken = true;
      setTimeout(() => (copiedToken = false), 2000);
    } catch {
      // Fallback
    }
  }
</script>

<div class="ai-features" class:ai-features--page={surface === 'page'}>
  <!-- ── AI Status & Active Provider ──────────────────── -->
  <div class="ai-card">
    <div class="ai-card-header">
      <BotIcon size={16} />
      <h4>AI Status</h4>
    </div>

    <!-- Provider + Model row -->
    <div class="ai-status-row">
      {#if $aiStatusLoading}
        <div class="ai-loading-row">
          <Loader2Icon size={14} class="ai-spin" />
          <span>Loading provider status...</span>
        </div>
      {:else if hasActiveProvider && activeProviderStatus}
        <div class="ai-provider-info">
          <span
            class="ai-provider-dot"
            style="background:{providerDotColor(activeProviderStatus.provider)}"
          ></span>
          <div class="ai-provider-details">
            <strong class="ai-provider-name">{providerDisplayName(activeProviderStatus.provider)}</strong>
            <span class="ai-provider-label">
              {#if activeModel}
                {activeModel}
              {:else}
                Active provider
              {/if}
            </span>
          </div>
        </div>
        <div class="ai-status-badge ai-status-badge--ok">
          <CheckCircle2Icon size={12} />
          <span>Connected</span>
        </div>
      {:else if configuredProviderStatuses.length > 0}
        <div class="ai-provider-info">
          <BotIcon size={16} class="ai-icon-muted" />
          <div class="ai-provider-details">
            <strong class="ai-provider-name">No active provider</strong>
            <span class="ai-provider-label">Select one in Credentials to enable AI features</span>
          </div>
        </div>
        <div class="ai-status-badge ai-status-badge--idle">
          <span>Inactive</span>
        </div>
      {:else}
        <div class="ai-provider-info">
          <BotIcon size={16} class="ai-icon-muted" />
          <div class="ai-provider-details">
            <strong class="ai-provider-name">No provider configured</strong>
            <span class="ai-provider-label">Add an API key in Credentials to get started</span>
          </div>
        </div>
        <div class="ai-status-badge ai-status-badge--off">
          <span>Off</span>
        </div>
      {/if}
    </div>

    <!-- Refresh button -->
    <div class="ai-card-actions">
      <button
        type="button"
        class="ai-btn ai-btn--sm ai-btn--ghost"
        onclick={() => void handleRefresh()}
        disabled={$aiStatusLoading}
      >
        <RefreshCwIcon size={13} class={$aiStatusLoading ? 'ai-spin' : ''} />
        Refresh
      </button>
    </div>
  </div>



  <!-- ── ChatGPT Account ──────────────────────────────── -->
  <ChatGptAuth />

  <!-- ── System Prompt / Custom Instructions ──────────── -->
  <div class="ai-card">
    <div class="ai-card-header">
      <MessageSquareIcon size={16} />
      <h4>Custom Instructions</h4>
    </div>

    <div class="ai-card-description">
      <p>
        Tell Bento's AI how to respond. This acts as a system prompt — it's sent with every AI request
        to guide tone, depth, and behavior.
      </p>
    </div>

    <div class="ai-prompt-header">
      <div class="ai-textarea-wrap">
        <textarea
          class="ai-textarea"
          rows="5"
          maxlength="2000"
          placeholder="E.g. Be concise. Prioritize actionable advice. Use a warm but professional tone."
          value={$aiFeaturesPrefs.systemPrompt}
          oninput={(e) => void handleSystemPromptInput(e.currentTarget.value)}
          onkeydown={handleKeydown}
        ></textarea>
        <span class="ai-textarea-count">{$aiFeaturesPrefs.systemPrompt.length} / 2000</span>
      </div>

      <div class="ai-prompt-status-row">
        {#if promptSavingStatus === 'saving'}
          <span class="ai-prompt-status ai-prompt-status--saving">
            <Loader2Icon size={12} class="ai-spin" />
            Saving...
          </span>
        {:else if promptSavingStatus === 'saved'}
          <span class="ai-prompt-status ai-prompt-status--saved">
            <CheckCircle2Icon size={12} />
            Saved
          </span>
        {:else if promptSavingStatus === 'unsaved'}
          <span class="ai-prompt-status ai-prompt-status--unsaved">
            <span class="ai-prompt-unsaved-dot"></span>
            Unsaved changes
          </span>
        {:else if $aiPrefsDirty}
          <span class="ai-prompt-status ai-prompt-status--unsaved">
            <span class="ai-prompt-unsaved-dot"></span>
            Saving...
          </span>
        {:else}
          <span class="ai-prompt-status ai-prompt-status--synced">
            <CheckCircle2Icon size={12} />
            All changes saved
          </span>
        {/if}

        <div class="ai-prompt-actions">
          <button
            type="button"
            class="ai-btn ai-btn--sm ai-btn--ghost"
            onclick={handleResetPrompt}
            disabled={$aiFeaturesPrefs.systemPrompt === defaultPrefs.systemPrompt}
          >
            <RefreshCwIcon size={13} />
            Reset
          </button>
          <button
            type="button"
            class="ai-btn ai-btn--sm"
            onclick={handleSavePrompt}
            disabled={promptSavingStatus !== 'unsaved'}
          >
            <CheckCircle2Icon size={13} />
            Save
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── MCP Connection Info ──────────────────────────── -->
  <div class="ai-card">
    <div class="ai-card-header">
      <ServerIcon size={16} />
      <h4>MCP Server Connection</h4>
    </div>

    <div class="ai-card-description">
      <p>
        AI clients like Claude Desktop, Codex, and Cursor can connect directly to Bento's local MCP server.
        Use these details to configure your client.
      </p>
    </div>

    {#if $mcpLoading}
      <div class="ai-loading-row">
        <Loader2Icon size={14} class="ai-spin" />
        <span>Loading MCP connection info...</span>
      </div>
    {:else if mcpUp}
      <div class="ai-mcp-row">
        <div class="ai-mcp-label">
          <span>Server URL</span>
        </div>
        <div class="ai-mcp-value-row">
          <code class="ai-mcp-value">{$mcpConnectionInfo!.url}</code>
          <button
            type="button"
            class="ai-btn ai-btn--icon ai-btn--ghost"
            aria-label="Copy server URL"
            title="Copy server URL"
            onclick={() => void handleCopyUrl()}
          >
            {#if copiedUrl}
              <ClipboardCheckIcon size={14} />
            {:else}
              <CopyIcon size={14} />
            {/if}
          </button>
        </div>
      </div>

      <div class="ai-mcp-row">
        <div class="ai-mcp-label">
          <span>Session Token</span>
          <span class="ai-mcp-badge">Sensitive</span>
        </div>
        <div class="ai-mcp-value-row">
          <code class="ai-mcp-value ai-mcp-value--token">
            {#each Array(48) as _}
              &bull;
            {/each}
          </code>
          <button
            type="button"
            class="ai-btn ai-btn--icon ai-btn--ghost"
            aria-label="Copy session token"
            title="Copy session token"
            onclick={() => void handleCopyToken()}
          >
            {#if copiedToken}
              <ClipboardCheckIcon size={14} />
            {:else}
              <CopyIcon size={14} />
            {/if}
          </button>
        </div>
      </div>

      <div class="ai-mcp-health">
        <span class="ai-mcp-health-dot"></span>
        <span>Server running on port {$mcpConnectionInfo!.port}</span>
        <span class="ai-mcp-version">v{$mcpConnectionInfo!.version}</span>
      </div>
    {:else}
      <div class="ai-mcp-offline">
        <ServerIcon size={14} />
        <span>MCP server is not available. AI clients cannot connect right now.</span>
      </div>
    {/if}
  </div>

  <!-- ── Privacy Note ─────────────────────────────────── -->
  <div class="ai-disclaimer">
    <ShieldIcon size={16} />
    <div class="ai-disclaimer__copy">
      <strong>Privacy & Data</strong>
      <p>
        All AI requests go directly from this device to your configured provider.
        No data passes through Bento servers. Your system prompt and feature preferences
        are stored locally and never transmitted off-device.
      </p>
    </div>
  </div>
</div>

<style>
  /* ── Layout ───────────────────────────────────────────────────────────────── */
  .ai-features {
    display: grid;
    gap: 1.75rem;
  }
  .ai-features--page {
    max-width: 48rem;
  }

  /* ── Cards ────────────────────────────────────────────────────────────────── */
  .ai-card {
    border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
    box-shadow: none;
    border-radius: 1.15rem;
    padding: 1.25rem;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--surface) 96%, var(--background)) 98%,
        color-mix(in srgb, var(--surface) 96%, var(--background)) 86%
      );
    display: grid;
    gap: 1rem;
  }
  .ai-card-header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--foreground);
    padding-bottom: 0.25rem;
  }
  .ai-card-header :global(svg) {
    color: var(--muted);
    flex-shrink: 0;
  }
  .ai-card-header h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--foreground);
  }
  .ai-card-description p {
    margin: 0;
    line-height: 1.5;
    color: var(--muted);
    padding-bottom: 0.25rem;
  }
  .ai-card-actions {
    display: flex;
    gap: 0.6rem;
  }

  /* ── Status Row ───────────────────────────────────────────────────────────── */
  .ai-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    border: none;
    box-shadow: none;
  }

  .ai-provider-info {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    flex: 1;
  }
  .ai-provider-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 9999px;
    flex-shrink: 0;
  }
  .ai-provider-details {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .ai-provider-name {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ai-provider-label {
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.ai-icon-muted) {
    color: var(--muted);
    flex-shrink: 0;
  }

  .ai-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
  }
  .ai-status-badge--ok {
    background: color-mix(in srgb, #10b981 12%, var(--background));
    color: #10b981;
  }
  .ai-status-badge--idle {
    background: color-mix(in srgb, #f59e0b 12%, var(--background));
    color: #d97706;
  }
  .ai-status-badge--off {
    background: color-mix(in srgb, var(--muted) 12%, var(--background));
    color: var(--muted);
  }

  .ai-loading-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0;
    color: var(--muted);
  }

  /* ── Prompt Header ──────────────────────────────────────────────────────── */
  .ai-prompt-header {
    display: grid;
    gap: 0.85rem;
  }

  /* ── Textarea ────────────────────────────────────────────────────────────── */
  .ai-textarea-wrap {
    position: relative;
  }
  .ai-textarea {
    width: 100%;
    max-width: 32rem;
    min-height: 6rem;
    padding: 0.85rem 1rem;
    border: none;
    border-radius: 10px;
    background: var(--background);
    color: var(--foreground);
    font-family: inherit;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .ai-textarea:focus {
    border-color: var(--primary);
  }
  .ai-textarea::placeholder {
    color: var(--muted);
    opacity: 0.7;
  }
  .ai-textarea-count {
    position: absolute;
    bottom: 0.5rem;
    right: 0.75rem;
    font-size: 0.7rem;
    color: var(--muted);
    pointer-events: none;
  }

  /* ── Prompt Status ──────────────────────────────────────────────────────── */
  .ai-prompt-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    min-height: 1.5rem;
  }
  .ai-prompt-status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .ai-prompt-status--saving {
    color: var(--muted);
  }
  .ai-prompt-status--saved {
    color: #10b981;
  }
  .ai-prompt-status--unsaved {
    color: #f59e0b;
  }
  .ai-prompt-status--synced {
    color: #10b981;
  }
  .ai-prompt-unsaved-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    background: #f59e0b;
    flex-shrink: 0;
  }
  .ai-prompt-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── MCP Connection ──────────────────────────────────────────────────────── */
  .ai-mcp-row {
    display: grid;
    gap: 0.45rem;
    max-width: 32rem;
  }
  .ai-mcp-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--muted);
  }
  .ai-mcp-badge {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 0.08rem 0.35rem;
    border-radius: 4px;
    background: color-mix(in srgb, #f59e0b 14%, var(--background));
    color: #d97706;
    text-transform: uppercase;
  }
  .ai-mcp-value-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ai-mcp-value {
    flex: 1;
    padding: 0.6rem 0.85rem;
    border: none;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    font-family: var(--font-mono, monospace);
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: all;
  }
  .ai-mcp-value--token {
    letter-spacing: 0.12em;
    color: var(--muted);
    font-size: 0.7rem;
  }
  .ai-mcp-health {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.65rem 0.85rem;
    border-radius: 8px;
    background: color-mix(in srgb, #10b981 8%, var(--background));
    font-weight: 600;
    color: #10b981;
  }
  .ai-mcp-health-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 9999px;
    background: #10b981;
    flex-shrink: 0;
  }
  .ai-mcp-version {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 500;
    opacity: 0.7;
  }
  .ai-mcp-offline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1rem;
    border-radius: 8px;
    background: color-mix(in srgb, var(--muted) 8%, var(--background));
    color: var(--muted);
    line-height: 1.5;
  }
  .ai-mcp-offline :global(svg) {
    flex-shrink: 0;
  }

  /* ── Buttons ─────────────────────────────────────────────────────────────── */
  .ai-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
  }
  .ai-btn--sm {
    padding: 0.4rem 0.75rem;
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    color: var(--foreground);
    border: none;
  }
  .ai-btn--sm:hover {
    background: color-mix(in srgb, var(--foreground) 14%, var(--background));
  }
  .ai-btn--ghost {
    border: none;
    background: transparent;
    color: var(--muted);
  }
  .ai-btn--ghost:hover {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }
  .ai-btn--icon {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
  }
  .ai-btn--icon:hover {
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    color: var(--foreground);
  }
  .ai-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ── Disclaimer ──────────────────────────────────────────────────────────── */
  .ai-disclaimer {
    display: flex;
    gap: 0.85rem;
    padding: 1.15rem;
    border-radius: 1.15rem;
    border: none;
    box-shadow: none;
    background: var(--surface);
    align-items: flex-start;
  }
  .ai-disclaimer :global(svg) {
    flex-shrink: 0;
    margin-top: 0.1rem;
    color: var(--muted);
  }
  .ai-disclaimer__copy {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }
  .ai-disclaimer__copy strong {
    color: var(--foreground);
  }
  .ai-disclaimer__copy p {
    margin: 0;
    line-height: 1.5;
    color: var(--muted);
  }

  /* ── Animations ──────────────────────────────────────────────────────────── */
  :global(.ai-spin) {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>
