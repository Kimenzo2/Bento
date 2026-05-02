# Genesis Internal App -- Brand Audit Report

Audited: 2026-03-10
Pages audited: Dashboard (/), Create (/create), Editor (/editor), Visual Studio (/visual-studio), Settings (/settings), Pricing (/pricing), Gamification (/gamification), Success (/success), Viewer (/viewer), Blog (/blog, /blog/:slug), Learn (/learn, /learn/:slug), Transparency (/transparency), Onboarding (/welcome/*)
Theme files read: config/themes.ts, types/theme.d.ts, contexts/ThemeContext.tsx, components/settings/ThemeSelector.tsx, index.css, tailwind.config.js, components.json

---

## SECTION 1: THEME SYSTEM OVERVIEW

### How Many Themes Exist

**Six** named themes, each as a paired light/dark set:

1. **Genesis Classic** (id: `genesis`) -- DEFAULT
2. **Aurora Scholar** (id: `aurora`)
3. **Ocean Academy** (id: `ocean`)
4. **Forest Wisdom** (id: `forest`)
5. **Nebula Mind** (id: `nebula`)
6. **Sunset Scholar** (id: `sunset`)

### How Themes Are Applied

1. **CSS variable injection**: `ThemeContext` calls `document.documentElement.style.setProperty(key, value)` for each variable in the theme's `cssVariables` or `darkCssVariables` map (depending on dark mode state).
2. **Body class**: `theme-<id>` class is added to `document.body` (e.g., `theme-genesis`). Old theme classes are removed via regex `/theme-\w+/g`.
3. **Dark mode class**: The `dark` class is added to both `<html>` and `<body>`. The `color-scheme` CSS property is set to `dark` or `light` on `<html>`.
4. **Tailwind bridge**: `index.css` `@theme` block and `tailwind.config.js` map CSS variables to semantic Tailwind tokens (`bg-cream-base`, `text-charcoal-soft`, `border-peach-soft`, etc.) with hardcoded Genesis Classic fallback values.
5. **Transition**: `html { transition: background-color 0.3s ease, color 0.3s ease; }` for smooth switching.

**No `[data-theme]` attribute is used.** No Tailwind `dark:` variant is used for color switching (colors come from CSS variables; `dark:` is used only for structural changes like `dark:border-opacity` etc.).

### Where Theme Preference Is Stored

- **Theme ID**: `localStorage.getItem('genesis_theme_id')` / `localStorage.setItem('genesis_theme_id', id)`
- **Dark mode**: `localStorage.getItem('genesis_dark_mode')` / `localStorage.setItem('genesis_dark_mode', 'true'|'false')`
- **Not stored in Supabase** -- purely client-side localStorage.
- A custom event `themeChanged` is dispatched on `window` with detail `{ theme, isDarkMode }` to notify non-React listeners.

---

## SECTION 2: THEME COLOUR PALETTES -- COMPLETE HEX DOCUMENTATION

### Theme: Genesis Classic (id: `genesis`) -- DEFAULT

#### Light Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#FFF8E7` | Warm cream with yellow undertone -- feels like parchment paper |
| Card / surface background | `#FFFFFF` | Pure white lifted above cream |
| Primary text | `#5A5A5A` | Warm medium grey -- softer than true black |
| Secondary / muted text | `#8B7E74` | Warm cocoa -- distinctly brown-grey, not cold grey |
| Border default | `#FFE4CC` | Peach-tinted border -- warm, not neutral grey |
| Primary accent start (gradient) | `#FF9B71` | Coral burst -- warm orange-pink |
| Primary accent end (gradient) | `#FFD93D` | Gold sunshine -- warm yellow |
| Accent start | `#FFD93D` | Reversed: gold first |
| Accent end | `#FF9B71` | Reversed: coral second |
| Shadow RGB | `255, 155, 113` | Coral shadow (used as `rgba(255,155,113,0.15)`) |

#### Dark Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#1A1412` | **Warm brown-black** (R=26,G=20,B=18) -- NOT cold/neutral |
| Card / surface background | `#2A201D` | **Warm dark brown** surface |
| Primary text | `#EAE0D5` | Warm off-white with ivory tint |
| Secondary / muted text | `#A89F91` | Warm grey-brown |
| Border default | `#3D302B` | Dark warm brown border |
| Primary accent start | `#E87D56` | Slightly deeper coral |
| Primary accent end | `#E5C02B` | Slightly deeper gold |
| Shadow RGB | `255, 155, 113` | Same coral shadow |

#### Light/Dark Relationship

The dark mode is a **warm continuation** of the light mode. `#1A1412` is a deep warm brown -- it feels like a firelit room, not a dark void. The peach borders shift to dark warm brown `#3D302B`, maintaining the same warm character at lower lightness. Accent colours shift to slightly deeper/more saturated versions of the same coral and gold. The entire palette retains its warm undertone across both modes.

---

### Theme: Aurora Scholar (id: `aurora`)

#### Light Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#F8F5FF` | Cool lavender-white |
| Card / surface background | `#FFFFFF` | Pure white |
| Primary text | `#2D1B4E` | Deep purple-black |
| Secondary / muted text | `#6A4F8B` | Medium purple |
| Border default | `#E1BEE7` | Light mauve |
| Primary accent start | `#4A148C` | Deep purple |
| Primary accent end | `#E91E63` | Vivid pink |
| Shadow RGB | `74, 20, 140` | Purple shadow |

#### Dark Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#130C1C` | **Deep purple-black** (R=19,G=12,B=28) |
| Card / surface background | `#1E152D` | Dark purple surface |
| Primary text | `#E2D8F0` | Light lavender |
| Secondary / muted text | `#A594BD` | Muted purple |
| Border default | `#362554` | Dark purple border |
| Primary accent start | `#7C4DFF` | Bright violet (lightened for dark mode visibility) |
| Primary accent end | `#F48FB1` | Soft pink (lightened) |

#### Light/Dark Relationship

The dark mode deepens the purple foundation. Accent colours shift **lighter** in dark mode (from `#4A148C` to `#7C4DFF`) to maintain contrast against the dark background -- a deliberate accessibility choice. The purple-black ground creates a mystical, scholarly atmosphere.

---

### Theme: Ocean Academy (id: `ocean`)

#### Light Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#E0F7FA` | Very light cyan |
| Card / surface background | `#FFFFFF` | Pure white |
| Primary text | `#00363A` | Deep dark teal |
| Secondary / muted text | `#00838F` | Medium teal |
| Border default | `#B2EBF2` | Light cyan border |
| Primary accent start | `#006064` | Deep teal |
| Primary accent end | `#00ACC1` | Bright cyan |
| Shadow RGB | `0, 96, 100` | Teal shadow |

#### Dark Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#0A191C` | **Deep teal-black** (R=10,G=25,B=28) |
| Card / surface background | `#12272B` | Dark teal surface |
| Primary text | `#D5EFEF` | Light icy blue-green |
| Secondary / muted text | `#85AFA8` | Muted teal |
| Border default | `#1A424A` | Dark teal border |
| Primary accent start | `#26C6DA` | Bright cyan (lightened) |
| Primary accent end | `#80DEEA` | Light cyan (lightened) |

#### Light/Dark Relationship

Cool teal throughout. Dark mode submerges into deep ocean colours. Accents lighten dramatically in dark mode for visibility.

---

### Theme: Forest Wisdom (id: `forest`)

#### Light Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#F1F8E9` | Pale sage green |
| Card / surface background | `#FFFFFF` | Pure white |
| Primary text | `#1B5E20` | Deep forest green |
| Secondary / muted text | `#558B2F` | Medium olive green |
| Border default | `#C5E1A5` | Light green border |
| Primary accent start | `#2E7D32` | Forest green |
| Primary accent end | `#66BB6A` | Medium green |
| Shadow RGB | `46, 125, 50` | Green shadow |

#### Dark Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#0F1A12` | **Deep forest green-black** (R=15,G=26,B=18) |
| Card / surface background | `#18291B` | Dark green surface |
| Primary text | `#DBEFE0` | Light mint |
| Secondary / muted text | `#8EAB94` | Muted sage |
| Border default | `#28462C` | Dark green border |
| Primary accent start | `#66BB6A` | Medium green (lightened) |
| Primary accent end | `#A5D6A7` | Light green (lightened) |

#### Light/Dark Relationship

Nature-inspired from pale sage (light) to deep forest (dark). The green tint is subtle but present throughout, creating a calming woodland atmosphere.

---

### Theme: Nebula Mind (id: `nebula`)

#### Light Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#EDE7F6` | Light lavender |
| Card / surface background | `#FFFFFF` | Pure white |
| Primary text | `#12005E` | Very deep indigo |
| Secondary / muted text | `#5E35B1` | Medium purple |
| Border default | `#D1C4E9` | Soft lavender border |
| Primary accent start | `#1A237E` | Deep navy/indigo |
| Primary accent end | `#7B1FA2` | Deep purple |
| Shadow RGB | `26, 35, 126` | Indigo shadow |

#### Dark Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#100C1A` | **Deep indigo-black** (R=16,G=12,B=26) |
| Card / surface background | `#1A152A` | Dark indigo surface |
| Primary text | `#DED8EB` | Pale lavender |
| Secondary / muted text | `#938BA3` | Muted mauve |
| Border default | `#2A2244` | Dark indigo-purple border |
| Primary accent start | `#5C6BC0` | Medium indigo (lightened) |
| Primary accent end | `#AB47BC` | Medium purple (lightened) |

#### Light/Dark Relationship

Deep space aesthetic. Indigo-black dark mode creates a cosmic, cerebral mood. The accent colours shift from deep jewel tones (light) to brighter neon versions (dark).

---

### Theme: Sunset Scholar (id: `sunset`)

#### Light Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#FFF3E0` | Warm peach white |
| Card / surface background | `#FFFFFF` | Pure white |
| Primary text | `#3E2723` | Deep brown |
| Secondary / muted text | `#8D6E63` | Medium brown |
| Border default | `#FFCCBC` | Peach-salmon border |
| Primary accent start | `#BF360C` | Deep burnt orange |
| Primary accent end | `#FF6F00` | Bright orange |
| Shadow RGB | `191, 54, 12` | Burnt orange shadow |

#### Dark Mode

| Token / Role | Hex | Notes |
|---|---|---|
| Page background | `#1C120C` | **Warm sienna-black** (R=28,G=18,B=12) |
| Card / surface background | `#2D1C12` | Dark burnt brown surface |
| Primary text | `#EFE5DE` | Warm cream white |
| Secondary / muted text | `#AC9B8F` | Warm taupe |
| Border default | `#4A2E1F` | Dark brown border |
| Primary accent start | `#FF7043` | Bright coral-orange (lightened) |
| Primary accent end | `#FFCA28` | Bright gold (lightened) |

#### Light/Dark Relationship

Warm throughout. The warmest theme pair -- sienna-black dark mode with deep brown surfaces. Most similar to Genesis Classic in emotional temperature, but with more saturated orange/burnt tones rather than coral/peach.

---

### Dark Mode Background Tint Summary

| Theme | Dark BG | R | G | B | Tint |
|---|---|---|---|---|---|
| Genesis Classic | `#1A1412` | 26 | 20 | 18 | **Warm** brown-black |
| Aurora Scholar | `#130C1C` | 19 | 12 | 28 | **Cool** purple-black |
| Ocean Academy | `#0A191C` | 10 | 25 | 28 | **Cool** teal-black |
| Forest Wisdom | `#0F1A12` | 15 | 26 | 18 | **Cool** green-black |
| Nebula Mind | `#100C1A` | 16 | 12 | 26 | **Cool** indigo-black |
| Sunset Scholar | `#1C120C` | 28 | 18 | 12 | **Warm** sienna-black |

All light mode surfaces are `#FFFFFF`. All light mode page backgrounds are tinted pastels unique to each theme.

---

## SECTION 3: TYPOGRAPHY -- COMPLETE DOCUMENTATION

### Fonts In Use

| Font Name | Source | Weights | Primary Role |
|---|---|---|---|
| Fredoka | Google Fonts (static) | 400, 500, 600, 700 | Default heading font |
| Manrope | Google Fonts (variable) | 200-800 | Default body font |
| Instrument Serif | Google Fonts (static) | 400 | Blog/editorial headings |
| Geist | Google Fonts (variable) | 100-900 | Blog/editorial body |
| Noto Sans Arabic Variable | @fontsource-variable (local woff2) | 100-900 | Arabic/RTL override |

### Detailed Usage

**Fredoka** (Default Heading)
- Loaded from: Google Fonts CDN
- Used for: All `font-heading` elements -- page titles, section headers, button labels, card titles, form labels, nav items, badge text
- Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold -- most common at 621 occurrences)
- Key sizes: text-4xl hero, text-2xl section, text-xl card, text-lg subsection
- CSS variable: `--font-heading: "Fredoka", system-ui, sans-serif`
- Tailwind class: `font-heading`

**Manrope** (Default Body)
- Loaded from: Google Fonts CDN (variable, full weight range)
- Used for: All `font-body` and default inherited text -- paragraphs, descriptions, form inputs, metadata, captions
- Weights: 400 (body copy), 500 (medium emphasis), 600 (semibold -- some labels)
- Key sizes: text-sm (body default), text-base (larger body), text-xs (captions)
- CSS variable: `--font-body: "Manrope", system-ui, sans-serif`
- Tailwind class: `font-body`

**Instrument Serif** (Editorial)
- Loaded from: Google Fonts CDN
- Used for: Blog post headings, blog card titles, learn page headings, transparency page headings, settings header
- Weights: 400 only
- Key sizes: clamp(2rem, 5vw, 3.5rem) hero, text-2xl (functional)
- Applied via: Inline style `fontFamily: '"Instrument Serif", Georgia, serif'`
- Not exposed through CSS variable or Tailwind class

**Geist** (Editorial Body)
- Loaded from: Google Fonts CDN (variable)
- Used for: Blog/learn/transparency page body text, nav elements, UI on those pages
- Weights: 100-900 (variable)
- Applied via: Inline style `fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif'`
- Not exposed through CSS variable or Tailwind class

**Noto Sans Arabic Variable** (RTL)
- Loaded from: Local woff2 via @fontsource-variable
- Used for: Overrides body font when `html[lang="ar"]` or `html[dir="rtl"]` is set
- Weights: 100-900 (variable)
- Applied via: CSS rule `font-family: "Noto Sans Arabic Variable", var(--font-body), system-ui, sans-serif`

### Type Scale

| Scale | px | rem | Used for |
|---|---|---|---|
| xs | 12 | 0.75 | Tags, timestamps, captions, metadata (485 occurrences) |
| sm | 14 | 0.875 | Default body text, descriptions (607 occurrences) |
| base | 16 | 1 | Larger body, form inputs (65 occurrences) |
| lg | 18 | 1.125 | Subsection headings, prominent labels (163 occurrences) |
| xl | 20 | 1.25 | Card titles, feature names (111 occurrences) |
| 2xl | 24 | 1.5 | Section headings, modal titles (118 occurrences) |
| 3xl | 30 | 1.875 | Page titles, hero subheadings (36 occurrences) |
| 4xl | 36 | 2.25 | Hero headlines (18 occurrences) |
| 5xl | 48 | 3 | Large display titles (7 occurrences) |
| 6xl | 60 | 3.75 | Maximum display (7 occurrences) |
| [8px] | 8 | 0.5 | Micro labels (MobileBottomNav) |
| [10px] | 10 | 0.625 | Tiny tags, indicators |
| [11px] | 11 | 0.6875 | Blog category pills |
| [15px] | 15 | 0.9375 | Blog body text (between sm and base) |

---

## SECTION 4: PAGE-BY-PAGE BRAND SUMMARY

### Dashboard (/) -- CreationCanvas.tsx

- **Background**: `bg-cream-base` (theme-aware)
- **Layout**: Full-width centred, `max-w-6xl` (1152px) for library grid
- **Hero**: Large heading `font-heading font-bold text-3xl md:text-4xl tracking-tight`
- **Quick start cards**: 3-column grid, `rounded-3xl`, `border-2 border-peach-soft`, Vercel-style radial-gradient glow on hover
- **Library grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- **Mascots**: 6 floating 3D characters framing the canvas
- **Brand feeling**: Warm, inviting creative workspace with playful characters and premium card interactions

### Editor (/editor) -- SmartEditor.tsx

- **Background**: `bg-cream-base` with radial dot grid (`opacity-30`)
- **Layout**: Split view -- `lg:w-[40%]` editor panel + preview panel
- **Typography**: `font-heading` for headers, `font-body` for content
- **Book preview**: Cream paper texture overlay (`mix-blend-multiply opacity-40`)
- **Brand feeling**: Focused, craft-oriented writing environment with storybook paper texture

### Visual Studio (/visual-studio) -- VisualStudio.tsx

- **Background**: `bg-cream-base` (theme-aware)
- **Layout**: `max-w-6xl mx-auto`
- **Brand feeling**: Clean creative workspace for image editing

### Settings (/settings) -- SettingsPanel.tsx

- **Background**: `bg-cream-base`
- **Layout**: `max-w-4xl mx-auto`, sidebar (`md:w-64`) + main content (`flex-1`)
- **Main content card**: `bg-surface rounded-2xl md:rounded-3xl border-peach-soft/50 p-4 md:p-8`
- **Header uses**: Instrument Serif for "Settings" title (editorial accent)
- **Tabs**: Sidebar with `rounded-xl` buttons, touch-friendly `min-w-30`
- **ThemeSelector**: Shows 6 theme options as gradient preview swatches with names and descriptions
- **Brand feeling**: Clean, spacious settings with editorial header and card-based organisation

### Pricing (/pricing) -- PricingPage.tsx

- **Background**: `bg-cream-base`
- **Layout**: Centred, full-width sections
- **Cards**: Tier cards with distinct colour treatments per tier
- **Community image**: 3D Pixar-style mascot illustration at bottom with gradient overlay
- **Brand feeling**: Premium SaaS pricing page with storytelling flair

### Gamification (/gamification) -- GamificationHub.tsx

- **Background**: `bg-cream-base`
- **Typography**: `font-heading` for section titles
- **SVG decorations**: Gold `#FFD93D` fills, `#E6C229` strokes
- **Brand feeling**: Achievement-driven, game-like progression UI

### Book Viewer (/viewer) -- StorybookViewer.tsx

- **Background**: `bg-cream-base`
- **Book render**: Paper texture overlay on book preview areas
- **Brand feeling**: Immersive reading experience designed to mimic a physical storybook

### Blog (/blog, /blog/:slug) -- BlogIndex.tsx, BlogPost.tsx

- **Typography**: **Separate system** -- Instrument Serif for headings, Geist for body
- **Background**: `#FAFAF9` (stone-50 -- NOT cream-base)
- **Accent colour**: `#C15F3C` (a darker brick-coral, defined inline as `S.accent`)
- **Borders**: `#E7E5E4` (stone-200)
- **Text**: `#1C1917` (stone-900 primary), `#78716C` (stone-500 muted)
- **Nav**: Frosted glass `rgba(250,250,249,0.85) backdrop-blur-md`
- **Article max-width**: `max-w-3xl` (768px) for body content with `max-w-5xl` outer
- **Brand feeling**: Clean editorial magazine aesthetic -- distinct from the playful internal app

### Learn (/learn, /learn/:slug) -- LearnPage.tsx, LearnArticlePage.tsx

- **Typography**: Same editorial system as Blog (Instrument Serif + Geist)
- **Background**: `#FAFAF9`
- **Accent**: `#C15F3C`
- **Layout**: `max-w-5xl` outer, `max-w-3xl` article content
- **Brand feeling**: Educational content hub with editorial quality

### Transparency (/transparency) -- TransparencyPage.tsx

- **Typography**: Same editorial system (Instrument Serif + Geist)
- **Background**: `#FAFAF9`
- **Accent**: `#C15F3C`
- **Layout**: `max-w-4xl`
- **Data visualisation**: SVG score rings with colour-coded ratings
- **Brand feeling**: Clean data report with editorial layout

### Onboarding (/welcome/*) -- OnboardingApp.tsx + steps

- **Background**: `#0d0d1a` (deep near-black) with Tailwind `slate-900` gradients
- **Typography**: Uses Genesis heading/body fonts (not editorial system)
- **Atmosphere**: Dense decoration -- blobs, particles, ambient orbs, confetti
- **Gradients**: Purple-blue-amber spectrum throughout
- **Mascot**: Gen appears with speech bubbles and sparkle crown
- **Brand feeling**: Cinematic dark onboarding -- dramatic, awe-inspiring, Pixar-meets-SaaS

---

## SECTION 5: BLOG / LEARN SECTION BRAND

The blog, learn, and transparency sections operate as a **separate brand identity** from the main internal app:

| Element | Internal App | Blog/Learn/Transparency |
|---|---|---|
| Heading font | Fredoka (via `--font-heading`) | Instrument Serif (inline style) |
| Body font | Manrope (via `--font-body`) | Geist (inline style) |
| Background | `#FFF8E7` cream (theme-variable) | `#FAFAF9` stone-50 (hardcoded) |
| Accent colour | `#FF9B71` coral (theme-variable) | `#C15F3C` brick-coral (hardcoded) |
| Text colour | `#5A5A5A` charcoal (theme-variable) | `#1C1917` stone-900 (hardcoded) |
| Border colour | `#FFE4CC` peach (theme-variable) | `#E7E5E4` stone-200 (hardcoded) |
| Theme-aware | Yes | **No** -- all values hardcoded |
| Font-pairing-aware | Yes | **No** -- always Instrument Serif + Geist |
| CTA colour | Coral-to-gold gradient | Flat `#C15F3C` |

The blog/learn pages define their own `S` (style) object with all design tokens inline. They do not import `ThemeContext` or use Tailwind theme tokens. This creates a consistent editorial brand for public-facing content pages that is **independent of the user's chosen theme**.

The editorial typography (Instrument Serif heading + Geist body) gives these pages a magazine-like quality -- more refined and serious than the playful Fredoka + Manrope of the internal app. The background shifts from warm cream to cool stone-50 (`#FAFAF9`), creating a subtly different reading environment.

---

## SECTION 6: BRAND CONSISTENCY OBSERVATIONS

**What is consistent across all internal pages:**
- The cream/coral/gold palette via CSS variables is applied everywhere in the internal app
- The `font-heading` / `font-body` font system is used consistently via Tailwind classes
- Border-radius hierarchy is rigorous: `rounded-xl` atoms, `rounded-2xl` molecules, `rounded-3xl` organisms
- All shadows are disabled globally -- depth comes from opacity, blur, and gradients
- The shadcn component library is thoroughly re-themed with Genesis tokens
- The fixed top navigation with frosted glass is consistent on all pages

**What is inconsistent:**
1. **Blog/Learn/Transparency pages** completely bypass the theme system. They have hardcoded colours (`#FAFAF9`, `#C15F3C`, `#1C1917`), hardcoded fonts (Instrument Serif, Geist), and their own `S` style object. Switching themes in settings has no effect on these pages.
2. **ChatWidget.css** defines its own `:root` colour palette (`#ff6b6b`, `#fca311`, `#2d3748`) that does not reference theme CSS variables.
3. **Collaboration components** (PresenceIndicator, LiveCursors, CollaborationProvider) use hardcoded colour palettes that do not respond to theme changes.
4. **Onboarding** uses its own dark aesthetic (`#0d0d1a` with purple/blue/amber accents) that is separate from any theme's dark mode. This appears intentional for a cinematic first-run experience.
5. **Some inline hex colours** appear in components like GamificationHub (`#FFD93D`, `#E6C229`), SparkleCursor (`#FF9B71`, `#FFD700`, `#60A5FA`, `#F472B6`), and confetti effects that bypass theme tokens. These use the Genesis Classic palette hardcoded.
6. **Focus outline** in `index.css` uses hardcoded `#ff9b71` rather than `var(--color-primary-start)`.

---

## SECTION 7: RAW TOKEN INVENTORY

### CSS Variables (Theme System)

| Variable Name | Light Default | Dark Default (Genesis Classic) |
|---|---|---|
| `--color-primary-start` | `#FF9B71` | `#E87D56` |
| `--color-primary-end` | `#FFD93D` | `#E5C02B` |
| `--color-accent-start` | `#FFD93D` | `#E5C02B` |
| `--color-accent-end` | `#FF9B71` | `#E87D56` |
| `--color-background` | `#FFF8E7` | `#1A1412` |
| `--color-surface` | `#FFFFFF` | `#2A201D` |
| `--color-text` | `#5A5A5A` | `#EAE0D5` |
| `--color-text-light` | `#8B7E74` | `#A89F91` |
| `--color-border` | `#FFE4CC` | `#3D302B` |
| `--color-shadow` | `255, 155, 113` | `255, 155, 113` |
| `--font-heading` | `"Fredoka", system-ui, sans-serif` | same |
| `--font-body` | `"Manrope", system-ui, sans-serif` | same |

### Tailwind Semantic Token to CSS Variable Mapping

| Tailwind Token | CSS Variable | Fallback Hex |
|---|---|---|
| `cream-base` | `var(--color-background)` | `#FFF8E7` |
| `cream-soft` | `var(--color-background)` | `#FFF8E7` |
| `surface` | `var(--color-surface)` | `#FFFFFF` |
| `coral-burst` | `var(--color-primary-start)` | `#FF9B71` |
| `coral-hover` | `var(--color-primary-end)` | `#FFD93D` |
| `gold-sunshine` | `var(--color-primary-end)` | `#FFD93D` |
| `charcoal-soft` | `var(--color-text)` | `#5A5A5A` |
| `cocoa-light` | `var(--color-text-light)` | `#8B8B8B` |
| `cocoa-dark` | `var(--color-text)` | `#5A5A5A` |
| `peach-soft` | `var(--color-border)` | `#FFE4CC` |
| `peach-light` | `var(--color-border)` | `#FFE4CC` |
| `yellow-butter` | (static) | `#FFF4A3` |
| `mint-breeze` | (static) | `#D4F4DD` |

### Shadow System

All shadows are set to `none` globally in both `index.css @theme` and `tailwind.config.js`:
```
--shadow-2xs through --shadow-2xl: none
--shadow-inner: none
--shadow-soft-sm through --shadow-soft-xl: none
--shadow-glow: none
```

---

## OPEN QUESTIONS FOR DEVELOPER

1. **Blog/Learn theme independence**: The blog, learn, and transparency pages do not respond to the user's theme selection (they use hardcoded stone-50 background, hardcoded Instrument Serif/Geist fonts, hardcoded `#C15F3C` accent). Is this intentional -- should public content pages have a fixed editorial brand regardless of user preferences?

2. **ChatWidget colour isolation**: The chat widget has its own colour palette divorced from theme tokens. Should it be integrated into the theme system?

3. **Font pairing scope**: When a user selects "Editorial Elegance" (Spectral + Lato) in Settings, only the internal app pages respond. Blog pages still use Instrument Serif + Geist. Is this the intended behaviour?

4. **Hardcoded particle/confetti colours**: SparkleCursor, confetti effects, and GamificationHub SVG use Genesis Classic palette hardcoded. Should these reference theme accent variables to change with other themes?

5. **Focus outline theming**: The keyboard focus ring is hardcoded to `#ff9b71`. When a user selects Ocean Academy (teal accents), should the focus ring become teal?

6. **Onboarding dark theme**: The onboarding uses its own `#0d0d1a` dark aesthetic that ignores the user's selected theme entirely. Is this a deliberate "first-run cinematic" experience, or should onboarding eventually respect the user's theme preference (if they've visited before)?

7. **Theme-to-theme surface consistency**: All light modes use `#FFFFFF` for surface, but dark modes each have unique tinted surfaces (warm brown, purple, teal, green, indigo, sienna). Was the white surface in light mode intentional (simplicity), or should light mode surfaces carry a subtle tint matching the background (e.g., slightly cream for Genesis Classic, slightly lavender for Aurora)?

---

BRAND AUDIT COMPLETE -- REPORT READY FOR DEVELOPER REVIEW
