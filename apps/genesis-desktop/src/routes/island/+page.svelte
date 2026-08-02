<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

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
      unlisteners.push(u1, u2, u3);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  });
</script>

<Island {handleLaunch} {handleQuickAction} />
