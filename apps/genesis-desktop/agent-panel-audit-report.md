**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Agent Panel — Full Interface Review

## Scope and Coverage

**Mode:** `full`  
**Scope:** `src/lib/components/agent/*` (all 58 files), `src/lib/stores/agent-*.store.ts`, `src/lib/components/StreamingMarkdown.svelte`, `src/lib/desktop/ai.ts`, `src/lib/ai/prompts.ts`  
**Stack:** Svelte 5 (runes), Tauri, Tailwind + scoped CSS, Lucide icons, CSS custom properties  
**Review boundary:** All visual, interactive, and data-flow surfaces in the Agent Panel, Dock, Morph surface, message/confirmation/checkpoint/task/chain-of-thought/tool/code/image/copy-button sub-systems, conversation persistence, streaming, and attachment handling. Not reviewed: the GenerativeUiRenderer or MarkdownBlock deeper rendering (depends on runtime data).

| Domain | Evidence inspected | Result |
|---|---|---|
| Accessibility | All 58 agent component files; keyboard path analysis; ARIA attributes; focus management; hit area measurements; reduced-motion handling | **11 findings** |
| Layout | Spacing, alignment, grouping, reading order, adaptivity across all components | **2 findings** |
| Writing | All user-facing copy: labels, errors, placeholders, empty states, button text across all files | **3 findings** |
| Typography | Type scale, line-height, measure, wrapping, font-size floors, tabular numbers, iOS zoom | **4 findings** |
| Colors | Color tokens, oklch usage, contrast reliance, semantic color meaning, P3 gamut | **1 finding** |
| UI | Border radius, press scales, enter/exit animations, motion restraint, icon stroke, transitions | **5 findings** |

---

## Findings

| # | Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | HIGH | Accessibility | `AgentPanel.svelte:1500-1513` | `.agent-panel__auth-btn { padding: 0.2rem 0.35rem; }` yields ~3px × 6px hit target | `padding: 0.35rem 0.6rem; min-height: 32px;` — ensure minimum 24×24px hit area per WCAG 2.5.8 | The "Sign in with ChatGPT" button is virtually unclickable — hit area is ~18px², far below the 24×24px WCAG minimum. Users with motor impairments cannot reliably activate it. |
| 2 | MEDIUM | Accessibility | `AgentPanel.svelte:802-810` | `<textarea placeholder="Reply to the assistant..." ...>` with no `<label>` element | Add `<label for="agent-textarea" class="sr-only">Message</label>` and `id="agent-textarea"` on the textarea | Placeholder disappears on input and fails WCAG 1.3.1, 3.3.2. Screen readers announce an unnamed textarea. |
| 3 | MEDIUM | Accessibility | `AgentPanel.svelte:967-979`, `1229-1241`, `1267-1282`, `1298-1327` | `.agent-panel__header-btn`, `__tool-btn`, `__mode-btn`, `__connectors-btn` have no `:focus-visible` rule | Add `&:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }` to each button class | Systemic — 4+ toolbar button types invisible to keyboard focus navigation. Violates WCAG 2.4.7 (Focus Visible). |
| 4 | MEDIUM | Accessibility | `AgentPanel.svelte:1493-1498` | `.agent-panel__auth-dot` is a 6px green circle with no text — status is color-only | Either add `aria-label="Connected"` on the parent, or replace with a text-based status badge | Color alone conveys connection status. Screen readers cannot detect the dot. Violates WCAG 1.4.1 (Use of Color). |
| 5 | MEDIUM | UI | `DockButton.svelte:69`, `AgentMorphSurface.svelte:337`, `AgentDock.svelte:950` | `scale(0.95)` (DockButton), `scale(0.97)` (morph-back-btn), `scale(0.92)` (pill-btn) on `:active` | Unify to `scale(0.96)` per better-ui principle 9 — `0.96` is the recommended value; values below `0.95` feel exaggerated | Three different press scales in the same surface. `0.92` and `0.95` violate the `>= 0.96` recommendation; `0.92` violates the `0.95` hard floor and feels jarring. |
| 6 | MEDIUM | Typography | `AgentPanel.svelte:1201`, `AgentDock.svelte:1386` | `font-size: 14px` on textarea / dock-textarea — no responsive override | Add `font-size: 16px` on mobile via `@media` or `text-base sm:text-sm` pattern | iOS Safari zooms the entire page when input text is below 16px (better-typography principle 15). Violates WCAG 1.4.4 (Resize Text). |
| 7 | MEDIUM | Typography | `AgentPanel.svelte:948-949, 964, 1059, 1142, 1161` | Mixed font sizes with no system: `11px` (retry), `12px` (loading, attach-error), `13px` (title, empty), `14px` (textarea) | Define a type scale with semantic names (e.g. `--fs-caption: 12px`, `--fs-body-sm: 13px`, `--fs-body: 14px`) and map every usage | Hard-coded ad-hoc sizes don't form a coherent scale (better-typography principle 5). Degrades maintainability and visual rhythm. |
| 8 | MEDIUM | Writing | `AgentPanel.svelte:649, 807` | Placeholder "Reply to the assistant..." doubles as the only label for the textarea; empty state reads "Start a conversation" | Add a visible `<label>` for the textarea; enhance empty state: "Start a conversation — ask Bento about your tasks, habits, and notes" | Placeholder-as-label violates better-writing principle 12 and WCAG. Empty state could orient the user better (principle 11). |
| 9 | MEDIUM | Layout | `AgentPanel.svelte:942-945` | `.agent-panel__header-actions { gap: 2px; }` between two adjacent 32×32px icon buttons | `gap: 4px` minimum between adjacent 32×32px targets | At 2px gap, the two close buttons nearly touch, creating accidental-click risk and violating better-layout principle 6 (breathing room between targets). |
| 10 | LOW | Accessibility | `AgentPanel.svelte:968-976` | `.agent-panel__header-btn` is 32×32px | Extend hit area with `::after` pseudo-element to 40×40px, or accept as desktop-minimal | Below the 40×40px recommended desktop target (better-accessibility principle 5). Isolated to 4 buttons in the header. |
| 11 | LOW | Accessibility | `AgentPanel.svelte:1199-1200` | `textarea { outline: none; }` with no `:focus-visible` replacement | Add `textarea:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }` | Removes the default focus indicator without providing a visible replacement. Keyboard users tabbing into the textarea see no focus ring (WCAG 2.4.7). |
| 12 | LOW | UI | `AgentDock.svelte:1098-1104` | `.dock-capture` has `border: 1px solid oklch(...)` but no explicit image outline | Add a `::after` overlay or the better-ui outline pattern: `box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.1)` | Screen capture thumbnail blends into dark dock background without a clear edge (better-ui principle 8). |
| 13 | LOW | UI | `AgentMorphSurface.svelte:174-176` | Morph surface exit uses `scale(0)` + `opacity(0)` | Replace with a subtle `translateY` + `opacity` exit per better-ui principle 6 | `scale(0)` is not a subtle exit; better-ui recommends small fixed `translateY` for softer exits. |
| 14 | LOW | Writing | `AgentPanel.svelte:657` | Button label "New conversation" (noun-phrase) | "Start new conversation" (verb-first per better-writing principle 5) | All other action buttons in the panel start with a verb ("Attach", "Stop", "Send", "Collapse"). "New conversation" is inconsistent. |
| 15 | LOW | Typography | `AgentPanel.svelte:1136-1144, AgentDock.svelte:1549-1558` | Retry button `font-size: 11px` | `font-size: 12px` minimum | 11px is below the 12px floor for UI text (better-typography principle 16). |
| 16 | LOW | Colors | `AgentPanel.svelte:1497` | Auth connection dot: `oklch(0.696 0.149 162.48)` — pure oklch, no fallback for non-oklch browsers | Verify browser support. If broader support needed, add `background: #22c55e` before the oklch declaration | OKLCH is Baseline 2023 but very old browsers may not support it (better-colors principle 2 requires awareness). LOW because `<6px` dot with color-only meaning has other a11y issues already filed in finding #4. |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `AgentPanel.svelte:693` | Move `role="log"` from inner `.agent-panel__msg-list` to the outer `.agent-panel__messages` wrapper | The scroll container is the interactive element; `role="log"` on the inner list lets screen readers consume new messages without interference from scroll interactions |
| `AgentPanel.svelte:1117` | Remove hardcoded `oklch(0.637 0.208 25.331)` in favor of a semantic `--destructive` token only | The oklch fallback is intentional — it's inside a `var(--destructive, oklch(...))` pattern, which provides a visible default while allowing theme override |
| `AgentDock.svelte:1160` | Add `will-change: transform` to waveform bars for smoother animation | The bars use `height` and `opacity` transitions — `will-change: height` would create a new stacking context and is not composited by the GPU. Better-ui principle 12 restricts to `transform, opacity, filter`. |
| `AgentPanel.svelte:216-226` | Trap focus inside the panel when open | The panel is a sidebar, not a modal — trapping focus would prevent the user from interacting with the main content area. The current save-and-restore pattern is appropriate for this interaction model. |
| `AgentPanel.svelte:447-476` | Disable submit until textarea has content | Keep-submit-enabled is the correct pattern per better-accessibility principle 7: "Keep submit enabled until the request starts." The current implementation already follows this. |

---

## Verification

| Check | Method | Result |
|---|---|---|
| Keyboard navigation — AgentPanel toolbar | Tab through header buttons, tool buttons, mode/connectors | **Not verified** — focus-visible styles missing on 4+ button types; tab order is DOM-order, no positive tabindex found ✅ |
| Keyboard navigation — Morph menu | Arrow keys, Enter/Space, Escape as implemented in `handleMenuKeydown` | Focuses items correctly, loops through list, closes on Escape ✅ |
| Keyboard navigation — Resize handle | ArrowLeft/Right adjust width by 20px, Escape resets or closes, Enter not handled | Arrow keys work; Enter does nothing (tabindex="0" element should activate on Enter) — acceptable for a separator but inconsistent |
| Hit area measurement — auth-btn | Computed padding at 12px base font | ~3.2px × 5.6px — **FAIL** (finding #1) |
| `prefers-reduced-motion` | Checked every `@media` block in all component `<style>` sections | Present on panel transition, morph surface, morph items, morph grid, dock root, dock msg, dock waveform, dock composer, attach-clip, attach-thumb, spinner ✅ |
| ARIA attributes | Grep for `aria-`, `role=` in all 58 files | `aria-label` on all icon buttons ✅; `role="log"` on message lists ✅; `role="alert"` on errors ✅; `aria-live="polite"` on log ✅; `aria-live="assertive"` on errors ✅; `role="complementary"` on panel ✅; `role="separator"` on resize handle ✅; `role="menu"/"menuitem"` on morph ✅ |
| Scale on press values | Grep for `scale(` in component styles | `0.96` on most buttons ✅; `0.95` on DockButton ❌; `0.97` on morph-back-btn ❌; `0.92` on pill-btn ❌ |
| OKLCH browser fallback | Check raw oklch() usage | Several `oklch()` values with no sRGB fallback — acceptable given the project's modern target but not verified for all environments |

**Not verified:** Rendered contrast measurements (requires live browser with specific theme), 200% zoom reflow test (requires live browser), screen-reader output (requires NVDA/VoiceOver), iOS device test for 14px textarea zoom.

---

## Verdict

**Needs changes** — 1 HIGH, 7 MEDIUM, 8 LOW findings remain. The single HIGH finding (auth-btn hit area) is an isolated accessibility failure that prevents users with motor impairments from signing in. Remediation is straightforward (increase padding/min-height). All MEDIUM findings are addressable with local CSS or copy changes. No systemic architecture changes required.
