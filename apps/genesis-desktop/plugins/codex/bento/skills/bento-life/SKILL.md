---
name: bento-life
description: Access and manage the user's Bento life-OS data — tasks, habits, mood, focus, journal, notes, sleep, meals, and cross-module intelligence. Full CRUD: create, update, delete, complete, undo across all modules. Triggers: "how is my life", "what's my day look like", "review my week", "spot patterns", "compare periods", "what keeps going wrong", "schedule my day", "log/journal/note/track/sleep/meal".
---

## Setup

Before using this skill, ensure Bento's MCP server is connected:

1. Open Bento Desktop app
2. Go to Settings → Integrations → MCP
3. Copy the connection token
4. Run: `codex mcp add bento --url http://localhost:14872`
5. Set the `x-bento-token` header from the copied token

Verify with: `get_tasks` (should return tasks or empty list).

## Workflows

### Life Overview

```
get_life_context → summary of all active domains
```

If user asks "how is my life going?", start here. Then drill into specific areas.

### Task Management

- `get_tasks` — list tasks (filter by status/project/due date)
- `create_task` — add a new task
- `update_task` — edit title, description, priority, status, due date, project, or tags
- `complete_task` — mark done
- `undo_task` — reopen a completed task (sets status back to 'todo')
- `delete_task` — permanently remove a task + subtasks

### Daily Review

```
get_day_reconstruction(date) → full narrative portrait
```

Includes deterministic narrative about mood, focus, habits, journal, and meals.

### Pattern Discovery

```
get_cross_module_correlations(metric_a, metric_b, period) → Pearson r + anomaly detection
```

Use when user asks about relationships between different life domains.

### Weekly Board Report

```
generate_weekly_board_report(number_of_weeks) → KPI with green/yellow/red vs prior week
```

Use for standup-style weekly summaries.

### Period Comparison

```
get_life_delta(period_a_start, period_a_end, period_b_start, period_b_end) → trajectory
```

Compare any two time periods across 7 dimensions.

### Failure Patterns

```
get_failure_patterns() → clustered abandoned goals + overdue tasks
```

Use when user asks "what keeps going wrong" or "why am I not making progress."

### Commitment Bonds

- `create_commitment_bond` — create a new commitment
- `get_commitment_bonds` — list bonds (filter by status)
- `update_bond_status` — update bond status/check-in

### Habit Tracking

- `create_habit` — add a new habit (name, emoji, frequency: daily/weekly/monthly, kind: build/quit/aspirational, why)
- `update_habit` — change name, emoji, or frequency
- `delete_habit` — remove habit + all completion history
- `log_habit_completion` — log a completion for today (also returns current streak)

### Notes Management

- `save_note` — create a new note with title, content, tags, and icon
- `update_note` — edit title, content, or tags
- `delete_note` — remove a note + its blocks
- `search_notes` — find notes by query (title/content/tags)

### Sleep Log

```
log_sleep(date, hours, quality, notes?) → creates or updates entry for that night
```

Upserts by date — use once per sleep session. Quality score 1–5.

### Meals

```
log_meal(name, meal_type, calories, notes?) → log a meal/snack
```

`meal_type` must be one of: breakfast, lunch, dinner, snack.

### Data Management

- **Create → Update → Delete** pattern across tasks, notes, and habits
- All write tools validate inputs and return meaningful error messages
- DELETE tools cascade related records (subtasks, completions, blocks)
- `log_sleep` uses upsert — safe to call multiple times for same date (last write wins)
- All responses include entity ID, action message, and `data_coverage: 1.0` for confirmation

### Cognitive Schedule

```
get_cognitive_schedule() → peak/avoid windows by day-of-week × hour
```

Use for scheduling advice.

### Journal Entry

```
write_ambient_journal_entry(content, style) → templated journal entry
```

Styles: terse, narrative, analytical.

### Future Projections

```
get_compound_self_projection() → linear regression across 4 dimensions
```

Use for "where am I headed" questions.

### Coding Agent Workflows

#### Daily Standup

```
generate_standup() → formatted summary of yesterday's completed tasks, focus, notes, habits + today's progress
```

Use for standup automation — returns both human-readable prose and structured data (task IDs, focus minutes).

#### Persistent Context

- `save_agent_context(key, value)` — store a developer preference (e.g. coding language, review style, project conventions)
- `get_agent_context(key?)` — retrieve stored preferences (optionally filter by key)

Preferences persist across sessions via tagged notes.

#### Burnout Prevention

```
get_burnout_risk() → risk level + signals + actionable alert
```

Analyzes mood trend (14d), sleep debt, focus decline, and task accumulation. Returns one of: low/mild/moderate/high. Use before assigning intensive work.

## Data Model Notes

- All timestamps are in milliseconds since epoch (i64)
- `data_coverage` field (0.0–1.0) indicates how much data exists for the period
- Tools always return partial data rather than erroring on empty state
