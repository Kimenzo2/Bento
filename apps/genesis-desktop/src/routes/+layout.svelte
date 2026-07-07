<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  // ── Island/Agent windows: bare render, no shell/auth ────────────────
  let isIsland = $state(false);
  let isAgent = $state(false);
  import { initEnterprisePolish } from "$lib/enterprise";
  import { hydrateDesktopSettings } from "$lib/desktop/settings";
  import { clearBillingProfile, refreshBillingProfile } from "$lib/stores/billing.store";
  import { hydrateLanguage } from "$lib/stores/language.store";
  import { getEditorFontFamily, fontPairings } from "$lib/data/preferences";
  import { initJournalFont } from "$lib/stores/journal-font.store";
  import { initNotesFont } from "$lib/stores/notes-font.store";
  import { openExternal } from "$lib/desktop/open-external";

  function applyEditorFont(fontPairingId: string) {
    if (!browser) return;
    const fontFamily = getEditorFontFamily(fontPairingId);
    document.documentElement.style.setProperty('--editor-font-family', fontFamily);
    // Set heading font from the pairing
    const pairing = fontPairings.find(p => p.id === fontPairingId);
    if (pairing) {
      document.documentElement.style.setProperty('--editor-font-family-heading', pairing.heading);
    }
  }
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
    setLoginUrl,
  } from "$lib/stores/auth.store";

  let { children } = $props();
  let shellTransitioned = false;

  onMount(() => {
    if (!browser) return;

    // Island/Agent windows: render only their content, no auth bootstrap
    const windowKind = isTauri() ? getCurrentWindow().label : window.location.pathname;
    isIsland = windowKind === "island" || windowKind === "/island";
    isAgent = windowKind === "agent" || windowKind === "/agent";
    if (isIsland || isAgent) return;

    // Enterprise polish — native-feel behaviors (context menu, zoom, etc.)
    initEnterprisePolish();

    console.log("[LAYOUT] onMount running, path=" + window.location.pathname);

    // HMR guard: prevent stale hot-reload instances from running duplicate bootstrap
    if ((window as any).__bentoAuthBootstrapping) {
      console.log("[LAYOUT] auth bootstrap already running — skipping duplicate HMR instance");
      return;
    }
    (window as any).__bentoAuthBootstrapping = true;

    const done = () => { (window as any).__bentoAuthBootstrapping = false; };

    // Bootstrap auth state from Rust backend
    (async () => {
      const dbg = async (msg: string) => {
        console.log("[BENTO DEBUG]", msg);
        try {
          await Promise.race([
            invoke("write_debug_log", { msg }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("dbg timeout")), 2000)),
          ]);
        } catch { /* ignore */ }
      };

      await dbg("layout onMount started");

      if (isTauri()) {
        await dbg("calling bootstrap_auth_state...");

        const invokeWithTimeout = <T>(cmd: string, args?: Record<string, unknown>, ms = 5000): Promise<T> =>
          Promise.race([
            invoke<T>(cmd, args),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${cmd} timed out after ${ms}ms`)), ms)),
          ]);

        const showWindow = async (shell: boolean) => {
          await dbg("showWindow shell=" + shell);
          try {
            await invokeWithTimeout(shell ? "prepare_shell_window" : "prepare_login_window");
            await dbg("showWindow invoke succeeded");
          } catch (e) {
            await dbg("showWindow invoke failed: " + String(e) + ", trying restore_window");
            try { await invokeWithTimeout("restore_window"); } catch (e2) { await dbg("restore_window also failed: " + String(e2)); }
          }
        };

        const enforceUserBoundary = async () => {
          await dbg("enforcing auth user boundary...");
          await invoke("enforce_auth_user_boundary");
          await dbg("auth user boundary enforced");
        };

        let bootstrapDone = false;
        try {
          const bootstrapState = await Promise.race([
            invoke<{
              status: string;
              user?: { id: string; name: string; email: string; avatarUrl: string };
            }>("bootstrap_auth_state"),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("bootstrap_auth_state timed out after 10s")), 10000)
            ),
          ]);

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
            await startOAuth();
          }
        } catch (error) {
          await dbg("bootstrap_auth_state threw: " + String(error));
          if (!bootstrapDone) {
            setAuthLoginRequired();
            await showWindow(false);
            await startOAuth();
          }
        }

        // ── OAuth flow: start server, open browser, poll for success ──
        async function startOAuth() {
          await dbg("starting OAuth flow inline...");
          try {
            const authUrl = await invokeWithTimeout<string>("begin_google_auth", undefined, 15000);
            await dbg("OAuth URL obtained: " + authUrl);
            setLoginUrl(authUrl);

            await dbg("auto-opening browser...");
            try {
              await openExternal(authUrl);
              await dbg("browser auto-opened successfully");
            } catch (e) {
              await dbg("auto-open browser failed: " + String(e));
            }

            // Poll for auth success (fallback in case listen doesn't register)
            let pollCount = 0;
            const POLL_MAX = 90;
            const checkSession = async () => {
              if (get(authStore).status === "restored") return;
              pollCount++;
              if (pollCount > POLL_MAX) return;
                try {
                  const result = await invokeWithTimeout<{
                    status: string;
                    user?: { id: string; name: string; email: string; avatarUrl: string };
                  }>("check_auth_session", undefined, 5000);
                await dbg("auth poll #" + pollCount + ": " + result.status);
                if (result.status === "restored" && result.user) {
                  await dbg("auth restored via poll!");
                  try { await invoke("enforce_auth_user_boundary"); } catch {}
                  clearBillingProfile();
                  setAuthRestored(result.user);
                  setAuthLoginLoading(false);
                  void refreshBillingProfile();
                  void invoke("prepare_shell_window");
                  return;
                }
              } catch {}
              setTimeout(checkSession, 2000);
            };
            setTimeout(checkSession, 2000);
          } catch (e) {
            await dbg("OAuth start failed: " + String(e));
          }
        }
      } else {
        await dbg("not tauri, setting local dev user");
        setAuthRestored({ id: "local-dev", name: "Local Developer", email: "dev@local.dev", avatarUrl: "" });
        clearBillingProfile();
      }

      // ── Language + settings hydration — non-fatal, never blocks auth ──
      (async () => {
        try {
          await dbg("hydrating settings...");
          const settings = await hydrateDesktopSettings();
          await dbg("settings hydrated: " + JSON.stringify(settings.language));
          try { await hydrateLanguage(settings.language?.code ?? "en"); } catch (e) { await dbg("hydrateLanguage failed: " + String(e)); }
          applyEditorFont(settings.appearance.fontPairingId);
          initJournalFont();
          initNotesFont();
        } catch (e) {
          await dbg("hydrateDesktopSettings failed: " + String(e));
        }
      })();

      done();
    })();

    // Listen for auth events — Tauri events only (guarded for browser mode)
    let unlistenSuccess: Promise<() => void> | undefined;
    let unlistenExpired: Promise<() => void> | undefined;
    let unlistenError: Promise<() => void> | undefined;

    if (isTauri()) {
      unlistenSuccess = listen<{ user: { id: string; name: string; email: string; avatarUrl: string } }>(
        "auth:success",
        async (event) => {
          const { user } = event.payload;

          // ── CRITICAL ORDER ─────────────────────────────────────────────
          // Update auth state FIRST so the UI unblocks immediately.
          // NEVER await prepare_shell_window before this: if the Tauri invoke
          // hangs for any reason, the app stays on "Signing in..." forever.
          // ───────────────────────────────────────────────────────────────
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

          void invoke("prepare_shell_window").catch((e: unknown) => {
            console.warn("[Auth] Failed to resize window after login:", e);
          });
        }
      );

      unlistenExpired = listen<{ message: string }>(
        "auth:session_expired",
        (event) => {
          setAuthSessionExpired(event.payload.message);
        }
      );

      unlistenError = listen<{ message: string }>(
        "auth:error",
        (event) => {
          setAuthError(event.payload.message);
          setAuthLoginLoading(false);
        }
      );
    }

    // ── Wake-from-sleep / visibility recovery ───────────────────────
    // When the laptop wakes from sleep, the webview may reload or the page
    // may become visible again. Re-check the session to avoid showing a
    // stale / logged-out state.
    //
    // CRITICAL: Do NOT fire during initial bootstrap (first 5s after mount).
    // The bootstrap_auth_state call is async and the focus/visibility events
    // can fire during setup, racing with the bootstrap and potentially
    // clobbering the auth state.
    let checkAuthTimer: ReturnType<typeof setTimeout> | null = null;
    let wakeCheckEnabled = false;

    // Enable wake checks after initial bootstrap settles
    const enableWakeCheckTimer = setTimeout(() => { wakeCheckEnabled = true; }, 5000);

    async function checkSessionOnWake() {
      if (!isTauri() || !wakeCheckEnabled) return;
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

    // Debounced wake check: fires at most once per N seconds
    function scheduleWakeCheck() {
      if (checkAuthTimer) clearTimeout(checkAuthTimer);
      checkAuthTimer = setTimeout(checkSessionOnWake, 500);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleWakeCheck();
      }
    }

    function onFocus() {
      scheduleWakeCheck();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(enableWakeCheckTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      if (checkAuthTimer) clearTimeout(checkAuthTimer);
      if (unlistenSuccess) void unlistenSuccess.then((fn) => fn());
      if (unlistenExpired) void unlistenExpired.then((fn) => fn());
      if (unlistenError) void unlistenError.then((fn) => fn());
    };
  });
</script>

{#if isIsland}
  {@render children?.()}
{:else if isAgent}
  {@render children?.()}
{:else if $authStore.status === "restored"}
  <DatabaseUnlockGate>
    {@render children?.()}
    <AuthSessionOverlay />
  </DatabaseUnlockGate>
{:else if $page.url.pathname === "/auth"}
  <AuthPage />
{:else}
  <LoginPage />
{/if}
