<script lang="ts">
  import { Router } from "@mateothegreat/svelte5-router";
  import CrashDialog from "$lib/components/CrashDialog.svelte";
  import RuntimeBridge from "$lib/components/RuntimeBridge.svelte";
  import UpdateNotification from "$lib/components/UpdateNotification.svelte";
  import WindowShell from "$lib/components/WindowShell.svelte";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import { appRoutes } from "$lib/router/routes";
</script>

<RuntimeBridge />
<WindowShell />

<div class="desktop-app-root">
  <Router routes={appRoutes} />
</div>

<UpdateNotification />
<CrashDialog />
<Toaster richColors position="top-center" offset={56} />
