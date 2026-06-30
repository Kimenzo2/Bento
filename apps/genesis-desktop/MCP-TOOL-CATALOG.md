# Bento MCP — Full Tool Catalog & Coding-Agent Sweet-Spot Research Brief

## Overview

Bento is a personal life-OS desktop app (Tauri + Svelte + SQLite) embedding an MCP server at `http://localhost:14872`. It exposes the user's entire life data — tasks, habits, mood, focus, journal, sleep, notes, goals, meals, budget, health events — as typed, schema-bearing MCP tools. Any MCP-compatible agent (Codex CLI, Claude Code, Cursor, Cline, Continue.dev) can connect and operate on the user's personal data.

**28 tools total.** All timestamps in epoch ms. Empty states return partial data, never errors. First 512 chars of server instructions are self-contained for Codex init.

---

## TOOL CATALOG

### Tier 0 — Core CRUD (7 tools)

These are the read/write primitives. Every other tool composes these.

| Tool                | Description                                                      | Use Case                                  |
| ------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| `create_task`       | Create task with title, due_at, priority (low/med/high), project | "Add a task to review PR by Friday"       |
| `get_tasks`         | List tasks with filters (status, due_before, project, limit)     | "What's pending in the 'launch' project?" |
| `complete_task`     | Mark task done by ID                                             | "Mark design-review as complete"          |
| `save_note`         | Create note with title, content (markdown), optional tags        | "Save these meeting notes"                |
| `search_notes`      | Search notes by keyword (LIKE %query%)                           | "Find my notes about database migrations" |
| `log_focus_session` | Log a focus/flow session (duration, description, type)           | "Log 25m pomodoro on frontend refactor"   |
| `log_mood`          | Log mood 1-5 with optional note and activities                   | "Log mood 4 after standup went well"      |

### Tier 0 — Habits & Daily (2 tools)

| Tool                   | Description                                           | Use Case                          |
| ---------------------- | ----------------------------------------------------- | --------------------------------- |
| `log_habit_completion` | Mark habit done by name (fuzzy match)                 | "Log that I meditated today"      |
| `get_daily_summary`    | Aggregate today's tasks, focus, habits, mood, journal | Morning briefing / evening review |

### Tier 0 — Journal (1 tool)

| Tool                   | Description                                                     | Use Case                             |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------ |
| `create_journal_entry` | Upsert daily journal entry with markdown blocks + optional mood | "Journal about today's sprint retro" |

---

### Tier 1 — Life Intelligence (9 tools — cross-module synthesis)

These are the high-leverage tools. Each queries 3-12 tables and returns synthesized insight.

| #   | Tool                            | What It Does                                                                                                                                                                                                        | Tables Queried                                                                                                                                    |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `get_life_context`              | Unified "right now" snapshot: mood, energy (inferred or manual), active focus session, sleep last night, today's tasks/habits/calories/journal, weekly goals/mood/sleep/budget, pressure signals, cognitive load    | tasks, habits, habit_completions, health_events, mood_checkins, sleep_logs, meals, journal_entries, goals, budget_transactions, budget_categories |
| 2   | `get_cross_module_correlations` | Pearson r between any two metrics (sleep, mood, focus, calories, spending, tasks, habits, energy) over N days. Returns coefficient, strength, direction, top 5 correlated days, + anomaly detection (>1.5σ)         | sleep_logs, mood_checkins, health_events, meals, budget_transactions, tasks, habit_completions                                                    |
| 3   | `get_day_reconstruction`        | Full-resolution portrait of any past date: mood, sleep, all meals, focus sessions, tasks (completed/created/overdue), habits (done/missed), journal, budget, notes, goal events + deterministic narrative summary   | mood_checkins, sleep_logs, meals, health_events, tasks, habits, habit_completions, journal_entries, budget_transactions, note_objects, goals      |
| 4   | `get_life_delta`                | Compare two periods (A vs B) across 7 dimensions: sleep, mood, focus (avg + total), habit consistency, tasks/day, spending. Returns deltas, direction, significance, trajectory (ascending/descending/stable/mixed) | sleep_logs, mood_checkins, health_events, habit_completions, tasks, budget_transactions                                                           |
| 5   | `get_cognitive_schedule`        | Find peak performance windows by day-of-week × hour. Composite score = 60% focus duration + 40% normalized mood. Returns top 3 peak windows, bottom 3 avoid windows, best/worst day, insight                        | health_events, mood_checkins                                                                                                                      |
| 6   | `get_failure_patterns`          | Analyze abandoned goals, chronically overdue tasks for failure signatures. Computes avg time-to-abandonment, stagnation progress level, avg overdue days. Returns patterns with trigger signals + recommendations   | goals, tasks                                                                                                                                      |
| 7   | `generate_weekly_board_report`  | Board-meeting-style KPI review across 6 modules with green/yellow/red vs prior week. Includes wins, risks, decisions needed, next-week forecast                                                                     | tasks, habit_completions, health_events, budget_transactions, mood_checkins, sleep_logs, goals                                                    |
| 8   | `get_compound_self_projection`  | Linear regression projections forward for focus, mood, sleep, savings, tasks. Returns projected values, inflection points, headline, biggest leverage point                                                         | health_events, mood_checkins, sleep_logs, budget_transactions, tasks                                                                              |
| 9   | `write_ambient_journal_entry`   | Deterministic prose engine (no LLM) generates a narrative entry from the day's raw data. 3 styles: terse, narrative, analytical. Stores to journal table (upsert by date)                                           | mood_checkins, sleep_logs, health_events, tasks, habit_completions, meals, budget_transactions                                                    |

### Tier 1 — Commitment Bonds (3 tools)

| Tool                     | Description                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `create_commitment_bond` | Create accountability contract: title, deadline, success_metric, consequence, check_in_days, optional goal_id  |
| `get_commitment_bonds`   | List bonds with optional status filter. Returns title, deadline, metric, consequence, status, check_in_history |
| `update_bond_status`     | Update status (active/kept/broken/extended) with optional check-in note appended to history                    |

---

### Tier 2 — New Intelligence Tools (6 tools — just shipped)

| #   | Tool                         | Description                                                                                                                                                                                                                                 | Tables Queried                                                                |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 10  | `get_meal_mood_correlations` | Time-lagged food→mood→focus analysis. For each meal (by name+type), finds mood/focus entries within configurable lag window (default 4h). Returns ranked "best pre-focus foods" by subsequent wellness score                                | meals, mood_checkins, health_events                                           |
| 11  | `get_integrity_score`        | Scans journal entries for 6 value domains (discipline, health, growth, financial, focus, connection) via keyword extraction. Cross-refs against actual actions. Returns per-domain alignment + overall integrity %                          | journal_entries, tasks, habit_completions, health_events, budget_transactions |
| 12  | `get_attention_allocation`   | Categorizes all tasks + focus sessions into strategic vs reactive via keyword heuristics (bug/fix/urgent/asap/reply/email/meeting = reactive; roadmap/strategy/long-term/goal = strategic). Returns % split + rebalancing advice            | tasks, health_events                                                          |
| 13  | `generate_sprint_plan`       | Historical task velocity by day-of-week × pending backlog → recommended capacity. Returns best/worst days, weeks-to-clear estimate, plain-language commitment recommendation                                                                | tasks                                                                         |
| 14  | `auto_schedule_tasks`        | Maps pending tasks (sorted by priority: high→medium→low) to cognitive schedule peak/avoid windows. Hard tasks → peak hours, easy tasks → avoid hours. Returns day×hour schedule for every pending task                                      | tasks, health_events, mood_checkins (via cognitive_schedule)                  |
| 15  | `get_skill_velocity`         | Finds notes tagged with learning keywords (learning, study, course, skill, book, tutorial, practice, training), groups by month. Returns monthly production, total words, velocity trend (accelerating/steady/declining), top skill domains | note_objects                                                                  |

---

## CODING-AGENT SWEET SPOT — RESEARCH BRIEF

**Target:** Codex CLI, Claude Code, Cursor — the three AI coding agents developers actually use.

### Why Bento Is Different From Every Other MCP Server

Every other MCP server is a CRUD wrapper around a SaaS API (Jira, Linear, Notion, GitHub, Gmail). Bento is different: it's the user's _actual life data_ — not their work tools, but their cognition, energy, habits, goals, mood, focus, sleep, meals, spending, journal. A coding agent connected to Bento becomes **context-aware** in a way no other coding tool can match:

| Capability                                                               | How Bento Enables It                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| The agent knows your energy level before suggesting a complex refactor   | `get_life_context` → energy_score + cognitive_load                  |
| The agent schedules code reviews during your peak focus windows          | `auto_schedule_tasks` + `get_cognitive_schedule`                    |
| The agent adjusts code comment verbosity based on your mood              | `get_life_context` → mood                                           |
| The agent refuses to commit to a sprint you can't deliver                | `generate_sprint_plan` → realistic capacity                         |
| The agent correlates sleep quality with production bug rate              | `get_cross_module_correlations` (sleep_hours vs tasks with bug tag) |
| The agent tracks how your learning velocity maps to actual shipped code  | `get_skill_velocity` + `get_tasks`                                  |
| The agent knows when you're burning out before you do                    | `get_life_context` → cognitive_load + pressure_signals              |
| The agent writes your standup from your actual data, not your memory     | `get_daily_summary` + `get_focus_sessions`                          |
| The agent knows what you ate before your best coding sessions            | `get_meal_mood_correlations`                                        |
| The agent measures whether your stated values match your code priorities | `get_integrity_score`                                               |

### Easiest Integration Points

These require zero Bento-side changes. A coding agent just calls these MCP tools before/after code operations:

1. **`get_life_context`** — call before every agent interaction → agent calibrates tone, depth, ambition
2. **`get_cognitive_schedule`** — before planning work → schedule deep work in proven windows
3. **`generate_sprint_plan`** — before sprint commitment → realistic capacity
4. **`get_attention_allocation`** — weekly → rebalance reactive vs strategic coding
5. **`auto_schedule_tasks`** — daily → get your optimized schedule
6. **`get_integrity_score`** — weekly → does your code output match your stated priorities
7. **`get_meal_mood_correlations`** — when user reports low energy → find nutritional patterns
8. **`get_skill_velocity`** — after learning sessions → track acquisition rate

### Natural Extensions (What an Agent Could Build on Top)

The coding agent can compose these tools into higher-order behaviors:

- **"Pulse-check before code review"**: Agent calls `get_life_context` → if cognitive_load is "critical" → suggests postponing or gives a lighter review
- **"Sprint autopilot"**: Agent calls `generate_sprint_plan` + `auto_schedule_tasks` → creates day-by-day coding schedule synced to user's energy windows
- **"Learning loop detector"**: Agent calls `get_skill_velocity` + `get_tasks` → discovers "you read 3 Rust books but shipped 0 Rust PRs"
- **"Burnout guardian"**: Agent monitors `get_life_context` pressure_signals + cognitive_load weekly → alerts on trend toward critical
- **"Posture-aware commit messages"**: Agent calls `get_mood` before writing commit message → bright mood gets creative messages, low mood gets disciplined one-liners

---

## RESEARCH INSTRUCTIONS — CRITIQUE LOOP

**You are now entering a critique loop.** The goal is NOT to generate ideas. The goal is to DESTROY the ideas that survive, then rebuild them stronger.

### Phase 1: Research (X + Reddit — deep, not wide)

- Search X for: `"MCP server" + "coding agent"`, `"Cursor" + "context-aware"`, `"Claude Code" + "MCP"`, `"Codex CLI" + "personal"`, agent workflows, AI productivity
- Search Reddit for: r/cursor, r/ClaudeAI, r/codex, r/MCP — find posts about "what I wish my coding agent knew about me"
- Find the 5 most viral posts about AI coding agents that users wished were context-aware
- Find the 3 most common COMPLAINTS about current coding agents (over-commit, wrong tone, bad scheduling, no self-awareness)
- Search for "life OS" + "developer" — what do devs track about themselves
- Search for "developer burnout" + "productivity data" — what data could prevent burnout
- Search for competitors: Watchman, Rewind AI, Screenpipe, Timely — what do they do that Bento should do better

### Phase 2: Brutal Filter (kill the weak)

For every use case you find, ask:

- **"Is this actually useful or just cool?"** — If it wouldn't make a developer's life measurably better in a single week, kill it.
- **"Would someone screenshot this and post it?"** — Viral potential is a forcing function for quality.
- **"Does this require Bento data specifically, or could it be done with generic telemetry?"** — If generic, it's not our moat. Kill it.
- **"Is the UX path less than 3 steps?"** — If a developer has to configure or learn more than 3 things, they won't use it.
- **"Does the output make the developer feel seen or attacked?"** — The best outputs make people feel understood. The worst feel like surveillance. We want the former.

### Phase 3: Output Format

For each surviving use case, produce:

```markdown
## Use Case: [Name]

**One-liner:** What happens in 10 words

**The Bento data it needs:** Which specific tools/tables

**The Codex UX:** Exactly what the developer sees / experiences

**Why it's not surveillance:** The framing that makes it feel helpful, not creepy

**Viral angle:** Why someone would tweet this

**Implementation complexity:** Simple (composes existing tools) / Medium (needs new tool, 1-2 days) / Hard (needs new infra)

**Known failures:** What could make this feel like slop
```

### Phase 4: Go Full Mode

Do not stop after N use cases. Stop when you've exhausted X and Reddit for the coding-agent-Bento sweet spot. This is the only area we care about. Every other use case category is noise. Go until you have 20+ surviving use cases, then rank them by:

1. Ease of implementation (can we ship this week?)
2. Emotional impact (will someone tweet this?)
3. Differentiation (could anyone else build this?)
4. Stickiness (will a developer change their workflow for this?)

**UX IS FIRST.** If the output isn't beautiful, concise, and immediately useful, it's slop. Every use case must pass the "would I show this to a designer" test.

**X and Reddit are your sources.** Not blogs. Not docs. Not newsletters. The signal is in what people are complaining about and what they're sharing.

Go.
