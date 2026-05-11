<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import BellIcon from "@lucide/svelte/icons/bell";
  import BotIcon from "@lucide/svelte/icons/bot";
  import CheckIcon from "@lucide/svelte/icons/check";
  import Grid2x2Icon from "@lucide/svelte/icons/grid-2x2";
  import MonitorCogIcon from "@lucide/svelte/icons/monitor-cog";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import XIcon from "@lucide/svelte/icons/x";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";
  import { activeModule, modules, switchModule } from "$lib/desktop/modules";
  import { fetchModuleRegistry, type ModuleRegistryEntry } from "$lib/desktop/installer";
  import { availableThemes, setMode, setTheme } from "$lib/stores/theme.store";
  import { toast } from "svelte-sonner";

  type SectionId = "appearance" | "apps" | "ai" | "notifications" | "privacy";

  const sections: Array<{ id: SectionId; label: string; icon: typeof MonitorCogIcon }> = [
    { id: "appearance", label: "Appearance", icon: MonitorCogIcon },
    { id: "apps", label: "Apps", icon: Grid2x2Icon },
    { id: "ai", label: "AI", icon: BotIcon },
    { id: "notifications", label: "Alerts", icon: BellIcon },
    { id: "privacy", label: "Privacy", icon: ShieldIcon },
  ];

  let open = $state(false);
  let activeSection = $state<SectionId>("appearance");
  let registry = $state<ModuleRegistryEntry[]>([]);
  let loadingRegistry = $state(false);

  function show() {
    open = true;
    void loadRegistry();
  }

  function hide() {
    open = false;
  }

  async function loadRegistry() {
    if (loadingRegistry || registry.length > 0) {
      return;
    }

    loadingRegistry = true;
    try {
      registry = await fetchModuleRegistry();
    } catch (error) {
      console.warn("[Genesis Desktop] Module registry failed to load", error);
      toast.error("Module registry failed to load.");
    } finally {
      loadingRegistry = false;
    }
  }

  async function selectBuiltin(moduleId: string) {
    const target = modules.find((entry) => entry.id === moduleId);
    if (!target) {
      toast.info("Installable modules are registered, but external bundle loading is not enabled in this UI yet.");
      return;
    }

    await switchModule(target.id);
    hide();
  }

  function handleKeydown(event: KeyboardEvent) {
    const shortcut = (event.metaKey || event.ctrlKey) && event.key === ",";
    if (!shortcut) {
      return;
    }

    event.preventDefault();
    open = !open;
    if (open) {
      void loadRegistry();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    const openSettings = () => show();
    window.addEventListener("genesis:open-global-settings", openSettings);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("genesis:open-global-settings", openSettings);
    };
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="global-settings" transition:fade={{ duration: 120 }} onkeydown={(event) => event.key === "Escape" && hide()}>
    <button class="global-settings__scrim" aria-label="Close Genesis settings" type="button" onclick={hide}></button>

    <section class="global-settings__panel" aria-label="Genesis global settings" transition:fly={{ y: 16, duration: 180 }}>
      <header class="global-settings__header">
        <div>
          <p class="global-settings__eyebrow">Genesis Shell</p>
          <h2>Global Settings</h2>
        </div>
        <button class="global-settings__close" type="button" aria-label="Close settings" onclick={hide}>
          <XIcon size={16} />
        </button>
      </header>

      <div class="global-settings__body">
        <nav class="global-settings__nav" aria-label="Settings sections">
          {#each sections as section}
            {@const Icon = section.icon}
            <button
              type="button"
              class:global-settings__nav-active={activeSection === section.id}
              onclick={() => {
                activeSection = section.id;
                if (section.id === "apps") void loadRegistry();
              }}
            >
              <Icon size={16} />
              <span>{section.label}</span>
            </button>
          {/each}
        </nav>

        <div class="global-settings__content">
          {#if activeSection === "appearance"}
            <div class="global-settings__section">
              <div class="global-settings__section-heading">
                <h3>Appearance</h3>
                <p>Stored through the Rust-backed Store plugin and mirrored into native window theme state.</p>
              </div>

              <div class="global-settings__segmented">
                <button
                  type="button"
                  class:global-settings__segment-active={$desktopSettings.appearance.mode === "light"}
                  onclick={() => void setMode("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  class:global-settings__segment-active={$desktopSettings.appearance.mode === "dark"}
                  onclick={() => void setMode("dark")}
                >
                  Dark
                </button>
              </div>

              <div class="global-settings__theme-grid">
                {#each availableThemes as theme}
                  <button
                    type="button"
                    class:global-settings__theme-active={$desktopSettings.appearance.themeId === theme.id}
                    onclick={() => void setTheme(theme.id)}
                  >
                    <span>{theme.name}</span>
                    {#if $desktopSettings.appearance.themeId === theme.id}
                      <CheckIcon size={15} />
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {:else if activeSection === "apps"}
            <div class="global-settings__section">
              <div class="global-settings__section-heading">
                <h3>Installed Apps</h3>
                <p>The shell stays mounted. Built-in apps route internally; future signed bundles load through the guarded module protocol.</p>
              </div>

              <div class="global-settings__apps">
                {#if loadingRegistry}
                  <p class="global-settings__muted">Loading registry...</p>
                {:else}
                  {#each registry as app}
                    <button type="button" class="global-settings__app-card" onclick={() => void selectBuiltin(app.id)}>
                      <span class="global-settings__app-accent" style={`--app-accent: ${app.accent}`}></span>
                      <span>
                        <strong>{app.name}</strong>
                        <small>{app.description}</small>
                      </span>
                      <em>{app.installed ? (app.id === $activeModule ? "Open" : "Launch") : "Locked"}</em>
                    </button>
                  {/each}
                {/if}
              </div>
            </div>
          {:else if activeSection === "ai"}
            <div class="global-settings__section">
              <div class="global-settings__section-heading">
                <h3>AI Runtime</h3>
                <p>Local shell streaming uses Tauri channels. Product provider wiring remains opt-in and explicit.</p>
              </div>
              <div class="global-settings__info-card">
                <strong>Streaming transport</strong>
                <span>Native Tauri channel, not local HTTP/EventSource.</span>
              </div>
            </div>
          {:else if activeSection === "notifications"}
            <div class="global-settings__section">
              <div class="global-settings__section-heading">
                <h3>Alerts</h3>
                <p>Background alerts are allowed only when background work exists.</p>
              </div>
              <label class="global-settings__toggle">
                <span>
                  <strong>Background alerts</strong>
                  <small>Permit native notifications for scheduled work.</small>
                </span>
                <input
                  type="checkbox"
                  checked={$desktopSettings.notifications.backgroundAlerts}
                  onchange={(event) => {
                    const checked = event.currentTarget.checked;
                    void updateDesktopSettings((current) => ({
                      ...current,
                      notifications: {
                        ...current.notifications,
                        backgroundAlerts: checked,
                      },
                    }));
                  }}
                />
              </label>
            </div>
          {:else if activeSection === "privacy"}
            <div class="global-settings__section">
              <div class="global-settings__section-heading">
                <h3>Privacy</h3>
                <p>Telemetry and remote crash upload stay disabled until the user consents.</p>
              </div>
              <div class="global-settings__info-card">
                <strong>Telemetry</strong>
                <span>{$desktopSettings.telemetry.consented ? "Enabled by consent" : "Off"}</span>
              </div>
              <div class="global-settings__info-card">
                <strong>Crash reports</strong>
                <span>{$desktopSettings.telemetry.crashReports ? "Remote upload allowed" : "Local files only"}</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </section>
  </div>
{/if}
