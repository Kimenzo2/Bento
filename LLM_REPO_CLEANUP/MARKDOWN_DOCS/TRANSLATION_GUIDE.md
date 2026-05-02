# Genesis Translation Guide

This guide outlines the internationalization (i18n) system for Genesis and
provides instructions for translators and developers working with translations.

## Table of Contents

1. [Overview](#overview)
2. [Supported Languages](#supported-languages)
3. [File Structure](#file-structure)
4. [Translation Keys](#translation-keys)
5. [For Translators](#for-translators)
6. [For Developers](#for-developers)
7. [RTL Support](#rtl-support)
8. [Testing Translations](#testing-translations)

---

## Overview

Genesis uses **react-i18next** for internationalization with:

- Lazy loading of language files
- Browser language detection
- Namespace-based organization
- Full RTL (Right-to-Left) support for Arabic

---

## Supported Languages

| Code    | Language  | Flag | Direction | Status   |
| ------- | --------- | ---- | --------- | -------- |
| `en`    | English   | 🇺🇸   | LTR       | Complete |
| `es`    | Español   | 🇪🇸   | LTR       | 85%      |
| `fr`    | Français  | 🇫🇷   | LTR       | 80%      |
| `de`    | Deutsch   | 🇩🇪   | LTR       | 75%      |
| `zh-CN` | 简体中文  | 🇨🇳   | LTR       | 70%      |
| `ar`    | العربية   | 🇸🇦   | **RTL**   | 65%      |
| `pt`    | Português | 🇧🇷   | LTR       | 75%      |
| `hi`    | हिन्दी    | 🇮🇳   | LTR       | 60%      |
| `ja`    | 日本語    | 🇯🇵   | LTR       | 70%      |

---

## File Structure

```text
public/
└── locales/
    ├── en/                 # English (base language)
    │   ├── common.json     # Common UI strings
    │   ├── navigation.json # Navigation menus
    │   ├── settings.json   # Settings panel
    │   ├── auth.json       # Authentication
    │   └── errors.json     # Error messages
    ├── es/                 # Spanish
    │   ├── common.json
    │   └── navigation.json
    ├── ar/                 # Arabic (RTL)
    │   ├── common.json
    │   └── navigation.json
    └── ... (other languages)
```

---

## Translation Keys

### Namespaces

| Namespace       | Purpose                       |
| --------------- | ----------------------------- |
| `common`        | Buttons, labels, general UI   |
| `navigation`    | Nav menus, breadcrumbs, links |
| `settings`      | All settings panel strings    |
| `auth`          | Login, signup, password reset |
| `errors`        | Error messages, validation    |
| `editor`        | Smart editor, text formatting |
| `creation`      | Book creation canvas          |
| `storybook`     | Storybook viewer              |
| `curriculum`    | Curriculum builder            |
| `pricing`       | Pricing page, subscription    |
| `gamification`  | Rewards, achievements, XP     |
| `notifications` | Push/email notifications      |

### Key Naming Conventions

1. **Use camelCase**: `welcomeBack`, `noResultsFound`
2. **Be descriptive**: `saveChangesButton` > `save`
3. **Group related keys**: `form.email`, `form.password`
4. **Include context**: `deleteBook` vs `deleteAccount`

### Interpolation

Use `{{variable}}` for dynamic values:

```json
{
  "welcomeBack": "Welcome back, {{name}}!",
  "itemCount": "{{count}} items found",
  "dateCreated": "Created on {{date}}"
}
```

### Pluralization

Use ICU format for plurals:

```json
{
  "bookCount": "{{count, plural, one {# book} other {# books}}}"
}
```

---

## For Translators

### Getting Started

1. Start with English (`en/`) as the reference
2. Copy the structure to your target language folder
3. Translate values, **never modify keys**
4. Maintain JSON formatting

### Best Practices

✅ **DO:**

- Keep translations concise (space constraints in UI)
- Preserve placeholders like `{{name}}` exactly
- Consider cultural context, not just literal translation
- Test your translations in the app

❌ **DON'T:**

- Change key names
- Remove or add curly braces in placeholders
- Leave untranslated strings (use English if unsure)
- Use machine translation without review

### Example Translation

**English (`en/common.json`):**

```json
{
  "welcomeBack": "Welcome back, {{name}}!",
  "save": "Save",
  "noResults": "No results found"
}
```

**Spanish (`es/common.json`):**

```json
{
  "welcomeBack": "¡Bienvenido de nuevo, {{name}}!",
  "save": "Guardar",
  "noResults": "No se encontraron resultados"
}
```

**Arabic (`ar/common.json`):**

```json
{
  "welcomeBack": "مرحباً بعودتك، {{name}}!",
  "save": "حفظ",
  "noResults": "لم يتم العثور على نتائج"
}
```

---

## For Developers

### Using Translations

```tsx
import { useTranslation } from "react-i18next";

const MyComponent = () => {
  const { t } = useTranslation("common");

  return (
    <div>
      <h1>{t("welcomeBack", { name: user.name })}</h1>
      <button>{t("save")}</button>
    </div>
  );
};
```

### Multiple Namespaces

```tsx
const { t } = useTranslation(["common", "settings"]);

// Use namespace prefix
t("common:save");
t("settings:language");
```

### Using the Language Hook

```tsx
import { useLanguage } from "../src/hooks/useLanguage";

const MyComponent = () => {
  const {
    currentLanguage,
    changeLanguage,
    formatDate,
    formatNumber,
    formatCurrency,
  } = useLanguage();

  return (
    <div>
      <p>Current: {currentLanguage.name}</p>
      <p>Date: {formatDate(new Date())}</p>
      <p>Price: {formatCurrency(99.99)}</p>
      <button onClick={() => changeLanguage("es")}>Switch to Spanish</button>
    </div>
  );
};
```

### Adding New Translation Keys

1. Add to English first (`en/{namespace}.json`)
2. Add to other languages
3. Use the key in components
4. Test all languages

---

## RTL Support

Arabic requires special handling for right-to-left text direction.

### Automatic RTL

The `LanguageProvider` automatically:

- Sets `dir="rtl"` on `<html>`
- Updates `lang` attribute
- Applies RTL-specific CSS

### Using Direction Hook

```tsx
import { useDirection } from "../src/hooks/useDirection";

const MyComponent = () => {
  const {
    direction,
    isRTL,
    startProperty, // 'left' or 'right'
    endProperty, // 'right' or 'left'
    flipAlign, // Flips text-align
    flipFlexDirection,
  } = useDirection();

  return (
    <div
      style={{
        textAlign: flipAlign("left"),
        flexDirection: flipFlexDirection("row"),
      }}
    >
      {/* Content */}
    </div>
  );
};
```

### RTL Tailwind Classes

Use `rtl:` prefix for RTL-specific styles:

```tsx
<div className="ml-4 rtl:ml-0 rtl:mr-4">
  <Icon className="rotate-0 rtl:rotate-180" />
</div>
```

### CSS Logical Properties

Prefer logical properties that adapt automatically:

```css
/* Instead of: */
margin-left: 16px;
padding-right: 8px;

/* Use: */
margin-inline-start: 16px;
padding-inline-end: 8px;
```

---

## Testing Translations

### Quick Language Switch

```tsx
import { useLanguage } from "../src/hooks/useLanguage";

// In development, add temporary buttons:
const DevLanguageSwitch = () => {
  const { changeLanguage } = useLanguage();

  return (
    <div className="fixed bottom-4 right-4 flex gap-2">
      <button onClick={() => changeLanguage("en")}>🇺🇸</button>
      <button onClick={() => changeLanguage("es")}>🇪🇸</button>
      <button onClick={() => changeLanguage("ar")}>🇸🇦</button>
    </div>
  );
};
```

### Checking Missing Keys

In development, missing keys show as the key name itself. Check console for:

```text
[i18n] Missing translation for key: "someKey" in namespace: "common"
```

### Pseudo-localization

For testing text expansion without translation:

```json
{
  "save": "[ŞäVé]",
  "welcomeBack": "[Wélçömé ßäçk, {{name}}!]"
}
```

---

## Contributing Translations

1. Fork the repository
2. Create language folder if missing
3. Add/update translation files
4. Test in the application
5. Submit a pull request

### Translation Priority

1. `common.json` - Most important
2. `navigation.json` - Core navigation
3. `auth.json` - User authentication
4. `errors.json` - Error messages
5. Other namespaces

---

## Questions?

For translation questions, open an issue with the `i18n` label or contact the
maintainers.
