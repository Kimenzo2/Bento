<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
  import BotIcon from "@lucide/svelte/icons/bot";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import KeyIcon from "@lucide/svelte/icons/key";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import XIcon from "@lucide/svelte/icons/x";

  import BrandIcon from "$lib/components/icons/BrandIcon.svelte";

  import {
    byokSettings,
    byokProviders,
    byokReady,
    byokTesting,
    byokTestResults,
    loadByokSettings,
    refreshProviders,
    saveApiKey,
    deleteApiKey,
    testConnection,
    toggleByok,
    setActiveProvider,
    setActiveModel,
    dismissOnboarding,
    updateByokSettings,
    type ProviderKeyStatus,
    type ByokSettings as ByokSettingsType,
    type ConnectionTestResult,
    providerDisplayName,
    providerKnownModels,
  } from "$lib/stores/byok.store";

  import { billingProfile } from "$lib/stores/billing.store";
  import { activeBundle, createTranslator } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Props ──────────────────────────────────────────────────────────────────
  let { surface = "panel" }: { surface?: "panel" | "page" } = $props();

  // ── State ──────────────────────────────────────────────────────────────────
  let onboardingVisible = $derived(!$byokSettings.onboardingDismissed);
  let addingKeyProvider = $state<string | null>(null);
  let editingKeyProvider = $state<string | null>(null);
  let keyInput = $state("");
  let keyConfirm = $state("");
  let showKey = $state(false);
  let savingKey = $state(false);
  let keyError = $state<string | null>(null);
  let keySuccess = $state<string | null>(null);
  let deletingProvider = $state<string | null>(null);
  let showProviderMenu = $state<string | null>(null);

  // Connection test
  let testingProvider = $state<string | null>(null);
  let connectionResult = $state<{ provider: string; result: ConnectionTestResult } | null>(null);

  // Model selector
  let showModelDropdown = $state(false);

  // ── Derivation ─────────────────────────────────────────────────────────────
  const hasPowerPlan = $derived(
    $billingProfile?.activePlanCode?.toLowerCase() === "power" ||
    $billingProfile?.billingTier?.toLowerCase() === "power"
  );

  const configuredProviders = $derived(
    ($byokProviders ?? []).filter((p) => p.isConfigured)
  );

  const activeProviderData = $derived(
    $byokSettings.activeProvider
      ? ($byokProviders ?? []).find((p) => p.provider === $byokSettings.activeProvider)
      : null
  );

  const availableModels = $derived(
    $byokSettings.activeProvider
      ? providerKnownModels($byokSettings.activeProvider)
      : []
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMount(() => {
    void loadByokSettings();
    void refreshProviders();
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function startAddKey(provider: string) {
    addingKeyProvider = provider;
    keyInput = "";
    keyConfirm = "";
    keyError = null;
    keySuccess = null;
    showKey = false;
  }

  function cancelAddKey() {
    addingKeyProvider = null;
    keyInput = "";
    keyConfirm = "";
    keyError = null;
  }

  async function handleSaveKey() {
    if (!addingKeyProvider) return;
    keyError = null;
    keySuccess = null;

    if (!keyInput.trim()) {
      keyError = "API key cannot be empty.";
      return;
    }

    if (keyInput.trim() !== keyConfirm.trim()) {
      keyError = "Keys do not match. Please re-enter.";
      return;
    }

    savingKey = true;
    try {
      await saveApiKey(addingKeyProvider, keyInput.trim());
      keySuccess = "API key saved securely to your system keyring.";
      setTimeout(() => {
        addingKeyProvider = null;
        keyInput = "";
        keyConfirm = "";
      }, 1200);
    } catch (e) {
      keyError = String(e);
    } finally {
      savingKey = false;
    }
  }

  async function handleDeleteKey(provider: string) {
    if (!confirm(`Delete the API key for ${providerDisplayName(provider)}? This cannot be undone.`)) return;
    deletingProvider = provider;
    try {
      await deleteApiKey(provider);
    } finally {
      deletingProvider = null;
    }
  }

  async function handleTestConnection(provider: string) {
    testingProvider = provider;
    connectionResult = null;
    try {
      const result = await testConnection(provider);
      connectionResult = { provider, result };
    } finally {
      testingProvider = null;
    }
  }

  async function handleToggle(enabled: boolean) {
    await toggleByok(enabled);
  }

  async function handleDismissOnboarding() {
    await dismissOnboarding();
  }

  async function handleSelectProvider(provider: string) {
    await setActiveProvider(provider);
    showProviderMenu = null;
  }

  async function handleSelectModel(model: string) {
    await setActiveModel(model);
    showModelDropdown = false;
  }

  async function handleBaseUrlChange(provider: string, url: string) {
    const overrides = { ...$byokSettings.baseUrlOverrides, [provider]: url };
    await updateByokSettings({ baseUrlOverrides: overrides });
  }



  const providerColors: Record<string, string> = {
    openai: "#10a37f",
    anthropic: "#d4a574",
    gemini: "#4285f4",
    grok: "#1da1f2",
    openrouter: "#ff6b35",
    ollama: "#9b59b6",
  };
</script>

<div class="byok-settings" class:byok-settings--page={surface === "page"}>
  <!-- ── Onboarding Banner ─────────────────────────────── -->
  {#if onboardingVisible}
    <div class="byok-onboarding" transition:fly={{ y: -8, duration: 300 }}>
      <div class="byok-onboarding__icon">
        <KeyIcon size={20} />
      </div>
      <div class="byok-onboarding__copy">
        <h4>Credentials</h4>
        <p>
          Power Plan users can connect their own AI provider API keys instead of using built-in credits.
          Your keys are stored securely in your system's OS keyring (credential manager), shown only
          as a masked preview in the UI, and are <strong>never sent to any Bento server</strong>.
        </p>
        <div class="byok-onboarding__disclaimer">
          <AlertCircleIcon size={14} />
          <span>
            You are responsible for all API usage costs and key security. Each provider bills you
            directly based on your usage. We recommend setting usage limits in your provider's dashboard.
          </span>
        </div>
      </div>
      <button
        class="byok-onboarding__dismiss"
        type="button"
        aria-label="Dismiss onboarding"
        onclick={handleDismissOnboarding}
      >
        <XIcon size={16} />
      </button>
    </div>
  {/if}

  <!-- ── Power Plan Gate ────────────────────────────────── -->
  {#if !hasPowerPlan}
    <div class="byok-gate" transition:fade={{ duration: 200 }}>
      <div class="byok-gate__icon">
        <ShieldIcon size={24} />
      </div>
      <h3 class="byok-gate__title">Power Plan Feature</h3>
      <p class="byok-gate__desc">
        BYOK is exclusive to the <strong>Power Plan</strong>. Upgrade to connect your own AI provider
        API keys and unlock advanced AI capabilities with your preferred models.
      </p>
      <div class="byok-gate__features">
        <div class="byok-gate__feature">
          <CheckCircle2Icon size={16} />
          <span>Connect OpenAI, Anthropic, Gemini, Grok, or local Ollama</span>
        </div>
        <div class="byok-gate__feature">
          <CheckCircle2Icon size={16} />
          <span>Keys stored in OS keyring — never on our servers</span>
        </div>
        <div class="byok-gate__feature">
          <CheckCircle2Icon size={16} />
          <span>Advanced AI intelligence across all modules</span>
        </div>
      </div>
    </div>
  {:else if !$byokReady}
    <!-- Loading state -->
    <div class="byok-loading">
      <Loader2Icon size={20} class="byok-loading__spin" />
      <span>Loading BYOK configuration...</span>
    </div>
  {:else}
    <!-- ── Main BYOK Panel ──────────────────────────────── -->
    <div class="byok-panel">
      <!-- ── Enable/Disable Toggle ───────────────────────── -->
      <div class="byok-toggle-row">
        <div class="byok-toggle-row__info">
          <h4>BYOK Mode</h4>
          <p>
            {#if $byokSettings.enabled}
              Active — using your configured provider for AI features.
            {:else}
              Disabled — using built-in AI channels.
            {/if}
          </p>
        </div>
        <label class="byok-toggle" aria-label="Toggle BYOK mode">
          <input
            type="checkbox"
            checked={$byokSettings.enabled}
            onchange={(e) => void handleToggle(e.currentTarget.checked)}
          />
          <span class="byok-toggle__track">
            <span class="byok-toggle__thumb"></span>
          </span>
        </label>
      </div>

      {#if $byokSettings.enabled}
        <!-- ── Active Provider Selector ────────────────────── -->
        <div class="byok-section">
          <div class="byok-section__header">
            <h4>Active AI Provider</h4>
            <p>Select which provider to use for AI features across Bento.</p>
          </div>

          <div class="byok-provider-select">
            <button
              type="button"
              class="byok-select-trigger"
              onclick={() => (showProviderMenu = !showProviderMenu as any)}
              aria-haspopup="listbox"
              aria-expanded={showProviderMenu ? 'true' : 'false'}
            >
              {#if $byokSettings.activeProvider}
                {const providerName = $byokSettings.activeProvider}
                <span class="byok-provider-dot" style={`background:${providerColors[providerName] ?? "#666"}`}></span>
                <BrandIcon name={providerName} size={16} class="byok-provider-svg" />
                <span>{providerDisplayName($byokSettings.activeProvider)}</span>
                {#if $byokSettings.activeModel}
                  <span class="byok-active-model-badge">{$byokSettings.activeModel}</span>
                {/if}
              {:else}
                <KeyIcon size={16} />
                <span class="byok-select-placeholder">Select a provider...</span>
              {/if}
              <ChevronDownIcon size={14} class={`byok-chevron${showProviderMenu ? ' byok-chevron--open' : ''}`} />
            </button>

            {#if showProviderMenu}
              <div class="byok-select-dropdown" role="listbox" transition:fade={{ duration: 100 }}>
                {#if configuredProviders.length === 0}
                  <div class="byok-select-empty">No providers configured. Add an API key below.</div>
                {:else}
                  {#each configuredProviders as provider}
                    <button
                      type="button"
                      role="option"
                      aria-selected={$byokSettings.activeProvider === provider.provider}
                      class="byok-select-option"
                      class:byok-select-option--active={$byokSettings.activeProvider === provider.provider}
                      onclick={() => void handleSelectProvider(provider.provider)}
                    >
                      <span class="byok-provider-dot" style={`background:${providerColors[provider.provider] ?? "#666"}`}></span>
                      <BrandIcon name={provider.provider} size={14} class="byok-provider-svg" />
                      <span>{provider.displayName}</span>
                      {#if provider.provider === "ollama"}
                        <span class="byok-provider-badge">Local</span>
                      {/if}
                    </button>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>

          <!-- ── Model Selector ─────────────────────────────── -->
          {#if $byokSettings.activeProvider && availableModels.length > 0}
            <div class="byok-model-select">
              <label class="byok-model-label">Active Model</label>
              <div class="byok-model-select-wrap">
                <button
                  type="button"
                  class="byok-select-trigger"
                  onclick={() => (showModelDropdown = !showModelDropdown)}
                  aria-haspopup="listbox"
                  aria-expanded={showModelDropdown}
                >
                  <BotIcon size={16} />
                  <span>{$byokSettings.activeModel || "Select a model..."}</span>
                  <ChevronDownIcon size={14} class={`byok-chevron${showModelDropdown ? ' byok-chevron--open' : ''}`} />
                </button>

                {#if showModelDropdown}
                  <div class="byok-select-dropdown byok-select-dropdown--models" role="listbox" transition:fade={{ duration: 100 }}>
                    {#each availableModels as model}
                      <button
                        type="button"
                        role="option"
                        aria-selected={$byokSettings.activeModel === model}
                        class="byok-select-option"
                        class:byok-select-option--active={$byokSettings.activeModel === model}
                        onclick={() => void handleSelectModel(model)}
                      >
                        <span>{model}</span>
                        {#if $byokSettings.activeModel === model}
                          <CheckCircle2Icon size={14} />
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- ── Connection Result ─────────────────────────── -->
          {#if connectionResult}
            <div
              class="byok-connection-result"
              class:byok-connection-result--ok={connectionResult.result.ok}
              class:byok-connection-result--err={!connectionResult.result.ok}
              transition:fade={{ duration: 150 }}
            >
              {#if connectionResult.result.ok}
                <CheckCircle2Icon size={16} />
                <span>
                  Connected successfully ({connectionResult.result.latencyMs}ms)
                  {#if connectionResult.result.availableModels.length > 0}
                    — {connectionResult.result.availableModels.length} models available
                  {/if}
                </span>
              {:else}
                {#if connectionResult.result.error?.code === 'AuthFailed'}
                  <ShieldIcon size={16} />
                  <span>Authentication failed: invalid API key</span>
                {:else if connectionResult.result.error?.code === 'RateLimited'}
                  <AlertCircleIcon size={16} />
                  <span>Rate limited: too many requests (HTTP {connectionResult.result.error.statusCode})</span>
                {:else if connectionResult.result.error?.code === 'Timeout'}
                  <AlertCircleIcon size={16} />
                  <span>Connection timed out — server may be unreachable</span>
                {:else if connectionResult.result.error?.code === 'DnsFailure'}
                  <AlertCircleIcon size={16} />
                  <span>DNS resolution failed — check your network or base URL</span>
                {:else if connectionResult.result.error?.code === 'SslError'}
                  <AlertCircleIcon size={16} />
                  <span>SSL/TLS error — check certificate configuration</span>
                {:else if connectionResult.result.error?.code === 'ServerError'}
                  <AlertCircleIcon size={16} />
                  <span>Server error (HTTP {connectionResult.result.error.statusCode})</span>
                {:else if connectionResult.result.error?.code === 'NoKey'}
                  <KeyIcon size={16} />
                  <span>No API key configured for this provider</span>
                {:else}
                  <AlertCircleIcon size={16} />
                  <span>Connection failed: {connectionResult.result.error?.message ?? 'Unknown error'}</span>
                {/if}
              {/if}
              <button type="button" class="byok-result-dismiss" onclick={() => (connectionResult = null)}>
                <XIcon size={14} />
              </button>
            </div>
          {/if}
        </div>

        <!-- ── Provider Configuration ──────────────────────── -->
        <div class="byok-section">
          <div class="byok-section__header">
          <h4>Provider Credentials</h4>
          <p>Add, test, and remove provider keys. Only masked previews are shown in Bento.</p>
        </div>

          <div class="byok-provider-list">
            {#each $byokProviders as provider}
              <div class="byok-provider-card" class:byok-provider-card--expanded={addingKeyProvider === provider.provider || editingKeyProvider === provider.provider}>
                <div class="byok-provider-card__main">
                  <div class="byok-provider-card__info">
                    <span class="byok-provider-dot byok-provider-dot--lg" style={`background:${providerColors[provider.provider] ?? "#666"}`}></span>
                    <BrandIcon name={provider.provider} size={18} class="byok-provider-svg" />
                    <div class="byok-provider-card__names">
                      <strong>{provider.displayName}</strong>
                      {#if provider.isConfigured}
                        <span class="byok-provider-status byok-provider-status--configured">
                          <CheckCircle2Icon size={12} />
                          {provider.keyPreview || "Configured"}
                        </span>
                      {:else}
                        <span class="byok-provider-status byok-provider-status--missing">
                          {provider.requiresKey ? "No key configured" : "No connection"}
                        </span>
                      {/if}
                    </div>
                  </div>

                  <div class="byok-provider-card__actions">
                    {#if provider.isConfigured}
                      {#if deletingProvider === provider.provider}
                        <Loader2Icon size={16} class="byok-spin" />
                      {:else}
                        <button
                          type="button"
                          class="byok-btn byok-btn--icon byok-btn--ghost"
                          title="Test connection"
                          aria-label="Test connection to {provider.displayName}"
                          disabled={testingProvider === provider.provider}
                          onclick={() => void handleTestConnection(provider.provider)}
                        >
                          {#if testingProvider === provider.provider}
                            <Loader2Icon size={15} class="byok-spin" />
                          {:else}
                            <PlugIcon size={15} />
                          {/if}
                        </button>
                        <button
                          type="button"
                          class="byok-btn byok-btn--icon byok-btn--ghost byok-btn--danger"
                          title="Remove API key"
                          aria-label="Remove API key for {provider.displayName}"
                          onclick={() => void handleDeleteKey(provider.provider)}
                        >
                          <Trash2Icon size={15} />
                        </button>
                      {/if}
                    {:else if provider.requiresKey}
                      <button
                        type="button"
                        class="byok-btn byok-btn--sm"
                        onclick={() => startAddKey(provider.provider)}
                      >
                        <PlusIcon size={14} />
                        Add Key
                      </button>
                    {:else}
                      <!-- Ollama local — no key needed -->
                      <span class="byok-provider-no-key">No key required</span>
                    {/if}
                  </div>
                </div>

                <!-- ── Key Input Panel ────────────────────────── -->
                {#if addingKeyProvider === provider.provider}
                  <div class="byok-key-input-panel" transition:fly={{ y: -8, duration: 200 }}>
                    {#if keyError}
                      <p class="byok-key-error" role="alert">{keyError}</p>
                    {/if}
                    {#if keySuccess}
                      <p class="byok-key-success" role="status">{keySuccess}</p>
                    {:else}
                      <div class="byok-key-input-wrap">
                        <label class="byok-key-label" for="byok-key-input">API Key</label>
                        <div class="byok-key-input-row">
                          <input
                            id="byok-key-input"
                            type={showKey ? "text" : "password"}
                            class="byok-key-input"
                            placeholder={provider.provider === "gemini" ? "AIza..." : "sk-..."}
                            bind:value={keyInput}
                            autocomplete="off"
                            spellcheck="false"
                          />
                          <button
                            type="button"
                            class="byok-btn byok-btn--icon byok-btn--ghost"
                            aria-label={showKey ? "Hide key" : "Show key"}
                            onclick={() => (showKey = !showKey)}
                          >
                            {#if showKey}<EyeOffIcon size={15} />{:else}<EyeIcon size={15} />{/if}
                          </button>
                        </div>
                      </div>
                      <div class="byok-key-input-wrap">
                        <label class="byok-key-label" for="byok-key-confirm">Confirm Key</label>
                        <input
                          id="byok-key-confirm"
                          type="password"
                          class="byok-key-input"
                          placeholder="Re-enter the key to confirm"
                          bind:value={keyConfirm}
                          autocomplete="off"
                          spellcheck="false"
                        />
                      </div>
                      <div class="byok-key-actions">
                        <button
                          type="button"
                          class="byok-btn byok-btn--sm byok-btn--primary"
                          disabled={savingKey || !keyInput.trim() || keyInput.trim() !== keyConfirm.trim()}
                          onclick={() => void handleSaveKey()}
                        >
                          {#if savingKey}
                            <Loader2Icon size={14} class="byok-spin" />
                            Saving...
                          {:else}
                            <ShieldIcon size={14} />
                            Save to Keyring
                          {/if}
                        </button>
                        <button
                          type="button"
                          class="byok-btn byok-btn--sm byok-btn--ghost"
                          disabled={savingKey}
                          onclick={cancelAddKey}
                        >
                          Cancel
                        </button>
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- ── Ollama Base URL Override ───────────────── -->
                {#if provider.provider === "ollama" && provider.isConfigured}
                  <div class="byok-ollama-url">
                    <label class="byok-key-label">Base URL</label>
                    <input
                      type="text"
                      class="byok-key-input"
                      placeholder="http://localhost:11434"
                      value={$byokSettings.baseUrlOverrides["ollama"] ?? "http://localhost:11434"}
                      onchange={(e) => void handleBaseUrlChange("ollama", e.currentTarget.value)}
                      autocomplete="off"
                      spellcheck="false"
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- ── Security & Disclaimer ───────────────────────── -->
        <div class="byok-disclaimer">
          <ShieldIcon size={16} />
          <div class="byok-disclaimer__copy">
            <strong>Security & Privacy</strong>
            <p>
              Your API keys are stored exclusively in your operating system's credential manager
              (Windows Credential Manager, macOS Keychain, or Linux Secret Service).
              Bento never transmits, stores, or has access to your keys. All AI requests go directly
              from this device to your chosen provider — there is no proxy or intermediary.
            </p>
            <p class="byok-disclaimer__cost">
              <AlertCircleIcon size={13} />
              You are responsible for all costs incurred through your API keys. Each provider charges
              according to their pricing. Set usage limits and monitor your dashboard.
            </p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ── Layout ───────────────────────────────────────────────────────────────── */
  .byok-settings {
    display: grid;
    gap: 1.25rem;
  }
  .byok-settings--page {
    max-width: 48rem;
  }

  /* ── Loading ──────────────────────────────────────────────────────────────── */
  .byok-loading {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 1.5rem;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .byok-loading__spin {
    animation: spin 0.8s linear infinite;
  }

  /* ── Onboarding ───────────────────────────────────────────────────────────── */
  .byok-onboarding {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.85rem;
    padding: 1.15rem 1.25rem;
    border-radius: 16px;
    border: none;
    box-shadow: none;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    align-items: start;
  }
  .byok-onboarding__icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--primary) 14%, var(--background));
    color: var(--primary);
    flex-shrink: 0;
  }
  .byok-onboarding__copy {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }
  .byok-onboarding__copy h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--foreground);
  }
  .byok-onboarding__copy p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--muted);
  }
  .byok-onboarding__disclaimer {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    margin-top: 0.4rem;
    padding: 0.55rem 0.7rem;
    border-radius: 8px;
    background: color-mix(in srgb, #f59e0b 12%, var(--background));
    color: #d97706;
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .byok-onboarding__disclaimer svg {
    flex-shrink: 0;
    margin-top: 0.1rem;
  }
  .byok-onboarding__dismiss {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s ease;
  }
  .byok-onboarding__dismiss:hover {
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
  }

  /* ── Power Plan Gate ──────────────────────────────────────────────────────── */
  .byok-gate {
    display: grid;
    gap: 1rem;
    padding: 2rem;
    border-radius: 20px;
    border: none;
    box-shadow: none;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    text-align: center;
    place-items: center;
    max-width: 32rem;
    margin: 0 auto;
  }
  .byok-gate__icon {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 9999px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, #a855f7 18%, var(--background));
    color: #a855f7;
  }
  .byok-gate__title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--foreground);
  }
  .byok-gate__desc {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 28rem;
  }
  .byok-gate__features {
    display: grid;
    gap: 0.6rem;
    text-align: left;
    width: 100%;
    max-width: 24rem;
  }
  .byok-gate__feature {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.85rem;
    color: var(--muted);
    line-height: 1.4;
  }
  .byok-gate__feature svg {
    color: #a855f7;
    flex-shrink: 0;
  }

  /* ── Panel ─────────────────────────────────────────────────────────────────- */
  .byok-panel {
    display: grid;
    gap: 1.25rem;
  }

  /* ── Toggle Row ──────────────────────────────────────────────────────────── */
  .byok-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border-radius: 14px;
    border: none;
    box-shadow: none;
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
  }
  .byok-toggle-row__info {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }
  .byok-toggle-row__info h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--foreground);
  }
  .byok-toggle-row__info p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
  }

  .byok-toggle {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .byok-toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .byok-toggle__track {
    position: relative;
    width: 2.75rem;
    height: 1.55rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--foreground) 15%, var(--background));
    transition: background 0.2s ease;
  }
  .byok-toggle input:checked + .byok-toggle__track {
    background: var(--primary);
  }
  .byok-toggle__thumb {
    position: absolute;
    top: 0.15rem;
    left: 0.15rem;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    background: white;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: none;
  }
  .byok-toggle input:checked + .byok-toggle__track .byok-toggle__thumb {
    transform: translateX(1.2rem);
  }

  /* ── Sections ────────────────────────────────────────────────────────────── */
  .byok-section {
    display: grid;
    gap: 0.85rem;
  }
  .byok-section__header {
    display: grid;
    gap: 0.2rem;
  }
  .byok-section__header h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--foreground);
  }
  .byok-section__header p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
  }

  /* ── Provider Select ─────────────────────────────────────────────────────── */
  .byok-provider-select {
    position: relative;
  }
  .byok-select-trigger {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.7rem 1rem;
    border: none;
    border-radius: 12px;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    color: var(--foreground);
    font-size: 0.9rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .byok-select-trigger:hover {
    background: color-mix(in srgb, var(--foreground) 6%, var(--background));
  }
  .byok-select-placeholder {
    color: var(--muted);
  }
  .byok-chevron {
    margin-left: auto;
    transition: transform 0.2s ease;
    color: var(--muted);
  }
  .byok-chevron--open {
    transform: rotate(180deg);
  }

  .byok-select-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 20;
    margin-top: 0.3rem;
    border-radius: 12px;
    background: var(--background);
    border: none;
    box-shadow: none;
    overflow: hidden;
    max-height: 16rem;
    overflow-y: auto;
  }
  .byok-select-dropdown--models {
    max-height: 12rem;
  }
  .byok-select-empty {
    padding: 1rem;
    color: var(--muted);
    font-size: 0.85rem;
    text-align: center;
  }
  .byok-select-option {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.65rem 1rem;
    border: none;
    background: transparent;
    color: var(--foreground);
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s ease;
    font-family: inherit;
  }
  .byok-select-option:hover {
    background: color-mix(in srgb, var(--foreground) 5%, var(--background));
  }
  .byok-select-option--active {
    background: color-mix(in srgb, var(--primary) 8%, var(--background));
    color: var(--primary);
    font-weight: 600;
  }
  .byok-provider-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    flex-shrink: 0;
  }
  .byok-provider-dot--lg {
    width: 0.65rem;
    height: 0.65rem;
  }
  .byok-active-model-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 6px;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    letter-spacing: -0.01em;
  }
  .byok-provider-badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 6px;
    background: color-mix(in srgb, #9b59b6 14%, var(--background));
    color: #9b59b6;
    letter-spacing: 0.03em;
    margin-left: auto;
  }

  /* ── Model Select ────────────────────────────────────────────────────────── */
  .byok-model-select {
    display: grid;
    gap: 0.4rem;
  }
  .byok-model-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--muted);
  }
  .byok-model-select-wrap {
    position: relative;
  }

  /* ── Provider Cards ──────────────────────────────────────────────────────── */
  .byok-provider-list {
    display: grid;
    gap: 0.5rem;
  }
  .byok-provider-card {
    border: none;
    box-shadow: none;
    border-radius: 14px;
    padding: 0.85rem 1rem;
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
    transition: background 0.15s ease;
  }
  .byok-provider-card--expanded {
    background: color-mix(in srgb, var(--primary) 8%, var(--background));
  }
  .byok-provider-card__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .byok-provider-card__info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    flex: 1;
  }
  .byok-provider-card__names {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .byok-provider-card__names strong {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--foreground);
  }
  .byok-provider-card__actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .byok-provider-status {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .byok-provider-status--configured {
    color: #10b981;
  }
  .byok-provider-status--missing {
    color: var(--muted);
  }
  .byok-provider-no-key {
    font-size: 0.78rem;
    color: var(--muted);
    font-weight: 500;
  }

  /* ── Buttons ─────────────────────────────────────────────────────────────── */
  .byok-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: none;
    border-radius: 10px;
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
  }
  .byok-btn--sm {
    padding: 0.45rem 0.85rem;
    font-size: 0.82rem;
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    color: var(--foreground);
    border: none;
  }
  .byok-btn--sm:hover {
    background: color-mix(in srgb, var(--foreground) 14%, var(--background));
  }
  .byok-btn--primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
  }
  .byok-btn--primary:hover {
    opacity: 0.9;
  }
  .byok-btn--primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .byok-btn--icon {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
  }
  .byok-btn--icon:hover {
    background: color-mix(in srgb, var(--foreground) 8%, var(--background));
    color: var(--foreground);
  }
  .byok-btn--ghost {
    border: none;
    background: transparent;
  }
  .byok-btn--danger:hover {
    color: #ef4444;
    background: color-mix(in srgb, #ef4444 10%, var(--background));
  }
  .byok-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Key Input Panel ─────────────────────────────────────────────────────── */
  .byok-key-input-panel {
    display: grid;
    gap: 0.65rem;
    margin-top: 0.85rem;
    padding: 1rem;
    border-radius: 12px;
    border: none;
    box-shadow: none;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
  }
  .byok-key-input-wrap {
    display: grid;
    gap: 0.3rem;
  }
  .byok-key-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
  }
  .byok-key-input-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .byok-key-input {
    flex: 1;
    padding: 0.55rem 0.85rem;
    border: none;
    border-radius: 10px;
    background: color-mix(in srgb, var(--foreground) 5%, var(--background));
    color: var(--foreground);
    font-size: 0.88rem;
    font-family: var(--font-mono, monospace);
    outline: none;
    transition: outline-color 0.15s ease;
    box-sizing: border-box;
  }
  .byok-key-input:focus {
    outline: 2px solid color-mix(in srgb, var(--primary) 30%, transparent);
    outline-offset: 1px;
  }
  .byok-key-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
  .byok-key-error {
    margin: 0;
    font-size: 0.82rem;
    color: #ef4444;
    background: color-mix(in srgb, #ef4444 10%, var(--background));
    border-radius: 8px;
    padding: 0.45rem 0.7rem;
  }
  .byok-key-success {
    margin: 0;
    font-size: 0.82rem;
    color: #10b981;
    background: color-mix(in srgb, #10b981 10%, var(--background));
    border-radius: 8px;
    padding: 0.45rem 0.7rem;
  }

  /* ── Ollama URL ──────────────────────────────────────────────────────────── */
  .byok-ollama-url {
    margin-top: 0.75rem;
    display: grid;
    gap: 0.3rem;
  }

  /* ── Connection Result ───────────────────────────────────────────────────── */
  .byok-connection-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.85rem;
    border-radius: 10px;
    border: none;
    box-shadow: none;
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1.4;
  }
  .byok-connection-result--ok {
    background: color-mix(in srgb, #10b981 10%, var(--background));
    color: #10b981;
  }
  .byok-connection-result--err {
    background: color-mix(in srgb, #ef4444 10%, var(--background));
    color: #ef4444;
  }
  .byok-connection-result svg {
    flex-shrink: 0;
  }
  .byok-result-dismiss {
    margin-left: auto;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .byok-result-dismiss:hover {
    opacity: 1;
  }

  /* ── Disclaimer ──────────────────────────────────────────────────────────── */
  .byok-disclaimer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 14px;
    border: none;
    box-shadow: none;
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
    align-items: flex-start;
  }
  .byok-disclaimer svg {
    flex-shrink: 0;
    margin-top: 0.1rem;
    color: var(--muted);
  }
  .byok-disclaimer__copy {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }
  .byok-disclaimer__copy strong {
    font-size: 0.85rem;
    color: var(--foreground);
  }
  .byok-disclaimer__copy p {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--muted);
  }
  .byok-disclaimer__cost {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    margin-top: 0.35rem !important;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: color-mix(in srgb, #f59e0b 10%, var(--background));
    color: #d97706 !important;
    font-weight: 600 !important;
  }
  .byok-disclaimer__cost svg {
    color: #d97706;
    margin-top: 0.05rem;
  }

  /* ── Provider brand SVGs (native brand colors, no extra styling needed) ─ */
  .byok-provider-svg {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Animations ──────────────────────────────────────────────────────────── */
  .byok-spin {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>
