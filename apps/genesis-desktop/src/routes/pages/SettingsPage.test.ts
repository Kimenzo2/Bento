import { beforeEach, describe, expect, it } from "vitest";
import { get } from "svelte/store";
import {
  defaultFontPairingId,
  defaultLanguageCode,
  defaultReopenShortcutId,
} from "$lib/data/preferences";
import { defaultThemeId } from "$lib/data/themes";
import {
  defaultDesktopSettings,
  desktopSettings,
  normalizeFontPairingId,
  normalizeLanguageCode,
  normalizeShortcutId,
  normalizeThemeId,
} from "$lib/desktop/settings";
import {
  setAvailableUpdate,
  setDownloadedBytes,
  setInstallingUpdate,
  setUpdateChecking,
  updateStore,
} from "$lib/stores/update.store";

describe("Desktop settings helpers", () => {
  it("normalizes unknown values to defaults", () => {
    expect(normalizeThemeId("nope")).toBe(defaultThemeId);
    expect(normalizeFontPairingId("nope")).toBe(defaultFontPairingId);
    expect(normalizeLanguageCode("nope")).toBe(defaultLanguageCode);
    expect(normalizeShortcutId("nope")).toBe(defaultReopenShortcutId);
  });

  it("exposes the default desktop settings snapshot", () => {
    expect(get(desktopSettings)).toEqual(defaultDesktopSettings);
  });
});

describe("Update store", () => {
  beforeEach(() => {
    setAvailableUpdate(null);
    setUpdateChecking(false);
    setInstallingUpdate(false);
    setDownloadedBytes(0);
  });

  it("tracks check, availability, install, and progress state", () => {
    expect(get(updateStore)).toEqual({
      available: null,
      checking: false,
      installing: false,
      downloadedBytes: 0,
    });

    setUpdateChecking(true);
    expect(get(updateStore)).toMatchObject({ checking: true });

    setAvailableUpdate({
      version: "0.2.0",
      body: "Bug fixes",
    });
    expect(get(updateStore)).toMatchObject({
      available: {
        version: "0.2.0",
        body: "Bug fixes",
      },
      checking: false,
      downloadedBytes: 0,
    });

    setInstallingUpdate(true);
    expect(get(updateStore)).toMatchObject({
      installing: true,
      downloadedBytes: 0,
    });

    setDownloadedBytes(1024);
    expect(get(updateStore)).toMatchObject({ downloadedBytes: 1024 });
  });
});
