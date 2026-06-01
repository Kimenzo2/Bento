import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');

// Read the reference English bundle (all keys)
const enBundle = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf-8'));
const allKeys = Object.keys(enBundle);

// Language codes that need stubs (all except 'en')
const languageCodes = [
  'ar',
  'be',
  'cs',
  'da',
  'de',
  'es',
  'fa',
  'fr',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'lt',
  'nl',
  'no',
  'pl',
  'pt-BR',
  'pt-PT',
  'ro',
  'ru',
  'tr',
  'uk',
  'vi',
  'zh-CN',
  'zh-TW',
];

// Existing stubs with real translations (from _generate_stubs.ps1)
const existingTranslations = {};

// Load any existing stub files that may have real translations
for (const code of languageCodes) {
  const path = join(localesDir, `${code}.json`);
  if (existsSync(path)) {
    try {
      existingTranslations[code] = JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      existingTranslations[code] = {};
    }
  } else {
    existingTranslations[code] = {};
  }
}

// German is pre-loaded, let's load it
const dePath = join(localesDir, 'de.json');
if (existsSync(dePath)) {
  const deBundle = JSON.parse(readFileSync(dePath, 'utf-8'));
  existingTranslations['de'] = { ...existingTranslations['de'], ...deBundle };
}

// Arabic is pre-loaded
const arPath = join(localesDir, 'ar.json');
if (existsSync(arPath)) {
  const arBundle = JSON.parse(readFileSync(arPath, 'utf-8'));
  existingTranslations['ar'] = { ...existingTranslations['ar'], ...arBundle };
}

// For each language, create a stub with:
// 1. Existing translated values preserved
// 2. All missing keys filled with English as fallback
for (const code of languageCodes) {
  const existing = existingTranslations[code] || {};
  const bundle = {};

  for (const key of allKeys) {
    if (existing.hasOwnProperty(key)) {
      bundle[key] = existing[key];
    } else {
      bundle[key] = enBundle[key]; // Fallback to English
    }
  }

  const path = join(localesDir, `${code}.json`);
  writeFileSync(path, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  console.log(`✓ Written: ${code}.json (${Object.keys(bundle).length} keys)`);
}

// Verify counts
const totalFiles = languageCodes.length + 1; // +1 for en.json
let totalKeys = allKeys.length;
console.log(`\n✅ Done. ${totalFiles} locale files (${totalKeys} keys each).`);
