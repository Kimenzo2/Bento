<script lang="ts">
  import { onMount } from "svelte";
  import {
    chatgptSession,
    chatgptReady,
    chatgptServerUrl,
    chatgptDeviceFlow,
    loadChatGptSession,
    startDeviceFlow,
    startDeviceFlowPolling,
    signOut,
    testConnection,
    validateServerUrl,
    formatExpiry,
    getVerificationUri,
    openExternalUrl,
    copyToClipboard,
  } from "$lib/stores/chatgpt-auth.store";

  import BotIcon from "@lucide/svelte/icons/bot";
  import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import ServerIcon from "@lucide/svelte/icons/server";
  import WifiIcon from "@lucide/svelte/icons/wifi";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let testing = $state(false);
  let testResult = $state<{ ok: boolean; message: string } | null>(null);
  let signingIn = $state(false);
  let signInError = $state<string | null>(null);
  let inputError = $state<string | null>(null);
  let cleanupPolling: (() => void) | null = null;
  let copied = $state(false);

  onMount(() => {
    loadChatGptSession();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !signingIn) {
      handleTestConnection();
    }
  }

  async function handleTestConnection() {
    inputError = validateServerUrl($chatgptServerUrl);
    if (inputError) return;

    testing = true;
    testResult = null;
    try {
      const result = await testConnection($chatgptServerUrl);
      testResult = {
        ok: result.ok,
        message: result.ok
          ? `Connected (${result.latencyMs}ms)`
          : result.error || "Connection failed",
      };
    } catch (e) {
      testResult = { ok: false, message: String(e) };
    } finally {
      testing = false;
    }
  }

  async function handleSignIn() {
    inputError = validateServerUrl($chatgptServerUrl);
    if (inputError) return;

    signInError = null;
    signingIn = true;
    try {
      const flow = await startDeviceFlow($chatgptServerUrl);
      const uri = getVerificationUri($chatgptDeviceFlow!);
      openExternalUrl(uri);
      cleanupPolling = startDeviceFlowPolling(
        flow.interval, flow.expiresAt,
        (msg) => { signInError = msg; signingIn = false; },
        () => { signInError = "Code expired. Please try again."; signingIn = false; },
      );
    } catch (e) {
      signInError = String(e);
      signingIn = false;
    }
  }

  async function handleSignOut() {
    cleanupPolling?.();
    cleanupPolling = null;
    await signOut();
  }

  async function handleCopyCode(code: string) {
    copyToClipboard(code, () => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }

  function cancelSignIn() {
    cleanupPolling?.();
    cleanupPolling = null;
    signingIn = false;
    chatgptDeviceFlow.set(null);
  }
</script>

<div class="chatgpt-tab">
  {#if !$chatgptReady}
    <div class="chatgpt-tab__loading">
      <Loader2Icon size={16} class="spin" />
      <span>Loading...</span>
    </div>
  {:else if $chatgptSession}
    <!-- ── Signed in ──────────────────────────────── -->
    <div class="chatgpt-tab__status">
      <div class="chatgpt-tab__badge chatgpt-tab__badge--active">
        <CheckCircle2Icon size={14} />
        <span>Signed in with ChatGPT</span>
      </div>

      <div class="chatgpt-tab__plan">
        {#if $chatgptSession.user?.name || $chatgptSession.user?.email}
          <div class="chatgpt-tab__row">
            <span>Account</span>
            <span>{$chatgptSession.user?.name || $chatgptSession.user?.email}</span>
          </div>
        {/if}
        {#if $chatgptSession.user?.plan}
          <div class="chatgpt-tab__row">
            <span>Plan</span>
            <span>{$chatgptSession.user.plan}</span>
          </div>
        {/if}
      </div>

      <button class="chatgpt-tab__btn chatgpt-tab__btn--outline" onclick={handleSignOut}>
        <LogOutIcon size={14} />
        Sign Out
      </button>
    </div>
  {:else if signingIn && $chatgptDeviceFlow}
    <!-- ── Device code ────────────────────────────── -->
    <div class="chatgpt-tab__device">
      <div class="chatgpt-tab__device-header">
        <Loader2Icon size={16} class="spin" />
        <span>Authorizing...</span>
      </div>
      <div class="chatgpt-tab__code">
        <code>{$chatgptDeviceFlow.userCode}</code>
        <button class="chatgpt-tab__icon-btn" onclick={() => handleCopyCode($chatgptDeviceFlow.userCode)} use:tooltip={{ text: copied ? 'Copied' : 'Copy code' }}>
          {#if copied} <CheckCircle2Icon size={14} /> {:else} <CopyIcon size={14} /> {/if}
        </button>
      </div>
      <p class="chatgpt-tab__hint">
        Enter this code on the verification page
      </p>
      <div class="chatgpt-tab__device-actions">
        <button class="chatgpt-tab__btn chatgpt-tab__btn--ghost" onclick={() => openExternalUrl(getVerificationUri($chatgptDeviceFlow!))}>
          <ExternalLinkIcon size={12} />
          Open page
        </button>
        <button class="chatgpt-tab__btn chatgpt-tab__btn--ghost" onclick={cancelSignIn}>
          <XIcon size={12} />
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <!-- ── Sign in prompt ─────────────────────────── -->
    <div class="chatgpt-tab__prompt">
      <BotIcon size={24} class="chatgpt-tab__prompt-icon" />
      <p class="chatgpt-tab__prompt-text">
        Sign in with your ChatGPT subscription to use AI without an API key.
      </p>

      <div class="chatgpt-tab__server-field">
        <ServerIcon size={14} />
        <input
          type="text"
          bind:value={$chatgptServerUrl}
          oninput={() => { inputError = null; }}
          onkeydown={handleKeydown}
          placeholder="Server URL (e.g. http://localhost:3001)"
          class="chatgpt-tab__input"
          class:chatgpt-tab__input--error={inputError}
        />
        <button
          class="chatgpt-tab__btn chatgpt-tab__btn--sm"
          onclick={handleTestConnection}
          disabled={testing}
        >
          {#if testing}
            <Loader2Icon size={12} class="spin" />
          {:else}
            <WifiIcon size={12} />
          {/if}
        </button>
      </div>
      {#if inputError}
        <p class="chatgpt-tab__test-result chatgpt-tab__test-result--err">
          <WifiOffIcon size={12} />
          {inputError}
        </p>
      {:else if testResult}
        <p class="chatgpt-tab__test-result" class:chatgpt-tab__test-result--ok={testResult.ok} class:chatgpt-tab__test-result--err={!testResult.ok}>
          {#if testResult.ok} <CheckCircle2Icon size={12} /> {:else} <WifiOffIcon size={12} /> {/if}
          {testResult.message}
        </p>
      {/if}

      <button class="chatgpt-tab__btn chatgpt-tab__btn--primary" onclick={handleSignIn} disabled={signingIn || !($chatgptServerUrl?.trim())}>
        {#if signingIn}
          <Loader2Icon size={16} class="spin" />
        {:else}
          <BotIcon size={16} />
        {/if}
        Sign in with ChatGPT
      </button>

      {#if signInError}
        <p class="chatgpt-tab__error">{signInError}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chatgpt-tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 0;
  }

  .chatgpt-tab__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    padding: 16px 0;
  }

  /* ── Status (signed in) ──────────────────────── */
  .chatgpt-tab__status {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .chatgpt-tab__badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    align-self: flex-start;
  }

  .chatgpt-tab__badge--active {
    color: #22c55e;
    background: color-mix(in srgb, #22c55e 12%, transparent);
  }

  .chatgpt-tab__plan {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chatgpt-tab__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--muted);
  }

  .chatgpt-tab__row span:last-child {
    color: var(--foreground);
    font-weight: 500;
  }

  .chatgpt-tab__tier--pro {
    color: #a855f7;
  }

  .chatgpt-tab__row .chatgpt-tab__expired {
    color: #ef4444;
  }

  .chatgpt-tab__row .chatgpt-tab__near-expiry {
    color: #f59e0b;
  }

  /* ── Device code ────────────────────────────── */
  .chatgpt-tab__device {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .chatgpt-tab__device-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }

  .chatgpt-tab__code {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    border-radius: 8px;
    border: 1px dashed color-mix(in srgb, var(--foreground) 25%, transparent);
  }

  .chatgpt-tab__code code {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 3px;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
  }

  .chatgpt-tab__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .chatgpt-tab__icon-btn:hover {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--foreground);
  }

  .chatgpt-tab__hint {
    font-size: 12px;
    color: var(--muted);
    margin: 0;
  }

  .chatgpt-tab__device-actions {
    display: flex;
    gap: 8px;
  }

  /* ── Prompt (not signed in) ─────────────────── */
  .chatgpt-tab__prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .chatgpt-tab__prompt-icon {
    color: color-mix(in srgb, var(--foreground) 30%, transparent);
  }

  .chatgpt-tab__prompt-text {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
    max-width: 280px;
  }

  .chatgpt-tab__server-field {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    max-width: 320px;
  }

  .chatgpt-tab__input {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
    color: var(--foreground);
    font-size: 12px;
    font-family: inherit;
    outline: none;
  }

  .chatgpt-tab__input:focus {
    border-color: color-mix(in srgb, var(--foreground) 35%, transparent);
  }
  .chatgpt-tab__input--error {
    border-color: #ef4444;
  }

  .chatgpt-tab__test-result {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 4px;
    max-width: 320px;
  }

  .chatgpt-tab__test-result--ok {
    color: #22c55e;
    background: color-mix(in srgb, #22c55e 10%, transparent);
  }

  .chatgpt-tab__test-result--err {
    color: #ef4444;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  /* ── Buttons ────────────────────────────────── */
  .chatgpt-tab__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
    white-space: nowrap;
  }

  .chatgpt-tab__btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .chatgpt-tab__btn--primary {
    background: var(--foreground);
    color: var(--background);
    width: 100%;
    max-width: 320px;
  }

  .chatgpt-tab__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .chatgpt-tab__btn--outline {
    background: transparent;
    color: #ef4444;
    border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
  }

  .chatgpt-tab__btn--outline:hover {
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .chatgpt-tab__btn--sm {
    padding: 6px 10px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--muted);
  }

  .chatgpt-tab__btn--sm:hover {
    background: color-mix(in srgb, var(--foreground) 14%, transparent);
    color: var(--foreground);
  }

  .chatgpt-tab__btn--ghost {
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    padding: 4px 8px;
  }

  .chatgpt-tab__btn--ghost:hover {
    color: var(--foreground);
  }

  .chatgpt-tab__error {
    margin: 0;
    font-size: 12px;
    color: #ef4444;
    padding: 6px 8px;
    background: color-mix(in srgb, #ef4444 10%, transparent);
    border-radius: 6px;
    max-width: 320px;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin { animation: none; }
  }
</style>
