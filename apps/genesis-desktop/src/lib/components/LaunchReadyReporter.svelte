<script lang="ts">
  import { onMount, tick } from "svelte";
  import { signalAppLaunchReady } from "$lib/stores/app-launch.store";

  let {
    moduleId,
  }: {
    moduleId: string;
  } = $props();

  onMount(() => {
    void tick().then(() => {
      signalAppLaunchReady(moduleId);
    });
  });
</script>
