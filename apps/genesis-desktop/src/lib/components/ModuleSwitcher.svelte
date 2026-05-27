<script lang="ts">
  import Grid2x2Icon from "@lucide/svelte/icons/grid-2x2";
  import { toast } from "svelte-sonner";
  import { activeModule, switchModule, type BentoModuleId } from "$lib/desktop/modules";
  import { beginAppLaunch, signalAppLaunchError } from "$lib/stores/app-launch.store";
  import { activeBundle, createTranslator } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));

  let expanded = $state(false);
  let stackExpanded = $state(false);
  let switching = $state<BentoModuleId | null>(null);
  let stackContainer: HTMLDivElement | null = $state(null);
  let triggerButton: HTMLButtonElement | null = $state(null);
  const comingSoonModules = new Set<BentoModuleId>(["ai"]);

  type SwitcherSlot = {
    id: BentoModuleId;
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

  const rowStep = 44;

  function toggleSwitcher() {
    expanded = !expanded;
    stackExpanded = expanded;
  }

  function rowStyle(index: number) {
    const collapsed = collapsedStack[index] ?? collapsedStack[collapsedStack.length - 1];
    const translateY = stackExpanded ? index * rowStep : collapsed.translateY;
    const scale = stackExpanded ? 1 : collapsed.scale;
    const opacity = stackExpanded ? 1 : collapsed.opacity;
    const zIndex = rows.length - index;
    const delay = stackExpanded ? index * 22 : (rows.length - index - 1) * 14;
    return `--stack-translate-y:${translateY}px;--stack-scale:${scale};--stack-opacity:${opacity};--stack-row-index:${index};--stack-delay:${delay}ms;z-index:${zIndex};`;
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

  async function selectModule(moduleId: BentoModuleId) {
    if (comingSoonModules.has(moduleId)) {
      beginAppLaunch(moduleId);
      signalAppLaunchError(moduleId, new Error(_t('switcherComingSoon')));
      expanded = false;
      return;
    }

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
      console.error("[Bento Desktop] Module switch failed", error);
      toast.error(error instanceof Error ? error.message : _t('switcherSwitchFailed'));
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="module-switcher">
  <button
    bind:this={triggerButton}
    type="button"
    class="module-switcher__trigger"
    aria-label={_t('switcherOpenModules')}
    aria-expanded={expanded}
    onclick={toggleSwitcher}
  >
    <Grid2x2Icon size={14} />
    <span>{_t('switcherApps')}</span>
  </button>
</div>

{#if expanded}
  <div
    bind:this={stackContainer}
    class="module-switcher-stack"
    class:module-switcher-stack--expanded={stackExpanded}
    role="menu"
    tabindex="-1"
    aria-label={_t('switcherModulesLabel')}
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
