<script lang="ts">
  import GlobalSettings from "$lib/components/GlobalSettings.svelte";
  import ShellLayout from "$lib/components/ShellLayout.svelte";
  import LaunchReadyReporter from "$lib/components/LaunchReadyReporter.svelte";
</script>

<ShellLayout page="settings">
  <GlobalSettings surface="page" />
  <LaunchReadyReporter moduleId="settings" />
</ShellLayout>
