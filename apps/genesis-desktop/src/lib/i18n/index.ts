/**
 * Bento Localization Engine
 *
 * Architecture ported from Anytype-ts (src/ts/lib/translate.ts + src/json/lang.ts)
 * Adapted for Svelte stores + Tauri-Rust settings backend.
 *
 * Key differences from Anytype:
 *  - No MobX; uses Svelte derived stores
 *  - Language code stored via desktopSettings (Tauri plugin-store / Rust settings)
 *  - Locale bundles loaded via dynamic import (same lazy-load pattern as Anytype)
 *  - RTL direction applied to <html dir="..."> at runtime
 */

import { get } from 'svelte/store';
import _defaultBundle from '$lib/i18n/locales/en.json';

const englishBundle = _defaultBundle as TranslationBundle;

/** The English translation bundle used as fallback for missing keys. */
export const defaultBundle: TranslationBundle = new Proxy(englishBundle, {
  get(target, prop, receiver) {
    if (typeof prop === 'string') {
      return Object.prototype.hasOwnProperty.call(target, prop)
        ? target[prop]
        : `⚠️${prop}⚠️`;
    }
    return Reflect.get(target, prop, receiver);
  },
}) as TranslationBundle;

// ── Type definitions ──────────────────────────────────────────────────────────

export type TranslationBundle = Record<string, string>;
export type TranslationValue = string | number | boolean | null | undefined;
export type TranslationReplacements = Record<string, TranslationValue> | TranslationValue[];

const POSITIONAL_PLACEHOLDERS = [
  'count',
  'pct',
  'rating',
  'title',
  'name',
  'q',
  'p',
  'avg',
  'n',
  'items',
  'time',
  'cmd',
  'min',
  'goal',
  'current',
  's',
  'id',
];

function applyTranslationReplacements(value: string, replacements?: TranslationReplacements): string {
  if (!replacements) return value;

  if (Array.isArray(replacements)) {
    return replacements.reduce<string>((next, replacement, index) => {
      const token = POSITIONAL_PLACEHOLDERS[index] ?? String(index);
      return next.replaceAll(`{${token}}`, String(replacement ?? ''));
    }, value);
  }

  return Object.entries(replacements).reduce(
    (next, [token, replacement]) => next.replaceAll(`{${token}}`, String(replacement ?? '')),
    value
  );
}

export function translateFromBundle(
  bundle: TranslationBundle | undefined,
  key: string,
  fallback?: string,
  replacements?: TranslationReplacements
): string {
  const value = bundle?.[key] ?? fallback ?? defaultBundle[key] ?? `⚠️${key}⚠️`;
  return applyTranslationReplacements(value, replacements);
}

export function createTranslator(bundle: TranslationBundle | undefined) {
  return (
    key: string,
    fallbackOrReplacements?: string | TranslationReplacements,
    ...positionalReplacements: TranslationValue[]
  ): string => {
    const hasPositionalReplacements = positionalReplacements.length > 0;
    const fallback = typeof fallbackOrReplacements === 'string' && !hasPositionalReplacements
      ? fallbackOrReplacements
      : undefined;
    const replacements = hasPositionalReplacements
      ? ([fallbackOrReplacements, ...positionalReplacements] as TranslationValue[])
      : (typeof fallbackOrReplacements === 'string' ? undefined : fallbackOrReplacements);

    return translateFromBundle(bundle, key, fallback, replacements);
  };
}

/** Full locale/region tag used for Intl APIs (e.g. "en-US", "ar-SA") */
export type LocaleTag = string;

/**
 * Interface language codes — matches Anytype's enabled list exactly.
 * These are the locales Bento ships UI translations for.
 */
export const INTERFACE_LANGUAGES = [
  { code: 'en',    label: 'English',             direction: 'ltr', locale: 'en-US' },
  { code: 'ar',    label: 'العربية',              direction: 'rtl', locale: 'ar-SA' },
  { code: 'be',    label: 'Беларуская',           direction: 'ltr', locale: 'be-BY' },
  { code: 'cs',    label: 'Čeština',              direction: 'ltr', locale: 'cs-CZ' },
  { code: 'da',    label: 'Dansk',                direction: 'ltr', locale: 'da-DK' },
  { code: 'de',    label: 'Deutsch',              direction: 'ltr', locale: 'de-DE' },
  { code: 'es',    label: 'Español',              direction: 'ltr', locale: 'es-ES' },
  { code: 'fa',    label: 'فارسی',                direction: 'rtl', locale: 'fa-IR' },
  { code: 'fr',    label: 'Français',             direction: 'ltr', locale: 'fr-FR' },
  { code: 'hi',    label: 'हिन्दी',               direction: 'ltr', locale: 'hi-IN' },
  { code: 'id',    label: 'Bahasa Indonesia',     direction: 'ltr', locale: 'id-ID' },
  { code: 'it',    label: 'Italiano',             direction: 'ltr', locale: 'it-IT' },
  { code: 'ja',    label: '日本語',               direction: 'ltr', locale: 'ja-JP' },
  { code: 'ko',    label: '한국어',               direction: 'ltr', locale: 'ko-KR' },
  { code: 'lt',    label: 'Lietuvių',             direction: 'ltr', locale: 'lt-LT' },
  { code: 'nl',    label: 'Nederlands',           direction: 'ltr', locale: 'nl-NL' },
  { code: 'no',    label: 'Norsk',                direction: 'ltr', locale: 'no-NO' },
  { code: 'pl',    label: 'Polski',               direction: 'ltr', locale: 'pl-PL' },
  { code: 'pt-BR', label: 'Português (Brasil)',   direction: 'ltr', locale: 'pt-BR' },
  { code: 'pt-PT', label: 'Português (Portugal)', direction: 'ltr', locale: 'pt-PT' },
  { code: 'ro',    label: 'Română',               direction: 'ltr', locale: 'ro-RO' },
  { code: 'ru',    label: 'Русский',              direction: 'ltr', locale: 'ru-RU' },
  { code: 'tr',    label: 'Türkçe',               direction: 'ltr', locale: 'tr-TR' },
  { code: 'uk',    label: 'Українська',           direction: 'ltr', locale: 'uk-UA' },
  { code: 'vi',    label: 'Tiếng Việt',           direction: 'ltr', locale: 'vi-VN' },
  { code: 'zh-CN', label: '简体中文',             direction: 'ltr', locale: 'zh-CN' },
  { code: 'zh-TW', label: '繁體中文',             direction: 'ltr', locale: 'zh-TW' },
] as const;

export type LanguageCode = (typeof INTERFACE_LANGUAGES)[number]['code'];

/** Map from interface language code to BCP-47 locale for Intl APIs */
export const LANGUAGE_TO_LOCALE: Record<string, string> = Object.fromEntries(
  INTERFACE_LANGUAGES.map((l) => [l.code, l.locale])
);

/**
 * Date format options — ported from Anytype's dateFormatOptions
 */
export const DATE_FORMATS = [
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '05/22/2026' },
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '22/05/2026' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-05-22' },
  { id: 'DD.MM.YYYY', label: 'DD.MM.YYYY', example: '22.05.2026' },
  { id: 'MMMM D, YYYY', label: 'Long (May 22, 2026)', example: 'May 22, 2026' },
] as const;

export type DateFormatId = (typeof DATE_FORMATS)[number]['id'];

/**
 * Time format options
 */
export const TIME_FORMATS = [
  { id: '12h', label: '12-hour (2:30 PM)' },
  { id: '24h', label: '24-hour (14:30)' },
] as const;

export type TimeFormatId = (typeof TIME_FORMATS)[number]['id'];

/**
 * First day of week options — ported from Anytype
 */
export const FIRST_DAY_OPTIONS = [
  { id: 'monday',   label: 'Monday'   },
  { id: 'sunday',   label: 'Sunday'   },
  { id: 'saturday', label: 'Saturday' },
] as const;

export type FirstDayId = (typeof FIRST_DAY_OPTIONS)[number]['id'];

// ── Lazy locale bundle loader ─────────────────────────────────────────────────
// Same pattern as Anytype's import.meta.glob — eagerly indexed at build time,
// loaded lazily per language on demand.

const localeModules = import.meta.glob<{ default: TranslationBundle }>(
  '$lib/i18n/locales/*.json',
  { eager: false }
);

const bundleCache = new Map<string, TranslationBundle>();
bundleCache.set('en', englishBundle);

export async function loadLocaleBundle(code: string): Promise<TranslationBundle> {
  if (bundleCache.has(code)) {
    return bundleCache.get(code)!;
  }

  const path = `/src/lib/i18n/locales/${code}.json`;
  const altPath = `$lib/i18n/locales/${code}.json`;

  // Try the glob map first
  const loader =
    localeModules[path] ??
    localeModules[altPath] ??
    localeModules[Object.keys(localeModules).find((k) => k.endsWith(`/${code}.json`)) ?? ''];

  if (loader) {
    try {
      const mod = await loader();
      const bundle = (mod.default ?? mod) as TranslationBundle;
      bundleCache.set(code, bundle);
      return bundle;
    } catch {
      // fall through to default
    }
  }

  // Fallback: return english
  return englishBundle;
}

// ── Active bundle reactive state ──────────────────────────────────────────────

import { writable } from 'svelte/store';

export const activeBundle = writable<TranslationBundle>(englishBundle);
export const activeLang = writable<string>('en');

/**
 * Reactive translate function — same API as Anytype's `translate(key, force?)`.
 * Reads from the active bundle, falls back to English.
 * Marks missing keys with ⚠️ just like Anytype does.
 */
export function t(key: string, forceBundle?: TranslationBundle): string {
  const bundle = forceBundle ?? get(activeBundle);
  return (
    bundle[key] ??
    defaultBundle[key] ??
    `⚠️${key}⚠️`
  );
}

/**
 * Apply a language: load bundle, update store, flip HTML dir attribute.
 * This is the single call site — mirrors Anytype's Action.setInterfaceLang.
 */
export async function applyLanguage(code: string): Promise<void> {
  const lang = INTERFACE_LANGUAGES.find((l) => l.code === code) ?? INTERFACE_LANGUAGES[0];
  const bundle = await loadLocaleBundle(lang.code);

  activeBundle.set(bundle);
  activeLang.set(lang.code);

  // Apply RTL/LTR to <html> — Anytype does this in renderer
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', lang.direction);
    document.documentElement.setAttribute('lang', lang.locale);
  }
}

// ── Regional format helpers — delegated to shared time infra ────────────────

import { time } from '$lib/utils/time';

export function formatDate(
  date: Date,
  formatId: DateFormatId,
  locale: string
): string {
  return time.formatDate(date.getTime(), formatId, locale);
}

export function formatTime(date: Date, formatId: TimeFormatId, locale: string): string {
  return time.formatTime(date.getTime(), formatId, locale);
}
