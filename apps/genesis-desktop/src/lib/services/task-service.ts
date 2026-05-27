import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';

// ─── Zod schemas ──────────────────────────────────────────────────────

const taskEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  done: z.boolean(),
  priority: z.string(),
  project: z.string(),
  tags: z.string(),
  notes: z.string(),
  dueAt: z.number().int().nullable(),
  dueTime: z.string().nullable(),
  startAt: z.number().int().nullable(),
  estimatedMinutes: z.number().int().nullable(),
  trackedMinutes: z.number().int(),
  recurrenceRule: z.string().nullable(),
  archived: z.boolean(),
  parentId: z.string().nullable(),
  completedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  sortOrder: z.number(),
}).strict();

const saveTaskParamsSchema = z.object({
  title: z.string().min(1),
  priority: z.string().optional(),
  project: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  dueAt: z.number().int().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  startAt: z.number().int().nullable().optional(),
  estimatedMinutes: z.number().int().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
}).strict();

const updateTaskParamsSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  done: z.boolean().optional(),
  priority: z.string().optional(),
  project: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  dueAt: z.number().int().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  startAt: z.number().int().nullable().optional(),
  estimatedMinutes: z.number().int().nullable().optional(),
  trackedMinutes: z.number().int().optional(),
  recurrenceRule: z.string().nullable().optional(),
  archived: z.boolean().nullable().optional(),
  completedAt: z.number().int().nullable().optional(),
}).strict();

// ─── Activity types ───────────────────────────────────────────────────

const activityEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  text: z.string(),
  timestamp: z.number().int(),
}).strict();

// ─── Types ────────────────────────────────────────────────────────────

export type TaskEntry = z.infer<typeof taskEntrySchema>;
export type SaveTaskParams = z.infer<typeof saveTaskParamsSchema>;
export type UpdateTaskParams = z.infer<typeof updateTaskParamsSchema>;
export type ActivityEntry = z.infer<typeof activityEntrySchema>;

// ─── Subtask types ────────────────────────────────────────────────────

export interface SubtaskEntry {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

export interface SaveSubtaskParams {
  taskId: string;
  title: string;
}

// ─── Commands ─────────────────────────────────────────────────────────

/** Create a new task. */
export async function saveTask(params: SaveTaskParams): Promise<TaskEntry> {
  const parsed = saveTaskParamsSchema.parse(params);
  const result = await invoke<unknown>('save_task', { params: parsed });
  return taskEntrySchema.parse(result);
}

/** Update an existing task (partial update). */
export async function updateTask(params: UpdateTaskParams): Promise<TaskEntry> {
  const parsed = updateTaskParamsSchema.parse(params);
  const result = await invoke<unknown>('update_task', { params: parsed });
  return taskEntrySchema.parse(result);
}

/** Toggle a task's done state. */
export async function toggleTask(id: string): Promise<TaskEntry> {
  const result = await invoke<unknown>('toggle_task', { id });
  return taskEntrySchema.parse(result);
}

/** Get a task by ID. Returns null if not found. */
export async function getTask(id: string): Promise<TaskEntry | null> {
  const result = await invoke<unknown>('get_task', { id });
  if (result === null) return null;
  return taskEntrySchema.parse(result);
}

/** Delete a task by ID. */
export async function deleteTask(id: string): Promise<void> {
  await invoke('delete_task', { id });
}

/** Archive a task. */
export async function archiveTask(id: string): Promise<TaskEntry> {
  const result = await invoke<unknown>('archive_task', { id });
  return taskEntrySchema.parse(result);
}

/** Duplicate a task. */
export async function duplicateTask(id: string): Promise<TaskEntry> {
  const result = await invoke<unknown>('duplicate_task', { id });
  return taskEntrySchema.parse(result);
}

/** Log an activity entry for a task. */
export async function logActivityEntry(taskId: string, text: string): Promise<ActivityEntry> {
  const result = await invoke<unknown>('log_activity_entry', { params: { taskId, text } });
  return activityEntrySchema.parse(result);
}

/** List activity entries for a task. */
export async function listActivityForTask(taskId: string, limit?: number): Promise<ActivityEntry[]> {
  const result = await invoke<unknown>('list_activity_for_task', { taskId, limit: limit ?? null });
  return z.array(activityEntrySchema).parse(result);
}

/**
 * List tasks with optional filters.
 * - project: filter by project id
 * - priority: filter by priority level
 * - done: filter by completion status
 * - dueBefore: only tasks with due_at <= this timestamp (ms)
 * - dueAfter: only tasks with due_at >= this timestamp (ms)
 * - limit: max results (default 100, max 500)
 */
export async function listTasks(params?: {
  project?: string;
  priority?: string;
  done?: boolean;
  dueBefore?: number;
  dueAfter?: number;
  limit?: number;
}): Promise<TaskEntry[]> {
  const result = await invoke<unknown>('list_tasks', {
    project: params?.project ?? null,
    priority: params?.priority ?? null,
    done: params?.done ?? null,
    dueBefore: params?.dueBefore ?? null,
    dueAfter: params?.dueAfter ?? null,
    limit: params?.limit ?? null,
  });
  return z.array(taskEntrySchema).parse(result);
}

/** Open a file picker dialog and read the selected import file. */
export async function pickImportFile(): Promise<{ content: string; fileName: string; extension: string } | null> {
  const result = await invoke<unknown>('pick_import_file');
  if (result === null) return null;
  return z.object({
    content: z.string(),
    fileName: z.string(),
    extension: z.string(),
  }).parse(result);
}

// ─── Subtask commands ─────────────────────────────────────────────────

const subtaskEntrySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
}).strict();

/** Create a new subtask. */
export async function saveSubtask(params: SaveSubtaskParams): Promise<SubtaskEntry> {
  const result = await invoke<unknown>('save_subtask', { params });
  return subtaskEntrySchema.parse(result);
}

/** Delete a subtask by ID. */
export async function deleteSubtask(id: string): Promise<void> {
  await invoke('delete_subtask', { id });
}

/** List all subtasks for a task. */
export async function listSubtasksForTask(taskId: string): Promise<SubtaskEntry[]> {
  const result = await invoke<unknown>('list_subtasks_for_task', { taskId });
  return z.array(subtaskEntrySchema).parse(result);
}

/** Update a subtask's done status. */
export async function updateSubtaskBackend(id: string, done: boolean): Promise<SubtaskEntry> {
  const result = await invoke<unknown>('update_subtask_status', { id, done });
  return subtaskEntrySchema.parse(result);
}

/** Reorder tasks (bulk update sort_order). */
export async function reorderTasks(items: ReorderItem[]): Promise<void> {
  await invoke('reorder_tasks', { items });
}

/**
 * Save content to a file using Tauri's save dialog.
 * Returns the saved file path, or null if the user cancelled.
 */
export async function exportContentToFile(
  content: string,
  defaultName: string,
  extension: string,
  filterName: string,
): Promise<string | null> {
  const result = await invoke<unknown>('export_content_to_file', {
    content,
    defaultName,
    extension,
    filterName,
  });
  return z.string().nullable().parse(result);
}
