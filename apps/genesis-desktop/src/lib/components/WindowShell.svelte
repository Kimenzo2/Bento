<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
import { browser } from "$app/environment";
import { onMount } from "svelte";
import { isTauri } from "@tauri-apps/api/core";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import SquareIcon from "@lucide/svelte/icons/square";
  import XIcon from "@lucide/svelte/icons/x";
  import { activeBundle, createTranslator } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));
  import TitlebarContextMenu from "./TitlebarContextMenu.svelte";
  import { isDark } from "$lib/stores/theme.store";
  import { authStore } from "$lib/stores/auth.store";
  import { getShellTokens } from "$lib/shell-theme";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  const isMac = browser && /mac/i.test(navigator.userAgent);
  const canUseTauri = browser && isTauri();
  let isMaximized = $state(false);
  let appWindow: any = null;
  const isAuthShell = $derived($authStore.status !== "restored");
  const shellStyle = $derived(
    Object.entries(getShellTokens($isDark))
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );
  async function minimize() {
    if (!canUseTauri || !appWindow) {
      return;
    }

    await appWindow.minimize();
  }

  async function close() {
    if (!canUseTauri || !appWindow) {
      return;
    }

    await appWindow.close();
  }

  async function syncMaximizedState() {
    if (!appWindow) {
      return;
    }

    try {
      isMaximized = await appWindow.isMaximized();
    } catch {
      isMaximized = false;
    }
  }

  async function toggleMaximized() {
    if (!canUseTauri || !appWindow) {
      return;
    }

    try {
      await appWindow.toggleMaximize();
    } catch {
      await syncMaximizedState();
      return;
    }

    await syncMaximizedState();
  }

  async function startDragging() {
    if (!canUseTauri || !appWindow) {
      return;
    }

    await appWindow.startDragging();
  }

  async function startResize() {
    if (!canUseTauri || !appWindow || isMaximized) {
      return;
    }

    await appWindow.startResizeDragging("SouthEast");
  }

  onMount(() => {
    if (!canUseTauri) {
      return;
    }

    let disposed = false;
    let removeResizeListener: (() => void) | undefined;

    void (async () => {
      const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      appWindow = getCurrentWebviewWindow();
      void syncMaximizedState();

      const resizeListener = appWindow.listen("tauri://resize", () => {
        if (!disposed) {
          void syncMaximizedState();
        }
      });

      void resizeListener.then((unlisten: () => void) => {
        if (disposed) {
          unlisten();
          return;
        }

        removeResizeListener = unlisten;
      });
    })();

    return () => {
      disposed = true;
      removeResizeListener?.();
    };
  });
</script>

<header class:window-shell--mac={isMac} class="window-shell" style={shellStyle}>
  <div class="window-shell__frame">
    {#if isAuthShell}
      <div class="window-shell__titlebar" aria-label={_t('windowAuthControls')}>
        <div class="window-shell__drag" data-tauri-drag-region></div>

        {#if !isMac}
          <div class="window-shell__controls" aria-label={_t('windowWindowControls')}>
            <button aria-label={_t('windowMinimize')} class="window-shell__control" type="button" onclick={() => void minimize()} use:tooltip={{ text: "Minimize" }}>
              <MinusIcon />
            </button>
            <button
              aria-label={_t('windowClose')}
              class="window-shell__control window-shell__control--close"
              type="button"
              onclick={() => void close()}
              use:tooltip={{ text: "Close" }}
            >
              <XIcon />
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <TitlebarContextMenu
        {isMac}
        {isMaximized}
        onClose={close}
        onMinimize={minimize}
        onStartDragging={startDragging}
        onStartResize={startResize}
        onToggleMaximized={toggleMaximized}
      />
    {/if}

    {#if !isAuthShell && !isMac}
      <div class="window-shell__controls" aria-label={_t('windowWindowControls')}>
        <button aria-label={_t('windowMinimize')} class="window-shell__control" type="button" onclick={() => void minimize()} use:tooltip={{ text: "Minimize" }}>
          <MinusIcon />
        </button>
        <button
          aria-label={_t(isMaximized ? 'windowRestore' : 'windowMaximize')}
          aria-pressed={isMaximized}
          class="window-shell__control"
          type="button"
          onclick={() => void toggleMaximized()}
          use:tooltip={{ text: isMaximized ? 'Restore' : 'Maximize' }}
        >
          {#if isMaximized}
            <svg aria-hidden="true" class="window-shell__restore-icon" viewBox="0 0 16 16">
              <path
                d="M5 3.5h6.5V10M11 5.5h1.5v7H5.5V11M3.5 5.5h6V12h-6z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.2"
              />
            </svg>
          {:else}
            <SquareIcon />
          {/if}
        </button>
        <button
          aria-label={_t('windowClose')}
          class="window-shell__control window-shell__control--close"
          type="button"
          onclick={() => void close()}
          use:tooltip={{ text: "Close" }}
        >
          <XIcon />
        </button>
      </div>
    {/if}
  </div>
</header>
