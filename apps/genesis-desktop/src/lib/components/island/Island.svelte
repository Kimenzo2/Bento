<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { invokeWithTimeout } from "$lib/ipc";
  import { islandStore } from "$lib/stores/island.store.svelte";
  import type { IslandItem } from "$lib/data/island-catalog";
  import { islandItems } from "$lib/data/island-catalog";
  import { getIcon } from "./island-icons";
  import { loadBuiltinWidgets } from "./widgets/widget-config";
  import { widgetStore } from "$lib/stores/widget.store.svelte";
  import { initWidgetData } from "$lib/stores/widget-data.svelte";
  import NotesWidget from "./widgets/NotesWidget.svelte";
  import MediaPlayerWidget from "./widgets/MediaPlayerWidget.svelte";
  import TaskWidget from "./widgets/TaskWidget.svelte";
  import ModuleActive from "./ModuleActive.svelte";

  // ── Diagnostics (DEV only — tree-shaken in production) ──
  const DIAG = import.meta.env.DEV;
  let diagModeChanges = 0;
  let diagEscapeCount = 0;
  let diagClickListenerCount = 0;
  let diagKeydownCount = 0;
  let diagLastModeChange = 0;
  let diagWatchdogInterval: ReturnType<typeof setInterval> | null = null;
  let diagMountTime = Date.now();
  let diagListenerLeakCheck = false;

  // Animation/interruption tracking
  let islandEl = $state<HTMLElement | null>(null);
  let diagTransitionCount = 0;
  let diagTransitionInterruptions = 0;
  let diagTransitionStartTime = 0;
  let diagLastTransitionProperty = "";
  let diagInvokeTimeout = 5000;
  let diagVisibilityHiddenCount = 0;

  // ── Three-phase choreography state ──
  let choreoClass = $state<"goo-expand" | "goo-collapse" | "">("");
  // Track whether the current expand used choreography (for matching collapse)
  let usedChoreography = $state(false);
  // Generation counter guards against stale RAF callbacks when expand/collapse
  // are rapidly interleaved (e.g. collapse triggered before expand RAF fires).
  let expandGeneration = $state(0);
  // Guards the initial frame where mode=expanded but the Tauri window
  // resize hasn't applied yet. The panel exists in the DOM but stays
  // invisible until the goo animation starts via RAF.
  let gooPending = $state(false);
  let expandTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let collapseTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let isIslandExpanded = $derived(islandStore.mode === "expanded" || choreoClass !== "");

  // Must stay in sync with CSS transition duration (shell width/height: 0.55s)
  // and the CSS @keyframes durations (goo-expand-keyframes: 500ms, goo-collapse-keyframes: 550ms).
  const EXPAND_ANIM_MS = 500;
  const COLLAPSE_ANIM_MS = 550;
  const EXPAND_TIMEOUT_MS = EXPAND_ANIM_MS + 50;  // 50ms buffer after animation settles
  const COLLAPSE_TIMEOUT_MS = COLLAPSE_ANIM_MS + 50;

  // SVG gooey filter — only active during transition to avoid perf hit
  let gooFilterActive = $state(false);

  if (DIAG) {
    console.log("[island-diag] Island.svelte mounted at", new Date().toISOString());
  }

  const layoutGridIcon = getIcon("layout-grid");
  const clockIcon = getIcon("clock");
  const layoutDashboardIcon = getIcon("layout-dashboard");
  const searchIcon = getIcon("search");
  const xIcon = getIcon("x");
  const chevronDownIcon = getIcon("chevron-down");

  let { handleLaunch = (item: IslandItem) => {}, handleQuickAction = (action: string, item: IslandItem) => {} }: {
    handleLaunch?: (item: IslandItem) => void;
    handleQuickAction?: (action: string, item: IslandItem) => void;
  } = $props();

  let appGridEl = $state<HTMLElement | null>(null);
  let searchActive = $state(false);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  // ── Diagnostics: mode change watcher ──
  let diagPrevMode = islandStore.mode;
  $effect(() => {
    const mode = islandStore.mode;
    if (mode !== diagPrevMode) {
      diagModeChanges++;
      diagLastModeChange = Date.now();
      if (DIAG) console.log(`[island-diag] mode change #${diagModeChanges}: ${diagPrevMode} -> ${mode} (${new Date().toISOString()})`);
      diagPrevMode = mode;
    }
  });

  // ── Live recording timer for compact state ──
  let compactTimerStart = $state(0);
  let compactElapsed = $state(0);

  $effect(() => {
    const isRecording = islandStore.activeModule?.activityType === "recording";
    if (!isRecording) {
      compactElapsed = 0;
      return;
    }
    compactTimerStart = Date.now();
    const interval = setInterval(() => {
      compactElapsed = Math.floor((Date.now() - compactTimerStart) / 1000);
    }, 200);
    return () => clearInterval(interval);
  });

  // ── Live clock for compact idle state (no active module) ──
  let compactClock = $state("");

  $effect(() => {
    const showClock = !islandStore.activeModule;
    if (!showClock) {
      compactClock = "";
      return;
    }
    function updateClock() {
      const now = new Date();
      compactClock = now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    updateClock();
    const interval = setInterval(updateClock, 30_000);
    return () => clearInterval(interval);
  });

  // ── Task notification for compact notch ──
  let taskCount = $state(0);
  let taskNotificationDismissed = $state(false);
  let taskFetchInProgress = $state(false);

  async function fetchTaskCount() {
    // Guard against concurrent fetches
    if (taskFetchInProgress) return;
    taskFetchInProgress = true;
    try {
      // Lightweight count — no auth required, just a COUNT(*) query
      const cnt = await invokeWithTimeout<number>("get_task_count", undefined, 3_000);
      taskCount = cnt ?? 0;
      // Reset dismiss flag when count changes
      if (taskCount > 0) {
        taskNotificationDismissed = false;
      }
    } catch (e) {
      // Silently fail - don't spam console during IPC congestion
      taskCount = 0;
    } finally {
      taskFetchInProgress = false;
    }
  }

  function dismissTaskNotification() {
    taskNotificationDismissed = true;
    taskCount = 0;
  }

  // Fetch task count on mount and refresh every 10 minutes (not 5)
  // This avoids competing with get_dashboard_data for database connections
  $effect(() => {
    // Delay initial fetch by 3s to let other IPC calls settle
    const initTimer = setTimeout(fetchTaskCount, 3000);
    const interval = setInterval(fetchTaskCount, 10 * 60 * 1000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  });

  // ── Notification click handler (triggers choreography) ──
  function onNotificationClick() {
    if (taskCount > 0 && !taskNotificationDismissed) {
      // Notification present → choreography expand into the task island
      expandWithChoreography();
      // Set active module to tasks for display
      islandStore.activateModule({
        id: "tasks",
        label: "Tasks",
        icon: "clipboard-list",
        status: `${taskCount} pending`,
      });
      // Dismiss notification after viewing
      dismissTaskNotification();
    } else {
      // No notification → normal expand to widget panel
      expandNormal();
    }
  }

  function formatClock(seconds: number): string {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const accentColorCache = new Map<string, string>();
  function getAccentColor(id: string): string {
    let c = accentColorCache.get(id);
    if (!c) {
      const item = islandItems.find((i) => i.id === id);
      c = item?.accentColor ?? "oklch(0.571 0.206 277.056)";
      accentColorCache.set(id, c);
    }
    return c;
  }

  function closeSearch() {
    searchActive = false;
    islandStore.searchQuery = "";
  }

  /**
   * Normal expand — uses the original spring CSS transition only.
   * Called by: compact body click, Escape, click-outside, close button.
   */
  function expandNormal() {
    if (islandStore.mode === "expanded") return;
    usedChoreography = false;
    choreoClass = "";
    islandStore.expand();
  }

  /**
   * Collapse after a normal expand — original spring, no choreography.
   */
  function collapseNormal() {
    if (islandStore.mode === "compact") return;
    usedChoreography = false;
    choreoClass = "";
    islandStore.collapse();
  }

  /**
   * Expand with gooey SVG-filter detachment animation.
   * Reserved for: specific widget/notification taps inside the notch.
   *
   * A container wrapping both the notch and panel has `filter: url(#goo)`
   * applied during the transition. The SVG filter (feGaussianBlur + feColorMatrix)
   * fuses the two shapes' blurred alpha channels, creating a liquid-looking
   * connecting neck that stretches and snaps as the panel moves away from
   * the notch — no hand-animated blob paths needed.
   *
   * The filter is removed after the settle to restore GPU perf.
   */
  function expandWithChoreography() {
    if (islandStore.mode === "expanded") return;
    usedChoreography = true;
    const gen = ++expandGeneration;
    gooPending = true;
    // Resize the Tauri window FIRST so the goo content isn't clipped
    // inside the still-compact 260×50 window.
    islandStore.expand();
    // Wait one frame for the Tauri window resize to apply, THEN start
    // the CSS goo animation. The panel exists in the DOM but stays
    // hidden via CSS until gooPending is cleared below.
    requestAnimationFrame(() => {
      if (gen !== expandGeneration) return;
      gooPending = false;
      choreoClass = "goo-expand";
      gooFilterActive = true;
    });
    expandTimeout = setTimeout(() => {
      if (gen !== expandGeneration) return;
      choreoClass = "";
      gooFilterActive = false;
      expandTimeout = null;
    }, EXPAND_TIMEOUT_MS);
  }

  /**
   * Collapse with reverse gooey reattachment.
   * The goo filter is reapplied so the returning panel re-fuses
   * into the notch visually as it springs back upward.
   */
  function collapseWithChoreography() {
    if (islandStore.mode === "compact") return;
    expandGeneration++; // cancel any pending expand RAF callback
    gooPending = false;
    choreoClass = "goo-collapse";
    gooFilterActive = true;
    collapseTimeout = setTimeout(() => {
      choreoClass = "";
      gooFilterActive = false;
      islandStore.collapse();
      usedChoreography = false;
      collapseTimeout = null;
    }, COLLAPSE_TIMEOUT_MS);
  }

  /** Collapse — dispatches to choreography or normal based on how we expanded. */
  function triggerCollapse() {
    if (usedChoreography) {
      collapseWithChoreography();
    } else {
      collapseNormal();
    }
  }

  function onLaunch(item: IslandItem) {
    if (DIAG) console.log(`[island-diag] onLaunch(${item.id})`);
    closeSearch();
    islandStore.pushRecent(item.id);
    handleLaunch(item);
    triggerCollapse();
  }

  function onQuickAction(action: string, item: IslandItem) {
    if (DIAG) console.log(`[island-diag] onQuickAction(${action}, ${item.id})`);
    closeSearch();
    islandStore.pushRecent(item.id);
    handleQuickAction(action, item);
    // Don't collapse — the parent handler keeps the island open
    // and switches to module-active view.
  }

  function onKeydown(e: KeyboardEvent) {
    diagKeydownCount++;
    const target = e.target as HTMLElement;
    const inWidget = target.closest(".widget-card-w") || target.closest(".widget-wrapper");

    if (e.key === "Escape") {
      diagEscapeCount++;
      if (DIAG) console.log(`[island-diag] Escape pressed (#${diagEscapeCount}), mode=${islandStore.mode}, searchActive=${searchActive}, inWidget=${!!inWidget}`);
      if (inWidget) {
        if (DIAG) console.log("[island-diag] Escape ignored — inside widget");
        return;
      }
      if (searchActive) {
        if (DIAG) console.log("[island-diag] Escape closes search");
        searchActive = false;
        islandStore.searchQuery = "";
        return;
      }
      if (DIAG) console.log("[island-diag] Escape collapses island");
      triggerCollapse();
    }
  }

  function toggleSearch() {
    searchActive = !searchActive;
    if (searchActive) {
      islandStore.searchQuery = "";
      requestAnimationFrame(() => searchInputEl?.focus());
    } else {
      islandStore.searchQuery = "";
    }
  }

  function onClickOutside(e: MouseEvent) {
    diagClickListenerCount++;
    const target = e.target as HTMLElement;
    const insideIsland = target.closest(".island");
    if (islandStore.mode === "expanded") {
      if (!insideIsland) {
        if (DIAG) console.log(`[island-diag] click outside island — collapsing (click #${diagClickListenerCount})`);
        triggerCollapse();
      }
    }
  }

  // ── Diagnostics: invoke timeout tracking ──
  // Uses imported invokeWithTimeout from $lib/ipc. Timeout detection is
  // handled by invokeWithTimeout's Promise.race (the caught error is silently
  // discarded — the watchdog can't see it from here).

  // ── Diagnostics: transitionend handler ──
  function onTransitionEnd(e: TransitionEvent) {
    diagTransitionCount++;
    const elapsed = diagTransitionStartTime ? Date.now() - diagTransitionStartTime : 0;
    const prop = e.propertyName;
    if (DIAG) console.log(`[island-diag] transitionend #${diagTransitionCount}: property=${prop}, elapsed=${elapsed}ms, mode=${islandStore.mode}`);
    diagLastTransitionProperty = prop;
    diagTransitionStartTime = 0;
  }

  // ── Diagnostics: track animation interruptions ──
  function onTransitionRun(e: TransitionEvent) {
    if (diagTransitionStartTime > 0) {
      diagTransitionInterruptions++;
      if (DIAG) console.warn(`[island-diag] TRANSITION INTERRUPTION #${diagTransitionInterruptions}: ${diagLastTransitionProperty} interrupted by ${e.propertyName}`);
    }
    diagTransitionStartTime = Date.now();
    diagLastTransitionProperty = e.propertyName;
  }

  function getGridColumns(): number {
    if (!appGridEl) return 2;
    const first = appGridEl.querySelector<HTMLElement>(".widget-card");
    if (!first) return 2;
    const containerWidth = appGridEl.offsetWidth;
    const cardWidth = first.offsetWidth;
    if (!cardWidth) return 2;
    return Math.max(1, Math.round(containerWidth / (cardWidth + 8)));
  }

  function handleGridKeydown(e: KeyboardEvent) {
    const buttons = appGridEl?.querySelectorAll<HTMLButtonElement>(".widget-card");
    if (!buttons?.length) return;
    const cols = getGridColumns();
    const currentIndex = Array.from(buttons).findIndex((b) => b === document.activeElement);

    if (e.key === "Enter") {
      e.preventDefault();
      const btn = buttons[currentIndex];
      if (btn) {
        const id = btn.dataset.itemId;
        if (id) {
          const item = islandStore.filteredItems.find((i) => i.id === id);
          if (item) onLaunch(item);
        }
      }
      return;
    }

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
    else if (e.key === "ArrowLeft") nextIndex = Math.max(currentIndex - 1, 0);
    else if (e.key === "ArrowDown") nextIndex = Math.min(currentIndex + cols, buttons.length - 1);
    else if (e.key === "ArrowUp") nextIndex = Math.max(currentIndex - cols, 0);
    else return;
    e.preventDefault();
    buttons[nextIndex]?.focus();
  }

  onMount(() => {
    loadBuiltinWidgets();
    widgetStore.load();
    initWidgetData();
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("mousedown", onClickOutside);
    if (islandEl) {
      islandEl.addEventListener("transitionend", onTransitionEnd);
      islandEl.addEventListener("transitionrun", onTransitionRun);
    }
    const onVisibilityChange = () => {
      if (document.hidden) {
        diagVisibilityHiddenCount++;
        if (DIAG) console.log(`[island-diag] page hidden #${diagVisibilityHiddenCount} (mode=${islandStore.mode})`);
      } else {
        if (DIAG) console.log(`[island-diag] page visible (mode=${islandStore.mode}, was hidden ${diagVisibilityHiddenCount} times)`);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    diagListenerLeakCheck = true;
    if (DIAG) console.log(`[island-diag] onMount complete — listeners registered, islandEl=${!!islandEl}`);

    if (DIAG) {
      diagWatchdogInterval = setInterval(() => {
        const warnings = islandStore.healthCheck();
        if (diagTransitionStartTime > 0 && Date.now() - diagTransitionStartTime > 6000) {
          const stuck = `[island-diag] TRANSITION STUCK for ${((Date.now() - diagTransitionStartTime) / 1000).toFixed(1)}s on ${diagLastTransitionProperty}`;
          console.warn(stuck);
          warnings.push(stuck);
          diagTransitionStartTime = 0;
        }
        // invoke timeout detection is handled by invokeWithTimeout (ipc.ts)
        // and is not accessible from this component's scope.
        if (warnings.length > 0) {
          console.warn(`[island-diag] Watchdog health check FAILED:`);
          warnings.forEach((w) => console.warn(`  ${w}`));
        }
      }, 10_000);
    }

    return () => {
      const uptime = Date.now() - diagMountTime;
      if (DIAG) console.log(`[island-diag] onDestroy: cleaning up (mounted ${uptime}ms, modeChanges=${diagModeChanges})`);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (islandEl) {
        islandEl.removeEventListener("transitionend", onTransitionEnd);
        islandEl.removeEventListener("transitionrun", onTransitionRun);
      }
      if (diagWatchdogInterval) {
        clearInterval(diagWatchdogInterval);
        diagWatchdogInterval = null;
      }
      // Clean up global stress-test harness to prevent stale references
      if (DIAG && typeof window !== "undefined") {
        delete (window as any).__islandDiagnostics;
        delete (window as any).__stressIsland;
        delete (window as any).__stressIslandRapid;
      }
      if (expandTimeout) {
        clearTimeout(expandTimeout);
        expandTimeout = null;
      }
      if (collapseTimeout) {
        clearTimeout(collapseTimeout);
        collapseTimeout = null;
      }
      if (DIAG) console.log(`[island-diag] cleanup complete — keydown=${diagKeydownCount}, escape=${diagEscapeCount}, clickOutside=${diagClickListenerCount}, transitions=${diagTransitionCount}, interruptions=${diagTransitionInterruptions}`);
    };
  });

  // ── Diagnostics: global stress test harness (DEV only) ──
  if (DIAG && typeof window !== "undefined") {
    (window as any).__islandDiagnostics = {
      store: islandStore,
      expand: () => expandNormal(),
      collapse: () => collapseNormal(),
      toggle: () => islandStore.mode === "compact" ? expandNormal() : collapseNormal(),
      healthCheck: () => islandStore.healthCheck(),
      runHealthCheck: () => islandStore.runHealthCheck(),
      // Expose choreography variants for testing
      expandChoreo: () => expandWithChoreography(),
      collapseChoreo: () => collapseWithChoreography(),
    };
    (window as any).__stressIsland = async function(options?: {
      iterations?: number;
      interval?: number;
      randomDelay?: boolean;
    }) {
      const iters = options?.iterations ?? 20;
      const baseInterval = options?.interval ?? 200;
      const randomDelay = options?.randomDelay ?? true;
      const results: { action: string; time: number; ok: boolean }[] = [];

      console.log(`[stress] Starting island stress test: ${iters} iterations`);

      for (let i = 0; i < iters; i++) {
        const action = i % 2 === 0 ? "expand" : "collapse";
        const start = performance.now();

        try {
          if (action === "expand") {
            expandNormal();
          } else {
            collapseNormal();
          }
          const elapsed = performance.now() - start;
          results.push({ action, time: elapsed, ok: true });
          console.log(`[stress] #${i + 1}/${iters} ${action} OK (${elapsed.toFixed(1)}ms)`);
        } catch (e) {
          const elapsed = performance.now() - start;
          results.push({ action, time: elapsed, ok: false });
          console.error(`[stress] #${i + 1}/${iters} ${action} FAILED:`, e);
        }

        const delay = randomDelay
          ? baseInterval + Math.random() * 300
          : baseInterval;
        await new Promise((r) => setTimeout(r, delay));
      }

      const finalHealth = islandStore.healthCheck();
      console.log(`[stress] Complete. ${results.filter((r) => r.ok).length}/${iters} OK`);
      if (finalHealth.length > 0) {
        console.error(`[stress] Health check FAILED:`, finalHealth);
      } else {
        console.log(`[stress] Health check PASSED`);
      }
      return { results, finalHealth };
    };

    (window as any).__stressIslandRapid = async function(options?: {
      bursts?: number;
      perBurst?: number;
      minDelay?: number;
      maxDelay?: number;
    }) {
      const bursts = options?.bursts ?? 5;
      const perBurst = options?.perBurst ?? 10;
      const minDelay = options?.minDelay ?? 30;
      const maxDelay = options?.maxDelay ?? 150;
      let totalOps = 0;
      let failures = 0;

      console.log(`[stress-rapid] Starting RAPID stress: ${bursts} bursts x ${perBurst} ops, delay ${minDelay}-${maxDelay}ms`);

      for (let b = 0; b < bursts; b++) {
        console.log(`[stress-rapid] Burst ${b + 1}/${bursts}`);
        for (let i = 0; i < perBurst; i++) {
          const expand = Math.random() > 0.5;
          try {
            if (expand) expandNormal();
            else collapseNormal();
            totalOps++;
          } catch (e) {
            failures++;
            console.error(`[stress-rapid] FAIL at op ${totalOps}:`, e);
          }
          await new Promise((r) => setTimeout(r, minDelay + Math.random() * (maxDelay - minDelay)));
        }
        console.log(`[stress-rapid] Burst ${b + 1} complete. Waiting 500ms for settle...`);
        await new Promise((r) => setTimeout(r, 500));
      }

      await new Promise((r) => setTimeout(r, 2000));
      const finalHealth = islandStore.healthCheck();
      if (finalHealth.length > 0) {
        console.error(`[stress-rapid] HEALTH CHECK FAILED after ${totalOps} ops:`, finalHealth);
      } else {
        console.log(`[stress-rapid] Complete: ${totalOps} ops, ${failures} failures, health PASSED`);
      }
      return { totalOps, failures, finalHealth };
    };
  }
</script>

<div
  class="island island-overlay"
  class:island-overlay--expanded={isIslandExpanded}
>
  <div
    class="island-shell"
    class:island-shell--normal={!islandStore.activeModule}
    class:island-shell--active={!!islandStore.activeModule}
    class:island-shell--shell={islandStore.mode === "expanded" && !islandStore.activeModule}
    class:island-shell--widget={islandStore.mode === "expanded" && !!islandStore.activeModule}
    class:island-shell--task={islandStore.mode === "expanded" && islandStore.activeModule?.id === "tasks"}
    class:island-shell--expanded={isIslandExpanded}
    bind:this={islandEl}
  >
    <!-- ════════════════════════════════════════════════════════════
         GOOEY FILTER CONTAINER
         Wraps both .island-notch (stationary) and .island-panel
         (moving) so the SVG filter composites their blurred alpha
         channels together before the contrast pass. The goo filter
         is ONLY active during transitions — class:goo-active adds
         filter: url(#goo) which fuses the two shapes into a single
         liquid form connected by an organic stretched "neck" that
         appears automatically from the blur overlap.
         ════════════════════════════════════════════════════════ -->
     <div class="goo-container" class:goo-active={gooFilterActive} style="--goo-expand-duration: {EXPAND_ANIM_MS}ms; --goo-collapse-duration: {COLLAPSE_ANIM_MS}ms">
      <!-- SVG filter: feGaussianBlur (soft edges) → feColorMatrix (crisp alpha with steep contrast, fusing overlapping blur into one connected shape) -->
      <svg class="goo-svg" aria-hidden="true">
        <defs>
            <!--
              Goo filter: blur softens both shapes' edges; the color matrix
              re-sharpens alpha with a steep slope so overlapping blurs fuse
              into one connected form ("metaball" effect).

              Alpha formula: A' = A * 19 - 8 → zero-cross at ~42% opacity.
              Higher multiplier = tighter threshold = bridge forms later.
              17-19 range avoids banding artifacts on Safari iOS (>20 triggers
              banding). 19 -8 keeps the effective threshold close to the
              original 22 -9 (zero-cross ~41%) while staying Safari-safe.
              stdDeviation of 14 provides ~68px of effective blur overlap
              for reliable connection at the animation's starting position.
            -->
            <filter id="goo" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 19 -8"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="over" />
            </filter>
        </defs>
      </svg>
      <div
        class="island-notch"
        class:island-notch--normal={!islandStore.activeModule}
        class:island-notch--hidden={!!islandStore.activeModule}
        class:island-notch--compact={islandStore.mode === "compact"}
        class:notch-morph={choreoClass === "goo-expand"}
      >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="compact-body"
        class:compact-body--live={!!islandStore.activeModule}
        class:compact-body--notification={taskCount > 0 && !taskNotificationDismissed && !islandStore.activeModule}
        in:fade={{ duration: 350, easing: cubicOut }}
        out:fade={{ duration: 120 }}
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
          if (DIAG) console.log(`[island-diag] compact-body click — expanding, activeModule=${!!islandStore.activeModule}`);
          onNotificationClick();
        }}
        role="button"
        tabindex="0"
        aria-label={islandStore.activeModule ? `Show ${islandStore.activeModule.label}` : taskCount > 0 && !taskNotificationDismissed ? `${taskCount} tasks due` : "Open Bento notes and media"}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (DIAG) console.log(`[island-diag] compact-body keydown(${e.key}) — expanding`);
            onNotificationClick();
          }
        }}
      >
        {#if islandStore.activeModule}
          {const CompactActiveIcon = getIcon(islandStore.activeModule.icon)}
          <div class="compact-live">
            <span class="compact-live-icon" style="color: {getAccentColor(islandStore.activeModule.id)}">
              <CompactActiveIcon size={12} strokeWidth={2.2} />
            </span>
            <span class="compact-live-label">{islandStore.activeModule.label}</span>
            <span class="compact-live-status">
              {#if islandStore.activeModule.activityType === "recording"}
                {formatClock(compactElapsed)}
                <span class="compact-live-dot"></span>
              {:else}
                {islandStore.activeModule.status}
              {/if}
            </span>
          </div>
        {:else if taskCount > 0 && !taskNotificationDismissed}
          <div class="compact-notification">
            <span class="compact-notification-icon">
              <layoutGridIcon size={11} strokeWidth={2.1}></layoutGridIcon>
            </span>
            <span class="compact-notification-text">{taskCount} tasks today</span>
          </div>
        {:else}
          <div class="compact-clock">
            <span class="compact-clock-time">{compactClock}</span>
          </div>
        {/if}
      </div>
    </div>
    {#if isIslandExpanded}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="island-panel"
        class:island-panel--widget={!!islandStore.activeModule}
        class:island-panel--task={islandStore.activeModule?.id === "tasks"}
        class:island-panel--shell={!islandStore.activeModule}
        class:island-panel--goo-pending={gooPending}
        onmousedown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
      >
        <div
          class="goo-panel"
          class:goo-expand={choreoClass === "goo-expand"}
          class:goo-collapse={choreoClass === "goo-collapse"}
        >
          {#if islandStore.activeModule}
            {#if islandStore.activeModule.id === "tasks"}
              <TaskWidget />
            {:else}
              <!-- ── Module Active View ── -->
              <ModuleActive activeModule={islandStore.activeModule} />
            {/if}
          {:else}
            <!-- ── Notch Expanded Shell: Notes + Media only ── -->
            <div class="shell-body" in:fade={{ duration: 260, easing: cubicOut, delay: 60 }} out:fade={{ duration: 120 }}>
              <div class="shell-grid">
                <div class="shell-column">
                  <NotesWidget />
                </div>
                <div class="shell-column">
                  <MediaPlayerWidget />
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    </div><!-- end goo-container -->
  </div>
</div>

<!-- ── Diagnostics: stress-test dump (listener always present, handler gated) ── -->
<svelte:window on:keydown={(e) => {
  if (!DIAG) return;
  if (e.key === "F12" && e.shiftKey && e.ctrlKey) {
    console.log("[island-diag] Ctrl+Shift+F12: dumping diagnostics");
    console.log({
      mode: islandStore.mode,
      page: islandStore.page,
      searchActive,
      activeModule: islandStore.activeModule,
      selectedItemId: islandStore.selectedItemId,
      modeChanges: diagModeChanges,
      keydownCount: diagKeydownCount,
      escapePresses: diagEscapeCount,
      clickOutsideCount: diagClickListenerCount,
      transitionCount: diagTransitionCount,
      transitionInterruptions: diagTransitionInterruptions,
      // invokeTimedOut: removed — tracked by ipc.ts LogRocket breadcrumbs
      visibilityHiddenCount: diagVisibilityHiddenCount,
      mountTime: new Date(diagMountTime).toISOString(),
      uptime: ((Date.now() - diagMountTime) / 1000).toFixed(1) + "s",
      msSinceModeChange: islandStore.msSinceModeChange,
    });
  }
}} />

<style>
  :global(.island-overlay), :global(.island-overlay *) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: transparent !important;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
    font-optical-sizing: auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :focus-visible {
    outline: 1px solid oklch(1 0 89.876 / 0.2);
    outline-offset: 2px;
  }

  .island-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    pointer-events: none;
  }

  .island-overlay > * {
    pointer-events: auto;
  }

  .island-overlay--expanded {
    z-index: 10000;
  }

  .island-shell {
    position: relative;
    background: oklch(0.159 0 89.876);
    border: 0.5px solid oklch(1 0 89.876 / 0.08);
    overflow: visible;
    display: block;
    width: 260px;
    height: 40px;
    color: oklch(1 0 89.876 / 0.85);
    transition:
      width 0.55s cubic-bezier(0.34, 1.3, 0.64, 1),
      height 0.55s cubic-bezier(0.34, 1.3, 0.64, 1);
  }

  @supports (animation-timing-function: linear(0, 1)) {
    .island-shell {
      transition:
        width 0.55s linear(0, 0.09 10%, 0.26 20%, 0.5 33%, 0.74 46%, 0.9 58%, 1.02 76%, 1 88%, 1),
        height 0.55s linear(0, 0.09 10%, 0.26 20%, 0.5 33%, 0.74 46%, 0.9 58%, 1.02 76%, 1 88%, 1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .island-shell {
      transition: none;
    }
    .compact-body,
    .island-panel {
      animation: none;
    }
    .goo-active {
      filter: none !important;
    }
  }

  .island-shell--expanded {
    width: 560px;
    height: 520px;
  }

  .island-shell--shell {
    width: 560px;
    height: 480px;
    border-radius: 0 0 18px 18px;
    overflow: hidden;
    border-top: none;
  }

  .island-shell--normal:not(.island-shell--shell) {
    border-top: none;
    border-radius: 0 0 14px 14px;
  }

  .island-shell--widget {
    width: 440px;
    height: 244px;
  }

  .island-shell--active {
    background: transparent;
    border: none;
  }

  /* A notification island is detached from the notch, so its host keeps the
     notch footprint while the card animates independently below it. */
  .island-shell--task {
    width: 440px;
    height: 200px;
    transition:
      width 0.55s cubic-bezier(0.34, 1.3, 0.64, 1),
      height 0.55s cubic-bezier(0.34, 1.3, 0.64, 1);
  }

  .island-notch {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 40px;
    background: oklch(0.159 0 89.876);
    border: 0.5px solid oklch(1 0 89.876 / 0.08);
    border-top: none;
    border-radius: 0 0 14px 14px;
    overflow: visible;
    display: flex;
    align-items: center;
    justify-content: center;
    color: oklch(1 0 89.876 / 0.85);
    cursor: pointer;
    z-index: 2;
    transition:
      opacity 120ms cubic-bezier(0.23, 1, 0.32, 1),
      transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .island-notch--hidden {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.98);
    pointer-events: none;
  }

  /* The normal state is the original single, attached notch surface. Its
     parent owns the spring resize; this inner element only carries the click
     target while compact. */
  .island-notch--normal {
    position: static;
    width: 100%;
    height: 100%;
    transform: none;
    background: transparent;
    border: none;
    border-radius: inherit;
  }

  .island-notch--normal::before,
  .island-notch--normal::after {
    display: none;
  }

  .island-shell--shell .island-notch--normal {
    display: none;
  }

  /* Keep the notch as a fixed absolute pill in compact mode so it doesn't
     visually "resettle" when the shell shrinks from expanded → compact
     after the goo collapse animation. Overrides --normal's static fill. */
  .island-notch--compact {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 40px;
    background: oklch(0.159 0 89.876);
    border: 0.5px solid oklch(1 0 89.876 / 0.08);
    border-top: none;
    border-radius: 0 0 14px 14px;
  }

  .island-notch:hover {
    border-color: oklch(1 0 89.876 / 0.12);
  }

  .island-notch:active {
    background: oklch(0.178 0 89.876);
  }

  .island-notch::before {
    content: '';
    position: absolute;
    top: -1px;
    left: -7px;
    width: 7px;
    height: 7px;
    z-index: 10;
    pointer-events: none;
    background: radial-gradient(circle at 0 100%, transparent 7px, oklch(0.159 0 89.876) 7px);
  }

  .island-notch::after {
    content: '';
    position: absolute;
    top: -1px;
    right: -7px;
    width: 7px;
    height: 7px;
    z-index: 10;
    pointer-events: none;
    background: radial-gradient(circle at 100% 100%, transparent 7px, oklch(0.159 0 89.876) 7px);
  }

  .island-panel {
    position: absolute;
    top: 40px;
    left: 50%;
    width: 560px;
    height: 480px;
    transform: translateX(-50%) translateY(0);
    transform-origin: top center;
    background: oklch(0.159 0 89.876);
    border: 0.5px solid oklch(1 0 89.876 / 0.08);
    border-radius: 0 0 28px 28px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-top: none;
    color: oklch(1 0 89.876 / 0.85);
    z-index: 1;
  }

  .island-panel--widget {
    width: 440px;
    height: 184px;
    top: 52px;
    border-radius: 42px;
    background: transparent;
    border: none;
    overflow: visible;
  }

  .island-panel--task {
    position: absolute;
    top: 44px;
    left: 0;
    width: 100%;
    height: calc(100% - 44px);
    transform: none;
    overflow: visible;
    z-index: 3;
  }

  .island-panel--shell {
    position: static;
    width: 100%;
    height: 100%;
    flex: 1;
    transform: none;
    background: transparent;
    border: none;
    border-radius: 0;
  }

  .island-panel--goo-pending {
    opacity: 0;
    pointer-events: none;
  }

  /* ════════════════════════════════════════════════════════════════════
     GOOEY DETACHMENT CONTAINER & SVG FILTER
     ════════════════════════════════════════════════════════════════════ */

  .goo-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
    border-radius: inherit;
  }

  .goo-svg {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  /* Inner wrapper that carries the goo animation transforms.
     Separated from .island-panel (which handles centering via
     left:50%/translateX) so the animation doesn't interfere
     with horizontal positioning. */
  .goo-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    transform-origin: top center;
    will-change: transform;
  }

  /* The gooey filter is ONLY applied during transitions (goo-active).
     When active: feGaussianBlur blurs both shapes' edges, then
     feColorMatrix sharpens the alpha back — fusing overlapping blur
     regions into a single connected form. This creates the organic
     liquid "neck" between notch and panel automatically.
     When inactive: zero filter cost, crisp normal rendering. */
  .goo-active {
    filter: url(#goo);
    will-change: filter;
    /* Don't clip — the panel animates away from the notch during the gooey
       detachment; overflow:hidden would clip the moving panel and break the
       liquid-connection visual effect. The filter bounds are expanded to
       x=-50%/y=-50%/width=200%/height=200% to accommodate the movement. */
    overflow: visible;
  }

  /* During the gooey transition, the panel's own background would appear
     abruptly at full size before the animation settles — hide it so only
     the notch background and the goo-filtered blend are visible. */
  .goo-active .island-panel {
    background: transparent;
    border: none;
    /* The panel's absolute position puts it below the notch. The goo animation
       translates the inner .goo-panel upward to overlap the notch, creating the
       liquid bridge. Without overflow:visible, the moving panel gets clipped at
       the island-panel's border box, massively reducing the blur overlap (and
       thus the goo effect strength). The blur needs ~68px of overlap for the
       metaball connection at 14px stdDeviation; clipping to ~28px weakens it
       significantly. */
    overflow: visible;
  }

  /* ── Notch must stay visible during goo so the filter can fuse both shapes ── */
  .goo-active .island-notch--hidden {
    opacity: 1;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .goo-active .island-notch--normal {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 40px;
    border: 0.5px solid oklch(1 0 89.876 / 0.08);
    border-top: none;
    border-radius: 0 0 14px 14px;
    background: oklch(0.159 0 89.876);
  }

  .notch-morph {
    animation: notch-morph 500ms cubic-bezier(0.23, 1, 0.32, 1) both;
  }

  @keyframes notch-morph {
    0%   { height: 40px; border-radius: 0 0 14px 14px; }
    20%  { height: 90px; border-radius: 0 0 26px 26px; }
    45%  { height: 60px; border-radius: 0 0 18px 18px; }
    100% { height: 40px; border-radius: 0 0 14px 14px; }
  }

  /* ════════════════════════════════════════════════════════════════════
     GOOEY DETACHMENT — SVG filter metaball liquid transition
     The shell width/height resize is handled by the CSS transition
     on .island-shell. These keyframes ONLY animate the floating panel
     (translateY + scale), making it appear to detach from the notch
     and settle below it. The goo filter on .goo-container fuses the
     two shapes into one liquid blob that stretches and snaps.
     ════════════════════════════════════════════════════════════════════ */

  /* ── EXPAND: panel starts overlapping the notch (small, same position)
       then springs downward and outward to its floating position ── */
  @keyframes goo-expand-keyframes {
    0% {
      transform: translateY(-44px) scale(0.55, 0.15);
      opacity: 0;
    }
    15% {
      transform: translateY(-40px) scale(0.62, 0.35);
      opacity: 1;
    }
    35% {
      transform: translateY(-30px) scale(0.75, 0.55);
      opacity: 1;
    }
    60% {
      transform: translateY(-14px) scale(0.9, 0.82);
      opacity: 1;
    }
    100% {
      transform: translateY(0) scale(1, 1);
      opacity: 1;
    }
  }

  .goo-expand {
    animation: goo-expand-keyframes var(--goo-expand-duration, 500ms) cubic-bezier(0.23, 1, 0.32, 1) both;
  }

  /* ── COLLAPSE: reverse — panel springs back into the notch,
       filter re-fuses it into the notch visually ── */
  @keyframes goo-collapse-keyframes {
    0% {
      transform: translateY(0) scale(1, 1);
      opacity: 1;
    }
    40% {
      transform: translateY(-14px) scale(0.9, 0.82);
      opacity: 1;
    }
    65% {
      transform: translateY(-30px) scale(0.75, 0.55);
      opacity: 0.8;
    }
    85% {
      transform: translateY(-40px) scale(0.62, 0.35);
      opacity: 0.5;
    }
    100% {
      transform: translateY(-44px) scale(0.55, 0.15);
      opacity: 0;
    }
  }

  .goo-collapse {
    animation: goo-collapse-keyframes var(--goo-collapse-duration, 550ms) cubic-bezier(0.55, 0, 0.67, 1) both;
  }

  .compact-body {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    padding: 0 14px;
    height: 100%;
    width: 100%;
  }

  /* ── Live compact state (module active) ── */
  .compact-body--live {
    justify-content: space-between;
    gap: 4px;
    cursor: pointer;
  }

  .compact-live {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .compact-live-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .compact-live-label {
    font-size: 11px;
    font-weight: 500;
    color: oklch(1 0 89.876 / 0.6);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .compact-live-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: oklch(1 0 89.876 / 0.3);
    margin-left: auto;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact-live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: oklch(0.637 0.208 25.331);
    animation: live-pulse 1s ease-in-out infinite;
  }

  /* ── Compact idle clock ── */
  .compact-clock {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .compact-clock-time {
    font-size: 12px;
    font-weight: 450;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: oklch(1 0 89.876 / 0.35);
  }

  /* ── Compact notification ── */
  .compact-body--notification {
    background: oklch(1 0 89.876 / 0.03);
  }

  .compact-body--notification:hover {
    background: oklch(1 0 89.876 / 0.06);
  }

  .compact-notification {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    justify-content: center;
  }

  .compact-notification-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .compact-notification-text {
    font-size: 12px;
    font-weight: 450;
    color: oklch(1 0 89.876 / 0.6);
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(0.7); }
  }

  .shell-body {
    display: flex;
    flex: 1;
    min-height: 0;
    padding: 10px 12px 12px;
  }

  .shell-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    width: 100%;
    min-height: 0;
  }

  .shell-column {
    min-width: 0;
    min-height: 0;
    display: flex;
  }

  .shell-column :global(.widget-wrapper) {
    width: 100%;
  }

  @media (max-width: 620px) {
    .shell-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
