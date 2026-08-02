**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Mini-App UI Rebuild Directive

Saved from the owner prompt on 2026-05-09.

## Non-Negotiable Rules

- Do not build the 21 mini-apps from one shared wrapper with swapped text.
- Do not import shared UI components from `$lib/components/ui` inside mini-app module roots.
- Each mini-app must have its own folder, its own `App.svelte`, and its own stylesheet.
- Each mini-app owns its colors, radius, typography scale, card language, and layout structure.
- Mock data must be realistic and domain-specific.
- Charts must use a real charting library where charts are present. `chart.js` is the desktop dependency.
- Hover states, active transitions, and dashboard entrance animation are expected.

## Reference Mapping

1. `tasks`: Donezo green dashboard.
2. `notes`: Weihu kanban board adapted for notes.
3. `habits`: FitSpark dark lime habit dashboard.
4. `focus`: Crextio warm yellow focus/timer dashboard.
5. `health`: FitSpark dark health dashboard.
6. `budget`: Financial white/coral dashboard.
7. `journal`: Personal lavender journal dashboard.
8. `flashcards`: Cr. cyan learning dashboard.
9. `reading`: Lunio red reading/media dashboard.
10. `goals`: Make.com off-white and lime goal dashboard.
11. `time`: Crextio time tracker dashboard.
12. `calendar`: Cr. calendar planner dashboard.
13. `passwords`: Haulix dark vault dashboard.
14. `clipboard`: Codename minimal clipboard manager.
15. `voice-memos`: Sooma lavender audio dashboard.
16. `mood`: Personal lavender mood tracker.
17. `grocery`: Teknova green commerce dashboard adapted for shopping.
18. `recipes`: Orgelux dark gold recipe manager.
19. `nutrition`: FitSpark water/nutrition tracker.
20. `countdown`: Sooma lavender countdown/events dashboard.
21. `telemetry`: Haulix dark system health dashboard.

## Completion Gate

Every app must open through the top-center launcher and render a distinct module root. If two apps still look like the same skeleton with swapped copy, both need rebuilding.
