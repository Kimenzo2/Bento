// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

export {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
  Root,
  Trigger,
  Content,
  Item,
  ItemFile,
} from "$lib/components/agent/task/index.js";

export type {
  TaskProps,
  TaskContentProps,
  TaskItemProps,
  TaskItemFileProps,
  TaskTriggerProps,
} from "$lib/components/agent/task/index.js";
