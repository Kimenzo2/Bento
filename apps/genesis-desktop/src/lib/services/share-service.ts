// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { time } from "$lib/utils/time";

// ─── Zod schemas ──────────────────────────────────────────────────────

const shareResultSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    filePath: z.string().nullable(),
    sizeBytes: z.number().int(),
  })
  .strict();

export type ShareResult = z.infer<typeof shareResultSchema>;

export type ShareFormat = "plainText" | "markdown" | "json" | "html" | "csv" | "bentoManifest";

export type ShareDestination = "clipboard" | "file";

export interface ShareOptions {
  label?: string;
  filename?: string;
  sanitize?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Share service ────────────────────────────────────────────────────

const defaultOptions: Required<ShareOptions> = {
  label: "Shared content",
  filename: "bento-export",
  sanitize: true,
  metadata: {},
};

/**
 * Share content using the Rust backend.
 * Central, module-agnostic API for sharing text/structured data.
 */
export async function shareContent(
  content: string,
  format: ShareFormat,
  destination: ShareDestination,
  options?: ShareOptions,
): Promise<ShareResult> {
  const opts = { ...defaultOptions, ...options };

  const result = await invoke<unknown>("share_content", {
    content,
    format,
    destination,
    options: {
      label: opts.label,
      filename: opts.filename,
      sanitize: opts.sanitize,
      metadata: opts.metadata,
    },
  });

  return shareResultSchema.parse(result);
}

/**
 * Convenience: share as markdown to clipboard.
 */
export async function shareAsMarkdown(content: string, label?: string): Promise<ShareResult> {
  const result = await invoke<unknown>("share_markdown", {
    content,
    label: label ?? "Shared content",
  });
  return shareResultSchema.parse(result);
}

/**
 * Convenience: share as JSON to a file via save dialog.
 */
export async function shareAsJsonToFile(
  content: string,
  filename?: string,
  label?: string,
): Promise<ShareResult> {
  const result = await invoke<unknown>("share_json_to_file", {
    content,
    filename: filename ?? "bento-export",
    label: label ?? "JSON export",
  });
  return shareResultSchema.parse(result);
}

/**
 * Convenience: share as CSV to a file via save dialog.
 */
export async function shareAsCsvToFile(
  content: string,
  filename?: string,
  label?: string,
): Promise<ShareResult> {
  const result = await invoke<unknown>("share_csv_to_file", {
    content,
    filename: filename ?? "bento-export",
    label: label ?? "CSV export",
  });
  return shareResultSchema.parse(result);
}

/**
 * Share plain text to clipboard.
 */
export async function copyToClipboard(text: string, label?: string): Promise<ShareResult> {
  return shareContent(text, "plainText", "clipboard", {
    label: label ?? "Text copied to clipboard",
  });
}

/**
 * Generate a markdown task list from an array of task-like objects.
 * Module-agnostic — works with any structure that has title, done, priority, dueAt, project, notes, tags.
 */
export function formatTasksAsMarkdown(
  items: Array<{
    title: string;
    done?: boolean;
    priority?: string;
    dueAt?: number | null;
    project?: string;
    notes?: string;
    tags?: string;
  }>,
  title = "Task List",
): string {
  const lines: string[] = [
    `# ${title}`,
    "",
    `_Generated ${time.format(time.now())}_`,
    "",
    "---",
    "",
  ];

  const incomplete = items.filter((t) => !t.done);
  const complete = items.filter((t) => t.done);

  if (incomplete.length > 0) {
    lines.push("## To Do", "");
    for (const t of incomplete) {
      const priorityMark =
        t.priority === "urgent"
          ? " 🔴"
          : t.priority === "high"
            ? " 🟠"
            : t.priority === "medium"
              ? " 🔵"
              : "";
      const dueStr = t.dueAt ? ` *(due ${time.formatCustom(t.dueAt, "M j")})*` : "";
      const projectStr = t.project && t.project !== "inbox" ? ` \`[${t.project}]\`` : "";
      lines.push(`- [ ] **${t.title}**${priorityMark}${dueStr}${projectStr}`);
      if (t.notes) lines.push(`  - ${t.notes.replace(/\n/g, "\n  ")}`);
      if (t.tags && t.tags !== "[]") {
        try {
          const tags = JSON.parse(t.tags) as string[];
          if (tags.length > 0) lines.push(`  \`Tags: ${tags.join(", ")}\``);
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (complete.length > 0) {
    lines.push("", "## Completed", "");
    for (const t of complete) {
      lines.push(`- [x] **${t.title}**`);
    }
  }

  lines.push("", "---", `_${items.length} total items_`);
  return lines.join("\n");
}

/**
 * Format health daily logs as markdown.
 */
export function formatHealthAsMarkdown(
  logs: Array<{
    dateKey: string;
    mood: string;
    energy: number;
    waterGlasses: number;
    sleepHours: number;
    symptoms: string[];
    note?: string | null;
  }>,
  title = "Health Log",
): string {
  const lines: string[] = [
    `# ${title}`,
    "",
    `_Generated ${time.format(time.now())}_`,
    "",
    "---",
    "",
  ];

  for (const log of logs) {
    lines.push(`### ${log.dateKey}`);
    lines.push(`- **Mood:** ${log.mood}`);
    lines.push(`- **Energy:** ${log.energy}/10`);
    lines.push(
      `- **Water:** ${log.waterGlasses} glasses (${(log.waterGlasses * 0.25).toFixed(1)}L)`,
    );
    lines.push(`- **Sleep:** ${log.sleepHours}h`);
    if (log.symptoms.length > 0) {
      lines.push(`- **Symptoms:** ${log.symptoms.join(", ")}`);
    }
    if (log.note) {
      lines.push(`- **Note:** ${log.note}`);
    }
    lines.push("");
  }

  lines.push("---", `_${logs.length} days logged_`);
  return lines.join("\n");
}

/**
 * Format health vitals as a markdown table.
 */
export function formatVitalsAsMarkdown(
  vitals: Array<{
    dateKey: string;
    bp?: string | null;
    hr?: string | null;
    weight?: string | null;
    temp?: string | null;
    spo2?: string | null;
  }>,
  title = "Vitals Log",
): string {
  const lines: string[] = [
    `# ${title}`,
    "",
    `_Generated ${time.format(time.now())}_`,
    "",
    "| Date | BP | HR | Weight | Temp | SpO₂ |",
    "|------|----|----|--------|------|------|",
  ];

  for (const v of vitals) {
    lines.push(
      `| ${v.dateKey} | ${v.bp ?? "—"} | ${v.hr ?? "—"} | ${v.weight ?? "—"} | ${v.temp ?? "—"} | ${v.spo2 ?? "—"} |`,
    );
  }

  lines.push("", `_${vitals.length} readings_`);
  return lines.join("\n");
}

/**
 * Format medications as markdown.
 */
export function formatMedsAsMarkdown(
  meds: Array<{
    name: string;
    dose: string;
    timeOfDay: string;
    notes?: string;
    takenToday?: boolean;
  }>,
  title = "Medications",
): string {
  const lines: string[] = [`# ${title}`, "", `_Generated ${time.format(time.now())}_`, "", ""];

  for (const m of meds) {
    const status = m.takenToday ? "✅ Taken" : "⬜ Pending";
    lines.push(
      `- **${m.name}** — ${m.dose} @ ${m.timeOfDay} (${status})${m.notes ? ` — ${m.notes}` : ""}`,
    );
  }

  lines.push("", `_${meds.length} medications_`);
  return lines.join("\n");
}
