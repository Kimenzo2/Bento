<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import './tasks.css';
  import {
    Plus, ListTodo, Inbox, Calendar, Trash2, CheckSquare,
    X, ChevronLeft, ChevronRight, Clock,
    Layers, Archive as ArchiveIcon, AlertCircle,
    Play, Square, Download, FileText, Share2
  } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import Sortable from 'sortablejs';
  import Card from '$lib/components/ui/card/card.svelte';
  import CardContent from '$lib/components/ui/card/card-content.svelte';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { saveTask, updateTask, toggleTask as toggleTaskBackend, deleteTask as deleteTaskBackend, listTasks, archiveTask, duplicateTask, logActivityEntry, listActivityForTask, exportContentToFile, pickImportFile, saveSubtask, deleteSubtask, listSubtasksForTask, reorderTasks, updateSubtaskBackend, type ReorderItem } from '$lib/services/task-service';
  import { parseImportContent, detectConflicts, executeImport } from '$lib/services/task-import-service';
  import type { ImportPreview, ImportPreviewEntry, ConflictEntry } from '$lib/services/task-import-service';
  import type { TaskEntry, UpdateTaskParams } from '$lib/services/task-service';
  import { time } from '$lib/utils/time';
import { registerRefresher } from '$lib/realtime/data-changed';
import ShareSheet from '$lib/components/ShareSheet.svelte';
import { formatTasksAsMarkdown } from '$lib/services/share-service';
import { tooltip } from "$lib/components/Tooltip.svelte";

  /* ═══════════════════════════════════════════════════════════════════
     TYPES
     ═══════════════════════════════════════════════════════════════════ */
  type Priority = 'urgent' | 'high' | 'medium' | 'none';
  type Density = 'comfortable' | 'compact' | 'spacious';
  type ViewFilter = 'inbox' | 'today' | 'upcoming' | 'overdue' | 'no-date' | 'someday' | 'logbook' | 'all';
  type ViewMode = 'list' | 'board' | 'calendar' | 'table' | 'timeline' | 'focus' | 'mind';

  interface Project {
    id: string;
    name: string;
    color: string;
  }

  interface LocalSubtask {
    id: string;
    title: string;
    done: boolean;
  }

  interface ActivityEntry {
    id: string;
    timestamp: number;
    text: string;
  }

  /* ═══════════════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════════════ */
  // Data
  let tasks = $state<TaskEntry[]>([]);
  let projects = $state<Project[]>([
    { id: 'inbox', name: 'Inbox', color: 'var(--primary)' },
    { id: 'work', name: 'Work', color: 'color-mix(in srgb, var(--primary) 72%, var(--foreground))' },
    { id: 'personal', name: 'Personal', color: 'color-mix(in srgb, var(--accent) 78%, var(--foreground))' },
    { id: 'learning', name: 'Learning', color: 'color-mix(in srgb, var(--destructive) 40%, var(--primary))' },
  ]);

  // View state
  let viewFilter = $state<ViewFilter>('inbox');
  let priorityFilter = $state<Priority | 'all'>('all');
  let projectFilter = $state<string>('all');
  let selectedTaskId: string | null = $state(null);
  let sidebarCollapsed = $state(false);
  let density: Density = $state('comfortable');

  // Animation state
  let removingIds = $state<Set<string>>(new Set());
  let checkingIds = $state<Set<string>>(new Set());
  let newIds = $state<Set<string>>(new Set());

  // Export
  let showExport = $state(false);
  let exportFormat = $state<'csv' | 'json' | 'markdown'>('csv');
  let isExporting = $state(false);
  let exportResult = $state<string | null>(null);

  // Import
  let showImport = $state(false);
  let importPreview = $state<ImportPreview | null>(null);
  let importConflictResolutions = $state<Map<number, 'skip' | 'overwrite' | 'duplicate'>>(new Map());
  let isImporting = $state(false);
  let importResult = $state<{ imported: number; skipped: number; errors: string[] } | null>(null);

  // Focus mode
  let focusMode = $state(false);

  // Shortcuts reference overlay
  let showShortcuts = $state(false);

  // Share
  let showShare = $state(false);
  let shareContent = $state('');

  async function openShare() {
    const allTasks = await listTasks({ limit: 10000 });
    shareContent = formatTasksAsMarkdown(allTasks, `Bento Tasks — ${viewTitle}`);
    showShare = true;
  }

  // Overdue reschedule dialog
  let showReschedule = $state(false);
  let rescheduleActions = $state<Map<string, 'leave' | 'tomorrow' | 'next-week' | 'next-month' | 'someday' | 'archive'>>(new Map());

  // Panel resize
  let sidebarWidth = $state(220);
  let listWidth = $state(380);

  // View mode
  const TASKS_VIEW_KEY = "bento:tasks:viewMode";
  const _savedViewMode = (typeof localStorage !== "undefined" ? localStorage.getItem(TASKS_VIEW_KEY) : null) as ViewMode | null;
  let viewMode = $state<ViewMode>(_savedViewMode ?? "calendar");
  $effect(() => { try { localStorage.setItem(TASKS_VIEW_KEY, viewMode); } catch {} });
  let customFilterText = $state('');
  let savedViews = $state<{ name: string; viewFilter: ViewFilter; priorityFilter: Priority | 'all'; projectFilter: string; viewMode: ViewMode; query: string }[]>([
    { name: 'Deep Work', viewFilter: 'today', priorityFilter: 'all', projectFilter: 'all', viewMode: 'focus', query: '' },
    { name: 'Risk Queue', viewFilter: 'overdue', priorityFilter: 'all', projectFilter: 'all', viewMode: 'timeline', query: '' },
  ]);

  // Context menu
  let showContextMenu = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let contextMenuTaskId: string | null = $state(null);

  // Timer
  let timerRunning = $state(false);
  let timerStartMs = $state<number | null>(null);
  let timerElapsed = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Quick Add — single source of truth for the add-task input
  let showQuickAdd = $state(false);
  let newTaskTitle = $state('');      // bound to both the inline bar and quick-add modal
  let quickAddTitle = $state('');     // alias kept for template compat — always mirrors newTaskTitle
  let selectedTemplate = $state<string | null>(null);

  // Bulk actions
  let selectedIds = $state<Set<string>>(new Set());
  let bulkMode = $state(false);

  // Detail pane local editing state
  let editTitle = $state('');
  let editPriority = $state<Priority>('none');
  let editProject = $state<string>('inbox');
  let editNotes = $state('');
  let editTags = $state<string[]>([]);
  let editTagInput = $state('');
  let editSubtasks = $state<LocalSubtask[]>([]);
  let editDueAt = $state<number | null>(null);
  let editDueTime = $state<string | null>(null);
  let editStartAt = $state<number | null>(null);
  let editEstimatedMinutes = $state<number | null>(null);
  let editRecurrenceRule = $state<string | null>(null);
  let editActivity = $state<ActivityEntry[]>([]);

  // Calendar picker state — month/year live-tracked via today
  let showCalendar = $state(false);

  /* ═══════════════════════════════════════════════════════════════════
     DERIVED
     ═══════════════════════════════════════════════════════════════════ */
  // BUG-12 FIX: today must tick in real time — use a $state that refreshes
  // every minute via a timer, not a $derived of time.now() which is static.
  let _todayTick = $state(0);
  let today = $derived.by(() => {
    void _todayTick; // reactive dependency — re-evaluates when tick changes
    const nowMs = time.now();
    return new Date(time.dayStart(nowMs));
  });

  // BUG-14 FIX: calendarMonth/Year must also follow today — init from live today
  let calendarMonth = $state(time.getDate(time.now()).month - 1);
  let calendarYear  = $state(time.getDate(time.now()).year);

  let selectedTask = $derived(tasks.find(t => t.id === selectedTaskId) ?? null);

  let filteredTasks = $derived.by(() => {
    let result = tasks.filter(t => !t.done);
    const now = time.now();
    const todayMs = today.getTime();
    const endOfToday = todayMs + 86_400_000;
    const next7 = todayMs + 7 * 86_400_000;

    switch (viewFilter) {
      case 'inbox':
        result = result.filter(t => t.project === 'inbox');
        break;
      case 'today':
        result = result.filter(t => t.dueAt !== null && t.dueAt < endOfToday && t.project !== 'someday');
        break;
      case 'upcoming':
        result = result.filter(t => t.dueAt !== null && t.dueAt >= endOfToday && t.dueAt <= next7 && t.project !== 'someday');
        break;
      case 'overdue':
        // BUG-13 FIX: exclude done tasks — a completed task is never overdue
        result = result.filter(t => !t.done && t.dueAt !== null && t.dueAt < today.getTime() && t.project !== 'someday');
        break;
      case 'no-date':
        result = result.filter(t => t.dueAt === null && t.project !== 'someday');
        break;
      case 'someday':
        result = result.filter(t => t.project === 'someday');
        break;
      case 'logbook':
        result = tasks.filter(t => t.done);
        break;
      case 'all':
        break;
    }

    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (projectFilter !== 'all') {
      result = result.filter(t => t.project === projectFilter);
    }
    if (customFilterText.trim()) {
      const q = customFilterText.trim().toLowerCase();
      result = result.filter((t) => {
        const tags = safeTags(t.tags).join(' ');
        return `${t.title} ${t.notes} ${t.project} ${tags}`.toLowerCase().includes(q);
      });
    }

    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, none: 3 };
    result.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      if (pDiff !== 0) return pDiff;
      if (a.dueAt !== null && b.dueAt !== null) return a.dueAt - b.dueAt;
      if (a.dueAt !== null) return -1;
      if (b.dueAt !== null) return 1;
      return b.createdAt - a.createdAt;
    });
    return result;
  });

  let completeTasks = $derived(tasks.filter(t => t.done));
  let visibleTasks = $derived.by(() => viewFilter === 'logbook' ? completeTasks : filteredTasks);
  let nextAction = $derived.by(() => filteredTasks.find(t => !t.done) ?? null);
  let timelineGroups = $derived.by(() => {
    const groups = new Map<string, TaskEntry[]>();
    for (const task of visibleTasks) {
      const key = task.dueAt ? time.toISODate(task.dueAt) : 'No Date';
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  let incompleteCount = $derived(tasks.filter(t => !t.done).length);
  let inboxCount = $derived(tasks.filter(t => t.project === 'inbox' && !t.done).length);
  let overdueCount = $derived(tasks.filter(t => !t.done && t.dueAt !== null && t.dueAt < today.getTime()).length);
  let todayCount = $derived(tasks.filter(t => !t.done && t.dueAt !== null && t.dueAt < (today.getTime() + 86_400_000)).length);
  let upcomingCount = $derived(tasks.filter(t => !t.done && t.dueAt !== null && t.dueAt >= (today.getTime() + 86_400_000) && t.dueAt <= (today.getTime() + 7 * 86_400_000)).length);

  let sidebarNavItems = $derived([
    { id: 'inbox' as ViewFilter, label: 'Inbox', icon: Inbox, count: inboxCount },
    { id: 'today' as ViewFilter, label: 'Today', icon: Calendar, count: todayCount },
    { id: 'upcoming' as ViewFilter, label: 'Upcoming', icon: Clock, count: upcomingCount },
    { id: 'overdue' as ViewFilter, label: 'Overdue', icon: AlertCircle, count: overdueCount },
    { id: 'no-date' as ViewFilter, label: 'No Due Date', icon: ListTodo, count: null },
    { id: 'someday' as ViewFilter, label: 'Someday', icon: ArchiveIcon, count: tasks.filter(t => t.project === 'someday' && !t.done).length },
    { id: 'logbook' as ViewFilter, label: 'Logbook', icon: CheckSquare, count: completeTasks.length },
    { id: 'all' as ViewFilter, label: 'All Tasks', icon: Layers, count: incompleteCount },
  ]);

  function openSidebarView(nextViewFilter: ViewFilter, nextProjectFilter: string = 'all') {
    viewFilter = nextViewFilter;
    projectFilter = nextProjectFilter;
    viewMode = 'list';
    selectedTaskId = null;
  }

  let viewTitle = $derived.by(() => {
    switch (viewFilter) {
      case 'inbox': return 'Inbox';
      case 'today': return 'Today';
      case 'upcoming': return 'Upcoming';
      case 'overdue': return 'Overdue';
      case 'no-date': return 'No Due Date';
      case 'someday': return 'Someday';
      case 'logbook': return 'Logbook';
      case 'all': return 'All Tasks';
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     LOAD
     ═══════════════════════════════════════════════════════════════════ */
  async function loadAll() {
    try {
      tasks = await listTasks({ limit: 10000 });
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  onMount(() => { loadAll(); });

  // Live-refresh via the realtime data-changed bus: the backend (or an AI
  // agent) emits `tasks/list` after every mutation, so this view re-fetches
  // without a manual refresh. Debounced per-topic in the bus.
  onMount(() => {
    const unregister = registerRefresher('tasks/list', () => loadAll());
    return () => { unregister(); };
  });

  /* ═══════════════════════════════════════════════════════════════════
     UNDO TOAST SYSTEM
     ═══════════════════════════════════════════════════════════════════ */
  interface UndoAction {
    type: 'add' | 'delete' | 'archive' | 'edit';
    task?: TaskEntry;
    taskId?: string;
    previousTitle?: string;
    message: string;
    id: string;
  }

  let undoToasts = $state<UndoAction[]>([]);

  function pushUndo(action: Omit<UndoAction, 'id'>) {
    const entry: UndoAction = { ...action, id: Math.random().toString(36).slice(2) };
    undoToasts = [...undoToasts, entry];
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      undoToasts = undoToasts.filter(t => t.id !== entry.id);
    }, 5000);
  }

  async function executeUndo(action: UndoAction) {
    try {
      if (action.type === 'delete' && action.task) {
        // Re-add the task
        const restored = await saveTask({
          title: action.task.title,
          priority: action.task.priority !== 'none' ? action.task.priority : undefined,
          project: action.task.project,
          dueAt: action.task.dueAt,
          tags: action.task.tags !== '[]' ? action.task.tags : undefined,
        });
        tasks = [restored, ...tasks];
        logActivityEntry(restored.id, 'Task restored (undo delete)').catch(() => {});
      } else if (action.type === 'add' && action.taskId) {
        // Delete the mistakenly added task
        await deleteTaskBackend(action.taskId);
        tasks = tasks.filter(t => t.id !== action.taskId);
        if (selectedTaskId === action.taskId) selectedTaskId = null;
      } else if (action.type === 'edit' && action.taskId && action.previousTitle) {
        // Restore previous title
        const updated = await updateTask({ id: action.taskId, title: action.previousTitle });
        tasks = tasks.map(t => t.id === action.taskId ? updated : t);
      } else if (action.type === 'archive' && action.taskId) {
        // Unarchive the task
        const updated = await updateTask({ id: action.taskId, archived: false });
        tasks = tasks.map(t => t.id === action.taskId ? updated : t);
        logActivityEntry(action.taskId, 'Task unarchived (undo)').catch(() => {});
      }
    } catch (err) {
      console.error('Undo failed:', err);
    }
    undoToasts = undoToasts.filter(t => t.id !== action.id);
  }

  /* ═══════════════════════════════════════════════════════════════════
     INLINE EDITING ON TASK CARDS
     ═══════════════════════════════════════════════════════════════════ */
  let inlineEditTaskId = $state<string | null>(null);
  let inlineEditValue = $state('');

  function startInlineEdit(task: TaskEntry) {
    inlineEditTaskId = task.id;
    inlineEditValue = task.title;
  }

  async function saveInlineEdit() {
    const id = inlineEditTaskId;
    const value = inlineEditValue.trim();
    inlineEditTaskId = null;
    if (!id || !value) return;
    const original = tasks.find(t => t.id === id);
    if (!original || original.title === value) return;
    try {
      const updated = await updateTask({ id, title: value });
      tasks = tasks.map(t => t.id === id ? updated : t);
      logActivityEntry(id, 'Title edited inline').catch(() => {});
    } catch (err) {
      console.error('Failed to edit inline:', err);
    }
  }

  function cancelInlineEdit() {
    inlineEditTaskId = null;
    inlineEditValue = '';
  }

  /* ═══════════════════════════════════════════════════════════════════
     DRAG & DROP REORDERING
     ═══════════════════════════════════════════════════════════════════ */
  let taskListEl = $state<HTMLElement | null>(null);
  let detailPanelEl = $state<HTMLElement | null>(null);
  let sortableInstance: Sortable | null = null;

  async function handleReorder() {
    if (!taskListEl) return;
    const cards = taskListEl.querySelectorAll<HTMLElement>('[data-task-id]');
    const orderedIds: string[] = [];
    cards.forEach(el => { const id = el.dataset.taskId; if (id) orderedIds.push(id); });
    if (orderedIds.length === 0) return;

    // Build a lookup of existing tasks
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const items: ReorderItem[] = [];
    orderedIds.forEach((id, idx) => {
      items.push({ id, sortOrder: (idx + 1) * 1000 });
    });

    try {
      await reorderTasks(items);
      // Update local state
      tasks = tasks.map(t => {
        const found = items.find(i => i.id === t.id);
        return found ? { ...t, sortOrder: found.sortOrder } : t;
      });
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleGlobalKeydown);

    // BUG-12 FIX: tick _todayTick every minute so today/overdue deriveds stay accurate.
    // Also schedule an exact midnight flip so the date rolls over precisely.
    const minuteInterval = setInterval(() => { _todayTick++; }, 60_000);

    function scheduleMidnightFlip() {
      const nowMs = time.now();
      const now = new Date(nowMs);
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - nowMs;
      return setTimeout(() => {
        _todayTick++;
        // Update calendarMonth/Year to follow the new day
        const tomorrow = new Date(time.now());
        calendarMonth = tomorrow.getMonth();
        calendarYear  = tomorrow.getFullYear();
        scheduleMidnightFlip(); // re-schedule for next midnight
      }, msUntilMidnight + 100); // +100ms safety margin
    }
    const midnightTimer = scheduleMidnightFlip();

    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      clearInterval(minuteInterval);
      clearTimeout(midnightTimer);
    };
  });
  $effect(() => {
    // Re-run when tasks change and the list element exists
    if (!taskListEl) return;
    const el = taskListEl;
    if (sortableInstance) {
      sortableInstance.destroy();
    }
    const sortableOptions = {
      animation: 200,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      handle: '.tasks-card-body',
      direction: 'vertical',
      ghostClass: 'tasks-card--ghost',
      dragClass: 'tasks-card--dragging',
      onEnd: () => {
        handleReorder();
      },
    } as any;
    sortableInstance = new Sortable(el, sortableOptions);

    return () => {
      if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
      }
    };
  });

  /* ═══════════════════════════════════════════════════════════════════
     EFFECT — sync detail pane when selection changes
     ═══════════════════════════════════════════════════════════════════ */
  $effect(() => {
    const task = selectedTask;
    if (task) {
      editTitle = task.title;
      editPriority = (task.priority as Priority) || 'none';
      editProject = task.project;
      editNotes = task.notes || '';
      editDueAt = task.dueAt;
      editDueTime = task.dueTime;
      editStartAt = task.startAt;
      editEstimatedMinutes = task.estimatedMinutes;
      editRecurrenceRule = task.recurrenceRule;
      try {
        const parsed = JSON.parse(task.tags || '[]');
        editTags = Array.isArray(parsed) ? parsed.filter((t: unknown): t is string => typeof t === 'string') : [];
      } catch {
        editTags = [];
      }
      // Load subtasks from backend
      listSubtasksForTask(task.id).then(sts => {
        editSubtasks = sts.map(s => ({ id: s.id, title: s.title, done: s.done }));
      }).catch(() => { editSubtasks = []; });
      // Load activity log
      listActivityForTask(task.id, 20).then(entries => {
        editActivity = entries.map(e => ({ id: e.id, timestamp: e.timestamp, text: e.text }));
      }).catch(() => { editActivity = []; });
    } else {
      editTitle = '';
      editPriority = 'none';
      editProject = 'inbox';
      editNotes = '';
      editTags = [];
      editSubtasks = [];
      editDueAt = null;
      editDueTime = null;
      editStartAt = null;
      editEstimatedMinutes = null;
      editRecurrenceRule = null;
      editActivity = [];
    }
  });

  /* ═══════════════════════════════════════════════════════════════════
     TASK ACTIONS
     ═══════════════════════════════════════════════════════════════════ */
  function addContextDefaults(): { project: string; dueAt: number | null } {
    const endOfDay = (offsetDays: number) => {
      const d = new Date(time.now());
      d.setDate(d.getDate() + offsetDays);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    };

    const project =
      projectFilter !== 'all'
        ? projectFilter
        : viewFilter === 'someday'
          ? 'someday'
          : 'inbox';

    if (viewFilter === 'today') return { project, dueAt: endOfDay(0) };
    if (viewFilter === 'upcoming') return { project, dueAt: endOfDay(1) };
    if (viewFilter === 'overdue') return { project, dueAt: endOfDay(-1) };
    return { project, dueAt: null };
  }

  async function addTask() {
    // Accept input from either the inline bar or the quick-add modal
    const raw = (newTaskTitle || quickAddTitle).trim();
    if (!raw) return;

    const parsed = parseTaskInput(raw);
    const finalTitle = parsed.title || raw;
    const defaults = addContextDefaults();

    try {
      const saved = await saveTask({
        title: finalTitle,
        priority: parsed.priority !== 'none' ? parsed.priority : undefined,
        project: defaults.project,
        dueAt: parsed.dueAt ?? defaults.dueAt,
        tags: parsed.tags.length > 0 ? JSON.stringify(parsed.tags) : undefined,
      });

      tasks = [saved, ...tasks];
      newIds = new Set(newIds).add(saved.id);
      // Clear both inputs and close modal
      newTaskTitle = '';
      quickAddTitle = '';
      showQuickAdd = false;

      logActivityEntry(saved.id, 'Task created').catch(() => {});
      pushUndo({ type: 'add', taskId: saved.id, message: 'Task added' });

      setTimeout(() => {
        const s = new Set(newIds);
        s.delete(saved.id);
        newIds = s;
      }, 150);
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  }

  async function toggleTask(id: string) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.done) {
      // Stage 1: spinner (100ms)
      const s = new Set(checkingIds);
      s.add(id);
      checkingIds = s;

      setTimeout(async () => {
        // Stage 2: removal animation starts
        const cs = new Set(checkingIds);
        cs.delete(id);
        checkingIds = cs;

        const rs = new Set(removingIds);
        rs.add(id);
        removingIds = rs;

        setTimeout(async () => {
          try {
            const updated = await toggleTaskBackend(id);
            tasks = tasks.map(t => t.id === id ? updated : t);
            logActivityEntry(id, 'Task completed').catch(() => {});
          } catch (err) {
            console.error('Failed to toggle task:', err);
          }
          const rs2 = new Set(removingIds);
          rs2.delete(id);
          removingIds = rs2;
        }, 350);
      }, 100);
    } else {
      try {
        const updated = await toggleTaskBackend(id);
        tasks = tasks.map(t => t.id === id ? updated : t);
        logActivityEntry(id, 'Task reopened').catch(() => {});
      } catch (err) {
        console.error('Failed to toggle task:', err);
      }
    }
  }

  async function deleteTask(id: string) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await deleteTaskBackend(id);
      tasks = tasks.filter(t => t.id !== id);
      if (selectedTaskId === id) selectedTaskId = null;
      logActivityEntry(id, 'Task deleted').catch(() => {});
      pushUndo({ type: 'delete', task, message: 'Task deleted' });
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  }

  async function archiveTaskAction(id: string) {
    try {
      const archived = await archiveTask(id);
      tasks = tasks.map(t => t.id === id ? archived : t);
      if (selectedTaskId === id) selectedTaskId = null;
      logActivityEntry(id, 'Task archived').catch(() => {});
      pushUndo({ type: 'archive', task: archived, message: 'Task archived' });
    } catch (err) {
      console.error('Failed to archive task:', err);
    }
  }

  async function moveTask(id: string, project: string) {
    try {
      await updateTask({ id, project });
      tasks = tasks.map(t => t.id === id ? { ...t, project } : t);
      logActivityEntry(id, `Moved to ${projects.find(p => p.id === project)?.name ?? project}`).catch(() => {});
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     DETAIL PANE — UPDATE HANDLERS
     ══════════════════════════════════════════════��════════════════════ */
  async function updateField(changes: Partial<UpdateTaskParams>) {
    if (!selectedTaskId) return;
    try {
      const updated = await updateTask({ id: selectedTaskId, ...changes });
      tasks = tasks.map(t => t.id === selectedTaskId ? updated : t);

      // Log significant field changes
      const msgs: string[] = [];
      if ('title' in changes && changes.title && changes.title !== selectedTask?.title) {
        msgs.push('Title changed');
      }
      if ('priority' in changes && changes.priority) {
        msgs.push(`Priority changed to ${changes.priority}`);
      }
      if ('project' in changes && changes.project && changes.project !== selectedTask?.project) {
        msgs.push(`Moved to ${projects.find(p => p.id === changes.project)?.name ?? changes.project}`);
      }
      if ('dueAt' in changes) {
        if (changes.dueAt !== undefined && changes.dueAt !== null) {
          msgs.push('Due date set');
        } else if (changes.dueAt === null) {
          msgs.push('Due date removed');
        }
      }
      if ('recurrenceRule' in changes) {
        if (changes.recurrenceRule !== undefined && changes.recurrenceRule !== null) {
          msgs.push(`Recurrence set to ${changes.recurrenceRule}`);
        } else if (changes.recurrenceRule === null) {
          msgs.push('Recurrence removed');
        }
      }
      if ('archived' in changes) {
        msgs.push(changes.archived ? 'Task archived' : 'Task unarchived');
      }

      for (const msg of msgs) {
        logActivityEntry(selectedTaskId, msg).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }

  function onTitleBlur() {
    if (!selectedTaskId || editTitle === selectedTask?.title) return;
    if (editTitle.trim()) updateField({ title: editTitle.trim() });
  }

  function onTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      (e.target as HTMLInputElement).blur();
    }
  }

  function onPriorityChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as Priority;
    editPriority = val;
    updateField({ priority: val });
  }

  function onPriorityChangeValue(val: Priority) {
    editPriority = val;
    updateField({ priority: val });
  }

  function onProjectChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    editProject = val;
    updateField({ project: val });
  }

  function onProjectChangeValue(val: string) {
    editProject = val;
    updateField({ project: val });
  }

  function onNotesBlur() {
    if (!selectedTaskId || editNotes === selectedTask?.notes) return;
    updateField({ notes: editNotes });
  }

  async function setDueDate(dateMs: number | null) {
    editDueAt = dateMs;
    if (selectedTaskId) {
      await updateField({ dueAt: dateMs });
    }
    if (dateMs === null) showCalendar = false;
  }

  function formatDate(ts: number | null): string {
    if (ts === null) return '';
    return time.formatCustom(ts, 'M j');
  }

  async function addTag() {
    const tag = editTagInput.trim().toLowerCase();
    if (!tag || editTags.includes(tag)) {
      editTagInput = '';
      return;
    }
    editTags = [...editTags, tag];
    editTagInput = '';
    if (selectedTaskId) await updateField({ tags: JSON.stringify(editTags) });
  }

  function onTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
    if (e.key === 'Backspace' && !editTagInput && editTags.length > 0) {
      removeTag(editTags[editTags.length - 1]);
    }
  }

  async function removeTag(tag: string) {
    editTags = editTags.filter(t => t !== tag);
    if (selectedTaskId) await updateField({ tags: JSON.stringify(editTags) });
  }

  function tagColor(tag: string): string {
    const colors = [
      'var(--primary)',
      'color-mix(in srgb, var(--primary) 72%, var(--foreground))',
      'color-mix(in srgb, var(--accent) 78%, var(--foreground))',
      'var(--destructive)',
      'color-mix(in srgb, var(--foreground) 62%, var(--muted))',
      'color-mix(in srgb, var(--primary) 54%, var(--foreground))',
      'color-mix(in srgb, var(--accent) 54%, var(--primary))',
      'color-mix(in srgb, var(--destructive) 58%, var(--foreground))',
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function safeTags(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
    } catch {
      return [];
    }
  }

  function saveCurrentView() {
    const name = `${viewTitle} ${viewMode}`;
    savedViews = [
      { name, viewFilter, priorityFilter, projectFilter, viewMode, query: customFilterText },
      ...savedViews.filter((view) => view.name !== name),
    ].slice(0, 8);
  }

  function applySavedView(view: typeof savedViews[number]) {
    viewFilter = view.viewFilter;
    priorityFilter = view.priorityFilter;
    projectFilter = view.projectFilter;
    viewMode = view.viewMode;
    customFilterText = view.query;
  }

  /* ─── Subtasks ─── */
  let subtaskInput = $state('');

  async function addSubtask() {
    const title = subtaskInput.trim();
    if (!title) return;
    try {
      const saved = await saveSubtask({ taskId: selectedTaskId!, title });
      editSubtasks = [...editSubtasks, { id: saved.id, title: saved.title, done: saved.done }];
      subtaskInput = '';
    } catch (err) {
      console.error('Failed to save subtask:', err);
    }
  }

  async function toggleSubtask(id: string) {
    const current = editSubtasks.find(s => s.id === id);
    if (!current) return;
    const newDone = !current.done;
    editSubtasks = editSubtasks.map(s => s.id === id ? { ...s, done: newDone } : s);
    try {
      await updateSubtaskBackend(id, newDone);
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  }

  async function deleteSubtaskAction(id: string) {
    editSubtasks = editSubtasks.filter(s => s.id !== id);
    try {
      await deleteSubtask(id);
    } catch (err) {
      console.error('Failed to delete subtask:', err);
    }
  }

  let subtaskProgress = $derived.by(() => {
    const total = editSubtasks.length;
    if (total === 0) return null;
    const done = editSubtasks.filter(s => s.done).length;
    return `${done}/${total}`;
  });

  /* ═══════════════════════════════════════════════════════════════════
     CALENDAR VIEW (Anytype-ported block-grid)
     ═══════════════════════════════════════════════════════════════════ */

  // Separate month/year state for the calendar VIEW (not the due-date picker)
  let calViewMonth = $state(time.getDate(time.now()).month - 1);
  let calViewYear  = $state(time.getDate(time.now()).year);
let calViewMonthStr = $state(String(time.getDate(time.now()).month - 1));  let calViewYearStr  = $state(String(time.getDate(time.now()).year));  $effect(() => { calViewMonth = parseInt(calViewMonthStr, 10); });  $effect(() => { calViewYear  = parseInt(calViewYearStr, 10); });

  let monthOptions = [
    { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
    { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
    { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
    { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' },
  ];
  let yearOptions = Array.from({ length: 20 }, (_, i) => ({
    value: String(time.getDate(time.now()).year - 5 + i),
    label: String(time.getDate(time.now()).year - 5 + i),
  }));

  // calTasks is DERIVED from the main tasks array so toggleDone/edits
  // reflect instantly. A secondary fetch loads tasks not yet in memory.
  let calExtraFetched = $state<TaskEntry[]>([]);
  let calLoading = $state(false);

  function _calRangeStart(): number {
    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);
    const firstDow = (firstOfMonth.getDay() + 6) % 7;
    return new Date(calViewYear, calViewMonth, 1 - firstDow, 0, 0, 0, 0).getTime();
  }
  const calRangeStart = $derived(_calRangeStart());
  const calRangeEnd = $derived(_calRangeStart() + 42 * 24 * 60 * 60 * 1000 - 1);

  // Primary: live slice of main tasks. Secondary: extra fetched tasks.
  const calTasks = $derived.by(() => {
    const seen = new Set(tasks.map(t => t.id));
    return [...tasks, ...calExtraFetched.filter(t => !seen.has(t.id))];
  });

  async function loadCalMonth() {
    calLoading = true;
    try {
      const fetched = await listTasks({
        dueAfter:  _calRangeStart(),
        dueBefore: _calRangeStart() + 42 * 24 * 60 * 60 * 1000 - 1,
        limit:     500,
      });
      const mainIds = new Set(tasks.map(t => t.id));
      calExtraFetched = fetched.filter(t => !mainIds.has(t.id));
    } catch (err) {
      console.error('[cal] loadCalMonth failed:', err);
    } finally {
      calLoading = false;
    }
  }

  // Reload whenever the visible month/year changes
  $effect(() => {
    // Track both reactive vars so the effect re-runs on navigation
    void calViewMonth;
    void calViewYear;
    loadCalMonth();
  });

  // Listen for tasks created anywhere in the app (Dashboard quick-add,
  // other modules, etc.) and reload the calendar view.
  onMount(() => {
    const refresh = () => loadCalMonth();
    window.addEventListener('bento:dashboard-refresh', refresh);
    window.addEventListener('bento:task-created',      refresh);
    return () => {
      window.removeEventListener('bento:dashboard-refresh', refresh);
      window.removeEventListener('bento:task-created',      refresh);
    };
  });

  // Listen for flyout panel navigation (Search, Activity panels)
  onMount(() => {
    const handleNavigate = (e: Event) => {
      const { taskId } = (e as CustomEvent<{ taskId: string }>).detail;
      if (taskId) selectedTaskId = taskId;
    };
    window.addEventListener('bento:tasks-navigate', handleNavigate);
    return () => window.removeEventListener('bento:tasks-navigate', handleNavigate);
  });

  // Listen for saved-views flyout applying a view
  onMount(() => {
    const handleApplyView = (e: Event) => {
      const { viewFilter: vf, viewMode: vm, priorityFilter: pf, projectFilter: proj, query: q } = (e as CustomEvent).detail;
      if (vf) viewFilter = vf as ViewFilter;
      if (vm) viewMode = vm as ViewMode;
      if (pf) priorityFilter = pf as Priority | 'all';
      if (proj) projectFilter = proj;
      if (q !== undefined) customFilterText = q;
    };
    window.addEventListener('bento:tasks-apply-view', handleApplyView);
    return () => window.removeEventListener('bento:tasks-apply-view', handleApplyView);
  });

  // Overflow popover state
  let calOverflow = $state<{
    x: number; y: number;
    day: number; month: number; year: number;
    tasks: TaskEntry[];
  } | null>(null);

  // Quick-add bar state
  let calQuickAddTarget = $state<{ day: number; month: number; year: number } | null>(null);
  let calQuickAddTitle  = $state('');

  /** Generate the 6×7 cell grid for the current cal view month.
   *  Mirrors Anytype's U.Date.getCalendarMonth() */
  function calViewData(): Array<{
    d: number; m: number; y: number;
    isOtherMonth: boolean; isToday: boolean;
    isWeekend: boolean; isFirstRow: boolean;
    wd: number; // 0=Mon … 6=Sun (Anytype convention)
  }> {
    const todayObj = new Date(time.now());
    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);
    const lastOfMonth  = new Date(calViewYear, calViewMonth + 1, 0);

    // getDay() returns 0=Sun, convert to 0=Mon
    const rawDow = (firstOfMonth.getDay() + 6) % 7; // Mon-based start
    const cells: ReturnType<typeof calViewData> = [];

    // Leading days from previous month
    const prevLast = new Date(calViewYear, calViewMonth, 0);
    for (let i = rawDow - 1; i >= 0; i--) {
      const d = prevLast.getDate() - i;
      const m = calViewMonth - 1 < 0 ? 11 : calViewMonth - 1;
      const y = calViewMonth - 1 < 0 ? calViewYear - 1 : calViewYear;
      const wd = ((new Date(y, m, d).getDay()) + 6) % 7;
      cells.push({
        d, m, y, isOtherMonth: true,
        isToday: false, isWeekend: wd >= 5,
        isFirstRow: cells.length < 7, wd,
      });
    }

    // Current month days
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      const wd = ((new Date(calViewYear, calViewMonth, d).getDay()) + 6) % 7;
      const isTod = todayObj.getFullYear() === calViewYear
        && todayObj.getMonth() === calViewMonth
        && todayObj.getDate() === d;
      cells.push({
        d, m: calViewMonth, y: calViewYear,
        isOtherMonth: false, isToday: isTod,
        isWeekend: wd >= 5, isFirstRow: false, wd,
      });
    }

    // Trailing days from next month
    const remaining = 42 - cells.length;
    const nextM = (calViewMonth + 1) % 12;
    const nextY = calViewMonth === 11 ? calViewYear + 1 : calViewYear;
    for (let d = 1; d <= remaining; d++) {
      const wd = ((new Date(nextY, nextM, d).getDay()) + 6) % 7;
      cells.push({
        d, m: nextM, y: nextY,
        isOtherMonth: true, isToday: false,
        isWeekend: wd >= 5, isFirstRow: false, wd,
      });
    }

    return cells;
  }

  /** Return all tasks whose dueAt falls on a specific calendar day. */
  function calTasksOnDay(d: number, m: number, y: number): TaskEntry[] {
    const start = new Date(y, m, d, 0, 0, 0, 0).getTime();
    const end   = new Date(y, m, d, 23, 59, 59, 999).getTime();
    return tasks.filter(t =>
      t.dueAt !== null && t.dueAt >= start && t.dueAt <= end && !t.archived
    );
  }

  function calPrevMonth() {
    if (calViewMonth === 0) { calViewMonth = 11; calViewYear--; }
    else calViewMonth--;
  }

  function calNextMonth() {
    if (calViewMonth === 11) { calViewMonth = 0; calViewYear++; }
    else calViewMonth++;
  }

  function calGoToday() {
    const n = new Date(time.now());
    calViewMonth = n.getMonth();
    calViewYear  = n.getFullYear();
  }

  /** Open the quick-add bar pinned to a specific cell. */
  function calQuickAdd(d: number, m: number, y: number) {
    calQuickAddTarget = { day: d, month: m, year: y };
    calQuickAddTitle  = '';
  }

  async function calSubmitQuickAdd() {
    const t = calQuickAddTarget;
    const title = calQuickAddTitle.trim();
    if (!t || !title) return;

    const dueAt = new Date(t.year, t.month, t.day, 12, 0, 0).getTime();
    calQuickAddTarget = null;
    calQuickAddTitle  = '';

    try {
      const saved = await saveTask({ title, dueAt, project: 'inbox' });
      tasks = [saved, ...tasks];
      logActivityEntry(saved.id, 'Task created from calendar').catch(() => {});
    } catch (err) {
      console.error('[cal] addTask failed:', err);
    }
  }

  function calOpenOverflow(
    e: MouseEvent,
    d: number, m: number, y: number,
    dayTasks: TaskEntry[],
  ) {
    const rect = (e.currentTarget as HTMLElement).closest('.tasks-cal-day')!.getBoundingClientRect();
    const container = (e.currentTarget as HTMLElement).closest('.tasks-cal')!.getBoundingClientRect();
    calOverflow = {
      x: rect.left - container.left,
      y: rect.bottom - container.top + 4,
      day: d, month: m, year: y,
      tasks: dayTasks,
    };
  }
  function calendarDays() {
    const first = new Date(calendarYear, calendarMonth, 1);
    const last = new Date(calendarYear, calendarMonth + 1, 0);
    const startDow = first.getDay();
    const days: { day: number; month: number; year: number; isOther: boolean }[] = [];

    // Previous month overflow
    const prevLast = new Date(calendarYear, calendarMonth, 0);
    for (let i = startDow - 1; i >= 0; i--) {
      days.push({ day: prevLast.getDate() - i, month: calendarMonth - 1, year: calendarYear, isOther: true });
    }

    // Current month
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ day: i, month: calendarMonth, year: calendarYear, isOther: false });
    }

    // Next month overflow
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, month: calendarMonth + 1, year: calendarYear, isOther: true });
    }

    return days;
  }

  function isToday(day: number, month: number, year: number): boolean {
    const d = new Date(time.now());
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  }

  function isSelected(day: number, month: number, year: number): boolean {
    if (!editDueAt) return false;
    const d = new Date(editDueAt);
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  }

  function selectCalendarDay(day: number, month: number, year: number) {
    const d = new Date(year, month, day, 23, 59, 59, 999);
    setDueDate(d.getTime());
    showCalendar = false;
  }

  function prevMonth() {
    if (calendarMonth === 0) { calendarMonth = 11; calendarYear--; }
    else { calendarMonth--; }
  }

  function nextMonth() {
    if (calendarMonth === 11) { calendarMonth = 0; calendarYear++; }
    else { calendarMonth++; }
  }

  /* ═══════════════════════════════════════════════════════════════════
     NLP PARSER
     ═══════════════════════════════════════════════════════════════════ */
  function parseTaskInput(input: string): { title: string; priority: Priority; dueAt: number | null; tags: string[] } {
    let title = input;
    let priority: Priority = 'none';
    let dueDateStr: string | null = null;
    let tags: string[] = [];

    // Extract priority markers
    const priorityPatterns: [RegExp, Priority][] = [
      [/(?:^|\s)(!1|p1|urgent|!!)\s*/i, 'urgent'],
      [/(?:^|\s)(!2|p2|high)\s*/i, 'high'],
      [/(?:^|\s)(!3|p3|medium|!)\s*/i, 'medium'],
    ];
    for (const [pattern, p] of priorityPatterns) {
      if (priority !== 'none') break;
      const m = title.match(pattern);
      if (m) { priority = p; title = title.replace(m[0], ' '); }
    }

    // Extract tags (#word)
    title = title.replace(/#(\w+)/g, (_, tag: string) => {
      tags.push(tag.toLowerCase());
      return '';
    });

    // Date parsing
    const lower = title.toLowerCase();
    const now = new Date(time.dayStart(time.now()));

    // "tomorrow at 3pm" pattern
    const atTimeMatch = lower.match(/\b(tomorrow|today|next week|next month)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (atTimeMatch) {
      const dayRef = atTimeMatch[1].toLowerCase();
      const hours = parseInt(atTimeMatch[2]);
      const minutes = atTimeMatch[3] ? parseInt(atTimeMatch[3]) : 0;
      const isPM = atTimeMatch[4]?.toLowerCase() === 'pm';

      let baseDate = new Date(now);
      if (dayRef === 'tomorrow') baseDate.setDate(baseDate.getDate() + 1);
      else if (dayRef === 'next week') baseDate.setDate(baseDate.getDate() + 7);
      else if (dayRef === 'next month') baseDate.setMonth(baseDate.getMonth() + 1);

      const finalH = isPM ? (hours % 12) + 12 : hours % 12;
      baseDate.setHours(finalH, minutes, 0, 0);
      dueDateStr = baseDate.toISOString();
      title = title.replace(atTimeMatch[0], '');
    }

    // Simple date keywords
    const tomorrowMatch = lower.match(/\btomorrow\b/);
    if (tomorrowMatch && !dueDateStr) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(tomorrowMatch[0], '');
    }

    const todayMatch = lower.match(/\btoday\b/);
    if (todayMatch && !dueDateStr) {
      const d = new Date(now);
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(todayMatch[0], '');
    }

    const nextWeekMatch = lower.match(/\bnext week\b/);
    if (nextWeekMatch && !dueDateStr) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(nextWeekMatch[0], '');
    }

    title = title.replace(/\s+/g, ' ').trim();

    let dueAt: number | null = null;
    if (dueDateStr) {
      dueAt = new Date(dueDateStr).getTime();
    }

    return { title: title || input.trim(), priority, dueAt, tags };
  }

  /* ═══════════════════════════════════════════════════════════════════
     TIMER
     ═══════════════════════════════════════════════════════════════════ */
  function toggleTimer() {
    if (timerRunning) {
      // Stop
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
      // Persist tracked minutes to backend
      const trackedMin = Math.round(timerElapsed / 60000);
      if (selectedTaskId && trackedMin > 0) {
        updateField({ trackedMinutes: (selectedTask?.trackedMinutes ?? 0) + trackedMin }).catch(() => {});
      }
      timerStartMs = null;
    } else {
      // Start
      timerStartMs = time.now();
      timerRunning = true;
      timerInterval = setInterval(() => {
        if (timerStartMs !== null) {
          timerElapsed = time.now() - timerStartMs;
        }
      }, 200);
    }
  }

  function formatElapsed(ms: number): string {
    if (ms <= 0) return '0m';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /* ═══════════════════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════════════════ */
  function isOverdue(ts: number | null): boolean {
    return ts !== null && ts < time.now();
  }

  function formatDueDate(ts: number | null): string | null {
    if (ts === null) return null;
    const d = new Date(ts);
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = Math.round((dateOnly.getTime() - todayOnly.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0 && diff <= 7) return time.formatCustom(ts, 'D');
    return time.formatCustom(ts, 'M j');
  }

  function priorityLabel(p: string): string {
    switch (p) {
      case 'urgent': return 'Urgent';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'none': return 'None';
      default: return p;
    }
  }

  function priorityColor(p: string): string {
    switch (p) {
      case 'urgent': return 'var(--destructive)';
      case 'high': return 'color-mix(in srgb, var(--primary) 78%, var(--foreground))';
      case 'medium': return 'var(--primary)';
      default: return 'var(--muted)';
    }
  }

  function getProjectColor(id: string): string {
    return projects.find(p => p.id === id)?.color ?? 'var(--primary)';
  }

  function getEmptyText(): string {
    switch (viewFilter) {
      case 'inbox': return "You're clear.";
      case 'today': return 'Nothing due. Enjoy it.';
      case 'upcoming': return 'Nothing upcoming.';
      case 'overdue': return 'All caught up.';
      case 'no-date': return 'No unscheduled tasks.';
      case 'someday': return 'Nothing saved for later.';
      case 'logbook': return 'No completed tasks yet.';
      case 'all': return 'No tasks yet. Add one above.';
    }
  }

  const emptyIconComponent = $derived.by(() => {
    switch (viewFilter) {
      case 'inbox': return Inbox;
      case 'today': return Calendar;
      case 'overdue': return CheckSquare;
      default: return ListTodo;
    }
  });

  function openContextMenu(e: MouseEvent, taskId: string) {
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    contextMenuTaskId = taskId;
    showContextMenu = true;
  }

  /* ═══════════════════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS
     ═══════════════════════════════════════════════════════════════════ */
  function handleGlobalKeydown(e: KeyboardEvent) {
    // Cmd+K — quick add
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showQuickAdd = true;
      quickAddTitle = '';
      selectedTemplate = null;
      setTimeout(() => document.getElementById('quick-add-input')?.focus(), 50);
    }

    // Cmd+N — quick add (alternative)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      showQuickAdd = true;
      quickAddTitle = '';
      selectedTemplate = null;
      setTimeout(() => document.getElementById('quick-add-input')?.focus(), 50);
    }

    // Cmd+D — duplicate task (if one selected)
    if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedTaskId) {
      e.preventDefault();
      duplicateTaskAction(selectedTaskId);
    }

    // Cmd+Shift+F — Focus Mode
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      focusMode = !focusMode;
    }

    // Cmd+/ — Show keyboard shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      showShortcuts = !showShortcuts;
    }

    // Escape — close overlays
    if (e.key === 'Escape') {
      if (showQuickAdd) { showQuickAdd = false; return; }
      if (showImport) { showImport = false; return; }
      if (showShortcuts) { showShortcuts = false; return; }
      if (focusMode) { focusMode = false; return; }
      if (selectedTaskId) { selectedTaskId = null; return; }
    }

    // P then 1/2/3/4 — set priority on selected task
    if (e.key === 'p' || e.key === 'P') {
      if (!selectedTaskId) return;
      const handlePriority = (ev: KeyboardEvent) => {
        document.removeEventListener('keydown', handlePriority);
        const map: Record<string, string> = { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'none' };
        if (map[ev.key]) {
          updateField({ priority: map[ev.key] as Priority });
        }
      };
      document.addEventListener('keydown', handlePriority);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     OVERDUE RESCHEDULE DIALOG
     ═══════════════════════════════════════════════════════════════════ */
  let overdueTasksToReschedule = $derived(
    tasks.filter(t => !t.done && t.dueAt !== null && t.dueAt < time.now() && t.project !== 'someday')
  );

  function openReschedule() {
    const actions = new Map<string, 'leave' | 'tomorrow' | 'next-week' | 'next-month' | 'someday' | 'archive'>();
    for (const t of overdueTasksToReschedule) {
      actions.set(t.id, 'leave');
    }
    rescheduleActions = actions;
    showReschedule = true;
  }

  async function applyReschedule() {
    const nowMs = time.now();
    const now = new Date(nowMs);
    showReschedule = false;

    for (const [taskId, action] of rescheduleActions) {
      if (action === 'leave') continue;

      try {
        if (action === 'archive') {
          const archived = await archiveTask(taskId);
          tasks = tasks.map(t => t.id === taskId ? archived : t);
          logActivityEntry(taskId, 'Archived via overdue reschedule').catch(() => {});
        } else if (action === 'someday') {
          await updateTask({ id: taskId, project: 'someday' });
          tasks = tasks.map(t => t.id === taskId ? { ...t, project: 'someday' } : t);
          logActivityEntry(taskId, 'Moved to Someday via overdue reschedule').catch(() => {});
        } else {
          const d = new Date(now);
          d.setHours(23, 59, 59, 999);
          if (action === 'tomorrow') d.setDate(d.getDate() + 1);
          else if (action === 'next-week') d.setDate(d.getDate() + 7);
          else if (action === 'next-month') d.setMonth(d.getMonth() + 1);
          await updateTask({ id: taskId, dueAt: d.getTime() });
          tasks = tasks.map(t => t.id === taskId ? { ...t, dueAt: d.getTime() } : t);
          logActivityEntry(taskId, `Rescheduled to ${time.formatCustom(d.getTime(), 'M j')} via overdue rescue`).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to apply reschedule action:', err);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     QUICK ADD & DUPLICATE
     ═══════════════════════════════════��═══════════════════════════════ */
  async function submitQuickAdd() {
    const title = quickAddTitle.trim();
    if (!title) return;
    const parsed = parseTaskInput(title);

    try {
      const saved = await saveTask({
        title: parsed.title || title,
        priority: parsed.priority !== 'none' ? parsed.priority : undefined,
        dueAt: parsed.dueAt,
        tags: parsed.tags.length > 0 ? JSON.stringify(parsed.tags) : undefined,
      });
      tasks = [saved, ...tasks];
      newIds = new Set(newIds).add(saved.id);
      logActivityEntry(saved.id, 'Task created via quick add').catch(() => {});
      setTimeout(() => {
        const s = new Set(newIds);
        s.delete(saved.id);
        newIds = s;
      }, 150);
    } catch (err) {
      console.error('Failed to quick-add:', err);
    }

    showQuickAdd = false;
    quickAddTitle = '';
    selectedTemplate = null;
  }

  // ─── Templates ───
  const templates = [
    { label: 'Morning Routine', title: 'Morning routine 🧘', subtasks: ['Meditate 5min', 'Plan top 3 goals', 'Review calendar'] },
    { label: 'Project Kickoff', title: 'Kick off new project 🚀', subtasks: ['Define scope', 'Set milestones', 'Assign roles', 'Schedule kickoff meeting'] },
    { label: 'Weekly Review', title: 'Weekly review 📋', subtasks: ['Review completed tasks', 'Check upcoming deadlines', 'Update project status', 'Plan next week'] },
    { label: 'Bug Report', title: 'Bug: [describe] 🐛', priority: 'urgent' as Priority, subtasks: ['Reproduce steps', 'Expected vs actual', 'Environment details', 'Attach logs'] },
    { label: 'Meeting Prep', title: 'Prep for [meeting] 📅', subtasks: ['Review agenda', 'Prepare notes', 'Gather materials', 'Confirm attendees'] },
    { label: 'Content Creation', title: 'Create [content] ✍️', subtasks: ['Research topic', 'Outline structure', 'Draft content', 'Review and revise', 'Publish'] },
  ];

  function applyTemplate(tmpl: typeof templates[0]) {
    quickAddTitle = tmpl.title;
    selectedTemplate = tmpl.label;
  }

  async function submitQuickAddWithTemplate() {
    const title = quickAddTitle.trim();
    if (!title) return;

    const tmpl = selectedTemplate ? templates.find(t => t.label === selectedTemplate) : null;

    try {
      const saved = await saveTask({
        title,
        priority: tmpl?.priority !== 'none' ? tmpl?.priority : undefined,
        project: viewFilter === 'someday' ? 'someday' : 'inbox',
      });

      // Create subtasks if template has them
      if (tmpl?.subtasks) {
        for (const st of tmpl.subtasks) {
          await saveTask({ title: st, parentId: saved.id, project: 'inbox' });
        }
      }

      tasks = [saved, ...tasks];
      newIds = new Set(newIds).add(saved.id);
      logActivityEntry(saved.id, 'Task created via template').catch(() => {});
      setTimeout(() => {
        const s = new Set(newIds);
        s.delete(saved.id);
        newIds = s;
      }, 150);
    } catch (err) {
      console.error('Failed to quick-add template:', err);
    }

    showQuickAdd = false;
    quickAddTitle = '';
    selectedTemplate = null;
  }

  function onQuickAddKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedTemplate) {
        submitQuickAddWithTemplate();
      } else {
        submitQuickAdd();
      }
    }
    if (e.key === 'Escape') {
      showQuickAdd = false;
    }
  }

  async function duplicateTaskAction(id: string) {
    const original = tasks.find(t => t.id === id);
    if (!original) return;
    try {
      const saved = await duplicateTask(id);
      tasks = [saved, ...tasks];
      selectedTaskId = saved.id;
      logActivityEntry(saved.id, 'Duplicated from existing task').catch(() => {});
    } catch (err) {
      console.error('Failed to duplicate task:', err);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     BULK ACTIONS
     ═══════════════════════════════════════════════════════════════════ */
  function toggleBulkSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
    bulkMode = next.size > 0;
  }

  async function bulkDelete() {
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await deleteTaskBackend(id);
        logActivityEntry(id, 'Task deleted (bulk)').catch(() => {});
      } catch { /* skip */ }
    }
    tasks = tasks.filter(t => !selectedIds.has(t.id));
    selectedIds = new Set();
    bulkMode = false;
  }

  async function bulkComplete() {
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        const updated = await toggleTaskBackend(id);
        tasks = tasks.map(t => t.id === id ? updated : t);
        logActivityEntry(id, 'Task completed (bulk)').catch(() => {});
      } catch { /* skip */ }
    }
    selectedIds = new Set();
    bulkMode = false;
  }

  async function bulkMoveTo(project: string) {
    const ids = [...selectedIds];
    const projectName = projects.find(p => p.id === project)?.name ?? project;
    for (const id of ids) {
      try {
        await updateTask({ id, project });
        tasks = tasks.map(t => t.id === id ? { ...t, project } : t);
        logActivityEntry(id, `Moved to ${projectName} (bulk)`).catch(() => {});
      } catch { /* skip */ }
    }
    selectedIds = new Set();
    bulkMode = false;
  }

  async function bulkSetPriority(priority: Priority) {
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await updateTask({ id, priority });
        tasks = tasks.map(t => t.id === id ? { ...t, priority } : t);
        logActivityEntry(id, `Priority set to ${priority} (bulk)`).catch(() => {});
      } catch { /* skip */ }
    }
    selectedIds = new Set();
    bulkMode = false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     DENSITY TOGGLE
     ═══════════════════════════════════════════════════════════════════ */
  let densityIndex = $state(0);
  const densityOptions: Density[] = ['comfortable', 'compact', 'spacious'];

  function cycleDensity() {
    densityIndex = (densityIndex + 1) % 3;
    density = densityOptions[densityIndex];
  }

  /* ═══════════════════════════════════════════════════════════════════
     EXPORT
     ═══════════════════════════════════════════════════════════════════ */

  function escapeCsv(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  function generateCsv(all: TaskEntry[]): string {
    const headers = ['id','title','done','priority','project','tags','notes','dueAt','dueTime','startAt','estimatedMinutes','trackedMinutes','recurrenceRule','archived','completedAt','createdAt'];
    const rows = all.map(t => [
      t.id, t.title, t.done ? 'true' : 'false', t.priority, t.project,
      t.tags, t.notes ?? '', t.dueAt?.toString() ?? '', t.dueTime ?? '',
      t.startAt?.toString() ?? '', t.estimatedMinutes?.toString() ?? '',
      t.trackedMinutes.toString(), t.recurrenceRule ?? '',
      t.archived ? 'true' : 'false',
      t.completedAt?.toString() ?? '', time.toISODateTime(t.createdAt),
    ].map(v => escapeCsv(v)).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  function generateJson(all: TaskEntry[]): string {
    return JSON.stringify(all, null, 2);
  }

  function generateMarkdown(all: TaskEntry[]): string {
    const lines: string[] = ['# Bento Tasks Export', '', `_Generated ${time.format(time.now())}_`, '', '---', ''];
    const incomplete = all.filter(t => !t.done);
    const complete = all.filter(t => t.done);

    lines.push('## Incomplete Tasks', '');
    if (incomplete.length === 0) {
      lines.push('*No incomplete tasks.*', '');
    } else {
      for (const t of incomplete) {
        const priorityMark = t.priority === 'urgent' ? ' 🔴' : t.priority === 'high' ? ' 🟠' : t.priority === 'medium' ? ' 🔵' : '';
        const dueStr = t.dueAt ? ` *(due ${time.formatCustom(t.dueAt, 'M j')}${t.dueTime ? ' at ' + t.dueTime : ''})*` : '';
        const projectStr = t.project !== 'inbox' ? ` \`[${t.project}]\`` : '';
        lines.push(`- [ ] **${t.title}**${priorityMark}${dueStr}${projectStr}`);
        if (t.notes) lines.push(`  - ${t.notes.replace(/\n/g, '\n  ')}`);
        if (t.tags && t.tags !== '[]') {
          const tags = JSON.parse(t.tags) as string[];
          if (tags.length > 0) lines.push(`  \`Tags: ${tags.join(', ')}\``);
        }
      }
    }

    lines.push('', '## Completed Tasks', '');
    if (complete.length === 0) {
      lines.push('*No completed tasks.*', '');
    } else {
      for (const t of complete) {
        const dateStr = t.completedAt ? ` *(completed ${time.formatDate(t.completedAt)})*` : '';
        lines.push(`- [x] **${t.title}**${dateStr}`);
      }
    }

    lines.push('', '---', `_${all.length} total tasks_`);
    return lines.join('\n');
  }

  async function handleExport() {
    if (isExporting) return;
    isExporting = true;
    exportResult = null;

    try {
      // Fetch all tasks from backend
      const allTasks = await listTasks({ limit: 10000 });

      let content: string;
      let defaultName: string;
      let extension: string;
      let filterName: string;

      switch (exportFormat) {
        case 'csv':
          content = generateCsv(allTasks);
          defaultName = `bento-tasks-${time.toISODate(time.now())}.csv`;
          extension = 'csv';
          filterName = 'CSV';
          break;
        case 'json':
          content = generateJson(allTasks);
          defaultName = `bento-tasks-${time.toISODate(time.now())}.json`;
          extension = 'json';
          filterName = 'JSON';
          break;
        case 'markdown':
          content = generateMarkdown(allTasks);
          defaultName = `bento-tasks-${time.toISODate(time.now())}.md`;
          extension = 'md';
          filterName = 'Markdown';
          break;
      }

      const path = await exportContentToFile(content, defaultName, extension, filterName);
      if (path !== null) {
        exportResult = `Exported to ${path}`;
      }
    } catch (err) {
      console.error('Export failed:', err);
      exportResult = `Export failed: ${err}`;
    }

    isExporting = false;
  }

  /* ═══════════════════════════════════════════════════════════════════
     IMPORT
     ═══════════════════════════════════════════════════════════════════ */
  async function handlePickImport() {
    try {
      const result = await pickImportFile();
      if (!result) return;

      const preview = parseImportContent(result.fileName, result.content);

      // Build existing title map for conflict detection
      const existingTitles = new Map<string, { id: string; title: string; done: boolean }>();
      for (const t of tasks) {
        const key = t.title.trim().toLowerCase();
        if (!existingTitles.has(key)) {
          existingTitles.set(key, { id: t.id, title: t.title, done: t.done });
        }
      }

      const conflicts = detectConflicts(preview.entries, existingTitles);
      preview.conflicts = conflicts;

      const resolutions = new Map<number, 'skip' | 'overwrite' | 'duplicate'>();
      for (const c of conflicts) {
        resolutions.set(c.rowIndex, 'skip');
      }

      importPreview = preview;
      importConflictResolutions = resolutions;
      importResult = null;
    } catch (err) {
      console.error('Import pick failed:', err);
      importResult = { imported: 0, skipped: 0, errors: [`Failed to read file: ${err}`] };
    }
  }

  function setConflictResolution(rowIndex: number, resolve: 'skip' | 'overwrite' | 'duplicate') {
    const next = new Map(importConflictResolutions);
    next.set(rowIndex, resolve);
    importConflictResolutions = next;
  }

  async function handleExecuteImport() {
    if (!importPreview) return;
    isImporting = true;

    try {
      const existingTitles = new Map<string, { id: string; title: string }>();
      for (const t of tasks) {
        const key = t.title.trim().toLowerCase();
        if (!existingTitles.has(key)) {
          existingTitles.set(key, { id: t.id, title: t.title });
        }
      }

      const conflicts = importPreview.conflicts.map(c => ({
        ...c,
        resolve: importConflictResolutions.get(c.rowIndex) ?? 'skip' as const,
      }));

      const result = await executeImport(importPreview, conflicts, existingTitles, saveTask);
      importResult = result;

      // Reload tasks
      try {
        tasks = await listTasks({ limit: 10000 });
      } catch { /* ignore */ }
    } catch (err) {
      importResult = { imported: 0, skipped: 0, errors: [`Import failed: ${err}`] };
    }

    isImporting = false;
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════════
     3-PANEL LAYOUT
     ═══════════════════════════════════════════════════════════════════ -->
<div
  class="tasks-app"
  class:detail-open={!!selectedTask}
  class:density-compact={density === 'compact'}
  class:density-spacious={density === 'spacious'}
  class:focus-mode={focusMode}
  style="--tasks-sidebar-width: {sidebarWidth}px; --tasks-list-width: {listWidth}px;"
>
  <!-- ─── SIDEBAR ─── -->
  <aside class="tasks-sidebar">
    <div class="tasks-sidebar-header">
      <div class="tasks-sidebar-logo">B</div>
      <h1 class="tasks-sidebar-wordmark">Bento Tasks</h1>
    </div>

    <!-- Smart Lists -->
    <div class="tasks-sidebar-section-label">Views</div>
    <nav class="tasks-sidebar-nav">
      {#each sidebarNavItems as item}
        <button
          class="tasks-sidebar-item"
          class:active={viewFilter === item.id}
          onclick={() => openSidebarView(item.id)}
        >
          <item.icon class="tasks-sidebar-item-icon" size={16} />
          <span>{item.label}</span>
          {#if item.count !== null && item.count > 0}
            <span class="tasks-sidebar-badge number number-tabular">{item.count}</span>
          {/if}
        </button>
      {/each}
    </nav>

    <!-- Projects -->
    <div class="tasks-sidebar-section-label">Projects</div>
    <div class="tasks-sidebar-section">
      {#each projects.filter(p => p.id !== 'inbox') as project}
        <button
          class="tasks-sidebar-project"
          class:active={projectFilter === project.id}
          onclick={() => openSidebarView('all', projectFilter === project.id ? 'all' : project.id)}
        >
          <span class="tasks-sidebar-project-dot" style="background: {project.color}"></span>
          <span>{project.name}</span>
        </button>
      {/each}
    </div>

    <!-- Settings Footer -->
    <div class="tasks-sidebar-footer">
      <button class="tasks-sidebar-settings-btn" onclick={cycleDensity} use:tooltip={{ text: "Cycle density" }}>
        <Layers size={14} />
        <span>{density === 'comfortable' ? 'Comfortable' : density === 'compact' ? 'Compact' : 'Spacious'}</span>
      </button>
      <button class="tasks-sidebar-settings-btn" onclick={() => { showExport = true; exportResult = null; }} use:tooltip={{ text: "Export tasks" }}>
        <Download size={14} />
        <span>Export</span>
      </button>
      <button class="tasks-sidebar-settings-btn" onclick={() => { showImport = true; importPreview = null; importResult = null; }} use:tooltip={{ text: "Import tasks" }}>
        <FileText size={14} />
        <span>Import</span>
      </button>
      <button class="tasks-sidebar-settings-btn" onclick={openShare} use:tooltip={{ text: "Share tasks" }}>
        <Share2 size={14} />
        <span>Share</span>
      </button>
    </div>

  </aside>

  <!-- ─── TASK LIST ─── -->
  <section class="tasks-list-panel">
    <!-- Header -->      <div class="tasks-list-panel-header">
      <h2>{viewTitle}</h2>
      <div class="tasks-list-panel-header-right">
        <div class="tasks-view-switcher">
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'calendar'} onclick={() => viewMode = 'calendar'}>Calendar</button>
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'list'} onclick={() => viewMode = 'list'}>List</button>
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'board'} onclick={() => viewMode = 'board'}>Board</button>
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'table'} onclick={() => viewMode = 'table'}>Table</button>
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'timeline'} onclick={() => viewMode = 'timeline'}>Timeline</button>
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'focus'} onclick={() => viewMode = 'focus'} use:tooltip={{ text: "Minimal view — only the next action (Ctrl+Shift+F)" }}>Focus</button>
          <button class="tasks-view-switcher-btn" class:active={viewMode === 'mind'} onclick={() => viewMode = 'mind'}>Map</button>
        </div>
        <span class="tasks-list-panel-count number number-tabular">{visibleTasks.length}</span>
      </div>
    </div>

    <!-- Overdue Banner (Today view) -->
    {#if viewFilter === 'today' && overdueCount > 0}
      <div class="tasks-overdue-banner">
        <AlertCircle size={13} style="color: var(--destructive); flex-shrink: 0;" />
        <span><strong class="number number-tabular number-semibold">{overdueCount}</strong> {overdueCount === 1 ? 'task is' : 'tasks are'} overdue</span>
        <button class="tasks-overdue-banner-btn" onclick={() => viewFilter = 'overdue'}>Review</button>
        <button class="tasks-overdue-banner-btn" onclick={() => { openReschedule(); }}>Reschedule</button>
      </div>
    {/if}

    <!-- Stats -->
    {#if overdueCount > 0 && viewFilter !== 'today' && viewFilter !== 'overdue' && viewFilter !== 'logbook'}
      <div class="tasks-stats">
        <span class="tasks-stat"><strong class="number number-tabular number-semibold" style="color: var(--destructive)">{overdueCount}</strong> overdue</span>
      </div>
    {/if}

    <!-- Filters — only Inbox and All Tasks -->
    {#if viewFilter === 'inbox' || viewFilter === 'all'}
    <div class="tasks-filters">
      <button class="tasks-filter-pill" class:active={priorityFilter === 'all'} onclick={() => priorityFilter = 'all'}>All</button>
      {#each ['urgent', 'high', 'medium'] as p}
        <button
          class="tasks-filter-pill"
          class:active={priorityFilter === p}
          onclick={() => priorityFilter = priorityFilter === p ? 'all' : p as Priority}
        >{priorityLabel(p)}</button>
      {/each}
    </div>

    <div class="tasks-saved-views">
      <input
        class="tasks-custom-filter"
        type="search"
        placeholder="Filter title, notes, tags, project"
        bind:value={customFilterText}
        spellcheck="false"
      />
      <button class="tasks-filter-pill" type="button" onclick={saveCurrentView}>Save View</button>
      {#each savedViews as view}
        <button class="tasks-filter-pill" type="button" onclick={() => applySavedView(view)}>{view.name}</button>
      {/each}
    </div>

    <!-- Add Input -->
    <div class="tasks-add">
      <Plus class="tasks-add-icon" size={16} />
      <input
        class="tasks-add-input"
        type="text"
        placeholder="Add a task... try 'Call John tomorrow at 3pm high priority #work'"
        bind:value={newTaskTitle}
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
        spellcheck="false"
      />
      <button class="tasks-add-btn" class:inactive={!newTaskTitle.trim()} type="button" onclick={addTask}>Add</button>
    </div>
    {/if}

    <!-- Task List (List View) -->
    {#if viewMode === 'list'}
    <div class="tasks-list-scroll" role="list">
      {#if visibleTasks.length === 0}
        <div class="tasks-empty">
          <svelte:component this={emptyIconComponent} class="tasks-empty-icon" size={36} />
          <p class="tasks-empty-text">{getEmptyText()}</p>
        </div>
      {:else}
        {#each visibleTasks as task (task.id)}
          <Card
            class={"card-surface tasks-card tasks-card--priority-" + task.priority + (task.done ? " tasks-card--completed" : "") + (!task.done && isOverdue(task.dueAt) ? " tasks-card--overdue" : "") + (newIds.has(task.id) ? " tasks-card--new" : "") + (removingIds.has(task.id) ? " tasks-card--removing" : "") + (selectedTaskId === task.id ? " selected" : "")}
            role="listitem"
            onclick={(ev) => {
              if (ev.metaKey || ev.ctrlKey) {
                toggleBulkSelect(task.id);
              } else {
                selectedTaskId = task.id;
              }
            }}
            onkeydown={(e) => { if (e.key === 'Enter') { selectedTaskId = task.id; } }}
          >
            <CardContent class="tasks-card-content">
              <!-- Checkbox -->
              <button
                class="tasks-checkbox"
                class:tasks-checkbox--checked={task.done}
                onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
              ></button>

              <!-- Body -->
              <div class="tasks-card-body" style="flex:1;min-width:0">
                <p class="tasks-card-title">{task.title}</p>
                <div class="tasks-card-meta">
                  {#if task.priority !== 'none'}
                    <span class="tasks-card-tag" style="color: {priorityColor(task.priority)}">
                      {priorityLabel(task.priority)}
                    </span>
                  {/if}
                  <span class="tasks-card-tag" style="border-left: 2px solid {getProjectColor(task.project)}; padding-left: 5px;">
                    {projects.find(p => p.id === task.project)?.name ?? 'Inbox'}
                  </span>
                  {#if formatDueDate(task.dueAt)}
                    <span class="tasks-card-date" class:tasks-card-date--overdue={!task.done && isOverdue(task.dueAt)}>
                      {formatDueDate(task.dueAt)}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Hover Actions -->
              <div class="tasks-card-actions">
                <Select.Root type="single" value={task.project} onValueChange={(v) => { if (v) moveTask(task.id, v); }}>
                  <Select.Trigger class="tasks-project-select" onclick={(e) => e.stopPropagation()}>
                    <span>{projects.find(p => p.id === task.project)?.name ?? task.project}</span>
                  </Select.Trigger>
                  <Select.Content>
                    {#each projects as p}
                      <Select.Item value={p.id}>{p.name}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
                <button
                  class="tasks-card-action-btn tasks-card-action-btn--archive"
                  onclick={(e) => { e.stopPropagation(); archiveTaskAction(task.id); }}
                  use:tooltip={{ text: "Archive task" }}
                >
                  <ArchiveIcon size={12} />
                </button>
                <button
                  class="tasks-card-action-btn tasks-card-action-btn--delete"
                  onclick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                  use:tooltip={{ text: "Delete task" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </CardContent>
          </Card>
        {/each}
      {/if}
    </div>
    {/if}

    <!-- Board View -->
    {#if viewMode === 'board'}
    <div class="tasks-board">
      {#each ['urgent', 'high', 'medium', 'none'] as priority}
        {const boardTasks = filteredTasks.filter(t => t.priority === priority)}
        <div class="tasks-board-column">
          <div class="tasks-board-column-header">
              <span style="color: {priorityColor(priority)};">
              {#if priority === 'urgent'}🔴{/if}
              {#if priority === 'high'}🟠{/if}
              {#if priority === 'medium'}🔵{/if}
              {#if priority === 'none'}⚪{/if}
               {priorityLabel(priority)}
            </span>
            <span class="tasks-board-column-count">{boardTasks.length}</span>
          </div>
          <div class="tasks-board-column-list">
            {#each boardTasks as task (task.id)}
              <Card
                class={"card-surface tasks-board-card tasks-board-card--priority-" + task.priority + (!task.done && isOverdue(task.dueAt) ? " tasks-card--overdue" : "")}
                onclick={() => { selectedTaskId = task.id; }}
                oncontextmenu={(e) => { e.preventDefault(); openContextMenu(e, task.id); }}
              >
                <CardContent class="tasks-board-card-content">
                  <p class="tasks-board-card-title">{task.title}</p>
                  <div class="tasks-board-card-meta">
                    {#if task.project !== 'inbox'}
                      <span class="tasks-board-card-tag">{projects.find(p => p.id === task.project)?.name ?? 'Inbox'}</span>
                    {/if}
                    {#if formatDueDate(task.dueAt)}
                      <span class="tasks-board-card-tag" class:tasks-card-date--overdue={!task.done && isOverdue(task.dueAt)}>
                        {formatDueDate(task.dueAt)}
                      </span>
                    {/if}
                  </div>
                </CardContent>
              </Card>
            {/each}
            {#if boardTasks.length === 0}
              <div class="tasks-empty" style="padding: 20px 10px;">
                <p class="tasks-empty-text">No tasks</p>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {/if}

    {#if viewMode === 'calendar'}
    <!--
      ══════════════════════════════════════════════════════════════════
       ANYTYPE-STYLE BLOCK GRID CALENDAR
       Ported 1:1 from anytype-ts ViewCalendar + CalendarItem
       Uses: calViewYear, calViewMonth, calViewData(), calTasksOnDay()
      ══════════════════════════════════════════════════════════════════
    -->
    <div class="tasks-cal">

      <!-- ── Date select bar ── -->
      <div class="tasks-cal-bar">
        <div class="tasks-cal-bar-left">
          <Select.Root type="single" bind:value={calViewMonthStr}>
            <Select.Trigger class="tasks-cal-select" id="tasks-cal-month" aria-label="Month">
              {monthOptions.find(f => f.value === calViewMonthStr)?.label ?? 'Month'}
            </Select.Trigger>
            <Select.Content>
              {#each monthOptions as opt (opt.value)}
                <Select.Item value={opt.value}>{opt.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <Select.Root type="single" bind:value={calViewYearStr}>
            <Select.Trigger class="tasks-cal-select" id="tasks-cal-year" aria-label="Year">
              {yearOptions.find(f => f.value === calViewYearStr)?.label ?? 'Year'}
            </Select.Trigger>
            <Select.Content>
              {#each yearOptions as opt (opt.value)}
                <Select.Item value={opt.value}>{opt.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="tasks-cal-bar-right">
          <button class="tasks-cal-arrow" aria-label="Previous month" onclick={calPrevMonth} use:tooltip={{ text: "Previous month" }}>
            <ChevronLeft size={15} />
          </button>
          <button class="tasks-cal-today-btn" onclick={calGoToday}>Today</button>
          <button class="tasks-cal-arrow" aria-label="Next month" onclick={calNextMonth} use:tooltip={{ text: "Next month" }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <!-- ── Grid ── -->
      <div class="tasks-cal-wrap">
        <div class="tasks-cal-table">

          <!-- Day-of-week header row -->
          <div class="tasks-cal-head">
            {#each ['Mo','Tu','We','Th','Fr','Sa','Su'] as d}
              <div class="tasks-cal-head-cell">{d}</div>
            {/each}
          </div>

          <!-- Body: 6 rows × 7 cols -->
          <div class="tasks-cal-body">
            {#each calViewData() as cell}
              {const cellTasks = calTasksOnDay(cell.d, cell.m, cell.y)}
              {const LIMIT = 4}
              {const overflow = cellTasks.length > LIMIT ? cellTasks.length - LIMIT : 0}
              <div
                class="tasks-cal-day"
                class:tasks-cal-day--other={cell.isOtherMonth}
                class:tasks-cal-day--today={cell.isToday}
                class:tasks-cal-day--weekend={cell.isWeekend}
                class:tasks-cal-day--first={cell.isFirstRow}
                ondblclick={() => calQuickAdd(cell.d, cell.m, cell.y)}
              >
                <!-- Day cell head -->
                <div class="tasks-cal-day-head">
                  <button
                    class="tasks-cal-day-plus"
                    aria-label="Add task"
                    onclick={(e) => { e.stopPropagation(); calQuickAdd(cell.d, cell.m, cell.y); }}
                    use:tooltip={{ text: "Add task" }}
                  >+</button>
                  <div class="tasks-cal-day-num">
                    <span>{cell.d}</span>
                  </div>
                </div>

                <!-- Task records inside the day cell -->
                <div class="tasks-cal-day-items">
                  {#each cellTasks.slice(0, LIMIT) as task (task.id)}
                    <button
                      class="tasks-cal-record"
                      class:tasks-cal-record--done={task.done}
                      onclick={() => selectedTaskId = task.id}
                      title={task.title}
                    >
                      <span
                        class="tasks-cal-record-dot"
                        style="background: {priorityColor(task.priority)}"
                      ></span>
                      <span class="tasks-cal-record-title">{task.title}</span>
                    </button>
                  {/each}

                  {#if overflow > 0}
                    <button
                      class="tasks-cal-record tasks-cal-record--more"
                      onclick={(e) => { e.stopPropagation(); calOpenOverflow(e, cell.d, cell.m, cell.y, cellTasks); }}
                    >
                      +{overflow} more
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Overflow popover -->
      {#if calOverflow}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="tasks-cal-overflow-scrim"
          onclick={() => calOverflow = null}
          onkeydown={(e) => e.key === 'Escape' && (calOverflow = null)}
        ></div>
        <div
          class="tasks-cal-overflow-popover"
          style="top: {calOverflow.y}px; left: {calOverflow.x}px"
        >
          <div class="tasks-cal-overflow-head">
            {time.formatCustom(
              time.fromComponents(calOverflow.year, calOverflow.month + 1, calOverflow.day),
              'D, M j')}
          </div>
          {#each calOverflow.tasks as task (task.id)}
            <button
              class="tasks-cal-record"
              onclick={() => { selectedTaskId = task.id; calOverflow = null; }}
            >
              <span class="tasks-cal-record-dot" style="background: {priorityColor(task.priority)}"></span>
              <span class="tasks-cal-record-title">{task.title}</span>
            </button>
          {/each}
          <button
            class="tasks-cal-overflow-add"
            onclick={() => { calQuickAdd(calOverflow!.day, calOverflow!.month, calOverflow!.year); calOverflow = null; }}
          >+ Add task</button>
        </div>
      {/if}

      <!-- Inline quick-add bar (appears below the grid) -->
      {#if calQuickAddTarget}
        <div class="tasks-cal-quick-add-bar">
          <span class="tasks-cal-quick-add-date">
            {time.formatCustom(
              time.fromComponents(calQuickAddTarget.year, calQuickAddTarget.month + 1, calQuickAddTarget.day),
              'D, M j')}
          </span>
          <input
            class="tasks-cal-quick-add-input"
            type="text"
            placeholder="Task title…"
            bind:value={calQuickAddTitle}
            onkeydown={(e) => {
              if (e.key === 'Enter') void calSubmitQuickAdd();
              if (e.key === 'Escape') calQuickAddTarget = null;
            }}
            spellcheck="false"
          />
          <button class="tasks-cal-quick-add-btn" onclick={() => void calSubmitQuickAdd()}>Add</button>
          <button class="tasks-cal-quick-add-cancel" onclick={() => calQuickAddTarget = null}>
            <X size={13} />
          </button>
        </div>
      {/if}

    </div>
    {/if}

    {#if viewMode === 'table'}
      <div class="tasks-table-wrap">
        <Table.Root class="tasks-table">
          <Table.Header>
            <Table.Row>
              <Table.Head>Task</Table.Head>
              <Table.Head>Priority</Table.Head>
              <Table.Head>Project</Table.Head>
              <Table.Head>Due</Table.Head>
              <Table.Head>Estimate</Table.Head>
              <Table.Head>Tracked</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each visibleTasks as task}
              <Table.Row class="tasks-table-row" onclick={() => selectedTaskId = task.id}>
                <Table.Cell>{task.title}</Table.Cell>
                <Table.Cell>{priorityLabel(task.priority)}</Table.Cell>
                <Table.Cell>{projects.find(p => p.id === task.project)?.name ?? task.project}</Table.Cell>
                <Table.Cell>{formatDueDate(task.dueAt) ?? '-'}</Table.Cell>
                <Table.Cell class="number number-tabular">{task.estimatedMinutes ?? '-'}</Table.Cell>
                <Table.Cell class="number number-tabular">{task.trackedMinutes}</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}

    {#if viewMode === 'timeline'}
      <div class="tasks-timeline-view">
        {#each timelineGroups as [date, dayTasks]}
          <Card class="card-surface tasks-timeline-group">
            <CardContent class="tasks-timeline-group-content">
              <div class="tasks-timeline-date">{date === 'No Date' ? 'No Date' : time.formatCustom(parseInt(date), 'M j')}</div>
              <div class="tasks-timeline-items">
                {#each dayTasks as task}
                  <button class="tasks-timeline-item" type="button" onclick={() => selectedTaskId = task.id}>
                    <span>{task.dueTime ?? '--:--'}</span>
                    <strong>{task.title}</strong>
                    <em>{task.estimatedMinutes ? `${task.estimatedMinutes}m` : 'No estimate'}</em>
                  </button>
                {/each}
              </div>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}

    {#if viewMode === 'focus'}
      <div class="tasks-focus-view">
        {#if nextAction}
          <p class="tasks-focus-kicker">Next Action</p>
          <h3>{nextAction.title}</h3>
          <div class="tasks-focus-meta">
            <span>{priorityLabel(nextAction.priority)}</span>
            <span>{projects.find(p => p.id === nextAction.project)?.name ?? 'Inbox'}</span>
            <span>{formatDueDate(nextAction.dueAt) ?? 'No due date'}</span>
          </div>
          <div class="tasks-focus-actions">
            <button class="tasks-bulk-btn" type="button" onclick={() => selectedTaskId = nextAction.id}>Open</button>
            <button class="tasks-bulk-btn" type="button" onclick={() => toggleTask(nextAction.id)}>Complete</button>
            <button class="tasks-bulk-btn" type="button" onclick={() => duplicateTaskAction(nextAction.id)}>Duplicate</button>
          </div>
        {:else}
          <div class="tasks-empty"><p class="tasks-empty-text">No next action.</p></div>
        {/if}
      </div>
    {/if}

    {#if viewMode === 'mind'}
      <div class="tasks-mind-view">
        <div class="tasks-mind-root">{viewTitle}</div>
        {#each projects as project}
          {const projectTasks = visibleTasks.filter(t => t.project === project.id)}
          {#if projectTasks.length}
            <section class="tasks-mind-branch" style="--branch: {project.color}">
              <h3>{project.name}</h3>
              <div>
                {#each projectTasks as task}
                  <button type="button" onclick={() => selectedTaskId = task.id}>{task.title}</button>
                {/each}
              </div>
            </section>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Bulk Action Bar -->
    {#if bulkMode}
      <div class="tasks-bulk-bar">
        <span class="tasks-bulk-count"><span class="number number-tabular">{selectedIds.size}</span> selected</span>
        <button class="tasks-bulk-btn" onclick={() => { selectedIds = new Set(); bulkMode = false; }}>Deselect</button>
        <button class="tasks-bulk-btn" onclick={bulkComplete}>Complete</button>
        <button class="tasks-bulk-btn" onclick={() => bulkMoveTo('inbox')}>To Inbox</button>
        <Select.Root type="single" onValueChange={(v) => { if (v) bulkSetPriority(v as Priority); }}>
          <Select.Trigger class="tasks-bulk-btn">
            <span>Priority</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="urgent">Urgent</Select.Item>
            <Select.Item value="high">High</Select.Item>
            <Select.Item value="medium">Medium</Select.Item>
            <Select.Item value="none">None</Select.Item>
          </Select.Content>
        </Select.Root>
        <button class="tasks-bulk-btn tasks-bulk-btn--danger" onclick={bulkDelete}>Delete</button>
      </div>
    {/if}
  </section>

  {#if selectedTask}
  <!-- ─── DETAIL PANE ─── -->
  <section class="tasks-detail" bind:this={detailPanelEl}>
      <!-- Detail — Task Content -->
      <div class="tasks-detail-scroll">
        <!-- Title -->
        <div class="tasks-detail-header">
          <!-- Close button — top right of panel -->
          <button
            class="tasks-detail-close"
            type="button"
            onclick={() => selectedTaskId = null}
            aria-label="Close task detail"
            use:tooltip={{ text: "Close (Esc)" }}
          ><X size={14} /></button>
          <input
            class="tasks-detail-title-input"
            type="text"
            bind:value={editTitle}
            onblur={onTitleBlur}
            onkeydown={onTitleKeydown}
            placeholder="Task title"
            aria-label="Task title"
            spellcheck="false"
          />
          <div class="tasks-detail-meta-row">
            <Select.Root type="single" value={editPriority} onValueChange={(v) => { if (v) onPriorityChangeValue(v as Priority); }}>
              <Select.Trigger class="tasks-detail-priority-select">
                <span>{editPriority === 'urgent' ? '🔴 Urgent' : editPriority === 'high' ? '🟠 High' : editPriority === 'medium' ? '🔵 Medium' : 'None'}</span>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="urgent">🔴 Urgent</Select.Item>
                <Select.Item value="high">🟠 High</Select.Item>
                <Select.Item value="medium">🔵 Medium</Select.Item>
                <Select.Item value="none">None</Select.Item>
              </Select.Content>
            </Select.Root>
            <Select.Root type="single" value={editProject} onValueChange={(v) => { if (v) onProjectChangeValue(v); }}>
              <Select.Trigger class="tasks-detail-project-select">
                <span>{projects.find(p => p.id === editProject)?.name ?? editProject}</span>
              </Select.Trigger>
              <Select.Content>
                {#each projects as p}
                  <Select.Item value={p.id}>{p.name}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            {#if editDueAt}
              <span class="tasks-card-date" style="font-size: 12px; color: {isOverdue(editDueAt) ? 'var(--destructive)' : 'oklch(1 0 89.876 / 0.5)'}">
                {formatDate(editDueAt)}
                <button
                  class="tasks-detail-date-btn clear"
                  style="display: inline; padding: 0 4px; margin-left: 2px;"
                  onclick={() => setDueDate(null)}
                  use:tooltip={{ text: "Clear due date" }}
                ><X size={10} /></button>
              </span>
            {/if}
          </div>
        </div>

        <!-- Due Date Quick Picks + Picker -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Due Date</div>
          <div class="tasks-detail-date-grid">
            <button
              class="tasks-detail-date-btn"
              class:active={editDueAt !== null && formatDueDate(editDueAt) === 'Today'}
              onclick={() => {
                setDueDate(time.dayStart(time.now()) + time.DAY - 1000);
              }}
            >Today</button>
            <button
              class="tasks-detail-date-btn"
              class:active={editDueAt !== null && formatDueDate(editDueAt) === 'Tomorrow'}
              onclick={() => {
                setDueDate(time.dayStart(time.now()) + 2 * time.DAY - 1000);
              }}
            >Tomorrow</button>
            <button
              class="tasks-detail-date-btn"
              onclick={() => {
                setDueDate(time.dayStart(time.now()) + 8 * time.DAY - 1000);
              }}
            >Next Week</button>
            <button
              class="tasks-detail-date-btn"
              onclick={() => {
                const d = new Date(time.now()); d.setMonth(d.getMonth() + 1); d.setHours(23, 59, 59, 999);
                setDueDate(d.getTime());
              }}
            >Next Month</button>
            <button
              class="tasks-detail-date-btn"
              onclick={() => showCalendar = !showCalendar}
              class:active={showCalendar}
            >Pick Date</button>
          </div>

          <!-- Mini Calendar -->
          {#if showCalendar}
            <div class="tasks-detail-calendar">
              <div class="tasks-detail-calendar-header">
                <button onclick={prevMonth} aria-label="Previous month" use:tooltip={{ text: "Previous month" }}><ChevronLeft size={14} /></button>
                <span class="tasks-detail-calendar-month">
                  {time.formatCustom(time.fromComponents(calendarYear, calendarMonth + 1, 1), 'F Y')}
                </span>
                <button onclick={nextMonth} aria-label="Next month" use:tooltip={{ text: "Next month" }}><ChevronRight size={14} /></button>
              </div>
              <div class="tasks-detail-calendar-grid">
                {#each ['S','M','T','W','T','F','S'] as day}
                  <span class="tasks-detail-calendar-day-header">{day}</span>
                {/each}
                {#each calendarDays() as cell}
                  <button
                    class="tasks-detail-calendar-day"
                    class:today={isToday(cell.day, cell.month, cell.year)}
                    class:selected={isSelected(cell.day, cell.month, cell.year)}
                    class:other-month={cell.isOther}
                    onclick={() => selectCalendarDay(cell.day, cell.month, cell.year)}
                  >{cell.day}</button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Due Time -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Due Time</div>
          <input
            class="tasks-detail-field-input"
            type="time"
            bind:value={editDueTime}
            onchange={() => { if (selectedTaskId) updateField({ dueTime: editDueTime }); }}
            spellcheck="false"
          />
          {#if editDueTime}
            <button class="tasks-detail-date-btn clear" onclick={() => { editDueTime = null; if (selectedTaskId) updateField({ dueTime: null }); }}><X size={10} /></button>
          {/if}
        </div>

        <!-- Start Date -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Start Date</div>
          <div class="tasks-detail-inline-row">
            {#if editStartAt}
              <span class="tasks-detail-field-label">{formatDate(editStartAt)}</span>
              <button class="tasks-detail-date-btn clear" onclick={() => { editStartAt = null; if (selectedTaskId) updateField({ startAt: null }); }}><X size={10} /></button>
            {/if}
            <button class="tasks-detail-date-btn" onclick={() => { const dS = time.dayStart(time.now()); editStartAt = dS; if (selectedTaskId) updateField({ startAt: dS }); }}>Today</button>
            <button class="tasks-detail-date-btn" onclick={() => { const dT = time.dayStart(time.now()) + time.DAY; editStartAt = dT; if (selectedTaskId) updateField({ startAt: dT }); }}>Tomorrow</button>
            <button class="tasks-detail-date-btn" onclick={() => { editStartAt = null; if (selectedTaskId) updateField({ startAt: null }); }}>Clear</button>
          </div>
        </div>

        <!-- Time Estimate -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Time Estimate</div>
          <div class="tasks-detail-inline-row">
            <input
              class="tasks-detail-field-input"
              type="number"
              min="0"
              max="9999"
              placeholder="Minutes"
              bind:value={editEstimatedMinutes}
              onchange={() => { if (selectedTaskId) updateField({ estimatedMinutes: editEstimatedMinutes }); }}
              style="width: 100px;"
              spellcheck="false"
            />
            <span class="tasks-detail-field-label">minutes</span>
            {#if editEstimatedMinutes}
              <button class="tasks-detail-date-btn clear" onclick={() => { editEstimatedMinutes = null; if (selectedTaskId) updateField({ estimatedMinutes: null }); }}><X size={10} /></button>
            {/if}
          </div>
        </div>

        <!-- Recurrence Rule -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Recurrence</div>
          <Select.Root type="single" value={editRecurrenceRule ?? ''} onValueChange={(v) => { editRecurrenceRule = v || null; if (selectedTaskId) updateField({ recurrenceRule: editRecurrenceRule }); }}>
            <Select.Trigger class="tasks-detail-recurrence-select">
              <span>{editRecurrenceRule === 'daily' ? 'Daily' : editRecurrenceRule === 'weekly' ? 'Weekly' : editRecurrenceRule === 'biweekly' ? 'Every 2 weeks' : editRecurrenceRule === 'monthly' ? 'Monthly' : editRecurrenceRule === 'yearly' ? 'Yearly' : editRecurrenceRule === 'every weekday' ? 'Every weekday' : editRecurrenceRule === 'every weekend' ? 'Every weekend' : 'No recurring'}</span>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="">No recurring</Select.Item>
              <Select.Item value="daily">Daily</Select.Item>
              <Select.Item value="weekly">Weekly</Select.Item>
              <Select.Item value="biweekly">Every 2 weeks</Select.Item>
              <Select.Item value="monthly">Monthly</Select.Item>
              <Select.Item value="yearly">Yearly</Select.Item>
              <Select.Item value="every weekday">Every weekday</Select.Item>
              <Select.Item value="every weekend">Every weekend</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Time Tracking -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Time Tracking</div>
          <div class="tasks-detail-inline-row">
            <button
              class="tasks-timer-btn"
              class:tasks-timer-btn--active={timerRunning}
              onclick={toggleTimer}
            >
              {#if timerRunning}
                <Square size={12} />
                <span>Stop</span>
              {:else}
                <Play size={12} />
                <span>Start</span>
              {/if}
            </button>
            <span class="tasks-timer-display number number-metric">{formatElapsed(timerElapsed)}</span>
            <span class="tasks-detail-field-label" style="margin-left: 4px;">
              tracked today
            </span>
          </div>
        </div>

        <!-- Notes -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Notes</div>
          <textarea
            class="tasks-detail-notes-area"
            bind:value={editNotes}
            onblur={onNotesBlur}
            placeholder="Add notes..."
            rows={4}
            spellcheck="true"
          ></textarea>
        </div>

        <!-- Tags -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Tags</div>
          <div class="tasks-detail-tags-area" onclick={() => document.getElementById('tag-input')?.focus()}>
            {#each editTags as tag}
              <span class="tasks-detail-tag-chip" style="background: {tagColor(tag)}20; color: {tagColor(tag)}">
                {tag}
                <span onclick={(e) => { e.stopPropagation(); removeTag(tag); }}><X size={9} /></span>
              </span>
            {/each}
            <input
              id="tag-input"
              class="tasks-detail-tag-input"
              type="text"
              placeholder={editTags.length === 0 ? 'Add a tag...' : ''}
              bind:value={editTagInput}
              onkeydown={onTagKeydown}
              onblur={addTag}
              spellcheck="false"
            />
          </div>
        </div>

        <!-- Subtasks -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Subtasks</div>
          {#if subtaskProgress}
            <div class="tasks-subtask-progress"><span class="number number-tabular">{subtaskProgress}</span> subtasks</div>
          {/if}
          {#each editSubtasks as subtask}
            <div class="tasks-subtask-item">
              <button
                class="tasks-subtask-checkbox"
                class:checked={subtask.done}
                onclick={() => toggleSubtask(subtask.id)}
                aria-label={subtask.done ? 'Mark incomplete' : 'Mark complete'}
              ></button>
              <span class="tasks-subtask-title" class:done={subtask.done}>{subtask.title}</span>
              <button class="tasks-subtask-delete" onclick={() => deleteSubtaskAction(subtask.id)}>
                <X size={11} />
              </button>
            </div>
          {/each}
          <div class="tasks-subtask-add">
            <Plus class="tasks-subtask-add-icon" size={14} />
            <input
              class="tasks-subtask-add-text"
              type="text"
              placeholder="Add subtask..."
              bind:value={subtaskInput}
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
              spellcheck="false"
            />
          </div>
        </div>

        <!-- Activity (placeholder) -->
        <div class="tasks-detail-section">
          <div class="tasks-detail-section-label">Activity</div>
          {#if editActivity.length === 0}
            <p style="font-size: 11px; color: oklch(1 0 89.876 / 0.5);">No activity yet.</p>
          {:else}
            {#each editActivity as entry}
              <div class="tasks-detail-activity-item">
                <span class="tasks-detail-activity-dot"></span>
                <span class="tasks-detail-activity-text">{entry.text}</span>
                <span class="tasks-detail-activity-time">{time.formatTime(entry.timestamp)}</span>
              </div>
            {/each}
          {/if}
        </div>
      </div>
  </section>
  {/if}
</div>

<ShareSheet bind:open={showShare} content={shareContent} title="Share Tasks" label={viewTitle} filename={`bento-tasks-${time.toISODate(time.now())}`} />

<!-- ─── UNDO TOASTS ─── -->
{#if undoToasts.length > 0}
  <div class="tasks-undo-container">
    {#each undoToasts as toast (toast.id)}
      <div class="tasks-undo-toast">
        <span class="tasks-undo-toast-msg">{toast.message}</span>
        <button class="tasks-undo-toast-btn" onclick={() => executeUndo(toast)}>Undo</button>
      </div>
    {/each}
  </div>
{/if}

<!-- ─── QUICK ADD OVERLAY ─── -->
{#if showQuickAdd}
  <div class="tasks-quick-add-overlay" onclick={() => showQuickAdd = false}>
    <div class="tasks-quick-add-dialog" onclick={(e) => e.stopPropagation()}>
      <h3>Quick Add</h3>
      <input
        id="quick-add-input"
        class="tasks-quick-add-input"
        type="text"
        placeholder='e.g. "Call John tomorrow at 3pm high priority #work"'
        bind:value={quickAddTitle}
        onkeydown={onQuickAddKeydown}
        spellcheck="false"
      />
      <div class="tasks-quick-add-templates">
        {#each templates as tmpl}
          <button
            class="tasks-quick-add-template-btn"
            class:active={selectedTemplate === tmpl.label}
            onclick={() => applyTemplate(tmpl)}
          >{tmpl.label}</button>
        {/each}
      </div>
      <p class="tasks-quick-add-hint">
        Press <strong>Enter</strong> to add · <strong>Esc</strong> to cancel
      </p>
    </div>
  </div>
{/if}

<!-- ─── OVERDUE RESCHEDULE DIALOG ─── -->
{#if showReschedule}
  <div class="tasks-quick-add-overlay" onclick={() => showReschedule = false}>
    <div class="tasks-reschedule-dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') showReschedule = false; }}>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="margin: 0;">Reschedule Overdue Tasks</h3>
        <button class="tasks-detail-date-btn clear" onclick={() => showReschedule = false}><X size={14} /></button>
      </div>

      <div class="tasks-reschedule-list">
        {#each overdueTasksToReschedule as task (task.id)}
          {const currentAction = rescheduleActions.get(task.id) ?? 'leave'}
          <div class="tasks-reschedule-row">
            <div class="tasks-reschedule-info">
              <span class="tasks-reschedule-title">{task.title}</span>
              <span class="tasks-reschedule-due">
                Overdue by {Math.ceil((time.now() - task.dueAt!) / 86_400_000)}d
                {#if task.priority !== 'none'}
                  <span class="tasks-reschedule-priority" style="color: {priorityColor(task.priority)};">
                    {priorityLabel(task.priority)}
                  </span>
                {/if}
              </span>
            </div>
            <Select.Root type="single" value={currentAction} onValueChange={(v) => {
              if (v) {
                const next = new Map(rescheduleActions);
                next.set(task.id, v as typeof currentAction);
                rescheduleActions = next;
              }
            }}>
              <Select.Trigger class="tasks-reschedule-select">
                <span>{currentAction === 'leave' ? 'Leave as-is' : currentAction === 'tomorrow' ? 'Reschedule → Tomorrow' : currentAction === 'next-week' ? 'Reschedule → Next Week' : currentAction === 'next-month' ? 'Reschedule → Next Month' : currentAction === 'someday' ? 'Move → Someday' : 'Archive (complete & hide)'}</span>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="leave">Leave as-is</Select.Item>
                <Select.Item value="tomorrow">Reschedule → Tomorrow</Select.Item>
                <Select.Item value="next-week">Reschedule → Next Week</Select.Item>
                <Select.Item value="next-month">Reschedule → Next Month</Select.Item>
                <Select.Item value="someday">Move → Someday</Select.Item>
                <Select.Item value="archive">Archive (complete & hide)</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        {/each}
      </div>

      <div class="tasks-export-actions" style="margin-top: 16px;">
        <button class="tasks-export-btn" onclick={() => showReschedule = false}>Cancel</button>
        <button class="tasks-export-btn tasks-export-btn--confirm" onclick={applyReschedule}>
          Apply Changes
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── SHORTCUTS OVERLAY ─── -->
{#if showShortcuts}
  <div class="tasks-shortcuts-overlay" onclick={() => showShortcuts = false}>
    <div class="tasks-shortcuts-dialog" onclick={(e) => e.stopPropagation()}>
      <h3>Keyboard Shortcuts</h3>
      <div class="tasks-shortcuts-grid">
        <div class="tasks-shortcuts-group-label">Navigation</div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Quick Add</span>
          <span class="tasks-shortcuts-item-key">{navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac') ? '⌘K' : 'Ctrl+K'}</span>
        </div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Focus Mode</span>
          <span class="tasks-shortcuts-item-key">{navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac') ? '⌘⇧F' : 'Ctrl+Shift+F'}</span>
        </div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Show Shortcuts</span>
          <span class="tasks-shortcuts-item-key">{navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac') ? '⌘/' : 'Ctrl+/'}</span>
        </div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Close panel / Escape</span>
          <span class="tasks-shortcuts-item-key">Esc</span>
        </div>
        <div class="tasks-shortcuts-group-label">Tasks</div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Set Priority (then 1-4)</span>
          <span class="tasks-shortcuts-item-key">P</span>
        </div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Duplicate Task</span>
          <span class="tasks-shortcuts-item-key">{navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac') ? '⌘D' : 'Ctrl+D'}</span>
        </div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">New Quick Add</span>
          <span class="tasks-shortcuts-item-key">{navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac') ? '⌘N' : 'Ctrl+N'}</span>
        </div>
        <div class="tasks-shortcuts-group-label">View</div>
        <div class="tasks-shortcuts-item">
          <span class="tasks-shortcuts-item-label">Cycle Density</span>
          <span class="tasks-shortcuts-item-key">Settings footer</span>
        </div>
      </div>
      <p class="tasks-quick-add-hint">Press <strong>Esc</strong> to close</p>
    </div>
  </div>
{/if}

<!-- ─── IMPORT DIALOG ─── -->
{#if showImport}
  <div class="tasks-quick-add-overlay" onclick={() => { showImport = false; }}>
    <div class="tasks-quick-add-dialog tasks-import-dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') showImport = false; }}>
      <h3>Import Tasks</h3>

      {#if importResult}
        <!-- Result -->
        <div class="tasks-import-result">
          <p style="font-size: 13px; font-weight: 500; color: oklch(1 0 89.876 / 0.7); margin: 0 0 12px;">
            Import complete
          </p>
          <p style="font-size: 12px; color: oklch(1 0 89.876 / 0.45); margin: 0 0 4px;">
            ✅ {importResult.imported} tasks imported
          </p>
          {#if importResult.skipped > 0}
            <p style="font-size: 12px; color: oklch(1 0 89.876 / 0.5); margin: 0 0 4px;">
              ⏭️ {importResult.skipped} skipped
            </p>
          {/if}
          {#if importResult.errors.length > 0}
            <div style="margin-top: 8px; max-height: 120px; overflow-y: auto;">
              {#each importResult.errors as err}
                <p style="font-size: 10.5px; color: var(--destructive); margin: 2px 0;">{err}</p>
              {/each}
            </div>
          {/if}
          <button class="tasks-export-btn" onclick={() => showImport = false} style="margin-top: 16px;">Done</button>
        </div>
      {:else if !importPreview}
        <!-- Pick file prompt -->
        <div class="tasks-import-prompt">
          <FileText size={36} style="color: oklch(1 0 89.876 / 0.08); margin-bottom: 16px;" />
          <p style="font-size: 13px; color: oklch(1 0 89.876 / 0.5); margin: 0 0 6px;">Supported formats</p>
          <ul class="tasks-import-format-list">
            <li><strong>Todoist</strong> — data export</li>
            <li><strong>Things 3</strong> — CSV export</li>
            <li><strong>TickTick</strong> — CSV export</li>
          </ul>
          <button class="tasks-export-btn tasks-export-btn--confirm" onclick={handlePickImport} style="margin-top: 16px;">
            Select file to import
          </button>
        </div>
      {:else}
        <!-- Preview -->
        <div class="tasks-import-preview">
          <div class="tasks-import-preview-header">
            <span class="tasks-import-preview-badge">{importPreview.format}</span>
            <span style="font-size: 12px; color: color-mix(in srgb, var(--foreground) 50%, transparent);"><span class="number number-tabular">{importPreview.entries.length}</span> tasks found</span>
          </div>

          {#if importPreview.conflicts.length > 0}
            <div class="tasks-import-conflicts">
              <p style="font-size: 11px; font-weight: 500; color: var(--primary); margin: 0 0 8px;">
                ⚠️ {importPreview.conflicts.length} conflict{importPreview.conflicts.length > 1 ? 's' : ''} detected
              </p>
              <p style="font-size: 10.5px; color: color-mix(in srgb, var(--foreground) 50%, transparent); margin: 0 0 10px;">
                Tasks with the same title already exist. Choose how to handle each:
              </p>
              <div class="tasks-import-conflicts-list">
                {#each importPreview.conflicts as conflict}
                  <div class="tasks-import-conflict-row">
                    <div class="tasks-import-conflict-info">
                      <span style="color: color-mix(in srgb, var(--foreground) 70%, transparent);">"{conflict.title}"</span>
                      <span style="color: color-mix(in srgb, var(--foreground) 50%, transparent); font-size: 11px;">
                        matches existing task
                        {#if conflict.existingDone}✅{/if}
                      </span>
</div>
              <Select.Root type="single" value={importConflictResolutions.get(conflict.rowIndex) ?? 'skip'} onValueChange={(v) => { if (v) setConflictResolution(conflict.rowIndex, v as 'skip' | 'overwrite' | 'duplicate'); }}>
                <Select.Trigger class="tasks-import-conflict-select">
                  <span>{(importConflictResolutions.get(conflict.rowIndex) ?? 'skip') === 'skip' ? 'Skip' : (importConflictResolutions.get(conflict.rowIndex) ?? 'skip') === 'duplicate' ? 'Add anyway' : 'Overwrite'}</span>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="skip">Skip</Select.Item>
                  <Select.Item value="duplicate">Add anyway</Select.Item>
                  <Select.Item value="overwrite">Overwrite</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Preview table -->
          <div class="tasks-import-table-wrap">
            <Table.Root class="tasks-import-table">
              <Table.Header>
                <Table.Row>
                  <Table.Head>Title</Table.Head>
                  <Table.Head>Priority</Table.Head>
                  <Table.Head>Project</Table.Head>
                  <Table.Head>Due</Table.Head>
                  <Table.Head>Tags</Table.Head>
                  <Table.Head>Status</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each importPreview.entries.slice(0, 100) as entry, i}
                  <Table.Row class={importPreview.conflicts.some(c => c.rowIndex === i) ? 'tasks-import-conflict-row' : ''}>
                    <Table.Cell class="tasks-import-cell-title">
                      {#if entry.done}<span style="color: var(--primary); margin-right: 4px;">✓</span>{/if}
                      {entry.title}
                    </Table.Cell>
                    <Table.Cell>
                      {#if entry.priority !== 'none'}
                        <span class="tasks-import-priority-dot" style="background: {entry.priority === 'urgent' ? 'var(--destructive)' : entry.priority === 'high' ? 'color-mix(in srgb, var(--primary) 78%, var(--foreground))' : 'var(--primary)'}"></span>
                      {/if}
                    </Table.Cell>
                    <Table.Cell>
                      {#if entry.project !== 'inbox'}
                        <span style="font-size: 11px; color: color-mix(in srgb, var(--foreground) 50%, transparent);">{entry.project}</span>
                      {/if}
                    </Table.Cell>
                    <Table.Cell style="font-size: 11px; color: color-mix(in srgb, var(--foreground) 50%, transparent);">
                      {entry.dueDate ? time.formatCustom(parseInt(entry.dueDate), 'M j') : ''}
                    </Table.Cell>
                    <Table.Cell>
                      {#each entry.tags.slice(0, 3) as tag}
                        <span class="tasks-import-tag">{tag}</span>
                      {/each}
                    </Table.Cell>
                    <Table.Cell style="font-size: 11px;">
                      {#if entry.done}<span style="color: var(--primary);">Done</span>{:else}<span style="color: oklch(1 0 89.876 / 0.5);">Open</span>{/if}
                    </Table.Cell>
                  </Table.Row>
                {/each}
                {#if importPreview.entries.length > 100}
                  <Table.Row>
                    <Table.Cell colspan={6} style="font-size: 11px; color: oklch(1 0 89.876 / 0.5); text-align: center; padding: 12px;">
                      … and {importPreview.entries.length - 100} more
                    </Table.Cell>
                  </Table.Row>
                {/if}
              </Table.Body>
            </Table.Root>
          </div>

          <div class="tasks-export-actions" style="margin-top: 12px;">
            <button class="tasks-export-btn" onclick={() => { showImport = false; }}>Cancel</button>
            <button
              class="tasks-export-btn tasks-export-btn--confirm"
              onclick={handleExecuteImport}
              disabled={isImporting}
            >
              {isImporting ? 'Importing…' : `Import ${importPreview.entries.length} task${importPreview.entries.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ─── EXPORT DIALOG ─── -->
{#if showExport}
  <div class="tasks-quick-add-overlay" onclick={() => showExport = false}>
    <div class="tasks-quick-add-dialog" onclick={(e) => e.stopPropagation()}>
      <h3>Export Tasks</h3>

      <div class="tasks-export-format-grid">
        {#each [
          { id: 'csv' as const, label: 'CSV', desc: 'Flat rows, easy to open in Excel/Sheets' },
          { id: 'json' as const, label: 'JSON', desc: 'Full data, best for backup or advanced use' },
          { id: 'markdown' as const, label: 'Markdown', desc: 'Readable, great for docs & notes' },
        ] as fmt}
          <button
            class="tasks-export-format-card"
            class:active={exportFormat === fmt.id}
            onclick={() => exportFormat = fmt.id}
          >
            <FileText size={16} />
            <strong>{fmt.label}</strong>
            <span>{fmt.desc}</span>
          </button>
        {/each}
      </div>

      {#if exportResult}
        <p class="tasks-export-result">{exportResult}</p>
      {/if}

      <div class="tasks-export-actions">
        <button class="tasks-export-btn tasks-export-btn--cancel" onclick={() => showExport = false}>Cancel</button>
        <button
          class="tasks-export-btn tasks-export-btn--confirm"
          onclick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting…' : `Export as ${exportFormat.toUpperCase()}`}
        </button>
      </div>
    </div>
  </div>
{/if}
