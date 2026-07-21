<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount, onDestroy } from "svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import FlagIcon from "@lucide/svelte/icons/flag";
  import CakeIcon from "@lucide/svelte/icons/cake";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import HourglassIcon from "@lucide/svelte/icons/hourglass";
  import RepeatIcon from "@lucide/svelte/icons/repeat-2";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { ensureModuleSection, getModuleSectionLabel, moduleSectionStore } from "$lib/stores/module-sections.store";
  import TiltCard from "$lib/components/TiltCard.svelte";
  import ShareIcon from "@lucide/svelte/icons/share-2";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let { moduleId = "countdown" }: { moduleId?: string } = $props();

  const sectionLabels = ["Events", "Milestones", "Birthdays", "Since", "Export"] as const;
  const selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  // ─── Types ────────────────────────────────────────────────────────────────

  type Category = "Trip" | "Deadline" | "Personal" | "Work" | "Anniversary" | "Celebration";

  interface CountdownItem {
    id: string;
    name: string;
    targetMs: number;
    category: Category;
    accent: string;
    note?: string;
  }

  interface Milestone {
    id: string;
    name: string;
    targetMs: number;
    progress: number;
    accent: string;
    note?: string;
  }

  interface Birthday {
    id: string;
    name: string;
    month: number; // 1–12
    day: number;   // 1–31
    accent: string;
  }

  // ─── Accent palette ───────────────────────────────────────────────────────

  const ACCENTS = [
    "#ec4899","#f59e0b","#6366f1","#10b981",
    "#ef4444","#8b5cf6","#06b6d4","#f97316",
  ];
  let accentIdx = $state(0);
  const nextAccent = () => { const a = ACCENTS[accentIdx % ACCENTS.length]; accentIdx++; return a; };

  // ─── Data ─────────────────────────────────────────────────────────────────

  let events = $state<CountdownItem[]>([]);
  let eventsLoading = $state(true);

  async function loadEvents() {
    eventsLoading = true;
    try {
      events = await invoke<CountdownItem[]>("countdown_list_events");
    } catch (e) {
      console.error("Failed to load countdown events:", e);
    } finally {
      eventsLoading = false;
    }
  }

  let milestones = $state<Milestone[]>([]);
  let milestonesLoading = $state(true);

  async function loadMilestones() {
    milestonesLoading = true;
    try {
      milestones = await invoke<Milestone[]>("countdown_list_milestones");
    } catch (e) {
      console.error("Failed to load milestones:", e);
    } finally {
      milestonesLoading = false;
    }
  }

  let birthdays = $state<Birthday[]>([]);
  let birthdaysLoading = $state(true);

  async function loadBirthdays() {
    birthdaysLoading = true;
    try {
      birthdays = await invoke<Birthday[]>("countdown_list_birthdays");
    } catch (e) {
      console.error("Failed to load birthdays:", e);
    } finally {
      birthdaysLoading = false;
    }
  }

  // ─── Live tick ────────────────────────────────────────────────────────────

  let tick = $state(Date.now());
  let tickTimer: ReturnType<typeof setInterval>;

  // ─── Drawer state (replaces inline form — no layout shift) ───────────────

  type DrawerKind = "event" | "milestone" | "birthday" | "fullscreen" | "edit-progress" | null;
  let drawer = $state<DrawerKind>(null);

  // Add-event form
  let newName     = $state("");
  let newDate     = $state("");
  let newCategory = $state<Category>("Personal");
  let newNote     = $state("");
  let newDateWarn = $state(false);

  // Add-milestone form
  let msName     = $state("");
  let msDate     = $state("");
  let msProgress = $state(0);
  let msNote     = $state("");

  // Add-birthday form
  let bdName  = $state("");
  let bdMonth = $state(1);
  let bdDay   = $state(1);

  // Fullscreen focus
  let focusId = $state<string | null>(null);
  const focusEvent = $derived(focusId ? events.find(e => e.id === focusId) ?? null : null);

  // Edit-progress
  let editMsId  = $state<string | null>(null);
  let editMsVal = $state(0);

  // ─── Celebration sounds ───────────────────────────────────────────
  // Called directly in the click handler — MUST be inside a user gesture
  // or AudioContext is blocked by browser autoplay policy.
  let _soundIdx = 0;

  function playCelebrationSound() {
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      const run = () => {
        const i = _soundIdx++ % 6;
        if (i === 0) {
          // Bright ascending chime
          [523,659,784].forEach((f,j) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=f; const t=ctx.currentTime+j*0.10; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.03); g.gain.exponentialRampToValueAtTime(0.001,t+0.5); o.start(t); o.stop(t+0.55); });
        } else if (i === 1) {
          // Soft pop + shimmer
          const buf=ctx.createBuffer(1,ctx.sampleRate*0.08,ctx.sampleRate); const d=buf.getChannelData(0); for(let k=0;k<d.length;k++) d[k]=(Math.random()*2-1)*Math.exp(-k/400); const s=ctx.createBufferSource(); s.buffer=buf; const g=ctx.createGain(); g.gain.value=0.35; s.connect(g); g.connect(ctx.destination); s.start();
          [1047,1319,1568].forEach((f,j) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='triangle'; o.frequency.value=f; const t=ctx.currentTime+0.05+j*0.07; g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4); o.start(t); o.stop(t+0.45); });
        } else if (i === 2) {
          // Ta-da fanfare
          [[392,0],[523,0.18],[659,0.32],[784,0.44]].forEach(([f,delay]) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sawtooth'; o.frequency.value=f as number; const t=ctx.currentTime+(delay as number); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.12,t+0.04); g.gain.exponentialRampToValueAtTime(0.001,t+0.35); o.start(t); o.stop(t+0.4); });
        } else if (i === 3) {
          // Bouncy plucks
          [440,554,659,880,1108].forEach((f,j) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.value=f; const t=ctx.currentTime+j*0.08; g.gain.setValueAtTime(0.10,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25); o.start(t); o.stop(t+0.28); });
        } else if (i === 4) {
          // Boom + sparkle
          const o1=ctx.createOscillator(),g1=ctx.createGain(); o1.connect(g1); g1.connect(ctx.destination); o1.type='sine'; o1.frequency.setValueAtTime(120,ctx.currentTime); o1.frequency.exponentialRampToValueAtTime(40,ctx.currentTime+0.3); g1.gain.setValueAtTime(0.4,ctx.currentTime); g1.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4); o1.start(); o1.stop(ctx.currentTime+0.45);
          [2093,2637,3136].forEach((f,j) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=f; const t=ctx.currentTime+0.05+j*0.06; g.gain.setValueAtTime(0.08,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.start(t); o.stop(t+0.35); });
        } else {
          // Pentatonic cascade
          [523,587,659,784,880,1047].forEach((f,j) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=f; const t=ctx.currentTime+j*0.06; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.15,t+0.02); g.gain.exponentialRampToValueAtTime(0.001,t+0.55); o.start(t); o.stop(t+0.6); });
        }
        setTimeout(() => ctx.close().catch(() => {}), 2500);
      };
      void (ctx.state === 'suspended' ? ctx.resume().then(run) : run());
    } catch { /* silence any errors */ }
  }

  // ─── Computed helpers ─────────────────────────────────────────────────────

  function msToTarget(targetMs: number) { return Math.max(0, targetMs - tick); }

  function decompose(ms: number) {
    const s = Math.floor(ms / 1000);
    return {
      days:  Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      mins:  Math.floor((s % 3600) / 60),
      secs:  s % 60,
    };
  }

  function daysTo(targetMs: number) { return Math.ceil((targetMs - tick) / 864e5); }
  function isPast(targetMs: number) { return targetMs < tick; }

  function urgencyClass(targetMs: number) {
    const d = daysTo(targetMs);
    if (d <= 0) return "cd-urgency--today";
    if (d <= 1) return "cd-urgency--tomorrow";
    if (d <= 7) return "cd-urgency--soon";
    return "";
  }

  function fmtDate(ms: number) {
    return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function nextOccurrenceMs(month: number, day: number) {
    const now = new Date();
    let candidate = new Date(now.getFullYear(), month - 1, day);
    if (candidate.getTime() < now.getTime()) candidate = new Date(now.getFullYear() + 1, month - 1, day);
    return candidate.getTime();
  }

  function daysUntilBirthday(b: Birthday) {
    return Math.ceil((nextOccurrenceMs(b.month, b.day) - tick) / 864e5);
  }

  function fmtMonthDay(month: number, day: number) {
    return new Date(2000, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const daysInMonth = (m: number) => new Date(2000, m, 0).getDate();

  const sortedEvents   = $derived([...events].filter(e => !isPast(e.targetMs)).sort((a,b) => a.targetMs - b.targetMs));
  const pastEvents     = $derived([...events].filter(e =>  isPast(e.targetMs)).sort((a,b) => b.targetMs - a.targetMs));
  const heroEvent      = $derived(sortedEvents[0] ?? null);
  const restEvents     = $derived(sortedEvents.slice(1));
  const sortedBirthdays= $derived([...birthdays].sort((a,b) => daysUntilBirthday(a) - daysUntilBirthday(b)));
  const nextBirthday   = $derived(sortedBirthdays[0] ?? null);

  // Celebration TiltCard popup (must be after pastEvents is declared above)
  let celebEventId = $state<string | null>(null);
  const celebEvent = $derived(pastEvents.find(e => e.id === celebEventId) ?? null);

  // ─── Actions ──────────────────────────────────────────────────────────────

  function validateDate(val: string): boolean {
    if (!val) return false;
    return !isNaN(new Date(val).getTime());
  }

  async function addEvent() {
    if (!newName.trim() || !newDate) return;
    if (!validateDate(newDate)) { newDateWarn = true; return; }
    try {
      await invoke("countdown_save_event", {
        params: {
          name: newName.trim(),
          targetMs: new Date(newDate).getTime(),
          category: newCategory,
          accent: nextAccent(),
          note: newNote.trim() || null,
        },
      });
      await loadEvents();
      newName = ""; newDate = ""; newNote = ""; newDateWarn = false; drawer = null;
    } catch (e) {
      console.error("Failed to add event:", e);
    }
  }

  async function removeEvent(id: string) {
    try {
      await invoke("countdown_delete_event", { id });
      await loadEvents();
    } catch (e) {
      console.error("Failed to delete event:", e);
    }
  }

  async function addMilestone() {
    if (!msName.trim() || !msDate) return;
    try {
      await invoke("countdown_save_milestone", {
        params: {
          name: msName.trim(),
          targetMs: new Date(msDate).getTime(),
          progress: msProgress,
          accent: nextAccent(),
          note: msNote.trim() || null,
        },
      });
      await loadMilestones();
      msName = ""; msDate = ""; msProgress = 0; msNote = ""; drawer = null;
    } catch (e) {
      console.error("Failed to add milestone:", e);
    }
  }

  async function removeMilestone(id: string) {
    try {
      await invoke("countdown_delete_milestone", { id });
      await loadMilestones();
    } catch (e) {
      console.error("Failed to delete milestone:", e);
    }
  }

  function startEditProgress(ms: Milestone) {
    editMsId = ms.id; editMsVal = ms.progress; drawer = "edit-progress";
  }

  async function saveProgress() {
    if (!editMsId) return;
    try {
      await invoke("countdown_update_milestone_progress", {
        id: editMsId,
        progress: editMsVal,
      });
      await loadMilestones();
    } catch (e) {
      console.error("Failed to update progress:", e);
    }
    editMsId = null; drawer = null;
  }

  async function addBirthday() {
    if (!bdName.trim()) return;
    try {
      await invoke("countdown_save_birthday", {
        params: {
          name: bdName.trim(),
          month: bdMonth,
          day: bdDay,
          accent: nextAccent(),
        },
      });
      await loadBirthdays();
      bdName = ""; bdMonth = 1; bdDay = 1; drawer = null;
    } catch (e) {
      console.error("Failed to add birthday:", e);
    }
  }

  async function removeBirthday(id: string) {
    try {
      await invoke("countdown_delete_birthday", { id });
      await loadBirthdays();
    } catch (e) {
      console.error("Failed to delete birthday:", e);
    }
  }

  // ─── Export ──────────────────────────────────────────────────────────────
  let exportLoading = $state<string | null>(null);

  function fmtDateShort(ms: number) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  async function exportEventsCsv() {
    exportLoading = "events";
    try {
      const all = [...sortedEvents, ...pastEvents];
      const header = "Name,Date,Category,Days Until,Notes\n";
      const csv = header + all.map(e =>
        `"${e.name}",${fmtDateShort(e.targetMs)},${e.category},${daysTo(e.targetMs)},"${e.note || ""}"`
      ).join("\n");
      await invoke("export_content_to_file", {
        content: csv,
        defaultName: "bento-countdown-events.csv",
        extension: "csv",
        filterName: "CSV files",
      });
    } catch (e) {
      console.error("Failed to export events:", e);
    } finally {
      exportLoading = null;
    }
  }

  async function exportBirthdaysCsv() {
    exportLoading = "birthdays";
    try {
      const header = "Name,Month,Day,Next Occurrence,Days Until\n";
      const csv = header + birthdays.map(b => {
        const nextMs = nextOccurrenceMs(b.month, b.day);
        return `"${b.name}",${b.month},${b.day},${fmtDateShort(nextMs)},${daysUntilBirthday(b)}`;
      }).join("\n");
      await invoke("export_content_to_file", {
        content: csv,
        defaultName: "bento-countdown-birthdays.csv",
        extension: "csv",
        filterName: "CSV files",
      });
    } catch (e) {
      console.error("Failed to export birthdays:", e);
    } finally {
      exportLoading = null;
    }
  }

  async function exportMilestonesCsv() {
    exportLoading = "milestones";
    try {
      const header = "Name,Target Date,Progress %,Days Left,Notes\n";
      const csv = header + milestones.map(m =>
        `"${m.name}",${fmtDateShort(m.targetMs)},${m.progress},${daysTo(m.targetMs)},"${m.note || ""}"`
      ).join("\n");
      await invoke("export_content_to_file", {
        content: csv,
        defaultName: "bento-countdown-milestones.csv",
        extension: "csv",
        filterName: "CSV files",
      });
    } catch (e) {
      console.error("Failed to export milestones:", e);
    } finally {
      exportLoading = null;
    }
  }

  function openFullscreen(id: string) { focusId = id; drawer = "fullscreen"; }
  function closeFullscreen() { focusId = null; drawer = null; }

  // Escape key closes any open drawer
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      drawer = null; focusId = null;
    }
    // Enter submits the active form
    if (e.key === "Enter" && !e.shiftKey) {
      if (drawer === "event")         addEvent();
      else if (drawer === "milestone") addMilestone();
      else if (drawer === "birthday")  addBirthday();
      else if (drawer === "edit-progress") saveProgress();
    }
  }

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    loadEvents();
    loadMilestones();
    loadBirthdays();
    tickTimer = setInterval(() => { tick = Date.now(); }, 1000);
    window.addEventListener("keydown", onKeydown);
  });

  onDestroy(() => {
    clearInterval(tickTimer);
    window.removeEventListener("keydown", onKeydown);
  });
</script>

<main class="cd-root module-root" data-module="countdown">

  <!-- ══ FULLSCREEN overlay ══ -->
  {#if drawer === "fullscreen" && focusEvent}
    {const remaining = msToTarget(focusEvent.targetMs)}
    {const { days, hours, mins, secs } = decompose(remaining)}
    <div class="cd-overlay cd-overlay--fullscreen" role="dialog" aria-modal="true" aria-label="Fullscreen countdown: {focusEvent.name}">
      <button class="cd-overlay-close" onclick={closeFullscreen} aria-label="Close fullscreen (Escape)" use:tooltip={{ text: "Close" }}>
        <XIcon size={18}/>
      </button>
      <p class="cd-fs-name">{focusEvent.name}</p>
      {#if isPast(focusEvent.targetMs)}
        <p class="cd-fs-past">It happened.</p>
      {:else}
        <div class="cd-fs-digits">
          <span><strong>{days}</strong><small>days</small></span>
          <span><strong>{hours}</strong><small>hrs</small></span>
          <span><strong>{mins}</strong><small>min</small></span>
          <span class="cd-fs-secs"><strong>{String(secs).padStart(2,"0")}</strong><small>sec</small></span>
        </div>
      {/if}
      <p class="cd-fs-date">{fmtDate(focusEvent.targetMs)}</p>
      <p class="cd-fs-hint">Press Escape to return</p>
    </div>
  {/if}

  <!-- ══ DRAWER (floating backdrop + sheet — main content stays rendered underneath) ══ -->
  {#if drawer && drawer !== "fullscreen"}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="cd-overlay cd-overlay--backdrop" role="dialog" aria-modal="true"
      onclick={(e) => { if ((e.target as HTMLElement).classList.contains('cd-overlay--backdrop')) drawer = null; }}>
      <div class="cd-sheet">
        <button class="cd-overlay-close" onclick={() => drawer = null} aria-label="Close (Escape)" use:tooltip={{ text: "Close" }}>
          <XIcon size={18}/>
        </button>

        {#if drawer === "event"}
          <h3 class="cd-drawer-title">New countdown</h3>
          <div class="cd-form">
            <input class="cd-input" placeholder="What are you counting down to?" bind:value={newName} />
            <input class="cd-input cd-input--date" type="date" bind:value={newDate}
              oninput={() => { newDateWarn = false; }}
              aria-invalid={newDateWarn}
            />
            {#if newDateWarn}
              <p class="cd-warn">Pick a valid date.</p>
            {/if}
            <select class="cd-input" bind:value={newCategory} aria-label="Category">
              {#each (["Trip","Deadline","Personal","Work","Anniversary","Celebration"] as Category[]) as cat}
                <option value={cat}>{cat}</option>
              {/each}
            </select>
            <input class="cd-input" placeholder="Note (optional)" bind:value={newNote} />
            <div class="cd-form-actions">
              <Button variant="outline" onclick={() => drawer = null}>Cancel</Button>
              <Button onclick={addEvent} disabled={!newName.trim() || !newDate}>Add event</Button>
            </div>
          </div>

        {:else if drawer === "milestone"}
          <h3 class="cd-drawer-title">New milestone</h3>
          <div class="cd-form">
            <input class="cd-input" placeholder="What are you working toward?" bind:value={msName} />
            <input class="cd-input cd-input--date" type="date" bind:value={msDate} />
            <label class="cd-range-label">
              Progress so far — <strong>{msProgress}%</strong>
              <input type="range" min="0" max="100" bind:value={msProgress} class="cd-range" aria-label="Progress percentage"/>
            </label>
            <input class="cd-input" placeholder="Any context? (optional)" bind:value={msNote} />
            <div class="cd-form-actions">
              <Button variant="outline" onclick={() => drawer = null}>Cancel</Button>
              <Button onclick={addMilestone} disabled={!msName.trim() || !msDate}>Add milestone</Button>
            </div>
          </div>

        {:else if drawer === "birthday"}
          <h3 class="cd-drawer-title">Add a birthday</h3>
          <p class="cd-drawer-sub">Month and day only — it repeats every year automatically.</p>
          <div class="cd-form">
            <input class="cd-input" placeholder="Who is this?" bind:value={bdName} />
            <div class="cd-bday-selects">
              <select class="cd-input" bind:value={bdMonth} aria-label="Birth month">
                {#each MONTHS as m, i}
                  <option value={i + 1}>{m}</option>
                {/each}
              </select>
              <select class="cd-input" bind:value={bdDay} aria-label="Birth day">
                {#each Array.from({ length: daysInMonth(bdMonth) }, (_, i) => i + 1) as d}
                  <option value={d}>{d}</option>
                {/each}
              </select>
            </div>
            <div class="cd-form-actions">
              <Button variant="outline" onclick={() => drawer = null}>Cancel</Button>
              <Button onclick={addBirthday} disabled={!bdName.trim()}>Add person</Button>
            </div>
          </div>

        {:else if drawer === "edit-progress"}
          {const ms = milestones.find(m => m.id === editMsId)}
          {#if ms}
            <h3 class="cd-drawer-title">Update progress</h3>
            <p class="cd-drawer-sub">{ms.name}</p>
            <div class="cd-form">
              <label class="cd-range-label">
                <strong style="font-size:2rem;font-family:var(--font-heading);letter-spacing:-0.04em;color:var(--foreground)">{editMsVal}%</strong>
                <input type="range" min="0" max="100" bind:value={editMsVal} class="cd-range" aria-label="Progress percentage"/>
              </label>
              <div class="cd-form-actions">
                <Button variant="outline" onclick={() => drawer = null}>Cancel</Button>
                <Button onclick={saveProgress}>Save</Button>
              </div>
            </div>
          {/if}
        {/if}

      </div><!-- /.cd-sheet -->
    </div><!-- /.cd-overlay--backdrop -->
  {/if}

  <!-- ══ MAIN CONTENT (always rendered — blur backdrop shows it underneath) ══ -->
  <div class="cd-main">

    <header class="cd-page__header">
      <div class="cd-page__intro">
        <div class="cd-page__eyebrow">
          <HourglassIcon size={13}/><span>Countdown</span><Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1 class="cd-page__title">
          {#if selectedSection === "Events"}What's next?
          {:else if selectedSection === "Milestones"}How far have you come?
          {:else if selectedSection === "Birthdays"}People who matter.
          {:else if selectedSection === "Since"}Look back.
          {:else}Take your data with you.
          {/if}
        </h1>
        <p class="cd-page__desc">
          {#if selectedSection === "Events"}The nearest event is always at the top.
          {:else if selectedSection === "Milestones"}Track progress, not just deadlines.
          {:else if selectedSection === "Birthdays"}Add once. Never miss again.
          {:else if selectedSection === "Since"}Past events flip to days-since automatically.
          {:else}Export to any calendar or backup locally.
          {/if}
        </p>
      </div>
      <div class="cd-page__actions">
        {#if selectedSection === "Events"}
          <Button onclick={() => drawer = "event"}>
            <PlusIcon data-icon="inline-start" />New event
          </Button>
        {:else if selectedSection === "Milestones"}
          <Button onclick={() => drawer = "milestone"}>
            <PlusIcon data-icon="inline-start" />New milestone
          </Button>
        {:else if selectedSection === "Birthdays"}
          <Button onclick={() => drawer = "birthday"}>
            <PlusIcon data-icon="inline-start" />Add person
          </Button>
        {/if}
      </div>
    </header>

    <!-- ══ EVENTS ══ -->
    {#if selectedSection === "Events"}

      {#if heroEvent}
        {const remaining = msToTarget(heroEvent.targetMs)}
        {const { days, hours, mins, secs } = decompose(remaining)}
        <Card class="cd-hero {urgencyClass(heroEvent.targetMs)}" style="--cd-accent:{heroEvent.accent}">
          <CardContent class="cd-hero__body">
            <div class="cd-hero__top">
              <Badge variant="outline" class="cd-category-badge">{heroEvent.category}</Badge>
              <button class="cd-fs-trigger" onclick={() => openFullscreen(heroEvent.id)} aria-label="Full screen countdown" use:tooltip={{ text: "View fullscreen" }}>
                <EyeIcon size={13}/> Full screen
              </button>
            </div>
            <h2 class="cd-hero__name">{heroEvent.name}</h2>
            <p class="cd-hero__date">{fmtDate(heroEvent.targetMs)}</p>
            {#if heroEvent.note}<p class="cd-hero__note">{heroEvent.note}</p>{/if}
            <div class="cd-digits" role="timer" aria-label="{heroEvent.name}: {days} days {hours} hours {mins} minutes">
              <div class="cd-digit"><strong>{days}</strong><span>days</span></div>
              <div class="cd-digit"><strong>{hours}</strong><span>hrs</span></div>
              <div class="cd-digit"><strong>{mins}</strong><span>min</span></div>
              <div class="cd-digit cd-digit--secs" aria-hidden="true"><strong>{String(secs).padStart(2,"0")}</strong><span>sec</span></div>
            </div>
          </CardContent>
        </Card>
      {/if}

      {#if restEvents.length > 0}
        <Card class="cd-list-card">
          <CardHeader>
            <CardTitle>Also coming up</CardTitle>
          </CardHeader>
          <CardContent class="cd-event-list">
            {#each restEvents as ev}
              <article class="cd-event-row {urgencyClass(ev.targetMs)}" style="--cd-accent:{ev.accent}">
                <span class="cd-event-dot" style="background:{ev.accent}" aria-hidden="true"></span>
                <div class="cd-event-info">
                  <strong>{ev.name}</strong>
                  <span>{fmtDate(ev.targetMs)}</span>
                  {#if ev.note}<p class="cd-event-note">{ev.note}</p>{/if}
                </div>
                <div class="cd-event-right">
                  <div class="cd-event-days" aria-label="{daysTo(ev.targetMs)} days remaining">
                    <span>{daysTo(ev.targetMs)}</span><small>days</small>
                  </div>
                  <button class="cd-icon-btn" onclick={() => openFullscreen(ev.id)} aria-label="Full screen {ev.name}" use:tooltip={{ text: "View fullscreen" }}><EyeIcon size={13}/></button>
                  <button class="cd-icon-btn cd-icon-btn--del" onclick={() => removeEvent(ev.id)} aria-label="Remove {ev.name}" use:tooltip={{ text: "Remove event" }}><Trash2Icon size={13}/></button>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      {/if}

      {#if pastEvents.length > 0}
        <Card class="cd-list-card">
          <CardHeader>
            <CardTitle>🎉 It happened</CardTitle>
            <CardDescription>Tap any event to celebrate.</CardDescription>
          </CardHeader>
          <CardContent class="cd-event-list">
            {#each pastEvents as ev}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <article class="cd-event-row cd-event-row--past cd-event-row--clickable" style="--cd-accent:{ev.accent}"
                onclick={() => { playCelebrationSound(); celebEventId = ev.id; }}
                onkeydown={(e) => { if (e.key === 'Enter') { playCelebrationSound(); celebEventId = ev.id; } }}
                role="button" tabindex="0"
              >
                <span class="cd-event-dot" style="background:{ev.accent}" aria-hidden="true"></span>
                <div class="cd-event-info">
                  <strong>{ev.name}</strong>
                  <span>{fmtDate(ev.targetMs)}</span>
                </div>
                <div class="cd-event-right">
                  <div class="cd-event-days">
                    <span>{Math.abs(daysTo(ev.targetMs))}</span><small>days ago</small>
                  </div>
                  <button class="cd-icon-btn cd-icon-btn--del" onclick={(e) => { e.stopPropagation(); removeEvent(ev.id); }} aria-label="Remove {ev.name}" use:tooltip={{ text: "Remove event" }}><Trash2Icon size={13}/></button>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      {/if}

      <!-- TiltCard celebration popup — dominates screen when an event is tapped -->
      {#if celebEvent}
        {const daysGone = Math.abs(daysTo(celebEvent.targetMs))}
        <TiltCard open={true} onClose={() => celebEventId = null} maxTilt={25}>
          <p class="tc-meta">{fmtDate(celebEvent.targetMs)}</p>
          <p class="tc-name">{celebEvent.name}</p>
          <div class="tc-banner" style="background:linear-gradient(135deg,{celebEvent.accent},color-mix(in srgb,{celebEvent.accent} 55%,#000))">
            <span class="tc-emoji">🎉</span>
            <div class="tc-banner-text">
              <strong>{daysGone}</strong>
              <span>{daysGone === 1 ? "day" : "days"} ago</span>
            </div>
          </div>
          {#if celebEvent.note}<p class="tc-note">{celebEvent.note}</p>{/if}
          <p class="tc-body">You set this goal and it happened. That's worth remembering.</p>
          <div class="tc-actions">
            <button class="tc-btn tc-btn--ghost" onclick={() => { navigator.clipboard.writeText(celebEvent!.name + " — " + fmtDate(celebEvent!.targetMs) + ". Tracked in Bento 🎉"); }}>Copy &amp; share</button>
            <button class="tc-btn tc-btn--primary" style="background:{celebEvent.accent}" onclick={() => celebEventId = null}>Done</button>
          </div>
          <p class="tc-hint">Esc or click outside to close</p>
        </TiltCard>
      {/if}

      {#if events.length === 0}
        <div class="cd-empty">
          <CalendarIcon size={32} class="cd-empty__icon" aria-hidden="true"/>
          <p>Nothing on the horizon.</p>
          <span>Tap "New event" to start counting down.</span>
        </div>
      {/if}

    <!-- ══ MILESTONES ══ -->
    {:else if selectedSection === "Milestones"}

      <div class="cd-milestone-grid">
        {#each milestones as ms}
          <Card class="cd-milestone-card" style="--cd-accent:{ms.accent}">
            <CardContent class="cd-milestone-body">
              <div class="cd-milestone-header">
                <div>
                  <h3 class="cd-milestone-name">{ms.name}</h3>
                  {#if ms.note}<p class="cd-milestone-note">{ms.note}</p>{/if}
                </div>
                <div class="cd-ms-actions">
                  <!-- Edit progress in place — this is the missing action -->
                  <button class="cd-icon-btn" onclick={() => startEditProgress(ms)} aria-label="Update progress for {ms.name}" use:tooltip={{ text: "Edit progress" }}><PencilIcon size={13}/></button>
                  <button class="cd-icon-btn cd-icon-btn--del" onclick={() => removeMilestone(ms.id)} aria-label="Remove {ms.name}" use:tooltip={{ text: "Remove milestone" }}><Trash2Icon size={13}/></button>
                </div>
              </div>

              <div class="cd-progress-wrap">
                <svg viewBox="0 0 80 80" class="cd-progress-ring" role="img" aria-label="{ms.progress}% complete">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="color-mix(in srgb, var(--border) 60%, transparent)" stroke-width="6"/>
                  <circle cx="40" cy="40" r="32" fill="none"
                    stroke={ms.accent} stroke-width="6" stroke-linecap="round"
                    stroke-dasharray="{(ms.progress / 100) * 2 * Math.PI * 32} {2 * Math.PI * 32}"
                    transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="45" text-anchor="middle" class="cd-progress-text">{ms.progress}%</text>
                </svg>
                <div class="cd-milestone-right">
                  <p class="cd-milestone-target">{fmtDate(ms.targetMs)}</p>
                  <p class="cd-milestone-days">
                    {#if isPast(ms.targetMs)}
                      <span class="cd-ms-past">Deadline passed</span>
                    {:else}
                      <strong>{daysTo(ms.targetMs)}</strong> days left
                    {/if}
                  </p>
                </div>
              </div>

              <div class="cd-progress-bar-wrap" role="progressbar" aria-valuenow={ms.progress} aria-valuemin={0} aria-valuemax={100}>
                <div class="cd-progress-bar" style="width:{ms.progress}%;background:{ms.accent}"></div>
              </div>
            </CardContent>
          </Card>
        {/each}
      </div>

      {#if milestones.length === 0}
        <div class="cd-empty">
          <FlagIcon size={32} class="cd-empty__icon" aria-hidden="true"/>
          <p>No milestones yet.</p>
          <span>Track what you're building, not just when.</span>
        </div>
      {/if}

    <!-- ══ BIRTHDAYS ══ -->
    {:else if selectedSection === "Birthdays"}

      {#if nextBirthday}
        <Card class="cd-bday-hero" style="--cd-accent:{nextBirthday.accent}">
          <CardContent class="cd-bday-hero__body">
            <CakeIcon size={28} class="cd-bday-icon" aria-hidden="true"/>
            <h2 class="cd-bday-hero__name">{nextBirthday.name}'s birthday</h2>
            <p class="cd-bday-days"><strong>{daysUntilBirthday(nextBirthday)}</strong> days away</p>
            <p class="cd-bday-hint">
              {fmtMonthDay(nextBirthday.month, nextBirthday.day)} — plan something worth remembering.
            </p>
          </CardContent>
        </Card>
      {/if}

      {#if birthdays.length > 0}
        <Card class="cd-list-card">
          <CardHeader>
            <CardTitle>Everyone's day</CardTitle>
            <CardDescription>Repeats every year — you never need to update them.</CardDescription>
          </CardHeader>
          <CardContent class="cd-event-list">
            {#each sortedBirthdays as bd}
              <article class="cd-event-row" style="--cd-accent:{bd.accent}">
                <span class="cd-event-dot" style="background:{bd.accent}" aria-hidden="true"></span>
                <div class="cd-event-info">
                  <strong>{bd.name}</strong>
                  <span>{fmtMonthDay(bd.month, bd.day)}</span>
                </div>
                <div class="cd-event-right">
                  <div class="cd-event-days" aria-label="{daysUntilBirthday(bd)} days until {bd.name}'s birthday">
                    <span>{daysUntilBirthday(bd)}</span><small>days</small>
                  </div>
                  <Badge variant="outline" class="cd-repeat-badge"><RepeatIcon size={10}/> Yearly</Badge>
                  <button class="cd-icon-btn cd-icon-btn--del" onclick={() => removeBirthday(bd.id)} aria-label="Remove {bd.name}" use:tooltip={{ text: "Remove birthday" }}><Trash2Icon size={13}/></button>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <div class="cd-empty">
          <CakeIcon size={32} class="cd-empty__icon" aria-hidden="true"/>
          <p>No birthdays yet.</p>
          <span>Tap "Add person" — they'll auto-repeat every year.</span>
        </div>
      {/if}

    <!-- ══ SINCE ══ -->
    {:else if selectedSection === "Since"}

      {#if pastEvents.length > 0}
        <Card class="cd-list-card">
          <CardHeader>
            <CardTitle>Days since it happened</CardTitle>
            <CardDescription>Past events flip here automatically.</CardDescription>
          </CardHeader>
          <CardContent class="cd-event-list">
            {#each pastEvents as ev}
              {const d = Math.abs(daysTo(ev.targetMs))}
              <article class="cd-event-row" style="--cd-accent:{ev.accent}">
                <span class="cd-event-dot" style="background:{ev.accent}" aria-hidden="true"></span>
                <div class="cd-event-info">
                  <strong>{ev.name}</strong>
                  <span>{fmtDate(ev.targetMs)}</span>
                </div>
                <div class="cd-event-right">
                  <div class="cd-since-block" aria-label="{d} days since {ev.name}">
                    <strong>{d}</strong>
                    <span>days ago</span>
                    {#if d >= 365}<small>{(d/365).toFixed(1)} yrs</small>
                    {:else if d >= 30}<small>~{Math.floor(d/30)} mo</small>{/if}
                  </div>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      {:else}
        <div class="cd-empty">
          <HistoryIcon size={32} class="cd-empty__icon" aria-hidden="true"/>
          <p>Nothing in the past yet.</p>
          <span>Once events pass their date, they appear here automatically.</span>
        </div>
      {/if}

    <!-- ══ EXPORT ══ -->
    {:else if selectedSection === "Export"}

      <Card class="cd-list-card">
        <CardHeader>
          <CardTitle>Take your data with you</CardTitle>
          <CardDescription>Export to any calendar app or keep a local backup.</CardDescription>
        </CardHeader>
        <CardContent class="cd-event-list">
          <article class="cd-event-row">
              <CalendarIcon size={18} class="cd-export-icon" aria-hidden="true"/>
              <div class="cd-event-info">
                <strong>Upcoming events (.csv)</strong>
                <span>All events with dates, categories, and notes.</span>
              </div>
              <Button variant="outline" size="sm" onclick={exportEventsCsv} disabled={exportLoading !== null}>
                <DownloadIcon data-icon="inline-start" size={13}/>
                {exportLoading === 'events' ? 'Exporting...' : 'Export'}
              </Button>
            </article>
            <article class="cd-event-row">
              <CakeIcon size={18} class="cd-export-icon" aria-hidden="true"/>
              <div class="cd-event-info">
                <strong>Birthdays (.csv)</strong>
                <span>All recurring birthdays with next occurrence dates.</span>
              </div>
              <Button variant="outline" size="sm" onclick={exportBirthdaysCsv} disabled={exportLoading !== null}>
                <DownloadIcon data-icon="inline-start" size={13}/>
                {exportLoading === 'birthdays' ? 'Exporting...' : 'Export'}
              </Button>
            </article>
            <article class="cd-event-row">
              <FlagIcon size={18} class="cd-export-icon" aria-hidden="true"/>
              <div class="cd-event-info">
                <strong>Milestone summary (.csv)</strong>
                <span>Goals, progress percentages, and deadlines.</span>
              </div>
              <Button variant="outline" size="sm" onclick={exportMilestonesCsv} disabled={exportLoading !== null}>
                <DownloadIcon data-icon="inline-start" size={13}/>
                {exportLoading === 'milestones' ? 'Exporting...' : 'Export'}
              </Button>
            </article>
        </CardContent>
      </Card>
    {/if}

  </div>

</main>

<style>
  :global(.cd-root) {
    padding: 28px 30px;
    box-sizing: border-box;
    overflow: hidden;
  }
  :global(.cd-root [data-slot="card"]) {
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--surface) 98%, var(--background)),
        color-mix(in srgb, var(--surface) 86%, var(--background))
      );
  }

  /* ── Header ── */
  .cd-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-shrink: 0;
  }
  .cd-page__intro { max-width: 56rem; }
  .cd-page__eyebrow {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    color: var(--muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .cd-page__title {
    margin: 0;
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    font-family: var(--font-display);
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .cd-page__desc {
    margin: 12px 0 0;
    max-width: 42rem;
    color: var(--muted);
    font-size: 0.97rem;
    line-height: 1.55;
    text-wrap: pretty;
  }
  .cd-page__actions {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }

  /* ── Main scroll area ── */
  .cd-main {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     OVERLAY / DRAWER
     Positioned fixed over the full window so backdrop-filter can blur the
     page content underneath (main content stays rendered).
  ──────────────────────────────────────────────────────────────────────────*/
  .cd-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: cd-fade-in 200ms ease;
  }

  @keyframes cd-fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Fullscreen countdown ── */
  .cd-overlay--fullscreen {
    background: var(--background);
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1.25rem;
  }

  .cd-overlay-close {
    position: absolute;
    top: 1.25rem; right: 1.25rem;
    width: 2.25rem; height: 2.25rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    display: flex; align-items: center; justify-content: center;
    cursor: default;
    transition: color 120ms, background 120ms;
  }
  .cd-overlay-close:hover { background: color-mix(in srgb, var(--foreground) 8%, transparent); color: var(--foreground); }

  .cd-fs-name {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.5rem);
    letter-spacing: -0.05em;
    color: var(--foreground);
    text-align: center;
    margin: 0;
  }

  .cd-fs-digits {
    display: flex;
    gap: 1.5rem;
    align-items: flex-end;
    flex-wrap: wrap;
    justify-content: center;
  }

  .cd-fs-digits span { display: flex; flex-direction: column; align-items: center; }
  .cd-fs-digits strong {
    font-family: var(--font-heading);
    font-size: clamp(3rem, 8vw, 7rem);
    letter-spacing: -0.06em;
    line-height: 1;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }
  .cd-fs-digits small { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-top: 0.25rem; }
  .cd-fs-secs strong { color: var(--primary); }

  .cd-fs-date { font-size: 0.85rem; color: var(--muted); margin: 0; }
  .cd-fs-past { font-size: 1.5rem; color: var(--muted); font-style: italic; margin: 0; }
  .cd-fs-hint { font-size: 0.75rem; color: var(--muted); opacity: 0.5; margin: 0; }

  /* ── Backdrop (full-cover dimmer with blur, click outside to close) ── */
  .cd-overlay--backdrop {
    background: color-mix(in srgb, var(--background) 60%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  /* ── Sheet panel (centered card inside backdrop) ── */
  .cd-sheet {
    position: relative;
    width: 100%;
    max-width: 480px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 2rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: cd-fade-in 200ms ease;
  }

  .cd-drawer-title {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    letter-spacing: -0.03em;
    color: var(--foreground);
    margin: 0 0 0.1rem;
  }

  .cd-drawer-sub {
    font-size: 0.82rem;
    color: var(--muted);
    margin: 0 0 0.75rem;
  }

  /* ── Form elements ── */
  .cd-form { display: flex; flex-direction: column; gap: 0.65rem; }

  .cd-input {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--surface) 70%, transparent);
    color: var(--foreground);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 150ms;
    font-family: inherit;
  }
  .cd-input:focus { border-color: var(--primary); }
  .cd-input[aria-invalid="true"] { border-color: #ef4444; }

  /* Date input: hide the default calendar icon on webkit — it's noisy */
  .cd-input--date::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }

  .cd-warn {
    font-size: 0.78rem;
    color: #ef4444;
    margin: -0.25rem 0 0;
  }

  .cd-bday-selects { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }

  .cd-form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.35rem; }

  .cd-range-label {
    font-size: 0.82rem;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .cd-range { width: 100%; accent-color: var(--primary); cursor: pointer; }

  /* ── Hero event card ── */
  .cd-hero {
    border-color: color-mix(in srgb, var(--cd-accent, var(--primary)) 30%, var(--border));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cd-accent, var(--primary)) 10%, var(--surface)),
      color-mix(in srgb, var(--cd-accent, var(--primary)) 4%, var(--background))
    );
    transition: border-color 180ms ease;
  }
  .cd-hero:hover {
    border-color: color-mix(in srgb, var(--cd-accent, var(--primary)) 55%, var(--border));
  }

  .cd-hero__body { padding: 1.5rem !important; display: flex; flex-direction: column; gap: 0.4rem; }

  .cd-hero__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .cd-fs-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    background: none;
    border: none;
    cursor: default;
    padding: 0;
    transition: color 150ms;
  }
  .cd-fs-trigger:hover { color: var(--foreground); }

  .cd-hero__name {
    font-family: var(--font-heading);
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    letter-spacing: -0.04em;
    line-height: 1.05;
    margin: 0.15rem 0 0;
    color: var(--foreground);
  }

  .cd-hero__date { font-size: 0.85rem; color: var(--muted); margin: 0; }
  .cd-hero__note { font-size: 0.8rem; color: var(--muted); margin: 0; font-style: italic; }

  /* ── Digit display ── */
  .cd-digits { display: flex; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap; }

  .cd-digit {
    display: flex; flex-direction: column; align-items: center;
    min-width: 3.5rem; padding: 0.6rem 0.75rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--foreground) 6%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    transition: background 150ms;
  }
  .cd-digit:hover {
    background: color-mix(in srgb, var(--foreground) 10%, var(--surface));
  }

  .cd-digit strong {
    font-family: var(--font-heading);
    font-size: 2rem;
    letter-spacing: -0.05em;
    line-height: 1;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }

  .cd-digit span {
    font-size: 0.65rem; color: var(--muted); font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.2rem;
  }

  .cd-digit--secs strong { color: var(--cd-accent, var(--primary)); font-size: 1.6rem; font-variant-numeric: tabular-nums; }

  /* ── Urgency states ── */
  :global(.cd-urgency--today)    { border-color: #ef4444 !important; }
  :global(.cd-urgency--tomorrow) { border-color: #f59e0b !important; }
  :global(.cd-urgency--soon)     { border-color: color-mix(in srgb, #f59e0b 40%, var(--border)) !important; }

  /* ── Event list ── */
  .cd-list-card { border-color: color-mix(in srgb, var(--border) 70%, transparent); }
  .cd-list-card--past { opacity: 0.7; }

  .cd-event-list { display: flex; flex-direction: column; gap: 0; padding: 0 !important; }

  .cd-event-row {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.65rem 1.25rem;
    transition: background 120ms;
  }
  .cd-event-row:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .cd-event-row:last-child { border-radius: 0 0 0.75rem 0.75rem; }
  .cd-event-row--past { opacity: 0.6; }

  .cd-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  .cd-event-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
  .cd-event-info strong { font-size: 0.875rem; color: var(--foreground); }
  .cd-event-info span   { font-size: 0.75rem;  color: var(--muted); }
  .cd-event-note { font-size: 0.72rem; color: var(--muted); margin: 0; font-style: italic; }

  .cd-event-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }

  .cd-event-days {
    display: flex; flex-direction: column; align-items: flex-end;
    font-family: var(--font-heading); font-size: 1.3rem; letter-spacing: -0.04em; color: var(--foreground);
  }
  .cd-event-days small { font-size: 0.65rem; color: var(--muted); font-family: var(--font-body); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }

  :global(.cd-repeat-badge) { font-size: 0.65rem !important; padding: 0.1rem 0.4rem !important; gap: 0.2rem; }

  .cd-icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 1.75rem; height: 1.75rem; border-radius: 0.5rem;
    border: none; background: transparent; color: var(--muted);
    cursor: default; transition: background 120ms, color 120ms;
  }
  .cd-icon-btn:hover { background: color-mix(in srgb, var(--foreground) 8%, transparent); color: var(--foreground); }
  .cd-icon-btn--del:hover { background: color-mix(in srgb, #ef4444 14%, transparent); color: #ef4444; }

  /* ── Since ── */
  .cd-since-block { display: flex; flex-direction: column; align-items: flex-end; }
  .cd-since-block strong { font-family: var(--font-heading); font-size: 1.4rem; letter-spacing: -0.04em; color: var(--foreground); font-variant-numeric: tabular-nums; }
  .cd-since-block span  { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .cd-since-block small { font-size: 0.7rem; color: var(--muted); }

  /* ── Birthday hero ── */
  .cd-bday-hero {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cd-accent, #ec4899) 12%, var(--surface)),
      color-mix(in srgb, var(--cd-accent, #ec4899) 4%, var(--background))
    );
    border-color: color-mix(in srgb, var(--cd-accent, #ec4899) 25%, var(--border));
    transition: border-color 180ms ease;
  }
  .cd-bday-hero:hover {
    border-color: color-mix(in srgb, var(--cd-accent, #ec4899) 55%, var(--border));
  }
  .cd-bday-hero__body { padding: 1.5rem !important; display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-start; }
  :global(.cd-bday-icon) { color: var(--cd-accent, #ec4899); margin-bottom: 0.25rem; }
  .cd-bday-hero__name { font-family: var(--font-heading); font-size: 1.6rem; letter-spacing: -0.04em; margin: 0; color: var(--foreground); }
  .cd-bday-days { margin: 0; font-size: 0.9rem; color: var(--muted); }
  .cd-bday-days strong { font-size: 1.5rem; font-family: var(--font-heading); letter-spacing: -0.04em; color: var(--cd-accent, #ec4899); font-variant-numeric: tabular-nums; }
  .cd-bday-hint { font-size: 0.82rem; color: var(--muted); margin: 0; }

  /* ── Milestones ── */
  .cd-milestone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.25rem; }

  .cd-milestone-card {
    border-color: color-mix(in srgb, var(--cd-accent, var(--border)) 20%, var(--border));
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--cd-accent, var(--surface)) 5%, var(--surface) 98%, var(--background)),
        color-mix(in srgb, var(--cd-accent, var(--surface)) 3%, var(--surface) 86%, var(--background))
      );
    transition: border-color 150ms, background 150ms;
  }
  .cd-milestone-card:hover {
    border-color: color-mix(in srgb, var(--cd-accent, var(--border)) 45%, var(--border));
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--cd-accent, var(--surface)) 9%, var(--surface) 98%, var(--background)),
        color-mix(in srgb, var(--cd-accent, var(--surface)) 5%, var(--surface) 86%, var(--background))
      );
  }
  :global(.cd-milestone-card .card-content) { padding: 1.75rem !important; }
  .cd-progress-ring { width: 100px; height: 100px; flex-shrink: 0; }
  .cd-progress-text { font-size: 16px; }

  .cd-milestone-body { display: flex; flex-direction: column; gap: 0.75rem; }
  .cd-milestone-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
  .cd-ms-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
  .cd-milestone-name { font-size: 1rem; font-weight: 700; color: var(--foreground); margin: 0; }
  .cd-milestone-note { font-size: 0.77rem; color: var(--muted); margin: 0.2rem 0 0; font-style: italic; }

  .cd-progress-wrap { display: flex; align-items: center; gap: 1rem; }
  .cd-progress-ring { width: 80px; height: 80px; flex-shrink: 0; }
  .cd-progress-text { font-family: var(--font-heading); font-size: 14px; fill: var(--foreground); font-weight: 700; }
  .cd-milestone-right { display: flex; flex-direction: column; gap: 0.25rem; }
  .cd-milestone-target { font-size: 0.8rem; color: var(--muted); margin: 0; }
  .cd-milestone-days { font-size: 0.85rem; margin: 0; color: var(--foreground); }
  .cd-milestone-days strong { font-family: var(--font-heading); font-size: 1.3rem; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  .cd-ms-past { color: var(--muted); font-style: italic; }

  .cd-progress-bar-wrap { height: 4px; border-radius: 9999px; background: color-mix(in srgb, var(--border) 60%, transparent); overflow: hidden; }
  .cd-progress-bar { height: 100%; border-radius: 9999px; transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1); }

  /* ── Export ── */
  :global(.cd-export-icon) { color: var(--muted); flex-shrink: 0; }

  /* ── Empty states ── */
  .cd-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.5rem; padding: 3rem 1.5rem; text-align: center; color: var(--muted);
  }
  :global(.cd-empty__icon) { opacity: 0.35; margin-bottom: 0.5rem; }
  .cd-empty p    { font-size: 0.95rem; font-weight: 600; color: var(--foreground); margin: 0; }
  .cd-empty span { font-size: 0.82rem; margin: 0; max-width: 28rem; }

  :global(.cd-category-badge) { font-size: 0.7rem !important; }

  /* ── Clickable past event row ── */
  .cd-event-row--clickable { cursor: pointer; }
  .cd-event-row--clickable:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }

  /* ── TiltCard content styles ── */
  .tc-meta {
    font-size: 0.72rem;
    font-family: monospace;
    color: var(--muted);
    margin: 0 0 0.25rem;
  }
  .tc-name {
    font-size: 1.25rem;
    font-weight: 700;
    font-family: var(--font-heading);
    letter-spacing: -0.03em;
    color: var(--foreground);
    margin: 0 0 0.75rem;
    line-height: 1.1;
  }
  .tc-banner {
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .tc-emoji { font-size: 2rem; line-height: 1; flex-shrink: 0; }
  .tc-banner-text { display: flex; flex-direction: column; }
  .tc-banner-text strong {
    font-family: var(--font-heading);
    font-size: 2rem;
    letter-spacing: -0.05em;
    line-height: 1;
    color: #fff;
  }
  .tc-banner-text span { font-size: 0.75rem; color: rgba(255,255,255,0.7); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .tc-note { font-size: 0.78rem; color: var(--muted); font-style: italic; margin: 0 0 0.5rem; }
  .tc-body { font-size: 0.82rem; color: var(--muted); margin: 0 0 1rem; line-height: 1.5; }
  .tc-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .tc-btn {
    padding: 0.4rem 1rem; border-radius: 0.5rem; font: inherit;
    font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none;
  }
  .tc-btn--ghost { background: color-mix(in srgb, var(--foreground) 8%, transparent); color: var(--foreground); }
  .tc-btn--ghost:hover { background: color-mix(in srgb, var(--foreground) 14%, transparent); }
  .tc-btn--primary { color: #fff; }
  .tc-btn--primary:hover { filter: brightness(1.1); }
  .tc-hint { font-size: 0.65rem; color: var(--muted); opacity: 0.45; text-align: center; margin: 0.5rem 0 0; }
</style>
