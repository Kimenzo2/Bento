<script lang="ts">
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { invoke } from "@tauri-apps/api/core";
  import { authStore, setAuthLoginLoading } from "$lib/stores/auth.store";

  async function signIn() {
    setAuthLoginLoading(true);
    try {
      await invoke("begin_google_auth");
    } catch (error) {
      setAuthLoginLoading(false);
      console.error("Session re-authentication failed.", error);
    }
  }
</script>

{#if $authStore.status === "sessionExpired"}
  <div class="auth-session-overlay" role="status" aria-live="polite">
    <section class="auth-session-overlay__card surface-card">
      <div class="auth-session-overlay__copy">
        <h2>Session expired</h2>
        <p>{$authStore.message ?? "Sign in again to continue."}</p>
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
        <span>Sign In</span>
      </button>
    </section>
  </div>
{/if}
