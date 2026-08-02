// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import Task from "./task.svelte";
import TaskContent from "./task-content.svelte";
import TaskItem from "./task-item.svelte";
import TaskItemFile from "./task-item-file.svelte";
import TaskTrigger from "./task-trigger.svelte";

export {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
  //
  Task as Root,
  TaskTrigger as Trigger,
  TaskContent as Content,
  TaskItem as Item,
  TaskItemFile as ItemFile,
};

export type { TaskProps } from "./task.svelte";
export type { TaskContentProps } from "./task-content.svelte";
export type { TaskItemProps } from "./task-item.svelte";
export type { TaskItemFileProps } from "./task-item-file.svelte";
export type { TaskTriggerProps } from "./task-trigger.svelte";
