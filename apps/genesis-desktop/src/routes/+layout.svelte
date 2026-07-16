<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { page } from "$app/stores";
  import LogRocket from "logrocket";
  import { invoke, invokeWithTimeout, setLogRocketInstance, trackShortcut, trackEvent } from "$lib/ipc";
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
  import { loadByokSettings } from "$lib/stores/byok.store";

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

    // ── LogRocket session recording (diagnostics for IPC issues) ──
    try {
      LogRocket.init("itajip/palma");
      setLogRocketInstance(LogRocket);
      console.log("[LogRocket] initialized for app itajip/palma");
    } catch (e) {
      console.warn("[LogRocket] init failed:", e);
    }

    // Enterprise polish — native-feel behaviors (context menu, zoom, etc.)
    initEnterprisePolish();

    console.log("[LAYOUT] onMount running, path=" + window.location.pathname);

    // HMR guard: prevent stale hot-reload instances from running duplicate bootstrap.
    // Uses a timestamp so stale guards (previous HMR instance that hung) are detected
    // and allowed to retry after 8s. Without this, a hung bootstrap would permanently
    // block recovery on reload.
    const BOOTSTRAP_KEY = "__bentoAuthBootstrapping";
    const prevTs = (window as any)[BOOTSTRAP_KEY];
    if (prevTs && Date.now() - prevTs < 8_000) {
      console.log("[LAYOUT] auth bootstrap already running — skipping duplicate HMR instance");
      return;
    }
    if (prevTs) {
      console.log("[LAYOUT] previous bootstrap appears stale (" + (Date.now() - prevTs) + "ms) — allowing retry");
    }
    (window as any)[BOOTSTRAP_KEY] = Date.now();

    // ── Module-level state for OAuth polling + wake checks ──
    // Declared here (before the IIFE) so both the async bootstrap flow
    // and the cleanup function can access them.
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let wakeCheckEnabled = false;

    const done = () => { (window as any)[BOOTSTRAP_KEY] = 0; };

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
          await invokeWithTimeout("enforce_auth_user_boundary", undefined, 8000);
          await dbg("auth user boundary enforced");
        };

        // ── FAST PATH: check in-memory state first (sub-ms, no network) ──
        // On HMR / app restart where Rust is still running, the in-memory
        // AuthBootstrapState persists. This returns instantly vs the full
        // bootstrap which can take seconds (keyring + token refresh + profile sync).
        //
        // If this fails (timeout or loginRequired), fall through to the full
        // bootstrap which handles keyring loading + token refresh.
        let sessionRestored = false;
        try {
          const memState = await invokeWithTimeout<{
            status: string;
            user?: { id: string; name: string; email: string; avatarUrl: string };
          }>("get_auth_bootstrap_state", undefined, 2_000);
          await dbg("fast path get_auth_bootstrap_state: " + memState.status);
          if (memState.status === "restored" && memState.user) {
            // Set auth state FIRST so the UI unblocks immediately.
            // Then fire-and-forget boundary enforcement and window show
            // so neither can delay the user seeing the app.
            shellTransitioned = true;
            clearBillingProfile();
            setAuthBootstrap({ status: "restored", user: memState.user });
            sessionRestored = true;
            void refreshBillingProfile();
            void enforceUserBoundary();
            void showWindow(true);
          }
        } catch (fastError) {
          await dbg("fast path failed (" + String(fastError) + "), falling through to full bootstrap");
        }

        // ── FULL BOOTSTRAP: keyring load + token refresh + session creation ──
        // Only runs when the fast path didn't restore the session.
        if (!sessionRestored) {
          let bootstrapDone = false;
          try {
            const bootstrapState = await Promise.race([
              invoke<{
                status: string;
                user?: { id: string; name: string; email: string; avatarUrl: string };
              }>("bootstrap_auth_state"),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("bootstrap_auth_state timed out after 15s")), 15000)
              ),
            ]);

            bootstrapDone = true;
            await dbg("bootstrap_auth_state result: " + bootstrapState.status);

            if (bootstrapState.status === "restored" && bootstrapState.user) {
              // Set auth state FIRST so the UI unblocks immediately.
              // Then fire-and-forget boundary enforcement.
              shellTransitioned = true;
              clearBillingProfile();
              setAuthBootstrap({ status: "restored", user: bootstrapState.user });
              void refreshBillingProfile();
              void enforceUserBoundary();
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
              // Timeout: show the app shell anyway with login page.
              // The Rust bootstrap handles network errors gracefully (returns
              // cached session on network failure), so a timeout is extremely
              // unlikely — but if it happens, show window so the user isn't
              // staring at a blank screen.
              setAuthLoginRequired();
              await showWindow(false);
            }
          }
        }

        // ── OAuth flow: start server, open browser, poll for success ──
        // checkSession is defined OUTSIDE the try block so the fallback
        // setTimeout after the try/catch can safely reference it without
        // the risk of a ReferenceError if begin_google_auth fails and
        // checkSession was never defined.
        let pollCount = 0;
        const POLL_MAX = 90;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;
        const checkSession = async () => {
          if (get(authStore).status === "restored") {
            pollTimer = null;
            return;
          }
          pollCount++;
          if (pollCount > POLL_MAX) {
            pollTimer = null;
            return;
          }
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
              pollTimer = null;
              return;
            }
          } catch {}
          pollTimer = setTimeout(checkSession, 2000);
        };

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

            // Start polling for auth success (fallback in case listen doesn't register)
            pollTimer = setTimeout(checkSession, 2000);
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
      // Also fires a delayed enable of the wake check (needs to stay in the
      // same timing band as settings hydration).
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
        // Eager-load BYOK settings so the store is populated before any
        // component reads it. Follows the same pattern as settings hydration
        // above — fire-and-forget, non-fatal.
        try { await loadByokSettings(); } catch (e) { await dbg("loadByokSettings failed: " + String(e)); }
        // Enable wake-session checks after all hydration settles
        wakeCheckEnabled = true;
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
          // NEVER await a Tauri invoke before this: if the invoke hangs for
          // any reason (compositor busy, IPC congestion), the app stays on
          // "Signing in..." forever.
          // ───────────────────────────────────────────────────────────────
          shellTransitioned = true;
          clearBillingProfile();
          setAuthRestored(user);
          setAuthLoginLoading(false);

          // Fire-and-forget: boundary enforcement and window resize.
          // These can run after the UI is already showing the app.
          void refreshBillingProfile();
          void invoke("enforce_auth_user_boundary").catch((error: unknown) => {
            console.error("[Auth] Failed to enforce user data boundary:", error);
            setAuthError("Could not safely switch accounts. Please sign in again.");
          });
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

    // Enable wake checks is now done inside settings hydration (above)
    // to avoid a race with the timer. The settings hydrate always runs
    // after bootstrap success or failure, so wake checks activate at the
    // right time.
    //
    // Safety net in case the settings hydration IIFE is somehow blocked.
    const enableWakeCheckTimer = setTimeout(() => { wakeCheckEnabled = true; }, 15000);

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

    // ── Keyboard shortcut listeners: Ctrl+Shift+A (Agent) / Ctrl+Shift+D (Island) ──
    function handleGlobalShortcut(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!e.shiftKey) return;
      if (e.key === "A" || e.key === "a") {
        e.preventDefault();
        trackShortcut("Ctrl+Shift+A");
        trackEvent("shortcut", "toggle_agent");
        console.log("[shortcut] Ctrl+Shift+A — agent toggle (tracked to LogRocket)");
      }
      if (e.key === "D" || e.key === "d") {
        e.preventDefault();
        trackShortcut("Ctrl+Shift+D");
        trackEvent("shortcut", "toggle_island");
        console.log("[shortcut] Ctrl+Shift+D — island toggle (tracked to LogRocket)");
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
      clearTimeout(enableWakeCheckTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      if (checkAuthTimer) clearTimeout(checkAuthTimer);
      // Clean up OAuth polling if still running
      if (pollTimer !== null) clearTimeout(pollTimer);
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
{:else if $authStore.status === "booting"}
  <!-- Loading state: show a subtle loading indicator during bootstrap.
       On HMR / reload, bootstrap may still be in-flight.
       A pulsing logo/text signals the app is working, without
       the jarring flash of the full login page. -->
  <div class="auth-booting">
    <div class="auth-booting-indicator">
      <svg class="auth-booting-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  </div>
{:else if $page.url.pathname === "/auth"}
  <AuthPage />
{:else}
  <LoginPage />
{/if}

<style>
  .auth-booting {
    position: fixed;
    inset: 0;
    background: var(--background, #08090b);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .auth-booting-indicator {
    opacity: 0.15;
    animation: auth-booting-pulse 2.4s ease-in-out infinite;
  }

  .auth-booting-logo {
    width: 32px;
    height: 32px;
    /* No CSS variable — during booting no theme has been loaded yet.
       Use the literal fallback directly. */
    color: #e8e8e8;
  }

  @keyframes auth-booting-pulse {
    0%, 100% { opacity: 0.08; transform: scale(1); }
    50% { opacity: 0.25; transform: scale(1.04); }
  }
</style>
