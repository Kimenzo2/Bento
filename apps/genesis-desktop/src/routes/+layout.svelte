<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { isTauri } from "@tauri-apps/api/core";
  import { initEnterprisePolish } from "$lib/enterprise";
  import { hydrateDesktopSettings } from "$lib/desktop/settings";
  import { clearBillingProfile, refreshBillingProfile } from "$lib/stores/billing.store";
  import { hydrateLanguage } from "$lib/stores/language.store";
  import DatabaseUnlockGate from "$lib/components/DatabaseUnlockGate.svelte";
  import LoginPage from "./pages/LoginPage.svelte";
  import AuthPage from "./pages/AuthPage.svelte";
  import AuthSessionOverlay from "$lib/components/AuthSessionOverlay.svelte";
  import {
    authStore,
    setAuthBootstrap,
    setAuthRestored,
    setAuthLoginRequired,
    setAuthSessionExpired,
    setAuthError,
    setAuthLoginLoading,
  } from "$lib/stores/auth.store";

  let { children } = $props();
  let shellTransitioned = false;
  let currentPath = $state(browser ? window.location.pathname : "/");

  function syncCurrentPath() {
    currentPath = window.location.pathname;
  }

  onMount(() => {
    if (!browser) return;

    // Enterprise polish — native-feel behaviors (context menu, zoom, etc.)
    initEnterprisePolish();
    syncCurrentPath();

    // Bootstrap auth state from Rust backend
    (async () => {
      const dbg = async (msg: string) => {
        try { await invoke("write_debug_log", { msg }); } catch { /* ignore */ }
        console.log("[BENTO DEBUG]", msg);
      };

      await dbg("layout onMount started");

      // ── Language + settings bootstrap — non-fatal, never blocks auth ──
      try {
        await dbg("hydrating settings...");
        const settings = await hydrateDesktopSettings();
        await dbg("settings hydrated: " + JSON.stringify(settings.language));
        try { await hydrateLanguage(settings.language?.code ?? "en"); } catch (e) { await dbg("hydrateLanguage failed: " + String(e)); }
      } catch (e) {
        await dbg("hydrateDesktopSettings failed: " + String(e));
      }

      if (!isTauri()) {
        await dbg("not tauri, setting local dev user");
        setAuthRestored({ id: "local-dev", name: "Local Developer", email: "dev@local.dev", avatarUrl: "" });
        clearBillingProfile();
        return;
      }

      await dbg("calling bootstrap_auth_state...");

      const showWindow = async (shell: boolean) => {
        await dbg("showWindow shell=" + shell);
        try {
          await invoke(shell ? "prepare_shell_window" : "prepare_login_window");
          await dbg("showWindow invoke succeeded");
        } catch (e) {
          await dbg("showWindow invoke failed: " + String(e) + ", trying restore_window");
          try { await invoke("restore_window"); } catch (e2) { await dbg("restore_window also failed: " + String(e2)); }
        }
      };

      const enforceUserBoundary = async () => {
        await dbg("enforcing auth user boundary...");
        await invoke("enforce_auth_user_boundary");
        await dbg("auth user boundary enforced");
      };

      let bootstrapDone = false;
      try {
        const bootstrapState = await invoke<{
          status: string;
          user?: { id: string; name: string; email: string; avatarUrl: string };
        }>("bootstrap_auth_state");

        bootstrapDone = true;
        await dbg("bootstrap_auth_state result: " + bootstrapState.status);

        if (bootstrapState.status === "restored" && bootstrapState.user) {
          await enforceUserBoundary();
          shellTransitioned = true;
          clearBillingProfile();
          setAuthBootstrap({ status: "restored", user: bootstrapState.user });
          void refreshBillingProfile();
          void showWindow(true);
        } else {
          clearBillingProfile();
          setAuthLoginRequired();
          await showWindow(false);
        }
      } catch (error) {
        await dbg("bootstrap_auth_state threw: " + String(error));
        if (!bootstrapDone) {
          setAuthLoginRequired();
          await showWindow(false);
        }
      }
    })();

    const historyEvents = ["popstate", "pushState", "replaceState", "hashchange"] as const;
    historyEvents.forEach((eventName) => window.addEventListener(eventName, syncCurrentPath));

    // Listen for auth:success — OAuth completed, transition to shell.
    const unlistenSuccess = listen<{ user: { id: string; name: string; email: string; avatarUrl: string } }>(
      "auth:success",
      async (event) => {
        const { user } = event.payload;

        // ── CRITICAL ORDER ─────────────────────────────────────────────────
        // Update auth state FIRST so the UI unblocks immediately.
        // NEVER await prepare_shell_window before this: if the Tauri invoke
        // hangs for any reason, the app stays on "Signing in..." forever.
        // ───────────────────────────────────────────────────────────────────
        try {
          await invoke("enforce_auth_user_boundary");
          shellTransitioned = true;
          clearBillingProfile();
          setAuthRestored(user);
          setAuthLoginLoading(false);
          void refreshBillingProfile();
        } catch (error) {
          console.error("[Auth] Failed to enforce user data boundary:", error);
          setAuthError("Could not safely switch accounts. Please sign in again.");
          setAuthLoginLoading(false);
          return;
        }

        // Fire-and-forget: maximize window after the UI transition is done.
        void invoke("prepare_shell_window").catch((e: unknown) => {
          console.warn("[Auth] Failed to resize window after login:", e);
        });
      }
    );

    // Listen for auth:session_expired — show non-blocking overlay
    const unlistenExpired = listen<{ message: string }>(
      "auth:session_expired",
      (event) => {
        setAuthSessionExpired(event.payload.message);
      }
    );

    // Listen for auth:error
    const unlistenError = listen<{ message: string }>(
      "auth:error",
      (event) => {
        if (get(authStore).status === "restored") {
          return;
        }
        setAuthError(event.payload.message);
        setAuthLoginLoading(false);
      }
    );

    // ── Wake-from-sleep / visibility recovery ───────────────────────
    // When the laptop wakes from sleep, the webview may reload or the page
    // may become visible again. Re-check the session to avoid showing a
    // stale / logged-out state.
    let checkAuthTimer: ReturnType<typeof setTimeout> | null = null;

    async function checkSessionOnWake() {
      if (!isTauri()) return;
      if (get(authStore).status !== "restored") return;

      try {
        const result = await invoke<{
          status: string;
          user?: { id: string; name: string; email: string; avatarUrl: string };
        }>("check_auth_session");

        if (result.status === "loginRequired") {
          setAuthLoginRequired();
          clearBillingProfile();
        } else if (result.status === "restored" && result.user) {
          setAuthRestored(result.user);
        }
      } catch (error) {
        console.warn("[Auth] check_auth_session failed on wake:", error);
      }
    }

    // Debounced wake check: fires at most once per 10 seconds
    function scheduleWakeCheck() {
      if (checkAuthTimer) clearTimeout(checkAuthTimer);
      checkAuthTimer = setTimeout(checkSessionOnWake, 500);
    }

    // visibilitychange fires when the page becomes visible after sleep
    document.addEventListener("visibilitychange", onVisibilityChange);
    // window focus fires when the window regains focus (also on wake)
    window.addEventListener("focus", onFocus);

    return () => {
      historyEvents.forEach((eventName) => window.removeEventListener(eventName, syncCurrentPath));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      if (checkAuthTimer) clearTimeout(checkAuthTimer);
      void unlistenSuccess.then((fn) => fn());
      void unlistenExpired.then((fn) => fn());
      void unlistenError.then((fn) => fn());
    };

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleWakeCheck();
      }
    }

    function onFocus() {
      scheduleWakeCheck();
    }
  });
</script>

{#if $authStore.status === "restored"}
  <DatabaseUnlockGate>
    {@render children?.()}
    <AuthSessionOverlay />
  </DatabaseUnlockGate>
{:else if currentPath === "/auth"}
  <AuthPage />
{:else}
  <LoginPage />
{/if}
