<script lang="ts">
  /**
   * UpdateNotification.svelte
   *
   * Backend pipeline ported from Anytype's electron/ts/update.ts:
   *   Anytype event flow:  update-available → download-started → download-progress
   *                        → update-downloaded → updateConfirm → quitAndInstall
   *
   * Tauri equivalent:     check() finds update → downloadAndInstall()
   *                        "Started"  → contentLength  (= Anytype's total)
   *                        "Progress" → chunkLength    (= Anytype's bytesPerSecond chunk)
   *                        "Finished"                  (= Anytype's update-downloaded)
   *
   * UI: Anytype's .updateBanner sits bottom-left fixed.
   *     Bento's sits bottom-right fixed, uses the card system (card-surface).
   *     Progress bar, speed, percent all mirror Anytype's DownloadProgress shape.
   */
  import { browser } from "$app/environment";
  import { check } from "@tauri-apps/plugin-updater";
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
  } from "$lib/stores/update.store";

  // ── Local UI state ─────────────────────────────────────────────────
  let errorMessage = $state("");
  let lastNativeNotificationVersion = $state("");

  // Chunk timing — mirrors Anytype's bytesPerSecond calculation
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

  // Fire native notification when backgrounded (Anytype does the same)
  $effect(() => {
    if (
      !browser ||
      !$updateStore.available ||
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
      errorMessage =
        error instanceof Error ? error.message : _t('updateFailed');
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
  <!-- Bottom-right, card-surface, no border, no shadow per card system rules -->
  <aside class="update-notification" role="status" aria-live="polite">

    <!-- Header row — mirrors Anytype's .infoWrapper -->
    <div class="update-notification__header">
      <div class="update-notification__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v10M8 8l4-4 4 4" />
          <path d="M3 15a9 9 0 1 0 18 0" />
        </svg>
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

    <!-- Release notes — Anytype's .label / secondary text -->
    {#if $updateStore.available?.body && !$updateStore.installing}
      <p class="update-notification__body">
        {$updateStore.available.body}
      </p>
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

    <!-- Action buttons — mirrors Anytype's .buttons row -->
    {#if !$updateStore.installing}
      <div class="update-notification__actions">
        <button
          type="button"
          class="update-notification__btn update-notification__btn--later"
          onclick={dismiss}
        >
          {_t('updateLater')}
        </button>
        <button
          type="button"
          class="update-notification__btn update-notification__btn--install"
          onclick={installAndRestart}
        >
          {_t('updateInstallRestart')}
        </button>
      </div>
    {/if}

  </aside>
{/if}

<style>
  /* ── Container — fixed bottom-right, card-surface, no border/shadow ── */
  .update-notification {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 999;

    /* card-surface: var(--card), border-radius 20px, no border, no shadow */
    background: var(--card);
    border-radius: 20px;
    border: none;
    box-shadow: none;

    width: 320px;
    padding: 1.1rem 1.15rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    /* Anytype: appears with a subtle upward animation */
    animation: update-notification-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes update-notification-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
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
    border-radius: 10px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    display: grid;
    place-items: center;
    color: var(--foreground);
  }

  .update-notification__icon svg {
    width: 1.1rem;
    height: 1.1rem;
  }

  .update-notification__meta {
    flex: 1;
    min-width: 0;
  }

  /* Anytype: .name — font-weight 500 */
  .update-notification__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }

  /* Anytype: .label — text-small, color-text-secondary */
  .update-notification__version {
    margin: 0.1rem 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--muted);
  }

  /* Dismiss × — Anytype has no X but Bento adds one (Later button doubles as dismiss) */
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
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }

  /* ── Progress — mirrors Anytype's .progressBar ──────────────────── */
  .update-notification__progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  /* Anytype: .bar — height 8px, border-radius 6px */
  .update-notification__bar {
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    overflow: hidden;
  }

  /* Anytype: .fill.isActive — accent color; .fill.empty — highlight-medium */
  .update-notification__bar-fill {
    height: 100%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 30%, transparent);
    transition: width 0.25s ease;
  }

  .update-notification__bar-fill--active {
    background: var(--foreground);
  }

  /* Anytype: percent + speed labels row */
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

  /* ── Buttons — mirrors Anytype's .buttons row ───────────────────── */
  .update-notification__actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Anytype: .button — flex-grow 1, background-color shape-highlight-medium */
  .update-notification__btn {
    flex: 1;
    height: 2.1rem;
    border: none;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    cursor: default;
    transition: background 0.12s ease, color 0.12s ease;
    letter-spacing: -0.01em;
  }

  /* Later — muted fill, foreground text */
  .update-notification__btn--later {
    background: color-mix(in srgb, var(--foreground) 6%, transparent);
    color: var(--muted);
  }

  .update-notification__btn--later:hover {
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    color: var(--foreground);
  }

  /* Install — full foreground fill, inverted text — accent treatment */
  .update-notification__btn--install {
    background: var(--foreground);
    color: var(--background);
  }

  .update-notification__btn--install:hover {
    background: color-mix(in srgb, var(--foreground) 88%, transparent);
  }
</style>
