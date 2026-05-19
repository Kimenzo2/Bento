<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { onMount } from "svelte";
  import { goto } from "@mateothegreat/svelte5-router";
  import { toast } from "svelte-sonner";
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";

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
  const closeShortcut = $derived(isMac ? "" : "Alt+F4");
  const commandKey = $derived(isMac ? "⌘" : "Ctrl");
  const toggleLabel = $derived(isMaximized ? "Restore" : "Maximize");

  const contentClass =
    "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-44 rounded-[1rem] p-1.5 shadow-xl ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 z-[140] overflow-x-hidden overflow-y-auto outline-none";
  const appMenuContentClass = `${contentClass} min-w-64`;

  function openLogoMenu(event: MouseEvent | PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    logoMenuOpen = true;
  }

  function openRoute(path: string) {
    logoMenuOpen = false;
    void goto(path);
  }

  function openGlobalSettings() {
    logoMenuOpen = false;
    window.dispatchEvent(new CustomEvent("genesis:open-global-settings"));
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

  onMount(() => {
    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  });
</script>

<div class="window-shell__titlebar">
  <DropdownMenu bind:open={logoMenuOpen}>
    <DropdownMenuTrigger
      aria-label="Genesis app menu"
      class="window-shell__brand-trigger"
      type="button"
      onclick={openLogoMenu}
      onpointerdown={(event) => {
        if (event.button === 0) {
          openLogoMenu(event);
        }
      }}
    >
      <span class="window-shell__brand-mark" aria-hidden="true"></span>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" class={appMenuContentClass} sideOffset={8}>
      <DropdownMenuItem class="window-shell__menu-item" onclick={() => openRoute("/")}>
        <span class="window-shell__menu-item-label">Dashboard</span>
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => openRoute("/project/local")}>
        <span class="window-shell__menu-item-label">Open Project...</span>
        <DropdownMenuShortcut>{commandKey}+O</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => openRoute("/visual-studio")}>
        <span class="window-shell__menu-item-label">New AI Session</span>
        <DropdownMenuShortcut>{commandKey}+N</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuSeparator class="window-shell__menu-separator" />

      <DropdownMenuItem class="window-shell__menu-item" onclick={openGlobalSettings}>
        <span class="window-shell__menu-item-label">Settings...</span>
        <DropdownMenuShortcut>{commandKey}+,</DropdownMenuShortcut>
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
        <span class="window-shell__menu-item-label">About Genesis</span>
      </DropdownMenuItem>

      <DropdownMenuItem class="window-shell__menu-item" onclick={() => void onClose()}>
        <span class="window-shell__menu-item-label">Exit</span>
        {#if closeShortcut}
          <DropdownMenuShortcut>{closeShortcut}</DropdownMenuShortcut>
        {/if}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

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
