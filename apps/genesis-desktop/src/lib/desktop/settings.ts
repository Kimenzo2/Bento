import { browser } from "$app/environment";
import { setTheme as setNativeTheme } from "@tauri-apps/api/app";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";
import { writable, get } from "svelte/store";
import { z } from "zod";
import {
  defaultThemeId,
  desktopThemes,
  getThemeTokensFor,
  type ThemeId,
  type ThemeMode,
} from "$lib/data/themes";
import {
  defaultFontPairingId,
  defaultLanguageCode,
  defaultReopenShortcutId,
  fontPairings,
  type ReopenShortcutId,
} from "$lib/data/preferences";

const THEME_KEY = "bento_desktop_theme";
const MODE_KEY = "bento_desktop_mode";
const FONT_KEY = "bento_desktop_fonts";
const LANGUAGE_KEY = "bento_desktop_language";
const SIDEBAR_KEY = "bento_desktop_sidebar_collapsed";
const SIDEBAR_WIDTH_KEY = "bento_desktop_sidebar_width";
const SHORTCUT_KEY = "bento_desktop_shortcut";
const NOTIFICATIONS_KEY = "bento_desktop_notifications";
const TELEMETRY_KEY = "bento_desktop_telemetry";
const EXPORT_DIRECTORY_KEY = "bento_desktop_export_directory";
const CLOUD_BACKUP_KEY = "bento_desktop_cloud_backup";
const SETTINGS_KEY = "bento_desktop_settings";
const STORE_PATH = "settings.json";
const THEME_SNAPSHOT_KEY = "__bento_theme_snapshot";

const storeKeys = {
  themeId: "appearance.themeId",
  mode: "appearance.mode",
  fontPairingId: "appearance.fontPairingId",
  languageCode: "language.code",
  dateFormat: "language.dateFormat",
  timeFormat: "language.timeFormat",
  firstDay: "language.firstDay",
  sidebarCollapsed: "workspace.sidebarCollapsed",
  sidebarWidth: "workspace.sidebarWidth",
  sidebarTop: "workspace.sidebarTop",
  tabsEnabled: "workspace.tabsEnabled",
  sidebarHidden: "workspace.sidebarHidden",
  restoreOnLaunch: "window.restoreOnLaunch",
  startHidden: "window.startHidden",
  reopenId: "shortcuts.reopenId",
  backgroundAlerts: "notifications.backgroundAlerts",
  telemetryConsented: "telemetry.consented",
  telemetryCrashReports: "telemetry.crashReports",
  exportDirectory: "files.exportDirectory",
  cloudBackupEnabled: "cloudBackup.enabled",
  cloudBackupProjectUrl: "cloudBackup.projectUrl",
  cloudBackupAnonKey: "cloudBackup.anonKey",
  cloudBackupBucketName: "cloudBackup.bucketName",
  cloudBackupScheduleEnabled: "cloudBackup.scheduleEnabled",
  cloudBackupSchedule: "cloudBackup.schedule",
  cloudBackupScope: "cloudBackup.scope",
  cloudBackupSelectedModules: "cloudBackup.selectedModules",
  cloudBackupLastBackupAt: "cloudBackup.lastBackupAt",
  cloudBackupLastBackupSizeBytes: "cloudBackup.lastBackupSizeBytes",
  cloudBackupLastBackupObjectPath: "cloudBackup.lastBackupObjectPath",
  cloudBackupLastBackupStatus: "cloudBackup.lastBackupStatus",
  cloudBackupStorageUsageBytes: "cloudBackup.storageUsageBytes",
  legacyBrowserStorageMigrated: "migration.legacyBrowserStorageMigrated",
  storeSettingsMigrated: "migration.storeSettingsMigrated",
  dynamicIslandEnabled: "dynamicIslandEnabled",
} as const;

const themeModeSchema = z.enum(["light", "dark"]);
// All 27 interface language codes — ported from Anytype-ts src/json/lang.ts
const languageCodeSchema = z.enum([
  "en",
  "ar",
  "be",
  "cs",
  "da",
  "de",
  "es",
  "fa",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "nl",
  "no",
  "pl",
  "pt-BR",
  "pt-PT",
  "ro",
  "ru",
  "tr",
  "uk",
  "vi",
  "zh-CN",
  "zh-TW",
]);
// Mirrors Anytype's I.DateFormat options from language.tsx
const dateFormatSchema = z
  .enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD.MM.YYYY", "MMMM D, YYYY"])
  .default("MM/DD/YYYY");
// Mirrors Anytype's I.TimeFormat (H12 / H24)
const timeFormatSchema = z.enum(["12h", "24h"]).default("12h");
// Mirrors Anytype's firstDayOptions
const firstDaySchema = z.enum(["monday", "sunday", "saturday"]).default("monday");
const shortcutSchema = z.enum(["ctrl-alt-g", "ctrl-shift-g", "ctrl-shift-space"]);
const cloudBackupScopeSchema = z.enum(["all", "selected"]).default("all");
const cloudBackupScheduleSchema = z.enum(["daily", "weekly"]).default("daily");

const themeSchema = z
  .object({
    themeId: z.string().min(1),
    mode: themeModeSchema,
    fontPairingId: z.string().min(1),
    glassEnabled: z.boolean().default(false),
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
    cloudBackup: z
      .object({
        enabled: z.boolean().default(false),
        projectUrl: z.string().default(""),
        anonKey: z.string().default(""),
        bucketName: z.string().default("bento-backups"),
        scheduleEnabled: z.boolean().default(false),
        schedule: cloudBackupScheduleSchema,
        scope: cloudBackupScopeSchema,
        selectedModules: z.array(z.string()).default([]),
        lastBackupAt: z.string().nullable().default(null),
        lastBackupSizeBytes: z.number().int().nonnegative().nullable().default(null),
        lastBackupObjectPath: z.string().nullable().default(null),
        lastBackupStatus: z.string().nullable().default(null),
        storageUsageBytes: z.number().int().nonnegative().nullable().default(null),
      })
      .passthrough(),
    migration: migrationSchema,
    dynamicIslandEnabled: z.boolean().default(true),
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
    mode: "dark",
    fontPairingId: defaultFontPairingId,
    glassEnabled: false,
  },
  language: {
    code: defaultLanguageCode,
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    firstDay: "monday",
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
    exportDirectory: "",
  },
  cloudBackup: {
    enabled: false,
    projectUrl: "",
    anonKey: "",
    bucketName: "bento-backups",
    scheduleEnabled: false,
    schedule: "daily",
    scope: "all",
    selectedModules: [],
    lastBackupAt: null,
    lastBackupSizeBytes: null,
    lastBackupObjectPath: null,
    lastBackupStatus: null,
    storageUsageBytes: null,
  },
  migration: {
    legacyBrowserStorageMigrated: false,
    storeSettingsMigrated: false,
  },
  dynamicIslandEnabled: true,
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
  const prefix = languageCode.toLowerCase().split("-")[0];
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

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
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
    [storeKeys.cloudBackupEnabled]: defaultDesktopSettings.cloudBackup.enabled,
    [storeKeys.cloudBackupProjectUrl]: defaultDesktopSettings.cloudBackup.projectUrl,
    [storeKeys.cloudBackupAnonKey]: defaultDesktopSettings.cloudBackup.anonKey,
    [storeKeys.cloudBackupBucketName]: defaultDesktopSettings.cloudBackup.bucketName,
    [storeKeys.cloudBackupScheduleEnabled]: defaultDesktopSettings.cloudBackup.scheduleEnabled,
    [storeKeys.cloudBackupSchedule]: defaultDesktopSettings.cloudBackup.schedule,
    [storeKeys.cloudBackupScope]: defaultDesktopSettings.cloudBackup.scope,
    [storeKeys.cloudBackupSelectedModules]: defaultDesktopSettings.cloudBackup.selectedModules,
    [storeKeys.cloudBackupLastBackupAt]: defaultDesktopSettings.cloudBackup.lastBackupAt,
    [storeKeys.cloudBackupLastBackupSizeBytes]:
      defaultDesktopSettings.cloudBackup.lastBackupSizeBytes,
    [storeKeys.cloudBackupLastBackupObjectPath]:
      defaultDesktopSettings.cloudBackup.lastBackupObjectPath,
    [storeKeys.cloudBackupLastBackupStatus]: defaultDesktopSettings.cloudBackup.lastBackupStatus,
    [storeKeys.cloudBackupStorageUsageBytes]: defaultDesktopSettings.cloudBackup.storageUsageBytes,
    [storeKeys.legacyBrowserStorageMigrated]:
      defaultDesktopSettings.migration.legacyBrowserStorageMigrated,
    [storeKeys.storeSettingsMigrated]: defaultDesktopSettings.migration.storeSettingsMigrated,
    [storeKeys.dynamicIslandEnabled]: defaultDesktopSettings.dynamicIslandEnabled,
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
    return result.success
      ? { ...result.data, workspace: { ...result.data.workspace, sidebarCollapsed: true } }
      : null;
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
  window.localStorage.setItem("bento_desktop_sidebar_top", String(settings.workspace.sidebarTop));
  writeThemeSnapshot(settings);
}

function readLegacyBrowserSettings() {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    appearance: {
      themeId: normalizeThemeId(window.localStorage.getItem(THEME_KEY) ?? defaultThemeId),
      mode: themeModeSchema.safeParse(window.localStorage.getItem(MODE_KEY)).success
        ? (window.localStorage.getItem(MODE_KEY) as DesktopThemeMode)
        : defaultDesktopSettings.appearance.mode,
      fontPairingId: normalizeFontPairingId(
        window.localStorage.getItem(FONT_KEY) ?? defaultFontPairingId,
      ),
    },
    language: {
      code: normalizeLanguageCode(window.localStorage.getItem(LANGUAGE_KEY) ?? defaultLanguageCode),
    },
    workspace: {
      sidebarCollapsed: true, // Always start collapsed — user toggle is per-session only
      sidebarHidden: false,
      sidebarWidth:
        Number.parseInt(window.localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? "", 10) ||
        defaultDesktopSettings.workspace.sidebarWidth,
      sidebarTop:
        Number.parseInt(
          window.localStorage.getItem("bento_desktop_sidebar_top") ??
            window.localStorage.getItem("bento_desktop_sidebar_top") ??
            "",
          10,
        ) || defaultDesktopSettings.workspace.sidebarTop,
      tabsEnabled: window.localStorage.getItem("bento_desktop_tabs_enabled") === "true",
    },
    shortcuts: {
      reopenId: normalizeShortcutId(
        window.localStorage.getItem(SHORTCUT_KEY) ?? defaultReopenShortcutId,
      ),
    },
    notifications: {
      backgroundAlerts:
        window.localStorage.getItem(NOTIFICATIONS_KEY) === "false"
          ? false
          : defaultDesktopSettings.notifications.backgroundAlerts,
    },
    telemetry: {
      consented: window.localStorage.getItem(TELEMETRY_KEY) === "true",
      crashReports: window.localStorage.getItem(TELEMETRY_KEY) === "true",
    },
    files: {
      exportDirectory: window.localStorage.getItem(EXPORT_DIRECTORY_KEY) ?? "",
    },
    cloudBackup: {
      enabled: window.localStorage.getItem(CLOUD_BACKUP_KEY) === "true",
      projectUrl: window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.projectUrl`) ?? "",
      anonKey: window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.anonKey`) ?? "",
      bucketName: window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.bucketName`) ?? "bento-backups",
      scheduleEnabled:
        window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.scheduleEnabled`) === "true",
      schedule: cloudBackupScheduleSchema.safeParse(
        window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.schedule`),
      ).success
        ? (window.localStorage.getItem(
            `${CLOUD_BACKUP_KEY}.schedule`,
          ) as DesktopSettings["cloudBackup"]["schedule"])
        : defaultDesktopSettings.cloudBackup.schedule,
      scope: cloudBackupScopeSchema.safeParse(
        window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.scope`),
      ).success
        ? (window.localStorage.getItem(
            `${CLOUD_BACKUP_KEY}.scope`,
          ) as DesktopSettings["cloudBackup"]["scope"])
        : defaultDesktopSettings.cloudBackup.scope,
      selectedModules: parseStringArray(
        window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.selectedModules`),
      ),
      lastBackupAt: window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.lastBackupAt`),
      lastBackupSizeBytes:
        Number.parseInt(
          window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.lastBackupSizeBytes`) ?? "",
          10,
        ) || null,
      lastBackupObjectPath: window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.lastBackupObjectPath`),
      lastBackupStatus: window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.lastBackupStatus`),
      storageUsageBytes:
        Number.parseInt(
          window.localStorage.getItem(`${CLOUD_BACKUP_KEY}.storageUsageBytes`) ?? "",
          10,
        ) || null,
    },
  };
}

function clearLegacyBrowserSettings() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(THEME_KEY);
  window.localStorage.removeItem(MODE_KEY);
  window.localStorage.removeItem(FONT_KEY);
  window.localStorage.removeItem(LANGUAGE_KEY);
  window.localStorage.removeItem(SIDEBAR_KEY);
  window.localStorage.removeItem(SIDEBAR_WIDTH_KEY);
  window.localStorage.removeItem("bento_desktop_sidebar_top");
  window.localStorage.removeItem("bento_desktop_sidebar_top");
  window.localStorage.removeItem(SHORTCUT_KEY);
  window.localStorage.removeItem(NOTIFICATIONS_KEY);
  window.localStorage.removeItem(TELEMETRY_KEY);
  window.localStorage.removeItem(EXPORT_DIRECTORY_KEY);
  window.localStorage.removeItem(CLOUD_BACKUP_KEY);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.projectUrl`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.anonKey`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.bucketName`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.scheduleEnabled`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.schedule`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.scope`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.selectedModules`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.lastBackupAt`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.lastBackupSizeBytes`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.lastBackupObjectPath`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.lastBackupStatus`);
  window.localStorage.removeItem(`${CLOUD_BACKUP_KEY}.storageUsageBytes`);
  window.localStorage.removeItem("bento_desktop_tabs_enabled");
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
      sidebarTop: settings.workspace?.sidebarTop ?? defaultDesktopSettings.workspace.sidebarTop,
      tabsEnabled: settings.workspace?.tabsEnabled ?? defaultDesktopSettings.workspace.tabsEnabled,
    },
    shortcuts: {
      reopenId: normalizeShortcutId(settings.shortcuts?.reopenId ?? defaultReopenShortcutId),
    },
    cloudBackup: {
      enabled: settings.cloudBackup?.enabled ?? defaultDesktopSettings.cloudBackup.enabled,
      projectUrl: settings.cloudBackup?.projectUrl ?? defaultDesktopSettings.cloudBackup.projectUrl,
      anonKey: settings.cloudBackup?.anonKey ?? defaultDesktopSettings.cloudBackup.anonKey,
      bucketName: settings.cloudBackup?.bucketName ?? defaultDesktopSettings.cloudBackup.bucketName,
      scheduleEnabled:
        settings.cloudBackup?.scheduleEnabled ?? defaultDesktopSettings.cloudBackup.scheduleEnabled,
      schedule: cloudBackupScheduleSchema.safeParse(settings.cloudBackup?.schedule).success
        ? (settings.cloudBackup?.schedule as DesktopSettings["cloudBackup"]["schedule"])
        : defaultDesktopSettings.cloudBackup.schedule,
      scope: cloudBackupScopeSchema.safeParse(settings.cloudBackup?.scope).success
        ? (settings.cloudBackup?.scope as DesktopSettings["cloudBackup"]["scope"])
        : defaultDesktopSettings.cloudBackup.scope,
      selectedModules: Array.isArray(settings.cloudBackup?.selectedModules)
        ? Array.from(
            new Set(settings.cloudBackup.selectedModules.filter((value) => !!value.trim())),
          )
        : defaultDesktopSettings.cloudBackup.selectedModules,
      lastBackupAt:
        settings.cloudBackup?.lastBackupAt ?? defaultDesktopSettings.cloudBackup.lastBackupAt,
      lastBackupSizeBytes:
        settings.cloudBackup?.lastBackupSizeBytes ??
        defaultDesktopSettings.cloudBackup.lastBackupSizeBytes,
      lastBackupObjectPath:
        settings.cloudBackup?.lastBackupObjectPath ??
        defaultDesktopSettings.cloudBackup.lastBackupObjectPath,
      lastBackupStatus:
        settings.cloudBackup?.lastBackupStatus ??
        defaultDesktopSettings.cloudBackup.lastBackupStatus,
      storageUsageBytes:
        settings.cloudBackup?.storageUsageBytes ??
        defaultDesktopSettings.cloudBackup.storageUsageBytes,
    },
  });
}

async function readStoreSettings(): Promise<DesktopSettings> {
  const store = await getSettingsStore();
  const settings: DesktopSettings = {
    schemaVersion: 1,
    appearance: {
      themeId: normalizeThemeId(
        (await store.get<string>(storeKeys.themeId)) ?? defaultDesktopSettings.appearance.themeId,
      ),
      mode: themeModeSchema.parse(
        (await store.get<string>(storeKeys.mode)) ?? defaultDesktopSettings.appearance.mode,
      ),
      fontPairingId: normalizeFontPairingId(
        (await store.get<string>(storeKeys.fontPairingId)) ??
          defaultDesktopSettings.appearance.fontPairingId,
      ),
      glassEnabled: defaultDesktopSettings.appearance.glassEnabled,
    },
    language: {
      code: normalizeLanguageCode(
        (await store.get<string>(storeKeys.languageCode)) ?? defaultDesktopSettings.language.code,
      ),
      dateFormat: dateFormatSchema.safeParse(await store.get<string>(storeKeys.dateFormat)).success
        ? ((await store.get<string>(storeKeys.dateFormat)) as DesktopDateFormat)
        : defaultDesktopSettings.language.dateFormat,
      timeFormat: timeFormatSchema.safeParse(await store.get<string>(storeKeys.timeFormat)).success
        ? ((await store.get<string>(storeKeys.timeFormat)) as DesktopTimeFormat)
        : defaultDesktopSettings.language.timeFormat,
      firstDay: firstDaySchema.safeParse(await store.get<string>(storeKeys.firstDay)).success
        ? ((await store.get<string>(storeKeys.firstDay)) as DesktopFirstDay)
        : defaultDesktopSettings.language.firstDay,
    },
    workspace: {
      sidebarCollapsed: true, // Always start collapsed — user toggle is per-session only
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
        (await store.get<string>(storeKeys.reopenId)) ?? defaultDesktopSettings.shortcuts.reopenId,
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
    cloudBackup: {
      enabled:
        (await store.get<boolean>(storeKeys.cloudBackupEnabled)) ??
        defaultDesktopSettings.cloudBackup.enabled,
      projectUrl:
        (await store.get<string>(storeKeys.cloudBackupProjectUrl)) ??
        defaultDesktopSettings.cloudBackup.projectUrl,
      anonKey:
        (await store.get<string>(storeKeys.cloudBackupAnonKey)) ??
        defaultDesktopSettings.cloudBackup.anonKey,
      bucketName:
        (await store.get<string>(storeKeys.cloudBackupBucketName)) ??
        defaultDesktopSettings.cloudBackup.bucketName,
      scheduleEnabled:
        (await store.get<boolean>(storeKeys.cloudBackupScheduleEnabled)) ??
        defaultDesktopSettings.cloudBackup.scheduleEnabled,
      schedule: cloudBackupScheduleSchema.safeParse(
        await store.get<string>(storeKeys.cloudBackupSchedule),
      ).success
        ? ((await store.get<string>(
            storeKeys.cloudBackupSchedule,
          )) as DesktopSettings["cloudBackup"]["schedule"])
        : defaultDesktopSettings.cloudBackup.schedule,
      scope: cloudBackupScopeSchema.safeParse(await store.get<string>(storeKeys.cloudBackupScope))
        .success
        ? ((await store.get<string>(
            storeKeys.cloudBackupScope,
          )) as DesktopSettings["cloudBackup"]["scope"])
        : defaultDesktopSettings.cloudBackup.scope,
      selectedModules:
        (await store.get<string[]>(storeKeys.cloudBackupSelectedModules)) ??
        defaultDesktopSettings.cloudBackup.selectedModules,
      lastBackupAt:
        (await store.get<string | null>(storeKeys.cloudBackupLastBackupAt)) ??
        defaultDesktopSettings.cloudBackup.lastBackupAt,
      lastBackupSizeBytes:
        (await store.get<number | null>(storeKeys.cloudBackupLastBackupSizeBytes)) ??
        defaultDesktopSettings.cloudBackup.lastBackupSizeBytes,
      lastBackupObjectPath:
        (await store.get<string | null>(storeKeys.cloudBackupLastBackupObjectPath)) ??
        defaultDesktopSettings.cloudBackup.lastBackupObjectPath,
      lastBackupStatus:
        (await store.get<string | null>(storeKeys.cloudBackupLastBackupStatus)) ??
        defaultDesktopSettings.cloudBackup.lastBackupStatus,
      storageUsageBytes:
        (await store.get<number | null>(storeKeys.cloudBackupStorageUsageBytes)) ??
        defaultDesktopSettings.cloudBackup.storageUsageBytes,
    },
    migration: {
      legacyBrowserStorageMigrated:
        (await store.get<boolean>(storeKeys.legacyBrowserStorageMigrated)) ??
        defaultDesktopSettings.migration.legacyBrowserStorageMigrated,
      storeSettingsMigrated:
        (await store.get<boolean>(storeKeys.storeSettingsMigrated)) ??
        defaultDesktopSettings.migration.storeSettingsMigrated,
    },
    dynamicIslandEnabled:
      (await store.get<boolean>(storeKeys.dynamicIslandEnabled)) ??
      defaultDesktopSettings.dynamicIslandEnabled,
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
  await store.set(storeKeys.cloudBackupEnabled, settings.cloudBackup.enabled);
  await store.set(storeKeys.cloudBackupProjectUrl, settings.cloudBackup.projectUrl);
  await store.set(storeKeys.cloudBackupAnonKey, settings.cloudBackup.anonKey);
  await store.set(storeKeys.cloudBackupBucketName, settings.cloudBackup.bucketName);
  await store.set(storeKeys.cloudBackupScheduleEnabled, settings.cloudBackup.scheduleEnabled);
  await store.set(storeKeys.cloudBackupSchedule, settings.cloudBackup.schedule);
  await store.set(storeKeys.cloudBackupScope, settings.cloudBackup.scope);
  await store.set(storeKeys.cloudBackupSelectedModules, settings.cloudBackup.selectedModules);
  await store.set(storeKeys.cloudBackupLastBackupAt, settings.cloudBackup.lastBackupAt);
  await store.set(
    storeKeys.cloudBackupLastBackupSizeBytes,
    settings.cloudBackup.lastBackupSizeBytes,
  );
  await store.set(
    storeKeys.cloudBackupLastBackupObjectPath,
    settings.cloudBackup.lastBackupObjectPath,
  );
  await store.set(storeKeys.cloudBackupLastBackupStatus, settings.cloudBackup.lastBackupStatus);
  await store.set(storeKeys.cloudBackupStorageUsageBytes, settings.cloudBackup.storageUsageBytes);
  await store.set(
    storeKeys.legacyBrowserStorageMigrated,
    settings.migration.legacyBrowserStorageMigrated,
  );
  await store.set(storeKeys.storeSettingsMigrated, settings.migration.storeSettingsMigrated);
  await store.set(storeKeys.dynamicIslandEnabled, settings.dynamicIslandEnabled);
  await store.save();
}

async function readNativeSettingsMirror(): Promise<DesktopSettings | null> {
  if (!isTauriRuntimeAvailable()) {
    return null;
  }

  try {
    const settings = await invoke<unknown>("load_desktop_settings");
    const parsed = desktopSettingsSchema.safeParse(settings);
    if (!parsed.success) return null;
    const normalized = normalizeSettings(parsed.data);
    return {
      ...normalized,
      workspace: { ...normalized.workspace, sidebarCollapsed: true },
    };
  } catch {
    return null;
  }
}

async function syncNativeSettingsMirror(settings: DesktopSettings) {
  if (!isTauriRuntimeAvailable()) {
    return;
  }

  try {
    await invoke<unknown>("save_desktop_settings", { settings });
  } catch (error) {
    console.warn("Bento desktop settings were stored, but native mirror sync failed.", error);
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
    }),
  );
}

async function applyNativeTheme(settings: DesktopSettings) {
  if (!isTauriRuntimeAvailable()) {
    return;
  }

  try {
    await setNativeTheme(settings.appearance.mode);
  } catch (error) {
    console.warn("Bento native app theme failed to update.", error);
  }
}

async function applyGlassEffect(settings: DesktopSettings) {
  if (!isTauri()) return;
  const enabled = !!settings?.appearance?.glassEnabled;
  document.documentElement.classList.toggle("glass-enabled", enabled);
  try {
    await invoke("set_window_glass", { enabled });
  } catch (error) {
    console.warn("Bento window glass effect failed to apply.", error);
  }
}

let prevDynamicIslandEnabled: boolean | undefined;

async function applyIslandEffect(settings: DesktopSettings) {
  if (!isTauri()) return;
  const enabled = !!settings?.dynamicIslandEnabled;
  if (enabled === prevDynamicIslandEnabled) return;
  prevDynamicIslandEnabled = enabled;
  try {
    await invoke("set_island_enabled", { enabled });
  } catch (error) {
    console.warn("Dynamic Island toggle failed.", error);
  }
}

function applySettingsSideEffects(settings: DesktopSettings) {
  writeThemeSnapshot(settings);
  void applyNativeTheme(settings);
  void applyGlassEffect(settings);
  void applyIslandEffect(settings);
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
    console.warn("Bento desktop settings failed to load from Store; falling back.", error);
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
        ...nativeMirror,
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
  updater: (current: DesktopSettings) => DesktopSettings,
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
