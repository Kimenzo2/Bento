<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, tick } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
  import { check } from "@tauri-apps/plugin-updater";
  import { goto } from "@mateothegreat/svelte5-router";
  import { restoreWindow } from "$lib/desktop/runtime";
  import { hydrateDesktopSettings, desktopSettingsReady } from "$lib/desktop/settings";
  import { fontStore } from "$lib/stores/font.store";
  import { setLifecycleState, type DesktopLifecycleState } from "$lib/stores/lifecycle.store";
  import { languageStore } from "$lib/stores/language.store";
  import { showCrash } from "$lib/stores/crash.store";
  import { activeTheme, getThemeTokens, isDark, themeState } from "$lib/stores/theme.store";
  import { setAvailableUpdate, setUpdateChecking } from "$lib/stores/update.store";
  import { logger } from "$lib/utils/logger";

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

      void hydrateDesktopSettings()
        .then(() => {
          desktopSettingsReady.set(true);
        })
        .catch((error) => {
          logger.error("Genesis desktop settings failed to hydrate.", error);
          desktopSettingsReady.set(true);
        });

      void tick().then(() => {
        void restoreWindow().catch((error) => {
          logger.error("Failed to restore window after first paint.", error);
        });
      });

      void invoke<DesktopLifecycleState>("get_lifecycle_state")
        .then((state) => {
          setLifecycleState(state);
        })
        .catch(() => {
          logger.debug("get_lifecycle_state failed on first attempt; native events will update later.");
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
        logger.debug("No pending deep link to consume (normal launch).");
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
              logger.debug("Updater check failed; non-blocking in development.");
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
