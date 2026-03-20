# GENESIS COMPONENTS TODO — Phase 3: Component Migration
**Prepared by:** Implementation Engineer  
**Phase:** 3 (after Phase 2 infrastructure is complete)  
**Prerequisite:** `THEME_AUDIT.md`, `DARK_PALETTE.md`, and this Phase 2 implementation are merged.  
**Constraint:** Migrate each component to semantic tokens. No decorative effects. Exact colour decisions from `DARK_PALETTE.md`.

---

## RULES FOR NEXT EXECUTOR

1. **DO NOT invent colours.** Every replacement hex/token must exist in `DARK_PALETTE.md` or `THEME_AUDIT.md §E`.
2. **Use semantic token Tailwind classes** (e.g. `bg-surface-elevated`, `text-text-primary`) where the token directly maps. Use `bg-[var(--genesis-*)]` arbitrary syntax ONLY for tokens without a Tailwind utility shorthand.
3. **Preserve existing component logic.** Only change `className` strings and inline style values. Do not refactor JSX structure.
4. **Verify light AND dark mode** after each component by toggling the theme in the running dev server.
5. **Work in severity order:** CRITICAL first, then HIGH, MEDIUM, LOW.

---

## ██ CRITICAL — Fix immediately (causes broken UI in one or both modes) ██

---

### 1. `components/CurriculumAssessment.tsx`
**Severity:** CRITICAL  
**Problem:** Component is designed as a permanently dark panel. Uses hardcoded navy/dark bg with `text-white`, creating a near-black box on cream light-mode background.

| Find | Replace With |
|------|-------------|
| `bg-[#1a1a2e]` | `bg-surface-base` |
| `to-[#16213e]` | `to-surface-elevated` |
| `bg-gray-800` | `bg-surface-elevated` |
| `bg-gray-800/50` | `bg-surface-elevated/50` |
| `text-white` (headings/body) | `text-text-primary` |
| `text-white` (on coral/gold bg elements) | keep as `text-white` — justified by coloured background |
| `border-gray-700` | `border-border-default` |
| `text-gray-300` | `text-text-secondary` |
| `text-gray-400` | `text-text-muted` |

**Special instruction:** Retain the "special panel" visual identity by adding `border border-border-brand shadow-dark-md` to the main container (replaces the dark bg differentiation).

---

### 2. `components/CharacterDepthPanel.tsx`
**Severity:** CRITICAL  
**Problem:** Always-dark panel. `bg-slate-900` + `text-white` renders as dark box on cream background in light mode.

| Find | Replace With |
|------|-------------|
| `bg-slate-800/50` | `bg-surface-elevated/80` |
| `bg-slate-900` | `bg-surface-elevated` |
| `bg-slate-800` | `bg-surface-elevated` |
| `text-white` (body text) | `text-text-primary` |
| `border-slate-600` | `border-border-default` |
| `border-slate-700` | `border-border-subtle` |
| `text-slate-300` | `text-text-secondary` |
| `text-slate-400` | `text-text-muted` |

---

### 3. `components/ConversationMode.tsx`
**Severity:** CRITICAL  
**Problem:** Full-screen modal with `bg-linear-to-br from-slate-900 to-slate-800` + `text-white`. Entirely invisible in light mode (white text on dark gradient that has no light fallback).

| Find | Replace With |
|------|-------------|
| `from-slate-900 to-slate-800` (main gradient) | `from-surface-elevated to-surface-base` |
| `bg-slate-700/50` | `bg-surface-overlay/50` |
| `border-slate-700/50` | `border-border-subtle/50` |
| `text-white` (all body/label instances) | `text-text-primary` |
| `bg-slate-800` | `bg-surface-elevated` |
| `text-slate-300` | `text-text-secondary` |
| `text-slate-400` | `text-text-muted` |

**Floating input bar:** use `bg-surface-overlay` with `border border-border-default`.

---

### 4. `components/RemixStudio.tsx`
**Severity:** CRITICAL  
**Problem:** Hardcoded `from-purple-950 via-slate-950 to-indigo-950` — completely cold, developer-dark, no warmth. Not theme-aware.

Per `DARK_PALETTE.md §6`, we can keep a "warm blackberry plum" vibe:

| Find | Replace With |
|------|-------------|
| `from-purple-950 via-slate-950 to-indigo-950` | `from-[#2A1525] via-surface-base to-[#1E1628]` |
| `bg-slate-900/95` | `bg-surface-elevated/95` |
| `bg-slate-800` | `bg-surface-elevated` |
| `border-slate-700` | `border-border-default` |
| `text-white` (body text) | `text-text-primary` |
| `text-slate-300` | `text-text-secondary` |
| `text-slate-400` | `text-text-muted` |
| `bg-slate-800/50` | `bg-surface-overlay/50` |

---

### 5. `components/StorybookViewer.tsx`
**Severity:** CRITICAL (partially patched in previous session)  
**Problem:** `text-surface` left over from a buggy previous migration. `surface` = `var(--color-surface)` = white in light mode → invisible white-on-white text.

| Find | Replace With |
|------|-------------|
| `text-surface` (all non-bg uses) | `text-text-primary` |
| `bg-surface/10` (navigation elements) | `bg-surface-elevated/10` |
| `bg-surface/20` | `bg-surface-elevated/20` |
| `text-white` (text not on coloured bg) | `text-text-primary` |
| `text-white` (text ON coral/gold bg) | keep as `text-white` |

**Book paper texture exception:** the in-book reading area should retain a slightly warm paper tone:  
- Outer page bg: `bg-surface-elevated` — stays warm  
- In-book text: `text-[#241810]` (dark warm brown) with `bg-[#DACAB2]` (aged parchment tile), per `DARK_PALETTE.md §6`.

---

### 6. `components/SharedBookViewer.tsx`
**Severity:** CRITICAL  
**Problem:** `dark:text-surface` — `dark:` variants are currently dead code (no darkMode config until Phase 2), and `text-surface` = white anyway.

| Find | Replace With |
|------|-------------|
| `dark:text-surface` | Remove entirely — not needed post-Phase 2. |
| Any standalone `text-surface` | `text-text-primary` |
| `text-white` (body text) | `text-text-primary` |

---

## ▓▓ HIGH — Fix before any release ▓▓

---

### 7. `components/BookViewer.tsx`
**Severity:** HIGH

| Find | Replace With |
|------|-------------|
| `bg-surface/10` | `bg-surface-elevated/10` |
| `bg-surface/20` | `bg-surface-elevated/20` |
| `text-white` (navigation bar labels) | `text-text-primary` |
| `text-white` (on coloured button bgs) | keep as `text-white` |

---

### 8. `components/GamificationHub.tsx`
**Severity:** HIGH

| Find | Replace With |
|------|-------------|
| `border-4 border-white` (level badge ring) | `border-4 border-border-brand` |
| `bg-charcoal-soft text-white text-xs` | Keep `bg-charcoal-soft`, change `text-white` → `text-text-inverse` (result is same in dark mode but semantically correct) |

---

### 9. `components/BlueprintReview.tsx`
**Severity:** HIGH

| Find | Replace With |
|------|-------------|
| `bg-cocoa-light text-white opacity-70` | `bg-interactive-default text-text-inverse` |
| `from-emerald-400 to-mint-breeze text-white` | `from-emerald-400 to-mint-breeze text-text-inverse` |

**Note:** `text-text-inverse` in dark mode resolves to `#1C120A` (dark warm, not white) — this ensures contrast on the lightened `mint-breeze` and `emerald` backgrounds.

---

### 10. `components/AudienceSafety.tsx`
**Severity:** HIGH

| Find | Replace With |
|------|-------------|
| `border-slate-700/30` | `border-border-subtle/30` |
| `bg-purple-500/20` | `bg-interactive-default/20` |
| `text-slate-400` | `text-text-muted` |
| `text-white` (reading level badge) | Ensure this is on a coloured bg — if not, change to `text-text-primary` |

---

### 11. `components/Navigation.tsx`
**Severity:** HIGH

| Find | Replace With |
|------|-------------|
| `bg-cream-base/85` (desktop navbar backdrop) | `bg-surface-elevated/85` |
| `bg-cream-base/95` (mobile overlay) | `bg-surface-elevated/95` |
| `bg-surface/50` (pill nav container) | `bg-surface-elevated/50` |

**Also:** Replace the existing dual-state `Sun`/`Moon` toggle button in Navigation.tsx with `<ThemeToggle />` (already created in Phase 2). Import from `'./ThemeToggle'`.

---

### 12. `components/LivingStoryboard.tsx`
**Severity:** HIGH

| Find | Replace With |
|------|-------------|
| `text-slate-200` | `text-text-primary` |
| Any other `text-slate-*` | `text-text-secondary` or `text-text-muted` as appropriate |

---

## ░░ MEDIUM — Fix before public launch ░░

---

### 13. `components/GenerationTheater.tsx`
**Severity:** MEDIUM  
**Problem:** Hardcoded hex in a JavaScript object property, not reachable by Tailwind scanning.

The `gradient` property (likely in a config object or `style={}`) uses `'from-[#FFE8D6] to-[#FFF8DC]'` or similar hardcoded hex values. These stay light in dark mode.

**Fix:** Replace the inline JS string with a dynamic value:
```tsx
// Before
const gradient = 'from-[#FFE8D6] to-[#FFF8DC]';

// After — reads the resolved CSS variable at runtime
const gradient = isDarkMode
  ? 'from-[#1C120A] via-[#2E1F16] to-[#4A3E10]'
  : 'from-[#FFE8D6] to-[#FFF8DC]';
```
Use `const { isDarkMode } = useTheme()` (already imported in most feature components).

---

### 14. `components/AuthPage.tsx`
**Severity:** MEDIUM

The page body background has no dark adaptation. Add to the root container:

| Find | Replace With |
|------|-------------|
| `bg-cream-base` (page wrapper) | `bg-surface-base` |
| `bg-cream-soft` | `bg-surface-base` |
| Icon backgrounds using `from-gold-sunshine to-coral-burst` | Keep — gradient justifies `text-white` on icons. |

---

### 15. `components/PricingPage.tsx`
**Severity:** MEDIUM  
**Problem:** `buttonColor: 'bg-charcoal-soft text-white hover:bg-black'` is hardcoded in a JS data array, unreachable by Tailwind dark variants.

**Fix:** Extend the pricing plan data objects to include a `darkButtonColor` key, or better: use a single semantic class string that adapts via CSS variables:
```tsx
// Replace hardcoded value in plan data
buttonColor: 'bg-interactive-default text-text-inverse hover:bg-interactive-hover',
```
The `interactive-default` token is `#5A5A5A` in light → `#422D1F` in dark. `text-text-inverse` is `#FFFFFF` in light → `#1C120A` in dark.

---

### 16. `components/SettingsPanel.tsx`
**Severity:** MEDIUM

| Find | Replace With |
|------|-------------|
| `text-blue-600` (conditional accent) | `text-status-info-text` |
| `text-purple-600` (conditional accent) | `text-text-brand` |
| `text-coral-burst` | Keep — already a semantic brand token |

---

### 17. `components/SavedBookCard.tsx`
**Severity:** MEDIUM (mostly fine)

| Find | Replace With |
|------|-------------|
| `bg-black/80` (hover overlay) | Keep — semi-transparent overlays over images are inherently dark and don't need adaptation |

No changes strictly required — this is acceptable as-is.

---

## ·· LOW — Polish pass (post-launch) ··

---

### 18. `components/Navigation.tsx` (mobile menu)
**Severity:** LOW

The mobile overlay uses `bg-cream-base/95`. In dark mode, `cream-base` maps to `var(--color-background)` which becomes `#1C120A`. This works correctly but the opacity may need tuning to `bg-surface-elevated/95` for slightly better elevation in dark mode. Test visually before changing.

---

### 19. `components/ui/button.tsx`
**Severity:** LOW (was previously broken but restored via `git restore`)  
**Problem:** Has `dark:bg-white dark:text-black` variants that currently do nothing (no `darkMode: 'class'` was configured). Post-Phase 2, these WILL activate.

**Required audit after Phase 2 goes live:**  
1. Check every variant in `button.tsx` for `dark:` classes.
2. The `dark:bg-white dark:text-black` pattern will now make buttons white in dark mode — they should instead use semantic tokens.

| Find (in variant strings) | Replace With |
|------|-------------|
| `dark:bg-white dark:text-black dark:hover:bg-white/90` | Remove — the default variant button should use `bg-interactive-default text-text-inverse` which adapts via CSS variables. |
| `dark:border-white/20` | Remove — use `border-border-default` |

---

### 20. `components/ui/badge.tsx`
**Severity:** LOW (same issue as button.tsx)  
**Problem:** `dark:bg-white dark:text-black` and `dark:bg-white/10 dark:text-white` will now activate post-Phase 2 and may create legibility surprises.

**Required audit:** Read all badge variants and replace `dark:` overrides with single semantic token classes that work in both modes.

---

### 21. `components/Toast.tsx` / `SparkleCursor.tsx`
**Severity:** LOW  
No changes required for Phase 3. Surface area is minimal. Monitor after Phase 2 deploys.

---

### 22. `components/SmartEditor.tsx`
**Severity:** LOW  
`border border-peach-soft` already adapts via CSS variables — no change needed. Keep as-is.

---

## GLOBAL PATTERNS — DO AFTER ALL ABOVE ARE DONE

### G1. Any remaining `text-white` NOT on a coloured background
Search the entire codebase for `text-white`. For each instance:
- If it is on a background of `coral-burst`, `gold-sunshine`, `charcoal-soft`, or any gradient containing those: **keep as `text-white`**.
- If it is on a dynamic surface (`bg-surface`, `bg-surface-elevated`, `bg-cream-base`, `bg-peach-soft`): **replace with `text-text-primary`**.
- If it is inside an always-dark panel that has been migrated in Phase 3: **replace with `text-text-primary`**.

### G2. Any remaining `text-slate-*`
Replace with `text-text-muted` (for `text-slate-400`/`text-slate-500`) or `text-text-secondary` (for `text-slate-300`). 

### G3. Any remaining `bg-gray-*` outside of status/error contexts
Replace with `bg-surface-elevated` or `bg-surface-base` as appropriate for the element's visual role.

### G4. Brand color text values that do not need changes
The following token usages are CORRECT as-is — do not touch them:
- `text-coral-burst` — semantic brand token, CSS var adapts ✓
- `text-gold-sunshine` — semantic brand token ✓  
- `text-cocoa-light` — CSS var backed, adapts ✓
- `text-charcoal-soft` — CSS var backed, adapts ✓
- `bg-coral-burst` — stays warm in both modes (per DARK_PALETTE.md §2) ✓
- `bg-gold-sunshine` — stays warm ✓

---

## TESTING CHECKLIST FOR EACH COMPONENT

After migrating each component, verify:

- [ ] Component renders without colour conflicts in **light mode** (cream background, dark text)
- [ ] Component renders without colour conflicts in **dark mode** (sepia-dark background, parchment text)
- [ ] All interactive states (hover, focus, disabled) are visible in **both modes**
- [ ] Status indicators (success/error/warning/info) are readable in **both modes**
- [ ] Text contrast meets **WCAG AA** (4.5:1 for body, 3:1 for large/UI elements)
- [ ] No `text-surface` anywhere (that token is a background colour, not a text colour)
- [ ] No `text-white` without a coloured background behind it
