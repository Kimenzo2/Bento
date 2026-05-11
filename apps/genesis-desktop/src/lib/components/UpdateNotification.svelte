<script lang="ts">
  import { browser } from "$app/environment";
  import { check } from "@tauri-apps/plugin-updater";
  import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
  } from "@tauri-apps/plugin-notification";
  import { Button } from "$lib/components/ui/button/index.js";
  import { desktopSettings } from "$lib/desktop/settings";
  import { lifecycleStore } from "$lib/stores/lifecycle.store";
  import { setAvailableUpdate, setDownloadedBytes, setInstallingUpdate, updateStore } from "$lib/stores/update.store";

  let errorMessage = $state("");
  let lastNativeNotificationVersion = $state("");

  async function notifyBackgroundUpdate(version: string, body?: string) {
    if (!browser || !("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const granted = await isPermissionGranted();
    const allowed = granted || (await requestPermission()) === "granted";

    if (!allowed) {
      return;
    }

    sendNotification({
      title: "Genesis update available",
      body: body?.trim()
        ? `Version ${version} is ready to install. ${body}`
        : `Version ${version} is ready to install.`,
    });
    lastNativeNotificationVersion = version;
  }

  $effect(() => {
    if (!browser || !$updateStore.available || !$desktopSettings.notifications.backgroundAlerts) {
      return;
    }

    if ($lifecycleStore !== "Backgrounded") {
      return;
    }

    if (lastNativeNotificationVersion === $updateStore.available.version) {
      return;
    }

    void notifyBackgroundUpdate($updateStore.available.version, $updateStore.available.body);
  });

  const installAndRestart = async () => {
    if (!$updateStore.available) {
      return;
    }

    setInstallingUpdate(true);
    setDownloadedBytes(0);
    errorMessage = "";

    try {
      const update = await check();
      if (!update) {
        setInstallingUpdate(false);
        setAvailableUpdate(null);
        return;
      }

      await update.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          setDownloadedBytes($updateStore.downloadedBytes + event.data.chunkLength);
        }
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to install update.";
    } finally {
      setInstallingUpdate(false);
    }
  };
</script>

{#if $updateStore.available}
  <aside class="update-toast">
    <div>
      <p class="font-[var(--font-heading)] text-lg font-semibold text-[var(--foreground)]">
        Update available
      </p>
      <p class="mt-1 text-sm text-[var(--muted)]">
        Version {$updateStore.available.version} is ready to install in the background.
      </p>
      {#if $updateStore.available.body}
        <p class="mt-3 text-sm text-[var(--muted)]">{$updateStore.available.body}</p>
      {/if}
      {#if errorMessage}
        <p class="mt-3 text-sm text-destructive">{errorMessage}</p>
      {/if}
    </div>
    <div class="flex gap-3">
      <Button
        class="rounded-full px-4"
        variant="outline"
        onclick={() => setAvailableUpdate(null)}
      >
        Later
      </Button>
      <Button class="rounded-full px-4" disabled={$updateStore.installing} onclick={installAndRestart}>
        {$updateStore.installing ? "Installing..." : "Install and Restart"}
      </Button>
    </div>
  </aside>
{/if}
