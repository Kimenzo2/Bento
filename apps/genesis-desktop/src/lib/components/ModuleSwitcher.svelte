<script lang="ts">
  import Grid2x2Icon from "@lucide/svelte/icons/grid-2x2";
  import { toast } from "svelte-sonner";
  import { activeModule, switchModule, type GenesisModuleId } from "$lib/desktop/modules";
  import { beginAppLaunch, signalAppLaunchError } from "$lib/stores/app-launch.store";

  let expanded = $state(false);
  let stackExpanded = $state(false);
  let switching = $state<GenesisModuleId | null>(null);
  let stackContainer: HTMLDivElement | null = $state(null);
  let triggerButton: HTMLButtonElement | null = $state(null);

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
      { id: "water", label: "Water" },
      { id: "countdown", label: "Countdown" },
      { id: "ai", label: "AI" },
      null,
      null,
    ],
  ] as const;

  const collapsedStack = [
    { translateY: 0, scale: 1, opacity: 1 },
    { translateY: -6, scale: 0.95, opacity: 0.7 },
    { translateY: -10, scale: 0.9, opacity: 0.4 },
    { translateY: -13, scale: 0.85, opacity: 0.2 },
    { translateY: -15, scale: 0.8, opacity: 0.1 },
  ] as const;

  const rowStep = 44;

  function toggleSwitcher() {
    expanded = !expanded;
    stackExpanded = false;
  }

  function rowStyle(index: number) {
    const collapsed = collapsedStack[index] ?? collapsedStack[collapsedStack.length - 1];
    const translateY = stackExpanded ? -(index * rowStep) : collapsed.translateY;
    const scale = stackExpanded ? 1 : collapsed.scale;
    const opacity = stackExpanded ? 1 : collapsed.opacity;
    const zIndex = rows.length - index;
    return `--stack-translate-y:${translateY}px;--stack-scale:${scale};--stack-opacity:${opacity};--stack-row-index:${index};z-index:${zIndex};`;
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!expanded) {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    if (stackContainer?.contains(target) || triggerButton?.contains(target)) {
      return;
    }
    expanded = false;
    stackExpanded = false;
  }

  async function selectModule(moduleId: GenesisModuleId) {
    if (switching || moduleId === $activeModule) {
      expanded = false;
      return;
    }

    switching = moduleId;
    beginAppLaunch(moduleId);
    expanded = false;

    try {
      await switchModule(moduleId);
      switching = null;
    } catch (error) {
      switching = null;
      signalAppLaunchError(moduleId, error);
      console.error("[Genesis Desktop] Module switch failed", error);
      toast.error(error instanceof Error ? error.message : "Module switch failed.");
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="module-switcher">
  <button
    bind:this={triggerButton}
    type="button"
    class="module-switcher__trigger"
    aria-label="Open Genesis modules"
    aria-expanded={expanded}
    onclick={toggleSwitcher}
  >
    <Grid2x2Icon size={14} />
    <span>Apps</span>
  </button>
</div>

{#if expanded}
  <div
    bind:this={stackContainer}
    class="module-switcher-stack"
    class:module-switcher-stack--expanded={stackExpanded}
    role="menu"
    aria-label="Genesis modules"
    onpointerenter={() => {
      stackExpanded = true;
    }}
    onpointerleave={() => {
      stackExpanded = false;
    }}
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
{/if}
