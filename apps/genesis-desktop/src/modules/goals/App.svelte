<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { registerRefresher } from "$lib/realtime/data-changed";
  import "./goals.css";
  import XIcon from "@lucide/svelte/icons/x";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import TargetIcon from "@lucide/svelte/icons/target";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { getModuleSectionLabel, ensureModuleSection, moduleSectionStore } from '$lib/stores/module-sections.store';
  import { tooltip } from "$lib/components/Tooltip.svelte";
  let { moduleId = "goals", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  // ── Section-based view switching ────────────────────────────────────
  const sectionLabels = ['Goals', 'Focus Areas', 'Timeline', 'New Goal'] as const;
  $effect(() => { ensureModuleSection(moduleId, sectionLabels); });
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  $effect(() => {
    if (selectedSection && selectedSection !== 'Goals') {
      selectedGoalId = null;
      notesByGoalId = {};
    }
  });

  // ── Backend type mirrors ──────────────────────────────────────────────
  interface GoalRow {
    id: string;
    title: string;
    description: string;
    horizon: string;
    progress: number;
    targetDate: string | null;
    successCriteria: string | null;
    notes: string | null;
    imageData: string | null;
    updateHistory: string;
    isBig3: boolean;
    focusAreaId: string | null;
    createdAt: string;
    updatedAt: string;
  }

  interface GoalSubtaskRow {
    id: string;
    goalId: string;
    title: string;
    completed: boolean;
    position: number;
  }

  interface GoalReviewRow {
    id: string;
    goalId: string;
    content: string;
    createdAt: string;
  }

  interface FocusAreaRow {
    id: string;
    name: string;
    position: number;
  }

  // ── Frontend Goal shape ───────────────────────────────────────────────
  interface SubTask {
    id: string;
    label: string;
    done: boolean;
  }

  interface Goal {
    id: string;
    title: string;
    description: string;
    horizon: string;
    progress: number;
    subTasks: SubTask[];
    imageBase64?: string;
    targetDate?: string;
    successCriteria?: string;
    notes?: string;
    updateHistory: string;
    lastLoggedAt: number;
    createdAtMs: number;
    status: "active" | "complete" | "archived";
    isBig3: boolean;
    focusAreaId: string | null;
  }

  // ── State ─────────────────────────────────────────────────────────────
  let loading = $state(true);
  let allGoals = $state<GoalRow[]>([]);
  let allSubtasks = $state<Record<string, GoalSubtaskRow[]>>({});
  let focusAreas = $state<FocusAreaRow[]>([]);
  let errorMessage = $state<string | null>(null);

  let errorTimer: ReturnType<typeof setTimeout> | undefined = $state();
  function showError(msg: string) {
    errorMessage = msg;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => errorMessage = null, 4000);
  }

  let weeklyGoals = $derived(
    allGoals.filter((g) => g.horizon === "weekly").map(toGoal),
  );
  let monthlyGoals = $derived(
    allGoals.filter((g) => g.horizon === "monthly").map(toGoal),
  );
  let yearlyGoals = $derived(
    allGoals.filter((g) => g.horizon === "yearly").map(toGoal),
  );

  let goals = $derived([...weeklyGoals, ...monthlyGoals, ...yearlyGoals]);

  function toGoal(row: GoalRow): Goal {
    const subs = allSubtasks[row.id] ?? [];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      horizon: row.horizon,
      progress: row.progress,
      subTasks: subs.map((s) => ({ id: s.id, label: s.title, done: s.completed })),
      imageBase64: row.imageData ?? undefined,
      targetDate: row.targetDate ?? undefined,
      successCriteria: row.successCriteria ?? undefined,
      notes: row.notes ?? undefined,
      updateHistory: row.updateHistory,
      lastLoggedAt: row.updatedAt ? parseInt(row.updatedAt) : 0,
      createdAtMs: row.createdAt ? parseInt(row.createdAt) : 0,
      status: row.progress >= 100 ? "complete" : "active",
      isBig3: row.isBig3,
      focusAreaId: row.focusAreaId,
    };
  }

  // ── View state ────────────────────────────────────────────────────────
  let currentView = $state<"list" | "detail">("list");
  let detailGoalId = $state<string | null>(null);
  let detailGoal = $derived(goals.find((g) => g.id === detailGoalId) ?? null);

  // ── Horizon filter (Page 1 dropdown) ─────────────────────────────────
  let horizonFilter = $state<"weekly" | "monthly" | "yearly">("weekly");
  // Goals for the selected horizon, sorted oldest-first (order added)
  const filteredGoals = $derived(
    goals
      .filter((g) => g.horizon === horizonFilter)
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
  );

  let expandedMap = $state<Record<string, boolean>>({});
  let selectedGoalId = $state<string | null>(null);
  let notesByGoalId = $state<Record<string, string>>({});

  let selectedGoal = $derived(goals.find((g) => g.id === selectedGoalId) ?? null);

  $effect(() => {
    if (selectedGoal && !(selectedGoal.id in notesByGoalId)) {
      notesByGoalId[selectedGoal.id] = selectedGoal.notes ?? "";
    }
  });

  // ── Detail page state ─────────────────────────────────────────────────
  let sliderProgress = $state(0);
  let reviewText = $state("");
  let reviews = $state<GoalReviewRow[]>([]);
  let detailPageTitle = $state("");
  let savingReview = $state(false);
  let editingTitle = $state(false);

  $effect(() => {
    if (detailGoal) {
      sliderProgress = detailGoal.progress;
      if (!(detailGoal.id in notesByGoalId)) {
        notesByGoalId[detailGoal.id] = detailGoal.notes ?? "";
      }
      detailPageTitle = detailGoal.title;
      editingTitle = false;
    }
  });

  // ── Streak counter ────────────────────────────────────────────────────
  function computeStreak(updateHistory: string): number {
    try {
      const timestamps: number[] = JSON.parse(updateHistory);
      if (timestamps.length === 0) return 0;
      const uniqueDays = new Set<number>();
      for (const t of timestamps) {
        const d = new Date(t);
        uniqueDays.add(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      }
      const sorted = [...uniqueDays].sort((a, b) => b - a);
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const diff = (sorted[i - 1] - sorted[i]) / 86400000;
        if (diff <= 1.5) streak++;
        else break;
      }
      return streak;
    } catch {
      return 0;
    }
  }

  // ── Insight line ──────────────────────────────────────────────────────
  function computeInsight(): string {
    if (!detailGoal) return "";
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const daysSince = detailGoal.lastLoggedAt > 0
      ? Math.floor((now - detailGoal.lastLoggedAt) / 86400000)
      : -1;

    if (daysSince > 7) {
      return `This goal has been untouched for ${daysSince} days.`;
    }

    try {
      const timestamps: number[] = JSON.parse(detailGoal.updateHistory);
      const thisWeek = timestamps.filter((t) => now - t < SEVEN_DAYS).length;
      if (thisWeek > 0) {
        return `You've updated this goal ${thisWeek} time${thisWeek > 1 ? "s" : ""} this week.`;
      }
      const streak = computeStreak(detailGoal.updateHistory);
      if (streak > 1) {
        return `You're on a ${streak}-day streak with this goal.`;
      }
    } catch {}
    return "Keep showing up \u2014 consistency compounds.";
  }

  // ── Data loading ──────────────────────────────────────────────────────
  async function loadGoals() {
    try {
      const rows = await invoke<GoalRow[]>("goals_list");
      allGoals = rows;

      const subPromises = rows.map((g) =>
        invoke<GoalSubtaskRow[]>("goal_subtasks_list", { goalId: g.id })
          .then((subs) => ({ goalId: g.id, subs }))
          .catch(() => ({ goalId: g.id, subs: [] })),
      );
      const subResults = await Promise.all(subPromises);
      const subMap: Record<string, GoalSubtaskRow[]> = {};
      for (const r of subResults) {
        subMap[r.goalId] = r.subs;
      }
      allSubtasks = subMap;
    } catch (e) {
      showError("Failed to load goals");
    } finally {
      loading = false;
    }
  }

  async function loadFocusAreas() {
    try {
      focusAreas = await invoke<FocusAreaRow[]>("focus_areas_list");
    } catch (e) {
      showError("Failed to load focus areas");
    }
  }

  async function loadSubtasksForGoal(goalId: string) {
    try {
      const subs = await invoke<GoalSubtaskRow[]>("goal_subtasks_list", { goalId });
      allSubtasks = { ...allSubtasks, [goalId]: subs };
    } catch (e) {
      showError("Failed to load subtasks");
    }
  }

  async function loadReviews(goalId: string) {
    try {
      reviews = await invoke<GoalReviewRow[]>("goal_reviews_list", { goalId });
    } catch (e) {
      showError("Failed to load reviews");
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────
  function openFullView(id: string) {
    detailGoalId = id;
    currentView = "detail";
    sliderProgress = goals.find((g) => g.id === id)?.progress ?? 0;
    reviewText = "";
    loadReviews(id);
  }

  function goBackToList() {
    currentView = "list";
    detailGoalId = null;
  }

  // ── Goal mutations ────────────────────────────────────────────────────
  async function saveGoal(params: {
    id?: string;
    title: string;
    description?: string;
    horizon: string;
    progress?: number;
    targetDate?: string;
    successCriteria?: string;
    notes?: string;
    imageData?: string;
  }) {
    try {
      await invoke<GoalRow>("goals_save", { payload: params });
      await loadGoals();
    } catch (e) {
      showError("Failed to save goal");
    }
  }

  async function updateProgress(id: string, progress: number) {
    try {
      await invoke<GoalRow>("goals_progress_update", {
        payload: { id, progress },
      });
      await loadGoals();
    } catch (e) {
      showError("Failed to update progress");
    }
  }

  async function deleteGoal(id: string) {
    if (!confirm("Are you sure you want to delete this goal and all its subtasks and reviews?")) return;
    try {
      await invoke<void>("goals_delete", { id });
      if (selectedGoalId === id) closePanel();
      if (detailGoalId === id) goBackToList();
      await loadGoals();
    } catch (e) {
      showError("Failed to delete goal");
    }
  }

  // ── Progress slider ───────────────────────────────────────────────────
  function handleProgressSliderChange() {
    if (detailGoalId) {
      updateProgress(detailGoalId, sliderProgress);
    }
  }

  // Sync sliderProgress when goals reload after panel button update
  $effect(() => {
    if (detailGoal && detailGoal.progress !== sliderProgress) {
      sliderProgress = detailGoal.progress;
    }
  });

  // ── Subtask mutations ─────────────────────────────────────────────────
  async function toggleSubtask(subtaskId: string, goalId: string) {
    try {
      await invoke<GoalSubtaskRow>("goal_subtask_toggle", { id: subtaskId });
      await loadSubtasksForGoal(goalId);
    } catch (e) {
      showError("Failed to toggle subtask");
    }
  }

  // ── Notes save on blur ────────────────────────────────────────────────
  async function saveNotes(id: string, value: string) {
    try {
      await invoke<GoalRow>("goals_update_notes", { id, notes: value });
      await loadGoals();
    } catch (e) {
      showError("Failed to save notes");
    }
  }

  // ── Big 3 toggle ──────────────────────────────────────────────────────
  async function toggleBig3(id: string, isBig3: boolean) {
    try {
      await invoke<GoalRow>("goals_toggle_big_3", { id, isBig3: !isBig3 });
      await loadGoals();
    } catch (e) {
      showError("Failed to toggle Big 3 status");
    }
  }

  // ── Debounced save ────────────────────────────────────────────────────
  let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  function debouncedSaveNotes(id: string, value: string) {
    clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(() => saveNotes(id, value), 600);
  }

  // ── Title edit ─────────────────────────────────────────────────────────
  async function saveTitle() {
    if (!detailGoalId || !detailPageTitle.trim()) return;
    try {
      await invoke<GoalRow>("goals_update_title", { id: detailGoalId, title: detailPageTitle.trim() });
      await loadGoals();
      editingTitle = false;
    } catch (e) {
      console.error("Failed to update title:", e);
    }
  }

  // ── Reviews ───────────────────────────────────────────────────────────
  async function saveReview() {
    if (!detailGoalId || !reviewText.trim()) return;
    savingReview = true;
    try {
      await invoke<GoalReviewRow>("goal_add_review", {
        payload: { goalId: detailGoalId, content: reviewText.trim() },
      });
      reviewText = "";
      await loadReviews(detailGoalId);
      await loadGoals();
    } catch (e) {
      showError("Failed to save review");
    } finally {
      savingReview = false;
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────
  let fileInput: HTMLInputElement | undefined = $state();
  let uploadTargetId = $state<string | null>(null);

  async function handleImageUpload(goalId: string) {
    if (!fileInput?.files?.[0]) return;
    const file = fileInput.files[0];
    const capturedId = goalId;
    const reader = new FileReader();

    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await invoke<GoalRow>("goals_update_image", { id: capturedId, imageData: base64 });
        await loadGoals();
      } catch (e) {
        showError("Failed to save image");
      }
    };

    reader.readAsDataURL(file);
    fileInput.value = "";
  }

  // ── UI handlers ───────────────────────────────────────────────────────
  function toggleExpanded(id: string) {
    expandedMap = { ...expandedMap, [id]: !expandedMap[id] };
  }

  function handleRowClick(id: string) {
    toggleExpanded(id);
    selectedGoalId = id;
  }

  function closePanel() {
    selectedGoalId = null;
  }

  // ── Deterministic rotation from goal ID hash ──────────────────────────
  function imageRotation(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    return ((hash % 9 + 9) % 9) - 4;
  }

  // ── Focus area accent colour ──────────────────────────────────────────
  function focusAreaColor(index: number): string {
    // Derive from --color-primary-start hue
    const hues = [0, 40, 120, 200, 280, 340];
    const hue = (hues[index % hues.length] + 15) % 360;
    return `hsl(${hue}, 50%, 55%)`;
  }

  // ── Aggregate completion for a focus area ─────────────────────────────
  function focusAreaAggregate(areaId: string): number {
    const areaGoals = goals.filter((g) => g.focusAreaId === areaId);
    if (areaGoals.length === 0) return 0;
    const total = areaGoals.reduce((sum, g) => sum + g.progress, 0);
    return Math.round(total / areaGoals.length);
  }

  // ── Emotional state language ──────────────────────────────────────────
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  function getGoalPhrase(goal: { progress: number; lastLoggedAt?: number }): string {
    const now = Date.now();
    if ((goal.lastLoggedAt ?? 0) > 0 && now - (goal.lastLoggedAt ?? 0) > SEVEN_DAYS_MS) {
      return "This one has been waiting.";
    }
    if (goal.progress === 0) return "You haven't started. That changes today.";
    if (goal.progress < 31) return "Moving. Keep going.";
    if (goal.progress < 70) return "You're in it.";
    if (goal.progress < 90) return "Almost. Don't stop now.";
    if (goal.progress < 100) return "One push.";
    return "Done. Remember why you started.";
  }

  function getGoalState(goal: { progress: number; lastLoggedAt?: number }): string {
    const now = Date.now();
    if ((goal.lastLoggedAt ?? 0) > 0 && now - (goal.lastLoggedAt ?? 0) > SEVEN_DAYS_MS) return "waiting";
    if (goal.progress === 0) return "not-started";
    if (goal.progress < 31) return "in-motion";
    if (goal.progress < 70) return "in-motion";
    if (goal.progress < 90) return "almost-there";
    if (goal.progress < 100) return "one-push";
    return "done";
  }

  function reflectionPrompt(p: number): string {
    if (p === 0) return "What's the first thing you can do today?";
    if (p < 50) return "What\u2019s the one step that would move this forward?";
    if (p < 100) return "What would finishing this change for you?";
    return "What did this journey teach you?";
  }

  // ── Deterministic index from a seed value ─────────────────────────────
  function pickByHash(index: number, length: number): number {
    return (index * 691 + 227) % length;
  }

  // ── Ambient sentence ──────────────────────────────────────────────────
  let ambientSentence = $derived.by(() => {
    const hash = goals.reduce((acc, g) => acc + g.createdAtMs, 0);
    if (goals.length === 0) {
      const prompts = [
        "No commitments yet. What are you moving toward?",
        "Nothing set in motion. What matters to you?",
        "A blank field. What are you building toward?",
        "No goals yet. What deserves your attention?",
      ];
      return prompts[0];
    }

    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const stale = goals.find(
      (g) => g.lastLoggedAt > 0 && now - g.lastLoggedAt > SEVEN_DAYS,
    );
    if (stale) {
      const pulses = [
        `\u201c${stale.title}\u201d has been waiting. This one needs a glance.`,
        `It's been quiet on \u201c${stale.title}.\u201d This one has been waiting.`,
        `This one has been waiting: \u201c${stale.title}.\u201d Pick it back up.`,
      ];
      return pulses[pickByHash(hash, pulses.length)];
    }

    const active = goals.filter((g) => g.status === "active");
    if (active.length === 0) {
      const done = [
        "All your goals are accounted for. What's next on the horizon?",
        "Everything here is settled. Time to set a new intention.",
        "No active goals. The page is blank \u2014 what will you write?",
      ];
      return done[pickByHash(hash, done.length)];
    }
    if (active.length === 1) {
      const singles = [
        `\u201c${active[0].title}\u201d is in motion. Keep showing up.`,
        `You're tracking \u201c${active[0].title}.\u201d Progress is a quiet accumulation.`,
        `\u201c${active[0].title}\u201d is yours to move forward. One day at a time.`,
      ];
      return singles[pickByHash(hash, singles.length)];
    }

    const pairs = [
      `You have ${active.length} active goals. Momentum is building.`,
      `${active.length} goals in progress. Stay the course.`,
      `${active.length} active commitments. Each one is a thread in the weave.`,
      `You're moving on ${active.length} fronts. Consistency compounds.`,
    ];
    return pairs[pickByHash(hash, pairs.length)];
  });

  // ── Subtask creation ─────────────────────────────────────────────────
  let newSubtaskTitle = $state("");
  let newSubtaskGoalId = $state<string | null>(null);
  let savingSubtask = $state(false);

  async function addSubtask() {
    if (!newSubtaskGoalId || !newSubtaskTitle.trim()) return;
    savingSubtask = true;
    try {
      await invoke<GoalSubtaskRow>("goal_subtask_save", {
        payload: { goalId: newSubtaskGoalId, title: newSubtaskTitle.trim() },
      });
      newSubtaskTitle = "";
      await loadSubtasksForGoal(newSubtaskGoalId);
    } catch (e) {
      showError("Failed to add subtask");
    } finally {
      savingSubtask = false;
    }
  }

  // ── Focus area creation dialog (for Page 3) ───────────────────────────
  let showFocusAreaDialog = $state(false);
  let newFocusAreaName = $state("");
  let savingFocusArea = $state(false);

  async function addFocusArea() {
    if (!newFocusAreaName.trim()) return;
    savingFocusArea = true;
    try {
      await invoke<FocusAreaRow>("focus_area_save", {
        payload: { name: newFocusAreaName.trim(), position: focusAreas.length },
      });
      newFocusAreaName = "";
      showFocusAreaDialog = false;
      await loadFocusAreas();
    } catch (e) {
      showError("Failed to add focus area");
    } finally {
      savingFocusArea = false;
    }
  }

  // ── Timeline / Heatmap state ────────────────────────────────────────
  let timelineView = $state<'timeline' | 'heatmap'>('timeline');

  let tlData = $derived(computeTimelineData());
  let hmData = $derived(computeHeatmapData());

  interface TimelineGoal {
    id: string;
    title: string;
    horizon: string;
    progress: number;
    pctStart: number;
    pctWidth: number;
    daysRemaining: number | null;
  }

  interface TimelineData {
    totalDays: number;
    monthLabelLeft: number;
    monthMarkers: { label: string; pct: number }[];
    horizonGroups: {
      label: string;
      goals: TimelineGoal[];
    }[];
  }

  function computeTimelineData(): TimelineData {
    const now = Date.now();
    const allTimestamps = goals
      .flatMap((g) => {
        const ts: number[] = [];
        if (g.lastLoggedAt > 0) ts.push(g.lastLoggedAt);
        if (g.targetDate) {
          const d = parseDateOrNull(g.targetDate);
          if (d !== null) ts.push(d);
        }
        return ts;
      });

    // Date range: min is earliest created_at, max is latest target_date or 90 days from now
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const g of goals) {
      if (g.lastLoggedAt > 0 && g.lastLoggedAt < minTime) minTime = g.lastLoggedAt;
      if (g.targetDate) {
        const d = parseDateOrNull(g.targetDate);
        if (d !== null && d > maxTime) maxTime = d;
      }
    }
    if (minTime === Infinity) minTime = now - 30 * 86400000;
    if (maxTime < now + 30 * 86400000) maxTime = now + 30 * 86400000;
    const range = maxTime - minTime;
    if (range <= 0) return { totalDays: 0, monthLabelLeft: 0, monthMarkers: [], horizonGroups: [] };

    // Month markers
    const monthMarkers: { label: string; pct: number }[] = [];
    const startDate = new Date(minTime);
    const endDate = new Date(maxTime);
    for (let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1); d <= endDate; d.setMonth(d.getMonth() + 1)) {
      const pct = ((d.getTime() - minTime) / range) * 100;
      monthMarkers.push({
        label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        pct: Math.max(0, Math.min(100, pct)),
      });
    }

    function calcPct(t: number): number {
      return ((t - minTime) / range) * 100;
    }

    function parseDateOrNull(dateStr: string): number | null {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.getTime();
    }

    function daysRemaining(goal: Goal): number | null {
      if (!goal.targetDate) return null;
      const d = parseDateOrNull(goal.targetDate);
      if (d === null) return null;
      return Math.max(0, Math.ceil((d - now) / 86400000));
    }

    const horizonGroups = [
      {
        label: 'WEEKLY',
        goals: weeklyGoals.map(toTimelineGoal),
      },
      {
        label: 'MONTHLY',
        goals: monthlyGoals.map(toTimelineGoal),
      },
      {
        label: 'YEARLY',
        goals: yearlyGoals.map(toTimelineGoal),
      },
    ];

    function toTimelineGoal(g: Goal): TimelineGoal {
      const startTime = g.createdAtMs > 0 ? g.createdAtMs : minTime;
      const endTime = g.targetDate ? new Date(g.targetDate).getTime() : maxTime;
      const pctStart = Math.max(0, Math.min(95, calcPct(startTime)));
      const pctEnd = Math.min(100, Math.max(pctStart + 1, calcPct(endTime)));
      return {
        id: g.id,
        title: g.title,
        horizon: g.horizon,
        progress: g.progress,
        pctStart,
        pctWidth: pctEnd - pctStart,
        daysRemaining: daysRemaining(g),
      };
    }

    return {
      totalDays: Math.ceil(range / 86400000),
      monthLabelLeft: 48,
      monthMarkers,
      horizonGroups,
    };
  }

  // ── Heatmap computation ──────────────────────────────────────────────
  interface HeatmapDay {
    dateStr: string;
    opacity: number;
    count: number;
  }

  interface HeatmapData {
    totalWeeks: number;
    monthHeaders: { label: string; startCol: number; span: number }[];
    days: HeatmapDay[];
    insightLine: string;
  }

  function computeHeatmapData(): HeatmapData {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // Count updates per day across all goals
    const dayCounts = new Map<string, number>();
    for (const g of goals) {
      try {
        const timestamps: string[] = JSON.parse(g.updateHistory);
        for (const t of timestamps) {
          const d = new Date(parseInt(t));
          if (d.getFullYear() !== year) continue;
          const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
          dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
        }
      } catch {}
    }

    // Build grid: 7 rows (days of week), columns = weeks
    const startDay = startOfYear.getDay(); // 0=Sun
    const totalDays = Math.ceil((endOfYear.getTime() - startOfYear.getTime()) / 86400000) + 1;
    const totalWeeks = Math.ceil((totalDays + startDay) / 7);

    const days: HeatmapDay[] = [];
    const monthCounts = new Map<string, number>();
    const monthActivityDays = new Map<string, number>();

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startOfYear);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const count = dayCounts.get(key) ?? 0;

      // Track monthly activity
      const monthKey = `${year}-${d.getMonth() + 1}`;
      if (count > 0) {
        monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + count);
        monthActivityDays.set(monthKey, (monthActivityDays.get(monthKey) ?? 0) + 1);
      }

      let opacity = 0.05;
      if (count === 1) opacity = 0.3;
      else if (count === 2) opacity = 0.55;
      else if (count === 3) opacity = 0.8;
      else if (count >= 4) opacity = 1;

      days.push({
        dateStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        opacity,
        count,
      });
    }

    // Month headers
    const monthHeaders: { label: string; startCol: number; span: number }[] = [];
    let currentMonth = -1;
    let monthStartCol = 0;
    let monthIndex = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startOfYear);
      d.setDate(d.getDate() + i);
      const m = d.getMonth();
      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          const col = Math.floor((d.getDay() + i - startDay) / 7) - monthStartCol + 1;
          monthHeaders[monthIndex - 1].span = Math.max(1, col);
        }
        monthStartCol = Math.floor((d.getDay() + i) / 7);
        monthHeaders.push({
          label: d.toLocaleDateString(undefined, { month: 'short' }),
          startCol: monthStartCol + 1,
          span: 1,
        });
        currentMonth = m;
        monthIndex++;
      }
    }

    // Insight line: most active month
    let mostActiveMonth = '';
    let maxCount = 0;
    for (const [mk, mc] of monthCounts) {
      if (mc > maxCount) {
        maxCount = mc;
        const parts = mk.split('-');
        const monthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
        mostActiveMonth = monthDate.toLocaleDateString(undefined, { month: 'long' });
      }
    }
    const insightLine = mostActiveMonth
      ? `Your most active month was ${mostActiveMonth}`
      : 'No activity recorded this year yet.';

    return { totalWeeks: Math.max(1, totalWeeks), monthHeaders, days, insightLine };
  }

  // ── Goal creation flow (Page 5) ────────────────────────────────────
  let creationStep = $state(0); // 0=title, 1=horizon, 2=targetDate, 3=successCriteria, 4=focusArea, 5=done
  let createTitle = $state("");
  let createHorizon = $state("weekly");
  let createTargetDate = $state("");
  let createSuccessCriteria = $state("");
  let createFocusAreaId = $state<string | null>(null);
  let creatingGoal = $state(false);
  let createError = $state("");

  const goalTemplates = [
    { title: "Launch a Product", desc: "Ship a working product to real users and validate the idea.", horizon: "monthly", successCriteria: "Product live with 10+ active users and positive feedback" },
    { title: "Master a New Skill", desc: "Learn something new with structured practice and measurable progress.", horizon: "monthly", successCriteria: "Can build a project using the skill independently" },
    { title: "Build a Reading Habit", desc: "Read consistently every week and finish the books you start.", horizon: "weekly", successCriteria: "Read for 30+ minutes daily for 30 days" },
    { title: "Improve Physical Health", desc: "Build sustainable fitness, nutrition, and recovery routines.", horizon: "yearly", successCriteria: "Achieve target BMI, run 5k in under 28 min, 7+ hours sleep avg" },
    { title: "Achieve Financial Milestone", desc: "Hit a savings target or eliminate a specific debt.", horizon: "monthly", successCriteria: "Emergency fund at 6 months of expenses" },
    { title: "Ship a Side Project", desc: "Take a personal project from idea to launch.", horizon: "monthly", successCriteria: "Project deployed with documentation and at least 1 user" },
    { title: "Learn a New Language", desc: "Reach conversational fluency in a language you don't know yet.", horizon: "yearly", successCriteria: "Can hold a 15-minute conversation with a native speaker" },
    { title: "Custom Goal", desc: "Start from scratch and build your own goal.", horizon: "weekly", successCriteria: "" },
  ];

  function applyTemplate(tmpl: typeof goalTemplates[number]) {
    createTitle = tmpl.title;
    createHorizon = tmpl.horizon;
    createSuccessCriteria = tmpl.successCriteria;
    createTargetDate = "";
    createFocusAreaId = null;
    creationStep = 1; // skip to horizon selection since title is filled
  }

  function advanceCreationStep() {
    if (creationStep < 5) {
      creationStep++;
    }
  }

  function prevCreationStep() {
    if (creationStep > 0) {
      creationStep--;
    }
  }

  function skipField() {
    advanceCreationStep();
  }

  async function submitCreation() {
    if (!createTitle.trim()) return;
    creatingGoal = true;
    createError = "";
    try {
      await invoke<GoalRow>("goals_save", {
        payload: {
          title: createTitle.trim(),
          description: "",
          horizon: createHorizon,
          targetDate: createTargetDate || undefined,
          successCriteria: createSuccessCriteria || undefined,
          focusAreaId: createFocusAreaId || undefined,
        },
      });
      // Reset form
      creationStep = 0;
      createTitle = "";
      createHorizon = "weekly";
      createTargetDate = "";
      createSuccessCriteria = "";
      createFocusAreaId = null;
      await loadGoals();
    } catch (e) {
      createError = String(e);
    } finally {
      creatingGoal = false;
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────
  let initialized = $state(false);
  $effect(() => {
    if (!initialized) {
      initialized = true;
      loadGoals();
      loadFocusAreas();
    }
  });

  // Live-refresh via the realtime data-changed bus: goals/* emits after every
  // mutation (incl. agent-driven writes), so re-fetch on change.
  $effect(() => {
    const offs = [
      registerRefresher('goals/list', () => loadGoals()),
      registerRefresher('goals/focus-areas', () => loadFocusAreas()),
      registerRefresher('goals/subtasks', () => loadGoals()),
      registerRefresher('goals/reviews', () => (detailGoalId ? loadReviews(detailGoalId) : undefined)),
    ];
    return () => { offs.forEach((off) => off()); };
  });
</script>

<div class="goals-workspace">
  {#if selectedSection === 'Focus Areas'}
    <!-- ═══════════════════════════════════════════════════════════════════
         PAGE 3 — FOCUS AREAS & THIS QUARTER'S BIG 3
         ═══════════════════════════════════════════════════════════════════ -->
    <div class="goals-focus-page">
      <header class="goals-ambient-header">
        <div class="gp1-eyebrow"><TargetIcon size={13}/><span>Goals</span><Badge variant="outline">Focus Areas</Badge></div>
        <h1 class="gp1-title">Strategic priorities</h1>
        <p class="goals-ambient-text">What matters most right now.</p>
        <hr class="goals-ambient-rule" />
      </header>

    <Card>
      <CardHeader>
        <CardTitle>FOCUS AREAS</CardTitle>
        <CardDescription>Group your goals into categories like Health, Career, or Learning.</CardDescription>
      </CardHeader>
      <CardContent>
      {#if loading}
        <div class="goals-loading"><span class="goals-loading__text">Loading...</span></div>
      {:else if focusAreas.length === 0}
          <p style="color:color-mix(in srgb, var(--muted) 70%, transparent);font-style:italic;font-size:0.97rem;">No focus areas yet. Group your goals into categories like Health, Career, or Learning.</p>
      {:else}
        <div class="goals-focus-areas__header" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.5rem;">
          <span></span>
          <button class="goals-focus-areas__add" onclick={() => showFocusAreaDialog = true} aria-label="Add focus area">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Add area
            </button>
          </div>

          {#each focusAreas as area, i (area.id)}
            {const areaGoals = goals.filter((g) => g.focusAreaId === area.id)}
            {const aggPct = focusAreaAggregate(area.id)}
            <div class="goals-focus-band" style="--band-accent: {focusAreaColor(i)}">
              <div class="goals-focus-band__left">
                <span class="goals-focus-band__accent"></span>
                <div class="goals-focus-band__info">
                  <span class="goals-focus-band__name">{area.name}</span>
                  {#if areaGoals.length > 0}
                    <span class="goals-focus-band__count"><span class="number number-tabular">{areaGoals.length}</span> goal{areaGoals.length > 1 ? 's' : ''}</span>
                  {/if}
                </div>
              </div>
              <div class="goals-focus-band__pills">
                {#each areaGoals as goal (goal.id)}
                  <span class="goals-focus-band__pill" data-state={getGoalState(goal)}>
                    <span class="goals-focus-band__pill-title">{goal.title}</span>
                    <span class="goals-focus-band__pill-pct"><span class="number number-stat">{goal.progress}</span>%</span>
                  </span>
                {/each}
                {#if areaGoals.length === 0}
                  <span class="goals-focus-band__empty">Nothing here yet</span>
                {/if}
              </div>
              <span class="goals-focus-band__agg"><span class="number number-metric">{aggPct}</span>%</span>
            </div>
          {/each}
        {/if}
      </CardContent>
    </Card>
    </div>

    <!-- ── Add Focus Area Dialog ─────────────────────────────────────── -->
    {#if showFocusAreaDialog}
      <div class="goals-dialog-overlay" onclick={() => showFocusAreaDialog = false}>
        <div class="goals-dialog" onclick={(e) => e.stopPropagation()}>
          <h3 class="goals-dialog__title">New focus area</h3>
          <div class="goals-dialog__field">
            <label for="fa-name" class="goals-dialog__label">Name</label>
            <input id="fa-name" type="text" class="goals-dialog__input" bind:value={newFocusAreaName} placeholder="e.g. Health, Career, Learning" onkeydown={(e) => { if (e.key === 'Enter' && newFocusAreaName.trim()) addFocusArea(); }} />
          </div>
          <div class="goals-dialog__actions">
            <button class="goals-dialog__btn goals-dialog__btn--secondary" onclick={() => showFocusAreaDialog = false}>Cancel</button>
            <button class="goals-dialog__btn goals-dialog__btn--primary" onclick={addFocusArea} disabled={savingFocusArea || !newFocusAreaName.trim()}>
              {savingFocusArea ? "Saving..." : "Create area"}
            </button>
          </div>
        </div>
      </div>
    {/if}

  {:else if selectedSection === 'Timeline'}
    <!-- ═══════════════════════════════════════════════════════════════════
         PAGE 4 — TIMELINE & HEATMAP
         ═══════════════════════════════════════════════════════════════════ -->
    <div class="goals-page-header">
      <div class="gp1-eyebrow"><TargetIcon size={13}/><span>Goals</span><Badge variant="outline">Timeline</Badge></div>
      <div class="goals-page-header__row">
        <div>
          <h1 class="gp1-title">Activity timeline</h1>
          <p class="goals-ambient-text">Visualize your goal activity over time.</p>
        </div>
        <div class="goals-timeline-tabs">
          <button class="goals-timeline-tab" class:goals-timeline-tab--active={timelineView === 'timeline'} onclick={() => timelineView = 'timeline'}>Timeline</button>
          <button class="goals-timeline-tab" class:goals-timeline-tab--active={timelineView === 'heatmap'} onclick={() => timelineView = 'heatmap'}>Heatmap</button>
        </div>
      </div>
    </div>
    <Card>

      {#if timelineView === 'timeline'}
        <!-- ── TIMELINE VIEW ──────────────────────────────────────── -->
        {#if loading}
          <div class="goals-loading"><span class="goals-loading__text">Loading...</span></div>
        {:else if goals.length === 0}
          <div class="goals-zone-empty"><p class="goals-zone-empty__text">No goals to visualize yet. Start tracking to see your timeline.</p></div>
        {:else}
          <div class="goals-timeline">
            <!-- Time axis header -->
            <div class="goals-timeline__header" style="--tl-left: {tlData.monthLabelLeft}px; --tl-width: {tlData.totalDays}">
              <div class="goals-timeline__axis" style="grid-column: 1 / -1;">
                {#each tlData.monthMarkers as marker}
                  <span class="goals-timeline__month-marker" style="left: {marker.pct}%">{marker.label}</span>
                {/each}
              </div>
            </div>

            <!-- Timeline body -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="goals-timeline__body" role="img" aria-label="Goal timeline showing {goals.length} goals across weekly, monthly, and yearly horizons">
              {#each tlData.horizonGroups as group}
                <div class="goals-timeline__group">
                  <span class="goals-timeline__group-label">{group.label}</span>
                  <div class="goals-timeline__group-bars">
                    {#each group.goals as g}
                      <div class="goals-timeline__bar-row" tabindex="0" role="button" data-tooltip="{g.title}">
                        <div class="goals-timeline__bar"
                          style="left: {g.pctStart}%; width: {g.pctWidth}%">
                          <div class="goals-timeline__bar-fill" style="width: {g.progress}%"></div>
                        </div>
                        <!-- Tooltip -->
                        <div class="goals-timeline__tooltip">
                          <span class="goals-timeline__tooltip-title">{g.title}</span>
                          <span class="goals-timeline__tooltip-state" data-state={getGoalState(g)}>{getGoalPhrase(g)}</span>
                          <span class="goals-timeline__tooltip-progress"><span class="number number-stat">{g.progress}</span>% complete</span>
                          {#if g.daysRemaining !== null}
                            <span class="goals-timeline__tooltip-days"><span class="number number-tabular">{g.daysRemaining}</span> day{g.daysRemaining !== 1 ? 's' : ''} remaining</span>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

      {:else}
        <!-- ── HEATMAP VIEW ───────────────────────────────────────── -->
        {#if loading}
          <div class="goals-loading"><span class="goals-loading__text">Loading...</span></div>
        {:else if goals.length === 0}
          <div class="goals-zone-empty"><p class="goals-zone-empty__text">No activity data yet. Consistency builds over time.</p></div>
        {:else}
          <div class="goals-heatmap">
            <div class="goals-heatmap__grid" role="img" aria-label="Year activity heatmap: {hmData.days.filter(d => d.count > 0).length} days with activity">
              <!-- Month labels -->
              <div class="goals-heatmap__months">
                {#each hmData.monthHeaders as mh}
                  <span class="goals-heatmap__month-label" style="grid-column: {mh.startCol} / span {mh.span}">{mh.label}</span>
                {/each}
              </div>
              <!-- Day squares -->
              <div class="goals-heatmap__cells" style="--hm-cols: {hmData.totalWeeks}">
                {#each hmData.days as day}
                  <span class="goals-heatmap__cell"
                    style="opacity: {day.opacity}"
                    use:tooltip={{ text: `${day.dateStr}: ${day.count} update${day.count !== 1 ? 's' : ''}` }}
                  ></span>
                {/each}
              </div>
              <!-- Legend -->
              <div class="goals-heatmap__legend">
                <span>Less</span>
                <span class="goals-heatmap__legend-cell" style="opacity: 0.05"></span>
                <span class="goals-heatmap__legend-cell" style="opacity: 0.3"></span>
                <span class="goals-heatmap__legend-cell" style="opacity: 0.55"></span>
                <span class="goals-heatmap__legend-cell" style="opacity: 0.8"></span>
                <span class="goals-heatmap__legend-cell" style="opacity: 1"></span>
                <span>More</span>
              </div>
            </div>
            <!-- Most active month line -->
            <p class="goals-heatmap__insight">{hmData.insightLine}</p>
          </div>
        {/if}
      {/if}
    </Card>

  {:else if selectedSection === 'New Goal'}
    <!-- ═══════════════════════════════════════════════════════════════════
         PAGE 5 — TEMPLATES & GOAL CREATION FLOW
         ═══════════════════════════════════════════════════════════════════ -->
    <Card>
      <CardHeader>
        <CardTitle>NEW GOAL</CardTitle>
        <CardDescription>A commitment starts with a decision. What's yours?</CardDescription>
      </CardHeader>
      <CardContent>
      <div class="goals-create-form">
        <!-- Step 0: Title -->
        <div class="goals-create-field" class:goals-create-field--active={creationStep >= 0} class:goals-create-field--done={creationStep > 0}>
          <label class="goals-create-field__label" for="create-title">What are you committing to?</label>
          <input
            id="create-title"
            type="text"
            class="goals-create-field__input goals-create-field__input--hero"
            bind:value={createTitle}
            placeholder="What are you committing to?"
            onkeydown={(e) => { if (e.key === 'Enter' && createTitle.trim()) advanceCreationStep(); }}
          />
          {#if creationStep === 0}
            <p class="goals-create-field__hint">Press Enter to continue, or type and press Enter to set your title.</p>
          {/if}
        </div>

        {#if creationStep >= 1}
          <!-- Step 1: Horizon -->
          <div class="goals-create-field" class:goals-create-field--active={creationStep === 1} class:goals-create-field--done={creationStep > 1}>
            <label class="goals-create-field__label">When do you want to achieve this?</label>
            <div class="goals-create-field__horizons">
              {#each ['weekly', 'monthly', 'yearly'] as h}
                <button
                  class="goals-create-horizon-btn"
                  class:goals-create-horizon-btn--active={createHorizon === h}
                  onclick={() => { createHorizon = h; advanceCreationStep(); }}
                >
                  <span class="goals-create-horizon-btn__title">{h === 'weekly' ? 'This Week' : h === 'monthly' ? 'This Month' : 'This Year'}</span>
                  <span class="goals-create-horizon-btn__desc">{h === 'weekly' ? 'A sprint — days, not months' : h === 'monthly' ? 'A steady push — weeks of focused work' : 'A long arc — months of consistent progress'}</span>
                </button>
              {/each}
            </div>
            <div class="goals-create-nav">
              <button class="goals-create-skip" onclick={prevCreationStep}>← Back</button>
              <button class="goals-create-skip" onclick={skipField}>Skip →</button>
            </div>
          </div>
        {/if}

        {#if creationStep >= 2}
          <!-- Step 2: Target date -->
          <div class="goals-create-field" class:goals-create-field--active={creationStep === 2} class:goals-create-field--done={creationStep > 2}>
            <label class="goals-create-field__label" for="create-date">Do you have a target date?</label>
            <input
              id="create-date"
              type="text"
              class="goals-create-field__input"
              bind:value={createTargetDate}
              placeholder="e.g. Dec 31, 2026 or Q3"
              onkeydown={(e) => { if (e.key === 'Enter') advanceCreationStep(); }}
            />
            <div class="goals-create-nav">
              <button class="goals-create-skip" onclick={prevCreationStep}>← Back</button>
              <button class="goals-create-skip" onclick={skipField}>Skip →</button>
            </div>
          </div>
        {/if}

        {#if creationStep >= 3}
          <!-- Step 3: Success criteria -->
          <div class="goals-create-field" class:goals-create-field--active={creationStep === 3} class:goals-create-field--done={creationStep > 3}>
            <label class="goals-create-field__label" for="create-criteria">What does done look like?</label>
            <textarea
              id="create-criteria"
              class="goals-create-field__input goals-create-field__textarea"
              bind:value={createSuccessCriteria}
              placeholder="Describe what success means for this goal…"
              onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); advanceCreationStep(); }}}
            ></textarea>
            <div class="goals-create-nav">
              <button class="goals-create-skip" onclick={prevCreationStep}>← Back</button>
              <button class="goals-create-skip" onclick={skipField}>Skip →</button>
            </div>
          </div>
        {/if}

        {#if creationStep >= 4}
          <!-- Step 4: Focus area -->
          <div class="goals-create-field" class:goals-create-field--active={creationStep === 4} class:goals-create-field--done={creationStep > 4}>
            <label class="goals-create-field__label">Which focus area does this belong to?</label>
            <div class="goals-create-field__areas">
              <button
                class="goals-create-area-btn"
                class:goals-create-area-btn--active={createFocusAreaId === null}
                onclick={() => { createFocusAreaId = null; advanceCreationStep(); }}
              >None</button>
              {#each focusAreas as fa (fa.id)}
                <button
                  class="goals-create-area-btn"
                  class:goals-create-area-btn--active={createFocusAreaId === fa.id}
                  onclick={() => { createFocusAreaId = fa.id; advanceCreationStep(); }}
                >{fa.name}</button>
              {/each}
            </div>
            <div class="goals-create-nav">
              <button class="goals-create-skip" onclick={prevCreationStep}>← Back</button>
              <button class="goals-create-skip" onclick={skipField}>Skip →</button>
            </div>
          </div>
        {/if}

        {#if creationStep >= 5}
          <!-- Step 5: Review & Save -->
          <div class="goals-create-field goals-create-field--active">
            <div class="goals-create-review">
              <div class="goals-create-review__line"><span class="goals-create-review__tag">Goal</span> {createTitle}</div>
              <div class="goals-create-review__line"><span class="goals-create-review__tag">Horizon</span> {createHorizon === 'weekly' ? 'This Week' : createHorizon === 'monthly' ? 'This Month' : 'This Year'}</div>
              {#if createTargetDate}<div class="goals-create-review__line"><span class="goals-create-review__tag">Target</span> {createTargetDate}</div>{/if}
              {#if createSuccessCriteria}<div class="goals-create-review__line"><span class="goals-create-review__tag">Success</span> {createSuccessCriteria}</div>{/if}
              {#if createFocusAreaId}<div class="goals-create-review__line"><span class="goals-create-review__tag">Area</span> {focusAreas.find(fa => fa.id === createFocusAreaId)?.name ?? 'None'}</div>{/if}
            </div>
            {#if createError}
              <p class="goals-create-error">{createError}</p>
            {/if}
            <div class="goals-create-actions">
              <button class="goals-dialog__btn goals-dialog__btn--secondary" onclick={() => creationStep = 0}>Start over</button>
              <button class="goals-dialog__btn goals-dialog__btn--primary" onclick={submitCreation} disabled={creatingGoal || !createTitle.trim()}>
                {creatingGoal ? "Saving..." : "Commit to this goal"}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- ── Templates ─────────────────────────────────────────────── -->
      <hr class="goals-ambient-rule" />
      <section class="goals-templates">
        <span class="goals-zone-label">TEMPLATES</span>
        <p class="goals-templates__sub">Pre-built goal structures to get you started faster.</p>
        <div class="goals-templates__grid">
          {#each goalTemplates as tmpl}
            <button class="goals-template-card" onclick={() => applyTemplate(tmpl)}>
              <span class="goals-template-card__title">{tmpl.title}</span>
              <span class="goals-template-card__desc">{tmpl.desc}</span>
              <span class="goals-template-card__meta">{tmpl.horizon === 'weekly' ? 'Short sprint' : tmpl.horizon === 'monthly' ? 'Monthly arc' : 'Yearly journey'}</span>
            </button>
          {/each}
        </div>
      </section>
      </CardContent>
    </Card>

  {:else if selectedSection === 'Goals'}
    <!-- ═══════════════════════════════════════════════════════════════════
         GOALS SECTION — List view (Page 1) + Detail view (Page 2)
         ═══════════════════════════════════════════════════════════════════ -->
    {#if currentView === "detail" && detailGoal}
      <!-- ── PAGE 2 — Full Detail View ──────────────────────────────── -->
      <div class="goals-detail-page">
        <header class="goals-detail-page__header">
          <button class="goals-detail-page__back" onclick={goBackToList} aria-label="Back to goals list" use:tooltip={{ text: "Back to goals" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Back
          </button>
          <p class="goals-ambient-text">{ambientSentence}</p>
        </header>

        <div class="goals-detail-page__columns">
          <aside class="goals-detail-page__left">
            {#if detailGoal.imageBase64}
              <div class="goals-detail-page__image" style="--rotation: {imageRotation(detailGoal.id)}deg">
                <img src={detailGoal.imageBase64} alt={detailGoal.title} />
              </div>
            {/if}
            <div class="goals-detail-page__badge" data-horizon={detailGoal.horizon}>
              {detailGoal.horizon === "weekly" ? "This Week" : detailGoal.horizon === "monthly" ? "This Month" : "This Year"}
            </div>
            <div class="goals-detail-page__streak">
              <span class="goals-detail-page__streak-label">Days on track</span>
              <span class="goals-detail-page__streak-value number number-stat">{computeStreak(detailGoal.updateHistory)}</span>
            </div>
            <div class="goals-detail-page__focus-tag">
              <span class="goals-detail-page__focus-label">Focus area</span>
              <span class="goals-detail-page__focus-value">{focusAreas.find(fa => fa.id === detailGoal.focusAreaId)?.name ?? detailGoal.horizon}</span>
            </div>
            <div class="goals-detail-page__big3">
              <button class="goals-big3-btn" class:goals-big3-btn--active={detailGoal.isBig3} onclick={() => toggleBig3(detailGoal.id, detailGoal.isBig3)} aria-label={detailGoal.isBig3 ? "Remove from Big 3" : "Add to Big 3"}>
                <svg viewBox="0 0 24 24" fill={detailGoal.isBig3 ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {detailGoal.isBig3 ? "Big 3" : "Mark as Big 3"}
              </button>
            </div>
          </aside>

          <main class="goals-detail-page__center">
            {#if editingTitle}
              <div class="goals-detail-page__title-edit">
                <input type="text" class="goals-detail-page__title-input" bind:value={detailPageTitle} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(); } if (e.key === 'Escape') { editingTitle = false; detailPageTitle = detailGoal.title; } }} onblur={saveTitle} />
              </div>
            {:else}
              <h1 class="goals-detail-page__title" onclick={() => editingTitle = true} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') editingTitle = true; }}>{detailGoal.title}</h1>
            {/if}
            {#if detailGoal.successCriteria}
              <blockquote class="goals-detail-page__criteria">{detailGoal.successCriteria}</blockquote>
            {/if}
            <div class="goals-detail-page__progress-bar">
              <div class="goals-detail-page__progress-fill" style="width: {sliderProgress}%"></div>
            </div>
            <div class="goals-detail-page__slider-row">
              <input type="range" min="0" max="100" step="1" bind:value={sliderProgress} onchange={handleProgressSliderChange} class="goals-progress-slider" aria-label="Goal progress" />
              <span class="goals-detail-page__slider-value"><span class="number number-stat">{sliderProgress}</span>%</span>
            </div>
            <section class="goals-detail-page__section">
              <h3 class="goals-detail-page__section-title">Milestones</h3>
              <p class="goals-detail-page__empty-hint">Add milestones to break this goal into larger checkpoints.</p>
            </section>
            {#if detailGoal.subTasks.length > 0}
              <section class="goals-detail-page__section">
                <h3 class="goals-detail-page__section-title">Checklist</h3>
                <div class="goals-detail-page__subtasks">
                  {#each detailGoal.subTasks as st (st.id)}
                    <label class="goals-row__subtask">
                      <span class="goals-row__dot" class:goals-row__dot--done={st.done} onclick={() => toggleSubtask(st.id, detailGoal.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSubtask(st.id, detailGoal.id); }}}></span>
                      <span class="goals-row__subtask-label">{st.label}</span>
                    </label>
                  {/each}
                </div>
              </section>
            {:else}
              <section class="goals-detail-page__section">
                <h3 class="goals-detail-page__section-title">Checklist</h3>
                <p class="goals-detail-page__empty-hint">Break this goal into actionable steps.</p>
              </section>
            {/if}
            <section class="goals-detail-page__section">
              <div class="goals-add-subtask">
                <input type="text" class="goals-detail-page__notes" placeholder="Add a step…" bind:value={newSubtaskTitle} onkeydown={(e) => { if (e.key === 'Enter' && newSubtaskTitle.trim()) { newSubtaskGoalId = detailGoal.id; addSubtask(); }}} />
              </div>
            </section>
            <section class="goals-detail-page__section">
              <h3 class="goals-detail-page__section-title">Notes</h3>
              <textarea class="goals-detail-page__notes" placeholder="Reflections, updates, anything that comes to mind…" value={notesByGoalId[detailGoal.id] ?? ''} oninput={(e) => notesByGoalId[detailGoal.id] = e.currentTarget.value} onblur={() => { if (detailGoalId) debouncedSaveNotes(detailGoalId, notesByGoalId[detailGoal.id] ?? ''); }}></textarea>
            </section>
          </main>

          <aside class="goals-detail-page__right">
            <div class="goals-detail-page__reflection">
              <p class="goals-detail-page__prompt">{reflectionPrompt(detailGoal.progress)}</p>
            </div>
            <div class="goals-detail-page__review-input">
              <textarea class="goals-detail-page__review-textarea" placeholder="Write your reflection…" bind:value={reviewText}></textarea>
              <button class="goals-detail-page__review-submit" onclick={saveReview} disabled={savingReview || !reviewText.trim()}>
                {savingReview ? "Saving..." : "Save reflection"}
              </button>
            </div>
            {#if reviews.length > 0}
              <div class="goals-detail-page__review-history">
                <h3 class="goals-detail-page__section-title">Previous reflections</h3>
                {#each reviews.slice(0, 5) as review (review.id)}
                  <details class="goals-detail-page__review-entry">
                    <summary class="goals-detail-page__review-date">{new Date(parseInt(review.createdAt)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</summary>
                    <p class="goals-detail-page__review-content">{review.content}</p>
                  </details>
                {/each}
              </div>
            {/if}
            <div class="goals-detail-page__insight">
              <span class="goals-detail-page__insight-icon">*</span>
              <p class="goals-detail-page__insight-text">{computeInsight()}</p>
            </div>
          </aside>
        </div>
      </div>

    {:else}
      <!-- ════════════════════════════════════════════════════════════════
           PAGE 1 — GOALS LIST  (alternating goal card ↔ memory image)
           ════════════════════════════════════════════════════════════════ -->

      <!-- Header row: eyebrow + title + ambient subtitle, controls right -->
      <div class="gp1-header">
        <div class="gp1-header__left">
          <div class="gp1-eyebrow"><TargetIcon size={13}/><span>Goals</span><Badge variant="outline">{selectedSection}</Badge></div>
          <h1 class="gp1-title">Track what matters</h1>
          <p class="goals-ambient-text">{ambientSentence}</p>
        </div>

        <div class="gp1-header-controls">
          <!-- Horizon dropdown -->
          <div class="gp1-horizon-wrap">
            <select
              class="gp1-horizon-select"
              bind:value={horizonFilter}
              aria-label="Filter by horizon"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <svg class="gp1-horizon-caret" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <button class="goals-btn-add" onclick={() => selectedSection = 'New Goal'} aria-label="New goal">
            <svg viewBox="0 0 14 14" fill="none" width="13" height="13" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            New goal
          </button>
        </div>
      </div>

      <!-- Horizons section header -->
      <div class="gp1-horizon-section-label" data-horizon={horizonFilter}>
        {horizonFilter === 'weekly' ? 'This Week' : horizonFilter === 'monthly' ? 'This Month' : 'This Year'}
        <span class="gp1-horizon-count"><span class="number number-tabular">{filteredGoals.length}</span> goal{filteredGoals.length !== 1 ? 's' : ''}</span>
      </div>

      <!-- Goal list -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="gp1-list"
        role="region" aria-live="polite" aria-label="Goals list"
        onclick={(e) => {
          if (
            selectedGoalId &&
            !(e.target as HTMLElement).closest('.goals-detail-panel') &&
            !(e.target as HTMLElement).closest('.gp1-card')
          ) closePanel();
        }}
      >
        {#if loading}
          <div class="goals-loading">
            <span class="goals-loading__text">Loading your goals…</span>
          </div>

        {:else if filteredGoals.length === 0}
          <!-- Empty state per horizon -->
          <div class="gp1-empty">
            {#if horizonFilter === "weekly"}
              <p class="gp1-empty-head">Nothing set this week.</p>
              <p class="gp1-empty-sub">What's one thing you want to move forward in the next 7 days?</p>
            {:else if horizonFilter === "monthly"}
              <p class="gp1-empty-head">No monthly goals yet.</p>
              <p class="gp1-empty-sub">What are you building over the next 30 days?</p>
            {:else}
              <p class="gp1-empty-head">No yearly goals.</p>
              <p class="gp1-empty-sub">What's the long arc you're committing to this year?</p>
            {/if}
            <button class="goals-btn-add" onclick={() => selectedSection = 'New Goal'}>
              <svg viewBox="0 0 14 14" fill="none" width="13" height="13" aria-hidden="true">
                <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
              Start with one goal
            </button>
          </div>

        {:else}
          {#each filteredGoals as goal, i (goal.id)}
            <!--
              Alternating: even index → card LEFT + image RIGHT
                           odd  index → image LEFT + card RIGHT
              CSS class gp1-pair--flip handles the reversal.
            -->
            <div class="gp1-pair" class:gp1-pair--flip={i % 2 === 1}>

              <!-- ── Goal card — uses Health medication row layout exactly ── -->
              <article
                class="gp1-card"
                class:gp1-card--selected={selectedGoalId === goal.id}
                onclick={() => handleRowClick(goal.id)}
                role="button"
                tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(goal.id); } }}
                aria-label="Goal: {goal.title}"
              >
                <!-- Header row: title + horizon badge + open -->
                <div class="gp1-card-hdr">
                  <h3 class="gp1-card-title">{goal.title}</h3>
                  <div class="gp1-card-hdr-right">
                    <span class="gp1-horizon-badge" data-horizon={goal.horizon}>
                      {goal.horizon === 'weekly' ? 'Week' : goal.horizon === 'monthly' ? 'Month' : 'Year'}
                    </span>
                    <button
                      class="gp1-open-btn"
                      type="button"
                      onclick={(e) => { e.stopPropagation(); openFullView(goal.id); }}
                      aria-label="Open full view for {goal.title}"
                    >Open
                      <svg viewBox="0 0 10 10" fill="none" width="9" height="9" aria-hidden="true">
                        <path d="M2 8l6-6M4 2h4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Subtask rows — exact Health med-item grid: [check | copy | right] -->
                <div class="gp1-med-list">
                  {#if goal.subTasks.length > 0}
                    {#each goal.subTasks as st, si (st.id)}
                      <div class="gp1-med-item" class:gp1-med-item--done={st.done}>
                        <!-- Check circle (30px) -->
                        <button
                          class="gp1-med-check"
                          class:gp1-med-check--done={st.done}
                          type="button"
                          aria-label="{st.done ? 'Mark incomplete' : 'Complete'}: {st.label}"
                          onclick={(e) => { e.stopPropagation(); toggleSubtask(st.id, goal.id); }}
                        >
                          {#if st.done}
                            <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2 5.2l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                          {/if}
                        </button>
                        <!-- Copy: name + step number -->
                        <div class="gp1-med-copy">
                          <strong>{st.label}</strong>
                          <p>Step <span class="number number-tabular">{si + 1}</span> of <span class="number number-tabular">{goal.subTasks.length}</span></p>
                        </div>
                        <!-- Right: done/pending state -->
                        <div class="gp1-med-right">
                          <span class="gp1-med-state" class:gp1-med-state--done={st.done}>
                            {st.done ? 'Done' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <p class="gp1-med-empty">No steps yet. Add steps in the full view.</p>
                  {/if}
                </div>

                <!-- Footer state phrase -->
                <div class="gp1-card-footer">
                  <span class="goals-row__state" data-state={getGoalState(goal)}>
                    {getGoalPhrase(goal)}
                  </span>
                  <span class="gp1-progress-pct"><span class="number number-stat">{goal.progress}</span>%</span>
                </div>
              </article>

              <!-- ── Memory image ──────────────────────────────────── -->
              <div class="gp1-memory">
                {#if goal.imageBase64}
                  <div
                    class="gp1-memory-photo"
                    style="--rot:{imageRotation(goal.id)}deg"
                  >
                    <img src={goal.imageBase64} alt="Memory for {goal.title}" />
                  </div>
                {:else}
                  <button
                    class="gp1-memory-empty"
                    type="button"
                    aria-label="Add a memory image for {goal.title}"
                    onclick={(e) => { e.stopPropagation(); uploadTargetId = goal.id; fileInput?.click(); }}
                  >
                    <UploadIcon size={20} />
                    <span class="gp1-memory-empty-label">Add a memory</span>
                    <span class="gp1-memory-empty-sub">A photo tied to this goal</span>
                  </button>
                {/if}
              </div>

            </div><!-- end gp1-pair -->
          {/each}
        {/if}
      </div><!-- end gp1-list -->

      <!-- Hidden file input -->
      <input type="file" accept="image/*" bind:this={fileInput} onchange={() => { if (uploadTargetId) { handleImageUpload(uploadTargetId); uploadTargetId = null; }}} style="display:none" aria-hidden="true" />

      <!-- Detail Panel (slide-in) -->
      {#if selectedGoal}
        <aside class="goals-detail-panel">
          <div class="goals-panel__scrim" onclick={closePanel}></div>
          <div class="goals-panel__body">
            <button class="goals-panel__close" onclick={closePanel} aria-label="Close panel" use:tooltip={{ text: "Close panel" }}><XIcon /></button>
            <div class="goals-panel__scroll">
              <div class="goals-panel__header">
                <h2 class="goals-panel__title">{selectedGoal.title}</h2>
                <span class="goals-row__state" data-state={getGoalState(selectedGoal)}>{getGoalPhrase(selectedGoal)}</span>
              </div>
              <div class="goals-panel__progress-bar"><div class="goals-panel__progress-fill" style="width: {selectedGoal.progress}%"></div></div>
              <div class="goals-panel__progress-actions">
                <button class="goals-panel__progress-btn" onclick={() => updateProgress(selectedGoal.id, Math.min(selectedGoal.progress + 10, 100))} disabled={selectedGoal.progress >= 100}>+10%</button>
                <button class="goals-panel__progress-btn" onclick={() => updateProgress(selectedGoal.id, Math.min(selectedGoal.progress + 25, 100))} disabled={selectedGoal.progress >= 100}>+25%</button>
                <span class="goals-panel__progress-value"><span class="number number-stat">{selectedGoal.progress}</span>%</span>
              </div>
              <button class="goals-panel__big3-btn" class:goals-panel__big3-btn--active={selectedGoal.isBig3} onclick={() => toggleBig3(selectedGoal.id, selectedGoal.isBig3)}>
                <svg viewBox="0 0 24 24" fill={selectedGoal.isBig3 ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {selectedGoal.isBig3 ? "Big 3 Goal" : "Make Big 3"}
              </button>
              <button class="goals-open-full-view" onclick={() => { openFullView(selectedGoal.id); closePanel(); }}>Open full view</button>
              <div class="goals-panel__meta">
                {#if selectedGoal.targetDate}<div class="goals-panel__field"><span class="goals-panel__label">Target date</span><span class="goals-panel__value">{selectedGoal.targetDate}</span></div>{/if}
                {#if selectedGoal.successCriteria}<div class="goals-panel__field"><span class="goals-panel__label">Success criteria</span><p class="goals-panel__text">{selectedGoal.successCriteria}</p></div>{/if}
              </div>
              {#if selectedGoal.subTasks.length > 0}
                <div class="goals-panel__section">
                  <span class="goals-panel__label">Checklist</span>
                  <div class="goals-panel__subtasks">
                    {#each selectedGoal.subTasks as st (st.id)}
                      <label class="goals-row__subtask">
                        <span class="goals-row__dot" class:goals-row__dot--done={st.done} onclick={() => toggleSubtask(st.id, selectedGoal.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSubtask(st.id, selectedGoal.id); }}}></span>
                        <span class="goals-row__subtask-label">{st.label}</span>
                      </label>
                    {/each}
                  </div>
                </div>
              {/if}
              <div class="goals-panel__section">
                <span class="goals-panel__label">Notes</span>
                <textarea class="goals-panel__notes" placeholder="Reflections, updates…" value={notesByGoalId[selectedGoal.id] ?? ''} oninput={(e) => notesByGoalId[selectedGoal.id] = e.currentTarget.value} onblur={() => debouncedSaveNotes(selectedGoal.id, notesByGoalId[selectedGoal.id] ?? '')}></textarea>
              </div>
              <div class="goals-panel__reflection">
                <span class="goals-panel__label">Reflection</span>
                <p class="goals-panel__prompt">{reflectionPrompt(selectedGoal.progress)}</p>
              </div>
              <div class="goals-panel__section">
                <span class="goals-panel__label">Add step</span>
                <input type="text" class="goals-panel__notes" placeholder="New subtask…" bind:value={newSubtaskTitle} onkeydown={(e) => { if (e.key === 'Enter' && newSubtaskTitle.trim()) { newSubtaskGoalId = selectedGoal.id; addSubtask(); }}} style="min-height: auto; padding: 0.4rem 0.65rem;" />
              </div>
              <button class="goals-panel__delete" onclick={() => deleteGoal(selectedGoal.id)}>Delete goal</button>
            </div>
          </div>
        </aside>
      {/if}

      
    {/if}
  {/if}

  {#if errorMessage}
    <div class="goals-error-toast" role="alert" aria-live="assertive">{errorMessage}</div>
  {/if}
</div>
