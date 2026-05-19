import { beforeEach, describe, expect, it } from "vitest";
import { get } from "svelte/store";
import {
  DESKTOP_SETTINGS_COMMANDS,
  buildDefaultLaunchModuleArgs,
  buildKeyboardShortcutArgs,
  buildLaunchOnLoginArgs,
  buildLocaleConfigArgs,
  buildNotificationConfigArgs,
  buildPrivacySettingsArgs,
  buildStartupConfigArgs,
  buildUpdateChannelArgs,
} from "$lib/desktop/settings";
import {
  clearUpdateState,
  setAvailableUpdate,
  setDownloadedBytes,
  setInstallingUpdate,
  setUpdateChecking,
  setUpdateError,
  updateStore,
} from "$lib/stores/update.store";

describe("Settings payload builders", () => {
  it("keeps the update check command stable", () => {
    expect(DESKTOP_SETTINGS_COMMANDS.checkForUpdates).toBe("check_for_updates");
  });

  it("builds the update channel payload exactly", () => {
    expect(buildUpdateChannelArgs("beta")).toEqual({ channel: "beta" });
    expect(buildUpdateChannelArgs("stable")).toEqual({ channel: "stable" });
  });

  it("builds the current settings payloads exactly", () => {
    expect(buildLaunchOnLoginArgs(true)).toEqual({ enabled: true });
    expect(buildDefaultLaunchModuleArgs("tasks")).toEqual({ moduleId: "tasks" });
    expect(buildKeyboardShortcutArgs("Open Settings", "Cmd+,")).toEqual({
      action: "Open Settings",
      combo: "Cmd+,",
    });
    expect(buildNotificationConfigArgs(true)).toEqual({
      enabled: true,
      soundEnabled: true,
      doNotDisturbFrom: null,
      doNotDisturbTo: null,
      dndDays: [],
      moduleSettings: {},
    });
    expect(buildPrivacySettingsArgs(true, false, 5, true)).toEqual({
      analytics: true,
      crashReports: false,
      sessionLockTimeout: 5,
      biometricUnlock: true,
    });
    expect(buildStartupConfigArgs(true, false, "tray", true)).toEqual({
      launch_on_login: true,
      start_minimized: false,
      close_behavior: "tray",
      hardware_acceleration: true,
    });
    expect(
      buildLocaleConfigArgs("en", "MM/DD/YYYY", "12h", "monday", "USD", "metric", "us")
    ).toEqual({
      language: "en",
      date_format: "MM/DD/YYYY",
      time_format: "12h",
      week_starts_on: "monday",
      currency: "USD",
      units: "metric",
      number_format: "us",
    });
  });
});

describe("Update store", () => {
  beforeEach(() => {
    clearUpdateState();
  });

  it("tracks check, availability, install, and error state", () => {
    expect(get(updateStore)).toEqual({
      available: null,
      checking: false,
      installing: false,
      downloadedBytes: 0,
      error: null,
    });

    setUpdateChecking(true);
    expect(get(updateStore)).toMatchObject({ checking: true, error: null });

    setAvailableUpdate({
      version: "0.2.0",
      body: "Bug fixes",
      downloadSize: 5_000_000,
    });
    expect(get(updateStore)).toMatchObject({
      available: {
        version: "0.2.0",
        body: "Bug fixes",
        downloadSize: 5_000_000,
      },
      checking: false,
      downloadedBytes: 0,
      error: null,
    });

    setInstallingUpdate(true);
    expect(get(updateStore)).toMatchObject({
      installing: true,
      downloadedBytes: 0,
    });

    setDownloadedBytes(1024);
    expect(get(updateStore)).toMatchObject({ downloadedBytes: 1024 });

    setUpdateError("Failed to install update.");
    expect(get(updateStore)).toMatchObject({
      checking: false,
      installing: false,
      error: "Failed to install update.",
    });

    clearUpdateState();
    expect(get(updateStore)).toEqual({
      available: null,
      checking: false,
      installing: false,
      downloadedBytes: 0,
      error: null,
    });
  });
});
