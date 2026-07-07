<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { hydrateDesktopSettings } from "$lib/desktop/settings";
  import { setLifecycleState, type DesktopLifecycleState } from "$lib/stores/lifecycle.store";
  import { languageStore } from "$lib/stores/language.store";
  import { showCrash } from "$lib/stores/crash.store";
  import { activeTheme, getThemeTokens, isDark, themeState } from "$lib/stores/theme.store";
  import { setAvailableUpdate, setUpdateChecking, showUpdatePanel } from "$lib/stores/update.store";
  import { eventBus, BentoEventType, initEventBridge } from "$lib/services/event-bus";
  import { playAlarmSound, stopAlarmSound, preloadAlarmAudios, type SoundName } from "$lib/services/sounds";

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

  // Fonts are defined via CSS custom properties in app.css :root.
  // RuntimeBridge does NOT override fonts — the CSS owns the font system.

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
      if (url.protocol !== "bento:") {
        goto("/");
        return;
      }

      const host = url.hostname.toLowerCase();
      if (host === "auth") {
        // bento://auth?access_token=...&refresh_token=...
        // The AuthPage will handle the token exchange
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

    // Preload alarm audios so they play instantly
    preloadAlarmAudios(["alarm", "ringtone", "gentle-rain", "ocean-waves", "guitar-loop"]);

    if (browser) {
      void (async () => {
        const { isTauri, invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        if (!isTauri()) return;
        const appWindow = getCurrentWebviewWindow();

        void hydrateDesktopSettings().catch((error) => {
          console.error("Bento desktop settings failed to hydrate.", error);
        });

        void invoke<DesktopLifecycleState>("get_lifecycle_state")
          .then((state) => {
            setLifecycleState(state);
          })
          .catch(() => {
            // The native lifecycle event stream will still update once available.
          });

        void (async () => {
          let safety = 0;
          while (safety < 10) {
            safety++;
            const payload = await invoke<string | null>('consume_pending_deep_link');
            if (!payload) break;
            routeDeepLink(payload);
          }
          if (safety >= 10) {
            console.warn('[RuntimeBridge] Deep link loop exceeded safety limit — possible backend bug');
          }
        })().catch(() => {
          // Normal launches do not have a pending deep link.
        });

        unlistenPromises.push(
          appWindow.listen<string>("bento://deep-link", ({ payload }) => {
            routeDeepLink(payload);
          })
        );

        unlistenPromises.push(
          appWindow.listen<string | { route?: string }>("bento://navigate", ({ payload }) => {
            const route = typeof payload === "string" ? payload : payload?.route;
            if (typeof route === "string" && route.startsWith("/")) {
              goto(route);
            }
          })
        );

        unlistenPromises.push(
          appWindow.listen<string>("bento://dashboard-refresh", ({ payload }) => {
            window.dispatchEvent(
              new CustomEvent("bento:dashboard-refresh", {
                detail: payload,
              })
            );
          })
        );

        unlistenPromises.push(
          appWindow.listen<{ message: string; logPath: string; timestamp: string }>(
            "bento://crash",
            ({ payload }) => {
              showCrash(payload);
            }
          )
        );

        unlistenPromises.push(
          appWindow.listen<string>("bento://lifecycle", ({ payload }) => {
            setLifecycleState(payload as DesktopLifecycleState);
          })
        );

        // Initialize Tauri → EventBus bridge for schedule-fire and other system events
        const bridgeCleanupPromise = initEventBridge();
        bridgeCleanupPromise.then((cleanup) => {
          unlistenPromises.push(Promise.resolve(cleanup));
        });

        // Show an in-app toast + play alarm sound when a schedule fires
        const unsubSchedule = eventBus.on(BentoEventType.ScheduleDue, (_event) => {
          const label = (_event?.payload?.label as string) ?? "";
          const moduleId = (_event?.payload?.moduleId as string) ?? "";
          if (!label) return;
          const ctx = moduleId === "sleep" ? "Alarm" : "Reminder";
          toast.info(label, {
            description: ctx,
            duration: 8000,
          });
          const soundName = (_event?.payload?.sound as string) ?? "alarm";
          const audio = playAlarmSound(soundName as SoundName, { loop: true, volume: 0.6 });
          if (audio) {
            setTimeout(() => { stopAlarmSound(audio); }, 30_000);
          }
        });
        unlistenPromises.push(
          Promise.resolve(() => { unsubSchedule(); }),
        );

        cancelDeferredTasks.push(
          scheduleAfterFirstPaint(() => {
            void (async () => {
              setUpdateChecking(true);
              try {
                const { check } = await import("@tauri-apps/plugin-updater");
                const update = await check();
                if (update) {
                  setAvailableUpdate({
                    version: update.version,
                    body: update.body,
                  });
                  setTimeout(() => showUpdatePanel(), 2000);
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                const type = /network|fetch|econnrefused|timeout|dns/i.test(msg) ? "network"
                  : /signature|verify|invalid.*key/i.test(msg) ? "signature"
                  : /parse|json|unexpected/i.test(msg) ? "manifest"
                  : /version|semver/i.test(msg) ? "version"
                  : "unknown";
                console.error(`[updater] check failed (${type}): ${msg}`);
                console.debug("[updater] full error:", e);
              } finally {
                setUpdateChecking(false);
              }
            })();
          }, 900)
        );
      })().catch((error) => {
        console.warn("[RuntimeBridge] Native bridge initialization failed:", error);
      });
    }

    return () => {
      cancelDeferredTasks.forEach((cancel) => cancel());
      void Promise.all(unlistenPromises).then((callbacks) => {
        callbacks.forEach((callback) => callback());
      });
    };
  });
</script>
