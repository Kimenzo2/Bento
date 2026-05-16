<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { onMount } from "svelte";
  import { goto } from "@mateothegreat/svelte5-router";
  import { toast } from "svelte-sonner";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

  type MenuAction = () => Promise<void> | void;

  let {
    isMac,
    isMaximized,
    onMinimize,
    onClose,
    onToggleMaximized,
    onStartDragging,
    onStartResize,
  }: {
    isMac: boolean;
    isMaximized: boolean;
    onMinimize: MenuAction;
    onClose: MenuAction;
    onToggleMaximized: MenuAction;
    onStartDragging: MenuAction;
    onStartResize: MenuAction;
  } = $props();

  let logoMenuOpen = $state(false);
  let logoMenuRoot: HTMLElement | null = $state(null);
  const closeShortcut = $derived(isMac ? "" : "Alt+F4");
  const commandKey = $derived(isMac ? "⌘" : "Ctrl");
  const toggleLabel = $derived(isMaximized ? "Restore" : "Maximize");

  function openRoute(path: string) {
    logoMenuOpen = false;
    void goto(path);
  }

  function openGlobalSettings() {
    logoMenuOpen = false;
    window.dispatchEvent(new CustomEvent("genesis:open-global-settings"));
  }

  function toggleTabsEnabled() {
    logoMenuOpen = false;
    void updateDesktopSettings((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        tabsEnabled: !current.workspace.tabsEnabled,
      },
    }));
  }

  function openNewTab() {
    logoMenuOpen = false;
    window.dispatchEvent(new CustomEvent("genesis:tabs:new"));
  }

  function showAbout() {
    logoMenuOpen = false;
    toast.info("Genesis Desktop v1 foundation", {
      description: "Tauri v2, Rust, Svelte, local-first shell architecture.",
    });
  }

  function shortcutModifier(event: KeyboardEvent) {
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function handleShortcut(event: KeyboardEvent) {
    if (!shortcutModifier(event) || event.altKey || event.shiftKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === ",") {
      event.preventDefault();
      openGlobalSettings();
      return;
    }

    if (key === "t") {
      event.preventDefault();
      openNewTab();
      return;
    }

    if (key === "o") {
      event.preventDefault();
      openRoute("/project/local");
      return;
    }

    if (key === "n") {
      event.preventDefault();
      openRoute("/visual-studio");
      return;
    }

    if (key === "m") {
      event.preventDefault();
      void onMinimize();
      return;
    }

    if (key === "w") {
      event.preventDefault();
      void onClose();
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!logoMenuOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (!target || logoMenuRoot?.contains(target)) {
      return;
    }

    logoMenuOpen = false;
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      logoMenuOpen = false;
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  });
</script>

<div class="window-shell__titlebar">
  <details bind:open={logoMenuOpen} bind:this={logoMenuRoot} class="window-shell__menu">
    <summary
      aria-label="Genesis app menu"
      class="window-shell__brand-trigger"
      onclick={(event) => {
        event.preventDefault();
        logoMenuOpen = !logoMenuOpen;
      }}
      onpointerdown={(event) => {
        if (event.button === 0) {
          event.preventDefault();
        }
      }}
    >
      <span class="window-shell__brand-mark" aria-hidden="true"></span>
      <span class="sr-only">Open Genesis app menu</span>
    </summary>

    <div class="window-shell__menu-panel" role="menu" aria-label="Genesis app menu">
      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => openRoute("/")}>
        <span class="window-shell__menu-item-label">Dashboard</span>
      </button>

      {#if $desktopSettings.workspace.tabsEnabled}
        <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={openNewTab}>
          <span class="window-shell__menu-item-label">New Tab</span>
          <span class="window-shell__menu-shortcut">{commandKey}+T</span>
        </button>
      {/if}

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={toggleTabsEnabled}>
        <span class="window-shell__menu-item-label">
          {$desktopSettings.workspace.tabsEnabled ? "Disable Tabs" : "Enable Tabs"}
        </span>
      </button>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => openRoute("/project/local")}>
        <span class="window-shell__menu-item-label">Open Project...</span>
        <span class="window-shell__menu-shortcut">{commandKey}+O</span>
      </button>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => openRoute("/visual-studio")}>
        <span class="window-shell__menu-item-label">New AI Session</span>
        <span class="window-shell__menu-shortcut">{commandKey}+N</span>
      </button>

      <div class="window-shell__menu-separator" aria-hidden="true"></div>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={openGlobalSettings}>
        <span class="window-shell__menu-item-label">Settings...</span>
        <span class="window-shell__menu-shortcut">{commandKey}+,</span>
      </button>

      <div class="window-shell__menu-separator" aria-hidden="true"></div>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => void onToggleMaximized()}>
        {toggleLabel}
      </button>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => void onStartDragging()} disabled={isMaximized}>
        Move
      </button>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => void onStartResize()} disabled={isMaximized}>
        Size
      </button>

      <div class="window-shell__menu-separator" aria-hidden="true"></div>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => void onMinimize()}>
        <span class="window-shell__menu-item-label">Minimize</span>
        <span class="window-shell__menu-shortcut">{commandKey}+M</span>
      </button>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => void onClose()}>
        <span class="window-shell__menu-item-label">Close Window</span>
        <span class="window-shell__menu-shortcut">{commandKey}+W</span>
      </button>

      <div class="window-shell__menu-separator" aria-hidden="true"></div>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={showAbout}>
        <span class="window-shell__menu-item-label">About Genesis</span>
      </button>

      <button type="button" class="window-shell__menu-item window-shell__menu-button" onclick={() => void onClose()}>
        <span class="window-shell__menu-item-label">Exit</span>
        {#if closeShortcut}
          <span class="window-shell__menu-shortcut">{closeShortcut}</span>
        {/if}
      </button>
    </div>
  </details>

  <ContextMenuPrimitive.Root>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <ContextMenuPrimitive.Trigger
      class="window-shell__drag"
      data-tauri-drag-region
      ondblclick={() => void onToggleMaximized()}
    >
      {#if isMac}
        <div class="window-shell__traffic-spacer"></div>
      {/if}

      <span class="window-shell__title">Genesis</span>
    </ContextMenuPrimitive.Trigger>

    <ContextMenuPrimitive.Content class="window-shell__context-menu" sideOffset={2}>
      <ContextMenuPrimitive.Item class="window-shell__menu-item" onclick={() => void onToggleMaximized()} disabled={false}>
        {toggleLabel}
      </ContextMenuPrimitive.Item>

      <ContextMenuPrimitive.Item class="window-shell__menu-item" onclick={() => void onStartDragging()} disabled={isMaximized}>
        Move
      </ContextMenuPrimitive.Item>

      <ContextMenuPrimitive.Item class="window-shell__menu-item" onclick={() => void onStartResize()} disabled={isMaximized}>
        Size
      </ContextMenuPrimitive.Item>

      <ContextMenuPrimitive.Separator class="window-shell__menu-separator" />

      <ContextMenuPrimitive.Item class="window-shell__menu-item" onclick={() => void onMinimize()}>
        <span class="window-shell__menu-item-label">Minimize</span>
      </ContextMenuPrimitive.Item>

      <ContextMenuPrimitive.Item class="window-shell__menu-item" onclick={() => void onClose()}>
        <span class="window-shell__menu-item-label">Close</span>
        {#if closeShortcut}
          <span class="window-shell__menu-shortcut">{closeShortcut}</span>
        {/if}
      </ContextMenuPrimitive.Item>
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Root>
</div>

<style>
  .window-shell__menu {
    position: relative;
    pointer-events: auto;
  }

  .window-shell__menu > summary {
    list-style: none;
  }

  .window-shell__menu > summary::-webkit-details-marker {
    display: none;
  }

  .window-shell__menu-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    z-index: 140;
    display: grid;
    min-width: 16rem;
    padding: 0.375rem;
    border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
    border-radius: 1rem;
    background: var(--popover);
    color: var(--popover-foreground);
  }

  .window-shell__menu-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 2rem;
    padding: 0.45rem 0.7rem;
    appearance: none;
    border: 0;
    background: transparent;
    font: inherit;
    text-align: left;
    color: inherit;
    border-radius: 0.8rem;
    cursor: default;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .window-shell__menu-button:hover:not(:disabled),
  .window-shell__menu-button:focus-visible {
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
    outline: none;
  }

  .window-shell__menu-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
