<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

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
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import ServerIcon from "@lucide/svelte/icons/server";
  import WifiIcon from "@lucide/svelte/icons/wifi";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  import XIcon from "@lucide/svelte/icons/x";



  let testing = $state(false);
  let testResult = $state<{ ok: boolean; message: string } | null>(null);
  let signingIn = $state(false);
  let signInError = $state<string | null>(null);
  let inputError = $state<string | null>(null);
  let cleanupPolling: (() => void) | null = null;
  let copied = $state(false);

  onMount(() => {
    signInError = null;
    loadChatGptSession();
  });

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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !signingIn) {
      handleTestConnection();
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
    const polling = cleanupPolling;
    cleanupPolling = null;
    polling?.();
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
    signInError = null;
    chatgptDeviceFlow.set(null);
  }
</script>

<div class="cgpt-inner">
  {#if !$chatgptReady}
    <div class="cgpt-loading">
      <Loader2Icon size={14} class="cgpt-spin" />
      <span>Loading...</span>
    </div>
  {:else if $chatgptSession}
    <!-- ── Signed in state ────────────────────────────── -->
    <div class="cgpt-signed">
      <span class="cgpt-badge cgpt-badge--ok">
        <CheckCircle2Icon size={11} />
        Signed in
      </span>

      <div class="cgpt-info">
        <div class="cgpt-info__row">
          <span class="cgpt-info__label">Account</span>
          <span class="cgpt-info__value">
            {$chatgptSession.user?.name || $chatgptSession.user?.email || $chatgptSession.user?.accountId || 'Connected'}
          </span>
        </div>
        {#if $chatgptSession.user?.plan}
          <div class="cgpt-info__row">
            <span class="cgpt-info__label">Plan</span>
            <span class="cgpt-info__value">{$chatgptSession.user.plan}</span>
          </div>
        {/if}
      </div>

      <div class="cgpt-actions">
        <button class="cgpt-btn cgpt-btn--subtle" onclick={async () => { await loadChatGptSession(); }}>
          <RefreshCwIcon size={13} />
          Refresh
        </button>
        <button class="cgpt-btn cgpt-btn--danger" onclick={handleSignOut}>
          <LogOutIcon size={13} />
          Sign Out
        </button>
      </div>
    </div>
  {:else if signingIn && $chatgptDeviceFlow}
    <!-- ── Sign-in flow ──────────────────────────────── -->
    <div class="cgpt-flow">
      <div class="cgpt-flow__header">
        <Loader2Icon size={14} class="cgpt-spin" />
        <span>Waiting for authorization...</span>
      </div>

      <div class="cgpt-code">
        <span class="cgpt-code__label">Enter this code:</span>
        <div class="cgpt-code__box">
          <code>{$chatgptDeviceFlow.userCode}</code>
          <button class="cgpt-btn cgpt-btn--icon" onclick={() => handleCopyCode($chatgptDeviceFlow.userCode)}>
            {#if copied}
              <CheckCircle2Icon size={14} />
            {:else}
              <CopyIcon size={14} />
            {/if}
          </button>
        </div>
      </div>

      <p class="cgpt-flow__desc">
        Open the verification page in your browser, sign in, and enter the code above.
      </p>

      <div class="cgpt-flow__actions">
        <span class="cgpt-link" onclick={() => openExternalUrl(getVerificationUri($chatgptDeviceFlow!))}>
          <ExternalLinkIcon size={12} />
          Open verification page
        </span>
        <button class="cgpt-btn cgpt-btn--subtle" onclick={cancelSignIn}>
          <XIcon size={13} />
          Cancel
        </button>
      </div>

      {#if signInError}
        <p class="cgpt-error">{signInError}</p>
      {/if}
    </div>
  {:else}
    <!-- ── Sign-in form ──────────────────────────────── -->
    <div class="cgpt-form">
      <div class="cgpt-field">
        <label class="cgpt-field__label" for="cgpt-server-url">
          <ServerIcon size={13} />
          Server URL
        </label>
        <div class="cgpt-field__row">
          <input
            id="cgpt-server-url"
            type="text"
            bind:value={$chatgptServerUrl}
            oninput={() => { inputError = null; }}
            onkeydown={handleKeydown}
            placeholder="http://localhost:3001"
            class="cgpt-input"
            class:cgpt-input--error={inputError}
          />
          <button
            class="cgpt-btn cgpt-btn--subtle"
            onclick={handleTestConnection}
            disabled={testing}
          >
            {#if testing}
              <Loader2Icon size={13} class="cgpt-spin" />
            {:else}
              <WifiIcon size={13} />
            {/if}
            Test
          </button>
        </div>
        {#if inputError}
          <p class="cgpt-note cgpt-note--err">
            <WifiOffIcon size={11} />
            {inputError}
          </p>
        {:else if testResult}
          <p class="cgpt-note" class:cgpt-note--ok={testResult.ok} class:cgpt-note--err={!testResult.ok}>
            {#if testResult.ok}
              <CheckCircle2Icon size={11} />
            {:else}
              <WifiOffIcon size={11} />
            {/if}
            {testResult.message}
          </p>
        {/if}
      </div>

      <button class="cgpt-btn cgpt-btn--primary" onclick={handleSignIn} disabled={signingIn || !($chatgptServerUrl?.trim())}>
        {#if signingIn}
          <Loader2Icon size={14} class="cgpt-spin" />
        {:else}
          <BotIcon size={14} />
        {/if}
        Sign in with ChatGPT
      </button>

      <p class="cgpt-hint">
        You need a self-hosted proxy server. See setup instructions in the Bento documentation.
      </p>

      {#if signInError}
        <p class="cgpt-error">{signInError}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cgpt-inner {
    display: grid;
    gap: 0.85rem;
  }

  .cgpt-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
    font-size: 0.85rem;
    padding: 0.5rem 0;
  }

  /* ── Signed in ───────────────────────────────── */
  .cgpt-signed {
    display: grid;
    gap: 0.75rem;
  }
  .cgpt-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 550;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    width: fit-content;
  }
  .cgpt-badge--ok {
    background: color-mix(in srgb, oklch(0.63 0.128 151.4) 12%, transparent);
    color: oklch(0.63 0.128 151.4);
  }

  .cgpt-info {
    display: grid;
    gap: 0.35rem;
  }
  .cgpt-info__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .cgpt-info__label {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .cgpt-info__value {
    font-size: 0.85rem;
    font-weight: 550;
    color: var(--foreground);
    text-align: right;
  }

  .cgpt-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* ── Device flow ──────────────────────────────── */
  .cgpt-flow {
    display: grid;
    gap: 0.75rem;
    align-items: center;
    text-align: center;
  }
  .cgpt-flow__header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--muted);
    font-size: 0.85rem;
  }
  .cgpt-code {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .cgpt-code__label {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .cgpt-code__box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border: 1px dashed color-mix(in srgb, var(--foreground) 12%, transparent);
    border-radius: 8px;
  }
  .cgpt-code__box code {
    font-size: 1.15rem;
    font-weight: 550;
    letter-spacing: 4px;
    font-family: var(--font-mono, monospace);
  }
  .cgpt-flow__desc {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
    max-width: 260px;
    line-height: 1.4;
  }
  .cgpt-flow__actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }
  .cgpt-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--primary);
    font-size: 0.82rem;
    font-weight: 550;
    cursor: pointer;
  }
  .cgpt-link:hover {
    text-decoration: underline;
  }

  /* ── Sign in form ──────────────────────────────── */
  .cgpt-form {
    display: grid;
    gap: 0.85rem;
  }
  .cgpt-field {
    display: grid;
    gap: 0.4rem;
  }
  .cgpt-field__label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    font-weight: 550;
    color: var(--muted);
  }
  .cgpt-field__row {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }
  .cgpt-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .cgpt-input:focus {
    border-color: var(--primary);
  }
  .cgpt-input--error {
    border-color: oklch(0.637 0.208 25.331);
  }
  .cgpt-input::placeholder {
    color: var(--muted);
  }

  .cgpt-note {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0;
    font-size: 0.78rem;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
  }
  .cgpt-note--ok {
    color: oklch(0.63 0.128 151.4);
    background: color-mix(in srgb, oklch(0.63 0.128 151.4) 8%, transparent);
  }
  .cgpt-note--err {
    color: oklch(0.637 0.208 25.331);
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 8%, transparent);
  }

  .cgpt-hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    line-height: 1.4;
  }

  .cgpt-error {
    margin: 0;
    font-size: 0.82rem;
    color: oklch(0.637 0.208 25.331);
    padding: 0.45rem 0.65rem;
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 8%, transparent);
    border-radius: 8px;
  }

  /* ── Buttons ──────────────────────────────────── */
  .cgpt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 550;
    cursor: pointer;
    transition: all 0.12s ease;
    white-space: nowrap;
    background: transparent;
    color: var(--foreground);
  }
  .cgpt-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cgpt-btn--primary {
    border-color: var(--foreground);
    background: var(--foreground);
    color: var(--background);
    align-self: flex-start;
  }
  .cgpt-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  .cgpt-btn--subtle {
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  .cgpt-btn--subtle:hover:not(:disabled) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
  }
  .cgpt-btn--danger {
    border-color: transparent;
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 10%, transparent);
    color: oklch(0.637 0.208 25.331);
  }
  .cgpt-btn--danger:hover:not(:disabled) {
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 18%, transparent);
  }
  .cgpt-btn--icon {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  .cgpt-btn--icon:hover:not(:disabled) {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }

  .cgpt-spin {
    animation: cgpt-spin 0.8s linear infinite;
  }
  @keyframes cgpt-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cgpt-spin { animation: none; }
  }
</style>
