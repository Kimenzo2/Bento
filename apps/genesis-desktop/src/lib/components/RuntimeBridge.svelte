<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { hydrateDesktopSettings, watchSystemTheme } from "$lib/desktop/settings";
  import { setLifecycleState, type DesktopLifecycleState } from "$lib/stores/lifecycle.store";
  import { languageStore } from "$lib/stores/language.store";
  import { showCrash } from "$lib/stores/crash.store";
  import { activeTheme, getThemeTokens, isDark, themeState } from "$lib/stores/theme.store";
  import { setAvailableUpdate, setUpdateChecking, showUpdatePanel } from "$lib/stores/update.store";
  import { eventBus, BentoEventType, initEventBridge } from "$lib/services/event-bus";
  import { playAlarmSound, stopAlarmSound, preloadAlarmAudios, type SoundName } from "$lib/services/sounds";
  import type { SoundHandle } from "$lib/services/sounds";
  import { ensureNotificationPermission } from "$lib/services/notifications";

  const themeTokens = $derived(getThemeTokens($themeState));
  let arabicFontReady = false;

  // ── Ringing alarm state (dismiss/snooze) ──
  let ringingAlarm = $state<{ label: string; moduleId: string; soundName: SoundName; handle: SoundHandle } | null>(null);
  let ringingTimer: ReturnType<typeof setTimeout> | null = null;

  function dismissAlarm() {
    if (ringingAlarm) {
      stopAlarmSound(ringingAlarm.handle);
      ringingAlarm = null;
    }
    if (ringingTimer) { clearTimeout(ringingTimer); ringingTimer = null; }
  }

  function snoozeAlarm(minutes: number) {
    if (ringingAlarm) {
      const handle = ringingAlarm.handle;
      stopAlarmSound(handle);
      const label = ringingAlarm.label;
      const moduleId = ringingAlarm.moduleId;
      const soundName = ringingAlarm.soundName;
      ringingAlarm = null;
      if (ringingTimer) clearTimeout(ringingTimer);
      ringingTimer = setTimeout(() => {
        const newHandle = playAlarmSound(soundName, { loop: true, volume: 0.6 });
        if (newHandle) ringingAlarm = { label, moduleId, soundName, handle: newHandle };
      }, minutes * 60_000);
    }
  }

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

        void hydrateDesktopSettings().then(() => {
          watchSystemTheme();
        }).catch((error) => {
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
        // (Native OS notification is dispatched from the Rust scheduler backend)
        const unsubSchedule = eventBus.on(BentoEventType.ScheduleDue, (_event) => {
          console.log("[RuntimeBridge] ScheduleDue event received:", _event?.payload);
          const label = (_event?.payload?.label as string) ?? "";
          const moduleId = (_event?.payload?.moduleId as string) ?? "";
          if (!label) {
            console.warn("[RuntimeBridge] ScheduleDue event missing label, skipping");
            return;
          }
          const ctx = moduleId === "sleep" ? "Alarm" : "Reminder";
          toast.info(label, {
            description: ctx,
            duration: 8000,
          });
          const rawSound = _event?.payload?.sound;
          const soundName: SoundName = (rawSound != null && rawSound !== "" ? String(rawSound) : "alarm") as SoundName;
          const handle = playAlarmSound(soundName, { loop: true, volume: 0.6 });
          if (handle) {
            ringingAlarm = { label, moduleId, soundName, handle };
            if (ringingTimer) clearTimeout(ringingTimer);
            ringingTimer = setTimeout(() => {
              stopAlarmSound(handle);
              if (ringingAlarm?.handle === handle) ringingAlarm = null;
              ringingTimer = null;
            }, 30_000);
          }
        });
        unlistenPromises.push(
          Promise.resolve(() => { unsubSchedule(); }),
        );

        // Request notification permission at startup
        cancelDeferredTasks.push(
          scheduleAfterFirstPaint(() => {
            void ensureNotificationPermission();
          }, 500)
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
      if (ringingTimer) { clearTimeout(ringingTimer); ringingTimer = null; }
      if (ringingAlarm) { stopAlarmSound(ringingAlarm.handle); ringingAlarm = null; }
      void Promise.all(unlistenPromises).then((callbacks) => {
        callbacks.forEach((callback) => callback());
      });
    };
  });
</script>

{#if ringingAlarm}
<div class="rb-alarm-overlay" role="dialog" aria-modal="true" aria-label="Alarm ringing">
  <div class="rb-alarm-modal">
    <div class="rb-alarm-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <div>
        <strong>{ringingAlarm.label}</strong>
        <span>{ringingAlarm.moduleId === 'sleep' ? 'Alarm' : 'Reminder'}</span>
      </div>
    </div>
    <div class="rb-alarm-actions">
      <button class="rb-alarm-btn rb-alarm-btn--dismiss" onclick={dismissAlarm}>Dismiss</button>
      <button class="rb-alarm-btn rb-alarm-btn--snooze" onclick={() => snoozeAlarm(5)}>Snooze 5m</button>
      <button class="rb-alarm-btn rb-alarm-btn--snooze" onclick={() => snoozeAlarm(10)}>Snooze 10m</button>
    </div>
  </div>
</div>
{/if}

<style>
  :global(.rb-alarm-overlay) {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, oklch(0 0 0) 60%, transparent);
    animation: rb-fade-in 0.2s ease-out;
  }
  :global(.rb-alarm-modal) {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 28px 32px;
    min-width: 320px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.25);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  :global(.rb-alarm-header) {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  :global(.rb-alarm-header svg) {
    color: oklch(0.637 0.208 25.331);
    animation: rb-ring 0.5s ease-in-out infinite alternate;
  }
  @keyframes rb-ring {
    from { transform: rotate(-12deg); }
    to { transform: rotate(12deg); }
  }
  :global(.rb-alarm-header) strong {
    display: block;
    font-size: 1.1rem;
  }
  :global(.rb-alarm-header) span {
    font-size: 0.8rem;
    color: var(--muted);
  }
  :global(.rb-alarm-actions) {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  :global(.rb-alarm-btn) {
    padding: 10px 20px;
    border-radius: 12px;
    border: none;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 160ms ease;
  }
  :global(.rb-alarm-btn:active) { transform: scale(0.96); }
  :global(.rb-alarm-btn--dismiss) {
    background: oklch(0.637 0.208 25.331);
    color: #fff;
  }
  :global(.rb-alarm-btn--snooze) {
    background: color-mix(in srgb, var(--border) 50%, transparent);
    color: var(--foreground);
  }
  :global(.rb-alarm-btn--snooze:hover) {
    background: color-mix(in srgb, var(--border) 70%, transparent);
  }
  @keyframes rb-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.rb-alarm-overlay) { animation: none; }
    :global(.rb-alarm-header svg) { animation: none; }
  }
</style>
