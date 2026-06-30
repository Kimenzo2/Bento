<script lang="ts">
  /**
   * UpdateNotification.svelte
   *
   * Backend pipeline ported from Anytype's electron/ts/update.ts:
   * Event flow:  update-available → download-started → download-progress
   *                        → update-downloaded → updateConfirm → quitAndInstall
   *
   * Tauri equivalent:     check() finds update → downloadAndInstall()
   *                        "Started"  → contentLength
   *                        "Progress" → chunkLength
   *                        "Finished"
   *
   * UI: Bottom-right fixed glass card with progress bar, speed, percent.
   */
  import { browser } from "$app/environment";
  import { fly } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import { check } from "@tauri-apps/plugin-updater";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
  } from "@tauri-apps/plugin-notification";
  import { desktopSettings } from "$lib/desktop/settings";
  import { lifecycleStore } from "$lib/stores/lifecycle.store";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";

  let _t = $derived.by(() => createTranslator($activeBundle));
  import {
    setAvailableUpdate,
    setInstallingUpdate,
    setDownloadTotal,
    setDownloadProgress,
    resetDownloadProgress,
    updateStore,
    hideUpdatePanel,
    setDismissedVersion,
    markBadgeSeen,
  } from "$lib/stores/update.store";

  // ── Local UI state ─────────────────────────────────────────────────
  let errorMessage = $state("");
  let lastNativeNotificationVersion = $state("");
  let notesExpanded = $state(false);
  const MAX_PREVIEW_LINES = 4;

  // Chunk timing
  let lastChunkTime = 0;

  // ── Derived display values ─────────────────────────────────────────
  const isDownloading = $derived(
    $updateStore.installing && $updateStore.totalBytes > 0
  );
  const percent = $derived($updateStore.downloadPercent);
  const speedLabel = $derived(() => {
    const bps = $updateStore.downloadSpeed;
    if (bps <= 0) return "";
    if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
    if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${bps} B/s`;
  });

  // Format bytes — mirrors Anytype's transferred/total display
  function formatBytes(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  // ── Background native notification (mirrors Anytype's notify logic) ─
  async function notifyBackgroundUpdate(version: string, body?: string) {
    if (!browser || !("__TAURI_INTERNALS__" in window)) return;

    const granted = await isPermissionGranted();
    const allowed = granted || (await requestPermission()) === "granted";
    if (!allowed) return;

    sendNotification({
      title: _t('updateNotificationTitle'),
      body: body?.trim()
        ? `${_t('updateVersionReady').replace('{version}', version)} ${body}`
        : _t('updateVersionReady').replace('{version}', version),
    });
    lastNativeNotificationVersion = version;
  }

  // Fire native notification only after user has seen the badge in titlebar
  $effect(() => {
    if (
      !browser ||
      !$updateStore.available ||
      !$updateStore.badgeSeen ||
      !$desktopSettings.notifications.backgroundAlerts
    ) return;
    if ($lifecycleStore !== "Backgrounded") return;
    if (lastNativeNotificationVersion === $updateStore.available.version) return;

    void notifyBackgroundUpdate(
      $updateStore.available.version,
      $updateStore.available.body
    );
  });

  // Reset error state when a new version arrives
  $effect(() => {
    if ($updateStore.available) {
      errorMessage = "";
    }
  });

  // Mark badge as seen when card is shown
  $effect(() => {
    if ($updateStore.showPanel && $updateStore.available) {
      markBadgeSeen();
    }
  });

  // Dismiss on Escape — registered only while card is visible
  $effect(() => {
    if (!browser || !$updateStore.showPanel) return;

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  // ── Install & restart (Anytype: updateConfirm → quitAndInstall) ────
  async function installAndRestart() {
    if (!$updateStore.available) return;

    setInstallingUpdate(true);
    resetDownloadProgress();
    errorMessage = "";
    lastChunkTime = time.now();

    try {
      // Re-check to get a fresh Update object with downloadAndInstall
      const update = await check();
      if (!update) {
        setInstallingUpdate(false);
        setAvailableUpdate(null);
        return;
      }

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          // Anytype: this is the "download-started" event + total size
          setDownloadTotal(event.data.contentLength ?? 0);
          lastChunkTime = time.now();

        } else if (event.event === "Progress") {
          // Anytype: "download-progress" → { bytesPerSecond, percent, transferred, total }
          const now = time.now();
          const elapsed = now - lastChunkTime;
          lastChunkTime = now;
          setDownloadProgress(event.data.chunkLength, elapsed);

        } else if (event.event === "Finished") {
          // Anytype: "update-downloaded" — install complete, about to relaunch
          // Tauri handles the relaunch automatically after downloadAndInstall resolves
        }
      });

      // downloadAndInstall resolves after install completes (Tauri relaunches the app)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/network|fetch|econnrefused|timeout|dns/i.test(msg)) {
        errorMessage = _t('updateNetworkError');
      } else if (/signature|verify|invalid/i.test(msg)) {
        errorMessage = _t('updateVerificationError');
      } else {
        errorMessage = _t('updateFailed');
      }
      setInstallingUpdate(false);
      resetDownloadProgress();
    }
  }

  // Dismiss — persists per version so the badge re-appears only for newer releases
  function dismiss() {
    const version = $updateStore.available?.version;
    if (version) setDismissedVersion(version);
    hideUpdatePanel();
  }

  const visible = $derived(
    $updateStore.showPanel && !!$updateStore.available && !$updateStore.checking
  );
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <aside
    class="update-notification"
    role="status"
    aria-live="polite"
    transition:fly={{ x: 0, y: 12, duration: 280, easing: backOut }}
  >

    <!-- Header row — mirrors Anytype's .infoWrapper -->
    <div class="update-notification__header">
      <div class="update-notification__icon" aria-hidden="true">
        <DownloadIcon />
      </div>
      <div class="update-notification__meta">
        <p class="update-notification__title">{_t('updateTitle')}</p>
        <p class="update-notification__version">
          Version {$updateStore.available?.version}
        </p>
      </div>
      {#if !$updateStore.installing}
        <button
          type="button"
          class="update-notification__close"
          aria-label={_t('updateDismiss')}
          onclick={dismiss}
        >
          <svg viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Release notes — truncated to MAX_PREVIEW_LINES, toggle to expand -->
    {#if $updateStore.available?.body && !$updateStore.installing}
      {@const lines = $updateStore.available.body.split("\n").filter((l) => l.trim())}
      <div class="update-notification__body" class:update-notification__body--truncated={!notesExpanded && lines.length > MAX_PREVIEW_LINES}>
        {#if notesExpanded || lines.length <= MAX_PREVIEW_LINES}
          {#each lines as line}
            <p>{line}</p>
          {/each}
        {:else}
          {#each lines.slice(0, MAX_PREVIEW_LINES) as line}
            <p>{line}</p>
          {/each}
        {/if}
      </div>
      {#if lines.length > MAX_PREVIEW_LINES}
        <button
          type="button"
          class="update-notification__notes-toggle"
          onclick={() => (notesExpanded = !notesExpanded)}
        >
          {notesExpanded ? "Show fewer" : `Show all (${lines.length})`}
        </button>
      {/if}
    {/if}

    <!-- Progress section — mirrors Anytype's progressBar + percent + speed -->
    {#if $updateStore.installing}
      <div class="update-notification__progress-wrap">

        <!-- Progress bar — Anytype's .progressBar .bar .fill -->
        <div class="update-notification__bar" role="progressbar"
             aria-valuenow={percent}
             aria-valuemin={0}
             aria-valuemax={100}>
          <div
            class="update-notification__bar-fill"
            class:update-notification__bar-fill--active={isDownloading}
            style={`width: ${isDownloading ? percent : 100}%`}
          ></div>
        </div>

        <!-- Status row — Anytype's percent + speed labels -->
        <div class="update-notification__progress-meta">
          {#if isDownloading}
            <span>{percent}%</span>
            <span class="update-notification__speed">{speedLabel()}</span>
            <span>
              {formatBytes($updateStore.downloadedBytes)} /
              {formatBytes($updateStore.totalBytes)}
            </span>
          {:else if percent === 0}
            <span class="update-notification__status">{_t('updatePreparing')}</span>
          {:else}
            <span class="update-notification__status">{_t('updateInstalling')}</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Error -->
    {#if errorMessage}
      <p class="update-notification__error">{errorMessage}</p>
    {/if}

    <!-- Action buttons -->
    {#if !$updateStore.installing}
      <div class="update-notification__actions">
        <Button variant="secondary" size="sm" onclick={dismiss}>
          {_t('updateLater')}
        </Button>
        <Button variant="default" size="sm" onclick={installAndRestart}>
          {_t('updateInstallRestart')}
        </Button>
      </div>
    {/if}

  </aside>
{/if}

<style>
  /* ── Container — fixed bottom-right, glass card ────────────────── */
  .update-notification {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 999;

    width: 320px;
    max-height: min(90vh - 2.5rem, 480px);
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    overflow-y: auto;

    border-radius: 24px;
    border: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
    background: color-mix(in srgb, var(--card) 80%, transparent);
    box-shadow:
      0 4px 24px -8px rgb(0 0 0 / 0.08),
      inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  @media (prefers-reduced-transparency: reduce) {
    .update-notification {
      background: var(--card);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      box-shadow: none;
    }
  }

  /* ── Header row ─────────────────────────────────────────────────── */
  .update-notification__header {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .update-notification__icon {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 12px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    display: grid;
    place-items: center;
    color: var(--foreground);
    border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  }

  .update-notification__icon :global(svg) {
    width: 1.1rem;
    height: 1.1rem;
  }

  .update-notification__meta {
    flex: 1;
    min-width: 0;
  }

  .update-notification__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }

  .update-notification__version {
    margin: 0.1rem 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--muted);
  }

  .update-notification__close {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    display: grid;
    place-items: center;
    cursor: default;
    transition: background 0.12s ease, color 0.12s ease;
    align-self: flex-start;
  }

  .update-notification__close:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }

  .update-notification__close svg {
    width: 10px;
    height: 10px;
  }

  /* ── Release notes body ─────────────────────────────────────────── */
  .update-notification__body {
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }

  .update-notification__body p {
    margin: 0;
  }

  .update-notification__body p + p {
    margin-top: 0.25rem;
  }

  .update-notification__body--truncated {
    max-height: 5.25rem;
    overflow: hidden;
    position: relative;
  }

  .update-notification__body--truncated::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1.25rem;
    background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--card) 80%, transparent));
    pointer-events: none;
  }

  .update-notification__notes-toggle {
    border: none;
    background: transparent;
    color: var(--foreground);
    font-size: 11px;
    font-weight: 600;
    padding: 0;
    cursor: default;
    text-align: left;
    opacity: 0.7;
    transition: opacity 0.12s ease;
  }

  .update-notification__notes-toggle:hover {
    opacity: 1;
  }

  /* ── Progress ───────────────────────────────────────────────────── */
  .update-notification__progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .update-notification__bar {
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    overflow: hidden;
  }

  .update-notification__bar-fill {
    height: 100%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 30%, transparent);
    transition: width 0.25s ease;
  }

  .update-notification__bar-fill--active {
    background: var(--foreground);
  }

  .update-notification__progress-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 11px;
    color: var(--muted);
    line-height: 1;
  }

  .update-notification__speed {
    margin-left: auto;
  }

  .update-notification__status {
    font-size: 11px;
    color: var(--muted);
  }

  /* ── Error ──────────────────────────────────────────────────────── */
  .update-notification__error {
    margin: 0;
    font-size: 12px;
    color: var(--destructive);
    line-height: 1.4;
  }

  /* ── Actions — matches Landing page nav bar button style ────────── */
  .update-notification__actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.1rem;
  }

  .update-notification__actions :global([data-slot="button"]) {
    flex: 1;
    height: 28px;
    border-radius: 0.75rem;
    padding-inline: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    gap: 8px;
  }
</style>
