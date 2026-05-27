import { browser } from '$app/environment';
import { setTheme as setNativeTheme } from '@tauri-apps/api/app';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { load, type Store } from '@tauri-apps/plugin-store';
import { writable, get } from 'svelte/store';
import { z } from 'zod';
import {
  defaultThemeId,
  desktopThemes,
  getThemeTokensFor,
  type ThemeId,
  type ThemeMode,
} from '$lib/data/themes';
import {
  defaultFontPairingId,
  defaultLanguageCode,
  defaultReopenShortcutId,
  fontPairings,
  languages,
  type ReopenShortcutId,
} from '$lib/data/preferences';

const THEME_KEY = 'bento_desktop_theme';
const MODE_KEY = 'bento_desktop_mode';
const FONT_KEY = 'bento_desktop_fonts';
const LANGUAGE_KEY = 'bento_desktop_language';
const SIDEBAR_KEY = 'bento_desktop_sidebar_collapsed';
const SIDEBAR_WIDTH_KEY = 'bento_desktop_sidebar_width';
const SHORTCUT_KEY = 'bento_desktop_shortcut';
const NOTIFICATIONS_KEY = 'bento_desktop_notifications';
const TELEMETRY_KEY = 'bento_desktop_telemetry';
const EXPORT_DIRECTORY_KEY = 'bento_desktop_export_directory';
const SETTINGS_KEY = 'bento_desktop_settings';
const STORE_PATH = 'settings.json';
const THEME_SNAPSHOT_KEY = '__bento_theme_snapshot';

const storeKeys = {
  themeId: 'appearance.themeId',
  mode: 'appearance.mode',
  fontPairingId: 'appearance.fontPairingId',
  languageCode: 'language.code',
  dateFormat: 'language.dateFormat',
  timeFormat: 'language.timeFormat',
  firstDay: 'language.firstDay',
  sidebarCollapsed: 'workspace.sidebarCollapsed',
  sidebarWidth: 'workspace.sidebarWidth',
  sidebarTop: 'workspace.sidebarTop',
  tabsEnabled: 'workspace.tabsEnabled',
  sidebarHidden: 'workspace.sidebarHidden',
  restoreOnLaunch: 'window.restoreOnLaunch',
  startHidden: 'window.startHidden',
  reopenId: 'shortcuts.reopenId',
  backgroundAlerts: 'notifications.backgroundAlerts',
  telemetryConsented: 'telemetry.consented',
  telemetryCrashReports: 'telemetry.crashReports',
  exportDirectory: 'files.exportDirectory',
  legacyBrowserStorageMigrated: 'migration.legacyBrowserStorageMigrated',
  storeSettingsMigrated: 'migration.storeSettingsMigrated',
} as const;

const themeModeSchema = z.enum(['light', 'dark']);
// All 27 interface language codes — ported from Anytype-ts src/json/lang.ts
const languageCodeSchema = z.enum([
  'en', 'ar', 'be', 'cs', 'da', 'de', 'es', 'fa', 'fr', 'hi',
  'id', 'it', 'ja', 'ko', 'lt', 'nl', 'no', 'pl', 'pt-BR', 'pt-PT',
  'ro', 'ru', 'tr', 'uk', 'vi', 'zh-CN', 'zh-TW',
]);
// Mirrors Anytype's I.DateFormat options from language.tsx
const dateFormatSchema = z.enum([
  'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY', 'MMMM D, YYYY',
]).default('MM/DD/YYYY');
// Mirrors Anytype's I.TimeFormat (H12 / H24)
const timeFormatSchema = z.enum(['12h', '24h']).default('12h');
// Mirrors Anytype's firstDayOptions
const firstDaySchema = z.enum(['monday', 'sunday', 'saturday']).default('monday');
const shortcutSchema = z.enum(['ctrl-alt-g', 'ctrl-shift-g', 'ctrl-shift-space']);

const themeSchema = z
  .object({
    themeId: z.string().min(1),
    mode: themeModeSchema,
    fontPairingId: z.string().min(1),
  })
  .passthrough();

const migrationSchema = z
  .object({
    legacyBrowserStorageMigrated: z.boolean().default(false),
    storeSettingsMigrated: z.boolean().default(false),
  })
  .default({
    legacyBrowserStorageMigrated: false,
    storeSettingsMigrated: false,
  });

const desktopSettingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    appearance: themeSchema,
    language: z
      .object({
        code: languageCodeSchema,
        dateFormat: dateFormatSchema,
        timeFormat: timeFormatSchema,
        firstDay: firstDaySchema,
      })
      .passthrough(),
    workspace: z
      .object({
        sidebarCollapsed: z.boolean().default(false),
        sidebarHidden: z.boolean().default(false),
        sidebarWidth: z.number().default(288),
        sidebarTop: z.number().default(54),
        tabsEnabled: z.boolean().default(false),
      })
      .passthrough(),
    window: z
      .object({
        restoreOnLaunch: z.boolean(),
        startHidden: z.boolean(),
      })
      .passthrough(),
    shortcuts: z
      .object({
        reopenId: shortcutSchema,
      })
      .passthrough(),
    notifications: z
      .object({
        backgroundAlerts: z.boolean(),
      })
      .passthrough(),
    telemetry: z
      .object({
        consented: z.boolean(),
        crashReports: z.boolean(),
      })
      .passthrough(),
    files: z
      .object({
        exportDirectory: z.string(),
      })
      .passthrough(),
    migration: migrationSchema,
  })
  .passthrough();

export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;
export type DesktopThemeMode = ThemeMode;
export type DesktopLanguageCode = z.infer<typeof languageCodeSchema>;
export type DesktopDateFormat = z.infer<typeof dateFormatSchema>;
export type DesktopTimeFormat = z.infer<typeof timeFormatSchema>;
export type DesktopFirstDay = z.infer<typeof firstDaySchema>;
export type DesktopShortcutId = ReopenShortcutId;

export const defaultDesktopSettings: DesktopSettings = {
  schemaVersion: 1,
  appearance: {
    themeId: defaultThemeId,
    mode: 'dark',
    fontPairingId: defaultFontPairingId,
  },
  language: {
    code: defaultLanguageCode,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    firstDay: 'monday',
  },
  workspace: {
    sidebarCollapsed: true,
    sidebarHidden: false,
    sidebarWidth: 288,
    sidebarTop: 54,
    tabsEnabled: true,
  },
  window: {
    restoreOnLaunch: true,
    startHidden: false,
  },
  shortcuts: {
    reopenId: defaultReopenShortcutId,
  },
  notifications: {
    backgroundAlerts: true,
  },
  telemetry: {
    consented: false,
    crashReports: false,
  },
  files: {
    exportDirectory: '',
  },
  migration: {
    legacyBrowserStorageMigrated: false,
    storeSettingsMigrated: false,
  },
};

export const desktopSettings = writable<DesktopSettings>(defaultDesktopSettings);
export const desktopSettingsReady = writable(false);

let settingsStorePromise: Promise<Store> | null = null;

export function normalizeThemeId(themeId: string): ThemeId {
  return desktopThemes.find((theme) => theme.id === themeId)?.id ?? defaultThemeId;
}

export function normalizeFontPairingId(fontPairingId: string): string {
  return fontPairings.find((entry) => entry.id === fontPairingId)?.id ?? defaultFontPairingId;
}

export function normalizeLanguageCode(languageCode: string): DesktopLanguageCode {
  // Accept all 27 Anytype-ported language codes
  const result = languageCodeSchema.safeParse(languageCode);
  if (result.success) return result.data as DesktopLanguageCode;
  // Fuzzy fallback: match by prefix (e.g. "pt" → "pt-BR")
  const prefix = languageCode.toLowerCase().split('-')[0];
  const byPrefix = languageCodeSchema.options.find((c) => c.toLowerCase().startsWith(prefix));
  return (byPrefix as DesktopLanguageCode) ?? defaultLanguageCode;
}

export function normalizeShortcutId(shortcutId: string): DesktopShortcutId {
  return shortcutSchema.safeParse(shortcutId).success
    ? (shortcutId as DesktopShortcutId)
    : defaultReopenShortcutId;
}

function desktopSettingsEquals(left: DesktopSettings, right: DesktopSettings) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isTauriRuntimeAvailable() {
  return browser && isTauri();
}

function storeDefaults() {
  return {
    [storeKeys.themeId]: defaultDesktopSettings.appearance.themeId,
    [storeKeys.mode]: defaultDesktopSettings.appearance.mode,
    [storeKeys.fontPairingId]: defaultDesktopSettings.appearance.fontPairingId,
    [storeKeys.languageCode]: defaultDesktopSettings.language.code,
    [storeKeys.dateFormat]: defaultDesktopSettings.language.dateFormat,
    [storeKeys.timeFormat]: defaultDesktopSettings.language.timeFormat,
    [storeKeys.firstDay]: defaultDesktopSettings.language.firstDay,
    [storeKeys.sidebarCollapsed]: defaultDesktopSettings.workspace.sidebarCollapsed,
    [storeKeys.sidebarHidden]: defaultDesktopSettings.workspace.sidebarHidden,
    [storeKeys.sidebarWidth]: defaultDesktopSettings.workspace.sidebarWidth,
    [storeKeys.sidebarTop]: defaultDesktopSettings.workspace.sidebarTop,
    [storeKeys.restoreOnLaunch]: defaultDesktopSettings.window.restoreOnLaunch,
    [storeKeys.startHidden]: defaultDesktopSettings.window.startHidden,
    [storeKeys.reopenId]: defaultDesktopSettings.shortcuts.reopenId,
    [storeKeys.backgroundAlerts]: defaultDesktopSettings.notifications.backgroundAlerts,
    [storeKeys.telemetryConsented]: defaultDesktopSettings.telemetry.consented,
    [storeKeys.telemetryCrashReports]: defaultDesktopSettings.telemetry.crashReports,
    [storeKeys.exportDirectory]: defaultDesktopSettings.files.exportDirectory,
    [storeKeys.legacyBrowserStorageMigrated]:
      defaultDesktopSettings.migration.legacyBrowserStorageMigrated,
    [storeKeys.storeSettingsMigrated]: defaultDesktopSettings.migration.storeSettingsMigrated,
  };
}

function getSettingsStore() {
  settingsStorePromise ??= load(STORE_PATH, {
    defaults: storeDefaults(),
    autoSave: true,
  });
  return settingsStorePromise;
}

function readBrowserSettingsBlob(): DesktopSettings | null {
  if (!browser) {
    return null;
  }

  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = desktopSettingsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function persistBrowserSettings(settings: DesktopSettings) {
  if (!browser) {
    return;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.localStorage.setItem(SIDEBAR_KEY, String(settings.workspace.sidebarCollapsed));
  window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(settings.workspace.sidebarWidth));
  window.localStorage.setItem('bento_desktop_sidebar_top', String(settings.workspace.sidebarTop));
  writeThemeSnapshot(settings);
}

function readLegacyBrowserSettings() {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    appearance: {
      themeId: normalizeThemeId(window.localStorage.getItem(THEME_KEY) ?? defaultThemeId),
      mode: themeModeSchema.safeParse(window.localStorage.getItem(MODE_KEY)).success
        ? (window.localStorage.getItem(MODE_KEY) as DesktopThemeMode)
        : defaultDesktopSettings.appearance.mode,
      fontPairingId: normalizeFontPairingId(
        window.localStorage.getItem(FONT_KEY) ?? defaultFontPairingId
      ),
    },
    language: {
      code: normalizeLanguageCode(window.localStorage.getItem(LANGUAGE_KEY) ?? defaultLanguageCode),
    },
    workspace: {
      sidebarCollapsed: window.localStorage.getItem(SIDEBAR_KEY) === 'true',
      sidebarHidden: false,
      sidebarWidth:
        Number.parseInt(window.localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? '', 10) ||
        defaultDesktopSettings.workspace.sidebarWidth,
      sidebarTop:
        Number.parseInt(
          window.localStorage.getItem('bento_desktop_sidebar_top') ??
            window.localStorage.getItem('bento_desktop_sidebar_top') ??
            '',
          10
        ) ||
        defaultDesktopSettings.workspace.sidebarTop,
      tabsEnabled: window.localStorage.getItem('bento_desktop_tabs_enabled') === 'true',
    },
    shortcuts: {
      reopenId: normalizeShortcutId(
        window.localStorage.getItem(SHORTCUT_KEY) ?? defaultReopenShortcutId
      ),
    },
    notifications: {
      backgroundAlerts:
        window.localStorage.getItem(NOTIFICATIONS_KEY) === 'false'
          ? false
          : defaultDesktopSettings.notifications.backgroundAlerts,
    },
    telemetry: {
      consented: window.localStorage.getItem(TELEMETRY_KEY) === 'true',
      crashReports: window.localStorage.getItem(TELEMETRY_KEY) === 'true',
    },
    files: {
      exportDirectory: window.localStorage.getItem(EXPORT_DIRECTORY_KEY) ?? '',
    },
  };
}

function clearLegacyBrowserSettings() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(THEME_KEY);
  window.localStorage.removeItem(MODE_KEY);
  window.localStorage.removeItem(FONT_KEY);
  window.localStorage.removeItem(LANGUAGE_KEY);
  window.localStorage.removeItem(SIDEBAR_KEY);
  window.localStorage.removeItem(SIDEBAR_WIDTH_KEY);
  window.localStorage.removeItem('bento_desktop_sidebar_top');
  window.localStorage.removeItem('bento_desktop_sidebar_top');
  window.localStorage.removeItem(SHORTCUT_KEY);
  window.localStorage.removeItem(NOTIFICATIONS_KEY);
  window.localStorage.removeItem(TELEMETRY_KEY);
  window.localStorage.removeItem(EXPORT_DIRECTORY_KEY);
  window.localStorage.removeItem('bento_desktop_tabs_enabled');
}

function normalizeSettings(settings: DesktopSettings): DesktopSettings {
  return desktopSettingsSchema.parse({
    ...settings,
    appearance: {
      ...settings.appearance,
      themeId: normalizeThemeId(settings.appearance.themeId),
      fontPairingId: normalizeFontPairingId(settings.appearance.fontPairingId),
    },
    language: {
      code: normalizeLanguageCode(settings.language?.code ?? defaultLanguageCode),
      dateFormat: settings.language?.dateFormat ?? defaultDesktopSettings.language.dateFormat,
      timeFormat: settings.language?.timeFormat ?? defaultDesktopSettings.language.timeFormat,
      firstDay: settings.language?.firstDay ?? defaultDesktopSettings.language.firstDay,
    },
    workspace: {
      sidebarCollapsed:
        settings.workspace?.sidebarCollapsed ?? defaultDesktopSettings.workspace.sidebarCollapsed,
      sidebarHidden:
        settings.workspace?.sidebarHidden ?? defaultDesktopSettings.workspace.sidebarHidden,
      sidebarWidth:
        settings.workspace?.sidebarWidth ?? defaultDesktopSettings.workspace.sidebarWidth,
      sidebarTop:
        settings.workspace?.sidebarTop ?? defaultDesktopSettings.workspace.sidebarTop,
      tabsEnabled:
        settings.workspace?.tabsEnabled ?? defaultDesktopSettings.workspace.tabsEnabled,
    },
    shortcuts: {
      reopenId: normalizeShortcutId(settings.shortcuts?.reopenId ?? defaultReopenShortcutId),
    },
  });
}

async function readStoreSettings(): Promise<DesktopSettings> {
  const store = await getSettingsStore();
  const settings: DesktopSettings = {
    schemaVersion: 1,
    appearance: {
      themeId: normalizeThemeId(
        (await store.get<string>(storeKeys.themeId)) ?? defaultDesktopSettings.appearance.themeId
      ),
      mode: themeModeSchema.parse(
        (await store.get<string>(storeKeys.mode)) ?? defaultDesktopSettings.appearance.mode
      ),
      fontPairingId: normalizeFontPairingId(
        (await store.get<string>(storeKeys.fontPairingId)) ??
          defaultDesktopSettings.appearance.fontPairingId
      ),
    },
    language: {
      code: normalizeLanguageCode(
        (await store.get<string>(storeKeys.languageCode)) ?? defaultDesktopSettings.language.code
      ),
      dateFormat: (dateFormatSchema.safeParse(
        await store.get<string>(storeKeys.dateFormat)
      ).success
        ? (await store.get<string>(storeKeys.dateFormat)) as DesktopDateFormat
        : defaultDesktopSettings.language.dateFormat),
      timeFormat: (timeFormatSchema.safeParse(
        await store.get<string>(storeKeys.timeFormat)
      ).success
        ? (await store.get<string>(storeKeys.timeFormat)) as DesktopTimeFormat
        : defaultDesktopSettings.language.timeFormat),
      firstDay: (firstDaySchema.safeParse(
        await store.get<string>(storeKeys.firstDay)
      ).success
        ? (await store.get<string>(storeKeys.firstDay)) as DesktopFirstDay
        : defaultDesktopSettings.language.firstDay),
    },
    workspace: {
      sidebarCollapsed:
        (await store.get<boolean>(storeKeys.sidebarCollapsed)) ??
        defaultDesktopSettings.workspace.sidebarCollapsed,
      sidebarHidden:
        (await store.get<boolean>(storeKeys.sidebarHidden)) ??
        defaultDesktopSettings.workspace.sidebarHidden,
      sidebarWidth:
        (await store.get<number>(storeKeys.sidebarWidth)) ??
        defaultDesktopSettings.workspace.sidebarWidth,
      sidebarTop:
        (await store.get<number>(storeKeys.sidebarTop)) ??
        defaultDesktopSettings.workspace.sidebarTop,
      tabsEnabled:
        (await store.get<boolean>(storeKeys.tabsEnabled)) ??
        defaultDesktopSettings.workspace.tabsEnabled,
    },
    window: {
      restoreOnLaunch:
        (await store.get<boolean>(storeKeys.restoreOnLaunch)) ??
        defaultDesktopSettings.window.restoreOnLaunch,
      startHidden:
        (await store.get<boolean>(storeKeys.startHidden)) ??
        defaultDesktopSettings.window.startHidden,
    },
    shortcuts: {
      reopenId: normalizeShortcutId(
        (await store.get<string>(storeKeys.reopenId)) ?? defaultDesktopSettings.shortcuts.reopenId
      ),
    },
    notifications: {
      backgroundAlerts:
        (await store.get<boolean>(storeKeys.backgroundAlerts)) ??
        defaultDesktopSettings.notifications.backgroundAlerts,
    },
    telemetry: {
      consented:
        (await store.get<boolean>(storeKeys.telemetryConsented)) ??
        defaultDesktopSettings.telemetry.consented,
      crashReports:
        (await store.get<boolean>(storeKeys.telemetryCrashReports)) ??
        defaultDesktopSettings.telemetry.crashReports,
    },
    files: {
      exportDirectory:
        (await store.get<string>(storeKeys.exportDirectory)) ??
        defaultDesktopSettings.files.exportDirectory,
    },
    migration: {
      legacyBrowserStorageMigrated:
        (await store.get<boolean>(storeKeys.legacyBrowserStorageMigrated)) ??
        defaultDesktopSettings.migration.legacyBrowserStorageMigrated,
      storeSettingsMigrated:
        (await store.get<boolean>(storeKeys.storeSettingsMigrated)) ??
        defaultDesktopSettings.migration.storeSettingsMigrated,
    },
  };

  return normalizeSettings(settings);
}

async function persistStoreSettings(settings: DesktopSettings) {
  const store = await getSettingsStore();
  await store.set(storeKeys.themeId, settings.appearance.themeId);
  await store.set(storeKeys.mode, settings.appearance.mode);
  await store.set(storeKeys.fontPairingId, settings.appearance.fontPairingId);
  await store.set(storeKeys.languageCode, settings.language.code);
  await store.set(storeKeys.dateFormat, settings.language.dateFormat);
  await store.set(storeKeys.timeFormat, settings.language.timeFormat);
  await store.set(storeKeys.firstDay, settings.language.firstDay);
  await store.set(storeKeys.sidebarCollapsed, settings.workspace.sidebarCollapsed);
  await store.set(storeKeys.sidebarHidden, settings.workspace.sidebarHidden);
  await store.set(storeKeys.sidebarTop, settings.workspace.sidebarTop);
  await store.set(storeKeys.tabsEnabled, settings.workspace.tabsEnabled);
  await store.set(storeKeys.restoreOnLaunch, settings.window.restoreOnLaunch);
  await store.set(storeKeys.startHidden, settings.window.startHidden);
  await store.set(storeKeys.reopenId, settings.shortcuts.reopenId);
  await store.set(storeKeys.backgroundAlerts, settings.notifications.backgroundAlerts);
  await store.set(storeKeys.telemetryConsented, settings.telemetry.consented);
  await store.set(storeKeys.telemetryCrashReports, settings.telemetry.crashReports);
  await store.set(storeKeys.exportDirectory, settings.files.exportDirectory);
  await store.set(
    storeKeys.legacyBrowserStorageMigrated,
    settings.migration.legacyBrowserStorageMigrated
  );
  await store.set(storeKeys.storeSettingsMigrated, settings.migration.storeSettingsMigrated);
  await store.save();
}

async function readNativeSettingsMirror(): Promise<DesktopSettings | null> {
  if (!isTauriRuntimeAvailable()) {
    return null;
  }

  try {
    const settings = await invoke<unknown>('load_desktop_settings');
    const parsed = desktopSettingsSchema.safeParse(settings);
    return parsed.success ? normalizeSettings(parsed.data) : null;
  } catch {
    return null;
  }
}

async function syncNativeSettingsMirror(settings: DesktopSettings) {
  if (!isTauriRuntimeAvailable()) {
    return;
  }

  try {
    await invoke<unknown>('save_desktop_settings', { settings });
  } catch (error) {
    console.warn('Bento desktop settings were stored, but native mirror sync failed.', error);
  }
}

function writeThemeSnapshot(settings: DesktopSettings) {
  if (!browser) {
    return;
  }

  const tokens = getThemeTokensFor(settings.appearance.themeId, settings.appearance.mode);
  window.sessionStorage.setItem(
    THEME_SNAPSHOT_KEY,
    JSON.stringify({
      themeId: settings.appearance.themeId,
      mode: settings.appearance.mode,
      tokens,
    })
  );
}

async function applyNativeTheme(settings: DesktopSettings) {
  if (!isTauriRuntimeAvailable()) {
    return;
  }

  try {
    await setNativeTheme(settings.appearance.mode);
  } catch (error) {
    console.warn('Bento native app theme failed to update.', error);
  }
}

function applySettingsSideEffects(settings: DesktopSettings) {
  writeThemeSnapshot(settings);
  void applyNativeTheme(settings);
}

export function getDesktopSettingsSnapshot(): DesktopSettings {
  return get(desktopSettings);
}

export async function loadDesktopSettings(): Promise<DesktopSettings> {
  if (!isTauriRuntimeAvailable()) {
    return readBrowserSettingsBlob() ?? defaultDesktopSettings;
  }

  try {
    return await readStoreSettings();
  } catch (error) {
    console.warn('Bento desktop settings failed to load from Store; falling back.', error);
    return (
      (await readNativeSettingsMirror()) ?? readBrowserSettingsBlob() ?? defaultDesktopSettings
    );
  }
}

export async function saveDesktopSettings(nextSettings: DesktopSettings): Promise<DesktopSettings> {
  const parsed = normalizeSettings(desktopSettingsSchema.parse(nextSettings));

  if (!isTauriRuntimeAvailable()) {
    persistBrowserSettings(parsed);
    desktopSettings.set(parsed);
    desktopSettingsReady.set(true);
    applySettingsSideEffects(parsed);
    return parsed;
  }

  await persistStoreSettings(parsed);
  desktopSettings.set(parsed);
  desktopSettingsReady.set(true);
  applySettingsSideEffects(parsed);
  void syncNativeSettingsMirror(parsed);
  return parsed;
}

export async function hydrateDesktopSettings(): Promise<DesktopSettings> {
  const current = await loadDesktopSettings();
  const legacySettings = readLegacyBrowserSettings();
  const nativeMirror = await readNativeSettingsMirror();
  const shouldMigrateToStore =
    isTauriRuntimeAvailable() && !current.migration.storeSettingsMigrated;

  const merged: DesktopSettings = shouldMigrateToStore
    ? {
        ...current,
        ...(nativeMirror ?? {}),
        appearance: {
          ...current.appearance,
          ...nativeMirror?.appearance,
          ...legacySettings.appearance,
        },
        language: { ...current.language, ...nativeMirror?.language, ...legacySettings.language },
    workspace: {
      ...current.workspace,
      ...nativeMirror?.workspace,
      ...legacySettings.workspace,
    },
        window: { ...current.window, ...nativeMirror?.window },
        shortcuts: {
          ...current.shortcuts,
          ...nativeMirror?.shortcuts,
          ...legacySettings.shortcuts,
        },
        notifications: {
          ...current.notifications,
          ...nativeMirror?.notifications,
          ...legacySettings.notifications,
        },
        telemetry: {
          ...current.telemetry,
          ...nativeMirror?.telemetry,
          ...legacySettings.telemetry,
        },
        files: { ...current.files, ...nativeMirror?.files, ...legacySettings.files },
        migration: {
          legacyBrowserStorageMigrated: true,
          storeSettingsMigrated: true,
        },
      }
    : {
        ...current,
        migration: {
          legacyBrowserStorageMigrated: true,
          storeSettingsMigrated:
            current.migration.storeSettingsMigrated || isTauriRuntimeAvailable(),
        },
      };

  const finalized = normalizeSettings(merged);

  if (!desktopSettingsEquals(current, finalized)) {
    const saved = await saveDesktopSettings(finalized);
    if (isTauriRuntimeAvailable()) {
      clearLegacyBrowserSettings();
    }
    return saved;
  }

  desktopSettings.set(finalized);
  desktopSettingsReady.set(true);
  applySettingsSideEffects(finalized);
  if (isTauriRuntimeAvailable()) {
    clearLegacyBrowserSettings();
  }
  return finalized;
}

export async function updateDesktopSettings(
  updater: (current: DesktopSettings) => DesktopSettings
): Promise<DesktopSettings> {
  const next = updater(getDesktopSettingsSnapshot());
  return saveDesktopSettings(next);
}

export function resolveThemeId(themeId: string): ThemeId {
  return normalizeThemeId(themeId);
}

export function resolveLanguageCode(languageCode: string): DesktopLanguageCode {
  return normalizeLanguageCode(languageCode);
}

export function resolveShortcutId(shortcutId: string): DesktopShortcutId {
  return normalizeShortcutId(shortcutId);
}

export function desktopSettingsSchemaSafeParse(value: unknown) {
  return desktopSettingsSchema.safeParse(value);
}
