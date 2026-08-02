// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

export type Priority = "urgent" | "high" | "medium" | "none";
export type TaskStatus = "todo" | "in-progress" | "waiting" | "blocked" | "done";
export type DeadlineKind = "soft" | "hard";
export type RecurringInterval = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  subtasks?: Subtask[];
}

export interface Recurrence {
  interval: RecurringInterval;
  every: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  ordinal?: number;
  weekdayOfMonth?: number;
  endKind?: "never" | "after" | "on";
  endAfter?: number;
  endOn?: string;
  completionCount?: number;
  skippedOccurrences?: string[];
}

export interface Reminder {
  id: string;
  kind: "time" | "location" | "persistent" | "recurring-daily";
  at?: string;
  location?: string;
  arriving?: boolean;
  persistent?: boolean;
  snoozedUntil?: string;
}

export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "document" | "other";
  sizeBytes: number;
  addedAt: string;
}

export interface TaskLink {
  targetId: string;
  kind: "blocks" | "blocked-by" | "related";
}

export interface TimeBlock {
  startTime: string;
  endTime: string;
  date: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  deadlineKind: DeadlineKind;
  dueDate?: string;
  dueTime?: string;
  dueDateEnd?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  snoozedUntil?: string;
  projectId?: string;
  areaId?: string;
  tags: string[];
  inInbox: boolean;
  inToday: boolean;
  subtasks: Subtask[];
  parentId?: string;
  recurrence?: Recurrence;
  timeBlock?: TimeBlock;
  estimatedMinutes?: number;
  reminders: Reminder[];
  attachments: Attachment[];
  links: TaskLink[];
  ageWarning: boolean;
  overdue: boolean;
  karmaPoints: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  areaId?: string;
  createdAt: string;
  archivedAt?: string;
}

export interface Area {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface FilterCondition {
  field: "project" | "tag" | "priority" | "status" | "dueDate" | "area";
  op: "is" | "isNot" | "before" | "after" | "contains";
  value: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  conditions: FilterCondition[];
  sortBy: "priority" | "dueDate" | "created" | "title" | "manual";
  sortDir: "asc" | "desc";
  createdAt: string;
}

export interface KanbanColumn {
  status: TaskStatus;
  label: string;
  color: string;
}

export interface TaskStats {
  completedToday: number;
  completedThisWeek: number;
  currentStreak: number;
  longestStreak: number;
  karmaTotal: number;
  overdueCount: number;
  agedCount: number;
  estimatedMinutesToday: number;
}

export interface ParsedTask {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: Priority;
  tags?: string[];
}
