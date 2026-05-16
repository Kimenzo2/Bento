<script lang="ts">
  import Grid2x2Icon from "@lucide/svelte/icons/grid-2x2";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { activeModule, switchModule, type GenesisModuleId } from "$lib/desktop/modules";
  import { beginAppLaunch, signalAppLaunchError } from "$lib/stores/app-launch.store";
  import { logger } from "$lib/utils/logger";

  let switcherOpen = $state(false);
  let switching = $state<GenesisModuleId | null>(null);
  let switcherRoot: HTMLElement | null = $state(null);
  const comingSoonModules = new Set<GenesisModuleId>(["notes", "ai"]);

  type SwitcherSlot = {
    id: GenesisModuleId;
    label: string;
  } | null;

  const rows: ReadonlyArray<ReadonlyArray<SwitcherSlot>> = [
    [
      { id: "dashboard", label: "Home" },
      { id: "telemetry", label: "Telemetry" },
      { id: "settings", label: "Settings" },
      { id: "journal", label: "Journal" },
      { id: "tasks", label: "Tasks" },
    ],
    [
      { id: "notes", label: "Notes" },
      { id: "habits", label: "Habits" },
      { id: "focus", label: "Focus" },
      { id: "health", label: "Health" },
      { id: "budget", label: "Budget" },
    ],
    [
      { id: "reading", label: "Reading" },
      { id: "goals", label: "Goals" },
      { id: "time", label: "Time" },
      { id: "sleep", label: "Calendar" },
      { id: "passwords", label: "Vault" },
    ],
    [
      { id: "clipboard", label: "Clipboard" },
      { id: "voice-memos", label: "Voice" },
      { id: "mood", label: "Mood" },
      { id: "grocery", label: "Grocery" },
      { id: "recipes", label: "Recipes" },
    ],
    [
      { id: "nutrition", label: "Water" },
      { id: "countdown", label: "Countdown" },
      { id: "ai", label: "AI" },
      null,
      null,
    ],
  ] as const;

  const collapsedStack = [
    { translateY: 0, scale: 1, opacity: 1 },
    { translateY: 8, scale: 0.965, opacity: 0.72 },
    { translateY: 14, scale: 0.93, opacity: 0.48 },
    { translateY: 20, scale: 0.895, opacity: 0.26 },
    { translateY: 26, scale: 0.86, opacity: 0.14 },
  ] as const;

  function rowStyle(index: number) {
    const collapsed = collapsedStack[index] ?? collapsedStack[collapsedStack.length - 1];
    const zIndex = rows.length - index;
    return `--stack-collapsed-translate-y:${collapsed.translateY}px;--stack-collapsed-scale:${collapsed.scale};--stack-collapsed-opacity:${collapsed.opacity};--stack-row-index:${index};z-index:${zIndex};`;
  }

  async function selectModule(moduleId: GenesisModuleId) {
    if (comingSoonModules.has(moduleId)) {
      beginAppLaunch(moduleId);
      signalAppLaunchError(moduleId, new Error("Coming soon"));
      switcherOpen = false;
      return;
    }

    if (switching || moduleId === $activeModule) {
      switcherOpen = false;
      return;
    }

    switching = moduleId;
    beginAppLaunch(moduleId);
    switcherOpen = false;

    try {
      await switchModule(moduleId);
      switching = null;
    } catch (error) {
      switching = null;
      signalAppLaunchError(moduleId, error);
      logger.error("Module switch failed", error);
      toast.error(error instanceof Error ? error.message : "Module switch failed.");
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!switcherOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (!target || switcherRoot?.contains(target)) {
      return;
    }

    switcherOpen = false;
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      switcherOpen = false;
    }
  }

  onMount(() => {
    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  });
</script>

<details bind:open={switcherOpen} bind:this={switcherRoot} class="module-switcher">
  <summary class="module-switcher__trigger" aria-label="Open Genesis modules" aria-expanded={switcherOpen}>
    <Grid2x2Icon size={14} />
    <span>Apps</span>
  </summary>

  <div
    class="module-switcher-stack"
    role="menu"
    tabindex="-1"
    aria-label="Genesis modules"
  >
    <div class="module-switcher-stack__rows">
      {#each rows as row, rowIndex}
        <div class="module-switcher-stack__row" style={rowStyle(rowIndex)}>
          {#each row as slot}
            {#if slot}
              <button
                type="button"
                role="menuitem"
                class="module-switcher-stack__pill"
                class:module-switcher-stack__pill--active={slot.id === $activeModule}
                disabled={switching !== null}
                onclick={() => void selectModule(slot.id)}
              >
                {slot.label}
              </button>
            {:else}
              <span class="module-switcher-stack__pill-slot" aria-hidden="true"></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
</details>
