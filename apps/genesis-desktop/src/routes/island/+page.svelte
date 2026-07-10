<svelte:head>
  <style>
    html, body, #root { background: transparent !important; }
  </style>
</svelte:head>

<script lang="ts">
  import { onMount } from "svelte";
  import { listen, emit } from "@tauri-apps/api/event";
  import { invokeWithTimeout } from "$lib/ipc";
  import Island from "$lib/components/island/Island.svelte";
  import { islandStore } from "$lib/stores/island.store.svelte";
  import type { IslandItem } from "$lib/data/island-catalog";
  import { getModuleCatalogEntry } from "$lib/data/module-catalog";

  /** Update island store from voice engine cross-window events. */
  function applyVoiceState(state: {
    id: string;
    label: string;
    icon: string;
    status: string;
    activityType?: string;
  } | null) {
    if (state) {
      islandStore.activateModule({
        id: state.id,
        label: state.label,
        icon: state.icon,
        status: state.status,
        activityType: state.activityType as "recording" | "timer" | "active" | "playback" | undefined,
      });
    } else if (islandStore.activeModule?.id === "voice") {
      // Only clear the voice module — don't touch other active modules
      islandStore.activeModule = null;
    }
  }

  function handleLaunch(item: IslandItem) {
    const entry = getModuleCatalogEntry(item.id);
    if (entry?.route) {
      emit("bento://navigate", { route: entry.route });
      invokeWithTimeout("focus_main_window", undefined, 5_000);
    }
    islandStore.collapse();
  }

  function handleQuickAction(action: string, item: IslandItem) {
    // Navigate to the module in the main window (background)
    if (action.startsWith("open:")) {
      const route = action.slice(5);
      emit("bento://navigate", { route });
      invokeWithTimeout("focus_main_window", undefined, 5_000);
    }

    // Keep the island open and show module status
    islandStore.activateModule({
      id: item.id,
      label: item.name,
      icon: item.icon,
      status: item.quickActions.find((a) => a.action === action)?.label ?? "Active",
      activityType: action.includes("record") || action.includes("mic")
        ? "recording"
        : action.includes("timer")
          ? "timer"
          : "active",
    });
  }

  onMount(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const u1 = await listen<{ id: string }>("island:toggle", () => {
        islandStore.toggle();
      });
      const u2 = await listen("island:show", () => {
        islandStore.expand("widgets");
      });
      const u3 = await listen("island:hide", () => {
        islandStore.collapse();
      });
      const u4 = await listen<
        | {
            id: string;
            label: string;
            icon: string;
            status: string;
            activityType?: string;
          }
        | null
      >("voice:island-state-changed", (event) => {
        applyVoiceState(event.payload);
      });
      unlisteners.push(u1, u2, u3, u4);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  });
</script>

<Island {handleLaunch} {handleQuickAction} />
