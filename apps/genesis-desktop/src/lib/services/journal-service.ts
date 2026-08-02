// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

// ─── Zod schemas ──────────────────────────────────────────────────────

const journalEntrySchema = z
  .object({
    id: z.string().min(1),
    date: z.string().min(1),
    blocks: z.string(),
    wordCount: z.number().int(),
    mood: z.string().nullable(),
    weather: z.string().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const saveEntryParamsSchema = z
  .object({
    id: z.string().min(1),
    date: z.string().min(1),
    blocks: z.string(),
    wordCount: z.number().int(),
    mood: z.string().nullable(),
    weather: z.string().nullable(),
  })
  .strict();

// ─── Types ────────────────────────────────────────────────────────────

export type JournalEntry = z.infer<typeof journalEntrySchema>;
type SaveEntryParams = z.infer<typeof saveEntryParamsSchema>;

// ─── Commands ─────────────────────────────────────────────────────────

/** Create a new blank journal entry for the given date. */
export async function createJournalEntry(date: string): Promise<JournalEntry> {
  const result = await invoke<unknown>("create_journal_entry", { date });
  return journalEntrySchema.parse(result);
}

/** Save (update) a journal entry by ID. */
export async function saveJournalEntry(
  id: string,
  date: string,
  blocks: string,
  wordCount: number,
  mood: string | null = null,
  weather: string | null = null,
): Promise<JournalEntry> {
  const params: SaveEntryParams = { id, date, blocks, wordCount, mood, weather };
  const parsed = saveEntryParamsSchema.parse(params);
  const result = await invoke<unknown>("save_journal_entry", { params: parsed });
  return journalEntrySchema.parse(result);
}

/** Get a journal entry by ID. Returns null if none exists. */
export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  try {
    const result = await invoke<unknown>("get_journal_entry", { id });
    if (result !== null) {
      return journalEntrySchema.parse(result);
    }
  } catch (err) {
    console.warn("[journal] Tauri get failed", err);
  }
  return null;
}

/** Delete a journal entry by ID. */
export async function deleteJournalEntry(id: string): Promise<void> {
  await invoke("delete_journal_entry", { id });
}

/** List recent journal entries (newest first by creation time). Limit defaults to 30. */
export async function listJournalEntries(limit?: number): Promise<JournalEntry[]> {
  const cap = limit ?? 30;
  const result = await invoke<unknown>("list_journal_entries", { limit: cap });
  return z.array(journalEntrySchema).parse(result);
}
