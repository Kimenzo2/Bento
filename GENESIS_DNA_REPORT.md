# Genesis -- Full Frontend DNA Report

Audited: 2026-03-10
Files read: 200+
Components audited: 85+

---

## EXECUTIVE SUMMARY

Genesis is a **warmly premium AI storytelling platform** that deliberately occupies the intersection of children's storybook magic and modern SaaS craft. Its visual DNA fuses the approachability of an educational product (rounded shapes, a mascot cast, playful spring animations) with the polish of a developer-forward platform (Vercel-style card glows, Apple-eased transitions, a six-theme paired light/dark system). The emotional world is intentionally warm -- every theme's dark mode carries a tinted undertone (brown-black, purple-black, teal-black, green-black) rather than cold generic black. The design philosophy is **flat-with-depth**: all box-shadows are disabled globally, yet depth is created through radial-gradient glows, backdrop blur, layered blobs, and particle effects. The product feels like a storybook-wrapped creative engine where every decorative decision says: "this is imaginative, this is safe, this is premium."

---

## 1. COLOUR AND THEME DNA

### Theme System

**Six named themes** exist, each as a paired light/dark set. Themes are defined in `config/themes.ts` as TypeScript objects containing both `cssVariables` and `darkCssVariables` maps. The `ThemeProvider` (`contexts/ThemeContext.tsx`) applies CSS custom properties directly to `document.documentElement.style` via `root.style.setProperty()`. A CSS class `theme-<id>` is set on `<body>`, and the `dark` class is toggled on both `<html>` and `<body>`.

- **Storage**: `localStorage` keys `genesis_theme_id` and `genesis_dark_mode`. Not synced to Supabase.
- **Transition**: 0.3s ease CSS transition on `background-color` and `color` on `<html>` for smooth theme switching.
- **Tailwind bridge**: `index.css` `@theme` block and `tailwind.config.js` map CSS variables to semantic tokens (`cream-base`, `coral-burst`, `gold-sunshine`, `charcoal-soft`, `cocoa-light`, `peach-soft`, `surface`).

### Complete Colour Documentation

#### Theme 1: GENESIS CLASSIC (id: `genesis`) -- DEFAULT

| Token | Light | Dark |
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

Light/Dark relationship: Dark background `#1A1412` (R=26,G=20,B=18) is a **warm brown-black** that mirrors the warm cream light mode. Surface `#2A201D` is warm brown.

#### Theme 2: AURORA SCHOLAR (id: `aurora`)

| Token | Light | Dark |
|---|---|---|
| `--color-primary-start` | `#4A148C` | `#7C4DFF` |
| `--color-primary-end` | `#E91E63` | `#F48FB1` |
| `--color-accent-start` | `#FFB74D` | `#FFCC80` |
| `--color-accent-end` | `#9C27B0` | `#CE93D8` |
| `--color-background` | `#F8F5FF` | `#130C1C` |
| `--color-surface` | `#FFFFFF` | `#1E152D` |
| `--color-text` | `#2D1B4E` | `#E2D8F0` |
| `--color-text-light` | `#6A4F8B` | `#A594BD` |
| `--color-border` | `#E1BEE7` | `#362554` |
| `--color-shadow` | `74, 20, 140` | `74, 20, 140` |

Light/Dark relationship: Dark background `#130C1C` (R=19,G=12,B=28) is a **deep purple-black**. Surface `#1E152D` is purple-tinted.

#### Theme 3: OCEAN ACADEMY (id: `ocean`)

| Token | Light | Dark |
|---|---|---|
| `--color-primary-start` | `#006064` | `#26C6DA` |
| `--color-primary-end` | `#00ACC1` | `#80DEEA` |
| `--color-accent-start` | `#4DD0E1` | `#B2EBF2` |
| `--color-accent-end` | `#80DEEA` | `#E0F7FA` |
| `--color-background` | `#E0F7FA` | `#0A191C` |
| `--color-surface` | `#FFFFFF` | `#12272B` |
| `--color-text` | `#00363A` | `#D5EFEF` |
| `--color-text-light` | `#00838F` | `#85AFA8` |
| `--color-border` | `#B2EBF2` | `#1A424A` |
| `--color-shadow` | `0, 96, 100` | `0, 96, 100` |

Light/Dark relationship: Dark background `#0A191C` (R=10,G=25,B=28) is a **deep teal-black**.

#### Theme 4: FOREST WISDOM (id: `forest`)

| Token | Light | Dark |
|---|---|---|
| `--color-primary-start` | `#2E7D32` | `#66BB6A` |
| `--color-primary-end` | `#66BB6A` | `#A5D6A7` |
| `--color-accent-start` | `#AED581` | `#C5E1A5` |
| `--color-accent-end` | `#FFE57F` | `#FFF59D` |
| `--color-background` | `#F1F8E9` | `#0F1A12` |
| `--color-surface` | `#FFFFFF` | `#18291B` |
| `--color-text` | `#1B5E20` | `#DBEFE0` |
| `--color-text-light` | `#558B2F` | `#8EAB94` |
| `--color-border` | `#C5E1A5` | `#28462C` |
| `--color-shadow` | `46, 125, 50` | `46, 125, 50` |

Light/Dark relationship: Dark background `#0F1A12` (R=15,G=26,B=18) is a **deep forest green-black**.

#### Theme 5: NEBULA MIND (id: `nebula`)

| Token | Light | Dark |
|---|---|---|
| `--color-primary-start` | `#1A237E` | `#5C6BC0` |
| `--color-primary-end` | `#7B1FA2` | `#AB47BC` |
| `--color-accent-start` | `#E91E63` | `#EC407A` |
| `--color-accent-end` | `#FFD54F` | `#FFE082` |
| `--color-background` | `#EDE7F6` | `#100C1A` |
| `--color-surface` | `#FFFFFF` | `#1A152A` |
| `--color-text` | `#12005E` | `#DED8EB` |
| `--color-text-light` | `#5E35B1` | `#938BA3` |
| `--color-border` | `#D1C4E9` | `#2A2244` |
| `--color-shadow` | `26, 35, 126` | `26, 35, 126` |

Light/Dark relationship: Dark background `#100C1A` (R=16,G=12,B=26) is a **deep indigo-black**.

#### Theme 6: SUNSET SCHOLAR (id: `sunset`)

| Token | Light | Dark |
|---|---|---|
| `--color-primary-start` | `#BF360C` | `#FF7043` |
| `--color-primary-end` | `#FF6F00` | `#FFCA28` |
| `--color-accent-start` | `#FFB74D` | `#FFE082` |
| `--color-accent-end` | `#FFD54F` | `#FFF59D` |
| `--color-background` | `#FFF3E0` | `#1C120C` |
| `--color-surface` | `#FFFFFF` | `#2D1C12` |
| `--color-text` | `#3E2723` | `#EFE5DE` |
| `--color-text-light` | `#8D6E63` | `#AC9B8F` |
| `--color-border` | `#FFCCBC` | `#4A2E1F` |
| `--color-shadow` | `191, 54, 12` | `191, 54, 12` |

Light/Dark relationship: Dark background `#1C120C` (R=28,G=18,B=12) is a **warm sienna-black**.

#### Static Colours (not theme-dependent)

| Token | Hex | Usage |
|---|---|---|
| `yellow-butter` | `#FFF4A3` | Highlight, decoration |
| `mint-breeze` | `#D4F4DD` | Subtle green accents |

### Colour Personality Analysis

**WHY these colours:**
- The default Genesis Classic palette (`#FFF8E7` cream background, `#FF9B71` coral accent, `#FFD93D` gold secondary) creates a **warm, nurturing, creatively energetic** world. Cream is not white -- it is deliberate. It removes the clinical harshness of a tech product and replaces it with the warmth of paper, parchment, or a child's storybook page.
- Coral-to-gold gradients (`#FF9B71` to `#FFD93D`) signal **creative energy** -- sunset warmth, not corporate blue. This palette positions Genesis as a creative tool, not a productivity tool.
- Every theme is named with an aspirational/educational suffix ("Scholar", "Academy", "Wisdom", "Mind") -- signalling that Genesis sees itself as both creative and educational.
- The warm dark mode backgrounds are a critical design decision: they maintain emotional continuity between light and dark. A user switching to dark mode retains the feeling of warmth rather than entering a cold void.
- All shadows are globally disabled (`--shadow-*: none`). This is a deliberate flat design philosophy -- depth comes from blobs, glows, and opacity layers rather than drop shadows.

---

## 2. TYPOGRAPHY DNA

### Fonts In Use

| Font | Source | Weights | Primary Role |
|---|---|---|---|
| **Fredoka** | Google Fonts | 400, 500, 600, 700 | Default heading font |
| **Manrope** | Google Fonts (variable) | 200-800 | Default body font |
| **Instrument Serif** | Google Fonts | 400 | Blog/editorial headings |
| **Geist** | Google Fonts (variable) | 100-900 | Blog/editorial body |
| **Noto Sans Arabic Variable** | @fontsource-variable (local) | 100-900 | Arabic/RTL script |

**Dynamic font pairings** (user-selectable in Settings):
| Pairing | Category | Heading | Body |
|---|---|---|---|
| Playful Classic (default) | playful | Fredoka | Manrope |
| Classic Academic | professional | Playfair Display | Source Sans 3 |
| Modern Tech | modern | Inter | IBM Plex Sans |
| Storybook Magic | playful | Quicksand | Nunito |
| Editorial Elegance | editorial | Spectral | Lato |
| Handwritten Warmth | handwritten | Caveat | Karla |

### Type Scale

| Scale | rem | px | Line Height |
|---|---|---|---|
| `text-xs` | 0.75 | 12 | 1.333 |
| `text-sm` | 0.875 | 14 | 1.429 |
| `text-base` | 1 | 16 | 1.5 |
| `text-lg` | 1.125 | 18 | 1.556 |
| `text-xl` | 1.25 | 20 | 1.4 |
| `text-2xl` | 1.5 | 24 | 1.333 |
| `text-3xl` | 1.875 | 30 | 1.2 |
| `text-4xl` | 2.25 | 36 | 1.111 |
| `text-5xl` | 3 | 48 | 1 |
| `text-6xl` | 3.75 | 60 | 1 |

Most used sizes: `text-sm` (607 occurrences), `text-xs` (485), `text-lg` (163), `text-2xl` (118), `text-xl` (111).

### Font Hierarchy

| Level | Font | Weight | Size | Usage |
|---|---|---|---|---|
| Display | `font-heading` | bold/extrabold | 4xl-6xl | Hero headlines, auth, pricing |
| Heading | `font-heading` | bold | xl-3xl | Section titles, modal headers |
| Subheading | `font-heading` | bold/semibold | lg-xl | Card titles, list headers |
| Body | `font-body` (inherit) | normal/medium | sm-base | Paragraphs, descriptions |
| Caption | inherit | medium/bold | xs, [10px]-[11px] | Tags, timestamps, metadata |
| Code | `font-mono` | bold/medium | xs-sm | Keyboard shortcuts, IDs |
| Editorial | Instrument Serif / Geist | 400 | variable | Blog, learn, transparency |

### Typography Personality Analysis

**WHY Fredoka + Manrope:**
- **Fredoka** is a rounded, friendly sans-serif -- it communicates warmth, approachability, and child-friendliness. It is distinctly not Inter, not Geist, not any "default AI font". This is a deliberate choice to feel like a storybook.
- **Manrope** is a modern geometric sans-serif that is readable yet has personality. It balances Fredoka's playfulness with clarity.
- The pairing creates **playful authority** -- headings say "this is fun" while body text says "this is professional".
- The fact that users can swap font pairings (6 options from playful to editorial to handwritten) reveals Genesis sees typography as an emotional setting, not just a visual one. Different users need different emotional tones.
- The blog/learn pages use **Instrument Serif + Geist** -- a completely separate editorial typography system. This signals that public content pages aspire to a magazine/editorial aesthetic distinct from the playful internal product.

---

## 3. DECORATIVE ELEMENTS DNA

### Blobs and Organic Shapes

**What they are:** Large (250-500px) CSS circles with `rounded-full` and extreme `blur-3xl` (48px) creating soft, diffused colour washes. They are positioned absolutely behind content using low opacity (10-20%).

**Where they appear:**
- PersonalizationQuiz (onboarding): 3 blobs (purple, blue, pink), animated drift + scale pulse, 15s loop
- Tier Detail pages (Creator/Studio/Empire): 2 blobs per page, static, colour-matched to tier (emerald for Creator, violet for Studio, slate for Empire)
- CommitmentCalculator: 1 gradient blob behind dark card
- ROICalculator: 1 centred full-size blob behind content
- ProRevealMoment: 2 animated glow orbs (purple + amber, blur-[100px])
- CreativePersonaQuiz: 2 pulsing blobs (purple + blue)

**WHY they were chosen:** Blobs serve as atmospheric depth. They soften the flat design by creating a sense of ambient light without resorting to box shadows. The colour choice always reinforces the context -- purple for creativity, emerald for growth, amber for value. They make the flat surfaces feel like they exist in a warm lit environment. They signal: "this is a creative product, not a spreadsheet."

### Glow Effects -- Vercel-Style Cards

**Exact implementation** (CreationCanvas.tsx, lines 100-204):

The Quick Start cards on the dashboard use a **two-layer radial-gradient glow** that tracks the mouse cursor:

```
Layer 1 (Static default):
  radial-gradient(600px circle at [preset-position], rgba(255,155,113,0.35), transparent 40%)
  opacity: 0.8, fades to 0 on hover

Layer 2 (Interactive, follows mouse):
  radial-gradient(600px circle at [mouseX]px [mouseY]px, rgba(255,155,113,0.35), transparent 40%)
  opacity: 0 by default, fades to 1 on hover
```

- Glow colour: `rgba(255, 155, 113, 0.35)` -- coral-burst at 35% opacity
- Size: 600px circle
- Trigger: `onMouseMove` tracks cursor position via `getBoundingClientRect()`
- Default positions: bottom-left, bottom-middle, bottom-right (one per card)
- Cards: `rounded-3xl`, `border-2 border-peach-soft`, `min-h-[220px]`, `p-6 md:p-8`
- Container: `overflow-hidden` with `z-0` glow layer

**WHY it was chosen:** The Vercel-style card glow directly references the aesthetic of premium developer tool companies (Vercel, Linear, Resend). It signals: "we are a modern SaaS product, not a toy." The coral glow colour ties it to the Genesis brand palette, making the technique feel native rather than borrowed. The mouse-tracking interaction creates a sense of living, responsive UI -- the cards feel sentient. This is aspirational positioning: Genesis wants to be perceived as developer-grade quality applied to a creative product.

### Gradients

Gradients are used **strategically, not liberally**:

**Primary CTA gradient**: `linear-gradient from-coral-burst to-gold-sunshine` (coral-to-gold) -- used on the primary button variant, progress bars, slider ranges, tabs active state. This is THE signature gradient.

**Background gradients**: Onboarding uses `from-slate-900 via-[#0d0d1a] to-slate-900` consistently across all dark onboarding screens. The internal app does NOT use background gradients (it uses flat `bg-cream-base`).

**Generation phases**: Each generation phase has its own pastel gradient:
- Sketching: `#FFE8D6 to #FFF8DC` (warm cream-to-gold)
- Painting: `#D5F2E3 to #E8D5F2` (mint-to-lavender)
- Writing: `#FFE17B to #FF9B85` (gold-to-coral)
- Magic: `#FF9B85 to #FFD93D` (coral-to-gold final)

**Text gradients**: WelcomeHero uses `from-purple-400 via-pink-400 to-amber-400` on "with a spark." -- the only gradient text in the internal app.

**WHY**: Gradients are restricted to moments of emphasis -- CTAs, generation progress, and onboarding hero text. The internal app pages are deliberately flat (cream background, white surfaces). This contrast makes gradient elements feel special and actionable.

### Background Atmosphere

**Dot grids**: Radial-gradient dot patterns at extreme low opacity (0.02-0.03) used in onboarding screens, SmartEditor, and StoryMap. Size: 24-50px spacing.

**Line grid**: Combined horizontal + vertical white lines at 0.02 opacity in WelcomeHero. Size: 60px spacing.

**Cream paper texture**: Physical texture overlay (`/textures/cream-paper.png`) at 40% opacity with `mix-blend-multiply` in SmartEditor and BookViewer -- gives book preview a paper feel.

**Radial spotlights**: Large (500-800px) radial gradient ellipses of near-invisible white (0.02-0.04 opacity) centred on the page to create subtle vignette lighting.

**Backdrop blur**: Navigation bar uses `bg-cream-base/85 backdrop-blur-md` for a frosted-glass effect. Blog headers use the same. This creates a hierarchy where navigation "floats" above content.

**WHY**: The atmospheric effects work together to create a sense of physical environment. Dot grids suggest graph paper or creativity space. Paper textures on the editor reinforce the story-making metaphor. Radial spotlights create the illusion of a reading lamp. Every effect is extremely subtle (0.02-0.04 opacity) -- they are felt, not seen.

---

## 4. MASCOT DNA

### Identity

**Primary mascot: Gen** -- "Gen, your AI creative guide." A 3D/Pixar-style illustrated character rendered from a high-resolution JPEG (`/images/onboarding/Style_directive_highend_202512150033.jpeg`). Gen is a friendly, encouraging creative companion.

**Six dashboard mascots:**
| Character | Image | Position |
|---|---|---|
| Joy the Musician | `joy-musician.png` | header-left |
| Zara the Scientist | `zara-scientist.png` | header-right |
| Wise Sage | `wise-sage.png` | middle-left |
| Explorer Boy | `explorer-boy.png` | middle-right |
| Wise Owl | `wise-owl.png` | bottom-left |
| Magic Dragon | `magic-dragon.png` | bottom-right |

### Presence in the App

**Gen appears in:**
1. **WelcomeHero** (onboarding step 1): Scale-fade entrance with sparkle crown above. Title: "Gen, your AI creative guide."
2. **FeatureStorybook** (onboarding step 6): Spring-animated slide-in from left with speech bubbles. Purple glow behind (`bg-purple-500/30 blur-3xl`). Delivers encouraging messages per feature.

**Dashboard mascots appear:**
- Six characters frame the CreationCanvas homepage, positioned as decorative figures around the creation workspace.
- CSS `animate-float` (8s ease-in-out vertical bob) with staggered delays (0-2.5s).
- Hidden on mobile/tablet (desktop-only via `hidden xl:block` for middle/bottom positions).
- Hover: opacity 0.9 to 1.0, 5% scale-up.
- Lazy-loaded with `loading="lazy" decoding="async"`.

**PricingPage mascot:** A 3D Pixar-style community illustration (`8k_3d_pixar_202512022053.jpeg`) at the bottom of the pricing page with a cream gradient overlay.

### Why the Mascot Exists

Gen and the mascot cast are **functionally integrated** into the experience, not merely decorative:
- **Gen speaks**: In FeatureStorybook, Gen delivers contextual messages via speech bubbles: *"I can help you craft stories that captivate and inspire!"* -- this transforms a passive feature tour into a character-guided conversation.
- **The dashboard mascots create a world**: Joy, Zara, Wise Sage, Explorer Boy, Wise Owl, and Magic Dragon represent the *types of stories* users might create (music, science, wisdom, adventure, nature, fantasy). Their presence transforms a blank dashboard into an inhabited creative universe.
- **Emotional safety**: For a product targeting parents and educators creating children's content, mascots reduce intimidation. They say: "this is a place for imagination."
- **The Pixar-style quality**: Gen is not a simple SVG illustration or emoji mascot. The high-resolution 3D Pixar-quality rendering signals production value -- the mascot aesthetic matches what users will create with Genesis.

---

## 5. SHADCN COMPONENT DNA

### Components In Use

24 component files in `components/ui/`, of which 22 are shadcn-based and 2 are fully custom (`toggle-row.tsx`, `direction.tsx`). The shadcn style is **new-york** with **neutral** base colour.

| Component | Import Count | Customisation Level |
|---|---|---|
| button.tsx | ~40 | **Heavy** -- 7 variants, gradient primary, active:scale-[0.98] |
| input.tsx | ~15 | **Heavy** -- combines Input+Textarea+Label, h-11, 4-ring focus |
| card.tsx | via barrel | **Heavy** -- rounded-2xl, font-heading titles |
| dialog.tsx | ~6 | **Heavy** -- rounded-3xl, lighter overlay |
| tabs.tsx | via barrel | **Heavy** -- gradient active state, scale-105 |
| badge.tsx | ~3 | **Heavy** -- 8 variants including gold gradient |
| alert.tsx | ~1 | **Medium** -- 4 variants |
| select.tsx | ~2 | **Medium** -- h-11, coral accents |
| switch.tsx | ~1 | **Medium** -- coral checked state |
| avatar.tsx | ~2 | **Light** -- peach border added |
| separator.tsx | ~1 | **Light** -- 2px thickness |
| tooltip.tsx | via barrel | **Light** -- cream bg (inverted from shadcn dark) |
| All others | 0-1 | **Medium** -- consistently re-themed |

### Customisations Made

Every shadcn component has been re-themed from the default neutral palette to the Genesis cream/coral/gold system:

- **All backgrounds**: `bg-card` replaced with `bg-cream-base`
- **All borders**: `border-border` replaced with `border-peach-soft`
- **All text**: `text-foreground` replaced with `text-charcoal-soft`, muted with `text-cocoa-light`
- **All focus rings**: Changed from blue/ring-2 to `ring-coral-burst/40 ring-4`
- **All border-radius**: Increased -- `rounded-md` to `rounded-xl`, `rounded-lg` to `rounded-2xl`, etc.
- **All headings/labels**: `font-heading font-bold` instead of default `font-medium`
- **Active states**: Added `active:scale-[0.98]` press animation to buttons
- **Primary variant**: Custom gradient `bg-linear-to-r from-coral-burst to-gold-sunshine`
- **Shadow system**: All shadows remain `none` (flat design)

**Consistent radius hierarchy**:
- `rounded-xl` (12px): inputs, buttons, small items
- `rounded-2xl` (16px): cards, panels
- `rounded-3xl` (24px): dialogs, modals, hero cards
- `rounded-full`: badges, pills, avatars, nav items

### Why Shadcn

shadcn/ui was chosen because it gives **full ownership of the design system**. The components are copied into the project (not a dependency), meaning Genesis can re-theme every single component without fighting a library's opinions. The `new-york` variant was chosen as the starting point because it is slightly more opinionated than `default` (tighter, more refined) but still fully malleable.

The barrel export file declares the library as inspired by "FoundrList.com with cream/coral/gold design system and clean 2px borders" -- revealing the developer's reference for the border and surface style. Every component has been transformed from a generic neutral palette into the Genesis brand, with the coral-to-gold gradient as the signature interactive accent. The fact that `font-heading font-bold` is used for every title/label in the component library (not `font-medium`) signals that Genesis wants its UI to feel **confident and assertive**, not quiet.

---

## 6. MOTION AND ANIMATION DNA

### Animation Inventory

**Framer Motion** (v12.23.24) is the sole animation library. 493 `motion.` usages across 44 files. CSS keyframes supplement for ambient effects.

| Category | Type | Duration/Config | Trigger | Example |
|---|---|---|---|---|
| Spring entrance | spring, bounce: 0.4 | mount, key change | GenMascot slide-in |
| Apple-ease tween | cubic-bezier [0.22, 1, 0.36, 1] | 0.15-0.4s | mount, state | WelcomeHero headline |
| Page slide transition | directional tween | 0.4s + 300px translate | step/index change | FeatureStorybook carousel |
| Ambient float | CSS keyframe `float` | 8s ease-in-out infinite | always active | Dashboard mascots |
| Hover scale | whileHover 1.02x, whileTap 1.0x | instant | hover/tap | Cards, buttons |
| Ambient pulse | CSS/Framer | 1.5-3s oscillation | always active | Glow orbs, wand icons |
| Staggered reveal | staggerChildren 0.03-0.1s | mount | FeatureStorybook features |
| Progress shimmer | CSS `shimmer` keyframe | 1.5s infinite | during progress | GenerationTheater bar |
| Nav dance | CSS keyframe | 0.52s cubic-bezier | hover | Navigation icon wiggle |
| Confetti burst | Framer position + rotation | 3-5s linear | mount | WelcomeSuccess, BookSuccess |
| Particle system | requestAnimationFrame | continuous | during generation | GenerationTheater |
| Sparkle cursor | mousemove + setTimeout | 20% chance per move | global cursor | SparkleCursor |

### Animation Personality

The motion language is a **hybrid of snappy and organic**:

- **Snappy for interactions**: Apple-style easing `[0.22, 1, 0.36, 1]` with 0.15-0.25s durations. Every button press, hover, and page transition feels immediate and polished. This is SaaS-grade responsiveness.
- **Springy for entrances**: Spring physics (bounce: 0.4) for mascots, images, and onboarding steps. This gives a playful, child-friendly bounciness.
- **Organic for atmosphere**: 4-8 second CSS animations for floating mascots, pulsing blobs, and drifting particles. The world breathes.
- **Reduced-motion fully respected**: `prefersReducedMotion()` utility, CSS `@media (prefers-reduced-motion: reduce)` rules, and component-level disable flags. Accessibility is not an afterthought.

**What this says**: The animation language positions Genesis between Apple (precision, quality) and Pixar (personality, warmth). The interplay of fast interaction animations and slow ambient animations creates a product that feels both responsive to use and emotionally alive.

---

## 7. ICONOGRAPHY DNA

### Icon System

- **Library**: Lucide React (sole third-party icon library)
- **Style**: Outline stroke icons (Lucide's default 1.5px stroke)
- **109 files** import from `lucide-react`
- **Custom icons**: `IconscoutIcons.tsx` provides 14 hand-crafted SVG icons: IcoRocket, IcoCrown, IcoSend, IcoBuilding, IcoPalette, IcoStar, IcoWand, IcoBook, IcoPen, IcoZap, IcoCheck, IcoLibrary, IcoAward, IcoBell, IcoScroll

### Icon Sizing

| Size | Occurrences | Context |
|---|---|---|
| `w-4 h-4` | 349 | Default in-button/inline icons |
| `w-5 h-5` | 280 | Settings, toasts, medium emphasis |
| `w-6 h-6` | 85 | Section headers, mobile nav |
| `w-8 h-8` | 77 | Loading spinners, hero, empty states |

### Custom Assets

30+ inline SVGs across components (Google auth icon, collaboration indicators, curriculum elements, certificate SVG, progress circles). The IconscoutIcons.tsx collection includes multi-colour icons (IcoCrown with gold/red/blue, IcoWand with purple/red/yellow/pink) that break from Lucide's monochrome pattern for moments of visual delight.

**WHY Lucide**: Lucide is modern, consistent, and uses a 24x24 grid with 1.5px stroke -- this matches the clean, outlined aesthetic of the Genesis UI. The outline style communicates modern/minimal without being cold. The custom IconscoutIcons supplement with illustrative quality when a moment needs more personality than a line icon can provide (crowns, wands, awards).

---

## 8. SPATIAL AND LAYOUT DNA

### Layout Architecture

**Shell**: Full-width with fixed top navigation (no sidebar except in Settings).

**Navigation**: Fixed at top, `px-4 md:px-12` (16-48px padding), frosted glass (`bg-cream-base/85 backdrop-blur-md`), 2px bottom border.

**Content width tiers**:
| Tier | max-width | Usage |
|---|---|---|
| Wide | `max-w-6xl` (1152px) | Dashboard library, Visual Studio, SmartEditor toolbar |
| Medium | `max-w-4xl` (896px) | Settings, form pages, legal, transparency |
| Narrow | `max-w-2xl`-`3xl` (672-768px) | Article content, modal bodies |
| Compact | `max-w-md` (448px) | Dialogs, small panels |

**Grid patterns**: Responsive `grid-cols-1 -> md:grid-cols-2 -> lg:grid-cols-3` for cards. Dashboard quick-starts use `md:grid-cols-3`. Art style selector uses `md:grid-cols-5`.

### Spacing Philosophy

- **Generous**: pb-32 (128px) bottom spacing for mobile nav, gap-6/8 for section grids, space-y-6 for vertical stacking.
- **Card padding**: Consistently `p-6 md:p-8` with rounded-2xl/3xl corners.
- **Information density**: Moderate -- the app favours readability with `leading-relaxed`, ample whitespace, and `text-sm` as the default body size. This positions it as a creative tool (breathing room for inspiration) rather than a data-dense dashboard (Linear, Notion).
- **Border-radius hierarchy is rigorous**: Every UI tier has a consistent radius -- xl for atoms, 2xl for molecules, 3xl for organisms.

---

## 9. OVERALL DESIGN PHILOSOPHY

**What is the product trying to feel like?**
Genesis is trying to feel like a **warmly premium creative companion** -- one part children's storybook (rounded fonts, mascots, floating blobs, paper textures), one part modern SaaS platform (Vercel-style card glows, Apple-eased transitions, frosted navigation). It wants to be taken seriously as a tool while never losing the warmth that its creative/educational audience needs. Evidence: Fredoka headings (playful authority), cream backgrounds (warm paper), coral-gold gradients (creative energy), disabling all shadows (flat modernity), mouse-tracking card glows (SaaS sophistication).

**Who is the design speaking to?**
The design speaks to **creative adults who make content for young audiences** -- parents, educators, children's book authors, indie creators. The typography is readable, not infantile. The mascots are high-quality Pixar-style, not clip art. The themes have scholarly names (Aurora Scholar, Ocean Academy, Forest Wisdom). The product treats its users as creative professionals who work in a child-friendly domain.

**What design influences are visible?**
- **Vercel/Linear**: Card glow effects, frosted nav, Apple cubic-bezier easing, flat design with no shadows
- **Pixar/Disney**: 3D mascot quality, warm palette, playful spring animations
- **Notion**: Clean surfaces, generous whitespace, typography-first content
- **Children's educational products**: Rounded shapes, warm cream palette, friendly sans-serif fonts
- **Apple HIG**: The easing curves, the motion presets, the `prefersReducedMotion` respect

**What is the single strongest visual signature?**
The **warm cream background (`#FFF8E7`) paired with the coral-to-gold gradient (`#FF9B71` to `#FFD93D`)**. This combination appears everywhere -- page backgrounds, CTA buttons, progress bars, tab active states, slider ranges. It is the most immediately recognisable visual element and the one that most defines "this is Genesis."

**What is internally consistent vs inconsistent?**
- **Consistent**: The shadcn re-theming is meticulous -- every component follows cream/coral/gold. The border-radius hierarchy is rigorous. The theme system's paired light/dark is thoughtfully designed with colour-temperature matching.
- **Consistent**: All shadows are disabled; depth comes from glows and opacity.
- **Inconsistent**: Blog/learn/transparency pages use a **completely separate typography system** (Instrument Serif + Geist with inline `S` style objects) that bypasses the theme-aware font system entirely. These pages ignore the user's selected font pairing.
- **Inconsistent**: ChatWidget.css defines its own `:root` colour palette that does not reference the theme CSS variables at all. It uses hardcoded values (`#ff6b6b`, `#fca311`, `#2d3748`) that are adjacent to but not identical to the Genesis theme tokens.
- **Inconsistent**: Some components use hardcoded hex colours (e.g., collaboration presence colours, GamificationHub SVG fills) rather than theme tokens, meaning they will not respond to theme changes.

---

## 10. RAW ASSET INVENTORY

### CSS Variables

| Variable | Light Default | Dark Default (Genesis Classic) |
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

### Fonts

| Font | Weights | Used For |
|---|---|---|
| Fredoka | 400, 500, 600, 700 | Default headings (`font-heading`) |
| Manrope | 200-800 (variable) | Default body (`font-body`) |
| Instrument Serif | 400 | Blog/editorial headings |
| Geist | 100-900 (variable) | Blog/editorial body |
| Noto Sans Arabic Variable | 100-900 | Arabic/RTL override |
| Playfair Display | 600, 700, 800 | Dynamic pairing: Classic Academic |
| Source Sans 3 | 400, 500, 600 | Dynamic pairing: Classic Academic |
| Inter | 600, 700, 800 | Dynamic pairing: Modern Tech |
| IBM Plex Sans | 400, 500, 600 | Dynamic pairing: Modern Tech |
| Quicksand | 600, 700 | Dynamic pairing: Storybook Magic |
| Nunito | 400, 500, 600 | Dynamic pairing: Storybook Magic |
| Spectral | 600, 700, 800 | Dynamic pairing: Editorial Elegance |
| Lato | 400, 500, 600 | Dynamic pairing: Editorial Elegance |
| Caveat | 600, 700 | Dynamic pairing: Handwritten Warmth |
| Karla | 400, 500, 600 | Dynamic pairing: Handwritten Warmth |

### Static Colours (non-theme)

| Token/Name | Hex | Usage |
|---|---|---|
| yellow-butter | `#FFF4A3` | Highlights, particles |
| mint-breeze | `#D4F4DD` | Success accents, particles |
| Sparkle palette | `#FF9B71, #FFD700, #60A5FA, #F472B6` | SparkleCursor |
| Onboarding dark | `#0d0d1a` | Onboarding background |
| Confetti palette | `#a855f7, #ec4899, #f59e0b, #3b82f6, #10b981` | WelcomeSuccess |
| Generation phase 1 | `#FFE8D6, #FFF8DC` | Sketching gradient |
| Generation phase 2 | `#D5F2E3, #E8D5F2` | Painting gradient |
| Generation phase 3 | `#FFE17B, #FF9B85` | Writing gradient |
| Generation phase 4 | `#FF9B85, #FFD93D` | Magic gradient |

### Animations

| Element | Type | Duration | Trigger |
|---|---|---|---|
| Mascots (dashboard) | CSS float | 8s ease-in-out | always |
| Section reveals | CSS fadeIn | 0.5s ease-out | mount |
| Nav icon | CSS nav-dance | 0.52s cubic-bezier | hover |
| Progress shimmer | CSS shimmer | 1.5s infinite | active |
| Gen mascot | spring entrance | bounce: 0.4 | mount |
| Page content | Apple tween | 0.25-0.4s | mount/state |
| Hover scale | Framer whileHover | 1.02x | hover |
| Button press | active:scale-[0.98] | instant | click |
| Blob pulse | Framer scale/opacity | 8-15s loop | always |
| Particle system | requestAnimationFrame | continuous | generation |
| Confetti | Framer fall | 3-5s linear | mount |
| Sparkle cursor | DOM append + fade | 50ms tick | mousemove |

---

## OPEN QUESTIONS FOR DEVELOPER

1. **ChatWidget.css isolation**: The chat widget defines its own `:root` colour palette with hardcoded hex values (`#ff6b6b`, `#fca311`, `#2d3748`). Was this intentional isolation from the theme system, or should the chat widget adopt theme CSS variables?

2. **Blog typography bypass**: Blog/learn/transparency pages use inline Instrument Serif + Geist typography that ignores the user's selected font pairing. Is this intentional (public pages should have a fixed editorial identity) or should they respect the font setting?

3. **Unused mascot assets**: `mascot-analytical.png` and `mascot-creative.png` exist in `public/assets/` but are not referenced anywhere. Were these deprecated or planned for future use?

4. **Collaboration hardcoded colours**: The presence indicator uses a fixed 8-colour palette (`#FF6B6B`, `#4ECDC4`, `#45B7D1`, etc.) that does not respond to theme changes. Is this intentional (user presence colours should be theme-independent) or an oversight?

5. **Focus outline hardcoded**: The keyboard focus outline uses hardcoded `#ff9b71` (coral-burst) rather than `var(--color-primary-start)`. Should this track the active theme's primary colour?

6. **External texture dependency**: MigrationAssistant loads a texture from `transparenttextures.com`. Should this be bundled locally for offline/reliability?

7. **Onboarding dark theme**: The onboarding flow uses `#0d0d1a` as its dark base with purple/blue/amber accents. This is a completely separate dark palette from the 6 theme dark modes. Was this intentional to create a distinct "cinematic" onboarding experience, or should onboarding adopt the active theme?

---

GENESIS DNA EXTRACTION COMPLETE -- FULL REPORT READY FOR DEVELOPER REVIEW
