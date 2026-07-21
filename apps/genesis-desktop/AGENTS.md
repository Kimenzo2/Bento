# Bento Desktop

Personal life-OS (Tauri + Svelte + SQLite). MCP server at `http://localhost:14872`.

## Connect

```
codex mcp add bento --url http://localhost:14872
```

Then get the token from Settings → Integrations → MCP and set it as the `x-bento-token` header.

## Build & Dev

| Command                       | Description                 |
| ----------------------------- | --------------------------- |
| `cargo tauri dev`             | Desktop app with hot reload |
| `cargo check` (in src-tauri/) | Rust compilation check      |
| `cargo test` (in src-tauri/)  | Run Rust tests              |
| `npm run dev`                 | Svelte frontend dev server  |

## Tools

| Category     | Tools                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tasks        | `create_task`, `get_tasks`, `update_task`, `complete_task`, `undo_task`, `delete_task`                                                                                                                                                                                                                                                                                                                                                                                         |
| Notes        | `save_note`, `update_note`, `delete_note`, `search_notes`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Habits       | `create_habit`, `update_habit`, `delete_habit`, `log_habit_completion`                                                                                                                                                                                                                                                                                                                                                                                                         |
| Mood         | `log_mood`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Focus        | `log_focus_session`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sleep        | `log_sleep` (upsert by date)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Meals        | `log_meal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Daily        | `get_daily_summary`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Intelligence | `get_life_context`, `get_cross_module_correlations`, `get_day_reconstruction`, `get_life_delta`, `get_cognitive_schedule`, `create_commitment_bond`, `get_commitment_bonds`, `update_bond_status`, `get_failure_patterns`, `generate_weekly_board_report`, `get_compound_self_projection`, `write_ambient_journal_entry`, `get_meal_mood_correlations`, `get_integrity_score`, `get_attention_allocation`, `generate_sprint_plan`, `auto_schedule_tasks`, `get_skill_velocity` |
| Coding Agent | `generate_standup`, `save_agent_context`, `get_agent_context`, `get_burnout_risk`                                                                                                                                                                                                                                                                                                                                                                                              |

## Workflows

- **Life overview**: `get_life_context` → drill into modules
- **Patterns**: `get_cross_module_correlations` (Pearson r)
- **Daily review**: `get_day_reconstruction` (narrative portrait)
- **Weekly**: `generate_weekly_board_report` (KPI green/yellow/red)
- **Failures**: `get_failure_patterns` (abandoned goals + overdue)
- **Forecast**: `get_compound_self_projection` (linear regression)
- **Compare**: `get_life_delta` (period A vs B)
- **Food & focus**: `get_meal_mood_correlations` (time-lagged)
- **Values audit**: `get_integrity_score` (journal vs actions)
- **Portfolio**: `get_attention_allocation` (strategic vs reactive)
- **Sprint**: `generate_sprint_plan` (velocity + backlog)
- **Schedule**: `auto_schedule_tasks` (energy-aware time blocks)
- **Learning**: `get_skill_velocity` (knowledge acquisition rate)
- **Standup**: `generate_standup` (yesterday's tasks + focus + notes + habits)
- **Context**: `save_agent_context` / `get_agent_context` (persistent dev preferences)
- **Burnout**: `get_burnout_risk` (cognitive load + sleep + mood early warning)
- **Data**: `create_task` → `update_task`/`complete_task`/`undo_task`/`delete_task`<br>`save_note` → `update_note`/`delete_note`<br>`create_habit` → `update_habit`/`delete_habit`/`log_habit_completion`<br>`log_sleep`/`log_meal` — single-entry log

## Conventions

- All timestamps in epoch ms (i64)
- All responses include `data_coverage` (0.0–1.0)
- Partial data on empty states (never error)
- Commitment bonds use TEXT UUID v4

## Git Workflow

- **Active branch:** `Gemini-api-connections`
- **Remotes:** `origin` (Kimenzo/Bento) + `kimenzo2` (Kimenzo2/Bento)
- **ALWAYS push to `Gemini-api-connections` on both remotes.**
- **NEVER push to `kimenzo2/main`** or any `main` branch — push will fail and may cause stash issues.
- Before committing: run `git status` first to check for dirty files.
- When staging: use `git add <specific-files>`, never `git add -A` (to avoid sweeping unrelated changes into the commit).
