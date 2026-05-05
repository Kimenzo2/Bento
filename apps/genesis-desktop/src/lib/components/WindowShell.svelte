<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import SquareIcon from "@lucide/svelte/icons/square";
  import XIcon from "@lucide/svelte/icons/x";
  import { isDark } from "$lib/stores/theme.store";
  import { getShellTokens } from "$lib/shell-theme";

  const isMac = browser && /mac/i.test(navigator.userAgent);
  const canUseTauri = browser && "__TAURI_INTERNALS__" in window;
  let isMaximized = $state(false);
  let appWindow: Window | null = null;
  const shellStyle = $derived(
    Object.entries(getShellTokens($isDark))
      .map(([key, value]) => `${key}:${value}`)
      .join(";")
  );
  const maximizeLabel = $derived(isMaximized ? "Restore Genesis" : "Maximize Genesis");

  async function minimize() {
    if (!canUseTauri || isMac || !appWindow) {
      return;
    }

    await appWindow.minimize();
  }

  async function close() {
    if (!canUseTauri || isMac || !appWindow) {
      return;
    }

    await appWindow.close();
  }

  async function syncMaximizedState() {
    if (isMac || !appWindow) {
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

  onMount(() => {
    if (!canUseTauri || isMac) {
      return;
    }

    appWindow = getCurrentWindow();
    void syncMaximizedState();

    let disposed = false;
    let removeResizeListener: (() => void) | undefined;

    void appWindow.listen("tauri://resize", () => {
      if (!disposed) {
        void syncMaximizedState();
      }
      }).then((unlisten: () => void) => {
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
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="window-shell__drag"
      data-tauri-drag-region
      ondblclick={() => void toggleMaximized()}
    >
      {#if isMac}
        <div class="window-shell__traffic-spacer"></div>
      {/if}
      <span class="window-shell__title">Genesis</span>
    </div>

    {#if !isMac}
      <div class="window-shell__controls" aria-label="Window controls">
        <button aria-label="Minimize Genesis" class="window-shell__control" type="button" onclick={() => void minimize()}>
          <MinusIcon />
        </button>
        <button
          aria-label={maximizeLabel}
          aria-pressed={isMaximized}
          class="window-shell__control"
          type="button"
          onclick={() => void toggleMaximized()}
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
          aria-label="Close Genesis"
          class="window-shell__control window-shell__control--close"
          type="button"
          onclick={() => void close()}
        >
          <XIcon />
        </button>
      </div>
    {/if}
  </div>
</header>
