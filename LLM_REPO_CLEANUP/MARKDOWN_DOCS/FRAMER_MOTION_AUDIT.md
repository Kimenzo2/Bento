# Framer Motion Audit — Genesis

**Total files using Framer Motion:** 49
**Bundle impact:** ~127 KB minified (vendor-motion chunk)

---

## Group A — Complex Animations (Justified — Keep)

These files use features that CSS cannot replicate: gesture physics, shared layout animations, scroll-linked transforms, drag-and-drop with PanInfo, staggered orchestration, or useInView for intersection-based triggering.

| # | File | Features Used |
|---|------|---------------|
| 1 | `hooks/useSwipeGesture.tsx` | `drag="x"`, `PanInfo`, `whileDrag` — gesture physics |
| 2 | `pages/LandingPage.tsx` | `useInView`, `staggerChildren`, `AnimatePresence` — scroll-triggered stagger |
| 3 | `components/CreationCanvas.tsx` | `staggerChildren`, `delayChildren` — orchestrated reveal |
| 4 | `components/collaboration/BroadcastStudio.tsx` | `layoutId` — shared layout tab animation |
| 5 | `components/tiers/interactive/FeatureVideoStories.tsx` | `layoutId` — shared layout story transitions |
| 6 | `components/onboarding/performance/optimizedMotion.tsx` | `Variants`, `MotionProps`, stagger utilities — motion abstraction layer |
| 7 | `components/onboarding/OnboardingLayout.tsx` | `AnimatePresence`, `Transition` type — page transition orchestration |
| 8 | `components/SkeletonLoaders.tsx` | `Transition` type — custom skeleton pulse |

**Count: 8 files**

---

## Group B — Simple Animations (CSS Could Handle)

These files use only `motion.div` with `initial`/`animate`/`exit` for simple opacity, y-translate, or scale transitions. No gesture handling, no layout animations, no scroll-linking. Pure CSS `@keyframes` + `transition` could replicate these.

| # | File | Pattern |
|---|------|---------|
| 1 | `components/AccountPage.tsx` | Fade-in sections |
| 2 | `components/AudioPlayer.tsx` | AnimatePresence fade toggle |
| 3 | `components/AudienceSafety.tsx` | AnimatePresence panel toggle |
| 4 | `components/billing/UpgradePrompt.tsx` | AnimatePresence modal |
| 5 | `components/BookSharing.tsx` | AnimatePresence panel |
| 6 | `components/BookSuccessView.tsx` | Fade/slide entrance |
| 7 | `components/BulkActions.tsx` | AnimatePresence toolbar |
| 8 | `components/CharacterDepthPanel.tsx` | AnimatePresence panel |
| 9 | `components/collaboration/NotificationCenter.tsx` | AnimatePresence notification list |
| 10 | `components/ConversationMode.tsx` | AnimatePresence chat bubbles |
| 11 | `components/EmotionalArc.tsx` | Fade-in chart |
| 12 | `components/ExportModal.tsx` | Modal fade |
| 13 | `components/GenerationTheater.tsx` | AnimatePresence step transitions |
| 14 | `components/GreenRoom.tsx` | AnimatePresence panels |
| 15 | `components/InteractiveCharacterTutor.tsx` | AnimatePresence step panels |
| 16 | `components/KeyboardShortcutsModal.tsx` | Modal fade |
| 17 | `components/LivingStoryboard.tsx` | Fade-in cards |
| 18 | `components/OfflineIndicator.tsx` | AnimatePresence banner |
| 19 | `components/onboarding/CreativePersonaQuiz.tsx` | AnimatePresence quiz steps |
| 20 | `components/onboarding/FeatureStorybook.tsx` | AnimatePresence story pages |
| 21 | `components/onboarding/InstantCreationDemo.tsx` | AnimatePresence demo steps |
| 22 | `components/onboarding/OnboardingHeader.tsx` | Fade-in header |
| 23 | `components/onboarding/OnboardingPricing.tsx` | Fade-in pricing cards |
| 24 | `components/onboarding/PersonalizationQuiz.tsx` | AnimatePresence quiz steps |
| 25 | `components/onboarding/ProRevealMoment.tsx` | AnimatePresence reveal |
| 26 | `components/onboarding/WelcomeSuccess.tsx` | Fade-in success |
| 27 | `components/RemixStudio.tsx` | AnimatePresence panels |
| 28 | `components/SavedBookCard.tsx` | Hover scale |
| 29 | `components/StoryMap.tsx` | Fade-in nodes |
| 30 | `components/StorybookViewer.tsx` | AnimatePresence page turns |
| 31 | `components/StylePresets.tsx` | AnimatePresence panel |
| 32 | `components/TemplateLibrary.tsx` | AnimatePresence grid |
| 33 | `components/tiers/interactive/DayInLifeTimeline.tsx` | Fade-in timeline items |
| 34 | `components/tiers/interactive/FeatureExplorer.tsx` | AnimatePresence feature panels |
| 35 | `components/tiers/interactive/MigrationAssistant.tsx` | AnimatePresence wizard steps |
| 36 | `components/tiers/interactive/SavingsCounter.tsx` | Number animation |
| 37 | `components/tiers/interactive/TierMatchQuiz.tsx` | AnimatePresence quiz steps |
| 38 | `components/tiers/interactive/UsageHeatmap.tsx` | AnimatePresence tooltip |
| 39 | `components/WhatsNewModal.tsx` | Modal fade |
| 40 | `hooks/useAutoSave.tsx` | AnimatePresence save indicator |
| 41 | `hooks/useNetworkStatus.tsx` | AnimatePresence status banner |

**Count: 41 files**

---

## Group C — Unused Imports (Removed)

No files were found with completely unused framer-motion imports. All 49 files that import from framer-motion use at least one `motion.*` component or `AnimatePresence` in their JSX.

**Count: 0 files**

---

## Bundle Impact Assessment

Framer Motion is **partially justified** for this codebase.

- **8 files (16%)** use complex features that genuinely require Framer Motion (gestures, shared layout, scroll-linked, orchestration)
- **41 files (84%)** use only simple fade/slide/scale that CSS transitions and `@keyframes` handle natively
- The `vendor-motion` chunk is **127 KB minified** — this is shipped to every user regardless of which page they visit

### Recommendation for Future Refactor

A future migration could replace the 41 Group B usages with CSS transitions + a small `<AnimatePresence>`-equivalent (or the native View Transitions API), then tree-shake Framer Motion to only the 8 files that genuinely need it. This would eliminate ~100 KB from the critical bundle path.

**Do NOT remove Framer Motion now.** The 8 Group A usages are deeply embedded and justify keeping the library. This report is informational only.
