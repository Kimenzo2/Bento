<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  /**
   * DatabaseUnlockGate
   *
   * ONLY shown when status === 'Locked' (DB is encrypted and the key is
   * not in memory). NOT shown on first launch (NotConfigured) — the app
   * runs normally and the user can optionally enable encryption from Settings.
   */

  import { onMount } from "svelte";
  import LockIcon from "@lucide/svelte/icons/lock";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";

  import {
    isDbLocked,
    cryptoLoading,
    cryptoError,
    unlockDatabase,
    hydrateCryptoStatus,
  } from "$lib/stores/crypto.store";

  let { children }: { children?: import("svelte").Snippet } = $props();

  let password = $state("");
  let showPassword = $state(false);
  let localError = $state<string | null>(null);

  let gateVisible = $derived($isDbLocked);
  let loading = $derived($cryptoLoading);
  let error = $derived(localError ?? $cryptoError);

  async function handleSubmit() {
    if (!password || loading) return;
    localError = null;
    try {
      await unlockDatabase(password);
    } catch {
      // error surfaced via cryptoStore
    } finally {
      password = "";
    }
  }

  onMount(() => {
    void hydrateCryptoStatus();
  });
</script>

{#if gateVisible}
  <div class="db-gate" role="dialog" aria-modal="true" aria-label="Unlock database">
    <div class="db-gate__card">

      <div class="db-gate__icon-wrap">
        <LockIcon size={28} />
      </div>

      <h1 class="db-gate__title">Unlock Bento</h1>
      <p class="db-gate__subtitle">
        Enter your master password to decrypt and open your database.
      </p>

      <div class="db-gate__field">
        <label for="db-pw" class="db-gate__label">Master Password</label>
        <div class="db-gate__input-wrap">
          <input
            id="db-pw"
            type={showPassword ? "text" : "password"}
            class="db-gate__input"
            placeholder="Enter your master password…"
            bind:value={password}
            onkeydown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            autocomplete="current-password"
            spellcheck="false"
          />
          <button
            type="button"
            class="db-gate__toggle-vis"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onclick={() => (showPassword = !showPassword)}
          >
            {#if showPassword}<EyeOffIcon size={15} />{:else}<EyeIcon size={15} />{/if}
          </button>
        </div>
      </div>

      {#if error}
        <p class="db-gate__error" role="alert">{error}</p>
      {/if}

      <button
        type="button"
        class="db-gate__submit"
        disabled={loading || password.length === 0}
        onclick={() => void handleSubmit()}
      >
        {#if loading}
          <span class="db-gate__spinner"></span>Unlocking…
        {:else}
          Unlock
        {/if}
      </button>

      <p class="db-gate__footnote">
        Your data is encrypted at rest with AES-256 encryption.
        The key exists only in memory during your session.
      </p>
    </div>
  </div>
{:else}
  {@render children?.()}
{/if}

<style>
  .db-gate {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: grid;
    place-items: center;
    background: var(--background);
    padding: 1.5rem;
  }

  .db-gate__card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    max-width: 22rem;
  }

  .db-gate__icon-wrap {
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 1rem;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    margin-bottom: 0.25rem;
  }

  .db-gate__title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 1.45rem;
    font-weight: 550;
    color: var(--foreground);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .db-gate__subtitle {
    margin: 0;
    font-size: 0.88rem;
    color: var(--muted-foreground);
    line-height: 1.55;
  }

  .db-gate__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .db-gate__label {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .db-gate__input-wrap {
    position: relative;
  }

  .db-gate__input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    padding: 0.7rem 2.5rem 0.7rem 0.85rem;
    color: var(--foreground);
    font-size: 0.95rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 120ms ease;
  }

  .db-gate__input:focus {
    border-color: var(--primary);
  }

  .db-gate__toggle-vis {
    position: absolute;
    right: 0.65rem;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0.2rem;
    display: grid;
    place-items: center;
  }

  .db-gate__error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--destructive);
    background: color-mix(in srgb, var(--destructive) 8%, var(--background));
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
  }

  .db-gate__submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    border: none;
    border-radius: 12px;
    background: var(--primary);
    color: var(--primary-foreground);
    padding: 0.8rem 1.25rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 120ms ease;
    min-height: 2.8rem;
  }

  .db-gate__submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .db-gate__spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--primary-foreground);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .db-gate__footnote {
    margin: 0;
    font-size: 0.75rem;
    color: var(--muted-foreground);
    line-height: 1.5;
    text-align: center;
    opacity: 0.7;
  }
</style>
