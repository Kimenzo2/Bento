<script lang="ts">
  import { browser } from "$app/environment";
  import ThemeSelector from "$lib/components/ThemeSelector.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { fontPairings, reopenShortcutOptions } from "$lib/data/preferences";
  import { backupDesktopSettings, pickExportDirectory, restoreDesktopSettingsBackup } from "$lib/desktop/runtime";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";
  import { fontStore, setFontPairing } from "$lib/stores/font.store";
  import { languageStore, languages, setLanguage } from "$lib/stores/language.store";
  import { toast } from "svelte-sonner";

  let isBackingUp = $state(false);
  let isRestoring = $state(false);
  let isChoosingExportDirectory = $state(false);
  const canUseTauri = browser && "__TAURI_INTERNALS__" in window;

  const toggleWorkspaceCollapsed = () => {
    void updateDesktopSettings((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        sidebarCollapsed: !current.workspace.sidebarCollapsed,
      },
    }));
  };

  const toggleWindowRestore = () => {
    void updateDesktopSettings((current) => ({
      ...current,
      window: {
        ...current.window,
        restoreOnLaunch: !current.window.restoreOnLaunch,
      },
    }));
  };

  const toggleStartHidden = () => {
    void updateDesktopSettings((current) => ({
      ...current,
      window: {
        ...current.window,
        startHidden: !current.window.startHidden,
      },
    }));
  };

  const toggleBackgroundAlerts = () => {
    void updateDesktopSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        backgroundAlerts: !current.notifications.backgroundAlerts,
      },
    }));
  };

  const toggleTelemetryConsent = () => {
    void updateDesktopSettings((current) => {
      const consented = !current.telemetry.consented;
      return {
        ...current,
        telemetry: {
          consented,
          crashReports: consented,
        },
      };
    });
  };

  const chooseExportDirectory = async () => {
    if (!canUseTauri) {
      toast.info("Run this view inside the desktop shell to choose an export folder.");
      return;
    }

    isChoosingExportDirectory = true;

    try {
      const directory = await pickExportDirectory();
      if (!directory) {
        toast.info("Export folder selection cancelled.");
        return;
      }

      await updateDesktopSettings((current) => ({
        ...current,
        files: {
          ...current.files,
          exportDirectory: directory,
        },
      }));

      toast.success(`Export folder set to ${directory}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the export folder.");
    } finally {
      isChoosingExportDirectory = false;
    }
  };

  const createSettingsBackup = async () => {
    if (!canUseTauri) {
      toast.info("Run this view inside the desktop shell to back up settings.");
      return;
    }

    isBackingUp = true;

    try {
      const path = await backupDesktopSettings();
      if (path) {
        toast.success(`Settings backup saved to ${path}`);
      } else {
        toast.info("Backup cancelled.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to back up settings.");
    } finally {
      isBackingUp = false;
    }
  };

  const restoreSettingsBackup = async () => {
    if (!canUseTauri) {
      toast.info("Run this view inside the desktop shell to restore settings.");
      return;
    }

    isRestoring = true;

    try {
      const restored = await restoreDesktopSettingsBackup();
      if (restored) {
        toast.success("Settings restored.");
      } else {
        toast.info("Restore cancelled.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore settings.");
    } finally {
      isRestoring = false;
    }
  };
</script>

<Tabs.Root value="theme" class="grid gap-4">
  <Tabs.List class="w-fit rounded-full bg-[var(--surface)] p-1">
    <Tabs.Trigger class="rounded-full px-3 py-1.5 text-sm" value="theme">Theme</Tabs.Trigger>
    <Tabs.Trigger class="rounded-full px-3 py-1.5 text-sm" value="preferences">
      Preferences
    </Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="theme">
    <ThemeSelector />
  </Tabs.Content>

  <Tabs.Content value="preferences">
    <div class="grid gap-6 xl:grid-cols-2">
      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none" id="settings-alerts">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Typography
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-5">
          <div class="grid gap-2">
            <p class="text-sm font-semibold text-[var(--foreground)]">Font pairing</p>
            <div class="flex flex-wrap gap-3">
              {#each fontPairings as pairing}
                <Button
                  class="rounded-full px-4"
                  variant={$fontStore.id === pairing.id ? "default" : "outline"}
                  onclick={() => setFontPairing(pairing.id)}
                >
                  {pairing.name}
                </Button>
              {/each}
            </div>
          </div>

          <div class="rounded-3xl app-surface p-5">
            <p class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
              Genesis typography preview
            </p>
            <p class="mt-2 text-sm text-[var(--muted)]">
              The desktop runtime applies the selected pairing at the document root.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Local preferences
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-5">
          <div class="grid gap-2">
            <p class="text-sm font-semibold text-[var(--foreground)]">Language</p>
            <div class="flex gap-3">
              {#each languages as language}
                <Button
                  class="rounded-full px-4"
                  variant={$languageStore.code === language.code ? "default" : "outline"}
                  onclick={() => setLanguage(language.code)}
                >
                  {language.label}
                </Button>
              {/each}
            </div>
          </div>

          <div class="grid gap-2">
            <p class="text-sm font-semibold text-[var(--foreground)]">Reopen shortcut</p>
            <div class="grid gap-3">
              {#each reopenShortcutOptions as shortcut}
                <button
                  class={`flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] ${$desktopSettings.shortcuts.reopenId === shortcut.id ? "bg-[var(--surface)]" : ""}`}
                  type="button"
                  onclick={() =>
                    void updateDesktopSettings((current) => ({
                      ...current,
                      shortcuts: {
                        ...current.shortcuts,
                        reopenId: shortcut.id,
                      },
                    }))
                  }
                >
                  <span>
                    <span class="block font-semibold text-[var(--foreground)]">{shortcut.label}</span>
                    <span class="block text-sm text-[var(--muted)]">{shortcut.description}</span>
                  </span>
                  <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                    {$desktopSettings.shortcuts.reopenId === shortcut.id ? "Active" : "Available"}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-2">
      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Shell behavior
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-3">
          <button
            class={`flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] ${$desktopSettings.workspace.sidebarCollapsed ? "bg-[var(--surface)]" : ""}`}
            type="button"
            onclick={toggleWorkspaceCollapsed}
          >
            <span>
              <span class="block font-semibold text-[var(--foreground)]">Start with sidebar collapsed</span>
              <span class="block text-sm text-[var(--muted)]">Keeps the left shell compact on launch.</span>
            </span>
            <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              {$desktopSettings.workspace.sidebarCollapsed ? "On" : "Off"}
            </span>
          </button>

          <button
            class={`flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] ${$desktopSettings.window.restoreOnLaunch ? "bg-[var(--surface)]" : ""}`}
            type="button"
            onclick={toggleWindowRestore}
          >
            <span>
              <span class="block font-semibold text-[var(--foreground)]">Restore window on launch</span>
              <span class="block text-sm text-[var(--muted)]">Reopens the last valid window bounds.</span>
            </span>
            <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              {$desktopSettings.window.restoreOnLaunch ? "On" : "Off"}
            </span>
          </button>

          <button
            class={`flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] ${$desktopSettings.window.startHidden ? "bg-[var(--surface)]" : ""}`}
            type="button"
            onclick={toggleStartHidden}
          >
            <span>
              <span class="block font-semibold text-[var(--foreground)]">Start hidden</span>
              <span class="block text-sm text-[var(--muted)]">Useful when the shell is used as a background helper.</span>
            </span>
            <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              {$desktopSettings.window.startHidden ? "On" : "Off"}
            </span>
          </button>
        </CardContent>
      </Card>

      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Alerts and telemetry
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-3">
          <button
            class={`flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] ${$desktopSettings.notifications.backgroundAlerts ? "bg-[var(--surface)]" : ""}`}
            type="button"
            onclick={toggleBackgroundAlerts}
          >
            <span>
              <span class="block font-semibold text-[var(--foreground)]">Background alerts</span>
              <span class="block text-sm text-[var(--muted)]">Use native notifications when the window is hidden.</span>
            </span>
            <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              {$desktopSettings.notifications.backgroundAlerts ? "On" : "Off"}
            </span>
          </button>

          <button
            class={`flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] ${$desktopSettings.telemetry.consented ? "bg-[var(--surface)]" : ""}`}
            type="button"
            onclick={toggleTelemetryConsent}
          >
            <span>
              <span class="block font-semibold text-[var(--foreground)]">Crash telemetry consent</span>
              <span class="block text-sm text-[var(--muted)]">
                Keeps telemetry off unless you explicitly opt in.
              </span>
            </span>
            <span class="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              {$desktopSettings.telemetry.consented ? "On" : "Off"}
            </span>
          </button>
        </CardContent>
      </Card>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-2">
      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader class="flex-row items-center justify-between">
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Export storage
          </CardTitle>
          <Button class="rounded-full px-5" variant="outline" disabled={isChoosingExportDirectory} onclick={chooseExportDirectory}>
            {isChoosingExportDirectory ? "Choosing..." : "Choose folder"}
          </Button>
        </CardHeader>
        <CardContent class="grid gap-3">
          <div class="rounded-2xl app-surface p-4">
            <p class="text-sm font-semibold text-[var(--foreground)]">Current export directory</p>
            <p class="mt-1 break-all text-sm text-[var(--muted)]">
              {$desktopSettings.files.exportDirectory || "Downloads/Genesis/exports"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader class="flex-row items-center justify-between">
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Settings backup
          </CardTitle>
          <div class="flex gap-3">
            <Button class="rounded-full px-5" variant="outline" disabled={isRestoring} onclick={restoreSettingsBackup}>
              {isRestoring ? "Restoring..." : "Restore"}
            </Button>
            <Button class="rounded-full px-5" disabled={isBackingUp} onclick={createSettingsBackup}>
              {isBackingUp ? "Backing up..." : "Back up"}
            </Button>
          </div>
        </CardHeader>
        <CardContent class="grid gap-3">
          <div class="rounded-2xl app-surface p-4">
            <p class="font-semibold text-[var(--foreground)]">Versioned Rust-owned settings</p>
            <p class="mt-1 text-sm text-[var(--muted)]">
              Every change is persisted through the desktop backend, not browser storage.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </Tabs.Content>
</Tabs.Root>
