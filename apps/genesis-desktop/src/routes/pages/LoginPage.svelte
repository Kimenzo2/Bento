<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { isTauri } from "@tauri-apps/api/core";
  import { authStore, setAuthLoginLoading, setAuthError } from "$lib/stores/auth.store";
  import AuthLogo from "$lib/components/auth/AuthLogo.svelte";

  async function handleGoogleSignIn() {
    if ($authStore.loginLoading) return;
    setAuthLoginLoading(true);

    try {
      if (!isTauri()) {
        // Fallback for browser dev: just simulate success
        console.warn("[LoginPage] Not in Tauri environment — can't start Google OAuth");
        setAuthError("Desktop auth requires the Tauri runtime.");
        setAuthLoginLoading(false);
        return;
      }

      await invoke("begin_google_auth");
      // The login loading stays true until auth:success or auth:error is received
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Google sign-in.";
      setAuthError(message);
      setAuthLoginLoading(false);
    }
  }
</script>

<section class="login-page">
  <div class="login-page__card">
    <!-- App Logo via AuthLogo component -->
    <div class="login-page__logo" aria-hidden="true">
      <AuthLogo size={48} />
    </div>

    <!-- App Name -->
    <h1 class="login-page__title">Bento</h1>

    <!-- Subtitle -->
    <p class="login-page__subtitle">Sign in to continue</p>

    <!-- Continue with Google Button -->
    <button
      class="login-page__google-btn"
      type="button"
      onclick={handleGoogleSignIn}
      disabled={$authStore.loginLoading}
    >
      {#if $authStore.loginLoading}
        <span class="login-page__spinner" aria-hidden="true"></span>
      {:else}
        <!-- Google "G" Logo SVG -->
        <svg class="login-page__google-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M19.6 10.2c0-.7-.06-1.36-.18-2H10v3.78h5.38a4.53 4.53 0 0 1-1.96 2.98v2.48h3.18c1.86-1.72 2.94-4.24 2.94-7.24z"
            fill="#4285F4"
          />
          <path
            d="M10 20c2.66 0 4.88-.88 6.52-2.38l-3.18-2.48c-.88.6-2 1-3.34 1-2.56 0-4.74-1.72-5.52-4.02H1.14v2.56C2.76 17.78 6.1 20 10 20z"
            fill="#34A853"
          />
          <path
            d="M4.48 12.12A5.96 5.96 0 0 1 4.1 10c0-.74.14-1.46.38-2.12V5.32H1.14A9.99 9.99 0 0 0 0 10c0 1.64.4 3.18 1.14 4.56l3.34-2.44z"
            fill="#FBBC05"
          />
          <path
            d="M10 4.02c1.44 0 2.74.5 3.76 1.46l2.82-2.82C14.86.98 12.66 0 10 0 6.1 0 2.76 2.22 1.14 5.32l3.34 2.56C5.26 5.74 7.44 4.02 10 4.02z"
            fill="#EA4335"
          />
        </svg>
      {/if}
      <span class="login-page__google-label">{$authStore.loginLoading ? "Signing in…" : "Continue with Google"}</span>
    </button>

    {#if $authStore.message}
      <p class="login-page__message" role="status" aria-live="polite">{$authStore.message}</p>
    {/if}
  </div>
</section>

<style>
  .login-page {
    --background: #08090b;
    --surface: #0f1115;
    --foreground: #f7f7f8;
    --muted: #9a9ca3;
    --muted-foreground: #9a9ca3;
    --border: rgba(255, 255, 255, 0.13);
    --primary: #f7f7f8;
    --primary-foreground: #08090b;
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background);
    color: var(--foreground);
    font-family: var(--font-body, system-ui, sans-serif);
    user-select: none;
    -webkit-user-select: none;
  }

  .login-page__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    width: 100%;
    max-width: 352px;
    padding: 0 24px;
  }

  .login-page__logo {
    color: var(--foreground, #111111);
    margin-bottom: 20px;
  }

  .login-page__title {
    font-family: var(--font-heading, system-ui, sans-serif);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--foreground, #111111);
    margin: 0;
  }

  .login-page__subtitle {
    font-size: 13px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted, #888888);
    margin: 4px 0 32px 0;
  }

  .login-page__google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    height: 48px;
    padding: 0 24px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--foreground);
    color: var(--background);
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease, box-shadow 0.15s ease;
    outline: none;
  }

  .login-page__google-btn:hover:not(:disabled) {
    background: #e9e9eb;
    box-shadow: none;
  }

  .login-page__google-btn:active:not(:disabled) {
    background: #dfe0e3;
  }

  .login-page__google-btn:focus-visible {
    box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.3);
  }

  .login-page__google-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .login-page__google-icon {
    flex-shrink: 0;
  }

  .login-page__google-label {
    flex: 1;
    text-align: center;
  }

  .login-page__message {
    margin: 14px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--muted, #888888);
    text-align: center;
  }

  .login-page__spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(8, 9, 11, 0.22);
    border-top-color: var(--background);
    border-radius: 50%;
    animation: login-spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  @keyframes login-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
