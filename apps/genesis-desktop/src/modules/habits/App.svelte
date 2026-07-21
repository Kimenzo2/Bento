<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import CheckIcon from "@lucide/svelte/icons/check";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import Grid3x3Icon from "@lucide/svelte/icons/grid-3x3";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import SearchIcon from "@lucide/svelte/icons/search";
  import TargetIcon from "@lucide/svelte/icons/target";
  import StarIcon from "@lucide/svelte/icons/star";
  import FootprintsIcon from "@lucide/svelte/icons/footprints";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import DropletIcon from "@lucide/svelte/icons/droplet";
  import WindIcon from "@lucide/svelte/icons/wind";
  import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import AppleIcon from "@lucide/svelte/icons/apple";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import MusicIcon from "@lucide/svelte/icons/music";
  import PenIcon from "@lucide/svelte/icons/pen";
  import LeafIcon from "@lucide/svelte/icons/leaf";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import HeartIcon from "@lucide/svelte/icons/heart";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import CoffeeIcon from "@lucide/svelte/icons/coffee";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
  } from "$lib/components/ui/card/index.js";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let { moduleId = 'habits', settings = {} } = $props();
  $effect(() => { void settings; });

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Section nav ─────────────────────────────────────────────────
  const sectionLabels = ["Today", "Streaks", "Heatmap", "Review", "Settings"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));
  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  // ── Loading / error ──────────────────────────────────────────────
  let loading = $state(true);
  let loadError = $state('');

  // ── State ────────────────────────────────────────────────────────
  type CompletionType = 'binary' | 'count' | 'duration';
  type Frequency = 'daily' | 'weekdays' | 'weekends';
  type HabitKind = 'build' | 'quit';

  type Habit = {
    id: string;
    name: string;
    emoji: string;
    color: string;
    kind: HabitKind;
    streak: number;
    longestStreak: number;
    completedToday: boolean;
    skippedToday: boolean;
    frozenStreak: boolean;
    completionType: CompletionType;
    targetCount: number;
    currentCount: number;
    unit: string;
    frequency: Frequency;
    timeOfDay: string;
    why: string;
    stackAfterId: string | null;
    stackAfterName: string;
    completionHistory: boolean[];
    archived: boolean;
    createdAt: number;
  };

  let habits: Habit[] = $state([]);

  // ── Backend sync ─────────────────────────────────────────────────
  async function loadHabits() {
    loading = true;
    loadError = '';
    try {
      const rows: any[] = await invoke('habits_list');
      habits = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        color: r.color,
        kind: (r.kind || 'build') as HabitKind,
        streak: r.streak ?? 0,
        longestStreak: r.longestStreak ?? 0,
        completedToday: r.completedToday ?? false,
        skippedToday: r.skippedToday ?? false,
        frozenStreak: r.frozenStreak ?? false,
        completionType: (r.completionType || 'binary') as CompletionType,
        targetCount: r.targetCount ?? 1,
        currentCount: r.currentCount ?? 0,
        unit: r.unit || '',
        frequency: (r.frequency || 'daily') as Frequency,
        timeOfDay: r.timeOfDay || 'anytime',
        why: r.why || '',
        stackAfterId: r.stackAfterId ?? null,
        stackAfterName: r.stackAfterName || '',
        completionHistory: Array.isArray(r.completionHistory) ? r.completionHistory : [],
        archived: r.archived ?? false,
        createdAt: r.createdAt ?? Date.now(),
      }));
    } catch (e: any) {
      loadError = String(e?.message || e);
      habits = [];
    } finally {
      loading = false;
    }
  }

  async function loadFreezeState() {
    try {
      const state: any = await invoke('habits_get_freeze_state');
      freezeTokens = state.freezeTokens ?? 3;
      usedFreezeTokens = state.usedFreezeTokens ?? 0;
    } catch {
      freezeTokens = 3;
      usedFreezeTokens = 0;
    }
  }

  let freezeTokens = $state(3);
  let usedFreezeTokens = $state(0);
  let availableFreezeTokens = $derived(freezeTokens - usedFreezeTokens);

  onMount(() => {
    loadHabits();
    loadFreezeState();
  });

  // ── Derived ─────────────────────────────────────────────────────
  let activeHabits = $derived(habits.filter(h => !h.archived));
  let completedCount = $derived(activeHabits.filter(h => h.completedToday).length);
  let totalHabits = $derived(activeHabits.length);
  let progressPct = $derived(totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0);
  let topStreak = $derived(Math.max(...activeHabits.map(h => h.streak), 0));
  let streakMilestoneLabel = $derived.by((): string => {
    if (topStreak <= 0) return '';
    if (topStreak >= 100) return '100 days — this isn\'t a habit anymore, it\'s who you are. Extraordinary.';
    if (topStreak >= 30) return '30 days — a full month. This practice is now part of your identity.';
    if (topStreak >= 14) return '14 days — two weeks. Your brain is starting to automate this.';
    if (topStreak >= 7) return '7 days — a full week. The first real milestone. You built something.';
    if (topStreak >= 3) return '3 days — three in a row. Momentum is building.';
    return '';
  });
  let avgRate = $derived(activeHabits.length > 0
    ? Math.round(activeHabits.reduce((s,h) => s + h.completionHistory.filter(Boolean).length / 90, 0) / activeHabits.length * 100) : 0);
  let sortedByStreak = $derived([...activeHabits].sort((a,b) => b.streak - a.streak));
  let bestHabit = $derived([...activeHabits].sort((a,b) =>
    b.completionHistory.filter(Boolean).length - a.completionHistory.filter(Boolean).length)[0]);
  let thisWeekTotal = $derived(activeHabits.reduce((s,h) => s + h.completionHistory.slice(-7).filter(Boolean).length, 0));
  let progressNarrative = $derived.by((): string => {
    if (totalHabits === 0) return '';
    if (completedCount === totalHabits) return 'Every one done. You showed up fully — that\'s how change happens.';
    if (completedCount >= totalHabits * 0.7) return `${completedCount} of ${totalHabits} — almost there. Keep going at your own pace.`;
    if (completedCount === 0) return 'No taps yet. Start with one — that\'s enough right now.';
    return `${completedCount} of ${totalHabits}. Small steps compound.`;
  });

  // ── Time-of-day logic ───────────────────────────────────────────
  const timeOfDayTabs = ['Now','Morning','Afternoon','Evening','All'] as const;
  let selectedTimeTab = $state('Now');
  
  function getCurrentPeriod(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  // Reactive clock period — updates every 60s so "Now" tab adapts to time of day
  let clockPeriod = $state(getCurrentPeriod());
  onMount(() => {
    const iv = setInterval(() => { clockPeriod = getCurrentPeriod(); }, 60_000);
    return () => clearInterval(iv);
  });

  const emptyStateMessages: Record<string, { emoji: string; message: string }> = {
    morning: { emoji: '🌅', message: 'Good morning. What\'s one thing you want to become more consistent at?' },
    afternoon: { emoji: '☀️', message: 'Afternoon check-in. What small habit would make today feel complete?' },
    evening: { emoji: '🌙', message: 'Evening wind-down. One small habit now can set up tomorrow for success.' },
  };
  let emptyStateMessage = $derived(emptyStateMessages[clockPeriod] ?? emptyStateMessages.evening);

  let undoneHabits = $derived(activeHabits.filter(h => !h.completedToday && !h.skippedToday));
  
  /** Habits for the "Now" tab — matching current time period. Stacked habits shown even when blocked. */
  let nowHabits = $derived(undoneHabits.filter(h => h.timeOfDay === 'anytime' || h.timeOfDay === clockPeriod));

  let morningHabits = $derived(undoneHabits.filter(h => h.timeOfDay === 'morning' || h.timeOfDay === 'anytime'));
  let afternoonHabits = $derived(undoneHabits.filter(h => h.timeOfDay === 'afternoon' || h.timeOfDay === 'anytime'));
  let eveningHabits = $derived(undoneHabits.filter(h => h.timeOfDay === 'evening' || h.timeOfDay === 'anytime'));
  
  /** Filtered habits based on selected time tab */
  let filteredHabits = $derived.by((): Habit[] => {
    switch (selectedTimeTab) {
      case 'Now': return nowHabits;
      case 'Morning': return morningHabits;
      case 'Afternoon': return afternoonHabits;
      case 'Evening': return eveningHabits;
      case 'All': return undoneHabits;
      default: return undoneHabits;
    }
  });

  /** Flow priority: higher = more important to do first.
   - Fragile streaks (2-5 days) are most likely to break - do them first
   - Compounding momentum (4+ of last 7 days) - protect the streak  */
  function flowPriority(h: Habit): number {
    if (h.streak >= 2 && h.streak <= 5) return 3;
    const last7 = h.completionHistory.slice(-7).filter(Boolean).length;
    if (last7 >= 4) return 2;
    return 1;
  }

  /** Chain ordering: stacked habits appear together in dependency order */
  let chainOrderedHabits = $derived.by((): Habit[] => {
    const pool = [...filteredHabits];
    const used = new Set<string>();
    const result: Habit[] = [];
    // Find all habits that serve as anchors
    const anchorIds = new Set(pool.filter(h => h.stackAfterId).map(h => h.stackAfterId!));
    // First pass: process ROOT anchors — anchors that are NOT themselves
    // stacked after another habit in the pool. This ensures chains are
    // built root → leaf in correct dependency order regardless of pool order.
    for (const h of pool) {
      if (used.has(h.id)) continue;
      if (anchorIds.has(h.id) && !h.stackAfterId) {
        let current: Habit | undefined = h;
        while (current && !used.has(current.id)) {
          used.add(current.id);
          result.push(current);
          current = pool.find(n => n.stackAfterId === current!.id);
        }
      }
    }
    // Second pass: handle anchors whose root is outside the pool
    // (e.g., anchor was completed, so it's not in the filtered view)
    for (const h of pool) {
      if (used.has(h.id)) continue;
      if (anchorIds.has(h.id)) {
        let current: Habit | undefined = h;
        while (current && !used.has(current.id)) {
          used.add(current.id);
          result.push(current);
          current = pool.find(n => n.stackAfterId === current!.id);
        }
      }
    }
    // Third pass: add remaining standalone habits sorted by flow priority
    const standalone = pool.filter(h => !used.has(h.id));
    standalone.sort((a, b) => {
      const pa = flowPriority(a);
      const pb = flowPriority(b);
      return pb - pa;
    });
    for (const h of standalone) {
      used.add(h.id);
      result.push(h);
    }
    return result;
  });

  /** Set of habit IDs that are blocked by an incomplete anchor */
  let blockedHabitIds = $derived.by((): Set<string> => {
    const blocked = new Set<string>();
    for (const h of undoneHabits) {
      if (h.stackAfterId) {
        const prereq = activeHabits.find(a => a.id === h.stackAfterId);
        if (prereq && !prereq.completedToday) {
          blocked.add(h.id);
        }
      }
    }
    return blocked;
  });

  /** Completed habits to show under the filtered list */
  let completedTodayHabits = $derived(activeHabits.filter(h => h.completedToday));

  /** Get the stack chain for a habit tooltip */
  function getStackChain(h: Habit): string {
    if (!h.stackAfterId || !h.stackAfterName) return '';
    return `Stacked after: ${h.stackAfterName}`;
  }

  let bestDay = $derived.by(() => {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts = [0,0,0,0,0,0,0];
    const today = new Date();
    activeHabits.forEach(h => h.completionHistory.forEach((done,i) => {
      if (done) { const d = new Date(today); d.setDate(today.getDate()-(89-i)); counts[d.getDay()]++; }
    }));
    return days[counts.indexOf(Math.max(...counts))];
  });

  // ── Insight generation ─────────────────────────────────────────
  // Today page = quick nudges. Review page = deeper patterns.
  let todayNudges = $derived.by((): { emoji: string; message: string }[] => {
    const msgs: { emoji: string; message: string }[] = [];
    if (activeHabits.length === 0) return [{ emoji: "🌱", message: "Add your first habit. One small step is all it takes." }];

    const undone = activeHabits.filter(h => !h.completedToday && !h.skippedToday);
    if (undone.length === 0) {
      msgs.push({ emoji: "🌟", message: "Every box checked, every intention met. You showed up fully — that's how change happens." });
    } else if (undone.length <= 2) {
      msgs.push({ emoji: "🍃", message: `Just ${undone.length} left — gentle pace. No rush, no pressure.` });
    } else {
      msgs.push({ emoji: "💛", message: `${undone.length} remaining. Pick one, start there. That's enough for now.` });
    }

    const completed = activeHabits.filter(h => h.completedToday);
    if (completed.length > 0) {
      const quitDone = completed.find(h => h.kind === 'quit');
      if (quitDone) {
        msgs.push({ emoji: "🛡️", message: `You resisted ${quitDone.name} today — that's a choice worth celebrating.` });
      }
    }

    if (topStreak >= 7 && sortedByStreak[0]) {
      msgs.push({ emoji: "🌿", message: `${sortedByStreak[0].name} is at ${topStreak} days. You're in a rhythm now.` });
    }

    return msgs;
  });

  let reviewInsights = $derived.by((): { emoji: string; message: string }[] => {
    const msgs: { emoji: string; message: string }[] = [];
    if (activeHabits.length === 0) return [{ emoji: "🌱", message: "Start small. One habit at a time. The data will follow." }];

    if (topStreak >= 14) msgs.push({ emoji: "🌿", message: `${sortedByStreak[0]?.name} at ${topStreak} days — that's two weeks of steady practice. Real momentum.` });
    else if (topStreak >= 7) msgs.push({ emoji: "💪", message: `${sortedByStreak[0]?.name} reached ${topStreak} days. The first week is the hardest — you've built a foundation.` });
    else if (topStreak >= 3) msgs.push({ emoji: "🌱", message: `A ${topStreak}-day streak on ${sortedByStreak[0]?.name}. Keep showing up — it compounds.` });
    else msgs.push({ emoji: "💛", message: "Every streak starts with day one. You're here, and that matters." });

    if (avgRate >= 80) msgs.push({ emoji: "✨", message: `${avgRate}% consistency over 90 days — that's extraordinary. Trust the process.` });
    else if (avgRate >= 60) msgs.push({ emoji: "👏", message: `${avgRate}% of days over 90 days. Progress, not perfection — you're building a practice.` });
    else if (avgRate >= 40) msgs.push({ emoji: "🔄", message: `${avgRate}% completion over 90 days. Small improvements compound. Try stacking a new habit onto an existing routine.` });
    else msgs.push({ emoji: "🌸", message: "Some seasons are gentler than others. Showing up even some of the time is still a win." });

    if (bestDay) msgs.push({ emoji: "📅", message: `${bestDay}s are your strongest day. What makes ${bestDay}s different? Leaning into that pattern could help.` });

    const quitting = activeHabits.filter(h => h.kind === 'quit');
    if (quitting.length > 0) {
      const qStreaks = quitting.filter(h => h.streak >= 3);
      if (qStreaks.length > 0) {
        msgs.push({ emoji: "🛡️", message: `Reducing ${qStreaks[0].name} for ${qStreaks[0].streak} days — every resisted urge rewires the habit loop.` });
      } else {
        msgs.push({ emoji: "💛", message: `Working on reducing ${quitting[0].name}. Be kind to yourself — changing takes time.` });
      }
    }

    // Pattern: consistency across weekdays
    if (activeHabits.length >= 3) {
      const weekCounts = [0,0,0,0,0,0,0];
      const today = new Date();
      activeHabits.forEach(h => h.completionHistory.forEach((done, i) => {
        if (done) { const d = new Date(today); d.setDate(today.getDate()-(89-i)); weekCounts[d.getDay()]++; }
      }));
      const max = Math.max(...weekCounts);
      const nonZero = weekCounts.filter(c => c > 0);
      if (nonZero.length > 0) {
        const min = Math.min(...nonZero);
        if (max > 0 && max - min > 5) {
        const bestDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][weekCounts.indexOf(max)];
        const worstDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][weekCounts.indexOf(min)];
        msgs.push({ emoji: "📊", message: `Your consistency dips on ${worstDayName}s. Could you prepare something the night before?` });
      } }
    }

    return msgs;
  });

  // ── Actions ─────────────────────────────────────────────────────
  async function toggleComplete(id: string) {
    try {
      await invoke('habits_toggle_complete', { habitId: id });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function skipHabit(id: string) {
    try {
      await invoke('habits_skip_today', { habitId: id });
      await loadHabits();
    } catch {
      // fallback: local only
      habits = habits.map(h => h.id !== id ? h : { ...h, skippedToday: true, completedToday: false });
    }
  }

  async function freezeStreak(id: string) {
    if (availableFreezeTokens <= 0) return;
    try {
      await invoke('habits_freeze_streak', { habitId: id });
      await loadHabits();
      await loadFreezeState();
    } catch {
      // fallback
      habits = habits.map(h => h.id !== id ? h : { ...h, frozenStreak: true });
      usedFreezeTokens++;
    }
  }

  async function incrementCount(id: string) {
    try {
      await invoke('habits_increment', { habitId: id });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function archiveHabit(id: string) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (!confirm(`Archive "${habit.name}"? You can always unarchive it later.`)) return;
    try {
      await invoke('habits_save', {
        input: {
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          kind: habit.kind,
          completionType: habit.completionType,
          targetCount: habit.targetCount,
          unit: habit.unit,
          frequency: habit.frequency,
          why: habit.why,
          archived: true,
        },
      });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function unarchiveHabit(id: string) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    try {
      await invoke('habits_save', {
        input: {
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          kind: habit.kind,
          completionType: habit.completionType,
          targetCount: habit.targetCount,
          unit: habit.unit,
          frequency: habit.frequency,
          why: habit.why,
          archived: false,
        },
      });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  async function deleteHabit(id: string) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    if (!confirm(`Permanently delete "${habit.name}"? This cannot be undone.`)) return;
    try {
      await invoke('habits_delete', { id });
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  // ── Add / Edit habit modal ──────────────────────────────────────
  let showAddModal = $state(false);
  let editingHabitId: string | null = $state(null);
  let isEditing = $derived(editingHabitId !== null);
  let newHabit = $state({
    name: '', emoji: 'Star', color: 'var(--mod-accent)',
    kind: 'build' as HabitKind,
    completionType: 'binary' as CompletionType,
    targetCount: 1, unit: '', frequency: 'daily' as Frequency,
    timeOfDay: 'anytime' as string,
    why: '',
    stackAfterId: '',
    stackAfterName: '',
  });
  const habitIcons: Record<string, any> = {
    'Star': StarIcon,
    'Footprints': FootprintsIcon,
    'BookOpen': BookOpenIcon,
    'Droplet': DropletIcon,
    'Wind': WindIcon,
    'Smartphone': SmartphoneIcon,
    'Target': TargetIcon,
    'Dumbbell': DumbbellIcon,
    'Apple': AppleIcon,
    'Moon': MoonIcon,
    'Palette': PaletteIcon,
    'Music': MusicIcon,
    'Pen': PenIcon,
    'Leaf': LeafIcon,
    'Brain': BrainIcon,
    'Heart': HeartIcon,
    'Zap': ZapIcon,
    'Monitor': MonitorIcon,
    'Headphones': HeadphonesIcon,
    'Coffee': CoffeeIcon,
  };
  const iconOptions = Object.keys(habitIcons);
  const colorOptions = ['var(--mod-accent)','#7c3aed','#0284c7','#d97706','#16a34a','#dc2626','#e05a3a'];

  function openAddModal() {
    editingHabitId = null;
    newHabit = { name: '', emoji: 'Star', color: 'var(--mod-accent)', kind: 'build', completionType: 'binary', targetCount: 1, unit: '', frequency: 'daily', timeOfDay: 'anytime', why: '', stackAfterId: '', stackAfterName: '' };
    showAddModal = true;
  }

  function openEditModal(h: Habit) {
    editingHabitId = h.id;
    newHabit = {
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      kind: h.kind,
      completionType: h.completionType,
      targetCount: h.targetCount,
      unit: h.unit,
      frequency: h.frequency,
      timeOfDay: h.timeOfDay,
      why: h.why,
      stackAfterId: h.stackAfterId ?? '',
      stackAfterName: h.stackAfterName,
    };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
    editingHabitId = null;
    newHabit = { name: '', emoji: 'Star', color: 'var(--mod-accent)', kind: 'build', completionType: 'binary', targetCount: 1, unit: '', frequency: 'daily', timeOfDay: 'anytime', why: '', stackAfterId: '', stackAfterName: '' };
  }

  async function saveNewHabit() {
    if (!newHabit.name.trim()) return;
    try {
      await invoke('habits_save', {
        input: {
          ...(editingHabitId ? { id: editingHabitId } : {}),
          name: newHabit.name.trim(),
          emoji: newHabit.emoji,
          color: newHabit.color,
          kind: newHabit.kind,
          completionType: newHabit.completionType,
          targetCount: newHabit.targetCount,
          unit: newHabit.unit,
          frequency: newHabit.frequency,
          timeOfDay: newHabit.timeOfDay,
          why: newHabit.why,
          stackAfterId: newHabit.stackAfterId || null,
          stackAfterName: newHabit.stackAfterName,
        },
      });
      closeAddModal();
      await loadHabits();
    } catch {
      await loadHabits();
    }
  }

  // ── Heatmap ─────────────────────────────────────────────────────
  let heatmapHabitId: string | null = $state(null);
  let heatmapHabit = $derived(activeHabits.find(h => h.id === heatmapHabitId) ?? activeHabits[0]);
  function hmOpacity(i: number) { return (0.3 + 0.7 * (i / 89)).toFixed(2); }


  // ── Mood tagging ────────────────────────────────────────────────
  let habitMoods: Record<string, string> = $state({});

  // ── Settings toggles ────────────────────────────────────────────
  let notifyEndOfDay = $state(true);
  let notifyMilestones = $state(true);
  let notifyWeeklyReview = $state(true);
</script>

{#snippet habitIcon(name: string, size = 16, color = "")}
  {#if name && habitIcons[name]}
    {@const Icon = habitIcons[name]}
    <Icon {size} style={color ? `color:${color}` : "color:inherit"} />
  {:else if name}
    <span class="hb-icon-fallback" style="font-size:{size}px;line-height:1">{name}</span>
  {/if}
{/snippet}

<main class="hb-workspace module-root" data-module="habits">

  {#if loading}
    <section class="hb-page hb-loading">
      <div class="hb-loading__orb"></div>
      <p>Loading your habits…</p>
    </section>

  {:else if loadError}
    <section class="hb-page hb-loading">
      <p>Could not load habits: {loadError}</p>
      <Button onclick={() => { location.reload(); }}>Retry</Button>
    </section>

  {:else}
  <!-- ════════════════════════════════════════ TODAY ════════════════════════════════════════ -->
  {#if selectedSection === "Today"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><TargetIcon size={13}/><span>Habits</span><Badge variant="outline">Today</Badge></div>
        <h1>Today's practice</h1>
        <p>One tap to log. No pressure, no judgment — just showing up is enough.</p>
      </div>
      <div class="hb-page__actions">
        <Button onclick={openAddModal}><PlusIcon size={15}/>&nbsp;New</Button>
      </div>
    </header>

    <!-- Quick-log strip: one-tap emoji buttons for all undone habits -->
    {#if undoneHabits.length > 0}
      <section class="hb-quick-log">
        <div class="hb-quick-log__inner">
          {#each undoneHabits as h}
            <button class="hb-quick-btn" style="--hc:{h.color}" title={h.name} aria-label={h.name}
              onclick={async () => { await toggleComplete(h.id); }}>
              <span class="hb-quick-icon">{@render habitIcon(h.emoji, 16)}</span>
              <span class="hb-quick-label">{h.name}</span>
            </button>
          {/each}
        </div>
      </section>
    {:else if activeHabits.length > 0}
      <section class="hb-quick-log hb-quick-log--done">
        <div class="hb-quick-log__inner">
          <span class="hb-quick-all-done">🌟 Everything done today!</span>
        </div>
      </section>
    {/if}

    <!-- Hero: ring + glance -->
    <section class="hb-hero-grid">
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>{completedCount} of {totalHabits} done today</CardDescription>
        </CardHeader>
        <CardContent class="hb-ring-content">
          <div class="hb-ring-wrap">
            <PremiumRing
              size={140}
              thickness={11}
              segments={[{ value: progressPct, color: "var(--mod-accent)", label: "Done" }]}
              centerLabel="Today"
              centerValue={`${Math.round(progressPct)}%`}
              centerNote={`${completedCount}/${totalHabits}`}
            />
          </div>
          {#if progressNarrative}<p class="hb-ring-narrative">{progressNarrative}</p>{/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>At a glance</CardTitle>
          <CardDescription>Your momentum, right now.</CardDescription>
        </CardHeader>
        <CardContent class="hb-glance">
          <article><span>Top streak</span><strong>{topStreak} days</strong>{#if streakMilestoneLabel}<span class="hb-milestone-note">{streakMilestoneLabel}</span>{/if}</article>
          <article><span>90-day rate</span><strong>{avgRate}%</strong></article>
          <article><span>Best day</span><strong>{bestDay}s</strong></article>
          <article><span>Freeze tokens</span><strong>{availableFreezeTokens} left</strong></article>
        </CardContent>
      </Card>
    </section>

    <!-- Time-of-day tabs -->
    <div class="hb-tod-tabs">
      {#each timeOfDayTabs as tab}
        <button class="hb-tod-tab" class:hb-tod-tab-on={selectedTimeTab === tab}
          onclick={() => selectedTimeTab = tab}>
          {#if tab === 'Now'}<span class="hb-tod-icon">⏰</span>
          {:else if tab === 'Morning'}<span class="hb-tod-icon">🌅</span>
          {:else if tab === 'Afternoon'}<span class="hb-tod-icon">☀️</span>
          {:else if tab === 'Evening'}<span class="hb-tod-icon">🌙</span>
          {:else}<span class="hb-tod-icon">📋</span>
          {/if}
          {tab}
          {#if tab === 'Now'}<span class="hb-tod-count">{nowHabits.length}</span>
          {:else if tab === 'All'}<span class="hb-tod-count">{undoneHabits.length}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Body: habit list + insights -->
    <section class="hb-body hb-grid--2col">
      <Card>
        <CardHeader>
          <CardTitle>{selectedTimeTab === 'Now' ? "Due now" : selectedTimeTab === 'All' ? "All habits" : `${selectedTimeTab} habits`}</CardTitle>
          <CardDescription>
            {#if selectedTimeTab === 'Now'}
              What's ready for you right now.
            {:else}
              Tap to log. Tap name to remember your why.
            {/if}
          </CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#if chainOrderedHabits.length > 0}
            {#each chainOrderedHabits as h (h.id)}
              <article class="hb-habit-row" class:hb-skip={blockedHabitIds.has(h.id)} style="--hc:{h.color}">
                <button class="hb-check" aria-label="Toggle completion" onclick={() => toggleComplete(h.id)} use:tooltip={{ text: "Complete habit" }}>
                  <CheckIcon size={14}/>
                </button>
                <div class="hb-identity">
                  <span class="hb-icon">{@render habitIcon(h.emoji, 18, "var(--hc)")}</span>
                  <div>
                    <span class="hb-hname">{h.name}</span>
                    {#if h.why}<span class="hb-why-peek">{h.why}</span>{/if}
                    <span class="hb-kind">
                      {#if h.stackAfterName}
                        After {h.stackAfterName} ·
                      {/if}
                      {h.kind === 'quit' ? 'reducing' : h.frequency}
                      {#if h.timeOfDay !== 'anytime' && selectedTimeTab === 'All'}
                        · {h.timeOfDay}
                      {/if}
                    </span>
                  </div>
                </div>
                {#if h.completionType !== 'binary'}
                  <div class="hb-count-block">
                    <span>{h.currentCount}/{h.targetCount}&thinsp;{h.unit}</span>
                    <button class="hb-inc" aria-label="Increment count" onclick={() => incrementCount(h.id)} use:tooltip={{ text: "Add one" }}>+1</button>
                  </div>
                {/if}
                {#if h.stackAfterName}
                  <div class="hb-stack-badge hb-chain-badge" title={getStackChain(h)}>
                    <span class="hb-stack-icon">🔗</span>
                    <span class="hb-stack-label">{h.stackAfterName}</span>
                  </div>
                {/if}
                <div class="hb-streak-pill" title={`Day ${h.streak}`}>
                  <span>{h.streak}</span><span class="hb-streak-unit">d</span>
                </div>
                <div class="hb-row-actions">
                  <button class="hb-icon-btn hb-icon-btn--subtle" title="Skip today — no guilt" aria-label="Skip today" onclick={() => skipHabit(h.id)}>
                    <span class="hb-skip-icon" aria-hidden="true">→</span>
                  </button>
                  {#if availableFreezeTokens > 0}
                    <button class="hb-icon-btn hb-icon-btn--ice" title="Protect streak" aria-label="Protect streak" onclick={() => freezeStreak(h.id)}><span aria-hidden="true">❄</span></button>
                  {/if}
                </div>
              </article>
            {/each}
          {:else if activeHabits.length === 0}
            <div class="hb-empty">
              <span>{emptyStateMessage.emoji}</span>
              <p>{emptyStateMessage.message}</p>
              <button class="hb-add-inline" onclick={openAddModal}>+ Add your first habit</button>
            </div>
          {:else}
            <div class="hb-empty">
              <span>🎉</span>
              <p>All done for {selectedTimeTab === 'Now' ? 'right now' : selectedTimeTab.toLowerCase()}! Take a breath.</p>
            </div>
          {/if}

          <!-- Show completed habits collapsed below -->
          {#if completedTodayHabits.length > 0 && filteredHabits.length > 0}
            <div class="hb-done-divider">✓ Done today</div>
            {#each completedTodayHabits as h (h.id)}
              <article class="hb-habit-row hb-done" style="--hc:{h.color}">
                <button class="hb-check hb-check-on" aria-label="Undo completion" onclick={() => toggleComplete(h.id)} use:tooltip={{ text: "Undo completion" }}>
                  <CheckIcon size={14}/>
                </button>
                <div class="hb-identity">
                  <span class="hb-icon">{@render habitIcon(h.emoji, 18, "var(--hc)")}</span>
                  <div>
                    <span class="hb-hname">{h.name}</span>
                    {#if h.why}<span class="hb-why-peek">{h.why}</span>{/if}
                  </div>
                </div>
                <div class="hb-streak-pill hb-frozen" title={`Day ${h.streak}`}>
                  <span>{h.streak}</span><span class="hb-streak-unit">d</span>
                </div>
                <div class="hb-mood-group">
                  {#each [['😤','Frustrated'],['😐','Neutral'],['🙂','Slightly happy'],['😊','Happy'],['🔥','On fire']] as [mood, label]}
                    <button class="hb-mood-btn" aria-label={label} class:hb-mood-on={habitMoods[h.id] === mood}
                      onclick={() => habitMoods = {...habitMoods, [h.id]: mood}} use:tooltip={{ text: label }}>{mood}</button>
                  {/each}
                </div>
              </article>
            {/each}
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Small nudges</CardTitle>
          <CardDescription>Quiet reminders for today.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each todayNudges as insight}
            <article class="hb-insight">
              <span class="hb-insight-emoji">{insight.emoji}</span>
              <p>{insight.message}</p>
            </article>
          {/each}
          {#if nowHabits.length > 0}
            <article class="hb-insight hb-insight--action">
              <span class="hb-insight-emoji">🎯</span>
              <p>Start with <strong>{nowHabits[0]?.name}</strong> — it's ready for you now.</p>
            </article>
          {/if}
          {#if activeHabits.length > 0 && completedCount === totalHabits && totalHabits > 1}
            <article class="hb-insight hb-insight--celebration">
              <span class="hb-insight-emoji">🌟</span>
              <p>Everything done! Take a breath. You showed up fully today.</p>
            </article>
          {/if}
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ STREAKS ════════════════════════════════════════ -->
  {:else if selectedSection === "Streaks"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><TrendingUpIcon size={13}/><span>Habits</span><Badge variant="outline">Streaks</Badge></div>
        <h1>Your rhythm</h1>
        <p>Streaks reflect consistency — not worth. Every day is a fresh start, and every restart is part of the journey.</p>
      </div>
      <div class="hb-page__actions">
        <Button onclick={openAddModal}><PlusIcon size={15}/>&nbsp;New</Button>
      </div>
    </header>

    <section class="hb-hero-grid">
      <Card>
        <CardHeader>
          <CardTitle>Longest active streak</CardTitle>
          <CardDescription>{sortedByStreak[0]?.name ?? '—'}</CardDescription>
        </CardHeader>
        <CardContent class="hb-streak-hero-content">
          <div class="hb-big-number">{topStreak}</div>
          <div class="hb-big-label">days</div>
          {#if streakMilestoneLabel}
            <div class="hb-badge-milestone">✨ {streakMilestoneLabel}</div>
          {:else if topStreak > 0}
            <div class="hb-badge-milestone">🌱 Every streak starts with day one — you're on your way.</div>
          {:else}
            <div class="hb-badge-milestone">🌱 A streak begins the moment you start. No better day than today.</div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Freeze tokens</CardTitle>
          <CardDescription>Life happens. Use a token to protect a streak without pressure.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <div class="hb-token-display">
            {#each Array(freezeTokens) as _, i}
              <span class="hb-token" class:hb-token-spent={i < usedFreezeTokens}>❄️</span>
            {/each}
          </div>
          <article><span>Available</span><strong>{availableFreezeTokens} of {freezeTokens}</strong></article>
          <article class="hb-tip-small"><p>Tokens reset monthly. Apply one before the day ends to keep your streak safe.</p></article>
        </CardContent>
      </Card>
    </section>

    <section class="hb-body hb-grid--2col">
      <Card>
        <CardHeader>
          <CardTitle>Streak board</CardTitle>
          <CardDescription>All habits by longest current run. Last 21 days shown.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each sortedByStreak as h (h.id)}
            <article class="hb-streak-row" style="--hc:{h.color}">
              <span class="hb-s-icon">{@render habitIcon(h.emoji, 18)}</span>
              <div class="hb-s-info">
                <strong>{h.name}</strong>
                <div class="hb-chain" role="img" aria-label="Last 21 days: {h.completionHistory.slice(-21).filter(Boolean).length} completed, {h.completionHistory.slice(-21).filter(d => !d).length} missed">
                  {#each h.completionHistory.slice(-21) as day}
                    <div class="hb-dot" class:hb-dot-on={day}></div>
                  {/each}
                </div>
              </div>
              <div class="hb-s-nums">
                <span class="hb-s-cur">{h.streak}d</span>
                <span class="hb-s-best">best {h.longestStreak}d</span>
              </div>
              <div class="hb-s-actions">
                {#if !h.frozenStreak && availableFreezeTokens > 0}
                  <button class="hb-freeze-btn" onclick={() => freezeStreak(h.id)}>❄ Freeze</button>
                {:else if h.frozenStreak}
                  <span class="hb-frozen-lbl">❄️ Safe</span>
                {/if}
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habit strength</CardTitle>
          <CardDescription>Streak × consistency × recency — your real momentum.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each [...activeHabits].sort((a,b) => {
            const sa = (a.streak * 0.5) + (a.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) + (a.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100);
            const sb = (b.streak * 0.5) + (b.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) + (b.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100);
            return sb - sa;
          }) as h}
            {const score = Math.min(100, Math.round(
              (h.streak * 0.5) + (h.completionHistory.filter(Boolean).length / 90 * 0.3 * 100) +
              (h.completionHistory.slice(-7).filter(Boolean).length / 7 * 0.2 * 100)
            ))}
            <article style="--hc:{h.color}">
              <span>{@render habitIcon(h.emoji, 16)}&thinsp;{h.name}</span>
              <div class="hb-strength-bar-wrap"><div class="hb-strength-bar" style="width:{score}%;background:{h.color}" role="meter" aria-label="Habit strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}></div></div>
              <strong>{score}</strong>
            </article>
          {/each}
          <article class="hb-tip-small"><p>Strength = Streak (50%) + 90-day rate (30%) + Last 7 days (20%).</p></article>
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ HEATMAP ════════════════════════════════════════ -->
  {:else if selectedSection === "Heatmap"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><Grid3x3Icon size={13}/><span>Habits</span><Badge variant="outline">Heatmap</Badge></div>
        <h1>90 days at a glance</h1>
        <p>Every cell is a day. Patterns emerge when you zoom out and look with kindness.</p>
      </div>
    </header>

    {#if heatmapHabit}
      <section class="hb-hero-grid hb-hero-grid--4">
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{heatmapHabit.completionHistory.filter(Boolean).length}</strong>
            <span>days completed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{Math.round(heatmapHabit.completionHistory.filter(Boolean).length / 90 * 100)}%</strong>
            <span>completion rate</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{heatmapHabit.streak}</strong>
            <span>current streak</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="hb-stat-box">
            <strong>{heatmapHabit.longestStreak}</strong>
            <span>best ever</span>
          </CardContent>
        </Card>
      </section>
    {/if}

    <section class="hb-body">
      <Card>
        <CardHeader>
          <CardTitle>Activity heatmap</CardTitle>
          <CardDescription>Select a habit to explore its rhythm.</CardDescription>
        </CardHeader>
        <CardContent class="hb-hm-content">
          <div class="hb-hm-tabs">
            {#each activeHabits as h}
              <button class="hb-hm-tab" class:hb-hm-tab-on={heatmapHabit?.id === h.id}
                style="--hc:{h.color}" onclick={() => heatmapHabitId = h.id}>
                {@render habitIcon(h.emoji, 15)}&thinsp;{h.name}
              </button>
            {/each}
          </div>
          {#if heatmapHabit}
            <div class="hb-hm-grid" style="--hc:{heatmapHabit.color}" role="img" aria-label="90-day activity heatmap for {heatmapHabit.name}: {heatmapHabit.completionHistory.filter(Boolean).length} days completed">
              {#each heatmapHabit.completionHistory as day, i}
                <div class="hb-hm-cell" class:hb-hm-on={day}
                  style={day ? `opacity:${hmOpacity(i)}` : ''}
                  title="{new Date(Date.now()-(89-i)*86400000).toLocaleDateString()}: {day ? '✓' : '·'}"
                ></div>
              {/each}
            </div>
            <!-- Screen reader table -->
            <table class="hb-sr-only">
              <caption>{heatmapHabit.name} — 90-day activity</caption>
              <thead><tr><th>Date</th><th>Completed</th></tr></thead>
              <tbody>
                {#each heatmapHabit.completionHistory as day, i}
                  <tr>
                    <td>{new Date(Date.now()-(89-i)*86400000).toLocaleDateString()}</td>
                    <td>{day ? 'Yes' : 'No'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <div class="hb-hm-legend">
              <span>Less</span>
              {#each [0.2,0.4,0.6,0.8,1] as op}
                <div class="hb-lgnd-cell" style="opacity:{op};background:{heatmapHabit.color}"></div>
              {/each}
              <span>More</span>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completion rates</CardTitle>
          <CardDescription>All habits by 90-day performance.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h}
            {const rate = Math.round(h.completionHistory.filter(Boolean).length / 90 * 100)}
            <article class="hb-perf-row">
              <span class="hb-perf-icon">{@render habitIcon(h.emoji, 16)}</span>
              <span class="hb-perf-name">{h.name}</span>
              <div class="hb-perf-track"><div class="hb-perf-fill" style="width:{rate}%;background:{h.color}" role="meter" aria-label="{h.name} completion rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}></div></div>
              <span class="hb-perf-pct">{rate}%</span>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ REVIEW ════════════════════════════════════════ -->
  {:else if selectedSection === "Review"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><SearchIcon size={13}/><span>Habits</span><Badge variant="outline">Review</Badge></div>
        <h1>Gentle reflection</h1>
        <p>No scores, no grades. Just curiosity about what's working and what might need a gentler approach.</p>
      </div>
    </header>

    <section class="hb-hero-grid">
      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
          <CardDescription>Completion across the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent class="hb-week-content">
          {#if activeHabits.length === 0}
            <div class="hl-wc-empty">
              <span>No habits yet</span>
              <small>Create a habit to see your weekly trend</small>
            </div>
          {:else}
            {@const srRows = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day, i) => { const dayTotal = activeHabits.reduce((s,h) => { const idx = 89 - (6 - i); return s + (h.completionHistory[idx] ? 1 : 0); }, 0); return `${day} ${dayTotal}`; }).join(', ')}
            <div class="hl-wc" role="img" aria-label="Weekly habit completion: {srRows}">
              <div class="hl-wc-y" aria-hidden="true">
                <span>{totalHabits}</span><span>{Math.round(totalHabits * 0.75)}</span><span>{Math.round(totalHabits * 0.5)}</span><span>{Math.round(totalHabits * 0.25)}</span><span>0</span>
                <span class="hl-wc-ytitle">Completed</span>
              </div>
              <div class="hl-wc-body">
                <div class="hl-wc-grid" aria-hidden="true">
                  {#each [100, 75, 50, 25, 0] as lv}
                    <div class="hl-wc-line" style="bottom:{lv}%"></div>
                  {/each}
                </div>
                <div class="hl-wc-bars">
                  {#each ['M','T','W','T','F','S','S'] as d, i}
                    {const dayTotal = activeHabits.reduce((s,h) => { const idx = 89 - (6 - i); return s + (h.completionHistory[idx] ? 1 : 0); }, 0)}
                    {const pct = totalHabits > 0 ? dayTotal / totalHabits : 0}
                    <div class="hl-wc-col">
                      {#if dayTotal > 0}
                        <span class="hl-wc-val">{dayTotal}</span>
                      {/if}
                      <div class="hl-wc-bar"
                        style="height:{Math.max(4, pct * 100)}%"
                        tabindex="0"
                        role="meter" aria-label="{d}: {dayTotal} of {totalHabits} habits completed"
                        aria-valuemin="0" aria-valuemax={totalHabits} aria-valuenow={dayTotal}
                        data-empty={dayTotal === 0 || undefined}>
                        <span class="hl-wc-tip">{d}: {dayTotal}/{totalHabits}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
            <div class="hl-wc-x" aria-hidden="true">
              {#each ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as d}
                <span>{d}</span>
              {/each}
            </div>
          {/if}
          <table class="hb-sr-only">
            <caption>Weekly habit completion</caption>
            <thead><tr><th>Day</th><th>Completed</th></tr></thead>
            <tbody>
              {#each ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as day, i}
                <tr>
                  <td>{day}</td>
                  <td>{activeHabits.reduce((s,h) => { const idx = 89 - (6 - i); return s + (h.completionHistory[idx] ? 1 : 0); }, 0)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Your numbers, held gently.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <article><span>Completions this week</span><strong>{thisWeekTotal}</strong></article>
          <article><span>90-day rate</span><strong>{avgRate}%</strong></article>
          <article><span>Best day</span><strong>{bestDay}s</strong></article>
          <article><span>Most consistent</span><strong>{@render habitIcon(bestHabit?.emoji, 14)} {bestHabit?.name}</strong></article>
        </CardContent>
      </Card>
    </section>

    <section class="hb-body hb-grid--2col">
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
          <CardDescription>Patterns that emerged from your practice.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each reviewInsights as insight}
            <article class="hb-insight-full">
              <span class="hb-insight-emoji-lg">{insight.emoji}</span>
              <p>{insight.message}</p>
            </article>
          {/each}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-habit view</CardTitle>
          <CardDescription>Streak, rate, and trajectory.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h}
            {const rate = Math.round(h.completionHistory.filter(Boolean).length / 90 * 100)}
            <article class="hb-bd-row" style="--hc:{h.color}">
              <span>{@render habitIcon(h.emoji, 14)}</span>
              <div class="hb-bd-info">
                <strong>{h.name}</strong>
                <div class="hb-bd-bar"><div class="hb-bd-fill" style="width:{rate}%" role="meter" aria-label="{h.name} 90-day rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}></div></div>
              </div>
              <div class="hb-bd-nums">
                <span>{rate}%</span>
                <span class="hb-bd-streak">{h.streak}d</span>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
  </section>

  <!-- ════════════════════════════════════════ SETTINGS ════════════════════════════════════════ -->
  {:else if selectedSection === "Settings"}
  <section class="hb-page">
    <header class="hb-page__header">
      <div class="hb-page__intro">
        <div class="hb-page__eyebrow"><SettingsIcon size={13}/><span>Habits</span><Badge variant="outline">Settings</Badge></div>
        <h1>Your practice, your way.</h1>
        <p>Adjust your habits, freeze tokens, and reminders to match your life.</p>
      </div>
      <div class="hb-page__actions">
        <Button onclick={openAddModal}><PlusIcon size={15}/>&nbsp;New</Button>
      </div>
    </header>

    <section class="hb-body hb-grid--3col">
      <Card>
        <CardHeader>
          <CardTitle>Active habits</CardTitle>
          <CardDescription>Manage what you're working on.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each activeHabits as h (h.id)}
            <article style="--hc:{h.color}">
              <span class="hb-m-dot"></span>
              <span class="hb-m-icon">{@render habitIcon(h.emoji, 16)}</span>
              <div class="hb-m-info">
                <strong>{h.name}</strong>
                <span>{h.kind === 'quit' ? 'Reducing' : 'Building'} · {h.frequency}</span>
              </div>
              <button class="hb-icon-btn" title="Edit" aria-label="Edit habit" onclick={() => openEditModal(h)}>
                <PencilIcon size={13} style="opacity:0.5" aria-hidden="true"/>
              </button>
              <button class="hb-icon-btn hb-icon-btn--archive" title="Archive — pause without losing progress" aria-label="Archive habit" onclick={() => archiveHabit(h.id)}>
                <span style="font-size:13px;opacity:0.6" aria-hidden="true">📦</span>
              </button>
            </article>
          {/each}
          <button class="hb-add-row" onclick={() => showAddModal = true}>+ Add habit</button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Freeze tokens</CardTitle>
          <CardDescription>Protect streaks when life gets in the way.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <article>
            <span>Monthly allowance</span>
            <div class="hb-stepper">
              <button onclick={async () => { if (freezeTokens > 1) {
                const t = freezeTokens - 1;
                freezeTokens = t;
                await invoke('habits_save_freeze_state', { freezeTokens: t, usedFreezeTokens });
              }}}>−</button>
              <strong>{freezeTokens}</strong>
              <button onclick={async () => { if (freezeTokens < 5) {
                const t = freezeTokens + 1;
                freezeTokens = t;
                await invoke('habits_save_freeze_state', { freezeTokens: t, usedFreezeTokens });
              }}}>+</button>
            </div>
          </article>
          <article><span>Used this month</span><strong>{usedFreezeTokens} / {freezeTokens}</strong></article>
          <div class="hb-token-bar"><div class="hb-token-bar-fill" style="width:{freezeTokens > 0 ? (usedFreezeTokens/freezeTokens*100) : 0}%" role="meter" aria-label="Freeze token usage" aria-valuemin={0} aria-valuemax={freezeTokens} aria-valuenow={usedFreezeTokens}></div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Gentle nudges, not alarms.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          <article class="hb-toggle-row">
            <div>
              <strong>Evening check-in</strong>
              <p>Gentle reminder if habits remain at 8pm.</p>
            </div>
            <input type="checkbox" bind:checked={notifyEndOfDay} class="hb-toggle"/>
          </article>
          <article class="hb-toggle-row">
            <div>
              <strong>Milestone celebrations</strong>
              <p>A quiet nod at 7, 14, 30, and 100 days.</p>
            </div>
            <input type="checkbox" bind:checked={notifyMilestones} class="hb-toggle"/>
          </article>
          <article class="hb-toggle-row">
            <div>
              <strong>Weekly reflection</strong>
              <p>Every Monday — look back with kindness.</p>
            </div>
            <input type="checkbox" bind:checked={notifyWeeklyReview} class="hb-toggle"/>
          </article>
        </CardContent>
      </Card>
    </section>

    <!-- Archived habits -->
    {#if habits.length > activeHabits.length}
      <Card>
        <CardHeader>
          <CardTitle>📦 Paused habits</CardTitle>
          <CardDescription>Habits you've set aside. They're waiting for you whenever you're ready.</CardDescription>
        </CardHeader>
        <CardContent class="hb-list">
          {#each habits.filter(h => h.archived) as h}
            <article style="--hc:{h.color}">
              <span class="hb-m-icon">{@render habitIcon(h.emoji, 16)}</span>
              <div class="hb-m-info">
                <strong>{h.name}</strong>
                <span>Paused — {h.streak}d streak saved</span>
              </div>
              <div class="hb-row-actions">
                <button class="hb-icon-btn" title="Resume" aria-label="Resume habit" onclick={() => unarchiveHabit(h.id)}>
                  <span style="font-size:14px" aria-hidden="true">↩</span>
                </button>
                <button class="hb-icon-btn" title="Delete permanently" aria-label="Delete habit permanently" onclick={() => deleteHabit(h.id)}>
                  <span style="font-size:13px;opacity:0.5" aria-hidden="true">✕</span>
                </button>
              </div>
            </article>
          {/each}
        </CardContent>
      </Card>
    {/if}
  </section>
  {/if}

  {/if}
</main>

<!-- Hidden SVG clipPath for Apple-style 60% corner smoothing -->
<svg width="0" height="0" style="position:absolute;pointer-events:none">
  <clipPath id="hb-smooth" clipPathUnits="objectBoundingBox">
    <path d="M 0 0.045 C 0 0.02 0.02 0 0.045 0 L 0.955 0 C 0.98 0 1 0.02 1 0.045 L 1 0.955 C 1 0.98 0.98 1 0.955 1 L 0.045 1 C 0.02 1 0 0.98 0 0.955 Z" />
  </clipPath>
</svg>

<!-- ══ ADD HABIT MODAL ══════════════════════════════════════════════ -->
{#if showAddModal}
<div class="hb-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeAddModal(); }} onkeydown={(e) => { if (e.key === 'Escape') closeAddModal(); }} role="dialog" aria-modal="true" tabindex="-1">
  <div class="hb-modal">
    <div class="hb-modal-head">
      <h3>{isEditing ? 'Edit habit' : 'New habit'}</h3>
      <button class="hb-icon-btn" onclick={closeAddModal} aria-label="Close" use:tooltip={{ text: "Close" }}><span style="font-size:18px" aria-hidden="true">✕</span></button>
    </div>
    <div class="hb-modal-body">
      <div class="hb-field">
        <label class="hb-lbl">What kind?</label>
        <div class="hb-chip-row">
          <button class="hb-chip" class:hb-chip-on={newHabit.kind === 'build'} onclick={() => newHabit.kind = 'build'}>🌱 Build a new habit</button>
          <button class="hb-chip" class:hb-chip-on={newHabit.kind === 'quit'} onclick={() => newHabit.kind = 'quit'}>🛑 Reduce a habit</button>
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Icon</label>
        <div class="hb-icon-grid">
          {#each iconOptions as name}
            <button class="hb-icon-opt" class:hb-sel={newHabit.emoji === name} onclick={() => newHabit.emoji = name} aria-label={name}>{@render habitIcon(name, 22)}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl" for="nm">Habit name</label>
        <input id="nm" class="hb-input" type="text" bind:value={newHabit.name} placeholder={_t('moduleHabitsPlaceholderName')}/>
      </div>
      <div class="hb-field">
        <label class="hb-lbl" for="wy">Why does this matter?</label>
        <input id="wy" class="hb-input" type="text" bind:value={newHabit.why} placeholder="The reason that will keep you going..."/>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">How to track</label>
        <div class="hb-chip-row">
          {#each ['binary','count','duration'] as t}
            <button class="hb-chip" class:hb-chip-on={newHabit.completionType === t}
              onclick={() => newHabit.completionType = t as CompletionType}>{t}</button>
          {/each}
        </div>
      </div>
      {#if newHabit.completionType !== 'binary'}
        <div class="hb-field-row">
          <div class="hb-field" style="flex:1">
            <label class="hb-lbl" for="tgt">Daily target</label>
            <input id="tgt" class="hb-input" type="number" min="1" bind:value={newHabit.targetCount}/>
          </div>
          <div class="hb-field" style="flex:1">
            <label class="hb-lbl" for="unt">Unit</label>
            <input id="unt" class="hb-input" type="text" bind:value={newHabit.unit} placeholder={newHabit.completionType === 'duration' ? 'min' : 'pages'}/>
          </div>
        </div>
      {/if}
      <div class="hb-field">
        <label class="hb-lbl">Frequency</label>
        <div class="hb-chip-row">
          {#each ['daily','weekdays','weekends'] as f}
            <button class="hb-chip" class:hb-chip-on={newHabit.frequency === f}
              onclick={() => newHabit.frequency = f as Frequency}>{f}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Best time of day</label>
        <div class="hb-chip-row">
          {#each [{v:'morning',l:'🌅 Morning'},{v:'afternoon',l:'☀️ Afternoon'},{v:'evening',l:'🌙 Evening'},{v:'anytime',l:'🕐 Anytime'}] as opt}
            <button class="hb-chip" class:hb-chip-on={newHabit.timeOfDay === opt.v}
              onclick={() => newHabit.timeOfDay = opt.v}>{opt.l}</button>
          {/each}
        </div>
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Stack after (optional)</label>
        <p class="hb-field-hint">Attach this habit to an existing routine. The habit appears after the anchor is done.</p>
        <select class="hb-select" bind:value={newHabit.stackAfterId}>
          <option value="">No stacking → standalone habit</option>
          {#each [...activeHabits].filter(h => h.id !== editingHabitId).sort((a,b) => a.name.localeCompare(b.name)) as h}
            <option value={h.id}>{h.name}</option>
          {/each}
        </select>
        {#if newHabit.stackAfterId && newHabit.stackAfterId !== ''}
          {const selectedStack = activeHabits.find(h => h.id === newHabit.stackAfterId)}
          {#if selectedStack}
            <div class="hb-stack-preview">
              <span>🔗 After</span>
              <span class="hb-stack-preview-name">{@render habitIcon(selectedStack?.emoji, 13)} {selectedStack?.name}</span>
            </div>
          {/if}
        {/if}
      </div>
      <div class="hb-field">
        <label class="hb-lbl">Colour</label>
        <div class="hb-color-row">
          {#each colorOptions as c}
            <button class="hb-swatch" class:hb-swatch-on={newHabit.color === c}
              style="background:{c}" onclick={() => newHabit.color = c}></button>
          {/each}
        </div>
      </div>
    </div>
    <div class="hb-modal-foot">
      <button class="hb-btn-ghost" onclick={closeAddModal}>Cancel</button>
      <button class="hb-btn-primary" onclick={saveNewHabit} disabled={!newHabit.name.trim()}>{isEditing ? 'Save changes' : 'Add habit'}</button>
    </div>
  </div>
</div>
{/if}



<style>
/* ════════════════════════════════════════════════════════════════════
   HABITS MODULE — Rebuild
   Design: Health-module card system. No borders, no shadows.
   Calm, warm, spacious. Supportive language throughout.
   ════════════════════════════════════════════════════════════════════ */

:global(.hb-workspace) {
  --hb-muted: var(--muted);
  --hb-accent: var(--primary);
  --hb-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
  --hb-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
  --hb-border: color-mix(in srgb, var(--border) 86%, transparent);
  --hb-radius-sm: 6px;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
  height: 100%;
  min-height: 0;
  background: var(--background);
  color: var(--foreground);
  overflow: hidden;
  font-family: var(--font-body);
}

/* ── Page shell ──────────────────────────────────────────────────── */
:global(.hb-page) {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  padding: 28px 30px;
  box-sizing: border-box;
  overflow-y: auto;
  animation: hb-in .32s var(--ease-out);
}
@keyframes hb-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  :global(.hb-page) { animation: none; }
}

/* ── Header ──────────────────────────────────────────────────────── */
:global(.hb-page__header) {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-shrink: 0;
}
:global(.hb-page__intro) { max-width: 56rem; }
:global(.hb-page__eyebrow) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--hb-muted);
  font-size: 0.82rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
:global(.hb-page__intro) h1 {
  margin: 0;
  font-size: clamp(1.7rem, 2.5vw, 2.6rem);
  line-height: 1.05;
  font-family: var(--font-display);
  letter-spacing: -0.02em;
  text-wrap: balance;
}
:global(.hb-page__intro) p {
  margin: 12px 0 0;
  max-width: 42rem;
  color: var(--hb-muted);
  font-size: 0.97rem;
  line-height: 1.55;
  text-wrap: pretty;
}
:global(.hb-page__actions) {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

/* ── Grid layouts ────────────────────────────────────────────────── */
:global(.hb-hero-grid) {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  flex-shrink: 0;
}
:global(.hb-hero-grid--4) {
  grid-template-columns: repeat(4, 1fr);
}
:global(.hb-body) {
  flex: 1;
  min-height: 0;
}
:global(.hb-grid--2col) {
  display: grid;
  grid-template-columns: 1fr 0.9fr;
  gap: 16px;
}
:global(.hb-grid--3col) {
  display: grid;
  grid-template-columns: 1fr 260px 260px;
  gap: 16px;
}

/* ── Cards ───────────────────────────────────────────────────────── */
:global(.hb-page [data-slot="card"]) {
  border: 1px solid var(--hb-border);
  box-shadow: none;
  clip-path: url(#hb-smooth);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--hb-surface) 98%, var(--background)),
      color-mix(in srgb, var(--hb-surface) 86%, var(--background))
    );
}

/* ── Ring content ────────────────────────────────────────────────── */
:global(.hb-ring-content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0 12px;
}
:global(.hb-ring-wrap) {
  position: relative;
  width: 130px;
  height: 130px;
}
:global(.hb-ring-narrative) {
  margin: 10px 0 4px;
  font-size: 0.78rem;
  color: var(--hb-muted);
  text-align: center;
  line-height: 1.5;
  font-style: italic;
  max-width: 180px;
}

/* ── Glance stats ────────────────────────────────────────────────── */
:global(.hb-glance) {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
:global(.hb-glance article) {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 92%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--hb-surface-strong) 92%, transparent);
  transition: background .15s var(--ease-out);
}
:global(.hb-glance article span) {
  font-size: 0.72rem;
  color: var(--hb-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
:global(.hb-glance article strong) {
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
}
:global(.hb-milestone-note) {
  font-size: 0.65rem;
  color: var(--hb-accent);
  line-height: 1.4;
  margin-top: 2px;
  font-weight: 500;
}

/* ── Lists ───────────────────────────────────────────────────────── */
:global(.hb-list) {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
:global(.hb-list > article) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 92%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--hb-surface-strong) 92%, transparent);
  font-size: 0.88rem;
  min-height: 44px;
}
:global(.hb-list article > span:first-child) {
  color: var(--hb-muted);
  flex-shrink: 0;
}
:global(.hb-list article strong) {
  font-weight: 600;
  font-size: 0.9rem;
}

/* ── Habit rows ──────────────────────────────────────────────────── */
:global(.hb-habit-row) {
  min-height: 48px;
  transition: background .15s var(--ease-out), transform .15s var(--ease-out);
  animation: hb-row-in .35s var(--ease-out) both;
}

@keyframes hb-row-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to { opacity: 1; transform: none; }
}

:global(.hb-habit-row):nth-child(1) { animation-delay: 0ms; }
:global(.hb-habit-row):nth-child(2) { animation-delay: 30ms; }
:global(.hb-habit-row):nth-child(3) { animation-delay: 60ms; }
:global(.hb-habit-row):nth-child(4) { animation-delay: 90ms; }
:global(.hb-habit-row):nth-child(5) { animation-delay: 120ms; }
:global(.hb-habit-row):nth-child(6) { animation-delay: 150ms; }
:global(.hb-habit-row):nth-child(7) { animation-delay: 180ms; }
:global(.hb-habit-row):nth-child(8) { animation-delay: 210ms; }
:global(.hb-habit-row):nth-child(n+9) { animation-delay: 240ms; }

@media (hover: hover) and (pointer: fine) {
  :global(.hb-habit-row:hover) {
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(.hb-habit-row) { animation: none; }
}

@media (hover: hover) and (pointer: fine) {
  :global(.hb-habit-row.hb-done:hover) {
    background: color-mix(in srgb, var(--hc) 4%, transparent);
  }
}
:global(.hb-done) { opacity: 0.6; }
:global(.hb-skip) { opacity: 0.4; }

:global(.hb-check) {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 2px solid var(--hc, var(--hb-accent));
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hc, var(--hb-accent));
  outline-offset: 2px;
  transition: background .15s;
}
:global(.hb-check:focus-visible) {
  outline: 2px solid var(--hc, var(--hb-accent));
}
:global(.hb-check-on) {
  background: var(--hc, var(--hb-accent)) !important;
  color: #fff !important;
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-check:hover:not(.hb-check-on)) {
    background: color-mix(in srgb, var(--hc) 12%, transparent);
  }
}
:global(.hb-check:active) {
  transform: scale(0.93);
}

:global(.hb-identity) {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
  outline-offset: 3px;
}
:global(.hb-icon) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 20px; }
:global(.hb-icon-fallback) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; }
:global(.hb-hname) {
  display: block;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.hb-kind) {
  display: block;
  font-size: 0.7rem;
  color: var(--hb-muted);
  margin-top: 1px;
  text-transform: capitalize;
}
:global(.hb-why-peek) {
  display: block;
  font-size: 0.7rem;
  color: var(--hb-accent);
  font-style: italic;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  max-height: 0;
  transition: opacity 0.2s ease, max-height 0.2s ease;
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-habit-row:hover .hb-why-peek),
  :global(.hb-habit-row:focus-within .hb-why-peek) {
    opacity: 1;
    max-height: 1.2em;
  }
}

:global(.hb-count-block) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--hb-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
:global(.hb-inc) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: color-mix(in srgb, var(--hc) 14%, transparent);
  color: var(--hc);
  font-size: 0.75rem;
  font-weight: 700;
  transition: transform 120ms var(--ease-out), background 120ms var(--ease-out);
}
:global(.hb-inc:focus-visible) {
  outline: 2px solid var(--hc);
  outline-offset: 2px;
}
:global(.hb-inc:active) {
  transform: scale(0.93);
}

/* Streak pill — gentle, not flashy */
:global(.hb-streak-pill) {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--hc) 10%, transparent);
  color: var(--hc);
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1;
}
:global(.hb-streak-unit) {
  font-size: 0.65rem;
  font-weight: 400;
  opacity: 0.6;
}
:global(.hb-frozen) {
  background: color-mix(in srgb, #60a5fa 12%, transparent) !important;
  color: #60a5fa !important;
}

/* Row actions */
:global(.hb-row-actions) {
  display: flex;
  gap: 2px;
  align-items: center;
  flex-shrink: 0;
}
:global(.hb-icon-btn) {
  width: 30px;
  height: 30px;
  border-radius: var(--hb-radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hb-muted);
  flex-shrink: 0;
  transition: background .12s var(--ease-out), color .12s var(--ease-out), transform .12s var(--ease-out);
}
:global(.hb-icon-btn:active) {
  transform: scale(0.93);
}
:global(.hb-icon-btn:focus-visible) {
  outline: 2px solid var(--hb-accent);
  outline-offset: 1px;
}
:global(.hb-icon-btn--subtle) {
  opacity: 0.35;
}
:global(.hb-icon-btn--subtle:hover) {
  opacity: 0.7;
}
:global(.hb-icon-btn--ice) {
  color: #60a5fa;
}
:global(.hb-skip-icon) {
  font-size: 14px;
  line-height: 1;
}

/* Mood buttons (after completion) */
:global(.hb-mood-group) {
  display: flex;
  gap: 1px;
}
:global(.hb-mood-btn) {
  width: 26px;
  height: 26px;
  border-radius: var(--hb-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.4;
  transition: opacity .12s var(--ease-out), transform .12s var(--ease-out);
}
:global(.hb-mood-btn:active) {
  transform: scale(0.9);
}
:global(.hb-mood-btn:focus-visible) {
  outline: 2px solid var(--hb-accent);
  outline-offset: 1px;
  opacity: 1;
}
:global(.hb-mood-on) {
  opacity: 1 !important;
  border-color: var(--hb-border) !important;
  background: color-mix(in srgb, var(--foreground) 6%, transparent) !important;
}

/* Empty state */
:global(.hb-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 0;
  color: var(--hb-muted);
  font-size: 0.86rem;
  text-align: center;
}
:global(.hb-empty span) { font-size: 2rem; }
:global(.hb-empty p) { margin: 0; }
:global(.hb-add-inline) {
  margin-top: 4px;
  padding: 7px 16px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--hb-accent);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms var(--ease-out), background 120ms var(--ease-out), border-color 120ms var(--ease-out);
}
:global(.hb-add-inline:active) {
  transform: scale(0.97);
}

/* Insights */
:global(.hb-insight) {
  display: flex !important;
  align-items: flex-start !important;
  gap: 10px !important;
  padding: 12px 0 !important;
  border: none !important;
}
:global(.hb-insight--celebration) {
  background: color-mix(in srgb, var(--hb-accent) 6%, transparent) !important;
  border-radius: 10px !important;
  padding: 12px !important;
  margin: 0 -12px !important;
}
:global(.hb-insight-emoji) {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 1px;
  line-height: 1;
}
:global(.hb-insight p) {
  font-size: 0.82rem;
  margin: 0;
  line-height: 1.6;
  color: var(--foreground);
}

:global(.hb-insight-full) {
  display: flex !important;
  align-items: flex-start !important;
  gap: 12px !important;
  padding: 14px 0 !important;
}
:global(.hb-insight-emoji-lg) {
  font-size: 1.3rem;
  flex-shrink: 0;
  line-height: 1.3;
}
:global(.hb-insight-full p) {
  font-size: 0.84rem;
  margin: 0;
  line-height: 1.6;
  color: var(--foreground);
}

/* ── Streak page ─────────────────────────────────────────────────── */
:global(.hb-streak-hero-content) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 0 20px;
  text-align: center;
}
:global(.hb-big-number) {
  font-size: 3.6rem;
  font-weight: 900;
  line-height: 1;
  font-family: var(--font-display);
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}
:global(.hb-big-label) {
  font-size: 0.9rem;
  color: var(--hb-muted);
}
:global(.hb-badge-milestone) {
  font-size: 0.8rem;
  color: var(--hb-muted);
  margin-top: 4px;
  line-height: 1.4;
}

:global(.hb-token-display) {
  display: flex;
  gap: 8px;
  padding: 8px 0;
}
:global(.hb-token) { font-size: 1.3rem; }
:global(.hb-token-spent) { opacity: 0.2; filter: grayscale(1); }

:global(.hb-streak-row) {
  padding: 12px 16px;
}
:global(.hb-s-icon) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 20px; }
:global(.hb-s-info) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
:global(.hb-s-info strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-chain) {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
:global(.hb-dot) {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--hb-border) 80%, transparent);
}
:global(.hb-dot-on) {
  background: var(--hc, var(--hb-accent));
}
:global(.hb-s-nums) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
:global(.hb-s-cur) {
  font-size: 0.95rem;
  font-weight: 700;
}
:global(.hb-s-best) {
  font-size: 0.72rem;
  color: var(--hb-muted);
}
:global(.hb-s-actions) { flex-shrink: 0; }

:global(.hb-freeze-btn) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 30px;
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #60a5fa 25%, var(--hb-border));
  cursor: pointer;
  background: color-mix(in srgb, #60a5fa 8%, transparent);
  color: #60a5fa;
  font-size: 0.78rem;
  font-weight: 600;
  transition: transform 120ms var(--ease-out), background 120ms var(--ease-out);
}
:global(.hb-freeze-btn:active) {
  transform: scale(0.95);
}
:global(.hb-frozen-lbl) { font-size: 0.78rem; color: #60a5fa; }

:global(.hb-strength-bar-wrap) {
  flex: 1;
  height: 5px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
  margin: 0 8px;
}
:global(.hb-strength-bar) {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}

/* ── Heatmap ─────────────────────────────────────────────────────── */
:global(.hb-stat-box) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 6px;
}
:global(.hb-stat-box strong) {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  font-family: var(--font-display);
}
:global(.hb-stat-box span) {
  font-size: 0.72rem;
  color: var(--hb-muted);
  line-height: 1.4;
}

:global(.hb-hm-content) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
:global(.hb-hm-tabs) {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
:global(.hb-hm-tab) {
  min-height: 32px;
  padding: 5px 13px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--hb-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background .12s var(--ease-out), border-color .12s var(--ease-out), color .12s var(--ease-out), transform .12s var(--ease-out);
}
:global(.hb-hm-tab:active) {
  transform: scale(0.95);
}
:global(.hb-hm-tab-on) {
  background: color-mix(in srgb, var(--hc) 12%, transparent) !important;
  border-color: color-mix(in srgb, var(--hc) 35%, var(--hb-border)) !important;
  color: var(--foreground) !important;
}
:global(.hb-hm-grid) {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
}
:global(.hb-hm-cell) {
  aspect-ratio: 1;
  border-radius: 3px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  transition: transform .1s;
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-hm-cell:hover) { transform: scale(1.3); }
}
:global(.hb-hm-on) {
  background: var(--hc, var(--hb-accent));
}
:global(.hb-hm-legend) {
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: flex-end;
}
:global(.hb-hm-legend span) { font-size: 0.7rem; color: var(--hb-muted); }
:global(.hb-lgnd-cell) { width: 11px; height: 11px; border-radius: 2px; }

:global(.hb-perf-row) {
  padding: 10px 16px;
}
:global(.hb-perf-icon) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 18px; height: 18px; }
:global(.hb-perf-name) {
  font-size: 0.84rem;
  font-weight: 500;
  min-width: 90px;
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.hb-perf-track) {
  flex: 1;
  height: 5px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
:global(.hb-perf-fill) {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}
:global(.hb-perf-pct) {
  font-size: 0.78rem;
  font-weight: 700;
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Review ──────────────────────────────────────────────────────── */
:global(.hb-week-content) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

:global(.hb-bd-row) {
  padding: 11px 16px;
}
:global(.hb-bd-info) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
:global(.hb-bd-info strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-bd-bar) {
  height: 4px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
:global(.hb-bd-fill) {
  height: 100%;
  border-radius: 999px;
  background: var(--hc, var(--hb-accent));
  transition: width .4s ease;
}
:global(.hb-bd-nums) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
:global(.hb-bd-nums span) { font-size: 0.8rem; font-weight: 700; }
:global(.hb-bd-streak) {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--hb-muted);
}

/* ── Settings ────────────────────────────────────────────────────── */
:global(.hb-m-dot) {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hc, var(--hb-accent));
  flex-shrink: 0;
}
:global(.hb-m-icon) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 18px; height: 18px; }
:global(.hb-m-info) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
:global(.hb-m-info strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-m-info span) { font-size: 0.72rem; color: var(--hb-muted); }

:global(.hb-add-row) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 10px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--hb-accent);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
}

:global(.hb-stepper) {
  display: flex;
  align-items: center;
  gap: 10px;
}
:global(.hb-stepper button) {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--foreground);
  transition: transform 120ms var(--ease-out), background 120ms var(--ease-out);
}
:global(.hb-stepper button:active) {
  transform: scale(0.93);
}
:global(.hb-stepper strong) { font-size: 1rem; min-width: 24px; text-align: center; }

:global(.hb-token-bar) {
  height: 4px;
  background: color-mix(in srgb, var(--hb-border) 70%, transparent);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 4px;
}
:global(.hb-token-bar-fill) {
  height: 100%;
  background: var(--hb-accent);
  border-radius: 999px;
  transition: width .3s;
}

:global(.hb-toggle-row) {
  justify-content: space-between;
}
:global(.hb-toggle-row > div) { display: flex; flex-direction: column; gap: 2px; }
:global(.hb-toggle-row > div strong) { font-size: 0.86rem; font-weight: 600; }
:global(.hb-toggle-row > div p) { font-size: 0.76rem; margin: 0; color: var(--hb-muted); line-height: 1.4; }
:global(.hb-toggle) { width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--hb-accent); cursor: pointer; }

/* ── Modals ──────────────────────────────────────────────────────── */
:global(.hb-overlay) {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: color-mix(in srgb, var(--background) 60%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: hb-overlay-in .22s var(--ease-out) both;
}
@keyframes hb-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  :global(.hb-overlay) { animation: none; }
}
:global(.hb-modal) {
  background: var(--background);
  border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  border-radius: 16px;
  width: 480px;
  max-width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  animation: hb-modal-in .32s var(--ease-out) both;
}
@keyframes hb-modal-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  :global(.hb-modal) { animation: none; }
}
:global(.hb-modal-head) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  flex-shrink: 0;
}
:global(.hb-modal-head h3) { font-size: 1rem; font-weight: 700; margin: 0; }
:global(.hb-modal-body) {
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

:global(.hb-modal-foot) {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 14px 24px 20px;
  border-top: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  flex-shrink: 0;
}

:global(.hb-field) { display: flex; flex-direction: column; gap: 6px; }
:global(.hb-field-row) { display: flex; gap: 12px; }
:global(.hb-lbl) {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--hb-muted);
}
:global(.hb-input) {
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  background: color-mix(in srgb, var(--foreground) 3%, var(--background));
  color: var(--foreground);
  font: inherit;
  font-size: 0.88rem;
  outline: none;
  transition: border-color .12s var(--ease-out);
}
:global(.hb-input:focus) {
  border-color: var(--hb-accent);
}
:global(.hb-input::placeholder) {
  color: color-mix(in srgb, var(--foreground) 22%, transparent);
}

:global(.hb-icon-grid) { display: flex; flex-wrap: wrap; gap: 5px; }
:global(.hb-icon-opt) {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  background: color-mix(in srgb, var(--foreground) 2%, var(--background));
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 120ms var(--ease-out), border-color 120ms var(--ease-out), background 120ms var(--ease-out);
}
:global(.hb-icon-opt:active) {
  transform: scale(0.93);
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-icon-opt:hover) {
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    border-color: color-mix(in srgb, var(--foreground) 12%, transparent);
  }
}
:global(.hb-sel) {
  border-color: var(--hb-accent) !important;
  background: color-mix(in srgb, var(--hb-accent) 12%, transparent) !important;
}

:global(.hb-chip-row) { display: flex; gap: 7px; flex-wrap: wrap; }
:global(.hb-chip) {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 5px 16px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
  background: color-mix(in srgb, var(--foreground) 2%, var(--background));
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--foreground) 45%, transparent);
  transition: background .12s var(--ease-out), border-color .12s var(--ease-out), color .12s var(--ease-out), transform .12s var(--ease-out);
}
:global(.hb-chip:active) {
  transform: scale(0.95);
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-chip:hover) {
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
    border-color: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: color-mix(in srgb, var(--foreground) 72%, transparent);
  }
}
:global(.hb-chip-on) {
  background: var(--hb-accent) !important;
  border-color: var(--hb-accent) !important;
  color: #fff !important;
}

:global(.hb-color-row) { display: flex; gap: 8px; }
:global(.hb-swatch) {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  outline-offset: 3px;
  transition: transform 120ms var(--ease-out), border-color 120ms var(--ease-out);
}
:global(.hb-swatch:active) {
  transform: scale(0.9);
}
:global(.hb-swatch-on) { outline: 2px solid var(--foreground) !important; }

:global(.hb-btn-ghost) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 80%, transparent);
  background: color-mix(in srgb, var(--hb-surface-strong) 92%, transparent);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--foreground);
  transition: transform 120ms var(--ease-out), background 120ms var(--ease-out);
}
:global(.hb-btn-ghost:hover) {
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
}
:global(.hb-btn-ghost:active) {
  transform: scale(0.97);
}
:global(.hb-btn-primary) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 20px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 80%, transparent);
  background: var(--hb-accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  color: #fff;
  transition: transform 120ms var(--ease-out), opacity 120ms var(--ease-out);
}
:global(.hb-btn-primary:hover) {
  opacity: 0.9;
}
:global(.hb-btn-primary:active) {
  transform: scale(0.97);
}
:global(.hb-btn-primary:disabled) { opacity: 0.38; cursor: not-allowed; transform: none !important; }

/* ── Tip small ───────────────────────────────────────────────────── */
:global(.hb-tip-small) {
  border: none !important;
  background: transparent !important;
  padding: 6px 0 !important;
  min-height: auto !important;
}
:global(.hb-tip-small p) {
  font-size: 0.78rem;
  color: var(--hb-muted);
  margin: 0;
  line-height: 1.58;
}

/* ── Quick-log strip ────────────────────────────────────────────── */
:global(.hb-quick-log) {
  flex-shrink: 0;
  overflow: hidden;
}
:global(.hb-quick-log__inner) {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 8px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
:global(.hb-quick-log__inner::-webkit-scrollbar) { display: none; }
:global(.hb-quick-btn) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px 8px 12px;
  border-radius: 20px;
  border: none;
  background: var(--card);
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .12s var(--ease-out), transform .12s var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-quick-btn:hover) {
    background: color-mix(in srgb, var(--hc, var(--hb-accent)) 18%, transparent);
  }
}
:global(.hb-quick-btn:active) {
  transform: scale(0.95);
}
:global(.hb-quick-icon) { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 18px; height: 18px; }
:global(.hb-quick-label) {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--foreground);
}
:global(.hb-quick-log--done) {
  opacity: 0.6;
}
:global(.hb-quick-all-done) {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--hb-accent);
  padding: 7px 0;
}

/* ── Time-of-day tabs ───────────────────────────────────────────── */
:global(.hb-tod-tabs) {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
:global(.hb-tod-tabs::-webkit-scrollbar) { display: none; }
:global(.hb-tod-tab) {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--hb-border) 70%, transparent);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--hb-muted);
  white-space: nowrap;
  transition: background .12s var(--ease-out), border-color .12s var(--ease-out), color .12s var(--ease-out), transform .12s var(--ease-out);
}
@media (hover: hover) and (pointer: fine) {
  :global(.hb-tod-tab:hover) {
    border-color: var(--hb-accent);
    color: var(--foreground);
  }
}
:global(.hb-tod-tab:active) {
  transform: scale(0.95);
}
:global(.hb-tod-tab-on) {
  background: var(--hb-accent) !important;
  border-color: var(--hb-accent) !important;
  color: #fff !important;
}
:global(.hb-tod-icon) { font-size: 0.85rem; line-height: 1; }
:global(.hb-tod-count) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--foreground) 12%, transparent);
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1;
}
:global(.hb-tod-tab-on .hb-tod-count) {
  background: color-mix(in srgb, #fff 20%, transparent);
  color: #fff;
}

/* ── Stacking badge ─────────────────────────────────────────────── */
:global(.hb-stack-badge) {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  font-size: 0.7rem;
  color: var(--hb-muted);
  flex-shrink: 0;
  max-width: 100px;
}
:global(.hb-chain-badge) {
  background: color-mix(in srgb, var(--hc, var(--hb-accent)) 10%, transparent);
  color: var(--hc, var(--hb-accent));
}
:global(.hb-stack-icon) { font-size: 0.65rem; }
:global(.hb-stack-label) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Done divider ───────────────────────────────────────────────── */
:global(.hb-done-divider) {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--hb-muted) 50%, transparent);
  padding: 16px 0 4px;
  border: none;
}

/* ── Modal additions ────────────────────────────────────────────── */
:global(.hb-field-hint) {
  margin: 0;
  font-size: 0.72rem;
  color: var(--hb-muted);
  line-height: 1.4;
}
:global(.hb-select) {
  padding: 11px 14px;
  padding-right: 36px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  background: color-mix(in srgb, var(--foreground) 3%, var(--background));
  color: var(--foreground);
  font: inherit;
  font-size: 0.88rem;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  transition: border-color .12s var(--ease-out);
}
:global(.hb-select:focus) {
  border-color: var(--hb-accent);
}
:global(.hb-stack-preview) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--hb-accent) 6%, transparent);
  font-size: 0.8rem;
  color: var(--hb-accent);
}
:global(.hb-stack-preview-name) {
  font-weight: 600;
}

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 1100px) {
  :global(.hb-hero-grid) { grid-template-columns: 1fr; }
  :global(.hb-grid--2col) { grid-template-columns: 1fr; }
  :global(.hb-grid--3col) { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 820px) {
  :global(.hb-page) { padding: 18px 16px 32px; gap: 16px; }
  :global(.hb-hero-grid--4) { grid-template-columns: repeat(2, 1fr); }
  :global(.hb-grid--3col) { grid-template-columns: 1fr; }
  :global(.hb-page__header) { flex-direction: column; gap: 12px; }
}

/* ── Screen reader only ─────────────────────────────────────────────── */
:global(.hb-sr-only) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
