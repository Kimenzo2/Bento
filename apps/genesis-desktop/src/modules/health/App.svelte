<script lang="ts">
  import { invoke }        from "@tauri-apps/api/core";
  import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
  import ActivityIcon      from "@lucide/svelte/icons/activity";
  import DropletIcon       from "@lucide/svelte/icons/droplet";
  import HeartPulseIcon    from "@lucide/svelte/icons/heart-pulse";
  import TrendingUpIcon    from "@lucide/svelte/icons/trending-up";
  import DownloadIcon      from "@lucide/svelte/icons/download";
  import SparklesIcon      from "@lucide/svelte/icons/sparkles";
  import PlusIcon          from "@lucide/svelte/icons/plus";
  import CheckIcon         from "@lucide/svelte/icons/check";
  import ThermometerIcon   from "@lucide/svelte/icons/thermometer";
  import ScaleIcon         from "@lucide/svelte/icons/scale";
  import ZapIcon           from "@lucide/svelte/icons/zap";
  import MoonIcon          from "@lucide/svelte/icons/moon";
  import FlameIcon         from "@lucide/svelte/icons/flame";
  import PillIcon          from "@lucide/svelte/icons/pill";
  import CalendarIcon      from "@lucide/svelte/icons/calendar";
  import Loader2Icon       from "@lucide/svelte/icons/loader-2";
  import { Badge }         from "$lib/components/ui/badge/index.js";
  import { Button }        from "$lib/components/ui/button/index.js";
  import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
  } from "$lib/components/ui/card/index.js";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  } from "$lib/components/ui/dialog/index.js";
  import { Input }         from "$lib/components/ui/input/index.js";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { onMount } from "svelte";
  import { time } from '$lib/utils/time';

  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Types mirroring Rust structs ──────────────────────────────
  type DailyLogRow = {
    id: string; mood: string; energy: number; waterGlasses: number;
    sleepHours: number; symptoms: string[]; note: string | null;
    loggedAt: number; dateKey: string;
  };

  type VitalsRow = {
    id: string; bp: string | null; hr: string | null; weight: string | null;
    temp: string | null; spo2: string | null; loggedAt: number; dateKey: string;
  };

  type MedRow = {
    id: string; name: string; dose: string; timeOfDay: string;
    notes: string; takenToday: boolean; createdAt: number;
  };

  // ── Section nav ───────────────────────────────────────────────
  const moduleId      = "health";
  const sectionLabels = ["Dashboard", "Daily Log", "Vitals", "Insights", "Medications"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));
  onMount(() => ensureModuleSection(moduleId, sectionLabels));

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  void today;

  // ── Daily Log state ───────────────────────────────────────────
  const moodOptions = [
    { id: "low",    label: "Low",    emoji: "😔" },
    { id: "okay",   label: "Okay",   emoji: "😐" },
    { id: "steady", label: "Steady", emoji: "🙂" },
    { id: "good",   label: "Good",   emoji: "😊" },
    { id: "great",  label: "Great",  emoji: "😄" },
  ];

  const symptomOptions = [
    "Headache","Fatigue","Nausea","Back pain",
    "Brain fog","Bloating","Anxiety","Joint pain",
    "Dizziness","Sore throat","Chest tightness","Low appetite",
  ];

  let selectedMood     = $state("steady");
  let selectedEnergy   = $state(7);
  let selectedSymptoms: string[] = $state([]);
  let waterGlasses     = $state(4);
  let sleepHours       = $state(7);
  let logNote          = $state("");
  let logSaving        = $state(false);
  let logSaved         = $state(false);
  let logError         = $state("");

  // Real data from DB
  let todayLog: DailyLogRow | null = $state(null);
  let weekLogs: DailyLogRow[] = $state([]);

  function toggleSymptom(s: string) {
    selectedSymptoms = selectedSymptoms.includes(s)
      ? selectedSymptoms.filter(x => x !== s)
      : [...selectedSymptoms, s];
  }

  async function saveLog() {
    logSaving = true; logError = "";
    try {
      const row: DailyLogRow = await invoke("health_log_save", {
        entry: {
          mood: selectedMood,
          energy: selectedEnergy,
          waterGlasses,
          sleepHours,
          symptoms: selectedSymptoms,
          note: logNote || null,
        }
      });
      todayLog = row;
      logSaved = true;
      setTimeout(() => (logSaved = false), 2500);
      await loadWeekLogs();
    } catch (e: any) {
      logError = e?.toString() ?? "Failed to save.";
    } finally {
      logSaving = false;
    }
  }

  async function loadTodayLog() {
    try {
      const row: DailyLogRow | null = await invoke("health_log_today");
      if (row) {
        todayLog         = row;
        selectedMood     = row.mood;
        selectedEnergy   = row.energy;
        waterGlasses     = row.waterGlasses;
        sleepHours       = row.sleepHours;
        selectedSymptoms = row.symptoms;
        logNote          = row.note ?? "";
      }
    } catch (e) { console.error("health_log_today failed:", e); }
  }

  async function loadWeekLogs() {
    try { weekLogs = await invoke("health_logs_week"); }
    catch (e) { console.error("health_logs_week failed:", e); }
  }

  // ── Vitals state ──────────────────────────────────────────────
  let newBP = $state(""); let newHR = $state(""); let newWeight = $state(""); let newTemp = $state(""); let newSpo2 = $state("");
  let vitalSaving = $state(false); let vitalSaved = $state(false); let vitalError = $state("");
  let vitalHistory: VitalsRow[] = $state([]);

  async function saveVitals() {
    if (!newBP && !newHR && !newWeight && !newTemp && !newSpo2) {
      vitalError = "Enter at least one reading."; return;
    }
    vitalSaving = true; vitalError = "";
    try {
      const row: VitalsRow = await invoke("health_vitals_save", {
        entry: {
          bp:     newBP     || null,
          hr:     newHR     || null,
          weight: newWeight || null,
          temp:   newTemp   || null,
          spo2:   newSpo2   || null,
        }
      });
      vitalHistory = [row, ...vitalHistory].slice(0, 30);
      newBP = ""; newHR = ""; newWeight = ""; newTemp = ""; newSpo2 = "";
      vitalSaved = true;
      setTimeout(() => (vitalSaved = false), 2500);
    } catch (e: any) {
      vitalError = e?.toString() ?? "Failed to save.";
    } finally {
      vitalSaving = false;
    }
  }

  async function loadVitals() {
    try { vitalHistory = await invoke("health_vitals_list"); }
    catch (e) { console.error("health_vitals_list failed:", e); }
  }

  // #8 fix: use actual entry dates, not day-of-week (avoids collision)
  let bpChartData = $derived.by((): {label:string; sys:number|null; dia:number|null}[] => {
    return vitalHistory
      .map((row) => {
        const sys = row.bp ? parseInt(row.bp.split("/")[0]) || null : null;
        const dia = row.bp ? parseInt(row.bp.split("/")[1]) || null : null;
        return { label: row.dateKey.slice(5), sys, dia };
      })
      .reverse();
  });

  // ── Medications state ─────────────────────────────────────────
  let medications: MedRow[] = $state([]);
  let medLoading   = $state(false);
  let newMedName   = $state(""); let newMedDose = $state(""); let newMedTime = $state(""); let newMedNotes = $state("");
  let medAdding    = $state(false); let medAdded = $state(false); let medError = $state("");

  async function loadMeds() {
    medLoading = true;
    try { medications = await invoke("health_meds_list"); }
    catch (e) { console.error("health_meds_list failed:", e); }
    finally { medLoading = false; }
  }

  async function toggleMed(id: string) {
    try {
      const taken: boolean = await invoke("health_med_toggle", { medId: id });
      medications = medications.map(m => m.id === id ? { ...m, takenToday: taken } : m);
    } catch (e) { console.error("health_med_toggle failed:", e); }
  }

  async function addMed() {
    if (!newMedName.trim()) { medError = "Name is required."; return; }
    medAdding = true; medError = "";
    try {
      const row: MedRow = await invoke("health_med_add", {
        entry: {
          name:      newMedName.trim(),
          dose:      newMedDose.trim(),
          timeOfDay: newMedTime || "08:00",
          notes:     newMedNotes.trim(),
        }
      });
      medications = [...medications, row];
      newMedName = ""; newMedDose = ""; newMedTime = ""; newMedNotes = "";
      medAdded = true;
      setTimeout(() => (medAdded = false), 2000);
    } catch (e: any) {
      medError = e?.toString() ?? "Failed to add.";
    } finally {
      medAdding = false;
    }
  }

  // #9 fix: delete with confirmation
  async function deleteMed(id: string, name: string) {
    if (!confirm(`Remove "${name}" from your medication list?`)) return;
    try {
      await invoke("health_med_delete", { medId: id });
      medications = medications.filter(m => m.id !== id);
    } catch (e) { console.error("health_med_delete failed:", e); }
  }

  // #7 fix: history view toggle on Daily Log page
  let showingHistory = $state(false);

  // #10 fix: global loading state
  let appLoading = $state(true);

  let takenCount   = $derived(medications.filter(m => m.takenToday).length);
  let adherencePct = $derived(medications.length ? Math.round((takenCount / medications.length) * 100) : 0);

  // #6 fix: richer correlation engine — 5 pattern types
  let correlations = $derived.by((): {label:string; positive:boolean; strength:number; note:string}[] => {
    if (weekLogs.length < 3) return [];
    const avg = (arr: number[]) => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;
    const items: {label:string; positive:boolean; strength:number; note:string}[] = [];

    const highSleep = weekLogs.filter(l => l.sleepHours >= 7);
    const lowSleep  = weekLogs.filter(l => l.sleepHours < 7);
    if (highSleep.length && lowSleep.length) {
      const diff = avg(highSleep.map(l => l.energy)) - avg(lowSleep.map(l => l.energy));
      if (Math.abs(diff) > 0.3)
        items.push({ label: "Sleep ≥ 7h → Energy", positive: diff > 0,
          strength: Math.min(98, Math.round(55 + Math.abs(diff) * 12)),
          note: `Energy averages ${avg(highSleep.map(l=>l.energy)).toFixed(1)}/10 on 7h+ nights vs ${avg(lowSleep.map(l=>l.energy)).toFixed(1)}/10 otherwise.` });
    }

    const highWater = weekLogs.filter(l => l.waterGlasses >= 8);
    const lowWater  = weekLogs.filter(l => l.waterGlasses < 8);
    if (highWater.length && lowWater.length) {
      const hwHeadache = highWater.filter(l => l.symptoms.includes("Headache")).length / highWater.length;
      const lwHeadache = lowWater.filter(l => l.symptoms.includes("Headache")).length / lowWater.length;
      if (lwHeadache > hwHeadache)
        items.push({ label: "Water ≥ 8 glasses → Fewer headaches", positive: true,
          strength: Math.min(98, Math.round(60 + (lwHeadache - hwHeadache) * 100)),
          note: `Headache rate: ${Math.round(hwHeadache*100)}% on high-water days vs ${Math.round(lwHeadache*100)}% on low-water days.` });
    }

    const highEnergy = weekLogs.filter(l => l.energy >= 7);
    const lowEnergy  = weekLogs.filter(l => l.energy < 7);
    if (highEnergy.length && lowEnergy.length) {
      const diff = avg(highEnergy.map(l => l.sleepHours)) - avg(lowEnergy.map(l => l.sleepHours));
      if (diff > 0.3)
        items.push({ label: "High energy days → More sleep", positive: true,
          strength: Math.min(98, Math.round(55 + diff * 10)),
          note: `You sleep ${diff.toFixed(1)}h more on average on high-energy days.` });
    }

    const symptomDays = weekLogs.filter(l => l.symptoms.length > 0);
    const clearDays   = weekLogs.filter(l => l.symptoms.length === 0);
    if (symptomDays.length && clearDays.length) {
      const diff = avg(clearDays.map(l => l.energy)) - avg(symptomDays.map(l => l.energy));
      if (diff > 0.5)
        items.push({ label: "Symptom-free days → Higher energy", positive: true,
          strength: Math.min(98, Math.round(55 + diff * 10)),
          note: `Energy is ${diff.toFixed(1)} points higher on days with no symptoms logged.` });
    }

    if (weekLogs.length >= 5) {
      const allSymptoms = weekLogs.flatMap(l => l.symptoms);
      const freq = [...allSymptoms.reduce((m,s) => m.set(s,(m.get(s)||0)+1), new Map<string,number>())];
      if (freq.length) {
        const [topSym, count] = freq.sort((a,b) => b[1]-a[1])[0];
        items.push({ label: `Most common symptom: ${topSym}`, positive: false,
          strength: Math.min(98, Math.round((count / weekLogs.length) * 100)),
          note: `"${topSym}" appeared in ${count} of your last ${weekLogs.length} logs.` });
      }
    }

    return items;
  });

  let weeklyChartData = $derived.by((): {day:string; score:number}[] => {
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const map = new Map(weekLogs.map(l => [new Date(l.loggedAt).toLocaleDateString("en-US",{weekday:"short"}), l]));
    return days.map(day => {
      const l = map.get(day);
      const score = l ? Math.round((l.energy / 10 * 40) + (Math.min(l.sleepHours,9)/9*30) + (Math.min(l.waterGlasses,10)/10*30)) : 0;
      return { day, score };
    });
  });

  // ── Exports ───────────────────────────────────────────────────
  let exportingCsv    = $state(false);
  let exportingPdf    = $state(false);
  let exportingRecap  = $state(false);
  let exportingVitals = $state(false);
  let exportingMedLog = $state(false);

  async function writeExport(filename: string, content: string): Promise<boolean> {
    const dir: string | null = await invoke("pick_export_directory");
    if (!dir) return false;
    // Tauri fs plugin: write to absolute path by passing full path as filename
    await writeTextFile(`${dir}/${filename}`, content);
    return true;
  }

  async function exportCsv(label: string) {
    exportingCsv = true;
    try {
      const rows = weekLogs.map(l =>
        [l.dateKey, l.mood, l.energy, l.waterGlasses, l.sleepHours, l.symptoms.join("|"), l.note ?? ""].join(",")
      );
      const csv = ["date,mood,energy,water_glasses,sleep_hours,symptoms,note", ...rows].join("\n");
      await writeExport(`health-logs-${time.toISODate(time.now())}.csv`, csv);
    } catch (e) { console.error("Export failed", e); }
    finally { exportingCsv = false; }
  }

  async function exportDoctorPdf() {
    exportingPdf = true;
    try {
      const lines = [
        "HEALTH REPORT — " + new Date().toLocaleDateString(),
        "",
        "== VITALS (last 10) ==",
        ...vitalHistory.slice(0,10).map(v =>
          `${v.dateKey}  BP:${v.bp ?? "—"}  HR:${v.hr ?? "—"}  Weight:${v.weight ?? "—"}  Temp:${v.temp ?? "—"}`
        ),
        "",
        "== MEDICATIONS ==",
        ...medications.map(m => `${m.name}  ${m.dose}  @${m.timeOfDay}  ${m.notes}`),
        "",
        "== DAILY LOGS (last 7) ==",
        ...weekLogs.map(l =>
          `${l.dateKey}  Mood:${l.mood}  Energy:${l.energy}/10  Water:${l.waterGlasses}g  Sleep:${l.sleepHours}h  Symptoms:[${l.symptoms.join(",")}]${l.note ? "  Note:"+l.note : ""}`
        ),
      ];
      await writeExport(`health-doctor-report-${time.toISODate(time.now())}.txt`, lines.join("\n"));
    } catch (e) { console.error("Export failed", e); }
    finally { exportingPdf = false; }
  }

  async function exportMonthlyRecap() {
    exportingRecap = true;
    try {
      const avgEnergy = weekLogs.length ? (weekLogs.reduce((a,b) => a+b.energy,0)/weekLogs.length).toFixed(1) : "—";
      const avgSleep  = weekLogs.length ? (weekLogs.reduce((a,b) => a+b.sleepHours,0)/weekLogs.length).toFixed(1) : "—";
      const allSymptoms = weekLogs.flatMap(l => l.symptoms);
      const topSymptom = allSymptoms.length
        ? [...allSymptoms.reduce((m,s) => m.set(s,(m.get(s)||0)+1), new Map())].sort((a,b)=>b[1]-a[1])[0][0]
        : "None";
      const recap = [
        "MONTHLY WELLNESS RECAP",
        `Generated: ${new Date().toLocaleDateString()}`,
        "",
        `Days logged this week: ${weekLogs.length}/7`,
        `Average energy:        ${avgEnergy}/10`,
        `Average sleep:         ${avgSleep}h`,
        `Most common symptom:   ${topSymptom}`,
        `Medications tracked:   ${medications.length}`,
        `Today's adherence:     ${adherencePct}%`,
        "",
        correlations.length ? "Top pattern: " + correlations[0].label : "Log more days to surface patterns.",
      ].join("\n");
      await writeExport(`health-recap-${time.toISODate(time.now())}.txt`, recap);
    } catch (e) { console.error("Export failed", e); }
    finally { exportingRecap = false; }
  }

  async function exportVitalsCsv() {
    exportingVitals = true;
    try {
      const rows = vitalHistory.map(v =>
        [v.dateKey, v.bp ?? "", v.hr ?? "", v.weight ?? "", v.temp ?? "", v.spo2 ?? ""].join(",")
      );
      const csv = ["date,bp,hr,weight,temp,spo2", ...rows].join("\n");
      await writeExport(`health-vitals-${time.toISODate(time.now())}.csv`, csv);
    } catch (e) { console.error("Export failed", e); }
    finally { exportingVitals = false; }
  }

  async function exportMedLog() {
    exportingMedLog = true;
    try {
      const rows = medications.map(m =>
        [m.name, m.dose, m.timeOfDay, m.notes, m.takenToday ? "taken" : "pending"].join(",")
      );
      const csv = ["name,dose,time,notes,status", ...rows].join("\n");
      await writeExport(`health-medications-${time.toISODate(time.now())}.csv`, csv);
    } catch (e) { console.error("Export failed", e); }
    finally { exportingMedLog = false; }
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  onMount(async () => {
    await Promise.all([loadTodayLog(), loadWeekLogs(), loadVitals(), loadMeds()]);
    appLoading = false;
  });
</script>

<main class="hl-workspace module-root" data-module="health">

  {#if appLoading}
    <section class="hl-page hl-loading">
      <div class="hl-loading__orb"></div>
      <p>{_t('moduleHealthLoadingData')}</p>
    </section>

  <!-- ═══════════════════ DASHBOARD ═══════════════════ -->
  {:else if selectedSection === "Dashboard"}
    <section class="hl-page">
      <header class="hl-page__header">
        <div class="hl-page__intro">
          <div class="hl-page__eyebrow"><ActivityIcon size={13}/><span>{_t('moduleHealthHealthTracker')}</span><Badge variant="outline">{_t('moduleHealthSectionDashboard')}</Badge></div>
          <h1>{_t('moduleHealthGoodMorning')}</h1>
          <p>{_t('moduleHealthDashboardDesc')}</p>
        </div>
        <div class="hl-page__actions">
          <Button variant="outline" onclick={() => setModuleSection("health", "Insights", sectionLabels)}><CalendarIcon data-icon="inline-start"/>{_t('moduleHealthWeekView')}</Button>
          <Button onclick={() => alert(weekLogs.length < 3 ? _t('moduleHealthLog3Checkins') : `Week summary:\n• ${weekLogs.length} days logged\n• Avg energy: ${(weekLogs.reduce((a,b)=>a+b.energy,0)/weekLogs.length).toFixed(1)}/10\n• Avg sleep: ${(weekLogs.reduce((a,b)=>a+b.sleepHours,0)/weekLogs.length).toFixed(1)}h\n• ${correlations.length} pattern(s) detected`)}><SparklesIcon data-icon="inline-start"/>{_t('moduleHealthAISummary')}</Button>
        </div>
      </header>

      <section class="hl-hero-grid">          <Card class="hl-score-card">
            <CardHeader><CardTitle>{_t('moduleHealthToday')}</CardTitle><CardDescription>{today}</CardDescription></CardHeader>
            <CardContent class="hl-score-card__content">
              <div class="hl-score-orb">
                <strong>{todayLog ? Math.round((todayLog.energy/10*40)+(Math.min(todayLog.sleepHours,9)/9*30)+(Math.min(todayLog.waterGlasses,10)/10*30)) : "--"}</strong>
                <small>{_t('moduleHealthWellness')}</small>
              </div>
              <div class="hl-score-meta">
                <div><FlameIcon size={12}/><strong>{weekLogs.length}</strong><span>{_t('moduleHealthDaysLogged')}</span></div>
                <div><DropletIcon size={12}/><strong>{todayLog ? (todayLog.waterGlasses*0.25).toFixed(1)+"L" : "--"}</strong><span>{_t('moduleHealthWaterToday')}</span></div>
                <div><MoonIcon size={12}/><strong>{todayLog ? todayLog?.sleepHours+"h" : "--"}</strong><span>{_t('moduleHealthLastNight')}</span></div>
                <div><ZapIcon size={12}/><strong>{todayLog ? todayLog?.energy+"/10" : "--"}</strong><span>{_t('moduleHealthEnergy')}</span></div>
              </div>
            </CardContent>
          </Card>          <Card class="hl-hero-card">
            <CardHeader><CardTitle>{_t('moduleHealthDailySnapshot')}</CardTitle><CardDescription>{_t('moduleHealthDailySnapshotDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-hero-list">
              {#if todayLog}
                <article><span>{_t('moduleHealthEnergy')}</span><div class="hl-hero-bar"><i style="--fill:{todayLog?.energy*10}%"></i></div><strong>{todayLog?.energy} / 10</strong></article>
                <article><span>{_t('moduleHealthWater')}</span><div class="hl-hero-bar"><i style="--fill:{Math.min(todayLog?.waterGlasses/10,1)*100}%"></i></div><strong>{(todayLog.waterGlasses*0.25).toFixed(1)} L</strong></article>
                <article><span>{_t('moduleHealthSleep')}</span><div class="hl-hero-bar"><i style="--fill:{Math.min(todayLog?.sleepHours/9,1)*100}%"></i></div><strong>{todayLog?.sleepHours}h</strong></article>
                <article><span>{_t('moduleHealthMood')}</span><div class="hl-hero-bar"><i style="--fill:{["low","okay","steady","good","great"].indexOf(todayLog?.mood)/4*100}%"></i></div><strong>{_t('moduleHealthMood' + (todayLog?.mood ? todayLog.mood.charAt(0).toUpperCase() + todayLog.mood.slice(1) : ''))}</strong></article>
              {:else}
                <p class="hl-muted hl-muted--center">{_t('moduleHealthNoCheckinYet')}</p>
              {/if}
            </CardContent>
          </Card>
      </section>

      <section class="hl-body">
        <div class="hl-grid hl-grid--2col">
          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthTodaysEntries')}</CardTitle><CardDescription>{_t('moduleHealthTodaysEntriesDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-timeline">
              {#if todayLog}
                <article class="hl-timeline__item">
                  <span class="hl-timeline__time">{new Date(todayLog.loggedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                  <div class="hl-timeline__dot hl-dot--mood"></div>
                  <div class="hl-timeline__copy"><strong>{_t('moduleHealthDailyCheckin')}</strong><p>{_t('moduleHealthMood')}: {todayLog?.mood} · {_t('moduleHealthEnergy')}: {todayLog.energy}/10 · {_t('moduleHealthWater')}: {todayLog.waterGlasses} glasses · {_t('moduleHealthSleep')}: {todayLog?.sleepHours}h</p></div>
                </article>
                {#if todayLog.symptoms.length > 0}
                  <article class="hl-timeline__item">
                    <span class="hl-timeline__time">--</span>
                    <div class="hl-timeline__dot hl-dot--symptom"></div>
                    <div class="hl-timeline__copy"><strong>{_t('moduleHealthSymptoms')}</strong><p>{todayLog.symptoms.join(", ")}</p></div>
                  </article>
                {/if}
                {#if todayLog.note}
                  <article class="hl-timeline__item">
                    <span class="hl-timeline__time">--</span>
                    <div class="hl-timeline__dot hl-dot--water"></div>
                    <div class="hl-timeline__copy"><strong>{_t('moduleHealthNote')}</strong><p>{todayLog.note}</p></div>
                  </article>
                {/if}
              {:else}
                <p class="hl-muted hl-muted--center">{_t('moduleHealthNothingLogged')}</p>
              {/if}
              {#each medications.filter(m => m.takenToday) as med}
                <article class="hl-timeline__item">
                  <span class="hl-timeline__time">{med.timeOfDay}</span>
                  <div class="hl-timeline__dot hl-dot--med"></div>
                  <div class="hl-timeline__copy"><strong>{med.name} {_t('moduleHealthTaken')}</strong><p>{med.dose} · {med.notes}</p></div>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthWeeklyWellness')}</CardTitle><CardDescription>{_t('moduleHealthWeeklyWellnessDesc').replace('{count}', String(weekLogs.length))}</CardDescription></CardHeader>
            <CardContent class="hl-bar-chart">
              {#each weeklyChartData as item}
                <article>
                  <span>{item.day}</span>
                  <i style="--bar:{item.score}%"></i>
                  <strong>{item.score || "--"}</strong>
                </article>
              {/each}
            </CardContent>
          </Card>
        </div>
      </section>
    </section>


  <!-- ═══════════════════ DAILY LOG ═══════════════════ -->
  {:else if selectedSection === "Daily Log"}
    <section class="hl-page">
      <header class="hl-page__header">
        <div class="hl-page__intro">
          <div class="hl-page__eyebrow"><ZapIcon size={13}/><span>{_t('moduleHealthHealthTracker')}</span><Badge variant="outline">{_t('moduleHealthSectionDailyLog')}</Badge></div>
          <h1>{_t('moduleHealthDailyLogDesc')}</h1>
          <p>{_t('moduleHealthDailyLogSavedDesc')}</p>
        </div>
        <div class="hl-page__actions">
          <Button variant="outline" onclick={() => (showingHistory = !showingHistory)}><CalendarIcon data-icon="inline-start"/>{showingHistory ? _t('moduleHealthHideHistory') : _t('moduleHealthViewHistory')}</Button>
          <Button onclick={saveLog} disabled={logSaving}>
            {#if logSaving}<Loader2Icon data-icon="inline-start" class="hl-spin"/>{_t('moduleHealthSaving')}
            {:else if logSaved}<CheckIcon data-icon="inline-start"/>{_t('moduleHealthSaved')}
            {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleHealthSaveCheckin')}{/if}
          </Button>
        </div>
      </header>

      <section class="hl-hero-grid">
        <Card class="hl-score-card">
          <CardHeader><CardTitle>{_t('moduleHealthTodaySoFar')}</CardTitle><CardDescription>{today}</CardDescription></CardHeader>
          <CardContent class="hl-score-card__content">
            <div class="hl-score-orb hl-score-orb--ring">
              <strong>{selectedEnergy}</strong><small>{_t('moduleHealthEnergy')}</small>
            </div>
            <div class="hl-score-meta">
              <div><span>{_t('moduleHealthMood')}</span><strong>{moodOptions.find(m=>m.id===selectedMood)?.emoji} {_t('moduleHealthMood' + (selectedMood ? selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1) : ''))}</strong></div>
              <div><DropletIcon size={12}/><strong>{waterGlasses} {_t('moduleHealthWater')}</strong><span>{(waterGlasses*0.25).toFixed(2)} L</span></div>
              <div><MoonIcon size={12}/><strong>{sleepHours}h {_t('moduleHealthSleep')}</strong><span>{_t('moduleHealthLastNight')}</span></div>
              <div><span>{_t('moduleHealthSymptoms')}</span><strong>{selectedSymptoms.length} {_t('moduleHealthDaysLogged')}</strong></div>
            </div>
          </CardContent>
        </Card>

        <Card class="hl-hero-card">
          <CardHeader><CardTitle>{_t('moduleHealthLastSaved')}</CardTitle><CardDescription>{todayLog ? _t('moduleHealthLoadedDb') : _t('moduleHealthNoCheckinToday')}</CardDescription></CardHeader>
          <CardContent class="hl-hero-list">
            {#if todayLog}
              <article><span>{_t('moduleHealthEnergy')}</span><div class="hl-hero-bar"><i style="--fill:{todayLog?.energy*10}%"></i></div><strong>{todayLog?.energy} / 10</strong></article>
              <article><span>{_t('moduleHealthWater')}</span><div class="hl-hero-bar"><i style="--fill:{Math.min(todayLog?.waterGlasses/10,1)*100}%"></i></div><strong>{(todayLog.waterGlasses*0.25).toFixed(2)} L</strong></article>
              <article><span>{_t('moduleHealthSleep')}</span><div class="hl-hero-bar"><i style="--fill:{Math.min(todayLog?.sleepHours/9,1)*100}%"></i></div><strong>{todayLog?.sleepHours}h</strong></article>
              <article><span>{_t('moduleHealthMood')}</span><div class="hl-hero-bar"><i style="--fill:{["low","okay","steady","good","great"].indexOf(todayLog?.mood)/4*100}%"></i></div><strong>{_t('moduleHealthMood' + (todayLog?.mood ? todayLog.mood.charAt(0).toUpperCase() + todayLog.mood.slice(1) : ''))}</strong></article>
            {:else}
              <p class="hl-muted hl-muted--center">{_t('moduleHealthFillForm')}</p>
            {/if}
          </CardContent>
        </Card>
      </section>

      <section class="hl-body">
        <div class="hl-grid hl-grid--2col">
          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthCheckinForm')}</CardTitle><CardDescription>{_t('moduleHealthCheckinFormDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-log-form">
              {#if logError}<p class="hl-error">{logError}</p>{/if}

              <div class="hl-log-block">
                <p class="hl-label">{_t('moduleHealthMoodRightNow')}</p>
                <div class="hl-mood-picker">
                  {#each moodOptions as m}
                    <button class="hl-mood-btn" class:hl-mood-btn--active={selectedMood===m.id}
                      type="button" onclick={()=>(selectedMood=m.id)}>
                      <span>{m.emoji}</span><small>{_t('moduleHealthMood' + (m.id.charAt(0).toUpperCase() + m.id.slice(1)))}</small>
                    </button>
                  {/each}
                </div>
              </div>

              <div class="hl-log-block">
                <p class="hl-label">{_t('moduleHealthEnergy')} — {selectedEnergy} / 10</p>
                <div class="hl-energy-row">
                  {#each [1,2,3,4,5,6,7,8,9,10] as lvl}
                    <button class="hl-energy-btn" class:hl-energy-btn--active={selectedEnergy===lvl}
                      type="button" onclick={()=>(selectedEnergy=lvl)}>{lvl}</button>
                  {/each}
                </div>
              </div>

              <div class="hl-log-row">
                <div class="hl-log-block">
                  <p class="hl-label">{_t('moduleHealthWater')} {_t('moduleHealthWater')}</p>
                  <div class="hl-stepper">
                    <button type="button" onclick={()=>(waterGlasses=Math.max(0,waterGlasses-1))}>−</button>
                    <strong>{waterGlasses} <small class="hl-muted">({(waterGlasses*0.25).toFixed(2)} L)</small></strong>
                    <button type="button" onclick={()=>(waterGlasses+=1)}>+</button>
                  </div>
                </div>
                <div class="hl-log-block">
                  <p class="hl-label">{_t('moduleHealthSleepLastNight')}</p>
                  <div class="hl-stepper">
                    <button type="button" onclick={()=>(sleepHours=Math.max(0,sleepHours-1))}>−</button>
                    <strong>{sleepHours}h <small class="hl-muted">{_t('moduleHealthTarget79')}</small></strong>
                    <button type="button" onclick={()=>(sleepHours+=1)}>+</button>
                  </div>
                </div>
              </div>

              <div class="hl-log-block">
                <p class="hl-label">{_t('moduleHealthQuickNote')} <small class="hl-muted">{_t('moduleHealthOptional')}</small></p>
                <Input bind:value={logNote} placeholder={_t('moduleHealthPlaceholderNote')}/>
              </div>
            </CardContent>
          </Card>

          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthSymptomsToday')}</CardTitle><CardDescription>{_t('moduleHealthSymptomsDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-symptoms-panel">
              <div class="hl-symptom-grid">
                {#each symptomOptions as s}
                  <button class="hl-symptom-btn" class:hl-symptom-btn--active={selectedSymptoms.includes(s)}
                    type="button" onclick={()=>toggleSymptom(s)}>{s}</button>
                {/each}
              </div>
              {#if selectedSymptoms.length > 0}
                <div class="hl-symptom-tagged">
                  <p class="hl-muted">{_t('moduleHealthSavedWithCheckin')}</p>
                  <div class="hl-chip-row">
                    {#each selectedSymptoms as s}<Badge variant="secondary">{s}</Badge>{/each}
                  </div>
                </div>
              {:else}
                <p class="hl-muted hl-muted--center">{_t('moduleHealthNothingFlagged')}</p>
              {/if}
            </CardContent>
          </Card>
        </div>

        {#if showingHistory && weekLogs.length > 0}
          <Card class="hl-panel hl-panel--full-row hl-history-panel">
            <CardHeader><CardTitle>{_t('moduleHealthRecentCheckins')}</CardTitle><CardDescription>{_t('moduleHealthRecentCheckinsDesc').replace('{count}', String(weekLogs.length))}</CardDescription></CardHeader>
            <CardContent class="hl-vitals-table">
              <div class="hl-table-head" style="grid-template-columns:100px 80px 70px 80px 70px 1fr">
                <span>{_t('moduleHealthDate')}</span><span>{_t('moduleHealthMood')}</span><span>{_t('moduleHealthEnergy')}</span><span>{_t('moduleHealthWater')}</span><span>{_t('moduleHealthSleep')}</span><span>{_t('moduleHealthSymptoms')}</span>
              </div>
              {#each weekLogs as l}
                <div class="hl-table-row" style="grid-template-columns:100px 80px 70px 80px 70px 1fr">
                  <span>{l.dateKey}</span>
                  <span>{moodOptions.find(m=>m.id===l.mood)?.emoji} {l.mood}</span>
                  <span>{l.energy}/10</span>
                  <span>{(l.waterGlasses*0.25).toFixed(1)}L</span>
                  <span>{l.sleepHours}h</span>
                  <span>{l.symptoms.length ? l.symptoms.join(", ") : "—"}</span>
                </div>
              {/each}
            </CardContent>
          </Card>
        {/if}
      </section>
    </section>


  <!-- ═══════════════════ VITALS ═══════════════════ -->
  {:else if selectedSection === "Vitals"}
    <section class="hl-page">
      <header class="hl-page__header">
        <div class="hl-page__intro">
          <div class="hl-page__eyebrow"><HeartPulseIcon size={13}/><span>{_t('moduleHealthHealthTracker')}</span><Badge variant="outline">{_t('moduleHealthSectionVitals')}</Badge></div>
          <h1>{_t('moduleHealthVitalsBodyDesc')}</h1>
          <p>{_t('moduleHealthVitalsPageDesc')}</p>
        </div>
        <div class="hl-page__actions">
          <Button variant="outline" onclick={exportVitalsCsv} disabled={exportingVitals}>
            <DownloadIcon data-icon="inline-start"/>{exportingVitals ? _t('moduleHealthExporting') : _t('moduleHealthExportCSV')}
          </Button>
          <Button onclick={saveVitals} disabled={vitalSaving}>
            {#if vitalSaving}<Loader2Icon data-icon="inline-start" class="hl-spin"/>{_t('moduleHealthSaving')}
            {:else if vitalSaved}<CheckIcon data-icon="inline-start"/>{_t('moduleHealthSaved')}
            {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleHealthLogVitals')}{/if}
          </Button>
        </div>
      </header>

      <section class="hl-hero-grid">
        <Card class="hl-score-card">
          <CardHeader><CardTitle>{_t('moduleHealthLatestReading')}</CardTitle><CardDescription>{vitalHistory[0] ? vitalHistory[0].dateKey : _t('moduleHealthNoReadingsYet')}</CardDescription></CardHeader>
          <CardContent class="hl-score-card__content">
            <div class="hl-score-orb hl-orb--bp">
              <strong>{vitalHistory[0]?.bp?.split("/")[0] ?? "--"}</strong>
              <small>{vitalHistory[0]?.bp ? "/"+vitalHistory[0].bp.split("/")[1]+" mmHg" : "mmHg"}</small>
            </div>
            <div class="hl-score-meta">
              <div><HeartPulseIcon size={12}/><strong>{vitalHistory[0]?.hr ?? "--"}</strong><span>{_t('moduleHealthHeartRate')}</span></div>
              <div><ScaleIcon size={12}/><strong>{vitalHistory[0]?.weight ?? "--"}</strong><span>{_t('moduleHealthWeight')}</span></div>
              <div><ThermometerIcon size={12}/><strong>{vitalHistory[0]?.temp ?? "--"}</strong><span>{_t('moduleHealthTemperature')}</span></div>
              <div><ActivityIcon size={12}/><strong>{vitalHistory[0]?.spo2 ?? "--"}</strong><span>SpO₂</span></div>
            </div>
          </CardContent>
        </Card>

        <Card class="hl-hero-card">
          <CardHeader><CardTitle>{_t('moduleHealthLogNewReading')}</CardTitle><CardDescription>{_t('moduleHealthAllFieldsOptional')}</CardDescription></CardHeader>
          <CardContent class="hl-vitals-form">
            {#if vitalError}<p class="hl-error">{vitalError}</p>{/if}
            <div class="hl-vital-row">
              <div class="hl-vital-field">
                <p class="hl-label"><HeartPulseIcon size={12}/>{_t('moduleHealthBloodPressure')}</p>
                <Input bind:value={newBP} placeholder={_t('moduleHealthPlaceholderBP')}/>
              </div>
              <div class="hl-vital-field">
                <p class="hl-label"><ActivityIcon size={12}/>{_t('moduleHealthHeartRate')}</p>
                <Input bind:value={newHR} placeholder={_t('moduleHealthPlaceholderHR')}/>
              </div>
            </div>
            <div class="hl-vital-row">
              <div class="hl-vital-field">
                <p class="hl-label"><ScaleIcon size={12}/>{_t('moduleHealthWeight')}</p>
                <Input bind:value={newWeight} placeholder={_t('moduleHealthPlaceholderWeight')}/>
              </div>
              <div class="hl-vital-field">
                <p class="hl-label"><ThermometerIcon size={12}/>{_t('moduleHealthTemperature')}</p>
                <Input bind:value={newTemp} placeholder={_t('moduleHealthPlaceholderTemp')}/>
              </div>
            </div>
            <div class="hl-vital-row">
              <div class="hl-vital-field">
                <p class="hl-label"><ActivityIcon size={12}/>SpO₂</p>
                <Input bind:value={newSpo2} placeholder={_t('moduleHealthPlaceholderSpo2')}/>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section class="hl-body">
        <div class="hl-grid hl-grid--vitals">
          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthBPTrend')}</CardTitle><CardDescription>{_t('moduleHealthBPTrendDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-bp-chart">
              {#each bpChartData as item}
                <article>
                  <span>{item.label}</span>
                  <div class="hl-bp-col">
                    {#if item.sys}
                      <i class="hl-bp-sys" style="--h:{Math.round(((item.sys-100)/60)*100)}%"></i>
                      <i class="hl-bp-dia" style="--h:{Math.round(((item.dia??70)-60)/60*100)}%"></i>
                    {:else}
                      <i class="hl-bp-sys" style="--h:4px;opacity:0.2"></i>
                    {/if}
                  </div>
                  <small>{item.sys ?? "--"}</small>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="hl-panel hl-panel--full-row">
            <CardHeader><CardTitle>{_t('moduleHealthVitalsHistory')}</CardTitle><CardDescription>{_t('moduleHealthVitalsHistoryDesc').replace('{count}', String(vitalHistory.length))}</CardDescription></CardHeader>
            <CardContent class="hl-vitals-table">
              <div class="hl-table-head">
                <span>{_t('moduleHealthDate')}</span><span>{_t('moduleHealthBloodPressure')}</span><span>{_t('moduleHealthHeartRate')}</span>
                <span>{_t('moduleHealthWeight')}</span><span>{_t('moduleHealthTemperature')}</span><span>SpO₂</span>
              </div>
              {#each vitalHistory.slice(0,10) as row}
                <div class="hl-table-row">
                  <span>{row.dateKey}</span>
                  <span>{row.bp ?? "—"}</span>
                  <span>{row.hr ?? "—"}</span>
                  <span>{row.weight ?? "—"}</span>
                  <span>{row.temp ?? "—"}</span>
                  <span>{row.spo2 ?? "—"}</span>
                </div>
              {/each}
              {#if vitalHistory.length === 0}
                <p class="hl-muted hl-muted--center">{_t('moduleHealthNoVitalsLogged')}</p>
              {/if}
            </CardContent>
          </Card>
        </div>
      </section>
    </section>


  <!-- ═══════════════════ INSIGHTS ═══════════════════ -->
  {:else if selectedSection === "Insights"}
    <section class="hl-page">
      <header class="hl-page__header">
        <div class="hl-page__intro">
          <div class="hl-page__eyebrow"><TrendingUpIcon size={13}/><span>{_t('moduleHealthHealthTracker')}</span><Badge variant="outline">{_t('moduleHealthSectionInsights')}</Badge></div>
          <h1>{_t('moduleHealthPatternsPageDesc')}</h1>
          <p>{_t('moduleHealthInsightsPageDesc')}</p>
        </div>
        <div class="hl-page__actions">
          <Button variant="outline" onclick={() => exportCsv(_t('moduleHealthExportReport'))} disabled={exportingCsv}>
            <DownloadIcon data-icon="inline-start"/>{exportingCsv ? _t('moduleHealthExporting') : _t('moduleHealthExportReport')}
          </Button>
          <Button><SparklesIcon data-icon="inline-start"/>{_t('moduleHealthAIRecap')}</Button>
        </div>
      </header>

      <section class="hl-hero-grid">
        <Card class="hl-score-card">
          <CardHeader><CardTitle>{_t('moduleHealthThisWeek')}</CardTitle><CardDescription>{_t('moduleHealthOf7Days').replace('{count}', String(weekLogs.length))}</CardDescription></CardHeader>
          <CardContent class="hl-score-card__content">
            <div class="hl-score-orb">
              <strong>{weeklyChartData.length ? Math.round(weeklyChartData.filter(d=>d.score>0).reduce((a,b)=>a+b.score,0)/(weeklyChartData.filter(d=>d.score>0).length||1)) : "--"}</strong>
              <small>{_t('moduleHealthAvgScore')}</small>
            </div>
            <div class="hl-score-meta">
              <div><strong>{weekLogs.length}</strong><span>{_t('moduleHealthDaysLogged')}</span></div>
              <div><strong>{weekLogs.length ? (weekLogs.reduce((a,b)=>a+b.energy,0)/weekLogs.length).toFixed(1) : "--"}</strong><span>{_t('moduleHealthAvgEnergy')}</span></div>
              <div><strong>{weekLogs.length ? (weekLogs.reduce((a,b)=>a+b.sleepHours,0)/weekLogs.length).toFixed(1)+"h" : "--"}</strong><span>{_t('moduleHealthAvgSleep')}</span></div>
              <div><strong>{correlations.length}</strong><span>{_t('moduleHealthPatternsFound')}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card class="hl-hero-card">
          <CardHeader><CardTitle>{_t('moduleHealthSignalStrength')}</CardTitle><CardDescription>{_t('moduleHealthSignalStrengthDesc')}</CardDescription></CardHeader>
          <CardContent class="hl-hero-list">
            {#if correlations.length > 0}
              {#each correlations.slice(0,4) as c}
                <article>
                  <span>{c.label}</span>
                  <div class="hl-hero-bar"><i style="--fill:{c.strength}%"></i></div>
                  <strong>{c.strength}%</strong>
                </article>
              {/each}
            {:else}
              <p class="hl-muted hl-muted--center">{_t('moduleHealthLog3Checkins')}</p>
            {/if}
          </CardContent>
        </Card>
      </section>

      <section class="hl-body">
        <div class="hl-grid hl-grid--2col">
          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthPatternCorrelations')}</CardTitle><CardDescription>{_t('moduleHealthPatternCorrelationsDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-correlations">
              {#if correlations.length > 0}
                {#each correlations as c}
                  <article class="hl-correlation">
                    <div class="hl-correlation__top">
                      <strong>{c.label}</strong>
                      <Badge variant={c.positive ? "default" : "secondary"}>{c.positive ? _t('moduleHealthPositive') : _t('moduleHealthNegative')}</Badge>
                    </div>
                    <p>{c.note}</p>
                    <div class="hl-meter"><i style="--fill:{c.strength}%"></i></div>
                    <small class="hl-muted">{_t('moduleHealthSignalStrengthLabel').replace('{pct}', String(c.strength))}</small>
                  </article>
                {/each}
              {:else}
                <p class="hl-muted hl-muted--center">{_t('moduleHealthKeepLogging')}</p>
              {/if}
            </CardContent>
          </Card>

          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthWeeklyScores')}</CardTitle><CardDescription>{_t('moduleHealthWeeklyScoresDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-bar-chart">
              {#each weeklyChartData as item}
                <article>
                  <span>{item.day}</span>
                  <i style="--bar:{item.score}%"></i>
                  <strong>{item.score || "--"}</strong>
                </article>
              {/each}
            </CardContent>
          </Card>

          <Card class="hl-panel hl-panel--full-row">
            <CardHeader><CardTitle>{_t('moduleHealthExportData')}</CardTitle><CardDescription>{_t('moduleHealthExportDataDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-export-list">
              {#each [
                {label:_t('moduleHealthDoctorPDF'),   detail:_t('moduleHealthDoctorPDFDetail'), fn: exportDoctorPdf,    busy: exportingPdf},
                {label:_t('moduleHealthCSVTimeline'), detail:_t('moduleHealthCSVTimelineDetail'), fn: () => exportCsv(_t('moduleHealthCSVTimeline')), busy: exportingCsv},
                {label:_t('moduleHealthMonthlyRecap'),detail:_t('moduleHealthMonthlyRecapDetail'), fn: exportMonthlyRecap, busy: exportingRecap},
              ] as opt}
                <article class="hl-export__item">
                  <div><strong>{opt.label}</strong><p>{opt.detail}</p></div>
                  <Button variant="outline" onclick={opt.fn} disabled={opt.busy}>
                    <DownloadIcon data-icon="inline-start"/>{opt.busy ? _t('moduleHealthExporting') : _t('moduleHealthExport')}
                  </Button>
                </article>
              {/each}
            </CardContent>
          </Card>
        </div>
      </section>
    </section>


  <!-- ═══════════════════ MEDICATIONS ═══════════════════ -->
  {:else if selectedSection === "Medications"}
    <section class="hl-page">
      <header class="hl-page__header">
        <div class="hl-page__intro">
          <div class="hl-page__eyebrow"><PillIcon size={13}/><span>{_t('moduleHealthHealthTracker')}</span><Badge variant="outline">{_t('moduleHealthSectionMedications')}</Badge></div>
          <h1>{_t('moduleHealthMedsPageDesc')}</h1>
          <p>{_t('moduleHealthMedsSubtitle')}</p>
        </div>
        <div class="hl-page__actions">
          <Button variant="outline" onclick={exportMedLog} disabled={exportingMedLog}>
            <DownloadIcon data-icon="inline-start"/>{exportingMedLog ? _t('moduleHealthExporting') : _t('moduleHealthExportLog')}
          </Button>
          <Button onclick={addMed} disabled={medAdding}>
            {#if medAdding}<Loader2Icon data-icon="inline-start" class="hl-spin"/>{_t('moduleHealthAdding')}
            {:else if medAdded}<CheckIcon data-icon="inline-start"/>{_t('moduleHealthAdded')}
            {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleHealthAddMedication')}{/if}
          </Button>
        </div>
      </header>

      <section class="hl-hero-grid">
          <Card class="hl-score-card">
          <CardHeader><CardTitle>{_t('moduleHealthTodaysAdherence')}</CardTitle><CardDescription>{today}</CardDescription></CardHeader>
          <CardContent class="hl-score-card__content">
            <div class="hl-score-orb">
              <PremiumRing
                size={156}
                thickness={12}
                gap={8}
                segments={[
                  { value: takenCount, color: "var(--hl-accent)", label: "Taken" },
                  { value: Math.max(medications.length - takenCount, 0), color: "color-mix(in srgb, var(--hl-border) 82%, transparent)", label: "Left" },
                ]}
                centerLabel={_t('moduleHealthTodaysAdherence')}
                centerValue={`${adherencePct}%`}
                centerNote="confirmed"
                showLegend
              />
            </div>              <div class="hl-score-meta">
              <div><PillIcon size={12}/><strong>{takenCount} {_t('moduleHealthTaken')}</strong><span>{_t('moduleHealthOf')} {medications.length} {_t('moduleHealthDoses')}</span></div>
              <div><strong>{medications.length - takenCount} {_t('moduleHealthLeft')}</strong><span>{_t('moduleHealthStillPending')}</span></div>
              <div><strong>{medications.length}</strong><span>{_t('moduleHealthTotalMeds')}</span></div>
              <div><strong>{adherencePct}%</strong><span>{_t('moduleHealthTodaysRate')}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card class="hl-hero-card">
          <CardHeader><CardTitle>{_t('moduleHealthAddNewMed')}</CardTitle><CardDescription>{_t('moduleHealthAddNewMedDesc')}</CardDescription></CardHeader>
          <CardContent class="hl-add-med">
            {#if medError}<p class="hl-error">{medError}</p>{/if}
            <div class="hl-vital-row">
              <div class="hl-vital-field">
                <p class="hl-label">{_t('moduleHealthName')}</p>
                <Input bind:value={newMedName} placeholder={_t('moduleHealthPlaceholderMedName')}/>
              </div>
              <div class="hl-vital-field">
                <p class="hl-label">{_t('moduleHealthDose')}</p>
                <Input bind:value={newMedDose} placeholder={_t('moduleHealthPlaceholderMedDose')}/>
              </div>
            </div>
            <div class="hl-vital-row">
              <div class="hl-vital-field">
                <p class="hl-label">{_t('moduleHealthTime')}</p>
                <Input bind:value={newMedTime} placeholder={_t('moduleHealthPlaceholderMedTime')}/>
              </div>
              <div class="hl-vital-field">
                <p class="hl-label">{_t('moduleHealthNotes')}</p>
                <Input bind:value={newMedNotes} placeholder={_t('moduleHealthPlaceholderMedNotes')}/>
              </div>
            </div>
            <Button onclick={addMed} disabled={medAdding}>
              {#if medAdding}<Loader2Icon data-icon="inline-start" class="hl-spin"/>{_t('moduleHealthAdding')}
              {:else if medAdded}<CheckIcon data-icon="inline-start"/>{_t('moduleHealthAdded')}
              {:else}<PlusIcon data-icon="inline-start"/>{_t('moduleHealthAddMedication')}{/if}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section class="hl-body">
        <div class="hl-grid hl-grid--2col">
          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthTodaysMeds')}</CardTitle><CardDescription>{_t('moduleHealthTodaysMedsDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-med-list">
              {#if medLoading}
                <p class="hl-muted hl-muted--center">{_t('commonLoading')}…</p>
              {:else if medications.length === 0}
                <p class="hl-muted hl-muted--center">{_t('moduleHealthNoMedsYet')}</p>
              {:else}
                {#each medications as med (med.id)}
                  <article class="hl-med__item" class:hl-med--taken={med.takenToday}>
                    <button class="hl-med__check" class:hl-med__check--done={med.takenToday}
                      type="button" onclick={()=>toggleMed(med.id)} aria-label={_t('moduleHealthToggleLabel').replace('{name}', med.name)}>
                      {#if med.takenToday}<CheckIcon size={13}/>{/if}
                    </button>
                    <div class="hl-med__copy">
                      <strong>{med.name}</strong>
                      <p>{med.dose} · {med.notes || med.timeOfDay}</p>
                    </div>
                    <div class="hl-med__right">
                      <Badge variant="outline">{med.timeOfDay}</Badge>
                      <button class="hl-med__delete" type="button" onclick={()=>deleteMed(med.id, med.name)} aria-label={_t('moduleHealthRemoveLabel').replace('{name}', med.name)}>×</button>
                    </div>
                  </article>
                {/each}
              {/if}
            </CardContent>
          </Card>

          <Card class="hl-panel">
            <CardHeader><CardTitle>{_t('moduleHealthAdherenceOverview')}</CardTitle><CardDescription>{_t('moduleHealthAdherenceOverviewDesc')}</CardDescription></CardHeader>
            <CardContent class="hl-adherence">
              <div class="hl-adherence__today">
                <div class="hl-adherence__orb hl-adherence__orb--ring">
                  <PremiumRing
                    size={148}
                    thickness={12}
                    gap={8}
                    segments={[
                      { value: takenCount, color: "var(--hl-accent)", label: _t('moduleHealthTaken') },
                      { value: Math.max(medications.length - takenCount, 0), color: "color-mix(in srgb, var(--hl-border) 82%, transparent)", label: _t('moduleHealthLeft') },
                    ]}
                    centerLabel={_t('moduleHealthTodayLabel')}
                    centerValue={`${adherencePct}%`}
                    centerNote={_t('moduleHealthDosesConfirmed')}
                    showLegend
                  />
                </div>
                <div class="hl-adherence__meta">
                  <strong>{takenCount} {_t('moduleHealthOf')} {medications.length}</strong>
                  <span class="hl-muted">{_t('moduleHealthDosesConfirmed')}</span>
                  <span class="hl-muted">{medications.length - takenCount} {_t('moduleHealthRemaining')}</span>
                </div>
              </div>
              <div class="hl-adherence__breakdown">
                {#each medications as med (med.id)}
                  <article class="hl-adherence__row">
                    <span>{med.name}</span>
                    <div class="hl-meter hl-meter--wide">
                      <i style="--fill:{med.takenToday ? 100 : 0}%"></i>
                    </div>
                    <strong class:hl-taken={med.takenToday}>{med.takenToday ? _t('moduleHealthDone') : _t('moduleHealthPending')}</strong>
                  </article>
                {/each}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </section>
  {/if}
</main>

<style>
  :global(.hl-workspace) {
    --hl-bg:             var(--background);
    --hl-surface:        color-mix(in srgb, var(--surface) 96%, var(--background));
    --hl-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --hl-border:         color-mix(in srgb, var(--border) 86%, transparent);
    --hl-ink:            var(--foreground);
    --hl-muted:          var(--muted);
    --hl-accent:         var(--primary);
    height:     100%;
    background: var(--hl-bg);
    color:      var(--hl-ink);
    overflow:   hidden;
    font-family: var(--font-body);
    box-sizing: border-box;
  }

  :global(.hl-page) {
    display:             grid;
    grid-template-rows:  auto auto minmax(0, 1fr);
    gap:                 18px;
    height:              100%;
    min-height:          0;
    padding:             28px 30px;
    box-sizing:          border-box;
    overflow:            hidden;
  }

  /* Header */
  :global(.hl-page__header) {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
  }
  :global(.hl-page__intro) { max-width: 56rem; }
  :global(.hl-page__eyebrow) {
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
    color: var(--hl-muted); font-size: 0.82rem; letter-spacing: 0.18em; text-transform: uppercase;
  }
  :global(.hl-page__intro) h1 { margin: 0; font-size: clamp(1.7rem,2.5vw,2.6rem); line-height: 1.05; }
  :global(.hl-page__intro) p  { margin: 12px 0 0; max-width: 42rem; color: var(--hl-muted); font-size: 0.97rem; line-height: 1.55; }
  :global(.hl-page__actions) { display: flex; gap: 12px; flex-shrink: 0; }

  /* Hero grid */
  :global(.hl-hero-grid) {
    display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; min-height: 0;
  }

  :global(.hl-score-card),
  :global(.hl-hero-card),
  :global(.hl-panel) {
    border-color: var(--hl-border);
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--hl-surface) 98%, var(--hl-bg)),
      color-mix(in srgb, var(--hl-surface) 86%, var(--hl-bg)));
  }

  :global(.hl-score-card__content) {
    display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center;
  }

  :global(.hl-score-orb) {
    display: grid; place-items: center; width: 120px; aspect-ratio: 1;
    border-radius: 999px; flex-shrink: 0;
    background: conic-gradient(var(--hl-accent) 78%, color-mix(in srgb, var(--hl-border) 80%, transparent) 0);
  }
  :global(.hl-score-orb--ring) {
    width: 156px;
    background: transparent;
    overflow: visible;
  }
  :global(.hl-orb--bp) {
    background: conic-gradient(var(--hl-accent) 63%, color-mix(in srgb, var(--hl-border) 80%, transparent) 0);
  }
  :global(.hl-score-orb) strong { font-size: 2.2rem; line-height: 1; }
  :global(.hl-score-orb) small  { color: var(--hl-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

  :global(.hl-score-meta) { display: grid; grid-template-columns: repeat(2,1fr); gap: 9px; }
  :global(.hl-score-meta) > div {
    display: flex; flex-direction: column; gap: 2px; padding: 10px 12px;
    border-radius: 14px; border: 1px solid color-mix(in srgb, var(--hl-border) 80%, transparent);
    background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent);
  }
  :global(.hl-score-meta) strong { font-size: 0.93rem; font-weight: 600; }
  :global(.hl-score-meta) span   { color: var(--hl-muted); font-size: 0.72rem; }

  :global(.hl-hero-list) { display: grid; gap: 7px; }
  :global(.hl-hero-list) article {
    padding: 11px 14px; border: 1px solid color-mix(in srgb, var(--hl-border) 88%, transparent);
    border-radius: 13px; background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent); display: grid; gap: 4px;
  }
  :global(.hl-hero-list) span   { color: var(--hl-muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.1em; }
  :global(.hl-hero-list) strong { font-size: 0.93rem; font-weight: 600; }

  :global(.hl-hero-bar) {
    height: 5px; border-radius: 999px;
    background: color-mix(in srgb, var(--hl-border) 70%, transparent); overflow: hidden;
  }
  :global(.hl-hero-bar) i {
    display: block; width: var(--fill); height: 100%; border-radius: inherit;
    background: linear-gradient(90deg, var(--hl-accent), color-mix(in srgb, var(--accent) 40%, var(--hl-accent)));
  }

  /* Body */
  :global(.hl-body), :global(.hl-grid), :global(.hl-panel), :global(.hl-panel) :global(.card-content) { min-height: 0; }
  :global(.hl-body) { min-height: 0; }
  :global(.hl-grid) { display: grid; gap: 16px; height: 100%; }
  :global(.hl-grid--2col)  { grid-template-columns: repeat(2,minmax(0,1fr)); }
  :global(.hl-grid--vitals){ grid-template-columns: repeat(2,minmax(0,1fr)); grid-template-rows: auto auto; }
  :global(.hl-panel)       { display: flex; flex-direction: column; }
  :global(.hl-panel--full-row) { grid-column: 1/-1; }

  /* Utils */
  :global(.hl-label) {
    display: flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.08em; margin-bottom: 8px; color: var(--hl-ink); text-transform: uppercase;
  }
  :global(.hl-muted)         { color: var(--hl-muted); font-size: 0.83rem; }
  :global(.hl-muted--center) { text-align: center; padding: 16px 0; display: block; }
  :global(.hl-error)         { color: color-mix(in srgb, red 80%, var(--hl-ink)); font-size: 0.82rem; padding: 6px 0; }
  :global(.hl-taken)         { color: var(--hl-accent); }

  :global(.hl-chip-row) { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }

  :global(.hl-meter) {
    height: 8px; border-radius: 999px;
    background: color-mix(in srgb, var(--hl-border) 72%, transparent); overflow: hidden;
  }
  :global(.hl-meter--wide) { width: 100%; }
  :global(.hl-meter) i {
    display: block; width: var(--fill); height: 100%; border-radius: inherit;
    background: linear-gradient(90deg, var(--hl-accent), color-mix(in srgb, var(--accent) 40%, var(--hl-accent)));
    transition: width 0.4s ease;
  }

  /* Spinner */
  :global(.hl-spin) { animation: hl-spin 0.8s linear infinite; }
  @keyframes hl-spin { to { transform: rotate(360deg); } }

  /* Timeline */
  :global(.hl-timeline) { display: grid; gap: 2px; overflow: auto; }
  :global(.hl-timeline__item) {
    display: grid; grid-template-columns: 56px 10px 1fr;
    gap: 0 12px; align-items: center; padding: 10px 12px; border-radius: 12px; transition: background 0.15s;
  }
  :global(.hl-timeline__item:hover) { background: color-mix(in srgb, var(--hl-surface-strong) 80%, transparent); }
  :global(.hl-timeline__time) { font-size: 0.78rem; color: var(--hl-muted); font-variant: tabular-nums; text-align: right; }
  :global(.hl-timeline__dot) { width: 10px; height: 10px; border-radius: 999px; background: var(--hl-accent); flex-shrink: 0; }
  :global(.hl-dot--vitals)  { background: color-mix(in srgb, red 60%,    var(--hl-accent)); }
  :global(.hl-dot--med)     { background: color-mix(in srgb, purple 50%, var(--hl-accent)); }
  :global(.hl-dot--water)   { background: color-mix(in srgb, cyan 60%,   var(--hl-accent)); }
  :global(.hl-dot--mood)    { background: color-mix(in srgb, blue 40%,   var(--hl-accent)); }
  :global(.hl-dot--symptom) { background: color-mix(in srgb, orange 60%, var(--hl-accent)); }
  :global(.hl-timeline__copy) strong { font-size: 0.88rem; }
  :global(.hl-timeline__copy) p      { margin: 2px 0 0; font-size: 0.78rem; color: var(--hl-muted); }

  /* Bar chart */
  :global(.hl-bar-chart) {
    display: grid; grid-template-columns: repeat(7,minmax(0,1fr));
    gap: 8px; align-items: end; height: 100%; padding-bottom: 4px; overflow: hidden;
  }
  :global(.hl-bar-chart) article { display: grid; justify-items: center; align-items: end; gap: 6px; height: 100%; }
  :global(.hl-bar-chart) i {
    display: block; width: 22px; height: var(--bar); min-height: 10px;
    border-radius: 999px; align-self: end;
    background: linear-gradient(180deg, var(--hl-accent), color-mix(in srgb, var(--accent) 38%, var(--hl-accent)));
    transition: height 0.4s ease;
  }
  :global(.hl-bar-chart) span   { font-size: 0.72rem; color: var(--hl-muted); }
  :global(.hl-bar-chart) strong { font-size: 0.75rem; }

  /* Daily Log */
  :global(.hl-log-form)  { display: grid; gap: 16px; overflow: auto; }
  :global(.hl-log-block) { display: grid; }
  :global(.hl-log-row) { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  :global(.hl-mood-picker) { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; }
  :global(.hl-mood-btn) {
    padding: 12px 6px; border: 1px solid var(--hl-border); border-radius: 14px;
    background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent); color: var(--hl-ink);
    display: grid; justify-items: center; gap: 5px; cursor: pointer; transition: all 0.15s; font: inherit;
  }
  :global(.hl-mood-btn) span  { font-size: 1.5rem; }
  :global(.hl-mood-btn) small { font-size: 0.72rem; color: var(--hl-muted); }
  :global(.hl-mood-btn--active) {
    border-color: color-mix(in srgb, var(--hl-accent) 60%, var(--hl-border));
    background:   color-mix(in srgb, var(--hl-accent) 14%, var(--hl-surface));
  }

  :global(.hl-energy-row) { display: flex; gap: 5px; }
  :global(.hl-energy-btn) {
    flex: 1; padding: 9px 0; border: 1px solid var(--hl-border); border-radius: 10px;
    background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent); color: var(--hl-muted);
    font: inherit; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; text-align: center;
  }
  :global(.hl-energy-btn--active) {
    border-color: var(--hl-accent); background: color-mix(in srgb, var(--hl-accent) 16%, var(--hl-surface));
    color: var(--hl-ink); font-weight: 600;
  }

  :global(.hl-stepper) { display: flex; align-items: center; gap: 12px; }
  :global(.hl-stepper) button {
    width: 34px; height: 34px; border: 1px solid var(--hl-border); border-radius: 999px;
    background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent); color: var(--hl-ink);
    font-size: 1.1rem; cursor: pointer; display: grid; place-items: center; transition: background 0.15s;
  }
  :global(.hl-stepper) button:hover { background: color-mix(in srgb, var(--hl-accent) 12%, var(--hl-surface)); }
  :global(.hl-stepper) strong { font-size: 1rem; }

  :global(.hl-symptoms-panel) { display: grid; gap: 14px; overflow: auto; }
  :global(.hl-symptom-grid)   { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 7px; }
  :global(.hl-symptom-btn) {
    padding: 11px 10px; border: 1px solid var(--hl-border); border-radius: 11px;
    background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent); color: var(--hl-muted);
    font: inherit; font-size: 0.82rem; cursor: pointer; text-align: left; transition: all 0.15s;
  }
  :global(.hl-symptom-btn--active) {
    border-color: color-mix(in srgb, var(--hl-accent) 60%, var(--hl-border));
    background:   color-mix(in srgb, var(--hl-accent) 14%, var(--hl-surface)); color: var(--hl-ink);
  }
  :global(.hl-symptom-tagged) { padding-top: 4px; }

  /* Vitals */
  :global(.hl-vitals-form) { display: grid; gap: 14px; }
  :global(.hl-vital-row)   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  :global(.hl-vital-field) { display: grid; gap: 5px; }

  :global(.hl-bp-chart) {
    display: grid; grid-template-columns: repeat(7,minmax(0,1fr));
    gap: 8px; align-items: end; height: 100%; padding-bottom: 4px; overflow: hidden;
  }
  :global(.hl-bp-chart) article { display: grid; justify-items: center; align-items: end; gap: 6px; height: 100%; }
  :global(.hl-bp-chart) span  { font-size: 0.72rem; color: var(--hl-muted); }
  :global(.hl-bp-chart) small { font-size: 0.7rem; }
  :global(.hl-bp-col) { display: flex; gap: 3px; align-items: flex-end; height: 70px; align-self: end; }
  :global(.hl-bp-sys), :global(.hl-bp-dia) { display: block; width: 10px; border-radius: 3px 3px 0 0; }
  :global(.hl-bp-sys) { height: var(--h); min-height: 6px; background: var(--hl-accent); transition: height 0.4s; }
  :global(.hl-bp-dia) { height: var(--h); min-height: 4px; background: color-mix(in srgb, var(--hl-accent) 40%, transparent); transition: height 0.4s; }

  :global(.hl-vitals-table) { display: grid; gap: 5px; overflow: auto; }
  :global(.hl-table-head), :global(.hl-table-row) {
    display: grid; grid-template-columns: 90px repeat(5,minmax(0,1fr)); gap: 8px; padding: 10px 16px; border-radius: 11px;
  }
  :global(.hl-table-head) {
    background: color-mix(in srgb, var(--hl-surface-strong) 80%, transparent);
    font-size: 0.74rem; font-weight: 600; color: var(--hl-muted); text-transform: uppercase; letter-spacing: 0.08em;
  }
  :global(.hl-table-row) {
    border: 1px solid color-mix(in srgb, var(--hl-border) 78%, transparent);
    background: color-mix(in srgb, var(--hl-surface-strong) 68%, transparent);
    font-size: 0.86rem; transition: background 0.12s;
  }
  :global(.hl-table-row:hover) { background: color-mix(in srgb, var(--hl-surface) 88%, transparent); }

  /* Insights */
  :global(.hl-correlations) { display: grid; gap: 10px; overflow: auto; }
  :global(.hl-correlation) {
    padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--hl-border) 88%, transparent);
    border-radius: 16px; background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent); display: grid; gap: 7px;
  }
  :global(.hl-correlation__top) { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  :global(.hl-correlation__top) strong { font-size: 0.88rem; }
  :global(.hl-correlation) p { margin: 0; font-size: 0.82rem; color: var(--hl-muted); }

  :global(.hl-export-list) { display: grid; gap: 10px; overflow: auto; }
  :global(.hl-export__item) {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--hl-border) 88%, transparent);
    border-radius: 16px; background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent);
  }
  :global(.hl-export__item) strong { font-size: 0.88rem; }
  :global(.hl-export__item) p      { margin: 3px 0 0; font-size: 0.8rem; color: var(--hl-muted); }

  /* Medications */
  :global(.hl-med-list) { display: grid; gap: 8px; overflow: auto; }
  :global(.hl-med__item) {
    display: grid; grid-template-columns: 30px 1fr auto;
    gap: 12px; align-items: center; padding: 13px 14px;
    border: 1px solid color-mix(in srgb, var(--hl-border) 88%, transparent);
    border-radius: 14px; background: color-mix(in srgb, var(--hl-surface-strong) 88%, transparent);
    transition: opacity 0.2s;
  }
  :global(.hl-med--taken)  { opacity: 0.52; }
  :global(.hl-med__check) {
    width: 30px; height: 30px; border: 2px solid var(--hl-border); border-radius: 999px;
    background: transparent; color: var(--hl-bg); cursor: pointer;
    display: grid; place-items: center; transition: all 0.15s; flex-shrink: 0;
  }
  :global(.hl-med__check:hover) { border-color: var(--hl-accent); background: color-mix(in srgb, var(--hl-accent) 12%, transparent); }
  :global(.hl-med__check--done) { background: var(--hl-accent); border-color: var(--hl-accent); color: var(--hl-bg); }
  :global(.hl-med__copy) strong { font-size: 0.88rem; }
  :global(.hl-med__copy) p      { margin: 2px 0 0; font-size: 0.78rem; color: var(--hl-muted); }
  :global(.hl-med__right) { display: flex; align-items: center; gap: 8px; }
  :global(.hl-med__delete) {
    width: 22px; height: 22px; border-radius: 999px; border: none;
    background: transparent; color: var(--hl-muted); font-size: 1rem;
    cursor: pointer; display: grid; place-items: center; opacity: 0; transition: opacity 0.15s;
  }
  :global(.hl-med__item:hover) :global(.hl-med__delete) { opacity: 1; }
  :global(.hl-med__delete:hover) { color: color-mix(in srgb, red 70%, var(--hl-ink)); }

  :global(.hl-add-med) { display: grid; gap: 14px; overflow: auto; }

  :global(.hl-adherence) { display: grid; gap: 18px; overflow: auto; }
  :global(.hl-adherence__today) {
    display: flex; align-items: center; gap: 20px; padding: 16px;
    border: 1px solid color-mix(in srgb, var(--hl-border) 80%, transparent);
    border-radius: 18px; background: color-mix(in srgb, var(--hl-surface-strong) 80%, transparent);
  }
  :global(.hl-adherence__orb) {
    display: grid; place-items: center; width: 84px; aspect-ratio: 1; border-radius: 999px; flex-shrink: 0;
  }
  :global(.hl-adherence__orb--ring) {
    width: 148px;
    background: transparent;
    overflow: visible;
  }
  :global(.hl-adherence__orb) strong { font-size: 1.4rem; line-height: 1; }
  :global(.hl-adherence__orb) small  { font-size: 0.68rem; color: var(--hl-muted); text-transform: uppercase; }
  :global(.hl-adherence__meta) { display: flex; flex-direction: column; gap: 4px; }
  :global(.hl-adherence__meta) strong { font-size: 1.1rem; }
  :global(.hl-adherence__breakdown) { display: grid; gap: 8px; overflow: auto; }
  :global(.hl-adherence__row) {
    display: grid; grid-template-columns: 1fr 100px auto;
    gap: 12px; align-items: center; font-size: 0.84rem;
  }
  :global(.hl-adherence__row) span { color: var(--hl-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* #10 Loading skeleton */
  :global(.hl-loading) {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    height: 100%;
  }
  :global(.hl-loading__orb) {
    width: 48px; height: 48px; border-radius: 999px;
    border: 3px solid color-mix(in srgb, var(--hl-accent) 30%, transparent);
    border-top-color: var(--hl-accent);
    animation: hl-spin 0.8s linear infinite;
  }
  :global(.hl-loading) p { color: var(--hl-muted); font-size: 0.9rem; }

  /* #7 History panel */
  :global(.hl-history-panel) { margin-top: 4px; }
</style>
