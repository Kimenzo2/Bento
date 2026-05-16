<script lang="ts">
  import { Router } from "@mateothegreat/svelte5-router";
  import AppLaunchCanvas from "$lib/components/AppLaunchCanvas.svelte";
  import CrashDialog from "$lib/components/CrashDialog.svelte";
  import GlobalSettings from "$lib/components/GlobalSettings.svelte";
  import ModuleSwitcher from "$lib/components/ModuleSwitcher.svelte";
  import RuntimeBridge from "$lib/components/RuntimeBridge.svelte";
  import UpdateNotification from "$lib/components/UpdateNotification.svelte";
  import WindowShell from "$lib/components/WindowShell.svelte";
  import WindowTabs from "$lib/components/WindowTabs.svelte";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import { appRoutes } from "$lib/router/routes";
  import { desktopSettings } from "$lib/desktop/settings";
</script>

<RuntimeBridge />
<WindowShell />
{#if $desktopSettings.workspace.tabsEnabled}
  <WindowTabs />
{/if}
<ModuleSwitcher />
<AppLaunchCanvas />
<GlobalSettings />

<div class="desktop-app-root">
  <Router routes={appRoutes} />
</div>

<UpdateNotification />
<CrashDialog />
<Toaster position="top-center" offset={56} />
