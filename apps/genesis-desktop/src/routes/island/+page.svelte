<svelte:head>
  <style>
    html, body, #root { background: transparent !important; }
  </style>
</svelte:head>

<script lang="ts">
  import { onMount } from "svelte";
  import { listen, emit } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";
  import Island from "$lib/components/island/Island.svelte";
  import { islandStore } from "$lib/stores/island.store.svelte";
  import type { IslandItem } from "$lib/data/island-catalog";
  import { getModuleCatalogEntry } from "$lib/data/module-catalog";

  function handleLaunch(item: IslandItem) {
    const entry = getModuleCatalogEntry(item.id);
    if (entry?.route) {
      emit("bento://navigate", { route: entry.route });
      invoke("focus_main_window");
    }
    islandStore.collapse();
  }

  function handleQuickAction(action: string) {
    if (action.startsWith("open:")) {
      const route = action.slice(5);
      emit("bento://navigate", { route });
      invoke("focus_main_window");
    }
    islandStore.collapse();
  }

  onMount(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const u1 = await listen<{ id: string }>("island:toggle", () => {
        islandStore.toggle();
      });
      const u2 = await listen("island:show", () => {
        islandStore.expand("apps");
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
