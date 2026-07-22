<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import BellIcon from "@lucide/svelte/icons/bell";
  import BellOffIcon from "@lucide/svelte/icons/bell-off";
  import { exportContentToFile } from "$lib/services/task-service";
  import { playAlarmSound, stopAlarmSound, type SoundName } from "$lib/services/sounds";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  const moduleId = "sleep";
  const sectionLabels = ["Tonight", "Score", "Routine", "Trends", "Alarm", "Export", "Sessions", "Goal"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  let displaySection = $derived.by(() => {
    const labels: Record<string, string> = {
      Tonight: _t("moduleSleepSectionTonight"),
      Score: _t("moduleSleepSectionScore"),
      Routine: _t("moduleSleepSectionRoutine"),
      Trends: _t("moduleSleepSectionTrends"),
      Alarm: _t("moduleSleepSectionAlarm"),
      Export: _t("moduleSleepSectionExport"),
      Sessions: "Sessions",
      Goal: "Goal",
    };
    return labels[selectedSection] ?? selectedSection;
  });

  // ═══════════════════════════════════════════════════════
  // BACKEND TYPES
  // ═══════════════════════════════════════════════════════

  interface SleepRoutine {
    id: string;
    title: string;
    sortOrder: number;
    createdAt: number;
  }

  interface RoutineTracking {
    routineId: string;
    dateKey: string;
    completed: boolean;
  }

  interface SleepAlarm {
    id: string;
    label: string;
    time: string;
    wakeWindow: string;
    mode: string;
    sound: string;
    active: boolean;
    createdAt: number;
  }

  // NEW: Sleep session types
  interface SleepSession {
    id: string;
    date: string;
    sleepOnsetTs: number;
    wakeTs: number;
    lastActiveTs: number | null;
    durationMin: number;
    qualityScore: number | null;
    notes: string | null;
    source: string;
    confirmationPending: boolean;
    createdAt: number;
  }

  interface SleepGoal {
    targetBedtime: string;
    targetWaketime: string;
    targetDurationMin: number;
    updatedAt: number;
  }

  interface SleepStats {
    avgDurationMin: number;
    avgBedtime: string;
    avgWaketime: string;
    consistencyScore: number;
    sleepDebtMin: number;
    longestStreakDays: number;
    currentStreakDays: number;
    weekdayAvgMin: number;
    weekendAvgMin: number;
    socialJetLagMin: number;
    totalSessions: number;
  }

  // ═══════════════════════════════════════════════════════
  // STATE — all loaded from backend
  // ═══════════════════════════════════════════════════════

  let loading = $state(true);
  let routines = $state<SleepRoutine[]>([]);
  let routineTracked = $state<RoutineTracking[]>([]);
  let alarmList = $state<SleepAlarm[]>([]);

  // Routine add form
  let routineInput = $state("");
  let routineSaving = $state(false);

  function formatTime24to12(time24: string): string {
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${period}`;
  }

  // Alarm add form
  const alarmSoundOptions: { value: string; label: string }[] = [
    { value: "alarm", label: "Default Alarm" },
    { value: "ringtone", label: "Ringtone" },
    { value: "gentle-rain", label: "Gentle Rain" },
    { value: "ocean-waves", label: "Ocean Waves" },
    { value: "river-flow", label: "River Flow" },
    { value: "guitar-loop", label: "Guitar Loop" },
  ];
  const soundLabelMap = new Map(alarmSoundOptions.map(o => [o.value, o.label]));
  let alarmLabel = $state("");
  let alarmTime = $state("07:00");
  let alarmSound = $state("alarm");
  let alarmSaving = $state(false);
  let alarmError = $state("");
  let alarmSuccess = $state("");
  let alarmTestAudio: { stop: () => void } | null = $state(null);

  // NEW: Session state
  let sleepSessions = $state<SleepSession[]>([]);
  let sleepGoal = $state<SleepGoal>({ targetBedtime: "23:00", targetWaketime: "07:00", targetDurationMin: 480, updatedAt: 0 });
  let sleepStats = $state<SleepStats | null>(null);
  let sessionSaving = $state(false);
  let sessionDeleteLoading = $state<string | null>(null);

  // Manual session form
  let manualDate = $state(todayKey());
  let manualBedtime = $state("23:00");
  let manualWake = $state("07:00");
  let manualNotes = $state("");
  let showManualForm = $state(false);

  // Goal form
  let goalBedtime = $state("23:00");
  let goalWaketime = $state("07:00");
  let goalDuration = $state(480);
  let goalSaving = $state(false);
  let goalSaved = $state(false);

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  function todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dayLabel(dateKey: string): string {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date(dateKey + "T00:00:00");
    return days[d.getDay()];
  }

  function shortDate(dateKey: string): string {
    const parts = dateKey.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`;
  }

  function formatDuration(minutes: number): string {
    const rounded = Math.round(minutes * 100) / 100;
    const h = Math.floor(rounded / 60);
    const m = Math.round(rounded % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  // ═══════════════════════════════════════════════════════
  // DERIVED — all from sleep_sessions (manual + OS-detected)
  // ═══════════════════════════════════════════════════════

  const weekColors = [
    'oklch(0.585 0.204 277.117)',  // Mon - indigo
    'oklch(0.541 0.247 293.009)',  // Tue - violet
    'oklch(0.627 0.233 303.900)',  // Wed - purple
    'oklch(0.680 0.158 276.935)',  // Thu - light indigo
    'oklch(0.585 0.204 277.117)',  // Fri - indigo
    'oklch(0.606 0.219 292.717)',  // Sat - medium violet
    'oklch(0.709 0.159 293.541)',  // Sun - soft violet
  ];

  // Most recent completed session (last night)
  const lastNight = $derived(
    sleepSessions.length > 0 ? sleepSessions[0] : null
  );

  function tsToHHMM(tsMs: number): string {
    const d = new Date(tsMs);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // Weekly trend for arc chart from sleep_sessions
  const weeklyTrend = $derived.by(() => {
    const days: { day: string; score: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const session = sleepSessions.find((s) => s.date === key);
      days.push({
        day: dayLabel(key),
        score: session ? Math.round(session.qualityScore ?? 0) : 0,
      });
    }
    return days;
  });

  // Average weekly score (only days with data)
  const weeklyAvgScore = $derived.by(() => {
    const withData = weeklyTrend.filter(d => d.score > 0);
    return withData.length > 0
      ? Math.round(withData.reduce((s, d) => s + d.score, 0) / withData.length)
      : 0;
  });

  // Best and worst nights from sessions
  const bestNight = $derived(sleepSessions.length > 0
    ? [...sleepSessions].sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))[0]
    : null
  );
  const worstNight = $derived(sleepSessions.length > 0
    ? [...sleepSessions].sort((a, b) => (a.qualityScore ?? 0) - (b.qualityScore ?? 0))[0]
    : null
  );

  // ── Concentric arc chart (one ring per day) ─
  const arcSegments = $derived.by(() => {
    const cx = 120, cy = 120;
    const minR = 28, ringW = 14, gap = 4;

    return weeklyTrend.map((d, i) => {
      const r = minR + i * (ringW + gap);
      const circumference = 2 * Math.PI * r;
      const fillRatio = Math.min(d.score / 100, 1);
      const filled = circumference * fillRatio;
      const empty = circumference - filled;
      const rotation = -90;
      return {
        cx, cy, r,
        strokeWidth: ringW,
        circumference, filled, empty, rotation,
        color: weekColors[i],
        day: d.day,
        score: d.score,
      };
    });
  });

  // Session-derived sub-scores (replaces unmeasurable stages)
  const scoreSubScores = $derived([
    { label: "Duration", value: lastNight ? `${formatDuration(lastNight.durationMin)}` : '--', fill: lastNight ? Math.round((lastNight.durationMin / (sleepGoal?.targetDurationMin ?? 480)) * 100) : 0, desc: "vs goal" },
    { label: "Quality", value: lastNight ? `${Math.round(lastNight.qualityScore ?? 0)}` : '--', fill: Math.round(lastNight?.qualityScore ?? 0), desc: "0-100 score" },
    { label: "Consistency", value: sleepStats ? `${Math.round(sleepStats.consistencyScore)}` : '--', fill: Math.round(sleepStats?.consistencyScore ?? 0), desc: "bedtime regularity" },
    { label: "Debt", value: sleepStats && sleepStats.sleepDebtMin > 0 ? `-${formatDuration(sleepStats.sleepDebtMin)}` : 'On track', fill: sleepStats ? Math.max(0, 100 - Math.round(sleepStats.sleepDebtMin / 3)) : 0, desc: `${sleepStats?.totalSessions ?? 0} sessions tracked` },
  ]);

  // Score breakdown from last night's session
  const scoreBreakdown = $derived.by(() => {
    const qs = lastNight?.qualityScore ?? 0;
    const durMin = lastNight?.durationMin ?? 0;
    const hours = durMin / 60;
    return [
      { label: "Duration", value: hours >= 7 && hours <= 9 ? 90 : hours >= 6 ? 70 : 40 },
      { label: "Quality", value: Math.round(qs) },
      { label: "Score", value: Math.round(qs) },
    ];
  });

  // Last night description
  const lastNightDesc = $derived(
    lastNight
      ? `${formatDuration(lastNight.durationMin)} total${lastNight.sleepOnsetTs ? ` · bed ${tsToHHMM(lastNight.sleepOnsetTs)}` : ""}`
      : _t("moduleSleepLastNightDesc")
  );

  // Tonight focus — from last session + defaults
  const tonightFocus = $derived([
    { label: "Wind-down", value: "22:15", note: "Reading lamp and no inbox after 10pm." },
    {
      label: "Target sleep",
      value: lastNight ? `${formatDuration(lastNight.durationMin)}` : "7h 50m",
      note: "Enough recovery for tomorrow's training block.",
    },
    { label: "Bedroom", value: "19°C", note: "Cooling mode starts 30 minutes before bed." },
  ]);

  // Routine items with status merged
  const routineWithStatus = $derived(
    routines.map((r) => {
      const track = routineTracked.find((t) => t.routineId === r.id);
      const status = track?.completed ? "Done" : "Ready";
      return {
        id: r.id,
        title: r.title,
        status,
        note: status === "Done" ? "Completed tonight." : "Ready for tonight.",
        tracked: track !== undefined,
      };
    })
  );

  // ═══════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════

  async function addRoutine() {
    if (!routineInput.trim()) return;
    routineSaving = true;
    try {
      await invoke<SleepRoutine>("sleep_routine_save", {
        input: { title: routineInput.trim() },
      });
      routineInput = "";
      await Promise.all([
        invoke<SleepRoutine[]>("sleep_routine_list").then(r => routines = r),
        invoke<RoutineTracking[]>("sleep_routine_status").then(r => routineTracked = r),
      ]);
    } catch (e) {
      console.error("Failed to add routine:", e);
    } finally {
      routineSaving = false;
    }
  }

  async function addAlarm() {
    if (!alarmLabel.trim() || !alarmTime.trim()) return;
    alarmSaving = true;
    alarmError = "";
    alarmSuccess = "";
    try {
      await invoke<SleepAlarm>("sleep_alarm_save", {
        alarm: { label: alarmLabel.trim(), time: alarmTime.trim(), sound: alarmSound },
      });
      alarmLabel = "";
      alarmTime = "07:00";
      alarmSound = "alarm";
      alarmList = await invoke<SleepAlarm[]>("sleep_alarm_list");
      alarmSuccess = "Alarm added";
      setTimeout(() => { alarmSuccess = ""; }, 3000);
    } catch (e) {
      alarmError = String(e);
      setTimeout(() => { alarmError = ""; }, 5000);
    } finally {
      alarmSaving = false;
    }
  }

  function previewAlarmSound(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    alarmSound = value;
    if (alarmTestAudio) { alarmTestAudio.stop(); alarmTestAudio = null; }
    const audio = playAlarmSound(value as SoundName, { volume: 0.4 });
    if (audio) {
      alarmTestAudio = {
        stop: () => stopAlarmSound(audio),
      };
      setTimeout(() => {
        if (alarmTestAudio) { alarmTestAudio.stop(); alarmTestAudio = null; }
      }, 3000);
    }
  }

  async function deleteAlarm(id: string) {
    alarmError = "";
    try {
      await invoke<void>("sleep_alarm_delete", { alarmId: id });
      alarmList = await invoke<SleepAlarm[]>("sleep_alarm_list");
    } catch (e) {
      alarmError = String(e);
      setTimeout(() => { alarmError = ""; }, 5000);
    }
  }

  async function toggleAlarm(id: string) {
    alarmError = "";
    try {
      await invoke<boolean>("sleep_alarm_toggle", { alarmId: id });
      alarmList = await invoke<SleepAlarm[]>("sleep_alarm_list");
    } catch (e) {
      alarmError = String(e);
      setTimeout(() => { alarmError = ""; }, 5000);
    }
  }

  async function toggleRoutine(routineId: string) {
    try {
      await invoke<boolean>("sleep_routine_toggle", { routineId });
      routineTracked = await invoke<RoutineTracking[]>("sleep_routine_status");
    } catch (e) {
      console.error("Failed to toggle routine:", e);
    }
  }

  async function deleteRoutine(id: string) {
    try {
      await invoke<void>("sleep_routine_delete", { ids: [id] });
      routines = await invoke<SleepRoutine[]>("sleep_routine_list");
    } catch (e) {
      console.error("Failed to delete routine:", e);
    }
  }

  // NEW: Session actions
  async function addManualSession() {
    sessionSaving = true;
    try {
      await invoke<SleepSession>("add_manual_sleep_session", {
        input: {
          date: manualDate,
          sleepTime: manualBedtime,
          wakeTime: manualWake,
          notes: manualNotes || null,
        },
      });
      showManualForm = false;
      manualNotes = "";
      await loadSessionData();
    } catch (e) {
      console.error("Failed to add session:", e);
    } finally {
      sessionSaving = false;
    }
  }

  async function deleteSession(id: string) {
    sessionDeleteLoading = id;
    try {
      await invoke<boolean>("delete_sleep_session", { id });
      await loadSessionData();
    } catch (e) {
      console.error("Failed to delete session:", e);
    } finally {
      sessionDeleteLoading = null;
    }
  }

  async function loadSessionData() {
    try {
      const [sessions, goal, stats] = await Promise.all([
        invoke<SleepSession[]>("get_sleep_sessions", { days: 30 }),
        invoke<SleepGoal>("get_sleep_goal"),
        invoke<SleepStats>("get_sleep_stats", { days: 30 }),
      ]);
      sleepSessions = sessions;
      sleepGoal = goal;
      sleepStats = stats;
      goalBedtime = goal.targetBedtime;
      goalWaketime = goal.targetWaketime;
      goalDuration = goal.targetDurationMin;
    } catch (e) {
      console.error("Failed to load session data:", e);
    }
  }

  async function saveSleepGoal() {
    goalSaving = true;
    goalSaved = false;
    try {
      const result = await invoke<SleepGoal>("update_sleep_goal", {
        bedtime: goalBedtime,
        waketime: goalWaketime,
        duration: goalDuration,
      });
      sleepGoal = result;
      goalBedtime = result.targetBedtime;
      goalWaketime = result.targetWaketime;
      goalDuration = result.targetDurationMin;
      goalSaved = true;
      setTimeout(() => { goalSaved = false; }, 2000);
    } catch (e) {
      console.error("Failed to save goal:", e);
    } finally {
      goalSaving = false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════

  async function exportSessionsCSV() {
    if (sleepSessions.length === 0) return;
    const header = "Date,Bedtime,Wake Time,Duration (min),Quality Score,Source,Notes";
    const rows = sleepSessions.map((s) => {
      const bedtime = s.sleepOnsetTs ? tsToHHMM(s.sleepOnsetTs) : "";
      const waketime = s.wakeTs ? tsToHHMM(s.wakeTs) : "";
      return `${s.date},${bedtime},${waketime},${s.durationMin},${s.qualityScore ?? ""},${s.source},${s.notes ?? ""}`;
    });
    const csv = [header, ...rows].join("\n");
    const saved = await exportContentToFile(csv, "sleep-sessions.csv", "csv", "CSV files");
    if (saved) console.log("[sleep] sessions CSV exported to:", saved);
  }

  async function exportSummaryCSV() {
    if (sleepSessions.length === 0) return;
    const header = "Date,Bedtime,Wake Time,Duration (min),Quality Score,Source,Notes";
    const rows = sleepSessions.map((s) => {
      const bedtime = s.sleepOnsetTs ? tsToHHMM(s.sleepOnsetTs) : "";
      const waketime = s.wakeTs ? tsToHHMM(s.wakeTs) : "";
      return `${s.date},${bedtime},${waketime},${s.durationMin},${s.qualityScore ?? ""},${s.source},${s.notes ?? ""}`;
    });
    const csv = [header, ...rows].join("\n");
    const saved = await exportContentToFile(csv, "sleep-summary-30-days.csv", "csv", "CSV files");
    if (saved) console.log("[sleep] summary CSV exported to:", saved);
  }

  async function exportPDF() {
    if (sleepSessions.length === 0) return;
    // Generate a textual summary (simple markdown-like format pending true PDF support)
    const lines: string[] = [];
    lines.push("=== Sleep Report (Last 30 Nights) ===");
    lines.push(`Generated: ${new Date().toLocaleDateString()}`);
    lines.push("");
    if (sleepStats) {
      lines.push(`Average Duration: ${formatDuration(Math.round(sleepStats.avgDurationMin))}`);
      lines.push(`Average Bedtime: ${sleepStats.avgBedtime}`);
      lines.push(`Average Wake Time: ${sleepStats.avgWaketime}`);
      lines.push(`Consistency Score: ${Math.round(sleepStats.consistencyScore)}/100`);
      lines.push(`Sleep Debt: ${sleepStats.sleepDebtMin > 0 ? formatDuration(sleepStats.sleepDebtMin) : "On track"}`);
      lines.push(`Total Sessions: ${sleepStats.totalSessions}`);
      lines.push("");
    }
    if (sleepGoal) {
      lines.push(`Goal Bedtime: ${sleepGoal.targetBedtime}`);
      lines.push(`Goal Wake Time: ${sleepGoal.targetWaketime}`);
      lines.push(`Goal Duration: ${formatDuration(sleepGoal.targetDurationMin)}`);
      lines.push("");
    }
    lines.push("--- Nightly Log ---");
    for (const s of sleepSessions) {
      lines.push(`${s.date} | ${s.durationMin}min | Score: ${s.qualityScore ?? "N/A"} | ${s.source}`);
    }
    const text = lines.join("\n");
    const saved = await exportContentToFile(text, "sleep-report.txt", "text", "Text files");
    if (saved) console.log("[sleep] report exported to:", saved);
  }

  async function loadData() {
    try {
      // Load session data (powers Tonight, Score, Trends)
      await loadSessionData();

      // Load routine + alarm data
      const [rList, rStatus, alarms] = await Promise.all([
        invoke<SleepRoutine[]>("sleep_routine_list"),
        invoke<RoutineTracking[]>("sleep_routine_status"),
        invoke<SleepAlarm[]>("sleep_alarm_list"),
      ]);
      routines = rList;
      routineTracked = rStatus;
      alarmList = alarms;
    } catch (e) {
      console.error("Failed to load sleep data:", e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    loadData();
  });

  onDestroy(() => {
    if (alarmTestAudio) { alarmTestAudio.stop(); alarmTestAudio = null; }
  });
</script>

<main class="sleep-workspace module-root" data-module="sleep">
  <section class="sleep-shell">
    <header class="sleep-shell__header">
      <div class="sleep-shell__intro">
        <div class="sleep-shell__eyebrow">
          <span>{_t('moduleSleepSomna')}</span>
          <Badge variant="outline">{displaySection}</Badge>
        </div>
        <h1>{_t('moduleSleepDesc')}</h1>
        <p>{_t('moduleSleepHeaderDesc')}</p>
      </div>
    </header>

    {#if loading}
      <div class="sleep-loading"></div>
    {:else if selectedSection === "Tonight"}
    <section class="sleep-hero-grid">
      <Card class="sleep-orb-card">
        <CardHeader>
          <CardTitle>{_t('moduleSleepLastNight')}</CardTitle>
          <CardDescription>{lastNightDesc}</CardDescription>
        </CardHeader>
        <CardContent class="sleep-orb-card__content">
          {@const score = Math.round(lastNight?.qualityScore ?? 0)}
          {@const arcR = 80}
          {@const arcStroke = 14}
          {@const arcCircumference = 2 * Math.PI * arcR}
          {@const arcFilled = (score / 100) * arcCircumference}
          <div class="sleep-orb" role="img" aria-label="Sleep quality score: {score} out of 100">
            <svg viewBox="0 0 200 200" class="sleep-orb-svg">
              <circle cx="100" cy="100" r={arcR} fill="none" stroke="color-mix(in srgb, var(--sleep-border) 60%, transparent)" stroke-width={arcStroke} />
              <circle cx="100" cy="100" r={arcR} fill="none" stroke="var(--sleep-accent)" stroke-width={arcStroke} stroke-linecap="round" stroke-dasharray="{arcFilled} {arcCircumference - arcFilled}" transform="rotate(-90 100 100)" />
            </svg>
            <div class="sleep-orb-center">
              <strong>{score}</strong>
              <small>{_t('moduleSleepScore')}</small>
            </div>
          </div>
          <div class="sleep-meta">
            <div><strong>{lastNight && sleepStats ? lastNight.durationMin >= sleepStats.avgDurationMin ? `+${Math.round((lastNight.durationMin / sleepStats.avgDurationMin - 1) * 100)}%` : `${Math.round((lastNight.durationMin / sleepStats.avgDurationMin - 1) * 100)}%` : '--'}</strong><span>{_t('moduleSleepBetterThanAvg')}</span></div>
            <div><strong>{lastNight ? tsToHHMM(lastNight.wakeTs) : '--:--'}</strong><span>{_t('moduleSleepSmartWake')}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card class="sleep-summary-card">
        <CardHeader>
          <CardTitle>{_t('moduleSleepRecoveryOutlook')}</CardTitle>
          <CardDescription>{_t('moduleSleepRecoveryOutlookDesc')}</CardDescription>
        </CardHeader>
        <CardContent class="sleep-summary-list">
          {#each tonightFocus as item}
            <article>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
    {/if}

    <section class="sleep-shell__body">
      {#if selectedSection === "Tonight"}
        <div class="sleep-grid sleep-grid--tonight">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepTonightPlan')}</CardTitle>
              <CardDescription>{_t('moduleSleepTonightPlanDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-list">
              {#each tonightFocus as item}
                <article>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepPreSleepChecklist')}</CardTitle>
              <CardDescription>{_t('moduleSleepPreSleepChecklistDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-routine-list">
              {#each routineWithStatus as step}
                <article>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.note}</p>
                  </div>
                  <button class="sl-routine-toggle" class:sl-routine--done={step.status === 'Done'} onclick={() => toggleRoutine(step.id)} aria-label={step.status === 'Done' ? 'Mark incomplete' : 'Mark complete'} use:tooltip={{ text: step.status === 'Done' ? 'Mark incomplete' : 'Mark complete' }}>
                    {#if step.status === 'Done'}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><path d="M5 13l4 4L19 7"/></svg>
                    {:else}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="9"/></svg>
                    {/if}
                  </button>
                </article>
              {/each}
              {#if routines.length === 0}
                <div class="sleep-empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" opacity="0.3"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 3"/></svg>
                  <p>No routine items yet.</p>
                  <span>Add your wind-down steps above to build a consistent bedtime routine.</span>
                </div>
              {/if}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Score"}
        <div class="sleep-grid sleep-grid--score">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>Sub-scores</CardTitle>
              <CardDescription>Breakdown from tracked sleep sessions (stages not measurable via laptop sensors)</CardDescription>
            </CardHeader>
            <CardContent class="sleep-stage-list">
              {#each scoreSubScores as sub}
                <article>
                  <div class="sleep-stage-copy">
                    <strong>{sub.label}</strong>
                    <span>{sub.value}</span>
                    <p>{sub.desc}</p>
                  </div>
                  <div class="sleep-meter" role="meter" aria-label="{sub.label} score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sub.fill)}><i style={`--fill:${sub.fill}%`}></i></div>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepScoreBreakdown')}</CardTitle>
              <CardDescription>{_t('moduleSleepScoreBreakdownDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-breakdown">
              {#each scoreBreakdown as item}
                <div><span>{item.label}</span><strong>{item.value}</strong></div>
              {/each}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Routine"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleSleepBedtimeRoutine')}</CardTitle>
            <CardDescription>{_t('moduleSleepBedtimeRoutineDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="sleep-routine-board">                <!-- Add routine form -->
            <div class="sr-add-form">
              <input type="text" bind:value={routineInput} placeholder="New routine step..." class="sr-input" onkeydown={(e) => e.key === 'Enter' && addRoutine()} />
              <button class="sr-add-btn" onclick={addRoutine} disabled={routineSaving || !routineInput.trim()}>
                {routineSaving ? 'Adding...' : 'Add'}
              </button>
            </div>
            {#each routineWithStatus as step, index}
              <article>
                <div class="sleep-routine-board__count" class:sr-count--done={step.status === 'Done'}>{index + 1}</div>
                <div>
                  <strong class:sr-title--done={step.status === 'Done'}>{step.title}</strong>
                  <p>{step.note}</p>
                </div>
                <div class="sr-actions">
                  <button class="sl-routine-toggle" class:sl-routine--done={step.status === 'Done'} onclick={() => toggleRoutine(step.id)} aria-label={step.status === 'Done' ? 'Mark incomplete' : 'Mark complete'} use:tooltip={{ text: step.status === 'Done' ? 'Mark incomplete' : 'Mark complete' }}>
                    {#if step.status === 'Done'}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="13" height="13"><path d="M5 13l4 4L19 7"/></svg>
                    {:else}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="9"/></svg>
                    {/if}
                  </button>
                  <button class="sr-del" onclick={() => deleteRoutine(step.id)} aria-label="Delete routine" use:tooltip={{ text: "Delete routine" }}><Trash2Icon size={14} /></button>
                </div>
              </article>
            {/each}
            {#if routines.length === 0}
              <div class="sleep-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" opacity="0.3"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 3"/></svg>
                <p>No routine items set up yet.</p>
                <span>Add your bedtime steps above to build a consistent wind-down routine.</span>
              </div>
            {/if}
          </CardContent>
        </Card>
      {:else if selectedSection === "Trends"}
        <div class="sleep-grid sleep-grid--trends">
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepWeeklyTrend')}</CardTitle>
              <CardDescription>{_t('moduleSleepWeeklyTrendDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-trend-chart">
              <svg viewBox="0 0 240 240" class="sleep-arc-svg" role="img" aria-label="Weekly sleep score rings: {arcSegments.map(s => `${s.day} ${s.score}`).join(', ')}">
                {#each arcSegments as seg}
                  <circle
                    cx={seg.cx} cy={seg.cy} r={seg.r}
                    fill="none"
                    stroke="color-mix(in srgb, {seg.color} 18%, transparent)"
                    stroke-width={seg.strokeWidth}
                  />
                {/each}
                {#each arcSegments as seg}
                  <circle
                    cx={seg.cx} cy={seg.cy} r={seg.r}
                    fill="none"
                    stroke={seg.color}
                    stroke-width={seg.strokeWidth}
                    stroke-linecap="round"
                    stroke-dasharray="{seg.filled} {seg.empty}"
                    transform="rotate({seg.rotation} {seg.cx} {seg.cy})"
                  />
                {/each}
                <text x="120" y="114" text-anchor="middle" dominant-baseline="central" class="sleep-arc-score">
                  {weeklyAvgScore}
                </text>
                <text x="120" y="134" text-anchor="middle" dominant-baseline="central" class="sleep-arc-label">
                  AVG
                </text>
              </svg>
              <!-- Screen reader table -->
              <table class="sleep-sr-only">
                <caption>Weekly sleep scores</caption>
                <thead><tr><th>Day</th><th>Score</th></tr></thead>
                <tbody>
                  {#each arcSegments as seg}
                    <tr><td>{seg.day}</td><td>{seg.score}</td></tr>
                  {/each}
                </tbody>
              </table>
              <div class="sleep-arc-legend">
                {#each arcSegments as seg}
                  <span class="sleep-arc-legend-item">
                    <i style="background:{seg.color}"></i>
                    <span>{seg.day}</span>
                    <strong>{seg.score}</strong>
                  </span>
                {/each}
              </div>
            </CardContent>
          </Card>

          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>{_t('moduleSleepPatternNotes')}</CardTitle>
              <CardDescription>{_t('moduleSleepPatternNotesDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="sleep-list">
              {#if bestNight && worstNight}
                <article><span>Best night</span><strong>{Math.round(bestNight.qualityScore ?? 0)}</strong><p>{shortDate(bestNight.date)} — {formatDuration(bestNight.durationMin)}</p></article>
                <article><span>Weakest night</span><strong>{Math.round(worstNight.qualityScore ?? 0)}</strong><p>{shortDate(worstNight.date)} — {formatDuration(worstNight.durationMin)}</p></article>
                <article><span>Trend</span><strong>{weeklyAvgScore >= 70 ? 'Rising' : 'Building'}</strong><p>{weeklyTrend.filter(d => d.score > 0).length} nights logged this week.</p></article>
              {:else}
                <article><span>No data yet</span><strong>--</strong><p>Start logging your sleep to see patterns.</p></article>
              {/if}
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Alarm"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleSleepAlarmOrch')}</CardTitle>
            <CardDescription>{_t('moduleSleepAlarmOrchDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="sleep-alarm-list">
            <!-- Add alarm form -->
            <div class="sa-add-form">
              <input type="text" bind:value={alarmLabel} placeholder="Alarm label..." class="sa-input" />
              <div class="sa-time-wrap">
                <input type="time" bind:value={alarmTime} class="sa-time" />
                <span class="sa-time-hint">{formatTime24to12(alarmTime)}</span>
              </div>
              <select class="sa-sound" onchange={(e) => previewAlarmSound(e)}>
                {#each alarmSoundOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
              <button class="sa-add-btn" onclick={addAlarm} disabled={alarmSaving || !alarmLabel.trim() || !alarmTime.trim()}>
                {alarmSaving ? 'Adding...' : 'Add'}
              </button>
            </div>
            {#if alarmError}
              <p style="color:var(--destructive);font-size:0.85rem;margin:8px 0;">{alarmError}</p>
            {/if}
            {#if alarmSuccess}
              <p style="color:var(--success);font-size:0.85rem;margin:8px 0;">{alarmSuccess}</p>
            {/if}
            {#each alarmList as alarm}
              <article>
                <div>
                  <strong>{alarm.label}</strong>
                  <p>{alarm.wakeWindow}{alarm.sound && alarm.sound !== 'alarm' ? ` · ${soundLabelMap.get(alarm.sound) ?? alarm.sound}` : ''}</p>
                </div>
                <div class="sleep-alarm-list__time" class:sa-time--inactive={!alarm.active}>{formatTime24to12(alarm.time)}</div>
                <div class="sa-actions">
                  <button class="sa-toggle" onclick={() => toggleAlarm(alarm.id)} aria-label={alarm.active ? 'Disable alarm' : 'Enable alarm'} use:tooltip={{ text: alarm.active ? 'Disable alarm' : 'Enable alarm' }}>
                    {#if alarm.active}
                      <BellIcon size={16} />
                    {:else}
                      <BellOffIcon size={16} />
                    {/if}
                  </button>
                  <button class="sr-del" onclick={() => deleteAlarm(alarm.id)} aria-label="Delete alarm" use:tooltip={{ text: "Delete alarm" }}><Trash2Icon size={14} /></button>
                </div>
              </article>
            {/each}
            {#if alarmList.length === 0}
              <p style="text-align:center;color:var(--muted);padding:20px;">No alarms configured yet.</p>
            {/if}
          </CardContent>
        </Card>
      {:else if selectedSection === "Sessions"}
        <div class="sleep-grid-sessions">
          <!-- Stats bento -->
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>Sleep stats</CardTitle>
              <CardDescription>30-day overview from tracked sessions</CardDescription>
            </CardHeader>
            <CardContent class="sleep-session-stats">
              {#if sleepStats}
                <div class="ss-stat">
                  <span class="ss-stat-value">{formatDuration(sleepStats.avgDurationMin)}</span>
                  <span class="ss-stat-label">Avg duration</span>
                </div>
                <div class="ss-stat">
                  <span class="ss-stat-value">{sleepStats.avgBedtime}</span>
                  <span class="ss-stat-label">Avg bedtime</span>
                </div>
                <div class="ss-stat">
                  <span class="ss-stat-value">{sleepStats.avgWaketime}</span>
                  <span class="ss-stat-label">Avg wake</span>
                </div>
                <div class="ss-stat">
                  <span class="ss-stat-value" class:ss-stat--good={sleepStats.consistencyScore >= 70} class:ss-stat--warn={sleepStats.consistencyScore >= 40 && sleepStats.consistencyScore < 70} class:ss-stat--bad={sleepStats.consistencyScore < 40}>{Math.round(sleepStats.consistencyScore)}</span>
                  <span class="ss-stat-label">Consistency</span>
                </div>
                <div class="ss-stat">
                  <span class="ss-stat-value" class:ss-stat--bad={sleepStats.sleepDebtMin > 0}>{sleepStats.sleepDebtMin > 0 ? `-${formatDuration(sleepStats.sleepDebtMin)}` : 'On track'}</span>
                  <span class="ss-stat-label">Sleep debt</span>
                </div>
                <div class="ss-stat">
                  <span class="ss-stat-value">{sleepStats.totalSessions}</span>
                  <span class="ss-stat-label">Sessions</span>
                </div>
              {:else}
                <p style="color:var(--muted);text-align:center;grid-column:1/-1;padding:20px;">No session data yet.</p>
              {/if}
            </CardContent>
          </Card>

          <!-- Session list + manual log -->
          <Card class="sleep-panel">
            <CardHeader>
              <CardTitle>Session log</CardTitle>
              <CardDescription>
                {#if !showManualForm}
                  OS-detected + manual sessions
                {:else}
                  Log a past night manually
                {/if}
              </CardDescription>
            </CardHeader>
            <CardContent class="sleep-session-list">
              {#if showManualForm}
                <div class="ss-manual-form">
                  <label class="ss-field">
                    <span>Date</span>
                    <input type="date" bind:value={manualDate} />
                  </label>
                  <label class="ss-field">
                    <span>Bedtime</span>
                    <input type="time" bind:value={manualBedtime} />
                  </label>
                  <label class="ss-field">
                    <span>Wake time</span>
                    <input type="time" bind:value={manualWake} />
                  </label>
                  <label class="ss-field">
                    <span>Notes</span>
                    <input type="text" bind:value={manualNotes} placeholder="Optional..." />
                  </label>
                  <div class="ss-form-actions">
                    <Button onclick={() => showManualForm = false} variant="outline">Cancel</Button>
                    <Button onclick={addManualSession} disabled={sessionSaving}>{sessionSaving ? 'Saving...' : 'Save session'}</Button>
                  </div>
                </div>
              {:else}
                <div class="ss-toolbar">
                  <Button onclick={() => showManualForm = true}>
                    <PlusIcon data-icon="inline-start" size={14} />
                    Log sleep
                  </Button>
                </div>
              {/if}

              <div class="ss-list">
                {#each sleepSessions as session}
                  <article class="ss-row">
                    <div class="ss-row-main">
                      <span class="ss-row-date">{shortDate(session.date)}</span>
                      <div class="ss-row-bar-wrap">
                        <div
                          class="ss-row-bar"
                          style="width:{(session.durationMin / (sleepGoal?.targetDurationMin ?? 480)) * 100}%;background:{session.qualityScore != null && session.qualityScore >= 70 ? 'var(--sleep-accent)' : session.qualityScore != null && session.qualityScore >= 40 ? 'oklch(0.769 0.165 70.080)' : 'oklch(0.637 0.208 25.331)'}"
                          role="meter"
                          aria-label="Sleep duration: {formatDuration(session.durationMin)}"
                          aria-valuemin={0}
                          aria-valuemax={sleepGoal?.targetDurationMin ?? 480}
                          aria-valuenow={session.durationMin}
                        >
                        </div>
                      </div>
                      <span class="ss-row-time">{formatDuration(session.durationMin)}</span>
                      <Badge variant="outline">{session.source === 'auto' ? 'Detected' : 'Manual'}</Badge>
                    </div>
                    {#if sessionDeleteLoading !== session.id}
                      <button class="ss-row-delete" onclick={() => deleteSession(session.id)} aria-label="Delete session" use:tooltip={{ text: "Delete session" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    {:else}
                      <span style="color:var(--muted);font-size:11px;">Deleting...</span>
                    {/if}
                  </article>
                {/each}
                {#if sleepSessions.length === 0}
                  <p style="text-align:center;color:var(--muted);padding:20px;">No sessions yet. OS detection will auto-record when your laptop sleeps.</p>
                {/if}
              </div>
            </CardContent>
          </Card>
        </div>
      {:else if selectedSection === "Goal"}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>Sleep goal</CardTitle>
            <CardDescription>Set your target bedtime, wake time, and duration. The quality score uses these as the baseline.</CardDescription>
          </CardHeader>
          <CardContent class="sleep-goal-form">
            <div class="sg-grid">
              <label class="sg-field">
                <span class="sg-label">Target bedtime</span>
                <input type="time" bind:value={goalBedtime} class="sg-input" />
              </label>
              <label class="sg-field">
                <span class="sg-label">Target wake time</span>
                <input type="time" bind:value={goalWaketime} class="sg-input" />
              </label>
              <label class="sg-field sg-field--wide">
                <span class="sg-label">Target duration: <strong>{formatDuration(goalDuration)}</strong></span>
                <input type="range" min="360" max="600" step="15" bind:value={goalDuration} class="sg-slider" />
                <div class="sg-slider-labels">
                  <span>6h</span>
                  <span>10h</span>
                </div>
              </label>
            </div>
            <div class="sg-actions">
              <Button onclick={saveSleepGoal} disabled={goalSaving}>
                {goalSaving ? 'Saving...' : goalSaved ? 'Saved!' : 'Save goal'}
              </Button>
            </div>
          </CardContent>
        </Card>
      {:else}
        <Card class="sleep-panel sleep-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleSleepExportTitle')}</CardTitle>
            <CardDescription>{_t('moduleSleepExportDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="sleep-list">
            <article>
              <div><strong>Sleep report</strong><p>Last 30 nights with score, debt, and routine adherence.</p></div>
              <Button variant="outline" onclick={exportPDF} disabled={sleepSessions.length === 0}>
                <DownloadIcon data-icon="inline-start" /> {_t('moduleSleepExportBtn')}
              </Button>
            </article>
            <article>
              <div><strong>CSV sessions</strong><p>Nightly duration, quality, and source for external analysis.</p></div>
              <Button variant="outline" onclick={exportSessionsCSV} disabled={sleepSessions.length === 0}>
                <DownloadIcon data-icon="inline-start" /> {_t('moduleSleepExportBtn')}
              </Button>
            </article>
            <article>
              <div><strong>Shareable recap</strong><p>A one-page summary for coach or clinician review.</p></div>
              <Button variant="outline" onclick={exportSummaryCSV} disabled={sleepSessions.length === 0}>
                <DownloadIcon data-icon="inline-start" /> {_t('moduleSleepExportBtn')}
              </Button>
            </article>
          </CardContent>
        </Card>
      {/if}
    </section>
  </section>
</main>

<style>
  :global(.sleep-workspace) {
    --sleep-bg: var(--background);
    --sleep-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --sleep-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --sleep-border: color-mix(in srgb, var(--border) 86%, transparent);
    --sleep-ink: var(--foreground);
    --sleep-muted: var(--muted);
    --sleep-accent: oklch(0.708 0.152 269.741);
    --sleep-accent-soft: color-mix(in srgb, oklch(0.708 0.152 269.741) 36%, var(--primary));
    --sleep-accent-bg: color-mix(in srgb, oklch(0.708 0.152 269.741) 12%, var(--background));
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    height: 100%;
    padding: 28px 30px;
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    overflow: hidden;
    font-family: var(--font-body);
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(.sleep-workspace) button,
  :global(.sleep-workspace) input,
  :global(.sleep-workspace) select {
    user-select: none;
  }

  :global(.sleep-workspace) ::selection {
    background: color-mix(in srgb, var(--sleep-accent) 22%, transparent);
    color: var(--sleep-ink);
  }

  :global(.sleep-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 20px;
    height: 100%;
    min-height: 0;
  }

  :global(.sleep-shell__header),
  :global(.sleep-hero-grid),
  :global(.sleep-shell__body),
  :global(.sleep-grid) {
    min-height: 0;
  }

  :global(.sleep-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.sleep-shell__intro) {
    max-width: 56rem;
  }

  :global(.sleep-shell__eyebrow) {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    color: var(--sleep-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.sleep-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    font-family: var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  :global(.sleep-shell__intro) p {
    max-width: 42rem;
    margin: 12px 0 0;
    color: var(--sleep-muted);
    font-size: 0.97rem;
    line-height: 1.55;
    text-wrap: pretty;
  }

  :global(.sleep-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 16px;
  }

  :global(.sleep-orb-card),
  :global(.sleep-summary-card),
  :global(.sleep-panel) {
    border-color: var(--sleep-border);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--sleep-surface) 98%, var(--background)),
        color-mix(in srgb, var(--sleep-surface) 86%, var(--background))
      );
  }

  :global(.sleep-orb-card__content) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 20px;
    align-items: center;
  }

  :global(.sleep-orb) {
    position: relative;
    width: 180px;
    height: 180px;
    flex-shrink: 0;
  }

  :global(.sleep-orb-svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  :global(.sleep-orb-center) {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  :global(.sleep-orb-center) strong {
    font-size: 3rem;
    line-height: 1;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--sleep-accent);
  }

  :global(.sleep-orb-center) small {
    color: var(--sleep-muted);
    font-size: 0.8rem;
  }

  :global(.sleep-meta) span,
  :global(.sleep-list) p,
  :global(.sleep-routine-list) p,
  :global(.sleep-stage-copy) span,
  :global(.sleep-alarm-list) p {
    color: var(--sleep-muted);
  }

  :global(.sleep-meta) {
    display: grid;
    gap: 14px;
  }

  :global(.sleep-meta) strong {
    display: block;
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
  }

  :global(.sleep-summary-list),
  :global(.sleep-list),
  :global(.sleep-routine-list),
  :global(.sleep-stage-list),
  :global(.sleep-alarm-list) {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
  }

  :global(.sleep-summary-list) article,
  :global(.sleep-list) article,
  :global(.sleep-routine-list) article,
  :global(.sleep-stage-list) article,
  :global(.sleep-alarm-list) article,
  :global(.sleep-routine-board) article,
  :global(.sleep-breakdown) div {
    border: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--sleep-surface-strong) 92%, transparent);
  }

  :global(.sleep-summary-list) article,
  :global(.sleep-list) article {
    padding: 16px 18px;
  }

  :global(.sleep-summary-list) span,
  :global(.sleep-list) span {
    display: block;
    color: var(--sleep-muted);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  :global(.sleep-summary-list) strong,
  :global(.sleep-list) strong {
    display: block;
    margin-top: 6px;
    font-size: 1.2rem;
    font-variant-numeric: tabular-nums;
  }

  :global(.sleep-shell__body) {
    min-height: 0;
  }

  :global(.sleep-grid) {
    display: grid;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  :global(.sleep-grid--tonight),
  :global(.sleep-grid--score),
  :global(.sleep-grid--trends) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.sleep-panel),
  :global(.sleep-panel) :global(.card-content) {
    min-height: 0;
  }

  :global(.sleep-panel) {
    display: flex;
    flex-direction: column;
  }

  :global(.sleep-panel--full) {
    height: 100%;
  }

  :global(.sleep-routine-list) article,
  :global(.sleep-alarm-list) article,
  :global(.sleep-routine-board) article {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 16px 18px;
  }

  :global(.sleep-routine-board) article {
    grid-template-columns: 46px 1fr auto;
  }

  :global(.sleep-stage-list) article {
    padding: 16px 18px;
  }

  :global(.sleep-stage-copy) {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 10px;
  }

  :global(.sleep-meter) {
    height: 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sleep-border) 72%, transparent);
    overflow: hidden;
  }

  :global(.sleep-meter) i {
    display: block;
    border-radius: inherit;
    background: linear-gradient(180deg, var(--sleep-accent), var(--sleep-accent-soft));
    width: var(--fill);
    height: 100%;
  }

  :global(.sleep-breakdown) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  :global(.sleep-breakdown) div {
    padding: 18px;
  }

  :global(.sleep-breakdown) span {
    display: block;
    color: var(--sleep-muted);
    font-size: 0.85rem;
  }

  :global(.sleep-breakdown) strong {
    display: block;
    margin-top: 12px;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }

  :global(.sleep-routine-board) {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow: auto;
  }

  :global(.sleep-routine-board__count) {
    display: grid;
    place-items: center;
    width: 46px;
    aspect-ratio: 1;
    border-radius: 16px;
    background: color-mix(in srgb, var(--sleep-accent) 16%, var(--sleep-surface));
    color: var(--sleep-ink);
    font-weight: 700;
  }

  :global(.sleep-trend-chart) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 200px;
    height: 100%;
  }

  :global(.sleep-arc-svg) {
    width: 100%;
    max-width: 200px;
    height: auto;
    overflow: visible;
  }

  :global(.sleep-arc-score) {
    font-size: 2rem;
    font-weight: 700;
    fill: var(--sleep-ink);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  :global(.sleep-arc-label) {
    font-size: 0.7rem;
    font-weight: 600;
    fill: var(--sleep-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  :global(.sleep-arc-legend) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    justify-content: center;
    max-width: 260px;
  }

  :global(.sleep-arc-legend-item) {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    line-height: 1;
  }

  :global(.sleep-arc-legend-item) i {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  :global(.sleep-arc-legend-item) span {
    color: var(--sleep-muted);
    min-width: 22px;
  }

  :global(.sleep-arc-legend-item) strong {
    font-weight: 600;
    color: var(--sleep-ink);
    min-width: 16px;
    text-align: right;
  }

  /* ── Routine add form ── */
  :global(.sr-add-form) {
    display: flex;
    gap: 8px;
    padding: 4px 0 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    flex-shrink: 0;
  }

  :global(.sr-input) {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--sleep-border);
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-size: 0.88rem;
    font-family: inherit;
  }

  :global(.sr-input:focus) {
    outline: none;
    border-color: var(--sleep-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sleep-accent) 20%, transparent);
  }

  :global(.sr-add-btn) {
    padding: 8px 18px;
    border-radius: 10px;
    border: none;
    background: var(--sleep-accent);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 160ms var(--ease-spring), opacity 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.sr-add-btn:disabled) { opacity: 0.5; cursor: not-allowed; }
  @media (hover: hover) and (pointer: fine) {
    :global(.sr-add-btn:hover:not(:disabled)) { background: color-mix(in srgb, var(--sleep-accent) 85%, #0a0a0a); }
  }
  :global(.sr-add-btn:active:not(:disabled)) { transform: scale(0.96); }

  /* ── Alarm add form ── */
  :global(.sa-add-form) {
    display: flex;
    gap: 8px;
    padding: 4px 0 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    flex-shrink: 0;
    align-items: center;
  }

  :global(.sa-input) {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--sleep-border);
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-size: 0.88rem;
    font-family: inherit;
  }

  :global(.sa-input:focus) {
    outline: none;
    border-color: var(--sleep-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sleep-accent) 20%, transparent);
  }

  :global(.sa-time-wrap) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  :global(.sa-time-wrap .sa-time) {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--sleep-border);
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-size: 0.85rem;
    font-family: 'JetBrains Mono', monospace;
    width: 100px;
  }

  :global(.sa-time-hint) {
    font-size: 0.78rem;
    color: var(--sleep-muted);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    min-width: 60px;
  }

  :global(.sa-time-wrap .sa-time:focus) {
    outline: none;
    border-color: var(--sleep-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sleep-accent) 20%, transparent);
  }

  :global(.sa-sound) {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--sleep-border);
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-size: 0.82rem;
    font-family: inherit;
    cursor: pointer;
    max-width: 140px;
  }

  :global(.sa-sound:focus) {
    outline: none;
    border-color: var(--sleep-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sleep-accent) 20%, transparent);
  }

  :global(.sa-add-btn) {
    padding: 8px 18px;
    border-radius: 10px;
    border: none;
    background: var(--sleep-accent);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 160ms var(--ease-spring), opacity 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.sa-add-btn:disabled) { opacity: 0.5; cursor: not-allowed; }
  @media (hover: hover) and (pointer: fine) {
    :global(.sa-add-btn:hover:not(:disabled)) { background: color-mix(in srgb, var(--sleep-accent) 85%, #0a0a0a); }
  }
  :global(.sa-add-btn:active:not(:disabled)) { transform: scale(0.96); }

  :global(.sleep-alarm-list) article {
    grid-template-columns: 1fr auto auto;
  }

  :global(.sleep-alarm-list__time) {
    font: 700 1.4rem "JetBrains Mono", monospace;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  :global(.sa-time--inactive) {
    opacity: 0.35;
    text-decoration: line-through;
  }

  :global(.sa-actions),
  :global(.sr-actions) {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  :global(.sa-toggle) {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    color: var(--sleep-accent);
    transition: transform 160ms var(--ease-spring), background 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.sa-toggle:hover) { background: color-mix(in srgb, var(--sleep-accent) 14%, transparent); }
  }
  :global(.sa-toggle:active) { transform: scale(0.92); }

  :global(.sr-del) {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    color: var(--sleep-muted);
    transition: transform 160ms var(--ease-spring), background 160ms ease, color 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.sr-del:hover) { background: color-mix(in srgb, oklch(0.637 0.208 25.331) 14%, transparent); color: oklch(0.637 0.208 25.331); }
  }
  :global(.sr-del:active) { transform: scale(0.92); }

  :global(.sleep-loading) {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sleep-muted);
    animation: sleep-pulse 1.5s ease-in-out infinite;
  }

  :global(.sleep-loading)::after {
    content: "Loading sleep data...";
    font-size: 0.9rem;
    opacity: 0.6;
  }

  @keyframes sleep-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  /* ── Sessions view ── */
  :global(.sleep-grid-sessions) {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  :global(.sleep-session-stats) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    min-height: 0;
  }

  :global(.ss-stat) {
    border-radius: 16px;
    padding: 14px 12px;
    background: color-mix(in srgb, var(--sleep-surface-strong) 94%, transparent);
    border: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    text-align: center;
  }

  :global(.ss-stat-value) {
    display: block;
    font-size: 1.3rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  :global(.ss-stat-label) {
    display: block;
    font-size: 0.7rem;
    color: var(--sleep-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
  }

  :global(.ss-stat--good) { color: oklch(0.723 0.192 149.579); }
  :global(.ss-stat--warn) { color: oklch(0.769 0.165 70.080); }
  :global(.ss-stat--bad) { color: oklch(0.637 0.208 25.331); }

  :global(.sleep-session-list) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    overflow: auto;
  }

  :global(.ss-toolbar) {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  :global(.ss-list) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }

  :global(.ss-row) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    background: color-mix(in srgb, var(--sleep-surface-strong) 94%, transparent);
    transition: border-color 160ms ease;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.ss-row:hover) { border-color: color-mix(in srgb, var(--sleep-border) 60%, transparent); }
  }

  :global(.ss-row-main) {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  :global(.ss-row-date) {
    font-size: 0.78rem;
    font-weight: 600;
    width: 60px;
    flex-shrink: 0;
    color: var(--sleep-muted);
  }

  :global(.ss-row-bar-wrap) {
    flex: 1;
    height: 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sleep-border) 72%, transparent);
    overflow: hidden;
    min-width: 40px;
  }

  :global(.ss-row-bar) {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  :global(.ss-row-time) {
    font-size: 0.78rem;
    font-weight: 600;
    width: 52px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  :global(.ss-row-delete) {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    color: var(--sleep-muted);
    transition: transform 160ms var(--ease-spring), background 160ms ease, color 160ms ease;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    :global(.ss-row-delete:hover) { background: color-mix(in srgb, oklch(0.637 0.208 25.331) 14%, transparent); color: oklch(0.637 0.208 25.331); }
  }
  :global(.ss-row-delete:active) { transform: scale(0.92); }

  :global(.ss-manual-form) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--sleep-border) 92%, transparent);
    background: color-mix(in srgb, var(--sleep-surface-strong) 94%, transparent);
    flex-shrink: 0;
  }

  :global(.ss-field) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.ss-field) span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sleep-muted);
  }

  :global(.ss-field) input {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--sleep-border);
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-size: 0.88rem;
    font-family: inherit;
  }

  :global(.ss-field) input:focus {
    outline: none;
    border-color: var(--sleep-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sleep-accent) 20%, transparent);
  }

  :global(.ss-form-actions) {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
  }

  /* ── Goal view ── */
  :global(.sleep-goal-form) {
    max-width: 420px;
    margin: 0 auto;
    padding-top: 20px;
  }

  :global(.sg-grid) {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  :global(.sg-field) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.sg-field--wide) {
    gap: 10px;
  }

  :global(.sg-label) {
    font-size: 0.82rem;
    color: var(--sleep-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  :global(.sg-label) strong {
    color: var(--sleep-ink);
    font-weight: 700;
  }

  :global(.sg-input) {
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--sleep-border);
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-size: 1.1rem;
    font-family: 'JetBrains Mono', monospace;
    width: 160px;
  }

  :global(.sg-input:focus) {
    outline: none;
    border-color: var(--sleep-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sleep-accent) 20%, transparent);
  }

  :global(.sg-slider) {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sleep-border) 80%, transparent);
    outline: none;
  }

  :global(.sg-slider::-webkit-slider-thumb) {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: var(--sleep-accent);
    cursor: pointer;
    border: 2px solid var(--sleep-bg);
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  }

  :global(.sg-slider-labels) {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--sleep-muted);
  }

  :global(.sg-actions) {
    margin-top: 24px;
    display: flex;
    justify-content: center;
  }

  @media (max-width: 860px) {
    :global(.sleep-grid-sessions) { grid-template-columns: 1fr; }
  }

  /* ── Reduced Motion ─────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    :global(.sr-add-btn),
    :global(.sa-add-btn),
    :global(.sa-toggle),
    :global(.sr-del),
    :global(.ss-row-delete),
    :global(.ss-row) {
      transition: none !important;
    }
    :global(.sr-add-btn:active:not(:disabled)),
    :global(.sa-add-btn:active:not(:disabled)),
    :global(.sa-toggle:active),
    :global(.sr-del:active),
    :global(.ss-row-delete:active),
    :global(.ss-row:hover) {
      transform: none !important;
    }
    :global(.sleep-loading) {
      animation: none;
    }
  }

  /* ── Screen reader only ─────────────────────────────────────────────── */
  :global(.sleep-sr-only) {
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

  /* ── Routine toggle button ─────────────────────────────────────────── */
  :global(.sl-routine-toggle) {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 2px solid color-mix(in srgb, var(--sleep-accent) 40%, transparent);
    background: transparent;
    color: var(--sleep-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  :global(.sl-routine-toggle:hover) {
    border-color: var(--sleep-accent);
    color: var(--sleep-accent);
  }
  :global(.sl-routine--done) {
    background: var(--sleep-accent);
    border-color: var(--sleep-accent);
    color: white;
  }

  /* ── Routine board step states ─────────────────────────────────────── */
  :global(.sr-count--done) {
    background: var(--sleep-accent);
    color: white;
  }
  :global(.sr-title--done) {
    text-decoration: line-through;
    opacity: 0.6;
  }

  /* ── Empty state ───────────────────────────────────────────────────── */
  :global(.sleep-empty-state) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
    color: var(--sleep-muted);
  }
  :global(.sleep-empty-state p) {
    margin: 0;
    font-weight: 500;
    color: var(--sleep-ink);
  }
  :global(.sleep-empty-state span) {
    font-size: 0.82rem;
    max-width: 260px;
  }
</style>
