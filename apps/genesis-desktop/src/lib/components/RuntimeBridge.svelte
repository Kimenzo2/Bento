<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
  import { check } from "@tauri-apps/plugin-updater";
  import { goto } from "@mateothegreat/svelte5-router";
  import { hydrateDesktopSettings } from "$lib/desktop/settings";
  import { fontStore } from "$lib/stores/font.store";
  import { setLifecycleState, type DesktopLifecycleState } from "$lib/stores/lifecycle.store";
  import { languageStore } from "$lib/stores/language.store";
  import { showCrash } from "$lib/stores/crash.store";
  import { activeTheme, getThemeTokens, isDark, themeState } from "$lib/stores/theme.store";
  import { setAvailableUpdate, setUpdateChecking } from "$lib/stores/update.store";

  const themeTokens = $derived(getThemeTokens($themeState));
  let arabicFontReady = false;

  function scheduleAfterFirstPaint(task: () => void, delayMs: number) {
    if (!browser) {
      return () => {};
    }

    let timeoutId = 0;
    let idleId = 0;

    timeoutId = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(task, { timeout: 1500 });
        return;
      }

      task();
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);

      if (idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }

  $effect(() => {
    if (!browser) {
      return;
    }

    const root = document.documentElement;
    Object.entries(themeTokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.classList.toggle("dark", $isDark);
    root.style.setProperty("color-scheme", $isDark ? "dark" : "light");
    root.setAttribute("data-theme", $activeTheme.id);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    document.documentElement.style.setProperty("--font-heading", `'${$fontStore.heading}', sans-serif`);
    document.documentElement.style.setProperty("--font-body", `'${$fontStore.body}', system-ui, sans-serif`);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    document.documentElement.setAttribute("lang", $languageStore.code);
    document.documentElement.setAttribute("dir", $languageStore.direction);
  });

  $effect(() => {
    if (!browser || arabicFontReady || $languageStore.direction !== "rtl") {
      return;
    }

    arabicFontReady = true;
    // @ts-expect-error fontsource ships runtime CSS without TypeScript declarations.
    void import("@fontsource-variable/noto-sans-arabic");
  });

  const routeDeepLink = (payload: string) => {
    try {
      const url = new URL(payload);
      if (url.protocol !== "genesis:") {
        goto("/");
        return;
      }

      const host = url.hostname.toLowerCase();
      if (host === "auth") {
        goto(`/auth${url.search}${url.hash}`);
        return;
      }

      if (host === "payment-callback") {
        goto(`/payment-callback${url.search}${url.hash}`);
        return;
      }

      if (host === "shared") {
        const path = url.pathname.replace(/\/+$/, "");
        if (path && path !== "/") {
          goto(`/shared${path}${url.search}${url.hash}`);
          return;
        }
      }

      goto("/");
    } catch {
      goto("/");
    }
  };

  onMount(() => {
    const unlistenPromises: Promise<() => void>[] = [];
    const cancelDeferredTasks: Array<() => void> = [];

    if ("__TAURI_INTERNALS__" in window) {
      const appWindow = getCurrentWebviewWindow();

      void hydrateDesktopSettings().catch((error) => {
        console.error("Genesis desktop settings failed to hydrate.", error);
      });

      void invoke<DesktopLifecycleState>("get_lifecycle_state")
        .then((state) => {
          setLifecycleState(state);
        })
        .catch(() => {
          // The native lifecycle event stream will still update once available.
        });

      void (async () => {
        while (true) {
          const payload = await invoke<string | null>("consume_pending_deep_link");
          if (!payload) {
            break;
          }

          routeDeepLink(payload);
        }
      })().catch(() => {
        // Normal launches do not have a pending deep link.
      });

      unlistenPromises.push(
        appWindow.listen<string>("genesis://deep-link", ({ payload }) => {
          routeDeepLink(payload);
        })
      );

      unlistenPromises.push(
        appWindow.listen<string>("genesis://navigate", ({ payload }) => {
          if (payload.startsWith("/")) {
            goto(payload);
          }
        })
      );

      unlistenPromises.push(
        appWindow.listen<{ message: string; logPath: string; timestamp: string }>(
          "genesis://crash",
          ({ payload }) => {
            showCrash(payload);
          }
        )
      );

      unlistenPromises.push(
        appWindow.listen<string>("genesis://lifecycle", ({ payload }) => {
          setLifecycleState(payload as DesktopLifecycleState);
        })
      );

      cancelDeferredTasks.push(
        scheduleAfterFirstPaint(() => {
          void (async () => {
            setUpdateChecking(true);
            try {
              const update = await check();
              if (update) {
                setAvailableUpdate({
                  version: update.version,
                  body: update.body,
                });
              }
            } catch {
              // Updater errors are non-blocking during development and stubbed deployments.
            } finally {
              setUpdateChecking(false);
            }
          })();
        }, 900)
      );
    }

    return () => {
      cancelDeferredTasks.forEach((cancel) => cancel());
      void Promise.all(unlistenPromises).then((callbacks) => {
        callbacks.forEach((callback) => callback());
      });
    };
  });
</script>
