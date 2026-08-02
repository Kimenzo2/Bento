<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

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
<WindowTabs />
{#if !$desktopSettings.workspace.tabsEnabled}
  <ModuleSwitcher />
{/if}
<AppLaunchCanvas />
<GlobalSettings />

<div class="desktop-app-root">
  <Router routes={appRoutes} />
</div>


<UpdateNotification />
<CrashDialog />
<Toaster richColors position="top-center" offset={56} />

