<script lang="ts">
  import { browser } from "$app/environment";
  import AppIcon from "$lib/components/AppIcon.svelte";
  import { appLaunch, clearAppLaunch } from "$lib/stores/app-launch.store";

  type Phase = "entering" | "holding" | "exiting" | "gone";

  const MIN_DISPLAY_MS = 500;
  const EXIT_MS = 600;
  const MAX_HOLD_MS = 6000;

  let phase = $state<Phase>("gone");
  let handledLaunchId: number | null = null;
  let exitScheduledFor: number | null = null;
  let enterFrame = 0;
  let fallbackTimer = 0;

  function clearTimers() {
    if (enterFrame) {
      cancelAnimationFrame(enterFrame);
      enterFrame = 0;
    }

    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = 0;
    }
  }

  function beginExit(launchId: number) {
    if (!$appLaunch || $appLaunch.launchId !== launchId || phase === "exiting" || phase === "gone") {
      return;
    }

    phase = "exiting";
    window.setTimeout(() => {
      clearAppLaunch(launchId);
    }, EXIT_MS);
  }

  $effect(() => {
    if (!browser) {
      return;
    }

    const launch = $appLaunch;
    if (!launch) {
      clearTimers();
      handledLaunchId = null;
      exitScheduledFor = null;
      phase = "gone";
      return;
    }

    if (handledLaunchId === launch.launchId) {
      return;
    }

    clearTimers();
    handledLaunchId = launch.launchId;
    exitScheduledFor = null;
    phase = "entering";

    enterFrame = requestAnimationFrame(() => {
      if ($appLaunch?.launchId === launch.launchId) {
        phase = "holding";
      }
    });

    fallbackTimer = window.setTimeout(() => {
      beginExit(launch.launchId);
    }, MAX_HOLD_MS);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    const launch = $appLaunch;
    if (!launch || launch.readyAt === null || exitScheduledFor === launch.launchId) {
      return;
    }

    exitScheduledFor = launch.launchId;
    const elapsed = Date.now() - launch.startedAt;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    const exitTimer = window.setTimeout(() => {
      beginExit(launch.launchId);
    }, launch.errorMessage ? Math.max(remaining, 900) : remaining);

    return () => {
      window.clearTimeout(exitTimer);
    };
  });
</script>

{#if $appLaunch && phase !== "gone"}
  <div
    class="launch-canvas"
    class:entering={phase === "entering"}
    class:holding={phase === "holding"}
    class:exiting={phase === "exiting"}
    style="--app-launch-bg: {$appLaunch.launchBg};"
    aria-label={`Loading ${$appLaunch.appName}`}
    aria-live="polite"
    role="status"
  >
    <div class="launch-canvas__icon-stage" class:zoom-exit={phase === "exiting"}>
      <div class="launch-canvas__icon-backdrop"></div>
      <div class="launch-canvas__icon-wrap">
        <AppIcon name={$appLaunch.icon} size={23} strokeWidth={1.7} />
      </div>
    </div>

    <div class="launch-canvas__name" class:fade-exit={phase === "exiting"}>
      {$appLaunch.errorMessage ?? $appLaunch.appName}
    </div>

    {#if !$appLaunch.errorMessage}
      <div class="launch-canvas__dots" class:hide={phase === "exiting"}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .launch-canvas {
    position: fixed;
    inset: 0;
    z-index: 8000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: #ffffff;
    color: #1F1C1A;
  }

  .launch-canvas__icon-stage {
    position: relative;
    display: grid;
    place-items: center;
    cursor: default;
  }

  .launch-canvas__icon-backdrop {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, white 26%, transparent);
    border-radius: 0.95rem;
    background:
      linear-gradient(145deg, color-mix(in srgb, white 16%, transparent), transparent),
      var(--app-launch-bg);
    color: white;
    box-shadow: inset 0 1px 0 color-mix(in srgb, white 28%, transparent);
    position: absolute;
    cursor: default;
  }

  .launch-canvas__icon-wrap {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    color: white;
  }

  .launch-canvas__name {
    font-size: 28px;
    font-weight: 750;
    letter-spacing: 0;
    color: #1F1C1A;
    text-shadow: 0 1px 4px rgba(31, 28, 26, 0.1);
  }

  .launch-canvas__dots {
    display: flex;
    gap: 8px;
  }

  .launch-canvas__dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(31, 28, 26, 0.5);
  }
</style>
