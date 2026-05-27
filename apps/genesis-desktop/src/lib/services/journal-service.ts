import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';

// ─── Zod schemas ──────────────────────────────────────────────────────

const journalEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  blocks: z.string(),
  wordCount: z.number().int(),
  mood: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
}).strict();

const saveEntryParamsSchema = z.object({
  date: z.string().min(1),
  blocks: z.string(),
  wordCount: z.number().int(),
  mood: z.string().nullable(),
}).strict();

// ─── Types ────────────────────────────────────────────────────────────

export type JournalEntry = z.infer<typeof journalEntrySchema>;
type SaveEntryParams = z.infer<typeof saveEntryParamsSchema>;

// ─── Commands ─────────────────────────────────────────────────────────

/** Save (upsert) a journal entry for a given date. */
export async function saveJournalEntry(params: SaveEntryParams): Promise<JournalEntry> {
  const parsed = saveEntryParamsSchema.parse(params);
  const result = await invoke<unknown>('save_journal_entry', { params: parsed });
  return journalEntrySchema.parse(result);
}

/** Get a journal entry by date ('YYYY-MM-DD'). Returns null if none exists. */
export async function getJournalEntry(date: string): Promise<JournalEntry | null> {
  const result = await invoke<unknown>('get_journal_entry', { date });
  if (result === null) return null;
  return journalEntrySchema.parse(result);
}

/** Delete a journal entry by ID. */
export async function deleteJournalEntry(id: string): Promise<void> {
  await invoke('delete_journal_entry', { id });
}

/** List recent journal entries (newest first). Limit defaults to 30. */
export async function listJournalEntries(limit?: number): Promise<JournalEntry[]> {
  const result = await invoke<unknown>('list_journal_entries', {
    limit: limit ?? 30,
  });
  return z.array(journalEntrySchema).parse(result);
}
