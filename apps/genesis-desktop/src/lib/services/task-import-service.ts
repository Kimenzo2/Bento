import type { SaveTaskParams } from "./task-service";

// ─── Public types ─────────────────────────────────────────────────────

export interface ImportPreview {
  format: string;
  fileName: string;
  entries: ImportPreviewEntry[];
  conflicts: ConflictEntry[];
}

export interface ImportPreviewEntry {
  title: string;
  priority: string;
  project: string;
  dueDate: string | null;
  tags: string[];
  notes: string;
  done: boolean;
}

export interface ConflictEntry {
  rowIndex: number;
  title: string;
  existingId: string;
  existingTitle: string;
  existingDone: boolean;
  resolve: "skip" | "overwrite" | "duplicate";
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ─── Detect format ────────────────────────────────────────────────────

export function detectImportFormat(fileName: string, content: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "json") {
    // Todoist: has "items" and "projects" keys
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && "items" in parsed && "projects" in parsed) {
        return "todoist";
      }
    } catch {
      /* not JSON */
    }
  }

  if (ext === "csv") {
    // Peek at header row
    const firstLine = content.split("\n")[0].trim().toLowerCase();
    // Normalize: strip quotes for detection
    const plain = firstLine.replace(/"/g, "");
    // Things 3: has type,status,title columns
    if (/\btype\b/.test(plain) && /\btitle\b/.test(plain) && /\bstatus\b/.test(plain)) {
      return "things3";
    }
    // TickTick: has Folder,List,Title,Tags,Content etc.
    if (/\bfolder\b/.test(plain) && /\btitle\b/.test(plain) && /\blist\b/.test(plain)) {
      return "ticktick";
    }
  }

  return "unknown";
}

// ─── Todoist JSON Parser ──────────────────────────────────────────────

interface TodoistItem {
  id: number;
  project_id: number;
  content: string;
  description?: string;
  priority: number; // 1=p1(urgent), 2=p2, 3=p3, 4=p4(none)
  due?: {
    date: string;
    datetime?: string;
    is_recurring: boolean;
    string?: string;
  } | null;
  labels?: string[];
  checked: number;
}

interface TodoistProject {
  id: number;
  name: string;
  color?: number;
}

interface TodoistExport {
  projects: TodoistProject[];
  items: TodoistItem[];
}

const priorityMap: Record<number, string> = { 1: "urgent", 2: "high", 3: "medium", 4: "none" };

function parseTodoist(content: string): ImportPreview {
  const data = JSON.parse(content) as TodoistExport;
  const projects = data.projects ?? [];
  const items = data.items ?? [];

  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  const entries: ImportPreviewEntry[] = items.map((item) => {
    const projectName = projectNames.get(item.project_id) ?? "inbox";
    const project =
      projectName.toLowerCase() === "inbox"
        ? "inbox"
        : projectName
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "") || "inbox";

    let dueDate: string | null = null;
    if (item.due?.datetime) {
      dueDate = item.due.datetime;
    } else if (item.due?.date) {
      dueDate = new Date(item.due.date + "T23:59:59").getTime().toString();
    }

    return {
      title: item.content,
      priority: priorityMap[item.priority] ?? "none",
      project: project === "inbox" ? "inbox" : project,
      dueDate,
      tags: (item.labels ?? []).map((l) => l.toLowerCase()),
      notes: item.description ?? "",
      done: item.checked === 1,
    };
  });

  return {
    format: "Todoist",
    fileName: data.projects?.[0]?.name ?? "Todoist",
    entries,
    conflicts: [],
  };
}

// ─── Things 3 CSV Parser ──────────────────────────────────────────────

/**
 * Things 3 CSV columns (0-indexed):
 * 0: Type, 1: Status, 2: Tags, 3: Area, 4: Project,
 * 5: Title, 6: Notes, 7: When, 8: Deadline,
 * 9: Creation Date, 10: Completion Date, 11: Start,
 * 12: Today, 13: Someday, 14: Recurrence, 15: ID
 */

function parseThings3Csv(content: string): ImportPreview {
  const lines = content.trim().split("\n");
  // Skip header row
  const dataLines = lines.slice(1).filter((l) => l.trim());
  const entries: ImportPreviewEntry[] = [];

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 6) continue;

    const type = cols[0] ?? "";
    const status = cols[1] ?? "";
    const tagsRaw = cols[2] ?? "";
    const projectRaw = cols[4] ?? "";
    const title = cols[5] ?? "";
    const notes = cols[6] ?? "";
    const whenRaw = cols[7] ?? "";
    const deadlineRaw = cols[8] ?? "";
    const _startRaw = cols[11] ?? "";
    const somedayRaw = cols[13] ?? "";

    if (!title || type === "heading") continue;

    // Determine project
    let project = "inbox";
    if (projectRaw) {
      project =
        projectRaw
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || "inbox";
    }
    if (somedayRaw.toLowerCase() === "true") {
      project = "someday";
    }

    // Parse due date
    let dueDate: string | null = null;
    if (deadlineRaw) {
      dueDate = parseThingsDate(deadlineRaw);
    } else if (whenRaw) {
      dueDate = parseThingsDate(whenRaw);
    }

    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];

    entries.push({
      title,
      priority: "none",
      project,
      dueDate,
      tags,
      notes,
      done: status.toLowerCase() === "completed",
    });
  }

  return {
    format: "Things 3",
    fileName: "Things 3",
    entries,
    conflicts: [],
  };
}

function parseThingsDate(raw: string): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.getTime().toString();
  } catch {
    /* ignore */
  }
  return null;
}

// ─── TickTick CSV Parser ──────────────────────────────────────────────

/**
 * TickTick CSV columns (0-indexed):
 * 0: Folder, 1: List, 2: Title, 3: Tags, 4: Content,
 * 5: Start Date, 6: Due Date, 7: Reminder, 8: Repeat,
 * 9: Priority, 10: Status, 11: Completed Time
 */

const tickTickPriorityMap: Record<string, string> = {
  high: "urgent",
  urgent: "urgent",
  medium: "high",
  low: "medium",
  none: "none",
};

function parseTickTickCsv(content: string): ImportPreview {
  const lines = content.trim().split("\n");
  const dataLines = lines.slice(1).filter((l) => l.trim());
  const entries: ImportPreviewEntry[] = [];

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    const folder = cols[0] ?? "";
    const list = cols[1] ?? "";
    const title = cols[2] ?? "";
    const tagsRaw = cols[3] ?? "";
    const contentRaw = cols[4] ?? "";
    const _startDateRaw = cols[5] ?? "";
    const dueDateRaw = cols[6] ?? "";
    const priorityRaw = cols[9]?.toLowerCase() ?? "";
    const statusRaw = cols[10] ?? "";

    if (!title) continue;

    // Determine project from folder/list
    const projectSource = list || folder;
    const project = projectSource
      ? projectSource
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || "inbox"
      : "inbox";

    // Parse due date
    let dueDate: string | null = null;
    if (dueDateRaw) {
      try {
        const d = new Date(dueDateRaw);
        if (!isNaN(d.getTime())) dueDate = d.getTime().toString();
      } catch {
        /* ignore */
      }
    }

    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];

    entries.push({
      title,
      priority: tickTickPriorityMap[priorityRaw] ?? "none",
      project,
      dueDate,
      tags,
      notes: contentRaw ?? "",
      done: statusRaw.toLowerCase() === "completed",
    });
  }

  return {
    format: "TickTick",
    fileName: "TickTick",
    entries,
    conflicts: [],
  };
}

// ─── Conflict detection ───────────────────────────────────────────────

export function detectConflicts(
  entries: ImportPreviewEntry[],
  existingTitles: Map<string, { id: string; title: string; done: boolean }>,
): ConflictEntry[] {
  const conflicts: ConflictEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const normalized = entry.title.trim().toLowerCase();
    const match = Array.from(existingTitles.entries()).find(
      ([key]) => key.toLowerCase() === normalized,
    );
    if (match) {
      conflicts.push({
        rowIndex: i,
        title: entry.title,
        existingId: match[1].id,
        existingTitle: match[1].title,
        existingDone: match[1].done,
        resolve: "skip", // default: skip
      });
    }
  }
  return conflicts;
}

// ─── Import execution ─────────────────────────────────────────────────

export async function executeImport(
  preview: ImportPreview,
  conflicts: ConflictEntry[],
  existingTasks: Map<string, { id: string; title: string }>,
  saveFn: (params: SaveTaskParams) => Promise<{ id: string }>,
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const conflictResolutions = new Map(conflicts.map((c) => [c.rowIndex, c.resolve]));

  for (let i = 0; i < preview.entries.length; i++) {
    const entry = preview.entries[i];

    // Check conflict
    const resolution = conflictResolutions.get(i);
    if (resolution === "skip") {
      skipped++;
      continue;
    }

    if (resolution === "overwrite") {
      // Find existing task and just skip for now (user would re-import after cleanup)
      skipped++;
      continue;
    }

    try {
      const params: SaveTaskParams = {
        title: entry.title,
        priority: entry.priority !== "none" ? entry.priority : undefined,
        project: entry.project,
        dueAt: entry.dueDate ? parseInt(entry.dueDate) : undefined,
        tags: entry.tags.length > 0 ? JSON.stringify(entry.tags) : undefined,
        notes: entry.notes || undefined,
      };

      await saveFn(params);
      imported++;
    } catch (err) {
      errors.push(`Row ${i + 1} "${entry.title}": ${err}`);
    }
  }

  return { imported, skipped, errors };
}

// ─── Main parse dispatcher ────────────────────────────────────────────

export function parseImportContent(fileName: string, content: string): ImportPreview {
  const format = detectImportFormat(fileName, content);

  switch (format) {
    case "todoist":
      return parseTodoist(content);
    case "things3":
      return parseThings3Csv(content);
    case "ticktick":
      return parseTickTickCsv(content);
    default:
      return {
        format: "Unknown",
        fileName,
        entries: [],
        conflicts: [],
      };
  }
}

// ─── CSV line parser (handles quoted fields) ──────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}
