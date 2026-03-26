import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const localesRoot = path.resolve(process.cwd(), 'public', 'locales');
const baseLanguage = 'en';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const flattenKeys = (obj, prefix = '') => {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const current = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) {
      keys.push(...flattenKeys(value, current));
    } else {
      keys.push(current);
    }
  }
  return keys;
};

const listLanguageDirs = () =>
  readdirSync(localesRoot).filter((entry) => statSync(path.join(localesRoot, entry)).isDirectory());

const listNamespaces = (lang) =>
  readdirSync(path.join(localesRoot, lang)).filter((file) => file.endsWith('.json'));

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const baseNamespaces = listNamespaces(baseLanguage);
const languages = listLanguageDirs().filter((l) => l !== baseLanguage);

const errors = [];
const warnings = [];

for (const namespaceFile of baseNamespaces) {
  const basePath = path.join(localesRoot, baseLanguage, namespaceFile);
  const baseKeys = new Set(flattenKeys(readJson(basePath)));

  for (const lang of languages) {
    const targetPath = path.join(localesRoot, lang, namespaceFile);

    try {
      const targetKeys = new Set(flattenKeys(readJson(targetPath)));

      const missing = [...baseKeys].filter((k) => !targetKeys.has(k));
      const extra = [...targetKeys].filter((k) => !baseKeys.has(k));

      if (missing.length > 0) {
        errors.push({ lang, namespaceFile, missing });
      }

      if (extra.length > 0) {
        warnings.push({ lang, namespaceFile, extra });
      }
    } catch (error) {
      errors.push({
        lang,
        namespaceFile,
        missing: [`Failed to read/parse ${targetPath}: ${error.message}`],
      });
    }
  }
}

for (const lang of languages) {
  const langNamespaces = new Set(listNamespaces(lang));
  for (const baseNs of baseNamespaces) {
    if (!langNamespaces.has(baseNs)) {
      errors.push({
        lang,
        namespaceFile: baseNs,
        missing: [`Missing namespace file ${baseNs}`],
      });
    }
  }
}

if (errors.length > 0) {
  console.error('[i18n] Localization parity check failed. Missing keys/files detected:');
  for (const entry of errors) {
    console.error(`\n- ${entry.lang}/${entry.namespaceFile}`);
    for (const key of entry.missing.slice(0, 30)) {
      console.error(`  • ${key}`);
    }
    if (entry.missing.length > 30) {
      console.error(`  • ... and ${entry.missing.length - 30} more`);
    }
  }
  process.exit(1);
}

console.log('[i18n] Localization parity check passed. All required keys/files exist.');

if (warnings.length > 0) {
  console.warn('[i18n] Found extra keys not present in English baseline:');
  for (const entry of warnings) {
    console.warn(`\n- ${entry.lang}/${entry.namespaceFile}`);
    for (const key of entry.extra.slice(0, 10)) {
      console.warn(`  • ${key}`);
    }
    if (entry.extra.length > 10) {
      console.warn(`  • ... and ${entry.extra.length - 10} more`);
    }
  }
}