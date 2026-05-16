<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { getCurrentWebviewWindow, type WebviewWindow } from "@tauri-apps/api/webviewWindow";
  import TitlebarContextMenu from "./TitlebarContextMenu.svelte";
  import { isDark } from "$lib/stores/theme.store";
  import { getShellTokens } from "$lib/shell-theme";

  const isMac = browser && /mac/i.test(navigator.userAgent);
  const canUseTauri = browser && "__TAURI_INTERNALS__" in window;
  let isMaximized = $state(false);
  let appWindow: WebviewWindow | null = null;
  const shellStyle = $derived(
    Object.entries(getShellTokens($isDark))
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );
  const maximizeLabel = $derived(isMaximized ? "Restore Genesis" : "Maximize Genesis");

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

    appWindow = getCurrentWebviewWindow();
    void syncMaximizedState();

    let disposed = false;
    let removeResizeListener: (() => void) | undefined;

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

    return () => {
      disposed = true;
      removeResizeListener?.();
    };
  });
</script>

<header class:window-shell--mac={isMac} class="window-shell" style={shellStyle}>
  <div class="window-shell__frame">
    <TitlebarContextMenu
      {isMac}
      {isMaximized}
      onClose={close}
      onMinimize={minimize}
      onStartDragging={startDragging}
      onStartResize={startResize}
      onToggleMaximized={toggleMaximized}
    />

    {#if !isMac}
      <div class="window-shell__controls" aria-label="Window controls">
        <button aria-label="Minimize Genesis" class="window-shell__control" type="button" onclick={minimize}>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.4" />
          </svg>
        </button>
        <button
          aria-label={maximizeLabel}
          aria-pressed={isMaximized}
          class="window-shell__control"
          type="button"
          onclick={toggleMaximized}
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
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <rect x="3.5" y="3.5" width="9" height="9" rx="1.25" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
          {/if}
        </button>
        <button
          aria-label="Close Genesis"
          class="window-shell__control window-shell__control--close"
          type="button"
          onclick={close}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path
              d="M4.25 4.25 11.75 11.75M11.75 4.25 4.25 11.75"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.4"
            />
          </svg>
        </button>
      </div>
    {/if}
  </div>
</header>
