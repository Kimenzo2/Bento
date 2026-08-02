<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { authStore, setAuthLoginLoading } from "$lib/stores/auth.store";
  import { openExternal } from "$lib/desktop/open-external";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { trackEvent } from "$lib/ipc";

  let _t = $derived.by(() => createTranslator($activeBundle));

  async function signIn() {
    trackEvent("auth", "session_overlay_sign_in");
    setAuthLoginLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const authUrl = await invoke<string>("begin_google_auth");
      await openExternal(authUrl);
      trackEvent("auth", "session_overlay_browser_opened");
    } catch (error) {
      trackEvent("auth", "session_overlay_error", { error: String(error) });
      setAuthLoginLoading(false);
      console.error("Session re-authentication failed.", error);
    }
  }
</script>

{#if $authStore.status === "sessionExpired"}
  <div class="auth-session-overlay" role="status" aria-live="polite">
    <section class="auth-session-overlay__card surface-card">
      <div class="auth-session-overlay__copy">
        <h2>{_t('shellSessionExpired')}</h2>
        <p>{$authStore.message ?? _t('shellSessionExpiredDesc')}</p>
      </div>
      <button
        type="button"
        class="auth-session-overlay__button"
        disabled={$authStore.loginLoading}
        onclick={() => void signIn()}
      >
        {#if $authStore.loginLoading}
          <LoaderCircleIcon class="animate-spin" size={16} />
        {/if}
        <span>{_t('commonSignIn')}</span>
      </button>
    </section>
  </div>
{/if}
