<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { onMount } from "svelte";
  import { goto } from "@mateothegreat/svelte5-router";
  import { toast } from "svelte-sonner";
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";
  import HeaderWidgetIcon from "$lib/components/anytype-icons/HeaderWidgetIcon.svelte";
  import VaultToggleIcon from "$lib/components/anytype-icons/VaultToggleIcon.svelte";
  import { toggleSidebarHidden } from "$lib/stores/workspace.store";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";
  import { back, canGoBack, pushNav } from "$lib/stores/nav-history.store";
  import { moduleFromPath } from "$lib/desktop/modules";

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
  const tabsEnabled = $derived($desktopSettings.workspace.tabsEnabled);
  const closeShortcut = $derived(isMac ? "" : "Alt+F4");
  const commandKey = $derived(isMac ? "⌘" : "Ctrl");
  const toggleLabel = $derived(isMaximized ? "Restore" : "Maximize");

  const contentClass =
    "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-44 rounded-[1rem] p-1.5 shadow-xl ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 z-[140] overflow-x-hidden overflow-y-auto outline-none";
  const appMenuContentClass = `${contentClass} min-w-64`;

  function openRoute(path: string) {
    logoMenuOpen = false;
    void goto(path);
  }

  function openGlobalSettings() {
    logoMenuOpen = false;
    window.dispatchEvent(new CustomEvent("bento:open-global-settings"));
  }

  async function toggleTabs() {
    logoMenuOpen = false;
    const next = !$desktopSettings.workspace.tabsEnabled;
    await updateDesktopSettings((s) => ({
      ...s,
      workspace: { ...s.workspace, tabsEnabled: next },
    }));
    toast.success(next ? "Tab mode enabled." : "Module switcher restored.");
  }

  function showAbout() {
    logoMenuOpen = false;
    toast.info("Bento Desktop v1 foundation", {
      description: "Tauri v2, Rust, Svelte, local-first shell architecture.",
    });
  }

  function shortcutModifier(event: KeyboardEvent) {
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      if ($canGoBack) back();
      return;
    }

    if (!shortcutModifier(event) || event.altKey || event.shiftKey) {
      return;
    }

    const key = event.key.toLowerCase();
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

  onMount(() => {
    // Seed history with the landing module — runs client-side only,
    // after hydration, so browser APIs are available.
    pushNav(moduleFromPath(window.location.pathname));

    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  });
</script>

<div class="window-shell__titlebar">
  <DropdownMenu bind:open={logoMenuOpen}>
    <DropdownMenuTrigger
      aria-label="Bento app menu"
      class="window-shell__brand-trigger"
      type="button"
    >
      <span class="window-shell__brand-mark">
        <HeaderWidgetIcon />
      </span>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" class={appMenuContentClass} sideOffset={8}>
      <DropdownMenuItem class="window-shell__menu-item" onclick={() => openRoute("/")}>
        <span class="window-shell__menu-item-label">Dashboard</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        class="window-shell__menu-item"
        disabled={!$canGoBack}
        onclick={() => { if ($canGoBack) back(); }}
      >
        <span class="window-shell__menu-item-label">Back</span>
        <DropdownMenuShortcut>Alt+←</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuSeparator class="window-shell__menu-separator" />

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void toggleTabs()}>
        <span class="window-shell__menu-item-label">
          {tabsEnabled ? "✓ " : ""}Enable Tabs
        </span>
      </DropdownMenuItem>

      <DropdownMenuSeparator class="window-shell__menu-separator" />

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onToggleMaximized()}>
        {toggleLabel}
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onStartDragging()} disabled={isMaximized}>
        Move
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onStartResize()} disabled={isMaximized}>
        Size
      </DropdownMenuItem>

      <DropdownMenuSeparator class="window-shell__menu-separator" />

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onMinimize()}>
        <span class="window-shell__menu-item-label">Minimize</span>
        <DropdownMenuShortcut>{commandKey}+M</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onClose()}>
        <span class="window-shell__menu-item-label">Close Window</span>
        <DropdownMenuShortcut>{commandKey}+W</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuSeparator class="window-shell__menu-separator" />

      <DropdownMenuItem class="window-shell__menu-item" onclick={showAbout}>
        <span class="window-shell__menu-item-label">About Bento</span>
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onClose()}>
        <span class="window-shell__menu-item-label">Exit</span>
        {#if closeShortcut}
          <DropdownMenuShortcut>{closeShortcut}</DropdownMenuShortcut>
        {/if}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <button
    aria-label="Hide or show sidebar"
    class="window-shell__aux-trigger"
    type="button"
    onclick={() => toggleSidebarHidden()}
  >
    <span class="window-shell__aux-icon">
      <VaultToggleIcon />
    </span>
  </button>

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

      
    </ContextMenuPrimitive.Trigger>

    <ContextMenuPrimitive.Content class={contentClass} sideOffset={2}>
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
