import { describe, expect, it } from 'vitest';
import { defaultDesktopSettings, desktopSettingsSchemaSafeParse } from './settings';

describe('desktop settings contract', () => {
  it('tracks legacy browser-storage migration in the native settings schema', () => {
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

  it('accepts settings that predate the migration marker', () => {
    const parsed = desktopSettingsSchemaSafeParse({
      ...defaultDesktopSettings,
      migration: undefined,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.migration.legacyBrowserStorageMigrated).toBe(false);
      expect(parsed.data.migration.storeSettingsMigrated).toBe(false);
    }
  });
});
