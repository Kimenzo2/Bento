// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

pub mod budget;
pub mod context;
pub mod countdown;
pub mod focus;
pub mod integrations;
pub mod goals;
pub mod habits;
pub mod health;
pub mod journal;
pub mod mood;
pub mod notes;
pub mod nutrition;
pub mod scheduler;
pub mod sleep;
pub mod tasks;

use serde_json::Value;
use sqlx::SqlitePool;

use super::chat::ToolDefinition;

pub fn all_definitions() -> Vec<ToolDefinition> {
    let mut defs = Vec::new();
    defs.extend(tasks::definitions());
    defs.extend(notes::definitions());
    defs.extend(habits::definitions());
    defs.extend(mood::definitions());
    defs.extend(sleep::definitions());
    defs.extend(focus::definitions());
    defs.extend(nutrition::definitions());
    defs.extend(health::definitions());
    defs.extend(goals::definitions());
    defs.extend(budget::definitions());
    defs.extend(journal::definitions());
    defs.extend(countdown::definitions());
    defs.extend(scheduler::definitions());
    defs.extend(context::definitions());
    defs
}

pub async fn execute_tool(
    pool: &SqlitePool,
    name: &str,
    args: &Value,
) -> Result<Value, String> {
    macro_rules! try_module {
        ($mod:ident => $name:ident) => {
            if let Some(result) = $mod::try_execute(name, args, pool).await? {
                return Ok(result);
            }
        };
    }

    try_module!(tasks => execute_task_tool);
    try_module!(notes => execute_note_tool);
    try_module!(habits => execute_habit_tool);
    try_module!(mood => execute_mood_tool);
    try_module!(sleep => execute_sleep_tool);
    try_module!(focus => execute_focus_tool);
    try_module!(nutrition => execute_nutrition_tool);
    try_module!(health => execute_health_tool);
    try_module!(goals => execute_goal_tool);
    try_module!(budget => execute_budget_tool);
    try_module!(journal => execute_journal_tool);
    try_module!(countdown => execute_countdown_tool);
    try_module!(scheduler => execute_scheduler_tool);
    try_module!(context => execute_context_tool);

    Err(format!("Unknown tool: {name}"))
}
