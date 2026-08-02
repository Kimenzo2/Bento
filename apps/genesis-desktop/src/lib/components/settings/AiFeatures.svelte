<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
  import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import Loader2Icon from '@lucide/svelte/icons/loader-2';
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
  } from '$lib/stores/ai-features.store';

  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  import { byokSettings } from '$lib/stores/byok.store';
  import { providerDisplayName, providerKnownModels } from '$lib/stores/byok.store';
  import { activeBundle, createTranslator } from '$lib/i18n';
  import ChatGptAuth from '$lib/components/settings/ChatGptAuth.svelte';

  let _t = $derived.by(() => createTranslator($activeBundle));
  let { surface = 'panel' }: { surface?: 'panel' | 'page' } = $props();

  let models = $state<string[]>([]);
  let modelsLoading = $state(false);
  let copiedUrl = $state(false);
  let copiedToken = $state(false);
  let promptSavingStatus = $state<'saved' | 'saving' | 'unsaved' | ''>('');

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

  onMount(() => {
    void initAiFeaturesPrefs();
    void refreshAiProviderStatus();
    void refreshMcpConnection();
    void loadModels();

    const handleBeforeUnload = () => { void flushPendingAiPrefsSave(); };
    window.addEventListener('beforeunload', handleBeforeUnload);

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

  async function handleRefresh() {
    await Promise.all([
      refreshAiProviderStatus(),
      refreshMcpConnection(),
    ]);
    await loadModels();
  }

  function handleSystemPromptInput(value: string) {
    if (value.length > 2000) { value = value.slice(0, 2000); }
    updateSystemPrompt(value);
    promptSavingStatus = 'unsaved';
  }

  function handleSavePrompt() {
    promptSavingStatus = 'saving';
    flushPendingAiPrefsSave().then(() => {
      promptSavingStatus = 'saved';
      setTimeout(() => (promptSavingStatus = ''), 2500);
    });
  }

  function handleResetPrompt() {
    resetSystemPrompt();
    promptSavingStatus = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSavePrompt();
    }
  }

  async function handleCopyUrl() {
    if (!$mcpConnectionInfo?.url) return;
    try {
      await navigator.clipboard.writeText($mcpConnectionInfo.url);
      copiedUrl = true;
      setTimeout(() => (copiedUrl = false), 2000);
    } catch {}
  }

  async function handleCopyToken() {
    if (!$mcpConnectionInfo?.token) return;
    try {
      await navigator.clipboard.writeText($mcpConnectionInfo.token);
      copiedToken = true;
      setTimeout(() => (copiedToken = false), 2000);
    } catch {}
  }
</script>

<div class="ai-features" class:ai-features--page={surface === 'page'}>

  <!-- ── AI Status ──────────────────────────────────── -->
  <div class="ai-card">
    <div class="ai-card__header">
      <h2 class="ai-card__title">AI Status</h2>
    </div>
    <div class="ai-card__body">
      <div class="ai-row">
        <div class="ai-row__left">
          {#if $aiStatusLoading}
            <div class="ai-inline-loading">
              <Loader2Icon size={14} class="ai-spin" />
              <span>Loading provider status...</span>
            </div>
          {:else if hasActiveProvider && activeProviderStatus}
            <span
              class="ai-dot"
              style="background:{providerDotColor(activeProviderStatus.provider)}"
            ></span>
            <div class="ai-row__text">
              <strong>{providerDisplayName(activeProviderStatus.provider)}</strong>
              <span>{activeModel ?? 'No model selected'}</span>
            </div>
          {:else if configuredProviderStatuses.length > 0}
            <BotIcon size={16} class="ai-icon-muted" />
            <div class="ai-row__text">
              <strong>No active provider</strong>
              <span>Select one in Credentials to enable AI features</span>
            </div>
          {:else}
            <BotIcon size={16} class="ai-icon-muted" />
            <div class="ai-row__text">
              <strong>No provider configured</strong>
              <span>Add an API key in Credentials to get started</span>
            </div>
          {/if}
        </div>
        <div class="ai-row__right">
          {#if $aiStatusLoading}
            <span class="ai-badge ai-badge--idle">Loading</span>
          {:else if hasActiveProvider && activeProviderStatus}
            <span class="ai-badge ai-badge--ok">
              <CheckCircle2Icon size={11} />
              Connected
            </span>
          {:else if configuredProviderStatuses.length > 0}
            <span class="ai-badge ai-badge--idle">Inactive</span>
          {:else}
            <span class="ai-badge ai-badge--off">Off</span>
          {/if}
        </div>
      </div>
    </div>
    <div class="ai-card__footer">
      <button
        type="button"
        class="ai-btn ai-btn--subtle"
        onclick={() => void handleRefresh()}
        disabled={$aiStatusLoading}
      >
        <RefreshCwIcon size={13} class={$aiStatusLoading ? 'ai-spin' : ''} />
        Refresh
      </button>
    </div>
  </div>

  <!-- ── ChatGPT Account ──────────────────────────────── -->
  <div class="ai-card">
    <div class="ai-card__header">
      <h2 class="ai-card__title">Sign in with ChatGPT</h2>
      <p class="ai-card__desc">Use your ChatGPT subscription through your own proxy server. No API key needed.</p>
    </div>
    <div class="ai-card__body">
      <ChatGptAuth />
    </div>
  </div>

  <!-- ── Custom Instructions ──────────────────────────── -->
  <div class="ai-card">
    <div class="ai-card__header">
      <h2 class="ai-card__title">Custom Instructions</h2>
      <p class="ai-card__desc">Tell Bento's AI how to respond. This acts as a system prompt — it's sent with every AI request to guide tone, depth, and behavior.</p>
    </div>
    <div class="ai-card__body">
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
    </div>
    <div class="ai-card__footer">
      <div class="ai-prompt-status">
        {#if promptSavingStatus === 'saving'}
          <span class="ai-status ai-status--saving">
            <Loader2Icon size={11} class="ai-spin" />
            Saving...
          </span>
        {:else if promptSavingStatus === 'saved'}
          <span class="ai-status ai-status--saved">
            <CheckCircle2Icon size={11} />
            Saved
          </span>
        {:else if promptSavingStatus === 'unsaved'}
          <span class="ai-status ai-status--unsaved">
            <span class="ai-unsaved-dot"></span>
            Unsaved changes
          </span>
        {:else if $aiPrefsDirty}
          <span class="ai-status ai-status--unsaved">
            <span class="ai-unsaved-dot"></span>
            Saving...
          </span>
        {:else}
          <span class="ai-status ai-status--synced">
            <CheckCircle2Icon size={11} />
            All changes saved
          </span>
        {/if}
      </div>
      <div class="ai-prompt-actions">
        <button
          type="button"
          class="ai-btn ai-btn--subtle"
          onclick={handleResetPrompt}
          disabled={$aiFeaturesPrefs.systemPrompt === defaultPrefs.systemPrompt}
        >
          <RefreshCwIcon size={13} />
          Reset
        </button>
        <button
          type="button"
          class="ai-btn ai-btn--primary"
          onclick={handleSavePrompt}
          disabled={promptSavingStatus !== 'unsaved'}
        >
          <CheckCircle2Icon size={13} />
          Save
        </button>
      </div>
    </div>
  </div>

  <!-- ── MCP Server Connection ────────────────────────── -->
  <div class="ai-card">
    <div class="ai-card__header">
      <h2 class="ai-card__title">MCP Server Connection</h2>
      <p class="ai-card__desc">AI clients like Claude Desktop, Codex, and Cursor can connect directly to Bento's local MCP server. Use these details to configure your client.</p>
    </div>
    {#if $mcpLoading}
      <div class="ai-card__body">
        <div class="ai-inline-loading">
          <Loader2Icon size={14} class="ai-spin" />
          <span>Loading MCP connection info...</span>
        </div>
      </div>
    {:else if mcpUp}
      <div class="ai-card__row">
        <span class="ai-card__row-label">Server URL</span>
        <div class="ai-card__row-value">
          <code class="ai-code-value">{$mcpConnectionInfo!.url}</code>
          <button
            type="button"
            class="ai-btn ai-btn--icon"
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
      <div class="ai-card__row">
        <span class="ai-card__row-label">
          Session Token
          <span class="ai-badge-inline">Sensitive</span>
        </span>
        <div class="ai-card__row-value">
          <code class="ai-code-value ai-code-value--masked">
            {#each Array($mcpConnectionInfo!.token.length) as _}&bull;{/each}
          </code>
          <button
            type="button"
            class="ai-btn ai-btn--icon"
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
      <div class="ai-card__row ai-card__row--status">
        <span class="ai-mcp-status__dot"></span>
        <span>Server running on port {$mcpConnectionInfo!.port}</span>
        <span class="ai-mcp-status__version">v{$mcpConnectionInfo!.version}</span>
      </div>
    {:else}
      <div class="ai-card__body">
        <div class="ai-mcp-offline">
          <ServerIcon size={14} />
          <span>MCP server is not available. AI clients cannot connect right now.</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Privacy & Data ───────────────────────────────── -->
  <div class="ai-card ai-card--muted">
    <div class="ai-card__body">
      <div class="ai-privacy">
        <ShieldIcon size={16} />
        <div class="ai-privacy__text">
          <strong>Privacy & Data</strong>
          <p>All AI requests go directly from this device to your configured provider. No data passes through Bento servers. Your system prompt and feature preferences are stored locally and never transmitted off-device.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .ai-features {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
  }

  /* ── Card (Whirl pattern) ─────────────────────────────────────── */
  .ai-card {
    display: flex;
    flex-direction: column;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 14px;
    background: transparent;
    min-width: 0;
    overflow: hidden;
  }
  .ai-card--muted {
    border-color: color-mix(in srgb, var(--foreground) 5%, transparent);
  }
  .ai-card__header {
    padding: 16px 20px 0;
  }
  .ai-card__title {
    margin: 0;
    font-weight: 550;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }
  .ai-card__desc {
    margin: 0.35rem 0 0;
    line-height: 1.5;
    color: var(--muted);
  }
  .ai-card__body {
    padding: 12px 20px 16px;
    min-width: 0;
  }
  .ai-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 10px 20px 12px;
    border-top: 1px solid color-mix(in srgb, var(--foreground) 5%, transparent);
  }

  /* ── Card rows (sub-border lines) ────────────────────────────── */
  .ai-card__row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 10px 20px;
    border-bottom: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  }
  .ai-card__row:last-child { border-bottom: none; }
  .ai-card__row-label {
    font-weight: 550;
    color: var(--foreground);
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
  }
  .ai-card__row-value {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ai-card__row--status {
    display: flex;
    color: oklch(0.63 0.128 151.4);
    font-weight: 550;
    justify-content: flex-start;
    gap: 0.45rem;
  }
  .ai-card__row--status .ai-mcp-status__version {
    margin-left: auto;
  }

  /* ── Row (inline setting) ────────────────────────────────────── */
  .ai-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .ai-row__left {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    flex: 1;
  }
  .ai-row__text {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .ai-row__text strong {
    font-weight: 550;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ai-row__text span {
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ai-row__right {
    flex-shrink: 0;
  }

  .ai-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 9999px;
    flex-shrink: 0;
  }
  :global(.ai-icon-muted) {
    color: var(--muted);
    flex-shrink: 0;
  }

  .ai-inline-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
  }

  /* ── Badges ───────────────────────────────────────────────────── */
  .ai-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 550;
    letter-spacing: 0.03em;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
  }
  .ai-badge--ok {
    background: color-mix(in srgb, oklch(0.63 0.135 163.337) 12%, transparent);
    color: oklch(0.63 0.135 163.337);
  }
  .ai-badge--idle {
    background: color-mix(in srgb, oklch(0.769 0.165 70.08) 12%, transparent);
    color: oklch(0.666 0.157 58.318);
  }
  .ai-badge--off {
    background: color-mix(in srgb, var(--muted) 12%, transparent);
    color: var(--muted);
  }
  .ai-badge-inline {
    font-size: 0.62rem;
    font-weight: 550;
    letter-spacing: 0.06em;
    padding: 0.08rem 0.35rem;
    border-radius: 4px;
    background: color-mix(in srgb, oklch(0.769 0.165 70.08) 14%, transparent);
    color: oklch(0.666 0.157 58.318);
    text-transform: uppercase;
    vertical-align: middle;
    margin-left: 0.35rem;
  }

  /* ── Textarea ─────────────────────────────────────────────────── */
  .ai-textarea-wrap {
    position: relative;
  }
  .ai-textarea {
    width: 100%;
    min-height: 7rem;
    padding: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.88rem;
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

  /* ── Prompt Footer ────────────────────────────────────────────── */
  .ai-prompt-status {
    display: flex;
    align-items: center;
  }
  .ai-status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 550;
  }
  .ai-status--saving { color: var(--muted); }
  .ai-status--saved { color: oklch(0.63 0.128 151.4); }
  .ai-status--unsaved { color: oklch(0.769 0.165 70.08); }
  .ai-status--synced { color: oklch(0.63 0.128 151.4); }
  .ai-unsaved-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    background: oklch(0.769 0.165 70.08);
    flex-shrink: 0;
  }
  .ai-prompt-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Fields ───────────────────────────────────────────────────── */
  .ai-field {
    display: grid;
    gap: 0.4rem;
  }
  .ai-field + .ai-field {
    margin-top: 0.75rem;
  }
  .ai-field__label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 550;
    color: var(--muted);
  }
  .ai-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .ai-code-value {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    background: transparent;
    font-family: var(--font-mono, monospace);
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: all;
  }
  .ai-code-value--masked {
    letter-spacing: 0.12em;
    color: var(--muted);
    font-size: 0.7rem;
  }

  .ai-mcp-status {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid color-mix(in srgb, oklch(0.63 0.128 151.4) 25%, transparent);
    border-radius: 8px;
    font-weight: 550;
    color: oklch(0.63 0.128 151.4);
  }
  .ai-mcp-status__dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    background: oklch(0.63 0.128 151.4);
    flex-shrink: 0;
  }
  .ai-mcp-status__version {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 500;
    opacity: 0.7;
  }

  .ai-mcp-offline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
    line-height: 1.5;
  }
  .ai-mcp-offline :global(svg) {
    flex-shrink: 0;
  }

  /* ── Privacy ──────────────────────────────────────────────────── */
  .ai-privacy {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .ai-privacy :global(svg) {
    flex-shrink: 0;
    margin-top: 0.1rem;
    color: var(--muted);
  }
  .ai-privacy__text {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
  }
  .ai-privacy__text strong {
    color: var(--foreground);
  }
  .ai-privacy__text p {
    margin: 0;
    line-height: 1.5;
    color: var(--muted);
  }

  /* ── Buttons ──────────────────────────────────────────────────── */
  .ai-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    font-family: inherit;
    font-weight: 550;
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
    background: transparent;
    color: var(--foreground);
    padding: 0.4rem 0.75rem;
  }
  .ai-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }
  .ai-btn--subtle {
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  .ai-btn--subtle:hover:not(:disabled) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }
  .ai-btn--primary {
    border-color: var(--foreground);
    background: var(--foreground);
    color: var(--background);
  }
  .ai-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  .ai-btn--icon {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  .ai-btn--icon:hover:not(:disabled) {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }
  .ai-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Animations ───────────────────────────────────────────────── */
  :global(.ai-spin) {
    animation: ai-spin 0.8s linear infinite;
  }
  @keyframes ai-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>
