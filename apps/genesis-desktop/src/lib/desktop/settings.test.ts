import { describe, expect, it } from "vitest";
import {
  defaultDesktopSettings,
  desktopSettings,
  desktopSettingsSchemaSafeParse,
  getDesktopSettingsSnapshot,
  saveDesktopSettings,
  updateDesktopSettings,
} from "./settings";
import { defaultThemeId, resolveThemeById } from "$lib/data/themes";

describe("desktop settings contract", () => {
  it("tracks legacy browser-storage migration in the native settings schema", () => {
    expect(defaultDesktopSettings.migration.legacyBrowserStorageMigrated).toBe(false);
    expect(defaultDesktopSettings.migration.storeSettingsMigrated).toBe(false);

    const parsed = desktopSettingsSchemaSafeParse({
      ...defaultDesktopSettings,
      migration: {
        legacyBrowserStorageMigrated: true,
        storeSettingsMigrated: true,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts settings that predate the migration marker", () => {
    const parsed = desktopSettingsSchemaSafeParse({
      ...defaultDesktopSettings,
      migration: undefined,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data!.migration.legacyBrowserStorageMigrated).toBe(false);
    expect(parsed.data!.migration.storeSettingsMigrated).toBe(false);
  });

  it("defaults the desktop to Midnight Classic", () => {
    expect(defaultThemeId).toBe("midnight");
    expect(defaultDesktopSettings.appearance.themeId).toBe("midnight");
    expect(defaultDesktopSettings.workspace.sidebarCollapsed).toBe(true);
    expect(resolveThemeById("unknown-theme").id).toBe("midnight");
  });

  it("keeps the sidebar collapsed when the theme mode changes", async () => {
    const original = getDesktopSettingsSnapshot();

    try {
      desktopSettings.set({
        ...defaultDesktopSettings,
        workspace: {
          sidebarCollapsed: true,
          sidebarHidden: false,
          sidebarWidth: 288,
          sidebarTop: 54,
          tabsEnabled: false,
        },
      });

      await saveDesktopSettings(getDesktopSettingsSnapshot());

      await updateDesktopSettings((current) => ({
        ...current,
        appearance: {
          ...current.appearance,
          mode: current.appearance.mode === "light" ? "dark" : "light",
        },
      }));

      expect(getDesktopSettingsSnapshot().workspace.sidebarCollapsed).toBe(true);
    } finally {
      desktopSettings.set(original);
      await saveDesktopSettings(original);
    }
  });
});
