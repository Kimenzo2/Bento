<script lang="ts">
  import { onMount } from "svelte";
  import {
    chatgptSession,
    chatgptReady,
    chatgptServerUrl,
    chatgptDeviceFlow,
    chatgptPlanInfo,
    loadChatGptSession,
    startDeviceFlow,
    startDeviceFlowPolling,
    signOut,
    testConnection,
    validateServerUrl,
    formatExpiry,
    getVerificationUri,
    isNearExpiry,
    openExternalUrl,
    copyToClipboard,
    isExpired,
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
      const expiresAt = Date.now() + flow.expiresIn * 1000;
      cleanupPolling = startDeviceFlowPolling(
        flow.deviceCode, $chatgptServerUrl, flow.interval, expiresAt,
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

<div class="chatgpt-auth">
  <div class="chatgpt-auth__header">
    <BotIcon size={20} />
    <h3>Sign in with ChatGPT</h3>
  </div>
  <p class="chatgpt-auth__desc">
    Use your ChatGPT subscription through your own proxy server. No API key needed.
  </p>

  {#if !$chatgptReady}
    <div class="chatgpt-auth__loading">
      <Loader2Icon size={16} class="spin" />
      <span>Loading...</span>
    </div>
  {:else if $chatgptSession}
    <!-- ── Signed in state ────────────────────────────── -->
    <div class="chatgpt-auth__signed-in">
      <div class="chatgpt-auth__status-badge">
        <CheckCircle2Icon size={14} />
        <span>Signed in</span>
      </div>

      {#if $chatgptPlanInfo}
        <div class="chatgpt-auth__plan">
          <div class="chatgpt-auth__plan-row">
            <span class="chatgpt-auth__label">Plan</span>
            <span class="chatgpt-auth__value">{$chatgptPlanInfo.name}</span>
          </div>
          <div class="chatgpt-auth__plan-row">
            <span class="chatgpt-auth__label">Tier</span>
            <span class="chatgpt-auth__value">
              <span class="chatgpt-auth__tier-badge" class:chatgpt-auth__tier-badge--pro={$chatgptPlanInfo.tier === 'pro'}>
                {$chatgptPlanInfo.tier === 'pro' ? 'Pro' : 'Plus'}
              </span>
            </span>
          </div>
          <div class="chatgpt-auth__plan-row">
            <span class="chatgpt-auth__label">Models</span>
            <span class="chatgpt-auth__value chatgpt-auth__models">
              {$chatgptPlanInfo.models.slice(0, 4).join(', ')}
              {#if $chatgptPlanInfo.models.length > 4}
                <span class="chatgpt-auth__more">+{$chatgptPlanInfo.models.length - 4} more</span>
              {/if}
            </span>
          </div>
          <div class="chatgpt-auth__plan-row">
            <span class="chatgpt-auth__label">Session</span>
            <span class="chatgpt-auth__value"
              class:chatgpt-auth__value--expired={isExpired($chatgptSession.expiresAt)}
              class:chatgpt-auth__value--near-expiry={isNearExpiry($chatgptSession.expiresAt)}
            >
              {isNearExpiry($chatgptSession.expiresAt) ? 'Expires' : 'Expires'} {formatExpiry($chatgptSession.expiresAt)}
            </span>
          </div>
        </div>
      {:else}
        <div class="chatgpt-auth__simple-info">
          <span>Server: {$chatgptSession.serverUrl}</span>
        </div>
      {/if}

      <div class="chatgpt-auth__actions">
        <button class="chatgpt-auth__btn chatgpt-auth__btn--secondary" onclick={async () => { await loadChatGptSession(); }}>
          <RefreshCwIcon size={14} />
          Refresh
        </button>
        <button class="chatgpt-auth__btn chatgpt-auth__btn--danger" onclick={handleSignOut}>
          <LogOutIcon size={14} />
          Sign Out
        </button>
      </div>
    </div>
  {:else if signingIn && $chatgptDeviceFlow}
    <!-- ── Sign-in flow ──────────────────────────────── -->
    <div class="chatgpt-auth__device-flow">
      <div class="chatgpt-auth__device-header">
        <Loader2Icon size={16} class="spin" />
        <span>Waiting for authorization...</span>
      </div>

      <div class="chatgpt-auth__code-box">
        <span class="chatgpt-auth__code-label">Enter this code:</span>
        <div class="chatgpt-auth__code">
          <code>{$chatgptDeviceFlow.userCode}</code>
          <button class="chatgpt-auth__copy-btn" onclick={() => handleCopyCode($chatgptDeviceFlow.userCode)}>
            {#if copied}
              <CheckCircle2Icon size={14} />
            {:else}
              <CopyIcon size={14} />
            {/if}
          </button>
        </div>
      </div>

      <p class="chatgpt-auth__device-desc">
        Open the verification page in your browser, sign in, and enter the code above.
      </p>

      <div class="chatgpt-auth__device-actions">
        <span class="chatgpt-auth__device-link" onclick={() => openExternalUrl(getVerificationUri($chatgptDeviceFlow!))}>
          <ExternalLinkIcon size={12} />
          Open verification page
        </span>
        <button class="chatgpt-auth__btn chatgpt-auth__btn--ghost" onclick={cancelSignIn}>
          <XIcon size={14} />
          Cancel
        </button>
      </div>

      {#if signInError}
        <p class="chatgpt-auth__error">{signInError}</p>
      {/if}
    </div>
  {:else}
    <!-- ── Sign-in form ──────────────────────────────── -->
    <div class="chatgpt-auth__signin-form">
      <div class="chatgpt-auth__field">
        <label class="chatgpt-auth__field-label" for="server-url">
          <ServerIcon size={14} />
          Server URL
        </label>
        <div class="chatgpt-auth__field-row">
          <input
            id="server-url"
            type="text"
            bind:value={$chatgptServerUrl}
            oninput={() => { inputError = null; }}
            onkeydown={handleKeydown}
            placeholder="http://localhost:3001"
            class="chatgpt-auth__input"
            class:chatgpt-auth__input--error={inputError}
          />
          <button
            class="chatgpt-auth__btn chatgpt-auth__btn--secondary"
            onclick={handleTestConnection}
            disabled={testing}
          >
            {#if testing}
              <Loader2Icon size={14} class="spin" />
            {:else}
              <WifiIcon size={14} />
            {/if}
            Test
          </button>
        </div>
        {#if inputError}
          <p class="chatgpt-auth__field-note chatgpt-auth__field-note--err">
            <WifiOffIcon size={12} />
            {inputError}
          </p>
        {:else if testResult}
          <p class="chatgpt-auth__field-note" class:chatgpt-auth__field-note--ok={testResult.ok} class:chatgpt-auth__field-note--err={!testResult.ok}>
            {#if testResult.ok}
              <CheckCircle2Icon size={12} />
            {:else}
              <WifiOffIcon size={12} />
            {/if}
            {testResult.message}
          </p>
        {/if}
      </div>

      <button class="chatgpt-auth__btn chatgpt-auth__btn--primary" onclick={handleSignIn} disabled={signingIn || !($chatgptServerUrl?.trim())}>
        {#if signingIn}
          <Loader2Icon size={16} class="spin" />
        {:else}
          <BotIcon size={16} />
        {/if}
        Sign in with ChatGPT
      </button>

      <p class="chatgpt-auth__desc-small">
        You need a self-hosted proxy server. See setup instructions in the Bento documentation.
      </p>

      {#if signInError}
        <p class="chatgpt-auth__error">{signInError}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .chatgpt-auth {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chatgpt-auth__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chatgpt-auth__header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .chatgpt-auth__desc {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
  }

  .chatgpt-auth__desc-small {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }

  .chatgpt-auth__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    padding: 16px 0;
  }

  /* ── Signed in ───────────────────────────────── */
  .chatgpt-auth__signed-in {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--foreground) 15%, transparent);
    border-radius: 10px;
  }

  .chatgpt-auth__status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: #22c55e;
    padding: 3px 8px;
    background: color-mix(in srgb, #22c55e 12%, transparent);
    border-radius: 6px;
    align-self: flex-start;
  }

  .chatgpt-auth__plan {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .chatgpt-auth__plan-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .chatgpt-auth__label {
    color: var(--muted);
  }

  .chatgpt-auth__value {
    color: var(--foreground);
    font-weight: 500;
    text-align: right;
  }

  .chatgpt-auth__value--expired {
    color: #ef4444;
  }

  .chatgpt-auth__value--near-expiry {
    color: #f59e0b;
  }

  .chatgpt-auth__tier-badge {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--foreground);
  }

  .chatgpt-auth__tier-badge--pro {
    background: color-mix(in srgb, #a855f7 15%, transparent);
    color: #a855f7;
  }

  .chatgpt-auth__models {
    font-size: 12px;
    max-width: 200px;
  }

  .chatgpt-auth__more {
    color: var(--muted);
    font-size: 11px;
  }

  .chatgpt-auth__simple-info {
    font-size: 12px;
    color: var(--muted);
  }

  .chatgpt-auth__actions {
    display: flex;
    gap: 8px;
  }

  /* ── Device flow ──────────────────────────────── */
  .chatgpt-auth__device-flow {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 16px;
    border: 1px solid color-mix(in srgb, var(--foreground) 15%, transparent);
    border-radius: 10px;
    text-align: center;
  }

  .chatgpt-auth__device-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
  }

  .chatgpt-auth__code-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .chatgpt-auth__code-label {
    font-size: 12px;
    color: var(--muted);
  }

  .chatgpt-auth__code {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    border-radius: 8px;
    border: 1px dashed color-mix(in srgb, var(--foreground) 25%, transparent);
  }

  .chatgpt-auth__code code {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
  }

  .chatgpt-auth__copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .chatgpt-auth__copy-btn:hover {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--foreground);
  }

  .chatgpt-auth__device-desc {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    max-width: 260px;
    line-height: 1.4;
  }

  .chatgpt-auth__device-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .chatgpt-auth__device-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--accent, #3b82f6);
    cursor: pointer;
    text-decoration: none;
  }

  .chatgpt-auth__device-link:hover {
    text-decoration: underline;
  }

  /* ── Sign in form ──────────────────────────────── */
  .chatgpt-auth__signin-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chatgpt-auth__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .chatgpt-auth__field-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }

  .chatgpt-auth__field-row {
    display: flex;
    gap: 6px;
  }

  .chatgpt-auth__input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 3%, var(--background));
    color: var(--foreground);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .chatgpt-auth__input:focus {
    border-color: color-mix(in srgb, var(--foreground) 40%, transparent);
  }
  .chatgpt-auth__input--error {
    border-color: #ef4444;
  }

  .chatgpt-auth__input::placeholder {
    color: var(--muted);
  }

  .chatgpt-auth__field-note {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 6px;
  }

  .chatgpt-auth__field-note--ok {
    color: #22c55e;
    background: color-mix(in srgb, #22c55e 10%, transparent);
  }

  .chatgpt-auth__field-note--err {
    color: #ef4444;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  /* ── Buttons ──────────────────────────────────── */
  .chatgpt-auth__btn {
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

  .chatgpt-auth__btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .chatgpt-auth__btn--primary {
    background: var(--foreground);
    color: var(--background);
  }

  .chatgpt-auth__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .chatgpt-auth__btn--secondary {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--foreground);
  }

  .chatgpt-auth__btn--secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--foreground) 16%, transparent);
  }

  .chatgpt-auth__btn--danger {
    background: color-mix(in srgb, #ef4444 12%, transparent);
    color: #ef4444;
  }

  .chatgpt-auth__btn--danger:hover:not(:disabled) {
    background: color-mix(in srgb, #ef4444 20%, transparent);
  }

  .chatgpt-auth__btn--ghost {
    background: transparent;
    color: var(--muted);
    padding: 4px 8px;
  }

  .chatgpt-auth__btn--ghost:hover:not(:disabled) {
    color: var(--foreground);
  }

  .chatgpt-auth__error {
    margin: 0;
    font-size: 12px;
    color: #ef4444;
    padding: 6px 8px;
    background: color-mix(in srgb, #ef4444 10%, transparent);
    border-radius: 6px;
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
